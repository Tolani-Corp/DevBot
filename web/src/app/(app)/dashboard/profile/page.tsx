import {
  Card,
  PageHeader,
  StatusPill,
} from "@/components/dashboard/DashboardPrimitives";
import { getDashboardData } from "@/lib/dashboard-data";

export default async function ProfilePage() {
  const { profile } = await getDashboardData();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operator profile"
        title="Profile"
        description="Workspace identity used for local dashboard ownership and review posture."
      />

      <Card>
        <dl className="grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Name
            </dt>
            <dd className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">
              {profile.name}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Organization
            </dt>
            <dd className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">
              {profile.organization}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Role
            </dt>
            <dd className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">
              {profile.role}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Contact
            </dt>
            <dd className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">
              {profile.contact}
            </dd>
          </div>
        </dl>
        <div className="mt-6">
          <StatusPill tone="positive">local workstation profile</StatusPill>
        </div>
      </Card>
    </div>
  );
}
