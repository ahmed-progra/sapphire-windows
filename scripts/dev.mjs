import {spawn} from 'node:child_process';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const run=(file,args)=>spawn(process.execPath,[file,...args],{stdio:'inherit',windowsHide:true});
const build=run('node_modules/typescript/bin/tsc',['-p','tsconfig.electron.json']);
await new Promise((resolve,reject)=>{build.once('exit',code=>code===0?resolve():reject(new Error('Desktop compilation failed.')));});
const vite=run('node_modules/vite/bin/vite.js',['--host','localhost']);
const cleanup=()=>{vite.kill();};process.on('SIGINT',cleanup);process.on('SIGTERM',cleanup);
let ready=false;for(let attempt=0;attempt<60;attempt++){try{const response=await fetch('http://localhost:5173');if(response.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
if(!ready){cleanup();throw new Error('The development renderer did not start.');}
const environment={...process.env};delete environment.ELECTRON_RUN_AS_NODE;
const electron=spawn(require('electron'),['.','--dev',...process.argv.slice(2)],{stdio:'inherit',windowsHide:true,env:environment});
electron.once('exit',code=>{cleanup();process.exitCode=code??1;});electron.once('error',error=>{cleanup();console.error(error.message);process.exitCode=1;});
