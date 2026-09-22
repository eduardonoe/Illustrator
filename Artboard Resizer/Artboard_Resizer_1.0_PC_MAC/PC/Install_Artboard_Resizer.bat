@echo off
setlocal EnableExtensions
title Artboard Resizer Installer

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$source=Join-Path ([System.IO.Path]::GetFullPath('%~dp0')) 'Artboard_Resizer';" ^
  "$extensions=Join-Path $env:APPDATA 'Adobe\CEP\extensions';" ^
  "$destination=Join-Path $extensions 'com.eduardonoe.artboardresizer';" ^
  "if(!(Test-Path $source)){throw 'The Artboard_Resizer folder is missing. Extract the complete ZIP before running this installer.'};" ^
  "New-Item -ItemType Directory -Path $extensions -Force | Out-Null;" ^
  "if(Test-Path $destination){$backup=$destination+'.backup-'+(Get-Date -Format 'yyyyMMddHHmmss'); Move-Item -LiteralPath $destination -Destination $backup -Force};" ^
  "New-Item -ItemType Directory -Path $destination -Force | Out-Null;" ^
  "Copy-Item (Join-Path $source '*') $destination -Recurse -Force;" ^
  "9..13 | ForEach-Object {$key='HKCU:\Software\Adobe\CSXS.'+$_; New-Item -Path $key -Force | Out-Null; New-ItemProperty -Path $key -Name PlayerDebugMode -Value '1' -PropertyType String -Force | Out-Null};" ^
  "Write-Host ('Installed at: ' + $destination);"

if not "%errorlevel%"=="0" (
    echo.
    echo Installation failed.
    echo Keep the Artboard_Resizer folder next to this installer and run it again.
    pause
    exit /b 1
)

echo.
echo Installation completed successfully.
echo Restart Adobe Illustrator, then open:
echo Window ^> Extensions ^(Legacy^) ^> Artboard Resizer
echo.
pause
exit /b 0
