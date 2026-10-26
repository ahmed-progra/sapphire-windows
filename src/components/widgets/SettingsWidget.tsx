import React, { useEffect, useState } from 'react';
import { Check, Download, KeyRound, Monitor, Upload } from 'lucide-react';
import { IslandSettings } from '../../types';
import { storageKeys } from '../../services/storageService';
import { resolveAppearance, themes } from '../../../electron/appearance.mjs';

interface SettingsWidgetProps {
  settings: IslandSettings;
  onUpdateSettings: (settings: IslandSettings) => Promise<void> | void;
}
type Provider = 'gemini' | 'finnhub' | 'sports';
const providers: { id: Provider; name: string; description: string }[] = [
  { id: 'gemini', name: 'Gemini', description: 'Blip, live conversations and screen search' },
  { id: 'finnhub', name: 'Finnhub', description: 'Market quotes and watchlists' },
  { id: 'sports', name: 'API-Sports', description: 'Live scores and sports results' },
];

export const SettingsWidget: React.FC<SettingsWidgetProps> = ({ settings, onUpdateSettings }) => {
  const api = window.electronAPI;
  const desktopSettings = settings as IslandSettings & { displayId?: number; clipboardEnabled?: boolean };
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [keys, setKeys] = useState<Record<Provider, string>>({ gemini: '', finnhub: '', sports: '' });
  const [configured, setConfigured] = useState<Record<Provider, boolean>>({ gemini: false, finnhub: false, sports: false });
  const [displays, setDisplays] = useState<{ id: number; label: string }[]>([]);
  const [capabilities, setCapabilities] = useState<Record<string, { available: boolean; reason?: string }>>({});
  const [clipboardEnabled, setClipboardEnabled] = useState(desktopSettings.clipboardEnabled ?? false);
  const [hotkey, setHotkey] = useState(settings.hotkey);
  const [collapseSeconds, setCollapseSeconds] = useState(String(settings.autoCollapseSeconds));
  const [version, setVersion] = useState('');
  const [customAccent, setCustomAccent] = useState(settings.accentColor);
  const [startupManagedByWindows, setStartupManagedByWindows] = useState<boolean | null>(api ? null : false);

  useEffect(() => { setHotkey(settings.hotkey); setCollapseSeconds(String(settings.autoCollapseSeconds)); }, [settings.hotkey, settings.autoCollapseSeconds]);
  useEffect(() => setCustomAccent(settings.accentColor), [settings.accentColor]);
  useEffect(() => {
    let active = true;
    if (api) api.invoke('desktop.bootstrap').then(data => {
      if (!active) return;
      setDisplays(data.displays ?? []);
      setConfigured(data.serviceKeys ?? { gemini: false, finnhub: false, sports: false });
      setClipboardEnabled(Boolean(data.clipboardEnabled));
      setCapabilities(data.capabilities ?? {});
      setVersion(data.version ?? '');
      setStartupManagedByWindows(Boolean(data.startupManagedByWindows));
    }).catch(reason => { if (active) { setMessage(String(reason)); setFailed(true); } });
    return () => { active = false; };
  }, [api]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setMessage(''); setFailed(false);
    try { const result = await action(); if (!(result as { cancelled?: boolean } | undefined)?.cancelled) setMessage(success); }
    catch (reason) { setFailed(true); setMessage(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  const update = (patch: Partial<IslandSettings>) => run(async () => { await onUpdateSettings({ ...settings, ...patch }); }, 'Settings saved.');
  const credential = (provider: Provider, remove = false) => run(async () => {
    if (!api) throw new Error('Open the desktop app to store service keys.');
    await api.invoke('credentials.set', { provider, key: remove ? '' : keys[provider].trim() });
    setKeys(current => ({ ...current, [provider]: '' }));
    setConfigured(await api.invoke('credentials.status'));
  }, remove ? 'Key removed.' : 'Key saved in Windows-protected storage.');
  const exportData = async () => {
    if (api) return api.invoke('storage.export');
    const data = Object.fromEntries(storageKeys.flatMap(key => {
      const value = localStorage.getItem(key);
      return value === null ? [] : [[key, value]];
    }));
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'sapphire-desktop', version: 1, data }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'sapphire-data.json'; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="notch-settings" data-busy={busy ? 'true' : undefined}>
      <section className="settings-section" aria-labelledby="appearance-heading">
        <div className="settings-section-heading"><h2 id="appearance-heading">Appearance</h2><span role={failed ? 'alert' : 'status'} className={`settings-status ${failed ? 'is-error' : ''}`}>{message}</span></div>
        <p>A different atmosphere, the same workspace.</p>
        <label className="settings-row"><span>Match Windows<small>Switch between Arctic Light and Midnight Obsidian.</small></span><input className="settings-switch" role="switch" type="checkbox" checked={settings.theme === 'system'} disabled={busy} onChange={event => void update({ theme: event.target.checked ? 'system' : 'obsidian' })} /></label>
        <div className="settings-themes" role="group" aria-label="Theme">
          {themes.map(theme => {
            const preview = resolveAppearance({ theme: theme.id, accentColor: settings.accentColor });
            return <button type="button" key={theme.id} className={`settings-theme ${settings.theme === theme.id ? 'is-selected' : ''}`} aria-label={theme.name} aria-pressed={settings.theme === theme.id} disabled={busy} onClick={() => void update({ theme: theme.id })}>
              <span className="theme-preview" style={preview.tokens as React.CSSProperties} aria-hidden="true"><span className="theme-preview-nav"><i /><i /><i /></span><span className="theme-preview-lines"><i /><i /></span><span className="theme-preview-accent" /></span>
              <span className="theme-name">{theme.name}{settings.theme === theme.id && <Check size={12} aria-hidden="true" />}</span><span className="theme-description">{theme.description}</span>
            </button>;
          })}
        </div>
        {settings.theme === 'custom' && <form className="settings-field" onSubmit={event => { event.preventDefault(); if (/^#[0-9a-f]{6}$/i.test(customAccent)) void update({ accentColor: customAccent }); }}>
          <label htmlFor="custom-accent">Custom accent</label><div className="settings-inline"><input type="color" aria-label="Pick accent color" value={/^#[0-9a-f]{6}$/i.test(customAccent) ? customAccent : settings.accentColor} onChange={event => setCustomAccent(event.target.value)} disabled={busy} /><input id="custom-accent" className="settings-input" value={customAccent} onChange={event => setCustomAccent(event.target.value)} pattern="#[0-9a-fA-F]{6}" maxLength={7} required spellCheck={false} disabled={busy} /><button className="notch-button" disabled={busy || !/^#[0-9a-f]{6}$/i.test(customAccent)}>Apply accent</button></div><p className="settings-hint">Text and focus colors adapt to keep your accent readable.</p>
        </form>}
        <label className="settings-row"><span>Motion<small>Windows reduced-motion preferences are always respected.</small></span><select aria-label="Motion preference" className="settings-input" value={settings.motionPreference} disabled={busy} onChange={event => void update({ motionPreference: event.target.value as IslandSettings['motionPreference'] })}><option value="system">Follow Windows</option><option value="reduced">Reduce motion</option></select></label>
        <h3 className="settings-subheading">Notch shape</h3>
        <div className="settings-styles" role="group" aria-label="Notch shape">
          {[{ id: 'mac-notch', name: 'Notch' }, { id: 'floating-island', name: 'Island' }, { id: 'minimal-pill', name: 'Pill' }].map(style => (
            <button type="button" key={style.id} className={`settings-style ${settings.notchStyle === style.id ? 'is-selected' : ''}`} disabled={busy} aria-pressed={settings.notchStyle === style.id} onClick={() => void update({ notchStyle: style.id as IslandSettings['notchStyle'], idleWidth: style.id === 'floating-island' ? 180 : 150, idleHeight: style.id === 'floating-island' ? 32 : 24 })}><span className={`settings-style-preview ${style.id}`} aria-hidden="true" />{style.name}</button>
          ))}
        </div>
      </section>
      <section className="settings-section" aria-labelledby="desktop-heading">
        <h2 id="desktop-heading">Desktop</h2>
        <label className="settings-row"><span>Always on top<small>Stay above regular windows. Windows sign-in and secure prompts remain protected.</small></span><input type="checkbox" checked={settings.alwaysOnTop} disabled={busy || !api} onChange={event => void update({ alwaysOnTop: event.target.checked })} /></label>
        {startupManagedByWindows === true ? <div className="settings-row"><span>Open at sign-in<small>Windows manages this app in Startup apps.</small></span><button type="button" className="notch-button" disabled={busy || !api} onClick={() => void run(() => api!.invoke('shell.openStartupSettings'), 'Windows Startup apps opened.')}>Startup apps</button></div> : startupManagedByWindows === null ? <div className="settings-row"><span>Open at sign-in<small>Checking Windows startup controls…</small></span></div> : <label className="settings-row"><span>Open at sign-in<small>Start quietly with your Windows account.</small></span><input type="checkbox" checked={settings.startOnBoot} disabled={busy || !api} onChange={event => void update({ startOnBoot: event.target.checked })} /></label>}
        <label className="settings-row"><span>Display</span><select className="settings-input" value={desktopSettings.displayId ?? displays[0]?.id ?? ''} disabled={busy || !api || !displays.length} onChange={event => void update({ displayId: Number(event.target.value) } as Partial<IslandSettings>)}>{!displays.length && <option value="">Primary display</option>}{displays.map(display => <option key={display.id} value={display.id}>{display.label}</option>)}</select></label>
        <form className="settings-row" onSubmit={event => { event.preventDefault(); void update({ hotkey: hotkey.trim() }); }}><label htmlFor="show-shortcut">Show / hide shortcut</label><div className="settings-inline"><input id="show-shortcut" className="settings-input" value={hotkey} onChange={event => setHotkey(event.target.value)} disabled={busy || !api} autoComplete="off" spellCheck={false} aria-label="Global shortcut" /><button type="submit" className="notch-button" disabled={busy || !api || !hotkey.trim()}>Apply</button></div></form>
        <form className="settings-row" onSubmit={event => { event.preventDefault(); const value = Number(collapseSeconds); if (Number.isInteger(value) && value >= 0 && value <= 300) void update({ autoCollapseSeconds: value }); else { setFailed(true); setMessage('Choose a whole number from 0 to 300 seconds.'); } }}><label htmlFor="collapse-seconds">Collapse after<small>Seconds after the pointer leaves. Use 0 to keep it open.</small></label><div className="settings-inline"><input id="collapse-seconds" className="settings-input" type="number" min="0" max="300" value={collapseSeconds} onChange={event => setCollapseSeconds(event.target.value)} disabled={busy} /><button type="submit" className="notch-button" disabled={busy}>Apply</button></div></form>
      </section>
      <section className="settings-section" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading">Data & privacy</h2>
        <label className="settings-row"><span>Collect clipboard history<small>Text you copy is saved locally until you clear it. Leave this off for sensitive work.</small></span><input type="checkbox" checked={clipboardEnabled} disabled={busy || !api} onChange={event => { const enabled = event.target.checked; void run(async () => { await api?.invoke('clipboard.enable', { enabled }); setClipboardEnabled(enabled); }, enabled ? 'Clipboard history enabled.' : 'Clipboard collection stopped.'); }} /></label>
        <div className="settings-inline"><button type="button" className="notch-button" disabled={busy} onClick={() => void run(exportData, 'Data exported. Service keys are excluded.')}><Download size={13} className="inline mr-1.5" />Export data</button><button type="button" className="notch-button" disabled={busy || !api} onClick={() => void run(async () => api?.invoke('storage.import'), 'Data imported.')}><Upload size={13} className="inline mr-1.5" />Import data</button></div>
        <p className="settings-hint">Import or export your notes, settings, shelf, clipboard, calendar, focus, weather and action shortcuts. Original files are never moved or deleted.</p>
      </section>
      <section className="settings-section" aria-labelledby="services-heading">
        <h2 id="services-heading"><KeyRound size={13} className="inline mr-1.5" />Connected services</h2>
        <p>Keys stay on this computer. Each provider's usage limits and charges apply.</p>
        <div className="settings-keys">{providers.map(provider => (
          <form key={provider.id} className="settings-field" onSubmit={event => { event.preventDefault(); void credential(provider.id); }}>
            <label htmlFor={`key-${provider.id}`}>{provider.name}{configured[provider.id] && <span className="text-success ml-2 text-[10px]"><Check size={10} className="inline" /> Key saved</span>}</label>
            <span className="settings-hint">{provider.description}</span>
            <div className="settings-inline"><input id={`key-${provider.id}`} className="settings-input" type="password" value={keys[provider.id]} placeholder={configured[provider.id] ? 'Enter a replacement key' : 'Enter API key'} autoComplete="off" spellCheck={false} disabled={busy || !api} onChange={event => setKeys(current => ({ ...current, [provider.id]: event.target.value }))} /><button type="submit" className="notch-button" disabled={busy || !api || !keys[provider.id].trim()}>Save</button>{configured[provider.id] && <button type="button" className="notch-button" disabled={busy || !api} onClick={() => void credential(provider.id, true)}>Remove</button>}</div>
          </form>
        ))}</div>
      </section>
      {api && <section className="settings-section" aria-labelledby="capabilities-heading"><h2 id="capabilities-heading"><Monitor size={13} className="inline mr-1.5" />Windows integration</h2><div className="settings-capabilities">{[{ id: 'media', label: 'Media controls' }, { id: 'audio', label: 'Audio mixer' }, { id: 'snap', label: 'Window snapping' }, { id: 'brightness', label: 'Display brightness' }, { id: 'battery', label: 'Battery' }, { id: 'bluetooth', label: 'Bluetooth' }, { id: 'hello', label: 'Windows Hello' }].map(item => <div key={item.id} title={capabilities[item.id]?.reason} className={`settings-capability ${capabilities[item.id]?.available ? 'is-available' : ''}`}><span className="capability-dot" /><span>{item.label}{capabilities[item.id]?.available ? '' : ' unavailable'}</span></div>)}</div><p>Secure lock-screen overlays, universal charge limits and driver-based audio processing are unavailable in this build.</p>{version && <p>Version {version}</p>}</section>}
      <footer className="settings-attribution">
        <p>Sapphire by cshariq (Shariq Charolia) and contributors. Windows adaptation © 2026 contributors.</p>
        <p>AGPL-3.0 · No warranty. {[
          { label: 'Source', url: 'https://github.com/ahmed-progra/sapphire-windows' },
          { label: 'License', url: 'https://github.com/ahmed-progra/sapphire-windows/blob/main/LICENSE' },
        ].map(link => <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" onClick={event => {
          if (!api) return;
          event.preventDefault();
          void run(() => api.invoke('shell.openExternal', { url: link.url }), '');
        }}>{link.label}</a>)}</p>
      </footer>
    </div>
  );
};
