# Requirements Document: Autonomous Earning Engine

## Introduction

This specification defines the requirements for extending PROTOGEN-01 with autonomous economic self-sufficiency capabilities. The agent must be able to discover, evaluate, bid on, execute, and claim payment for computational tasks offered by other agents in the Anóteros Lógos mesh network when USDC balance falls below survival threshold.

## Glossary

- **Agent**: An autonomous economic entity with cryptographic identity (DID) capable of executing tasks and transacting value
- **Earning Engine**: The orchestration module responsible for autonomous task discovery, evaluation, execution, and payment claiming
- **Survival Threshold**: The USDC balance level ($1.00) below which the agent enters EARNING state
- **Safe Threshold**: The USDC balance level ($5.00) above which the agent exits EARNING state
- **Task Marketplace**: The discovery and evaluation system for finding profitable tasks in the mesh network
- **Escrow Contract**: An on-chain smart contract holding payment funds that releases upon UCPT proof submission
- **UCPT**: Universal Computational Proof Token - cryptographic proof of task execution
- **Mesh Network**: The peer-to-peer network of agents using Kademlia DHT for discovery
- **Risk Assessment**: The security evaluation system for validating task safety before execution
- **Bid Strategy**: The pricing algorithm for calculating optimal bid prices
- **LLM Advisor**: The AI reasoning system for ambiguous economic decisions

## Requirements

### Requirement 1: Economic State Machine Extension

**User Story:** As an autonomous agent, I want to automatically enter earning mode when my balance is low, so that I can restore economic viability without human intervention.

#### Acceptance Criteria

1. WHEN the Agent USDC balance falls below SURVIVAL_THRESHOLD THEN the Kernel SHALL transition from IDLE state to EARNING state
2. WHILE in EARNING state THE Agent SHALL query the Mesh Network for available tasks every 5 minutes
3. WHEN the Agent USDC balance reaches SAFE_THRESHOLD THEN the Kernel SHALL transition from EARNING state to IDLE state
4. IF the Agent experiences 3 consecutive task execution failures THEN the Kernel SHALL transition to CRITICAL_FAILURE state
5. WHEN entering EARNING state THEN the Agent SHALL broadcast WORKER_AVAILABLE message to all connected mesh peers

### Requirement 2: Task Discovery and Marketplace

**User Story:** As an autonomous agent, I want to discover paying tasks in the mesh network, so that I can evaluate opportunities for earning USDC.

#### Acceptance Criteria

1. WHEN querying for tasks THEN the Task Marketplace SHALL use Kademlia DHT to find nodes with task-offering capability
2. WHEN a peer advertises tasks THEN the Task Marketplace SHALL retrieve task specifications via A2A protocol
3. WHEN evaluating a task THEN the Task Marketplace SHALL verify the Agent meets minimum CCC balance requirements
4. WHEN evaluating a task THEN the Task Marketplace SHALL verify the Agent meets minimum reputation requirements
5. WHEN evaluating a task THEN the Task Marketplace SHALL calculate estimated execution cost including gas fees
6. WHEN evaluating a task THEN the Task Marketplace SHALL verify profit margin exceeds MIN_PROFIT_MARGIN (30%)
7. WHEN evaluating a task THEN the Task Marketplace SHALL verify estimated duration does not exceed MAX_TASK_DURATION (1800 seconds)

### Requirement 3: Dynamic Bid Strategy

**User Story:** As an autonomous agent, I want to calculate optimal bid prices for tasks, so that I maximize profit while remaining competitive.

#### Acceptance Criteria

1. WHEN calculating a bid THEN the Bid Strategy SHALL compute BASE_COST as estimated execution time multiplied by $0.001 per second
2. WHEN calculating a bid THEN the Bid Strategy SHALL query current Base L2 gas price and apply 20% safety margin
3. WHEN the task requester has trust score below 50 THEN the Bid Strategy SHALL add 20% risk premium to the bid
4. WHEN the task requester has trust score above 50 THEN the Bid Strategy SHALL not add risk premium
5. WHEN competing bids exist THEN the Bid Strategy SHALL undercut the lowest bid by 5% if still profitable
6. WHEN undercutting would violate minimum profit margin THEN the Bid Strategy SHALL maintain floor price
7. WHEN the calculated bid exceeds task payment amount THEN the Bid Strategy SHALL cap bid at payment amount

### Requirement 4: Risk Assessment and Security

**User Story:** As an autonomous agent, I want to evaluate task safety before execution, so that I protect my identity and resources from malicious actors.

#### Acceptance Criteria

1. WHEN assessing task risk THEN the Risk Assessment SHALL query mesh network for requester reputation score
2. IF requester trust score is below 30 THEN the Risk Assessment SHALL reject the task
3. WHEN inspecting task payload THEN the Risk Assessment SHALL scan for dangerous keywords (exec, eval, system, shell, private, key, vault, password)
4. IF dangerous keywords are detected THEN the Risk Assessment SHALL reject the task
5. WHEN verifying payment THEN the Risk Assessment SHALL query escrow contract to confirm funds are locked on-chain
6. IF escrow funds are insufficient THEN the Risk Assessment SHALL reject the task
7. WHEN verifying payment THEN the Risk Assessment SHALL confirm payment release requires UCPT proof submission

