/**
 * PROTOGEN-01 Production Server
 * TypeScript server with full backend integration
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { identityService } from './services/identity';
import { kernel } from './services/kernel';
import apiRouter from './server/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());
app.use(express.static(join(__dirname, 'dist')));

// Use API router (handles all /api/* routes)
app.use(apiRouter);

// Agent card endpoint
app.get('/.well-known/agent-card.json', (_req, res) => {
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
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Initialize and start
async function start() {
  console.log('[Server] Initializing PROTOGEN-01...');
  
  try {
    // Initialize identity service
    await identityService.initialize();
    const identity = identityService.getIdentity();
    if (identity) {
      console.log('[Server] Identity initialized:', identity.did.substring(0, 30) + '...');
    } else {
      console.log('[Server] Identity not found - will be created on first use');
    }
    
    // Note: Kernel boot requires callbacks, so we don't auto-start it
    // It will be started via API or manually
    console.log('[Server] Kernel ready (not auto-started)');
  } catch (error: any) {
    console.error('[Server] Initialization error:', error.message);
    console.error('[Server] Stack:', error.stack);
  }
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] PROTOGEN-01 running on http://0.0.0.0:${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'production'}`);
  });
}

start();

process.on('SIGTERM', () => {
  console.log('[Server] Shutting down...');
  if (kernel.isActive()) {
    kernel.shutdown();
  }
  process.exit(0);
});
