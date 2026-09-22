@echo off
setlocal EnableExtensions
title Artboard Resizer Uninstaller

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$destination=Join-Path $env:APPDATA 'Adobe\CEP\extensions\com.eduardonoe.artboardresizer';" ^
  "if(Test-Path $destination){$backup=$destination+'.removed-'+(Get-Date -Format 'yyyyMMddHHmmss'); Move-Item -LiteralPath $destination -Destination $backup -Force; Write-Host ('Removed to: ' + $backup)} else {Write-Host 'Artboard Resizer is not installed for this user.'};"

if not "%errorlevel%"=="0" (
    echo.
    echo Uninstallation failed.
    pause
    exit /b 1
)

echo.
echo Restart Adobe Illustrator to finish.
pause
exit /b 0
