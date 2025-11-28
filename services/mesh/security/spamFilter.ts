/**
 * UCPT Cascade Spam Filter Implementation
 * 
 * Production-grade security module implementing:
 * - Rate limiting (10 announcements/minute per peer)
 * - Bandwidth throttling (100 KB/s per peer)
 * - Proof-of-work challenges (3 leading zero bits)
 * - Automatic peer banning (5 invalid tokens = 24h ban)
 * - Reputation-based quota scaling (>500 reputation = +50% quota)
 * 
 * Uses SQLite for persistent state tracking across restarts.
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as crypto from 'crypto';
import { ISpamFilter } from './interfaces';
import { RateLimitState, ProofOfWork } from '../types';
import { getReputationEngine } from '../reputation/reputationEngine';

const DATA_DIR = process.env.DATA_DIR || './data';
const CACHE_DB_PATH = path.join(DATA_DIR, 'ucpt_cache.db');

// Rate limiting constants
const MAX_ANNOUNCEMENTS_PER_MINUTE = 10;
const MAX_BANDWIDTH_PER_SECOND = 100 * 1024; // 100 KB/s
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

// Proof-of-work constants
const POW_DIFFICULTY = 3; // Number of leading zero bits
const POW_MAX_NONCE = 1000000;

// Ban constants
const MAX_INVALID_TOKENS = 5;
const BASE_BAN_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const BAN_BACKOFF_MULTIPLIER = 2;

// Reputation thresholds
const HIGH_REPUTATION_THRESHOLD = 500;
const LOW_REPUTATION_THRESHOLD = 100;
const HIGH_REPUTATION_BONUS = 0.5; // +50%
const LOW_REPUTATION_PENALTY = 0.5; // -50%

export class SpamFilter implements ISpamFilter {
  private db: Database.Database;
  private reputationEngine = getReputationEngine();
  private resetInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.db = new Database(CACHE_DB_PATH);
    this.startResetScheduler();
    console.log('[SpamFilter] Initialized');
  }

  /**
   * Check if peer is allowed to announce UCPT
   */
  public async checkRateLimit(peerDid: string): Promise<boolean> {
    // Check if banned
    if (await this.isBanned(peerDid)) {
      console.warn(`[SpamFilter] Peer ${peerDid.substring(0, 16)}... is banned`);
      return false;
    }

    const state = await this.getRateLimitState(peerDid);
    const quota = await this.getQuota(peerDid);

    // Check announcement rate
    if (state.announcements >= quota) {
      console.warn(`[SpamFilter] Peer ${peerDid.substring(0, 16)}... exceeded announcement quota (${state.announcements}/${quota})`);
      return false;
    }

    // Check bandwidth rate
    const now = Date.now();
    const timeSinceReset = (now - state.last_reset * 1000) / 1000; // seconds
    const bandwidthRate = state.bandwidth_bytes / Math.max(timeSinceReset, 1);

    if (bandwidthRate > MAX_BANDWIDTH_PER_SECOND) {
      console.warn(`[SpamFilter] Peer ${peerDid.substring(0, 16)}... exceeded bandwidth quota (${Math.round(bandwidthRate)} bytes/s)`);
      return false;
    }

    return true;
  }

  /**
   * Record UCPT announcement from peer
   */
  public async recordAnnouncement(peerDid: string, bytes: number): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO rate_limit_state (peer_did, announcements_count, bandwidth_bytes, last_reset)
      VALUES (?, 1, ?, strftime('%s', 'now'))
      ON CONFLICT(peer_did) DO UPDATE SET
        announcements_count = announcements_count + 1,
        bandwidth_bytes = bandwidth_bytes + ?,
        last_reset = CASE 
          WHEN strftime('%s', 'now') - last_reset > 60 THEN strftime('%s', 'now')
          ELSE last_reset
        END
    `);

    stmt.run(peerDid, bytes, bytes);
  }

  /**
   * Check if peer is banned
   */
  public async isBanned(peerDid: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      SELECT banned_until FROM rate_limit_state
      WHERE peer_did = ? AND banned_until IS NOT NULL AND banned_until > strftime('%s', 'now')
    `);

    const row = stmt.get(peerDid);
    return row !== undefined;
  }

  /**
   * Ban peer for specified duration
   */
  public async banPeer(peerDid: string, durationMs: number): Promise<void> {
    const bannedUntil = Math.floor((Date.now() + durationMs) / 1000);

    const stmt = this.db.prepare(`
      INSERT INTO rate_limit_state (peer_did, banned_until, ban_count, last_reset)
      VALUES (?, ?, 1, strftime('%s', 'now'))
      ON CONFLICT(peer_did) DO UPDATE SET
        banned_until = ?,
        ban_count = ban_count + 1
    `);

    stmt.run(peerDid, bannedUntil, bannedUntil);

    console.warn(`[SpamFilter] Banned peer ${peerDid.substring(0, 16)}... for ${Math.round(durationMs / 1000 / 60)} minutes`);
  }

  /**
   * Record invalid UCPT from peer
   */
  public async recordInvalidToken(peerDid: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO rate_limit_state (peer_did, invalid_count, last_reset)
      VALUES (?, 1, strftime('%s', 'now'))
      ON CONFLICT(peer_did) DO UPDATE SET
        invalid_count = invalid_count + 1
    `);

    stmt.run(peerDid);

    // Check if should ban
    const state = await this.getRateLimitState(peerDid);
    if (state.invalid_count >= MAX_INVALID_TOKENS) {
      // Calculate ban duration with exponential backoff
      const banCount = state.banned_until ? 1 : 0;
      const banDuration = BASE_BAN_DURATION_MS * Math.pow(BAN_BACKOFF_MULTIPLIER, banCount);
      await this.banPeer(peerDid, banDuration);

      // Reset invalid count after ban
      const resetStmt = this.db.prepare(`
        UPDATE rate_limit_state SET invalid_count = 0 WHERE peer_did = ?
      `);
      resetStmt.run(peerDid);
    }
  }

  /**
   * Generate proof-of-work challenge
   */
  public generateChallenge(peerDid: string, ucptHash: string): ProofOfWork {
    // Challenge = SHA256(peer_did + ucpt_hash + timestamp)
    const timestamp = Date.now();
    const challenge = crypto
      .createHash('sha256')
      .update(peerDid + ucptHash + timestamp)
      .digest('hex');

    return {
      challenge,
      difficulty: POW_DIFFICULTY,
      valid: false
    };
  }

  /**
   * Validate proof-of-work solution
   * Requires nonce such that SHA256(challenge + nonce) has POW_DIFFICULTY leading zero bits
   */
  public validateProofOfWork(challenge: ProofOfWork, nonce: string): boolean {
    if (!nonce || nonce.length === 0) {
      return false;
    }

    // Calculate hash of challenge + nonce
    const hash = crypto
      .createHash('sha256')
      .update(challenge.challenge + nonce)
      .digest('hex');

    // Check leading zero bits
    const leadingZeroBits = this.countLeadingZeroBits(hash);
    return leadingZeroBits >= challenge.difficulty;
  }

  /**
   * Get rate limit quota for peer based on reputation
   */
  public async getQuota(peerDid: string): Promise<number> {
    try {
      const reputation = await this.reputationEngine.calculateScore(peerDid);
      const baseQuota = MAX_ANNOUNCEMENTS_PER_MINUTE;

      if (reputation.overall >= HIGH_REPUTATION_THRESHOLD) {
        // High reputation: +50% quota
        return Math.floor(baseQuota * (1 + HIGH_REPUTATION_BONUS));
      } else if (reputation.overall <= LOW_REPUTATION_THRESHOLD) {
        // Low reputation: -50% quota
        return Math.floor(baseQuota * (1 - LOW_REPUTATION_PENALTY));
      }

      return baseQuota;
    } catch (error) {
      // If reputation query fails, use base quota
      console.warn(`[SpamFilter] Failed to get reputation for ${peerDid}:`, error);
      return MAX_ANNOUNCEMENTS_PER_MINUTE;
    }
  }

  /**
   * Reset rate limits (called every minute)
   */
  public async resetRateLimits(): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE rate_limit_state
      SET 
        announcements_count = 0,
        bandwidth_bytes = 0,
        last_reset = strftime('%s', 'now')
      WHERE strftime('%s', 'now') - last_reset >= 60
    `);

    const result = stmt.run();
    
    if (result.changes > 0) {
      console.log(`[SpamFilter] Reset rate limits for ${result.changes} peers`);
    }
  }

  /**
   * Get rate limit state for peer
   */
  public async getRateLimitState(peerDid: string): Promise<RateLimitState> {
    const stmt = this.db.prepare(`
      SELECT * FROM rate_limit_state WHERE peer_did = ?
    `);

    const row = stmt.get(peerDid) as any;

    if (!row) {
      return {
        announcements: 0,
        bandwidth_bytes: 0,
        last_reset: Math.floor(Date.now() / 1000),
        invalid_count: 0
      };
    }

    return {
      announcements: row.announcements_count || 0,
      bandwidth_bytes: row.bandwidth_bytes || 0,
      last_reset: row.last_reset || Math.floor(Date.now() / 1000),
      invalid_count: row.invalid_count || 0,
      banned_until: row.banned_until
    };
  }

  /**
   * Start periodic rate limit reset (every minute)
   */
  private startResetScheduler(): void {
    this.resetInterval = setInterval(async () => {
      try {
        await this.resetRateLimits();
      } catch (error) {
        console.error('[SpamFilter] Rate limit reset failed:', error);
      }
    }, RATE_LIMIT_WINDOW_MS);

    console.log('[SpamFilter] Started rate limit reset scheduler');
  }

  /**
   * Stop rate limit reset scheduler
   */
  public stopResetScheduler(): void {
    if (this.resetInterval) {
      clearInterval(this.resetInterval);
      this.resetInterval = null;
      console.log('[SpamFilter] Stopped rate limit reset scheduler');
    }
  }

  /**
   * Count leading zero bits in hex string
   */
  private countLeadingZeroBits(hexString: string): number {
    let count = 0;
    
    for (let i = 0; i < hexString.length; i++) {
      const nibble = parseInt(hexString[i], 16);
      
      if (nibble === 0) {
        count += 4;
      } else {
        // Count leading zeros in nibble
        if (nibble < 8) count += 1;
        if (nibble < 4) count += 1;
        if (nibble < 2) count += 1;
        break;
      }
    }
    
    return count;
  }

  /**
   * Get statistics for monitoring
   */
  public async getStatistics(): Promise<{
    total_peers: number;
    banned_peers: number;
    high_reputation_peers: number;
    low_reputation_peers: number;
  }> {
    const totalStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM rate_limit_state
    `);
    const total = (totalStmt.get() as any).count;

    const bannedStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM rate_limit_state
      WHERE banned_until IS NOT NULL AND banned_until > strftime('%s', 'now')
    `);
    const banned = (bannedStmt.get() as any).count;

    // Get reputation distribution
    const reputationStmt = this.db.prepare(`
      SELECT 
        SUM(CASE WHEN overall_score >= ? THEN 1 ELSE 0 END) as high_rep,
        SUM(CASE WHEN overall_score <= ? THEN 1 ELSE 0 END) as low_rep
      FROM reputation_cache
    `);
    const repStats = reputationStmt.get(HIGH_REPUTATION_THRESHOLD, LOW_REPUTATION_THRESHOLD) as any;

    return {
      total_peers: total,
      banned_peers: banned,
      high_reputation_peers: repStats?.high_rep || 0,
      low_reputation_peers: repStats?.low_rep || 0
    };
  }
}

// Singleton instance
let spamFilterInstance: SpamFilter | null = null;

export function getSpamFilter(): SpamFilter {
  if (!spamFilterInstance) {
    spamFilterInstance = new SpamFilter();
  }
  return spamFilterInstance;
}
