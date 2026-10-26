import test from 'node:test';
import assert from 'node:assert/strict';
import {settings,defaultSettings,importData,boundsFor,outline,validateNative,validateStorage,shortcuts,documentPath} from '../electron/core.mjs';
test('settings reject unsafe bounds and preserve known preferences',()=>{
  assert.equal(settings({}).startOnBoot,false);assert.equal(settings({}).idleWidth,150);
  for(const value of [NaN,Infinity,-1,100000])assert.throws(()=>settings({idleWidth:value}));
  assert.throws(()=>settings({hotkey:'Alt+F4;calc'}));assert.throws(()=>settings({startOnBoot:'yes'}));
  assert.equal(settings({...defaultSettings,anything:'secret'}).anything,undefined);
});
test('appearance introduction migrates old settings without changing data or an existing choice',()=>{
  for(const legacy of [{hotkey:'Ctrl+Alt+N',accentColor:'#123456'},{theme:'paper',appearanceIntroSeen:false}]){
    const migrated=settings(legacy);assert.equal(migrated.appearanceIntroSeen,false);
    const saved=settings({...migrated,appearanceIntroSeen:true});assert.equal(saved.appearanceIntroSeen,true);
    assert.equal(saved.theme,migrated.theme);assert.equal(saved.hotkey,migrated.hotkey);
    const backup=importData({format:'sapphire-desktop',version:1,data:{sapphire_settings:saved,sapphire_quick_notes:'Keep this note\nعربي'}});
    assert.equal(backup.sapphire_settings.appearanceIntroSeen,true);assert.equal(backup.sapphire_quick_notes,'Keep this note\nعربي');
  }
  for(const value of ['true',1,null])assert.throws(()=>settings({appearanceIntroSeen:value}));
});
test('backup accepts legacy localStorage strings without rewriting note text',()=>{
  const data=importData({sapphire_settings:JSON.stringify({idleWidth:460}),sapphire_quick_notes:'a\n[important]',sapphire_clipboard_history:'[]'});
  assert.equal(data.sapphire_quick_notes,'a\n[important]');assert.equal(data.sapphire_settings.idleWidth,460);
  assert.throws(()=>importData({format:'foreign',version:1,data:{}}));assert.throws(()=>importData({version:2,data:{}}));
  assert.throws(()=>importData({sapphire_clipboard_history:[{id:'x',type:'text',content:4}]}));
  assert.throws(()=>validateStorage('password','do not persist arbitrary keys'));
});
test('notch stays on selected negative-origin monitor and respects taskbar',()=>{
  const display={bounds:{x:-1920,y:0,width:1920,height:1080},workArea:{x:-1920,y:40,width:1920,height:1040}};
  assert.deepEqual(boundsFor(display,150,24),{x:-1035,y:40,width:150,height:24});
  assert.equal(boundsFor(display,680,480,'floating-island').y,48);
  assert.equal(boundsFor({...display,workArea:{x:0,y:0,width:640,height:400}},1200,1000).height,400);
});

test('floating notch leaves its gap inside the work area, including short displays',()=>{
 for(const workArea of [{x:0,y:0,width:640,height:400},{x:-1280,y:35,width:1280,height:665},{x:40,y:0,width:600,height:25}]){
  const rect=boundsFor({bounds:{...workArea},workArea},1200,1000,'floating-island');
  assert.ok(rect.y>=workArea.y);assert.ok(rect.y+rect.height<=workArea.y+workArea.height,'notch covers reserved taskbar area');
  assert.ok(rect.x>=workArea.x&&rect.x+rect.width<=workArea.x+workArea.width);
 }
});
test('native boundary rejects arbitrary commands, invalid volume, seek, layout',()=>{
  assert.throws(()=>validateNative('shell.exec',{command:'anything'}));
  assert.throws(()=>validateNative('audio.volume',{id:'device',volume:2}));
  assert.throws(()=>validateNative('snap.apply',{layout:'../other'}));
  assert.throws(()=>validateNative('media.control',{action:'seek',position:-1}));
  assert.throws(()=>validateNative('media.get',{unused:'x'.repeat(65536)}),/60 KB/);
  assert.deepEqual(validateNative('media.control',{action:'toggle'}),{action:'toggle'});
});
test('native hit region excludes rounded transparent corners',()=>{
  const rects=outline(680,480,40);assert.equal(rects.length,480);assert.equal(rects[0].width,680);assert.ok(rects.at(-1).width<680);
  assert.ok(rects.every(r=>r.x>=0&&r.width>0&&r.x+r.width<=680));
});
test('global shortcuts only accept bounded actions and distinct accelerators',()=>{
 const row={id:'a',accelerator:'Ctrl+Alt+N',action:{name:'open_notes'}};
 assert.equal(shortcuts([row])[0].action.name,'open_notes');
 assert.throws(()=>shortcuts([row,{...row,id:'b',accelerator:'ctrl+alt+n'}]));
 assert.throws(()=>shortcuts([{...row,action:{name:'constructor'}}]));
 assert.throws(()=>shortcuts([{...row,action:{name:'set_caffeinate',args:{enabled:'yes'}}}]));
 assert.throws(()=>shortcuts(Array.from({length:11},()=>row)));
});
test('file opening cannot launch scripts, shortcuts or installers through the document bridge',()=>{
 assert.equal(documentPath('C:\\Documents\\note.txt'),'C:\\Documents\\note.txt');assert.throws(()=>documentPath('relative.txt'));
 for(const extension of ['exe','cmd','ps1','hta','wsf','cpl','appref-ms','msix','py','lnk'])assert.throws(()=>documentPath('C:\\Downloads\\file.'+extension));
});

test('pointer-leave default is two seconds without overwriting an explicit timeout',()=>{assert.equal(settings({}).autoCollapseSeconds,2);assert.equal(settings({autoCollapseSeconds:0}).autoCollapseSeconds,0);assert.equal(settings({autoCollapseSeconds:8}).autoCollapseSeconds,8);});
