# PROTOGEN-01 Deployment Guide

## Quick Start (One-Click Deploy)

### Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- 2GB RAM minimum, 4GB recommended
- 10GB disk space for data and backups

### Linux/macOS

```bash
# 1. Clone repository
git clone <repository-url>
cd protogen-01

# 2. Configure environment
cp .env.example .env
nano .env  # Edit configuration

# 3. Deploy
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### Windows (PowerShell)

```powershell
# 1. Clone repository
git clone <repository-url>
cd protogen-01

# 2. Configure environment
Copy-Item .env.example .env
notepad .env  # Edit configuration

# 3. Deploy
.\scripts\deploy.ps1
```

## Configuration

### Critical Environment Variables

**MUST configure before deployment:**

```bash
# Generate secure vault password
VAULT_PASSWORD=$(openssl rand -base64 32)

# Generate wallet encryption key
WALLET_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Set unique machine ID
MACHINE_ID=protogen-production-01
```

### Blockchain Configuration

```bash
# Base L2 RPC (required)
BASE_RPC_URL=https://mainnet.base.org

# USDC Contract on Base L2
USDC_CONTRACT_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

### AI Integration

```bash
# OpenRouter API Key (required for Cortex)
VITE_OPENROUTER_API_KEY=sk-or-v1-your-api-key-here

# Model selection
VITE_OPENROUTER_MODEL=minimax/minimax-m2:free
```

### Agent-Pay-Agent

```bash
# Platform wallet for receiving payments
PLATFORM_WALLET_ADDRESS=0x742d35Cc6634C0532925a3b844Bc454e4438f44e
```

## Manual Deployment

### Build Docker Image

```bash
docker build -t protogen-01:latest .
```

### Run Container

```bash
docker run -d \
  --name protogen-01 \
  -p 3000:3000 \
  -p 8080:8080 \
  -v $(pwd)/data:/app/data \
  -e BASE_RPC_URL=https://mainnet.base.org \
  -e VAULT_PASSWORD=your-secure-password \
  -e WALLET_ENCRYPTION_KEY=your-encryption-key \
  -e VITE_OPENROUTER_API_KEY=your-api-key \
  protogen-01:latest
```

### Using Docker Compose

```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Restart
docker-compose restart
```

## Kubernetes Deployment

### Create Namespace

```bash
kubectl create namespace protogen
```

### Create Secrets

```bash
kubectl create secret generic protogen-secrets \
  --from-literal=vault-password=$(openssl rand -base64 32) \
  --from-literal=wallet-key=$(openssl rand -hex 32) \
  --from-literal=openrouter-key=sk-or-v1-your-key \
  -n protogen
```

### Deploy

```bash
kubectl apply -f k8s/deployment.yaml -n protogen
```

### Verify

```bash
kubectl get pods -n protogen
kubectl logs -f deployment/protogen-01 -n protogen
```

## Health Checks

### HTTP Health Endpoint

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": 1234567890,
  "version": "1.0.0"
}
```

### Container Health

```bash
docker inspect --format='{{.State.Health.Status}}' protogen-01
```

### Logs

```bash
# Docker
docker logs -f protogen-01

# Docker Compose
docker-compose logs -f

# Kubernetes
kubectl logs -f deployment/protogen-01 -n protogen
```

## Monitoring

### Prometheus Metrics

Metrics exposed at: `http://localhost:9090/metrics`

Key metrics:
- `protogen_ccc_balance` - CCC balance
- `protogen_usdc_balance` - USDC balance
- `protogen_mining_hashrate` - Mining hash rate
- `protogen_peer_count` - Connected peers
- `protogen_task_total` - Total tasks executed
- `protogen_task_duration_seconds` - Task execution time

### Grafana Dashboard

Import dashboard from `monitoring/grafana-dashboard.json`

## Backup & Recovery

### Automatic Backups

Backups are created automatically every 24 hours in `./data/backups/`

### Manual Backup

```bash
# Docker
docker exec protogen-01 node -e "require('./services/persistence').persistenceService.createBackup()"

# Direct
sqlite3 ./data/protogen.db ".backup ./data/backups/manual-backup-$(date +%Y%m%d-%H%M%S).db"
```

