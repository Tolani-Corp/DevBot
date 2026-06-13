import {
  Card,
  PageHeader,
  ProgressBar,
  StatusPill,
} from "@/components/dashboard/DashboardPrimitives";
import { getDashboardData } from "@/lib/dashboard-data";

const checkpointTone = {
  complete: "positive",
  active: "info",
  review: "warning",
} as const;

const terminalTone = {
  success: "text-emerald-600 dark:text-emerald-300",
  info: "text-cyan-600 dark:text-cyan-300",
  warning: "text-amber-600 dark:text-amber-300",
} as const;

export default async function LearningPage() {
  const { learning } = await getDashboardData();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tolani Labs student mode"
        title="Student Learning"
        description="Guided learner journey with terminal feedback, evidence checkpoints, and mentor review before execution escalates."
      />

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="bg-zinc-950 text-zinc-100 dark:bg-black">
          <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-emerald-300">
                Learning terminal
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                {learning.learner.journey}
              </h2>
            </div>
            <StatusPill tone="positive">guided</StatusPill>
          </div>

          <div className="mt-5 space-y-4 font-mono text-sm">
            {learning.terminal.map((line, index) => (
              <div key={line.prompt}>
                <p className="text-emerald-300">
                  <span className="text-zinc-500">student@debo</span>{" "}
                  <span className="text-emerald-300">$</span> {line.prompt}
                  {index === learning.terminal.length - 1 ? (
                    <span className="debo-terminal-cursor ml-2 h-4 w-1.5" />
                  ) : null}
                </p>
                <p className={`mt-1 pl-4 ${terminalTone[line.tone]}`}>
                  {line.output}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">
              {learning.learner.name}
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {learning.learner.cohort}
            </p>
            <div className="mt-5">
              <div className="mb-2 flex justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <span>Journey progress</span>
                <span>{learning.learner.progress}%</span>
              </div>
              <ProgressBar value={learning.learner.progress} />
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">
              Mentor Review
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-semibold text-zinc-950 dark:text-white">
                  Owner
                </dt>
                <dd className="mt-1 text-zinc-600 dark:text-zinc-400">
                  {learning.review.owner}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-zinc-950 dark:text-white">
                  Next action
                </dt>
                <dd className="mt-1 text-zinc-600 dark:text-zinc-400">
                  {learning.review.nextAction}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-zinc-950 dark:text-white">
                  Guardrail
                </dt>
                <dd className="mt-1 text-zinc-600 dark:text-zinc-400">
                  {learning.review.guardrail}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {learning.checkpoints.map((checkpoint) => (
          <Card key={checkpoint.label}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold text-zinc-950 dark:text-white">
                {checkpoint.label}
              </h2>
              <StatusPill tone={checkpointTone[checkpoint.status]}>
                {checkpoint.status}
              </StatusPill>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {checkpoint.detail}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
