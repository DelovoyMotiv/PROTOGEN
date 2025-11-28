/**
 * Browser-safe stubs for Node.js services
 * These provide mock implementations that work in browser environment
 */

console.warn('[Browser Mode] Using stub implementations for Node.js services');

// Mock identity service for browser
export const identityService = {
  getIdentity: () => {
    console.warn('[identityService] Browser stub - returning null');
    return null;
  },
  initialize: async () => {
    console.warn('[identityService] Browser stub - initialize called');
    return { success: false, error: 'Browser mode - identity not available' };
  },
  getWalletState: () => {
    console.warn('[identityService] Browser stub - getWalletState called');
    return {
      address: '0x0000000000000000000000000000000000000000',
      balance: 0,
      isInitialized: false
    };
  }
};

// Mock mesh service for browser
export const meshService = {
  getPeers: () => {
    console.warn('[meshService] Browser stub - getPeers called');
    return [];
  },
  connect: async () => {
    console.warn('[meshService] Browser stub - connect called');
    return false;
  },
  disconnect: () => {
    console.warn('[meshService] Browser stub - disconnect called');
  },
  broadcast: async () => {
    console.warn('[meshService] Browser stub - broadcast called');
    return false;
  }
};

// Mock memory service for browser
export const memoryService = {
  getMemoryUsage: () => {
    console.warn('[memoryService] Browser stub - getMemoryUsage called');
    return { used: 0, total: 0 };
  },
  clearCache: () => {
    console.warn('[memoryService] Browser stub - clearCache called');
  },
  getHistory: () => {
    console.warn('[memoryService] Browser stub - getHistory called');
    return [];
  }
};

// Mock kernel for browser
export const kernel = {
  getStatus: () => {
    console.warn('[kernel] Browser stub - getStatus called');
    return 'IDLE';
  },
  start: async () => {
    console.warn('[kernel] Browser stub - start called');
    return false;
  },
  stop: () => {
    console.warn('[kernel] Browser stub - stop called');
  },
  isActive: () => {
    console.warn('[kernel] Browser stub - isActive called');
    return false;
  }
};

// Mock economy service for browser
export const economyService = {
  getBalance: () => {
    console.warn('[economyService] Browser stub - getBalance called');
    return 0;
  },
  getHashRate: () => {
    return 0;
  },
  startMining: () => {
    console.warn('[economyService] Browser stub - startMining called');
  },
  stopMining: () => {
    console.warn('[economyService] Browser stub - stopMining called');
  }
};

// Mock cortex service for browser
export const cortexService = {
  query: async () => {
    console.warn('[cortexService] Browser stub - query called');
    return { success: false, error: 'Browser mode - AI not available' };
  },
  isAvailable: () => {
    return false;
  }
};

// Mock scheduler service for browser
export const schedulerService = {
  getNextRun: () => {
    return Date.now() + 300000;
  },
  getStatus: () => {
    return {
      isActive: false,
      nextRun: Date.now() + 300000,
      lastRun: Date.now() - 300000
    };
  },
  schedule: () => {
    console.warn('[schedulerService] Browser stub - schedule called');
  },
  cancel: () => {
    console.warn('[schedulerService] Browser stub - cancel called');
  }
};

// Mock oracle service for browser
export const oracleService = {
  getNetworkMetrics: async () => {
    return {
      blockNumber: 0,
      gasPriceGwei: '0.00',
      timestamp: Date.now()
    };
  },
  getPrice: async () => {
    console.warn('[oracleService] Browser stub - getPrice called');
    return 0;
  }
};
