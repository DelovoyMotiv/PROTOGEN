/**
 * UCPT Cascade Gossip Protocol Implementation
 * 
 * Byzantine fault-tolerant epidemic-style propagation protocol.
 * Implements three-phase synchronization:
 * 1. Push: Eager propagation of new tokens
 * 2. Pull: Periodic digest exchange for missing tokens
 * 3. Anti-entropy: Merkle tree reconciliation for long-term consistency
 */

import { IUCPTCascade } from './interfaces';
import { UCPTToken, GossipMessage, GossipMetrics } from '../types';
import { MeshPeer } from '../../../types';
import { meshService } from '../../mesh';
import { getUCPTCache } from '../cache/ucptCache';
import { getUCPTValidator } from '../validation/ucptValidator';
import { createBloomFilter, BloomFilter } from '../filters/bloomFilter';
import { getReputationEngine } from '../reputation/reputationEngine';
import { getSpamFilter } from '../security/spamFilter';
import { getUCPTConsensus } from '../consensus/ucptConsensus';
import * as crypto from 'crypto';

const GOSSIP_FANOUT = parseInt(process.env.UCPT_GOSSIP_FANOUT || '3');
const DIGEST_INTERVAL_MS = parseInt(process.env.UCPT_SYNC_INTERVAL || '30000');
const ANTI_ENTROPY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_PAYLOAD_SIZE = 100 * 1024; // 100KB

export class UCPTCascade implements IUCPTCascade {
  private cache = getUCPTCache();
  private validator = getUCPTValidator();
  private reputationEngine = getReputationEngine();
  private spamFilter = getSpamFilter();
  private consensus = getUCPTConsensus();
  
  private bloomFilter: BloomFilter;
  private digestInterval: NodeJS.Timeout | null = null;
  private antiEntropyInterval: NodeJS.Timeout | null = null;
  
  private metrics: GossipMetrics = {
    tokens_propagated: 0,
    tokens_received: 0,
    bandwidth_bytes: 0,
    coverage_percentage: 0
  };

  // Pending requests to avoid duplicate fetches
  private pendingRequests = new Set<string>();
  
  // Merkle tree cache for anti-entropy
  private merkleRoots = new Map<string, string>();

  constructor() {
    this.bloomFilter = createBloomFilter(10000, 0.01);
    console.log('[UCPTCascade] Initialized with fanout:', GOSSIP_FANOUT);
  }

  /**
   * Phase 1: Push - Propagate new UCPT token to K random peers
   */
  public async propagate(token: UCPTToken): Promise<void> {
    try {
      // Add to local cache first
      await this.cache.store(token, 'local');
      this.bloomFilter.add(token.hash);

      // Select K random peers
      const peers = meshService.getPeers();
      const selectedPeers = this.selectRandomPeers(peers, GOSSIP_FANOUT);

      if (selectedPeers.length === 0) {
        console.warn('[UCPTCascade] No peers available for propagation');
        return;
      }

      // Send UCPT_ANNOUNCE to selected peers
      const announceMsg: GossipMessage = {
        type: 'UCPT_ANNOUNCE',
        hash: token.hash,
        metadata: token.metadata
      };

      let successCount = 0;
      for (const peer of selectedPeers) {
        try {
          await this.sendMessage(peer.did, announceMsg);
          successCount++;
          this.metrics.bandwidth_bytes += this.estimateMessageSize(announceMsg);
        } catch (error) {
          console.error(`[UCPTCascade] Failed to announce to ${peer.did}:`, error);
        }
      }

      this.metrics.tokens_propagated++;
      this.metrics.coverage_percentage = (successCount / selectedPeers.length) * 100;

      console.log(`[UCPTCascade] Propagated ${token.hash.substring(0, 16)}... to ${successCount}/${selectedPeers.length} peers`);
    } catch (error) {
      console.error('[UCPTCascade] Propagation failed:', error);
      throw error;
    }
  }

  /**
   * Phase 2: Pull - Synchronize with specific peer using bloom filter
   */
  public async syncWithPeer(peer: MeshPeer): Promise<void> {
    try {
      // Send our bloom filter to peer
      const digestMsg: GossipMessage = {
        type: 'DIGEST',
        bloom_filter: this.bloomFilter.serialize(),
        peer_id: meshService.getSelfId()
      };

      await this.sendMessage(peer.did, digestMsg);
      this.metrics.bandwidth_bytes += this.estimateMessageSize(digestMsg);

      console.log(`[UCPTCascade] Sent digest to ${peer.did.substring(0, 16)}...`);
    } catch (error) {
      console.error(`[UCPTCascade] Sync with peer ${peer.did} failed:`, error);
    }
  }

