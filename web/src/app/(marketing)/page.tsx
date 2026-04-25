"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  BoltIcon,
  CheckCircleIcon,
  CommandLineIcon,
  CpuChipIcon,
  FireIcon,
  ShieldCheckIcon,
  SparklesIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";

type ModeId = "intake" | "build" | "review" | "teach";

const modes: {
  id: ModeId;
  label: string;
  title: string;
  body: string;
  checkpoint: string;
  status: string;
  score: number;
}[] = [
  {
    id: "intake",
    label: "Intake",
    title: "Request intake with scope and guardrails",
    body: "Tag DevBot with a request and it opens a governed work item instead of a loose chat thread.",
    checkpoint: "Request normalized into a task, owner, and approval lane.",
    status: "Ready for triage",
    score: 91,
  },
  {
    id: "build",
    label: "Build",
    title: "Execute the smallest safe change",
    body: "DevBot keeps a short operating memory, pushes one bounded patch, and keeps the blast radius visible.",
    checkpoint: "Workspace is in a narrow build lane with change scope pinned.",
    status: "Patch lane active",
    score: 94,
  },
  {
    id: "review",
    label: "Review",
    title: "Present evidence before anything ships",
    body: "Every change carries policy checks, memory provenance, and a reviewer-facing summary.",
    checkpoint: "Human approval required before merge or deployment.",
    status: "Approval gate engaged",
    score: 96,
  },
  {
    id: "teach",
    label: "Teach",
    title: "Capture correction without creating chaos",
    body: "If a reviewer rejects, DevBot can learn the correction only when the operator explicitly teaches it.",
    checkpoint: "Correction routed into durable memory with consent.",
    status: "Teach mode armed",
    score: 89,
  },
];

const operationalSignals = [
  {
    label: "Approval posture",
    value: "Human-in-the-loop",
    detail: "Risky steps pause until a reviewer clears them.",
  },
  {
    label: "Memory policy",
    value: "Conservative",
    detail: "Snapshots stay on, passive learning stays off by default.",
  },
  {
    label: "Pilot shape",
    value: "Request to PR",
    detail: "One narrow path from intake to an audited merge candidate.",
  },
];

const pilotPlan = [
  {
    icon: CommandLineIcon,
    title: "Start in one workflow",
    body: "Pick a single request flow, wire in the task lane, and keep the human approvals visible.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Prove the governance story",
    body: "Show that memory, review, and policy controls are explicit enough for platform owners.",
  },
  {
    icon: SparklesIcon,
    title: "Expand only after trust lands",
    body: "Move from DevBot into broader DEBO governance when the team wants fleet-level command.",
  },
];

function nextMode(current: ModeId): ModeId {
  const index = modes.findIndex((mode) => mode.id === current);
  return modes[(index + 1) % modes.length].id;
}

