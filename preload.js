// Preload script for security
// This runs in a separate context and can expose safe APIs to the renderer

const { contextBridge } = require('electron');

// Expose protected methods that allow the renderer process to use
// specific features without exposing the entire Electron API
contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    isElectron: true
});

// Log that preload is working
console.log('PDF Editor AI - Electron preload initialized');
