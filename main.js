const { app, BrowserWindow, ipcMain, shell, clipboard } = require('electron');
const path = require('path');
const dbManager = require('./db-manager');
const sshLauncher = require('./ssh-launcher');
const apiServer = require('./server');

let mainWindow = null;
let clipboardTimeout = null;
let lastCopiedValue = '';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    title: 'PassLock',
    frame: true, // Keep standard frame but style inside
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    // Set icon if available (can add a placeholder or skip)
    icon: path.join(__dirname, 'icon.png')
  });

  mainWindow.loadFile('index.html');
  
  // Remove menu bar for application look
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers

// DB existence check
ipcMain.handle('db:exists', async () => {
  return dbManager.exists();
});

// Setup master password
ipcMain.handle('db:setup', async (event, masterPassword) => {
  try {
    const success = dbManager.setup(masterPassword);
    return { success };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Unlock vault
ipcMain.handle('db:unlock', async (event, masterPassword) => {
  try {
    const success = dbManager.unlock(masterPassword);
    return { success };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Lock vault
ipcMain.handle('db:lock', async () => {
  dbManager.lock();
  return { success: true };
});

// Check if locked
ipcMain.handle('db:is-locked', async () => {
  return !dbManager.isUnlocked;
});

// Get logins
ipcMain.handle('db:get-logins', async () => {
  try {
    return { success: true, logins: dbManager.getLogins() };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Save login
ipcMain.handle('db:save-login', async (event, loginData) => {
  try {
    const saved = dbManager.saveLogin(loginData);
    return { success: true, login: saved };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Delete login
ipcMain.handle('db:delete-login', async (event, id) => {
  try {
    const success = dbManager.deleteLogin(id);
    return { success };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Get API token
ipcMain.handle('db:get-api-token', async () => {
  try {
    return { success: true, token: dbManager.getApiToken() };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Reset API token
ipcMain.handle('db:reset-api-token', async () => {
  try {
    const token = dbManager.resetApiToken();
    return { success: true, token };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// SSH launch
ipcMain.handle('ssh:launch', async (event, loginData) => {
  try {
    const success = sshLauncher.launch(loginData);
    return { success };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Open external URL
ipcMain.handle('url:open', async (event, url) => {
  try {
    let cleanUrl = url.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
    }
    await shell.openExternal(cleanUrl);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Copy to clipboard with auto-clear
ipcMain.handle('clipboard:copy', async (event, text) => {
  try {
    clipboard.writeText(text);
    lastCopiedValue = text;

    // Clear previous timeout if it exists
    if (clipboardTimeout) {
      clearTimeout(clipboardTimeout);
    }

    // Auto-clear clipboard after 30 seconds for security
    clipboardTimeout = setTimeout(() => {
      // Only clear if the user hasn't copied something else in the meantime
      if (clipboard.readText() === lastCopiedValue) {
        clipboard.clear();
        console.log('Clipboard: Auto-cleared password for security.');
      }
    }, 30000); // 30 seconds

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Lifecycle Handlers

app.whenReady().then(() => {
  createWindow();
  
  // Start local HTTP server
  apiServer.start();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  // Stop local HTTP server on exit
  apiServer.stop();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