export default function Home() {
  const [modeId, setModeId] = useState<ModeId>("intake");
  const [pilotRequested, setPilotRequested] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 2400);

    return () => window.clearInterval(interval);
  }, []);

  const mode = useMemo(
    () => modes.find((item) => item.id === modeId) ?? modes[0],
    [modeId],
  );

  const activityFeed = useMemo(() => {
    const entries = [
      `Workspace pulse ${tick + 1}: ${mode.status.toLowerCase()}.`,
      "Guardrail summary compiled for reviewer consumption.",
      pilotRequested
        ? "Pilot request queued with pilot workspace metadata."
        : "Pilot CTA remains available for operator handoff.",
      `Current mode: ${mode.label}.`,
    ];

    return entries.map((message, index) => ({
      id: `${mode.id}-${index}`,
      message,
      tone: index === 0 ? "emerald" : index === 1 ? "cyan" : index === 2 ? "amber" : "slate",
    }));
  }, [mode, pilotRequested, tick]);

  const readiness = Math.min(100, mode.score + (tick % 4) * 2);

  return (
    <div className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.18),_transparent_22%),linear-gradient(180deg,_rgba(2,6,23,1),_rgba(8,15,32,1))]" />
      <div className="absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.08),_transparent_52%)] blur-3xl" />

      <section className="mx-auto max-w-7xl px-6 pb-12 pt-14 lg:px-8 lg:pb-16 lg:pt-20">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-300">
              Governed engineering workstation demo
            </div>

            <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-[-0.05em] text-[var(--text-primary)] sm:text-6xl lg:text-7xl">
              DevBot turns a request into a reviewable engineering lane.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--text-secondary)] sm:text-xl">
              This proof-of-concept surface shows the operator loop: intake, patch, review, and teach.
              It reads like a governed workstation, not a generic chatbot landing page.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                Open Pilot Console
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => setModeId((current) => nextMode(current))}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-cyan-300/40 hover:bg-white/5"
              >
                Cycle Work Mode
                <CommandLineIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPilotRequested(true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-amber-300/30 hover:bg-white/10"
              >
                Request Pilot
                <BoltIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                {pilotRequested ? "Pilot request queued" : "Pilot CTA ready"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                Live mode: {mode.label}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                Heartbeat: {tick + 1}
              </span>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {operationalSignals.map((signal) => (
                <div key={signal.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">{signal.label}</p>
                  <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{signal.value}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{signal.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-[linear-gradient(140deg,rgba(16,185,129,0.2),rgba(6,182,212,0.08),rgba(250,204,21,0.12))] blur-2xl" />
            <div className="rounded-[2rem] border border-white/10 bg-[rgba(7,12,24,0.92)] p-5 shadow-2xl shadow-emerald-950/20">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Workspace snapshot</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">tenant: engineering-pilot</p>
                </div>
                <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  {mode.status}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Selected mode</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{mode.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{mode.body}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Readiness</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 transition-all duration-500"
                      style={{ width: `${readiness}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{readiness}% pilot ready</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {modes.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setModeId(item.id)}
                    aria-pressed={mode.id === item.id}
                    className={`rounded-2xl border p-4 text-left transition ${
                      mode.id === item.id
                        ? "border-emerald-300/40 bg-emerald-300/10"
                        : "border-white/10 bg-white/5 hover:border-cyan-300/30 hover:bg-white/10"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">{item.label}</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{item.status}</p>
                    <p className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">{item.checkpoint}</p>
                  </button>
                ))}
              </div>

              <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-[#07101d] p-4 font-mono text-sm">
                {activityFeed.map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded-xl border p-3 ${
                      entry.tone === "emerald"
                        ? "border-emerald-400/20 bg-emerald-400/5"
                        : entry.tone === "cyan"
                          ? "border-cyan-400/20 bg-cyan-400/5"
                          : entry.tone === "amber"
                            ? "border-amber-300/20 bg-amber-300/5"
                            : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                      <FireIcon className="h-4 w-4 text-emerald-300" />
                      Live event
                    </div>
                    <p className="mt-2 text-[var(--text-primary)]">{entry.message}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                    <CpuChipIcon className="h-4 w-4 text-cyan-300" />
                    Change Envelope
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    Scope stays small until review evidence, memory provenance, and policy checks all line up.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                    <WrenchScrewdriverIcon className="h-4 w-4 text-amber-300" />
                    Pilot CTA
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    {pilotRequested
                      ? "The request is staged. Use the console to continue the demo."
                      : "Click request pilot to stage the workspace handoff signal."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20 lg:px-8">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.24em] text-amber-300">Pilot motion</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-4xl">
                Sell the operating lane first, then widen the account when trust is earned.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-[var(--text-secondary)]">
              This demo frames DevBot as a governed workstation: deliberate controls, visible approvals,
              and a clean expansion path into broader DEBO command.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {pilotPlan.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-[#0a1424] p-5">
                  <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-3">
                    <Icon className="h-6 w-6 text-emerald-300" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-[var(--text-primary)]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{item.body}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--text-primary)] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white"
            >
              Launch Console
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => setPilotRequested(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-emerald-300/40 hover:bg-white/5"
            >
              Stage Pilot Brief
              <CheckCircleIcon className="h-4 w-4" />
            </button>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-[var(--text-secondary)]">
              <ShieldCheckIcon className="h-4 w-4 text-cyan-300" />
              Governed by default
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
