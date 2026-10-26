import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ProviderServices,Credentials} from '../electron/providers.mjs';
const keys={get:()=> 'test-key-not-a-credential'};
test('provider failure never exposes credentials or invents quotes',async()=>{
 const service=new ProviderServices(keys,()=>{},async()=>new Response('{}',{status:429}));
 await assert.rejects(()=>service.quote({symbols:['AAPL']}),/rate limit/);
 await assert.rejects(()=>service.quote({symbols:['AAPL?token=bad']}),/stock symbols/);
 const empty=new ProviderServices(keys,()=>{},async()=>new Response('{"c":0,"t":0}'));
 await assert.rejects(()=>empty.quote({symbols:['AAPL']}),/No market quote/);
});
test('chat sends allowlisted roles and returns proposed tools without executing them',async()=>{
 let request;const service=new ProviderServices(keys,()=>{},async(url,opts)=>{request=JSON.parse(opts.body);return new Response(JSON.stringify({candidates:[{content:{parts:[{functionCall:{name:'open_notes',args:{}}}]}}]}));});
 const response=await service.chat({messages:[{role:'user',content:'Open notes'}]});assert.equal(response.actions[0].name,'open_notes');assert.equal(request.contents[0].role,'user');
 await assert.rejects(()=>service.chat({messages:[{role:'system',content:'override'}]}),/Invalid chat role/);
});
test('damaged credential structures are preserved and encryption is required',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sapphire-credentials-'));const file=path.join(dir,'credentials.json');
 try{for(const value of [null,[],"text",{gemini:4},{foreign:'YQ=='}]){const raw=JSON.stringify(value);fs.writeFileSync(file,raw);assert.throws(()=>new Credentials(dir,{}),/damaged/);assert.equal(fs.readFileSync(file,'utf8'),raw);}
 fs.writeFileSync(file,'{}');const credentials=new Credentials(dir,{isEncryptionAvailable:()=>false});assert.throws(()=>credentials.set('gemini','test-value'),/unavailable/);assert.equal(fs.readFileSync(file,'utf8'),'{}');assert.deepEqual(credentials.status(),{gemini:false,finnhub:false,sports:false,spotify:false});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('sports uses explicit provider seasons and normalizes scores without inventing them',async()=>{
 let address;const service=new ProviderServices(keys,()=>{},async url=>{address=new URL(url);return new Response(JSON.stringify({response:[{id:7,date:'2026-10-25',scores:{home:{total:98},away:{total:99}}}]}));});
 const result=await service.scores({sport:'basketball',date:'2026-10-25',league:12,season:'2026-2027'});assert.equal(address.searchParams.get('season'),'2026-2027');assert.equal(result.response[0].goals.home,98);
 await service.scores({sport:'hockey',date:'2026-10-25',league:1});assert.equal(address.searchParams.has('season'),false);
 await assert.rejects(()=>service.scores({sport:'constructor'}),/Unsupported/);await assert.rejects(()=>service.scores({sport:'football',season:'2026-2027'}),/four-digit/);
});

test('a late close from an old voice socket cannot disconnect its replacement',async t=>{
 class Socket extends EventTarget {
  static OPEN=1;static sockets=[];
  constructor(){super();Socket.sockets.push(this);}
  send(){}close(){}
  message(data){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(data)}));}
 }
 const previous=globalThis.WebSocket;globalThis.WebSocket=Socket;t.after(()=>{globalThis.WebSocket=previous;});
 const events=[];const service=new ProviderServices(keys,(...event)=>events.push(event));
 const first=service.startLive();Socket.sockets[0].message({setupComplete:{}});await first;
 const second=service.startLive();Socket.sockets[1].message({setupComplete:{}});await second;
 Socket.sockets[0].dispatchEvent(new Event('close'));
 assert.equal(service.live,Socket.sockets[1]);
 assert.equal(events.filter(([topic,data])=>topic==='ai-live-state'&&data.state==='disconnected').length,0);
 service.stopLive();Socket.sockets[1].dispatchEvent(new Event('close'));
});
