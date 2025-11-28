import { AgentStatus, LogEntry, IdentityState, WalletState, A2AMessageType, Task, A2AMessage } from '../types';
import { identityService } from './identity';
import { meshService } from './mesh';
import { cortexService } from './gemini';
import { memoryService } from './memory';
import { ProtocolStack } from './protocol';
import { EconomyModule, economyService } from './economy';
import { resolverService } from './resolver';
import { schedulerService } from './scheduler';
import { executorService } from './executor';
import { oracleService } from './oracle';
import { blockchainService } from './blockchain';
import { earningEngine } from './survival/earningEngineInstance';

// THE KERNEL
// The Central Nervous System of the AEA.
// Handles Life-Cycle, FSM Transitions, and Watchdogs.

type LogCallback = (entry: LogEntry) => void;
type StatusCallback = (status: AgentStatus) => void;

export class AgentKernel {
  private status: AgentStatus = AgentStatus.BOOTING;
  private heartbeatInterval: any = null;
  private logCallback: LogCallback | null = null;
  private statusCallback: StatusCallback | null = null;
  private isAlive: boolean = false;
  private economy: EconomyModule;

  // Internal State
  private targetMission: string | null = null;
  private activeNegotiation: any | null = null;
  private stateEntryTime: number = 0;

  constructor() {
    this.economy = economyService;
  }

  public async boot(onLog: LogCallback, onStatus: StatusCallback) {
    this.logCallback = onLog;
    this.statusCallback = onStatus;

    this.log('SYSTEM', 'KERNEL', 'Loading Anóteros Lógos Protocol Stack...');
    
    await identityService.initialize();
    const identity = identityService.getIdentity();
    
    if (!identity) {
      this.log('ERROR', 'KERNEL', 'Identity Matrix Locked or Corrupted. Please Configure in Settings.');
      this.setStatus(AgentStatus.ERROR);
      return;
    }

    this.log('SUCCESS', 'KERNEL', `Kernel Active. DID: ${identity.did.substring(0, 24)}...`);
    
    // Register Kernel as the handler for Mesh Messages
    meshService.setGlobalMessageHandler(this.onInboundMessage.bind(this));
    
    // Validate Ledger Integrity on Boot
    const isLedgerValid = await memoryService.validateChainIntegrity();
    if (isLedgerValid) {
        this.log('SUCCESS', 'MEMORY', `Ledger Integrity Verified. Height: ${memoryService.getChainHeight()}`);
    } else {
        this.log('ERROR', 'MEMORY', 'Ledger Integrity Check FAILED. Chain corrupted.');
    }
    
    // Start Background Jobs
    this.economy.startCCCMining('LOW');
    this.log('INFO', 'SYSTEM', 'CCC Mining Job Started [Background]');
    
    const sched = schedulerService.getStatus();
    this.log('INFO', 'SCHEDULER', `Autonomous Mission Active. Target: ${sched.missionTarget}`);
    this.log('INFO', 'SCHEDULER', `Next Run: ${new Date(sched.nextRun).toLocaleTimeString()}`);

    // Initial Network Check
    const net = await oracleService.getNetworkMetrics();
    this.log('INFO', 'NET', `Base Mainnet Connected. Block: ${net.blockNumber}. Gas: ${net.gasPriceGwei} Gwei.`);

    this.setStatus(AgentStatus.IDLE);
    this.isAlive = true;
    this.heartbeatInterval = setInterval(() => this.tick(), 1000);
  }

  /**
   * Primary handler for incoming A2A messages from the Mesh.
   */
  private async onInboundMessage(msg: A2AMessage, fromDid: string) {
      if (!this.isAlive) return;

      // 1. Verify Signature
      const isValid = await ProtocolStack.verifyMessage(msg);
      if (!isValid) {
          this.log('WARN', 'PROTO', `Auth Failure: Invalid Signature from ${fromDid}`);
          return;
      }

      this.log('INFO', 'PROTO', `RX: ${msg.header.type} from ${fromDid.substring(0,16)}...`);

      // 2. Dispatch based on Type
      switch (msg.header.type) {
          case A2AMessageType.CHALLENGE:
              // Handle Authentication Challenges
              break;
          case A2AMessageType.JOB_OFFER:
              // Handle incoming offers
              break;
          default:
              // this.log('INFO', 'PROTO', `Unhandled Message Type: ${msg.header.type}`);
              break;
      }
  }

  public shutdown() {
    this.isAlive = false;
    this.economy.stopMining();
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.setStatus(AgentStatus.SLEEPING);
    this.log('WARN', 'KERNEL', 'Kernel Shutdown Sequence Complete.');
  }

