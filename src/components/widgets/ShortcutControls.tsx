import React,{useEffect,useState} from 'react';
import { desktopCall,messageOf } from '../../services/desktopClient';

type Action={name:string;args:Record<string,unknown>};
type Shortcut={id:string;accelerator:string;action:Action};
const choices=[
 {id:'open_notes',label:'Open notes',action:{name:'open_notes',args:{}}},
 {id:'open_calendar',label:'Open calendar',action:{name:'open_calendar',args:{}}},
 {id:'show_weather',label:'Show weather',action:{name:'show_weather',args:{}}},
 {id:'open_files',label:'Choose files',action:{name:'open_files',args:{}}},
 {id:'awake',label:'Stay awake',action:{name:'set_caffeinate',args:{enabled:true}}},
 {id:'sleep',label:'Allow sleep',action:{name:'set_caffeinate',args:{enabled:false}}},
] satisfies {id:string;label:string;action:Action}[];
const actionLabel=(action:Action)=>choices.find(choice=>choice.action.name===action.name&&(action.name!=='set_caffeinate'||choice.action.args.enabled===action.args?.enabled))?.label??'Unavailable action';

export const ShortcutControls:React.FC=()=>{
 const [shortcuts,setShortcuts]=useState<Shortcut[]>([]);const [loaded,setLoaded]=useState(false);const [accelerator,setAccelerator]=useState('');const [choice,setChoice]=useState('open_notes');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [status,setStatus]=useState('');
 const load=async()=>{setBusy(true);try{const result=await desktopCall('shortcuts.list');if(!Array.isArray(result))throw new Error('The desktop host returned an invalid shortcut list.');setShortcuts(result);setLoaded(true);setError('');}catch(e){setError(messageOf(e));}finally{setBusy(false);}};
 useEffect(()=>{void load();},[]);
 const save=async(next:Shortcut[])=>{setBusy(true);setStatus('');try{const result=await desktopCall('shortcuts.save',{shortcuts:next});setShortcuts(Array.isArray(result)?result:result?.shortcuts??next);setAccelerator('');setError('');setStatus('Shortcuts registered with Windows.');}catch(e){setError(messageOf(e));}finally{setBusy(false);}};
 const add=(event:React.FormEvent)=>{event.preventDefault();const key=accelerator.trim();const selected=choices.find(item=>item.id===choice);if(!selected||!key)return;if(shortcuts.length>=10){setError('You can register up to 10 action shortcuts.');return;}if(shortcuts.some(item=>item.accelerator.toLowerCase()===key.toLowerCase())){setError('That shortcut is already in this list.');return;}void save([...shortcuts,{id:crypto.randomUUID(),accelerator:key,action:selected.action}]);};
 return <div className="glass-card p-4 space-y-3">
  <h3 className="text-sm">Global action shortcuts</h3>
  <p className="text-[11px] text-muted">Choose up to 10 shortcuts that work while Sapphire is running. Keys already used by Windows or another app may be unavailable.</p>
  {loaded?<>
   <form onSubmit={add} className="flex flex-wrap gap-2">
    <select aria-label="Shortcut action" value={choice} onChange={e=>setChoice(e.target.value)} disabled={busy} className="bg-field rounded-xl border border-subtle px-2 py-2 text-xs">{choices.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select>
    <input aria-label="Shortcut keys" placeholder="Ctrl+Alt+N" value={accelerator} onChange={e=>setAccelerator(e.target.value)} maxLength={80} required disabled={busy} className="flex-1 min-w-24 bg-field border border-subtle rounded-xl px-3 py-2 text-xs"/>
    <button disabled={busy||!accelerator.trim()||shortcuts.length>=10} className="glass-button px-3 py-2 text-xs disabled:opacity-30">{busy?'Registering…':'Add shortcut'}</button>
   </form>
   {shortcuts.map(item=><div key={item.id} className="flex items-center justify-between gap-3 text-xs"><span>{actionLabel(item.action)}<kbd className="ml-2 text-muted font-mono">{item.accelerator}</kbd></span><button disabled={busy} className="glass-button px-2 py-1 text-xs" aria-label={'Remove '+item.accelerator} onClick={()=>void save(shortcuts.filter(value=>value.id!==item.id))}>Remove</button></div>)}
   {shortcuts.length===0&&<p className="text-[11px] text-muted">No action shortcuts configured.</p>}
  </>:<button className="glass-button px-3 py-2 text-xs" disabled={busy} onClick={load}>{busy?'Loading shortcuts…':'Retry loading shortcuts'}</button>}
  {error&&<p role="alert" className="text-xs text-warning">{error}</p>}
  {status&&<p role="status" className="text-[11px] text-muted">{status}</p>}
 </div>;
};
