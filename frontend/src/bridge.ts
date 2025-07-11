export interface ElectronAPI {
  invoke: (channel: string, data?: any) => Promise<any>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

// ✅ Export typed access
export const electron = window.electron;
