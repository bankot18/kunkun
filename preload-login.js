const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loginWithD1: (username, password, rememberMe) => ipcRenderer.invoke('d1-login', { username, password, rememberMe }),
  testD1Connection: (apiToken) => ipcRenderer.invoke('d1-test-connection', { apiToken }),
  getD1Config: () => ipcRenderer.invoke('d1-get-config'),
  saveD1Config: (config) => ipcRenderer.invoke('d1-save-config', config),
  closeLogin: () => ipcRenderer.send('close-login')
});
