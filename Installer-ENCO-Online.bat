@echo off
setlocal enabledelayedexpansion
title ENCO - Installer Online Client
chcp 65001 >nul

:: Banner
cls
echo =======================================================================
echo              ENCO (Entry CKG Otomatis) - Sehat Indonesiaku
echo                     OFFICIAL CLIENT ONLINE INSTALLER
echo               Sumber Data: https://github.com/bankot18/kunkun
echo =======================================================================
echo.

:: 1. Tentukan Lokasi Instalasi
set "DEFAULT_DIR=%LOCALAPPDATA%\ENCO"
echo Lokasi instalasi default: %DEFAULT_DIR%
echo Tekan ENTER untuk menggunakan lokasi default, atau ketik lokasi folder lain:
set /p "INSTALL_DIR=> "
if "%INSTALL_DIR%"=="" set "INSTALL_DIR=%DEFAULT_DIR%"

echo.
echo [*] Memasang aplikasi ke: %INSTALL_DIR%
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: 2. Jalankan PowerShell untuk mengunduh semua berkas dari GitHub
echo [*] Menghubungkan ke GitHub dan mengunduh berkas aplikasi...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop'; ^
   [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; ^
   $targetDir = '%INSTALL_DIR%'; ^
   $manifestUrl = 'https://raw.githubusercontent.com/bankot18/kunkun/main/manifest.json?t=' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds(); ^
   $rawBase = 'https://raw.githubusercontent.com/bankot18/kunkun/main'; ^
   Write-Host '==> Memeriksa koneksi server...' -ForegroundColor Cyan; ^
   $wc = New-Object System.Net.WebClient; ^
   $wc.Encoding = [System.Text.Encoding]::UTF8; ^
   try { ^
     $manifestJson = $wc.DownloadString($manifestUrl); ^
   } catch { ^
     Write-Host 'Gagal mengunduh manifest.json dari GitHub.' -ForegroundColor Red; ^
     Write-Host 'Pastikan komputer terhubung internet dan repositori GitHub telah diisi.' -ForegroundColor Yellow; ^
     exit 1; ^
   } ^
   $manifest = $manifestJson | ConvertFrom-Json; ^
   $files = $manifest.files.PSObject.Properties; ^
   $total = $files.Count; ^
   $current = 0; ^
   Write-Host ('==> Ditemukan ' + $total + ' berkas untuk diinstal...') -ForegroundColor Green; ^
   foreach ($prop in $files) { ^
     $current++; ^
     $relPath = $prop.Name; ^
     $dest = Join-Path $targetDir $relPath; ^
     $destDir = Split-Path $dest; ^
     if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }; ^
     $fileUrl = $rawBase + '/' + [Uri]::EscapeUriString($relPath) + '?t=' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds(); ^
     $percent = [math]::Round(($current / $total) * 100); ^
     Write-Host ('[' + $percent + '%%] (' + $current + '/' + $total + ') Mengunduh ' + [System.IO.Path]::GetFileName($relPath) + '...') -ForegroundColor Gray; ^
     try { ^
       $wc.DownloadFile($fileUrl, $dest); ^
     } catch { ^
       Write-Host ('Peringatan: Gagal unduh ' + $relPath) -ForegroundColor Yellow; ^
     } ^
   }; ^
   Set-Content -Path (Join-Path $targetDir 'manifest.json') -Value $manifestJson -Encoding UTF8; ^
   Write-Host '==> Berkas aplikasi berhasil diunduh.' -ForegroundColor Green;"

if %errorlevel% neq 0 (
  echo.
  echo [!] Terjadi kesalahan saat mengunduh berkas dari GitHub.
  echo Pastikan repositori https://github.com/bankot18/kunkun sudah di-upload.
  pause
  exit /b 1
)

:: 3. Buat default config.json jika belum ada
if not exist "%INSTALL_DIR%\config.json" (
  echo [*] Membuat konfigurasi awal config.json...
  (
    echo {
    echo   "cloudflare": {
    echo     "accountId": "11ee11ecfb053d14f27892e9128844a2",
    echo     "databaseId": "8815a9d2-4d81-4340-8415-8992229f3c07",
    echo     "databaseName": "enco_db",
    echo     "apiToken": ""
    echo   }
    echo }
  ) > "%INSTALL_DIR%\config.json"
)

