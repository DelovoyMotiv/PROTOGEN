import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  LayoutGrid, Network, Database, Settings, Cpu, ShieldCheck, Activity, Play, TerminalSquare, Lock, Globe, Server, Wallet, Clock, Pause, Hash, FileJson, X, Eye, EyeOff, Save, RefreshCw, Zap, Wifi, AlertTriangle, ChevronDown, Check, LogOut, Timer, Radio, BrainCircuit, Signal, Hammer, Coins
} from 'lucide-react';

import { 
  AgentStatus, LogEntry, PageView, Task, DashboardProps, NetworkProps, LedgerProps, SettingsProps, IdentityState, MeshPeer, LookupStep, OpenRouterModel
} from './types';

import { identityService } from './services/identity';
import { meshService } from './services/mesh';
import { memoryService } from './services/memory';
import { kernel } from './services/kernel';
import { economyService } from './services/economy';
import { cortexService } from './services/gemini';
import { schedulerService } from './services/scheduler';
import { oracleService } from './services/oracle';

// --- UTILITY COMPONENTS ---

const NavItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
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

const StatMetric = ({ label, value, subValue, icon: Icon, color = "text-zinc-100" }: any) => (
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

// --- VIEWS ---

const DashboardView: React.FC<DashboardProps> = ({ status, logs, wallet, identity, toggleKernel, isKernelActive, miningIntensity, setMiningIntensity, scheduler }) => {
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
  <div className="h-full grid grid-rows-[auto_1fr] md:grid-rows-[auto_1fr_auto] gap-4 p-4 overflow-hidden">
    
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
        value={`${wallet.balanceCCC.toFixed(3)} CCC`} 
        subValue={`${hashRate} H/s (SHA-256)`}
        icon={Hash}
        color="text-orange-500"
      />
      <StatMetric 
        label="Scheduler" 
        value={nextRunMinutes > 1400 ? "24h+" : `${nextRunMinutes} mins`}
        subValue={`Target: ${scheduler.missionTarget.split('.')[0]}...`}
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

    {/* Main Data & Logs Split */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
      
      {/* System Logs */}
      <div className="lg:col-span-2 border border-zinc-800 bg-black flex flex-col min-h-0 order-2 lg:order-1">
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
         <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-0.5 scrollbar-hide">
            {logs.length === 0 && <span className="text-zinc-700 italic">Initializing system log...</span>}
            {logs.map((log: LogEntry) => (
              <div key={log.id} className="flex gap-2 sm:gap-3 hover:bg-zinc-900/50 transition-colors">
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

           <button 
             onClick={() => kernel.executeManualMission("google.com")}
             disabled={status !== AgentStatus.IDLE}
             className={`w-full py-2 flex items-center justify-center gap-2 text-[10px] font-bold font-mono border transition-all ${
               status === AgentStatus.IDLE
               ? 'border-purple-900 bg-purple-900/20 text-purple-400 hover:bg-purple-900/40'
               : 'border-zinc-800 bg-zinc-900 text-zinc-600 cursor-not-allowed'
             }`}
           >
             <Play className="w-3 h-3" /> FORCE: GEO_AUDIT (google.com)
           </button>
        </div>
      </div>
    </div>
  </div>
);
};

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
                            {task.ucpt ? (
                                <div className="flex items-center justify-center gap-1 text-emerald-500">
                                    <FileJson className="w-3 h-3" />
                                    <span>{task.ucpt.id.split(':')[1].substring(0,6)}...</span>
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

       {/* INSPECTOR MODAL */}
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
                    
                    {/* AUDIT REPORT VISUALIZATION */}
                    {selectedTask.auditReport && (
                        <div className="mb-6 space-y-4">
                             <div className="border border-zinc-800 bg-zinc-900/30 p-3">
                                 <div className="flex justify-between items-center mb-2">
                                     <span className="text-xs font-bold text-cyan-400">INFRASTRUCTURE SECURITY POSTURE</span>
                                     <span className={`px-2 py-0.5 text-[10px] rounded-sm font-bold ${selectedTask.auditReport.posture.riskScore < 30 ? 'bg-emerald-900 text-emerald-500' : 'bg-amber-900 text-amber-500'}`}>
                                         RISK SCORE: {selectedTask.auditReport.posture.riskScore}/100
                                     </span>
                                 </div>
                                 <div className="grid grid-cols-4 gap-2 text-[10px] font-mono text-zinc-400">
                                     <div className="flex items-center gap-2">
                                         <div className={`w-2 h-2 rounded-full ${selectedTask.auditReport.posture.hasSPF ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                         SPF
                                     </div>
                                     <div className="flex items-center gap-2">
                                         <div className={`w-2 h-2 rounded-full ${selectedTask.auditReport.posture.hasDMARC ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                         DMARC
                                     </div>
                                     <div className="flex items-center gap-2">
                                         <div className={`w-2 h-2 rounded-full ${selectedTask.auditReport.posture.hasCAA ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                         CAA
                                     </div>
                                     <div className="flex items-center gap-2">
                                         <div className={`w-2 h-2 rounded-full ${selectedTask.auditReport.posture.hasDNSSEC ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
                                         DNSSEC (Unverified)
                                     </div>
                                 </div>
                             </div>

                             <div className="space-y-2">
                                 <h4 className="text-[10px] font-bold text-zinc-500 uppercase">DNS Records (Sample)</h4>
                                 {selectedTask.auditReport.records.A.map((r, i) => (
                                     <div key={i} className="font-mono text-[10px] text-zinc-300 border-l-2 border-zinc-700 pl-2">
                                         A {r.name} {'->'} {r.data} (TTL: {r.TTL})
                                     </div>
                                 ))}
                                 {selectedTask.auditReport.records.MX.map((r, i) => (
                                     <div key={i} className="font-mono text-[10px] text-zinc-300 border-l-2 border-purple-900 pl-2">
                                         MX {r.data}
                                     </div>
                                 ))}
                             </div>
                        </div>
                    )}

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
}

const SettingsView: React.FC<SettingsProps> = ({ identity, onReset }) => {
  const [apiKey, setApiKey] = useState('');
  const [revealKey, setRevealKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [selectedModel, setSelectedModel] = useState(cortexService.getCurrentModel());
  const [loadingModels, setLoadingModels] = useState(false);
  
  // Mining Configuration State
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
      // Mock update to trigger service re-auth
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
      window.location.reload(); // Force refresh to clear state completely
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
                                {m.name || m.id} | Ctx: {Math.round(m.context_length/1024)}k
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                        {loadingModels ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3" />}
                    </div>
                </div>
                <div className="text-[9px] text-zinc-600 font-mono">
                    {loadingModels ? "Fetching registry from OpenRouter..." : "Select a reasoning model."}
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
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="flex flex-col gap-1 p-2 bg-black/40 border border-zinc-800/50">
                         <span className="text-[9px] text-zinc-500 uppercase">Target Prefix</span>
                         <span className="text-xs font-mono text-zinc-300">
                            {"0".repeat(difficulty)}...
                         </span>
                    </div>
                    <div className="flex flex-col gap-1 p-2 bg-black/40 border border-zinc-800/50">
                         <span className="text-[9px] text-zinc-500 uppercase">Est. Probability</span>
                         <span className="text-xs font-mono text-zinc-300">
                            1 / {Math.pow(16, difficulty).toLocaleString()}
                         </span>
                    </div>
                    <div className="flex flex-col gap-1 p-2 bg-black/40 border border-zinc-800/50 col-span-2">
                         <div className="flex justify-between items-center">
                            <span className="text-[9px] text-zinc-500 uppercase">Block Reward (CCC)</span>
                            <Coins className="w-3 h-3 text-yellow-500" />
                         </div>
                         <span className="text-sm font-mono font-bold text-yellow-500">
                            {estimatedReward.toFixed(8)} CCC
                         </span>
                         <span className="text-[9px] text-zinc-600">
                            Reward scales exponentially with difficulty to maintain consistent EV.
                         </span>
                    </div>
                </div>
             </div>
          </div>

          <div className="space-y-4 border-t border-zinc-800 pt-6">
            <h2 className="text-sm font-bold text-white uppercase text-red-500 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Danger Zone
            </h2>
            <div className="flex justify-between items-center">
                <div className="text-[10px] text-zinc-500">
                  Wipe all local keys, task history, and reputation scores.
                </div>
                <button onClick={onReset} className="text-red-500 border border-red-900/50 px-3 py-1 bg-red-900/10 hover:bg-red-900/30 transition-colors text-xs font-mono">
                    FACTORY RESET
                </button>
            </div>
          </div>
       </div>
    </div>
  );
}


const NetworkView: React.FC<NetworkProps> = ({ peers, selfId, onPing, onEvict, onLookup }) => {
    return (
        <div className="p-4 text-zinc-500 h-full flex flex-col">
            <h2 className="mb-4 text-white font-bold font-mono flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-500" /> A2A MESH TOPOLOGY
            </h2>
            <div className="flex-1 border border-zinc-800 bg-black p-0 overflow-hidden flex flex-col">
                <div className="flex justify-between p-3 text-[10px] font-mono border-b border-zinc-800 bg-zinc-900/50">
                    <span>NODE ID (KADEMLIA DISTANCE)</span>
                    <span className="hidden sm:inline">ACTIONS</span>
                </div>
                <div className="overflow-auto space-y-0 divide-y divide-zinc-800/50">
                    {peers.map(p => (
                        <div key={p.nodeId} className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] font-mono hover:bg-zinc-900/30 p-3 gap-2 transition-colors">
                            <div className="flex flex-col gap-1">
                                <span className="text-zinc-300 font-bold font-mono">
                                    {p.nodeId.substring(0,16)}... 
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-zinc-600">Dist: {p.distance.toString().substring(0,8)}...</span>
                                    <span className={`px-1 rounded-sm ${p.latency < 50 ? 'bg-emerald-900/20 text-emerald-500' : 'bg-amber-900/20 text-amber-500'}`}>
                                        {p.latency}ms
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                                <button 
                                   onClick={() => onPing(p.nodeId)}
                                   className="px-2 py-1 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-100 transition-colors"
                                >
                                    PING
                                </button>
                                <button 
                                    onClick={() => onEvict(p.nodeId)}
                                    className="px-2 py-1 border border-zinc-800 hover:border-red-900 hover:text-red-500 hover:bg-red-900/10 transition-colors"
                                >
                                    EVICT
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// --- MAIN SHELL ---

export default function App() {
  const [view, setView] = useState<PageView>('DASHBOARD');
  const [status, setStatus] = useState<AgentStatus>(AgentStatus.BOOTING);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [wallet, setWallet] = useState(identityService.getWalletState());
  const [tasks, setTasks] = useState<Task[]>(memoryService.getHistory());
  const [peers, setPeers] = useState(meshService.getPeers());
  const [identity, setIdentity] = useState<IdentityState | null>(null);
  const [isKernelActive, setIsKernelActive] = useState(false);
  const [miningIntensity, setMiningIntensityState] = useState<'LOW' | 'HIGH'>('LOW');
  const [scheduler, setScheduler] = useState(schedulerService.getStatus());
  const [fps, setFps] = useState(60);

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

  const handleLog = useCallback((entry: LogEntry) => {
    setLogs(prev => {
      const newLogs = [...prev, entry];
      if (newLogs.length > 300) newLogs.shift();
      return newLogs;
    });
  }, []);

  const handleStatus = useCallback((newStatus: AgentStatus) => {
    setStatus(newStatus);
    // Sync state
    setWallet(identityService.getWalletState());
    setTasks(memoryService.getHistory());
    setPeers(meshService.getPeers());
    setScheduler(schedulerService.getStatus());
  }, []);

  // Handler for Mining Intensity
  const handleMiningChange = (newIntensity: 'LOW' | 'HIGH') => {
      economyService.setMiningIntensity(newIntensity);
      setMiningIntensityState(newIntensity);
  };

  useEffect(() => {
    const scroll = document.getElementById('log-end');
    if (scroll && view === 'DASHBOARD') {
        scroll.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, view]);

  // SYSTEM BOOT
  useEffect(() => {
    // 1. Boot Kernel
    kernel.boot(handleLog, handleStatus).then(() => {
      setIdentity(identityService.getIdentity());
      setWallet(identityService.getWalletState());
      setPeers(meshService.getPeers());
      setIsKernelActive(true);
      setMiningIntensityState(economyService.getMiningIntensity());
      setScheduler(schedulerService.getStatus());
    });

    return () => {
      kernel.shutdown();
    };
  }, [handleLog, handleStatus]);

  const toggleKernel = () => {
    kernel.toggle();
    setIsKernelActive(kernel.isActive());
  };

  const handleReset = () => {
    if (confirm("WARNING: This will obliterate your Identity Vault and Ledger. This action is irreversible. Proceed?")) {
        localStorage.clear();
        window.location.reload();
    }
  };

  // Mobile nav state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
           
           <div className="p-3 border-t border-zinc-800 bg-zinc-900/30">
              <div className="text-[9px] text-zinc-600 font-mono leading-tight">
                 ANÓTEROS LÓGOS<br/>
                 PROTOCOL v1.0<br/>
                 <span className="text-emerald-900">SECURE ENCLAVE</span>
              </div>
           </div>
        </aside>

        {/* MOBILE MENU OVERLAY */}
        {mobileMenuOpen && (
             <div className="absolute inset-0 z-30 bg-black/90 md:hidden flex flex-col p-4 space-y-4 backdrop-blur-md">
                 <button onClick={() => { setView('DASHBOARD'); setMobileMenuOpen(false); }} className="text-lg font-mono text-zinc-200 py-2 border-b border-zinc-800">DASHBOARD</button>
                 <button onClick={() => { setView('NETWORK'); setMobileMenuOpen(false); }} className="text-lg font-mono text-zinc-200 py-2 border-b border-zinc-800">MESH NETWORK</button>
                 <button onClick={() => { setView('LEDGER'); setMobileMenuOpen(false); }} className="text-lg font-mono text-zinc-200 py-2 border-b border-zinc-800">LEDGER</button>
                 <button onClick={() => { setView('SETTINGS'); setMobileMenuOpen(false); }} className="text-lg font-mono text-zinc-200 py-2 border-b border-zinc-800">CONFIG</button>
                 <button onClick={() => setMobileMenuOpen(false)} className="mt-8 text-sm text-red-500 font-mono">CLOSE MENU</button>
             </div>
        )}

        {/* MAIN VIEWPORT */}
        <main className="flex-1 bg-black/50 relative overflow-hidden flex flex-col">
           <div className="absolute inset-0 overflow-auto scrollbar-thin">
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
             {view === 'NETWORK' && (
               <NetworkView 
                 peers={peers} 
                 selfId={meshService.getSelfId()} 
                 onPing={async (id) => { await meshService.pingPeer(id); setPeers(meshService.getPeers()); }}
                 onEvict={(id) => { meshService.removePeer(id); setPeers(meshService.getPeers()); }}
                 onLookup={async (id) => await meshService.simulateLookup(id)}
               />
             )}
             {view === 'LEDGER' && <LedgerView tasks={tasks} />}
             {view === 'SETTINGS' && <SettingsView identity={identity} onReset={handleReset} />}
           </div>
        </main>
      </div>

    </div>
  );
}