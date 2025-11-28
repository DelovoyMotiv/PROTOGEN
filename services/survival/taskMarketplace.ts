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

export class TaskMarketplace {
  private readonly MIN_PROFIT_MARGIN = parseFloat(process.env.MIN_PROFIT_MARGIN || '0.30');
  private readonly MAX_TASK_DURATION = parseInt(process.env.MAX_TASK_DURATION || '1800'); // 30 minutes

  /**
   * Query mesh network for available tasks
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

      // Query each peer for tasks
      for (const peer of taskOfferingPeers) {
        try {
          // TODO: Implement A2A query for tasks
          // const peerTasks = await this.queryPeerForTasks(peer.did);
          // tasks.push(...peerTasks);
        } catch (error: any) {
          console.warn(`[TaskMarketplace] Failed to query peer ${peer.did}:`, error.message);
        }
      }

      // For now, return mock tasks for testing
      if (tasks.length === 0 && process.env.NODE_ENV === 'development') {
        tasks.push(this.createMockTask());
      }

      return tasks;
    } catch (error: any) {
      console.error('[TaskMarketplace] Query failed:', error.message);
      return [];
    }
  }

  /**
   * Evaluate if a task meets requirements and is profitable
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
   */
  public async acceptTask(taskId: string): Promise<boolean> {
    console.log(`[TaskMarketplace] Accepting task: ${taskId}`);

    try {
      // TODO: Implement A2A task acceptance
      // Send JOB_ACCEPT message to requester
      // Verify escrow funds are locked
      
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
