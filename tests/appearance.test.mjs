import test from 'node:test';
import assert from 'node:assert/strict';
import { themes, appearanceDefaults, normalizeAppearance, resolveAppearance, contrast } from '../electron/appearance.mjs';
import { settings, importData } from '../electron/core.mjs';

test('appearance migrates old accents and recovers invalid preferences without resetting desktop settings', () => {
  assert.deepEqual(normalizeAppearance(null), appearanceDefaults);
  const legacy = settings({ accentColor: '#12AB34', alwaysOnTop: false, idleWidth: 220, hotkey: 'Ctrl+Alt+X' });
  assert.equal(legacy.theme, 'custom');
  assert.equal(legacy.accentColor, '#12ab34');
  const recovered = settings({ ...legacy, theme: 'not-a-theme', accentColor: 'url(https://invalid)', motionPreference: 'invalid' });
  assert.equal(recovered.theme, 'obsidian');
  assert.equal(recovered.accentColor, appearanceDefaults.accentColor);
  assert.equal(recovered.motionPreference, 'system');
  for (const key of ['alwaysOnTop', 'idleWidth', 'hotkey']) assert.equal(recovered[key], legacy[key]);
});

test('all ten palettes provide readable text, statuses, focus and accent fills', () => {
  assert.equal(themes.length, 10);
  assert.equal(new Set(themes.map(theme => theme.id)).size, 10);
  for (const theme of themes) {
    const { tokens } = resolveAppearance({ theme: theme.id });
    for (const foreground of ['--text', '--muted', '--success', '--warning', '--danger', '--accent-ink']) {
      for (const background of ['--surface', '--panel', '--field', '--hover']) {
        assert.ok(contrast(tokens[foreground], tokens[background]) >= 4.5, `${theme.id}: ${foreground} on ${background}`);
      }
    }
    assert.ok(contrast(tokens['--accent'], tokens['--on-accent']) >= 4.5, theme.id + ' accent label');
    assert.ok(contrast(tokens['--border-strong'], tokens['--field']) >= 3, theme.id + ' control boundary');
  }
});

test('custom accents retain the chosen fill while text and focus stay readable at color extremes', () => {
  for (const accent of ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#123456']) {
    const { tokens } = resolveAppearance({ theme: 'custom', accentColor: accent });
    assert.equal(tokens['--accent'], accent);
    assert.ok(contrast(tokens['--accent'], tokens['--on-accent']) >= 4.5);
    for (const background of ['--surface', '--panel', '--field', '--hover']) assert.ok(contrast(tokens['--accent-ink'], tokens[background]) >= 4.5);
  }
});

test('system theme follows OS appearance without replacing the persisted selection', () => {
  const selected = settings({ theme: 'system', motionPreference: 'reduced' });
  assert.equal(resolveAppearance(selected, true).id, 'obsidian');
  assert.equal(resolveAppearance(selected, false).id, 'arctic');
  assert.equal(selected.theme, 'system');
  assert.equal(selected.motionPreference, 'reduced');
});

test('theme settings round-trip in backups without modifying notes or other preferences', () => {
  for (const theme of [...themes.map(item => item.id), 'system']) {
    const value = settings({ theme, accentColor: '#abcdef', motionPreference: 'reduced', alwaysOnTop: false, autoCollapseSeconds: 0 });
    const result = importData({ format: 'sapphire-desktop', version: 1, data: { sapphire_settings: JSON.stringify(value), sapphire_quick_notes: 'Keep\nthis note exactly.' } });
    assert.deepEqual(result.sapphire_settings, value);
    assert.equal(result.sapphire_quick_notes, 'Keep\nthis note exactly.');
  }
});
