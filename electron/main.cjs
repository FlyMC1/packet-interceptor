const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const APP_PORT = process.env.APP_PORT || "4173";
const APP_HOST = process.env.APP_HOST || "127.0.0.1";
const APP_URL = `http://${APP_HOST}:${APP_PORT}`;

let previewProcess;

function waitForServer(url, timeoutMs = 30000) {
    const started = Date.now();

    return new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    clearInterval(interval);
                    resolve();
                    return;
                }
            } catch {
                // Keep polling until timeout.
            }

            if (Date.now() - started > timeoutMs) {
                clearInterval(interval);
                reject(new Error(`Timed out waiting for server at ${url}`));
            }
        }, 500);
    });
}

function startPreviewServer() {
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

    previewProcess = spawn(npmCmd, ["run", "preview", "--", "--host", APP_HOST, "--port", APP_PORT], {
        cwd: path.resolve(__dirname, ".."),
        stdio: "inherit",
        shell: false,
        env: {
            ...process.env,
            APP_HOST,
            APP_PORT
        }
    });

    previewProcess.on("exit", (code) => {
        if (code !== 0) {
            console.error(`Preview process exited with code ${code}`);
        }
    });
}

async function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 700,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs")
        }
    });

    await win.loadURL(APP_URL);
}

app.whenReady().then(async () => {
    startPreviewServer();

    try {
        await waitForServer(APP_URL);
        await createWindow();
    } catch (error) {
        console.error(error);
        app.quit();
    }

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow().catch((err) => {
                console.error(err);
                app.quit();
            });
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("before-quit", () => {
    if (previewProcess && !previewProcess.killed) {
        previewProcess.kill("SIGTERM");
    }
});
