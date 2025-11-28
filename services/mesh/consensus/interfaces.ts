/**
 * Byzantine Consensus Interfaces
 */

import { UCPTToken } from '../types';

export interface IUCPTConsensus {
  /**
   * Detect if two tokens conflict
   */
  detectConflict(token1: UCPTToken, token2: UCPTToken): boolean;

  /**
   * Resolve conflict via Byzantine voting
   */
  resolveConflict(token1: UCPTToken, token2: UCPTToken): Promise<UCPTToken>;

  /**
   * Query peers for votes on token
   */
  queryVotes(token: UCPTToken, peer_count: number): Promise<VoteResult[]>;

  /**
   * Calculate vote weight based on reputation
   */
  calculateVoteWeight(reputation: number): number;

  /**
   * Check if quorum reached
   */
  checkQuorum(votes: VoteResult[], required: number): boolean;

  /**
   * Mark token as disputed
   */
  markDisputed(hash: string): Promise<void>;

  /**
   * Mark token as canonical
   */
  markCanonical(hash: string): Promise<void>;
}

export interface VoteResult {
  voter_did: string;
  vote: boolean;
  weight: number;
  timestamp: number;
}
