export enum AgentStatus {
  BOOTING = "BOOTING",
  IDLE = "IDLE",
  SCANNING = "SCANNING",     // Active DHT Lookup
  HANDSHAKE = "HANDSHAKE",   // A2A Connection
  NEGOTIATING = "NEGOTIATING", // Economic logic
  WORKING = "WORKING",       // Task execution
  SETTLING = "SETTLING",     // Blockchain tx
  EARNING = "EARNING",       // Autonomous earning mode
  CRITICAL_FAILURE = "CRITICAL_FAILURE", // Earning failures exceeded threshold
  ERROR = "ERROR",
  SLEEPING = "SLEEPING"
}

export type PageView = 'DASHBOARD' | 'NETWORK' | 'LEDGER' | 'SETTINGS';

export interface IdentityState {
  privateKey: string;     // EVM Private Key (Hex)
  address: string;        // EVM Address
  did: string;            // DID Identifier (did:key:z...)
  ed25519PublicKey: string; 
}

export interface WalletState {
  address: string;
  balanceUSDC: number;
  balanceCCC: number;     // Causal Contribution Credits (Protocol Token)
  network: 'Base L2' | 'Localhost';
  chainId: number;
  nonce: number;
}

// --- OPENROUTER / CORTEX TYPES ---

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  architecture?: {
    tokenizer: string;
    instruct_type?: string;
    modality: string;
  };
}

export interface CortexConfig {
  apiKey: string;
  model: string;
}

// --- ANÓTEROS LÓGOS PROTOCOL TYPES ---

export enum A2AMessageType {
  HELLO = "A2A_HELLO",
  CHALLENGE = "A2A_CHALLENGE",
  RESPONSE = "A2A_RESPONSE",
  JOB_OFFER = "JOB_OFFER",
  JOB_BID = "JOB_BID",
  JOB_ACCEPT = "JOB_ACCEPT",
  JOB_COMPLETE = "JOB_COMPLETE"
}

export interface A2AHeader {
  version: "1.0";
  id: string;         // UUID of message
  timestamp: number;
  sender_did: string;
  recipient_did: string | "BROADCAST";
  type: A2AMessageType;
  nonce: number;
}

export interface A2AMessage<T = any> {
  header: A2AHeader;
  payload: T;
  signature: string; // Ed25519 signature of Canonical(Header + Payload)
}

// Universal Computational Proof Token (Verifiable Credential Structure)
export interface UCPT {
  id: string; // ucpt:uuid
  context: string[]; // ["https://anoteroslogos.com/ucpt/v1"]
  issuer: string; // DID of Agent
  issuanceDate: string;
  credentialSubject: {
    taskType: string;
    targetHash: string; // Keccak256 of target data
    executionTimeMs: number;
    resourceCost: string; // Gas/Compute metric
  };
  proof: {
    type: "Ed25519Signature2020";
    created: string;
    verificationMethod: string;
    proofPurpose: "assertionMethod";
    jws: string;
  };
}

// --- REAL AUDIT DATA STRUCTURES ---

export interface DNSRecord {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

export interface SecurityPosture {
  hasDNSSEC: boolean;
  hasSPF: boolean;
  hasDMARC: boolean;
  hasCAA: boolean;
  riskScore: number; // 0-100 (Lower is better)
}

export interface AuditReport {
  target: string;
  timestamp: string;
  records: {
    A: DNSRecord[];
    AAAA: DNSRecord[];
    MX: DNSRecord[];
    TXT: DNSRecord[];
  };
  posture: SecurityPosture;
  rawResponseHash: string;
}

export interface Task {
  id: string;
  type: 'GEO_AUDIT' | 'DATA_VERIFICATION';
  target: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'REJECTED';
  cost: number;
  timestamp: number;
  txHash?: string;
  ucpt?: UCPT; // Full UCPT Object
  auditReport?: AuditReport; // The real work artifact
  logs: string[];
}

export interface LedgerBlock {
  index: number;
  timestamp: number;
  prevHash: string;
  hash: string;       // SHA-256(index + timestamp + prevHash + JSON(data))
  data: Task;
  signature: string;  // Ed25519(hash) by Agent DID
  // Production fields
  version: number;
  merkleRoot: string;
  stateRoot: string;
  gasUsed: bigint;
  confirmations: number;
}

// --- CCC BLOCKCHAIN TYPES ---

/**
 * CCC Transaction - Represents a transfer of Causal Contribution Credits
 * between agents in the distributed network.
 */
export interface CCCTransaction {
  from: string;        // DID of sender (did:key:z...)
  to: string;          // DID of recipient
  amount: number;      // CCC amount (integer, smallest unit)
  fee: number;         // Transaction fee in CCC
  nonce: number;       // Sender's transaction counter (prevents replay)
  timestamp: number;   // Unix timestamp in milliseconds
  data?: string;       // Optional metadata (e.g., job reference)
  signature: string;   // Ed25519 signature of canonical transaction
}

/**
 * CCC Block - A block in the distributed CCC blockchain.
 * Uses SHA-256 Proof-of-Work with adjustable difficulty.
 */
export interface CCCBlock {
  // Block Header
  version: number;           // Protocol version (currently 1)
  index: number;             // Block height (genesis = 0)
  timestamp: number;         // Unix timestamp in milliseconds
  previousHash: string;      // SHA-256 hash of previous block (hex)
  merkleRoot: string;        // Merkle root of transactions (hex)
  difficulty: number;        // Current mining difficulty (leading zeros)
  nonce: string;             // Proof-of-work nonce (hex, 32 bytes)
  
