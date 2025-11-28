/**
 * UCPT Cascade Gossip Protocol Interfaces
 */

import { UCPTToken, GossipMessage, GossipMetrics } from '../types';
import { MeshPeer } from '../../../types';

export interface IUCPTCascade {
  /**
   * Propagate UCPT token to mesh network (push phase)
   */
  propagate(token: UCPTToken): Promise<void>;

  /**
   * Synchronize UCPT inventory with specific peer
   */
  syncWithPeer(peer: MeshPeer): Promise<void>;

  /**
   * Handle incoming gossip message
   */
  handleMessage(msg: GossipMessage, fromDid: string): Promise<void>;

  /**
   * Get gossip metrics
   */
  getMetrics(): GossipMetrics;

  /**
   * Start periodic digest broadcast (pull phase)
   */
  startDigestBroadcast(): void;

  /**
   * Stop periodic digest broadcast
   */
  stopDigestBroadcast(): void;

  /**
   * Start anti-entropy synchronization
   */
  startAntiEntropy(): void;

  /**
   * Stop anti-entropy synchronization
   */
  stopAntiEntropy(): void;
}
