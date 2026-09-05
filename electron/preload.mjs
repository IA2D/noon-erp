import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktopStore', {
  getItem: key => ipcRenderer.sendSync('desktop-store:get', key),
  setItem: (key, value) => ipcRenderer.sendSync('desktop-store:set', key, value),
  setItemVersioned: (key, value, expectedVersion) => ipcRenderer.sendSync('desktop-store:set-versioned', key, value, expectedVersion),
  removeItem: key => ipcRenderer.sendSync('desktop-store:remove', key),
  entries: () => ipcRenderer.sendSync('desktop-store:entries'),
  replaceEntries: (entries, clearPrefixes) => ipcRenderer.sendSync('desktop-store:replace-entries', entries, clearPrefixes),
  info: () => ipcRenderer.sendSync('desktop-store:info'),
  version: key => ipcRenderer.sendSync('desktop-store:version', key),
  accountingCommand: payload => ipcRenderer.sendSync('desktop-store:accounting-command', payload),
  createBackup: () => ipcRenderer.sendSync('desktop-store:create-backup'),
  login: (username, password) => ipcRenderer.sendSync('auth:login', username, password),
  session: token => ipcRenderer.sendSync('auth:session', token),
  logout: token => ipcRenderer.sendSync('auth:logout', token),
  changePassword: (token, currentPassword, nextPassword) => ipcRenderer.sendSync('auth:change-password', token, currentPassword, nextPassword),
  configureSecurity: options => ipcRenderer.sendSync('auth:configure-security', options),
});

contextBridge.exposeInMainWorld('desktopPrint', {
  preview: options => ipcRenderer.invoke('desktop-print:preview', options),
});

contextBridge.exposeInMainWorld('desktopFiles', {
  openAttachment: attachment => ipcRenderer.invoke('desktop-file:open-attachment', attachment),
});

contextBridge.exposeInMainWorld('desktopWindow', {
  getUiScale: () => ipcRenderer.sendSync('desktop-window:get-ui-scale'),
  setUiScalePercent: percent => ipcRenderer.sendSync('desktop-window:set-ui-scale', percent),
});
