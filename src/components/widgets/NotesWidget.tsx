import React,{useRef,useState} from 'react';
import {discardNotesRecovery,loadNotes,loadNotesRecovery,preserveNotesRecovery,saveNotes} from '../../services/storageService';
import {messageOf} from '../../services/desktopClient';

export const NotesWidget:React.FC=()=>{
 const [content,setContent]=useState(loadNotes);const [recovery,setRecovery]=useState(loadNotesRecovery);const [restored,setRestored]=useState(false);const [saving,setSaving]=useState(false);const [status,setStatus]=useState('Notes loaded on this computer');const [error,setError]=useState('');const revision=useRef(0);const confirmedRevision=useRef(0);const confirmedContent=useRef(content);
 const save=async(value:string)=>{
  const current=++revision.current;setContent(value);setStatus('Saving…');setSaving(true);
  try{
   await saveNotes(value);
   if(current>=confirmedRevision.current){confirmedRevision.current=current;confirmedContent.current=value;}
   if(current===revision.current){setStatus('Saved on this computer');setError('');setRecovery(loadNotesRecovery());setRestored(false);}
  }catch(e){if(current===revision.current){setStatus('Couldn’t save. Your text is still in the editor.');setError(messageOf(e));setRecovery(loadNotesRecovery());}}
  finally{if(current===revision.current)setSaving(false);}
 };
 const restore=()=>{if(!recovery)return;setContent(recovery.content);setRestored(true);setStatus('Recovered draft opened. Save restored draft to replace the current desktop notes.');};
 const discard=()=>{if(!recovery)return;try{discardNotesRecovery(recovery.content,confirmedContent.current);setRecovery(null);setRestored(false);setContent(confirmedContent.current);setStatus('Recovery discarded. Last confirmed notes are shown.');}catch(e){setError(messageOf(e));}};
 return <section className="h-full p-5 flex flex-col gap-3" aria-label="Quick notes" data-keep-open={saving||restored||content!==confirmedContent.current ? true : undefined}>
  <div className="flex justify-between text-xs text-muted"><h3 className="text-content text-sm">Quick notes</h3><span>{content.trim()?content.trim().split(/\s+/).length:0} words</span></div>
  {recovery&&<div className="glass-card p-3 space-y-2">
   <p className="text-xs text-warning">A local recovery draft is available ({new Date(recovery.updatedAt).toLocaleString()}).</p>
   <p className="text-[11px] text-muted">Restore opens the draft for review without saving. Choose Save restored draft or Retry saving to replace desktop notes. Discard removes the recovery copy.</p>
   <div className="flex gap-2"><button disabled={saving} className="glass-button px-3 py-1.5 text-xs" onClick={restore}>Restore in editor</button><button disabled={saving} className="glass-button px-3 py-1.5 text-xs" onClick={discard}>Discard recovery</button></div>
  </div>}
  <textarea aria-label="Quick notes" readOnly={!!recovery&&!restored} value={content} onChange={event=>{if(restored){const value=event.target.value;setContent(value);try{preserveNotesRecovery(value);setRecovery(loadNotesRecovery());setStatus('Recovered draft changed. Choose Save restored draft to save it.');}catch(e){setStatus('Recovery copy could not be updated. Keep this editor open.');setError(messageOf(e));}}else void save(event.target.value);}} placeholder="A thought, a list, something to remember…" className="flex-1 min-h-24 w-full resize-none rounded-2xl p-4 bg-field border border-subtle focus:border-strong outline-none text-sm leading-relaxed select-text read-only:opacity-60"/>
  {restored&&<button disabled={saving} className="glass-button px-3 py-2 text-xs" onClick={()=>void save(content)}>{saving?'Saving…':'Save restored draft'}</button>}
  <p role="status" className="text-[11px] text-muted">{status}</p>
  {error&&<div role="alert" className="text-xs text-warning">{error}<button disabled={saving} onClick={()=>void save(content)} className="ml-2 underline">Retry saving</button></div>}
 </section>;
};
