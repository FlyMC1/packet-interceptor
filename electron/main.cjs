const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const { fork } = require("child_process");

const APP_PORT = process.env.APP_PORT || "4173";
const APP_HOST = process.env.APP_HOST || "127.0.0.1";
const APP_URL = `http://${APP_HOST}:${APP_PORT}`;

let serverProcess;

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

function getServerEntry() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, "app.asar.unpacked", "build", "index.js");
    }

    return path.resolve(__dirname, "..", "build", "index.js");
}

function startServer() {
    const serverEntry = getServerEntry();

    serverProcess = fork(serverEntry, {
        cwd: path.dirname(serverEntry),
        stdio: "inherit",
        env: {
            ...process.env,
            HOST: APP_HOST,
            PORT: APP_PORT,
            APP_DATA_DIR: app.getPath("userData")
        }
    });

    serverProcess.on("exit", (code) => {
        if (code !== 0) {
            console.error(`Server process exited with code ${code}`);
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
    startServer();

    try {
        await waitForServer(APP_URL);
        await createWindow();
    } catch (error) {
        console.error(error);
        dialog.showErrorBox(
            "Bedrock Packet Interceptor",
            "The internal server failed to start. Reinstall the app or check the bundled files."
        );
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
    if (serverProcess && !serverProcess.killed) {
        serverProcess.kill("SIGTERM");
    }
});
