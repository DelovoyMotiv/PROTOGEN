/**
 * UCPT Cache Interfaces
 */

import { UCPTToken, UCPTQuery } from '../types';

export interface IUCPTCache {
  /**
   * Store validated UCPT token
   */
  store(token: UCPTToken, peer_id: string): Promise<void>;

  /**
   * Query tokens with filters
   */
  query(filter: UCPTQuery): Promise<UCPTToken[]>;

  /**
   * Get token by hash
   */
  get(hash: string): Promise<UCPTToken | null>;

  /**
   * Check if token exists
   */
  has(hash: string): Promise<boolean>;

  /**
   * Get reputation score for DID
   */
  getReputationScore(did: string): Promise<number>;

  /**
   * Prune expired tokens
   */
  pruneExpired(): Promise<number>;

  /**
   * Get cache size in bytes
   */
  getSize(): Promise<number>;

  /**
   * Apply LRU eviction if needed
   */
  evictIfNeeded(): Promise<number>;
}
