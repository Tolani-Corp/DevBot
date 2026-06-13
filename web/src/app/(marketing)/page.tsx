"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  BoltIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  CommandLineIcon,
  CpuChipIcon,
  CurrencyDollarIcon,
  DocumentCheckIcon,
  FireIcon,
  LockClosedIcon,
  PlayCircleIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";

type ModeId = "intake" | "build" | "review" | "teach";
type DemoStageId = "stabilize" | "security" | "release" | "scale";

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

const premiumDemoStages: {
  id: DemoStageId;
  label: string;
  account: string;
  title: string;
  request: string;
  outcome: string;
  owner: string;
  approval: string;
  risk: string;
  eta: string;
  roi: string;
  evidence: string[];
  events: string[];
}[] = [
  {
    id: "stabilize",
    label: "Stabilize",
    account: "Series B SaaS",
    title: "Recover a failing billing release without losing context",
    request:
      "Investigate the checkout regression, isolate the smallest patch, and prepare a reviewed PR.",
    outcome: "Patch lane drafted with rollback notes and reviewer summary.",
    owner: "Platform lead",
    approval: "Finance + release owner",
    risk: "Customer revenue path",
    eta: "18 min",
    roi: "4.8h review drag avoided",
    evidence: [
      "Failing path reproduced from checkout fixture",
      "Diff limited to billing session guard",
      "Rollback note attached to release evidence",
    ],
    events: [
      "Request normalized into billing-release lane",
      "Regression scope pinned to checkout session validation",
      "Reviewer brief generated with tests and rollback proof",
    ],
  },
  {
    id: "security",
    label: "Security",
    account: "AI operations team",
    title: "Run a governed NATT triage with written scope",
    request:
      "Review the staging API attack surface and produce sanitized findings for the security owner.",
    outcome: "Non-destructive findings package staged behind ROE gate.",
    owner: "Security owner",
    approval: "ROE + operations owner",
    risk: "Security assessment",
    eta: "24 min",
    roi: "1 manual handoff removed",
    evidence: [
      "Rules of engagement checked before scan",
      "Private target data excluded from output",
      "Findings labeled observed, inferred, or unverified",
    ],
    events: [
      "Scope verified against authorized staging targets",
      "Passive checks completed before active probes",
      "Claim-integrity policy applied to the report",
    ],
  },
  {
    id: "release",
    label: "Release",
    account: "Enterprise product group",
    title: "Convert a feature request into release-ready proof",
    request:
      "Implement the settings audit trail and prepare the governance evidence for approval.",
    outcome: "PR package includes CI, evidence manifest, and approval posture.",
    owner: "Release captain",
    approval: "Architecture + operations",
    risk: "Production release",
    eta: "32 min",
    roi: "2 release meetings compressed",
    evidence: [
      "CI gate list attached to delivery evidence",
      "ADR and design-review links verified",
      "Unverified production claims blocked from notes",
    ],
    events: [
      "Feature decomposed into schema, service, and UI steps",
      "Evidence manifest refreshed after docs changed",
      "Release note drafted with remaining uncertainty",
    ],
  },
  {
    id: "scale",
    label: "Scale",
    account: "Multi-team engineering org",
    title: "Coordinate DevBot lanes across teams without chaos",
    request:
      "Compare active work lanes, identify blocked approvals, and propose the next operator action.",
    outcome: "Fleet view ranks lanes by risk, evidence quality, and owner state.",
    owner: "Engineering chief of staff",
    approval: "Team leads",
    risk: "Cross-team delivery",
    eta: "11 min",
    roi: "7 stale threads resolved",
    evidence: [
      "Owner state grouped by team and workflow",
      "Blocked approvals separated from active work",
      "Customer-impacting claims require direct proof",
    ],
    events: [
      "Fleet lanes grouped by approval posture",
      "Blocked work separated from ready-to-review tasks",
      "Operator action list ranked by risk and time",
    ],
  },
];

