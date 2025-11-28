# CCC Blockchain Implementation

## Overview

The Causal Contribution Credits (CCC) blockchain is a distributed proof-of-work system for tracking computational contributions in the Anóteros Lógos network. This implementation provides production-grade consensus with cryptographic guarantees.

## Architecture

### Block Structure

```typescript
interface CCCBlock {
  // Header
  version: number;           // Protocol version
  index: number;             // Block height
  timestamp: number;         // Unix timestamp (ms)
  previousHash: string;      // SHA-256 of previous block
  merkleRoot: string;        // Merkle root of transactions
  difficulty: number;        // Mining difficulty (leading zeros)
  nonce: string;             // Proof-of-work nonce (32 bytes hex)
  
  // Body
  miner: string;             // DID of miner
  transactions: CCCTransaction[];
  
  // Validation
  hash: string;              // SHA-256 of header
  signature: string;         // Ed25519 signature by miner
  cumulativeDifficulty: bigint;
}
```

### Transaction Structure

```typescript
interface CCCTransaction {
  from: string;              // Sender DID
  to: string;                // Recipient DID
  amount: number;            // CCC amount (smallest unit)
  fee: number;               // Transaction fee
  nonce: number;             // Sender's tx counter
  timestamp: number;         // Unix timestamp (ms)
  data?: string;             // Optional metadata
  signature: string;         // Ed25519 signature
}
```

## Consensus Rules

### Proof-of-Work

- **Algorithm**: SHA-256
- **Target**: Hash must have N leading zeros (N = difficulty)
- **Genesis Difficulty**: 4 (2^16 average attempts)
- **Target Block Time**: 10 minutes
- **Adjustment Interval**: 2016 blocks

### Difficulty Adjustment

```
if (actual_time < expected_time / 2):
    difficulty += 1
elif (actual_time > expected_time * 2):
    difficulty = max(1, difficulty - 1)
```

### Chain Selection

- **Rule**: Longest chain by cumulative difficulty
- **Cumulative Difficulty**: Sum of 2^difficulty for all blocks
- **Max Reorg Depth**: 100 blocks

### Block Validation

1. **Size Check**: Block size ≤ 1MB
2. **Hash Verification**: Computed hash matches block.hash
3. **PoW Verification**: Hash meets difficulty target
4. **Merkle Root**: Computed merkle root matches block.merkleRoot
5. **Signature**: Valid Ed25519 signature from miner
6. **Transactions**: All transactions valid
7. **Chain Link**: Previous block exists (except genesis)
8. **Cumulative Difficulty**: Correctly calculated

### Transaction Validation

1. **Signature**: Valid Ed25519 signature from sender
2. **Amount**: Positive amount and non-negative fee
3. **Balance**: Sender has sufficient balance
4. **Nonce**: Correct sequence number (prev_nonce + 1)
5. **Timestamp**: Within ±1 hour of current time

## Economic Model

### Block Rewards

- **Initial Reward**: 50 CCC
- **Halving**: Every 210,000 blocks
- **Total Supply**: ~21 million CCC (asymptotic)

### Transaction Fees

- Fees paid to block miner
- Minimum fee: 0 CCC (but may be rejected by miners)
- Recommended fee: Based on network congestion

## Security Properties

### Cryptographic Guarantees

1. **Hash Chain Integrity**: Each block links to previous via SHA-256
2. **Signature Authenticity**: All blocks and transactions signed with Ed25519
3. **Double-Spend Prevention**: Nonce-based transaction ordering
4. **Sybil Resistance**: Proof-of-work mining cost

### Attack Resistance

- **51% Attack**: Requires majority of network hash power
- **Replay Attack**: Prevented by nonce and chain-specific hashing
- **Eclipse Attack**: Mitigated by peer diversity and reputation
- **Long-Range Attack**: Limited by MAX_REORG_DEPTH (100 blocks)

## Implementation Details

