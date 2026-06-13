import type { LogMessage } from "@/hooks/useDevBotStream";
import { useEffect, useState } from "react";

const ActiveTasks = ({ logs }: { logs: LogMessage[] }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const completedIds = new Set(
    logs
      .filter((log) => log.type === "task:completed")
      .map((log) => log.data?.taskId ?? log.data?.id)
      .filter(Boolean),
  );

  const activeTasks = logs
    .filter((log) => log.type === "task:started")
    .filter((log) => !completedIds.has(log.data?.taskId ?? log.data?.id))
    .slice(0, 5);

  const formatAge = (timestamp: string) => {
    const elapsed = now - new Date(timestamp).getTime();
    if (!Number.isFinite(elapsed) || elapsed < 60000) return "under 1m";
    return `${Math.floor(elapsed / 60000)}m`;
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
        <span>ACTIVE TASKS</span>
        <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] text-blue-400">
          {activeTasks.length}
        </span>
      </h3>

      <div className="space-y-3">
        {activeTasks.length === 0 ? (
          <div className="text-xs italic text-slate-600">
            No active task starts are open in the stream.
          </div>
        ) : (
          activeTasks.map((task, index) => (
            <div
              key={`${task.data?.id ?? task.timestamp}-${index}`}
              className="group relative overflow-hidden rounded border border-slate-800 bg-slate-950 p-3"
            >
              <div className="absolute left-0 top-0 h-full w-1 bg-blue-500" />
              <div className="mb-1 flex items-start justify-between">
                <span className="font-mono text-xs text-blue-400">
                  TASK-{task.data?.id?.slice(0, 6) ?? "queue"}
                </span>
                <span className="text-[10px] text-slate-500">
                  {formatAge(task.timestamp)}
                </span>
              </div>
              <p className="line-clamp-2 text-sm text-slate-200">
                {task.data?.description || "Processing governed request..."}
              </p>

              <div className="mt-3 flex gap-2">
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                  Agent: Orchestrator
                </span>
                <span className="animate-pulse rounded bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-400">
                  Running
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActiveTasks;
