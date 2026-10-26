import React, { useEffect, useState } from 'react';
import { FolderPlus, File, Trash2, Share2, ExternalLink } from 'lucide-react';
import { desktopBridge, desktopCall, messageOf } from '../../services/desktopClient';
import { StashedFile } from '../../types';
type ShelfFile = StashedFile & { path?: string; missing?: boolean };
export const FileShelfWidget: React.FC = () => {
  const [files,setFiles] = useState<ShelfFile[]>([]);
  const [error,setError] = useState('');
  const [dragging,setDragging] = useState(false);
  const refresh = async () => { try { setFiles(await desktopCall('files.list')); } catch(e) { setError(messageOf(e)); } };
  useEffect(() => { void refresh(); return desktopBridge()?.onDesktopEvent('files',setFiles); },[]);
  const operation = async (method:string, params?:Record<string,unknown>) => { try { await desktopCall(method,params); setError(''); await refresh(); } catch(e) { setError(messageOf(e)); } };
  const drop = async (event:React.DragEvent) => { event.preventDefault(); setDragging(false); const bridge=desktopBridge(); const paths=Array.from(event.dataTransfer.files).map(file=>bridge?.getPathForFile?.(file)).filter(Boolean); if (!paths.length) { setError('Native file paths are available in the desktop app. Use Add files to choose them.'); return; } await operation('files.add',{paths}); };
  const dragOut = (event:React.DragEvent,id:string) => { event.preventDefault(); const bridge=desktopBridge(); if (bridge?.startFileDrag) bridge.startFileDrag(id); else if (bridge?.startDrag) bridge.startDrag(id); else void operation('files.drag',{id}); };
  return <section className="h-full overflow-y-auto p-5 space-y-3" aria-label="File shelf">
    <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDragging(false);}} onDragEnd={()=>setDragging(false)} onDrop={drop} className={'rounded-2xl border border-dashed p-5 text-center '+(dragging?'border-[var(--accent-ink)] bg-accent-soft':'border-strong')}>
      <p className="text-sm mb-2">Drop files into your notch</p><button className="glass-button px-3 py-2 text-xs inline-flex gap-2 items-center" onClick={()=>operation('files.pick')}><FolderPlus size={14}/>Add files</button>
    </div>
    {error && <p role="alert" className="text-xs text-warning">{error}</p>}
    {files.length===0 && <p className="text-xs text-muted py-4 text-center">Your shelf is empty. Files stay in their original folders.</p>}
    {files.map(file=><div key={file.id} draggable={!file.missing && !!file.path} onDragStart={e=>dragOut(e,file.id)} className="glass-card p-3 flex items-center gap-3">
      <File size={18} className="text-muted flex-shrink-0"/><div className="flex-1 min-w-0"><p className="text-xs truncate">{file.name}</p><p className="text-[11px] text-muted truncate">{file.missing?'File moved or removed':file.path||'Imported record: add the original file again'}</p></div>
      <button disabled={file.missing || !file.path} aria-label={'Open '+file.name} className="p-2 disabled:opacity-25" onClick={()=>operation('files.open',{id:file.id})}><ExternalLink size={14}/></button>
      <button aria-label={'Remove '+file.name+' from shelf'} className="p-2 text-muted" onClick={()=>operation('files.remove',{id:file.id})}><Trash2 size={14}/></button>
    </div>)}
    <div className="glass-card p-3 flex items-center justify-between gap-4"><div><p className="text-xs">Android Quick Share</p><p className="text-[11px] text-muted mt-1">Drag a shelf file into Google Quick Share. Transfers run in its window.</p></div><button className="glass-button p-2 text-xs flex gap-2 items-center flex-shrink-0" onClick={()=>operation('shell.quickShare')}><Share2 size={14}/>Open</button></div>
  </section>;
};
