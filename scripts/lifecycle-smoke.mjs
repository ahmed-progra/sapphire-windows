import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const exec = promisify(execFile);
const pause = () => new Promise(resolve => setTimeout(resolve, 250));
const handle = window => window.getNativeWindowHandle().readBigUInt64LE().toString();
export async function runWindowOrderSmoke(window, BrowserWindow, refresh, foregroundChanged) {
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sapphire-window-order-'));
 const script=path.join(directory,'probe.ps1');fs.writeFileSync(script,fs.readFileSync(new URL('./window-order.ps1',import.meta.url)));
 const fixture = new BrowserWindow({width:400,height:250,show:false,skipTaskbar:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 try {
  await fixture.loadURL('data:text/html,<title>Sapphire owned stacking fixture</title>Window stacking fixture');
  const probe = async () => JSON.parse((await exec('powershell.exe',['-NoProfile','-File',script,'-Notch',handle(window),'-Other',handle(fixture),...(process.env.SAPPHIRE_ISOLATED_DESKTOP==='1'?['-NoShell']:[])],{windowsHide:true})).stdout);
  window.showInactive(); fixture.showInactive(); await pause();
  const normal = await probe();
  fixture.maximize(); fixture.showInactive(); await pause();
  const maximized = await probe();
  const before = maximized.foreground;window.setAlwaysOnTop(false);refresh(); await pause();
  const refreshed = await probe();
  assert.equal(normal.notchAboveFixture,true,'notch behind ordinary fixture');
  assert.equal(maximized.notchAboveFixture,true,'notch behind maximized fixture');
  assert.equal(refreshed.topmost,true);
  assert.equal(refreshed.foreground,before,'background refresh stole focus');
  for(const result of [normal,maximized,refreshed]){
   if(!result.taskbarAvailable)continue;
   assert.equal(result.taskbarAboveNotch,true,'notch must remain below the Windows taskbar');
   assert.equal(result.intersectsTaskbar,false,'notch overlaps the Windows taskbar');
   assert.equal(result.taskbarButtons,0,'Sapphire has a main taskbar button');
  }
  if(normal.taskbarAvailable){window.setSkipTaskbar(false);await pause();
   assert.equal((await probe()).taskbarButtons,1,'taskbar probe must detect its positive control');
   refresh();await pause();assert.equal((await probe()).taskbarButtons,0,'refresh failed to remove the taskbar button');}
  const transitions=[];
  fixture.setFullScreen(true);await pause();transitions.push(['borderless-fullscreen',await probe()]);
  fixture.setFullScreen(false);fixture.minimize();await pause();fixture.restore();await pause();transitions.push(['restore',await probe()]);
  window.setAlwaysOnTop(false);assert.equal((await probe()).topmost,false,'probe must detect disabled topmost');refresh();
  for(const [name,result]of transitions)assert.equal(result.notchAboveFixture,true,name+' covered Sapphire');
  fixture.setAlwaysOnTop(true,'floating');fixture.moveTop();await pause();
  const competing=await probe();assert.equal(competing.notchAboveFixture,false,'competing topmost positive control did not cover the notch');
  foregroundChanged();await pause();const recovered=await probe();
  assert.equal(recovered.notchAboveFixture,true,'foreground repair failed against another topmost app');
  assert.equal(recovered.foreground,competing.foreground,'foreground repair stole focus');
  window.hide();foregroundChanged();assert.equal(window.isVisible(),false,'foreground change revealed hidden notch');window.showInactive();
  return {ordinaryAbove:true,maximizedAbove:true,fullscreenAndRestore:true,topmostPositiveControl:true,competingTopmostRepaired:true,refreshPreservedFocus:true,taskbarChecks:normal.taskbarAvailable?'passed':'unavailable on isolated desktop'};
 } finally {fixture.destroy();fs.unlinkSync(script);fs.rmdirSync(directory);}
}

export async function runSecondInstanceSmoke(window,app,root,smokeRoot){
 window.hide();
 const env={...process.env,SAPPHIRE_SMOKE_DIR:smokeRoot};delete env.ELECTRON_RUN_AS_NODE;
 await exec(process.execPath,app.isPackaged?['--smoke-test']:[root,'--smoke-test'],{env,windowsHide:true,timeout:20000});
 await pause();assert.equal(window.isVisible(),true,'second launch did not reopen the first instance');
 return true;
}

export async function runLifecycleSmoke(window, {show, refresh, failTray, restoreTray}) {
 assert.equal(window.isVisible(),false,'startup must stay in tray');
 show(); await pause(); assert.equal(window.isVisible(),true);
 for(let i=0;i<3;i++){
  window.close(); await pause();
  assert.equal(window.isDestroyed(),false,'normal close must not destroy the window');
  assert.equal(window.isVisible(),false,'close must hide the notch');
  refresh(); await pause(); assert.equal(window.isVisible(),false,'refresh must preserve hidden state');
  show(); await pause(); assert.equal(window.isVisible(),true,'tray reopen failed');
 }
 window.minimize(); await pause(); assert.equal(window.isVisible(),false,'minimize must hide to tray'); show(); await pause(); assert.equal(window.isMinimized(),false);
 window.hide(); failTray(); await pause(); assert.equal(window.isVisible(),true,'tray failure left app inaccessible');
 window.close(); await pause(); assert.equal(window.isVisible(),true,'close without a tray left app inaccessible');
 window.minimize(); await pause(); assert.equal(window.isVisible(),true,'minimize without a tray left app inaccessible');assert.equal(window.isMinimized(),false);
 restoreTray();
 return {startupHidden:true,closeReopenCycles:3,hiddenRefresh:true,minimizeRestore:true,trayFailureFallback:true};
}
