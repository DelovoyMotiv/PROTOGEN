# PROTOGEN-01 - Autonomous Economic Agent

![License](https://img.shields.io/badge/License-Proprietary-red.svg)
![Version](https://img.shields.io/badge/version-1.2.8-blue.svg)
![Node](https://img.shields.io/badge/node-22.x-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)
![React](https://img.shields.io/badge/React-19.2-cyan.svg)
![A2A](https://img.shields.io/badge/A2A-v1.0-purple.svg)
![UCPT](https://img.shields.io/badge/UCPT-v1.0-orange.svg)

Autonomous agent implementing cryptographically verifiable provenance, deterministic execution, and blockchain-based micropayments for decentralized AI coordination on Base L2.

**Production URL:** 

**Codebase:** 57 files | 14,020 lines

---

## Overview

Production-grade autonomous agent for decentralized economic coordination. Implements real blockchain integration with distributed consensus mechanisms, enabling trustless agent-to-agent interactions and verifiable computational proofs.

### Core Architecture

**Autonomous Operation Layer**
- Self-sovereign identity with Ed25519 and EVM dual-key cryptography
- Finite state machine for lifecycle management with EARNING and CRITICAL_FAILURE states
- Economic safety mechanisms with autonomous survival mode activation
- Autonomous earning engine with balance monitoring and task execution
- Task marketplace with DHT-based discovery and A2A protocol integration
- Dynamic bid strategy with competitive pricing and profit margin enforcement
- Risk assessment with three-factor security evaluation
- UCPT proof generation with Ed25519 signatures for task verification
- Escrow contract integration for trustless payment settlement
- AI-powered task selection with LLM reasoning and confidence scoring
- Reputation-based requester filtering with persistent scoring

**Blockchain Integration Layer**
- Native Base L2 support with USDC payment processing
- Real-time gas estimation with safety margins
- Transaction simulation and revert detection
- Multi-provider RPC with automatic failover

**Distributed Consensus Layer**
- SHA-256 Proof-of-Work for Causal Contribution Credits and UCPT validation
- Adjustable difficulty targeting 10-minute blocks with dynamic adjustment
- Chain reorganization with cumulative difficulty tracking
- Merkle tree validation for block integrity
- UCPT cascade gossip protocol with exponential fanout
- Bloom filter deduplication for network efficiency
- Peer reputation scoring with temporal decay

**Cryptographic Provenance Layer**
- UCPT token generation using COSE_Sign1 structure
- Ed25519 signatures for all protocol messages
- AES-256-GCM encryption for vault storage
- PBKDF2 key derivation with 100,000 iterations

**Agent-to-Agent Protocol Layer**
- Full A2A v1.0 specification compliance
- JSON-RPC 2.0 messaging with signature verification
- WebSocket-based peer-to-peer networking
- Kademlia DHT for peer discovery

**Security Layer**
- Token bucket rate limiting with adaptive thresholds
- Multi-layer spam filtering with pattern matching
- Input sanitization and injection detection
- Authentication backoff on failed attempts
- Sender reputation tracking with automatic blacklisting
- Comprehensive audit logging with structured events

---

## Quick Start

### Prerequisites

```
Node.js 22+
Docker 20.10+
Docker Compose 2.0+
2GB RAM minimum
10GB disk space
```

### Installation

```bash
git clone https://github.com/DelovoyMotiv/PROTOGEN.git
cd PROTOGEN
cp .env.example .env
```

Configure required variables in `.env`:

```bash
# Blockchain Configuration
BASE_RPC_URL=https://mainnet.base.org
USDC_CONTRACT_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
PLATFORM_WALLET_ADDRESS=0x742d35Cc6634C0532925a3b844Bc454e4438f44e

# Security Configuration
VAULT_PASSWORD=<generate-with-openssl-rand-base64-32>
WALLET_ENCRYPTION_KEY=<generate-with-openssl-rand-hex-32>
MACHINE_ID=<unique-machine-identifier>

# AI Integration
VITE_OPENROUTER_API_KEY=sk-or-v1-<your-key>
VITE_OPENROUTER_MODEL=minimax/minimax-m2:free

# Mining Configuration
CCC_MINING_DIFFICULTY=2
CCC_MINING_INTENSITY=LOW
```

### Deployment

**Linux/macOS:**
```bash
chmod +x deploy.sh
./deploy.sh
```

**Windows:**
```powershell
.\deploy.ps1
```

**Docker Compose:**
```bash
docker-compose up -d
```

### Verification

```bash
# Health check
curl http://localhost:3000/health

# Agent card
curl http://localhost:3000/.well-known/agent-card.json

# View logs
docker-compose logs -f
```

---

## Architecture

### Service Layer

**Kernel Service**
Central state machine managing agent lifecycle. Coordinates task execution, handles state transitions, enforces economic safety rules, and monitors balance thresholds for autonomous earning mode activation.

**Identity Service**
Cryptographic identity management with encrypted vault storage. Generates and manages Ed25519 signing keys and EVM wallet keys.

**Blockchain Service**
Base L2 integration with transaction management. Handles USDC balance queries, gas estimation, transaction broadcasting, and confirmation polling.

**Consensus Service**
CCC blockchain implementation with Proof-of-Work mining. Validates blocks, manages chain state, and handles reorganizations.

**Persistence Service**
SQLite database with WAL mode for ACID-compliant storage. Manages ledger blocks, identity vault, and system state.

**Security Service**
Encryption, rate limiting, and input validation. Implements PBKDF2 key derivation, AES-256-GCM encryption, and token bucket rate limiting.

**Mesh Service**
Peer-to-peer networking with WebSocket transport. Implements Kademlia DHT for peer discovery and capability-based routing.

**A2A Handler**
Agent-to-agent protocol message processing. Validates signatures, routes messages, and generates responses.

**UCPT Generator**
Cryptographic proof token creation. Generates COSE_Sign1 tokens with Ed25519 signatures for task execution proofs.

**Earning Engine**
Autonomous economic self-sufficiency module. Monitors USDC balance, activates survival mode when below threshold, discovers and evaluates task offers, executes tasks with resource monitoring, generates cryptographic proofs, claims payments from escrow contracts, and manages requester blacklisting. Integrates AI advisor for multi-task selection with confidence-weighted decision making.

**Earning Advisor**
LLM-based task selection system. Analyzes multiple task options with risk-adjusted profit calculations, generates structured reasoning for decisions, provides confidence scores for selection quality, and falls back to deterministic selection when unavailable.

**UCPT Cascade**
Gossip protocol implementation for distributed UCPT token propagation. Implements exponential fanout with configurable parameters, Bloom filter deduplication, and SQLite-backed caching with TTL expiration and LRU eviction. Supports batch operations and peer selection based on reputation scores.

**UCPT Consensus**
Proof-of-Work consensus engine for UCPT validation. Implements SHA-256 mining with adjustable difficulty, nonce discovery with configurable iteration limits, and cryptographic verification of computational proofs. Supports parallel validation and difficulty adjustment based on network conditions.

**Spam Filter**
Multi-layer spam detection system. Implements rate limiting with token bucket algorithm, content-based filtering with pattern matching, sender reputation tracking, and adaptive threshold adjustment. Supports configurable rules and automatic blacklisting.

**Reputation Engine**
Persistent peer reputation tracking with exponential moving average metrics. Maintains success rate, response time, and contribution quality per peer. Implements decay functions for temporal relevance and configurable thresholds for peer selection.

**UCPT Cascade**
Gossip protocol implementation for distributed UCPT token propagation. Implements exponential fanout with configurable parameters, Bloom filter deduplication, and SQLite-backed caching with TTL expiration and LRU eviction. Supports batch operations and peer selection based on reputation scores.

**UCPT Consensus**
Proof-of-Work consensus engine for UCPT validation. Implements SHA-256 mining with adjustable difficulty, nonce discovery with configurable iteration limits, and cryptographic verification of computational proofs. Supports parallel validation and difficulty adjustment based on network conditions.

**UCPT Validator**
Cryptographic validation engine for UCPT tokens. Verifies COSE_Sign1 structure integrity, validates Ed25519 signatures, checks timestamp freshness, and enforces schema compliance with comprehensive error reporting.

**Spam Filter**
Multi-layer spam detection system. Implements rate limiting with token bucket algorithm, content-based filtering with pattern matching, sender reputation tracking, and adaptive threshold adjustment. Supports configurable rules and automatic blacklisting.

**Reputation Engine**
Persistent peer reputation tracking with exponential moving average metrics. Maintains success rate, response time, and contribution quality per peer. Implements decay functions for temporal relevance and configurable thresholds for peer selection.

**Task Executor**
Production-grade task execution engine with state locking, resource tracking, and malicious payload detection. Delegates to service layer based on task type, generates UCPT proofs with Ed25519 signatures, and handles comprehensive error recovery.

**Escrow Service**
Base L2 escrow contract integration for trustless payment settlement. Verifies locked funds, encodes UCPT proofs for on-chain submission, simulates transactions before broadcast, and manages payment claims with confirmation tracking.

### Data Flow

```
External Request → A2A Handler → Kernel → Service Layer → Blockchain/Consensus
                                    ↓
                              Persistence ← Security
```

---

## API Reference

### Agent Discovery

```http
GET /.well-known/agent-card.json
```

Returns agent metadata, capabilities, payment information, and communication endpoints.

### A2A Protocol

```http
POST /api/a2a
Content-Type: application/json

{
  "header": {
    "version": "1.0",
    "id": "msg-uuid",
    "timestamp": 1234567890,
    "sender_did": "did:key:...",
    "recipient_did": "did:key:...",
    "type": "DISCOVER",
    "nonce": 12345
  },
  "payload": {},
  "signature": "base64-signature"
}
```

**Supported Methods:**
- `a2a.discover` - Agent metadata and capabilities
- `a2a.ping` - Connectivity test
- `a2a.status` - System status
- `a2a.ccc.balance` - Query CCC balance
- `a2a.ccc.transfer` - Transfer CCC tokens
- `a2a.mesh.discover` - Peer discovery
- `task.execute` - Execute task with UCPT generation
- `ucpt.cascade` - Propagate UCPT tokens via gossip protocol
- `ucpt.validate` - Validate UCPT proof-of-work

### Health Monitoring

```http
GET /health
```

Returns system health status including:
- Service availability
- Database connectivity
- Blockchain RPC status
- Peer count
- Resource usage

---

## Configuration

### Environment Variables

**Blockchain Settings**
```bash
BASE_RPC_URL                  # Base L2 RPC endpoint
USDC_CONTRACT_ADDRESS         # USDC token contract
PLATFORM_WALLET_ADDRESS       # Platform fee recipient
```

**Security Settings**
```bash
VAULT_PASSWORD                # Vault encryption password
WALLET_ENCRYPTION_KEY         # Wallet key encryption
MACHINE_ID                    # Unique machine identifier
```

**Mining Settings**
```bash
CCC_MINING_DIFFICULTY         # PoW difficulty (1-4)
CCC_MINING_INTENSITY          # LOW, MEDIUM, HIGH
UCPT_MINING_DIFFICULTY        # UCPT PoW difficulty (1-4, default: 2)
UCPT_MAX_ITERATIONS           # Maximum mining iterations (default: 1000000)
```

**Cascade Settings**
```bash
UCPT_CASCADE_FANOUT           # Gossip fanout factor (default: 3)
UCPT_CASCADE_TTL              # Token time-to-live in seconds (default: 3600)
UCPT_CACHE_MAX_SIZE           # Maximum cache entries (default: 10000)
BLOOM_FILTER_SIZE             # Bloom filter size in bits (default: 100000)
BLOOM_FILTER_HASHES           # Number of hash functions (default: 7)
```

**Security Settings**
```bash
SPAM_RATE_LIMIT               # Messages per minute threshold (default: 60)
SPAM_BURST_LIMIT              # Burst capacity (default: 10)
MIN_PEER_REPUTATION           # Minimum reputation for peer selection (default: 50)
REPUTATION_DECAY_RATE         # Temporal decay factor (default: 0.95)
```

**Earning Engine Settings**
```bash
SURVIVAL_THRESHOLD            # USDC balance threshold for entering earning mode (default: 1.00)
SAFE_THRESHOLD                # USDC balance threshold for exiting earning mode (default: 5.00)
EARNING_CYCLE_INTERVAL        # Task discovery interval in milliseconds (default: 300000)
MAX_CONSECUTIVE_FAILURES      # Maximum failures before critical state (default: 3)
BLACKLIST_DURATION            # Requester blacklist duration in milliseconds (default: 86400000)
MIN_PROFIT_MARGIN             # Minimum profit margin for task acceptance (default: 0.30)
MAX_TASK_DURATION             # Maximum task execution duration in seconds (default: 1800)
ESCROW_CONTRACT_ADDRESS       # Base L2 escrow contract address
MIN_REPUTATION_SCORE          # Minimum requester reputation threshold (default: 30)
RISK_THRESHOLD                # Maximum acceptable risk score (default: 70)
```

**AI Integration**
```bash
VITE_OPENROUTER_API_KEY       # OpenRouter API key
VITE_OPENROUTER_MODEL         # Model identifier
```

See `.env.example` for complete reference.

---

## Development

### Local Development

```bash
npm install
npm run dev
```

Access at `http://localhost:5173`

### Build

```bash
npm run build
```

Output in `dist/` directory.

### Type Checking

```bash
npm run typecheck
```

### Code Quality

```bash
npm run lint
npm run format
```

---

## Monitoring

### Container Status

```bash
docker-compose ps
docker-compose logs -f
```

### System Metrics

The agent tracks:
- CCC balance and mining hash rate
- USDC balance and transaction history
- Earning mode status and balance thresholds
- Task execution statistics with success rate and average profit
- Resource usage per task execution (CPU time, memory delta)
- Requester blacklist status and duration
- Connected peer count and reputation scores
- UCPT cache hit rate and eviction statistics
- UCPT cascade propagation metrics and fanout efficiency
- Spam filter detection rate and false positive rate
- Peer reputation distribution and decay statistics
- AI advisor decision confidence and fallback rate
- Memory and CPU usage

### Performance

**Mining Performance:**
- 1000+ H/s (LOW intensity)
- 5000+ H/s (HIGH intensity)
- Adjustable difficulty targeting 10-minute blocks

**Database Performance:**
- Sub-10ms block append with fsync
- Concurrent read access with WAL mode
- Automatic integrity checking

**Network Performance:**
- 200-500ms blockchain query latency
- 50-100ms peer-to-peer messaging
- Automatic retry with exponential backoff

---

## Backup and Recovery

### Automatic Backups

Backups created every 24 hours in `./data/backups/`

### Manual Backup

```bash
docker exec protogen-01 sqlite3 /app/data/protogen.db ".backup /app/data/backups/manual.db"
```

### Restore from Backup

```bash
docker-compose down
cp ./data/backups/backup-YYYYMMDD.db ./data/protogen.db
docker-compose up -d
```

### Backup Verification

```bash
sqlite3 ./data/backups/backup.db "PRAGMA integrity_check;"
```

---

## Security

### Cryptographic Standards

- **Ed25519** - Digital signatures (RFC 8032)
- **AES-256-GCM** - Encryption at rest
- **PBKDF2** - Key derivation (100,000 iterations)
- **SHA-256** - Hashing and proof-of-work
- **COSE_Sign1** - UCPT tokens (RFC 9052)

### Network Security

- TLS certificate validation
- Rate limiting with token bucket algorithm
- Input sanitization and injection detection
- WebSocket security for peer communication

### Operational Security

- Non-root container execution
- Encrypted identity vault storage
- Automatic backup with verification
- Audit logging for all operations

### Best Practices

- Use strong passwords (32+ characters)
- Rotate secrets regularly
- Enable rate limiting
- Monitor audit logs
- Keep backups encrypted and off-site
- Review security logs daily

---

## Integration

### Anoteros Logos Platform

Complete implementation of:
- A2A Protocol v1.0
- UCPT provenance token generation
- Agent card discovery mechanism
- CCC economic layer participation
- Mesh network DHT integration

### Base L2 Blockchain

- Native USDC payment processing
- Gas optimization and congestion detection
- Transaction simulation and validation
- Multi-provider RPC failover

### Mesh Network

- Kademlia DHT for peer discovery
- WebSocket-based peer connections
- Capability-based routing
- UCPT cascade distribution

---

## Troubleshooting

### Container Issues

```bash
# Check configuration
docker-compose config

# View detailed logs
docker-compose logs --tail=100

# Restart services
docker-compose restart
```

### Database Issues

```bash
# Check integrity
sqlite3 ./data/protogen.db "PRAGMA integrity_check;"

# Vacuum database
sqlite3 ./data/protogen.db "VACUUM;"
```

### Network Issues

```bash
# Test RPC connectivity
curl -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### Common Issues

**Agent not starting:**
- Check `.env` configuration
- Verify Docker is running
- Check port availability (3000, 8080, 8443)

**Mining not working:**
- Verify CCC_MINING_DIFFICULTY setting
- Check CPU availability
- Review mining logs

**Blockchain connection failed:**
- Verify BASE_RPC_URL is accessible
- Check network connectivity
- Try alternative RPC provider

---

## Documentation

- **DEPLOYMENT.md** - Complete deployment guide
- **SECURITY.md** - Security policies and procedures
- **CONTRIBUTING.md** - Contribution guidelines
- **CHANGELOG.md** - Version history

---

## License

Proprietary. All rights reserved.

---

## Version History

**1.2.8** - UCPT Cascade and Security Layer
- UCPT cascade gossip protocol with exponential fanout and peer selection
- Proof-of-Work consensus engine for UCPT validation with adjustable difficulty
- Multi-layer spam filtering with pattern matching and adaptive thresholds
- Peer reputation engine with temporal decay and contribution quality tracking
- Bloom filter deduplication for network efficiency
- SQLite-backed UCPT cache with TTL expiration and LRU eviction
- Cryptographic UCPT validator with comprehensive error reporting
- Mesh network security with sender reputation tracking

**1.2.6** - AI Integration and Distributed Caching
- LLM-based task selection with structured reasoning and confidence scoring
- Persistent reputation engine with exponential moving average metrics
- SQLite-backed UCPT cache with TTL expiration and LRU eviction
- Bloom filter implementation for fast UCPT deduplication
- UCPT cascade distribution with batch operations
- Cryptographic UCPT validator with COSE_Sign1 verification
- Mesh network configuration with capability-based routing
- Enhanced earning cycle with AI advisor integration

**1.2.5** - Task Execution and Escrow Integration
- Production-grade task executor with state locking and resource monitoring
- UCPT proof generation with Ed25519 signatures for task verification
- Malicious payload detection with automatic requester blacklisting
- Base L2 escrow contract integration for trustless payment settlement
- Transaction simulation and gas estimation with safety margins
- Payment claim workflow with confirmation tracking
- Metrics tracking with exponential moving average smoothing
- Full earning cycle implementation from discovery to payment

**1.2.1** - Autonomous Earning Engine
- Autonomous economic self-sufficiency module
- Balance monitoring with configurable thresholds
- Automatic survival mode activation and deactivation
- Task marketplace with DHT-based discovery
- Dynamic bid strategy with competitive pricing
- Three-factor risk assessment system
- Requester blacklisting mechanism
- FSM extension with EARNING and CRITICAL_FAILURE states

**1.0.0** - Production Release
- Full A2A Protocol v1.0 implementation
- Base L2 blockchain integration
- CCC consensus mechanism
- UCPT provenance tokens
- Production-ready security hardening
