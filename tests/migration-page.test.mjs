import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {storageKeys} from '../electron/core.mjs';

const code=await readFile(new URL('../public/migration.js',import.meta.url),'utf8');
function page(origin,seed){
 const callbacks={};const elements=new Map();let downloaded;let reads=0;
 const create=()=>({textContent:'',disabled:false,children:[],append(...children){this.children.push(...children);},replaceChildren(){this.children=[];},addEventListener(name,fn){callbacks[this.id+':'+name]=fn;},click(){},remove(){}});
 for(const id of ['origin','summary','records','download','status','refresh']){const element=create();element.id=id;elements.set(id,element);}
 const context={window:{location:{origin}},document:{getElementById:id=>elements.get(id),createElement:create,body:create()},localStorage:{getItem(key){reads++;return seed.get(key)??null;}},Blob,URL:{createObjectURL(blob){downloaded=blob;return'blob:test';},revokeObjectURL(){}},setTimeout:fn=>fn()};
 vm.runInNewContext(code,context);
 return {elements,callbacks,downloaded:()=>downloaded,reads:()=>reads};
}
test('legacy browser export preserves every allowlisted raw string and excludes credential entries without mutating storage',async()=>{
 const seed=new Map([...storageKeys].map(key=>[key,key==='sapphire_quick_notes'?'Raw notes\nwith lines':'{"value":1}']));seed.set('gemini_api_key','secret fixture never exported');const before=[...seed];
 const app=page('http://localhost:54321',seed);
 assert.equal(app.elements.get('download').disabled,false);
 app.callbacks['download:click']();
 const backup=JSON.parse(await app.downloaded().text());
 assert.equal(backup.format,'sapphire-desktop');assert.equal(backup.version,1);
 assert.deepEqual(Object.keys(backup.data).sort(),[...storageKeys].sort());
 for(const key of storageKeys)assert.equal(backup.data[key],seed.get(key));
 assert.equal(backup.data.gemini_api_key,undefined);assert.deepEqual([...seed],before);
 assert.match(app.elements.get('summary').textContent,/8 of 8/);
});
test('migration blocks export from a different browser origin and leaves empty storage unchanged',()=>{
 const other=page('http://127.0.0.1:54321',new Map());assert.equal(other.elements.get('download').disabled,true);assert.equal(other.reads(),0);
 const empty=page('http://localhost:54321',new Map());assert.equal(empty.elements.get('download').disabled,true);empty.callbacks['download:click']();assert.equal(empty.downloaded(),undefined);
});
