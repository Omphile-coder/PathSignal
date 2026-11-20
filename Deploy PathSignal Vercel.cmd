@echo off
setlocal
cd /d "%~dp0presentation-site"
call npx.cmd --yes vercel@latest deploy --scope pixels7 --project pathsignal --prod --yes --archive=tgz
if errorlevel 1 (
  echo Deployment failed. Review the message above.
  pause
  exit /b 1
)
echo Vercel deployment finished. Use the production link printed above.
pause
