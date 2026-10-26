import React, { useEffect, useState } from 'react';
import { Copy, Trash2, Clipboard } from 'lucide-react';
import { ClipboardItem } from '../../types';
import { desktopBridge, desktopCall, messageOf } from '../../services/desktopClient';
export const ClipboardWidget:React.FC=()=>{
  const [items,setItems]=useState<ClipboardItem[]>([]);const [enabled,setEnabled]=useState(false);const [search,setSearch]=useState('');const [error,setError]=useState('');const [copied,setCopied]=useState('');const [confirmClear,setConfirmClear]=useState(false);const [clearing,setClearing]=useState(false);
  const visible=items.filter(item=>item.content.toLowerCase().includes(search.toLowerCase()));
  const clear=async()=>{setClearing(true);try{await desktopCall('clipboard.clear');setItems([]);setConfirmClear(false);setError('');}catch(e){setError(messageOf(e));}finally{setClearing(false);}};
  useEffect(()=>{desktopCall('clipboard.list').then(value=>setItems(Array.isArray(value)?value:value.items??[])).catch(e=>setError(messageOf(e)));desktopCall('desktop.bootstrap').then(value=>setEnabled(!!value.clipboardEnabled)).catch(()=>{});return desktopBridge()?.onDesktopEvent('clipboard',value=>setItems(Array.isArray(value)?value:value.items??[]));},[]);
  const enable=async()=>{try{await desktopCall('clipboard.enable',{enabled:!enabled});setEnabled(!enabled);setError('');}catch(e){setError(messageOf(e));}};
  const copy=async(item:ClipboardItem)=>{try{await desktopCall('clipboard.copy',{content:item.content});setCopied(item.id);setError('');}catch(e){setError(messageOf(e));}};
  return <section className="h-full overflow-y-auto p-5 space-y-3" aria-label="Clipboard history">
    <div className="flex items-center justify-between gap-4"><div><h3 className="text-sm">Clipboard history</h3><p className="text-[11px] text-muted mt-1">Text is stored on this computer. Pause collection for sensitive work.</p></div><button className="glass-button px-3 py-2 text-xs" aria-pressed={enabled} onClick={enable}>{enabled?'Pause collection':'Enable collection'}</button></div>
    <div className="flex gap-2"><input aria-label="Search clipboard" placeholder="Search history" value={search} onChange={e=>setSearch(e.target.value)} className="flex-1 min-w-0 bg-field border border-subtle rounded-xl px-3 py-2 text-xs"/><button className="glass-button p-2" aria-label="Clear clipboard history" disabled={!items.length||clearing} onClick={()=>setConfirmClear(true)}><Trash2 size={15}/></button></div>
    {confirmClear&&<div className="glass-card p-3 space-y-2" role="group" aria-label="Clear clipboard history confirmation"><p className="text-xs">Clear all saved clipboard text? This cannot be undone.</p><div className="flex gap-2"><button data-clipboard-confirm className="glass-button px-3 py-2 text-xs" disabled={clearing} onClick={()=>void clear()}>{clearing?'Clearing…':'Clear history'}</button><button data-clipboard-cancel className="glass-button px-3 py-2 text-xs" disabled={clearing} onClick={()=>setConfirmClear(false)}>Keep history</button></div></div>}
    {items.length>0&&visible.length===0&&<p className="py-6 text-center text-sm text-muted">No matching text. Try a different search.</p>}
    {error&&<p role="alert" className="text-xs text-warning">{error}</p>}
    {items.length===0&&<div className="py-8 text-center text-muted text-sm"><Clipboard className="mx-auto mb-3"/>Copy text after enabling collection to add it here.</div>}
    {visible.map(item=><button key={item.id} className="glass-card p-3 flex gap-3 w-full text-left" onClick={()=>copy(item)}><p className="flex-1 min-w-0 text-xs whitespace-pre-wrap break-words line-clamp-3">{item.content}</p><span className="text-[10px] text-muted">{copied===item.id?'Copied':<Copy size={14}/>}</span></button>)}
  </section>;
};
