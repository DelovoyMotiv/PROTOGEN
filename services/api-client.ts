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

// ========== NEW API SERVICES FOR UI ENHANCEMENT ==========

// Cascade Service API
let cachedCascadeMetrics = {
  tokens_propagated: 0,
  tokens_received: 0,
  bandwidth_bytes: 0,
  coverage_percentage: 0
};

let cachedCascadeConfig = {
  fanout: 3,
  ttl: 3600,
  cacheMaxSize: 10000,
  bloomFilterSize: 100000,
  bloomFilterHashes: 7
};

// Update cascade metrics periodically
setInterval(async () => {
  try {
    const metrics = await fetchAPI('/api/cascade/metrics');
    cachedCascadeMetrics = metrics;
  } catch (error) {
    // Silent fail
  }
}, 5000);

// Fetch config once on load
fetchAPI('/api/cascade/config').then(config => {
  cachedCascadeConfig = config;
}).catch(() => {});

export const cascadeService = {
  getMetrics: () => cachedCascadeMetrics,
  getConfig: () => cachedCascadeConfig,
  getCascadeMetrics: async () => {
    try {
      return await fetchAPI('/api/cascade/metrics');
    } catch (error) {
      console.error('[API] getCascadeMetrics error:', error);
      return cachedCascadeMetrics;
    }
  },
  getCascadeConfig: async () => {
    try {
      return await fetchAPI('/api/cascade/config');
    } catch (error) {
      console.error('[API] getCascadeConfig error:', error);
      return cachedCascadeConfig;
    }
  }
};

// Security Service API
let cachedSecurityStats = {
  total_peers: 0,
  banned_peers: 0,
  high_reputation_peers: 0,
  low_reputation_peers: 0
};

// Update security stats periodically
setInterval(async () => {
  try {
    const stats = await fetchAPI('/api/security/stats');
    cachedSecurityStats = stats;
  } catch (error) {
    // Silent fail
  }
}, 5000);

export const securityService = {
  getStats: () => cachedSecurityStats,
  getSecurityStats: async () => {
    try {
      return await fetchAPI('/api/security/stats');
    } catch (error) {
      console.error('[API] getSecurityStats error:', error);
      return cachedSecurityStats;
    }
  },
  getPeerLimits: async (did: string) => {
    try {
      return await fetchAPI(`/api/security/peer/${encodeURIComponent(did)}/limits`);
    } catch (error) {
      console.error('[API] getPeerLimits error:', error);
      return {
        announcements: 0,
        bandwidth_bytes: 0,
        last_reset: Math.floor(Date.now() / 1000),
        invalid_count: 0,
        quota: 10,
        isBanned: false
      };
    }
  }
};

// Reputation Service API
let cachedRankings: any[] = [];

// Update rankings periodically
setInterval(async () => {
  try {
    const data = await fetchAPI('/api/reputation/rankings');
    cachedRankings = data.rankings || [];
  } catch (error) {
    // Silent fail
  }
}, 5000);

export const reputationService = {
  getRankings: () => cachedRankings,
  getReputationRankings: async () => {
    try {
      const data = await fetchAPI('/api/reputation/rankings');
      return data.rankings || [];
    } catch (error) {
      console.error('[API] getReputationRankings error:', error);
      return cachedRankings;
    }
  },
  getPeerReputation: async (did: string) => {
    try {
      return await fetchAPI(`/api/reputation/peer/${encodeURIComponent(did)}/score`);
    } catch (error) {
      console.error('[API] getPeerReputation error:', error);
      return {
        overall: 0,
        success_rate: 0,
        avg_task_time: 0,
        total_earned: 0,
        peer_trust: 0
      };
    }
  }
};

// Earning Service API
let cachedEarningStatus = {
  isActive: false,
  currentBalance: 0,
  survivalThreshold: 1.0,
  safeThreshold: 5.0,
  consecutiveFailures: 0,
  lastEarningAttempt: 0,
  metrics: {
    totalEarned: 0,
    tasksCompleted: 0,
    tasksRejected: 0,
    averageProfit: 0,
    successRate: 100,
    averageExecutionTime: 0
  },
  blacklistedRequesters: []
};

// Update earning status periodically
setInterval(async () => {
  try {
    const status = await fetchAPI('/api/earning/status');
    cachedEarningStatus = status;
  } catch (error) {
    // Silent fail
  }
}, 5000);

export const earningService = {
  getStatus: () => cachedEarningStatus,
  getEarningStatus: async () => {
    try {
      return await fetchAPI('/api/earning/status');
    } catch (error) {
      console.error('[API] getEarningStatus error:', error);
      return cachedEarningStatus;
    }
  },
  getEarningMetrics: async () => {
    try {
      return await fetchAPI('/api/earning/metrics');
    } catch (error) {
      console.error('[API] getEarningMetrics error:', error);
      return cachedEarningStatus.metrics;
    }
  },
  getBlacklist: async () => {
    try {
      const data = await fetchAPI('/api/earning/blacklist');
      return data.blacklist || [];
    } catch (error) {
      console.error('[API] getBlacklist error:', error);
      return [];
    }
  }
};

// Consensus Service API (UCPT)
let cachedConsensusMetrics = {
  difficulty: 2,
  tokensValidated: 0,
  tokensRejected: 0,
  avgValidationTime: 0,
  conflictsResolved: 0
};

// Update consensus metrics periodically
setInterval(async () => {
  try {
    const metrics = await fetchAPI('/api/consensus/metrics');
    cachedConsensusMetrics = metrics;
  } catch (error) {
    // Silent fail
  }
}, 5000);

export const consensusServiceAPI = {
  getMetrics: () => cachedConsensusMetrics,
  getConsensusMetrics: async () => {
    try {
      return await fetchAPI('/api/consensus/metrics');
    } catch (error) {
      console.error('[API] getConsensusMetrics error:', error);
      return cachedConsensusMetrics;
    }
  },
  getConsensusConfig: async () => {
    try {
      return await fetchAPI('/api/consensus/config');
    } catch (error) {
      console.error('[API] getConsensusConfig error:', error);
      return {
        difficulty: 2,
        maxIterations: 1000000
      };
    }
  }
};

// Export Service API
export const exportService = {
  exportMetrics: async () => {
    try {
      const data = await fetchAPI('/api/export/metrics');
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
      const filename = `metrics-${timestamp[0]}-${timestamp[1].split('-')[0]}.json`;
      
      // Create blob and trigger download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return { success: true, filename };
    } catch (error: any) {
      console.error('[API] exportMetrics error:', error);
      return { success: false, error: error.message };
    }
  }
};
