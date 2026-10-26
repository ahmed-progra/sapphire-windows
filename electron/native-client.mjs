import {spawn} from 'node:child_process';
import fs from 'node:fs';
import readline from 'node:readline';
import {validateNative} from './core.mjs';
export class NativeClient {
  constructor(executable,spawnChild=spawn,onForegroundChanged=()=>{}){this.executable=executable;this.spawnChild=spawnChild;this.onForegroundChanged=onForegroundChanged;this.pending=new Map();this.sequence=0;this.child=null;this.closing=false;this.closePromise=null;}
  start(){
    if(this.closing)throw new Error('Sapphire is closing.');
    if(this.child)return;
    if(!fs.existsSync(this.executable))throw new Error('Windows helper is missing. Run npm run build:native, then restart Sapphire.');
    const child=this.spawnChild(this.executable,[`--parent-pid=${process.pid}`],{stdio:['pipe','pipe','pipe'],windowsHide:true});this.child=child;
    child.stderr.on('data',()=>{});
    const fail=()=>{if(this.child!==child)return;this.child=null;lines.close();for(const {reject,timer}of this.pending.values()){clearTimeout(timer);reject(new Error('Windows helper disconnected. Reopen this widget to retry.'));}this.pending.clear();child.kill();};
    child.on('error',fail);child.on('exit',fail);
    child.stdin.on('error',fail);child.stdout.on('error',fail);child.stderr.on('error',fail);
    let bytes=0;
    child.stdout.on('data',data=>{bytes+=data.length;if(bytes>8*1024*1024){child.kill();fail();}});
    const lines=readline.createInterface({input:child.stdout});
    lines.on('line',line=>{
      if(this.child!==child)return;
      bytes=0;let response;try{response=JSON.parse(line);}catch{fail();return;}
      if(response?.event==='foreground-changed'&&Object.keys(response).length===1){this.onForegroundChanged();return;}
      if(!response||typeof response!=='object'||Array.isArray(response)||!Number.isSafeInteger(response.id)||response.id<1||
        (Object.hasOwn(response,'result')===Object.hasOwn(response,'error'))||
        (Object.hasOwn(response,'error')&&(!response.error||typeof response.error.message!=='string'))){fail();return;}
      const job=this.pending.get(response.id);if(!job)return;
      this.pending.delete(response.id);clearTimeout(job.timer);
      if(response.error)job.reject(new Error(response.error.message||'Windows command failed.'));else job.resolve(response.result);
    });
  }
  call(method,params={}){
    validateNative(method,params);
    try{this.start();}catch(error){return Promise.reject(error);}
    return new Promise((resolve,reject)=>{
      const id=++this.sequence;const timeout=['hello.verify','notifications.access'].includes(method)?125000:20000;
      const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Windows did not respond in time. Please retry.'));},timeout);
      this.pending.set(id,{resolve,reject,timer});
      this.child.stdin.write(JSON.stringify({id,method,params})+'\n',error=>{if(error){this.pending.delete(id);clearTimeout(timer);reject(new Error('Windows helper is unavailable.'));}});
    });
  }
  close(){if(this.closePromise)return this.closePromise;this.closing=true;for(const {reject,timer}of this.pending.values()){clearTimeout(timer);reject(new Error('Sapphire is closing.'));}this.pending.clear();const child=this.child;this.child=null;this.closePromise=new Promise(resolve=>{if(!child||child.exitCode!==null){resolve();return;}const timer=setTimeout(resolve,3000);child.once('exit',()=>{clearTimeout(timer);resolve();});child.kill();});return this.closePromise;}
}