  // Block Body
  miner: string;             // DID of miner who found this block
  transactions: CCCTransaction[];
  
  // Block Validation
  hash: string;              // SHA-256 hash of block header (hex)
  signature: string;         // Ed25519 signature by miner (hex)
  
  // Consensus Metadata
  cumulativeDifficulty: bigint; // Sum of all difficulties up to this block
  stateRoot?: string;        // Optional: Merkle root of account states
}

/**
 * CCC Chain State - Represents the current state of the blockchain
 */
export interface CCCChainState {
  height: number;            // Current chain height
  tip: string;               // Hash of the latest block
  difficulty: number;        // Current mining difficulty
  cumulativeDifficulty: bigint;
  totalSupply: number;       // Total CCC in circulation
  lastAdjustment: number;    // Block height of last difficulty adjustment
}

/**
 * CCC Account State - Balance and nonce for a DID
 */
export interface CCCAccountState {
  did: string;
  balance: number;           // CCC balance
  nonce: number;             // Transaction counter
  lastUpdated: number;       // Block height of last update
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'SYSTEM';
  module: 'KERNEL' | 'NET' | 'CORTEX' | 'MEMORY' | 'PROTO' | 'SYSTEM' | 'ECONOMY' | 'SCHEDULER' | 'EXECUTOR';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface MeshPeer {
  nodeId: string;       
  address: string;      
  distance: bigint;     
  lastSeen: number;
  agentVersion: string;
  bucketIndex: number;  
  latency: number;      
  reputation: number;
  did?: string;         // Associated DID
}

export interface LookupStep {
  step: number;
  queriedNode: string;
  distanceToTarget: bigint;
  status: 'FOUND_CLOSER' | 'DEAD_END' | 'TARGET_FOUND';
}

export interface CortexDecision {
  action: 'PROCEED' | 'ABORT' | 'NEGOTIATE';
  reasoning: string;
  confidence: number;
  maxBid: number;
}

// Agent Identity Discovery
export interface AgentCard {
  context: string[];
  id: string; // DID
  profile: {
    name: string;
    description: string;
    avatar?: string;
  };
  capabilities: string[];
  payment: {
    networks: string[];
    assets: string[];
    address: string;
  };
  communication: {
    transports: string[];
    endpoints: string[];
  };
  proofs: {
    integrity: string;
  };
}

export interface SchedulerState {
  lastRun: number;
  nextRun: number;
  intervalMs: number;
  missionTarget: string;
  isActive: boolean;
}

// UI Props
export interface DashboardProps {
  status: AgentStatus;
  logs: LogEntry[];
  wallet: WalletState;
  identity: IdentityState | null;
  toggleKernel: () => void; // Manual override
  isKernelActive: boolean;
  miningIntensity: 'LOW' | 'HIGH';
  setMiningIntensity: (intensity: 'LOW' | 'HIGH') => void;
  scheduler: SchedulerState;
}

export interface NetworkProps {
  peers: MeshPeer[];
  selfId: string;
  onPing: (nodeId: string) => Promise<void>;
  onEvict: (nodeId: string) => void;
  onLookup: (targetId: string) => Promise<LookupStep[]>;
}

export interface LedgerProps {
  tasks: Task[];
}

export interface SettingsProps {
  identity: IdentityState | null;
  onReset: () => void;
}