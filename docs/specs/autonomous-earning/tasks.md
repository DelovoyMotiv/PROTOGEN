# Implementation Plan: Autonomous Earning Engine

This plan transforms the design into incremental, testable implementation steps. Each task builds on previous work with validation checkpoints.

## Phase 1: Foundation & State Machine Extension

- [ ] 1. Extend Kernel FSM with EARNING state
- [ ] 1.1 Add EARNING state to AgentStatus enum in types.ts
  - Add EARNING state constant
  - Update state transition logic
  - _Requirements: 1.1_

- [ ] 1.2 Implement shouldEnterEarningMode() in kernel.ts
  - Query USDC balance via blockchainService
  - Compare against SURVIVAL_THRESHOLD
  - Return boolean decision
  - _Requirements: 1.1_

- [ ] 1.3 Implement canExitEarningMode() logic
  - Check current balance against SAFE_THRESHOLD
  - Return boolean decision
  - _Requirements: 1.3_

- [ ] 1.4 Add CRITICAL_FAILURE state and transition logic
  - Track consecutive failures
  - Transition at MAX_CONSECUTIVE_FAILURES (3)
  - _Requirements: 1.4_

- [ ] 1.5 Update environment configuration
  - Add SURVIVAL_THRESHOLD to .env.example
  - Add SAFE_THRESHOLD to .env.example
  - Add MIN_PROFIT_MARGIN to .env.example
  - Add MAX_TASK_DURATION to .env.example
  - Add ESCROW_CONTRACT_ADDRESS to .env.example
  - _Requirements: 10.1-10.5_

## Phase 2: Earning Engine Core

- [ ] 2. Create Earning Engine orchestrator
- [ ] 2.1 Create services/survival/earningEngine.ts
  - Define EarningState interface
  - Define EarningMetrics interface
  - Implement EarningEngine class constructor
  - _Requirements: 1.1-1.5_

- [ ] 2.2 Implement enterEarningMode()
  - Set isActive flag
  - Reset consecutive failures
  - Broadcast WORKER_AVAILABLE to mesh
  - Start earning loop timer
  - _Requirements: 1.5_

- [ ] 2.3 Implement exitEarningMode()
  - Clear isActive flag
  - Stop earning loop timer
  - Log final metrics
  - _Requirements: 1.3_

- [ ] 2.4 Implement earning cycle loop
  - Query available tasks
  - Evaluate each task
  - Select best task (LLM if multiple)
  - Execute selected task
  - Update metrics
  - _Requirements: 1.2_

- [ ]* 2.5 Write property test for balance threshold monotonicity
  - **Property 1: Balance Threshold Monotonicity**
  - **Validates: Requirements 1.1, 1.3**

## Phase 3: Task Marketplace

- [ ] 3. Implement Task Marketplace client
- [ ] 3.1 Create services/survival/taskMarketplace.ts
  - Define MarketplaceTask interface
  - Define TaskEvaluation interface
  - Implement TaskMarketplace class
  - _Requirements: 2.1-2.7_

- [ ] 3.2 Implement queryAvailableTasks()
  - Query mesh DHT for task-offering nodes
  - Send A2A task query messages
  - Parse task specifications
  - Return array of tasks
  - _Requirements: 2.1, 2.2_

- [ ] 3.3 Implement evaluateTask()
  - Check CCC balance requirement
  - Check reputation requirement
  - Calculate estimated cost (compute + gas)
  - Calculate profit margin
  - Check duration limit
  - Return TaskEvaluation
  - _Requirements: 2.3-2.7_

- [ ] 3.4 Implement acceptTask()
  - Send JOB_ACCEPT A2A message
  - Verify escrow funds locked
  - Return acceptance status
  - _Requirements: 2.1_

- [ ]* 3.5 Write property test for task profitability guarantee
  - **Property 2: Task Profitability Guarantee**
  - **Validates: Requirements 2.6**

## Phase 4: Bid Strategy Engine

- [ ] 4. Implement dynamic bid pricing
- [ ] 4.1 Create services/survival/bidStrategy.ts
  - Define Bid interface
  - Implement BidStrategy class
  - _Requirements: 3.1-3.7_

