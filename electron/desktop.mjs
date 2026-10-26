import {app,BrowserWindow,ipcMain,screen,Tray,Menu,nativeImage,powerSaveBlocker,powerMonitor,globalShortcut,shell,dialog,clipboard,Notification,safeStorage,session,desktopCapturer} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {defaultSettings,settings,shortcuts,storageKeys,validateStorage,object,text,number,documentPath,boundsFor,outline,nativeMethods,validateNative} from './core.mjs';
import {Store} from './store.mjs';
import {NativeClient} from './native-client.mjs';
import {Credentials,ProviderServices} from './providers.mjs';
import {Spotify} from './spotify.mjs';
import {themes} from './appearance.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.dirname(here);
const smoke=process.argv.includes('--smoke-test');
const soak=process.argv.includes('--soak-test');
const dev=!app.isPackaged&&process.argv.includes('--dev');
const smokeRoot=process.env.SAPPHIRE_SMOKE_DIR??(app.isPackaged?path.join(app.getPath('temp'),'sapphire-smoke-'+process.pid):root);
const smokeOutput=path.join(smokeRoot,'.test-output');
if(smoke)app.setPath('userData',path.join(smokeRoot,'.smoke-profile'));
app.setAppUserModelId('tech.sapphire.windows');
const gotLock=app.requestSingleInstanceLock();
if(!gotLock)app.quit();
let window=null,tray=null,store,credentials,services,native,spotify;
let preferences={...defaultSettings},awakeId=null,quitting=false,dialogDepth=0,hotkey=null,polling=false,lastClipboard='';
let timer=null,lastMedia='',lastBattery='';
let cleanupPromise=null,cleanupComplete=false;
let suspended=false,rendererFailed=false,pendingShow=!smoke&&!process.argv.includes('--startup'),pendingTopic=null,trayError=null;
let pendingActivation=true,rendererReady=false,automaticRecoveryUsed=false,pendingData;
let requestedSize=null,lastShape=null;
let soakJob=null,soakRequested=soak;
function cleanupDesktop(){return cleanupPromise??=(async()=>{clearInterval(timer);services?.stopLive();spotify?.close();globalShortcut.unregisterAll();if(awakeId!==null){powerSaveBlocker.stop(awakeId);awakeId=null;}tray?.destroy();await native?.close();})();}
const reminders=new Set();
let shortcutItems=[];
const emit=(topic,data)=>{if(window&&!window.isDestroyed())window.webContents.send('desktop:event',{topic,data});};
const chosenDisplay=()=>screen.getAllDisplays().find(d=>d.id===preferences.displayId)??screen.getPrimaryDisplay();
const handle=()=>{const buffer=window.getNativeWindowHandle();return buffer.length===8?buffer.readBigUInt64LE().toString():buffer.readUInt32LE().toString();};
const entryURL=dev?'http://localhost:5173/':pathToFileURL(path.join(root,'dist','index.html')).href;
const trusted=event=>window&&event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame&&event.senderFrame.url===entryURL;
function assertTrusted(event){if(!trusted(event))throw new Error('This page is not allowed to control Sapphire.');}
function diagnostic(event,details={}){
 try{const directory=path.join(app.getPath('userData'),'diagnostics');fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,'lifecycle.jsonl');if(fs.existsSync(file)&&fs.statSync(file).size>256*1024)fs.renameSync(file,file+'.previous');fs.appendFileSync(file,JSON.stringify({at:new Date().toISOString(),event,...details})+'\n');}catch{/* Diagnostics must not prevent recovery when the disk is unavailable. */}
}
function place(width=requestedSize?.width??preferences.idleWidth,height=requestedSize?.height??preferences.idleHeight){
 if(!window||window.isDestroyed())return;const bounds=boundsFor(chosenDisplay(),width,height,preferences.notchStyle);requestedSize={width,height};const current=window.getBounds();if(Object.keys(bounds).some(key=>bounds[key]!==current[key]))window.setBounds(bounds);applyWindowPolicy();
 const expanded=height>120;const shapeKey=[bounds.width,bounds.height,expanded,preferences.notchStyle].join(':');try{if(shapeKey!==lastShape){window.setShape(outline(bounds.width,bounds.height,expanded?40:Math.min(12,height/2),preferences.notchStyle==='floating-island'?Math.min(24,height/2):0));lastShape=shapeKey;}}catch{/* shortcut: window shapes depend on Windows, renderer pointer routing remains available. */}
}
function applyWindowPolicy(value=preferences){if(!window||window.isDestroyed())return;window.setSkipTaskbar(true);window.setAlwaysOnTop(value.alwaysOnTop,'floating');}
function foregroundChanged(){if(!quitting&&!suspended&&!dialogDepth&&preferences.alwaysOnTop&&window&&!window.isDestroyed()&&window.isVisible()&&!window.isMinimized())applyWindowPolicy();}
function refreshWindow(){if(!window||window.isDestroyed())return;place();}
function recreateWindow(visible,activate=false,topic,data){
 pendingShow=visible;pendingActivation=activate;pendingTopic=topic??pendingTopic;rendererFailed=false;rendererReady=false;
 if(topic)pendingData=data;
 services?.stopLive();const previous=window;window=null;previous?.destroy();createWindow();
}
function show(topic,activate=true,data){if(topic){pendingTopic=topic;pendingData=data;}if(!window){pendingShow=true;pendingActivation=activate;return;}if(rendererFailed){automaticRecoveryUsed=false;recreateWindow(true,activate);return;}window.setIgnoreMouseEvents(false);refreshWindow();if(window.isMinimized())window.restore();if(activate)window.show();else window.showInactive();if(rendererReady&&pendingTopic){emit(pendingTopic,pendingData);pendingTopic=null;pendingData=undefined;}}
function hideWindow(){pendingShow=false;if(tray)window?.hide();else{if(window?.isMinimized())window.restore();window?.showInactive();emit('desktop-error',{message:trayError||'The tray is unavailable. The window will stay visible; restart Sapphire to retry.'});}}
function toggle(){if(window?.isVisible()&&!window.isMinimized())hideWindow();else show();}
function createTray(factory=icon=>new Tray(icon)){
 tray?.destroy();tray=null;
 try{const icon=nativeImage.createFromPath(path.join(root,'dist','sapphire.ico'));if(icon.isEmpty())throw new Error('Tray icon is missing.');tray=factory(icon);tray.setToolTip(smoke?'Sapphire test':'Sapphire');tray.on('click',()=>show());updateTray();trayError=null;}
 catch{tray?.destroy();tray=null;trayError='Sapphire could not create its tray icon. The window will remain accessible; restart Sapphire to retry.';window?.showInactive();emit('desktop-error',{message:trayError});}
}
function resumeDesktop(){suspended=false;refreshWindow();lastMedia='';lastBattery='';emit('system-resume');void poll();}
async function beginSoak(){if(!window)return;return soakJob??=(async()=>{const {startSoak}=await import(pathToFileURL(path.join(root,'scripts','soak.mjs')).href);return startSoak({app,window,powerMonitor,output:path.join(app.getPath('userData'),'diagnostics','soak')});})();}
function monitorExistingApp(){void beginSoak().catch(error=>emit('desktop-error',{message:'Reliability monitoring could not start: '+error.message}));}
async function withDialog(action){dialogDepth++;emit('dialog-state',true);try{return await action();}finally{dialogDepth--;emit('dialog-state',dialogDepth>0);}}
function notify(title,body){text(title,150);text(body,1000);if(!Notification.isSupported())throw new Error('Windows notifications are unavailable.');const notification=new Notification({title,body,icon:path.join(root,'dist','sapphire.ico')});notification.on('failed',()=>emit('desktop-error',{message:'Windows could not deliver this notification. Check Windows notification settings.'}));notification.show();emit('notification',{title,body});return{requested:true};}
function awake(enabled){if(typeof enabled!=='boolean')throw new Error('Invalid stay-awake setting.');if(enabled&&awakeId===null)awakeId=powerSaveBlocker.start('prevent-display-sleep');else if(!enabled&&awakeId!==null){powerSaveBlocker.stop(awakeId);awakeId=null;}emit('caffeinate',awakeId!==null);updateTray();return awakeId!==null;}
function updateTray(){
 if(!tray)return;tray.setContextMenu(Menu.buildFromTemplate([
 {label:rendererFailed?'Reload Sapphire':'Show Sapphire',click:()=>show()},
 {label:'Hide notch',click:hideWindow},
 {label:'Settings',click:()=>show('open-settings')},
 {label:'Always on top',type:'checkbox',checked:preferences.alwaysOnTop,click:item=>{try{saveSettings({...preferences,alwaysOnTop:item.checked});}catch(error){updateTray();emit('desktop-error',{message:error.message});}}},
 {label:'Keep awake',type:'checkbox',checked:awakeId!==null,click:item=>awake(item.checked)},
 {type:'separator'},{label:'Quit Sapphire',click:()=>{quitting=true;app.quit();}}
 ]));
}
function registerHotkey(next){if(next===hotkey)return;if(!globalShortcut.register(next,toggle))throw new Error('That shortcut is already in use. Choose another shortcut.');const old=hotkey;hotkey=next;if(old)globalShortcut.unregister(old);}
function saveSettings(value,persist=true){
 const next=settings(value),old=preferences;registerHotkey(next.hotkey);
 try{applyWindowPolicy(next);if(app.isPackaged&&!smoke&&!process.windowsStore)app.setLoginItemSettings({openAtLogin:next.startOnBoot,args:['--startup']});if(persist)store.set('sapphire_settings',next);}
 catch(error){applyWindowPolicy(old);if(app.isPackaged&&!smoke&&!process.windowsStore)app.setLoginItemSettings({openAtLogin:old.startOnBoot,args:['--startup']});if(next.hotkey!==old.hotkey){globalShortcut.unregister(next.hotkey);hotkey=null;registerHotkey(old.hotkey);}throw error;}
 preferences=next;place();updateTray();if(persist)emit('settings',next);return next;
}
function saveShortcuts(value,persist=true){
 const next=shortcuts(value),added=[];
 try{for(const item of next){if(item.accelerator.toLowerCase()===hotkey?.toLowerCase())throw new Error('That shortcut is already used to show Sapphire.');if(shortcutItems.some(old=>old.accelerator.toLowerCase()===item.accelerator.toLowerCase()))continue;if(!globalShortcut.register(item.accelerator,()=>{const current=shortcutItems.find(s=>s.accelerator.toLowerCase()===item.accelerator.toLowerCase());if(current){show();try{handlers['ai.action']({action:current.action});}catch(error){emit('desktop-error',{message:error.message});}}}))throw new Error(`${item.accelerator} is already in use.`);added.push(item.accelerator);}if(persist)store.set('sapphire_shortcuts',next);}
 catch(error){added.forEach(key=>globalShortcut.unregister(key));throw error;}
 for(const old of shortcutItems)if(!next.some(item=>item.accelerator.toLowerCase()===old.accelerator.toLowerCase()))globalShortcut.unregister(old.accelerator);shortcutItems=next;return next;
}
function currentFiles(){return(store.get('sapphire_stashed_files')??[]).map(file=>({...file,missing:!file.path||!fs.existsSync(file.path)}));}
function selectedFile(id){text(id,200);const file=currentFiles().find(f=>f.id===id);if(!file?.path||file.missing)throw new Error('This file is missing. Add it to the shelf again.');return file;}
function addFiles(paths){
 if(!Array.isArray(paths)||paths.length>200)throw new Error('Select up to 200 files.');let files=currentFiles();
 for(const filePath of paths){text(filePath,32768);if(!path.isAbsolute(filePath))throw new Error('Drop a local file.');const stat=fs.statSync(filePath);if(!stat.isFile()&&!stat.isDirectory())continue;if(files.some(f=>f.path===filePath))continue;files.push({id:crypto.randomUUID(),name:path.basename(filePath),path:filePath,size:stat.isDirectory()?'Folder':`${(stat.size/1024).toFixed(1)} KB`,type:stat.isDirectory()?'folder':path.extname(filePath).slice(1)||'file',dateAdded:new Date().toISOString()});}
 store.set('sapphire_stashed_files',files.slice(-200));emit('files',currentFiles());return currentFiles();
}
async function startDrag(id){const file=selectedFile(id);const icon=await app.getFileIcon(file.path,{size:'normal'});if(window&&!window.isDestroyed())window.webContents.startDrag({file:file.path,icon});return{started:true};}
function collectClipboard(){
 if(!preferences.clipboardEnabled)return;
 const formats=clipboard.availableFormats();if(formats.some(f=>/password|concealed|ExcludeClipboardContentFromMonitorProcessing/i.test(f)))return;
 const content=clipboard.readText();if(!content||content===lastClipboard||content.length>64000)return;lastClipboard=content;
 const prior=store.get('sapphire_clipboard_history')??[];
 const item={id:crypto.randomUUID(),content,type:/^https?:\/\//.test(content)?'url':'text',timestamp:new Date().toISOString()};
 store.set('sapphire_clipboard_history',[item,...prior.filter(i=>i.content!==content)].slice(0,200));emit('clipboard',store.get('sapphire_clipboard_history'));
}
function checkReminders(){
 const now=Date.now(),focus=store.get('sapphire_focus');
 if(focus){let next={...focus},changed=false;if(typeof focus.deadline==='number'&&now>=focus.deadline){notify('Sapphire timer',focus.mode==='break'?'Your break is complete.':'Your focus session is complete.');next.deadline=null;next.remaining=0;changed=true;}
 if(focus.eyeBreak&&typeof focus.eyeDeadline==='number'&&now>=focus.eyeDeadline){notify('Time for an eye break','Look at something 20 feet away for 20 seconds.');next.eyeDeadline=now+20*60000;changed=true;}if(changed){store.set('sapphire_focus',next);emit('focus',next);}}
 const calendar=store.get('sapphire_calendar');for(const event of(Array.isArray(calendar)?calendar:calendar?.events??[])){
  const start=Date.parse(event.start),key=`${event.id}:${event.start}`;if(Number.isFinite(start)&&now>=start-5*60000&&now<start+60000&&!reminders.has(key)){reminders.add(key);notify(event.title,event.allDay?'Today':`Starts ${new Date(start).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`);}
 }
}
async function poll(){
 if(polling||quitting||dialogDepth||suspended)return;polling=true;
 try{
  collectClipboard();checkReminders();
  const [media,battery]=await Promise.allSettled([native.call('media.get'),native.call('battery.get')]);
  if(media.status==='fulfilled'){const value=JSON.stringify(media.value);if(value!==lastMedia){lastMedia=value;emit('media',media.value);}}
  else if(lastMedia!=='null'){lastMedia='null';emit('media',null);}
  if(battery.status==='fulfilled'){const value=JSON.stringify(battery.value);if(value!==lastBattery){lastBattery=value;emit('battery',battery.value);}}
 }catch(error){emit('desktop-error',{message:error.message});}finally{polling=false;}
}
async function capture(){
 return withDialog(async()=>{
  const sources=await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:1600,height:1000},fetchWindowIcons:false});
  const available=sources.filter(s=>s.name!=='Sapphire');if(!available.length)throw new Error('No screen or window is available to capture.');
  const choice=await dialog.showMessageBox(window,{type:'question',title:'Share a screen or window',message:'Choose what to share with Blip',detail:'The selected image stays local until you send it. It can contain private information.',buttons:[...available.slice(0,12).map(s=>s.name),'Cancel'],cancelId:Math.min(available.length,12),noLink:true});
  if(choice.response>=Math.min(available.length,12))return{cancelled:true};
  const image=available[choice.response].thumbnail;if(image.isEmpty())throw new Error('Windows could not capture this window.');return{dataUrl:image.toDataURL(),...image.getSize()};
 });
}
const handlers={
 'desktop.bootstrap':async()=>{
  const results=await Promise.allSettled([native.call('native.capabilities'),native.call('media.get'),native.call('battery.get')]);
  return{settings:preferences,storage:store.data,storageError:store.error,capabilities:results[0].status==='fulfilled'?results[0].value:{native:{available:false,reason:results[0].reason.message}},media:results[1].status==='fulfilled'?results[1].value:null,battery:results[2].status==='fulfilled'?results[2].value:{available:false,percent:null,charging:false},clipboardEnabled:preferences.clipboardEnabled,startupManagedByWindows:!!process.windowsStore,serviceKeys:credentials.status(),displays:screen.getAllDisplays().map((d,index)=>({id:d.id,label:`${d.label||`Display ${index+1}`} (${d.size.width} × ${d.size.height})`})),version:app.getVersion()};
 },
 'settings.save':p=>saveSettings(p.settings),
 'shell.ready':()=>{rendererReady=true;if(trayError)emit('desktop-error',{message:trayError});if(pendingTopic){emit(pendingTopic,pendingData);pendingTopic=null;pendingData=undefined;}return{ready:true};},
 'shortcuts.list':()=>shortcutItems,
 'shortcuts.save':p=>saveShortcuts(p.shortcuts),
 'shell.resize':p=>{place(number(p.width,100,1200,'Width'),number(p.height,20,1000,'Height'));return{resized:true};},
 'shell.setInteractive':p=>{if(typeof p.interactive!=='boolean')throw new Error('Invalid mouse state.');window.setIgnoreMouseEvents(!p.interactive,{forward:true});return{interactive:p.interactive};},
 'shell.hide':()=>{hideWindow();return{hidden:!window.isVisible()};},
 'shell.minimize':()=>{window.minimize();return{minimized:true};},
 'shell.openSettings':()=>{show('open-settings');return{opened:true};},
 'shell.display':p=>{if(!screen.getAllDisplays().some(d=>d.id===p.displayId))throw new Error('That display is no longer available.');return saveSettings({...preferences,displayId:p.displayId});},
 'shell.notify':p=>notify(p.title,p.body),
 'shell.capture':()=>capture(),
 'shell.openExternal':async p=>{const url=new URL(text(p.url,2000));if(url.protocol!=='https:'||!['github.com','sapphire-app.tech','www.android.com','support.google.com','aistudio.google.com','finnhub.io','api-sports.io','lrclib.net','accounts.spotify.com','developer.spotify.com'].includes(url.hostname)||url.username||url.password)throw new Error('This external link is not allowed.');await shell.openExternal(url.href);return{opened:true};},
 'shell.openStartupSettings':async()=>{await shell.openExternal('ms-settings:startupapps');return{opened:true};},
 'shell.openSignInSettings':async()=>{await shell.openExternal('ms-settings:signinoptions');return{opened:true};},
 'shell.openBluetoothSettings':async()=>{await shell.openExternal('ms-settings:bluetooth');return{opened:true};},
 'shell.quickShare':async()=>{const candidates=[path.join(process.env.ProgramFiles??'C:\\Program Files','Google','NearbyShare','nearby_share.exe'),path.join(process.env.LOCALAPPDATA??'','Google','NearbyShare','nearby_share.exe')];const executable=candidates.find(p=>fs.existsSync(p));if(!executable)throw new Error('Google Quick Share is not installed. Install it from android.com/quick-share/with-windows-pc, then drag shelf files into its window.');const error=await shell.openPath(executable);if(error)throw new Error('Quick Share could not open. Start it from the Windows Start menu.');return{opened:true};},
 'storage.get':p=>{if(!storageKeys.has(p.key))throw new Error('Unknown storage key.');return store.get(p.key);},
 'storage.save':p=>{if(p.key==='sapphire_settings')return saveSettings(p.value);if(p.key==='sapphire_shortcuts')return saveShortcuts(p.value);return store.set(p.key,p.value);},
 'storage.export':()=>withDialog(async()=>{const result=await dialog.showSaveDialog(window,{title:'Export Sapphire data',defaultPath:'sapphire-backup.json',filters:[{name:'Sapphire backup',extensions:['json']}]});if(result.canceled||!result.filePath)return{cancelled:true};fs.writeFileSync(result.filePath,JSON.stringify(store.export(),null,2),{mode:0o600});return{cancelled:false,path:result.filePath};}),
 'storage.import':()=>withDialog(async()=>{const result=await dialog.showOpenDialog(window,{title:'Import Sapphire data',properties:['openFile'],filters:[{name:'Sapphire backup',extensions:['json']}]});if(result.canceled)return{cancelled:true};const filename=result.filePaths[0];if(fs.statSync(filename).size>32*1024*1024)throw new Error('This backup is too large.');let input;try{input=JSON.parse(fs.readFileSync(filename,'utf8'));}catch{throw new Error('This backup contains invalid JSON. Existing data was preserved.');}store.import(input,incoming=>{const old=preferences,oldShortcuts=shortcutItems;const rollback=()=>{saveShortcuts([],false);saveSettings(old,false);saveShortcuts(oldShortcuts,false);};try{saveShortcuts([],false);saveSettings(incoming.sapphire_settings??old,false);saveShortcuts(incoming.sapphire_shortcuts??oldShortcuts,false);}catch(error){rollback();throw error;}return rollback;});emit('settings',preferences);emit('storage',store.data);return{cancelled:false,imported:true,data:store.data};}),
 'credentials.status':()=>credentials.status(),
 'credentials.set':p=>credentials.set(p.provider,p.key),
 'power.awake':p=>awake(p.enabled),
 'clipboard.list':()=>store.get('sapphire_clipboard_history')??[],
 'clipboard.enable':p=>{if(typeof p.enabled!=='boolean')throw new Error('Invalid clipboard preference.');lastClipboard=clipboard.readText();saveSettings({...preferences,clipboardEnabled:p.enabled});return{enabled:p.enabled};},
 'clipboard.copy':p=>{clipboard.writeText(text(p.content,200000));return{copied:true};},
 'clipboard.clear':()=>{store.set('sapphire_clipboard_history',[]);lastClipboard=clipboard.readText();emit('clipboard',[]);return{cleared:true};},
 'files.list':()=>currentFiles(),
 'files.pick':()=>withDialog(async()=>{const result=await dialog.showOpenDialog(window,{properties:['openFile','multiSelections']});return result.canceled?currentFiles():addFiles(result.filePaths);}),
 'files.add':p=>addFiles(p.paths),
 'files.remove':p=>{text(p.id,200);store.set('sapphire_stashed_files',currentFiles().filter(f=>f.id!==p.id));emit('files',currentFiles());return currentFiles();},
 'files.open':async p=>{const file=selectedFile(p.id);const error=await shell.openPath(documentPath(file.path));if(error)throw new Error('Windows could not open this file.');return{opened:true};},
 'files.reveal':p=>{shell.showItemInFolder(selectedFile(p.id).path);return{shown:true};},
 'files.drag':p=>startDrag(p.id),
 'finance.quote':p=>services.quote(p),
 'sports.scores':p=>services.scores(p),
 'ai.chat':p=>services.chat(p),
 'ai.live':p=>services.liveInput(p),
 'spotify.status':()=>spotify.status(),
 'spotify.connect':p=>withDialog(()=>spotify.connect(p.clientId)),
 'spotify.disconnect':()=>spotify.disconnect(),
 'spotify.queue':()=>spotify.queue(),
 'spotify.play':p=>spotify.play(p.uri),
 'ai.action':p=>{const action=object(p.action);const tabs={open_files:'fileshelf',open_notes:'notes',show_weather:'weather',open_calendar:'calendar'};if(action.name==='set_caffeinate')return{active:awake(object(action.args).enabled)};if(!Object.hasOwn(tabs,action.name))throw new Error('This action is not supported.');show('open-widget',true,tabs[action.name]);return{opened:true};},
};
for(const method of nativeMethods)handlers[method]=async p=>{validateNative(method,p);if(method==='hello.verify')p={...p,windowHandle:handle()};const call=()=>native.call(method,p);return await(['hello.verify','notifications.access'].includes(method)?withDialog(call):call());};

