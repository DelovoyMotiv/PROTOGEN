/**
 * Reputation Engine Implementation
 * 
 * Production-grade reputation scoring system based on UCPT history.
 * Formula: REPUTATION = (SUCCESSFUL × 10) - (FAILED × 20) + (CONFIRMATIONS × 5) - AGE_PENALTY
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import { IReputationEngine } from './interfaces';
import { ReputationScore, AgentRanking } from '../types';

const DATA_DIR = process.env.DATA_DIR || './data';
const CACHE_DB_PATH = path.join(DATA_DIR, 'ucpt_cache.db');
const WEEKLY_DECAY_FACTOR = parseFloat(process.env.UCPT_REPUTATION_DECAY || '0.95');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export class ReputationEngine implements IReputationEngine {
  private db: Database.Database;

  constructor() {
    this.db = new Database(CACHE_DB_PATH);
  }

  public async calculateScore(did: string): Promise<ReputationScore> {
    const cached = this.getCachedScore(did);
    if (cached && Date.now() - cached.last_updated < 60000) {
      return this.buildScoreFromCache(cached);
    }

    const stats = this.getUCPTStats(did);
    const agePenalty = this.calculateAgePenalty(did);
    
    const overall = (stats.successful * 10) - (stats.failed * 20) + (stats.peer_confirmations * 5) - agePenalty;
    
    const success_rate = stats.total > 0 ? (stats.successful / stats.total) * 100 : 100;
    
    this.updateCache(did, {
      overall_score: Math.max(0, overall),
      success_count: stats.successful,
      failure_count: stats.failed,
      peer_confirmations: stats.peer_confirmations,
      total_earned: stats.total_earned,
      avg_task_time: stats.avg_task_time
    });

    return {
      overall: Math.max(0, overall),
      success_rate,
      avg_task_time: stats.avg_task_time,
      total_earned: stats.total_earned,
      peer_trust: this.calculatePeerTrust(stats.peer_confirmations, stats.total)
    };
  }

  public async getTopAgents(count: number): Promise<AgentRanking[]> {
    const stmt = this.db.prepare(`
      SELECT did, overall_score 
      FROM reputation_cache 
      ORDER BY overall_score DESC 
      LIMIT ?
    `);

    const rows = stmt.all(count) as Array<{ did: string; overall_score: number }>;
    
    return rows.map((row, index) => ({
      did: row.did,
      score: row.overall_score,
      rank: index + 1
    }));
  }

  public async getPeerOpinion(did: string, peer_id: string): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT AVG(vote * weight) as opinion
      FROM peer_votes
      WHERE voter_did = ? AND ucpt_hash IN (
        SELECT hash FROM ucpt_cache WHERE issuer_did = ?
      )
    `);

    const row = stmt.get(peer_id, did) as { opinion: number | null } | undefined;
    return row?.opinion || 0;
  }

  public async updateAfterTask(did: string, success: boolean, earned: number, time_ms: number): Promise<void> {
    const current = this.getCachedScore(did);
    
    const newSuccessCount = current ? current.success_count + (success ? 1 : 0) : (success ? 1 : 0);
    const newFailureCount = current ? current.failure_count + (success ? 0 : 1) : (success ? 0 : 1);
    const totalTasks = newSuccessCount + newFailureCount;
    
    const newTotalEarned = (current?.total_earned || 0) + earned;
    const newAvgTime = current 
      ? ((current.avg_task_time * (totalTasks - 1)) + time_ms) / totalTasks
      : time_ms;

    const overall = (newSuccessCount * 10) - (newFailureCount * 20) + ((current?.peer_confirmations || 0) * 5);

    this.updateCache(did, {
      overall_score: Math.max(0, overall),
      success_count: newSuccessCount,
      failure_count: newFailureCount,
      peer_confirmations: current?.peer_confirmations || 0,
      total_earned: newTotalEarned,
      avg_task_time: newAvgTime
    });
  }

  public async applyDecay(): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE reputation_cache
      SET overall_score = CAST(overall_score * ? AS INTEGER),
          last_updated = strftime('%s', 'now')
      WHERE last_updated < strftime('%s', 'now') - ?
    `);

    stmt.run(WEEKLY_DECAY_FACTOR, WEEK_MS / 1000);
  }

  public async penalizeDispute(did: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE reputation_cache
      SET overall_score = MAX(0, overall_score - 100),
          last_updated = strftime('%s', 'now')
      WHERE did = ?
    `);

    stmt.run(did);
  }

  private getUCPTStats(did: string): {
    successful: number;
    failed: number;
    total: number;
    peer_confirmations: number;
    total_earned: number;
    avg_task_time: number;
  } {
    const stmt = this.db.prepare(`
      SELECT 
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        COUNT(*) as total,
        SUM(peer_confirmations) as peer_confirmations
      FROM ucpt_cache
      WHERE issuer_did = ?
    `);

    const row = stmt.get(did) as any;
    
    return {
      successful: row.successful || 0,
      failed: row.failed || 0,
      total: row.total || 0,
      peer_confirmations: row.peer_confirmations || 0,
      total_earned: 0,
      avg_task_time: 0
    };
  }

  private calculateAgePenalty(did: string): number {
    const stmt = this.db.prepare(`
      SELECT issued_at FROM ucpt_cache 
      WHERE issuer_did = ? 
      ORDER BY issued_at DESC
    `);

    const rows = stmt.all(did) as Array<{ issued_at: number }>;
    if (rows.length === 0) return 0;

    const now = Date.now() / 1000;
    let penalty = 0;

    for (const row of rows) {
      const ageWeeks = (now - row.issued_at) / (WEEK_MS / 1000);
      const decayFactor = Math.pow(WEEKLY_DECAY_FACTOR, ageWeeks);
      penalty += (1 - decayFactor) * 10;
    }

    return Math.floor(penalty);
  }

  private calculatePeerTrust(confirmations: number, total: number): number {
    if (total === 0) return 0;
    return Math.min(100, (confirmations / total) * 100);
  }

  private getCachedScore(did: string): any {
    const stmt = this.db.prepare(`
      SELECT * FROM reputation_cache WHERE did = ?
    `);

    return stmt.get(did);
  }

  private buildScoreFromCache(cached: any): ReputationScore {
    const total = cached.success_count + cached.failure_count;
    const success_rate = total > 0 ? (cached.success_count / total) * 100 : 100;

    return {
      overall: cached.overall_score,
      success_rate,
      avg_task_time: cached.avg_task_time,
      total_earned: cached.total_earned,
      peer_trust: this.calculatePeerTrust(cached.peer_confirmations, total)
    };
  }

  private updateCache(did: string, data: any): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO reputation_cache (
        did, overall_score, success_count, failure_count, 
        peer_confirmations, total_earned, avg_task_time, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
    `);

    stmt.run(
      did,
      data.overall_score,
      data.success_count,
      data.failure_count,
      data.peer_confirmations,
      data.total_earned,
      data.avg_task_time
    );
  }
}

let engineInstance: ReputationEngine | null = null;

export function getReputationEngine(): ReputationEngine {
  if (!engineInstance) {
    engineInstance = new ReputationEngine();
  }
  return engineInstance;
}
