export interface DesktopAPI {
  invoke<T = any>(method: string, params?: Record<string, unknown>): Promise<T>;
  onDesktopEvent(topic: string, callback: (data: any) => void): () => void;
  getPathForFile(file: File): string;
  startDrag(id: string): void;
  startFileDrag(id: string): void;
  resizeIsland(width: number, height: number): Promise<void>;
  toggleCaffeinate(enable: boolean): Promise<boolean>;
  snapWindow(layout: string): Promise<{success: boolean; layout: string}>;
  minimizeApp(): Promise<void>;
  hideIsland(): Promise<void>;
  onOpenSettings(callback: () => void): () => void;
  onCaffeinateStatus(callback: (active: boolean) => void): () => void;
}
declare global { interface Window { electronAPI?: DesktopAPI } }
export const desktop = <T = any>(method: string, params?: Record<string, unknown>): Promise<T> => window.electronAPI
  ? window.electronAPI.invoke<T>(method, params)
  : Promise.reject(new Error('Open the Sapphire desktop application to use this feature.'));
export const resizeWindow = async (width:number,height:number) => { if(window.electronAPI) await window.electronAPI.resizeIsland(width,height); };
export const setCaffeinate = (enable:boolean):Promise<boolean> => desktop('power.awake',{enabled:enable});
export const snapWindowAction = (layout:string):Promise<{success:boolean;layout:string}> => desktop('snap.apply',{layout});
export const minimizeWindow = async () => { if(window.electronAPI) await window.electronAPI.minimizeApp(); };
export const hideWindow = async () => { if(window.electronAPI) await window.electronAPI.hideIsland(); };
