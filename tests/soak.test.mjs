import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {EventEmitter} from 'node:events';
import {startSoak} from '../scripts/soak.mjs';

function fixture(t,responsive=true){
 const output=fs.mkdtempSync(path.join(os.tmpdir(),'sapphire-soak-test-'));
 t.after(()=>fs.rmSync(output,{recursive:true,force:true}));
 const app=new EventEmitter();app.getVersion=()=> 'test';app.getAppMetrics=()=>[{memory:{workingSetSize:100},cpu:{percentCPUUsage:0}}];app.quit=()=>app.emit('before-quit');
 const powerMonitor=new EventEmitter();const window=new EventEmitter();
 window.webContents={executeJavaScript:async()=>responsive};window.showInactive=window.close=()=>{throw new Error('The observer must not manipulate the window.');};
 return {app,window,powerMonitor,output};
}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
test('soak only completes after 24 hours and records actual power events separately',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval','setTimeout'],now:1000});
 const input=fixture(t);const state=startSoak(input);await flush();
 assert.equal(state.status,'running');assert.equal(state.samples,1);
 input.powerMonitor.emit('suspend');input.powerMonitor.emit('resume');
 input.window.emit('show');input.window.emit('hide');input.window.emit('close');
 let quits=0;input.app.on('before-quit',()=>quits++);
 for(let i=0;i<288;i++){t.mock.timers.tick(5*60*1000);await flush();}
 assert.equal(state.status,'completed');assert.equal(state.samples,289);assert.equal(state.suspends,1);assert.equal(state.resumes,1);
 assert.equal(state.peakWorkingSetKB,100);assert.equal(state.shows,1);assert.equal(state.hides,1);assert.equal(state.closeRequests,1);assert.equal(quits,0);
 const result=JSON.parse(fs.readFileSync(path.join(input.output,'soak-status.json'),'utf8'));assert.equal(result.status,'completed');
});
test('soak records renderer failure and early quit instead of success',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval','setTimeout'],now:1000});
 const failed=startSoak(fixture(t,false));await flush();assert.equal(failed.status,'failed');
 const input=fixture(t);const stopped=startSoak(input);await flush();input.app.quit();assert.equal(stopped.status,'interrupted');
});
test('quitting during a pending sample remains interrupted',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval','setTimeout'],now:1000});
 for(const rejects of [false,true]){
  const input=fixture(t);let finish;
  input.window.webContents.executeJavaScript=()=>new Promise((resolve,reject)=>{finish=()=>rejects?reject(new Error('Renderer closed')):resolve(true);});
  const state=startSoak(input);input.app.quit();finish();await flush();
  assert.equal(state.status,'interrupted');assert.equal(state.samples,0);assert.equal(state.error,null);
 }
});
