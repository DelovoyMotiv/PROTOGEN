import { createPublicClient, createWalletClient, http, parseAbi, formatUnits, type Hash, type TransactionReceipt } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// PRODUCTION-GRADE BLOCKCHAIN SERVICE
// Real Base L2 integration with fallback providers and retry logic

const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const FALLBACK_RPC_URLS = [
  'https://base.llamarpc.com',
  'https://base.blockpi.network/v1/rpc/public',
];

const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base USDC
const USDC_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) returns (bool)',
]);

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const CONFIRMATION_BLOCKS = 1;

export class BlockchainService {
  private publicClient: any; // Simplified typing to avoid viem version conflicts
  private currentRpcIndex = 0;

  constructor() {
    this.publicClient = this.createPublicClient(BASE_RPC_URL);
  }

  private createPublicClient(rpcUrl: string) {
    return createPublicClient({
      chain: base,
      transport: http(rpcUrl, {
        timeout: 30_000,
        retryCount: 2,
        retryDelay: 1000,
      }),
    });
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        console.warn(`${operationName} failed (attempt ${attempt + 1}/${MAX_RETRIES}):`, error.message);

        // Try fallback RPC if available
        if (attempt < FALLBACK_RPC_URLS.length) {
          console.log(`Switching to fallback RPC: ${FALLBACK_RPC_URLS[attempt]}`);
          this.publicClient = this.createPublicClient(FALLBACK_RPC_URLS[attempt]);
        }

        // Exponential backoff
        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`${operationName} failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  // --- BALANCE OPERATIONS ---

  public async getUSDCBalance(address: string): Promise<bigint> {
    return this.withRetry(async () => {
      const balance = await this.publicClient.readContract({
        address: USDC_CONTRACT_ADDRESS,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      });

      return balance as bigint;
    }, 'getUSDCBalance');
  }

  public async getETHBalance(address: string): Promise<bigint> {
    return this.withRetry(async () => {
      const balance = await this.publicClient.getBalance({
        address: address as `0x${string}`,
      });

      return balance;
    }, 'getETHBalance');
  }

  // --- TRANSACTION OPERATIONS ---

  public async broadcastTransaction(signedTx: string): Promise<string> {
    return this.withRetry(async () => {
      const hash = await this.publicClient.sendRawTransaction({
        serializedTransaction: signedTx as `0x${string}`,
      });

      console.log(`Transaction broadcast: ${hash}`);
      return hash;
    }, 'broadcastTransaction');
  }

  public async waitForConfirmation(
    txHash: string,
    blocks: number = CONFIRMATION_BLOCKS
  ): Promise<TransactionReceipt> {
    return this.withRetry(async () => {
      console.log(`Waiting for ${blocks} confirmation(s) for tx: ${txHash}`);

      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
        confirmations: blocks,
        timeout: 120_000, // 2 minutes
      });

      if (receipt.status === 'reverted') {
        // Try to get revert reason
        const revertReason = await this.getRevertReason(txHash);
        throw new Error(`Transaction reverted: ${revertReason || 'Unknown reason'}`);
      }

      console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
      return receipt;
    }, 'waitForConfirmation');
  }

  private async getRevertReason(txHash: string): Promise<string | null> {
    try {
      const tx = await this.publicClient.getTransaction({
        hash: txHash as `0x${string}`,
      });

      if (!tx) return null;

      // Try to simulate the transaction to get revert reason
      await this.publicClient.call({
        to: tx.to,
        data: tx.input,
        value: tx.value,
        from: tx.from,
      });

      return null;
    } catch (error: any) {
      // Extract revert reason from error
      if (error.message) {
        const match = error.message.match(/reverted with reason string '(.+)'/);
        if (match) return match[1];
      }
      return error.message || null;
    }
  }

  public async estimateGas(tx: {
    to: string;
    value?: bigint;
    data?: string;
    from?: string;
  }): Promise<bigint> {
    return this.withRetry(async () => {
      const gas = await this.publicClient.estimateGas({
        to: tx.to as `0x${string}`,
        value: tx.value,
        data: tx.data as `0x${string}` | undefined,
        account: tx.from as `0x${string}` | undefined,
      });

      return gas;
    }, 'estimateGas');
  }

  // --- NETWORK STATE ---

  public async getCurrentBlock(): Promise<number> {
    return this.withRetry(async () => {
      const blockNumber = await this.publicClient.getBlockNumber();
      return Number(blockNumber);
    }, 'getCurrentBlock');
  }

  public async getGasPrice(): Promise<bigint> {
    return this.withRetry(async () => {
      const gasPrice = await this.publicClient.getGasPrice();
      return gasPrice;
    }, 'getGasPrice');
  }

  public async isNetworkCongested(): Promise<boolean> {
    try {
      const gasPrice = await this.getGasPrice();
      // Base L2 is congested if gas > 0.5 Gwei
      const congestionThreshold = 500000000n; // 0.5 Gwei in Wei
      return gasPrice > congestionThreshold;
    } catch (error) {
      console.warn('Failed to check network congestion:', error);
      return false; // Assume not congested if check fails
    }
  }

  // --- TRANSACTION SIMULATION ---

  public async simulateTransaction(tx: {
    to: string;
    value?: bigint;
    data?: string;
    from: string;
  }): Promise<{ success: boolean; result?: string; error?: string }> {
    try {
      const result = await this.publicClient.call({
        to: tx.to as `0x${string}`,
        value: tx.value,
        data: tx.data as `0x${string}` | undefined,
        account: tx.from as `0x${string}`,
      });

      return {
        success: true,
        result: result.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Simulation failed',
      };
    }
  }

  // --- UTILITY ---

  public formatUSDC(amount: bigint): string {
    return formatUnits(amount, 6); // USDC has 6 decimals
  }

  public formatETH(amount: bigint): string {
    return formatUnits(amount, 18);
  }
}

// Singleton instance
export const blockchainService = new BlockchainService();
