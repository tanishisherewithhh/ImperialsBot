#!/bin/bash
# ImperialsBot - Startup Script for Linux

echo "Checking environment..."

if ! command -v node &> /dev/null
then
    echo "Node.js could not be found. Please install Node.js from https://nodejs.org/"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

echo "Starting ImperialsBot..."
npm start
