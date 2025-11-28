/**
 * ConsensusService - CCC Blockchain Consensus Implementation
 * 
 * Implements a distributed proof-of-work blockchain for Causal Contribution Credits (CCC).
 * Features:
 * - SHA-256 Proof-of-Work with adjustable difficulty
 * - Ed25519 signature validation
 * - Longest chain rule (cumulative difficulty)
 * - Merkle tree transaction verification
 * - Deterministic difficulty adjustment (every 2016 blocks)
 * - Chain reorganization support
 * 
 * Security Properties:
 * - All blocks must satisfy PoW (hash < target)
 * - All transactions must have valid Ed25519 signatures
 * - Chain integrity verified via hash links
 * - Double-spend prevention via nonce tracking
 */

import { CCCBlock, CCCTransaction, CCCChainState, CCCAccountState } from '../types';
import { createHash, randomBytes } from 'crypto';
import * as ed from '@noble/ed25519';

// Constants
const GENESIS_DIFFICULTY = 4; // 4 leading zeros = 2^16 hashes average
const TARGET_BLOCK_TIME_MS = 10 * 60 * 1000; // 10 minutes
const DIFFICULTY_ADJUSTMENT_INTERVAL = 2016; // Bitcoin-style
const MAX_BLOCK_SIZE = 1_000_000; // 1MB
const BLOCK_REWARD = 50_000_000; // 50 CCC (in smallest units)
const MAX_REORG_DEPTH = 100; // Maximum blocks to reorganize

/**
 * Canonical serialization for hashing
 */
function canonicalJSON(obj: any): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

/**
 * SHA-256 hash function
 */
function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Calculate merkle root of transactions
 */
function calculateMerkleRoot(transactions: CCCTransaction[]): string {
  if (transactions.length === 0) {
    return sha256('');
  }
  
  let hashes = transactions.map(tx => sha256(canonicalJSON(tx)));
  
  while (hashes.length > 1) {
    const newHashes: string[] = [];
    for (let i = 0; i < hashes.length; i += 2) {
      if (i + 1 < hashes.length) {
        newHashes.push(sha256(hashes[i] + hashes[i + 1]));
      } else {
        newHashes.push(hashes[i]); // Odd one out
      }
    }
    hashes = newHashes;
  }
  
  return hashes[0];
}

/**
 * Check if hash satisfies difficulty target
 */
function meetsTarget(hash: string, difficulty: number): boolean {
  const prefix = '0'.repeat(difficulty);
  return hash.startsWith(prefix);
}

/**
 * Calculate difficulty target from difficulty number
 */
function difficultyToTarget(difficulty: number): bigint {
  // Target = 2^256 / (2^difficulty)
  const maxTarget = BigInt(2) ** BigInt(256);
  return maxTarget / (BigInt(2) ** BigInt(difficulty));
}

/**
 * Serialize block header for hashing
 */
function serializeBlockHeader(block: Omit<CCCBlock, 'hash' | 'signature' | 'cumulativeDifficulty'>): string {
  return canonicalJSON({
    version: block.version,
    index: block.index,
    timestamp: block.timestamp,
    previousHash: block.previousHash,
    merkleRoot: block.merkleRoot,
    difficulty: block.difficulty,
    nonce: block.nonce,
    miner: block.miner
  });
}

/**
 * Serialize transaction for signing
 */
function serializeTransaction(tx: Omit<CCCTransaction, 'signature'>): string {
  return canonicalJSON({
    from: tx.from,
    to: tx.to,
    amount: tx.amount,
    fee: tx.fee,
    nonce: tx.nonce,
    timestamp: tx.timestamp,
    data: tx.data || ''
  });
}

export class ConsensusService {
  private chainState: CCCChainState;
  private accountStates: Map<string, CCCAccountState>;
  private blockCache: Map<string, CCCBlock>; // hash -> block
  private heightIndex: Map<number, string>; // height -> hash
  
