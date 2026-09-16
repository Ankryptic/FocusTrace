import {
  contextBridge,
  ipcRenderer,
} from "electron";

contextBridge.exposeInMainWorld(
  "focusTrace",
  {
    getProjects: () =>
      ipcRenderer.invoke("projects:get"),

    getActiveProject: () =>
      ipcRenderer.invoke("project:get"),

    setActiveProject: (
      projectId: string | null,
    ) =>
      ipcRenderer.invoke(
        "project:set",
        projectId,
      ),
  },
);

console.log("FocusTrace preload loaded");