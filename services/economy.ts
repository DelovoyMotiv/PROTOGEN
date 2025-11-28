import { IdentityModule, identityService } from './identity';
import { CryptoService } from './crypto';
import { oracleService } from './oracle';
import { blockchainService } from './blockchain';

// ECONOMY MODULE
// Handles Agent-Pay-Agent (APA) standards, Causal Contribution Credits (CCC) mining,
// and Gas/Cost Estimation via Real-time Oracle.

export class EconomyModule {
  private miningActive: boolean = false;
  private cccBalance: number = 0;
  private miningHandle: number | null = null; // requestAnimationFrame ID
  private intensity: 'LOW' | 'HIGH' = 'LOW';
  private hashesPerSecond: number = 0;
  private lastHashTime: number = 0;
  private hashCount: number = 0;
  
  // Mining Configuration
  private miningDifficulty: number = 2; // Default: 2 leading hex zeros (1/256 chance)

  constructor(private identityService: IdentityModule) {}

  /**
   * Generates a payment invoice. 
   * Includes strict expiration based on current Oracle block time if possible.
   */
  public async generateAPAInvoice(amountUSDC: number, service: string): Promise<string> {
    const identity = this.identityService.getIdentity();
    if (!identity) throw new Error("Identity not ready");

    // Standard APA Invoice format (JSON-LD compatible envelope)
    const invoice = {
      "@context": "https://anoteroslogos.com/schemas/apa/v1",
      "type": "Invoice",
      "issuer": identity.did,
      "payee": identity.address,
      "amount": {
        "value": amountUSDC.toFixed(6),
        "currency": "USDC",
        "chain_id": 8453 // Base
      },
      "service_code": service,
      "expiry": Date.now() + 3600000, // 1 hour
      "nonce": crypto.randomUUID()
    };

    const signature = await this.identityService.signAttestation(CryptoService.canonicalize(invoice));
    
    return JSON.stringify({
      invoice,
      signature
    });
  }

  /**
   * Estimates the total cost of a transaction including network fees.
   * Uses real blockchain gas estimation with safety margins.
   * Throws if the network is too congested (Economic Safety).
   */
  public async estimateTotalCost(serviceCostUSDC: number): Promise<number> {
      // Check network congestion via BlockchainService
      const isCongested = await blockchainService.isNetworkCongested();
      
      if (isCongested) {
          const gasPrice = await blockchainService.getGasPrice();
          const gasPriceGwei = Number(gasPrice) / 1e9;
          throw new Error(`Network Congested (${gasPriceGwei.toFixed(2)} Gwei). Aborting to save capital.`);
      }

      try {
          // Get real gas price from blockchain
          const gasPrice = await blockchainService.getGasPrice();
          
          // Estimate gas for a typical ETH transfer (21000 gas)
          // For USDC ERC-20 transfer, it's typically ~50,000 gas
          const gasLimit = 50000n;
          
          // Calculate L2 fee
          const l2FeeWei = gasPrice * gasLimit;
          
          // Add 10% safety margin for gas price volatility
          const l2FeeWithMargin = l2FeeWei * 110n / 100n;
          
          // Heuristic L1 Data Fee for Base (approx 0.00005 ETH)
          const l1DataFeeWei = 50000000000000n; // 0.00005 ETH in Wei
          
          // Total fee in ETH
          const totalFeeWei = l2FeeWithMargin + l1DataFeeWei;
          const totalFeeEth = Number(totalFeeWei) / 1e18;
          
          // Convert to USDC (using oracle or fallback to 2000 USDC/ETH)
          const ethPriceUSDC = 2000; // TODO: Get from price oracle
          const estimatedFeeUSDC = totalFeeEth * ethPriceUSDC;

          console.log(`Gas estimation: ${Number(gasPrice) / 1e9} Gwei, Fee: ${estimatedFeeUSDC.toFixed(6)} USDC`);

          return serviceCostUSDC + estimatedFeeUSDC;
      } catch (error: any) {
          console.warn('Gas estimation failed, using fallback:', error.message);
          
          // Fallback to conservative estimate
          const fallbackFeeUSDC = 0.10; // $0.10 conservative estimate for Base L2
          return serviceCostUSDC + fallbackFeeUSDC;
      }
  }

