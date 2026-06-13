import {
  Card,
  PageHeader,
  StatusPill,
} from "@/components/dashboard/DashboardPrimitives";
import { getDashboardData } from "@/lib/dashboard-data";

const statusTone = {
  ready: "positive",
  review: "warning",
  blocked: "danger",
} as const;

export default async function DashboardDeploymentsPage() {
  const { deployments } = await getDashboardData();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Release controls"
        title="Deployments"
        description="Deployment intent records with workflow, environment, provenance, and rollback expectations."
      />

      <div className="grid gap-4">
        {deployments.map((deployment) => (
          <Card key={deployment.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold capitalize text-zinc-950 dark:text-white">
                  {deployment.environment}
                </h2>
                <p className="mt-2 break-all font-mono text-xs text-zinc-500 dark:text-zinc-400">
                  {deployment.workflow}
                </p>
              </div>
              <StatusPill tone={statusTone[deployment.status]}>
                {deployment.status}
              </StatusPill>
            </div>
            <dl className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <dt className="text-sm font-semibold text-zinc-950 dark:text-white">
                  Provenance
                </dt>
                <dd className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {deployment.provenance}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-zinc-950 dark:text-white">
                  Rollback
                </dt>
                <dd className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {deployment.rollback}
                </dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>
    </div>
  );
}
