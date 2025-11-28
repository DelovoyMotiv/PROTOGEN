/**
 * UCPT Validation Interfaces
 */

import { UCPTToken, ValidationResult, ConsensusResult } from '../types';

export interface IUCPTValidator {
  /**
   * Validate UCPT token (signature, timestamp, chain)
   */
  validateToken(token: UCPTToken): Promise<ValidationResult>;

  /**
   * Verify chain of custody for token
   */
  verifyChain(token: UCPTToken, depth: number): Promise<boolean>;

  /**
   * Query peer consensus for token validity
   */
  queryPeerConsensus(hash: string): Promise<ConsensusResult>;

  /**
   * Verify COSE_Sign1 signature
   */
  verifyCOSESignature(token: UCPTToken): Promise<boolean>;

  /**
   * Check timestamp validity
   */
  validateTimestamp(issued_at: number, expires_at?: number): boolean;
}
