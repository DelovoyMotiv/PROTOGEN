# Design Document: Autonomous Earning Engine

## Overview

The Autonomous Earning Engine extends PROTOGEN-01 with economic self-sufficiency through trustless task execution in the Anóteros Lógos mesh network. The system implements a production-grade economic state machine with real blockchain transactions, cryptographic proof generation, and LLM-powered decision making.

## Architecture

### System Context

```
┌─────────────────────────────────────────────────────────────────┐
│                         PROTOGEN-01 Kernel                      │
│                    Finite State Machine (FSM)                   │
│                                                                 │
│  States: BOOTING → IDLE → SCANNING → HANDSHAKE →              │
│          NEGOTIATING → WORKING → SETTLING → IDLE               │
│                                                                 │
│  New States: IDLE → SURVIVAL → EARNING →                      │
│              (IDLE | CRITICAL_FAILURE)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Earning Engine Core                         │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  State Management                                         │ │
│  │  - Balance monitoring (USDC via viem)                    │ │
│  │  - Threshold detection (survival: $1, safe: $5)         │ │
│  │  - Transition orchestration                              │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Earning Loop (5-minute interval)                        │ │
│  │  1. Query mesh for tasks                                 │ │
│  │  2. Evaluate profitability                               │ │
│  │  3. Assess risk                                          │ │
│  │  4. Calculate bid                                        │ │
│  │  5. Execute task                                         │ │
│  │  6. Generate UCPT                                        │ │
│  │  7. Claim payment                                        │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Metrics & Observability                                 │ │
│  │  - Total earned (USDC)                                   │ │
│  │  - Success rate (%)                                      │ │
│  │  - Average profit margin                                 │ │
│  │  - Execution time (EMA)                                  │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Task       │ │     Bid      │ │     Risk     │ │    Task      │
│ Marketplace  │ │   Strategy   │ │  Assessment  │ │   Executor   │
│              │ │              │ │              │ │              │
│ - DHT query  │ │ - Cost calc  │ │ - Reputation │ │ - Execution  │
│ - Filtering  │ │ - Gas est    │ │ - Payload    │ │ - UCPT gen   │
│ - Evaluation │ │ - Competition│ │ - Escrow     │ │ - Payment    │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Integration Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Mesh Service │  │  Blockchain  │  │    Escrow    │         │
│  │  (Kademlia)  │  │  (viem/Base) │  │  (Contract)  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### Component Interfaces

#### 1. Earning Engine

```typescript
interface EarningEngine {
  // State Management
  shouldEnterEarningMode(): Promise<boolean>;
  canExitEarningMode(): boolean;
  hasCriticalFailure(): boolean;
  
  // Lifecycle
  enterEarningMode(): Promise<void>;
  exitEarningMode(): void;
  
  // Observability
  getState(): Readonly<EarningState>;
  getMetrics(): EarningMetrics;
}

interface EarningState {
  isActive: boolean;
  currentBalance: number;
  survivalThreshold: number;
  safeThreshold: number;
  consecutiveFailures: number;
  lastEarningAttempt: number;
  blacklistedRequesters: Set<string>;
}

interface EarningMetrics {
  totalEarned: number;
  tasksCompleted: number;
  tasksRejected: number;
  averageProfit: number;
  successRate: number;
  averageExecutionTime: number;
}
```

#### 2. Task Marketplace

```typescript
interface TaskMarketplace {
  // Discovery
  queryAvailableTasks(): Promise<MarketplaceTask[]>;
  queryCompetingBids(taskId: string): Promise<Bid[]>;
  
  // Evaluation
  evaluateTask(task: MarketplaceTask): Promise<TaskEvaluation>;
  
  // Acceptance
  acceptTask(taskId: string, bidPrice: number): Promise<boolean>;
}

interface MarketplaceTask {
  task_id: string;
  type: 'geo.audit' | 'data.verification' | string;
  payment: {
    amount: string; // USDC amount as string
    token: 'USDC';
    chain_id: 8453; // Base L2
    escrow: `0x${string}`; // Escrow contract address
  };
  requirements: {
    min_ccc_balance: number;
    min_reputation: number;
  };
  deadline: number; // Unix timestamp
  description: string;
  requester_did: string; // DID of task requester
}