  /**
   * Handle incoming gossip messages
   */
  public async handleMessage(msg: GossipMessage, fromDid: string): Promise<void> {
    try {
      switch (msg.type) {
        case 'UCPT_ANNOUNCE':
          await this.handleAnnounce(msg, fromDid);
          break;
        
        case 'UCPT_REQUEST':
          await this.handleRequest(msg, fromDid);
          break;
        
        case 'UCPT_RESPONSE':
          await this.handleResponse(msg, fromDid);
          break;
        
        case 'DIGEST':
          await this.handleDigest(msg, fromDid);
          break;
        
        case 'SYNC_REQUEST':
          await this.handleSyncRequest(msg, fromDid);
          break;
        
        case 'SYNC_RESPONSE':
          await this.handleSyncResponse(msg, fromDid);
          break;
        
        default:
          console.warn('[UCPTCascade] Unknown message type:', (msg as any).type);
      }
    } catch (error) {
      console.error('[UCPTCascade] Message handling failed:', error);
    }
  }

  /**
   * Start periodic digest broadcast (every 30 seconds)
   */
  public startDigestBroadcast(): void {
    if (this.digestInterval) {
      return;
    }

    this.digestInterval = setInterval(async () => {
      try {
        await this.broadcastDigest();
      } catch (error) {
        console.error('[UCPTCascade] Digest broadcast failed:', error);
      }
    }, DIGEST_INTERVAL_MS);

    console.log('[UCPTCascade] Started digest broadcast');
  }

  /**
   * Stop periodic digest broadcast
   */
  public stopDigestBroadcast(): void {
    if (this.digestInterval) {
      clearInterval(this.digestInterval);
      this.digestInterval = null;
      console.log('[UCPTCascade] Stopped digest broadcast');
    }
  }

  /**
   * Start anti-entropy synchronization (every 5 minutes)
   */
  public startAntiEntropy(): void {
    if (this.antiEntropyInterval) {
      return;
    }

    this.antiEntropyInterval = setInterval(async () => {
      try {
        await this.performAntiEntropy();
      } catch (error) {
        console.error('[UCPTCascade] Anti-entropy failed:', error);
      }
    }, ANTI_ENTROPY_INTERVAL_MS);

    console.log('[UCPTCascade] Started anti-entropy sync');
  }

  /**
   * Stop anti-entropy synchronization
   */
  public stopAntiEntropy(): void {
    if (this.antiEntropyInterval) {
      clearInterval(this.antiEntropyInterval);
      this.antiEntropyInterval = null;
      console.log('[UCPTCascade] Stopped anti-entropy sync');
    }
  }

  /**
   * Get current metrics
   */
  public getMetrics(): GossipMetrics {
    return { ...this.metrics };
  }

  /**
   * Handle UCPT_ANNOUNCE message
   */
  private async handleAnnounce(msg: Extract<GossipMessage, { type: 'UCPT_ANNOUNCE' }>, fromDid: string): Promise<void> {
    // Check rate limit
    const allowed = await this.spamFilter.checkRateLimit(fromDid);
    if (!allowed) {
      console.warn(`[UCPTCascade] Rate limit exceeded for ${fromDid.substring(0, 16)}...`);
      
      // Generate PoW challenge
      const challenge = this.spamFilter.generateChallenge(fromDid, msg.hash);
      console.log(`[UCPTCascade] Issued PoW challenge to ${fromDid.substring(0, 16)}...`);
      // TODO: Send challenge to peer
      return;
    }

    // Record announcement
    const msgSize = this.estimateMessageSize(msg);
    await this.spamFilter.recordAnnouncement(fromDid, msgSize);

    // Check if we already have this token
    if (this.bloomFilter.has(msg.hash)) {
      const hasToken = await this.cache.has(msg.hash);
      if (hasToken) {
        console.log(`[UCPTCascade] Already have token ${msg.hash.substring(0, 16)}...`);
        return;
      }
    }

    // Check if already requesting
    if (this.pendingRequests.has(msg.hash)) {
      return;
    }

    // Request full payload
    this.pendingRequests.add(msg.hash);
    
    const requestMsg: GossipMessage = {
      type: 'UCPT_REQUEST',
      hash: msg.hash
    };

    await this.sendMessage(fromDid, requestMsg);
    this.metrics.bandwidth_bytes += this.estimateMessageSize(requestMsg);
  }