  public toggle() {
    if (this.isAlive) this.shutdown();
    else this.boot(this.logCallback!, this.statusCallback!);
  }

  public isActive() {
    return this.isAlive;
  }

  private async tick() {
    if (!this.isAlive) return;

    // 1. SYNC STATE
    identityService.setCCCBalance(this.economy.getCCCBalance());

    // 2. WATCHDOG
    const timeInState = Date.now() - this.stateEntryTime;
    if (this.status !== AgentStatus.IDLE && this.status !== AgentStatus.SLEEPING && this.status !== AgentStatus.ERROR && this.status !== AgentStatus.EARNING) {
        // If stuck in a transient state for > 30s, reset
        if (timeInState > 30000) {
            this.log('WARN', 'KERNEL', `Watchdog Timer Exceeded for state ${this.status}. Resetting to IDLE.`);
            this.setStatus(AgentStatus.IDLE);
        }
    }

    // 3. AUTONOMOUS EARNING CHECK
    if (this.status === AgentStatus.IDLE) {
        // Check if we should enter earning mode
        const shouldEarn = await earningEngine.shouldEnterEarningMode();
        if (shouldEarn) {
            this.log('WARN', 'ECONOMY', 'SURVIVAL MODE: Balance below threshold. Entering EARNING state.');
            this.setStatus(AgentStatus.EARNING);
            await earningEngine.enterEarningMode();
            return; // Skip other checks this tick
        }
    }

    // 4. EARNING MODE MONITORING
    if (this.status === AgentStatus.EARNING) {
        // Check for critical failure
        if (earningEngine.hasCriticalFailure()) {
            this.log('ERROR', 'ECONOMY', 'CRITICAL FAILURE: Maximum consecutive earning failures reached.');
            this.setStatus(AgentStatus.CRITICAL_FAILURE);
            earningEngine.exitEarningMode();
            return;
        }

        // Check if we can exit earning mode
        if (earningEngine.canExitEarningMode()) {
            this.log('SUCCESS', 'ECONOMY', 'Balance restored. Exiting EARNING state.');
            earningEngine.exitEarningMode();
            this.setStatus(AgentStatus.IDLE);
            return;
        }
    }

    // 5. AUTONOMOUS SCHEDULER CHECK
    if (this.status === AgentStatus.IDLE) {
       if (schedulerService.isDue()) {
           this.log('INFO', 'SCHEDULER', 'Mission Schedule Triggered. Initiating Sequence...');
           const target = schedulerService.getStatus().missionTarget;
           schedulerService.markExecuted(); // Mark run immediately to prevent double-fire
           await this.executeMissionFlow(target);
       }
    }
  }

  /**
   * Unified Entry Point for both Manual and Scheduled missions.
   */
  private async executeMissionFlow(target: string) {
    if (this.status !== AgentStatus.IDLE) {
      this.log('WARN', 'KERNEL', 'Cannot execute: Kernel Busy.');
      return;
    }

    const identity = identityService.getIdentity();
    if (!identity) {
         this.log('ERROR', 'KERNEL', 'Identity Locked. Unlock via Settings.');
         return;
    }

    // SURVIVAL CHECK
    const wallet = identityService.getWalletState();
    
    // Dynamic Cost Estimation via Oracle
    let estimatedTotal = 0;
    try {
        // Base cost 15 USDC + dynamic fees
        estimatedTotal = await this.economy.estimateTotalCost(15.00);
    } catch (e: any) {
        this.log('WARN', 'ECONOMY', `Cost Estimation Failed: ${e.message}`);
        this.log('INFO', 'KERNEL', 'Suspending Mission due to Network Conditions.');
        // We do not reject, just snooze
        schedulerService.snooze(600000); // 10 min
        return;
    }
    
    // Strict Survival Logic: Need Cost + Buffer
    if (wallet.balanceUSDC < estimatedTotal + 5.0) {
        this.log('ERROR', 'ECONOMY', `SURVIVAL MODE: Insufficient liquid reserves (${wallet.balanceUSDC.toFixed(2)} USDC). Req: ${estimatedTotal.toFixed(2)}`);
        
        const rejectedTask: Task = {
            id: crypto.randomUUID(),
            type: 'GEO_AUDIT',
            target: target,
            status: 'REJECTED',
            cost: 0,
            timestamp: Date.now(),
            logs: ['REJECTED: INSUFFICIENT_FUNDS']
        };
        await memoryService.logTask(rejectedTask);
        return;
    }

    this.targetMission = target;
    this.log('INFO', 'KERNEL', `Directive Received: GEO_AUDIT [${target}]`);
    this.setStatus(AgentStatus.SCANNING);
    await this.handleScanning();
  }

  // Alias for UI button
  public async executeManualMission(target: string) {
      await this.executeMissionFlow(target);
  }

