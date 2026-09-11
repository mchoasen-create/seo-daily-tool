@echo off
title Cai Dat Va Khoi Dong - SEO Daily Tool Cho Tris
cd /d "%~dp0"
echo ======================================================================
echo    TRIS SEO DAILY MASTER - KHOI TAO MAY MOI
echo ======================================================================
echo.
echo 1. Dang kiem tra va tu dong cai dat thu vien (chi mat 30 giay)...
call npm install
echo.
echo ======================================================================
echo    CAI DAT HOAN TAT! DANG KHOI DONG PHAN MEM...
echo    Dia chi web: http://localhost:3000
echo ======================================================================
start http://localhost:3000
node server.js
pause
