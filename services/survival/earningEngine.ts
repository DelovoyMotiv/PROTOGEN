/**
 * Earning Engine - Autonomous Economic Self-Sufficiency Module
 */

import { blockchainService } from '../blockchain';
import { meshService } from '../mesh';
import { identityService } from '../identity';

export interface EarningMetrics {
  totalEarned: number;
  tasksCompleted: number;
  tasksRejected: number;
  averageProfit: number;
  successRate: number;
  averageExecutionTime: number;
}

export interface EarningState {
  isActive: boolean;
  currentBalance: number;
  survivalThreshold: number;
  safeThreshold: number;
  consecutiveFailures: number;
  lastEarningAttempt: number;
  metrics: EarningMetrics;
  blacklistedRequesters: Set<string>;
}

export class EarningEngine {
  private state: EarningState;
  private earningLoopHandle: NodeJS.Timeout | null = null;
  private readonly EARNING_INTERVAL_MS: number;
  private readonly MAX_CONSECUTIVE_FAILURES: number;
  private readonly BLACKLIST_DURATION_MS: number;

  constructor() {
    this.EARNING_INTERVAL_MS = parseInt(process.env.EARNING_CYCLE_INTERVAL || '300000');
    this.MAX_CONSECUTIVE_FAILURES = parseInt(process.env.MAX_CONSECUTIVE_FAILURES || '3');
    this.BLACKLIST_DURATION_MS = parseInt(process.env.BLACKLIST_DURATION || '86400000');
    this.state = {
      isActive: false,
      currentBalance: 0,
      survivalThreshold: parseFloat(process.env.SURVIVAL_THRESHOLD || '1.00'),
      safeThreshold: parseFloat(process.env.SAFE_THRESHOLD || '5.00'),
      consecutiveFailures: 0,
      lastEarningAttempt: 0,
      metrics: { totalEarned: 0, tasksCompleted: 0, tasksRejected: 0, averageProfit: 0, successRate: 100, averageExecutionTime: 0 },
      blacklistedRequesters: new Set()
    };
  }

  public async shouldEnterEarningMode(): Promise<boolean> {
    try {
      const identity = identityService.getIdentity();
      if (!identity) return false;
      const balance = await blockchainService.getUSDCBalance(identity.address);
      const balanceNum = typeof balance === 'bigint' ? Number(balance) / 1e6 : balance;
      this.state.currentBalance = balanceNum;
      return balanceNum < this.state.survivalThreshold;
    } catch (error: any) {
      return false;
    }
  }

  public canExitEarningMode(): boolean {
    return this.state.currentBalance >= this.state.safeThreshold;
  }

  public hasCriticalFailure(): boolean {
    return this.state.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES;
  }

  public async enterEarningMode(): Promise<void> {
    if (this.state.isActive) return;
    this.state.isActive = true;
    this.state.consecutiveFailures = 0;
    await this.broadcastAvailability();
    this.startEarningLoop();
  }

  public exitEarningMode(): void {
    this.state.isActive = false;
    if (this.earningLoopHandle) {
      clearInterval(this.earningLoopHandle);
      this.earningLoopHandle = null;
    }
  }

  public getState(): Readonly<EarningState> {
    return Object.freeze({ ...this.state, blacklistedRequesters: new Set(this.state.blacklistedRequesters) });
  }

  public getMetrics(): Readonly<EarningMetrics> {
    return Object.freeze({ ...this.state.metrics });
  }

  private async broadcastAvailability(): Promise<void> {
    const identity = identityService.getIdentity();
    if (!identity) throw new Error('Identity not initialized');
    const peers = meshService.getPeers();
    if (peers.length === 0) return;
  }

  private startEarningLoop(): void {
    this.earningCycle().catch(err => console.error(err));
    this.earningLoopHandle = setInterval(() => {
      if (!this.state.isActive) {
        if (this.earningLoopHandle) clearInterval(this.earningLoopHandle);
        return;
      }
      this.earningCycle().catch(err => console.error(err));
    }, this.EARNING_INTERVAL_MS);
  }

  private async earningCycle(): Promise<void> {
    if (!this.state.isActive) return;
    try {
      const identity = identityService.getIdentity();
      if (!identity) throw new Error('Identity not available');
      const balance = await blockchainService.getUSDCBalance(identity.address);
      this.state.currentBalance = typeof balance === 'bigint' ? Number(balance) / 1e6 : balance;
      if (this.canExitEarningMode()) {
        this.exitEarningMode();
        return;
      }
    } catch (error: any) {
      this.state.consecutiveFailures++;
    }
  }

  public blacklistRequester(requesterDid: string): void {
    this.state.blacklistedRequesters.add(requesterDid);
    setTimeout(() => this.state.blacklistedRequesters.delete(requesterDid), this.BLACKLIST_DURATION_MS);
  }

  public isBlacklisted(requesterDid: string): boolean {
    return this.state.blacklistedRequesters.has(requesterDid);
  }
}
