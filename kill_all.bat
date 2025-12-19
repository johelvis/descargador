@echo off
echo Cerrando todo por la fuerza...
taskkill /F /IM node.exe /T
taskkill /F /IM electron.exe /T
echo.
echo !Listo! Todo cerrado. Ya puedes intentar abrir la app de nuevo.
pause