function createWindow(){
 rendererReady=false;requestedSize=null;lastShape=null;
 const icon=path.join(root,'dist','sapphire.ico');
 window=new BrowserWindow({title:'Sapphire',...boundsFor(chosenDisplay(),preferences.idleWidth,preferences.idleHeight,preferences.notchStyle),frame:false,transparent:true,backgroundColor:'#00000000',alwaysOnTop:preferences.alwaysOnTop,skipTaskbar:true,resizable:false,hasShadow:false,show:false,icon,webPreferences:{preload:path.join(here,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,backgroundThrottling:false}});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.webContents.on('will-navigate',(event,url)=>{if(url!==entryURL)event.preventDefault();});
 window.webContents.on('will-attach-webview',event=>event.preventDefault());
 // The renderer delays blur collapse and cancels it when focus returns.
 window.on('close',event=>{if(!quitting){event.preventDefault();hideWindow();}});
 window.on('session-end',()=>{quitting=true;void cleanupDesktop();});
 window.on('restore',refreshWindow);
 window.on('show',()=>applyWindowPolicy());
 window.on('blur',foregroundChanged);
 window.on('minimize',()=>hideWindow());
 const current=window;
 window.webContents.on('render-process-gone',(_event,details)=>{
  if(quitting||window!==current)return;rendererFailed=true;rendererReady=false;services.stopLive();diagnostic('renderer-gone',{reason:details.reason,exitCode:details.exitCode});updateTray();
  // One automatic recovery per app run; subsequent failures require a user retry.
  if(!automaticRecoveryUsed){automaticRecoveryUsed=true;setImmediate(()=>{if(!quitting&&window===current&&rendererFailed)recreateWindow(current.isVisible()&&!current.isMinimized());});}
 });
 window.webContents.on('did-fail-load',(_event,code,_description,_url,isMainFrame)=>{if(isMainFrame&&code!==-3&&window===current){rendererFailed=true;diagnostic('load-failed',{code});updateTray();}});
 window.on('unresponsive',()=>{rendererFailed=true;diagnostic('renderer-unresponsive');updateTray();});
 window.on('responsive',()=>{rendererFailed=false;updateTray();});
 window.webContents.on('did-start-loading',()=>{rendererReady=false;});
 window.webContents.on('did-finish-load',()=>{refreshWindow();updateTray();if(soakRequested)monitorExistingApp();});
 window.once('ready-to-show',()=>{refreshWindow();if(pendingShow){pendingShow=false;if(rendererFailed){if(pendingActivation)current.show();else current.showInactive();}else show(undefined,pendingActivation);}else if(!tray)window.showInactive();});
 if(dev)window.loadURL('http://localhost:5173');else window.loadFile(path.join(root,'dist','index.html'));
 if(!tray)createTray();
}
app.on('second-instance',(_event,commandLine)=>{if(commandLine.includes('--startup'))return;if(commandLine.includes('--soak-test')){soakRequested=true;if(window&&!window.webContents.isLoading())monitorExistingApp();return;}show();window?.restore();});
app.on('before-quit',event=>{quitting=true;if(!cleanupComplete){event.preventDefault();void cleanupDesktop().finally(()=>{cleanupComplete=true;app.quit();});}});
app.on('window-all-closed',()=>{if(quitting)app.quit();});
if(gotLock)app.whenReady().then(async()=>{
 store=new Store(app.getPath('userData'));preferences=settings(store.get('sapphire_settings')??{});
 try{credentials=new Credentials(app.getPath('userData'),safeStorage);}catch(error){dialog.showErrorBox('Sapphire credential storage',error.message);app.quit();return;}
 services=new ProviderServices(credentials,emit);
 spotify=new Spotify(credentials,url=>shell.openExternal(url));
 native=new NativeClient(app.isPackaged?path.join(process.resourcesPath,'native','Sapphire.Native.exe'):path.join(root,'native','publish','win-x64','Sapphire.Native.exe'),undefined,foregroundChanged);
 session.defaultSession.setPermissionRequestHandler((contents,permission,callback,details)=>callback(contents===window?.webContents&&details.isMainFrame!==false&&permission==='media'));
 session.defaultSession.setPermissionCheckHandler((contents,permission)=>contents===window?.webContents&&permission==='media');
 ipcMain.handle('desktop:invoke',async(event,method,params={})=>{assertTrusted(event);if(typeof method!=='string'||!Object.hasOwn(handlers,method))throw new Error('Unknown desktop command.');object(params);if(Buffer.byteLength(JSON.stringify(params))>6*1024*1024)throw new Error('Request is too large.');return handlers[method](params);});
 ipcMain.on('desktop:drag',(event,id)=>{try{assertTrusted(event);void startDrag(id).catch(error=>emit('desktop-error',{message:error.message}));}catch{}});
 createWindow();try{registerHotkey(preferences.hotkey);}catch(error){emit('desktop-error',{message:error.message});}
 if(app.isPackaged&&!smoke&&!process.windowsStore&&preferences.startOnBoot){try{app.setLoginItemSettings({openAtLogin:true,args:['--startup']});}catch{trayError='Windows startup registration could not be refreshed. Check Startup apps in Settings.';}}
 try{saveShortcuts(store.get('sapphire_shortcuts')??[],false);}catch(error){emit('desktop-error',{message:error.message});}
 screen.on('display-added',refreshWindow);screen.on('display-removed',refreshWindow);screen.on('display-metrics-changed',refreshWindow);
 powerMonitor.on('suspend',()=>{suspended=true;services.stopLive();emit('ai-live-state',{state:'disconnected'});});
 powerMonitor.on('resume',resumeDesktop);powerMonitor.on('unlock-screen',resumeDesktop);
 timer=setInterval(()=>{void poll();},1500);timer.unref();
 if(smoke){window.webContents.once('did-finish-load',()=>{setTimeout(async()=>{
  try{fs.mkdirSync(smokeOutput,{recursive:true});const bootstrap=await window.webContents.executeJavaScript("window.electronAPI.invoke('desktop.bootstrap')");
   const bridge=await window.webContents.executeJavaScript('Boolean(window.electronAPI?.invoke)');if(!bridge)throw new Error('Preload bridge failed.');
   const screenshot=await window.webContents.capturePage();fs.writeFileSync(path.join(smokeOutput,'notch.png'),screenshot.toPNG());
   const runtime={bridge,sandbox:window.webContents.getLastWebPreferences().sandbox,bounds:window.getBounds(),capabilities:bootstrap.capabilities,hasTray:!!tray,hotkey:globalShortcut.isRegistered(preferences.hotkey),electron:process.versions.electron};
   if(process.argv.includes('--smoke-restart')){
    if(preferences.theme!=='paper'||preferences.motionPreference!=='reduced'||preferences.accentColor!=='#abcdef')throw new Error('Appearance did not survive process restart.');
    if(await window.webContents.executeJavaScript("document.querySelector('main').dataset.theme")!=='paper')throw new Error('Persisted theme was not rendered after restart.');
    runtime.themeRestartPersistence=true;
    if(preferences.alwaysOnTop!==false||window.isAlwaysOnTop())throw new Error('Disabled always-on-top preference did not survive process restart.');
    saveSettings({...preferences,alwaysOnTop:true});show();
    if(!window.isAlwaysOnTop()||!window.isVisible())throw new Error('Enabling always on top after restart failed.');
    runtime.restartPersistence=true;runtime.nativePid=native.child?.pid;
    fs.writeFileSync(path.join(smokeOutput,'desktop-smoke.json'),JSON.stringify(runtime,null,2));console.log('SAPPHIRE_DESKTOP_SMOKE_OK restart');app.quit();return;
   }
   const {runWindowOrderSmoke,runLifecycleSmoke,runSecondInstanceSmoke}=await import(pathToFileURL(path.join(root,'scripts','lifecycle-smoke.mjs')).href);
   runtime.lifecycle=await runLifecycleSmoke(window,{show,refresh:resumeDesktop,failTray:()=>createTray(()=>{throw new Error('Owned tray failure fixture');}),restoreTray:createTray});
   runtime.secondInstance=await runSecondInstanceSmoke(window,app,root,smokeRoot);
   runtime.stacking=await runWindowOrderSmoke(window,BrowserWindow,refreshWindow,foregroundChanged);
   const {runPolicySmoke,runRecoverySmoke}=await import(pathToFileURL(path.join(root,'scripts','reliability-smoke.mjs')).href);
   runtime.policy=await runPolicySmoke(window,{screen,place,refresh:refreshWindow,saveSettings,getPreferences:()=>preferences,store});
   console.log('SAPPHIRE_STACKING '+JSON.stringify(runtime.stacking));
   if(!runtime.sandbox||!runtime.hasTray||!runtime.hotkey)throw new Error('Desktop host smoke checks failed.');
   show();window.focus();const {runRendererSmoke}=await import(pathToFileURL(path.join(root,'scripts','renderer-smoke.mjs')).href);runtime.renderer=await runRendererSmoke(window);
   const {runMotionSmoke,runStorageFailureSmoke,runAppearanceSmoke,runDismissalSmoke}=await import(pathToFileURL(path.join(root,'scripts','motion-smoke.mjs')).href);
   runtime.motion=await runMotionSmoke(window);runtime.storageFailure=await runStorageFailureSmoke(window,store);
   runtime.appearance=await runAppearanceSmoke(window,themes);runtime.dismissal=await runDismissalSmoke(window);
   const boundary=await window.webContents.executeJavaScript("(async()=>{let rejected=0;for(const [method,params]of [['shell.exec',{}],['audio.volume',{id:'invalid',volume:2}],['ai.action',{action:{name:'constructor'}}]])try{await window.electronAPI.invoke(method,params);}catch{rejected++;}return rejected;})()");if(boundary!==3)throw new Error('Renderer command validation failed.');runtime.invalidCommandsRejected=boundary;
   runtime.recovery=await runRecoverySmoke({getWindow:()=>window,ready:()=>rendererReady,show,recreate:recreateWindow,emit,BrowserWindow});
   const fixture=path.join(smokeOutput,'shelf-fixture.txt');fs.writeFileSync(fixture,'Sapphire smoke fixture');const files=addFiles([fixture]);if(!files.some(f=>f.path===fixture&&!f.missing))throw new Error('File shelf persistence failed.');runtime.fileReference=true;
   const note='Desktop persistence smoke fixture';store.set('sapphire_quick_notes',note);if(new Store(app.getPath('userData')).get('sapphire_quick_notes')!==note)throw new Error('Desktop persistence failed.');runtime.persistence=true;
   const credentialDirectory=fs.mkdtempSync(path.join(smokeOutput,'credential-fixture-'));const protectedKeys=new Credentials(credentialDirectory,safeStorage);const fixtureKey='SAPPHIRE_NON_SECRET_SMOKE_FIXTURE';protectedKeys.set('gemini',fixtureKey);if(protectedKeys.get('gemini')!==fixtureKey||fs.readFileSync(protectedKeys.file,'utf8').includes(fixtureKey))throw new Error('Windows-protected credential storage failed.');fs.unlinkSync(protectedKeys.file);fs.rmdirSync(credentialDirectory);runtime.protectedStorage=true;
   const oldHelper=native.child;oldHelper?.kill();await new Promise(resolve=>oldHelper?oldHelper.once('exit',resolve):resolve());await native.call('battery.get');runtime.helperRecovery=true;
   window.minimize();window.restore();show('open-settings');await new Promise(resolve=>setTimeout(resolve,1200));if(!window.isVisible()||window.isMinimized())throw new Error('Taskbar restoration failed.');runtime.windowRestore=true;
   fs.writeFileSync(path.join(smokeOutput,'settings.png'),(await window.webContents.capturePage()).toPNG());
   awake(true);if(!powerSaveBlocker.isStarted(awakeId))throw new Error('Stay-awake request failed.');awake(false);
   runtime.nativePid=native.child?.pid;runtime.displays=screen.getAllDisplays().map(display=>({bounds:display.bounds,scaleFactor:display.scaleFactor}));
   saveSettings({...preferences,alwaysOnTop:false,theme:'paper',motionPreference:'reduced',accentColor:'#abcdef'});
   fs.writeFileSync(path.join(smokeOutput,'desktop-smoke.json'),JSON.stringify(runtime,null,2));console.log('SAPPHIRE_DESKTOP_SMOKE_OK '+JSON.stringify(runtime));quitting=true;app.quit();
  }catch(error){console.error('SAPPHIRE_DESKTOP_SMOKE_FAILED '+error.message);quitting=true;await cleanupDesktop();app.exit(1);}
 },2500);});}
}).catch(error=>{console.error('Sapphire could not start: '+error.message);app.exit(1);});
