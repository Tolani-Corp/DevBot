import {
  Card,
  PageHeader,
  StatusPill,
} from "@/components/dashboard/DashboardPrimitives";
import { getDashboardData } from "@/lib/dashboard-data";

const statusTone = {
  verified: "positive",
  required: "warning",
  review: "info",
} as const;

export default async function EvidencePage() {
  const { evidence } = await getDashboardData();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Proof packet"
        title="Evidence"
        description="Curated governance references, hashes, policies, and manifests used to support release and customer-facing claims."
      />

      <div className="grid gap-4">
        {evidence.map((item) => (
          <Card key={item.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
                  {item.label}
                </h2>
                <p className="mt-1 break-all font-mono text-xs text-zinc-500 dark:text-zinc-400">
                  {item.path}
                </p>
                {item.digest ? (
                  <p className="mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    sha256: {item.digest}
                  </p>
                ) : null}
              </div>
              <StatusPill tone={statusTone[item.status]}>
                {item.status}
              </StatusPill>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
