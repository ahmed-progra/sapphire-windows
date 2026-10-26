import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build,Platform,Arch} from 'electron-builder';
import {getWindowsKitsBundle} from 'app-builder-lib/out/toolsets/windows.js';

const target=process.argv[2]??'nsis';
if(!['nsis','zip','appx','release'].includes(target))throw new Error('Choose nsis, zip, appx or release.');
const project=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
if(target==='appx'){
 const vendor=await getWindowsKitsBundle({winCodeSign:'1.1.0',arch:Arch.x64});
 const localKit=path.join(project,'.tools','packaging-kit');
 // shortcut: SxS activation fails in this host's cached kit location; use an unmodified local copy.
 fs.cpSync(vendor.kit,localKit,{recursive:true});
 process.env.ELECTRON_BUILDER_WINDOWS_KITS_PATH=localKit;
}
await build({projectDir:project,targets:Platform.WINDOWS.createTarget(target==='release'?['nsis','zip']:target,Arch.x64)});
