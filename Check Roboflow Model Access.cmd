@echo off
setlocal
title PathSignal - Check Roboflow Model Access
"%~dp0depth-lab\.venv\Scripts\python.exe" "%~dp0model-comparison\check_access.py"
echo.
echo Keep your API key private. Only the access report is saved.
pause
endlocal
