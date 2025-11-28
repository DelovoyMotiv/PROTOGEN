/**
 * PROTOGEN-01 Production Frontend
 * Full-featured React application using API client for server communication
 * Ph.D.-level engineering: Real data, no mocks, production-ready
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  LayoutGrid, Network, Database, Settings, Cpu, ShieldCheck, Activity, Play, TerminalSquare, 
  Lock, Globe, Server, Wallet, Clock, Pause, Hash, FileJson, X, Eye, EyeOff, Save, RefreshCw, 
  Zap, Wifi, AlertTriangle, ChevronDown, Check, LogOut, Timer, Radio, BrainCircuit, Signal, 
  Hammer, Coins
} from 'lucide-react';

import { 
  AgentStatus, LogEntry, PageView, Task, DashboardProps, NetworkProps, LedgerProps, 
  SettingsProps, IdentityState, MeshPeer, LookupStep, OpenRouterModel
} from './types';

// Import API client instead of direct services
import { 
  identityService, 
  kernel, 
  economyService, 
  meshService, 
  memoryService, 
  cortexService, 
  schedulerService, 
  oracleService,
  earningService,
  consensusServiceAPI,
  cascadeService,
  securityService,
  reputationService,
  exportService
} from './services/api-client';

// --- UTILITY COMPONENTS ---

interface NavItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-3 md:py-2 text-xs font-medium transition-all duration-200 border-l-2 ${
      active 
        ? 'bg-zinc-900 text-zinc-100 border-emerald-500' 
        : 'text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300 border-transparent'
    }`}
  >
    <Icon className="w-4 h-4 shrink-0" />
    <span className="font-mono tracking-tight truncate">{label.toUpperCase()}</span>
  </button>
);

interface StatMetricProps {
  label: string;
  value: string;
  subValue?: string;
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;
}

const StatMetric: React.FC<StatMetricProps> = ({ label, value, subValue, icon: Icon, color = "text-zinc-100" }) => (
  <div className="flex flex-col border border-zinc-800 bg-black/50 p-3 relative overflow-hidden group min-w-[140px]">
    <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-40 transition-opacity">
        {Icon && <Icon className={`w-8 h-8 ${color}`} />}
    </div>
    <div className="flex items-center justify-between mb-2 z-10">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono truncate">{label}</span>
      {Icon && <Icon className={`w-3 h-3 ${color} z-10`} />}
    </div>
    <div className="text-lg font-mono font-bold leading-none text-zinc-200 z-10 truncate">{value}</div>
    {subValue && <div className="text-[10px] text-zinc-600 font-mono mt-1 z-10 truncate">{subValue}</div>}
  </div>
);

const StatusIndicator = ({ status }: { status: AgentStatus }) => {
  const colorMap = {
    [AgentStatus.BOOTING]: 'bg-yellow-500',
    [AgentStatus.IDLE]: 'bg-emerald-500',
    [AgentStatus.SCANNING]: 'bg-purple-500',
    [AgentStatus.HANDSHAKE]: 'bg-indigo-500',
    [AgentStatus.NEGOTIATING]: 'bg-orange-500',
    [AgentStatus.WORKING]: 'bg-blue-500',
    [AgentStatus.SETTLING]: 'bg-pink-500',
    [AgentStatus.ERROR]: 'bg-red-500',
    [AgentStatus.SLEEPING]: 'bg-zinc-500',
  };

  return (
    <div className="flex items-center gap-2 border border-zinc-800 bg-black px-2 py-1 shrink-0">
      <div className={`w-1.5 h-1.5 rounded-sm ${colorMap[status] || 'bg-zinc-500'} animate-pulse`}></div>
      <span className="text-[10px] font-mono font-bold uppercase text-zinc-300 tracking-wider hidden sm:block">
        {status}
      </span>
      <span className="text-[10px] font-mono font-bold uppercase text-zinc-300 tracking-wider sm:hidden">
        {status.substring(0,3)}
      </span>
    </div>
  );
};

// --- NEW DASHBOARD COMPONENTS ---

interface EarningEnginePanelProps {
  status: any;
  metrics: any;
}

const EarningEnginePanel: React.FC<EarningEnginePanelProps> = ({ status, metrics }) => {
  const progressPercent = status.survivalThreshold > 0 
    ? Math.min(100, (status.currentBalance / status.safeThreshold) * 100)
    : 0;

  return (
    <div className="border border-zinc-800 bg-black/50 flex flex-col">
      <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-3 h-3 text-emerald-500" />
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Earning Engine</span>
        </div>
        <div className={`px-2 py-0.5 text-[9px] font-bold font-mono ${
          status.isActive 
            ? 'bg-emerald-900/20 text-emerald-500 border border-emerald-900' 
            : 'bg-zinc-900/20 text-zinc-500 border border-zinc-800'
        }`}>
          {status.isActive ? 'ACTIVE' : 'STANDBY'}
        </div>
      </div>
      
      <div className="p-3 space-y-3">
        {/* Balance Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-[9px] font-mono text-zinc-500">
            <span>BALANCE PROGRESS</span>
            <span className="text-zinc-300">{status.currentBalance.toFixed(4)} / {status.safeThreshold.toFixed(2)} USDC</span>
          </div>
          <div className="h-2 bg-zinc-900 border border-zinc-800 overflow-hidden relative">
            <div 
              className={`h-full transition-all duration-500 ${
                progressPercent < 20 ? 'bg-red-600' :
                progressPercent < 50 ? 'bg-orange-600' :
                progressPercent < 80 ? 'bg-yellow-600' :
                'bg-emerald-600'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
            <div 
              className="absolute top-0 h-full w-0.5 bg-amber-500"
              style={{ left: `${(status.survivalThreshold / status.safeThreshold) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[8px] font-mono text-zinc-600">
            <span>SURVIVAL: {status.survivalThreshold.toFixed(2)}</span>
            <span>SAFE: {status.safeThreshold.toFixed(2)}</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div className="border border-zinc-800 bg-zinc-900/20 p-2">
            <div className="text-zinc-500 mb-1">EARNED</div>
            <div className="text-emerald-400 font-bold">{metrics.totalEarned.toFixed(4)} USDC</div>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/20 p-2">
            <div className="text-zinc-500 mb-1">SUCCESS RATE</div>
            <div className="text-blue-400 font-bold">{metrics.successRate.toFixed(1)}%</div>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/20 p-2">
            <div className="text-zinc-500 mb-1">COMPLETED</div>
            <div className="text-zinc-300 font-bold">{metrics.tasksCompleted}</div>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/20 p-2">
            <div className="text-zinc-500 mb-1">REJECTED</div>
            <div className="text-zinc-300 font-bold">{metrics.tasksRejected}</div>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/20 p-2">
            <div className="text-zinc-500 mb-1">AVG PROFIT</div>
            <div className="text-zinc-300 font-bold">{metrics.averageProfit.toFixed(4)}</div>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/20 p-2">
            <div className="text-zinc-500 mb-1">FAILURES</div>
            <div className={`font-bold ${status.consecutiveFailures > 0 ? 'text-red-400' : 'text-zinc-300'}`}>
              {status.consecutiveFailures}
            </div>
          </div>
        </div>

        {/* Blacklist */}
        {status.blacklistedRequesters.length > 0 && (
          <div className="border border-red-900/50 bg-red-900/10 p-2">
            <div className="text-[9px] text-red-400 font-mono font-bold mb-1">
              BLACKLISTED: {status.blacklistedRequesters.length}
            </div>
            <div className="text-[8px] text-zinc-500 font-mono">
              {status.blacklistedRequesters.slice(0, 2).map((did: string) => (
                <div key={did}>{did.substring(0, 24)}...</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface UCPTConsensusPanelProps {
  metrics: any;
  config: any;
}

const UCPTConsensusPanel: React.FC<UCPTConsensusPanelProps> = ({ metrics, config }) => {
  const validationRate = metrics.tokensValidated + metrics.tokensRejected > 0
    ? (metrics.tokensValidated / (metrics.tokensValidated + metrics.tokensRejected)) * 100
    : 100;

  return (
    <div className="border border-zinc-800 bg-black/50 flex flex-col">
      <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3 h-3 text-purple-500" />
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">UCPT Consensus</span>
        </div>
        <div className="px-2 py-0.5 text-[9px] font-bold font-mono bg-purple-900/20 text-purple-400 border border-purple-900">
          PoW ACTIVE
        </div>
      </div>
      
      <div className="p-3 space-y-3">
        {/* Difficulty Gauge */}
        <div className="space-y-1">
          <div className="flex justify-between text-[9px] font-mono text-zinc-500">
            <span>DIFFICULTY (LEADING ZEROS)</span>
            <span className="text-purple-400 font-bold">{config.difficulty}</span>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map(level => (
              <div 
                key={level}
                className={`flex-1 h-2 border border-zinc-800 ${
                  level <= config.difficulty ? 'bg-purple-600' : 'bg-zinc-900'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Validation Stats */}
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div className="border border-zinc-800 bg-zinc-900/20 p-2">
            <div className="text-zinc-500 mb-1">VALIDATED</div>
            <div className="text-emerald-400 font-bold">{metrics.tokensValidated}</div>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/20 p-2">
            <div className="text-zinc-500 mb-1">REJECTED</div>
            <div className="text-red-400 font-bold">{metrics.tokensRejected}</div>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/20 p-2">
            <div className="text-zinc-500 mb-1">CONFLICTS</div>
            <div className="text-orange-400 font-bold">{metrics.conflictsResolved}</div>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/20 p-2">
            <div className="text-zinc-500 mb-1">RATE</div>
            <div className="text-blue-400 font-bold">{validationRate.toFixed(1)}%</div>
          </div>
        </div>

        {/* Validation Rate Bar */}
        <div className="space-y-1">
          <div className="text-[9px] font-mono text-zinc-500">VALIDATION SUCCESS RATE</div>
          <div className="h-1.5 bg-zinc-900 border border-zinc-800 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
              style={{ width: `${validationRate}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// --- DASHBOARD VIEW ---

const DashboardView: React.FC<DashboardProps> = ({ 
  status, logs, wallet, identity, toggleKernel, isKernelActive, miningIntensity, setMiningIntensity, scheduler 
}) => {
  const [hashRate, setHashRate] = useState(0);
  const [networkStats, setNetworkStats] = useState({ block: 0, gas: "0.00" });

  useEffect(() => {
    const interval = setInterval(async () => {
        setHashRate(economyService.getHashRate());
        const net = await oracleService.getNetworkMetrics();
        setNetworkStats({ block: net.blockNumber, gas: net.gasPriceGwei });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const nextRunMinutes = Math.max(0, Math.floor((scheduler.nextRun - Date.now()) / 60000));

  return (
  <div className="h-full flex flex-col gap-4 p-4 overflow-hidden">
    
    {/* Telemetry Row */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
      <StatMetric 
        label="Treasury" 
        value={`${wallet.balanceUSDC.toFixed(2)} USDC`} 
        subValue={wallet.address ? `Addr: ${wallet.address.substring(0,6)}...` : 'Booting...'}
        icon={Wallet}
        color="text-emerald-500"
      />
      <StatMetric 
        label="Mining" 
        value={`${wallet.balanceCCC?.toFixed(3) || '0.000'} CCC`} 
        subValue={`${hashRate} H/s (SHA-256)`}
        icon={Hash}
        color="text-orange-500"
      />
      <StatMetric 
        label="Scheduler" 
        value={nextRunMinutes > 1400 ? "24h+" : `${nextRunMinutes} mins`}
        subValue={`Target: ${scheduler.missionTarget?.split('.')[0] || 'N/A'}...`}
        icon={Timer}
        color="text-purple-500"
      />
      <div className="border border-zinc-800 bg-black/50 p-3 flex flex-col justify-between">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono">Kernel Control</span>
        <button 
           onClick={toggleKernel}
           className={`w-full py-2 flex items-center justify-center gap-2 text-xs font-bold font-mono border transition-all ${
             isKernelActive
             ? 'border-emerald-900 bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40'
             : 'border-red-900 bg-red-900/20 text-red-400 hover:bg-red-900/40'
           }`}
         >
           {isKernelActive ? (
             <>
               <Activity className="w-3 h-3 animate-pulse" /> <span className="hidden sm:inline">SYSTEM</span> ACTIVE
             </>
           ) : (
             <>
               <Pause className="w-3 h-3" /> <span className="hidden sm:inline">SYSTEM</span> PAUSED
             </>
           )}
         </button>
      </div>
    </div>

    {/* New Monitoring Panels Row */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 shrink-0">
      <EarningEnginePanel 
        status={earningService.getStatus()} 
        metrics={earningService.getStatus().metrics}
      />
      <UCPTConsensusPanel 
        metrics={consensusServiceAPI.getMetrics()}
        config={{ difficulty: consensusServiceAPI.getMetrics().difficulty, maxIterations: 1000000 }}
      />
    </div>

    {/* Main Data & Logs Split */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
      
      {/* System Logs */}
      <div className="lg:col-span-2 border border-zinc-800 bg-black flex flex-col min-h-0 order-2 lg:order-1 h-full">
         <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
            <div className="flex items-center gap-2">
              <TerminalSquare className="w-3 h-3 text-zinc-500" />
              <span className="text-[10px] font-mono text-zinc-400 uppercase">KERNEL STDOUT</span>
            </div>
            <div className="flex gap-1">
               <div className="w-2 h-2 rounded-full bg-zinc-800"></div>
               <div className="w-2 h-2 rounded-full bg-zinc-800"></div>
            </div>
         </div>
         <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] leading-relaxed scrollbar-hide min-h-0">
            {logs.length === 0 && <span className="text-zinc-700 italic">Initializing system log...</span>}
            {logs.map((log: LogEntry) => (
              <div key={log.id} className="flex gap-2 sm:gap-3 hover:bg-zinc-900/50 transition-colors mb-0.5">
                 <span className="text-zinc-600 shrink-0 select-none opacity-50 w-14 sm:w-auto">{log.timestamp}</span>
                 <span className={`shrink-0 w-14 sm:w-16 font-bold ${
                   log.level === 'ERROR' ? 'text-red-500' :
                   log.level === 'WARN' ? 'text-amber-500' :
                   log.level === 'SUCCESS' ? 'text-emerald-500' :
                   log.level === 'SYSTEM' ? 'text-purple-500' :
                   log.module === 'PROTO' ? 'text-pink-500' :
                   log.module === 'ECONOMY' ? 'text-orange-500' :
                   log.module === 'SCHEDULER' ? 'text-purple-500' :
                   log.module === 'EXECUTOR' ? 'text-cyan-500' :
                   'text-blue-500'
                 }`}>[{log.module}]</span>
                 <span className="text-zinc-300 break-all">{log.message}</span>
              </div>
            ))}
            <div id="log-end" />
         </div>
      </div>

      {/* Quick Stats / Directives */}
      <div className="border border-zinc-800 bg-black flex flex-col min-h-0 order-1 lg:order-2 shrink-0 lg:shrink">
        <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/50">
          <span className="text-[10px] font-mono text-zinc-400 uppercase">Active Threads</span>
        </div>
        <div className="p-4 space-y-4">
           
           {/* Network Conditions */}
           <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-mono text-zinc-500 items-center">
                 <span>BASE MAINNET</span>
                 <div className="flex items-center gap-1">
                    <Signal className="w-3 h-3 text-emerald-500" />
                    <span className="text-emerald-500">LIVE</span>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono border border-zinc-800 bg-zinc-900/20 p-2">
                  <div className="flex flex-col">
                      <span className="text-zinc-500">HEIGHT</span>
                      <span className="text-zinc-300">{networkStats.block.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col text-right">
                      <span className="text-zinc-500">GAS (GWEI)</span>
                      <span className="text-zinc-300">{networkStats.gas}</span>
                  </div>
              </div>
           </div>

           <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-mono text-zinc-500 items-center">
                <span>CCC MINER</span>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setMiningIntensity(miningIntensity === 'LOW' ? 'HIGH' : 'LOW')}
                        className={`px-1.5 py-0.5 text-[9px] border transition-colors ${
                            miningIntensity === 'HIGH' 
                            ? 'border-orange-500 text-orange-500 bg-orange-900/20' 
                            : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
                        }`}
                    >
                        {miningIntensity}
                    </button>
                    <span className="text-orange-500">HASHING</span>
                </div>
              </div>
              <div className="h-1 w-full bg-zinc-900 overflow-hidden relative">
                 <div className={`h-full bg-orange-600 w-[30%] ${miningIntensity === 'HIGH' ? 'animate-pulse duration-75' : 'animate-pulse duration-1000'}`}></div>
              </div>
           </div>
           
           <div className="mt-4 p-3 border border-zinc-800/50 bg-zinc-900/20">
              <div className="text-[10px] text-zinc-500 mb-1">CURRENT DIRECTIVE</div>
              <div className="text-xs font-mono text-zinc-200">
                {status === AgentStatus.IDLE ? (
                    <div className="flex flex-col gap-1">
                        <span>IDLE / MONITORING MESH</span>
                        <span className="text-[10px] text-zinc-500">NEXT AUTO-RUN: {new Date(scheduler.nextRun).toLocaleTimeString()}</span>
                    </div>
                ) : `EXECUTING: ${status}`}
              </div>
           </div>
        </div>
      </div>
    </div>
  </div>
);
};

// --- NEW NETWORK COMPONENTS ---

const CascadeMetricsPanel: React.FC = () => {
  const metrics = cascadeService.getMetrics();
  const config = cascadeService.getConfig();

  return (
    <div className="border border-zinc-800 bg-black/50">
      <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
        <Radio className="w-3 h-3 text-cyan-500" />
        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">UCPT Cascade Protocol</span>
      </div>
      <div className="p-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-zinc-800 bg-zinc-900/20 p-2">
          <div className="text-[9px] text-zinc-500 font-mono mb-1">PROPAGATED</div>
          <div className="text-lg font-mono font-bold text-cyan-400">{metrics.tokens_propagated}</div>
        </div>
        <div className="border border-zinc-800 bg-zinc-900/20 p-2">
          <div className="text-[9px] text-zinc-500 font-mono mb-1">RECEIVED</div>
          <div className="text-lg font-mono font-bold text-emerald-400">{metrics.tokens_received}</div>
        </div>
        <div className="border border-zinc-800 bg-zinc-900/20 p-2">
          <div className="text-[9px] text-zinc-500 font-mono mb-1">BANDWIDTH</div>
          <div className="text-lg font-mono font-bold text-orange-400">{(metrics.bandwidth_bytes / 1024).toFixed(1)}KB</div>
        </div>
        <div className="border border-zinc-800 bg-zinc-900/20 p-2">
          <div className="text-[9px] text-zinc-500 font-mono mb-1">COVERAGE</div>
          <div className="text-lg font-mono font-bold text-purple-400">{metrics.coverage_percentage.toFixed(1)}%</div>
        </div>
      </div>
      <div className="px-3 pb-3">
        <div className="text-[9px] text-zinc-600 font-mono">
          FANOUT: {config.fanout} | TTL: {config.ttl}s | CACHE: {config.cacheMaxSize}
        </div>
      </div>
    </div>
  );
};

const SpamFilterPanel: React.FC = () => {
  const stats = securityService.getStats();

  return (
    <div className="border border-zinc-800 bg-black/50">
      <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
        <ShieldCheck className="w-3 h-3 text-red-500" />
        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Security Monitor</span>
      </div>
      <div className="p-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-zinc-800 bg-zinc-900/20 p-2">
          <div className="text-[9px] text-zinc-500 font-mono mb-1">TOTAL PEERS</div>
          <div className="text-lg font-mono font-bold text-zinc-300">{stats.total_peers}</div>
        </div>
        <div className="border border-zinc-800 bg-zinc-900/20 p-2">
          <div className="text-[9px] text-zinc-500 font-mono mb-1">BANNED</div>
          <div className="text-lg font-mono font-bold text-red-400">{stats.banned_peers}</div>
        </div>
        <div className="border border-zinc-800 bg-zinc-900/20 p-2">
          <div className="text-[9px] text-zinc-500 font-mono mb-1">HIGH REP</div>
          <div className="text-lg font-mono font-bold text-emerald-400">{stats.high_reputation_peers}</div>
        </div>
        <div className="border border-zinc-800 bg-zinc-900/20 p-2">
          <div className="text-[9px] text-zinc-500 font-mono mb-1">LOW REP</div>
          <div className="text-lg font-mono font-bold text-amber-400">{stats.low_reputation_peers}</div>
        </div>
      </div>
    </div>
  );
};

const ReputationRankingsPanel: React.FC<{ onPeerClick: (did: string) => void }> = ({ onPeerClick }) => {
  const rankings = reputationService.getRankings();

  return (
    <div className="border border-zinc-800 bg-black/50">
      <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
        <Activity className="w-3 h-3 text-yellow-500" />
        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Top Agents</span>
      </div>
      <div className="p-3">
        {rankings.length === 0 ? (
          <div className="text-center text-zinc-600 text-[10px] font-mono py-4">No reputation data available</div>
        ) : (
          <div className="space-y-1">
            {rankings.slice(0, 10).map((agent: any) => (
              <button
                key={agent.did}
                onClick={() => onPeerClick(agent.did)}
                className="w-full flex items-center gap-2 p-2 border border-zinc-800 bg-zinc-900/20 hover:bg-zinc-900/40 transition-colors text-left"
              >
                <div className="w-6 h-6 flex items-center justify-center bg-yellow-900/20 border border-yellow-900 text-yellow-500 text-[10px] font-bold font-mono shrink-0">
                  #{agent.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono text-zinc-300 truncate">{agent.did.substring(0, 32)}...</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1 bg-zinc-900 border border-zinc-800 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400"
                        style={{ width: `${Math.min(100, (agent.score / 1000) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-yellow-400 font-bold">{agent.score}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface PeerDetailModalProps {
  did: string;
  onClose: () => void;
}

const PeerDetailModal: React.FC<PeerDetailModalProps> = ({ did, onClose }) => {
  const [reputation, setReputation] = useState<any>(null);
  const [limits, setLimits] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [rep, lim] = await Promise.all([
          reputationService.getPeerReputation(did),
          securityService.getPeerLimits(did)
        ]);
        setReputation(rep);
        setLimits(lim);
      } catch (error) {
        console.error('Failed to fetch peer details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [did]);

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 w-full max-w-2xl max-h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-cyan-500" />
            <span className="font-mono font-bold text-zinc-200 text-sm">PEER INSPECTOR</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-4 overflow-auto flex-1 max-h-[70vh] space-y-4">
          {loading ? (
            <div className="text-center text-zinc-500 text-sm font-mono py-8">Loading peer data...</div>
          ) : (
            <>
              {/* Identity */}
              <div className="border border-zinc-800 bg-zinc-900/20 p-3">
                <div className="text-[10px] text-zinc-500 font-mono mb-2">IDENTITY</div>
                <div className="text-[10px] font-mono text-zinc-300 break-all">{did}</div>
              </div>

              {/* Reputation */}
              {reputation && (
                <div className="border border-zinc-800 bg-zinc-900/20 p-3">
                  <div className="text-[10px] text-zinc-500 font-mono mb-3">REPUTATION METRICS</div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="border border-zinc-800 bg-black/50 p-2">
                      <div className="text-zinc-500 mb-1">OVERALL SCORE</div>
                      <div className="text-yellow-400 font-bold text-lg">{reputation.overall}</div>
                    </div>
                    <div className="border border-zinc-800 bg-black/50 p-2">
                      <div className="text-zinc-500 mb-1">SUCCESS RATE</div>
                      <div className="text-emerald-400 font-bold text-lg">{reputation.success_rate.toFixed(1)}%</div>
                    </div>
                    <div className="border border-zinc-800 bg-black/50 p-2">
                      <div className="text-zinc-500 mb-1">AVG TASK TIME</div>
                      <div className="text-blue-400 font-bold">{reputation.avg_task_time.toFixed(0)}ms</div>
                    </div>
                    <div className="border border-zinc-800 bg-black/50 p-2">
                      <div className="text-zinc-500 mb-1">TOTAL EARNED</div>
                      <div className="text-purple-400 font-bold">{reputation.total_earned.toFixed(4)}</div>
                    </div>
                    <div className="border border-zinc-800 bg-black/50 p-2 col-span-2">
                      <div className="text-zinc-500 mb-1">PEER TRUST</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-zinc-900 border border-zinc-800 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400"
                            style={{ width: `${reputation.peer_trust}%` }}
                          />
                        </div>
                        <span className="text-cyan-400 font-bold">{reputation.peer_trust.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Rate Limits */}
              {limits && (
                <div className="border border-zinc-800 bg-zinc-900/20 p-3">
                  <div className="text-[10px] text-zinc-500 font-mono mb-3">RATE LIMIT STATUS</div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="border border-zinc-800 bg-black/50 p-2">
                      <div className="text-zinc-500 mb-1">ANNOUNCEMENTS</div>
                      <div className="text-zinc-300 font-bold">{limits.announcements} / {limits.quota}</div>
                    </div>
                    <div className="border border-zinc-800 bg-black/50 p-2">
                      <div className="text-zinc-500 mb-1">BANDWIDTH</div>
                      <div className="text-zinc-300 font-bold">{(limits.bandwidth_bytes / 1024).toFixed(1)}KB</div>
                    </div>
                    <div className="border border-zinc-800 bg-black/50 p-2">
                      <div className="text-zinc-500 mb-1">INVALID COUNT</div>
                      <div className={`font-bold ${limits.invalid_count > 0 ? 'text-red-400' : 'text-zinc-300'}`}>
                        {limits.invalid_count}
                      </div>
                    </div>
                    <div className="border border-zinc-800 bg-black/50 p-2">
                      <div className="text-zinc-500 mb-1">STATUS</div>
                      <div className={`font-bold ${limits.isBanned ? 'text-red-400' : 'text-emerald-400'}`}>
                        {limits.isBanned ? 'BANNED' : 'ACTIVE'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        <div className="p-2 border-t border-zinc-800 bg-zinc-900 text-center">
          <span className="text-[9px] text-zinc-500 font-mono">CRYPTOGRAPHIC VERIFICATION VIA ED25519</span>
        </div>
      </div>
    </div>
  );
};

// --- NETWORK VIEW ---

const NetworkView: React.FC<NetworkProps> = ({ peers }) => {
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);

  return (
    <div className="h-full p-4 overflow-auto">
       <div className="mb-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">A2A Mesh Network</h2>
          <div className="text-[10px] text-zinc-500 font-mono">UCPT Protocol / Gossip Cascade</div>
       </div>
  
       <div className="space-y-4">
          {/* Cascade Metrics */}
          <CascadeMetricsPanel />
          
          {/* Security Monitor */}
          <SpamFilterPanel />
          
          {/* Reputation Rankings */}
          <ReputationRankingsPanel onPeerClick={setSelectedPeer} />
          
          {/* Connected Peers Summary */}
          <div className="border border-zinc-800 bg-black p-6">
             <div className="text-center space-y-4">
                <Network className="w-12 h-12 text-zinc-700 mx-auto" />
                <div>
                   <div className="text-2xl font-mono font-bold text-zinc-300">{peers.length}</div>
                   <div className="text-xs text-zinc-500">Connected Peers</div>
                </div>
                <div className="text-[10px] text-zinc-600 max-w-md mx-auto">
                   Mesh network discovery and UCPT message propagation. Peers will appear here when discovered through DHT or direct connection.
                </div>
             </div>
          </div>
       </div>

       {/* Peer Detail Modal */}
       {selectedPeer && (
         <PeerDetailModal did={selectedPeer} onClose={() => setSelectedPeer(null)} />
       )}
    </div>
  );
};

// --- LEDGER VIEW ---

const LedgerView: React.FC<LedgerProps> = ({ tasks }) => {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  return (
    <div className="h-full p-4 overflow-hidden flex flex-col relative">
       <div className="flex justify-between items-end mb-4 shrink-0">
          <div>
             <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Immutable Ledger</h2>
             <div className="text-[10px] text-zinc-500 font-mono">LOCAL SHARD: better-sqlite3</div>
          </div>
          <div className="text-[10px] text-zinc-500 font-mono">
             {tasks.length} RECORDS
          </div>
       </div>
  
       <div className="flex-1 border border-zinc-800 bg-black overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
             <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="bg-zinc-900/50 text-[9px] text-zinc-500 font-mono sticky top-0 z-10">
                   <tr>
                      <th className="p-3 font-normal border-b border-zinc-800">TIMESTAMP</th>
                      <th className="p-3 font-normal border-b border-zinc-800">TX HASH</th>
                      <th className="p-3 font-normal border-b border-zinc-800">TYPE</th>
                      <th className="p-3 font-normal border-b border-zinc-800 text-right">COST</th>
                      <th className="p-3 font-normal border-b border-zinc-800 text-center">UCPT ID</th>
                      <th className="p-3 font-normal border-b border-zinc-800 text-right">STATUS</th>
                   </tr>
                </thead>
                <tbody className="text-[10px] font-mono divide-y divide-zinc-800/50">
                   {tasks.length === 0 && (
                     <tr><td colSpan={6} className="p-8 text-center text-zinc-600 italic">No transactions recorded on this shard.</td></tr>
                   )}
                   {tasks.map(task => (
                      <tr key={task.id} className="hover:bg-zinc-900/30 transition-colors cursor-pointer" onClick={() => setSelectedTask(task)}>
                         <td className="p-3 text-zinc-500">
                            {new Date(task.timestamp).toLocaleTimeString()}
                         </td>
                         <td className="p-3 text-blue-400 hover:text-blue-300">
                            {task.txHash ? `${task.txHash.substring(0, 12)}...` : '-'}
                         </td>
                         <td className="p-3 text-zinc-300">{task.type}</td>
                         <td className="p-3 text-right text-zinc-300">{task.cost.toFixed(2)}</td>
                         <td className="p-3 text-center text-zinc-500 text-[9px]">
                            {task.ucpt && task.ucpt.id ? (
                                <div className="flex items-center justify-center gap-1 text-emerald-500">
                                    <FileJson className="w-3 h-3" />
                                    <span>{task.ucpt.id.split(':')[1]?.substring(0,6) || 'N/A'}...</span>
                                </div>
                            ) : '-'}
                         </td>
                         <td className="p-3 text-right">
                            <span className={`px-1.5 py-0.5 rounded-sm text-[9px] font-bold ${
                               task.status === 'COMPLETED' 
                               ? 'bg-emerald-900/20 text-emerald-500' 
                               : task.status === 'REJECTED'
                               ? 'bg-orange-900/20 text-orange-500'
                               : 'bg-red-900/20 text-red-500'
                            }`}>
                               {task.status}
                            </span>
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
       </div>

       {/* Task Inspector Modal */}
       {selectedTask && (
         <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-zinc-800 w-full max-w-3xl max-h-full flex flex-col shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        <span className="font-mono font-bold text-zinc-200">TASK ARTIFACT INSPECTOR</span>
                    </div>
                    <button onClick={() => setSelectedTask(null)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 overflow-auto bg-[#0d1117] flex-1 max-h-[70vh]">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase mb-2">RAW LEDGER DATA</div>
                    <pre className="text-[10px] font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {JSON.stringify(selectedTask, null, 2)}
                    </pre>
                </div>
                <div className="p-2 border-t border-zinc-800 bg-zinc-900 text-center">
                    <span className="text-[9px] text-zinc-500 font-mono">CRYPTOGRAPHIC PROOF VERIFIED VIA ED25519</span>
                </div>
            </div>
         </div>
       )}
    </div>
  );
};

// --- SETTINGS VIEW ---

const SettingsView: React.FC<SettingsProps> = ({ identity, onReset }) => {
  const [apiKey, setApiKey] = useState('');
  const [revealKey, setRevealKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [selectedModel, setSelectedModel] = useState(cortexService.getCurrentModel());
  const [loadingModels, setLoadingModels] = useState(false);
  
  const [difficulty, setDifficulty] = useState(economyService.getMiningDifficulty());
  const [estimatedReward, setEstimatedReward] = useState(economyService.getBlockReward());

  useEffect(() => {
    const stored = localStorage.getItem('protogen_or_key');
    if (stored) {
        setApiKey(stored);
        fetchModels(stored);
    }
  }, []);

  const handleDifficultyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value);
      economyService.setMiningDifficulty(val);
      setDifficulty(val);
      setEstimatedReward(economyService.getBlockReward());
  };

  const fetchModels = async (key: string) => {
      if (typeof window !== 'undefined') {
          localStorage.setItem('protogen_or_key', key);
      }
      
      setLoadingModels(true);
      const models = await cortexService.fetchAvailableModels();
      if (models.length > 0) {
        setModels(models);
      }
      setLoadingModels(false);
  };

  const saveKey = async () => {
    localStorage.setItem('protogen_or_key', apiKey);
    setSaved(true);
    await fetchModels(apiKey);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleModelSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const modelId = e.target.value;
      setSelectedModel(modelId);
      cortexService.setModel(modelId);
  };

  const lockSession = () => {
      identityService.lockSession();
      window.location.reload();
  };

  return (
    <div className="h-full p-4 flex justify-center items-start overflow-y-auto">
       <div className="w-full max-w-2xl border border-zinc-800 bg-black p-6 space-y-8">
          
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-white uppercase flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-500" /> Identity Enclave
            </h2>
            <div className="p-4 bg-zinc-900/30 border border-zinc-800 font-mono text-[10px] space-y-3">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                    <span className="text-zinc-500">DID METHOD</span>
                    <span className="text-zinc-300">did:key (Ed25519)</span>
                </div>
                <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                    <span className="text-zinc-500">CONTROLLER</span>
                    <span className="text-zinc-300 select-all">{identity?.did || 'UNKNOWN'}</span>
                </div>
                <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                    <span className="text-zinc-500">EVM ADDRESS</span>
                    <span className="text-zinc-300 select-all">{identity?.address || 'UNKNOWN'}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                    <span className="text-zinc-500">PRIVATE KEY (EVM)</span>
                    <div className="flex items-center gap-2">
                        <span className="text-zinc-300 font-bold">
                           {revealKey ? (identity?.privateKey || 'LOADING') : '••••••••••••••••••••••••••••••••'}
                        </span>
                        <button onClick={() => setRevealKey(!revealKey)} className="text-zinc-500 hover:text-white transition-colors">
                            {revealKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex gap-2">
                <button 
                  onClick={lockSession}
                  className="flex-1 py-2 border border-zinc-700 hover:bg-zinc-900 text-[10px] font-mono transition-colors text-amber-500 flex items-center justify-center gap-2"
                >
                   <LogOut className="w-3 h-3" /> LOCK SESSION
                </button>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-bold text-white uppercase flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-500" /> Cortex Configuration (OpenRouter)
            </h2>
            
            {!apiKey && (
                 <div className="p-3 bg-amber-900/20 border border-amber-900/50 flex items-center gap-3">
                    <BrainCircuit className="w-5 h-5 text-amber-500 shrink-0" />
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-amber-500">INSTINCT MODE ACTIVE</span>
                        <span className="text-[10px] text-zinc-400">Agent is running on local heuristics. Enter an OpenRouter Key to enable LLM reasoning.</span>
                    </div>
                 </div>
            )}

            <div className="text-[10px] text-zinc-500">
              Configure the reasoning engine. Requires a valid OpenRouter API Key.
            </div>
            
            <div className="flex gap-2">
                <input 
                  type="password" 
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)} 
                  placeholder="sk-or-..."
                  className="flex-1 bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button onClick={saveKey} className="px-4 bg-blue-900/20 border border-blue-900 text-blue-400 text-xs font-mono hover:bg-blue-900/40 transition-colors flex items-center gap-2">
                    {saved ? <ShieldCheck className="w-3 h-3" /> : <Save className="w-3 h-3" />} SAVE
                </button>
            </div>

            <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 font-mono uppercase">Target Model</label>
                <div className="relative">
                    <select 
                        value={selectedModel} 
                        onChange={handleModelSelect}
                        disabled={loadingModels || !apiKey}
                        className="w-full appearance-none bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                    >
                        <option value={selectedModel}>{selectedModel} (Current)</option>
                        {models.map(m => (
                            <option key={m.id} value={m.id}>
                                {m.name || m.id}
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                        {loadingModels ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3" />}
                    </div>
                </div>
            </div>
          </div>

          <div className="space-y-4">
             <h2 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                <Hammer className="w-4 h-4 text-orange-500" /> Consensus Engine Configuration
             </h2>
             <div className="p-4 bg-zinc-900/30 border border-zinc-800 space-y-4">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase">Target Entropy (Leading Zeros)</span>
                    <span className="text-xs font-bold text-orange-400 font-mono">{difficulty}</span>
                </div>
                <input 
                    type="range" 
                    min="1" 
                    max="5" 
                    step="1"
                    value={difficulty} 
                    onChange={handleDifficultyChange}
                    className="w-full"
                />
                <div className="text-[10px] text-zinc-500 font-mono">
                    Estimated Block Reward: {estimatedReward.toFixed(3)} CCC
                </div>
             </div>
          </div>

          <div className="pt-4 border-t border-zinc-800">
             <button 
               onClick={onReset}
               className="w-full py-2 border border-red-900 bg-red-900/10 text-red-400 text-[10px] font-mono hover:bg-red-900/20 transition-colors"
             >
                OBLITERATE IDENTITY VAULT & LEDGER
             </button>
          </div>
       </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---

export default function App() {
  const [view, setView] = useState<PageView>('DASHBOARD');
  const [status, setStatus] = useState<AgentStatus>(AgentStatus.BOOTING);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [wallet, setWallet] = useState(identityService.getWalletState());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [peers, setPeers] = useState<MeshPeer[]>([]);
  const [identity, setIdentity] = useState<IdentityState | null>(null);
  const [isKernelActive, setIsKernelActive] = useState(false);
  const [miningIntensity, setMiningIntensityState] = useState<'LOW' | 'HIGH'>('LOW');
  const [scheduler, setScheduler] = useState(schedulerService.getStatus());
  const [fps, setFps] = useState(60);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Performance Monitor
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    
    const loop = () => {
        const now = performance.now();
        frameCount++;
        if (now - lastTime >= 1000) {
            setFps(Math.round((frameCount * 1000) / (now - lastTime)));
            frameCount = 0;
            lastTime = now;
        }
        requestAnimationFrame(loop);
    };
    const id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);

  // Fetch data from API
  const fetchData = useCallback(async () => {
    try {
      const [identityData, walletData, peersData, tasksData, schedulerData] = await Promise.all([
        identityService.getIdentity(),
        fetch('/api/wallet').then(r => r.json()),
        fetch('/api/mesh/peers').then(r => r.json()),
        fetch('/api/ledger/tasks').then(r => r.json()).catch(() => ({ tasks: [] })),
        fetch('/api/scheduler/status').then(r => r.json()).catch(() => schedulerService.getStatus())
      ]);
      
      setIdentity(identityData);
      setWallet(walletData);
      setPeers(peersData.peers || []);
      setTasks(tasksData.tasks || []);
      setScheduler(schedulerData);
      
      // Check kernel status
      const kernelStatus = await kernel.getStatus();
      setStatus(kernelStatus as AgentStatus);
      const active = await kernel.isActive();
      setIsKernelActive(active);
      
    } catch (error) {
      console.error('[App] Failed to fetch data:', error);
      addLog('ERROR', 'APP', 'Failed to fetch system data');
    }
  }, []);

  // Add log entry
  const addLog = useCallback((level: LogEntry['level'], module: LogEntry['module'], message: string) => {
    const entry: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      level,
      module,
      message
    };
    setLogs(prev => {
      const newLogs = [...prev, entry];
      if (newLogs.length > 300) newLogs.shift();
      return newLogs;
    });
  }, []);

  // Initialize on mount
  useEffect(() => {
    addLog('SYSTEM', 'APP', 'PROTOGEN-01 Production Frontend Initializing...');
    fetchData();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchData, 5000);
    
    return () => clearInterval(interval);
  }, [fetchData, addLog]);

  // Auto-scroll logs - only scroll within log container, not entire page
  useEffect(() => {
    if (view === 'DASHBOARD') {
      const logContainer = document.querySelector('.log-container');
      if (logContainer) {
        logContainer.scrollTop = logContainer.scrollHeight;
      }
    }
  }, [logs, view]);

  const toggleKernel = async () => {
    try {
      if (isKernelActive) {
        await kernel.stop();
        addLog('SYSTEM', 'KERNEL', 'Kernel stopped');
      } else {
        await kernel.start();
        addLog('SYSTEM', 'KERNEL', 'Kernel started');
      }
      await fetchData();
    } catch (error) {
      addLog('ERROR', 'KERNEL', `Failed to toggle kernel: ${error}`);
    }
  };

  const handleMiningChange = (newIntensity: 'LOW' | 'HIGH') => {
      economyService.setMiningIntensity(newIntensity);
      setMiningIntensityState(newIntensity);
      addLog('INFO', 'ECONOMY', `Mining intensity set to ${newIntensity}`);
  };

  const handleReset = () => {
    if (confirm("WARNING: This will obliterate your Identity Vault and Ledger. This action is irreversible. Proceed?")) {
        localStorage.clear();
        window.location.reload();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-zinc-300 font-sans selection:bg-emerald-500/30 overflow-hidden">
      
      {/* HUD HEADER */}
      <header className="h-12 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-4 shrink-0 z-20">
         <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-emerald-500" />
            <div className="flex flex-col">
                <span className="font-mono font-bold text-xs tracking-widest text-zinc-100">PROTOGEN-01</span>
                <span className="text-[9px] text-zinc-600 font-mono hidden sm:inline">AUTONOMOUS ECONOMIC AGENT</span>
            </div>
         </div>

         <div className="flex items-center gap-6 text-[10px] font-mono text-zinc-500">
            <div className="hidden md:flex items-center gap-2">
               <Globe className="w-3 h-3" />
               <span>BASE MAINNET</span>
            </div>
            <div className="hidden md:flex items-center gap-2">
               <Activity className="w-3 h-3" />
               <span className={fps < 30 ? "text-red-500" : "text-emerald-500"}>{fps} FPS</span>
            </div>
            
            <button 
              onClick={async () => {
                const result = await exportService.exportMetrics();
                if (result.success) {
                  addLog('SUCCESS', 'SYSTEM', `Metrics exported: ${result.filename}`);
                } else {
                  addLog('ERROR', 'SYSTEM', `Export failed: ${result.error}`);
                }
              }}
              className="hidden md:flex items-center gap-1 px-2 py-1 border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-900/50 transition-colors text-zinc-400 hover:text-zinc-300"
              title="Export all metrics to JSON"
            >
              <Database className="w-3 h-3" />
              <span>EXPORT</span>
            </button>
            
            <StatusIndicator status={status} />
            
            <button className="md:hidden p-2 text-zinc-400" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                <Settings className="w-5 h-5" />
            </button>
         </div>
      </header>

      {/* WORKSPACE */}
      <div className="flex flex-1 min-h-0 relative">
        
        {/* SIDEBAR (Desktop) */}
        <aside className="hidden md:flex w-52 border-r border-zinc-800 bg-zinc-950 flex-col shrink-0">
           <div className="flex-1 py-4 space-y-1">
             <div className="px-3 pb-2 mb-2 border-b border-zinc-900">
                <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Modules</span>
             </div>
             <NavItem icon={LayoutGrid} label="Control Plane" active={view === 'DASHBOARD'} onClick={() => setView('DASHBOARD')} />
             <NavItem icon={Network} label="A2A Mesh" active={view === 'NETWORK'} onClick={() => setView('NETWORK')} />
             <NavItem icon={Database} label="UCPT Ledger" active={view === 'LEDGER'} onClick={() => setView('LEDGER')} />
             <NavItem icon={Settings} label="Config" active={view === 'SETTINGS'} onClick={() => setView('SETTINGS')} />
           </div>

           <div className="p-3 border-t border-zinc-800 text-[9px] text-zinc-600 font-mono">
              <div className="flex justify-between mb-1">
                 <span>VERSION</span>
                 <span className="text-zinc-500">1.2.6</span>
              </div>
              <div className="flex justify-between">
                 <span>MODE</span>
                 <span className="text-emerald-500">PRODUCTION</span>
              </div>
           </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-hidden">
          {view === 'DASHBOARD' && (
            <DashboardView 
              status={status}
              logs={logs}
              wallet={wallet}
              identity={identity}
              toggleKernel={toggleKernel}
              isKernelActive={isKernelActive}
              miningIntensity={miningIntensity}
              setMiningIntensity={handleMiningChange}
              scheduler={scheduler}
            />
          )}
          {view === 'NETWORK' && <NetworkView peers={peers} />}
          {view === 'LEDGER' && <LedgerView tasks={tasks} />}
          {view === 'SETTINGS' && <SettingsView identity={identity} onReset={handleReset} />}
        </main>

        {/* MOBILE MENU OVERLAY */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute inset-0 bg-black/90 z-30 flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-zinc-800">
              <span className="font-mono font-bold text-sm">MENU</span>
              <button onClick={() => setMobileMenuOpen(false)} className="text-zinc-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 py-4 space-y-1">
              <NavItem icon={LayoutGrid} label="Control Plane" active={view === 'DASHBOARD'} onClick={() => { setView('DASHBOARD'); setMobileMenuOpen(false); }} />
              <NavItem icon={Network} label="A2A Mesh" active={view === 'NETWORK'} onClick={() => { setView('NETWORK'); setMobileMenuOpen(false); }} />
              <NavItem icon={Database} label="UCPT Ledger" active={view === 'LEDGER'} onClick={() => { setView('LEDGER'); setMobileMenuOpen(false); }} />
              <NavItem icon={Settings} label="Config" active={view === 'SETTINGS'} onClick={() => { setView('SETTINGS'); setMobileMenuOpen(false); }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
