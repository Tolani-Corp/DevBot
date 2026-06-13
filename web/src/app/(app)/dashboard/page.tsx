import {
  Card,
  PageHeader,
  StatGrid,
  StatusPill,
} from "@/components/dashboard/DashboardPrimitives";
import { getDashboardData } from "@/lib/dashboard-data";

const toneMap = {
  positive: "positive",
  info: "info",
  warning: "warning",
  danger: "danger",
} as const;

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="DEBO command"
        title="Overview"
        description="Live governance posture for request-to-PR work, delivery evidence, claim integrity, and reviewed escalation."
      />

      <StatGrid stats={data.overview.stats} />

      <section>
        <h2 className="text-lg font-medium text-zinc-950 dark:text-white">
          Commercial Readiness Evidence
        </h2>
        <div className="mt-4 space-y-3">
          {data.overview.activity.map((event) => (
            <Card key={event.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                {event.message}
              </p>
              <StatusPill tone={toneMap[event.tone]}>{event.time}</StatusPill>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
