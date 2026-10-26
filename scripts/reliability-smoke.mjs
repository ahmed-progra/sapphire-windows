import assert from 'node:assert/strict';

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(check,label){const deadline=Date.now()+30000;while(Date.now()<deadline){if(await check())return;await pause(50);}throw new Error('Timed out: '+label);}

export async function runPolicySmoke(window,{screen,place,refresh,saveSettings,getPreferences,store}){
 const original={...getPreferences()},getDisplays=screen.getAllDisplays,getPrimary=screen.getPrimaryDisplay;
 const primary=getPrimary.call(screen);
 const selected={...primary,id:123456,workArea:{...primary.workArea,x:primary.workArea.x+40,width:600,height:300}};
 try{
  screen.getAllDisplays=()=>[primary,selected];
  saveSettings({...original,displayId:selected.id});place(680,480);
  assert.equal(window.getBounds().width,600);assert.equal(window.getBounds().height,300);
  screen.getAllDisplays=()=>[primary];screen.emit('display-removed',{},selected);
  assert.equal(getPreferences().displayId,selected.id,'disconnect forgot selected display');
  assert.equal(window.getBounds().width,Math.min(680,primary.workArea.width),'unplug retained clipped width');
  screen.getAllDisplays=()=>[primary,selected];screen.emit('display-added',{},selected);
  assert.equal(window.getBounds().width,600,'reconnect did not return to selected display');
  screen.getAllDisplays=getDisplays;
  saveSettings({...original,alwaysOnTop:false});refresh();assert.equal(window.isAlwaysOnTop(),false);
  window.hide();refresh();assert.equal(window.isVisible(),false,'refresh revealed intentionally hidden window');
  window.showInactive();place(700,500);assert.equal(window.isAlwaysOnTop(),false,'resize ignored disabled preference');
  saveSettings({...original,alwaysOnTop:true});window.setAlwaysOnTop(false);place(680,480);
  assert.equal(window.isAlwaysOnTop(),true,'resize lost topmost state');
  const write=store.write;
  try{store.write=()=>{throw new Error('Owned disk failure fixture');};assert.throws(()=>saveSettings({...original,alwaysOnTop:false}),/Owned disk failure/);assert.equal(window.isAlwaysOnTop(),true);}
  finally{store.write=write;}
  return{displayDisconnectReconnectSimulated:true,desiredSizeRestored:true,liveToggle:true,resizeRepairsTopmost:true,hiddenPreserved:true,failedSaveRollsBack:true};
 }finally{screen.getAllDisplays=getDisplays;screen.getPrimaryDisplay=getPrimary;saveSettings(original);place(original.idleWidth,original.idleHeight);}
}

export async function runRecoverySmoke({getWindow,ready,show,recreate,emit,BrowserWindow}){
 const fixture=new BrowserWindow({show:false,skipTaskbar:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 try{
  await fixture.loadURL('data:text/html,<title>Owned recovery focus fixture</title>Focus fixture');
  fixture.show();fixture.focus();
  const priorFocus=BrowserWindow.getFocusedWindow();
  let old=getWindow();old.showInactive();old.webContents.forcefullyCrashRenderer();
  await waitFor(()=>getWindow()!==old&&ready(),'automatic renderer recovery');
  assert.equal(getWindow().isVisible(),true);assert.equal(getWindow().isAlwaysOnTop(),true);
  assert.equal(BrowserWindow.getFocusedWindow(),priorFocus,'automatic recovery stole focus');
  old=getWindow();old.hide();old.webContents.forcefullyCrashRenderer();
  await waitFor(()=>old.webContents.isCrashed(),'second renderer crash');await pause(500);
  assert.equal(getWindow(),old,'crash loop restarted repeatedly');assert.equal(old.isVisible(),false);
  show('open-settings');await waitFor(()=>getWindow()!==old&&ready(),'manual recovery');
  await waitFor(()=>getWindow().webContents.executeJavaScript("Boolean(document.querySelector('.notch-settings'))"),'pending Settings after recovery');
  old=getWindow();old.hide();old.webContents.forcefullyCrashRenderer();
  await waitFor(()=>getWindow()!==old&&ready(),'hidden automatic recovery');assert.equal(getWindow().isVisible(),false);
  show();
  old=getWindow();old.webContents.emit('did-fail-load',{},-6,'Owned load failure','file:///fixture',true);
  show('open-settings');await waitFor(()=>getWindow()!==old&&ready(),'load failure manual retry');
  old=getWindow();recreate(true,false,'open-settings');
  await waitFor(()=>getWindow()!==old&&ready(),'window recreation');
  await waitFor(()=>getWindow().webContents.executeJavaScript("Boolean(document.querySelector('.notch-settings'))"),'Settings after recreation');
  await getWindow().webContents.executeJavaScript("document.getElementById('tab-audio').click()");
  await waitFor(()=>getWindow().webContents.executeJavaScript("Boolean(document.querySelector('section[aria-label=\"Audio mixer\"]'))"),'audio mounted');
  emit('audio',null);
  await waitFor(()=>getWindow().webContents.executeJavaScript("document.body.textContent.includes('This widget could not open')"),'widget error boundary');
  await getWindow().webContents.executeJavaScript("document.getElementById('tab-notes').click()");
  await waitFor(()=>getWindow().webContents.executeJavaScript("Boolean(document.querySelector('textarea[aria-label=\"Quick notes\"]'))"),'navigation after widget failure');
  return{automaticCrashRecovery:true,backgroundFocusPreserved:true,repeatedCrashBounded:true,hiddenRecovery:true,manualReload:true,pendingSettingsDelivered:true,loadFailureRetry:true,widgetFailureContained:true};
 }finally{fixture.destroy();}
}
