@echo off
setlocal
set "scan=%~1"
if not defined scan (
  echo Extract your Stray Scanner ZIP, then drag the folder containing odometry.csv onto this launcher.
  pause
  exit /b 1
)
cd /d "%~dp0depth-lab"
if not exist .venv\Scripts\python.exe (
  python -m venv .venv
  if errorlevel 1 goto failed
)
.venv\Scripts\python.exe -c "import imageio_ffmpeg, numpy, PIL" >nul 2>&1
if errorlevel 1 (
  .venv\Scripts\python.exe -m pip install "imageio-ffmpeg==0.8.1" numpy Pillow
  if errorlevel 1 goto failed
)
.venv\Scripts\python.exe import_stray.py "%scan%"
:failed
pause
