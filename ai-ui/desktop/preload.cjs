const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // SYNCED WITH main.cjs: Use chat-request and structured payload
    sendMessage: (payload) => ipcRenderer.invoke('chat-request', payload),
    runDeepResearch: (payload) => ipcRenderer.invoke('research-request', payload),
    copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),

    // PRIVATE LINE PROTOCOL: Listens for tokens on a per-request channel
    listenToStream: (streamId, callback) => {
        const tokenChannel = `token-${streamId}`;
        const endChannel = `end-${streamId}`;
        const errorChannel = `error-${streamId}`;

        const tokenListener = (_event, token) => callback({ type: 'token', data: token });
        const endListener = (_event, full) => callback({ type: 'end', data: full });
        const errorListener = (_event, err) => callback({ type: 'error', data: err });

        ipcRenderer.on(tokenChannel, tokenListener);
        ipcRenderer.on(endChannel, endListener);
        ipcRenderer.on(errorChannel, errorListener);

        // Cleanup function: remove all listeners for this stream
        return () => {
            ipcRenderer.removeListener(tokenChannel, tokenListener);
            ipcRenderer.removeListener(endChannel, endListener);
            ipcRenderer.removeListener(errorChannel, errorListener);
        };
    }
});
