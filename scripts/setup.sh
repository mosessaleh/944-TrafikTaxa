#!/bin/bash

# =====================================
# 944 Trafik - Setup Script for New Environment
# =====================================

echo "🚀 Setting up 944 Trafik Taxi Service..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please update the .env file with your actual values before continuing"
    echo "📝 Required values to update:"
    echo "   - AUTH_SECRET (use a secure random string)"
    echo "   - DATABASE_URL (MySQL connection string)"
    echo "   - SMTP_USER and SMTP_PASS (email settings)"
    echo ""
    read -p "Press Enter to continue after updating .env file..."
fi

# Check if Docker is available for database setup
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo "🐳 Docker detected. You can use Docker for MySQL setup."
    echo "📋 Docker setup options:"
    echo "   1. Use Docker Compose (recommended):"
    echo "      docker-compose up -d mysql"
    echo "   2. Or start the full stack:"
    echo "      docker-compose up -d"
else
    echo "📋 Manual database setup required:"
    echo "   - Install MySQL 8.0+"
    echo "   - Create database: CREATE DATABASE 944_taxi;"
    echo "   - Update DATABASE_URL in .env file"
fi

# Wait for database connection
echo "🔄 Testing database connection..."
npx prisma db push --accept-data-loss

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npx prisma generate

# Run migrations
echo "📊 Applying database migrations..."
npx prisma migrate dev --name init

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Ensure MySQL is running"
echo "   2. Update .env file with your values"
echo "   3. Run migrations: npx prisma migrate dev"
echo "   4. Start development server: npm run dev"
echo ""
echo "📖 For detailed setup instructions, see README-SETUP.md"