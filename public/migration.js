(() => {
  'use strict';
  const expectedOrigin = 'http://localhost:54321';
  const entries = [
    ['sapphire_settings', 'Settings'],
    ['sapphire_stashed_files', 'File shelf'],
    ['sapphire_quick_notes', 'Quick notes'],
    ['sapphire_clipboard_history', 'Clipboard history'],
    ['sapphire_calendar', 'Calendar'],
    ['sapphire_focus', 'Focus and eye breaks'],
    ['sapphire_weather', 'Weather location'],
    ['sapphire_shortcuts', 'Action shortcuts'],
  ];
  const origin = document.getElementById('origin');
  const summary = document.getElementById('summary');
  const records = document.getElementById('records');
  const download = document.getElementById('download');
  const status = document.getElementById('status');

  function inspect() {
    records.replaceChildren();
    download.disabled = true;
    if (window.location.origin !== expectedOrigin) {
      origin.textContent = 'Current origin: ' + window.location.origin;
      summary.textContent = 'Open the localhost address shown above in the original browser profile. Browser storage belongs to its exact origin.';
      return null;
    }
    origin.textContent = 'Reading only ' + expectedOrigin + ' in this browser profile.';
    try {
      const data = Object.create(null);
      let characters = 0;
      for (const [key, label] of entries) {
        const raw = localStorage.getItem(key);
        const row = document.createElement('li');
        row.textContent = label + ' (' + key + '): ' + (raw === null ? 'not present' : raw.length.toLocaleString() + ' stored characters');
        records.append(row);
        if (raw !== null) {
          data[key] = raw;
          characters += raw.length;
        }
      }
      const count = Object.keys(data).length;
      summary.textContent = count + ' of ' + entries.length + ' data entries found · ' + characters.toLocaleString() + ' stored characters. Credential entries are excluded.';
      download.disabled = count === 0;
      return { format: 'sapphire-desktop', version: 1, data };
    } catch (error) {
      summary.textContent = 'Browser storage could not be read. ' + (error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  document.getElementById('refresh').addEventListener('click', () => { status.textContent = ''; inspect(); });
  download.addEventListener('click', () => {
    try {
      const backup = inspect();
      if (!backup || !Object.keys(backup.data).length) return;
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sapphire-browser-backup.json';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = 'Backup download requested. Import the file in the desktop app’s Settings.';
    } catch (error) {
      status.textContent = 'Backup could not be created. ' + (error instanceof Error ? error.message : String(error));
    }
  });
  inspect();
})();
