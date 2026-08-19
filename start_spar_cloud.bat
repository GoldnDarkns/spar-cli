@echo off
chcp 65001 >nul 2>&1
setlocal
cd /d "%~dp0"

echo.
echo ========================================
echo  SPAR Cloud Hybrid Test
echo  Granite offline + 5 cloud APIs
echo ========================================
echo.

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Run install.bat first.
    pause
    exit /b 1
)

echo [1/3] Checking Ollama...
ollama list 2>nul
if errorlevel 1 (
    echo Starting Ollama in background...
    start "" /B ollama serve
    timeout /t 5 /nobreak >nul
)

echo.
echo [2/3] Validating API models (5 agents + moderator)...
.venv\Scripts\python.exe examples\spar_cloud_brief_test.py --validate-preset multi-provider-free
echo.
echo Note: Moderator rate-limits on OpenRouter free tier are normal.
echo       Round 1 brief test uses the 5 domain agents only.
echo.
echo [3/3] Running SPAR Layer 0 + Round 1 cloud brief test...
.venv\Scripts\python.exe examples\spar_cloud_brief_test.py --preset multi-provider-free

echo.
echo Done. Check research\spar_outputs\cloud_brief_* for results.
echo.
pause