### Mining Process

```typescript
1. Collect pending transactions
2. Validate all transactions
3. Calculate merkle root
4. Initialize block header
5. Loop:
   a. Generate random nonce
   b. Calculate block hash
   c. If hash meets target, break
   d. Every 10k attempts, update timestamp
6. Sign block with miner's private key
7. Broadcast to network
```

### Chain Reorganization

```typescript
1. Detect competing chain with higher cumulative difficulty
2. Find common ancestor
3. Verify reorg depth ≤ MAX_REORG_DEPTH
4. Revert blocks from current chain
5. Apply blocks from new chain
6. Update chain state
```

### State Management

- **Account States**: Map<DID, {balance, nonce, lastUpdated}>
- **Block Cache**: Map<hash, CCCBlock>
- **Height Index**: Map<height, hash>
- **Chain State**: {height, tip, difficulty, cumulativeDifficulty, totalSupply}

## API Reference

### ConsensusService

```typescript
// Initialize with genesis block
await consensus.initializeGenesis(minerDID);

// Mine a new block
const block = await consensus.mineBlock(
  previousHash,
  difficulty,
  minerDID,
  transactions,
  privateKey
);

// Validate and add block
const accepted = await consensus.addBlock(block);

// Query chain state
const tip = consensus.getChainTip();
const state = consensus.getChainState();
const account = consensus.getAccountState(did);
```

### CCCBlockchainUtils

```typescript
// Create signed transaction
const tx = await CCCBlockchainUtils.createTransaction(
  fromDID,
  toDID,
  amount,
  fee,
  nonce,
  privateKey
);

// Serialize/deserialize blocks
const json = CCCBlockchainUtils.serializeBlock(block);
const block = CCCBlockchainUtils.deserializeBlock(json);

// Utility functions
const hash = CCCBlockchainUtils.calculateBlockHash(block);
const valid = CCCBlockchainUtils.verifyProofOfWork(hash, difficulty);
const reward = CCCBlockchainUtils.getBlockReward(height);
```

## Performance Characteristics

### Mining Performance

- **Target Hash Rate**: 1000 H/s (reference hardware)
- **Average Block Time**: 10 minutes
- **Block Size**: ~100 KB average, 1 MB maximum
- **Transactions per Block**: ~1000 average

### Storage Requirements

- **Block Storage**: ~50 MB per 1000 blocks
- **State Storage**: ~1 KB per account
- **Index Storage**: ~100 bytes per block

### Network Bandwidth

- **Block Propagation**: ~100 KB per block
- **Transaction Propagation**: ~500 bytes per transaction
- **Sync Bandwidth**: ~5 MB per 1000 blocks

## Testing Strategy

### Unit Tests

- Block validation logic
- Transaction validation logic
- Merkle tree calculation
- Difficulty adjustment
- Signature verification

### Property-Based Tests

- Hash chain integrity
- Cumulative difficulty monotonicity
- Account balance conservation
- Nonce sequence correctness
- Reorg depth limits

### Integration Tests

- Multi-node mining
- Chain reorganization
- Network synchronization
- Transaction propagation

## Future Enhancements

1. **UTXO Model**: Replace account model with UTXO for better privacy
2. **Smart Contracts**: Add Turing-complete scripting language
3. **Sharding**: Horizontal scaling via chain partitioning
4. **Zero-Knowledge Proofs**: Privacy-preserving transactions
5. **Cross-Chain Bridges**: Interoperability with other blockchains

## References

- Bitcoin Whitepaper: https://bitcoin.org/bitcoin.pdf
- Ethereum Yellow Paper: https://ethereum.github.io/yellowpaper/paper.pdf
- Ed25519 Signature Scheme: https://ed25519.cr.yp.to/
- Merkle Trees: https://en.wikipedia.org/wiki/Merkle_tree
- DID Specification: https://www.w3.org/TR/did-core/
