@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Montazhopa 3 - Install
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0INSTALL_WINDOWS.ps1"
if errorlevel 1 echo Installation failed. The previous panel should remain available.
pause
