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
router.get('/api/identity', async (req: Request, res: Response) => {
  try {
    const identity = identityService.getIdentity();
    if (!identity) {
      return res.status(503).json({ error: 'Identity not initialized' });
    }
    
    res.json({
      did: identity.did,
      publicKey: identity.publicKey,
      address: identity.address
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/wallet', async (req: Request, res: Response) => {
  try {
    const identity = identityService.getIdentity();
    if (!identity) {
      return res.status(503).json({ error: 'Identity not initialized' });
    }

    const balance = await blockchainService.getUSDCBalance(identity.address);
    const balanceNum = typeof balance === 'bigint' ? Number(balance) / 1e6 : balance;

    res.json({
      address: identity.address,
      balanceUSDC: balanceNum,
      isInitialized: true
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Kernel endpoints
router.get('/api/kernel/status', (req: Request, res: Response) => {
  try {
    const status = kernel.getStatus();
    res.json({ status, isActive: kernel.isActive() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/kernel/start', async (req: Request, res: Response) => {
  try {
    await kernel.start();
    res.json({ success: true, status: kernel.getStatus() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/kernel/stop', (req: Request, res: Response) => {
  try {
    kernel.stop();
    res.json({ success: true, status: kernel.getStatus() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Economy endpoints
router.get('/api/economy/balance', (req: Request, res: Response) => {
  try {
    const balance = economyService.getBalance();
    const hashRate = economyService.getHashRate();
    res.json({ balance, hashRate });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/economy/hashrate', (req: Request, res: Response) => {
  try {
    const hashRate = economyService.getHashRate();
    res.json({ hashRate });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mesh endpoints
router.get('/api/mesh/peers', (req: Request, res: Response) => {
  try {
    const peers = meshService.getPeers();
    res.json({ peers, count: peers.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Consensus endpoints
router.get('/api/consensus/chain', (req: Request, res: Response) => {
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
    res.status(500).json({ error: error.message });
  }
});

// Blockchain oracle endpoints
router.get('/api/oracle/network', async (req: Request, res: Response) => {
  try {
    const blockNumber = await blockchainService.getCurrentBlock();
    const gasPrice = await blockchainService.getGasPrice();
    
    res.json({
      blockNumber,
      gasPriceGwei: (Number(gasPrice) / 1e9).toFixed(2),
      timestamp: Date.now()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// System logs endpoint
router.get('/api/logs', (req: Request, res: Response) => {
  // This would integrate with actual logging system
  res.json({ logs: [] });
});

export default router;
