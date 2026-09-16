import {
  app,
  BrowserWindow,
  ipcMain,
} from "electron";

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { startActivityTracker } from "./activity-tracker.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = "http://localhost:3000";

let mainWindow: BrowserWindow | null = null;

const configPath = path.join(
  app.getPath("userData"),
  "focustrace-config.json",
);

function readConfig() {
  try {
    if (!fs.existsSync(configPath)) {
      return {};
    }

    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (error) {
    console.error("Could not read config:", error);
    return {};
  }
}

function saveConfig(config: Record<string, unknown>) {
  try {
    fs.writeFileSync(
      configPath,
      JSON.stringify(config, null, 2),
      "utf-8",
    );
  } catch (error) {
    console.error("Could not save config:", error);
  }
}

function getActiveProjectId(): string | null {
  const config = readConfig();

  return typeof config.projectId === "string"
    ? config.projectId
    : null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,

    webPreferences: {
      preload: path.join(
        __dirname,
        "preload.js",
      ),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(
    path.join(
      __dirname,
      "../src/renderer.html",
    ),
  );

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/*
 * Get projects from Next.js
 */
ipcMain.handle("projects:get", async () => {
  try {
    const response = await fetch(
      `${API_URL}/api/projects`,
    );

    if (!response.ok) {
      throw new Error(
        `Projects API returned ${response.status}`,
      );
    }

    const data = await response.json();

    return {
      success: true,
      projects: data.projects ?? [],
    };
  } catch (error) {
    console.error("Could not load projects:", error);

    return {
      success: false,
      projects: [],
      error: "Could not load projects",
    };
  }
});

/*
 * Save selected project
 */
ipcMain.handle(
  "project:set",
  async (_event, projectId: string | null) => {
    const config = readConfig();

    config.projectId = projectId;

    saveConfig(config);

    return {
      success: true,
      projectId,
    };
  },
);

/*
 * Get selected project
 */
ipcMain.handle("project:get", async () => {
  return {
    success: true,
    projectId: getActiveProjectId(),
  };
});

function start() {
  createWindow();

  startActivityTracker(() => {
    return getActiveProjectId();
  });
}

app.whenReady().then(() => {
  start();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      start();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});