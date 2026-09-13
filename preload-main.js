const { contextBridge, ipcRenderer, shell } = require('electron');

try {
  contextBridge.exposeInMainWorld('encoElectron', {
    logout: () => ipcRenderer.send('enco-logout'),
    loginSuccess: (user) => ipcRenderer.send('enco-login-success', user),
    openExternal: (url) => ipcRenderer.send('open-external', url),
    ping: () => ipcRenderer.invoke('enco-ping')
  });
} catch (e) {}

// Tangkap window message dari UI ENCO
window.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'ENCO_LOGOUT' || event.data.type === 'ENCO_DESKTOP_LOGOUT')) {
    console.log('[preload-main] Signal logout diterima dari UI ENCO. Meneruskan ke proses Electron...');
    ipcRenderer.send('enco-logout');
  }
  if (event.data && event.data.type === 'ENCO_LOGIN_SUCCESS') {
    console.log('[preload-main] Signal login sukses diterima dari UI ENCO. Meneruskan ke proses Electron...');
    ipcRenderer.send('enco-login-success', event.data.user);
  }
});

// Terima sesi user dari main process dan teruskan ke window
ipcRenderer.on('enco-user-session', (event, user) => {
  if (typeof window.setInitialUser === 'function') {
    window.setInitialUser(user);
  } else {
    window.postMessage({ type: 'ENCO_SYNC_USER_SESSION', user }, '*');
  }
});
