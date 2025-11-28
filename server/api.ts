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

export default router;
