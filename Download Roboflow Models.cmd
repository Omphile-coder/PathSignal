@echo off
setlocal
title PathSignal - Download Roboflow Models
"%~dp0depth-lab\.venv\Scripts\python.exe" "%~dp0model-comparison\download_models.py"
echo.
echo Downloads and reports are in PathSignal\model-comparison.
echo The existing app has not been changed by this download.
pause
endlocal
