import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { getDashboardData } from "@/lib/dashboard-data";

export default async function AgentsMarketingPage() {
  const { agents } = await getDashboardData();

  return (
    <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
      <p className="text-xs font-semibold uppercase text-emerald-300">
        Agent mesh
      </p>
      <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="max-w-3xl text-4xl font-semibold text-[var(--text-primary)]">
            DEBO keeps specialized DevBot lanes inside one governed workstation.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
            Each lane carries coverage, review posture, and guardrails so the
            buyer understands the control model before work expands.
          </p>
        </div>
        <Link
          href="/dashboard/agents"
          className="inline-flex items-center gap-2 rounded-md bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950"
        >
          Open Agent Console
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {agents.map((agent) => (
          <article
            key={agent.id}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                {agent.name}
              </h2>
              <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                {agent.status}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              {agent.role}
            </p>
            <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-primary)]">
                Guardrail:
              </span>{" "}
              {agent.guardrail}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
