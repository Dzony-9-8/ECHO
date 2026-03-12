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
        const payload = {
            model: "llama3.1:8b",
            // Pass full message history
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            temperature: 0.7,
            stream: false, // Force non-streaming for now due to V2 orchestrator limitations
            web_enabled: web_search || false,
            rag_enabled: false,
            research_depth: 0,
            mode: "chat",
            images: images || []
        };

        const response = await fetch("http://127.0.0.1:8000/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || errData.error || "API Error");
        }

        const data = await response.json();
        const assistantMessage = data.choices[0].message.content;

        // Immediately send the full block as a token, followed by DONE
        event.sender.send(`token-${streamId}`, assistantMessage);
        event.sender.send(`end-${streamId}`, "DONE");

        return { success: true };
    } catch (error) {
        console.error("IPC Error:", error);
        event.sender.send(`error-${streamId}`, error.message);
        return { success: false, error: error.message };
    }
});

ipcMain.handle("research-request", async (event, { query, depth, breadth, provider }) => {
    try {
        const response = await fetch("http://127.0.0.1:8000/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama3.1:8b",
                messages: [{ role: "user", content: query }],
                temperature: 0.7,
                stream: false,
                web_enabled: true,
                rag_enabled: false,
                research_depth: depth || 2,
                mode: "research",
                images: []
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || errData.error || "API Error from Research Engine");
        }

        const data = await response.json();

        // Emulate the older Deep Research format expected by Chat.jsx
        // Chat.jsx expects: { status: "success", data: { report: "...", log: [] } }
        return {
            status: "success",
            data: {
                report: data.choices[0].message.content,
                log: [{ step: "Autonomous loop complete", message: "Parsed from V2 Engine" }]
            }
        };
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
