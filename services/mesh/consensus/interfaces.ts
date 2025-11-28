/**
 * UCPT Consensus Module Interfaces
 * 
 * Byzantine fault-tolerant voting protocol for conflict resolution.
 */

import { UCPTToken } from '../types';

export interface IUCPTConsensus {
  /**
   * Detect conflicting UCPT tokens (same task_id, different result)
   */
  detectConflict(token: UCPTToken): Promise<UCPTToken[]>;

  /**
   * Initiate Byzantine consensus voting for conflicting tokens
   * Returns winning token hash
   */
  resolveConflict(conflictingTokens: UCPTToken[]): Promise<string>;

  /**
   * Query high-reputation peers for votes
   */
  queryPeersForVotes(tokens: UCPTToken[]): Promise<Map<string, VoteResult>>;

  /**
   * Calculate weighted vote totals
   */
  calculateWeightedVotes(votes: Map<string, VoteResult>): Map<string, number>;

  /**
   * Determine winner based on quorum threshold
   */
  determineWinner(weightedVotes: Map<string, number>): string | null;

  /**
   * Mark losing tokens as disputed
   */
  markAsDisputed(tokenHashes: string[]): Promise<void>;

  /**
   * Penalize issuers of disputed tokens
   */
  penalizeIssuers(tokenHashes: string[]): Promise<void>;

  /**
   * Broadcast dispute resolution to mesh
   */
  broadcastDispute(winnerHash: string, loserHashes: string[]): Promise<void>;
}

export interface VoteResult {
  token_hash: string;
  voter_did: string;
  vote: boolean; // true = valid, false = invalid
  weight: number; // reputation-based weight
  timestamp: number;
}

export interface ConflictResolution {
  winner_hash: string;
  loser_hashes: string[];
  total_votes: number;
  quorum_reached: boolean;
  resolution_time: number;
}
