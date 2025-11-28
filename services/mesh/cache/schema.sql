-- UCPT Cache Database Schema
-- Production-grade storage for Universal Causal Provenance Tokens
-- with FTS5 full-text search and reputation tracking

-- Main UCPT cache table
CREATE TABLE IF NOT EXISTS ucpt_cache (
  hash TEXT PRIMARY KEY,
  token_data BLOB NOT NULL,
  issuer_did TEXT NOT NULL,
  subject_did TEXT,
  task_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed', 'disputed')),
  issued_at INTEGER NOT NULL,
  expires_at INTEGER,
  validation_score INTEGER DEFAULT 100 CHECK (validation_score >= 0 AND validation_score <= 100),
  first_seen_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  peer_confirmations INTEGER DEFAULT 0 CHECK (peer_confirmations >= 0),
  parent_hash TEXT,
  last_accessed INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  access_count INTEGER DEFAULT 0,
  FOREIGN KEY (parent_hash) REFERENCES ucpt_cache(hash) ON DELETE SET NULL,
  CHECK (length(hash) = 64),
  CHECK (issued_at > 0),
  CHECK (expires_at IS NULL OR expires_at > issued_at)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_ucpt_issuer ON ucpt_cache(issuer_did);
CREATE INDEX IF NOT EXISTS idx_ucpt_subject ON ucpt_cache(subject_did);
CREATE INDEX IF NOT EXISTS idx_ucpt_task ON ucpt_cache(task_id);
CREATE INDEX IF NOT EXISTS idx_ucpt_status ON ucpt_cache(status);
CREATE INDEX IF NOT EXISTS idx_ucpt_issued_at ON ucpt_cache(issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_ucpt_expires_at ON ucpt_cache(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ucpt_parent ON ucpt_cache(parent_hash) WHERE parent_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ucpt_lru ON ucpt_cache(last_accessed DESC);

-- FTS5 virtual table for full-text search on metadata
CREATE VIRTUAL TABLE IF NOT EXISTS ucpt_fts USING fts5(
  hash UNINDEXED,
  issuer_did,
  subject_did,
  task_id,
  task_type,
  content=ucpt_cache,
  content_rowid=rowid
);

-- Triggers to keep FTS5 in sync
CREATE TRIGGER IF NOT EXISTS ucpt_fts_insert AFTER INSERT ON ucpt_cache BEGIN
  INSERT INTO ucpt_fts(rowid, hash, issuer_did, subject_did, task_id, task_type)
  VALUES (new.rowid, new.hash, new.issuer_did, new.subject_did, new.task_id, new.task_type);
END;

CREATE TRIGGER IF NOT EXISTS ucpt_fts_delete AFTER DELETE ON ucpt_cache BEGIN
  DELETE FROM ucpt_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER IF NOT EXISTS ucpt_fts_update AFTER UPDATE ON ucpt_cache BEGIN
  DELETE FROM ucpt_fts WHERE rowid = old.rowid;
  INSERT INTO ucpt_fts(rowid, hash, issuer_did, subject_did, task_id, task_type)
  VALUES (new.rowid, new.hash, new.issuer_did, new.subject_did, new.task_id, new.task_type);
END;

-- Reputation cache table
CREATE TABLE IF NOT EXISTS reputation_cache (
  did TEXT PRIMARY KEY,
  overall_score INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER DEFAULT 0 CHECK (success_count >= 0),
  failure_count INTEGER DEFAULT 0 CHECK (failure_count >= 0),
  peer_confirmations INTEGER DEFAULT 0 CHECK (peer_confirmations >= 0),
  total_earned REAL DEFAULT 0.0 CHECK (total_earned >= 0),
  avg_task_time REAL DEFAULT 0.0 CHECK (avg_task_time >= 0),
  last_updated INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  CHECK (length(did) > 10)
);

CREATE INDEX IF NOT EXISTS idx_reputation_score ON reputation_cache(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_reputation_updated ON reputation_cache(last_updated DESC);

-- Peer votes table for Byzantine consensus
CREATE TABLE IF NOT EXISTS peer_votes (
  ucpt_hash TEXT NOT NULL,
  voter_did TEXT NOT NULL,
  vote INTEGER NOT NULL CHECK (vote IN (0, 1)),
  weight REAL NOT NULL CHECK (weight > 0),
  timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  PRIMARY KEY (ucpt_hash, voter_did),
  FOREIGN KEY (ucpt_hash) REFERENCES ucpt_cache(hash) ON DELETE CASCADE,
  CHECK (length(ucpt_hash) = 64),
  CHECK (length(voter_did) > 10)
);

CREATE INDEX IF NOT EXISTS idx_votes_hash ON peer_votes(ucpt_hash);
CREATE INDEX IF NOT EXISTS idx_votes_voter ON peer_votes(voter_did);
CREATE INDEX IF NOT EXISTS idx_votes_timestamp ON peer_votes(timestamp DESC);

-- Orphaned tokens waiting for parent
CREATE TABLE IF NOT EXISTS orphaned_tokens (
  hash TEXT PRIMARY KEY,
  parent_hash TEXT NOT NULL,
  token_data BLOB NOT NULL,
  first_seen INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  retry_count INTEGER DEFAULT 0,
  FOREIGN KEY (hash) REFERENCES ucpt_cache(hash) ON DELETE CASCADE,
  CHECK (length(hash) = 64),
  CHECK (length(parent_hash) = 64)
);

CREATE INDEX IF NOT EXISTS idx_orphaned_parent ON orphaned_tokens(parent_hash);
CREATE INDEX IF NOT EXISTS idx_orphaned_seen ON orphaned_tokens(first_seen);

-- Rate limiting state per peer
CREATE TABLE IF NOT EXISTS rate_limit_state (
  peer_did TEXT PRIMARY KEY,
  announcements_count INTEGER DEFAULT 0,
  bandwidth_bytes INTEGER DEFAULT 0,
  invalid_count INTEGER DEFAULT 0,
  last_reset INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  banned_until INTEGER,
  ban_count INTEGER DEFAULT 0,
  CHECK (length(peer_did) > 10),
  CHECK (announcements_count >= 0),
  CHECK (bandwidth_bytes >= 0),
  CHECK (invalid_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_banned ON rate_limit_state(banned_until) WHERE banned_until IS NOT NULL;

-- Gossip metrics tracking
CREATE TABLE IF NOT EXISTS gossip_metrics (
  timestamp INTEGER PRIMARY KEY,
  tokens_propagated INTEGER DEFAULT 0,
  tokens_received INTEGER DEFAULT 0,
  bandwidth_bytes INTEGER DEFAULT 0,
  active_peers INTEGER DEFAULT 0,
  CHECK (tokens_propagated >= 0),
  CHECK (tokens_received >= 0),
  CHECK (bandwidth_bytes >= 0)
);

CREATE INDEX IF NOT EXISTS idx_gossip_timestamp ON gossip_metrics(timestamp DESC);

-- Views for common queries

-- Active (non-expired) tokens
CREATE VIEW IF NOT EXISTS active_tokens AS
SELECT * FROM ucpt_cache
WHERE expires_at IS NULL OR expires_at > strftime('%s', 'now');

-- High reputation agents
CREATE VIEW IF NOT EXISTS high_reputation_agents AS
SELECT * FROM reputation_cache
WHERE overall_score >= 500
ORDER BY overall_score DESC;

-- Recently accessed tokens (for LRU)
CREATE VIEW IF NOT EXISTS lru_tokens AS
SELECT hash, last_accessed, access_count
FROM ucpt_cache
ORDER BY last_accessed ASC;

-- Disputed tokens requiring attention
CREATE VIEW IF NOT EXISTS disputed_tokens AS
SELECT * FROM ucpt_cache
WHERE status = 'disputed'
ORDER BY issued_at DESC;
