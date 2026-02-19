const { app, BrowserWindow, ipcMain, shell, clipboard } = require("electron");
const path = require("path");
const fetch = require("node-fetch");

// ISOLATION: Use a data folder inside the project to avoid permission issues
const userDataPath = path.join(app.getAppPath(), 'electron_data_latest');
app.setPath("userData", userDataPath);

function createWindow() {
    // Robust detection: If we are not packaged, it's dev.
    const isDev = !app.isPackaged || process.env.NODE_ENV === "development";

    const win = new BrowserWindow({
        width: 1200,
        height: 900,
        backgroundColor: "#212121",
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "preload.cjs"),
            sandbox: false
        }
    });

    // OPEN DEVTOOLS BY DEFAULT TO SEE RENDERER ERRORS
    // win.webContents.openDevTools(); // Commented out to prevent "Autofill" console errors

    if (isDev) {
        console.log("ELECTRON: Loading Dev URL http://localhost:5173");
        win.loadURL("http://localhost:5173").catch(err => {
            console.error("ELECTRON: Vite not found at 5173, falling back to dist/index.html");
            win.loadFile(path.join(__dirname, "../dist/index.html"));
        });
    } else {
        win.loadFile(path.join(__dirname, "../dist/index.html"));
    }

    win.once("ready-to-show", () => {
        win.show();
        win.focus();
    });

    // PERMISSIONS: Grant microphone access
    win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === 'media') {
            return callback(true);
        }
        callback(false);
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
    });

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error(`ELECTRON: Load Failed: ${validatedURL} (${errorCode}: ${errorDescription})`);
    });
}

ipcMain.handle("chat-request", async (event, { messages, streamId, images, sessionId, web_search, provider }) => {
    try {
        // BACKEND COMPATIBILITY: Extract the latest user message from the array
        const latestMsg = messages[messages.length - 1]?.content || "";

        const response = await fetch("http://127.0.0.1:8002/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: latestMsg,
                session_id: sessionId || "default_session",
                images: images || [],
                web_search: web_search || false,
                provider: provider || "duckduckgo"
            })
        });

        if (!response.body) throw new Error("No response body from backend");

        response.body.on("data", (chunk) => {
            const raw = chunk.toString();
            const lines = raw.split("\n");
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                if (trimmed.startsWith("data: ")) {
                    const payload = trimmed.slice(6);

                    if (payload === "[DONE]") {
                        event.sender.send(`end-${streamId}`, "DONE");
                        continue;
                    }

                    try {
                        const data = JSON.parse(payload);
                        if (data.token) {
                            event.sender.send(`token-${streamId}`, String(data.token));
                        }
                    } catch (e) {
                        // Partial JSON or non-JSON data
                    }
                }
            }
        });

        response.body.on("end", () => {
            // Backup termination
            event.sender.send(`end-${streamId}`, "DONE");
        });

        return { success: true };
    } catch (error) {
        console.error("IPC Error:", error);
        event.sender.send(`error-${streamId}`, error.message);
        return { success: false, error: error.message };
    }
});

ipcMain.handle("research-request", async (event, { query, depth, breadth, provider }) => {
    try {
        const response = await fetch("http://127.0.0.1:8002/research/deep", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                query,
                depth: depth || 2,
                breadth: breadth || 3,
                provider: provider || "duckduckgo"
            })
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Deep Research IPC Error:", error);
        return { status: "error", message: error.message };
    }
});

ipcMain.handle("copy-to-clipboard", async (event, text) => {
    try {
        clipboard.writeText(text);
        return { success: true };
    } catch (error) {
        console.error("Clipboard Error:", error);
        return { success: false, error: error.message };
    }
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
