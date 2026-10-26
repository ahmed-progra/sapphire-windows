import React, { useEffect, useRef, useState } from 'react';
import { AudioLines, CalendarDays, ChevronDown, ChevronUp, ClipboardList, CloudSun, Coffee, FileText, Folder, Grid2X2, LayoutGrid, Monitor, Music2, ScanFace, Search, Settings, Sparkles, TrendingUp, X } from 'lucide-react';
import { WidgetTab } from '../types';

const tools = [
  { id: 'media', label: 'Music', description: 'Now playing and playback', group: 'Media', icon: Music2 },
  { id: 'audio', label: 'Audio', description: 'App and output volume', group: 'Media', icon: AudioLines },
  { id: 'notes', label: 'Notes', description: 'A place for your thoughts', group: 'Productivity', icon: FileText },
  { id: 'fileshelf', label: 'Files', description: 'Keep files within reach', group: 'Productivity', icon: Folder },
  { id: 'focus', label: 'Focus', description: 'Timers and stay awake', group: 'Productivity', icon: Coffee },
  { id: 'calendar', label: 'Calendar', description: 'Your imported events', group: 'Productivity', icon: CalendarDays },
  { id: 'clipboard', label: 'Clipboard', description: 'Text you choose to keep', group: 'Productivity', icon: ClipboardList },
  { id: 'weather', label: 'Weather', description: 'Conditions and forecasts', group: 'Productivity', icon: CloudSun },
  { id: 'snapzones', label: 'Snap zones', description: 'Arrange your windows', group: 'Windows', icon: LayoutGrid },
  { id: 'system', label: 'System', description: 'Devices and desktop controls', group: 'Windows', icon: Monitor },
  { id: 'faceid', label: 'Windows Hello', description: 'Verify with Windows', group: 'Windows', icon: ScanFace },
  { id: 'blip', label: 'Blip', description: 'Chat, voice and screen help', group: 'Connected services', icon: Sparkles },
  { id: 'search', label: 'Circle to search', description: 'Ask about a selected image', group: 'Connected services', icon: Search },
  { id: 'finance', label: 'Markets & sports', description: 'Market quotes and game scores', group: 'Connected services', icon: TrendingUp },
] as const;
const daily = ['media', 'notes', 'focus', 'fileshelf'] as const;
const groups = ['Media', 'Productivity', 'Windows', 'Connected services'];

export const HeaderNav: React.FC<{ activeTab: WidgetTab; onSelectTab: (tab: WidgetTab) => void; onCollapse: () => void }> = ({ activeTab, onSelectTab, onCollapse }) => {
  const [open, setOpen] = useState(false);
  const picker = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = (restore = false) => { setOpen(false); if (restore) trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    picker.current?.querySelector<HTMLButtonElement>(`[data-tool="${activeTab}"]`)?.focus();
    if (!picker.current?.contains(document.activeElement)) picker.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const outside = (event: PointerEvent) => { if (!picker.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const select = (id: WidgetTab) => { onSelectTab(id); close(); requestAnimationFrame(() => (document.getElementById(`tab-${id}`) ?? trigger.current)?.focus()); };
  const moveDaily = (event: React.KeyboardEvent, index: number) => {
    const next = event.key === 'ArrowRight' ? (index + 1) % daily.length : event.key === 'ArrowLeft' ? (index + daily.length - 1) % daily.length : event.key === 'Home' ? 0 : event.key === 'End' ? daily.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault(); onSelectTab(daily[next]); document.getElementById(`tab-${daily[next]}`)?.focus();
  };
  return <header className="notch-header">
    <div className="notch-heading">
      <div className="notch-heading-title"><img src="./sapphire-light.png" alt="" width="16" height="18" /><span>Sapphire</span><span className="notch-heading-divider" aria-hidden="true" /><h1 id="active-widget-title">{activeTab === 'settings' ? 'Settings' : tools.find(tool => tool.id === activeTab)?.label}</h1></div>
      <div className="notch-heading-actions">
        <button id="tab-settings" className={`notch-icon-button ${activeTab === 'settings' ? 'is-selected' : ''}`} aria-label="Settings" aria-pressed={activeTab === 'settings'} title="Settings" onClick={() => select('settings')}><Settings size={17} /></button>
        <button className="notch-icon-button" aria-label="Collapse notch" title="Collapse notch (Esc)" onClick={onCollapse}><ChevronUp size={18} /></button>
      </div>
    </div>
    <div className="notch-navigation">
      <nav className="notch-tabs" role="tablist" aria-label="Daily tools">
        {daily.map((id, index) => { const tool = tools.find(item => item.id === id)!; return <button key={id} id={`tab-${id}`} role="tab" aria-selected={activeTab === id} aria-controls="notch-widget-panel" tabIndex={activeTab === id || (!daily.includes(activeTab as typeof daily[number]) && index === 0) ? 0 : -1} className={`notch-tab ${activeTab === id ? 'is-selected' : ''}`} onClick={() => select(id)} onKeyDown={event => moveDaily(event, index)}><tool.icon size={16} strokeWidth={1.8} /><span>{tool.label}</span></button>; })}
      </nav>
      <button ref={trigger} id="all-tools-toggle" className={`notch-tools-toggle ${!daily.includes(activeTab as typeof daily[number]) && activeTab !== 'settings' ? 'is-selected' : ''}`} aria-expanded={open} aria-controls="all-tools-picker" aria-haspopup="dialog" onClick={() => setOpen(value => !value)}><Grid2X2 size={16} /><span>All tools</span><ChevronDown size={12} /></button>
    </div>
    {open && <div ref={picker} id="all-tools-picker" className="tools-picker" role="dialog" aria-label="All tools" onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== trigger.current) close(); }} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
      if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); buttons[event.key === 'Home' ? 0 : buttons.length - 1]?.focus(); }
      if (step) { event.preventDefault(); buttons[(index + step + buttons.length) % buttons.length]?.focus(); }
    }}>
      <div className="tools-picker-title"><h2>All tools</h2><button className="notch-icon-button" aria-label="Close all tools" onClick={() => close(true)}><X size={16} /></button></div>
      {groups.map(group => <section key={group} aria-label={group}><h3>{group}</h3><div className="tools-grid">{tools.filter(tool => tool.group === group).map(tool => <button key={tool.id} id={daily.includes(tool.id as typeof daily[number]) ? undefined : `tab-${tool.id}`} data-tool={tool.id} className="tool-choice" aria-pressed={activeTab === tool.id} onClick={() => select(tool.id)}><tool.icon size={18} /><span><strong>{tool.label}</strong><small>{tool.description}</small></span></button>)}</div></section>)}
    </div>}
  </header>;
};
