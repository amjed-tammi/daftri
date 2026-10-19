@echo off
rem Daftari - double click to install as an app (desktop + start menu icon)
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0tools\install.ps1"
