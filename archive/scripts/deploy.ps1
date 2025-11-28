# PROTOGEN-01 One-Click Deployment Script (PowerShell)
# Deploys the agent with all production configurations

$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "PROTOGEN-01 Production Deployment" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path .env)) {
    Write-Host "❌ Error: .env file not found" -ForegroundColor Red
    Write-Host "📝 Please copy .env.example to .env and configure it" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Copy-Item .env.example .env"
    Write-Host "  notepad .env  # Edit configuration"
    Write-Host ""
    exit 1
}

Write-Host "✅ Configuration file found" -ForegroundColor Green
Write-Host ""

# Create data directories
Write-Host "📁 Creating data directories..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path ./data | Out-Null
New-Item -ItemType Directory -Force -Path ./data/backups | Out-Null
Write-Host "✅ Data directories created" -ForegroundColor Green
Write-Host ""

# Check if Docker is installed
try {
    docker --version | Out-Null
    Write-Host "✅ Docker found" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Docker is not installed" -ForegroundColor Red
    Write-Host "📝 Install Docker Desktop: https://docs.docker.com/desktop/install/windows-install/" -ForegroundColor Yellow
    exit 1
}

# Check if Docker Compose is installed
try {
    docker-compose --version | Out-Null
    Write-Host "✅ Docker Compose found" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Docker Compose is not installed" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Build Docker image
Write-Host "🔨 Building Docker image..." -ForegroundColor Cyan
docker-compose build
Write-Host "✅ Docker image built" -ForegroundColor Green
Write-Host ""

# Stop existing container if running
Write-Host "🛑 Stopping existing container (if any)..." -ForegroundColor Cyan
docker-compose down
Write-Host "✅ Existing container stopped" -ForegroundColor Green
Write-Host ""

# Start container
Write-Host "🚀 Starting PROTOGEN-01..." -ForegroundColor Cyan
docker-compose up -d
Write-Host "✅ Container started" -ForegroundColor Green
Write-Host ""

# Wait for container to be healthy
Write-Host "⏳ Waiting for health check..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

# Check container status
$status = docker-compose ps
if ($status -match "Up") {
    Write-Host "✅ PROTOGEN-01 is running" -ForegroundColor Green
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "Deployment Successful! 🎉" -ForegroundColor Green
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📊 Container Status:" -ForegroundColor Cyan
    docker-compose ps
    Write-Host ""
    Write-Host "📝 View logs:" -ForegroundColor Yellow
    Write-Host "  docker-compose logs -f"
    Write-Host ""
    Write-Host "🔍 Check health:" -ForegroundColor Yellow
    Write-Host "  curl http://localhost:3000/health"
    Write-Host ""
    Write-Host "🛑 Stop agent:" -ForegroundColor Yellow
    Write-Host "  docker-compose down"
    Write-Host ""
    Write-Host "🔄 Restart agent:" -ForegroundColor Yellow
    Write-Host "  docker-compose restart"
    Write-Host ""
    Write-Host "📦 View backups:" -ForegroundColor Yellow
    Write-Host "  Get-ChildItem ./data/backups/"
    Write-Host ""
} else {
    Write-Host "❌ Error: Container failed to start" -ForegroundColor Red
    Write-Host ""
    Write-Host "📝 Check logs:" -ForegroundColor Yellow
    Write-Host "  docker-compose logs"
    exit 1
}
