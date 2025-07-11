// frontend/src/global.d.ts
export {};

declare global {
  interface Window {
    electron: {
      invoke: (channel: string, data?: any) => Promise<any>;
      sendToMain: (channel: string, data?: any) => void;
      receive: (channel: string, func: (...args: any[]) => void) => void;
    };
  }
}
