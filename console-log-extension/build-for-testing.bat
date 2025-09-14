@echo off
echo Building Console Log Extension for manual testing...
echo.

cd /d "%~dp0"
node scripts\build.js

echo.
echo Build complete! You can now load the extension from the 'dist' folder.
echo.
echo Installation instructions: dist\MANUAL_INSTALL_README.md
echo.
pause