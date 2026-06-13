import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { getDashboardData } from "@/lib/dashboard-data";

export default async function SettingsMarketingPage() {
  const { settings } = await getDashboardData();

  return (
    <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
      <p className="text-xs font-semibold uppercase text-emerald-300">
        Control model
      </p>
      <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="max-w-3xl text-4xl font-semibold text-[var(--text-primary)]">
            DEBO settings are governance controls, not cosmetic toggles.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
            Approval mode, memory behavior, claim integrity, and Unchained
            escalation stay explicit so operators know what can run and what
            needs review.
          </p>
        </div>
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-2 rounded-md bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950"
        >
          Open Settings
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {[
          ["Approval mode", settings.approvalMode],
          ["Claim integrity", settings.claimIntegrity],
          ["Memory policy", settings.memoryPolicy],
          ["DEBO Unchained", settings.unchainedMode],
        ].map(([label, value]) => (
          <article
            key={label}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-5"
          >
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {label}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              {value}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
