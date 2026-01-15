@echo off
setlocal

set PORT=5050
if not "%~1"=="" set PORT=%~1

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start.ps1" -Port %PORT%
