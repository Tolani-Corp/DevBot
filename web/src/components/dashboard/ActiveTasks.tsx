import React from 'react';

// Mock active tasks based on stream data if real persistence isn't hooked up yet
const ActiveTasks = ({ logs }: { logs: any[] }) => {
  // Infer active state from logs (simple implementation for now)
  // In a real implementation, we'd fetch this from the API
  const activeTasks = logs.filter(l => l.type === 'task:started').slice(0, 3);

  return (
    <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
        <span>ACTIVE TASKS</span>
        <span className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded-full">{activeTasks.length}</span>
      </h3>
      
      <div className="space-y-3">
        {activeTasks.length === 0 ? (
          <div className="text-slate-600 text-xs italic">No active tasks detected in stream.</div>
        ) : (
          activeTasks.map((task, i) => (
            <div key={i} className="bg-slate-950 p-3 rounded border border-slate-800 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-mono text-blue-400">TASK-{task.data?.id?.substring(0,6)}</span>
                <span className="text-[10px] text-slate-500">Just now</span>
              </div>
              <p className="text-sm text-slate-200 line-clamp-2">{task.data?.description || 'Processing request...'}</p>
              
              <div className="mt-3 flex gap-2">
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">Agent: Orchestrator</span>
                <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded animate-pulse">Running</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActiveTasks;
