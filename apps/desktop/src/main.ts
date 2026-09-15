import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { startActivityTracker } from "./activity-tracker.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function craeteWindow(){
    const window = new BrowserWindow({
        width: 1000, 
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, "preload.js")
        }
    });

    window.loadURL("https://example.com");
}

app.whenReady().then(() => {
    craeteWindow();

    startActivityTracker();

    app.on("activate", () => {
        if(BrowserWindow.getAllWindows().length === 0){
            craeteWindow();
        }
    });
});

app.on("window-all-closed", () => {
    if(process.platform !== "darwin"){
        app.quit();
    }
});