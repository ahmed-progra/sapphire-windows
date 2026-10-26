// Browser-safe tokens shared with the desktop settings boundary.
export const themes = [
  { id: 'obsidian', name: 'Midnight Obsidian', description: 'Ink blue · cool silver', scheme: 'dark', surface: '#0c1019', panel: '#151c29', field: '#1b2433', hover: '#253146', text: '#edf2fb', muted: '#a8b5ca', border: '#344159', strong: '#7788a3', accent: '#8cb9ff' },
  { id: 'oled', name: 'OLED Black', description: 'Pure black · crisp white', scheme: 'dark', surface: '#000000', panel: '#0b0b0b', field: '#151515', hover: '#252525', text: '#f5f5f5', muted: '#b0b0b0', border: '#353535', strong: '#858585', accent: '#dedede' },
  { id: 'graphite', name: 'Graphite', description: 'Neutral charcoal · soft lilac', scheme: 'dark', surface: '#202124', panel: '#2a2b30', field: '#303238', hover: '#3b3d45', text: '#f1f0f4', muted: '#bdc0cb', border: '#494c58', strong: '#9194a3', accent: '#c0b5e4' },
  { id: 'amber', name: 'Warm Amber', description: 'Smoked brown · brushed gold', scheme: 'dark', surface: '#1d1711', panel: '#2a2219', field: '#34291e', hover: '#443527', text: '#f8efdf', muted: '#cbbb9e', border: '#504332', strong: '#a38b69', accent: '#e8b765' },
  { id: 'arctic', name: 'Arctic Light', description: 'Glacier white · cobalt', scheme: 'light', surface: '#f2f6fc', panel: '#ffffff', field: '#e7eef8', hover: '#dbe6f6', text: '#182b45', muted: '#4f6580', border: '#c5d1e2', strong: '#6c7f99', accent: '#235bb5' },
  { id: 'paper', name: 'Paper', description: 'Warm ivory · terracotta', scheme: 'light', surface: '#f4eee2', panel: '#fffaf0', field: '#eae1d2', hover: '#e2d5c2', text: '#342d24', muted: '#685a48', border: '#cfc0aa', strong: '#897761', accent: '#944729' },
  { id: 'forest', name: 'Forest', description: 'Pine green · pale sage', scheme: 'dark', surface: '#101c17', panel: '#192a21', field: '#22372b', hover: '#2e4637', text: '#e9f4e9', muted: '#acc8b1', border: '#3a5443', strong: '#789e83', accent: '#b1d89a' },
  { id: 'ocean', name: 'Ocean', description: 'Deep navy · sea glass', scheme: 'dark', surface: '#0b1c29', panel: '#122b3c', field: '#19384b', hover: '#23465a', text: '#e8f4f8', muted: '#a4c5d1', border: '#31576b', strong: '#6f9dab', accent: '#7ed5d0' },
  { id: 'crimson', name: 'Crimson', description: 'Wine charcoal · dusty rose', scheme: 'dark', surface: '#21151a', panel: '#301e26', field: '#3b2530', hover: '#4c303d', text: '#fbecf1', muted: '#d2afbc', border: '#593b48', strong: '#aa7f90', accent: '#f0a0b4' },
  { id: 'custom', name: 'Custom Accent', description: 'Your color · midnight base', scheme: 'dark', surface: '#0c1019', panel: '#151c29', field: '#1b2433', hover: '#253146', text: '#edf2fb', muted: '#a8b5ca', border: '#344159', strong: '#7788a3', accent: '#8cb9ff' },
];
export const appearanceDefaults = Object.freeze({ theme: 'obsidian', accentColor: '#8cb9ff', motionPreference: 'system' });
const validColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
export function normalizeAppearance(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    theme: input.theme === 'system' || themes.some(theme => theme.id === input.theme) ? input.theme
      : input.theme === undefined && validColor(input.accentColor) ? 'custom' : appearanceDefaults.theme,
    accentColor: validColor(input.accentColor) ? input.accentColor.toLowerCase() : appearanceDefaults.accentColor,
    motionPreference: input.motionPreference === 'reduced' ? 'reduced' : 'system',
  };
}
const channels = hex => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
export function contrast(a, b) {
  const luminance = hex => channels(hex).map(channel => {
    const value = channel / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
function readableAccent(accent, theme) {
  const rgb = channels(accent), target = channels(theme.text);
  for (let step = 0; step <= 20; step++) {
    const color = '#' + rgb.map((value, index) => Math.round(value + (target[index] - value) * step / 20).toString(16).padStart(2, '0')).join('');
    if ([theme.surface, theme.panel, theme.field, theme.hover].every(background => contrast(color, background) >= 4.5)) return color;
  }
  return theme.text;
}
export function resolveAppearance(value, systemDark = true) {
  const preferences = normalizeAppearance(value);
  const id = preferences.theme === 'system' ? systemDark ? 'obsidian' : 'arctic' : preferences.theme;
  const theme = themes.find(item => item.id === id);
  const accent = id === 'custom' ? preferences.accentColor : theme.accent;
  const light = theme.scheme === 'light';
  return { id, scheme: theme.scheme, tokens: {
    '--surface': theme.surface, '--panel': theme.panel, '--field': theme.field, '--hover': theme.hover,
    '--text': theme.text, '--muted': theme.muted, '--border': theme.border, '--border-strong': theme.strong,
    '--accent': accent, '--accent-ink': readableAccent(accent, theme),
    '--on-accent': contrast(accent, '#ffffff') > contrast(accent, '#000000') ? '#ffffff' : '#000000',
    '--success': light ? '#24613b' : '#a0d9af', '--warning': light ? '#794d09' : '#eac58b',
    '--danger': light ? '#a3283f' : '#ffb0bc',
  } };
}
