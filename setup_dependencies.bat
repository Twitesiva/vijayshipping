@echo off
title Vijay Shipping HRMS - Dependency Setup
color 0E

echo ==========================================================
echo           VIJAY SHIPPING HRMS SETUP SCRIPT
echo ==========================================================
echo.

echo [1/2] Installing Backend Dependencies (Python)...
cd backend
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install Python dependencies.
    pause
    exit /b
)
cd ..

echo.
echo [2/2] Installing Frontend Dependencies (Node.js)...
cd HR
npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install Node.js dependencies.
    pause
    exit /b
)
cd ..

echo.
echo ==========================================================
echo SUCCESS: All dependencies installed!
echo You can now run the project using "start_project.bat"
echo ==========================================================
echo.
pause
