@echo off
setlocal enabledelayedexpansion
title MediKiosk Full-Stack Launcher

echo ========================================================
echo Starting MediKiosk Clinical Intake Platform
echo ========================================================

cd /d "%~dp0"

echo [1/3] Starting Backend API (Port 8000)...
start "MediKiosk Backend (Port 8000)" powershell -NoExit -Command "cd '%~dp0backend'; python -m app.seed; python -m uvicorn app.main:app --reload --port 8000"

timeout /t 3 /nobreak >nul

echo [2/3] Starting Frontend Web App (Port 3000)...
start "MediKiosk Frontend (Port 3000)" powershell -NoExit -Command "cd '%~dp0frontend'; npm run dev"

timeout /t 4 /nobreak >nul

echo [3/3] Opening browser...
start http://localhost:3000

echo.
echo ========================================================
echo MediKiosk is running!
echo - Patient Portal: http://localhost:3000/patient
echo - Doctor Portal:  http://localhost:3000/doctor
echo - Admin Portal:   http://localhost:3000/admin
echo ========================================================
