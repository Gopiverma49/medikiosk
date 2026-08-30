@echo off
setlocal enabledelayedexpansion
title MediKiosk Full-Stack Suite (Laptop + Mobile Ready)

echo ========================================================
echo   MediKiosk Live Platform (Laptop + Mobile Ready)
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Preparing database & seeding records...
cd "%~dp0backend"
python -m app.seed
cd "%~dp0"

echo.
echo [2/3] Opening local laptop browser at http://localhost:3000 ...
start http://localhost:3000

echo.
echo [3/3] Starting Backend, Frontend, and Mobile HTTPS Tunnel...
echo.
echo ========================================================
echo   SERVER ACTIVE!
echo   * Laptop access: http://localhost:3000
echo   * Mobile HTTPS:  Look for the 'https://*.trycloudflare.com' URL below
echo   * Press Ctrl+C in this window to stop.
echo ========================================================
echo.

npm run dev:all

