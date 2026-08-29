@echo off
setlocal enabledelayedexpansion
title MediKiosk Live Development Server

echo ========================================================
echo   MediKiosk Live Development Platform
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Preparing database & seeding demo records...
cd "%~dp0backend"
python -m app.seed
cd "%~dp0"

echo.
echo [2/3] Opening browser at http://localhost:3000 ...
start http://localhost:3000

echo.
echo [3/3] Starting Live Hot-Reload Server (Backend + Frontend)...
echo.
echo ========================================================
echo   LIVE SERVER ACTIVE!
echo   * Changes to .tsx, .css, or .py files auto-update instantly.
echo   * You do NOT need to restart this launcher on code changes.
echo   * Press Ctrl+C in this window to stop the servers.
echo ========================================================
echo.

npm run dev
