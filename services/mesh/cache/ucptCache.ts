/**
 * UCPT Cache Implementation
 * 
 * Production-grade SQLite-based cache for UCPT tokens
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { IUCPTCache } from './interfaces';
import { UCPTToken, UCPTQuery } from '../types';

const DATA_DIR = process.env.DATA_DIR || './data';
const CACHE_DB_PATH = path.join(DATA_DIR, 'ucpt_cache.db');

export class UCPTCache implements IUCPTCache {
  private db: Database.Database;
  private readonly maxCacheSize: number;

  constructor(maxCacheSizeBytes: number = 100 * 1024 * 1024) {
    this.maxCacheSize = maxCacheSizeBytes;

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    }

    this.db = new Database(CACHE_DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('temp_store = MEMORY');

    this.initializeSchema();
  }

  private initializeSchema(): void {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema);
    console.log('[UCPTCache] Database initialized');
  }

  public async store(token: UCPTToken, peer_id: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ucpt_cache (
        hash, token_data, issuer_did, subject_did, task_id, task_type,
        status, issued_at, expires_at, parent_hash, peer_confirmations
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
        COALESCE((SELECT peer_confirmations FROM ucpt_cache WHERE hash = ?), 0) + 1
      )
    `);

    const tokenData = Buffer.from(JSON.stringify(token));

    stmt.run(
      token.hash,
      tokenData,
      token.metadata.issuer_did,
      token.metadata.subject_did || null,
      token.metadata.task_id,
      token.metadata.task_type,
      token.metadata.status,
      token.metadata.issued_at,
      token.metadata.expires_at || null,
      token.metadata.parent_hash || null,
      token.hash
    );

    await this.evictIfNeeded();
  }

  public async query(filter: UCPTQuery): Promise<UCPTToken[]> {
    let sql = 'SELECT token_data FROM ucpt_cache WHERE 1=1';
    const params: any[] = [];

    if (filter.issuer) {
      sql += ' AND issuer_did = ?';
      params.push(filter.issuer);
    }

    if (filter.subject) {
      sql += ' AND subject_did = ?';
      params.push(filter.subject);
    }

    if (filter.min_score !== undefined) {
      sql += ' AND validation_score >= ?';
      params.push(filter.min_score);
    }

    if (filter.after) {
      sql += ' AND issued_at > ?';
      params.push(Math.floor(filter.after.getTime() / 1000));
    }

    sql += ' ORDER BY issued_at DESC';

    if (filter.limit) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as Array<{ token_data: Buffer }>;

    return rows.map(row => JSON.parse(row.token_data.toString()));
  }

  public async get(hash: string): Promise<UCPTToken | null> {
    const stmt = this.db.prepare(`
      UPDATE ucpt_cache 
      SET last_accessed = strftime('%s', 'now'), access_count = access_count + 1
      WHERE hash = ?
      RETURNING token_data
    `);

    const row = stmt.get(hash) as { token_data: Buffer } | undefined;
    if (!row) return null;

    return JSON.parse(row.token_data.toString());
  }

  public async has(hash: string): Promise<boolean> {
    const stmt = this.db.prepare('SELECT 1 FROM ucpt_cache WHERE hash = ? LIMIT 1');
    return stmt.get(hash) !== undefined;
  }

  public async getReputationScore(did: string): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT overall_score FROM reputation_cache WHERE did = ?
    `);

    const row = stmt.get(did) as { overall_score: number } | undefined;
    return row?.overall_score || 0;
  }

  public async pruneExpired(): Promise<number> {
    const stmt = this.db.prepare(`
      DELETE FROM ucpt_cache 
      WHERE expires_at IS NOT NULL AND expires_at < strftime('%s', 'now')
    `);

    const result = stmt.run();
    return result.changes;
  }

  public async getSize(): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()
    `);

    const row = stmt.get() as { size: number };
    return row.size;
  }

  public async evictIfNeeded(): Promise<number> {
    const currentSize = await this.getSize();
    
    if (currentSize <= this.maxCacheSize) {
      return 0;
    }

    const totalTokens = this.db.prepare('SELECT COUNT(*) as count FROM ucpt_cache').get() as { count: number };
    const tokensToEvict = Math.floor(totalTokens.count * 0.2);
    const tokensToKeep = Math.max(10000, totalTokens.count - tokensToEvict);

    const stmt = this.db.prepare(`
      DELETE FROM ucpt_cache 
      WHERE hash NOT IN (
        SELECT hash FROM ucpt_cache 
        ORDER BY last_accessed DESC 
        LIMIT ?
      )
    `);

    const result = stmt.run(tokensToKeep);
    console.log(`[UCPTCache] Evicted ${result.changes} tokens (LRU policy)`);
    
    return result.changes;
  }

  public close(): void {
    this.db.close();
  }
}

let cacheInstance: UCPTCache | null = null;

export function getUCPTCache(maxCacheSizeBytes?: number): UCPTCache {
  if (!cacheInstance) {
    cacheInstance = new UCPTCache(maxCacheSizeBytes);
  }
  return cacheInstance;
}
