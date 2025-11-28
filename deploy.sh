#!/bin/bash

# PROTOGEN-01 Production Deployment
set -e

echo "PROTOGEN-01 Deployment"
echo "======================"

# Check environment file
if [ ! -f .env ]; then
    echo "Error: .env file not found"
    echo "Copy .env.example to .env and configure it"
    exit 1
fi

# Create data directories
mkdir -p ./data
mkdir -p ./data/backups
chmod 700 ./data
chmod 700 ./data/backups

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "Error: Docker not installed"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "Error: Docker Compose not installed"
    exit 1
fi

# Deploy
echo "Building and starting container..."
docker-compose down
docker-compose build
docker-compose up -d

# Wait for health check
echo "Waiting for health check..."
sleep 10

if docker-compose ps | grep -q "Up"; then
    echo "Deployment successful!"
    echo "Agent running at: http://localhost:3000"
    echo "Health check: curl http://localhost:3000/health"
    echo "View logs: docker-compose logs -f"
else
    echo "Deployment failed. Check logs: docker-compose logs"
    exit 1
fi