- [ ] 4.2 Implement calculateBaseCost()
  - Estimate execution time by task type
  - Multiply by $0.001/second rate
  - Return base cost
  - _Requirements: 3.1_

- [ ] 4.3 Implement estimateGasCost()
  - Query current Base L2 gas price
  - Estimate gas limit for escrow release
  - Apply 20% safety margin
  - Convert to USDC
  - _Requirements: 3.2_

- [ ] 4.4 Implement calculateRiskPremium()
  - Query requester reputation
  - If trust < 50, add 20% premium
  - Return premium amount
  - _Requirements: 3.3, 3.4_

- [ ] 4.5 Implement calculateBid()
  - Sum: base + gas + risk + profit margin
  - Handle competitive bidding (undercut by 5%)
  - Enforce minimum floor price
  - Cap at payment amount
  - _Requirements: 3.5, 3.6, 3.7_

- [ ]* 4.6 Write property test for bid price bounds
  - **Property 4: Bid Price Bounds**
  - **Validates: Requirements 3.1, 3.2, 3.7**

## Phase 5: Risk Assessment Module

- [ ] 5. Implement security risk evaluation
- [ ] 5.1 Create services/survival/riskAssessment.ts
  - Define RiskScore interface
  - Implement RiskAssessment class
  - _Requirements: 4.1-4.7_

- [ ] 5.2 Implement validateRequester()
  - Query mesh for requester reputation
  - Check trust score threshold (30)
  - Verify escrow control
  - Return risk score (0-100)
  - _Requirements: 4.2_

- [ ] 5.3 Implement inspectPayload()
  - Scan description for dangerous keywords
  - Check task type against whitelist
  - Return safety score (0-100)
  - _Requirements: 4.3, 4.4_

- [ ] 5.4 Implement verifyPayment()
  - Query escrow contract for locked funds
  - Verify amount matches payment
  - Verify UCPT proof requirement
  - Return security score (0-100)
  - _Requirements: 4.5, 4.6, 4.7_

- [ ] 5.5 Implement evaluateTaskRisk()
  - Call all validation methods
  - Calculate weighted overall score
  - Return RiskScore with factors
  - _Requirements: 4.1-4.7_

- [ ]* 5.6 Write property test for risk score consistency
  - **Property 3: Risk Score Consistency**
  - **Validates: Requirements 4.2, 4.4, 4.6**

## Phase 6: Task Executor

- [ ] 6. Implement task execution pipeline
- [ ] 6.1 Create services/survival/executor.ts
  - Define ExecutionResult interface
  - Implement TaskExecutor class
  - _Requirements: 5.1-5.7_

- [ ] 6.2 Implement execute()
  - Lock agent state
  - Record start time and resources
  - Delegate to service layer by task type
  - Monitor execution
  - Return ExecutionResult
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 6.3 Implement generateProof()
  - Create UCPT structure
  - Sign with Ed25519
  - Validate signature
  - Return UCPT token
  - _Requirements: 5.4_

- [ ] 6.4 Handle execution failures
  - Detect malicious payloads
  - Blacklist requester if malicious
  - Do not generate UCPT on failure
  - Log failure reason
  - _Requirements: 5.5, 5.6_

- [ ]* 6.5 Write property test for UCPT generation atomicity
  - **Property 5: UCPT Generation Atomicity**
  - **Validates: Requirements 5.4, 5.5**

## Phase 7: Escrow Contract Integration

- [ ] 7. Implement on-chain escrow interaction
- [ ] 7.1 Create services/blockchain/escrow.ts
  - Define escrow contract ABI
  - Implement EscrowService class
  - _Requirements: 6.1-6.6_

- [ ] 7.2 Implement verifyLockedFunds()
  - Call getLockedAmount view function
  - Compare with task payment
  - Return verification result
  - _Requirements: 6.1_

- [ ] 7.3 Implement claimPayment()
  - Encode UCPT proof as bytes
  - Simulate releasePayment transaction
  - Broadcast if simulation succeeds
  - Wait for confirmation
  - Update balance
  - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ]* 7.4 Write property test for escrow verification pre-condition
  - **Property 6: Escrow Verification Pre-condition**
  - **Validates: Requirements 6.1**

