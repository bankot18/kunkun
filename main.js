const { app, BrowserWindow, session, Menu, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const updater = require('./updater');

const APP_NAME = 'ENCO (Entry CKG Otomatis) v1.0.0';

// Cegah multiple instance aplikasi berjalan bersamaan
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow = null;
let loginWindow = null;
let splashWindow = null;
let currentLoggedUser = null;
let isTransitioning = false;

// File konfigurasi dan sesi
const configFilePath = path.join(__dirname, 'config.json');
const sessionFilePath = path.join(app.getPath('userData'), 'enco-auth-session.json');

function getConfig() {
  try {
    if (fs.existsSync(configFilePath)) {
      return JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
    }
  } catch (e) {}
  return {
    cloudflare: {
      accountId: '11ee11ecfb053d14f27892e9128844a2',
      databaseId: '8815a9d2-4d81-4340-8415-8992229f3c07',
      databaseName: 'enco_db',
      apiToken: ''
    }
  };
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(configFilePath, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {}
}

function getSavedSession() {
  try {
    if (fs.existsSync(sessionFilePath)) {
      const content = fs.readFileSync(sessionFilePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (e) {}
  return null;
}

function saveSession(user) {
  try {
    fs.writeFileSync(sessionFilePath, JSON.stringify(user), 'utf8');
  } catch (e) {}
}

function clearSession() {
  try {
    if (fs.existsSync(sessionFilePath)) {
      fs.unlinkSync(sessionFilePath);
    }
  } catch (e) {}
}

/**
 * Eksekusi Query Langsung ke Cloudflare D1 enco_db via REST API
 */
async function queryD1(sql, params = [], tokenOverride = null) {
  const cfg = getConfig();
  const accountId = cfg?.cloudflare?.accountId || '11ee11ecfb053d14f27892e9128844a2';
  const databaseId = cfg?.cloudflare?.databaseId || '8815a9d2-4d81-4340-8415-8992229f3c07';
  const token = (tokenOverride || cfg?.cloudflare?.apiToken || '').trim();

  if (!token) {
    throw new Error('Cloudflare API Token belum diisi. Silakan klik Konfigurasi Cloudflare D1 enco_db.');
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql, params })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    const errorMsg = data.errors?.[0]?.message || `Cloudflare API HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return data.result?.[0]?.results || [];
}

// Domain yang diizinkan untuk navigasi (Domain Whitelist)
const ALLOWED_DOMAINS = [
  'sehatindonesiaku.kemkes.go.id',
  'form.kemkes.go.id',
  'kemkes.go.id',
  'cpenco.bankot-laporan.workers.dev',
  'bankot-laporan.workers.dev',
  'accounts.google.com',
  'accounts.youtube.com',
  'oauth2.googleapis.com',
  'content.googleapis.com',
  'apis.google.com'
];

function isUrlAllowed(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol === 'chrome-extension:' || parsed.protocol === 'about:') {
      return true;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_DOMAINS.some(allowed => 
      hostname === allowed || hostname.endsWith('.' + allowed)
    );
  } catch (err) {
    return false;
  }
}

/**
 * Membuat Jendela Splash Screen (Pengecekan Pembaruan Diferensial GitHub)
 */
function createSplashWindow() {
  if (splashWindow) {
    splashWindow.focus();
    return splashWindow;
  }

  splashWindow = new BrowserWindow({
    width: 440,
    height: 280,
    resizable: false,
    maximizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    center: true,
    show: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-splash.js')
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));

  splashWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.show();
    }
  });

  splashWindow.on('closed', () => {
    splashWindow = null;
  });

  return splashWindow;
}

/**
 * Membuat Jendela Login Khusus (Login Gate)
 */
function createLoginWindow() {
  if (loginWindow) {
    loginWindow.focus();
    return;
  }

  loginWindow = new BrowserWindow({
    width: 440,
    height: 580,
    resizable: false,
    maximizable: false,
    title: `${APP_NAME} - Login`,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    center: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-login.js')
    }
  });

  loginWindow.loadFile(path.join(__dirname, 'login.html'));

  loginWindow.on('closed', () => {
    loginWindow = null;
    if (!mainWindow && !isTransitioning) {
      app.quit();
    }
  });
}

/**
 * Menyuntikkan Sesi Pengguna ke Aplikasi Desktop ENCO
 */
async function injectUserSessionToApp(user) {
  if (!mainWindow || !user) return;

  try {
    mainWindow.webContents.send('enco-user-session', user);
    await mainWindow.webContents.executeJavaScript(`
      if (typeof window.setInitialUser === 'function') {
        window.setInitialUser(${JSON.stringify(user)});
      }
    `);
    console.log('[ENCO] Sesi profil user dari enco_db berhasil disinkronkan ke desktop app:', user.nama);
  } catch (e) {
    console.warn('[ENCO] Gagal sync session ke webContents:', e.message);
  }
}

/**
 * Membuat jendela utama browser aplikasi (Sehat Indonesiaku + Panel ENCO)
 */
async function createMainWindow(user = null) {
  currentLoggedUser = user;

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: APP_NAME,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true, // Wajib aktif untuk native split-screen webview
      webSecurity: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload-main.js'),
      allowRunningInsecureContent: false
    }
  });

  // Kunci judul jendela agar konsisten
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
    mainWindow.setTitle(APP_NAME);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.setTitle(APP_NAME);
    if (currentLoggedUser) {
      injectUserSessionToApp(currentLoggedUser);
    }
  });

  // Maximalkan jendela saat pertama kali dibuka untuk kenyamanan pengguna
  mainWindow.maximize();

  // Kunci window baru (target="_blank" atau window.open)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isUrlAllowed(url)) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Pasang menu aplikasi
  createApplicationMenu();

  // Muat antarmuka utama desktop split-screen
  mainWindow.loadFile(path.join(__dirname, 'app.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (!loginWindow && !isTransitioning) {
      app.quit();
    }
  });
}

/**
 * Konfigurasi Menu Aplikasi yang Rapi & Kiosk-friendly
 */
function createApplicationMenu() {
  const template = [
    {
      label: 'Navigasi',
      submenu: [
        {
          label: '🏠 Beranda Sehat Indonesiaku',
          accelerator: 'CmdOrCtrl+H',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(`
                const wv = document.getElementById('kemkesView');
                if (wv) wv.loadURL('https://sehatindonesiaku.kemkes.go.id/');
              `).catch(() => {});
            }
          }
        },
        {
          label: '🎛️ Control Panel ENCO',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            shell.openExternal('https://cpenco.bankot-laporan.workers.dev');
          }
        },
        {
          label: '📝 Form Pemeriksaan Kemkes',
          accelerator: 'CmdOrCtrl+M',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(`
                const wv = document.getElementById('kemkesView');
                if (wv) wv.loadURL('https://form.kemkes.go.id/');
              `).catch(() => {});
            }
          }
        },
        {
          label: '🔄 Refresh Web Sehat Indonesiaku',
          accelerator: 'F5',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(`
                const wv = document.getElementById('kemkesView');
                if (wv) wv.reload();
              `).catch(() => {});
            }
          }
        },
        {
          label: '⬅️ Kembali (Back)',
          accelerator: 'Alt+Left',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(`
                const wv = document.getElementById('kemkesView');
                if (wv && wv.canGoBack()) wv.goBack();
              `).catch(() => {});
            }
          }
        },
        {
          label: '➡️ Maju (Forward)',
          accelerator: 'Alt+Right',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(`
                const wv = document.getElementById('kemkesView');
                if (wv && wv.canGoForward()) wv.goForward();
              `).catch(() => {});
            }
          }
        },
        { type: 'separator' },
        {
          label: '🚪 Keluar Akun (Logout)',
          click: () => {
            clearSession();
            currentLoggedUser = null;
            // Bersihkan storage extension
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.executeJavaScript(`
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                  chrome.storage.local.remove(["session", "deviceToken", "isLoggedIn", "loggedUsername", "loggedUser"]);
                }
              `).catch(() => {});
            }
            // Tutup main window dan buka login window
            isTransitioning = true;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.close();
              mainWindow = null;
            }
            createLoginWindow();
            isTransitioning = false;
          }
        },
        {
          label: 'Tutup Aplikasi',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Tampilan',
      submenu: [
        { role: 'resetZoom', label: 'Ukuran Normal' },
        { role: 'zoomIn', label: 'Perbesar (+)' },
        { role: 'zoomOut', label: 'Perkecil (-)' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Layar Penuh (Fullscreen)' }
      ]
    },
    {
      label: 'Bantuan',
      submenu: [
        {
          label: 'Tentang Aplikasi ENCO',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Tentang ENCO Desktop',
              message: APP_NAME,
              detail: 'Aplikasi Dedicated Browser berbasis Chromium open-source yang terhubung ke Cloudflare D1 enco_db.\n\nDibuat oleh: Mochamad Fauzie, S.Gz'
            });
          }
        },
        {
          label: 'Developer Tools (Debug)',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ── IPC Handlers untuk Komunikasi D1 Database ──

// 1. Ambil Konfigurasi
ipcMain.handle('d1-get-config', async () => {
  return getConfig();
});

// 2. Simpan Konfigurasi Token
ipcMain.handle('d1-save-config', async (event, newCfg) => {
  saveConfig(newCfg);
  return { success: true };
});

// 3. Tes Koneksi Langsung ke Cloudflare D1 enco_db
ipcMain.handle('d1-test-connection', async (event, { apiToken }) => {
  try {
    const results = await queryD1('SELECT count(*) as total_users FROM users', [], apiToken);
    const count = results?.[0]?.total_users ?? 0;
    return { success: true, userCount: count };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

// 4. Login & Autentikasi Pengguna dari Tabel users di enco_db
ipcMain.handle('d1-login', async (event, { username, password, rememberMe }) => {
  const cleanUsername = (username || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();

  if (!cleanUsername || !cleanPassword) {
    return { success: false, message: 'Username dan password tidak boleh kosong.' };
  }

  const cfg = getConfig();
  const hasToken = Boolean(cfg?.cloudflare?.apiToken?.trim());

  let user = null;

  if (hasToken) {
    // ── KONEKSI LANGSUNG KE CLOUDFLARE D1 ──
    try {
      const users = await queryD1('SELECT * FROM users WHERE LOWER(username) = ?1', [cleanUsername]);
      if (!users || users.length === 0) {
        return { success: false, message: 'Akun tidak ditemukan di database enco_db!' };
      }
      user = users[0];
    } catch (d1Err) {
      return { success: false, message: `Gagal query ke D1 enco_db: ${d1Err.message}` };
    }
  } else {
    // ── FALLBACK DEMO / LOCAL JIKA TOKEN BELUM DIISI ──
    if (cleanUsername === 'admin' && cleanPassword === 'admin123') {
      user = {
        id: 'usr_admin_master',
        username: 'admin',
        password: 'admin123',
        nama: 'Super Administrator',
        role: 'admin',
        instansi: 'Dinas Kesehatan / Puskesmas Pusat',
        status_aktif: 'aktif',
        masa_aktif: null,
        lisensi: 'ENTERPRISE-LIFETIME'
      };
    } else if (cleanUsername === 'petugas1' && cleanPassword === 'petugas123') {
      user = {
        id: 'usr_petugas_demo',
        username: 'petugas1',
        password: 'petugas123',
        nama: 'Petugas Skrining 1',
        role: 'petugas',
        instansi: 'Puskesmas',
        status_aktif: 'aktif',
        masa_aktif: '2026-12-31',
        lisensi: 'STANDARD-PRO'
      };
    } else {
      return { 
        success: false, 
        message: 'Token Cloudflare D1 belum diisi! Silakan buka Konfigurasi Cloudflare D1 di bawah untuk memasukkan API Token, atau gunakan akun demo default.' 
      };
    }
  }

  // Validasi Password
  if (user.password !== cleanPassword) {
    return { success: false, message: 'Password yang Anda masukkan salah!' };
  }

  // Validasi Status Aktif
  if (user.status_aktif !== 'aktif') {
    return { success: false, message: `Akun Anda sedang nonaktif (${user.status_aktif}). Silakan hubungi Admin.` };
  }

  // Normalisasi Role & Lisensi
  const rawRole = (user.role || 'petugas').toString().trim().toLowerCase();
  const rawLisensi = (user.lisensi || '').toString().trim();
  const isSuperAdmin = rawRole === 'admin' || rawRole === 'super_admin';
  const isLifetime = isSuperAdmin || rawLisensi.toUpperCase().includes('LIFETIME');

  // Pengecekan Masa Aktif Lisensi:
  // Super Admin / Lifetime bebas masa aktif.
  // Jika lisensi Basic atau Pro habis masa aktifnya, OTOMATIS TURUN KE FREE (Expired).
  // Lisensi Free memang tidak memiliki masa aktif (bersifat Expired).
  let isExpired = false;
  let activeLisensi = rawLisensi;

  if (!isLifetime) {
    const today = new Date().toISOString().split('T')[0];
    if (user.masa_aktif && today > user.masa_aktif) {
      isExpired = true;
      activeLisensi = 'Free'; // Otomatis turun ke Free
    } else if (rawLisensi.toUpperCase().includes('FREE') || !user.masa_aktif) {
      isExpired = true; // Lisensi Free bersifat Expired
      activeLisensi = 'Free';
    }
  }

  const isPro = !isExpired && (isLifetime || activeLisensi.toUpperCase().includes('PRO'));
  const isFree = isExpired || (!isPro && activeLisensi.toUpperCase().includes('FREE'));
  const isBasic = !isPro && !isFree;
  const jenisLisensi = isLifetime ? 'Lifetime' : (isPro ? 'Pro' : (isFree ? 'Free' : 'Basic'));

  // Daftar Tab Fitur Bot yang Diizinkan Sesuai Lisensi
  // Lisensi Free & Basic: HANYA Pendaftaran dan Pasien (pelayanan-instan) + Pengaturan
  // Lisensi Pro / Lifetime: Seluruh Fitur Terbuka Lengkap
  const allowedTabs = isPro
    ? ['pendaftaran', 'pelayanan-instan', 'konfirmasi-hadir', 'otomasi', 'bnba-umum', 'bnba-sekolah', 'tools', 'pengaturan']
    : ['pendaftaran', 'pelayanan-instan', 'pengaturan'];

  // Data profil aman untuk disinkronkan ke aplikasi & ekstensi
  const safeUser = {
    id: user.id,
    username: user.username,
    nama: user.nama,
    role: user.role,
    instansi: user.instansi,
    status_aktif: user.status_aktif,
    statusAktif: user.status_aktif,
    masa_aktif: isLifetime ? 'LIFETIME' : (isFree ? null : user.masa_aktif),
    masaAktif: isLifetime ? 'LIFETIME' : (isFree ? null : user.masa_aktif),
    isLifetime: isLifetime,
    isPro: isPro,
    isBasic: isBasic,
    isFree: isFree,
    isExpired: isExpired,
    maxDailyQuota: isFree ? 200 : null,
    lisensi: jenisLisensi,
    originalLisensi: rawLisensi,
    allowedTabs: allowedTabs
  };

  // Simpan Sesi
  if (rememberMe) {
    saveSession(safeUser);
  } else {
    clearSession();
  }

  // Buka Main Window TERLEBIH DAHULU agar tidak memicu penutupan aplikasi
  isTransitioning = true;
  await createMainWindow(safeUser);

  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.close();
    loginWindow = null;
  }
  isTransitioning = false;

  return { success: true, user: safeUser };
});

ipcMain.on('close-login', () => {
  app.quit();
});

// Handler Login Sukses yang disinkronkan dari UI popup.html / iframe ekstensi ENCO
ipcMain.on('enco-login-success', (event, user) => {
  if (user) {
    console.log('[ENCO] Sesi login dari ekstensi disinkronkan ke Electron:', user?.nama || user?.username);
    currentLoggedUser = user;
    injectUserSessionToExtension(user);
  }
});

// Handler Logout yang dipicu dari UI aplikasi / sidebar ENCO
// Logout = tutup main window → buka login window lagi
ipcMain.on('enco-logout', () => {
  console.log('[ENCO] Logout dipicu dari UI aplikasi ENCO. Menutup main window, membuka login...');
  clearSession();
  currentLoggedUser = null;

  // Bersihkan storage extension & session sebelum tutup
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(`
      if (typeof chrome !== 'undefined' && chrome.storage) {
        if (chrome.storage.local) {
          chrome.storage.local.remove(["session", "deviceToken", "isLoggedIn", "loggedUsername", "loggedUser"]);
        }
        if (chrome.storage.session) {
          chrome.storage.session.clear();
        }
      }
    `).catch(() => {});
  }

  // Tutup main window dan buka login window
  isTransitioning = true;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
    mainWindow = null;
  }
  createLoginWindow();
  isTransitioning = false;
});

// Handler untuk membuka URL eksternal
ipcMain.on('open-external', (event, url) => {
  if (url && typeof url === 'string') {
    shell.openExternal(url);
  }
});

/**
 * Pengukur latensi TCP super-cepat & realtime tanpa overhead HTTP / CORS
 */
function tcpPing(host, port = 443, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = new net.Socket();
    let handled = false;

    socket.setTimeout(timeoutMs);

    const finish = (ok, error = null) => {
      if (!handled) {
        handled = true;
        const ms = Math.max(1, Math.round(performance.now() - start));
        try { socket.destroy(); } catch (e) {}
        resolve({ ok, ms: ok ? ms : null, error });
      }
    };

    socket.on('connect', () => finish(true));
    socket.on('timeout', () => finish(false, 'RTO'));
    socket.on('error', (err) => {
      // Jika port menolak atau mereset koneksi, paket tetap sampai ke server (RTT valid)
      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
        finish(true);
      } else {
        finish(false, 'Err');
      }
    });

    try {
      socket.connect(port, host);
    } catch (e) {
      finish(false, 'Err');
    }
  });
}

// Handler IPC Ping Realtime Live
ipcMain.handle('enco-ping', async () => {
  try {
    const [google, asik] = await Promise.all([
      tcpPing('8.8.8.8', 53, 1800),
      tcpPing('sehatindonesiaku.kemkes.go.id', 443, 2000)
    ]);
    return { google, asik };
  } catch (e) {
    return {
      google: { ok: false, ms: null, error: 'Err' },
      asik: { ok: false, ms: null, error: 'Err' }
    };
  }
});

// Inisialisasi Aplikasi
app.whenReady().then(async () => {
  // Selalu bersihkan sesi lama saat baru pertama kali dijalankan agar WAJIB login dulu
  clearSession();
  currentLoggedUser = null;

  // 1. Tampilkan Splash Screen Pembaruan Otomatis
  console.log('[ENCO] Membuka jendela splash pembaruan...');
  createSplashWindow();

  // 2. Periksa Pembaruan Diferensial dari GitHub (bankot18/kunkun)
  try {
    await updater.checkAndApplyUpdates((text, percent) => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('updater-status', { text, percent });
      }
    });
  } catch (updErr) {
    console.warn('[ENCO] Update checker error:', updErr.message);
  }

  // 3. Transisi halus dari Splash Screen ke Jendela Login
  console.log('[ENCO] Membuka jendela login...');
  isTransitioning = true;
  createLoginWindow();

  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    isTransitioning = false;
  }, 400);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createLoginWindow();
    }
  });
});

// Bersihkan sesi ketika aplikasi akan ditutup agar tidak stay login
app.on('before-quit', () => {
  clearSession();
  currentLoggedUser = null;
});

// Tutup aplikasi jika semua jendela ditutup (Windows behavior)
app.on('window-all-closed', () => {
  clearSession();
  currentLoggedUser = null;
  if (!isTransitioning && process.platform !== 'darwin') {
    app.quit();
  }
});

// Tangani event jika user mencoba membuka instance kedua
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else if (loginWindow) {
    if (loginWindow.isMinimized()) loginWindow.restore();
    loginWindow.focus();
  } else if (splashWindow) {
    if (splashWindow.isMinimized()) splashWindow.restore();
    splashWindow.focus();
  }
});
