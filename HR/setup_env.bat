@echo off
REM Setup script to ensure HR app has correct environment variables
REM This script copies/creates the necessary .env file for the HR frontend

echo ==========================================================
echo HR Frontend Environment Setup
echo ==========================================================

REM Check if root .env exists
if not exist "..\.env" (
    echo [ERROR] Root .env file not found!
    echo Please ensure VijayShipping\.env exists with SUPABASE credentials.
    pause
    exit /b
)

echo Found root .env file

REM Check if HR .env already exists
if exist ".env" (
    echo [INFO] HR .env already exists
    goto :check_vars
)

REM Create .env for HR by copying from root (we'll add VITE_ prefix if needed)
echo [INFO] Creating HR .env from root configuration...

REM Copy root .env to HR .env
copy "..\.env" ".env" >nul

echo [SUCCESS] Created .env file in HR folder

:check_vars
echo.
echo Checking environment variables...

REM Check for VITE_ prefixed variables
findstr /C:"VITE_SUPABASE_URL" .env >nul
if %errorlevel% neq 0 (
    echo [WARNING] VITE_SUPABASE_URL not found. Adding it...
    echo. >> .env
    echo # Added by setup script >> .env
    REM Get the value from SUPABASE_URL if exists
    for /f "tokens=1,* delims==" %%a in ('findstr /i "SUPABASE_URL" "..\.env" 2^>nul') do (
        echo VITE_SUPABASE_URL=%%b >> .env
    )
)

findstr /C:"VITE_SUPABASE_ANON_KEY" .env >nul
if %errorlevel% neq 0 (
    echo [WARNING] VITE_SUPABASE_ANON_KEY not found. Adding it...
    for /f "tokens=1,* delims==" %%a in ('findstr /i "SUPABASE_ANON_KEY" "..\.env" 2^>nul') do (
        echo VITE_SUPABASE_ANON_KEY=%%b >> .env
    )
    for /f "tokens=1,* delims==" %%a in ('findstr /i "SUPABASE_SERVICE_ROLE_KEY" "..\.env" 2^>nul') do (
        echo VITE_SUPABASE_ANON_KEY=%%b >> .env
    )
)

REM Also add API URL
findstr /C:"VITE_API_BASE_URL" .env >nul
if %errorlevel% neq 0 (
    for /f "tokens=1,* delims==" %%a in ('findstr /i "API_BASE_URL" "..\.env" 2^>nul') do (
        echo VITE_API_BASE_URL=%%b >> .env
    )
)

REM Add Google Maps API Key
findstr /C:"VITE_GOOGLE_MAPS_API_KEY" .env >nul
if %errorlevel% neq 0 (
    for /f "tokens=1,* delims==" %%a in ('findstr /i "GOOGLE_MAPS_API_KEY" "..\.env" 2^>nul') do (
        echo VITE_GOOGLE_MAPS_API_KEY=%%b >> .env
    )
)

echo.
echo [SUCCESS] Environment setup complete!
echo.
echo Please restart your development servers:
echo 1. Close any running terminals
echo 2. Run: start_project.bat
echo.
pause
