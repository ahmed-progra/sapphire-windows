import {contextBridge,ipcRenderer,webUtils} from 'electron';
const topics=new Set(['media','audio','files','battery','clipboard','settings','caffeinate','open-settings','notification','collapse','dialog-state','storage','open-widget','focus','desktop-error','system-resume','ai-live-audio','ai-live-text','ai-live-state']);
const invoke=(method:string,params:Record<string,unknown>={})=>ipcRenderer.invoke('desktop:invoke',method,params);
const onDesktopEvent=(topic:string,callback:(data:any)=>void)=>{
  if(!topics.has(topic))throw new Error('Unknown desktop event.');
  const listener=(_event:Electron.IpcRendererEvent,event:{topic:string;data:any})=>{if(event.topic===topic)callback(event.data);};
  ipcRenderer.on('desktop:event',listener);return()=>ipcRenderer.removeListener('desktop:event',listener);
};
contextBridge.exposeInMainWorld('electronAPI',{
  invoke,onDesktopEvent,getPathForFile:(file:File)=>webUtils.getPathForFile(file),startDrag:(id:string)=>ipcRenderer.send('desktop:drag',id),startFileDrag:(id:string)=>ipcRenderer.send('desktop:drag',id),
  resizeIsland:(width:number,height:number)=>invoke('shell.resize',{width,height}),
  toggleCaffeinate:(enabled:boolean)=>invoke('power.awake',{enabled}),snapWindow:(layout:string)=>invoke('snap.apply',{layout}),
  minimizeApp:()=>invoke('shell.minimize'),hideIsland:()=>invoke('shell.hide'),
  onOpenSettings:(callback:()=>void)=>onDesktopEvent('open-settings',callback),
  onCaffeinateStatus:(callback:(active:boolean)=>void)=>onDesktopEvent('caffeinate',callback)
});
