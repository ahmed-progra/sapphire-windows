import assert from 'node:assert/strict';

export async function runMotionSmoke(window){
 const probe=async function(reduced=false){
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const surface=()=>document.querySelector('.notch-surface');
  const open=()=>document.querySelector('.notch-idle-open')?.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}));
  const close=()=>document.querySelector('button[aria-label="Collapse notch"]')?.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}));
  const prefs=(await globalThis.electronAPI.invoke('desktop.bootstrap')).settings;
  await globalThis.electronAPI.invoke('settings.save',{settings:{...prefs,autoCollapseSeconds:0}});
  close();await pause(750);
  const frames=[];let running=true;
  const frame=time=>{const box=surface().getBoundingClientRect();frames.push({time,width:box.width,height:box.height,center:box.left+box.width/2-innerWidth/2});if(running)requestAnimationFrame(frame);};
  requestAnimationFrame(frame);
  open();await pause(50);
  if(reduced&&Math.abs(surface().getBoundingClientRect().height-Math.min(prefs.expandedHeight,screen.availHeight))>3)throw new Error('Reduced motion still animated the expansion.');
  await pause(40);close();await pause(70);open();await pause(850);
  const expanded=surface().getBoundingClientRect();
  if(getComputedStyle(document.querySelector('.notch-expanded')).pointerEvents==='none')throw new Error('Rapid reversal left the expanded panel unclickable.');
  const controls=document.getElementById('tab-notes');controls?.click();await pause(200);
  const notesUsable=Boolean(document.querySelector('textarea[aria-label="Quick notes"]'));
  close();await pause(850);running=false;await pause(40);
  const idle=surface().getBoundingClientRect();
  await globalThis.electronAPI.invoke('settings.save',{settings:prefs});
  if(!notesUsable)throw new Error('Rapid reversal left widget navigation unavailable.');
  if(Math.abs(expanded.width-Math.min(prefs.expandedWidth,screen.availWidth))>3||Math.abs(expanded.height-Math.min(prefs.expandedHeight,screen.availHeight))>3)throw new Error('Expansion did not settle at its target.');
  if(Math.abs(idle.height-prefs.idleHeight)>3)throw new Error('Collapse did not settle at its target.');
  if(frames.some(f=>f.height>prefs.expandedHeight+2||f.width>prefs.expandedWidth+2||Math.abs(f.center)>3))throw new Error('Morph overshot or jumped off its center anchor.');
  const intervals=frames.slice(1).map((f,i)=>f.time-frames[i].time).sort((a,b)=>a-b);
  if(!reduced&&!frames.some(f=>f.height>prefs.idleHeight+5&&f.height<prefs.expandedHeight-5))throw new Error('Normal mode did not animate.');
  return {frames:frames.length,rapidReversal:true,noOvershoot:true,centered:true,controlsUsable:true,...(reduced?{instantExpansion:true}:{}),p95FrameMs:intervals[Math.floor(intervals.length*.95)]??null};
 };
 const systemReducedMotion=await window.webContents.executeJavaScript("matchMedia('(prefers-reduced-motion: reduce)').matches");
 window.webContents.debugger.attach('1.3');
 try{
  await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  assert.equal(await window.webContents.executeJavaScript("matchMedia('(prefers-reduced-motion: reduce)').matches"),false);
  const normal=await window.webContents.executeJavaScript('('+probe.toString()+')()');
  assert.ok(normal.frames>5,'No animation frames were observed.');
  await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await window.webContents.executeJavaScript("matchMedia('(prefers-reduced-motion: reduce)').matches"),true);
  const reduced=await window.webContents.executeJavaScript('('+probe.toString()+')(true)');
  return {normal,reduced,systemReducedMotion,frameTimingScope:'offscreen desktop; physical-display smoothness remains a manual check'};
 }finally{await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[]});window.webContents.debugger.detach();}
}

export async function runStorageFailureSmoke(window,store){
 await window.webContents.executeJavaScript("document.querySelector('.notch-idle-open')?.click()");
 await new Promise(resolve=>setTimeout(resolve,850));
 await window.webContents.executeJavaScript("document.getElementById('tab-focus').click()");
 await new Promise(resolve=>setTimeout(resolve,250));
 const before=await window.webContents.executeJavaScript("localStorage.getItem('sapphire_focus')");
 const write=store.write;
 try{
  store.write=()=>{throw new Error('Owned storage failure fixture');};
  await window.webContents.executeJavaScript("[...document.querySelectorAll('section[aria-label=\"Focus and stay awake\"] button')].find(b=>b.textContent==='Start').click()");
  await new Promise(resolve=>setTimeout(resolve,200));
  assert.equal(await window.webContents.executeJavaScript("localStorage.getItem('sapphire_focus')"),before,'rejected save changed the confirmed cache');
  assert.equal(await window.webContents.executeJavaScript("document.body.textContent.includes('Owned storage failure fixture')"),true,'save failure was not shown');
  return{failedSavePreservesCache:true,errorVisible:true};
 }finally{store.write=write;}
}

