# Reputation Engine

Production-grade reputation scoring system based on UCPT history.

## Formula

```
REPUTATION = (SUCCESSFUL × 10) - (FAILED × 20) + (CONFIRMATIONS × 5) - AGE_PENALTY
```

## Features

- **Time-based Decay**: Weekly decay factor (0.95) applied automatically every 24 hours
- **Peer Opinion Aggregation**: Weighted average of peer votes
- **Dispute Penalties**: -100 points for disputed tokens
- **Performance Tracking**: Success rate, average task time, total earned
- **Caching**: 60-second TTL for score queries

## Usage

```typescript
import { getReputationEngine } from './services/mesh/reputation/reputationEngine';

const engine = getReputationEngine();

// Calculate score
const score = await engine.calculateScore('did:key:...');
console.log(score.overall, score.success_rate, score.peer_trust);

// Update after task
await engine.updateAfterTask('did:key:...', true, 10.5, 5000);

// Record peer vote
await engine.recordPeerVote('ucpt_hash', 'voter_did', true, 1.0);

// Get top agents
const top = await engine.getTopAgents(10);

// Penalize disputed token
await engine.penalizeDispute('did:key:...');
```

## Database Schema

Uses `reputation_cache` table from `services/mesh/cache/schema.sql`:
- `did`: Agent DID (primary key)
- `overall_score`: Calculated reputation score
- `success_count`: Number of successful tasks
- `failure_count`: Number of failed tasks
- `peer_confirmations`: Total peer confirmations
- `total_earned`: Total USDC earned
- `avg_task_time`: Average task execution time (ms)
- `last_updated`: Unix timestamp of last update

## Decay Scheduler

Automatically runs every 24 hours to apply time-based decay to all scores.
Decay only applies to scores not updated in the last week.

## Configuration

Environment variables:
- `UCPT_REPUTATION_DECAY`: Weekly decay factor (default: 0.95)
- `DATA_DIR`: Database directory (default: ./data)
