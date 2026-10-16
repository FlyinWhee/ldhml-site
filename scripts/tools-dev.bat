@echo off
rem Start the LDHML tools (admin area) on THIS computer: http://localhost:8787/admin/
rem Nothing is deployed and no email is sent: the database is local (tools\.wrangler),
rem and the sign-in code shows on the page and in this window. Stop with Ctrl+C.
rem Double-click it, or run scripts\tools-dev.bat from a terminal. Needs Node.
setlocal
cd /d "%~dp0.."
set CI=true
if not exist node_modules (
  echo Installing packages...
  call npm ci --no-audit --no-fund || goto :fail
)
if not exist tools\.dev.vars (
  echo Creating tools\.dev.vars ^(local secrets, never in git^)...
  node tools\scripts\dev-vars.mjs || goto :fail
)
echo.
set ADMIN=
set /p ADMIN=Your email for a LOCAL admin account (press Enter to skip):
call npm run build >nul || goto :fail
call npx wrangler@4.151.1 d1 migrations apply ldhml-tools --local -c tools\wrangler.jsonc >nul || goto :fail
if not "%ADMIN%"=="" (
  call node tools\scripts\add-admin.mjs %ADMIN% "Admin" >nul || goto :fail
  echo Local admin ready: %ADMIN%
)
echo.
echo Opening http://localhost:8787/admin/ in a few seconds. Stop with Ctrl+C.
start "" cmd /c "timeout /t 8 >nul & start http://localhost:8787/admin/"
rem A fixed port: if another copy already runs, this stops with "address in use" instead of using a random port.
call npx wrangler@4.151.1 dev -c tools\wrangler.jsonc --port 8787
goto :eof
:fail
echo.
echo Something went wrong. Read the message above.
pause
exit /b 1
