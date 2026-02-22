'use client';

import React from 'react';
import { useDevBotStream } from '@/hooks/useDevBotStream';
import DevBotHeader from '@/components/dashboard/DevBotHeader';
import StreamLog from '@/components/dashboard/StreamLog';
import ActiveTasks from '@/components/dashboard/ActiveTasks';

export default function DashboardPage() {
  const { logs, status } = useDevBotStream('ws://localhost:8080');

  // Simple state machine for live data
  const connectionState = {
    connected: { color: 'green', text: 'ONLINE' },
    disconnected: { color: 'red', text: 'OFFLINE' },
    connecting: { color: 'yellow', text: 'CONNECTING...' }
  }[status] || { color: 'slate', text: 'UNKNOWN' };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30">
      <DevBotHeader status={status} />
      
      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        
        {/* Connection Status Banner (Only show if disconnected) */}
        {status !== 'connected' && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-lg flex items-center justify-center gap-2 animate-pulse">
            <span>⚠</span>
            <span>Disconnected from DevBot brain. Trying to reconnect...</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Feed: Live Stream */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <span>⚡ BRAIN ACTIVITY</span>
              </h2>
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-1 bg-slate-800 rounded text-slate-400">Filter: All</span>
                <button className="px-2 py-1 text-blue-400 hover:text-blue-300">Clear</button>
              </div>
            </div>
            
            <StreamLog logs={logs} />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
                <div className="text-2xl font-mono text-white mb-1">{logs.length}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">Events Processed</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
                <div className="text-2xl font-mono text-green-400 mb-1">
                  {logs.filter(l => l.type === 'task:completed').length}
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">Tasks Complete</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
                <div className="text-2xl font-mono text-blue-400 mb-1">
                  {logs.filter(l => l.type === 'task:started').length}
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">Tasks Started</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-blue-500/5" />
                <div className="text-2xl font-mono text-purple-400 mb-1">0ms</div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">Latency</div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive + Context */}
          <div className="space-y-6">
            <ActiveTasks logs={logs} />
            
            {/* Quick Actions / Portal */}
            <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">QUICK ACTIONS</h3>
              <div className="grid grid-cols-2 gap-2">
                <button className="bg-slate-800 hover:bg-slate-700 p-3 rounded text-xs text-left transition-colors border border-slate-700/50 hover:border-blue-500/30 group">
                  <div className="text-lg mb-1 group-hover:scale-110 transition-transform">📝</div>
                  <div className="text-slate-200 font-medium">New Task</div>
                  <div className="text-[10px] text-slate-500">Create manually</div>
                </button>
                <button className="bg-slate-800 hover:bg-slate-700 p-3 rounded text-xs text-left transition-colors border border-slate-700/50 hover:border-purple-500/30 group">
                  <div className="text-lg mb-1 group-hover:scale-110 transition-transform">🔎</div>
                  <div className="text-slate-200 font-medium">Inspect</div>
                  <div className="text-[10px] text-slate-500">View Memory</div>
                </button>
                <button className="bg-slate-800 hover:bg-slate-700 p-3 rounded text-xs text-left transition-colors border border-slate-700/50 hover:border-green-500/30 group">
                  <div className="text-lg mb-1 group-hover:scale-110 transition-transform">🔄</div>
                  <div className="text-slate-200 font-medium">Restart</div>
                  <div className="text-[10px] text-slate-500">Reset Brain</div>
                </button>
                <button className="bg-slate-800 hover:bg-slate-700 p-3 rounded text-xs text-left transition-colors border border-slate-700/50 hover:border-red-500/30 group">
                  <div className="text-lg mb-1 group-hover:scale-110 transition-transform">🛑</div>
                  <div className="text-slate-200 font-medium">Brake</div>
                  <div className="text-[10px] text-slate-500">Emergency Stop</div>
                </button>
              </div>
            </div>

            {/* System Health */}
            <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4 font-mono text-xs space-y-2">
              <h3 className="text-sm font-sans font-semibold text-slate-300 mb-2">SYSTEM STATUS</h3>
              <div className="flex justify-between">
                <span className="text-slate-500">Memory</span>
                <span className="text-green-400">14% 340MB</span>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded overflow-hidden">
                <div className="bg-green-500 h-full w-[14%]" />
              </div>
              
              <div className="flex justify-between pt-2">
                <span className="text-slate-500">Context</span>
                <span className="text-blue-400">4,203 Tokens</span>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded overflow-hidden">
                <div className="bg-blue-500 h-full w-[45%]" />
              </div>

              <div className="flex justify-between pt-2">
                <span className="text-slate-500">Rate Limit</span>
                <span className="text-yellow-400">850/1000</span>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded overflow-hidden">
                <div className="bg-yellow-500 h-full w-[85%]" />
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
