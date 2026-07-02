@echo off
rem Stops the Template Vault server by killing whatever listens on its port.
rem Change PORT here if you run the server on a non-default port.
set PORT=4000

set FOUND=0
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
  echo Stopping process PID %%p on port %PORT%...
  taskkill /PID %%p /F >nul 2>nul
  set FOUND=1
)

if "%FOUND%"=="0" (
  echo No server found listening on port %PORT%.
) else (
  echo Template Vault stopped.
)
