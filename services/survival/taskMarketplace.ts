/**
 * Task Marketplace Client
 * 
 * Discovers and evaluates paying tasks in the mesh network.
 * Uses Kademlia DHT to find nodes advertising tasks.
 * 
 * @module services/survival/taskMarketplace
 */

import { meshService } from '../mesh';
import { identityService } from '../identity';
import { blockchainService } from '../blockchain';

export interface Task {
  task_id: string;
  type: string;
  payment: {
    amount: string;
    token: 'USDC';
    chain_id: number;
    escrow: string;
  };
  requirements: {
    min_ccc_balance: number;
    min_reputation: number;
  };
  deadline: number;
  description: string;
  requester_did: string;
}

export interface TaskEvaluation {
  meetsRequirements: boolean;
  isProfitable: boolean;
  estimatedCost: number;
  estimatedProfit: number;
  estimatedDuration: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface Bid {
  bidder_did: string;
  amount: number;
  timestamp: number;
}

export class TaskMarketplace {
  private readonly MIN_PROFIT_MARGIN = parseFloat(process.env.MIN_PROFIT_MARGIN || '0.30');
  private readonly MAX_TASK_DURATION = parseInt(process.env.MAX_TASK_DURATION || '1800'); // 30 minutes

  /**
   * Query mesh network for available tasks
   * Requirement 2.1: Query mesh DHT for task-offering nodes
   * Requirement 2.2: Send A2A task query messages
   */
  public async queryAvailableTasks(): Promise<Task[]> {
    console.log('[TaskMarketplace] Querying mesh for available tasks');

    try {
      // Query mesh for nodes with 'task-offering' capability
      const peers = meshService.getPeers();
      const taskOfferingPeers = peers.filter(peer => 
        peer.reputation > 50 // Only query reputable peers
      );

      console.log(`[TaskMarketplace] Found ${taskOfferingPeers.length} potential task providers`);

      const tasks: Task[] = [];

      // Query each peer for tasks via A2A protocol
      for (const peer of taskOfferingPeers) {
        if (!peer.did) continue;

        try {
          const peerTasks = await this.queryPeerForTasks(peer.did);
          tasks.push(...peerTasks);
        } catch (error: any) {
          console.warn(`[TaskMarketplace] Failed to query peer ${peer.did.substring(0, 16)}:`, error.message);
        }
      }

      console.log(`[TaskMarketplace] Found ${tasks.length} available tasks`);

      // For development/testing, add mock task if no real tasks found
      if (tasks.length === 0 && process.env.NODE_ENV === 'development') {
        console.log('[TaskMarketplace] No tasks found, adding mock task for testing');
        tasks.push(this.createMockTask());
      }

      return tasks;
    } catch (error: any) {
      console.error('[TaskMarketplace] Query failed:', error.message);
      return [];
    }
  }

  /**
   * Query a specific peer for available tasks via A2A protocol
   * Sends 'task.query' JSON-RPC request
   */
  private async queryPeerForTasks(peerDid: string): Promise<Task[]> {
    try {
      // Construct A2A JSON-RPC request
      const request = {
        jsonrpc: '2.0' as const,
        id: `task-query-${Date.now()}`,
        method: 'task.query',
        params: {
          requester_did: identityService.getIdentity()?.did,
          capabilities: ['geo.audit', 'data.verification'],
          max_results: 10
        }
      };

      // Send via mesh network
      // Note: Full mesh integration will be completed when mesh service supports A2A messaging
      console.log(`[TaskMarketplace] Querying ${peerDid.substring(0, 16)} for tasks`);
      
      // TODO: Implement when mesh service supports A2A JSON-RPC
      // const response = await meshService.sendA2ARequest(peerDid, request);
      // return response.result?.tasks || [];

      return [];
    } catch (error: any) {
      console.error(`[TaskMarketplace] Peer query failed:`, error.message);
      return [];
    }
  }

  /**
   * Query competing bids for a task
   * Used for competitive bidding strategy
   */
  public async queryCompetingBids(taskId: string, requesterDid: string): Promise<Bid[]> {
    try {
      const request = {
        jsonrpc: '2.0' as const,
        id: `bids-${taskId}`,
        method: 'task.bids',
        params: {
          task_id: taskId
        }
      };

      console.log(`[TaskMarketplace] Querying competing bids for task ${taskId}`);
      
      // TODO: Send via mesh when A2A messaging is integrated
      // const response = await meshService.sendA2ARequest(requesterDid, request);
      // return response.result?.bids || [];

      return [];
    } catch (error: any) {
      console.error('[TaskMarketplace] Failed to query bids:', error.message);
      return [];
    }
  }

