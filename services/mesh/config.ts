/**
 * UCPT Cascade Configuration
 * 
 * Loads configuration from environment variables with sensible defaults
 */

import { UCPTCascadeConfig } from './types';

export function loadConfig(): UCPTCascadeConfig {
  return {
    // Gossip protocol settings
    gossip_fanout: parseInt(process.env.UCPT_GOSSIP_FANOUT || '3'),
    sync_interval: parseInt(process.env.UCPT_SYNC_INTERVAL || '30000'),
    
    // Cache settings
    cache_max_size: parseInt(process.env.UCPT_CACHE_MAX_SIZE || '100') * 1024 * 1024, // Convert MB to bytes
    
    // Reputation settings
    reputation_decay: parseFloat(process.env.UCPT_REPUTATION_DECAY || '0.95'),
    
    // Consensus settings
    consensus_quorum: parseInt(process.env.UCPT_CONSENSUS_QUORUM || '5'),
    
    // Rate limiting settings
    max_announcements_per_minute: parseInt(process.env.UCPT_MAX_ANNOUNCEMENTS || '10'),
    max_bandwidth_per_second: parseInt(process.env.UCPT_MAX_BANDWIDTH || '102400'), // 100 KB/s
    
    // Security settings
    pow_difficulty: parseInt(process.env.UCPT_POW_DIFFICULTY || '3'),
    ban_duration: parseInt(process.env.UCPT_BAN_DURATION || '86400000'), // 24 hours
    max_invalid_tokens: parseInt(process.env.UCPT_MAX_INVALID || '5'),
  };
}

export const config = loadConfig();

// Validation
if (config.gossip_fanout < 2 || config.gossip_fanout > 10) {
  throw new Error('UCPT_GOSSIP_FANOUT must be between 2 and 10');
}

if (config.sync_interval < 10000) {
  throw new Error('UCPT_SYNC_INTERVAL must be at least 10000ms');
}

if (config.cache_max_size < 10 * 1024 * 1024) {
  throw new Error('UCPT_CACHE_MAX_SIZE must be at least 10MB');
}

if (config.reputation_decay < 0 || config.reputation_decay > 1) {
  throw new Error('UCPT_REPUTATION_DECAY must be between 0 and 1');
}

if (config.consensus_quorum < 3 || config.consensus_quorum > 7) {
  throw new Error('UCPT_CONSENSUS_QUORUM must be between 3 and 7');
}

console.log('[UCPT Cascade] Configuration loaded:', {
  gossip_fanout: config.gossip_fanout,
  sync_interval_sec: config.sync_interval / 1000,
  cache_max_mb: config.cache_max_size / (1024 * 1024),
  reputation_decay: config.reputation_decay,
  consensus_quorum: config.consensus_quorum,
});
