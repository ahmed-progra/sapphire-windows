type DesktopBridge = {
  invoke<T = any>(method: string, params?: Record<string, unknown>): Promise<T>;
  onDesktopEvent(topic: string, callback: (data: any) => void): () => void;
  getPathForFile?(file: File): string;
  startFileDrag?(id: string): void;
  startDrag?(id: string): void;
};
export const desktopBridge = () => window.electronAPI as DesktopBridge | undefined;
export const desktopCall = <T = any>(method: string, params?: Record<string, unknown>): Promise<T> => {
  const bridge = desktopBridge();
  if (!bridge) return Promise.reject(new Error('Open the Sapphire desktop app to use this feature.'));
  return bridge.invoke<T>(method, params);
};
export const messageOf = (error: unknown): string => error instanceof Error ? error.message : 'The operation did not complete.';
