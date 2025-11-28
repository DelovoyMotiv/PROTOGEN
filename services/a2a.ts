/**
 * A2A (Agent-to-Agent) Protocol Handler
 * 
 * Implements Linux Foundation A2A Protocol v1.0 with extensions:
 * - JSON-RPC 2.0 messaging
 * - Ed25519 signatures
 * - UCPT provenance tokens
 * - CCC economic layer
 * - Mesh network integration
 * 
 * @module services/a2a
 */

import { IdentityState, Task, CCCBlock, CCCTransaction, A2AMessage, A2AMessageType } from '../types';
import { generateUCPT, createTaskUCPT } from './ucpt';
import { ConsensusService } from './consensus';
import * as ed from '@noble/ed25519';

/**
 * JSON-RPC 2.0 Request
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC 2.0 Response
 */
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * A2A Protocol Handler
 */
export class A2AProtocolHandler {
  private identity: IdentityState | null = null;
  private consensus: ConsensusService | null = null;
  
  constructor() {
    console.log('[A2A] Protocol handler initialized');
  }
  
  /**
   * Set agent identity
   */
  setIdentity(identity: IdentityState): void {
    this.identity = identity;
    console.log(`[A2A] Identity set: ${identity.did}`);
  }
  
  /**
   * Set consensus service
   */
  setConsensus(consensus: ConsensusService): void {
    this.consensus = consensus;
    console.log('[A2A] Consensus service connected');
  }
  
  /**
   * Handle incoming A2A request
   */
  async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    console.log(`[A2A] Handling request: ${request.method}`);
    
