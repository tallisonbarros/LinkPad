@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\validate-work.ps1" -All -Bootstrap
exit /b %ERRORLEVEL%
