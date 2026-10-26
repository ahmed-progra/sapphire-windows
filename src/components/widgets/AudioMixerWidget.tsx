import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, RefreshCw } from 'lucide-react';
import { desktopBridge, desktopCall, messageOf } from '../../services/desktopClient';
type AudioItem = { id: string; name: string; volume: number; isMuted: boolean; peakLevel?: number; isDefault?: boolean };
export const AudioMixerWidget: React.FC = () => {
  const [tab, setTab] = useState<'sessions' | 'devices' | 'eq'>('sessions');
  const [data, setData] = useState<{ sessions: AudioItem[]; devices: AudioItem[] }>({ sessions: [], devices: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = async () => { try { setData(await desktopCall('audio.get')); setError(''); } catch (e) { setError(messageOf(e)); } finally { setLoading(false); } };
  useEffect(() => { void refresh(); const timer = setInterval(refresh, 1500); const off = desktopBridge()?.onDesktopEvent('audio', setData); return () => { clearInterval(timer); off?.(); }; }, []);
  const update = async (item: AudioItem, patch: { volume?: number; muted?: boolean }) => {
    try { await desktopCall(tab === 'devices' ? 'audio.deviceVolume' : 'audio.volume', { id: item.id, volume: item.volume, ...patch }); await refresh(); } catch (e) { setError(messageOf(e)); }
  };
  return <section className="h-full overflow-y-auto p-5 space-y-4" aria-label="Audio mixer">
    <div className="flex items-center gap-2">{(['sessions','devices','eq'] as const).map(t => <button className={'glass-button px-3 py-2 text-xs '+(tab===t?'text-content':'text-muted')} aria-pressed={tab===t} key={t} onClick={() => setTab(t)}>{t==='sessions'?'Applications':t==='devices'?'Output devices':'Equalizer'}</button>)}<button className="ml-auto glass-button p-2" onClick={refresh} aria-label="Refresh audio"><RefreshCw size={14}/></button></div>
    {error && <p role="alert" className="text-xs text-warning">{error}</p>}
    {tab==='eq' ? <div className="glass-card p-5 text-sm text-muted leading-relaxed">System-wide per-app EQ and simultaneous multi-device routing need an audio driver. This build uses standard Windows audio controls. No equalizer is applied.</div> : <>
      {loading && <p className="text-sm text-muted">Finding audio sessions…</p>}
      {!loading && data[tab].length===0 && <p className="text-sm text-muted">{tab==='sessions'?'Play audio in an application to see its session.':'No output devices are available.'}</p>}
      {data[tab].map(item => <div key={item.id} className="glass-card p-3 flex items-center gap-3">
        <button className="p-2" aria-label={(item.isMuted?'Unmute ':'Mute ')+item.name} onClick={() => update(item,{muted:!item.isMuted})}>{item.isMuted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button>
        <div className="flex-1 min-w-0"><div className="flex justify-between text-xs mb-2"><span className="truncate">{item.name}{item.isDefault?' · Default':''}</span><span>{Math.round(item.volume*100)}%</span></div>
        <input aria-label={item.name+' volume'} className="w-full" type="range" min="0" max="1" step="0.01" value={item.volume} onChange={e => update(item,{volume:Number(e.target.value)})}/>
        {item.peakLevel!==undefined && <meter className="w-full h-1" min="0" max="1" value={item.peakLevel} aria-label={item.name+' output level'}/>}</div>
      </div>)}
    </>}
  </section>;
};
