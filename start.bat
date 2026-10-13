@echo off
chcp 65001 >nul
title ShennongAI Launcher
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Node.js not found. Please install Node.js 18+ from https://nodejs.org
  echo.
  pause
  exit /b 1
)
node "%~dp0start.js"
echo.
pause