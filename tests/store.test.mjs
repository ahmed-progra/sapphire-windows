import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store} from '../electron/store.mjs';
test('store atomically persists notes and refuses invalid imports without changing existing data',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sapphire-store-'));
 try{const store=new Store(dir);store.set('sapphire_quick_notes','real note');assert.equal(new Store(dir).get('sapphire_quick_notes'),'real note');
 const before=fs.readFileSync(store.file,'utf8');assert.throws(()=>store.import({sapphire_settings:{idleWidth:-10}}));assert.equal(fs.readFileSync(store.file,'utf8'),before);
 store.import({sapphire_quick_notes:'imported'});assert.equal(store.get('sapphire_quick_notes'),'imported');assert.equal(JSON.parse(fs.readFileSync(store.file+'.before-import','utf8')).data.sapphire_quick_notes,'real note');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('a corrupt store is preserved and cannot be silently overwritten',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sapphire-corrupt-'));
 try{fs.writeFileSync(path.join(dir,'sapphire-data.json'),'broken');const store=new Store(dir);assert.ok(store.error);assert.throws(()=>store.set('sapphire_quick_notes','replacement'));assert.equal(fs.readFileSync(store.file,'utf8'),'broken');store.import({sapphire_quick_notes:'recovered'});assert.equal(fs.readFileSync(store.file+'.before-import','utf8'),'broken');fs.writeFileSync(store.file,'{"sapphire_quick_notes":"private-fixture-contents"');assert.ok(!new Store(dir).error.includes('private-fixture-contents'));}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('import preflights runtime configuration and rolls it back if persistence fails',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sapphire-transaction-'));
 try{const store=new Store(dir);store.set('sapphire_quick_notes','original');const before=fs.readFileSync(store.file,'utf8');
 assert.throws(()=>store.import({sapphire_quick_notes:'incoming'},()=>{throw Error('shortcut in use');}),/shortcut in use/);
 assert.equal(fs.readFileSync(store.file,'utf8'),before);assert.equal(store.get('sapphire_quick_notes'),'original');
 let runtime='old';store.write=()=>{throw Error('disk full');};
 assert.throws(()=>store.import({sapphire_quick_notes:'incoming'},()=>{runtime='new';return()=>{runtime='old';};}),/disk full/);
 assert.equal(runtime,'old');assert.equal(fs.readFileSync(store.file,'utf8'),before);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
