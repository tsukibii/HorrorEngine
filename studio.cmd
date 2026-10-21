@echo off
rem The studio launcher: pick a tool from a list (tools\launch.py). From the project folder: .\studio
cd /d "%~dp0"
python tools\launch.py %*
