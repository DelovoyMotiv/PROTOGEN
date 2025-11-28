/**
 * Gossip Protocol Interfaces
 */

import { UCPTToken, GossipMessage, GossipMetrics } from '../types';
import { MeshPeer } from '../../../types';

export interface IUCPTCascade {
  /**
   * Propagate UCPT token to mesh network
   */
  propagate(token: UCPTToken): Promise<void>;

  /**
   * Synchronize UCPT inventory with specific peer
   */
  syncWithPeer(peer: MeshPeer): Promise<void>;

  /**
   * Handle incoming gossip message
   */
  handleMessage(msg: GossipMessage, from: string): Promise<void>;

  /**
   * Get current gossip metrics
   */
  getMetrics(): GossipMetrics;

  /**
   * Start gossip protocol (periodic tasks)
   */
  start(): void;

  /**
   * Stop gossip protocol
   */
  stop(): void;
}
