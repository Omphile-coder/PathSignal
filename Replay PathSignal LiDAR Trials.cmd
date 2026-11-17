@echo off
setlocal
cd /d "%~dp0phone"
if "%~1"=="" (
  echo Drag your exported pathsignal-lidar-trials.json onto this launcher.
  pause
  exit /b 1
)
node replay-lidar.cjs "%~1"
pause
