/**
 * PROTOGEN-01 API Server
 * Production backend with real service implementations
 */

import express, { Request, Response } from 'express';
import { identityService } from '../services/identity.js';
import { meshService } from '../services/mesh.js';
import { kernel } from '../services/kernel.js';
import { economyService } from '../services/economy.js';
import { blockchainService } from '../services/blockchain.js';
import { consensusService } from '../services/consensus.js';
import { memoryService } from '../services/memory.js';
import { schedulerService } from '../services/scheduler.js';
import { getUCPTCascade } from '../services/mesh/gossip/ucptCascade.js';
import { getSpamFilter } from '../services/mesh/security/spamFilter.js';
import { getReputationEngine } from '../services/mesh/reputation/reputationEngine.js';
import { earningEngine } from '../services/survival/earningEngineInstance.js';
import { getUCPTConsensus } from '../services/mesh/consensus/ucptConsensus.js';

const router = express.Router();

// Health check
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    version: '1.2.6',
    uptime: process.uptime()
  });
});

// Identity endpoints
router.get('/api/identity', async (_req: Request, res: Response) => {
  try {
    const identity = identityService.getIdentity();
    if (!identity) {
      return res.status(503).json({ error: 'Identity not initialized' });
    }
    
    res.json({
      did: identity.did,
      ed25519PublicKey: identity.ed25519PublicKey,
      address: identity.address,
      privateKey: identity.privateKey
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/wallet', (_req: Request, res: Response) => {
  try {
    const identity = identityService.getIdentity();
    
    if (!identity) {
      return res.status(503).json({ error: 'Identity not initialized' });
    }

    // Get wallet state and CCC balance
    const walletState = identityService.getWalletState();
    const cccBalance = economyService.getCCCBalance();

    // Return wallet data
    res.status(200).json({
      address: identity.address,
      balanceUSDC: walletState.balanceUSDC,
      balanceCCC: cccBalance,
      network: 'Base L2',
      chainId: 8453,
      nonce: walletState.nonce,
      isInitialized: true
    });
  } catch (error: any) {
    console.error('[API] /api/wallet error:', error.message);
    console.error('[API] /api/wallet stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Kernel endpoints
router.get('/api/kernel/status', (_req: Request, res: Response) => {
  try {
    const isActive = kernel.isActive();
    // Kernel doesn't expose status directly, infer from isActive
    const status = isActive ? 'IDLE' : 'SLEEPING';
    res.status(200).json({ status, isActive });
  } catch (error: any) {
    console.error('[API] /api/kernel/status error:', error);
    console.error('[API] /api/kernel/status stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/kernel/start', async (_req: Request, res: Response) => {
  try {
    // Kernel requires callbacks for boot, which we don't have in API context
    // Return current state instead
    const isActive = kernel.isActive();
    res.json({ 
      success: false, 
      isActive,
      message: 'Kernel start requires manual initialization with callbacks'
    });
  } catch (error: any) {
    console.error('[API] /api/kernel/start error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/kernel/stop', (_req: Request, res: Response) => {
  try {
    if (kernel.isActive()) {
      kernel.shutdown();
    }
    res.json({ success: true, isActive: kernel.isActive() });
  } catch (error: any) {
    console.error('[API] /api/kernel/stop error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Economy endpoints
router.get('/api/economy/balance', (_req: Request, res: Response) => {
  try {
    const balance = economyService.getCCCBalance();
    const hashRate = economyService.getHashRate();
    res.json({ balance, hashRate });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/economy/hashrate', (_req: Request, res: Response) => {
  try {
    const hashRate = economyService.getHashRate();
    res.json({ hashRate });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mesh endpoints
router.get('/api/mesh/peers', (_req: Request, res: Response) => {
  try {
    const peers = meshService.getPeers();
    res.json({ peers, count: peers.length });
  } catch (error: any) {
    console.error('[API] /api/mesh/peers error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Consensus endpoints
router.get('/api/consensus/chain', (_req: Request, res: Response) => {
  try {
    const chain = consensusService.getChain();
    const latestBlock = chain[chain.length - 1];
    res.json({
      height: chain.length,
      latestBlock: latestBlock ? {
        index: latestBlock.index,
        hash: latestBlock.hash,
        timestamp: latestBlock.timestamp
      } : null
    });
  } catch (error: any) {
    console.error('[API] /api/consensus/chain error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Blockchain oracle endpoints
router.get('/api/oracle/network', async (_req: Request, res: Response) => {
  try {
    const blockNumber = await blockchainService.getCurrentBlock();
    const gasPrice = await blockchainService.getGasPrice();
    
    res.json({
      blockNumber,
      gasPriceGwei: (Number(gasPrice) / 1e9).toFixed(2),
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error('[API] /api/oracle/network error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ledger/Memory endpoints
router.get('/api/ledger/tasks', (_req: Request, res: Response) => {
  try {
    const tasks = memoryService.getHistory();
    res.status(200).json({ tasks });
  } catch (error: any) {
    console.error('[API] /api/ledger/tasks error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Scheduler endpoints
router.get('/api/scheduler/status', (_req: Request, res: Response) => {
  try {
    const status = schedulerService.getStatus();
    res.status(200).json(status);
  } catch (error: any) {
    console.error('[API] /api/scheduler/status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// System logs endpoint
router.get('/api/logs', (_req: Request, res: Response) => {
  // This would integrate with actual logging system
  res.json({ logs: [] });
});

// ========== NEW ENDPOINTS FOR UI ENHANCEMENT ==========

// UCPT Cascade endpoints
router.get('/api/cascade/metrics', (_req: Request, res: Response) => {
  try {
    const cascade = getUCPTCascade();
    const metrics = cascade.getMetrics();
    res.status(200).json(metrics);
  } catch (error: any) {
    console.error('[API] /api/cascade/metrics error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/cascade/config', (_req: Request, res: Response) => {
  try {
    const config = {
      fanout: parseInt(process.env.UCPT_CASCADE_FANOUT || '3'),
      ttl: parseInt(process.env.UCPT_CASCADE_TTL || '3600'),
      cacheMaxSize: parseInt(process.env.UCPT_CACHE_MAX_SIZE || '10000'),
      bloomFilterSize: parseInt(process.env.BLOOM_FILTER_SIZE || '100000'),
      bloomFilterHashes: parseInt(process.env.BLOOM_FILTER_HASHES || '7')
    };
    res.status(200).json(config);
  } catch (error: any) {
    console.error('[API] /api/cascade/config error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Spam Filter / Security endpoints
router.get('/api/security/stats', async (_req: Request, res: Response) => {
  try {
    const spamFilter = getSpamFilter();
    const stats = await spamFilter.getStatistics();
    res.status(200).json(stats);
  } catch (error: any) {
    console.error('[API] /api/security/stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/security/peer/:did/limits', async (req: Request, res: Response) => {
  try {
    const { did } = req.params;
    if (!did) {
      return res.status(400).json({ error: 'DID parameter required' });
    }

    const spamFilter = getSpamFilter();
    const rateLimitState = await spamFilter.getRateLimitState(did);
    const quota = await spamFilter.getQuota(did);
    const isBanned = await spamFilter.isBanned(did);

    res.status(200).json({
      ...rateLimitState,
      quota,
      isBanned
    });
  } catch (error: any) {
    console.error('[API] /api/security/peer/:did/limits error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reputation Engine endpoints
router.get('/api/reputation/rankings', async (_req: Request, res: Response) => {
  try {
    const reputationEngine = getReputationEngine();
    const rankings = await reputationEngine.getTopAgents(10);
    res.status(200).json({ rankings });
  } catch (error: any) {
    console.error('[API] /api/reputation/rankings error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/reputation/peer/:did/score', async (req: Request, res: Response) => {
  try {
    const { did } = req.params;
    if (!did) {
      return res.status(400).json({ error: 'DID parameter required' });
    }

    const reputationEngine = getReputationEngine();
    const score = await reputationEngine.calculateScore(did);
    res.status(200).json(score);
  } catch (error: any) {
    console.error('[API] /api/reputation/peer/:did/score error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Earning Engine endpoints
router.get('/api/earning/status', (_req: Request, res: Response) => {
  try {
    const state = earningEngine.getState();
    // Convert Set to Array for JSON serialization
    const serializedState = {
      ...state,
      blacklistedRequesters: Array.from(state.blacklistedRequesters)
    };
    res.status(200).json(serializedState);
  } catch (error: any) {
    console.error('[API] /api/earning/status error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/earning/metrics', (_req: Request, res: Response) => {
  try {
    const metrics = earningEngine.getMetrics();
    res.status(200).json(metrics);
  } catch (error: any) {
    console.error('[API] /api/earning/metrics error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/earning/blacklist', (_req: Request, res: Response) => {
  try {
    const state = earningEngine.getState();
    const blacklist = Array.from(state.blacklistedRequesters);
    res.status(200).json({ blacklist, count: blacklist.length });
  } catch (error: any) {
    console.error('[API] /api/earning/blacklist error:', error);
    res.status(500).json({ error: error.message });
  }
});

// UCPT Consensus endpoints
router.get('/api/consensus/metrics', (_req: Request, res: Response) => {
  try {
    const consensus = getUCPTConsensus();
    const metrics = consensus.getMetrics();
    res.status(200).json(metrics);
  } catch (error: any) {
    console.error('[API] /api/consensus/metrics error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/consensus/config', (_req: Request, res: Response) => {
  try {
    const config = {
      difficulty: parseInt(process.env.UCPT_MINING_DIFFICULTY || '2'),
      maxIterations: parseInt(process.env.UCPT_MAX_ITERATIONS || '1000000')
    };
    res.status(200).json(config);
  } catch (error: any) {
    console.error('[API] /api/consensus/config error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export endpoint - aggregates all metrics
router.get('/api/export/metrics', async (_req: Request, res: Response) => {
  try {
    // Gather all metrics
    const identity = identityService.getIdentity();
    const walletState = identityService.getWalletState();
    const cccBalance = economyService.getCCCBalance();
    const hashRate = economyService.getHashRate();
    const peers = meshService.getPeers();
    const tasks = memoryService.getHistory();
    const schedulerStatus = schedulerService.getStatus();
    const kernelActive = kernel.isActive();
    
    // Cascade metrics
    const cascade = getUCPTCascade();
    const cascadeMetrics = cascade.getMetrics();
    const cascadeConfig = {
      fanout: parseInt(process.env.UCPT_CASCADE_FANOUT || '3'),
      ttl: parseInt(process.env.UCPT_CASCADE_TTL || '3600'),
      cacheMaxSize: parseInt(process.env.UCPT_CACHE_MAX_SIZE || '10000')
    };
    
    // Security metrics
    const spamFilter = getSpamFilter();
    const securityStats = await spamFilter.getStatistics();
    
    // Reputation metrics
    const reputationEngine = getReputationEngine();
    const rankings = await reputationEngine.getTopAgents(10);
    
    // Earning metrics
    const earningState = earningEngine.getState();
    const earningMetrics = earningEngine.getMetrics();
    
    // Consensus metrics
    const consensus = getUCPTConsensus();
    const consensusMetrics = consensus.getMetrics();
    const consensusConfig = {
      difficulty: parseInt(process.env.UCPT_MINING_DIFFICULTY || '2'),
      maxIterations: parseInt(process.env.UCPT_MAX_ITERATIONS || '1000000')
    };
    
    // Blockchain metrics
    const blockNumber = await blockchainService.getCurrentBlock();
    const gasPrice = await blockchainService.getGasPrice();
    
    const exportData = {
      timestamp: Date.now(),
      version: '1.2.9',
      identity: identity ? {
        did: identity.did,
        address: identity.address
      } : null,
      wallet: {
        address: walletState.address,
        balanceUSDC: walletState.balanceUSDC,
        balanceCCC: cccBalance,
        network: 'Base L2',
        chainId: 8453
      },
      kernel: {
        isActive: kernelActive,
        status: kernelActive ? 'IDLE' : 'SLEEPING'
      },
      economy: {
        cccBalance,
        hashRate
      },
      mesh: {
        peerCount: peers.length,
        peers: peers.map(p => ({
          did: p.did,
          address: p.address,
          lastSeen: p.lastSeen
        }))
      },
      cascade: {
        metrics: cascadeMetrics,
        config: cascadeConfig
      },
      security: securityStats,
      reputation: {
        rankings
      },
      earning: {
        state: {
          ...earningState,
          blacklistedRequesters: Array.from(earningState.blacklistedRequesters)
        },
        metrics: earningMetrics
      },
      consensus: {
        metrics: consensusMetrics,
        config: consensusConfig
      },
      blockchain: {
        blockNumber,
        gasPriceGwei: (Number(gasPrice) / 1e9).toFixed(2)
      },
      scheduler: schedulerStatus,
      ledger: {
        taskCount: tasks.length,
        tasks: tasks.slice(-100) // Last 100 tasks
      }
    };
    
    res.status(200).json(exportData);
  } catch (error: any) {
    console.error('[API] /api/export/metrics error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
