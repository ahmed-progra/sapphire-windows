import type { Appearance } from '../../electron/appearance.mjs';

export type IslandMode = 'idle' | 'compact' | 'expanded';

export type WidgetTab = 
  | 'blip'
  | 'media' 
  | 'faceid'
  | 'audio' 
  | 'fileshelf' 
  | 'snapzones' 
  | 'weather' 
  | 'focus' 
  | 'clipboard' 
  | 'notes' 
  | 'finance' 
  | 'settings'
  | 'calendar'
  | 'system'
  | 'search';

export interface TrackInfo {
  title: string;
  artist: string;
  album: string;
  albumArt: string | null;
  duration: number; // in seconds
  currentTime: number;
  isPlaying: boolean;
  volume: number | null;
  controls?: { play: boolean; pause: boolean; next: boolean; previous: boolean; seek: boolean };
  lyrics: { time: number; text: string }[];
}

export interface AppVolumeItem {
  id: string;
  name: string;
  icon: string;
  volume: number;
  isMuted: boolean;
  peakLevel: number;
}

export interface StashedFile {
  id: string;
  name: string;
  size: string;
  type: string;
  dateAdded: string;
  path?: string;
  missing?: boolean;
  previewUrl?: string;
}

export interface SnapLayout {
  id: string;
  name: string;
  iconName: string;
  description: string;
  areas: { x: number; y: number; width: number; height: number }[];
}

export interface WeatherData {
  temp: number;
  condition: string;
  location: string;
  high: number;
  low: number;
  humidity: number;
  windSpeed: number;
  hourly: { time: string; temp: number; icon: string }[];
}

export interface ClipboardItem {
  id: string;
  content: string;
  type: 'text' | 'code' | 'url';
  timestamp: string;
}

export interface IslandSettings extends Appearance {
  notchStyle: 'floating-island' | 'mac-notch' | 'minimal-pill';
  idleWidth: number;
  idleHeight: number;
  expandedWidth: number;
  expandedHeight: number;
  acrylicBlur: 'light' | 'medium' | 'ultra';
  autoCollapseSeconds: number;
  accentColor: string;
  alwaysOnTop: boolean;
  startOnBoot: boolean;
  hotkey: string;
  displayId?: number;
  clipboardEnabled?: boolean;
}
