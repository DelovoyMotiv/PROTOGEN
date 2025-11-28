# UCPT Consensus Module

Byzantine fault-tolerant voting protocol for resolving conflicting UCPT tokens.

## Algorithm

### Conflict Detection
Conflicts occur when multiple UCPT tokens have:
- Same `task_id`
- Different `result_hash`

This indicates multiple agents claiming different results for the same task.

### Byzantine Consensus Protocol

1. **Peer Selection**: Select 7 high-reputation peers (reputation >= 300)
2. **Vote Collection**: Query each peer for vote on each conflicting token
3. **Vote Weighting**: Weight votes by peer reputation (normalized to [0, 1])
4. **Quorum Check**: Require 5/7 weighted votes (71% Byzantine threshold)
5. **Winner Determination**: Token with most weighted votes wins
6. **Dispute Marking**: Mark losing tokens as `disputed` in cache
7. **Reputation Penalty**: Deduct 100 points from issuers of disputed tokens
8. **Broadcast**: Notify all peers of resolution

## Byzantine Fault Tolerance

The protocol tolerates up to **33% malicious peers** (2 out of 7).

**Quorum Threshold**: 5/7 = 71%
- Honest majority: 5 honest + 2 malicious = 5/7 quorum ✓
- Malicious majority: 3 honest + 4 malicious = 4/7 no quorum ✗

## Usage

```typescript
import { getUCPTConsensus } from './services/mesh/consensus/ucptConsensus';

const consensus = getUCPTConsensus();

// Detect conflicts
const conflicts = await consensus.detectConflict(newToken);

if (conflicts.length > 0) {
  // Resolve via Byzantine consensus
  const allTokens = [newToken, ...conflicts];
  const winnerHash = await consensus.resolveConflict(allTokens);
  
  console.log('Winner:', winnerHash);
}

// Get statistics
const stats = await consensus.getStatistics();
console.log('Total disputes:', stats.total_disputes);
console.log('Resolved:', stats.resolved_disputes);
```

## Vote Weighting

Votes are weighted by peer reputation to incentivize honest behavior:

```typescript
normalizedWeight = min(peerReputation / 1000, 1.0)
```

Examples:
- Reputation 1000: weight = 1.0
- Reputation 500: weight = 0.5
- Reputation 300: weight = 0.3

## Dispute Resolution

### Winner
- Marked as canonical in cache
- Status remains `completed` or `failed`
- Issuer reputation unchanged

### Losers
- Status changed to `disputed`
- Issuer reputation penalized (-100 points)
- Broadcast to all peers

## Database Schema

Uses existing tables:
- `ucpt_cache`: Status field updated to 'disputed'
- `peer_votes`: Records all votes with weights
- `reputation_cache`: Updated with penalties

## Performance

- **Conflict Detection**: O(n) where n = tokens with same task_id
- **Peer Selection**: O(m log m) where m = total peers
- **Vote Collection**: O(7 * k) where k = conflicting tokens
- **Quorum Check**: O(7 * k)
- **Total**: O(n + m log m + 7k) ≈ O(n + m log m)

Typical resolution time: **< 10 seconds**

## Security Properties

### Byzantine Fault Tolerance
- Tolerates 33% malicious peers
- Requires 71% honest majority
- Reputation-weighted voting prevents Sybil attacks

### Incentive Alignment
- Honest voting: No penalty
- Dishonest voting: Risk reputation loss if minority
- Issuing fake UCPT: -100 reputation penalty

### Attack Resistance
- **Sybil Attack**: Prevented by reputation weighting
- **Collusion**: Requires 5/7 colluding high-reputation peers
- **Eclipse Attack**: Mitigated by random peer selection

## Configuration

Constants (in code):
- `CONSENSUS_PEER_COUNT`: 7 peers
- `CONSENSUS_QUORUM`: 5 votes (71%)
- `MIN_PEER_REPUTATION`: 300
- `DISPUTE_PENALTY`: 100 points
- `VOTE_TIMEOUT_MS`: 10 seconds

## Integration

Automatically integrated into UCPT Cascade:
- Conflicts detected on token receipt
- Consensus triggered automatically
- Losing tokens rejected
- Winning tokens stored normally

## Monitoring

```typescript
const stats = await consensus.getStatistics();

console.log({
  total_disputes: stats.total_disputes,
  resolved_disputes: stats.resolved_disputes,
  pending_disputes: stats.pending_disputes,
  avg_resolution_time: stats.avg_resolution_time
});
```

## Mathematical Foundation

### Byzantine Generals Problem
Given n peers with up to f malicious:
- Require: n >= 3f + 1
- Our setup: n=7, f=2 → 7 >= 3(2) + 1 = 7 ✓

### Quorum Intersection
Any two quorums must intersect in at least one honest peer:
- Quorum size: 5
- Intersection: 5 + 5 - 7 = 3 peers
- Malicious: 2 peers
- Honest intersection: 3 - 2 = 1 ✓

This guarantees consistency across concurrent consensus rounds.
