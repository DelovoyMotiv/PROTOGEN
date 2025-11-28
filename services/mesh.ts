/**
 * Mesh Network Service
 * 
 * Implements Kademlia-inspired DHT for peer discovery and routing
 * Integrates with Anóteros Lógos platform mesh network
 * 
 * Features:
 * - WebSocket-based peer connections
 * - Capability-based routing
 * - Circuit breaker pattern
 * - Message broadcasting
 * - UCPT cascade support
 * 
 * @module services/mesh
 */

import { A2AMessage, MeshPeer } from '../types';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

interface PeerConnection {
  did: string;
  endpoint: string;
  ws: WebSocket | null;
  status: 'connecting' | 'connected' | 'disconnected' | 'failed';
  lastSeen: number;
  failureCount: number;
}

type MessageHandler = (msg: A2AMessage, fromDid: string) => Promise<void>;

export class MeshService {
  private peers: Map<string, PeerConnection> = new Map();
  private messageHandler: MessageHandler | null = null;
  private localNodeId: string = '';
  private localDid: string = '';
  
  private readonly MAX_PEERS = 100;
  private readonly FAILURE_THRESHOLD = 5;
  private readonly RECONNECT_DELAY_MS = 5000;

  constructor() {
    console.log('[Mesh] Service initialized');
  }

  /**
   * Initialize mesh service with local identity
   */
  public initialize(did: string): void {
    this.localDid = did;
    this.localNodeId = this.didToNodeId(did);
    console.log(`[Mesh] Initialized with DID: ${did.substring(0, 24)}...`);
  }