interface TaskEvaluation {
  meetsRequirements: boolean;
  isProfitable: boolean;
  estimatedCost: number;
  estimatedProfit: number;
  estimatedDuration: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface Bid {
  bidder_did: string;
  amount: number;
  timestamp: number;
}
```

#### 3. Bid Strategy

```typescript
interface BidStrategy {
  // Pricing
  calculateBid(task: MarketplaceTask, competition: Bid[]): Promise<number>;
  isTaskProfitable(task: MarketplaceTask, bidPrice: number): Promise<boolean>;
  
  // Cost Components
  calculateBaseCost(task: MarketplaceTask): Promise<number>;
  estimateGasCost(): Promise<number>;
  calculateRiskPremium(task: MarketplaceTask): number;
}
```

#### 4. Risk Assessment

```typescript
interface RiskAssessment {
  // Evaluation
  evaluateTaskRisk(task: MarketplaceTask): Promise<RiskScore>;
  isTaskSafe(task: MarketplaceTask): Promise<boolean>;
  
  // Validation
  validateRequester(task: MarketplaceTask): Promise<number>;
  inspectPayload(task: MarketplaceTask): Promise<number>;
  verifyPayment(task: MarketplaceTask): Promise<number>;
}

interface RiskScore {
  overall: number; // 0-100 (lower is better)
  factors: {
    requester_trust: number;
    payload_safety: number;
    payment_security: number;
  };
}
```

#### 5. Task Executor

```typescript
interface TaskExecutor {
  // Execution
  execute(task: MarketplaceTask): Promise<ExecutionResult>;
  
  // Proof Generation
  generateProof(result: ExecutionResult): Promise<UCPT>;
  
  // Payment
  claimPayment(proof: UCPT, escrow: `0x${string}`): Promise<boolean>;
}

interface ExecutionResult {
  success: boolean;
  taskId: string;
  output: any;
  executionTime: number;
  resourceUsage: {
    cpu: number;
    memory: number;
  };
  error?: string;
}
```

#### 6. Earning Advisor (LLM)

```typescript
interface EarningAdvisor {
  // Decision Making
  selectBestTask(
    tasks: MarketplaceTask[],
    currentBalance: number
  ): Promise<TaskDecision>;
  
