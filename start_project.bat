@echo off
title Vijay Shipping HRMS - Startup Script
color 0B

echo ==========================================================
echo           VIJAY SHIPPING HRMS STARTUP SCRIPT
echo ==========================================================
echo.
echo [System Check]
echo 1. Checking for .env file...
if not exist ".env" (
    echo [ERROR] .env file not found in root! 
    echo Please ensure the common .env file is present.
    pause
    exit /b
)
echo SUCCESS: .env file found.

echo.
echo [1/2] Launching FastAPI Backend...
echo Standardized Port: 8000
start cmd /k "cd backend && title HRMS Backend && echo Starting Backend Server... && python -m uvicorn main:app --reload --port 8000"

echo.
echo [2/2] Launching Vite Frontend...
start cmd /k "cd HR && title HRMS Frontend && echo Starting Development Server... && npm run dev"

echo.
echo ==========================================================
echo SERVICES ARE LAUNCHING...
echo.
echo Backend URL : http://localhost:8000
echo Frontend URL: http://localhost:5173 (Check terminal for exact port)
echo.
echo Standard Users:
echo - Founder: founder@vijayshipping.com / founder123
echo - Manager: manager@vijayshipping.com / manager123
echo - Employee: test@vijayshipping.com / test123
echo ==========================================================
echo.
echo Press any key to close this launcher (Services will stay running).
pause > nul
exit
