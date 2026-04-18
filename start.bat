@echo off
title ImperialBot - Startup
echo checking environment...

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] NodeJS not found.
    echo you can install it manually from https://nodejs.org/
    echo.
    set /p install="Would you like to try installing NodeJS using winget? (y/n): "
    if /i "%install%"=="y" (
        echo trying to install nodejs...
        winget install OpenJS.NodeJS
        if %errorlevel% neq 0 (
            echo auto-install failed. please install manually.
            pause
            exit /b
        )
    ) else (
        echo please install nodejs to continue.
        pause
        exit /b
    )
)

echo checking dependencies...
call npm install --no-audit --no-fund
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed.
    pause
    exit /b
)

echo starting imperialbot...
call npm start
echo.
echo App terminated or crashed.
pause