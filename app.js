// ============================================================================
// ENCO Desktop - App Controller (Topbar, Webview Controls, Splitter, IPC)
// ============================================================================

(function() {
  console.log('[ENCO App] Inisialisasi App Controller Desktop...');

  const kemkesView = document.getElementById('kemkesView');
  const kemkesLoadingBar = document.getElementById('kemkes-loading-bar');
  const topbarUrlText = document.getElementById('topbar-url-text');
  const navReloadIcon = document.getElementById('nav-reload-icon');
  const botPanel = document.getElementById('bot-panel');
  const appSplitter = document.getElementById('app-splitter');
  const navBtnToggleBot = document.getElementById('nav-btn-toggle-bot');
  const navToggleText = document.getElementById('nav-toggle-text');

  // ── 1. SPLITTER RESIZER LOGIC ─────────────────────────────────
  let isDragging = false;
  const savedWidth = localStorage.getItem('enco_bot_panel_width');
  if (savedWidth && botPanel) {
    const w = parseInt(savedWidth, 10);
    if (!isNaN(w) && w >= 360 && w <= 800) {
      botPanel.style.width = `${w}px`;
    }
  }

  if (appSplitter && botPanel) {
    appSplitter.addEventListener('mousedown', (e) => {
      isDragging = true;
      appSplitter.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const containerWidth = window.innerWidth;
      const newBotWidth = containerWidth - e.clientX;
      if (newBotWidth >= 360 && newBotWidth <= 800) {
        botPanel.style.width = `${newBotWidth}px`;
        localStorage.setItem('enco_bot_panel_width', newBotWidth);
      }
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        appSplitter.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }

  // ── 2. TOGGLE BOT PANEL ───────────────────────────────────────
  if (navBtnToggleBot && botPanel) {
    navBtnToggleBot.addEventListener('click', () => {
      const isCollapsed = botPanel.classList.toggle('collapsed');
      if (isCollapsed) {
        navBtnToggleBot.classList.remove('active');
        navBtnToggleBot.title = 'Tampilkan Panel Bot';
        if (navToggleText) navToggleText.textContent = 'Buka Bot';
      } else {
        navBtnToggleBot.classList.add('active');
        navBtnToggleBot.title = 'Sembunyikan Panel Bot';
        if (navToggleText) navToggleText.textContent = 'Panel Bot';
      }
    });
  }

  // ── 3. TOPBAR NAVIGASI SEHAT INDONESIAKU ──────────────────────
  const navBtnHome = document.getElementById('nav-btn-home');
  const navBtnBack = document.getElementById('nav-btn-back');
  const navBtnForward = document.getElementById('nav-btn-forward');
  const navBtnReload = document.getElementById('nav-btn-reload');
  const navBtnLogout = document.getElementById('nav-btn-logout');

  if (navBtnHome && kemkesView) {
    navBtnHome.addEventListener('click', () => {
      kemkesView.loadURL('https://sehatindonesiaku.kemkes.go.id/');
    });
  }

  if (navBtnBack && kemkesView) {
    navBtnBack.addEventListener('click', () => {
      if (kemkesView.canGoBack()) kemkesView.goBack();
    });
  }

  if (navBtnForward && kemkesView) {
    navBtnForward.addEventListener('click', () => {
      if (kemkesView.canGoForward()) kemkesView.goForward();
    });
  }

  if (navBtnReload && kemkesView) {
    navBtnReload.addEventListener('click', () => {
      kemkesView.reload();
    });
  }

  // ── 3B. TOGGLE MODE REDUP / DARK MODE UNTUK WEB ASIK ────────
  const navBtnDarkMode = document.getElementById('nav-btn-dark-mode');
  const darkModeLabel = document.getElementById('dark-mode-label');
  let isDarkModeActive = localStorage.getItem('enco_kemkes_dark_mode') === 'true';
  let darkCssKey = null;

  const KEMKES_DARK_CSS = `
    html {
      filter: invert(0.9) hue-rotate(180deg) !important;
      background: #0d1527 !important;
    }
    img, svg, video, canvas, [style*="background-image"], .captcha-image, #captcha, [class*="captcha"] {
      filter: invert(1.12) hue-rotate(180deg) !important;
    }
  `;

  async function applyKemkesDarkMode(enable) {
    if (!kemkesView) return;
    try {
      if (enable) {
        if (!darkCssKey) {
          darkCssKey = await kemkesView.insertCSS(KEMKES_DARK_CSS);
        }
        if (navBtnDarkMode) {
          navBtnDarkMode.classList.add('active');
          navBtnDarkMode.style.background = 'rgba(0, 212, 255, 0.2)';
          navBtnDarkMode.style.borderColor = '#00d4ff';
          navBtnDarkMode.style.color = '#00f0ff';
        }
        if (darkModeLabel) darkModeLabel.textContent = 'Mode Terang';
      } else {
        if (darkCssKey) {
          await kemkesView.removeInsertedCSS(darkCssKey);
          darkCssKey = null;
        }
        if (navBtnDarkMode) {
          navBtnDarkMode.classList.remove('active');
          navBtnDarkMode.style.background = '';
          navBtnDarkMode.style.borderColor = '';
          navBtnDarkMode.style.color = '';
        }
        if (darkModeLabel) darkModeLabel.textContent = 'Mode Redup';
      }
      localStorage.setItem('enco_kemkes_dark_mode', enable ? 'true' : 'false');
    } catch (e) {
      console.warn('[ENCO App] Gagal mengaplikasikan dark mode kemkes:', e);
    }
  }

  if (navBtnDarkMode) {
    navBtnDarkMode.addEventListener('click', () => {
      isDarkModeActive = !isDarkModeActive;
      applyKemkesDarkMode(isDarkModeActive);
    });
  }

  if (kemkesView) {
    kemkesView.addEventListener('did-finish-load', () => {
      const currentUrl = kemkesView.getURL() || '';
      if (isDarkModeActive && currentUrl.includes('kemkes.go.id')) {
        darkCssKey = null;
        applyKemkesDarkMode(true);
      } else if (darkCssKey) {
        kemkesView.removeInsertedCSS(darkCssKey);
        darkCssKey = null;
      }
    });
  }

  if (isDarkModeActive) {
    setTimeout(() => applyKemkesDarkMode(true), 1200);
  }

  // Hotkey F5 untuk refresh webview Kemkes saja (tanpa me-refresh aplikasi utama)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F5') {
      e.preventDefault();
      if (kemkesView) kemkesView.reload();
    }
  });

  // Logout Handler dengan Desain Modal Mewah & Modern
  if (navBtnLogout) {
    navBtnLogout.addEventListener('click', async () => {
      let isConfirmed = false;
      if (typeof Swal !== 'undefined') {
        const res = await Swal.fire({
          html: `
            <div class="swal-neon-modal-body">
              <div class="swal-neon-icon-box">
                <div class="swal-neon-icon-glow"></div>
                <div class="swal-neon-icon-circle">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                </div>
              </div>
              <h3 class="swal-neon-title">Konfirmasi Logout</h3>
              <p class="swal-neon-desc">Apakah Anda yakin ingin keluar dari aplikasi ENCO?</p>
              <div class="swal-neon-tip">Sesi akun dan aktivitas saat ini akan ditutup secara aman.</div>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: 'Ya, Keluar',
          cancelButtonText: 'Batal',
          reverseButtons: true,
          buttonsStyling: false,
          customClass: {
            popup: 'cyber-premium-modal',
            actions: 'cyber-premium-actions',
            confirmButton: 'cyber-premium-confirm',
            cancelButton: 'cyber-premium-cancel'
          },
          showClass: {
            popup: 'swal2-modal-popin'
          },
          hideClass: {
            popup: 'swal2-modal-popout'
          }
        });
        isConfirmed = res.isConfirmed;
      } else {
        isConfirmed = window.confirm('Apakah Anda yakin ingin keluar dari akun ENCO?');
      }

      if (isConfirmed) {
        // Bersihkan seluruh data sesi antrean & cache agar bersih total saat logout
        try {
          if (window.chrome?.storage?.session?.clear) {
            await window.chrome.storage.session.clear();
          }
          if (window.chrome?.storage?.local?.remove) {
            await window.chrome.storage.local.remove(['loggedUser', 'loggedUsername', 'isLoggedIn', 'session']);
          }
        } catch (e) {}

        window.postMessage({ type: 'ENCO_LOGOUT' }, '*');
        if (window.encoElectron && typeof window.encoElectron.logout === 'function') {
          window.encoElectron.logout();
        }
      }
    });
  }

  // ── 3C. TOMBOL CONTROL PANEL (Buka https://cpenco.bankot-laporan.workers.dev/ di Webview) ──
  const btnControlPanel = document.getElementById('btn-control-panel');
  if (btnControlPanel && kemkesView) {
    btnControlPanel.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const targetUrl = 'https://cpenco.bankot-laporan.workers.dev/';
      console.log('[ENCO App] Membuka Control Panel di panel tengah webview:', targetUrl);
      kemkesView.loadURL(targetUrl);
    });
  }

  // Tangkap navigasi Control Panel atau Deep Link yang dikirim via postMessage
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'ENCO_NAVIGATE_LEFT' && event.data.url && kemkesView) {
      console.log('[ENCO App] Navigasi panel tengah ke:', event.data.url);
      kemkesView.loadURL(event.data.url);
    }
  });

  // ── 3D. SIDEBAR TAB NAVIGATION & LICENSE LOCK CONTROLLER ──────
  const LOCKED_TABS = ['konfirmasi-hadir', 'otomasi', 'bnba-umum', 'bnba-sekolah', 'tools'];
  let isDesktopUserLocked = true;
  let desktopUserLicenseTier = 'FREE';

  function updateDesktopTabLockBadges(isLocked, licenseTier = 'FREE') {
    isDesktopUserLocked = Boolean(isLocked);
    desktopUserLicenseTier = licenseTier || (isLocked ? 'FREE' : 'PRO');

    const sidebarBtns = document.querySelectorAll('#app-nav-sidebar .tab-nav__btn, .tab-nav__btn');
    sidebarBtns.forEach((btn) => {
      const tabKey = btn.dataset.tab;
      if (!tabKey || btn.id === 'btn-control-panel') return;

      const shouldLock = isDesktopUserLocked && LOCKED_TABS.includes(tabKey);
      btn.classList.toggle('tab-nav__btn--locked', shouldLock);

      let lockBadge = btn.querySelector('.tab-nav__lock-badge');
      if (shouldLock) {
        if (!lockBadge) {
          lockBadge = document.createElement('span');
          lockBadge.className = 'tab-nav__lock-badge';
          lockBadge.title = 'Fitur Terkunci (Lisensi PRO)';
          lockBadge.innerHTML = `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2.5" ry="2.5" fill="#facc15" fill-opacity="0.25" stroke="#facc15" stroke-width="2.2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="#facc15" stroke-width="2.2"></path>
              <circle cx="12" cy="16.5" r="1.3" fill="#facc15"></circle>
            </svg>
          `;
          btn.appendChild(lockBadge);
        }
      } else {
        if (lockBadge) {
          lockBadge.remove();
        }
      }
    });
  }
  window.updateTabButtonsLockState = updateDesktopTabLockBadges;

  function showLockedFeatureModal(tabKey) {
    const tabNamesMap = {
      'konfirmasi-hadir': 'Konfirmasi Kehadiran',
      'otomasi': 'Pelayanan & Skrining',
      'bnba-umum': 'BNBA Kategori Umum',
      'bnba-sekolah': 'BNBA Kategori Sekolah',
      'tools': 'Tools & Utilitas'
    };
    const featureName = tabNamesMap[tabKey] || tabKey.toUpperCase();

    if (typeof Swal !== 'undefined') {
      Swal.fire({
        html: `
          <div class="swal-neon-modal-body">
            <div class="swal-neon-icon-box swal-neon-icon-box--amber">
              <div class="swal-neon-icon-glow swal-neon-icon-glow--amber"></div>
              <div class="swal-neon-icon-circle swal-neon-icon-circle--amber">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="#facc15" stroke="#fde047" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="3" ry="3"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  <circle cx="12" cy="16" r="1.5" fill="#0c1322"></circle>
                </svg>
              </div>
            </div>
            <div class="swal-neon-pill swal-neon-pill--amber">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#facc15" stroke="#fde047" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
              <span>FITUR EKSKLUSIF PRO</span>
            </div>
            <h3 class="swal-neon-title">Fitur Terkunci (Lisensi PRO)</h3>
            <p class="swal-neon-subtitle">Fitur <b>${featureName}</b> memerlukan izin lisensi tingkat lanjut.</p>

            <div class="swal-neon-card swal-neon-card--amber">
              <div class="swal-neon-card__row">
                <span class="swal-neon-card__badge-free">
                  <span class="swal-neon-dot swal-neon-dot--amber"></span>
                  Akun Anda: Lisensi ${desktopUserLicenseTier}
                </span>
                <span class="swal-neon-card__badge-tier">Tier Terbatas</span>
              </div>
              <div class="swal-neon-card__desc">
                Akun Anda saat ini hanya membuka modul <b>Pendaftaran</b> dan <b>Pasien</b>.
              </div>
              <div class="swal-neon-features-grid">
                <div class="swal-feat-item swal-feat-item--active">
                  <span>✓</span> Pendaftaran Pasien
                </div>
                <div class="swal-feat-item swal-feat-item--active">
                  <span>✓</span> Database Pasien
                </div>
                <div class="swal-feat-item swal-feat-item--locked">
                  <span>🔒</span> Konfirmasi Hadir
                </div>
                <div class="swal-feat-item swal-feat-item--locked">
                  <span>🔒</span> Pelayanan & Skrining
                </div>
                <div class="swal-feat-item swal-feat-item--locked">
                  <span>🔒</span> BNBA Umum & Sekolah
                </div>
                <div class="swal-feat-item swal-feat-item--locked">
                  <span>🔒</span> Tools & Utilitas
                </div>
              </div>
            </div>

            <div class="swal-neon-tip swal-neon-tip--pro">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <span>Silakan hubungi Administrator untuk upgrade akun Anda ke <b>Lisensi PRO</b> agar seluruh fitur terbuka.</span>
            </div>
          </div>
        `,
        confirmButtonText: 'Saya Mengerti',
        buttonsStyling: false,
        customClass: {
          popup: 'cyber-premium-modal',
          actions: 'cyber-premium-actions',
          confirmButton: 'cyber-premium-confirm cyber-premium-confirm--cyan'
        },
        showClass: { popup: 'swal2-modal-popin' },
        hideClass: { popup: 'swal2-modal-popout' }
      });
    } else {
      alert(`Fitur "${featureName}" Terkunci!\nAkun Anda berlisensi ${desktopUserLicenseTier}.\nHubungi Administrator untuk upgrade ke Lisensi PRO.`);
    }
  }

  function switchDesktopTab(tabKey) {
    if (!tabKey) return;

    if (isDesktopUserLocked && LOCKED_TABS.includes(tabKey)) {
      showLockedFeatureModal(tabKey);
      return;
    }

    // 1. Update status aktif tombol tab
    document.querySelectorAll('#app-nav-sidebar .tab-nav__btn, .tab-nav__btn').forEach((btn) => {
      if (btn.dataset.tab) {
        btn.classList.toggle('tab-nav__btn--active', btn.dataset.tab === tabKey);
      }
    });

    // 2. Tampilkan panel bot yang bersangkutan dan sembunyikan yang lain
    const allTabPanels = [
      'tab-pendaftaran',
      'tab-konfirmasi-hadir',
      'tab-pelayanan-instan',
      'tab-otomasi',
      'tab-bnba-umum',
      'tab-bnba-sekolah',
      'tab-tools',
      'tab-pengaturan'
    ];

    allTabPanels.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.hidden = (id !== ('tab-' + tabKey));
      }
    });

    // 3. Update footer button visibility
    const btnFooter = document.getElementById('btn-footer');
    if (btnFooter) {
      btnFooter.hidden = (tabKey !== 'otomasi' && tabKey !== 'pelayanan-instan');
    }

    // 4. Simpan ke session storage agar tab aktif konsisten
    try {
      if (window.chrome?.storage?.session?.set) {
        window.chrome.storage.session.set({ activeTab: tabKey, hasExplicitTab: true });
      }
    } catch (e) {}

    // 5. Panggil fungsi popup.js jika ada untuk sinkronisasi state internal modul
    if (typeof window.switchTab === 'function') {
      try { window.switchTab(tabKey); } catch (e) {}
    }

    // Pastikan modul pelayanan-instan ter-render saat tab pasien dibuka
    if (tabKey === 'pelayanan-instan' && window.pelayananInstan && typeof window.pelayananInstan.initialize === 'function') {
      try { window.pelayananInstan.initialize(); } catch (e) {}
    }
  }
  window.switchDesktopTab = switchDesktopTab;

  function initSidebarTabNavigation() {
    const sidebarBtns = document.querySelectorAll('#app-nav-sidebar .tab-nav__btn');
    sidebarBtns.forEach((btn) => {
      if (btn.id === 'btn-control-panel') return;
      const tabKey = btn.dataset.tab;
      if (!tabKey) return;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        switchDesktopTab(tabKey);
      });
    });

    // Delegated click listener untuk tombol CTA "Buka Halaman di Kiri" pada empty state
    document.addEventListener('click', (e) => {
      const ctaBtn = e.target.closest('.hud-empty-cta-btn');
      if (ctaBtn && ctaBtn.dataset.url && kemkesView) {
        console.log('[ENCO App] Navigasi cepat kemkesView dari empty state:', ctaBtn.dataset.url);
        kemkesView.loadURL(ctaBtn.dataset.url);
      }
    });
  }

  // Pasang listener klik sekarang juga
  initSidebarTabNavigation();

  // ── 4. WEBVIEW EVENT LISTENERS ────────────────────────────────
  if (kemkesView) {
    kemkesView.addEventListener('did-start-loading', () => {
      if (kemkesLoadingBar) kemkesLoadingBar.style.width = '40%';
      if (navReloadIcon) navReloadIcon.classList.add('spinning');
    });

    kemkesView.addEventListener('did-stop-loading', () => {
      if (kemkesLoadingBar) {
        kemkesLoadingBar.style.width = '100%';
        setTimeout(() => {
          kemkesLoadingBar.style.width = '0%';
        }, 300);
      }
      if (navReloadIcon) navReloadIcon.classList.remove('spinning');

      try {
        const url = kemkesView.getURL();
        if (url && topbarUrlText) {
          const parsed = new URL(url);
          topbarUrlText.textContent = parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '');
        }
      } catch (e) {}
    });

    // Tangkap IPC messages dari preload-kemkes.js
    kemkesView.addEventListener('ipc-message', (event) => {
      console.log('[ENCO App] IPC message dari Kemkes webview:', event.channel);
      if (event.channel === 'CKG_USER_ME') {
        const userData = event.args?.[0];
        if (userData && window.chrome?.runtime?.sendMessage) {
          window.chrome.runtime.sendMessage({ type: 'CKG_USER_ME', data: userData }).catch(() => {});
        }
      }
      if (event.channel === 'CKG_DETAIL_SCREENING') {
        const detail = event.args?.[0];
        if (detail && window.chrome?.runtime?.sendMessage) {
          window.chrome.runtime.sendMessage({ type: 'CKG_DETAIL_SCREENING', data: detail }).catch(() => {});
        }
      }
    });
  }

  // ── 5. PROFIL USER TOPBAR SYNC ────────────────────────────────
  async function syncTopbarUser() {
    try {
      let name = 'Mochamad Fauzie, S.Gz';
      let role = 'Admin';
      let instansi = 'Puskesmas Banjaran Kota';
      let avatar = 'M';

      if (window.chrome?.storage?.local) {
        const res = await window.chrome.storage.local.get(['loggedUser', 'enco_daily_quota']);
        const user = res?.loggedUser;
        if (user) {
          name = user.nama || user.username || name;
          const today = new Date().toISOString().split('T')[0];
          const isSuperAdmin = user.role === 'admin' || user.role === 'super_admin';
          const isLifetime = isSuperAdmin || user.isLifetime === true || (user.lisensi || '').toUpperCase().includes('LIFETIME');
          const masaAktif = user.masa_aktif || user.masaAktif || user.user_metadata?.masaAktif;

          // Pengecekan masa aktif:
          // Jika lisensi basic atau pro habis, LANGSUNG TURUN KE FREE dan dinyatakan Expired
          const isDateExpired = (!isLifetime && masaAktif && masaAktif !== 'LIFETIME' && masaAktif !== '-' && today > masaAktif);
          const isFreeExplicit = (user.lisensi || '').toUpperCase().includes('FREE') || user.isFree === true;
          const isFree = !isLifetime && (isFreeExplicit || isDateExpired || !masaAktif);
          const isPro = !isLifetime && !isFree && (user.isPro === true || (user.lisensi || '').toUpperCase().includes('PRO'));
          const isBasic = !isLifetime && !isPro && !isFree;
          
          // 1. Tampilkan Lisensi saja (tanpa tulisan 'petugas' dan tanpa tanda petir ⚡)
          const lisensiStr = isSuperAdmin 
            ? '👑 Super Admin' 
            : (isPro 
                ? '💎 PRO' 
                : (isFree 
                    ? '🎁 FREE' 
                    : 'BASIC'));
          role = lisensiStr;
          instansi = user.instansi || instansi;
          avatar = name.trim().charAt(0).toUpperCase() || 'M';

          // 2. Tampilkan Sisa Masa Aktif Lisensi (Khusus Free / Expired tampil Expired berwarna merah)
          const topQuotaEl = document.getElementById('top-user-quota');
          const topQuotaVal = document.getElementById('top-quota-val');

          if (topQuotaEl && topQuotaVal) {
            topQuotaEl.style.display = 'inline-flex';
            if (isLifetime) {
              topQuotaVal.textContent = 'Lifetime';
              topQuotaEl.className = 'topbar-user-quota-badge quota-unlimited';
              topQuotaEl.title = 'Masa Aktif: Permanen (Lifetime)';
              topQuotaEl.style.color = '';
              topQuotaEl.style.borderColor = '';
              topQuotaEl.style.background = '';
            } else if (isFree) {
              // Lisensi Free TIDAK ADA MASA AKTIF -> DINYATAKAN EXPIRED & BERWARNA MERAH
              const quotaData = res?.enco_daily_quota;
              const used = (quotaData && quotaData.date === today) ? Number(quotaData.count || 0) : 0;
              const sisa = Math.max(0, 200 - used);
              
              topQuotaVal.textContent = `Expired (${sisa}/200)`;
              topQuotaEl.className = 'topbar-user-quota-badge quota-expired';
              topQuotaEl.style.color = '#ef4444';
              topQuotaEl.style.borderColor = 'rgba(239, 68, 68, 0.7)';
              topQuotaEl.style.background = 'rgba(239, 68, 68, 0.22)';
              
              const expTitle = isDateExpired
                ? `Masa aktif lisensi telah berakhir pada ${masaAktif}. Akun otomatis turun ke Lisensi Free • Sisa Kuota Hari Ini: ${sisa} dari 200 (Reset pukul 00:00)`
                : `Lisensi Free bersifat Expired (Tanpa Masa Aktif) • Sisa Kuota Entry Hari Ini: ${sisa} dari 200 (Reset pukul 00:00)`;
              topQuotaEl.title = expTitle;
            } else {
              // Basic atau Pro yang masih aktif
              const diffDays = Math.ceil((new Date(masaAktif).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
              let hariText = '';
              let badgeClass = 'topbar-user-quota-badge';
              let badgeTitle = '';

              if (diffDays === 0) {
                hariText = 'Hari Terakhir';
                badgeClass += ' quota-low';
                badgeTitle = `Masa aktif lisensi berakhir hari ini (${masaAktif})`;
              } else {
                hariText = `Sisa ${diffDays} Hari`;
                if (diffDays <= 7) badgeClass += ' quota-low';
                else if (diffDays <= 30) badgeClass += ' quota-warning';
                else badgeClass += ' quota-active';
                badgeTitle = `Masa aktif lisensi: ${diffDays} hari lagi (berlaku s.d ${masaAktif})`;
              }

              topQuotaVal.textContent = hariText;
              topQuotaEl.className = badgeClass;
              topQuotaEl.title = badgeTitle;
              topQuotaEl.style.color = '';
              topQuotaEl.style.borderColor = '';
              topQuotaEl.style.background = '';
            }
          }

          // SUPER ADMIN & PRO (yang belum expired): Buka SEMUA fitur tanpa gembok
          if (isSuperAdmin || (isPro && !isFree)) {
            document.querySelectorAll('.tab-nav__btn--locked').forEach(el => el.classList.remove('tab-nav__btn--locked'));
            document.querySelectorAll('.tab-nav__lock-badge').forEach(el => el.remove());
            if (typeof window.updateTabButtonsLockState === 'function') {
              window.updateTabButtonsLockState(false, 'PRO');
            }
          } else {
            // Free / Basic / Expired: Kunci fitur pro dengan gembok kuning terang
            if (typeof window.updateTabButtonsLockState === 'function') {
              window.updateTabButtonsLockState(true, isFree ? 'FREE' : 'BASIC');
            }
          }
        }
      }

      const topAvatar = document.getElementById('top-user-avatar');
      const topName = document.getElementById('top-user-name');
      const topRole = document.getElementById('top-user-role');
      const topInstansi = document.getElementById('top-user-instansi');

      if (topAvatar) topAvatar.textContent = avatar;
      if (topName) topName.textContent = name;
      if (topRole) topRole.textContent = role;
      if (topInstansi) topInstansi.textContent = instansi;

      // Juga sinkronkan ke hidden legacy elements agar popup.js tidak error
      const legName = document.getElementById('user-full-name');
      const legStatus = document.getElementById('user-status-active');
      const legInstansi = document.getElementById('user-instansi');
      const legAvatar = document.getElementById('user-avatar-initial');
      if (legName) legName.textContent = name;
      if (legStatus) legStatus.textContent = role;
      if (legInstansi) legInstansi.textContent = instansi;
      if (legAvatar) legAvatar.textContent = avatar;
    } catch (e) {
      console.warn('[ENCO App] syncTopbarUser error:', e);
    }
  }

  // Sinkronkan saat dom ready dan berkala
  syncTopbarUser();
  setTimeout(syncTopbarUser, 300);
  setTimeout(syncTopbarUser, 1500);

  // Expose global helper jika main.js mengirim sesi langsung
  window.setInitialUser = async function(user) {
    if (!user) return;
    console.log('[ENCO App] setInitialUser diterima dari Electron:', user.nama, '| Lisensi:', user.lisensi);

    // 1. Bersihkan seluruh data antrean sesi sebelumnya agar UI bot selalu bersih saat baru login
    try {
      if (window.chrome?.storage?.session?.clear) {
        await window.chrome.storage.session.clear();
      }
      if (window.chrome?.storage?.session?.set) {
        await window.chrome.storage.session.set({
          activeTab: 'pendaftaran',
          pelayananRunning: false,
          pendaftaranRunning: false
        });
      }
    } catch (e) {}

    // 2. Simpan profil user yang sedang login
    if (window.chrome?.storage?.local) {
      const isSuperAdmin = user.role === 'admin' || user.role === 'super_admin';
      const isLifetime = isSuperAdmin || user.isLifetime === true;
      const isPro = isLifetime || user.isPro === true || (user.lisensi || '').toUpperCase() === 'PRO';
      const isFree = !isPro && ((user.lisensi || '').toUpperCase() === 'FREE' || user.isFree === true);
      const isBasic = !isPro && !isFree;

      await window.chrome.storage.local.set({
        isLoggedIn: true,
        loggedUsername: user.username,
        loggedUser: {
          ...user,
          isPro,
          isBasic,
          isFree,
          isLifetime,
          maxDailyQuota: isFree ? 200 : null,
          lisensi: isLifetime ? 'Lifetime' : (isPro ? 'Pro' : (isFree ? 'Free' : 'Basic')),
          allowedTabs: isPro 
            ? ['pendaftaran', 'pelayanan-instan', 'konfirmasi-hadir', 'otomasi', 'bnba-umum', 'bnba-sekolah', 'tools', 'pengaturan']
            : ['pendaftaran', 'pelayanan-instan', 'pengaturan']
        },
        session: {
          accessToken: 'enco-desktop-' + Date.now(),
          user: {
            id: user.id || user.username,
            email: (user.username || 'petugas') + '@enco.cloud',
            user_metadata: {
              full_name: user.nama,
              role: user.role,
              instansi: user.instansi,
              statusAktif: user.statusAktif || 'aktif',
              masaAktif: isLifetime ? null : (user.masaAktif || null),
              isLifetime: isLifetime,
              isPro: isPro,
              isBasic: isBasic,
              isFree: isFree,
              maxDailyQuota: isFree ? 200 : null,
              lisensi: isLifetime ? 'Lifetime' : (isPro ? 'Pro' : (isFree ? 'Free' : 'Basic'))
            }
          }
        }
      });

      // Buka seluruh tombol tab jika Super Admin / Pro
      if (isSuperAdmin || isPro || isLifetime) {
        document.querySelectorAll('.tab-nav__btn--locked').forEach(el => el.classList.remove('tab-nav__btn--locked'));
        document.querySelectorAll('.tab-nav__lock-badge').forEach(el => el.remove());
        if (typeof window.updateTabButtonsLockState === 'function') {
          window.updateTabButtonsLockState(false, 'PRO');
        }
      } else {
        if (typeof window.updateTabButtonsLockState === 'function') {
          window.updateTabButtonsLockState(true, isFree ? 'FREE' : 'BASIC');
        }
      }

      syncTopbarUser();
    }
  };

})();
