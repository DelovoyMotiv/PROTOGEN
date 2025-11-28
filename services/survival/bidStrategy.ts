/**
 * Bid Strategy Engine
 * 
 * Implements dynamic pricing algorithm for task bidding.
 * Calculates optimal bid prices based on costs, competition, and profit margins.
 * 
 * @module services/survival/bidStrategy
 */

import { Task } from './taskMarketplace';
import { blockchainService } from '../blockchain';

export interface Bid {
  bidder_did: string;
  amount: number;
  timestamp: number;
}

export class BidStrategy {
  private readonly MIN_PROFIT_MARGIN = parseFloat(process.env.MIN_PROFIT_MARGIN || '0.30');
  private readonly RISK_PREMIUM = 0.20; // 20% premium for unknown peers
  private readonly COMPETITIVE_UNDERCUT = 0.05; // 5% undercut

  /**
   * Calculate optimal bid price for a task
   */
  public async calculateBid(task: Task, competition: Bid[]): Promise<number> {
    // Calculate base cost
    const baseCost = await this.calculateBaseCost(task);
    
    // Get gas estimate
    const gasEstimate = await this.estimateGasCost();
    
    // Calculate risk premium
    const riskPremium = this.calculateRiskPremium(task);
    
    // Calculate profit margin
    const profitMargin = baseCost * this.MIN_PROFIT_MARGIN;
    
    // Base bid price
    let bidPrice = baseCost + gasEstimate + riskPremium + profitMargin;

    // Adjust for competition
    if (competition.length > 0) {
      const lowestBid = Math.min(...competition.map(b => b.amount));
      const competitiveBid = lowestBid * (1 - this.COMPETITIVE_UNDERCUT);
      
      // Only undercut if still profitable
      const minAcceptable = baseCost + gasEstimate + (baseCost * this.MIN_PROFIT_MARGIN);
      if (competitiveBid >= minAcceptable) {
        bidPrice = competitiveBid;
      }
    }

    // Ensure we don't bid more than task payment
    const maxPayment = parseFloat(task.payment.amount);
    bidPrice = Math.min(bidPrice, maxPayment);

    console.log(`[BidStrategy] Calculated bid: $${bidPrice.toFixed(4)} (base: $${baseCost.toFixed(4)}, gas: $${gasEstimate.toFixed(4)}, risk: $${riskPremium.toFixed(4)}, profit: $${profitMargin.toFixed(4)})`);

    return bidPrice;
  }

  /**
   * Check if task is profitable at given bid price
   */
  public async isTaskProfitable(task: Task, bidPrice: number): Promise<boolean> {
    const baseCost = await this.calculateBaseCost(task);
    const gasEstimate = await this.estimateGasCost();
    const totalCost = baseCost + gasEstimate;
    
    const profit = bidPrice - totalCost;
    const profitMargin = profit / bidPrice;

    const isProfitable = profitMargin >= this.MIN_PROFIT_MARGIN;

    console.log(`[BidStrategy] Profitability check: ${isProfitable} (margin: ${(profitMargin * 100).toFixed(1)}%, min: ${(this.MIN_PROFIT_MARGIN * 100).toFixed(1)}%)`);

    return isProfitable;
  }

  /**
   * Calculate base execution cost
   */
  private async calculateBaseCost(task: Task): Promise<number> {
    // Estimate compute time based on task type
    const estimatedTimeSeconds = this.estimateExecutionTime(task);
    
    // Cost per second of compute
    const costPerSecond = 0.001; // $0.001 per second
    
    return estimatedTimeSeconds * costPerSecond;
  }

  /**
   * Estimate gas cost for claiming payment
   */
  private async estimateGasCost(): Promise<number> {
    try {
      const gasPrice = await blockchainService.getGasPrice();
      const gasLimit = 100000n; // Estimate for escrow release
      
      // Add 20% safety margin
      const gasCostWei = gasPrice * gasLimit * 120n / 100n;
      const gasCostEth = Number(gasCostWei) / 1e18;
      
      // Convert to USDC (assume 2000 USDC/ETH)
      const gasCostUSDC = gasCostEth * 2000;
      
      return gasCostUSDC;
    } catch (error) {
      // Fallback to conservative estimate
      return 0.05; // $0.05
    }
  }

  /**
   * Calculate risk premium based on requester trust
   */
  private calculateRiskPremium(task: Task): number {
    // TODO: Query mesh for requester reputation
    const requesterTrust = this.getRequesterTrust(task.requester_did);
    
    if (requesterTrust < 50) {
      // Unknown or low-trust requester
      const baseCost = this.estimateExecutionTime(task) * 0.001;
      return baseCost * this.RISK_PREMIUM;
    }
    
    return 0; // No premium for trusted requesters
  }

  /**
   * Estimate execution time in seconds
   */
  private estimateExecutionTime(task: Task): number {
    switch (task.type) {
      case 'geo.audit.request':
        return 600; // 10 minutes
      case 'data.verification':
        return 300; // 5 minutes
      default:
        return 900; // 15 minutes default
    }
  }

  /**
   * Get requester trust score from reputation cache
   */
  private getRequesterTrust(requesterDid: string): number {
    // TODO: Implement reputation cache lookup
    // For now, return default medium trust
    return 70;
  }
}
