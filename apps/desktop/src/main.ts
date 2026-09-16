import {
  app,
  BrowserWindow,
  ipcMain,
  safeStorage,
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

function saveDesktopToken(token: string) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "Secure storage is not available on this machine",
    );
  }

  const encryptedToken = safeStorage.encryptString(token);

  const config = readConfig();

  config.desktopToken = encryptedToken.toString("base64");

  saveConfig(config);
}

function getDesktopToken(): string | null {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      console.error("Secure storage is not available");
      return null;
    }

    const config = readConfig();

    if (typeof config.desktopToken !== "string") {
      return null;
    }

    const encryptedToken = Buffer.from(
      config.desktopToken,
      "base64",
    );

    return safeStorage.decryptString(encryptedToken);
  } catch (error) {
    console.error("Could not decrypt desktop token:", error);
    return null;
  }
}

async function desktopFetch(
  url: string,
  options: RequestInit = {},
) {
  const token = getDesktopToken();

  if (!token) {
    throw new Error("Desktop device is not paired");
  }

  const headers = new Headers(options.headers);

  headers.set("Authorization", `Bearer ${token}`);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, {
    ...options,
    headers,
  });
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
    const response = await desktopFetch(
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

ipcMain.handle("desktop-token:save", async (_event, token: string) => {
  try {
    if (!token || typeof token !== "string") {
      return {
        success: false,
        error: "Invalid desktop token",
      };
    }

    saveDesktopToken(token);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Could not save desktop token:", error);

    return {
      success: false,
      error: "Could not securely save desktop token",
    };
  }
});

ipcMain.handle("desktop-token:exists", async () => {
  return {
    success: getDesktopToken() !== null,
  };
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