import {
  Card,
  PageHeader,
  StatusPill,
} from "@/components/dashboard/DashboardPrimitives";
import { getDashboardData } from "@/lib/dashboard-data";

export default async function DashboardSettingsPage() {
  const { settings } = await getDashboardData();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Control policy"
        title="Settings"
        description="Current dashboard policy posture. Changes through the API are staged for operator review instead of silently mutating high-risk controls."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">
            Approval Mode
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {settings.approvalMode}
          </p>
          <div className="mt-4">
            <StatusPill tone="warning">human review retained</StatusPill>
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">
            Claim Integrity
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {settings.claimIntegrity}
          </p>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">
            Memory Policy
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {settings.memoryPolicy}
          </p>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">
            DEBO Unchained
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {settings.unchainedMode}
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">
          Strict Claim Domains
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {settings.strictDomains.map((domain) => (
            <StatusPill key={domain} tone="info">
              {domain}
            </StatusPill>
          ))}
        </div>
      </Card>
    </div>
  );
}