  constructor() {
    this.chainState = {
      height: 0,
      tip: '',
      difficulty: GENESIS_DIFFICULTY,
      cumulativeDifficulty: BigInt(0),
      totalSupply: 0,
      lastAdjustment: 0
    };
    this.accountStates = new Map();
    this.blockCache = new Map();
    this.heightIndex = new Map();
  }
  
  /**
   * Initialize with genesis block
   */
  async initializeGenesis(minerDID: string): Promise<CCCBlock> {
    const genesisBlock: CCCBlock = {
      version: 1,
      index: 0,
      timestamp: Date.now(),
      previousHash: '0'.repeat(64),
      merkleRoot: sha256(''),
      difficulty: GENESIS_DIFFICULTY,
      nonce: '0'.repeat(64),
      miner: minerDID,
      transactions: [],
      hash: '',
      signature: '',
      cumulativeDifficulty: BigInt(0)
    };
    
    // Genesis block doesn't need PoW
    genesisBlock.hash = sha256(serializeBlockHeader(genesisBlock));
    
    // Store genesis
    this.blockCache.set(genesisBlock.hash, genesisBlock);
    this.heightIndex.set(0, genesisBlock.hash);
    this.chainState.tip = genesisBlock.hash;
    this.chainState.height = 0;
    
    return genesisBlock;
  }
  
  /**
   * Mine a new block with Proof-of-Work
   */
  async mineBlock(
    previousHash: string,
    difficulty: number,
    miner: string,
    transactions: CCCTransaction[],
    privateKey: Uint8Array
  ): Promise<CCCBlock> {
    const previousBlock = this.blockCache.get(previousHash);
    if (!previousBlock) {
      throw new Error(`Previous block not found: ${previousHash}`);
    }
    
    // Validate all transactions
    for (const tx of transactions) {
      await this.validateTransaction(tx);
    }
    
    const merkleRoot = calculateMerkleRoot(transactions);
    
    const block: Omit<CCCBlock, 'hash' | 'signature' | 'cumulativeDifficulty'> = {
      version: 1,
      index: previousBlock.index + 1,
      timestamp: Date.now(),
      previousHash,
      merkleRoot,
      difficulty,
      nonce: '',
      miner,
      transactions
    };
    
    // Proof-of-Work mining
    let attempts = 0;
    let hash = '';
    
    while (true) {
      block.nonce = randomBytes(32).toString('hex');
      hash = sha256(serializeBlockHeader(block));
      
      if (meetsTarget(hash, difficulty)) {
        break;
      }
      
      attempts++;
      if (attempts % 10000 === 0) {
        // Update timestamp every 10k attempts to prevent stale blocks
        block.timestamp = Date.now();
      }
    }
    
    // Sign the block
    const signature = await ed.signAsync(Buffer.from(hash, 'hex'), privateKey);
    
    const minedBlock: CCCBlock = {
      ...block,
      hash,
      signature: Buffer.from(signature).toString('hex'),
      cumulativeDifficulty: previousBlock.cumulativeDifficulty + BigInt(2 ** difficulty)
    };
    
    return minedBlock;
  }
  
