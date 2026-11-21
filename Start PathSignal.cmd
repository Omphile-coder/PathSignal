@echo off
setlocal
title PathSignal - Retro App
cd /d "%~dp0presentation-site"
where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo Install Node.js to run PathSignal.
  pause
  exit /b 1
)
if not exist node_modules\.bin\esbuild.cmd (
  call npm.cmd ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Building the current retro PathSignal app...
call npm.cmd run build
if errorlevel 1 (
  echo The build failed. Keep this window open to review the error above.
  pause
  exit /b 1
)
echo Keep this window open while using PathSignal.
if "%~1"=="--no-open" (
  node scripts\serve.mjs
) else (
  node scripts\serve.mjs --open
)
pause
