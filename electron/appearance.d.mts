export type ThemeId = 'obsidian' | 'oled' | 'graphite' | 'amber' | 'arctic' | 'paper' | 'forest' | 'ocean' | 'crimson' | 'custom';
export type Appearance = { theme: ThemeId | 'system'; accentColor: string; motionPreference: 'system' | 'reduced' };
export const themes: { id: ThemeId; name: string; description: string; scheme: 'light' | 'dark'; surface: string; panel: string; field: string; hover: string; text: string; muted: string; border: string; strong: string; accent: string }[];
export const appearanceDefaults: Readonly<Appearance>;
export function normalizeAppearance(value: unknown): Appearance;
export function resolveAppearance(value: unknown, systemDark?: boolean): { id: ThemeId; scheme: 'light' | 'dark'; tokens: Record<string, string> };
export function contrast(a: string, b: string): number;
