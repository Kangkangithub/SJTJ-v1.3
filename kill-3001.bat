@echo off
echo === Kill port 3001 ===
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    echo Killing PID %%a ...
    taskkill /F /PID %%a 2>nul
)
echo Done.