    try {
      // Validate JSON-RPC structure
      if (request.jsonrpc !== '2.0' || !request.method) {
        return this.errorResponse(request.id, -32600, 'Invalid Request');
      }
      
      // Route to appropriate handler
      let result: unknown;
      
      switch (request.method) {
        case 'a2a.discover':
          result = await this.handleDiscover();
          break;
          
        case 'a2a.capabilities':
          result = await this.handleCapabilities();
          break;
          
        case 'a2a.ping':
          result = await this.handlePing();
          break;
          
        case 'a2a.status':
          result = await this.handleStatus();
          break;
          
        case 'a2a.ccc.balance':
          result = await this.handleCCCBalance(request.params);
          break;
          
        case 'a2a.ccc.history':
          result = await this.handleCCCHistory(request.params);
          break;
          
        case 'a2a.ccc.transfer':
          result = await this.handleCCCTransfer(request.params);
          break;
          
        case 'a2a.mesh.discover':
          result = await this.handleMeshDiscover(request.params);
          break;
          
        case 'a2a.mesh.announce':
          result = await this.handleMeshAnnounce(request.params);
          break;
          
        case 'a2a.mesh.sync':
          result = await this.handleMeshSync(request.params);
          break;
          
        case 'a2a.mesh.cascade':
          result = await this.handleMeshCascade(request.params);
          break;
          
        case 'a2a.ucpt.verify':
          result = await this.handleUCPTVerify(request.params);
          break;
          
        case 'task.execute':
          result = await this.handleTaskExecute(request.params);
          break;
          
        default:
          return this.errorResponse(request.id, -32601, 'Method not found');
      }
      
      return {
        jsonrpc: '2.0',
        id: request.id,
        result,
      };
    } catch (error) {
      console.error('[A2A] Request handling error:', error);
      return this.errorResponse(
        request.id,
        -32603,
        'Internal error',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
  
  /**
   * Handle a2a.discover
   */
  private async handleDiscover(): Promise<unknown> {
    return {
      name: 'PROTOGEN-01',
      version: '1.0.0',
      did: this.identity?.did || 'unknown',
      capabilities: [
        'a2a.discover',
        'a2a.capabilities',
        'a2a.ping',
        'a2a.status',
        'a2a.ccc.balance',
        'a2a.ccc.history',
        'a2a.ccc.transfer',
        'a2a.mesh.discover',
        'a2a.mesh.announce',
        'a2a.mesh.sync',
        'a2a.mesh.cascade',
        'task.execute',
      ],
      protocols: ['a2a/1.0', 'jsonrpc/2.0'],
    };
  }
  
  /**
   * Handle a2a.capabilities
   */
  private async handleCapabilities(): Promise<unknown> {
    return {
      methods: [
        {
          name: 'a2a.discover',
          description: 'Get agent metadata and capabilities',
          params: {},
        },
        {
          name: 'a2a.capabilities',
          description: 'Get full API documentation',
          params: {},
        },
        {
          name: 'a2a.ping',
          description: 'Health check',
          params: {},
        },
        {
          name: 'a2a.status',
          description: 'Get system status',
          params: {},
        },
        {
          name: 'a2a.ccc.balance',
          description: 'Query CCC balance',
          params: { did: 'string' },
        },
        {
          name: 'a2a.ccc.history',
          description: 'Get transaction history',
          params: { did: 'string', limit: 'number?' },
        },
        {
          name: 'a2a.ccc.transfer',
          description: 'Transfer CCC between agents',
          params: { to: 'string', amount: 'number', fee: 'number' },
        },
        {
          name: 'task.execute',
          description: 'Execute task and return UCPT',
          params: { type: 'string', target: 'string' },
        },
      ],
    };
  }
  
  /**
   * Handle a2a.ping
   */
  private async handlePing(): Promise<unknown> {
    return {
      pong: true,
      timestamp: Date.now(),
      did: this.identity?.did || 'unknown',
    };
  }
  
  /**
   * Handle a2a.status
   */
  private async handleStatus(): Promise<unknown> {
    const chainState = this.consensus?.getChainState();
    
    return {
      status: 'operational',
      timestamp: Date.now(),
      identity: {
        did: this.identity?.did || 'unknown',
        address: this.identity?.address || 'unknown',
      },
      consensus: chainState ? {
        height: chainState.height,
        difficulty: chainState.difficulty,
        totalSupply: chainState.totalSupply,
      } : null,
    };
  }
  
  /**
   * Handle a2a.ccc.balance
   */
  private async handleCCCBalance(params: any): Promise<unknown> {
    if (!params?.did) {
      throw new Error('DID required');
    }
    
    if (!this.consensus) {
      throw new Error('Consensus service not available');
    }
    
    const accountState = this.consensus.getAccountState(params.did);
    
    return {
      did: params.did,
      balance: accountState?.balance || 0,
      nonce: accountState?.nonce || 0,
      lastUpdated: accountState?.lastUpdated || 0,
    };
  }
  
  /**
   * Handle a2a.ccc.history
   */
  private async handleCCCHistory(params: any): Promise<unknown> {
    if (!params?.did) {
      throw new Error('DID required');
    }
    
    // TODO: Implement transaction history query
    return {
      did: params.did,
      transactions: [],
      total: 0,
    };
  }
  
  /**
   * Handle a2a.ccc.transfer
   */
  private async handleCCCTransfer(params: any): Promise<unknown> {
    if (!params?.to || !params?.amount || params?.fee === undefined) {
      throw new Error('Missing required parameters: to, amount, fee');
    }
    
    if (!this.identity) {
      throw new Error('Identity not set');
    }
    
    if (!this.consensus) {
      throw new Error('Consensus service not available');
    }
    
    // TODO: Implement CCC transfer
    // 1. Create transaction
    // 2. Sign with Ed25519
    // 3. Add to mempool
    // 4. Return transaction hash
    
    return {
      success: true,
      txHash: 'pending',
      from: this.identity.did,
      to: params.to,
      amount: params.amount,
      fee: params.fee,
    };
  }
  
  /**
   * Handle a2a.mesh.discover
   */
  private async handleMeshDiscover(params: any): Promise<unknown> {
    // TODO: Integrate with mesh network
    return {
      peers: [],
      total: 0,
    };
  }
  
  /**
   * Handle a2a.mesh.announce
   */
  private async handleMeshAnnounce(params: any): Promise<unknown> {
    // TODO: Integrate with mesh network
    return {
      success: true,
      timestamp: Date.now(),
    };
  }
  
  /**
   * Handle a2a.mesh.sync
   */
  private async handleMeshSync(params: any): Promise<unknown> {
    // TODO: Integrate with mesh network
    return {
      success: true,
      timestamp: Date.now(),
    };
  }
  
  /**
   * Handle a2a.mesh.cascade (UCPT viral distribution)
   */
  private async handleMeshCascade(params: any): Promise<unknown> {
    if (!params?.ucpt || !params?.sourceAid || !params?.tool) {
      throw new Error('Missing required parameters: ucpt, sourceAid, tool');
    }
    
    console.log(`[A2A] Received UCPT cascade from ${params.sourceAid} (TTL: ${params.ttl})`);
    
    // Store UCPT token
    // TODO: Implement UCPT storage
    
    // Rebroadcast if TTL > 0
    if (params.ttl > 0) {
      // TODO: Rebroadcast to mesh peers
      console.log(`[A2A] Rebroadcasting UCPT with TTL ${params.ttl - 1}`);
    }
    
    return {
      accepted: true,
      timestamp: Date.now(),
    };
  }
  
  /**
   * Handle a2a.ucpt.verify - Query if peer has and validates a UCPT token
   */
  private async handleUCPTVerify(params: any): Promise<unknown> {
    if (!params?.hash) {
      throw new Error('Missing required parameter: hash');
    }
    
    // Import cache dynamically to avoid circular dependency
    const { getUCPTCache } = await import('./mesh/cache/ucptCache');
    const cache = getUCPTCache();
    
    // Check if we have this token
    const hasToken = await cache.has(params.hash);
    
    if (!hasToken) {
      return {
        has_token: false,
        valid: false,
      };
    }
    
    // Get token and check validation score
    const token = await cache.get(params.hash);
    
    if (!token) {
      return {
        has_token: false,
        valid: false,
      };
    }
    
    const validationScore = (token.metadata as any).validation_score || 0;
    
    return {
      has_token: true,
      valid: validationScore >= 50,
      validation_score: validationScore,
    };
  }
  
  /**
   * Handle task.execute
   */
  private async handleTaskExecute(params: any): Promise<unknown> {
    if (!params?.type || !params?.target) {
      throw new Error('Missing required parameters: type, target');
    }
    
    if (!this.identity) {
      throw new Error('Identity not set');
    }
    
    console.log(`[A2A] Executing task: ${params.type} on ${params.target}`);
    
    // Execute task (placeholder)
    const result = {
      status: 'completed',
      target: params.target,
      timestamp: Date.now(),
    };
    
    // Generate UCPT
    const privateKeyBytes = Buffer.from(this.identity.privateKey, 'hex');
    const ucpt = await createTaskUCPT(
      `task_${Date.now()}`,
      params.type,
      { target: params.target },
      result,
      this.identity.did,
      privateKeyBytes,
      this.identity.ed25519PublicKey
    );
    
    return {
      task: {
        id: `task_${Date.now()}`,
        type: params.type,
        status: 'completed',
        result,
      },
      ucpt: ucpt.token,
      ucpt_mime_type: ucpt.mime_type,
    };
  }
  
  /**
   * Create error response
   */
  private errorResponse(
    id: string | number | null,
    code: number,
    message: string,
    data?: unknown
  ): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        data,
      },
    };
  }
  
  /**
   * Sign A2A message with Ed25519
   */
  async signMessage(message: any): Promise<string> {
    if (!this.identity) {
      throw new Error('Identity not set');
    }
    
    const messageBytes = new TextEncoder().encode(JSON.stringify(message));
    const privateKeyBytes = Buffer.from(this.identity.privateKey, 'hex');
    const signature = await ed.signAsync(messageBytes, privateKeyBytes);
    
    return Buffer.from(signature).toString('hex');
  }
  
  /**
   * Verify A2A message signature
   */
  async verifyMessage(message: any, signature: string, publicKey: string): Promise<boolean> {
    try {
      const messageBytes = new TextEncoder().encode(JSON.stringify(message));
      const signatureBytes = Buffer.from(signature, 'hex');
      const publicKeyBytes = Buffer.from(publicKey, 'hex');
      
      return await ed.verifyAsync(signatureBytes, messageBytes, publicKeyBytes);
    } catch {
      return false;
    }
  }
}

/**
 * Global A2A handler instance
 */
export const a2aHandler = new A2AProtocolHandler();
