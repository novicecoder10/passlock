const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // DB Existence Check
  dbExists: () => ipcRenderer.invoke('db:exists'),
  
  // Auth Operations
  setup: (masterPassword) => ipcRenderer.invoke('db:setup', masterPassword),
  unlock: (masterPassword) => ipcRenderer.invoke('db:unlock', masterPassword),
  lock: () => ipcRenderer.invoke('db:lock'),
  isLocked: () => ipcRenderer.invoke('db:is-locked'),
  
  // CRUD Login Entries
  getLogins: () => ipcRenderer.invoke('db:get-logins'),
  saveLogin: (loginData) => ipcRenderer.invoke('db:save-login', loginData),
  deleteLogin: (id) => ipcRenderer.invoke('db:delete-login', id),
  
  // API Token Operations (for Chrome Extension)
  getApiToken: () => ipcRenderer.invoke('db:get-api-token'),
  resetApiToken: () => ipcRenderer.invoke('db:reset-api-token'),
  
  // OS Actions
  openSsh: (loginData) => ipcRenderer.invoke('ssh:launch', loginData),
  openUrl: (url) => ipcRenderer.invoke('url:open', url),
  copyToClipboard: (text) => ipcRenderer.invoke('clipboard:copy', text)
});
