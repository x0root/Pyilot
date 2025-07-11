const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  sendToMain: (channel, data) => ipcRenderer.send(channel, data),
  receive: (channel, callback) =>
    ipcRenderer.on(channel, (event, ...args) => callback(...args)),
});
