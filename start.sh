#!/bin/bash
# ImperialsBot - Startup Script for Linux

echo "Checking environment..."

if ! command -v node &> /dev/null
then
    echo "Node.js could not be found. Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "Checking dependencies..."
npm install --no-audit --no-fund
if [ $? -ne 0 ]; then
    echo "[ERROR] npm install failed."
    read -p "Press [Enter] to exit..."
    exit 1
fi

echo "Starting ImperialsBot..."
npm start

echo ""
echo "App terminated or crashed."
read -p "Press [Enter] to exit..."
