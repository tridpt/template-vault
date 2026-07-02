@echo off
rem Runs the Template Vault server. Called by start-template-vault.vbs (hidden)
rem or can be run directly to see the console window.
cd /d "%~dp0.."
if not exist logs mkdir logs

rem Prefer node on PATH; fall back to the default install location.
where node >nul 2>nul
if %errorlevel%==0 (
  set "NODE_EXE=node"
) else (
  set "NODE_EXE=C:\Program Files\nodejs\node.exe"
)

"%NODE_EXE%" src\index.js >> logs\server.out.log 2>> logs\server.err.log
