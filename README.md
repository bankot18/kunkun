# ENCO Desktop (Aplikasi Sehat Indonesiaku Kiosk Browser)

Aplikasi desktop mandiri berbasis **Chromium Open-Source (Electron.js)** yang dirancang khusus untuk operasional **Sehat Indonesiaku (Kemenkes RI)** dengan integrasi penuh modul automasi **ENCO (Entry CKG Otomatis)**.

---

## ✨ Fitur Utama

1. **Akses Terkunci (Single-Site Browser / Kiosk)**:
   - Akses dibatasi secara ketat hanya untuk domain resmi Kemenkes (`sehatindonesiaku.kemkes.go.id`, `form.kemkes.go.id`) dan autentikasi resmi.
   - Semua upaya membuka alamat URL lain di luar whitelist akan diblokir otomatis.
   - Tidak ada address bar konvensional sehingga pengguna terfokus pada penginputan data.
2. **Integrasi Ekstensi ENCO Bawaan**:
   - Seluruh modul ekstensi (Sidebar ENCO, Interceptor API, automasi form, dsb.) otomatis dimuat ke dalam sesi Chromium aplikasi.
3. **Navigasi Cepat**:
   - Tombol shortcut Beranda Sehat Indonesiaku (`Ctrl + H`).
   - Refresh Halaman (`F5`).
   - Kembali / Maju (`Alt + Left` / `Alt + Right`).
   - Pengaturan zoom teks & tampilan layar penuh (`F11`).

---

## 🚀 Cara Menjalankan Aplikasi

### 1. Instalasi Dependensi (Hanya pertama kali)
Buka terminal/PowerShell di dalam folder `ENCO`, lalu jalankan:
```bash
cmd /c npm install
```

### 2. Jalankan Aplikasi
```bash
cmd /c npm start
```
*(Aplikasi akan langsung membuka jendela browser Chromium dan mengarah ke portal Sehat Indonesiaku bersama modul ENCO).*

---

## 📦 Cara Membuat File Installer / Executable (.exe)

Untuk membagikan aplikasi ini kepada petugas atau staf tanpa perlu menginstal Node.js di komputer mereka, Anda dapat mengemasnya menjadi file `.exe`:

1. Instal `electron-builder` jika belum terpasang:
   ```bash
   cmd /c npm install --save-dev electron-builder
   ```
2. Jalankan perintah build:
   ```bash
   cmd /c npm run build
   ```
3. File installer Windows (`.exe`) akan otomatis tercipta di dalam folder `ENCO/dist/`.

---

## 📁 Struktur Folder

```
ENCO/
├── assets/             # Ikon aplikasi desktop
├── extension/          # Paket ekstensi ENCO (manifest, scripts, popup, dsb.)
├── main.js             # Kode utama Chromium/Electron & Domain Locking Guard
├── package.json        # Konfigurasi dependensi & build
└── README.md           # Petunjuk penggunaan
```

---
*Dikembangkan oleh: Mochamad Fauzie, S.Gz*
