@echo off
rem The studio launcher: pick a tool from a list (tools\launch.py). From the project folder: .\studio
rem Uses the project's uv environment (.venv) when there is one, else the Python on the PATH.
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (".venv\Scripts\python.exe" tools\launch.py %*) else (python tools\launch.py %*)
