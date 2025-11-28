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

// Identity Service API
export const identityService = {
  getIdentity: async () => {
    try {
      return await fetchAPI('/api/identity');
    } catch (error) {
      console.error('[API] getIdentity error:', error);
      return null;
    }
  },
  
  getWalletState: async () => {
    try {
      return await fetchAPI('/api/wallet');
    } catch (error) {
      console.error('[API] getWalletState error:', error);
      return {
        address: '0x0000000000000000000000000000000000000000',
        balanceUSDC: 0,
        isInitialized: false
      };
    }
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
  
  getHashRate: async () => {
    try {
      const data = await fetchAPI('/api/economy/hashrate');
      return data.hashRate;
    } catch (error) {
      return 0;
    }
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
  getPeers: async () => {
    try {
      const data = await fetchAPI('/api/mesh/peers');
      return data.peers;
    } catch (error) {
      console.error('[API] getPeers error:', error);
      return [];
    }
  },
  
  connect: async () => false,
  disconnect: () => {},
  broadcast: async () => false
};

// Memory Service API
export const memoryService = {
  getMemoryUsage: () => ({ used: 0, total: 0 }),
  clearCache: () => {}
};

// Cortex Service API
export const cortexService = {
  query: async () => ({ success: false, error: 'Not available in browser' }),
  isAvailable: () => false
};

// Scheduler Service API
export const schedulerService = {
  getNextRun: () => Date.now() + 300000,
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