  /**
   * Handle UCPT_REQUEST message
   */
  private async handleRequest(msg: Extract<GossipMessage, { type: 'UCPT_REQUEST' }>, fromDid: string): Promise<void> {
    // Retrieve token from cache
    const token = await this.cache.get(msg.hash);
    
    if (!token) {
      console.warn(`[UCPTCascade] Token ${msg.hash.substring(0, 16)}... not found in cache`);
      return;
    }

    // Send full token
    const responseMsg: GossipMessage = {
      type: 'UCPT_RESPONSE',
      token,
      signature: '' // TODO: Sign response
    };

    const msgSize = this.estimateMessageSize(responseMsg);
    if (msgSize > MAX_PAYLOAD_SIZE) {
      console.warn(`[UCPTCascade] Token ${msg.hash.substring(0, 16)}... exceeds max payload size`);
      return;
    }

    await this.sendMessage(fromDid, responseMsg);
    this.metrics.bandwidth_bytes += msgSize;
  }

  /**
   * Handle UCPT_RESPONSE message
   */
  private async handleResponse(msg: Extract<GossipMessage, { type: 'UCPT_RESPONSE' }>, fromDid: string): Promise<void> {
    const token = msg.token;
    
    // Remove from pending
    this.pendingRequests.delete(token.hash);

    // Validate token
    const validation = await this.validator.validateToken(token);
    
    if (!validation.valid) {
      console.warn(`[UCPTCascade] Invalid token from ${fromDid}:`, validation.errors);
      
      // Record invalid token
      await this.spamFilter.recordInvalidToken(fromDid);
      
      return;
    }

    // Check for conflicts before storing
    const conflicts = await this.consensus.detectConflict(token);
    
    if (conflicts.length > 0) {
      console.warn(`[UCPTCascade] Conflict detected for token ${token.hash.substring(0, 16)}...`);
      
      // Resolve conflict via Byzantine consensus
      try {
        const allTokens = [token, ...conflicts];
        const winnerHash = await this.consensus.resolveConflict(allTokens);
        
        if (winnerHash !== token.hash) {
          console.log(`[UCPTCascade] Token ${token.hash.substring(0, 16)}... lost consensus - not storing`);
          return;
        }
        
        console.log(`[UCPTCascade] Token ${token.hash.substring(0, 16)}... won consensus`);
      } catch (error) {
        console.error('[UCPTCascade] Consensus resolution failed:', error);
        // Store anyway if consensus fails
      }
    }

    // Store validated token
    await this.cache.store(token, fromDid);
    this.bloomFilter.add(token.hash);
    this.metrics.tokens_received++;

    console.log(`[UCPTCascade] Received and validated token ${token.hash.substring(0, 16)}...`);

    // Update reputation
    await this.reputationEngine.updateAfterTask(
      token.metadata.issuer_did,
      token.metadata.status === 'completed',
      0, // earned amount not available here
      0  // task time not available here
    );
  }

  /**
   * Handle DIGEST message
   */
  private async handleDigest(msg: Extract<GossipMessage, { type: 'DIGEST' }>, fromDid: string): Promise<void> {
    try {
      // Deserialize peer's bloom filter
      const peerBloomFilter = BloomFilter.deserialize(msg.bloom_filter);

      // Query our cache for all tokens
      const ourTokens = await this.cache.query({ limit: 10000 });

      // Find tokens we have that peer doesn't
      const missingHashes: string[] = [];
      for (const token of ourTokens) {
        if (!peerBloomFilter.has(token.hash)) {
          missingHashes.push(token.hash);
        }
      }

      // Send missing tokens (up to 100 at a time to avoid overwhelming)
      const tokensToSend = missingHashes.slice(0, 100);
      for (const hash of tokensToSend) {
        const token = await this.cache.get(hash);
        if (token) {
          const responseMsg: GossipMessage = {
            type: 'UCPT_RESPONSE',
            token,
            signature: ''
          };
          await this.sendMessage(fromDid, responseMsg);
        }
      }

      console.log(`[UCPTCascade] Sent ${tokensToSend.length} missing tokens to ${fromDid.substring(0, 16)}...`);
    } catch (error) {
      console.error('[UCPTCascade] Digest handling failed:', error);
    }
  }

