// Run with Electron, from a built checkout. Only synthetic, isolated profile data is used.
import {app, BrowserWindow} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const label=process.argv[2]??'candidate';
assert.match(label,/^[a-z0-9-]+$/);
const output=path.resolve('.test-output','visible-'+label);
const profile=path.join(output,'profile');
fs.mkdirSync(profile,{recursive:true});
fs.writeFileSync(path.join(profile,'sapphire-data.json'),JSON.stringify({format:'sapphire-desktop',version:1,data:{sapphire_settings:{hotkey:'Ctrl+Alt+Shift+V',autoCollapseSeconds:0,appearanceIntroSeen:true},sapphire_quick_notes:'Visible motion verification fixture'}}));
app.setPath('userData',profile);
app.setName('Sapphire visible verification');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const deadline=setTimeout(()=>app.exit(1),120000);
void (async()=>{try{
 console.log('Starting visible probe',label,app.isReady());
 const entry=new URL(process.argv[3]??'../dist-electron/desktop.mjs',import.meta.url);
 const {Store}=await import(new URL('./store.mjs',entry));const {NativeClient}=await import(new URL('./native-client.mjs',entry));
 let measuring=false,storageWrites=0;const nativeCalls={};const write=Store.prototype.write,call=NativeClient.prototype.call;
 Store.prototype.write=function(...args){if(measuring)storageWrites++;return write.apply(this,args);};
 NativeClient.prototype.call=function(method,...args){if(measuring)nativeCalls[method]=(nativeCalls[method]??0)+1;return call.call(this,method,...args);};
 await import(entry.href);
 console.log('Host imported',app.isReady(),BrowserWindow.getAllWindows().length);
 await app.whenReady();
 let window;
 for(let i=0;i<300;i++){window=BrowserWindow.getAllWindows()[0];if(window&&!window.webContents.isLoading()&&await window.webContents.executeJavaScript('Boolean(document.querySelector(".notch-idle-open, .notch-expanded"))').catch(()=>false))break;await pause(100);}
 assert(window&&!window.webContents.isOffscreen());
 console.log('Renderer ready');window.show();window.focus();await pause(500);
 assert(window.isVisible());
 window.webContents.debugger.attach('1.3');
 await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 measuring=true;
 const result=await window.webContents.executeJavaScript(`(${async function(){
  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  const open=()=>document.querySelector('.notch-idle-open')?.click();
  const close=()=>dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  close();await pause(700);open();await pause(700);close();await pause(700);
  const frames=[],frameStalls=[];let sampling=true,phase='calibration';const frame=t=>{const prior=frames.at(-1);if(prior&&t-prior>50)frameStalls.push({phase,intervalMs:t-prior,focused:document.hasFocus(),visible:document.visibilityState});frames.push(t);if(sampling)requestAnimationFrame(frame);};
  requestAnimationFrame(frame);await pause(1500);sampling=false;await pause(30);
  const idle=frames.slice(1).map((t,i)=>t-frames[i]).sort((a,b)=>a-b);const interval=idle[Math.floor(idle.length/2)];
  frames.length=0;frameStalls.length=0;const stalls=[];const observer=new PerformanceObserver(list=>stalls.push(...list.getEntries().map(e=>e.duration)));observer.observe({type:'longtask'});
  sampling=true;requestAnimationFrame(frame);
  for(let i=0;i<20;i++){phase='expand '+i;open();await pause(430);phase='switch '+i;document.getElementById(i%2?'tab-notes':'tab-media')?.click();await pause(180);phase='collapse '+i;close();await pause(430);}
  sampling=false;await pause(50);observer.disconnect();
  const deltas=frames.slice(1).map((t,i)=>t-frames[i]).sort((a,b)=>a-b);
  open();await pause(500);document.getElementById('tab-settings')?.click();await pause(300);
  return {intervalMs:interval,samples:deltas.length,p95FrameMs:deltas[Math.floor(deltas.length*.95)],p99FrameMs:deltas[Math.floor(deltas.length*.99)],maxFrameMs:deltas.at(-1),longTasksMs:stalls,frameStalls,documentVisible:document.visibilityState==='visible',focused:document.hasFocus(),targetP95Ms:interval*1.5};
 }.toString()})()`);
 measuring=false;result.activity={storageWrites,nativeCalls};
 await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[]});window.webContents.debugger.detach();
 result.visibleWindow=window.isVisible();result.offscreen=window.webContents.isOffscreen();result.passed=result.p95FrameMs<=result.targetP95Ms&&result.maxFrameMs<=50&&!result.longTasksMs.some(ms=>ms>50);
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));
 fs.writeFileSync(path.join(output,'settings.png'),(await window.webContents.capturePage()).toPNG());
 for(const [theme,name]of [['obsidian','appearance-dark'],['arctic','appearance-light']]){await window.webContents.executeJavaScript(`(async()=>{const s=(await electronAPI.invoke('desktop.bootstrap')).settings;await electronAPI.invoke('settings.save',{settings:{...s,theme:'${theme}'}});})()`);await pause(350);fs.writeFileSync(path.join(output,name+'.png'),(await window.webContents.capturePage()).toPNG());}
 await window.webContents.executeJavaScript("document.getElementById('all-tools-toggle')?.click()");await pause(150);fs.writeFileSync(path.join(output,'all-tools.png'),(await window.webContents.capturePage()).toPNG());
 console.log(JSON.stringify(result));
 assert(result.passed,'Visible frame-pacing target missed.');
}catch(error){console.error(error.message);app.once('will-quit',()=>app.exit(1));}finally{clearTimeout(deadline);app.quit();}})();
