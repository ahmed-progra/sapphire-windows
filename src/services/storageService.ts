import { IslandSettings, StashedFile, ClipboardItem } from '../types';
import { desktopBridge, desktopCall } from './desktopClient';
import { appearanceDefaults, normalizeAppearance } from '../../electron/appearance.mjs';
import {discardNoteRecovery,hydrateNotes,notesKey,preserveNoteDraft,readNoteRecovery,saveNotesWithRecovery} from './noteRecovery.mjs';

export const defaultSettings: IslandSettings = {
  ...appearanceDefaults, appearanceIntroSeen: false,
  notchStyle: 'mac-notch', idleWidth: 150, idleHeight: 24,
  expandedWidth: 680, expandedHeight: 480, acrylicBlur: 'medium',
  autoCollapseSeconds: 8, alwaysOnTop: true,
  startOnBoot: false, hotkey: 'Ctrl+Shift+S',
};
export const storageKeys = ['sapphire_settings', 'sapphire_stashed_files', 'sapphire_quick_notes', 'sapphire_clipboard_history', 'sapphire_calendar', 'sapphire_focus', 'sapphire_weather', 'sapphire_shortcuts'] as const;
const allowedKeys = new Set<string>(storageKeys);
export function hydrateDesktopStorage(values: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values)) {
    if (!allowedKeys.has(key) || value === undefined || value === null) continue;
    if(key===notesKey)hydrateNotes(localStorage,String(value));
    else localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  window.dispatchEvent(new Event('sapphire-storage-hydrated'));
}
export function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}
export async function saveStored(key: string, value: unknown): Promise<void> {
  if (!allowedKeys.has(key)) throw new Error('Unknown Sapphire storage key.');
  try {
    if(key===notesKey)await saveNotesWithRecovery(localStorage,String(value),async content=>{if(desktopBridge())await desktopCall('storage.save',{key,value:content});});
    else{
      if (desktopBridge()) await desktopCall('storage.save', { key, value });
      localStorage.setItem(key,JSON.stringify(value));
    }
  } catch (error) {
    window.dispatchEvent(new CustomEvent('sapphire-storage-error', { detail: error }));
    throw error;
  }
}
export const loadSettings = (): IslandSettings => {
  const stored = loadStored('sapphire_settings', {});
  return { ...defaultSettings, ...stored, ...normalizeAppearance(stored) };
};
export const saveSettings = (settings: IslandSettings) => saveStored('sapphire_settings', settings);
export const loadStashedFiles = (): StashedFile[] => loadStored('sapphire_stashed_files', []);
export const saveStashedFiles = (files: StashedFile[]) => saveStored('sapphire_stashed_files', files);
export const loadNotes = (): string => localStorage.getItem('sapphire_quick_notes') ?? '';
export const saveNotes = (notes: string) => saveStored('sapphire_quick_notes', notes);
export const loadNotesRecovery=()=>readNoteRecovery(localStorage);
export const preserveNotesRecovery=(content:string)=>preserveNoteDraft(localStorage,content);
export const discardNotesRecovery=(content:string,confirmedContent:string)=>discardNoteRecovery(localStorage,content,confirmedContent);
export const loadClipboardHistory = (): ClipboardItem[] => loadStored('sapphire_clipboard_history', []);
export const saveClipboardHistory = (items: ClipboardItem[]) => saveStored('sapphire_clipboard_history', items);