  /**
   * Handle SYNC_REQUEST message (Merkle tree sync)
   */
  private async handleSyncRequest(msg: Extract<GossipMessage, { type: 'SYNC_REQUEST' }>, fromDid: string): Promise<void> {
    // Calculate our Merkle root
    const ourRoot = await this.calculateMerkleRoot();

    if (ourRoot === msg.merkle_root) {
      console.log(`[UCPTCascade] Merkle roots match with ${fromDid.substring(0, 16)}...`);
      return;
    }

    // Roots differ - send list of our token hashes
    const ourTokens = await this.cache.query({ limit: 10000 });
    const ourHashes = ourTokens.map(t => t.hash);

    const responseMsg: GossipMessage = {
      type: 'SYNC_RESPONSE',
      missing_hashes: ourHashes
    };

    await this.sendMessage(fromDid, responseMsg);
    this.metrics.bandwidth_bytes += this.estimateMessageSize(responseMsg);
  }

  /**
   * Handle SYNC_RESPONSE message
   */
  private async handleSyncResponse(msg: Extract<GossipMessage, { type: 'SYNC_RESPONSE' }>, fromDid: string): Promise<void> {
    // Request tokens we don't have
    for (const hash of msg.missing_hashes) {
      const hasToken = await this.cache.has(hash);
      if (!hasToken && !this.pendingRequests.has(hash)) {
        this.pendingRequests.add(hash);
        
        const requestMsg: GossipMessage = {
          type: 'UCPT_REQUEST',
          hash
        };
        
        await this.sendMessage(fromDid, requestMsg);
      }
    }

    console.log(`[UCPTCascade] Requested ${msg.missing_hashes.length} missing tokens from ${fromDid.substring(0, 16)}...`);
  }

  /**
   * Broadcast digest to all peers
   */
  private async broadcastDigest(): Promise<void> {
    const peers = meshService.getPeers();
    
    if (peers.length === 0) {
      return;
    }

    const digestMsg: GossipMessage = {
      type: 'DIGEST',
      bloom_filter: this.bloomFilter.serialize(),
      peer_id: meshService.getSelfId()
    };

    for (const peer of peers) {
      try {
        await this.sendMessage(peer.did, digestMsg);
      } catch (error) {
        console.error(`[UCPTCascade] Failed to send digest to ${peer.did}:`, error);
      }
    }

    console.log(`[UCPTCascade] Broadcast digest to ${peers.length} peers`);
  }

  /**
   * Perform anti-entropy synchronization with random peer
   */
  private async performAntiEntropy(): Promise<void> {
    const peers = meshService.getPeers();
    
    if (peers.length === 0) {
      return;
    }

    // Select random peer
    const randomPeer = peers[Math.floor(Math.random() * peers.length)];

    // Calculate our Merkle root
    const ourRoot = await this.calculateMerkleRoot();

    // Send sync request
    const syncMsg: GossipMessage = {
      type: 'SYNC_REQUEST',
      merkle_root: ourRoot
    };

    await this.sendMessage(randomPeer.did, syncMsg);
    this.metrics.bandwidth_bytes += this.estimateMessageSize(syncMsg);

    console.log(`[UCPTCascade] Anti-entropy sync with ${randomPeer.did.substring(0, 16)}...`);
  }

  /**
   * Calculate Merkle root of all cached tokens
   */
  private async calculateMerkleRoot(): Promise<string> {
    const tokens = await this.cache.query({ limit: 10000 });
    const hashes = tokens.map(t => t.hash).sort();

    if (hashes.length === 0) {
      return crypto.createHash('sha256').update('empty').digest('hex');
    }

    // Build Merkle tree
    let level = hashes;
    while (level.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = i + 1 < level.length ? level[i + 1] : left;
        const combined = crypto.createHash('sha256')
          .update(left + right)
          .digest('hex');
        nextLevel.push(combined);
      }
      level = nextLevel;
    }

    return level[0];
  }

  /**
   * Select K random peers from available peers
   */
  private selectRandomPeers(peers: MeshPeer[], count: number): MeshPeer[] {
    if (peers.length <= count) {
      return peers;
    }

    // Fisher-Yates shuffle
    const shuffled = [...peers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, count);
  }

  /**
   * Send message to peer via mesh network
   */
  private async sendMessage(did: string, msg: GossipMessage): Promise<void> {
    const a2aMessage: any = {
      header: {
        type: 'gossip',
        from: meshService.getSelfId(),
        to: did,
        timestamp: Date.now()
      },
      payload: msg,
      signature: ''
    };

    meshService.send(did, a2aMessage);
  }

  /**
   * Estimate message size in bytes
   */
  private estimateMessageSize(msg: GossipMessage): number {
    return JSON.stringify(msg).length;
  }
}

// Singleton instance
let cascadeInstance: UCPTCascade | null = null;

export function getUCPTCascade(): UCPTCascade {
  if (!cascadeInstance) {
    cascadeInstance = new UCPTCascade();
  }
  return cascadeInstance;
}
