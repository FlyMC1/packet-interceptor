const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const net = require("net");
const { fork } = require("child_process");

const DEFAULT_APP_PORTS = [4173, 4174, 4175];
const APP_PORTS = parsePortCandidates(process.env.APP_PORTS, process.env.APP_PORT);
const APP_HOST = process.env.APP_HOST || "127.0.0.1";

let serverProcess;
let activeAppUrl;

function parsePortCandidates(portList, singlePort) {
    const fromList = (portList || "")
        .split(",")
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isInteger(value) && value > 0 && value <= 65535);

    if (fromList.length > 0) return fromList;

    const parsedSingle = Number.parseInt(singlePort || "", 10);
    if (Number.isInteger(parsedSingle) && parsedSingle > 0 && parsedSingle <= 65535) {
        return [parsedSingle];
    }

    return DEFAULT_APP_PORTS;
}

function canListen(host, port) {
    return new Promise((resolve) => {
        const testServer = net.createServer();

        testServer.once("error", () => {
            resolve(false);
        });

        testServer.listen(port, host, () => {
            testServer.close(() => resolve(true));
        });
    });
}

async function pickAvailablePort(host, candidates) {
    for (const port of candidates) {
        // Prefer first available candidate to keep URL predictable for users.
        if (await canListen(host, port)) return String(port);
    }

    throw new Error(`No available internal server ports in: ${candidates.join(", ")}`);
}

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

function startServer(port) {
    const serverEntry = getServerEntry();

    serverProcess = fork(serverEntry, {
        cwd: path.dirname(serverEntry),
        stdio: "inherit",
        env: {
            ...process.env,
            HOST: APP_HOST,
            PORT: port,
            APP_DATA_DIR: app.getPath("userData")
        }
    });

    serverProcess.on("exit", (code) => {
        if (code !== 0) {
            console.error(`Server process exited with code ${code}`);
        }
    });
}

async function createWindow(url) {
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

    await win.loadURL(url);
}

app.whenReady().then(async () => {
    try {
        const port = await pickAvailablePort(APP_HOST, APP_PORTS);
        const appUrl = `http://${APP_HOST}:${port}`;
        activeAppUrl = appUrl;

        startServer(port);
        await waitForServer(appUrl);
        await createWindow(appUrl);
    } catch (error) {
        console.error(error);
        dialog.showErrorBox(
            "Bedrock Value Monitor",
            "The internal server failed to start. Try closing other instances or set APP_PORT/APP_PORTS to a free port."
        );
        app.quit();
    }

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow(activeAppUrl || `http://${APP_HOST}:${APP_PORTS[0]}`).catch((err) => {
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
