import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { IslandMode, IslandSettings, TrackInfo, WidgetTab } from '../types';
import { hydrateDesktopStorage, loadSettings, saveSettings } from '../services/storageService';
import { resizeWindow } from '../services/systemService';
import { normalizeAppearance, resolveAppearance } from '../../electron/appearance.mjs';
import { contentTransition, motionTiming } from '../services/motion';
import { HeaderNav } from './HeaderNav';
import { WidgetErrorBoundary } from './WidgetErrorBoundary';
import { PillIdle } from './PillIdle';
import { AudioMixerWidget } from './widgets/AudioMixerWidget';
import { BlipAgentWidget } from './widgets/BlipAgentWidget';
import { CalendarWidget } from './widgets/CalendarWidget';
import { ClipboardWidget } from './widgets/ClipboardWidget';
import { FaceIDWidget } from './widgets/FaceIDWidget';
import { FileShelfWidget } from './widgets/FileShelfWidget';
import { FinanceSportsWidget } from './widgets/FinanceSportsWidget';
import { FocusCaffeinateWidget } from './widgets/FocusCaffeinateWidget';
import { MediaWidget } from './widgets/MediaWidget';
import { NotesWidget } from './widgets/NotesWidget';
import { SearchWidget } from './widgets/SearchWidget';
import { SettingsWidget } from './widgets/SettingsWidget';
import { SnapZonesWidget } from './widgets/SnapZonesWidget';
import { SystemWidget } from './widgets/SystemWidget';
import { WeatherWidget } from './widgets/WeatherWidget';

type BatteryState = { percent: number | null; charging: boolean; available: boolean };
const isEditing = () => Boolean(document.activeElement?.matches('input:not([type="checkbox"]):not([type="range"]), textarea, select, [contenteditable="true"]') || document.querySelector('[data-busy="true"]'));

