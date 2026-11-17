@echo off
setlocal
cd /d "%~dp0phone"
if not exist node_modules\.bin\expo.cmd (
  call npm.cmd ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm.cmd start
pause
