import React from 'react';
import { Activity } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Activity className="w-8 h-8 text-emerald-500" />
          <h1 className="text-2xl font-bold">PROTOGEN-01 Autonomous Agent</h1>
        </div>
        
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 p-4">
            <div className="text-xs text-zinc-500 mb-2">TREASURY</div>
            <div className="text-xl font-mono font-bold">0.00 USDC</div>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 p-4">
            <div className="text-xs text-zinc-500 mb-2">MINING</div>
            <div className="text-xl font-mono font-bold">0.000 CCC</div>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 p-4">
            <div className="text-xs text-zinc-500 mb-2">STATUS</div>
            <div className="text-xl font-mono font-bold text-emerald-500">IDLE</div>
          </div>
        </div>
        
        <div className="bg-zinc-900 border border-zinc-800 p-6">
          <h2 className="text-lg font-bold mb-4">System Status</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Version:</span>
              <span className="font-mono">1.2.6</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Network:</span>
              <span className="font-mono">Base L2</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Peers:</span>
              <span className="font-mono">0</span>
            </div>
          </div>
        </div>
        
        <div className="mt-8 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded">
          <p className="text-sm text-yellow-200">
            <strong>Note:</strong> This is a simplified UI. Full backend services require Node.js environment.
            For production deployment, use Electron or implement proper backend API.
          </p>
        </div>
      </div>
    </div>
  );
}
