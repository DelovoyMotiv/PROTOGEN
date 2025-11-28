# UCPT Cascade Gossip Protocol

Byzantine fault-tolerant epidemic-style propagation protocol for UCPT tokens.

## Three-Phase Architecture

### Phase 1: Push (Eager Propagation)
- New tokens immediately propagated to K random peers (default K=3)
- Sends UCPT_ANNOUNCE with hash and metadata
- Peers check bloom filter before requesting payload
- Achieves 90% coverage within 60 seconds

### Phase 2: Pull (Periodic Synchronization)
- Every 30 seconds, broadcast DIGEST with bloom filter
- Peers compare with local cache and request missing tokens
- Bandwidth-efficient using probabilistic data structures
- Handles network partitions and late joiners

### Phase 3: Anti-Entropy (Merkle Tree Reconciliation)
- Every 5 minutes, sync with random peer
- Exchange Merkle tree root hashes
- Resolve conflicts via timestamp and signature
- Ensures eventual consistency (95% agreement within 5 minutes)

## Message Types

```typescript
type GossipMessage =
  | { type: 'UCPT_ANNOUNCE', hash: string, metadata: UCPTMetadata }
  | { type: 'UCPT_REQUEST', hash: string }
  | { type: 'UCPT_RESPONSE', token: UCPTToken, signature: string }
  | { type: 'DIGEST', bloom_filter: Uint8Array, peer_id: string }
  | { type: 'SYNC_REQUEST', merkle_root: string }
  | { type: 'SYNC_RESPONSE', missing_hashes: string[] };
```

## Usage

```typescript
import { getUCPTCascade } from './services/mesh/gossip/ucptCascade';

const cascade = getUCPTCascade();

// Start periodic synchronization
cascade.startDigestBroadcast();
cascade.startAntiEntropy();

// Propagate new token
await cascade.propagate(ucptToken);

// Handle incoming message
await cascade.handleMessage(gossipMsg, fromDid);

// Get metrics
const metrics = cascade.getMetrics();
console.log('Tokens propagated:', metrics.tokens_propagated);
console.log('Coverage:', metrics.coverage_percentage);
```

## Configuration

Environment variables:
- `UCPT_GOSSIP_FANOUT`: Number of peers for push phase (default: 3)
- `UCPT_SYNC_INTERVAL`: Digest broadcast interval in ms (default: 30000)

## Performance Characteristics

- **Propagation Latency**: 90% coverage in <60s
- **Bandwidth Overhead**: <5% of total mesh traffic
- **Consensus Latency**: Conflict resolution in <5 minutes
- **Scalability**: Tested with 100+ nodes

## Byzantine Fault Tolerance

- Validates all tokens before acceptance
- Queries 3 random peers for consensus (2/3 threshold)
- Detects and marks conflicting tokens as disputed
- Penalizes issuers of invalid tokens (-100 reputation)

## Anti-Spam Measures

- Rate limiting: 10 announcements/minute per peer
- Bandwidth throttling: 100 KB/s per peer
- Proof-of-work challenges for rate limit violations
- Automatic peer banning after 5 invalid tokens

## Metrics

- `tokens_propagated`: Total tokens sent to network
- `tokens_received`: Total tokens received and validated
- `bandwidth_bytes`: Total gossip protocol bandwidth
- `coverage_percentage`: Percentage of peers reached in last propagation
