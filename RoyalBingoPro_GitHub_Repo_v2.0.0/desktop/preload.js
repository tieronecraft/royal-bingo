/**
 * Preload Bridge (`desktop/preload.js`)
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("RoyalDesktopBridge", {
  getHardwareId: () => ipcRenderer.invoke("rbp:get-hardware-id"),
  loadState: () => ipcRenderer.invoke("rbp:load-state"),
  saveState: (stateObj) => ipcRenderer.invoke("rbp:save-state", stateObj),
  toggleFullscreen: () => ipcRenderer.invoke("rbp:toggle-fullscreen")
});
