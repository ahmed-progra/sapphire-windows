// Run only from the Electron smoke profile; this exercises navigation without
// authorizing hardware, authentication, capture, clipboard or provider mutations.
export async function runRendererSmoke(window) {
  const probe = async function () {
    const failures = [];
    const error = event => failures.push(String(event.error?.message ?? event.message ?? 'Renderer error'));
    const rejection = event => failures.push(String(event.reason?.message ?? event.reason ?? 'Unhandled rejection'));
    globalThis.addEventListener('error', error);
    globalThis.addEventListener('unhandledrejection', rejection);
    const waitFor = (predicate, label, timeout = 12000) => new Promise((resolve, reject) => {
      const started = performance.now();
      const check = () => {
        if (failures.length) return reject(new Error(failures.join('; ')));
        if (predicate()) return resolve();
        if (performance.now() - started > timeout) return reject(new Error('Renderer smoke timed out: ' + label));
        setTimeout(check, 25);
      };
      check();
    });
    const routes = [
      ['media', 'section[aria-label="Music player"]'],
      ['audio', 'section[aria-label="Audio mixer"]'],
      ['fileshelf', 'section[aria-label="File shelf"]'],
      ['calendar', 'section[aria-label="Calendar"]'],
      ['weather', 'section[aria-label="Weather"]'],
      ['focus', 'section[aria-label="Focus and stay awake"]'],
      ['notes', 'section[aria-label="Quick notes"]'],
      ['clipboard', 'section[aria-label="Clipboard history"]'],
      ['snapzones', 'section[aria-label="Snap zones"]'],
      ['blip', 'section[aria-label="Blip assistant"]'],
      ['search', 'section[aria-label="Circle to search"]'],
      ['finance', 'section[aria-label="Finance and sports"]'],
      ['faceid', 'section[aria-label="Windows Hello"]'],
      ['system', 'section[aria-label="System utilities"]'],
      ['settings', '.notch-settings'],
    ];
    const results = [];
    try {
      if (!document.querySelector('[role="tablist"]')) document.querySelector('.notch-idle-open')?.click();
      await waitFor(() => document.getElementById('tab-media'), 'notch expansion');
      await waitFor(() => document.querySelector('section[aria-label="Music player"]'), 'desktop storage hydration', 30000);
      globalThis.dispatchEvent(new Event('blur'));
      globalThis.dispatchEvent(new Event('focus'));
      await new Promise(resolve=>setTimeout(resolve,700));
      if(!document.querySelector('[role="tablist"]'))throw new Error('Transient blur still collapses the notch after focus returns.');
      const preferences=await window.electronAPI.invoke('storage.get',{key:'sapphire_settings'});
      const current=(await window.electronAPI.invoke('desktop.bootstrap')).settings;
      await window.electronAPI.invoke('settings.save',{settings:{...current,autoCollapseSeconds:0}});
      await new Promise(resolve=>setTimeout(resolve,100));
      globalThis.dispatchEvent(new Event('blur'));
      await new Promise(resolve=>setTimeout(resolve,700));
      if(!document.querySelector('[role="tablist"]'))throw new Error('Disabled auto-collapse still collapses on blur.');
      globalThis.dispatchEvent(new Event('focus'));
      await window.electronAPI.invoke('settings.save',{settings:preferences??current});
      const rootBackground = getComputedStyle(document.getElementById('root')).backgroundColor;
      if (!['rgba(0, 0, 0, 0)', 'transparent'].includes(rootBackground)) throw new Error('Desktop renderer root is opaque.');
      for (const [id, selector] of routes) {
        const tab = document.getElementById('tab-' + id);
        if (!tab) throw new Error('Missing widget tab: ' + id);
        tab.click();
        await waitFor(() => tab.getAttribute('aria-selected') === 'true' && document.getElementById('notch-widget-panel')?.getAttribute('aria-labelledby') === 'tab-' + id && document.querySelector(selector), id);
        // Allow effect subscriptions to run: a denied event topic throws here.
        await new Promise(resolve => setTimeout(resolve, 150));
        if (failures.length) throw new Error(failures.join('; '));
        results.push({ id, selected: true, widgetMounted: true });
      }
      document.getElementById('tab-media').focus();
      document.getElementById('tab-media').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await waitFor(() => document.activeElement?.id === 'tab-audio', 'arrow-key navigation');
      const keyboard = { arrowNavigation: true, escapeCollapse: false };
      globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await waitFor(() => document.querySelector('.notch-idle-open') && !document.querySelector('[role="tablist"]'), 'Escape collapse');
      keyboard.escapeCollapse = true;
      await waitFor(() => document.activeElement?.classList.contains('notch-idle-open'), 'collapsed focus restoration');
      return { tabs: results, keyboard, transparentRoot: true, unhandledErrors: failures.length };
    } finally {
      globalThis.removeEventListener('error', error);
      globalThis.removeEventListener('unhandledrejection', rejection);
    }
  };
  return window.webContents.executeJavaScript('(' + probe.toString() + ')()', true);
}