:: 4. Periksa Lingkungan Runtime (Node.js / Electron)
echo.
echo [*] Memeriksa runtime Node.js dan Electron...
where electron >nul 2>nul
if %errorlevel% equ 0 (
  echo [OK] Electron global ditemukan.
) else (
  where npm >nul 2>nul
  if %errorlevel% equ 0 (
    echo [*] Memasang dependensi Electron lokal via npm...
    pushd "%INSTALL_DIR%"
    call npm install --silent
    popd
  ) else (
    echo [!] Node.js / Electron belum terpasang di komputer ini.
    echo [*] Mengunduh dan memasang Node.js LTS otomatis...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$nodeUrl = 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi'; ^
       $msiPath = Join-Path $env:TEMP 'node-setup.msi'; ^
       Write-Host 'Mengunduh Node.js installer...' -ForegroundColor Cyan; ^
       (New-Object System.Net.WebClient).DownloadFile($nodeUrl, $msiPath); ^
       Write-Host 'Memasang Node.js ke sistem...' -ForegroundColor Cyan; ^
       Start-Process msiexec.exe -ArgumentList ('/i', $msiPath, '/qn') -Wait; ^
       Remove-Item $msiPath -Force -ErrorAction SilentlyContinue; ^
       Write-Host 'Node.js berhasil terpasang!' -ForegroundColor Green;"
    pushd "%INSTALL_DIR%"
    call npm install --silent
    popd
  )
)

:: 5. Buat Shortcut di Desktop
echo [*] Membuat pintasan (shortcut) di Desktop...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$targetDir = '%INSTALL_DIR%'; ^
   $desktop = [Environment]::GetFolderPath('Desktop'); ^
   $shortcutPath = Join-Path $desktop 'ENCO Desktop - Sehat Indonesiaku.lnk'; ^
   $wsh = New-Object -ComObject WScript.Shell; ^
   $shortcut = $wsh.CreateShortcut($shortcutPath); ^
   $exePath = Join-Path $targetDir 'ENCO.exe'; ^
   $batPath = Join-Path $targetDir 'Jalankan-ENCO.bat'; ^
   if (Test-Path $exePath) { ^
     $shortcut.TargetPath = $exePath; ^
   } else { ^
     $shortcut.TargetPath = $batPath; ^
   }; ^
   $shortcut.WorkingDirectory = $targetDir; ^
   $icoPath = Join-Path $targetDir 'assets\enco.ico'; ^
   if (-not (Test-Path $icoPath)) { $icoPath = Join-Path $targetDir 'assets\icon.ico' }; ^
   if (Test-Path $icoPath) { $shortcut.IconLocation = $icoPath }; ^
   $shortcut.Description = 'ENCO Desktop (Entry CKG Otomatis) - Sehat Indonesiaku'; ^
   $shortcut.Save(); ^
   Write-Host 'Pintasan berhasil dibuat di Desktop.' -ForegroundColor Green;"

:: 6. Selesai
cls
echo =======================================================================
echo 🎉 INSTALASI ONLINE BERHASIL!
echo =======================================================================
echo.
echo Aplikasi ENCO Desktop telah terpasang dengan sukses di:
echo %INSTALL_DIR%
echo.
echo Pintasan aplikasi telah dibuat di Desktop Anda:
echo [ENCO Desktop - Sehat Indonesiaku]
echo =======================================================================
echo.
set /p "RUN_NOW=Apakah Anda ingin membuka aplikasi ENCO sekarang? (Y/T): "
if /i "%RUN_NOW%"=="Y" (
  echo Membuka ENCO...
  pushd "%INSTALL_DIR%"
  if exist "ENCO.exe" (
    start "" "ENCO.exe"
  ) else (
    start "" "Jalankan-ENCO.bat"
  )
  popd
)

exit /b 0
