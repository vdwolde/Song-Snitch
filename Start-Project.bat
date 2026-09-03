@echo off
setlocal enableextensions
cd /d "%~dp0"
title Song Snitch

set "PORT=5178"
set "URL=http://127.0.0.1:%PORT%"
set "TOTAL=3"

echo ============================================================
echo   Song Snitch
echo ============================================================
echo.

rem ------------------------------------------------------------
rem  Step 1: Node.js must be present (>= 22.5, for built-in node:sqlite)
rem ------------------------------------------------------------
echo Step 1 of %TOTAL%: Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo Node.js was not found on PATH. Install Node 22+ from https://nodejs.org
    echo then run this file again.
    pause
    exit /b 1
)
for /f "delims=" %%v in ('node --version') do echo [ok] Using Node %%v
echo.

rem ------------------------------------------------------------
rem  Step 2: install dependencies (first run / when package.json changed)
rem ------------------------------------------------------------
echo Step 2 of %TOTAL%: Getting the app's building blocks ready...
if not exist "node_modules" (
    call npm install
    if errorlevel 1 goto :fail
) else (
    powershell -NoProfile -Command "$p=Get-Item 'package.json'; $s=Get-Item 'node_modules' -ErrorAction SilentlyContinue; if($s -and $s.LastWriteTime -ge $p.LastWriteTime){exit 0}else{exit 1}"
    if errorlevel 1 (
        call npm install
        if errorlevel 1 goto :fail
    )
)
echo.

rem ------------------------------------------------------------
rem  Step 3: single instance check, build, serve
rem ------------------------------------------------------------
echo Step 3 of %TOTAL%: Starting Song Snitch...
powershell -NoProfile -Command "try{ if((Invoke-WebRequest -UseBasicParsing '%URL%/api/health' -TimeoutSec 2).StatusCode -eq 200){exit 0} }catch{}; exit 1"
if not errorlevel 1 (
    echo Song Snitch is already running - opening the browser.
    start "" "%URL%"
    exit /b 0
)

call npm run build
if errorlevel 1 goto :fail

set "OPEN_BROWSER=1"
call npm run serve

exit /b 0

:fail
echo.
echo Setup failed. See the error above.
pause
exit /b 1
