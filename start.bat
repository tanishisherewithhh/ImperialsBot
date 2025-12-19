@echo off
title ImperialBot - Startup
echo checking environment...

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo nodejs not found. please install nodejs from https://nodejs.org/
    echo or wait while i try to install it using winget...
    winget install OpenJS.NodeJS
    if %errorlevel% neq 0 (
        echo auto-install failed. please install manually.
        pause
        exit /b
    )
)

if not exist node_modules (
    echo installing dependencies...
    npm install
)

echo starting imperialbot...
npm start
pause