/**
 * UCPT Cascade Security Module Interfaces
 */

import { RateLimitState, ProofOfWork } from '../types';

export interface ISpamFilter {
  /**
   * Check if peer is allowed to announce UCPT
   * Returns true if allowed, false if rate limited
   */
  checkRateLimit(peerDid: string): Promise<boolean>;

  /**
   * Record UCPT announcement from peer
   */
  recordAnnouncement(peerDid: string, bytes: number): Promise<void>;

  /**
   * Check if peer is banned
   */
  isBanned(peerDid: string): Promise<boolean>;

  /**
   * Ban peer for specified duration
   */
  banPeer(peerDid: string, durationMs: number): Promise<void>;

  /**
   * Record invalid UCPT from peer
   */
  recordInvalidToken(peerDid: string): Promise<void>;

  /**
   * Generate proof-of-work challenge
   */
  generateChallenge(peerDid: string, ucptHash: string): ProofOfWork;

  /**
   * Validate proof-of-work solution
   */
  validateProofOfWork(challenge: ProofOfWork, nonce: string): boolean;

  /**
   * Get rate limit quota for peer based on reputation
   */
  getQuota(peerDid: string): Promise<number>;

  /**
   * Reset rate limits (called every minute)
   */
  resetRateLimits(): Promise<void>;

  /**
   * Get rate limit state for peer
   */
  getRateLimitState(peerDid: string): Promise<RateLimitState>;
}
