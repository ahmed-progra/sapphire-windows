import React from 'react';
import { AudioLines, CalendarDays, ChevronUp, ClipboardList, CloudSun, Coffee, FileText, Folder, LayoutGrid, Monitor, Music2, ScanFace, Search, Settings, Sparkles, TrendingUp } from 'lucide-react';
import { WidgetTab } from '../types';

interface HeaderNavProps {
  activeTab: WidgetTab;
  onSelectTab: (tab: WidgetTab) => void;
  onCollapse: () => void;
}
const tabs = [
  { id: 'media', label: 'Music', icon: Music2 },
  { id: 'audio', label: 'Audio', icon: AudioLines },
  { id: 'fileshelf', label: 'File shelf', icon: Folder },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'weather', label: 'Weather', icon: CloudSun },
  { id: 'focus', label: 'Focus', icon: Coffee },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'clipboard', label: 'Clipboard', icon: ClipboardList },
  { id: 'snapzones', label: 'Snap zones', icon: LayoutGrid },
  { id: 'blip', label: 'Blip', icon: Sparkles },
  { id: 'search', label: 'Circle to search', icon: Search },
  { id: 'finance', label: 'Markets & sports', icon: TrendingUp },
  { id: 'faceid', label: 'Windows Hello', icon: ScanFace },
  { id: 'system', label: 'System', icon: Monitor },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

export const HeaderNav: React.FC<HeaderNavProps> = ({ activeTab, onSelectTab, onCollapse }) => {
  const moveTab = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    onSelectTab(tabs[next].id);
    document.getElementById(`tab-${tabs[next].id}`)?.focus();
  };
  return (
    <header className="notch-header">
      <div className="notch-heading">
        <div className="notch-heading-title">
          <img src="./sapphire-light.png" alt="" width="16" height="18" />
          <span>Sapphire</span><span className="notch-heading-divider" aria-hidden="true" />
          <h1>{tabs.find(tab => tab.id === activeTab)?.label}</h1>
        </div>
        <button type="button" className="notch-icon-button" aria-label="Collapse notch" title="Collapse notch (Esc)" onClick={onCollapse}><ChevronUp size={18} /></button>
      </div>
      <nav className="notch-tabs" role="tablist" aria-label="Sapphire widgets">
        {tabs.map((tab, index) => (
          <button key={tab.id} id={`tab-${tab.id}`} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls="notch-widget-panel" aria-label={tab.label} tabIndex={activeTab === tab.id ? 0 : -1} className={`notch-tab ${activeTab === tab.id ? 'is-selected' : ''}`} title={tab.label} onClick={() => onSelectTab(tab.id)} onKeyDown={event => moveTab(event, index)}><tab.icon size={17} strokeWidth={1.8} /></button>
        ))}
      </nav>
    </header>
  );
};