  /**
   * Set global message handler for incoming A2A messages
   */
  public setGlobalMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
    console.log('[Mesh] Message handler registered');
  }

  /**
   * Connect to a peer
   */
  public async connectToPeer(did: string, endpoint: string): Promise<void> {
    // Check if already connected
    const existing = this.peers.get(did);
    if (existing && existing.status === 'connected') {
      console.log(`[Mesh] Already connected to ${did.substring(0, 16)}...`);
      return;
    }

    // Check peer limit
    if (this.peers.size >= this.MAX_PEERS) {
      throw new Error('Maximum peer limit reached');
    }

    console.log(`[Mesh] Connecting to ${did.substring(0, 16)}... at ${endpoint}`);

    const connection: PeerConnection = {
      did,
      endpoint,
      ws: null,
      status: 'connecting',
      lastSeen: Date.now(),
      failureCount: 0
    };

    this.peers.set(did, connection);

    try {
      // Create WebSocket connection
      const ws = new WebSocket(endpoint);

      ws.onopen = () => {
        console.log(`[Mesh] Connected to ${did.substring(0, 16)}...`);
        connection.status = 'connected';
        connection.ws = ws;
        connection.lastSeen = Date.now();
        connection.failureCount = 0;
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          connection.lastSeen = Date.now();

          // Handle incoming A2A message
          if (this.messageHandler && data.header && data.payload && data.signature) {
            await this.messageHandler(data as A2AMessage, did);
          }
        } catch (error) {
          console.error(`[Mesh] Message parsing error from ${did}:`, error);
        }
      };

      ws.onerror = (error) => {
        console.error(`[Mesh] WebSocket error with ${did}:`, error);
        connection.failureCount++;
        
        if (connection.failureCount >= this.FAILURE_THRESHOLD) {
          connection.status = 'failed';
          console.warn(`[Mesh] Peer ${did} marked as failed after ${this.FAILURE_THRESHOLD} failures`);
        }
      };

      ws.onclose = () => {
        console.log(`[Mesh] Disconnected from ${did.substring(0, 16)}...`);
        connection.status = 'disconnected';
        connection.ws = null;

        // Attempt reconnection if not failed
        if (connection.status !== 'failed') {
          setTimeout(() => {
            this.reconnectToPeer(did).catch(err => {
              console.error(`[Mesh] Reconnection failed for ${did}:`, err);
            });
          }, this.RECONNECT_DELAY_MS);
        }
      };

      connection.ws = ws;

    } catch (error) {
      console.error(`[Mesh] Failed to connect to ${did}:`, error);
      connection.status = 'failed';
      connection.failureCount++;
      throw error;
    }
  }

  /**
   * Reconnect to a peer
   */
  private async reconnectToPeer(did: string): Promise<void> {
    const connection = this.peers.get(did);
    if (!connection || connection.status === 'failed') {
      return;
    }

    console.log(`[Mesh] Attempting to reconnect to ${did.substring(0, 16)}...`);
    await this.connectToPeer(did, connection.endpoint);
  }

  /**
   * Send message to a specific peer
   */
  public send(did: string, message: A2AMessage): void {
    const connection = this.peers.get(did);
    
    if (!connection) {
      throw new Error(`Peer not found: ${did}`);
    }

    if (connection.status !== 'connected' || !connection.ws) {
      throw new Error(`Peer not connected: ${did}`);
    }

    if (connection.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`WebSocket not ready: ${did}`);
    }

    try {
      connection.ws.send(JSON.stringify(message));
      console.log(`[Mesh] Sent message to ${did.substring(0, 16)}...`);
    } catch (error) {
      console.error(`[Mesh] Failed to send message to ${did}:`, error);
      connection.failureCount++;
      throw error;
    }
  }

  /**
   * Broadcast message to all connected peers
   */
  public broadcast(message: A2AMessage): { sent: number; failed: number } {
    let sent = 0;
    let failed = 0;

    for (const [did, connection] of this.peers.entries()) {
      if (connection.status === 'connected' && connection.ws) {
        try {
          this.send(did, message);
          sent++;
        } catch (error) {
          console.error(`[Mesh] Broadcast failed to ${did}:`, error);
          failed++;
        }
      }
    }

    console.log(`[Mesh] Broadcast complete: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  }

  /**
   * Disconnect from a peer
   */
  public disconnect(did: string): void {
    const connection = this.peers.get(did);
    
    if (connection && connection.ws) {
      connection.ws.close();
      connection.status = 'disconnected';
      connection.ws = null;
    }

    this.peers.delete(did);
    console.log(`[Mesh] Disconnected from ${did.substring(0, 16)}...`);
  }

  /**
   * Disconnect from all peers
   */
  public disconnectAll(): void {
    for (const did of this.peers.keys()) {
      this.disconnect(did);
    }
    console.log('[Mesh] Disconnected from all peers');
  }

  /**
   * Get list of connected peers
   */
  public getConnectedPeers(): MeshPeer[] {
    const peers: MeshPeer[] = [];

    for (const [did, connection] of this.peers.entries()) {
      if (connection.status === 'connected') {
        peers.push({
          nodeId: this.didToNodeId(did),
          address: connection.endpoint,
          distance: this.calculateDistance(this.localNodeId, this.didToNodeId(did)),
          lastSeen: connection.lastSeen,
          agentVersion: '1.0.0',
          bucketIndex: 0,
          latency: 0,
          reputation: 100 - (connection.failureCount * 10),
          did: did
        });
      }
    }

    return peers;
  }

  /**
   * Get peer count
   */
  public getPeerCount(): number {
    let count = 0;
    for (const connection of this.peers.values()) {
      if (connection.status === 'connected') {
        count++;
      }
    }
    return count;
  }

  /**
   * Get mesh statistics
   */
  public getStats(): {
    totalPeers: number;
    connectedPeers: number;
    failedPeers: number;
    disconnectedPeers: number;
  } {
    let connected = 0;
    let failed = 0;
    let disconnected = 0;

    for (const connection of this.peers.values()) {
      switch (connection.status) {
        case 'connected':
          connected++;
          break;
        case 'failed':
          failed++;
          break;
        case 'disconnected':
          disconnected++;
          break;
      }
    }

    return {
      totalPeers: this.peers.size,
      connectedPeers: connected,
      failedPeers: failed,
      disconnectedPeers: disconnected
    };
  }

  /**
   * Prune failed peers
   */
  public pruneFailed(): number {
    let pruned = 0;

    for (const [did, connection] of this.peers.entries()) {
      if (connection.status === 'failed') {
        this.disconnect(did);
        pruned++;
      }
    }

    console.log(`[Mesh] Pruned ${pruned} failed peers`);
    return pruned;
  }

  /**
   * Convert DID to node ID (SHA-256 hash)
   */
  private didToNodeId(did: string): string {
    const hash = sha256(new TextEncoder().encode(did));
    return bytesToHex(hash);
  }

  /**
   * Calculate XOR distance between two node IDs
   */
  private calculateDistance(nodeId1: string, nodeId2: string): bigint {
    const buf1 = Buffer.from(nodeId1, 'hex');
    const buf2 = Buffer.from(nodeId2, 'hex');
    
    let distance = 0n;
    for (let i = 0; i < buf1.length; i++) {
      distance = (distance << 8n) | BigInt(buf1[i] ^ buf2[i]);
    }
    
    return distance;
  }

  /**
   * Health check - ping all peers
   */
  public async healthCheck(): Promise<void> {
    const now = Date.now();
    const staleThreshold = 60000; // 1 minute

    for (const [did, connection] of this.peers.entries()) {
      if (connection.status === 'connected' && now - connection.lastSeen > staleThreshold) {
        console.warn(`[Mesh] Peer ${did.substring(0, 16)}... appears stale, reconnecting...`);
        await this.reconnectToPeer(did);
      }
    }
  }
}

// Singleton instance
export const meshService = new MeshService();
