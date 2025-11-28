import { Task, LedgerBlock } from '../types';
import { identityService } from './identity';
import { CryptoService } from './crypto';
import { persistenceService } from './persistence';

// SECURE LEDGER
// Implements a local append-only hash chain.
// - Integrity: SHA-256 linking
// - Authenticity: Ed25519 signature per block
// - Persistence: SQLite with WAL mode (Production-ready)

const GENESIS_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

export class SecureLedger {
  private isInitialized = false;
  private cachedHistory: Task[] = [];

  constructor() {
    this.loadChain();
  }

  private async loadChain() {
    try {
      // Validate chain integrity on boot
      const isValid = await persistenceService.validateChainIntegrity();
      if (!isValid) {
        console.error("Ledger Corruption Detected: Chain integrity check failed");
        throw new Error("Ledger corruption detected. Manual intervention required.");
      }
      
      // Load history into cache
      await this.refreshCache();
      
      this.isInitialized = true;
    } catch (e) {
      console.error("Ledger Initialization Failed:", e);
      throw e;
    }
  }

  private async refreshCache() {
    const blocks = await persistenceService.getAllBlocks();
    this.cachedHistory = blocks.map(block => block.data);
  }

  public async validateChainIntegrity(): Promise<boolean> {
    return await persistenceService.validateChainIntegrity();
  }

  public async logTask(task: Task): Promise<LedgerBlock> {
    if (!this.isInitialized) await this.loadChain();

    const height = await persistenceService.getChainHeight();
    const index = height;
    const prevHash = index === 0 ? GENESIS_HASH : (await persistenceService.getBlock(index - 1))!.hash;
    const timestamp = Date.now();

    const hash = await this.calculateBlockHash(index, timestamp, prevHash, task);
    const signature = await identityService.signAttestation(hash);

    const newBlock: LedgerBlock = {
      index,
      timestamp,
      prevHash,
      hash,
      data: task,
      signature,
      version: 1,
      merkleRoot: hash, // Use block hash as merkle root for single transaction
      stateRoot: hash,  // Use block hash as state root
      gasUsed: 0n,      // No gas in current implementation
      confirmations: 0
    };

    // Persist to SQLite with fsync guarantee
    await persistenceService.appendBlock(newBlock);
    
    // Refresh cache
    await this.refreshCache();
    
    return newBlock;
  }

  public getHistory(): Task[] {
    // Return cached history (synchronous for UI compatibility)
    return this.cachedHistory;
  }

  public async getChainHeight(): Promise<number> {
    return await persistenceService.getChainHeight();
  }

  public async getLatestHash(): Promise<string> {
    const height = await persistenceService.getChainHeight();
    if (height === 0) return GENESIS_HASH;
    const latestBlock = await persistenceService.getBlock(height - 1);
    return latestBlock!.hash;
  }

  public async clear() {
    // Not implemented for production - use backup/restore instead
    throw new Error('Clear operation not supported in production mode. Use backup/restore.');
  }

  private async calculateBlockHash(index: number, timestamp: number, prevHash: string, data: Task): Promise<string> {
    const payload = `${index}:${timestamp}:${prevHash}:${JSON.stringify(data)}`;
    const encoder = new TextEncoder();
    const buffer = encoder.encode(payload);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return '0x' + Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

export const memoryService = new SecureLedger();