# UCPT Cascade Security Module

Production-grade spam filter and rate limiting system for Byzantine fault-tolerant UCPT propagation.

## Features

### Rate Limiting
- **10 announcements/minute** per peer (configurable)
- **100 KB/s bandwidth** limit per peer
- Automatic reset every 60 seconds
- Persistent state across restarts (SQLite)

### Proof-of-Work Challenges
- **3 leading zero bits** difficulty (SHA-256)
- Issued when peer exceeds rate limits
- Validates nonce: `SHA256(challenge + nonce)` must have 3 leading zero bits
- Prevents spam attacks while allowing legitimate traffic

### Automatic Peer Banning
- **5 invalid tokens** triggers 24-hour ban
- **Exponential backoff**: 24h → 48h → 96h → ...
- Automatic unban after duration expires
- Ban state persists across restarts

### Reputation-Based Quota Scaling
- **High reputation (>500)**: +50% quota (15 announcements/minute)
- **Low reputation (<100)**: -50% quota (5 announcements/minute)
- **Normal reputation**: Base quota (10 announcements/minute)
- Dynamic adjustment based on peer behavior

## Usage

```typescript
import { getSpamFilter } from './services/mesh/security/spamFilter';

const spamFilter = getSpamFilter();

// Check if peer can announce
const allowed = await spamFilter.checkRateLimit(peerDid);
if (!allowed) {
  // Generate PoW challenge
  const challenge = spamFilter.generateChallenge(peerDid, ucptHash);
  // Send challenge to peer
}

// Record announcement
await spamFilter.recordAnnouncement(peerDid, messageBytes);

// Record invalid token
await spamFilter.recordInvalidToken(peerDid);

// Check if banned
const banned = await spamFilter.isBanned(peerDid);

// Validate PoW solution
const valid = spamFilter.validateProofOfWork(challenge, nonce);
```

## Database Schema

Uses `rate_limit_state` table from `services/mesh/cache/schema.sql`:

```sql
CREATE TABLE rate_limit_state (
  peer_did TEXT PRIMARY KEY,
  announcements_count INTEGER DEFAULT 0,
  bandwidth_bytes INTEGER DEFAULT 0,
  invalid_count INTEGER DEFAULT 0,
  last_reset INTEGER NOT NULL,
  banned_until INTEGER,
  ban_count INTEGER DEFAULT 0
);
```

## Algorithms

### Rate Limit Check
1. Check if peer is banned
2. Get peer's reputation score
3. Calculate quota based on reputation
4. Check announcements count against quota
5. Check bandwidth rate against limit
6. Return allow/deny decision

### Proof-of-Work Validation
1. Calculate `hash = SHA256(challenge + nonce)`
2. Count leading zero bits in hash
3. Return `leadingZeroBits >= difficulty`

### Ban Logic
1. Increment invalid token counter
2. If counter >= 5:
   - Calculate ban duration: `24h * 2^(ban_count)`
   - Set `banned_until` timestamp
   - Reset invalid counter
   - Log ban event

### Quota Calculation
```typescript
if (reputation >= 500) {
  quota = baseQuota * 1.5  // +50%
} else if (reputation <= 100) {
  quota = baseQuota * 0.5  // -50%
} else {
  quota = baseQuota
}
```

## Performance

- **Rate limit check**: O(1) - single SQLite query
- **PoW validation**: O(1) - single SHA-256 hash
- **Ban check**: O(1) - indexed query
- **Quota calculation**: O(1) - cached reputation lookup

## Security Properties

### Byzantine Fault Tolerance
- Tolerates up to 33% malicious peers
- Invalid tokens trigger automatic banning
- PoW challenges prevent Sybil attacks
- Reputation-based throttling rewards honest behavior

### Spam Attack Mitigation
- Rate limiting prevents announcement floods
- Bandwidth throttling prevents payload floods
- PoW challenges increase attack cost
- Automatic banning removes persistent attackers

### Sybil Attack Resistance
- New peers start with low reputation
- Low reputation = reduced quota
- Building reputation requires valid UCPT history
- PoW challenges for low-reputation peers

## Monitoring

```typescript
const stats = await spamFilter.getStatistics();
console.log('Total peers:', stats.total_peers);
console.log('Banned peers:', stats.banned_peers);
console.log('High reputation:', stats.high_reputation_peers);
console.log('Low reputation:', stats.low_reputation_peers);
```

## Configuration

Environment variables:
- `DATA_DIR`: Database directory (default: ./data)

Constants (in code):
- `MAX_ANNOUNCEMENTS_PER_MINUTE`: 10
- `MAX_BANDWIDTH_PER_SECOND`: 100 KB/s
- `POW_DIFFICULTY`: 3 leading zero bits
- `MAX_INVALID_TOKENS`: 5
- `BASE_BAN_DURATION_MS`: 24 hours
- `HIGH_REPUTATION_THRESHOLD`: 500
- `LOW_REPUTATION_THRESHOLD`: 100
