@echo off
REM SPAR launcher for Windows
setlocal
chcp 65001 >nul 2>&1

set "SCRIPT_DIR=%~dp0"
set "FRONTEND_DIR=%SCRIPT_DIR%frontend"

if not exist "%SCRIPT_DIR%.venv\Scripts\python.exe" (
    echo.
    echo [ERROR] SPAR is not installed.
    echo.
    echo Please run install.bat first:
    echo   install.bat
    echo.
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\dist\index.js" (
    echo Building frontend...
    cd /d "%FRONTEND_DIR%"
    call npm run build
    cd /d "%SCRIPT_DIR%"
)

set "QUORUM_PYTHON=%SCRIPT_DIR%.venv\Scripts\python.exe"
set "QUORUM_SIGNAL_FILE=%TEMP%\spar-ready-%RANDOM%"

echo Starting SPAR...

node "%FRONTEND_DIR%\dist\index.js"

if errorlevel 1 (
    echo.
    echo [ERROR] SPAR exited with an error.
    pause
)

if exist "%QUORUM_SIGNAL_FILE%" del "%QUORUM_SIGNAL_FILE%"

endlocal
