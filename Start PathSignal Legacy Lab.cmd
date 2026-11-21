@echo off
setlocal
title PathSignal - Legacy Replay Lab
cd /d "%~dp0"
where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo Install Node.js to run PathSignal.
  pause
  exit /b 1
)
if not exist node_modules\.bin\vite.cmd (
  call npm.cmd ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Opening the original replay and trial research lab.
echo For the current retro app, use Start PathSignal.cmd instead.
call npm.cmd run dev -- --open
pause