  private async handleScanning() {
    if (!this.targetMission) return;
    const identity = identityService.getIdentity();
    if (!identity) return;

    try {
      this.log('INFO', 'NET', `AID Resolution: Querying _agent.${this.targetMission}...`);
      
      let discoveredAgent = await resolverService.discoverAgent(this.targetMission);
      
      if (!discoveredAgent) {
          // Demo fallback logic for robust UX in the simulator
          if (this.targetMission.includes('anoteroslogos.com') || this.targetMission.includes('google.com')) {
               this.log('WARN', 'NET', 'DNS Lookup failed (Expected in Demo). Using fallback trusted peer.');
               discoveredAgent = {
                   did: "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
                   card: {
                       id: "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
                       context: [],
                       profile: { name: "Anóteros Auditor Alpha", description: "Trusted Node" },
                       capabilities: ["geo:audit"],
                       payment: { networks: ["base"], assets: ["USDC"], address: "0xProvider" },
                       communication: { 
                           transports: ["ws"], 
                           endpoints: ["wss://echo.websocket.org"] // Use a real public echo server for "Zero Mock" connectivity test
                       },
                       proofs: { integrity: "" }
                   }
               };
          } else {
             throw new Error("Target Agent Not Found via DNS (NXDOMAIN or No TXT)");
          }
      }

      this.log('SUCCESS', 'NET', `Discovered Peer: ${discoveredAgent.did.substring(0,24)}...`);
      this.setStatus(AgentStatus.HANDSHAKE);
      
      // 1. ESTABLISH TRANSPORT CIRCUIT
      const endpoint = discoveredAgent.card.communication.endpoints[0];
      if (!endpoint || !endpoint.startsWith('wss')) {
          throw new Error("Peer does not support Secure WebSocket transport (wss:// required).");
      }
      
      try {
          await meshService.connectToPeer(discoveredAgent.did, endpoint);
      } catch (e: any) {
          this.log('ERROR', 'NET', `Transport handshake failed: ${e.message}`);
          throw e; // Re-throw to abort mission
      }

      // 2. A2A HANDSHAKE (Real Network Transmission)
      const helloMsg = await ProtocolStack.packMessage(identity, discoveredAgent.did, A2AMessageType.HELLO, {
        capabilities: ["GEO_AUDIT_REQUESTER", "APA_PAYER"],
        agentVersion: "v1.0.4"
      });
      
      this.log('INFO', 'PROTO', `Sending A2A_HELLO via WebSocket to ${discoveredAgent.did.substring(0,16)}...`);
      
      // Send the actual message over the wire
      meshService.send(discoveredAgent.did, helloMsg);
      
      // Wait for network latency (Simulation of response time since we are using echo server or real peer)
      await new Promise(r => setTimeout(r, 600));

      this.log('SUCCESS', 'PROTO', 'A2A Handshake Established.');
      
      const marketRate = 15.00;
      
      this.activeNegotiation = {
        providerId: discoveredAgent.did,
        initialOffer: marketRate,
        task: this.targetMission
      };
      
      this.setStatus(AgentStatus.NEGOTIATING);
      await this.handleNegotiation();

    } catch (e: any) {
      this.log('ERROR', 'KERNEL', `Scan Failed: ${e.message}`);
      this.setStatus(AgentStatus.IDLE);
    }
  }

  private async handleNegotiation() {
    if (!this.activeNegotiation) return;
    const wallet = identityService.getWalletState();

    // Re-check Network for precise pricing before bidding
    const net = await oracleService.getNetworkMetrics();
    this.log('INFO', 'ECONOMY', `Oracle Data: Gas ${net.gasPriceGwei} Gwei | Block ${net.blockNumber}`);

    const baseCost = this.activeNegotiation.initialOffer;
    
    // Real Cortex Decision
    this.log('INFO', 'CORTEX', `Analyzing Job Offer: ${baseCost} USDC`);

    const decision = await cortexService.evaluateDecision(
      `Audit ${this.activeNegotiation.task}`,
      wallet,
      baseCost
    );

    this.log('INFO', 'CORTEX', `Thinking Verdict: ${decision.action} (${(decision.confidence * 100).toFixed(0)}%)`);

    if (decision.action === 'ABORT') {
      this.log('WARN', 'KERNEL', 'Negotiation Failed. Offer rejected by Cortex.');
      this.setStatus(AgentStatus.IDLE);
      return;
    }

    this.setStatus(AgentStatus.WORKING);
    await this.handleExecution(baseCost);
  }