### Restore from Backup

```bash
# Stop container
docker-compose down

# Restore database
cp ./data/backups/backup-YYYYMMDD-HHMMSS.db ./data/protogen.db

# Start container
docker-compose up -d
```

### Vault Backup

```bash
# Backup encrypted vault
cp ./data/vault.enc ./data/backups/vault-$(date +%Y%m%d-%H%M%S).enc
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs

# Check configuration
docker-compose config

# Validate environment
docker-compose run --rm protogen env
```

### Database Corruption

```bash
# Check integrity
sqlite3 ./data/protogen.db "PRAGMA integrity_check;"

# Restore from backup
docker-compose down
cp ./data/backups/latest-backup.db ./data/protogen.db
docker-compose up -d
```

### Network Issues

```bash
# Test RPC connectivity
curl -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Check DNS resolution
nslookup mainnet.base.org

# Test WebSocket
wscat -c wss://echo.websocket.org
```

### Memory Issues

```bash
# Check memory usage
docker stats protogen-01

# Increase memory limit in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 4G  # Increase from 2G
```

### Identity Issues

```bash
# Reset identity (WARNING: Creates new wallet)
docker-compose down
rm ./data/vault.enc
docker-compose up -d
```

## Security Best Practices

### 1. Secure Secrets

- Never commit `.env` to version control
- Use strong passwords (32+ characters)
- Rotate secrets regularly
- Use secret management systems (Vault, AWS Secrets Manager)

### 2. Network Security

- Use TLS for all external connections
- Restrict port access with firewall
- Use VPN for remote access
- Enable rate limiting

### 3. Container Security

- Run as non-root user (already configured)
- Use read-only filesystem where possible
- Limit capabilities
- Regular security updates

### 4. Backup Security

- Encrypt backups
- Store backups off-site
- Test restore procedures regularly
- Implement backup retention policy

## Performance Tuning

### Mining Intensity

```bash
# Low intensity (default) - minimal CPU usage
CCC_MINING_INTENSITY=LOW

# High intensity - maximum mining performance
CCC_MINING_INTENSITY=HIGH
```

### Database Optimization

```bash
# Increase cache size
sqlite3 ./data/protogen.db "PRAGMA cache_size = 10000;"

# Optimize database
sqlite3 ./data/protogen.db "VACUUM;"
```

### Resource Limits

Edit `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '4.0'      # Increase CPU
      memory: 4G       # Increase RAM
    reservations:
      cpus: '1.0'
      memory: 1G
```

## Scaling

### Horizontal Scaling

Each instance requires:
- Unique `MACHINE_ID`
- Unique `AGENT_AID`
- Independent data volume
- Separate identity vault

### Load Balancing

Use nginx or HAProxy for load balancing:

```nginx
upstream protogen {
    server protogen-01:3000;
    server protogen-02:3000;
    server protogen-03:3000;
}

server {
    listen 80;
    location / {
        proxy_pass http://protogen;
    }
}
```

## Maintenance

### Regular Tasks

- **Daily**: Check logs for errors
- **Weekly**: Review backup integrity
- **Monthly**: Update dependencies
- **Quarterly**: Security audit

### Updates

```bash
# Pull latest code
git pull origin main

# Rebuild image
docker-compose build

# Restart with new image
docker-compose up -d
```

### Database Maintenance

```bash
# Vacuum database (reclaim space)
docker exec protogen-01 sqlite3 /app/data/protogen.db "VACUUM;"

# Analyze database (update statistics)
docker exec protogen-01 sqlite3 /app/data/protogen.db "ANALYZE;"
```

## Support

### Logs Location

- Container logs: `docker-compose logs`
- Application logs: `./data/logs/`
- Audit logs: `./data/audit/`

### Debug Mode

```bash
# Enable debug logging
DEBUG=true docker-compose up -d

# View detailed logs
docker-compose logs -f --tail=100
```

### Community

- GitHub Issues: <repository-url>/issues
- Documentation: <repository-url>/wiki
- Discord: <discord-invite-link>

## License

Proprietary - All rights reserved

---

**Version**: 1.0.0  
**Last Updated**: November 28, 2025  
**Status**: Production Ready
