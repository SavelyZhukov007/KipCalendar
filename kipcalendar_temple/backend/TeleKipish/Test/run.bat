# ============================================================================
# run.bat - Скрипт запуска для Windows
# ============================================================================
@echo off
echo Starting TeleKipish Bot...

REM Проверка .NET
where dotnet >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo .NET 8.0 SDK not found!
    echo Please install from: https://dotnet.microsoft.com/download
    exit /b 1
)

REM Проверка токена
if "%TELEGRAM_BOT_TOKEN%"=="" (
    echo TELEGRAM_BOT_TOKEN not set!
    echo Please set it with: set TELEGRAM_BOT_TOKEN=your_token_here
    exit /b 1
)

REM Проверка API
echo Checking API connection...
curl -s http://localhost:5000/health >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo API not responding on http://localhost:5000
    echo Please start the Python API first
    exit /b 1
)

echo API is running

REM Сборка и запуск
echo Building project...
dotnet build

if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    exit /b 1
)

echo Starting bot...
dotnet run
