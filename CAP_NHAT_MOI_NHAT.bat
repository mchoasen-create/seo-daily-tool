@echo off
title DONG BO VA CAP NHAT CODE MOI 24/7 CHO TRIS
color 0A
cd /d "%~dp0"
echo ======================================================================
echo       DANG TU DONG CAP NHAT CODE MOI NHAT TU GITHUB CHO ANH
echo ======================================================================
echo.

echo 1. Dang keo ban cap nhat moi nhat ve may...
git pull origin main

echo.
echo 2. Kiem tra thu vien phan mem...
call npm install --no-audit --no-fund

echo.
echo ======================================================================
echo   DA CAP NHAT XONG! DANG KHOI DONG SERVER 24/7 VA MO TRINH DUYET...
echo ======================================================================
echo.

ping 127.0.0.1 -n 3 >nul
start http://localhost:3000
node server.js

pause
