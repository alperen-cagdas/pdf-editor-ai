// Electron Main Process with Auto-Updater
'use strict';

const electron = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

// Module to control application life.
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const Menu = electron.Menu;
const shell = electron.shell;
const dialog = electron.dialog;

// Keep a global reference of the window object
let mainWindow = null;

// Auto-updater configuration
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
    console.log('Güncelleme kontrol ediliyor...');
});

autoUpdater.on('update-available', (info) => {
    console.log('Güncelleme mevcut:', info.version);
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Güncelleme Mevcut',
        message: `Yeni versiyon mevcut: v${info.version}`,
        detail: 'Şimdi indirmek ister misiniz?',
        buttons: ['İndir', 'Daha Sonra']
    }).then((result) => {
        if (result.response === 0) {
            autoUpdater.downloadUpdate();
        }
    });
});

autoUpdater.on('update-not-available', () => {
    console.log('Uygulama güncel.');
});

autoUpdater.on('download-progress', (progressObj) => {
    let message = `İndirme hızı: ${Math.round(progressObj.bytesPerSecond / 1024)} KB/s`;
    message += ` - İndirilen: ${progressObj.percent.toFixed(1)}%`;
    console.log(message);

    // Send progress to renderer
    if (mainWindow) {
        mainWindow.setProgressBar(progressObj.percent / 100);
    }
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('Güncelleme indirildi:', info.version);
    if (mainWindow) {
        mainWindow.setProgressBar(-1); // Remove progress bar
    }

    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Güncelleme Hazır',
        message: 'Güncelleme indirildi',
        detail: 'Uygulamayı yeniden başlatarak güncellemeyi yüklemek ister misiniz?',
        buttons: ['Şimdi Yeniden Başlat', 'Daha Sonra']
    }).then((result) => {
        if (result.response === 0) {
            autoUpdater.quitAndInstall();
        }
    });
});

autoUpdater.on('error', (err) => {
    console.error('Güncelleme hatası:', err);
});

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        show: false,
        backgroundColor: '#0a0a0a'
    });

    // Load the index.html of the app
    mainWindow.loadFile('index.html');

    // Show window when ready
    mainWindow.once('ready-to-show', function () {
        mainWindow.show();

        // Check for updates after window is shown (only in production)
        if (!process.argv.includes('--dev')) {
            setTimeout(() => {
                autoUpdater.checkForUpdates().catch(err => {
                    console.log('Güncelleme kontrolü başarısız:', err.message);
                });
            }, 3000);
        }
    });

    // Open external links in default browser
    mainWindow.webContents.setWindowOpenHandler(function (details) {
        shell.openExternal(details.url);
        return { action: 'deny' };
    });

    // Handle navigation
    mainWindow.webContents.on('will-navigate', function (event, url) {
        if (!url.startsWith('file://')) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });

    // Window closed
    mainWindow.on('closed', function () {
        mainWindow = null;
    });

    // Application menu
    var menuTemplate = [
        {
            label: 'Dosya',
            submenu: [
                {
                    label: 'PDF Aç',
                    accelerator: 'CmdOrCtrl+O',
                    click: function () {
                        mainWindow.webContents.executeJavaScript('document.getElementById("fileInput").click()');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Çıkış',
                    accelerator: 'Alt+F4',
                    click: function () {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Düzen',
            submenu: [
                { label: 'Geri Al', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
                { label: 'Yinele', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
                { type: 'separator' },
                { label: 'Kes', accelerator: 'CmdOrCtrl+X', role: 'cut' },
                { label: 'Kopyala', accelerator: 'CmdOrCtrl+C', role: 'copy' },
                { label: 'Yapıştır', accelerator: 'CmdOrCtrl+V', role: 'paste' }
            ]
        },
        {
            label: 'Görünüm',
            submenu: [
                {
                    label: 'Yakınlaştır',
                    accelerator: 'CmdOrCtrl+Plus',
                    click: function () {
                        mainWindow.webContents.executeJavaScript('document.getElementById("zoomIn").click()');
                    }
                },
                {
                    label: 'Uzaklaştır',
                    accelerator: 'CmdOrCtrl+-',
                    click: function () {
                        mainWindow.webContents.executeJavaScript('document.getElementById("zoomOut").click()');
                    }
                },
                { type: 'separator' },
                { label: 'Tam Ekran', accelerator: 'F11', role: 'togglefullscreen' },
                { type: 'separator' },
                { label: 'Geliştirici Araçları', accelerator: 'F12', role: 'toggleDevTools' }
            ]
        },
        {
            label: 'Yardım',
            submenu: [
                {
                    label: 'Güncelleme Kontrol Et',
                    click: function () {
                        autoUpdater.checkForUpdates().then(() => {
                            // Will trigger update-available or update-not-available event
                        }).catch(err => {
                            dialog.showMessageBox(mainWindow, {
                                type: 'error',
                                title: 'Güncelleme Hatası',
                                message: 'Güncelleme kontrol edilemedi',
                                detail: err.message
                            });
                        });
                    }
                },
                { type: 'separator' },
                {
                    label: 'Hakkında',
                    click: function () {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'PDF Editor AI Hakkında',
                            message: 'PDF Editor AI',
                            detail: `Versiyon: ${app.getVersion()}\n\nAI destekli PDF metin düzenleme uygulaması.\n\nGemini API ile akıllı font eşleştirme özelliği.`
                        });
                    }
                }
            ]
        }
    ];

    var menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}

// App ready event
app.on('ready', createWindow);

// Quit when all windows are closed
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});