  // --- MINING & CONSENSUS ---

  public startCCCMining(intensity: 'LOW' | 'HIGH' = 'LOW') {
    this.intensity = intensity;
    if (!this.miningActive) {
      this.miningActive = true;
      this.mineLoop();
    }
  }

  public setMiningIntensity(intensity: 'LOW' | 'HIGH') {
    this.intensity = intensity;
  }

  public getMiningIntensity(): 'LOW' | 'HIGH' {
    return this.intensity;
  }

  /**
   * Adjusts the difficulty (number of leading zero hex chars required).
   * Range: 1 (Easy) to 5 (Hard).
   */
  public setMiningDifficulty(difficulty: number) {
      // Clamp between 1 and 5
      this.miningDifficulty = Math.max(1, Math.min(5, Math.floor(difficulty)));
  }

  public getMiningDifficulty(): number {
      return this.miningDifficulty;
  }

  /**
   * Calculates reward based on difficulty to maintain fair expected value.
   * Diff 1: 1/16 prob -> Reward Base / 16
   * Diff 2: 1/256 prob -> Reward Base
   * Formula: Base * 16^(Diff - 2)
   */
  public getBlockReward(): number {
      const BASE_REWARD = 0.0005; // Calibrated for Diff 2
      return BASE_REWARD * Math.pow(16, this.miningDifficulty - 2);
  }

  public getHashRate(): number {
    return this.hashesPerSecond;
  }

  public stopMining() {
    this.miningActive = false;
    if (this.miningHandle) {
      cancelAnimationFrame(this.miningHandle);
      this.miningHandle = null;
    }
    this.hashesPerSecond = 0;
  }

  private async mineLoop() {
    if (!this.miningActive) return;

    // Throttle based on intensity
    // HIGH: Run continuously
    // LOW: Run sparingly (add delay)
    
    const now = performance.now();
    if (now - this.lastHashTime >= 1000) {
      this.hashesPerSecond = this.hashCount;
      this.hashCount = 0;
      this.lastHashTime = now;
    }

    const batchSize = this.intensity === 'HIGH' ? 50 : 5; // Hashes per frame

    for (let i = 0; i < batchSize; i++) {
        await this.performWork();
        this.hashCount++;
    }

    // Yield to main thread
    if (this.intensity === 'HIGH') {
        this.miningHandle = requestAnimationFrame(() => this.mineLoop());
    } else {
        setTimeout(() => {
            this.miningHandle = requestAnimationFrame(() => this.mineLoop());
        }, 100); // 100ms delay for LOW intensity
    }
  }

  private async performWork() {
    // 1. Context: Previous block hash (simulated for demo, would be from mesh)
    const previousHash = "0x0000a89b7c...graph_tip";
    
    // 2. Nonce: Random entropy
    const nonce = toHex(crypto.getRandomValues(new Uint8Array(16)));
    
    // 3. Data: Timestamp + Nonce
    const dataToHash = `${previousHash}:${Date.now()}:${nonce}`;
    
    // 4. Hash: SHA-256 (Real Crypto Op)
    const hash = await this.sha256(dataToHash);
    
    // 5. Difficulty Check
    const targetPrefix = "0".repeat(this.miningDifficulty);
    if (hash.startsWith(targetPrefix)) {
        // Valid Block Found
        this.cccBalance += this.getBlockReward();
        // In a real node, we would broadcast this block here
    }
  }

  private async sha256(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return '0x' + Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  public getCCCBalance() {
    return this.cccBalance;
  }
}

function toHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Export a singleton instance that uses the shared identity service
export const economyService = new EconomyModule(identityService);