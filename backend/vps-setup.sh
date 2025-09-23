#!/bin/bash

# VPS Wilaya Correction Setup Script
# This script prepares your VPS environment and runs the wilaya correction

echo "🚀 VPS Wilaya Correction Setup"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
print_status "Checking Node.js installation..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_status "Node.js is installed: $NODE_VERSION"
else
    print_error "Node.js is not installed. Please install Node.js first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check if npm is available
print_status "Checking npm availability..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    print_status "npm is available: $NPM_VERSION"
else
    print_error "npm is not available. Please install npm."
    exit 1
fi

# Install required packages
print_status "Installing required packages..."
npm install mysql2 dotenv

if [ $? -eq 0 ]; then
    print_status "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Check if .env file exists
print_status "Checking environment configuration..."
if [ -f ".env" ]; then
    print_status ".env file found"
    
    # Check for required variables
    if grep -q "DB_PASSWORD" .env; then
        print_status "DB_PASSWORD found in .env"
    else
        print_warning "DB_PASSWORD not found in .env"
        echo "Please add your database password to .env file:"
        echo "DB_PASSWORD=your_actual_password"
    fi
    
    if grep -q "DB_HOST" .env; then
        print_status "DB_HOST found in .env"
    else
        print_warning "DB_HOST not found in .env, will use default (localhost)"
    fi
    
    if grep -q "DB_USER" .env; then
        print_status "DB_USER found in .env"
    else
        print_warning "DB_USER not found in .env, will use default (eco_user)"
    fi
    
else
    print_warning ".env file not found, creating template..."
    cat > .env << EOF
# Database Configuration
DB_HOST=localhost
DB_USER=eco_user
DB_PASSWORD=your_database_password_here
DB_NAME=eco_system
EOF
    print_status "Template .env file created. Please update with your actual database credentials."
    echo ""
    echo "Edit the file with: nano .env"
    echo "Then re-run this script."
    exit 1
fi

# Check if correction script exists
print_status "Checking for wilaya correction script..."
if [ -f "vps-wilaya-correction.js" ]; then
    print_status "Correction script found"
else
    print_error "vps-wilaya-correction.js not found in current directory"
    echo "Please upload the script file first."
    exit 1
fi

# Make script executable
chmod +x vps-wilaya-correction.js
print_status "Made correction script executable"

# Final confirmation
echo ""
echo "🎯 Setup Complete! Ready to run wilaya correction."
echo ""
print_warning "IMPORTANT: This will modify your production database!"
print_warning "Make sure you have a recent database backup."
echo ""
read -p "Do you want to proceed with the correction? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Starting wilaya correction..."
    echo ""
    node vps-wilaya-correction.js
else
    print_status "Correction cancelled. You can run it manually later with:"
    echo "node vps-wilaya-correction.js"
fi

echo ""
print_status "Setup script completed."