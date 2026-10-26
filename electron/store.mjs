import fs from 'node:fs';
import path from 'node:path';
import {importData,validateStorage} from './core.mjs';
export class Store {
  constructor(directory) {
    this.file=path.join(directory,'sapphire-data.json');this.data={};this.error=null;
    fs.mkdirSync(directory,{recursive:true});
    if(fs.existsSync(this.file))try{this.data=importData(JSON.parse(fs.readFileSync(this.file,'utf8')));}catch{this.error='Saved data could not be read. The original file was preserved. Import a validated backup to recover it.';}
  }
  get(key){return this.data[key]??null;}
  write(data){
    if(this.error)throw new Error(this.error);
    const next={format:'sapphire-desktop',version:1,data};
    const temporary=this.file+'.tmp';fs.writeFileSync(temporary,JSON.stringify(next,null,2),{mode:0o600});
    fs.renameSync(temporary,this.file);this.data=data;
  }
  set(key,value){const checked=validateStorage(key,value);this.write({...this.data,[key]:checked});return checked;}
  import(input,prepare=()=>()=>{}){const incoming=importData(input);const rollback=prepare(incoming);const prior=this.error;try{if(fs.existsSync(this.file))fs.copyFileSync(this.file,this.file+'.before-import');this.error=null;this.write({...this.data,...incoming});}catch(error){this.error=prior;rollback();throw error;}return incoming;}
  export(){return {format:'sapphire-desktop',version:1,data:this.data};}
}