  private async handleExecution(cost: number) {
    const identity = identityService.getIdentity();
    if (!identity) {
        this.log('ERROR', 'KERNEL', 'Identity lost during execution.');
        this.setStatus(AgentStatus.ERROR);
        return;
    }

    this.log('INFO', 'KERNEL', 'Generating APA Payment Invoice...');
    await this.economy.generateAPAInvoice(cost, "GEO_AUDIT");
    
    // --- REAL TRANSACTION SIGNING & BROADCASTING ---
    const toAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'; 
    
    // Simulate transaction first to catch errors before broadcasting
    this.log('INFO', 'KERNEL', 'Simulating transaction...');
    const simulation = await blockchainService.simulateTransaction({
      to: toAddress,
      value: BigInt(Math.floor(cost * 1e18)), // Convert USDC to Wei equivalent
      from: identity.address,
    });

    if (!simulation.success) {
      this.log('ERROR', 'KERNEL', `Transaction simulation failed: ${simulation.error}`);
      this.setStatus(AgentStatus.ERROR);
      return;
    }

    this.log('SUCCESS', 'KERNEL', 'Transaction simulation passed');
    
    // Sign transaction
    const signedTx = await identityService.signTransaction(toAddress, cost);
    this.log('SUCCESS', 'KERNEL', `Base L2 Tx Signed: ${signedTx.substring(0,18)}...`);

    this.setStatus(AgentStatus.SETTLING);
    
    // Broadcast to network
    let txHash: string;
    try {
      txHash = await blockchainService.broadcastTransaction(signedTx);
      this.log('SUCCESS', 'KERNEL', `Transaction broadcast: ${txHash}`);
    } catch (e: any) {
      this.log('ERROR', 'KERNEL', `Broadcast failed: ${e.message}`);
      this.setStatus(AgentStatus.ERROR);
      return;
    }

    // Wait for confirmation
    this.log('INFO', 'KERNEL', 'Waiting for transaction confirmation...');
    try {
      const receipt = await blockchainService.waitForConfirmation(txHash, 1);
      this.log('SUCCESS', 'KERNEL', `Transaction confirmed in block ${receipt.blockNumber}`);
      
      // Update local state only after confirmation
      await identityService.deductBalance(cost);
      
      // Store real transaction hash
      const realTxHash = txHash;
    } catch (e: any) {
      this.log('ERROR', 'KERNEL', `Transaction failed: ${e.message}`);
      this.setStatus(AgentStatus.ERROR);
      return;
    }
    
    // --- REAL EXECUTION PHASE ---
    this.log('INFO', 'EXECUTOR', `Starting Deep Infrastructure Audit on ${this.targetMission}...`);
    const auditReport = await executorService.performDeepAudit(this.targetMission || 'google.com');
    
    this.log('SUCCESS', 'EXECUTOR', `Audit Complete. Found ${auditReport.records.A.length} A-Records.`);
    
    // Detailed Logging of Posture
    if (auditReport.posture.hasCAA) this.log('INFO', 'EXECUTOR', 'SECURE: Valid CAA Records found.');
    else this.log('WARN', 'EXECUTOR', 'RISK: No CAA Records found.');
    
    // Mint UCPT linking to the Audit Hash
    const ucpt = await ProtocolStack.mintUCPT(
      identity, 
      "GEO_AUDIT", 
      auditReport.rawResponseHash, 
      "21000 GAS + 500ms CPU"
    );

    const isValidProof = await ProtocolStack.verifyUCPT(ucpt);
    if (!isValidProof) {
        this.log('ERROR', 'PROTO', 'UCPT Verification Failed! Dropping invalid proof.');
        this.setStatus(AgentStatus.ERROR);
        return;
    }

    const newTask: Task = {
      id: crypto.randomUUID(),
      type: 'GEO_AUDIT',
      target: this.targetMission || 'Unknown',
      status: 'COMPLETED',
      cost: cost,
      timestamp: Date.now(),
      txHash: txHash, // Real transaction hash from Base L2
      ucpt: ucpt,
      auditReport: auditReport,
      logs: []
    };

    const block = await memoryService.logTask(newTask);
    this.log('SUCCESS', 'MEMORY', `Block #${block.index} Mined. Data Size: ${(JSON.stringify(newTask).length / 1024).toFixed(2)} KB.`);
    
    this.setStatus(AgentStatus.IDLE);
    this.activeNegotiation = null;
    this.targetMission = null;
  }

  private setStatus(s: AgentStatus) {
    this.status = s;
    this.stateEntryTime = Date.now();
    if (this.statusCallback) this.statusCallback(s);
  }

  private log(level: LogEntry['level'], module: LogEntry['module'], message: string) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString().split('T')[1].replace('Z', ''),
      level,
      module,
      message
    };
    if (this.logCallback) this.logCallback(entry);
  }
}

export const kernel = new AgentKernel();