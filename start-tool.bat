@echo off
title SEO Daily Tool - Tris Master Engine
cd /d "%~dp0"
echo ======================================================================
echo    TRIS SEO DAILY MASTER - KHOI DONG HE THONG TU DONG HOA
echo    Web App dang chay tai dia chi: http://localhost:3000
echo ======================================================================
echo Dang khoi chay server...
start http://localhost:3000
node server.js
pause
