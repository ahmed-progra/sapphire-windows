// Electron entrypoint: disposable legacy profiles exercise real startup and migration.
import {app,BrowserWindow} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const scenario=process.argv[2];
assert(['legacy-102','legacy-110','startup'].includes(scenario));
const restarting=process.argv.includes('--restart');
const output=path.resolve('.test-output','launch-'+scenario),profile=path.join(output,'profile');
fs.mkdirSync(profile,{recursive:true});
const file=path.join(profile,'sapphire-data.json');
const fixture='Preserve this note\nمرحبا — recovery verification';
if(!restarting)fs.writeFileSync(file,JSON.stringify({format:'sapphire-desktop',version:1,data:{sapphire_settings:{hotkey:'Ctrl+Alt+Shift+L',alwaysOnTop:false,autoCollapseSeconds:0,...(scenario==='legacy-110'?{theme:'paper',accentColor:'#abcdef',motionPreference:'reduced'}:{accentColor:'#123456'})},sapphire_quick_notes:fixture}}));
app.setPath('userData',profile);app.setName('Sapphire launch verification');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const timer=setTimeout(()=>app.exit(1),45000);
void(async()=>{try{
 await import('../dist-electron/desktop.mjs');await app.whenReady();
 let window;
 for(let i=0;i<200;i++){window=BrowserWindow.getAllWindows()[0];if(window&&!window.webContents.isLoading()&&await window.webContents.executeJavaScript('Boolean(document.querySelector(".notch-expanded, .notch-idle-open"))').catch(()=>false))break;await pause(100);}
 await pause(800);assert(window);
 assert.equal(window.isVisible(),scenario!=='startup','manual launch shows; startup stays hidden');
 const before=await window.webContents.executeJavaScript("electronAPI.invoke('desktop.bootstrap')");
 assert.equal(before.storage.sapphire_quick_notes,fixture);
 assert.equal(before.settings.theme,scenario==='legacy-110'?'paper':'custom');
 assert.equal(before.settings.alwaysOnTop,false);
 if(scenario!=='startup'){
  assert.equal(await window.webContents.executeJavaScript('!!document.querySelector(".appearance-intro")'),!restarting);
  if(!restarting){
   assert.equal(await window.webContents.executeJavaScript('document.querySelectorAll(".settings-theme").length'),10);
   await window.webContents.executeJavaScript('document.querySelector(".appearance-intro button").click()');await pause(250);
   assert.equal(await window.webContents.executeJavaScript(`!!document.querySelector('section[aria-label="Music player"]')`),true);
   assert.equal(JSON.parse(fs.readFileSync(file)).data.sapphire_settings.appearanceIntroSeen,true);
  }
 }
 assert.equal(JSON.parse(fs.readFileSync(file)).data.sapphire_quick_notes,fixture);
 const result={scenario,restarting,passed:true,windowVisible:window.isVisible(),notesPreserved:true,theme:before.settings.theme,introductionOnce:scenario!=='startup'};
 fs.writeFileSync(path.join(output,restarting?'restart.json':'initial.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){console.error(error);app.once('will-quit',()=>app.exit(1));}finally{clearTimeout(timer);app.quit();}})();
