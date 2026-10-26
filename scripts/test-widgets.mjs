// Real renderer and preload, disposable storage, explicit fake Windows/provider responses.
// No credentials, clipboard contents, files or hardware from the user's account are accessed.
import {app,BrowserWindow,ipcMain} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {defaultSettings} from '../electron/core.mjs';
const output=path.resolve('.test-output/widgets');fs.mkdirSync(output,{recursive:true});
app.setPath('userData',fs.mkdtempSync(path.join(output,'profile-')));
const data={sapphire_settings:{...defaultSettings,appearanceIntroSeen:true,autoCollapseSeconds:0,motionPreference:'reduced'},sapphire_quick_notes:'Saved fixture'};
let window,fail='',clipboardEnabled=false,clipboard=[{id:'clip',content:'Owned clipboard fixture'}],files=[],calls=[],audio={sessions:[{id:'owned',name:'Owned audio',volume:.5,isMuted:false}],devices:[]};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const emit=(topic,value)=>window.webContents.send('desktop:event',{topic,data:value});
ipcMain.handle('desktop:invoke',async(_event,method,p={})=>{
 calls.push(method);if(method===fail)throw new Error('Owned failure. Retry this action.');
 switch(method){
  case 'desktop.bootstrap':return{settings:data.sapphire_settings,storage:data,version:'1.2.0',media:null,battery:{percent:null},serviceKeys:{gemini:false,finnhub:false,sports:false},clipboardEnabled,displays:[],capabilities:{}};
  case 'shell.ready':case 'shell.resize':case 'shell.openExternal':return{};
  case 'storage.save':data[p.key]=p.value;return p.value;
  case 'settings.save':data.sapphire_settings=p.settings;emit('settings',p.settings);return p.settings;
  case 'storage.export':case 'storage.import':case 'files.pick':case 'shell.capture':return{cancelled:true};
  case 'spotify.status':return{connected:false};
  case 'audio.get':return structuredClone(audio);
  case 'audio.volume':await pause(120);audio.sessions[0]={...audio.sessions[0],volume:p.volume,isMuted:p.muted??audio.sessions[0].isMuted};return{};
  case 'files.list':return files;
  case 'files.remove':files=files.filter(f=>f.id!==p.id);return{};
  case 'clipboard.list':return clipboard;
  case 'clipboard.enable':clipboardEnabled=p.enabled;return{};
  case 'clipboard.clear':clipboard=[];return{};
  case 'clipboard.copy':return{};
  case 'hello.availability':return{available:false,status:'Unavailable',reason:'Windows Hello is unavailable in this fixture.',faceEnrolled:false};
  case 'snap.apply':return{message:'Owned window arranged.'};
  case 'battery.get':return{percent:null,available:false};
  case 'brightness.get':return{value:null};
  case 'bluetooth.list':case 'shortcuts.list':return[];
  case 'finance.quote':return{quotes:[{symbol:'OWNED',c:12.34,d:1,dp:2,t:1}]};
  case 'ai.chat':throw new Error('Needs setup. Add a Gemini API key in Settings → Connections.');
  default:throw new Error('Unexpected fixture call: '+method);
 }
});
const evaluate=async code=>{
 const value=await window.webContents.executeJavaScript(`(async()=>{try{return await (${code})}catch(e){return{probeError:String(e.stack)}}})()`).catch(error=>{throw new Error(error.message+' in '+code)});
 if(value?.probeError)throw new Error(value.probeError);return value;
};
const click=async selector=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await pause(90);};
const text=()=>evaluate('document.body.innerText');
const input=async(selector,value)=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await pause(60);};
const route=async id=>{if(!await evaluate(`!!document.getElementById('tab-${id}')`))await click('#all-tools-toggle');await click('#tab-'+id);assert(await evaluate('!!document.querySelector("#notch-widget-panel > *")'),id+' mounted');};
const checks=[];
const deadline=setTimeout(()=>app.exit(1),60000);
void(async()=>{try{
 await app.whenReady();window=new BrowserWindow({width:800,height:600,show:false,webPreferences:{preload:path.resolve('dist-electron/preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,offscreen:true}});
 await window.loadFile(path.resolve('dist/index.html'));await pause(500);await click('.notch-idle-open');
 for(const id of ['media','notes','focus','fileshelf','audio','calendar','weather','clipboard','snapzones','blip','search','finance','faceid','system','settings']){await route(id);assert(!(await text()).includes('This widget could not open'),id+' error boundary');}
 checks.push('All 15 tools mount with empty/unavailable fixtures');
 await route('notes');fail='storage.save';await input('textarea','Unsaved fixture');assert((await text()).includes('Your text is still in the editor'));assert.equal(data.sapphire_quick_notes,'Saved fixture');assert.equal(await evaluate('document.querySelector("textarea").value'),'Unsaved fixture');fail='';await click('section[aria-label="Quick notes"] [role="alert"] button');assert.equal(data.sapphire_quick_notes,'Unsaved fixture');checks.push('Notes failure preserves editor; explicit retry saves latest text');
 await route('clipboard');assert.equal(clipboardEnabled,false);await click('section[aria-label="Clipboard history"] button[aria-pressed]');assert.equal(clipboardEnabled,true);await input('input[aria-label="Search clipboard"]','nothing matches');assert((await text()).includes('No matching text'));await input('input[aria-label="Search clipboard"]','');await click('button[aria-label="Clear clipboard history"]');assert.equal(clipboard.length,1);await click('[data-clipboard-cancel]');assert.equal(clipboard.length,1);await click('button[aria-label="Clear clipboard history"]');fail='clipboard.clear';await click('[data-clipboard-confirm]');assert.equal(clipboard.length,1);fail='';await click('[data-clipboard-confirm]');assert.equal(clipboard.length,0);checks.push('Clipboard opt-in, empty search, clear cancellation and failed clear');
 await route('fileshelf');await click('section[aria-label="File shelf"] button');assert.equal(files.length,0);files=[{id:'file',name:'owned.txt',path:'C:\\fixture\\owned.txt',missing:true}];await route('notes');await route('fileshelf');assert.equal(await evaluate('document.querySelector("button[aria-label=\\\"Open owned.txt\\\"]").disabled'),true);fail='files.remove';await click('button[aria-label="Remove owned.txt from shelf"]');assert.equal(files.length,1);fail='';await click('button[aria-label="Remove owned.txt from shelf"]');assert.equal(files.length,0);checks.push('Files cancellation, missing-file state and failed removal');
 await route('calendar');await evaluate(`(()=>{const d=new Date();const day=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('');const transfer=new DataTransfer();transfer.items.add(new File(['BEGIN:VCALENDAR\\nBEGIN:VEVENT\\nUID:owned\\nDTSTART;VALUE=DATE:'+day+'\\nSUMMARY:Owned event\\nEND:VEVENT\\nEND:VCALENDAR'],'owned.ics',{type:'text/calendar'}));const e=document.querySelector('input[type=file]');e.files=transfer.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await pause(100);assert.equal(data.sapphire_calendar.events.length,1);await route('notes');await route('calendar');assert((await text()).includes('Owned event'));fail='storage.save';await click('button[aria-label="Remove Owned event"]');assert.equal(data.sapphire_calendar.events.length,1);fail='';checks.push('Calendar import, remount persistence and failed removal');
 await route('focus');fail='storage.save';await click('section[aria-label="Focus and stay awake"] .grid button.glass-button');assert.equal(data.sapphire_focus,undefined);fail='';await click('section[aria-label="Focus and stay awake"] .grid button.glass-button');assert(data.sapphire_focus.deadline>Date.now());await click('section[aria-label="Focus and stay awake"] .grid button.glass-button');assert.equal(data.sapphire_focus.deadline,null);checks.push('Focus failed start, start and pause persistence');
 await route('audio');const before=calls.filter(c=>c==='audio.get').length;await pause(1600);assert(calls.filter(c=>c==='audio.get').length>before);await route('notes');const after=calls.filter(c=>c==='audio.get').length;await pause(1600);assert.equal(calls.filter(c=>c==='audio.get').length,after);checks.push('Audio polling stops on unmount');
 await route('blip');await input('input[aria-label="Message Blip"]','Owned question');await click('button[aria-label="Send message"]');assert((await text()).includes('Needs setup'));await route('search');await click('section[aria-label="Circle to search"] button');assert.equal(await evaluate('!!document.querySelector("img[alt^=\\\"Screen capture\\\"]")'),false);checks.push('Blip setup failure; screen capture cancellation');
 await route('finance');await input('input[aria-label="Stock symbols"]','OWNED');await click('button[aria-label="Refresh"]');assert((await text()).includes('12.34'));fail='finance.quote';await click('button[aria-label="Refresh"]');assert((await text()).includes('12.34'));assert((await text()).includes('Previous results remain visible'));fail='';checks.push('Provider results survive refresh failure');
 await route('snapzones');fail='snap.apply';await click('section[aria-label="Snap zones"] button');assert((await text()).includes('Retry this action'));fail='';await click('section[aria-label="Snap zones"] button');assert((await text()).includes('Owned window arranged'));await route('faceid');assert.equal(await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Test Windows Hello").disabled'),true);checks.push('Snap failure and recovery; unavailable Hello cannot claim verification');
 await route('settings');await click('#settings-nav-privacy');await click('#settings-panel-privacy button');assert(!(await text()).includes('Data exported.'));await click('#settings-nav-connections');assert((await text()).includes('Needs setup'));assert(!(await text()).includes('Connected successfully'));await click('#settings-nav-about');assert((await text()).includes('1.2.0'));checks.push('Cancelled export has no success message; provider setup status; About version');
 await click('#settings-nav-appearance');
 for(const factor of [1,1.25,1.5,2]){window.webContents.setZoomFactor(factor);await pause(100);assert(await evaluate('(()=>{const b=document.getElementById("all-tools-toggle").getBoundingClientRect();return b.left>=0&&b.right<=innerWidth})()'),'navigation at zoom '+factor);await click('#all-tools-toggle');assert(await evaluate('document.getElementById("all-tools-picker").scrollHeight>=document.getElementById("all-tools-picker").clientHeight'));await click('button[aria-label="Close all tools"]');}
 window.webContents.setZoomFactor(1);window.webContents.debugger.attach('1.3');
 for(const feature of [{name:'forced-colors',value:'active'},{name:'prefers-contrast',value:'more'},{name:'prefers-reduced-transparency',value:'reduce'}]){await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[feature]});await pause(80);assert.notEqual(await evaluate('getComputedStyle(document.querySelector(".notch-header")).backgroundColor'),'rgba(0, 0, 0, 0)');}
 await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[]});window.webContents.debugger.detach();checks.push('Navigation at 100/125/150/200% browser zoom; solid contrast/transparency treatments');
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,scope:'Synthetic renderer fixtures, not real providers or hardware',checks},null,2));console.log(JSON.stringify({passed:true,checks}));
}catch(error){console.error(error.stack);app.once('will-quit',()=>app.exit(1));}finally{clearTimeout(deadline);app.quit();}})();
