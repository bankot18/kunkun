@echo off
title ENCO Desktop - Sehat Indonesiaku
cd /d "%~dp0"
echo ========================================================
echo   ENCO (Entry CKG Otomatis) - Sehat Indonesiaku
echo   Dedicated Chromium Browser
echo ========================================================
echo Sedang membuka aplikasi...

where electron >nul 2>nul
if %errorlevel% equ 0 (
    start "" electron .
) else (
    start "" npx electron .
)
