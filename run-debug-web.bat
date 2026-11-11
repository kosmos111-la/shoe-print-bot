@echo off
rem ============================================
rem  Debug Web UI for shoe-print-bot
rem  Runs app.js with DEBUG_WEB=1 (port 3001)
rem  Stop: close this window or press Ctrl+C
rem ============================================
title Shoe-Print Bot - DEBUG WEB (http://localhost:3001)

rem cd to this file's own folder (no hardcoded path)
cd /d "%~dp0"

set DEBUG_WEB=1

echo.
echo   [OK] DEBUG_WEB=1 - starting debug web UI...
echo   [..] Open browser: http://localhost:3001
echo   [x]  To stop: close this window or press Ctrl+C
echo.

npm start

echo.
echo   [!] Server stopped (exit code %ERRORLEVEL%).
echo.
pause
