import Database from 'better-sqlite3';
import { LedgerBlock, Task } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// PRODUCTION-GRADE PERSISTENCE SERVICE
// Implements ACID-compliant storage with SQLite + WAL mode
// Replaces localStorage with durable filesystem storage

const DATA_DIR = process.env.DATA_DIR || './data';
const DB_PATH = path.join(DATA_DIR, 'protogen.db');
const GENESIS_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

interface EncryptedVault {
  version: number;
  algorithm: 'AES-256-GCM';
  kdf: 'PBKDF2';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  authTag: string;
  createdAt: number;
  lastAccessed: number;
  backupCount: number;
}

export class PersistenceService {
  private db: Database.Database;
  private isInitialized = false;

  constructor() {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    }

    // Initialize database with WAL mode for concurrent reads
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = FULL'); // Ensure fsync on commit
    this.db.pragma('foreign_keys = ON');
    
    this.initializeSchema();
    this.isInitialized = true;
  }

  private initializeSchema(): void {
    // Run integrity check first
    const integrityResult = this.db.pragma('integrity_check') as Array<{ integrity_check: string }>;
    if (integrityResult[0].integrity_check !== 'ok') {
      console.error('DATABASE CORRUPTION DETECTED:', integrityResult);
      throw new Error('Database integrity check failed. Manual intervention required. Restore from backup.');
    }

    // Verify foreign key constraints
    const fkResult = this.db.pragma('foreign_key_check') as Array<any>;
    if (fkResult.length > 0) {
      console.error('FOREIGN KEY VIOLATIONS:', fkResult);
      throw new Error('Database has foreign key violations. Manual intervention required.');
    }

    // Ledger Blocks Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ledger_blocks (
        block_index INTEGER PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        prev_hash TEXT NOT NULL,
        hash TEXT NOT NULL UNIQUE,
        signature TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        merkle_root TEXT,
        state_root TEXT,
        gas_used INTEGER,
        confirmations INTEGER DEFAULT 0,
        task_data TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CHECK (block_index >= 0),
        CHECK (timestamp > 0),
        CHECK (length(hash) = 66),
        CHECK (length(prev_hash) = 66)
      );
      
      CREATE INDEX IF NOT EXISTS idx_ledger_timestamp ON ledger_blocks(timestamp);
      CREATE INDEX IF NOT EXISTS idx_ledger_hash ON ledger_blocks(hash);
    `);

    // State Storage Table (key-value store)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS state_storage (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );
    `);

    // Metadata Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Initialize metadata if empty
    const metaCount = this.db.prepare('SELECT COUNT(*) as count FROM metadata').get() as { count: number };
    if (metaCount.count === 0) {
      this.db.prepare(`
        INSERT INTO metadata (key, value) VALUES 
        ('schema_version', '1'),
        ('genesis_hash', ?),
        ('created_at', ?)
      `).run(GENESIS_HASH, Date.now());
    }
  }

  // --- LEDGER OPERATIONS ---

  public async appendBlock(block: LedgerBlock): Promise<void> {
    if (!this.isInitialized) throw new Error('PersistenceService not initialized');

    // Use transaction for atomicity
    const insert = this.db.prepare(`
      INSERT INTO ledger_blocks (
        block_index, timestamp, prev_hash, hash, signature,
        version, merkle_root, state_root, gas_used, confirmations, task_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      insert.run(
        block.index,
        block.timestamp,
        block.prevHash,
        block.hash,
        block.signature,
        block.version || 1,
        block.merkleRoot || null,
        block.stateRoot || null,
        block.gasUsed ? Number(block.gasUsed) : null,
        block.confirmations || 0,
        JSON.stringify(block.data)
      );
    });

    transaction();
  }

  public async getBlock(index: number): Promise<LedgerBlock | null> {
    const row = this.db.prepare(`
      SELECT * FROM ledger_blocks WHERE block_index = ?
    `).get(index) as any;

    if (!row) return null;

    return this.rowToBlock(row);
  }

  public async getChainHeight(): Promise<number> {
    const result = this.db.prepare(`
      SELECT COALESCE(MAX(block_index), -1) as height FROM ledger_blocks
    `).get() as { height: number };

    return result.height + 1; // Height is count, not max index
  }

  public async validateChainIntegrity(): Promise<boolean> {
    try {
      // 1. Check database integrity
      const integrityResult = this.db.pragma('integrity_check') as Array<{ integrity_check: string }>;
      if (integrityResult[0].integrity_check !== 'ok') {
        console.error('Database integrity check failed:', integrityResult);
        return false;
      }

      // 2. Check for gaps in block indices
      const gapCheck = this.db.prepare(`
        SELECT block_index FROM ledger_blocks 
        ORDER BY block_index ASC
      `).all() as Array<{ block_index: number }>;

      for (let i = 0; i < gapCheck.length; i++) {
        if (gapCheck[i].block_index !== i) {
          console.error(`Chain gap detected: expected index ${i}, found ${gapCheck[i].block_index}`);
          return false;
        }
      }

      // 3. Validate hash chain links
      const blocks = this.db.prepare(`
        SELECT block_index, prev_hash, hash FROM ledger_blocks ORDER BY block_index ASC
      `).all() as Array<{ block_index: number; prev_hash: string; hash: string }>;

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const expectedPrevHash = i === 0 ? GENESIS_HASH : blocks[i - 1].hash;

        if (block.prev_hash !== expectedPrevHash) {
          console.error(`Chain integrity violation at block ${block.block_index}: prev_hash mismatch`);
          console.error(`Expected: ${expectedPrevHash}, Got: ${block.prev_hash}`);
          return false;
        }

        // Validate hash format
        if (!/^0x[0-9a-f]{64}$/i.test(block.hash)) {
          console.error(`Invalid hash format at block ${block.block_index}: ${block.hash}`);
          return false;
        }
      }

      // 4. Check for duplicate hashes
      const duplicateCheck = this.db.prepare(`
        SELECT hash, COUNT(*) as count FROM ledger_blocks 
        GROUP BY hash HAVING count > 1
      `).all() as Array<{ hash: string; count: number }>;

      if (duplicateCheck.length > 0) {
        console.error('Duplicate block hashes detected:', duplicateCheck);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Chain validation error:', error);
      return false;
    }
  }

  public async getAllBlocks(): Promise<LedgerBlock[]> {
    const rows = this.db.prepare(`
      SELECT * FROM ledger_blocks ORDER BY block_index DESC
    `).all() as any[];

    return rows.map(row => this.rowToBlock(row));
  }

  private rowToBlock(row: any): LedgerBlock {
    return {
      index: row.block_index,
      timestamp: row.timestamp,
      prevHash: row.prev_hash,
      hash: row.hash,
      signature: row.signature,
      version: row.version,
      merkleRoot: row.merkle_root,
      stateRoot: row.state_root,
      gasUsed: row.gas_used ? BigInt(row.gas_used) : undefined,
      confirmations: row.confirmations,
      data: JSON.parse(row.task_data)
    };
  }

  // --- IDENTITY VAULT OPERATIONS ---

  public async storeIdentity(vault: EncryptedVault): Promise<void> {
    const vaultPath = path.join(DATA_DIR, 'vault.enc');
    const vaultJson = JSON.stringify(vault, null, 2);
    
    // Write with atomic rename to prevent corruption
    const tempPath = vaultPath + '.tmp';
    fs.writeFileSync(tempPath, vaultJson, { mode: 0o600 });
    fs.renameSync(tempPath, vaultPath);
  }

  public async loadIdentity(): Promise<EncryptedVault | null> {
    const vaultPath = path.join(DATA_DIR, 'vault.enc');
    
    if (!fs.existsSync(vaultPath)) {
      return null;
    }

    const vaultJson = fs.readFileSync(vaultPath, 'utf-8');
    return JSON.parse(vaultJson) as EncryptedVault;
  }

  // --- STATE MANAGEMENT ---

  public async saveState(key: string, value: any): Promise<void> {
    const valueJson = JSON.stringify(value);
    
    this.db.prepare(`
      INSERT OR REPLACE INTO state_storage (key, value, updated_at)
      VALUES (?, ?, ?)
    `).run(key, valueJson, Date.now());
  }

  public async loadState(key: string): Promise<any | null> {
    const row = this.db.prepare(`
      SELECT value FROM state_storage WHERE key = ?
    `).get(key) as { value: string } | undefined;

    if (!row) return null;

    return JSON.parse(row.value);
  }

  // --- BACKUP OPERATIONS ---

  public async createBackup(): Promise<string> {
    const backupDir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${timestamp}.db`);

    // Use SQLite backup API for consistent snapshot
    await this.db.backup(backupPath);
    
    return backupPath;
  }

  public async restoreFromBackup(backupPath: string): Promise<void> {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    // Close current database
    this.db.close();

    // Replace with backup
    fs.copyFileSync(backupPath, DB_PATH);

    // Reopen database
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = FULL');
    this.db.pragma('foreign_keys = ON');

    // Validate integrity
    const isValid = await this.validateChainIntegrity();
    if (!isValid) {
      throw new Error('Restored database failed integrity check');
    }
  }

  // --- UTILITY ---

  public close(): void {
    if (this.db) {
      this.db.close();
    }
  }

  public getDatabase(): Database.Database {
    return this.db;
  }
}

// Singleton instance
export const persistenceService = new PersistenceService();
