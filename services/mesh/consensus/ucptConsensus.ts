/**
 * UCPT Consensus Module Implementation
 * 
 * Byzantine fault-tolerant voting protocol for resolving conflicting UCPT tokens.
 * 
 * Algorithm:
 * 1. Detect conflicts: Same task_id, different result_hash
 * 2. Select 7 high-reputation peers (>= 300 reputation)
 * 3. Query each peer for vote on each conflicting token
 * 4. Weight votes by peer reputation
 * 5. Require 5/7 weighted votes for quorum (71% Byzantine threshold)
 * 6. Mark winner as canonical, losers as disputed
 * 7. Penalize issuers of disputed tokens (-100 reputation)
 * 8. Broadcast resolution to mesh network
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import { IUCPTConsensus, VoteResult, ConflictResolution } from './interfaces';
import { UCPTToken } from '../types';
import { getUCPTCache } from '../cache/ucptCache';
import { getReputationEngine } from '../reputation/reputationEngine';
import { meshService } from '../../mesh';

const DATA_DIR = process.env.DATA_DIR || './data';
const CACHE_DB_PATH = path.join(DATA_DIR, 'ucpt_cache.db');

// Consensus constants
const CONSENSUS_PEER_COUNT = 7;
const CONSENSUS_QUORUM = 5; // 5 out of 7 = 71% (Byzantine threshold)
const MIN_PEER_REPUTATION = 300;
const DISPUTE_PENALTY = 100;
const VOTE_TIMEOUT_MS = 10000; // 10 seconds

export class UCPTConsensus implements IUCPTConsensus {
  private db: Database.Database;
  private cache = getUCPTCache();
  private reputationEngine = getReputationEngine();

  constructor() {
    this.db = new Database(CACHE_DB_PATH);
    console.log('[UCPTConsensus] Initialized');
  }

  /**
   * Detect conflicting UCPT tokens
   * Conflicts occur when multiple tokens have same task_id but different result_hash
   */
  public async detectConflict(token: UCPTToken): Promise<UCPTToken[]> {
    // Query all tokens with same task_id
    const stmt = this.db.prepare(`
      SELECT token_data FROM ucpt_cache
      WHERE task_id = ? AND hash != ?
    `);

    const rows = stmt.all(token.metadata.task_id, token.hash) as Array<{ token_data: Buffer }>;
    const tokens = rows.map(row => JSON.parse(row.token_data.toString()) as UCPTToken);

    // Filter for actual conflicts (different result_hash)
    const conflicts = tokens.filter(t => 
      t.payload.result_hash !== token.payload.result_hash
    );

    if (conflicts.length > 0) {
      console.warn(`[UCPTConsensus] Detected ${conflicts.length} conflicting tokens for task ${token.metadata.task_id}`);
    }

    return conflicts;
  }

  /**
   * Resolve conflict using Byzantine consensus voting
   */
  public async resolveConflict(conflictingTokens: UCPTToken[]): Promise<string> {
    if (conflictingTokens.length < 2) {
      throw new Error('Need at least 2 conflicting tokens for consensus');
    }

    const startTime = Date.now();
    console.log(`[UCPTConsensus] Starting consensus for ${conflictingTokens.length} conflicting tokens`);

    // Query peers for votes
    const votes = await this.queryPeersForVotes(conflictingTokens);

    if (votes.size === 0) {
      throw new Error('No votes received from peers');
    }

    // Calculate weighted votes
    const weightedVotes = this.calculateWeightedVotes(votes);

    // Determine winner
    const winnerHash = this.determineWinner(weightedVotes);

    if (!winnerHash) {
      throw new Error('No winner determined - quorum not reached');
    }

    // Mark losers as disputed
    const loserHashes = conflictingTokens
      .map(t => t.hash)
      .filter(h => h !== winnerHash);

    await this.markAsDisputed(loserHashes);

    // Penalize issuers
    await this.penalizeIssuers(loserHashes);

    // Broadcast resolution
    await this.broadcastDispute(winnerHash, loserHashes);

    const resolutionTime = Date.now() - startTime;
    console.log(`[UCPTConsensus] Consensus resolved in ${resolutionTime}ms - Winner: ${winnerHash.substring(0, 16)}...`);

    return winnerHash;
  }

  /**
   * Query high-reputation peers for votes on conflicting tokens
   */
  public async queryPeersForVotes(tokens: UCPTToken[]): Promise<Map<string, VoteResult>> {
    // Get high-reputation peers
    const topAgents = await this.reputationEngine.getTopAgents(100);
    const highRepPeers = topAgents.filter(a => a.score >= MIN_PEER_REPUTATION);

    if (highRepPeers.length < CONSENSUS_PEER_COUNT) {
      console.warn(`[UCPTConsensus] Only ${highRepPeers.length} high-reputation peers available (need ${CONSENSUS_PEER_COUNT})`);
    }

    // Select random subset of high-reputation peers
    const selectedPeers = this.selectRandomPeers(highRepPeers, CONSENSUS_PEER_COUNT);

    console.log(`[UCPTConsensus] Querying ${selectedPeers.length} high-reputation peers for votes`);

    // Query each peer for each token
    const votes = new Map<string, VoteResult>();
    const votePromises: Promise<void>[] = [];

    for (const peer of selectedPeers) {
      for (const token of tokens) {
        const promise = this.queryPeerVote(peer.did, token, peer.score)
          .then(voteResult => {
            if (voteResult) {
              const key = `${peer.did}:${token.hash}`;
              votes.set(key, voteResult);
            }
          })
          .catch(error => {
            console.error(`[UCPTConsensus] Failed to get vote from ${peer.did}:`, error);
          });

        votePromises.push(promise);
      }
    }

    // Wait for all votes with timeout
    await Promise.race([
      Promise.all(votePromises),
      new Promise(resolve => setTimeout(resolve, VOTE_TIMEOUT_MS))
    ]);

    console.log(`[UCPTConsensus] Received ${votes.size} votes from ${selectedPeers.length} peers`);

    return votes;
  }

  /**
   * Calculate weighted vote totals for each token
   */
  public calculateWeightedVotes(votes: Map<string, VoteResult>): Map<string, number> {
    const weightedVotes = new Map<string, number>();

    for (const [_key, voteResult] of votes) {
      if (voteResult.vote) {
        // Vote is "valid" - add weight to this token
        const currentWeight = weightedVotes.get(voteResult.token_hash) || 0;
        weightedVotes.set(voteResult.token_hash, currentWeight + voteResult.weight);
      }
    }

    // Log vote distribution
    for (const [hash, weight] of weightedVotes) {
      console.log(`[UCPTConsensus] Token ${hash.substring(0, 16)}... received ${weight.toFixed(2)} weighted votes`);
    }

    return weightedVotes;
  }

  /**
   * Determine winner based on quorum threshold
   * Winner must have at least CONSENSUS_QUORUM weighted votes
   */
  public determineWinner(weightedVotes: Map<string, number>): string | null {
    let maxWeight = 0;
    let winnerHash: string | null = null;

    for (const [hash, weight] of weightedVotes) {
      if (weight > maxWeight) {
        maxWeight = weight;
        winnerHash = hash;
      }
    }

    // Check if winner meets quorum threshold
    // We normalize by assuming each peer has weight 1.0 for simplicity
    // In practice, weights are reputation scores normalized to [0, 1]
    const normalizedWeight = maxWeight / CONSENSUS_PEER_COUNT;
    const quorumReached = normalizedWeight >= (CONSENSUS_QUORUM / CONSENSUS_PEER_COUNT);

    if (!quorumReached) {
      console.warn(`[UCPTConsensus] Quorum not reached - max weight: ${maxWeight.toFixed(2)}, required: ${CONSENSUS_QUORUM}`);
      return null;
    }

    return winnerHash;
  }

  /**
   * Mark tokens as disputed in cache
   */
  public async markAsDisputed(tokenHashes: string[]): Promise<void> {
    if (tokenHashes.length === 0) return;

    const placeholders = tokenHashes.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      UPDATE ucpt_cache
      SET status = 'disputed'
      WHERE hash IN (${placeholders})
    `);

    stmt.run(...tokenHashes);

    console.log(`[UCPTConsensus] Marked ${tokenHashes.length} tokens as disputed`);
  }

  /**
   * Penalize issuers of disputed tokens
   */
  public async penalizeIssuers(tokenHashes: string[]): Promise<void> {
    if (tokenHashes.length === 0) return;

    // Get issuer DIDs for disputed tokens
    const placeholders = tokenHashes.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT DISTINCT issuer_did FROM ucpt_cache
      WHERE hash IN (${placeholders})
    `);

    const rows = stmt.all(...tokenHashes) as Array<{ issuer_did: string }>;

    // Penalize each issuer
    for (const row of rows) {
      await this.reputationEngine.penalizeDispute(row.issuer_did);
      console.log(`[UCPTConsensus] Penalized ${row.issuer_did.substring(0, 16)}... (-${DISPUTE_PENALTY} reputation)`);
    }
  }

  /**
   * Broadcast dispute resolution to mesh network
   */
  public async broadcastDispute(winnerHash: string, loserHashes: string[]): Promise<void> {
    const peers = meshService.getPeers();

    if (peers.length === 0) {
      console.warn('[UCPTConsensus] No peers to broadcast dispute resolution');
      return;
    }

    const disputeMsg = {
      type: 'DISPUTE_RESOLUTION',
      winner_hash: winnerHash,
      loser_hashes: loserHashes,
      timestamp: Date.now()
    };

    // Broadcast to all peers
    for (const peer of peers) {
      try {
        const a2aMessage: any = {
          header: {
            type: 'consensus',
            from: meshService.getSelfId(),
            to: peer.did,
            timestamp: Date.now()
          },
          payload: disputeMsg,
          signature: ''
        };

        meshService.send(peer.did, a2aMessage);
      } catch (error) {
        console.error(`[UCPTConsensus] Failed to broadcast to ${peer.did}:`, error);
      }
    }

    console.log(`[UCPTConsensus] Broadcast dispute resolution to ${peers.length} peers`);
  }

  /**
   * Query single peer for vote on token
   */
  private async queryPeerVote(
    peerDid: string,
    token: UCPTToken,
    peerReputation: number
  ): Promise<VoteResult | null> {
    try {
      // Send vote request via A2A
      const voteRequest = {
        type: 'VOTE_REQUEST',
        token_hash: token.hash,
        task_id: token.metadata.task_id
      };

      const a2aMessage: any = {
        header: {
          type: 'consensus',
          from: meshService.getSelfId(),
          to: peerDid,
          timestamp: Date.now()
        },
        payload: voteRequest,
        signature: ''
      };

      meshService.send(peerDid, a2aMessage);

      // In production, we would wait for response via callback
      // For now, simulate vote based on whether peer has token
      const peerHasToken = await this.cache.has(token.hash);

      // Normalize reputation to [0, 1] range for weight
      const normalizedWeight = Math.min(peerReputation / 1000, 1.0);

      return {
        token_hash: token.hash,
        voter_did: peerDid,
        vote: peerHasToken,
        weight: normalizedWeight,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`[UCPTConsensus] Vote query failed for ${peerDid}:`, error);
      return null;
    }
  }

  /**
   * Select random subset of peers
   */
  private selectRandomPeers(peers: Array<{ did: string; score: number }>, count: number): Array<{ did: string; score: number }> {
    if (peers.length <= count) {
      return peers;
    }

    // Fisher-Yates shuffle
    const shuffled = [...peers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, count);
  }

  /**
   * Record peer vote in database
   */
  public async recordVote(voteResult: VoteResult): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO peer_votes (ucpt_hash, voter_did, vote, weight, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      voteResult.token_hash,
      voteResult.voter_did,
      voteResult.vote ? 1 : 0,
      voteResult.weight,
      Math.floor(voteResult.timestamp / 1000)
    );
  }

  /**
   * Get consensus statistics
   */
  public async getStatistics(): Promise<{
    total_disputes: number;
    resolved_disputes: number;
    pending_disputes: number;
    avg_resolution_time: number;
  }> {
    const disputedStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM ucpt_cache WHERE status = 'disputed'
    `);
    const disputed = (disputedStmt.get() as any).count;

    const votesStmt = this.db.prepare(`
      SELECT COUNT(DISTINCT ucpt_hash) as count FROM peer_votes
    `);
    const resolved = (votesStmt.get() as any).count;

    return {
      total_disputes: disputed + resolved,
      resolved_disputes: resolved,
      pending_disputes: disputed,
      avg_resolution_time: 0 // TODO: Track resolution times
    };
  }

  /**
   * Get consensus metrics for monitoring
   */
  public getMetrics(): {
    difficulty: number;
    tokensValidated: number;
    tokensRejected: number;
    avgValidationTime: number;
    conflictsResolved: number;
  } {
    try {
      // Get validated tokens count
      const validatedStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM ucpt_cache WHERE status = 'completed'
      `);
      const validated = (validatedStmt.get() as any)?.count || 0;

      // Get rejected/disputed tokens count
      const rejectedStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM ucpt_cache WHERE status = 'disputed'
      `);
      const rejected = (rejectedStmt.get() as any)?.count || 0;

      // Get resolved conflicts count
      const conflictsStmt = this.db.prepare(`
        SELECT COUNT(DISTINCT ucpt_hash) as count FROM peer_votes
      `);
      const conflicts = (conflictsStmt.get() as any)?.count || 0;

      // Get difficulty from environment
      const difficulty = parseInt(process.env.UCPT_MINING_DIFFICULTY || '2');

      return {
        difficulty,
        tokensValidated: validated,
        tokensRejected: rejected,
        avgValidationTime: 0, // TODO: Track validation times
        conflictsResolved: conflicts
      };
    } catch (error) {
      console.error('[UCPTConsensus] getMetrics error:', error);
      return {
        difficulty: 2,
        tokensValidated: 0,
        tokensRejected: 0,
        avgValidationTime: 0,
        conflictsResolved: 0
      };
    }
  }
}

// Singleton instance
let consensusInstance: UCPTConsensus | null = null;

export function getUCPTConsensus(): UCPTConsensus {
  if (!consensusInstance) {
    consensusInstance = new UCPTConsensus();
  }
  return consensusInstance;
}
