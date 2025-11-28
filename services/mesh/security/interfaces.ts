/**
 * Security and Rate Limiting Interfaces
 */

import { RateLimitState, ProofOfWork } from '../types';

export interface ISpamFilter {
  /**
   * Check if peer is rate limited
   */
  checkRateLimit(peer_did: string): Promise<boolean>;

  /**
   * Record announcement from peer
   */
  recordAnnouncement(peer_did: string, bytes: number): Promise<void>;

  /**
   * Record invalid token from peer
   */
  recordInvalidToken(peer_did: string): Promise<void>;

  /**
   * Check if peer is banned
   */
  isBanned(peer_did: string): Promise<boolean>;

  /**
   * Ban peer for duration
   */
  banPeer(peer_did: string, duration_ms: number): Promise<void>;

  /**
   * Generate proof-of-work challenge
   */
  generateChallenge(ucpt_hash: string): ProofOfWork;

  /**
   * Validate proof-of-work solution
   */
  validateProof(challenge: ProofOfWork, nonce: string): boolean;

  /**
   * Get rate limit state for peer
   */
  getRateLimitState(peer_did: string): Promise<RateLimitState>;

  /**
   * Reset rate limits (called periodically)
   */
  resetRateLimits(): Promise<void>;
}
