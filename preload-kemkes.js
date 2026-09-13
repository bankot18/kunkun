// Preload Script untuk Webview Sehat Indonesiaku di ENCO Desktop
const { ipcRenderer } = require('electron');

(function() {
  console.log('[ENCO Kemkes Preload] Preload script aktif pada Sehat Indonesiaku.');

  // Intercept fetch untuk menangkap data CKG dan profil petugas Sehat Indonesiaku
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
      
      // 1. Tangkap profil user petugas dari portal Sehat Indonesiaku
      if (url.includes('user-management/me')) {
        response.clone().json().then(json => {
          if (json?.statusCode === 200 && json?.data) {
            console.log('[ENCO Kemkes] User Sehat Indonesiaku terdeteksi:', json.data);
            ipcRenderer.sendToHost('CKG_USER_ME', json.data);
          }
        }).catch(() => {});
      }

      // 2. Tangkap respons detail screening
      if (url.includes('detail-screening') || url.includes('get-screening')) {
        response.clone().json().then(json => {
          window.__ckgCache = window.__ckgCache || {};
          window.__ckgCache.detailScreening = json;
          ipcRenderer.sendToHost('CKG_DETAIL_SCREENING', json);
        }).catch(() => {});
      }
    } catch (e) {}

    return response;
  };
})();
