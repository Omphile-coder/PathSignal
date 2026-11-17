@echo off
setlocal
cd /d "%~dp0phone"
set "EAS_NO_VCS=1"
set "EAS_PROJECT_ROOT=%CD%"
call npx.cmd --yes eas-cli@latest build --platform ios --profile development
pause
