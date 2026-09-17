import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("focusTrace", {
  getProjects: () => ipcRenderer.invoke("projects:get"),

  getActiveProject: () =>
    ipcRenderer.invoke("project:get"),

  setActiveProject: (projectId: string | null) =>
    ipcRenderer.invoke("project:set", projectId),

  saveDesktopToken: (token: string) =>
    ipcRenderer.invoke("desktop-token:save", token),

  hasDesktopToken: () =>
    ipcRenderer.invoke("desktop-token:exists"),

  clearDesktopToken: () =>
  ipcRenderer.invoke("desktop-token:clear"),

  getTrackingStatus: () =>
  ipcRenderer.invoke("tracking:get-status"),
});

console.log("FocusTrace preload loaded");