  /**
   * Evaluate if a task meets requirements and is profitable
   * Requirement 2.3: Check CCC balance requirement
   * Requirement 2.4: Check reputation requirement
   * Requirement 2.5: Calculate estimated cost
   * Requirement 2.6: Calculate profit margin
   * Requirement 2.7: Check duration limit
   */
  public async evaluateTask(task: Task): Promise<TaskEvaluation> {
    const identity = identityService.getIdentity();
    if (!identity) {
      throw new Error('Identity not available');
    }

    // Check requirements
    const cccBalance = identityService.getWalletState().balanceCCC;
    const meetsRequirements = 
      cccBalance >= task.requirements.min_ccc_balance &&
      this.getAgentReputation() >= task.requirements.min_reputation;

    // Estimate costs
    const estimatedCost = await this.estimateTaskCost(task);
    const paymentAmount = parseFloat(task.payment.amount);
    const estimatedProfit = paymentAmount - estimatedCost;
    const isProfitable = estimatedProfit >= (paymentAmount * this.MIN_PROFIT_MARGIN);

    // Estimate duration
    const estimatedDuration = this.estimateTaskDuration(task);

    // Check resource constraints
    const withinResourceLimits = estimatedDuration <= this.MAX_TASK_DURATION;

    // Determine risk level
    const riskLevel = this.assessRiskLevel(task);

    return {
      meetsRequirements: meetsRequirements && withinResourceLimits,
      isProfitable,
      estimatedCost,
      estimatedProfit,
      estimatedDuration,
      riskLevel
    };
  }

  /**
   * Accept a task
   * Requirement 2.1: Send JOB_ACCEPT A2A message
   * Requirement 2.7: Verify escrow funds locked
   */
  public async acceptTask(task: Task): Promise<boolean> {
    console.log(`[TaskMarketplace] Accepting task: ${task.task_id}`);

    try {
      const identity = identityService.getIdentity();
      if (!identity) {
        throw new Error('Identity not available');
      }

      // 1. Verify escrow funds are locked on-chain
      console.log(`[TaskMarketplace] Verifying escrow funds at ${task.payment.escrow}`);
      const escrowBalance = await blockchainService.getUSDCBalance(task.payment.escrow);
      const requiredAmount = BigInt(Math.floor(parseFloat(task.payment.amount) * 1e6));
      
      if (escrowBalance < requiredAmount) {
        console.error(`[TaskMarketplace] Insufficient escrow funds: ${escrowBalance} < ${requiredAmount}`);
        return false;
      }

      console.log(`[TaskMarketplace] Escrow verified: ${escrowBalance} >= ${requiredAmount}`);

      // 2. Send JOB_ACCEPT message via A2A protocol
      const acceptMessage = {
        jsonrpc: '2.0' as const,
        id: `accept-${task.task_id}`,
        method: 'task.accept',
        params: {
          task_id: task.task_id,
          worker_did: identity.did,
          worker_address: identity.address,
          timestamp: Date.now()
        }
      };

      console.log(`[TaskMarketplace] Sending JOB_ACCEPT to ${task.requester_did.substring(0, 16)}`);
      
      // TODO: Send via mesh when A2A messaging is integrated
      // const response = await meshService.sendA2ARequest(task.requester_did, acceptMessage);
      // return response.result?.accepted === true;

      // For now, assume acceptance succeeds if escrow is valid
      console.log(`[TaskMarketplace] Task ${task.task_id} accepted successfully`);
      return true;
    } catch (error: any) {
      console.error('[TaskMarketplace] Task acceptance failed:', error.message);
      return false;
    }
  }

  /**
   * Estimate the cost of executing a task
   */
  private async estimateTaskCost(task: Task): Promise<number> {
    // Base compute cost
    const estimatedDuration = this.estimateTaskDuration(task);
    const computeCost = (estimatedDuration / 1000) * 0.001; // $0.001 per second

    // Gas cost for claiming payment
    try {
      const gasPrice = await blockchainService.getGasPrice();
      const gasLimit = 100000n; // Estimate for escrow release
      const gasCostWei = gasPrice * gasLimit * 120n / 100n; // 20% safety margin
      const gasCostEth = Number(gasCostWei) / 1e18;
      const gasCostUSDC = gasCostEth * 2000; // Assume 2000 USDC/ETH

      return computeCost + gasCostUSDC;
    } catch (error) {
      // Fallback to conservative estimate
      return computeCost + 0.05; // $0.05 gas estimate
    }
  }

  /**
   * Estimate task duration in milliseconds
   */
  private estimateTaskDuration(task: Task): number {
    // Simple heuristic based on task type
    switch (task.type) {
      case 'geo.audit.request':
        return 10 * 60 * 1000; // 10 minutes
      case 'data.verification':
        return 5 * 60 * 1000; // 5 minutes
      default:
        return 15 * 60 * 1000; // 15 minutes default
    }
  }

  /**
   * Assess risk level of a task
   */
  private assessRiskLevel(task: Task): 'LOW' | 'MEDIUM' | 'HIGH' {
    const paymentAmount = parseFloat(task.payment.amount);
    
    // High payment from unknown requester = HIGH risk
    if (paymentAmount > 1.0 && task.requirements.min_reputation === 0) {
      return 'HIGH';
    }

    // Reasonable payment with requirements = LOW risk
    if (paymentAmount <= 1.0 && task.requirements.min_ccc_balance > 0) {
      return 'LOW';
    }

    return 'MEDIUM';
  }

  /**
   * Get agent's current reputation score
   */
  private getAgentReputation(): number {
    // TODO: Implement reputation tracking
    return 100; // Default high reputation for now
  }

  /**
   * Create a mock task for testing
   */
  private createMockTask(): Task {
    return {
      task_id: `task-${Date.now()}`,
      type: 'geo.audit.request',
      payment: {
        amount: '0.50',
        token: 'USDC',
        chain_id: 8453,
        escrow: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
      },
      requirements: {
        min_ccc_balance: 100,
        min_reputation: 50
      },
      deadline: Date.now() + 3600000, // 1 hour
      description: 'Audit example.com and return UCPT proof',
      requester_did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
    };
  }
}
