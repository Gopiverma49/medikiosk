@echo off
setlocal enabledelayedexpansion
title MediKiosk Full-Stack Suite (Laptop + Mobile Ready)

echo ========================================================
echo   MediKiosk Live Platform (Laptop + Mobile Ready)
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/4] Freeing ports 3000 and 8000 if occupied...
call npx --yes kill-port 3000 8000 >nul 2>&1

echo.
echo [2/4] Preparing database & seeding records...
cd "%~dp0backend"
python -m app.seed
cd "%~dp0"

echo.
echo [3/4] Opening local laptop browser at http://localhost:3000 ...
start http://localhost:3000

echo.
echo [4/4] Starting Backend, Frontend, and Mobile HTTPS Tunnel...
echo.
echo ========================================================
echo   SERVER ACTIVE!
echo   * Laptop access: http://localhost:3000
echo   * Mobile Access: Scan Local Wi-Fi or Public HTTPS Tunnel QR codes below
echo   * Press Ctrl+C in this window to stop.
echo ========================================================
echo.

npm run dev:all

