import { app, BrowserWindow } from "electron";
import path from "node:path";

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