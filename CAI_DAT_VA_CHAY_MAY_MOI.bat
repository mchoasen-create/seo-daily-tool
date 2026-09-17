@echo off
title TRIS SEO DAILY MASTER - MAY MOI 24/7
cd /d "%~dp0"
color 0b
echo ======================================================================
echo           TRIS SEO DAILY MASTER - KHOI TAO MAY MOI 24/7
echo ======================================================================
echo.

node -v >nul 2>nul
if %errorlevel% neq 0 goto :NO_NODE

echo [OK] Da tim thay Node.js tren may!
echo.
echo 1. Dang kiem tra thu vien phan mem...
call npm install
echo.
echo ======================================================================
echo    CAI DAT HOAN TAT! DANG KHOI DONG PHAN MEM CHAY 24/7...
echo    Dia chi web: http://localhost:3000
echo ======================================================================
echo.
ping 127.0.0.1 -n 3 >nul
start http://localhost:3000
node server.js
echo.
echo Phan mem da dung lai.
pause
exit /b

:NO_NODE
color 0c
echo ======================================================================
echo [CANH BAO] May tinh nay chua cai dat Node.js!
echo ======================================================================
echo.
echo Vui long tai va cai dat Node.js ban LTS mien phi tai:
echo https://nodejs.org
echo.
echo Dang tu dong mo trinh duyet de anh tai Node.js...
start https://nodejs.org
echo.
echo Sau khi cai dat Node.js xong, anh hay bam lai file nay de chay nhe!
echo.
pause
exit /b