export async function runAppearanceSmoke(window, themes) {
 const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
 const evaluate = async code => {
  const result = await window.webContents.executeJavaScript('(async()=>{try{return await ('+code+')}catch(error){return {probeError:String(error.stack??error)}}})()');
  if(result?.probeError)throw new Error(result.probeError);
  return result;
 };
 const original = await evaluate("(async()=> (await electronAPI.invoke('desktop.bootstrap')).settings)()");
 const topmost = window.isAlwaysOnTop();
 const save = value => evaluate(`electronAPI.invoke('settings.save',{settings:${JSON.stringify(value)}})`);
 const failures = [];
 const consoleError = (_event, details) => { if (details.level === 'error') failures.push(details.message); };
 window.webContents.on('console-message', consoleError);
 window.webContents.debugger.attach('1.3');
 try {
  await save({ ...original, autoCollapseSeconds: 0, motionPreference: 'system' });
  await evaluate("dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
  await pause(750);
  const idle = window.getBounds();
  for (let i = 0; i < 12; i++) {
   window.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(idle.width / 2), y: 8 });
   await pause(35);
   window.webContents.sendInputEvent({ type: 'mouseLeave', x: -1, y: -1 });
   await pause(35);
   assert.deepEqual(window.getBounds(), idle, 'Brief hover changed native window geometry.');
  }
  await pause(350);
  assert.equal(await evaluate("!!document.querySelector('.notch-surface.is-expanded')"), false, 'Cancelled hover timer still expanded the island.');
  await evaluate("document.querySelector('.notch-idle-open').click()");
  await pause(750);
  const expanded = window.getBounds();
  const results = [];
  for (const theme of themes) {
   const probe = async function (theme) {
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    document.getElementById('tab-settings').click();
    await pause(200);
    const button = document.querySelector(`.settings-theme[aria-label="${theme.name}"]`);
    button.click();
    await pause(250);
    const preferences = (await electronAPI.invoke('desktop.bootstrap')).settings;
    if (preferences.theme !== theme.id || document.querySelector('main').dataset.theme !== theme.id || button.getAttribute('aria-pressed') !== 'true') throw new Error('Theme selection failed: ' + theme.id);
    const tabs = ['media','notes','focus','fileshelf','audio','calendar','weather','clipboard','snapzones','blip','search','finance','faceid','system','settings'];
    for (const id of tabs) {
     if (!document.getElementById('tab-'+id)) { document.getElementById('all-tools-toggle').click(); await pause(40); }
     document.getElementById('tab-'+id).click(); await pause(60);
     if (document.querySelector('main').dataset.theme !== theme.id) throw new Error('Navigation reset theme.');
     if (!document.querySelector('#notch-widget-panel > *')) throw new Error('Widget missing: ' + id);
    }
    const style = getComputedStyle(document.querySelector('.notch-surface'));
    const control = document.querySelector('.settings-input');
    const toRGB = hex => 'rgb(' + [1,3,5].map(offset => parseInt(hex.slice(offset,offset+2),16)).join(', ') + ')';
    if (style.backgroundColor !== toRGB(theme.surface) || style.color !== toRGB(theme.text)) throw new Error('Surface palette mismatch: ' + theme.id);
    if (getComputedStyle(control).backgroundColor !== toRGB(theme.field)) throw new Error('Input palette mismatch: ' + theme.id);
    return { theme: theme.id, widgets: tabs.length, selected: true, surface: style.backgroundColor, input: getComputedStyle(control).backgroundColor };
   };
   results.push(await evaluate(`(${probe.toString()})(${JSON.stringify(theme)})`));
   assert.deepEqual(window.getBounds(), expanded, 'Theme switch changed window bounds.');
   assert.equal(window.isAlwaysOnTop(), topmost, 'Theme switch changed always-on-top.');
  }
  // Exercise real mouse states, including release outside the original control.
  const controls = ['#tab-settings', '.settings-theme', '.settings-style', '.notch-button'];
  for (const selector of controls) {
   const box = await evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});element.scrollIntoView({block:'center'});const r=element.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);
   window.webContents.sendInputEvent({ type: 'mouseMove', ...box });
   window.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...box });
   await pause(180);
   window.webContents.sendInputEvent({ type: 'mouseMove', x: 4, y: 4 });
   window.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, x: 4, y: 4 });
   await pause(180);
   assert.equal(await evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).scale`), '1', selector + ' did not restore its scale');
  }
  for (const scheme of ['light', 'dark']) {
   await save({ ...original, theme: 'system', autoCollapseSeconds: 0 });
   await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
   await pause(220);
   assert.equal(await evaluate("document.querySelector('main').dataset.theme"), scheme === 'light' ? 'arctic' : 'obsidian');
  }
  await save({ ...original, autoCollapseSeconds: 1 });
  window.focus();
  window.webContents.sendInputEvent({ type: 'mouseLeave', x: -1, y: -1 });
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' });
  await evaluate("document.getElementById('tab-settings').focus()");
  assert.equal(await evaluate("document.hasFocus() && document.getElementById('tab-settings').matches(':focus-visible')"), true);
  await pause(1150);
  assert.equal(await evaluate("!!document.querySelector('.notch-surface.is-expanded')"), true, 'Auto-collapse interrupted keyboard navigation.');
  await save({ ...original, theme: 'custom', accentColor: '#000000', motionPreference: 'reduced', autoCollapseSeconds: 0 });
  await pause(200);
  assert.equal(await evaluate("document.querySelector('main').dataset.reducedMotion"), 'true');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.notch-tab')).transitionDuration"), '0s');
  await evaluate("dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
  await pause(60);
  assert.equal(await evaluate("!!document.querySelector('.notch-expanded')"), false);
  await evaluate("document.querySelector('.notch-idle-open').click()");
  await pause(60);
  assert.equal(await evaluate("Math.round(document.querySelector('.notch-surface').getBoundingClientRect().height)"), expanded.height);
  assert.deepEqual(failures, [], 'Appearance checks logged renderer errors.');
  return { themes: results, briefHoverPasses: 12, stableNativeBounds: true, restoredControls: controls, systemTheme: true, reducedPreference: true, keyboardPreventsCollapse: true, alwaysOnTopPreserved: true };
 } finally {
  await save(original);
  await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] });
  window.webContents.debugger.detach();
  window.webContents.removeListener('console-message', consoleError);
 }
}

export async function runDismissalSmoke(window){
 const pause=ms=>new Promise(r=>setTimeout(r,ms));const evaluate=code=>window.webContents.executeJavaScript(code);
 const original=await evaluate("(async()=> (await electronAPI.invoke('desktop.bootstrap')).settings)()");
 const expanded=()=>evaluate("!!document.querySelector('.notch-surface.is-expanded')");
 const mouse=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)})?.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}))`);
 const enter=async()=>{window.webContents.sendInputEvent({type:'mouseMove',x:120,y:45});await pause(70);};
 const leave=()=>window.webContents.sendInputEvent({type:'mouseLeave',x:-1,y:-1});
 const setIgnore=window.setIgnoreMouseEvents;let ignoresMouse;
 window.setIgnoreMouseEvents=function(ignore,...args){ignoresMouse=ignore;return setIgnore.call(this,ignore,...args);};
 window.webContents.debugger.attach('1.3');
 try{
  await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await evaluate(`electronAPI.invoke('settings.save',{settings:${JSON.stringify({...original,autoCollapseSeconds:2})}})`);
  await mouse('button[aria-label="Collapse notch"]');await pause(700);await mouse('.notch-idle-open');await pause(700);await mouse('#tab-media');await enter();leave();
  const started=Date.now();await pause(800);assert.equal(ignoresMouse,false,'expanded window cannot receive returning pointer');await evaluate("dispatchEvent(new Event('focus'))");await pause(900);assert(await expanded(),'pointer leave collapsed before two seconds');
  while(await expanded()){assert(Date.now()-started<2700,'pointer leave did not collapse');await pause(20);}
  const delayMs=Date.now()-started;assert(delayMs>=1900);await pause(850);assert(window.getBounds().height<120,'native bounds stayed expanded: '+JSON.stringify(window.getBounds()));
  assert.equal(ignoresMouse,false,'settled pill cannot receive returning pointer');
  await mouse('.notch-idle-open');await pause(700);await enter();leave();await pause(1200);await enter();await pause(1100);assert(await expanded(),'returning pointer did not cancel closing');
  leave();await pause(800);await evaluate("dispatchEvent(new Event('blur'))");await pause(1400);assert(!await expanded(),'blur restarted the pointer-leave deadline');
  await mouse('.notch-idle-open');await pause(700);await enter();leave();
  window.focus();window.webContents.sendInputEvent({type:'keyDown',keyCode:'Tab'});window.webContents.sendInputEvent({type:'keyUp',keyCode:'Tab'});await pause(2200);assert(await expanded(),'keyboard activity was interrupted');
  await evaluate("dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");await pause(90);assert(!await expanded(),'keyboard collapse was delayed');assert(window.getBounds().height<120,'keyboard native bounds were delayed');
  await evaluate("document.querySelector('.notch-idle-open').click()");await pause(90);assert(await expanded(),'keyboard expansion was delayed');assert.equal(Math.round(await evaluate("document.querySelector('.notch-surface').getBoundingClientRect().height")),window.getBounds().height);
  await enter();leave();await pause(2400);assert(!await expanded(),'stale keyboard focus prevented pointer dismissal');
  return{delayMs,returnedPointerCancels:true,blurKeepsDeadline:true,lateFocusKeepsDeadline:true,keyboardProtected:true,keyboardInstant:true,staleFocusReleased:true,nativeBoundsRestored:true,settledWindowInteractive:true};
 }finally{window.setIgnoreMouseEvents=setIgnore;await evaluate(`electronAPI.invoke('settings.save',{settings:${JSON.stringify(original)}})`);await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[]});window.webContents.debugger.detach();}
}