  /**
   * Validate a block (PoW + signature + transactions)
   */
  async validateBlock(block: CCCBlock): Promise<boolean> {
    try {
      // 1. Check block size
      const blockSize = JSON.stringify(block).length;
      if (blockSize > MAX_BLOCK_SIZE) {
        console.error(`Block exceeds max size: ${blockSize} > ${MAX_BLOCK_SIZE}`);
        return false;
      }
      
      // 2. Verify hash
      const computedHash = sha256(serializeBlockHeader(block));
      if (computedHash !== block.hash) {
        console.error('Block hash mismatch');
        return false;
      }
      
      // 3. Verify Proof-of-Work
      if (!meetsTarget(block.hash, block.difficulty)) {
        console.error('Block does not meet difficulty target');
        return false;
      }
      
      // 4. Verify merkle root
      const computedMerkleRoot = calculateMerkleRoot(block.transactions);
      if (computedMerkleRoot !== block.merkleRoot) {
        console.error('Merkle root mismatch');
        return false;
      }
      
      // 5. Verify miner signature
      const publicKey = await this.extractPublicKeyFromDID(block.miner);
      const isValidSignature = await ed.verifyAsync(
        Buffer.from(block.signature, 'hex'),
        Buffer.from(block.hash, 'hex'),
        publicKey
      );
      
      if (!isValidSignature) {
        console.error('Invalid miner signature');
        return false;
      }
      
      // 6. Verify all transactions
      for (const tx of block.transactions) {
        const isValid = await this.validateTransaction(tx);
        if (!isValid) {
          console.error(`Invalid transaction in block: ${tx.from} -> ${tx.to}`);
          return false;
        }
      }
      
      // 7. Verify previous block exists (except genesis)
      if (block.index > 0) {
        const prevBlock = this.blockCache.get(block.previousHash);
        if (!prevBlock) {
          console.error('Previous block not found');
          return false;
        }
        
        // Verify cumulative difficulty
        const expectedCumulativeDifficulty = prevBlock.cumulativeDifficulty + BigInt(2 ** block.difficulty);
        if (block.cumulativeDifficulty !== expectedCumulativeDifficulty) {
          console.error('Cumulative difficulty mismatch');
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Block validation error:', error);
      return false;
    }
  }
  
  /**
   * Validate a transaction
   */
  async validateTransaction(tx: CCCTransaction): Promise<boolean> {
    try {
      // 1. Verify signature
      const publicKey = await this.extractPublicKeyFromDID(tx.from);
      const txData = serializeTransaction(tx);
      const isValidSignature = await ed.verifyAsync(
        Buffer.from(tx.signature, 'hex'),
        Buffer.from(sha256(txData), 'hex'),
        publicKey
      );
      
      if (!isValidSignature) {
        console.error('Invalid transaction signature');
        return false;
      }
      
      // 2. Check amount and fee are positive
      if (tx.amount <= 0 || tx.fee < 0) {
        console.error('Invalid amount or fee');
        return false;
      }
      
      // 3. Check sender has sufficient balance
      const senderState = this.accountStates.get(tx.from);
      if (senderState) {
        const totalCost = tx.amount + tx.fee;
        if (senderState.balance < totalCost) {
          console.error('Insufficient balance');
          return false;
        }
        
        // 4. Check nonce
        if (tx.nonce !== senderState.nonce + 1) {
          console.error('Invalid nonce');
          return false;
        }
      }
      
      // 5. Check timestamp is reasonable (within 1 hour)
      const now = Date.now();
      if (Math.abs(tx.timestamp - now) > 60 * 60 * 1000) {
        console.error('Transaction timestamp too far from current time');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Transaction validation error:', error);
      return false;
    }
  }
  
  /**
   * Add a validated block to the chain
   */
  async addBlock(block: CCCBlock): Promise<boolean> {
    // Validate first
    const isValid = await this.validateBlock(block);
    if (!isValid) {
      return false;
    }
    
    // Check if we already have this block
    if (this.blockCache.has(block.hash)) {
      return true; // Already have it
    }
    
    // Store block
    this.blockCache.set(block.hash, block);
    this.heightIndex.set(block.index, block.hash);
    
    // Check if this extends the main chain
    if (block.previousHash === this.chainState.tip) {
      // Direct extension
      this.chainState.tip = block.hash;
      this.chainState.height = block.index;
      this.chainState.cumulativeDifficulty = block.cumulativeDifficulty;
      
      // Apply transactions to state
      await this.applyBlockTransactions(block);
      
      // Check if difficulty adjustment needed
      if (block.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && block.index > 0) {
        await this.adjustDifficulty();
      }
      
      return true;
    }
    
    // Check if this is a better chain (higher cumulative difficulty)
    const currentTip = this.blockCache.get(this.chainState.tip);
    if (currentTip && block.cumulativeDifficulty > currentTip.cumulativeDifficulty) {
      // Potential reorganization
      const reorgDepth = currentTip.index - this.findCommonAncestor(block.hash, this.chainState.tip);
      
      if (reorgDepth > MAX_REORG_DEPTH) {
        console.error(`Reorg depth ${reorgDepth} exceeds maximum ${MAX_REORG_DEPTH}`);
        return false;
      }
      
      console.warn(`Chain reorganization detected: depth ${reorgDepth}`);
      await this.reorganize(block.hash);
      return true;
    }
    
    return true; // Block stored but not on main chain
  }
  
  /**
   * Apply block transactions to account states
   */
  private async applyBlockTransactions(block: CCCBlock): Promise<void> {
    // Credit miner with block reward
    const minerState = this.accountStates.get(block.miner) || {
      did: block.miner,
      balance: 0,
      nonce: 0,
      lastUpdated: block.index
    };
    
    minerState.balance += BLOCK_REWARD;
    minerState.lastUpdated = block.index;
    this.accountStates.set(block.miner, minerState);
    
    // Apply transactions
    for (const tx of block.transactions) {
      // Debit sender
      const senderState = this.accountStates.get(tx.from)!;
      senderState.balance -= (tx.amount + tx.fee);
      senderState.nonce = tx.nonce;
      senderState.lastUpdated = block.index;
      this.accountStates.set(tx.from, senderState);
      
      // Credit recipient
      const recipientState = this.accountStates.get(tx.to) || {
        did: tx.to,
        balance: 0,
        nonce: 0,
        lastUpdated: block.index
      };
      recipientState.balance += tx.amount;
      recipientState.lastUpdated = block.index;
      this.accountStates.set(tx.to, recipientState);
      
      // Credit miner with fee
      minerState.balance += tx.fee;
    }
    
    // Update total supply
    this.chainState.totalSupply += BLOCK_REWARD;
  }
  
  /**
   * Find common ancestor of two blocks
   */
  private findCommonAncestor(hash1: string, hash2: string): number {
    const block1 = this.blockCache.get(hash1);
    const block2 = this.blockCache.get(hash2);
    
    if (!block1 || !block2) {
      return 0;
    }
    
    let current1 = block1;
    let current2 = block2;
    
    // Walk back to same height
    while (current1.index > current2.index) {
      const prev = this.blockCache.get(current1.previousHash);
      if (!prev) break;
      current1 = prev;
    }
    
    while (current2.index > current1.index) {
      const prev = this.blockCache.get(current2.previousHash);
      if (!prev) break;
      current2 = prev;
    }
    
    // Walk back together until common ancestor
    while (current1.hash !== current2.hash) {
      const prev1 = this.blockCache.get(current1.previousHash);
      const prev2 = this.blockCache.get(current2.previousHash);
      if (!prev1 || !prev2) break;
      current1 = prev1;
      current2 = prev2;
    }
    
    return current1.index;
  }
  
  /**
   * Reorganize chain to new tip
   */
  private async reorganize(newTipHash: string): Promise<void> {
    const newTip = this.blockCache.get(newTipHash);
    if (!newTip) {
      throw new Error('New tip block not found');
    }
    
    // Find common ancestor
    const commonAncestorHeight = this.findCommonAncestor(newTipHash, this.chainState.tip);
    
    // Revert blocks from current chain
    for (let height = this.chainState.height; height > commonAncestorHeight; height--) {
      const blockHash = this.heightIndex.get(height);
      if (blockHash) {
        const block = this.blockCache.get(blockHash);
        if (block) {
          await this.revertBlockTransactions(block);
        }
      }
    }
    
    // Apply blocks from new chain
    const blocksToApply: CCCBlock[] = [];
    let current = newTip;
    while (current.index > commonAncestorHeight) {
      blocksToApply.unshift(current);
      const prev = this.blockCache.get(current.previousHash);
      if (!prev) break;
      current = prev;
    }
    
    for (const block of blocksToApply) {
      await this.applyBlockTransactions(block);
      this.heightIndex.set(block.index, block.hash);
    }
    
    // Update chain state
    this.chainState.tip = newTipHash;
    this.chainState.height = newTip.index;
    this.chainState.cumulativeDifficulty = newTip.cumulativeDifficulty;
  }
  
  /**
   * Revert block transactions from account states
   */
  private async revertBlockTransactions(block: CCCBlock): Promise<void> {
    // Revert miner reward
    const minerState = this.accountStates.get(block.miner);
    if (minerState) {
      minerState.balance -= BLOCK_REWARD;
    }
    
    // Revert transactions in reverse order
    for (let i = block.transactions.length - 1; i >= 0; i--) {
      const tx = block.transactions[i];
      
      // Credit sender
      const senderState = this.accountStates.get(tx.from);
      if (senderState) {
        senderState.balance += (tx.amount + tx.fee);
        senderState.nonce = tx.nonce - 1;
      }
      
      // Debit recipient
      const recipientState = this.accountStates.get(tx.to);
      if (recipientState) {
        recipientState.balance -= tx.amount;
      }
      
      // Debit miner fee
      if (minerState) {
        minerState.balance -= tx.fee;
      }
    }
    
    // Update total supply
    this.chainState.totalSupply -= BLOCK_REWARD;
  }
  
  /**
   * Adjust mining difficulty based on last 2016 blocks
   */
  private async adjustDifficulty(): Promise<void> {
    const currentHeight = this.chainState.height;
    const adjustmentBlock = this.blockCache.get(this.heightIndex.get(currentHeight)!);
    const previousAdjustmentBlock = this.blockCache.get(
      this.heightIndex.get(currentHeight - DIFFICULTY_ADJUSTMENT_INTERVAL)!
    );
    
    if (!adjustmentBlock || !previousAdjustmentBlock) {
      return;
    }
    
    const actualTime = adjustmentBlock.timestamp - previousAdjustmentBlock.timestamp;
    const expectedTime = DIFFICULTY_ADJUSTMENT_INTERVAL * TARGET_BLOCK_TIME_MS;
    
    // Calculate new difficulty
    let newDifficulty = this.chainState.difficulty;
    
    if (actualTime < expectedTime / 2) {
      // Blocks coming too fast, increase difficulty
      newDifficulty++;
    } else if (actualTime > expectedTime * 2) {
      // Blocks coming too slow, decrease difficulty
      newDifficulty = Math.max(1, newDifficulty - 1);
    }
    
    this.chainState.difficulty = newDifficulty;
    this.chainState.lastAdjustment = currentHeight;
    
    console.log(`Difficulty adjusted to ${newDifficulty} at height ${currentHeight}`);
  }
  
  /**
   * Get current chain tip
   */
  getChainTip(): CCCBlock | null {
    return this.blockCache.get(this.chainState.tip) || null;
  }
  
  /**
   * Get block by hash
   */
  getBlock(hash: string): CCCBlock | null {
    return this.blockCache.get(hash) || null;
  }
  
  /**
   * Get block by height
   */
  getBlockByHeight(height: number): CCCBlock | null {
    const hash = this.heightIndex.get(height);
    return hash ? this.blockCache.get(hash) || null : null;
  }
  
  /**
   * Get account state
   */
  getAccountState(did: string): CCCAccountState | null {
    return this.accountStates.get(did) || null;
  }
  
  /**
   * Get chain state
   */
  getChainState(): CCCChainState {
    return { ...this.chainState };
  }
  
  /**
   * Get entire chain as array of blocks
   */
  getChain(): CCCBlock[] {
    const chain: CCCBlock[] = [];
    let currentHash = this.chainState.tip;
    
    while (currentHash && currentHash !== '0'.repeat(64)) {
      const block = this.blockCache.get(currentHash);
      if (!block) break;
      chain.unshift(block);
      currentHash = block.previousHash;
    }
    
    return chain;
  }
  
  /**
   * Extract Ed25519 public key from DID
   * DID format: did:key:z<multibase-multicodec-encoded-public-key>
   * 
   * Multicodec prefix for Ed25519: 0xed01
   * Multibase: base58btc (z prefix)
   */
  private async extractPublicKeyFromDID(did: string): Promise<Uint8Array> {
    if (!did.startsWith('did:key:z')) {
      throw new Error(`Invalid DID format: ${did}`);
    }
    
    try {
      // Import base58 decoder from multiformats
      const { base58btc } = await import('multiformats/bases/base58');
      
      // Remove 'did:key:' prefix
      const multibaseKey = did.substring(8);
      
      // Decode from base58btc
      const decoded = base58btc.decode(multibaseKey);
      
      // First two bytes are multicodec prefix (0xed01 for Ed25519)
      if (decoded[0] !== 0xed || decoded[1] !== 0x01) {
        throw new Error('Not an Ed25519 key');
      }
      
      // Return public key (skip 2-byte multicodec prefix)
      return decoded.slice(2);
    } catch (error) {
      throw new Error(`Failed to extract public key from DID: ${error}`);
    }
  }
}


/**
 * Utility functions for CCC blockchain serialization
 */
export class CCCBlockchainUtils {
  /**
   * Serialize block to JSON string
   */
  static serializeBlock(block: CCCBlock): string {
    return JSON.stringify({
      ...block,
      cumulativeDifficulty: block.cumulativeDifficulty.toString()
    });
  }
  
  /**
   * Deserialize block from JSON string
   */
  static deserializeBlock(json: string): CCCBlock {
    const obj = JSON.parse(json);
    return {
      ...obj,
      cumulativeDifficulty: BigInt(obj.cumulativeDifficulty)
    };
  }
  
  /**
   * Create a signed transaction
   */
  static async createTransaction(
    from: string,
    to: string,
    amount: number,
    fee: number,
    nonce: number,
    privateKey: Uint8Array,
    data?: string
  ): Promise<CCCTransaction> {
    const tx: Omit<CCCTransaction, 'signature'> = {
      from,
      to,
      amount,
      fee,
      nonce,
      timestamp: Date.now(),
      data
    };
    
    const txData = serializeTransaction(tx);
    const txHash = sha256(txData);
    const signature = await ed.signAsync(Buffer.from(txHash, 'hex'), privateKey);
    
    return {
      ...tx,
      signature: Buffer.from(signature).toString('hex')
    };
  }
  
  /**
   * Calculate block hash
   */
  static calculateBlockHash(block: Omit<CCCBlock, 'hash' | 'signature' | 'cumulativeDifficulty'>): string {
    return sha256(serializeBlockHeader(block));
  }
  
  /**
   * Verify block meets difficulty target
   */
  static verifyProofOfWork(hash: string, difficulty: number): boolean {
    return meetsTarget(hash, difficulty);
  }
  
  /**
   * Calculate cumulative difficulty
   */
  static calculateCumulativeDifficulty(previousCumulativeDifficulty: bigint, difficulty: number): bigint {
    return previousCumulativeDifficulty + BigInt(2 ** difficulty);
  }
  
  /**
   * Estimate mining time for given difficulty
   */
  static estimateMiningTime(difficulty: number, hashRate: number): number {
    // Average attempts = 2^difficulty
    const averageAttempts = 2 ** difficulty;
    // Time in milliseconds
    return (averageAttempts / hashRate) * 1000;
  }
  
  /**
   * Get block reward for given height
   */
  static getBlockReward(height: number): number {
    // Halving every 210,000 blocks (similar to Bitcoin)
    const halvings = Math.floor(height / 210000);
    if (halvings >= 64) return 0; // All coins mined
    
    return Math.floor(BLOCK_REWARD / (2 ** halvings));
  }
}

/**
 * Export constants for external use
 */
export const CCC_CONSTANTS = {
  GENESIS_DIFFICULTY,
  TARGET_BLOCK_TIME_MS,
  DIFFICULTY_ADJUSTMENT_INTERVAL,
  MAX_BLOCK_SIZE,
  BLOCK_REWARD,
  MAX_REORG_DEPTH
};


// Singleton instance
export const consensusService = new ConsensusService();
