import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {NativeClient} from '../electron/native-client.mjs';

function fixture(t) {
 const children=[];
 const client=new NativeClient(process.execPath,()=>{
  const child=new EventEmitter();
  Object.assign(child,{stdin:new PassThrough(),stdout:new PassThrough(),stderr:new PassThrough(),exitCode:null});
  child.kill=()=>{child.exitCode=1;child.emit('exit',1);};
  children.push(child);return child;
 });
 t.after(()=>client.close());
 return {client,children};
}

test('malformed helper replies reject the request without crashing the host',async t=>{
 for(const line of ['null','[]','invalid JSON','{"id":1,"error":null}','{"id":1}']){
  const {client,children}=fixture(t);
  const rejected=assert.rejects(client.call('battery.get'),/helper disconnected/);
  assert.doesNotThrow(()=>children[0].stdout.write(line+'\n'));
  await rejected;assert.equal(client.child,null);assert.equal(client.pending.size,0);
 }
});

test('pipe errors reject pending work; a new helper can serve the next request',async t=>{
 const {client,children}=fixture(t);
 const rejected=assert.rejects(client.call('battery.get'),/helper disconnected/);
 assert.doesNotThrow(()=>children[0].stdin.emit('error',new Error('EPIPE')));
 await rejected;
 const next=client.call('battery.get');
 children[1].stdout.write('{"id":2,"result":{"percent":50}}\n');
 assert.deepEqual(await next,{percent:50});
 assert.equal(client.pending.size,0);
});

test('closing rejects pending helper calls and never restarts the child',async t=>{
 const {client,children}=fixture(t);
 const rejected=assert.rejects(client.call('battery.get'),/closing/);
 await client.close();await rejected;
 await assert.rejects(client.call('battery.get'),/closing/);
 assert.equal(children.length,1);assert.equal(client.pending.size,0);
});

test('foreground notifications do not consume a pending command or accept arbitrary events',async t=>{
 const {client,children}=fixture(t);let changes=0;client.onForegroundChanged=()=>changes++;
 const request=client.call('battery.get');children[0].stdout.write('{"event":"foreground-changed"}\n');
 assert.equal(changes,1);assert.equal(client.pending.size,1);
 children[0].stdout.write('{"id":1,"result":null}\n');assert.equal(await request,null);
 const rejected=assert.rejects(client.call('battery.get'),/helper disconnected/);
 children[0].stdout.write('{"event":"execute-command"}\n');await rejected;
});
