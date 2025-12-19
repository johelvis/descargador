const { app, BrowserWindow } = require('electron');
const path = require('path');

// Start the Express server
require('./server.js');

function createWindow() {
    const win = new BrowserWindow({
        width: 1000,
        height: 800,
        title: 'Video Downloader Premium',
        icon: path.join(__dirname, 'public/favicon.ico'), // Optional if you had one
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        autoHideMenuBar: true,
        backgroundColor: '#0f172a'
    });

    // Wait for server to start? It's usually instant enough or we can retry.
    // server.js runs on port 3000
    setTimeout(() => {
        win.loadURL('http://localhost:3000');
    }, 1000);

    // win.webContents.openDevTools(); // For debugging
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
