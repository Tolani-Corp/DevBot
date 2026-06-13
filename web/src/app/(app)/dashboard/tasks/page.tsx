import {
  Card,
  PageHeader,
  ProgressBar,
  StatusPill,
} from "@/components/dashboard/DashboardPrimitives";
import { getDashboardData } from "@/lib/dashboard-data";

const riskTone = {
  low: "positive",
  medium: "warning",
  high: "danger",
} as const;

export default async function TasksPage() {
  const { tasks } = await getDashboardData();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Execution lanes"
        title="Tasks"
        description="Governed work items with lane, owner, risk, progress, and the next operator action."
      />

      <div className="grid gap-4">
        {tasks.map((task) => (
          <Card key={task.id}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill tone="info">{task.lane}</StatusPill>
                  <StatusPill tone={riskTone[task.risk]}>
                    {task.risk} risk
                  </StatusPill>
                  <StatusPill>{task.status}</StatusPill>
                </div>
                <h2 className="mt-3 text-lg font-semibold text-zinc-950 dark:text-white">
                  {task.title}
                </h2>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Owner: {task.owner}
                </p>
              </div>
              <div className="w-full lg:w-72">
                <div className="mb-2 flex justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  <span>Progress</span>
                  <span>{task.progress}%</span>
                </div>
                <ProgressBar value={task.progress} />
              </div>
            </div>
            <p className="mt-4 rounded-md bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-300">
              {task.nextAction}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
