import React from 'react';

const DevBotHeader = ({ status }: { status: string }) => {
  return (
    <header className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-900 border-slate-800">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🤖</span>
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">DevBot Command Center</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 text-sm px-3 py-1 rounded-full border ${
          status === 'connected' 
            ? 'border-green-500/30 bg-green-500/10 text-green-400' 
            : 'border-red-500/30 bg-red-500/10 text-red-400'
        }`}>
          <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          {status.toUpperCase()}
        </div>
      </div>
    </header>
  );
};

export default DevBotHeader;
