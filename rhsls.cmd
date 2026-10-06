@echo off
REM ===========================================================================
REM  rhsls - Rushless Exam CLI (Windows wrapper)
REM  Menjalankan:  rhsls <perintah> [opsi]
REM
REM  Agar bisa dipanggil dari mana saja:
REM    1. Tambahkan folder project ini ke PATH, atau
REM    2. Buat salinan file ini di C:\Windows\System32\ (atau folder di PATH),
REM       atau
REM    3. Jalankan `npm link` sekali lalu panggil `rhsls` dari mana saja.
REM ===========================================================================
setlocal

REM racine folder project: dua tingkat ke atas dari folder scripts\
set "RHSLS_DIR=%~dp0.."

REM kalau file ini disalin ke folder lain, cari project lewat lokasi default
if not exist "%RHSLS_DIR%\scripts\rhsls.js" (
    if exist "D:\Project\Visual studio\Rushless Exam\rushless-exam\scripts\rhsls.js" (
        set "RHSLS_DIR=D:\Project\Visual studio\Rushless Exam\rushless-exam"
    )
)

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js tidak ditemukan di PATH. Instal Node.js terlebih dahulu.
    exit /b 1
)

node "%RHSLS_DIR%\scripts\rhsls.js" %*
exit /b %ERRORLEVEL%