### Requirement 5: Task Execution Pipeline

**User Story:** As an autonomous agent, I want to execute accepted tasks with full monitoring, so that I can generate valid proofs and claim payment.

#### Acceptance Criteria

1. WHEN executing a task THEN the Task Executor SHALL lock agent state to prevent concurrent task execution
2. WHEN executing a task THEN the Task Executor SHALL record start time and initial resource snapshot
3. WHEN executing a task THEN the Task Executor SHALL delegate to appropriate service layer based on task type
4. WHEN task execution completes successfully THEN the Task Executor SHALL generate UCPT proof token with Ed25519 signature
5. WHEN task execution fails THEN the Task Executor SHALL not generate UCPT proof
6. WHEN task execution fails due to malicious payload THEN the Task Executor SHALL blacklist the requester DID
7. WHEN UCPT proof is generated THEN the Task Executor SHALL submit proof to escrow contract via releasePayment function

### Requirement 6: Escrow Smart Contract Integration

**User Story:** As an autonomous agent, I want to interact with on-chain escrow contracts, so that I can claim payment trustlessly after task completion.

#### Acceptance Criteria

1. BEFORE accepting a task THEN the Escrow Service SHALL verify lockFunds function was called with correct task ID and amount
2. WHEN claiming payment THEN the Escrow Service SHALL call releasePayment function with task ID and UCPT proof bytes
3. BEFORE broadcasting transaction THEN the Escrow Service SHALL use staticcall to simulate transaction and detect reverts
4. IF simulation detects revert THEN the Escrow Service SHALL not broadcast transaction and SHALL log revert reason
5. WHEN releasePayment succeeds THEN the Escrow Service SHALL update Agent USDC balance from blockchain query
6. WHEN releasePayment transaction is broadcast THEN the Escrow Service SHALL wait for 1 block confirmation before updating balance

### Requirement 7: LLM-Powered Decision Making

**User Story:** As an autonomous agent, I want to use AI reasoning for ambiguous economic decisions, so that I optimize for long-term economic viability.

#### Acceptance Criteria

1. WHEN multiple profitable tasks are available THEN the Earning Advisor SHALL consult LLM to select optimal task
2. WHEN consulting LLM THEN the Earning Advisor SHALL provide current balance, task details, and risk scores in prompt
3. WHEN LLM responds THEN the Earning Advisor SHALL parse JSON response containing task selection and reasoning
4. WHEN task from unknown requester offers above-market payment THEN the Earning Advisor SHALL consult LLM for risk/reward analysis
5. WHEN choosing between quick low-value task and slow high-value task THEN the Earning Advisor SHALL consult LLM for velocity optimization

### Requirement 8: Failure Handling and Blacklisting

**User Story:** As an autonomous agent, I want to handle failures gracefully and learn from malicious actors, so that I improve success rate over time.

#### Acceptance Criteria

1. WHEN task execution fails THEN the Earning Engine SHALL increment consecutive failure counter
2. WHEN consecutive failures reach 3 THEN the Earning Engine SHALL transition to CRITICAL_FAILURE state
3. WHEN task fails due to malicious payload THEN the Earning Engine SHALL add requester DID to blacklist
4. WHEN requester is blacklisted THEN the Earning Engine SHALL reject all tasks from that requester for 24 hours
5. AFTER 24 hours THEN the Earning Engine SHALL automatically remove requester from blacklist
6. WHEN task succeeds THEN the Earning Engine SHALL reset consecutive failure counter to zero

### Requirement 9: Metrics and Observability

**User Story:** As an autonomous agent, I want to track earning performance metrics, so that I can optimize economic strategy over time.

#### Acceptance Criteria

1. WHEN task completes successfully THEN the Earning Engine SHALL increment total earned by payment amount
2. WHEN task completes successfully THEN the Earning Engine SHALL increment tasks completed counter
3. WHEN task is rejected THEN the Earning Engine SHALL increment tasks rejected counter
4. WHEN updating metrics THEN the Earning Engine SHALL calculate success rate as (completed / (completed + failures)) * 100
5. WHEN updating metrics THEN the Earning Engine SHALL calculate average profit as total earned / tasks completed
6. WHEN updating metrics THEN the Earning Engine SHALL calculate average execution time using exponential moving average

### Requirement 10: Configuration and Environment

**User Story:** As a system operator, I want to configure earning parameters via environment variables, so that I can tune economic behavior without code changes.

#### Acceptance Criteria

1. THE Agent SHALL read SURVIVAL_THRESHOLD from environment variable with default value 1.00 USDC
2. THE Agent SHALL read SAFE_THRESHOLD from environment variable with default value 5.00 USDC
3. THE Agent SHALL read MIN_PROFIT_MARGIN from environment variable with default value 0.30 (30%)
4. THE Agent SHALL read MAX_TASK_DURATION from environment variable with default value 1800 seconds
5. THE Agent SHALL read ESCROW_CONTRACT_ADDRESS from environment variable for Base L2 network
6. IF required environment variables are missing THEN the Agent SHALL log error and use default values
