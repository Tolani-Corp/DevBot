import React from 'react';
import { LogMessage } from '@/hooks/useDevBotStream';

const StreamLog = ({ logs }: { logs: LogMessage[] }) => {
  return (
    <div className="flex-1 bg-slate-950/50 rounded-lg border border-slate-800 flex flex-col h-[500px] overflow-hidden">
      <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
        <span className="text-xs font-mono text-slate-400">LIVE RELAY</span>
        <span className="text-[10px] text-emerald-500 animate-pulse">● LIVE</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs scrollbar-thin scrollbar-thumb-slate-700 font-terminal">
        {logs.length === 0 && (
          <div className="text-slate-600 italic text-center py-10">Waiting for DevBot activity...</div>
        )}
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200">
            <span className="text-slate-600 min-w-[70px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
            {log.type === 'task:started' && (
              <div className="text-yellow-400">
                <span className="mr-2">⚡</span>
                Started Task: {log.data?.id || 'Unknown'} - {log.data?.description || JSON.stringify(log.data)}
              </div>
            )}
            {log.type === 'task:completed' && (
              <div className="text-green-400">
                <span className="mr-2">✅</span>
                Completed: {log.data?.taskId || 'Unknown'}
              </div>
            )}
            {log.type === 'log' && (
              <div className="text-slate-300">
                <span className="text-blue-500 mr-2">ℹ️</span>
                {log.message || JSON.stringify(log.data)}
              </div>
            )}
            {log.type === 'connected' && (
              <div className="text-cyan-400 font-bold">
                {log.message}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StreamLog;
