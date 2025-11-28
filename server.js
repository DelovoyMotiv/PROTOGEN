/**
 * PROTOGEN-01 Production Server
 * Serves frontend with API endpoints
 * Note: Backend services require TypeScript compilation - using mock data for now
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, 'dist')));

// Mock state for demonstration
const mockState = {
  identity: {
    did: 'did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH',
    address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    publicKey: 'ed25519:...'
  },
  wallet: {
    balanceUSDC: 0.00,
    isInitialized: true
  },
  kernel: {
    status: 'IDLE',
    isActive: false
  },
  economy: {
    balance: 0,
    hashRate: 0
  },
  peers: [],
  chain: {
    height: 1,
    latestBlock: {
      index: 0,
      hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      timestamp: Date.now()
    }
  }
};

// API Routes
app.get('/api/identity', (req, res) => {
  res.json(mockState.identity);
});

app.get('/api/wallet', (req, res) => {
  res.json({
    address: mockState.identity.address,
    ...mockState.wallet
  });
});

app.get('/api/kernel/status', (req, res) => {
  res.json(mockState.kernel);
});

app.post('/api/kernel/start', (req, res) => {
  mockState.kernel.isActive = true;
  mockState.kernel.status = 'WORKING';
  res.json({ success: true, status: mockState.kernel.status });
});

app.post('/api/kernel/stop', (req, res) => {
  mockState.kernel.isActive = false;
  mockState.kernel.status = 'IDLE';
  res.json({ success: true, status: mockState.kernel.status });
});

app.get('/api/economy/balance', (req, res) => {
  res.json(mockState.economy);
});

app.get('/api/economy/hashrate', (req, res) => {
  res.json({ hashRate: mockState.economy.hashRate });
});

app.get('/api/mesh/peers', (req, res) => {
  res.json({ peers: mockState.peers, count: mockState.peers.length });
});

app.get('/api/consensus/chain', (req, res) => {
  res.json(mockState.chain);
});

app.get('/api/oracle/network', (req, res) => {
  res.json({
    blockNumber: 12345678,
    gasPriceGwei: '0.05',
    timestamp: Date.now()
  });
});

// Agent card endpoint
app.get('/.well-known/agent-card.json', (req, res) => {
  try {
    const agentCard = JSON.parse(
      readFileSync(join(__dirname, 'public/.well-known/agent-card.json'), 'utf-8')
    );
    res.json(agentCard);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load agent card' });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] PROTOGEN-01 running on http://0.0.0.0:${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Server] Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`[Server] Note: Using mock data - backend services require TypeScript compilation`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully');
  process.exit(0);
});
