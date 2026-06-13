import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { getDashboardData } from "@/lib/dashboard-data";

export default async function DeploymentsMarketingPage() {
  const { deployments } = await getDashboardData();

  return (
    <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
      <p className="text-xs font-semibold uppercase text-emerald-300">
        Release posture
      </p>
      <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="max-w-3xl text-4xl font-semibold text-[var(--text-primary)]">
            Deployment intent, provenance, and rollback proof stay visible.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
            DEBO does not treat release as a black box. The dashboard exposes
            the workflow, environment, review state, and rollback expectation.
          </p>
        </div>
        <Link
          href="/dashboard/evidence"
          className="inline-flex items-center gap-2 rounded-md bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950"
        >
          Inspect Evidence
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {deployments.map((deployment) => (
          <article
            key={deployment.id}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                {deployment.environment}
              </h2>
              <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                {deployment.status}
              </span>
            </div>
            <p className="mt-3 break-all font-mono text-xs text-[var(--text-secondary)]">
              {deployment.workflow}
            </p>
            <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
              {deployment.provenance}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
