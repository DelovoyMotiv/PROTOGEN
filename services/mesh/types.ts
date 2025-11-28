/**
 * UCPT Cascade Protocol Types
 * 
 * Type definitions for Byzantine fault-tolerant gossip protocol
 * for distributing Universal Causal Provenance Tokens.
 */

import { UCPT } from '../../types';

/**
 * UCPT Token with cascade-specific metadata
 */
export interface UCPTToken {
  hash: string;
  cose_sign1: Uint8Array;
  metadata: UCPTMetadata;
  payload: UCPTPayload;
}

export interface UCPTMetadata {
  issuer_did: string;
  subject_did?: string;
  task_id: string;
  task_type: string;
  status: 'completed' | 'failed' | 'disputed';
  issued_at: number;
  expires_at?: number;
  parent_hash?: string;
  validation_score?: number;
}

export interface UCPTPayload {
  result_hash: string;
  computation_proof: string;
  resource_usage: string;
}

/**
 * Gossip Protocol Message Types
 */
export type GossipMessage =
  | { type: 'UCPT_ANNOUNCE'; hash: string; metadata: UCPTMetadata }
  | { type: 'UCPT_REQUEST'; hash: string }
  | { type: 'UCPT_RESPONSE'; token: UCPTToken; signature: string }
  | { type: 'DIGEST'; bloom_filter: Uint8Array; peer_id: string }
  | { type: 'SYNC_REQUEST'; merkle_root: string }
  | { type: 'SYNC_RESPONSE'; missing_hashes: string[] };

export interface GossipMetrics {
  tokens_propagated: number;
  tokens_received: number;
  bandwidth_bytes: number;
  coverage_percentage: number;
}

/**
 * Validation Results
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  confidence_score: number;
}

export interface ConsensusResult {
  votes_for: number;
  votes_against: number;
  quorum_reached: boolean;
}

/**
 * Cache Query Interface
 */
export interface UCPTQuery {
  issuer?: string;
  subject?: string;
  min_score?: number;
  after?: Date;
  limit?: number;
}

/**
 * Reputation Scoring
 */
export interface ReputationScore {
  overall: number;
  success_rate: number;
  avg_task_time: number;
  total_earned: number;
  peer_trust: number;
}

export interface AgentRanking {
  did: string;
  score: number;
  rank: number;
}

/**
 * Security and Rate Limiting
 */
export interface RateLimitState {
  announcements: number;
  bandwidth_bytes: number;
  last_reset: number;
  invalid_count: number;
  banned_until?: number;
}

export interface ProofOfWork {
  challenge: string;
  difficulty: number;
  nonce?: string;
  valid: boolean;
}

/**
 * Configuration
 */
export interface UCPTCascadeConfig {
  gossip_fanout: number;
  sync_interval: number;
  cache_max_size: number;
  reputation_decay: number;
  consensus_quorum: number;
  max_announcements_per_minute: number;
  max_bandwidth_per_second: number;
  pow_difficulty: number;
  ban_duration: number;
  max_invalid_tokens: number;
}
