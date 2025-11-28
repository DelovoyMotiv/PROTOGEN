# PROTOGEN-01

Autonomous economic agent implementing the Anoteros Logos protocol with distributed consensus, blockchain integration, and cryptographic provenance.

## Overview

PROTOGEN-01 is a production-ready autonomous agent designed for decentralized economic coordination. The system combines real blockchain integration with distributed consensus mechanisms, enabling trustless agent-to-agent interactions and verifiable computational proofs.

### Core Features

**Autonomous Operation**
- Self-sovereign identity management with Ed25519 and EVM dual-key system
- AI-powered decision making via LLM integration
- Economic safety mechanisms with survival mode protection

**Blockchain Integration**
- Native Base L2 support with USDC payments
- Real-time gas estimation and transaction simulation
- Multi-provider failover with exponential backoff retry

**Distributed Consensus**
- SHA-256 Proof-of-Work for Causal Contribution Credits (CCC)
- Adjustable difficulty with deterministic recalculation
- Chain reorganization support with cumulative difficulty tracking

**Cryptographic Provenance**
- UCPT token generation using COSE_Sign1 format
- Ed25519 signatures for all protocol messages
- AES-256-GCM encryption for sensitive data storage

**Agent-to-Agent Protocol**
- Full A2A v1.0 specification compliance
- JSON-RPC 2.0 messaging with signature verification
- WebSocket-based peer-to-peer networking

**Enterprise Security**
- PBKDF2 key derivation with 100,000 iterations
- Token bucket rate limiting
- Input sanitization and injection detection
- Comprehensive audit logging

## Quick Start

### Prerequisites

- Node.js 22 or higher
- Docker and Docker Compose
- 2GB RAM minimum
- 10GB disk space

### Installation

```bash
git clone https://github.com/your-org/protogen-01.git
cd protogen-01
cp .env.example .env
```

Edit `.env` and configure required variables:

```bash
BASE_RPC_URL=https://mainnet.base.org
VAULT_PASSWORD=<generate-secure-password>
WALLET_ENCRYPTION_KEY=<generate-secure-key>
VITE_OPENROUTER_API_KEY=<your-api-key>
```

### Deployment

**Using Docker Compose:**

```bash
docker-compose up -d
```

**Using deployment script:**

```bash
# Linux/macOS
chmod +x scripts/deploy.sh
./scripts/deploy.sh

# Windows
.\scripts\deploy.ps1
```

### Verification

```bash
curl http://localhost:3000/health
```

## Architecture

The system follows a modular service-oriented architecture:

**Kernel** - Central state machine managing agent lifecycle and task execution

**Identity Module** - Cryptographic identity with encrypted vault storage

**Blockchain Service** - Base L2 integration with transaction management

**Consensus Service** - CCC blockchain with PoW mining and validation

**Persistence Service** - SQLite with WAL mode for ACID-compliant storage

**Security Service** - Encryption, rate limiting, and input validation

**Mesh Service** - Peer-to-peer networking with WebSocket transport

**A2A Handler** - Agent-to-agent protocol message processing

**UCPT Generator** - Cryptographic proof token creation

## Configuration

### Required Environment Variables

```bash
# Blockchain
BASE_RPC_URL=https://mainnet.base.org
USDC_CONTRACT_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Security
VAULT_PASSWORD=<secure-password>
WALLET_ENCRYPTION_KEY=<encryption-key>
MACHINE_ID=<unique-identifier>

# AI Integration
VITE_OPENROUTER_API_KEY=<api-key>
VITE_OPENROUTER_MODEL=minimax/minimax-m2:free

# Agent-Pay-Agent
PLATFORM_WALLET_ADDRESS=<wallet-address>
```

See `.env.example` for complete configuration options.

## API

### Agent Card Discovery

```
GET /.well-known/agent-card.json
```

Returns agent metadata, capabilities, and endpoints.

### A2A Protocol

```
POST /api/a2a
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "a2a.discover",
  "id": 1
}
```

Supported methods:
- `a2a.discover` - Agent metadata
- `a2a.capabilities` - Available methods
- `a2a.ping` - Health check
- `a2a.status` - System status
- `a2a.ccc.balance` - Query CCC balance
- `a2a.mesh.discover` - Find peers
- `task.execute` - Execute task with UCPT

### Health Check

```
GET /health
```

Returns system health status.

## Development

### Local Development

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
```

### Type Checking

```bash
npm run typecheck
```

## Monitoring

### Logs

```bash
# Docker Compose
docker-compose logs -f

# Docker
docker logs -f protogen-01
```

### Metrics

The system tracks:
- CCC balance and mining hash rate
- USDC balance and transaction history
- Connected peer count
- Task execution statistics
- System resource usage

## Backup and Recovery

### Automatic Backups

Backups are created every 24 hours in `./data/backups/`

### Manual Backup

```bash
docker exec protogen-01 sqlite3 /app/data/protogen.db ".backup /app/data/backups/manual.db"
```

### Restore

```bash
docker-compose down
cp ./data/backups/backup.db ./data/protogen.db
docker-compose up -d
```

## Security

### Cryptographic Standards

- Ed25519 for digital signatures (RFC 8032)
- AES-256-GCM for encryption at rest
- PBKDF2 for key derivation (100,000 iterations)
- SHA-256 for hashing and proof-of-work
- COSE_Sign1 for UCPT tokens (RFC 9052)

### Best Practices

- Run as non-root user in containers
- Use strong passwords (32+ characters)
- Rotate secrets regularly
- Enable rate limiting
- Monitor audit logs
- Keep backups encrypted and off-site

## Integration

### Anoteros Logos Platform

Full compatibility with:
- A2A Protocol v1.0
- UCPT provenance tokens
- Agent card discovery
- CCC economic layer
- Mesh network DHT

### Blockchain Networks

- Base L2 (Mainnet)
- USDC token support
- EIP-1559 transaction format

## Troubleshooting

### Container Issues

```bash
docker-compose logs
docker-compose config
```

### Database Issues

```bash
sqlite3 ./data/protogen.db "PRAGMA integrity_check;"
```

### Network Issues

```bash
curl -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

See `DEPLOYMENT.md` for detailed troubleshooting.

## Documentation

- `DEPLOYMENT.md` - Complete deployment guide
- `docs/CCC_BLOCKCHAIN.md` - Consensus implementation details
- `docs/ANTEROSLOGOS_INTEGRATION.md` - Platform integration guide
- `.env.example` - Configuration reference

## License

Proprietary. All rights reserved.

## Version

1.0.0 - Production Release
