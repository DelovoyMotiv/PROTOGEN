/**
 * Risk Assessment Module
 * 
 * Evaluates security risks before accepting tasks.
 * Validates requesters, inspects payloads, and verifies payments.
 * 
 * @module services/survival/riskAssessment
 */

import { Task } from './taskMarketplace';
import { blockchainService } from '../blockchain';
import { meshService } from '../mesh';

export interface RiskScore {
  overall: number; // 0-100 (lower is better)
  factors: {
    requester_trust: number;
    payload_safety: number;
    payment_security: number;
  };
}

export class RiskAssessment {
  private readonly TRUST_THRESHOLD = 30;
  private readonly RISK_THRESHOLD = 70;

  /**
   * Evaluate overall risk of a task
   */
  public async evaluateTaskRisk(task: Task): Promise<RiskScore> {
    console.log(`[RiskAssessment] Evaluating risk for task: ${task.task_id}`);

    // 1. Requester validation
    const requesterTrust = await this.validateRequester(task);

    // 2. Payload inspection
    const payloadSafety = await this.inspectPayload(task);

    // 3. Payment verification
    const paymentSecurity = await this.verifyPayment(task);

    // Calculate overall risk (weighted average)
    const overall = Math.round(
      (requesterTrust * 0.4) +
      (payloadSafety * 0.3) +
      (paymentSecurity * 0.3)
    );

    const riskScore: RiskScore = {
      overall,
      factors: {
        requester_trust: requesterTrust,
        payload_safety: payloadSafety,
        payment_security: paymentSecurity
      }
    };

    console.log(`[RiskAssessment] Risk score: ${overall}/100 (trust: ${requesterTrust}, payload: ${payloadSafety}, payment: ${paymentSecurity})`);

    return riskScore;
  }

  /**
   * Determine if task is safe to execute
   */
  public async isTaskSafe(task: Task): Promise<boolean> {
    const riskScore = await this.evaluateTaskRisk(task);
    
    // Reject if overall risk too high
    if (riskScore.overall > this.RISK_THRESHOLD) {
      console.log(`[RiskAssessment] Task rejected: overall risk too high (${riskScore.overall})`);
      return false;
    }

    // Reject if requester trust too low
    if (riskScore.factors.requester_trust > (100 - this.TRUST_THRESHOLD)) {
      console.log(`[RiskAssessment] Task rejected: requester trust too low`);
      return false;
    }

    // Reject if payload unsafe
    if (riskScore.factors.payload_safety > 50) {
      console.log(`[RiskAssessment] Task rejected: payload safety concerns`);
      return false;
    }

    // Reject if payment not secure
    if (riskScore.factors.payment_security > 50) {
      console.log(`[RiskAssessment] Task rejected: payment security concerns`);
      return false;
    }

    console.log(`[RiskAssessment] Task approved: safe to execute`);
    return true;
  }

  /**
   * Validate requester identity and reputation
   */
  private async validateRequester(task: Task): Promise<number> {
    try {
      // Check requester's DID against mesh reputation cache
      const peers = meshService.getPeers();
      const requesterPeer = peers.find(p => p.did === task.requester_did);

      if (!requesterPeer) {
        // Unknown requester
        console.log(`[RiskAssessment] Unknown requester: ${task.requester_did}`);
        return 70; // High risk for unknown
      }

      // Convert reputation (0-100) to risk (0-100, inverted)
      const riskScore = 100 - requesterPeer.reputation;

      // Verify requester controls the escrow wallet
      const controlsEscrow = await this.verifyEscrowControl(
        task.requester_did,
        task.payment.escrow
      );

      if (!controlsEscrow) {
        console.log(`[RiskAssessment] Requester does not control escrow wallet`);
        return 100; // Maximum risk
      }

      return riskScore;
    } catch (error: any) {
      console.error(`[RiskAssessment] Requester validation error:`, error.message);
      return 100; // Maximum risk on error
    }
  }

  /**
   * Inspect task payload for security risks
   */
  private async inspectPayload(task: Task): Promise<number> {
    try {
      const description = task.description.toLowerCase();

      // Check for dangerous keywords
      const dangerousPatterns = [
        'exec', 'eval', 'system', 'shell',
        'private', 'key', 'vault', 'password',
        'rm -rf', 'delete', 'drop table'
      ];

      for (const pattern of dangerousPatterns) {
        if (description.includes(pattern)) {
          console.log(`[RiskAssessment] Dangerous pattern detected: ${pattern}`);
          return 100; // Maximum risk
        }
      }

      // Check task type is supported
      const supportedTypes = ['geo.audit.request', 'data.verification'];
      if (!supportedTypes.includes(task.type)) {
        console.log(`[RiskAssessment] Unsupported task type: ${task.type}`);
        return 80; // High risk for unknown types
      }

      // TODO: Implement sandbox simulation
      // const simulationResult = await this.simulateInSandbox(task);
      // if (!simulationResult.safe) return 100;

      return 10; // Low risk if all checks pass
    } catch (error: any) {
      console.error(`[RiskAssessment] Payload inspection error:`, error.message);
      return 100; // Maximum risk on error
    }
  }

  /**
   * Verify payment is secured in escrow
   */
  private async verifyPayment(task: Task): Promise<number> {
    try {
      // Query escrow smart contract
      const escrowAddress = task.payment.escrow;
      const paymentAmount = parseFloat(task.payment.amount);

      // TODO: Implement escrow contract query
      // const lockedFunds = await escrowService.getLockedFunds(task.task_id);
      // if (lockedFunds < paymentAmount) {
      //   console.log(`[RiskAssessment] Insufficient funds in escrow`);
      //   return 100;
      // }

      // Verify payment is releasable only upon UCPT proof
      // TODO: Check escrow contract logic
      // const requiresProof = await escrowService.requiresProof(task.task_id);
      // if (!requiresProof) {
      //   console.log(`[RiskAssessment] Escrow does not require UCPT proof`);
      //   return 80;
      // }

      // For now, basic validation
      if (!escrowAddress || escrowAddress === '0x0') {
        console.log(`[RiskAssessment] Invalid escrow address`);
        return 100;
      }

      if (paymentAmount <= 0) {
        console.log(`[RiskAssessment] Invalid payment amount`);
        return 100;
      }

      return 20; // Low-medium risk if basic checks pass
    } catch (error: any) {
      console.error(`[RiskAssessment] Payment verification error:`, error.message);
      return 100; // Maximum risk on error
    }
  }

  /**
   * Verify requester controls the escrow wallet
   */
  private async verifyEscrowControl(requesterDid: string, escrowAddress: string): Promise<boolean> {
    try {
      // TODO: Implement on-chain verification
      // Query blockchain to verify DID is linked to escrow address
      // This could be done via a registry contract or by checking signatures
      
      // For now, assume valid if escrow address is provided
      return escrowAddress !== '0x0' && escrowAddress.length === 42;
    } catch (error) {
      return false;
    }
  }

  /**
   * Simulate task execution in isolated sandbox
   */
  private async simulateInSandbox(task: Task): Promise<{ safe: boolean; reason?: string }> {
    // TODO: Implement sandbox simulation using isolated-vm or Docker
    // - Monitor CPU usage
    // - Monitor memory usage
    // - Monitor file system access
    // - Kill if exceeds limits
    
    return { safe: true };
  }
}