  // Risk Analysis
  analyzeRiskReward(
    task: MarketplaceTask,
    riskScore: RiskScore
  ): Promise<RiskRewardAnalysis>;
}

interface TaskDecision {
  taskId: string;
  reasoning: string;
  confidence: number;
}

interface RiskRewardAnalysis {
  recommendation: 'ACCEPT' | 'REJECT' | 'NEGOTIATE';
  reasoning: string;
  expectedValue: number;
}
```

## Data Models

### Task Storage

```typescript
interface StoredTask extends MarketplaceTask {
  acceptedAt: number;
  executionStarted?: number;
  executionCompleted?: number;
  ucptProof?: UCPT;
  paymentClaimed?: boolean;
  paymentTxHash?: `0x${string}`;
}
```

### Reputation Cache

```typescript
interface ReputationEntry {
  did: string;
  score: number; // 0-100
  successfulTasks: number;
  failedTasks: number;
  lastInteraction: number;
  blacklisted: boolean;
  blacklistedUntil?: number;
}
```

### Escrow Contract ABI

```typescript
const ESCROW_ABI = [
  {
    name: 'lockFunds',
    type: 'function',
    inputs: [
      { name: 'taskId', type: 'bytes32' },
      { name: 'worker', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'payable'
  },
  {
    name: 'releasePayment',
    type: 'function',
    inputs: [
      { name: 'taskId', type: 'bytes32' },
      { name: 'proof', type: 'bytes' }
    ],
    outputs: [{ name: 'success', type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    name: 'getLockedAmount',
    type: 'function',
    inputs: [{ name: 'taskId', type: 'bytes32' }],
    outputs: [{ name: 'amount', type: 'uint256' }],
    stateMutability: 'view'
  }
] as const;
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system - essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Balance Threshold Monotonicity
*For any* earning cycle, if the agent enters EARNING state with balance B < SURVIVAL_THRESHOLD, then the agent SHALL NOT exit EARNING state until balance B' >= SAFE_THRESHOLD.

**Validates: Requirements 1.1, 1.3**

### Property 2: Task Profitability Guarantee
*For any* accepted task T with payment P and estimated cost C, the calculated profit margin (P - C) / P SHALL be >= MIN_PROFIT_MARGIN.

**Validates: Requirements 2.6**

### Property 3: Risk Score Consistency
*For any* task T, if risk assessment produces score R > RISK_THRESHOLD, then isTaskSafe(T) SHALL return false.

**Validates: Requirements 4.2, 4.4, 4.6**

### Property 4: Bid Price Bounds
*For any* task T with payment amount P, the calculated bid price B SHALL satisfy: BASE_COST + GAS_ESTIMATE <= B <= P.

**Validates: Requirements 3.1, 3.2, 3.7**

### Property 5: UCPT Generation Atomicity
*For any* successfully executed task T, a UCPT proof SHALL be generated if and only if execution result indicates success = true.

**Validates: Requirements 5.4, 5.5**

### Property 6: Escrow Verification Pre-condition
*For any* task acceptance, the escrow contract SHALL have locked funds >= payment amount before task execution begins.

**Validates: Requirements 6.1**

### Property 7: Blacklist Temporal Consistency
*For any* requester DID D blacklisted at time T, all tasks from D SHALL be rejected for duration [T, T + 24 hours].

**Validates: Requirements 8.3, 8.4, 8.5**

### Property 8: Failure Counter Reset
*For any* successful task completion, the consecutive failure counter SHALL be reset to 0.

**Validates: Requirements 8.1, 8.6**

### Property 9: Metrics Monotonicity
*For any* successful task with payment P, the totalEarned metric SHALL increase by exactly P.

**Validates: Requirements 9.1**

### Property 10: State Transition Safety
*For any* state transition from EARNING to CRITICAL_FAILURE, the consecutive failure count SHALL equal MAX_CONSECUTIVE_FAILURES.

**Validates: Requirements 1.4**

## Error Handling

### Failure Modes

1. **Network Failures**
   - Mesh DHT query timeout → Retry with exponential backoff (1s, 2s, 4s)
   - Blockchain RPC failure → Switch to fallback provider
   - WebSocket disconnect → Reconnect with backoff

2. **Economic Failures**
   - Insufficient gas → Abort transaction, log warning
   - Escrow funds missing → Reject task, blacklist requester
   - Payment claim revert → Log revert reason, retry once

3. **Security Failures**
   - Malicious payload detected → Reject task, blacklist requester permanently
   - Invalid UCPT signature → Abort payment claim, log error
   - Reputation score too low → Reject task silently

4. **Execution Failures**
   - Task timeout → Kill execution, mark as failed
   - Resource limit exceeded → Kill execution, blacklist requester
   - LLM API failure → Fall back to deterministic heuristics

### Recovery Strategies

1. **Transient Failures** (network, RPC)
   - Exponential backoff retry
   - Provider failover
   - Graceful degradation

2. **Economic Failures** (gas, escrow)
   - Abort current cycle
   - Wait for next cycle
   - Log for operator review

3. **Security Failures** (malicious actors)
   - Immediate blacklist
   - No retry
   - Permanent reputation penalty

4. **Critical Failures** (3 consecutive)
   - Transition to CRITICAL_FAILURE state
   - Stop earning loop
   - Require operator intervention

## Testing Strategy

### Unit Testing

1. **Earning Engine**
   - State transition logic
   - Balance threshold detection
   - Metrics calculation
   - Blacklist management

2. **Task Marketplace**
   - Task filtering by requirements
   - Profitability calculation
   - Cost estimation accuracy

3. **Bid Strategy**
   - Bid price calculation
   - Competitive undercutting
   - Profit margin enforcement

4. **Risk Assessment**
   - Reputation scoring
   - Payload pattern detection
   - Escrow verification

### Property-Based Testing

Each correctness property will be implemented as a property-based test using fast-check (TypeScript PBT library). Tests will run 100+ iterations with randomly generated inputs.

### Integration Testing

1. **End-to-End Earning Cycle**
   - Mock requester agent posts task
   - PROTOGEN discovers and evaluates
   - Bid calculation and acceptance
   - Task execution and UCPT generation
   - Payment claim from mock escrow

2. **Failure Scenarios**
   - Malicious task payload
   - Insufficient escrow funds
   - Network partition during execution
   - Consecutive failures triggering CRITICAL_FAILURE

3. **Economic Scenarios**
   - Balance recovery from $0.50 to $5.00
   - Multiple competing agents
   - Gas price spike handling
   - LLM decision quality

## Security Considerations

### Threat Model

1. **Malicious Requesters**
   - Payload injection attacks
   - Resource exhaustion attacks
   - Payment fraud (fake escrow)

2. **Economic Attacks**
   - Bid manipulation
   - Gas price manipulation
   - Escrow contract exploits

3. **Network Attacks**
   - Sybil attacks on DHT
   - Eclipse attacks on mesh
   - Man-in-the-middle on WebSocket

### Mitigations

1. **Input Validation**
   - Strict payload sanitization
   - Regex pattern matching for dangerous keywords
   - Type validation for all task fields

2. **Resource Limits**
   - CPU time limits (30 minutes max)
   - Memory limits (500MB max)
   - Sandbox execution environment

3. **Cryptographic Verification**
   - Ed25519 signature verification on all A2A messages
   - UCPT proof validation before payment claim
   - Escrow contract address validation

4. **Economic Safety**
   - Minimum profit margin enforcement (30%)
   - Gas price ceiling (2 Gwei max)
   - Balance reservation for gas

## Performance Requirements

### Latency

- Task discovery: < 5 seconds
- Risk assessment: < 1 second
- Bid calculation: < 500ms
- UCPT generation: < 2 seconds
- Payment claim: < 30 seconds (blockchain confirmation)

### Throughput

- Earning cycles: 1 per 5 minutes
- Concurrent task evaluation: Up to 10 tasks
- Mesh queries: Up to 50 peers per cycle

### Resource Usage

- Memory: < 100MB for earning engine
- CPU: < 10% average, < 50% peak
- Network: < 1MB per earning cycle
- Storage: < 10KB per task record

## Deployment Configuration

### Environment Variables

```bash
# Economic Thresholds
SURVIVAL_THRESHOLD=1.00          # Enter earning at $1 USDC
SAFE_THRESHOLD=5.00              # Exit earning at $5 USDC
MIN_PROFIT_MARGIN=0.30           # 30% minimum profit
MAX_TASK_DURATION=1800           # 30 minutes max

# Escrow Contract
ESCROW_CONTRACT_ADDRESS=0x...    # Base L2 escrow address

# Risk Parameters
MIN_REPUTATION_SCORE=30          # Minimum requester trust
RISK_THRESHOLD=70                # Maximum acceptable risk
BLACKLIST_DURATION=86400000      # 24 hours in ms

# LLM Configuration
EARNING_ADVISOR_MODEL=gpt-4      # LLM model for decisions
EARNING_ADVISOR_TEMPERATURE=0.3  # Low temperature for consistency

# Performance
EARNING_CYCLE_INTERVAL=300000    # 5 minutes in ms
MAX_CONCURRENT_EVALUATIONS=10    # Parallel task evaluation
```

## Monitoring and Observability

### Metrics

1. **Economic Metrics**
   - `earning_total_earned_usdc`: Total USDC earned
   - `earning_tasks_completed`: Count of successful tasks
   - `earning_success_rate`: Percentage of successful tasks
   - `earning_average_profit`: Average profit per task

2. **Performance Metrics**
   - `earning_cycle_duration_ms`: Time per earning cycle
   - `earning_task_execution_time_ms`: Task execution time
   - `earning_payment_claim_time_ms`: Payment claim latency

3. **Security Metrics**
   - `earning_tasks_rejected_risk`: Tasks rejected for risk
   - `earning_requesters_blacklisted`: Count of blacklisted DIDs
   - `earning_malicious_payloads_detected`: Security incidents

### Logging

All earning engine operations will log structured JSON with:
- Timestamp
- Component (EarningEngine, TaskMarketplace, etc.)
- Level (INFO, WARN, ERROR)
- Message
- Context (taskId, requesterDid, amount, etc.)

### Alerting

Critical conditions requiring operator attention:
- CRITICAL_FAILURE state reached
- Balance below $0.50 for > 1 hour
- Success rate < 50% over 10 tasks
- Malicious payload detected
- Escrow contract interaction failure

## Future Enhancements

1. **Advanced Bidding**
   - Machine learning for bid optimization
   - Historical data analysis
   - Market trend prediction

2. **Reputation System**
   - Distributed reputation consensus
   - Stake-weighted trust scores
   - Reputation token economics

3. **Task Specialization**
   - Capability-based task routing
   - Performance-based pricing
   - Quality-of-service guarantees

4. **Multi-Chain Support**
   - Ethereum mainnet
   - Arbitrum, Optimism
   - Cross-chain escrow bridges
