import path from 'node:path';
import { appearanceDefaults, normalizeAppearance } from './appearance.mjs';

export const storageKeys = new Set(['sapphire_settings', 'sapphire_stashed_files', 'sapphire_quick_notes', 'sapphire_clipboard_history', 'sapphire_calendar', 'sapphire_focus', 'sapphire_weather', 'sapphire_shortcuts']);
export const defaultSettings = Object.freeze({...appearanceDefaults,appearanceIntroSeen:false,notchStyle:'mac-notch',idleWidth:150,idleHeight:24,expandedWidth:680,expandedHeight:480,acrylicBlur:'medium',autoCollapseSeconds:2,alwaysOnTop:true,startOnBoot:false,hotkey:'Ctrl+Shift+S',clipboardEnabled:false});
export function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.');
  return value;
}
export function number(value, min, max, name='Value') {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${name} must be between ${min} and ${max}.`);
  return value;
}
export function text(value, max=10000) {
  if (typeof value !== 'string' || value.length > max) throw new Error('Invalid text or text is too long.');
  return value;
}
export function documentPath(value) {
  text(value,32768);
  if(!path.isAbsolute(value)||/\.(exe|com|bat|cmd|ps1|psc1|vbs|vbe|js|jse|wsf|wsh|wsc|sct|hta|lnk|url|scf|pif|cpl|scr|dll|reg|inf|msi|msp|mst|msix|appx|msixbundle|appxbundle|application|appref-ms|py|pyw|jar)$/i.test(value))throw new Error('Use Show in Explorer to open programs, scripts or installers.');
  return value;
}
export function settings(value) {
  const s = {...defaultSettings,...object(value),...normalizeAppearance(value)};
  if (!['mac-notch','floating-island','minimal-pill'].includes(s.notchStyle)) throw new Error('Unknown notch style.');
  for (const [key,min,max] of [['idleWidth',100,800],['idleHeight',20,120],['expandedWidth',420,1200],['expandedHeight',300,1000],['autoCollapseSeconds',0,300]]) number(s[key],min,max,key);
  for (const key of ['alwaysOnTop','startOnBoot','clipboardEnabled','appearanceIntroSeen']) if (typeof s[key] !== 'boolean') throw new Error(`Invalid ${key}.`);
  if (!/^#[0-9a-f]{6}$/i.test(s.accentColor)) throw new Error('Invalid accent color.');
  if (!['light','medium','ultra'].includes(s.acrylicBlur)) throw new Error('Invalid appearance.');
  if (!/^(?:(?:Ctrl|Control|Alt|Shift|Super|Win|CommandOrControl)\+){1,4}[A-Za-z0-9]$/.test(s.hotkey)) throw new Error('Use a shortcut such as Ctrl+Shift+S.');
  if (s.displayId !== undefined && !Number.isInteger(s.displayId)) throw new Error('Invalid display.');
  return Object.fromEntries(Object.entries(s).filter(([key])=>key in defaultSettings || key === 'displayId'));
}
export function validateStorage(key, value) {
  if (!storageKeys.has(key)) throw new Error('Unknown storage key.');
  if (Buffer.byteLength(JSON.stringify(value) ?? '') > 6*1024*1024) throw new Error('Saved data exceeds 6 MB.');
  if (key === 'sapphire_settings') return settings(value);
  if (key === 'sapphire_quick_notes') return text(value,2*1024*1024);
  if (key === 'sapphire_focus') return object(value);
  if (key === 'sapphire_weather') return object(value);
  if (key === 'sapphire_shortcuts') return shortcuts(value);
  const rows = key === 'sapphire_calendar' ? (Array.isArray(value) ? value : object(value).events) : value;
  if (!Array.isArray(rows) || rows.length > 2000) throw new Error('Invalid saved list.');
  for (const row of rows) {
    object(row);
    if (key === 'sapphire_clipboard_history') { text(row.id,200); text(row.content,200000); if (!['text','code','url'].includes(row.type)) throw new Error('Invalid clipboard item.'); }
    if (key === 'sapphire_stashed_files') { text(row.id,200); text(row.name,1000); if(row.path !== undefined && (typeof row.path !== 'string' || !path.isAbsolute(row.path))) throw new Error('File paths must be absolute.'); }
    if (key === 'sapphire_calendar') { if(typeof row.title !== 'string' && typeof row.summary !== 'string') throw new Error('Invalid calendar event.'); }
  }
  return value;
}
export function importData(input) {
  const raw=object(input);
  if(raw.version !== undefined && raw.version !== 1) throw new Error('Unsupported backup version.');
  if(raw.format !== undefined && raw.format !== 'sapphire-desktop') throw new Error('This is not a Sapphire backup.');
  const data=object(raw.data ?? raw);
  const result={};
  for (const [key, original] of Object.entries(data)) {
    if(!storageKeys.has(key)) continue;
    let value=original;
    if(typeof value === 'string' && key !== 'sapphire_quick_notes') { try {value=JSON.parse(value);} catch {throw new Error(`Invalid ${key} JSON.`);} }
    result[key]=validateStorage(key,value);
  }
  if(!Object.keys(result).length) throw new Error('The backup contains no Sapphire data.');
  return result;
}
export function shortcuts(value) {
  if(!Array.isArray(value)||value.length>10)throw new Error('Choose up to ten shortcuts.');
  const used=new Set();return value.map(row=>{
    object(row);text(row.id,100);text(row.accelerator,100);settings({hotkey:row.accelerator});
    const normalized=row.accelerator.toLowerCase();if(used.has(normalized))throw new Error('Each shortcut must be unique.');used.add(normalized);
    const action=object(row.action);if(!['open_files','open_notes','show_weather','open_calendar','set_caffeinate'].includes(action.name))throw new Error('Unsupported shortcut action.');
    if(action.name==='set_caffeinate'&&typeof action.args?.enabled!=='boolean')throw new Error('Choose whether this shortcut enables or disables stay awake.');
    return{id:row.id,accelerator:row.accelerator,action:{name:action.name,args:action.name==='set_caffeinate'?{enabled:action.args.enabled}:{}}};
  });
}
export function boundsFor(display,width,height,style='mac-notch') {
  const work=display.workArea;
  const gap=style==='floating-island'?Math.min(8,Math.max(0,work.height-20)):0;
  const w=Math.round(Math.min(number(width,100,1200,'Width'),work.width));
  const h=Math.floor(Math.min(number(height,20,1000,'Height'),work.height-gap));
  return {x:Math.round(work.x+(work.width-w)/2),y:work.y+gap,width:w,height:h};
}
export function outline(width,height,radius,topRadius=0) {
  const rects=[];
  const r=Math.min(radius,width/2,height/2),t=Math.min(topRadius,width/2,height/2);
  for(let y=0;y<height;y++) {
    let inset=0;
    if(y<t) inset=t-Math.sqrt(Math.max(0,t*t-(t-y-.5)**2));
    if(y>=height-r) inset=Math.max(inset,r-Math.sqrt(Math.max(0,r*r-(y-(height-r)+.5)**2)));
    const x=Math.ceil(inset);rects.push({x,y,width:Math.max(1,width-2*x),height:1});
  }
  return rects;
}
export const nativeMethods = new Set(['native.capabilities','media.get','media.control','audio.get','audio.volume','audio.deviceVolume','snap.apply','brightness.get','brightness.set','battery.get','bluetooth.list','hello.availability','hello.verify','notifications.access','notifications.list']);
export function validateNative(method,params={}) {
  object(params);
  if(Buffer.byteLength(JSON.stringify(params))>60*1024)throw new Error('Native request exceeds 60 KB.');
  if(!nativeMethods.has(method)) throw new Error('Unknown native command.');
  if(method==='media.control') {if(!['toggle','play','pause','next','previous','seek'].includes(params.action)) throw new Error('Unsupported media action.');if(params.action==='seek') number(params.position,0,604800,'Position');}
  if(method==='audio.volume'||method==='audio.deviceVolume') {text(params.id,1000);if(params.volume!==undefined)number(params.volume,0,1,'Volume');if(params.muted!==undefined && typeof params.muted!=='boolean') throw new Error('Invalid mute state.');}
  if(method==='brightness.set') number(params.value,0,100,'Brightness');
  if(method==='snap.apply'&&!['left','right','maximize','center','top-left','top-right','bottom-left','bottom-right'].includes(params.layout))throw new Error('Unsupported layout.');
  return params;
}
