@echo off
rem Refresh the data cache from this computer (residential IP: NBHPA blocks data-center IPs).
rem Pulls main, fetches every league now, then commits and pushes data\ if it changed.
rem Double-click it, or run scripts\refresh.bat from a terminal. Needs git and Node.
setlocal
set EXITCODE=0
cd /d "%~dp0.."

echo Updating main...
git pull --rebase --autostash -q origin main || goto :fail

if not exist node_modules (
  echo Installing dependencies...
  call npm ci --no-audit --no-fund || goto :fail
)

node scraper/fetch.mjs --force || goto :fail

git add data registry || goto :fail
git diff --cached --quiet -- data registry
if not errorlevel 1 (
  echo No change in data. Nothing to push.
  goto :done
)

git commit -q -m "Refresh data cache" -- data registry || goto :fail
git push -q origin HEAD:main || goto :fail
echo Pushed. GitHub Pages deploys from the push.
goto :done

:fail
echo.
echo Refresh FAILED. Nothing was pushed. See the messages above.
set EXITCODE=1

:done
rem Keep the window open when double-clicked.
echo %cmdcmdline% | find /i "%~nx0" >nul && pause
exit /b %EXITCODE%
