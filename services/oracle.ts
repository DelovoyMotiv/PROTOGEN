// PROTOGEN-01 NETWORK ORACLE
// Provides real-time blockchain telemetry from Base Mainnet.
// Used for: Gas Estimation, Liveness Checks, and Economic Timing.

const BASE_RPC_URL = "https://mainnet.base.org";
const CACHE_TTL_MS = 5000; // 5 seconds cache

export interface NetworkMetrics {
  blockNumber: number;
  gasPriceWei: bigint;
  gasPriceGwei: string;
  isCongested: boolean;
  lastUpdated: number;
}

export class NetworkOracle {
  private cache: NetworkMetrics | null = null;
  private isRequesting = false;

  public async getNetworkMetrics(): Promise<NetworkMetrics> {
    const now = Date.now();
    
    // Return cache if fresh
    if (this.cache && (now - this.cache.lastUpdated < CACHE_TTL_MS)) {
      return this.cache;
    }

    // Prevent stampede
    if (this.isRequesting && this.cache) return this.cache;
    this.isRequesting = true;

    try {
      const payload = [
        { jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 },
        { jsonrpc: "2.0", method: "eth_gasPrice", params: [], id: 2 }
      ];

      const response = await fetch(BASE_RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`RPC Error: ${response.status}`);

      const data = await response.json();
      
      // Parse Hex responses
      const blockHex = data.find((r: any) => r.id === 1)?.result;
      const gasHex = data.find((r: any) => r.id === 2)?.result;

      if (!blockHex || !gasHex) throw new Error("Invalid RPC Response structure");

      const blockNumber = parseInt(blockHex, 16);
      const gasPriceWei = BigInt(gasHex);
      
      // Heuristic for congestion on L2 (Base usually < 0.1 gwei, spike > 0.5)
      // 0.5 Gwei = 500000000 Wei
      const congestionThreshold = 500000000n;
      const isCongested = gasPriceWei > congestionThreshold;

      // Convert to Gwei for display (1 Gwei = 1e9 Wei)
      // BigInt division drops decimals, so we format manually or use simple float div for display
      const gasPriceGwei = (Number(gasPriceWei) / 1e9).toFixed(6);

      this.cache = {
        blockNumber,
        gasPriceWei,
        gasPriceGwei,
        isCongested,
        lastUpdated: now
      };

      return this.cache;

    } catch (e) {
      console.warn("Oracle: Connection Failed, using fallback data.", e);
      // Fallback to static if offline/rate-limited to keep UI alive
      return this.cache || {
        blockNumber: 0,
        gasPriceWei: 10000000n, // 0.01 gwei
        gasPriceGwei: "0.010000",
        isCongested: false,
        lastUpdated: now
      };
    } finally {
      this.isRequesting = false;
    }
  }
}

export const oracleService = new NetworkOracle();