export const IslandContainer: React.FC = () => {
  const [mode, setMode] = useState<IslandMode>('idle');
  const [activeTab, setActiveTab] = useState<WidgetTab>('media');
  const [settings, setSettings] = useState<IslandSettings>(loadSettings);
  const [track, setTrack] = useState<TrackInfo | null>(null);
  const [battery, setBattery] = useState<BatteryState>({ percent: null, charging: false, available: false });
  const [isCaffeinated, setIsCaffeinated] = useState(false);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState<{ title: string; body: string } | null>(null);
  const [hydrated, setHydrated] = useState(!window.electronAPI);
  const [storageRevision, setStorageRevision] = useState(0);
  const dialogOpen = useRef(false);
  const hoverTimer = useRef<number>();
  const collapseTimer = useRef<number>();
  const bannerTimer = useRef<number>();
  const modeRef = useRef(mode);
  const activeTabRef = useRef(activeTab);
  const focusAfterMorph = useRef<'expanded' | 'idle' | null>(null);
  const focusFrame = useRef<number>();
  const dragActive = useRef(false);
  const [systemReducedMotion, setSystemReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const reducedMotion = systemReducedMotion || settings.motionPreference === 'reduced';
  const appearance = useMemo(() => resolveAppearance(settings, systemDark), [settings.theme, settings.accentColor, systemDark]);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const previousAppearance = useRef(appearance);
  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const changed = previousAppearance.current !== appearance;
    previousAppearance.current = appearance;
    if (!surface || !changed || !hydrated) return;
    // Apply the complete palette at once; a short fade avoids unreadable color interpolation.
    surface.classList.add('is-switching-theme');
    if (reducedMotion) { surface.classList.remove('is-switching-theme'); return; }
    const animation = surface.animate([{ opacity: .94 }, { opacity: 1 }], { duration: motionTiming.theme, easing: 'ease-out' });
    animation.finished.then(() => surface.classList.remove('is-switching-theme')).catch(() => {});
    return () => { animation.cancel(); surface.classList.remove('is-switching-theme'); };
  }, [appearance, hydrated, reducedMotion]);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const colorQuery = matchMedia('(prefers-color-scheme: dark)');
    const update = () => { setSystemReducedMotion(query.matches); setSystemDark(colorQuery.matches); };
    query.addEventListener('change', update);
    colorQuery.addEventListener('change', update);
    update();
    return () => { query.removeEventListener('change', update); colorQuery.removeEventListener('change', update); };
  }, []);
  const desktop = Boolean(window.electronAPI);
  const expanded = mode === 'expanded';
  const compact = mode === 'compact' && Boolean(banner);
  const idleWidth = track ? Math.max(280, settings.idleWidth) : settings.idleWidth;
  const idleHeight = track ? Math.max(34, settings.idleHeight) : settings.idleHeight;
  const width = expanded ? settings.expandedWidth : compact ? Math.max(320, idleWidth) : idleWidth;
  const height = expanded ? settings.expandedHeight : compact ? 64 : idleHeight;
  const boundsRef = useRef({ width, height });
  boundsRef.current = { width, height };
  modeRef.current = mode;
  activeTabRef.current = activeTab;

  const restoreRequestedFocus = useCallback(() => {
    const requested = focusAfterMorph.current;
    if (!requested || requested !== modeRef.current) return;
    if (requested === 'expanded' && isEditing()) { focusAfterMorph.current = null; return; }
    const target = requested === 'expanded' ? document.getElementById(`tab-${activeTabRef.current}`) : document.querySelector<HTMLElement>('.notch-idle-open');
    if (!target) return; // AnimatePresence may still be waiting to mount this view.
    target.focus({ preventScroll: true });
    if (document.activeElement === target) focusAfterMorph.current = null;
  }, []);

  const clearCollapse = useCallback(() => window.clearTimeout(collapseTimer.current), []);
  const collapse = useCallback(() => {
    window.clearTimeout(hoverTimer.current);
    clearCollapse();
    setMode('idle');
  }, [clearCollapse]);
  const scheduleCollapse = useCallback((delay?: number): void => {
    clearCollapse();
    if (!settings.autoCollapseSeconds) return;
    collapseTimer.current = window.setTimeout(() => {
      if (isEditing() || (document.hasFocus() && document.querySelector('.notch-expanded :focus-visible')) || dragActive.current || dialogOpen.current) return scheduleCollapse(delay);
      collapse();
    }, delay ?? settings.autoCollapseSeconds * 1000);
  }, [clearCollapse, collapse, settings.autoCollapseSeconds]);
  const expand = useCallback((focus = false) => {
    window.clearTimeout(hoverTimer.current);
    clearCollapse();
    setBanner(null);
    focusAfterMorph.current = focus ? 'expanded' : null;
    if (focus) { window.cancelAnimationFrame(focusFrame.current ?? 0); focusFrame.current = window.requestAnimationFrame(restoreRequestedFocus); }
    setMode('expanded');
  }, [clearCollapse, restoreRequestedFocus]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    let active = true;
    api.invoke('desktop.bootstrap').then(data => {
      if (!active) return;
      hydrateDesktopStorage(data.storage ?? {});
      if (data.settings) setSettings({ ...data.settings, ...normalizeAppearance(data.settings) });
      setTrack(data.media ?? null);
      if (data.battery) setBattery(data.battery);
      if (data.storageError) setError(data.storageError);
      setHydrated(true);
      return api.invoke('shell.ready');
    }).catch(reason => active && setError(reason instanceof Error ? reason.message : String(reason)));
    const unsubscribers = [
      api.onDesktopEvent('media', value => setTrack(value ?? null)),
      api.onDesktopEvent('battery', setBattery),
      api.onDesktopEvent('settings', setSettings),
      api.onDesktopEvent('caffeinate', setIsCaffeinated),
      api.onDesktopEvent('open-settings', () => { setActiveTab('settings'); expand(true); }),
      api.onDesktopEvent('collapse', () => { if (!isEditing() && !dragActive.current && !dialogOpen.current) collapse(); }),
      api.onDesktopEvent('dialog-state', value => { dialogOpen.current = Boolean(value); if (value) clearCollapse(); }),
      api.onDesktopEvent('storage', value => {
        try { hydrateDesktopStorage(value ?? {}); setHydrated(true); setStorageRevision(revision => revision + 1); }
        catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
      }),
      api.onDesktopEvent('open-widget', value => {
        if (['media', 'audio', 'fileshelf', 'calendar', 'weather', 'focus', 'notes', 'clipboard', 'snapzones', 'blip', 'search', 'finance', 'faceid', 'system', 'settings'].includes(value)) {
          setActiveTab(value as WidgetTab); expand(true);
        }
      }),
      api.onDesktopEvent('desktop-error', value => setError(String(value?.message ?? 'A Windows operation failed.'))),
      api.onDesktopEvent('notification', value => {
        if (!value || typeof value.title !== 'string') return;
        setBanner({ title: value.title, body: String(value.body ?? '') });
        if (modeRef.current !== 'expanded') setMode('compact');
        window.clearTimeout(bannerTimer.current);
        bannerTimer.current = window.setTimeout(() => { setBanner(null); setMode(current => current === 'compact' ? 'idle' : current); }, 8000);
      }),
    ];
    return () => { active = false; unsubscribers.forEach(unsubscribe => unsubscribe()); };
  }, [clearCollapse, collapse, expand]);

  useEffect(() => {
    // Expand the native surface first; shrinking waits until the morph finishes.
    if (mode !== 'idle') resizeWindow(width, height).catch(reason => setError(String(reason)));
  }, [width, height, mode]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !dialogOpen.current && !document.querySelector('[data-busy="true"]')) { event.preventDefault(); focusAfterMorph.current = 'idle'; collapse(); }
    };
    const blur = () => { window.clearTimeout(hoverTimer.current); dragActive.current = false; focusAfterMorph.current = null; if (modeRef.current === 'expanded') scheduleCollapse(500); };
    const focus = () => clearCollapse();
    window.addEventListener('keydown', keyDown);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    return () => { window.removeEventListener('keydown', keyDown); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); };
  }, [collapse, scheduleCollapse, clearCollapse]);

  useEffect(() => () => {
    window.clearTimeout(hoverTimer.current);
    window.clearTimeout(collapseTimer.current);
    window.clearTimeout(bannerTimer.current);
    window.cancelAnimationFrame(focusFrame.current ?? 0);
  }, []);

  const mediaAction = async (action: string, position?: number) => {
    try {
      if (!window.electronAPI) throw new Error('Open the desktop app to control Windows media.');
      const command = action === 'toggle' ? (track?.isPlaying ? 'pause' : 'play') : action;
      await window.electronAPI.invoke('media.control', { action: command, ...(position === undefined ? {} : { position }) });
      setTrack(await window.electronAPI.invoke('media.get'));
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const updateSettings = async (next: IslandSettings) => {
    if (!window.electronAPI) { await saveSettings(next); setSettings(next); return; }
    const saved = await window.electronAPI.invoke('settings.save', { settings: next });
    setSettings(saved ?? next);
  };
  const interactive = (value: boolean) => { window.electronAPI?.invoke('shell.setInteractive', { interactive: value }).catch(() => {}); };

  return (
    <main className="notch-stage" data-theme={appearance.id} data-scheme={appearance.scheme} data-reduced-motion={reducedMotion} style={{ ...appearance.tokens, colorScheme: appearance.scheme, '--motion-feedback': `${motionTiming.feedback}ms`, '--motion-content': `${motionTiming.content}ms`, '--motion-ease': `cubic-bezier(${motionTiming.ease.join(',')})`, '--expanded-width': `${settings.expandedWidth}px`, '--expanded-height': `${settings.expandedHeight}px` } as React.CSSProperties}>
      <motion.div
        ref={surfaceRef}
        style={{ visibility: hydrated || error ? 'visible' : 'hidden' }}
        className={`notch-surface ${expanded ? 'is-expanded' : ''} ${settings.notchStyle === 'mac-notch' ? 'is-anchored' : ''}`}
        initial={false}
        animate={{ width, height, borderRadius: settings.notchStyle === 'mac-notch' ? (expanded ? '0px 0px 40px 40px' : '0px 0px 14px 14px') : expanded ? '40px' : '22px' }}
        transition={reducedMotion ? { duration: 0 } : motionTiming.morph}
        onAnimationComplete={() => {
          const bounds = boundsRef.current;
          resizeWindow(bounds.width, bounds.height).catch(reason => setError(String(reason)));
          restoreRequestedFocus();
        }}
        onPointerEnter={event => {
          interactive(true); clearCollapse();
          window.clearTimeout(hoverTimer.current);
          if (event.pointerType === 'mouse' && modeRef.current === 'idle') hoverTimer.current = window.setTimeout(() => expand(), 300);
        }}
        onPointerLeave={() => {
          window.clearTimeout(hoverTimer.current);
          if (!dragActive.current) interactive(false);
          if (modeRef.current === 'expanded') scheduleCollapse();
        }}
        onPointerCancel={() => { window.clearTimeout(hoverTimer.current); dragActive.current = false; }}
        onFocusCapture={() => { interactive(true); clearCollapse(); }}
        onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) scheduleCollapse(); }}
        onDragEnter={() => { dragActive.current = true; setActiveTab('fileshelf'); expand(); }}
        onDragOver={event => { event.preventDefault(); clearCollapse(); }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) { dragActive.current = false; scheduleCollapse(); } }}
        onDrop={event => {
          dragActive.current = false;
          if (event.defaultPrevented) return;
          event.preventDefault();
          const api = window.electronAPI;
          const paths = Array.from(event.dataTransfer.files).map(file => api?.getPathForFile?.(file)).filter((filePath): filePath is string => Boolean(filePath));
          if (!paths.length) { setError('Drop local files in the desktop app or use Add files in the shelf.'); return; }
          void api?.invoke('files.add', { paths }).then(() => setStorageRevision(revision => revision + 1)).catch(reason => setError(reason instanceof Error ? reason.message : String(reason)));
        }}
      >
        <AnimatePresence initial={false} mode="sync">
          {!expanded ? (
            <motion.div key="idle" className="notch-idle-view" initial={{ opacity: 0 }} animate={{ opacity: 1, pointerEvents: 'auto' }} exit={{ opacity: 0, pointerEvents: 'none' }} transition={reducedMotion ? { duration: 0 } : contentTransition} onAnimationComplete={restoreRequestedFocus}>
              <PillIdle track={track} battery={battery} banner={compact ? banner : null} isCaffeinated={isCaffeinated} onExpand={expand} onTogglePlay={event => { event.stopPropagation(); void mediaAction('toggle'); }} />
            </motion.div>
          ) : (
            <motion.div key="expanded" className="notch-expanded" initial={{ opacity: 0 }} animate={{ opacity: 1, pointerEvents: 'auto' }} exit={{ opacity: 0, pointerEvents: 'none' }} transition={reducedMotion ? { duration: 0 } : contentTransition} onAnimationComplete={restoreRequestedFocus}>
              <HeaderNav activeTab={activeTab} onSelectTab={tab => { setActiveTab(tab); clearCollapse(); }} onCollapse={() => { focusAfterMorph.current = 'idle'; collapse(); }} />
              {!desktop && <p className="notch-preview-note">Browser preview. Open the desktop app for Windows controls.</p>}
              {error && <div className="notch-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
              <motion.div key={`${activeTab}:${storageRevision}`} id="notch-widget-panel" role="tabpanel" aria-labelledby={`tab-${activeTab}`} className="notch-widget-panel" tabIndex={0} initial={reducedMotion ? false : { opacity: 0, transform: 'translateY(4px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }} transition={reducedMotion ? { duration: 0 } : contentTransition}>
                {!hydrated && <div className="notch-empty" role="status"><h2>Opening your workspace</h2><p>Your saved data will appear when desktop storage is ready.</p></div>}
                {hydrated && <WidgetErrorBoundary>
                {activeTab === 'media' && <MediaWidget track={track} onTogglePlay={() => void mediaAction('toggle')} onNext={() => void mediaAction('next')} onPrev={() => void mediaAction('previous')} onSeek={position => void mediaAction('seek', position)} onVolumeChange={async volume => {
                  try { await window.electronAPI?.invoke('audio.deviceVolume', { id: 'default', volume: volume / 100 }); }
                  catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
                }} />}
                {activeTab === 'audio' && <AudioMixerWidget />}
                {activeTab === 'fileshelf' && <FileShelfWidget />}
                {activeTab === 'calendar' && <CalendarWidget />}
                {activeTab === 'weather' && <WeatherWidget />}
                {activeTab === 'focus' && <FocusCaffeinateWidget isCaffeinated={isCaffeinated} onToggleCaffeinate={setIsCaffeinated} />}
                {activeTab === 'notes' && <NotesWidget />}
                {activeTab === 'clipboard' && <ClipboardWidget />}
                {activeTab === 'snapzones' && <SnapZonesWidget />}
                {activeTab === 'blip' && <BlipAgentWidget />}
                {activeTab === 'search' && <SearchWidget />}
                {activeTab === 'finance' && <FinanceSportsWidget />}
                {activeTab === 'faceid' && <FaceIDWidget />}
                {activeTab === 'system' && <SystemWidget />}
                {activeTab === 'settings' && <SettingsWidget settings={settings} onUpdateSettings={updateSettings} />}
                </WidgetErrorBoundary>}
              </motion.div>
              <footer className="notch-footer"><span>{isCaffeinated ? 'Stay awake is on' : 'Sapphire for Windows'}</span><span>Esc to collapse</span></footer>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
};
