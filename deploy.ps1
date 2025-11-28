# PROTOGEN-01 Production Deployment
$ErrorActionPreference = "Stop"

Write-Host "PROTOGEN-01 Deployment" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan

# Check environment file
if (-not (Test-Path .env)) {
    Write-Host "Error: .env file not found" -ForegroundColor Red
    Write-Host "Copy .env.example to .env and configure it" -ForegroundColor Yellow
    exit 1
}

# Create data directories
New-Item -ItemType Directory -Force -Path ./data | Out-Null
New-Item -ItemType Directory -Force -Path ./data/backups | Out-Null

# Check Docker
try {
    docker --version | Out-Null
    docker-compose --version | Out-Null
} catch {
    Write-Host "Error: Docker or Docker Compose not installed" -ForegroundColor Red
    exit 1
}

# Deploy
Write-Host "Building and starting container..." -ForegroundColor Cyan
docker-compose down
docker-compose build
docker-compose up -d

# Wait for health check
Write-Host "Waiting for health check..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

$status = docker-compose ps
if ($status -match "Up") {
    Write-Host "Deployment successful!" -ForegroundColor Green
    Write-Host "Agent running at: http://localhost:3000" -ForegroundColor Yellow
    Write-Host "Health check: curl http://localhost:3000/health" -ForegroundColor Yellow
    Write-Host "View logs: docker-compose logs -f" -ForegroundColor Yellow
} else {
    Write-Host "Deployment failed. Check logs: docker-compose logs" -ForegroundColor Red
    exit 1
}
