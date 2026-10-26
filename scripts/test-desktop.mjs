import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {once} from 'node:events';

if(!process.env.SAPPHIRE_SMOKE_DIR)throw new Error('Run this through scripts/test-desktop.ps1 to isolate the desktop and profile.');
const root=path.resolve(process.env.SAPPHIRE_SMOKE_DIR);
fs.mkdirSync(path.join(root,'.smoke-profile'),{recursive:true});
fs.writeFileSync(path.join(root,'.smoke-profile','sapphire-data.json'),JSON.stringify({format:'sapphire-desktop',version:1,data:{sapphire_settings:{hotkey:'Ctrl+Alt+Shift+S',appearanceIntroSeen:true}}}));
const executable=process.argv[2]?path.resolve(process.argv[2]):createRequire(import.meta.url)('electron');
const sourceRuntime=!process.argv[2]||path.basename(executable).toLowerCase()==='electron.exe';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const results=[];
try {
 for(const phase of ['initial','restart']){
  const log=fs.openSync(path.join(root,phase+'.log'),'w');
  const child=spawn(executable,[...(sourceRuntime?['.']:[]),'--smoke-test',...(phase==='restart'?['--smoke-restart']:[])],{env,windowsHide:true,stdio:['ignore',log,log]});
  const timer=setTimeout(()=>child.kill(),180000);
  let code;
  try{[code]=await once(child,'exit');}finally{clearTimeout(timer);fs.closeSync(log);}
  results.push({phase,code});
  if(code!==0)throw new Error(phase+' smoke exited '+code);
  const report=path.join(root,'.test-output','desktop-smoke.json');
  if(!fs.existsSync(report))throw new Error('Smoke report is missing.');
  const data=JSON.parse(fs.readFileSync(report,'utf8'));
  fs.copyFileSync(report,path.join(root,phase+'.json'));
  if(data.nativePid){let alive=false;try{process.kill(data.nativePid,0);alive=true;}catch{}if(alive)throw new Error('Native helper survived application shutdown.');}
 }
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify({passed:true,results},null,2));
}catch(error){fs.writeFileSync(path.join(root,'result.json'),JSON.stringify({passed:false,results,error:error.message},null,2));process.exitCode=1;}
