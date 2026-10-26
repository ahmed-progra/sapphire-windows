import fs from 'node:fs';
import path from 'node:path';

// Observe the existing app; never create a window, change visibility or quit it.
export function startSoak({app,window,powerMonitor,output}) {
 fs.mkdirSync(output,{recursive:true});
 const file=path.join(output,'soak-status.json');
 const state={version:app.getVersion(),pid:process.pid,startedAt:new Date().toISOString(),endsAt:new Date(Date.now()+24*60*60*1000).toISOString(),status:'running',samples:0,shows:0,hides:0,closeRequests:0,suspends:0,resumes:0,unlocks:0,peakWorkingSetKB:0,last:null,error:null};
 const save=()=>{fs.writeFileSync(file+'.tmp',JSON.stringify(state,null,2));fs.renameSync(file+'.tmp',file);};
 let timer,busy=false;
 const events=['suspend','resume','unlock-screen'];
 const listeners=events.map((event,index)=>{const listener=()=>{state[['suspends','resumes','unlocks'][index]]++;save();};powerMonitor.on(event,listener);return listener;});
 const windowEvents=['show','hide','close'];
 const windowListeners=windowEvents.map((event,index)=>{const listener=()=>{state[['shows','hides','closeRequests'][index]]++;save();};window.on(event,listener);return listener;});
 const stop=()=>{clearInterval(timer);events.forEach((event,index)=>powerMonitor.removeListener(event,listeners[index]));windowEvents.forEach((event,index)=>window.removeListener(event,windowListeners[index]));app.removeListener('before-quit',stop);window.removeListener('session-end',stop);if(state.status==='running'){state.status='interrupted';save();}};
 app.once('before-quit',stop);
 window.on('session-end',stop);
 const sample=async()=>{
  if(busy)return;busy=true;let timeout;
  try{
   const responsive=await Promise.race([window.webContents.executeJavaScript("document.readyState === 'complete' && Boolean(window.electronAPI?.invoke)"),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Renderer response timed out.')),5000);})]);
   if(state.status!=='running')return;
   if(!responsive)throw new Error('Renderer is not ready.');
   const metrics=app.getAppMetrics();const workingSetKB=metrics.reduce((sum,metric)=>sum+metric.memory.workingSetSize,0);
   const sample={at:new Date().toISOString(),workingSetKB,cpuPercent:metrics.reduce((sum,metric)=>sum+metric.cpu.percentCPUUsage,0),processes:metrics.length};
   state.samples++;state.last=sample;state.peakWorkingSetKB=Math.max(state.peakWorkingSetKB,workingSetKB);
   fs.appendFileSync(path.join(output,'soak-samples.jsonl'),JSON.stringify(sample)+'\n');
   if(Date.now()>=Date.parse(state.endsAt)){state.status='completed';state.completedAt=new Date().toISOString();}
  }catch(error){if(state.status==='running'){state.status='failed';state.error=error.message;}}
  finally{clearTimeout(timeout);busy=false;save();if(state.status!=='running')stop();}
 };
 save();void sample();timer=setInterval(()=>void sample(),5*60*1000);
 return state;
}
