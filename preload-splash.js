const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('splashAPI', {
  onStatusUpdate: (callback) => {
    if (typeof callback === 'function') {
      ipcRenderer.on('updater-status', (_event, data) => callback(data));
    }
  }
});
