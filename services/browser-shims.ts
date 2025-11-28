/**
 * Browser-safe shims for Node.js services
 * These provide mock implementations that work in browser environment
 */

// Mock identity service for browser
export const identityService = {
  getIdentity: () => null,
  initialize: async () => ({ success: false, error: 'Browser mode - identity not available' }),
  getWalletState: () => ({
    address: '0x0000000000000000000000000000000000000000',
    balance: 0,
    isInitialized: false
  })
};

// Mock mesh service for browser
export const meshService = {
  getPeers: () => [],
  connect: async () => false,
  disconnect: () => {},
  broadcast: async () => false
};

// Mock memory service for browser
export const memoryService = {
  getMemoryUsage: () => ({ used: 0, total: 0 }),
  clearCache: () => {}
};

// Mock kernel for browser
export const kernel = {
  getStatus: () => 'IDLE',
  start: async () => false,
  stop: () => {},
  isActive: () => false
};

// Mock economy service for browser
export const economyService = {
  getBalance: () => 0,
  getHashRate: () => 0,
  startMining: () => {},
  stopMining: () => {}
};

// Mock cortex service for browser
export const cortexService = {
  query: async () => ({ success: false, error: 'Browser mode - AI not available' }),
  isAvailable: () => false
};

// Mock scheduler service for browser
export const schedulerService = {
  getNextRun: () => Date.now() + 300000,
  schedule: () => {},
  cancel: () => {}
};

// Mock oracle service for browser
export const oracleService = {
  getNetworkMetrics: async () => ({
    blockNumber: 0,
    gasPriceGwei: '0.00',
    timestamp: Date.now()
  }),
  getPrice: async () => 0
};
