/**
 * Reputation Engine Interfaces
 */

import { ReputationScore, AgentRanking } from '../types';

export interface IReputationEngine {
  /**
   * Calculate reputation score for DID
   */
  calculateScore(did: string): Promise<ReputationScore>;

  /**
   * Get top N agents by reputation
   */
  getTopAgents(count: number): Promise<AgentRanking[]>;

  /**
   * Get peer's opinion of specific DID
   */
  getPeerOpinion(did: string, peer_id: string): Promise<number>;

  /**
   * Update reputation after task completion
   */
  updateAfterTask(did: string, success: boolean, earned: number, time_ms: number): Promise<void>;

  /**
   * Apply time-based decay to all scores
   */
  applyDecay(): Promise<void>;

  /**
   * Penalize DID for disputed token
   */
  penalizeDispute(did: string): Promise<void>;
}
