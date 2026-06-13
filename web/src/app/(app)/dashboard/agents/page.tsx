import {
  Card,
  PageHeader,
  StatusPill,
} from "@/components/dashboard/DashboardPrimitives";
import { getDashboardData } from "@/lib/dashboard-data";

const statusTone = {
  active: "positive",
  reviewed: "info",
  standby: "neutral",
} as const;

export default async function DashboardAgentsPage() {
  const { agents } = await getDashboardData();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Agent mesh"
        title="Agents"
        description="Specialized DevBot lanes operating inside the DEBO workstation with visible coverage and guardrails."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {agents.map((agent) => (
          <Card key={agent.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">
                  {agent.name}
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {agent.role}
                </p>
              </div>
              <StatusPill tone={statusTone[agent.status]}>
                {agent.status}
              </StatusPill>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div>
                <dt className="font-semibold text-zinc-950 dark:text-white">
                  Coverage
                </dt>
                <dd className="mt-1 text-zinc-600 dark:text-zinc-400">
                  {agent.coverage}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-zinc-950 dark:text-white">
                  Guardrail
                </dt>
                <dd className="mt-1 text-zinc-600 dark:text-zinc-400">
                  {agent.guardrail}
                </dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>
    </div>
  );
}