## Phase 8: LLM Decision Making

- [ ] 8. Implement AI-powered task selection
- [ ] 8.1 Create services/ai/earningAdvisor.ts
  - Define TaskDecision interface
  - Define RiskRewardAnalysis interface
  - Implement EarningAdvisor class
  - _Requirements: 7.1-7.5_

- [ ] 8.2 Implement selectBestTask()
  - Format task options for LLM
  - Include balance and risk scores
  - Send prompt to OpenRouter
  - Parse JSON response
  - Return TaskDecision
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 8.3 Implement analyzeRiskReward()
  - Format risk/reward analysis prompt
  - Include unknown requester context
  - Send to LLM
  - Parse recommendation
  - _Requirements: 7.4, 7.5_

## Phase 9: Failure Handling & Blacklisting

- [ ] 9. Implement failure recovery
- [ ] 9.1 Add blacklist management to EarningEngine
  - Implement blacklistRequester()
  - Add temporal blacklist removal (24h)
  - Filter tasks by blacklist
  - _Requirements: 8.3, 8.4, 8.5_

- [ ] 9.2 Implement failure counter logic
  - Increment on task failure
  - Reset on task success
  - Trigger CRITICAL_FAILURE at threshold
  - _Requirements: 8.1, 8.2, 8.6_

- [ ]* 9.3 Write property test for blacklist temporal consistency
  - **Property 7: Blacklist Temporal Consistency**
  - **Validates: Requirements 8.3, 8.4, 8.5**

- [ ]* 9.4 Write property test for failure counter reset
  - **Property 8: Failure Counter Reset**
  - **Validates: Requirements 8.1, 8.6**

## Phase 10: Metrics & Observability

- [ ] 10. Implement performance tracking
- [ ] 10.1 Add metrics tracking to EarningEngine
  - Track totalEarned
  - Track tasksCompleted
  - Track tasksRejected
  - Calculate success rate
  - Calculate average profit
  - Calculate average execution time (EMA)
  - _Requirements: 9.1-9.6_

- [ ]* 10.2 Write property test for metrics monotonicity
  - **Property 9: Metrics Monotonicity**
  - **Validates: Requirements 9.1**

## Phase 11: Integration & Testing

- [ ] 11. Wire all components together
- [ ] 11.1 Update kernel.ts to use EarningEngine
  - Import EarningEngine
  - Check shouldEnterEarningMode in tick()
  - Call enterEarningMode() when threshold reached
  - Monitor earning state
  - _Requirements: 1.1-1.5_

- [ ] 11.2 Add earning state to UI
  - Display EARNING status
  - Show earning metrics
  - Show blacklisted requesters
  - _Requirements: 9.1-9.6_

- [ ]* 11.3 Write property test for state transition safety
  - **Property 10: State Transition Safety**
  - **Validates: Requirements 1.4**

- [ ] 11.4 End-to-end integration test
  - Deploy mock requester agent
  - Drain PROTOGEN balance to $0.80
  - Observe autonomous earning
  - Verify balance recovery to $5.00
  - Verify UCPT proofs generated
  - Verify payments claimed
  - _Requirements: All_

## Phase 12: Documentation & Deployment

- [ ] 12. Finalize production deployment
- [ ] 12.1 Update README.md
  - Document autonomous earning feature
  - Add configuration guide
  - Add troubleshooting section
  - _Requirements: All_

- [ ] 12.2 Create operator runbook
  - Monitoring procedures
  - Alert response procedures
  - Recovery procedures for CRITICAL_FAILURE
  - _Requirements: All_

- [ ] 12.3 Production deployment checklist
  - Verify all environment variables set
  - Verify escrow contract deployed
  - Verify mesh network connectivity
  - Verify LLM API access
  - Run smoke tests
  - _Requirements: All_

## Success Criteria

- [ ] Agent autonomously recovers from sub-$1 balance without human input
- [ ] All transactions cryptographically verified (UCPT proofs stored)
- [ ] Zero security incidents (no malicious tasks executed)
- [ ] Average profit margin >30% per task
- [ ] Success rate >80% over 10+ tasks
- [ ] All 10 correctness properties pass PBT with 100+ iterations
