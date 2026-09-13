/**
 * ENCO Auto-Updater Diferensial (GitHub Raw)
 * Repositori: https://github.com/bankot18/kunkun
 * Membandingkan SHA-256 file lokal dengan manifest.json di GitHub.
 * Hanya mengunduh file yang mengalami perubahan (hot-update).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_DIR = __dirname;
const GITHUB_REPO = 'bankot18/kunkun';
const GITHUB_BRANCH = 'main';
const MANIFEST_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/manifest.json`;
const RAW_BASE_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}`;

// File yang tidak boleh ditimpa agar konfigurasi pengguna tetap aman
const PROTECTED_FILES = [
  'config.json',
  'enco-auth-session.json',
  'generate-manifest.js',
  'manifest.json',
  'ENCO.exe'
];

function calculateSha256(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (e) {
    return null;
  }
}

/**
 * Fetch dengan timeout menggunakan AbortController bawaan Node.js
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 4000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Memeriksa dan menerapkan pembaruan file secara diferensial
 * @param {Function} onStatus Callback status: (message, progressPercent) => void
 */
async function checkAndApplyUpdates(onStatus = () => {}) {
  try {
    onStatus('Menghubungkan ke server pembaruan GitHub...', 15);

    // 1. Ambil manifest.json dari GitHub dengan cache buster (?t=timestamp)
    let manifestResponse;
    try {
      manifestResponse = await fetchWithTimeout(`${MANIFEST_URL}?t=${Date.now()}`, {}, 4000);
    } catch (netErr) {
      console.warn('[ENCO Updater] Gagal mengambil manifest:', netErr.message);
      onStatus('Pengecekan selesai (Mode Offline / Melewati)...', 100);
      return { success: false, reason: 'network_timeout_or_offline' };
    }

    if (!manifestResponse.ok) {
      console.warn(`[ENCO Updater] Manifest tidak ditemukan di GitHub (HTTP ${manifestResponse.status}).`);
      onStatus('Menyiapkan aplikasi...', 100);
      return { success: false, reason: 'manifest_not_found_on_github' };
    }

    const remoteManifest = await manifestResponse.json().catch(() => null);
    if (!remoteManifest || !remoteManifest.files || typeof remoteManifest.files !== 'object') {
      console.warn('[ENCO Updater] Format manifest.json tidak valid.');
      onStatus('Menyiapkan aplikasi...', 100);
      return { success: false, reason: 'invalid_manifest' };
    }

    onStatus(`Memeriksa integritas file (${remoteManifest.version || 'v1.0'})...`, 30);

    const remoteFiles = remoteManifest.files;
    const filesToUpdate = [];

    // 2. Bandingkan SHA-256 tiap file lokal dengan file di manifest
    for (const [relPath, fileInfo] of Object.entries(remoteFiles)) {
      const normalizedRelPath = relPath.replace(/\\/g, '/');

      // Lewati file yang dilindungi
      if (PROTECTED_FILES.includes(normalizedRelPath)) {
        continue;
      }

      const localFilePath = path.join(BASE_DIR, normalizedRelPath);
      const localHash = calculateSha256(localFilePath);

      // Jika file lokal belum ada atau hash-nya berbeda, masukkan ke antrean update
      if (!localHash || localHash.toLowerCase() !== (fileInfo.hash || '').toLowerCase()) {
        filesToUpdate.push({
          relPath: normalizedRelPath,
          size: fileInfo.size || 0
        });
      }
    }

    // 3. Jika tidak ada file yang perlu diperbarui
    if (filesToUpdate.length === 0) {
      console.log('[ENCO Updater] Semua file sudah sesuai dengan versi terbaru.');
      onStatus('Aplikasi sudah dalam versi terbaru!', 100);
      await new Promise(r => setTimeout(r, 600));
      return { success: true, updatedCount: 0 };
    }

    console.log(`[ENCO Updater] Ditemukan ${filesToUpdate.length} file yang perlu diperbarui.`);
    onStatus(`Mengunduh pembaruan (${filesToUpdate.length} file)...`, 40);

    // 4. Unduh dan timpa hanya file yang berubah
    let updatedCount = 0;
    const totalFiles = filesToUpdate.length;

    for (let i = 0; i < totalFiles; i++) {
      const item = filesToUpdate[i];
      const percent = Math.min(95, 40 + Math.round(((i + 1) / totalFiles) * 55));
      const displayName = path.basename(item.relPath);

      onStatus(`Mengunduh ${displayName} (${i + 1}/${totalFiles})...`, percent);

      try {
        const fileUrl = `${RAW_BASE_URL}/${encodeURI(item.relPath)}?t=${Date.now()}`;
        const fileRes = await fetchWithTimeout(fileUrl, {}, 10000);

        if (fileRes.ok) {
          const arrayBuffer = await fileRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const targetPath = path.join(BASE_DIR, item.relPath);

          // Pastikan folder tujuan ada
          const dir = path.dirname(targetPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          fs.writeFileSync(targetPath, buffer);
          updatedCount++;
          console.log(`[ENCO Updater] Berhasil memperbarui: ${item.relPath}`);
        } else {
          console.warn(`[ENCO Updater] Gagal unduh ${item.relPath}: HTTP ${fileRes.status}`);
        }
      } catch (dlErr) {
        console.warn(`[ENCO Updater] Error saat mengunduh ${item.relPath}:`, dlErr.message);
      }
    }

    onStatus(`Pembaruan selesai (${updatedCount} file diperbarui)!`, 100);
    await new Promise(r => setTimeout(r, 700));

    return {
      success: true,
      updatedCount: updatedCount,
      version: remoteManifest.version
    };

  } catch (err) {
    console.error('[ENCO Updater] Terjadi kesalahan tak terduga:', err);
    onStatus('Menyiapkan aplikasi...', 100);
    return { success: false, error: err.message };
  }
}

module.exports = {
  checkAndApplyUpdates,
  calculateSha256
};
