#!/bin/bash

# PROTOGEN-01 One-Click Deployment Script
# Deploys the agent with all production configurations

set -e  # Exit on error

echo "========================================="
echo "PROTOGEN-01 Production Deployment"
echo "========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "📝 Please copy .env.example to .env and configure it"
    echo ""
    echo "  cp .env.example .env"
    echo "  nano .env  # Edit configuration"
    echo ""
    exit 1
fi

# Load environment variables
source .env

# Validate critical environment variables
echo "🔍 Validating configuration..."

if [ -z "$VAULT_PASSWORD" ] || [ "$VAULT_PASSWORD" = "CHANGE_THIS_TO_SECURE_PASSWORD" ]; then
    echo "❌ Error: VAULT_PASSWORD not configured"
    echo "📝 Generate a secure password:"
    echo "  openssl rand -base64 32"
    exit 1
fi

if [ -z "$WALLET_ENCRYPTION_KEY" ] || [ "$WALLET_ENCRYPTION_KEY" = "CHANGE_THIS_TO_SECURE_KEY" ]; then
    echo "❌ Error: WALLET_ENCRYPTION_KEY not configured"
    echo "📝 Generate a secure key:"
    echo "  openssl rand -hex 32"
    exit 1
fi

echo "✅ Configuration validated"
echo ""

# Create data directories
echo "📁 Creating data directories..."
mkdir -p ./data
mkdir -p ./data/backups
chmod 700 ./data
chmod 700 ./data/backups
echo "✅ Data directories created"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed"
    echo "📝 Install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: Docker Compose is not installed"
    echo "📝 Install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker and Docker Compose found"
echo ""

# Build Docker image
echo "🔨 Building Docker image..."
docker-compose build
echo "✅ Docker image built"
echo ""

# Stop existing container if running
echo "🛑 Stopping existing container (if any)..."
docker-compose down
echo "✅ Existing container stopped"
echo ""

# Start container
echo "🚀 Starting PROTOGEN-01..."
docker-compose up -d
echo "✅ Container started"
echo ""

# Wait for container to be healthy
echo "⏳ Waiting for health check..."
sleep 10

# Check container status
if docker-compose ps | grep -q "Up"; then
    echo "✅ PROTOGEN-01 is running"
    echo ""
    echo "========================================="
    echo "Deployment Successful! 🎉"
    echo "========================================="
    echo ""
    echo "📊 Container Status:"
    docker-compose ps
    echo ""
    echo "📝 View logs:"
    echo "  docker-compose logs -f"
    echo ""
    echo "🔍 Check health:"
    echo "  curl http://localhost:3000/health"
    echo ""
    echo "🛑 Stop agent:"
    echo "  docker-compose down"
    echo ""
    echo "🔄 Restart agent:"
    echo "  docker-compose restart"
    echo ""
    echo "📦 View backups:"
    echo "  ls -lh ./data/backups/"
    echo ""
else
    echo "❌ Error: Container failed to start"
    echo ""
    echo "📝 Check logs:"
    echo "  docker-compose logs"
    exit 1
fi
