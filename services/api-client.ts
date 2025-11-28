/**
 * API Client for browser-side communication with backend
 * Replaces direct service calls with HTTP API calls
 */

const API_BASE = '';

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// Cached state for synchronous access
let cachedWallet = {
  address: '0x0000000000000000000000000000000000000000',
  balanceUSDC: 0,
  balanceCCC: 0,
  isInitialized: false
};

let cachedIdentity = null;
let cachedPeers: any[] = [];

// Update cache function
async function updateCache() {
  try {
    const [wallet, identity, peersData] = await Promise.all([
      fetchAPI('/api/wallet'),
      fetchAPI('/api/identity'),
      fetchAPI('/api/mesh/peers')
    ]);
    cachedWallet = {
      ...wallet,
      balanceCCC: wallet.balanceCCC || 0
    };
    cachedIdentity = identity;
    cachedPeers = peersData.peers || [];
  } catch (error) {
    console.error('[API] Failed to update cache:', error);
  }
}

// Initialize cache on load
updateCache();

// Update cache every 5 seconds
setInterval(updateCache, 5000);

// Identity Service API
export const identityService = {
  getIdentity: async () => {
    try {
      const data = await fetchAPI('/api/identity');
      cachedIdentity = data;
      return data;
    } catch (error) {
      console.error('[API] getIdentity error:', error);
      return cachedIdentity;
    }
  },
  
  getWalletState: () => {
    // Synchronous access to cached data
    return cachedWallet;
  },
  
  lockSession: () => {
    console.log('[API] lockSession called');
    // Clear cached data
    cachedWallet = {
      address: '0x0000000000000000000000000000000000000000',
      balanceUSDC: 0,
      balanceCCC: 0,
      isInitialized: false
    };
    cachedIdentity = null;
  },
  
  initialize: async () => {
    return { success: false, error: 'Client-side initialization not supported' };
  }
};

// Kernel Service API
export const kernel = {
  getStatus: async () => {
    try {
      const data = await fetchAPI('/api/kernel/status');
      return data.status;
    } catch (error) {
      console.error('[API] getStatus error:', error);
      return 'ERROR';
    }
  },
  
  isActive: async () => {
    try {
      const data = await fetchAPI('/api/kernel/status');
      return data.isActive;
    } catch (error) {
      console.error('[API] isActive error:', error);
      return false;
    }
  },
  
  start: async () => {
    try {
      await fetchAPI('/api/kernel/start', { method: 'POST' });
      return true;
    } catch (error) {
      console.error('[API] start error:', error);
      return false;
    }
  },
  
  stop: async () => {
    try {
      await fetchAPI('/api/kernel/stop', { method: 'POST' });
    } catch (error) {
      console.error('[API] stop error:', error);
    }
  }
};

// Economy Service API
let miningDifficulty = 2;
let cachedHashRate = 0;

// Update hash rate periodically
setInterval(async () => {
  try {
    const data = await fetchAPI('/api/economy/hashrate');
    cachedHashRate = data.hashRate || 0;
  } catch (error) {
    // Silent fail
  }
}, 2000);

export const economyService = {
  getBalance: async () => {
    try {
      const data = await fetchAPI('/api/economy/balance');
      return data.balance;
    } catch (error) {
      console.error('[API] getBalance error:', error);
      return 0;
    }
  },
  
  getHashRate: () => {
    // Synchronous access to cached hash rate
    return cachedHashRate;
  },
  
  getMiningDifficulty: () => {
    return miningDifficulty;
  },
  
  setMiningDifficulty: (difficulty: number) => {
    miningDifficulty = difficulty;
    console.log('[API] setMiningDifficulty:', difficulty);
  },
  
  getBlockReward: () => {
    // Exponential reward based on difficulty
    return Math.pow(2, miningDifficulty) * 0.1;
  },
  
  setMiningIntensity: (intensity: 'LOW' | 'HIGH') => {
    console.log('[API] setMiningIntensity:', intensity);
  },
  
  startMining: () => {
    console.warn('[API] startMining not implemented');
  },
  
  stopMining: () => {
    console.warn('[API] stopMining not implemented');
  }
};

// Mesh Service API
export const meshService = {
  getPeers: () => {
    // Synchronous access to cached data
    return cachedPeers;
  },
  
  connect: async () => false,
  disconnect: () => {},
  broadcast: async () => false
};

// Memory Service API
let cachedTasks: any[] = [];

// Update tasks periodically
setInterval(async () => {
  try {
    const data = await fetchAPI('/api/ledger/tasks');
    cachedTasks = data.tasks || [];
  } catch (error) {
    // Silent fail
  }
}, 5000);

export const memoryService = {
  getMemoryUsage: () => ({ used: 0, total: 0 }),
  clearCache: () => {},
  getHistory: () => cachedTasks
};

// Cortex Service API
let currentModel = 'minimax/minimax-m2:free';

export const cortexService = {
  query: async () => ({ success: false, error: 'Not available in browser' }),
  isAvailable: () => false,
  getCurrentModel: () => currentModel,
  setModel: (modelId: string) => {
    currentModel = modelId;
    console.log('[API] setModel:', modelId);
  },
  fetchAvailableModels: async () => {
    // Return mock models for now
    return [
      { id: 'minimax/minimax-m2:free', name: 'MiniMax M2 (Free)' },
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'claude-3-opus', name: 'Claude 3 Opus' }
    ];
  }
};

// Scheduler Service API
let cachedSchedulerStatus = {
  lastRun: Date.now(),
  nextRun: Date.now() + 300000,
  intervalMs: 300000,
  missionTarget: 'aid://anoteroslogos.com/geo-audit',
  isActive: false
};

// Update scheduler status periodically
setInterval(async () => {
  try {
    const data = await fetchAPI('/api/scheduler/status');
    cachedSchedulerStatus = data;
  } catch (error) {
    // Silent fail
  }
}, 5000);

export const schedulerService = {
  getStatus: () => cachedSchedulerStatus,
  getNextRun: () => cachedSchedulerStatus.nextRun,
  schedule: () => {},
  cancel: () => {}
};

// Oracle Service API
export const oracleService = {
  getNetworkMetrics: async () => {
    try {
      return await fetchAPI('/api/oracle/network');
    } catch (error) {
      console.error('[API] getNetworkMetrics error:', error);
      return {
        blockNumber: 0,
        gasPriceGwei: '0.00',
        timestamp: Date.now()
      };
    }
  },
  
  getPrice: async () => 0
};