const premiumSignals = [
  {
    icon: LockClosedIcon,
    label: "Claim integrity",
    value: "Strict",
    detail: "High-risk claims need evidence or stay labeled unverified.",
  },
  {
    icon: UserGroupIcon,
    label: "Approval mesh",
    value: "Named owners",
    detail: "Security, release, customer, and operations gates stay visible.",
  },
  {
    icon: CurrencyDollarIcon,
    label: "Commercial proof",
    value: "ROI surfaced",
    detail: "Review drag, handoffs, and release meetings become measurable.",
  },
];

function nextMode(current: ModeId): ModeId {
  const index = modes.findIndex((mode) => mode.id === current);
  return modes[(index + 1) % modes.length].id;
}

export default function Home() {
  const [modeId, setModeId] = useState<ModeId>("intake");
  const [demoStageId, setDemoStageId] = useState<DemoStageId>("stabilize");
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
      tone:
        index === 0
          ? "emerald"
          : index === 1
            ? "cyan"
            : index === 2
              ? "amber"
              : "slate",
    }));
  }, [mode, pilotRequested, tick]);

  const readiness = Math.min(100, mode.score + (tick % 4) * 2);
  const demoStage =
    premiumDemoStages.find((stage) => stage.id === demoStageId) ??
    premiumDemoStages[0];

  return (
    <div className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.18),_transparent_22%),linear-gradient(180deg,_rgba(2,6,23,1),_rgba(8,15,32,1))]" />
      <div className="absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.08),_transparent_52%)] blur-3xl" />

      <section className="mx-auto max-w-7xl px-6 pb-12 pt-14 lg:px-8 lg:pb-16 lg:pt-20">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-300">
              Governed engineering workstation
            </div>

            <h1 className="mt-6 max-w-4xl text-5xl font-semibold text-[var(--text-primary)] sm:text-6xl lg:text-7xl">
              DEBO turns requests into governed engineering execution.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--text-secondary)] sm:text-xl">
              This surface shows the operator loop DEBO is built around:
              intake, patch, review, and teach. DevBot handles the request-to-PR
              lane while DEBO keeps evidence, claims, approvals, and portfolio
              posture visible.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                Open DEBO Console
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
                <div
                  key={signal.label}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
                >
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">
                    {signal.label}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
                    {signal.value}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    {signal.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-[linear-gradient(140deg,rgba(16,185,129,0.2),rgba(6,182,212,0.08),rgba(250,204,21,0.12))] blur-2xl" />
            <div className="rounded-[2rem] border border-white/10 bg-[rgba(7,12,24,0.92)] p-5 shadow-2xl shadow-emerald-950/20">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">
                    Workspace snapshot
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                    tenant: engineering-pilot
                  </p>
                </div>
                <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  {mode.status}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-300">
                    Selected mode
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                    {mode.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    {mode.body}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
                    Readiness
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 transition-all duration-500"
                      style={{ width: `${readiness}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                    {readiness}% pilot ready
                  </p>
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
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                      {item.status}
                    </p>
                    <p className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">
                      {item.checkpoint}
                    </p>
                  </button>
                ))}
              </div>

              <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-[#07101d] p-4 font-mono text-sm">
                {activityFeed.map((entry, index) => (
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
                    <p className="mt-2 text-[var(--text-primary)]">
                      {entry.message}
                      {index === activityFeed.length - 1 ? (
                        <span className="debo-terminal-cursor ml-2 h-4 w-1.5" />
                      ) : null}
                    </p>
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
                    Scope stays small until review evidence, memory provenance,
                    and policy checks all line up.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                    <WrenchScrewdriverIcon className="h-4 w-4 text-amber-300" />
                    Pilot CTA
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    {pilotRequested
                      ? "The request is staged. Use the console to continue the pilot review."
                      : "Click request pilot to stage the workspace handoff signal."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#06111e] px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase text-emerald-300">
                Premium demo
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-[var(--text-primary)] sm:text-4xl">
                A buyer can inspect the whole operating lane in one pass.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
                Pick a scenario and the console updates the request, approval
                owner, risk, evidence, and commercial value. The demo favors
                operational clarity over spectacle so executives and platform
                owners can understand the control model quickly.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-white/5 p-1 sm:grid-cols-4">
              {premiumDemoStages.map((stage) => (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setDemoStageId(stage.id)}
                  aria-pressed={demoStage.id === stage.id}
                  className={`min-h-10 rounded-md px-3 py-2 text-xs font-semibold transition ${
                    demoStage.id === stage.id
                      ? "bg-emerald-300 text-slate-950"
                      : "text-[var(--text-secondary)] hover:bg-white/10 hover:text-[var(--text-primary)]"
                  }`}
                >
                  {stage.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-[0.88fr_1.36fr_0.76fr]">
            <div className="space-y-4">
              {premiumSignals.map((signal) => {
                const Icon = signal.icon;
                return (
                  <div
                    key={signal.label}
                    className="rounded-lg border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/20">
                        <Icon className="h-5 w-5 text-cyan-300" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
                          {signal.label}
                        </p>
                        <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                          {signal.value}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                          {signal.detail}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg border border-white/10 bg-[#091827] shadow-2xl shadow-black/20">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-300 text-slate-950">
                    <PlayCircleIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase text-cyan-300">
                      Live buyer view
                    </p>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {demoStage.account}
                    </p>
                  </div>
                </div>
                <span className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  {demoStage.eta} to evidence
                </span>
              </div>

              <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
                  <p className="text-xs font-semibold uppercase text-amber-300">
                    Request
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">
                    {demoStage.title}
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
                    {demoStage.request}
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                        <ClockIcon className="h-4 w-4 text-cyan-300" />
                        SLA
                      </div>
                      <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
                        {demoStage.eta}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                        <ChartBarIcon className="h-4 w-4 text-emerald-300" />
                        Value
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-primary)]">
                        {demoStage.roi}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <p className="text-xs font-semibold uppercase text-emerald-300">
                    Governance lane
                  </p>
                  <dl className="mt-4 space-y-3">
                    {[
                      ["Owner", demoStage.owner],
                      ["Approval", demoStage.approval],
                      ["Risk", demoStage.risk],
                      ["Outcome", demoStage.outcome],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="grid grid-cols-[6.5rem_1fr] gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-sm"
                      >
                        <dt className="font-semibold text-[var(--text-secondary)]">
                          {label}
                        </dt>
                        <dd className="font-medium text-[var(--text-primary)]">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-5 rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                      <DocumentCheckIcon className="h-4 w-4 text-cyan-300" />
                      Evidence generated
                    </div>
                    <ul className="mt-3 space-y-2">
                      {demoStage.evidence.map((item) => (
                        <li
                          key={item}
                          className="flex gap-2 text-sm leading-6 text-[var(--text-secondary)]"
                        >
                          <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <FireIcon className="h-4 w-4 text-amber-300" />
                Operator feed
              </div>
              <div className="mt-4 space-y-3">
                {demoStage.events.map((event, index) => (
                  <div key={event} className="flex gap-3">
                    <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-xs font-semibold text-emerald-200">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-6 text-[var(--text-secondary)]">
                      {event}
                    </p>
                  </div>
                ))}
              </div>
              <Link
                href="/dashboard"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--text-primary)] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white"
              >
                Inspect Console
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20 lg:px-8">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.24em] text-amber-300">
                Pilot motion
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-4xl">
                Sell the operating lane first, then widen the account when trust
                is earned.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-[var(--text-secondary)]">
              DevBot is packaged as a governed workstation: deliberate controls,
              visible approvals, and a clean expansion path into broader DEBO
              command.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {pilotPlan.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-[#0a1424] p-5"
                >
                  <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-3">
                    <Icon className="h-6 w-6 text-emerald-300" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-[var(--text-primary)]">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                    {item.body}
                  </p>
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
