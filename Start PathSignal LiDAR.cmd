@echo off
setlocal
cd /d "%~dp0phone"
call npm.cmd run start:lidar
pause
