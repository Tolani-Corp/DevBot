/**
 * agent-roi.ts — Agent ROI Measurement Service
 *
 * Computes the return-on-investment of DevBot's autonomous agents.
 * Tracks cost (Claude API spend) vs. value (developer hours saved).
 *
 * Agentic AI ROI dimensions measured:
 *   1. Task throughput       — automated tasks per period
 *   2. Completion rate       — % reaching "completed" status
 *   3. Agent quality score   — estimated success rate per agent role
 *   4. Time-to-complete      — avg ms from creation to done
 *   5. Developer time saved  — throughput × 45 min industry avg per task
 *   6. API cost              — estimated Claude spend per task
 *   7. ROI multiplier        — (value delivered) / (api cost)
 *   8. Security value        — breach cost prevented by NATT findings
 */

import { db } from "@/db";
import { tasks, agentPerformanceHistory, auditLogs } from "@/db/schema";
import { sql, and, gte, eq, desc } from "drizzle-orm";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Average developer time replaced per completed automated task (industry benchmark) */
const AVG_MINUTES_SAVED_PER_TASK = 45;

/** Estimated Claude Sonnet API cost per task (prompt + completion tokens) */
const AVG_API_COST_PER_TASK_USD = 0.08;

/** Loaded developer hourly rate for value calculation */
const DEV_HOURLY_RATE_USD = 150;

/** IBM 2024 breach cost estimates by severity */
const BREACH_COST_BY_SEVERITY: Record<string, number> = {
  critical: 150_000,
  high: 45_000,
  medium: 12_000,
  low: 2_500,
  info: 0,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentROIReport {
  period: string;
  generatedAt: Date;

  // Volume
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  completionRate: number; // 0-1

  // Speed
  avgCompletionTimeMs: number;
  avgCompletionTimeMinutes: number;

  // Quality — from agentPerformanceHistory
  agentScores: AgentQualityScore[];
  overallAgentQuality: number; // 0-100

  // Financial
  estimatedTimeSavedHours: number;
  estimatedValueDeliveredUSD: number;
  estimatedApiCostUSD: number;
  roiMultiplier: number; // value / cost (e.g. 14.2× = $14.20 saved per $1 spent)
  netValueUSD: number; // value - cost

  // Security (NATT)
  nattFindingsCount: number;
  estimatedBreachCostPreventedUSD: number;

  // Breakdown
  byTaskType: TaskTypeROI[];
  byRepository: RepositoryROI[];
  topUsers: UserProductivity[];
}

export interface AgentQualityScore {
  role: string;
  estimatedSuccessRate: number; // 0-100
  totalAttempts: number;
  successes: number;
  failures: number;
}

export interface TaskTypeROI {
  taskType: string;
  count: number;
  successRate: number;
  avgCompletionTimeMs: number;
  timeSavedHours: number;
}

export interface RepositoryROI {
  repository: string;
  tasksCompleted: number;
  timeSavedHours: number;
}

export interface UserProductivity {
  userId: string;
  tasksRequested: number;
  tasksCompleted: number;
  timeSavedHours: number;
}

// ─── Core Computation ─────────────────────────────────────────────────────────

export async function computeAgentROI(days = 30): Promise<AgentROIReport> {
  const since = new Date(Date.now() - days * 86_400_000);

  // Run all DB queries in parallel for performance
  const [
    volumeRows,
    completionTimeRows,
    taskTypeRows,
    repoRows,
    userRows,
    agentPerfRows,
    nattAuditRows,
  ] = await Promise.all([
    // 1. Volume: total / completed / failed
    db
      .select({
        status: tasks.status,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(tasks)
      .where(gte(tasks.createdAt, since))
      .groupBy(tasks.status),

    // 2. Avg completion time for completed tasks
    db
      .select({
        avgMs: sql<number>`cast(avg(extract(epoch from (completed_at - created_at)) * 1000) as int)`,
      })
      .from(tasks)
      .where(
        and(
          gte(tasks.createdAt, since),
          eq(tasks.status, "completed"),
          sql`completed_at is not null`
        )
      ),

    // 3. Per-task-type breakdown
    db
      .select({
        taskType: tasks.taskType,
        total: sql<number>`cast(count(*) as int)`,
        completed: sql<number>`cast(sum(case when status = 'completed' then 1 else 0 end) as int)`,
        avgMs: sql<number>`cast(avg(case when status = 'completed' and completed_at is not null then extract(epoch from (completed_at - created_at)) * 1000 end) as int)`,
      })
      .from(tasks)
      .where(gte(tasks.createdAt, since))
      .groupBy(tasks.taskType),

    // 4. Per-repository breakdown
    db
      .select({
        repository: tasks.repository,
        completed: sql<number>`cast(sum(case when status = 'completed' then 1 else 0 end) as int)`,
      })
      .from(tasks)
      .where(gte(tasks.createdAt, since))
      .groupBy(tasks.repository),

    // 5. Per-user productivity
    db
      .select({
        userId: tasks.slackUserId,
        total: sql<number>`cast(count(*) as int)`,
        completed: sql<number>`cast(sum(case when status = 'completed' then 1 else 0 end) as int)`,
      })
      .from(tasks)
      .where(gte(tasks.createdAt, since))
      .groupBy(tasks.slackUserId)
      .orderBy(desc(sql`sum(case when status = 'completed' then 1 else 0 end)`))
      .limit(5),

    // 6. Agent quality scores from performance history
    db
      .select()
      .from(agentPerformanceHistory)
      .orderBy(desc(agentPerformanceHistory.updatedAt)),

    // 7. NATT audit findings from audit logs
    db
      .select({
        details: auditLogs.details,
      })
      .from(auditLogs)
      .where(
        and(
          gte(auditLogs.timestamp, since),
          eq(auditLogs.action, "natt_finding")
        )
      ),
  ]);

  // ── Aggregate volume ───────────────────────────────────────────────────────
  let totalTasks = 0;
  let completedTasks = 0;
  let failedTasks = 0;

  for (const row of volumeRows) {
    totalTasks += row.count;
    if (row.status === "completed") completedTasks = row.count;
    if (row.status === "failed") failedTasks = row.count;
  }

  const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;
  const avgCompletionTimeMs = completionTimeRows[0]?.avgMs ?? 0;

  // ── Time saved & value ────────────────────────────────────────────────────
  const estimatedTimeSavedHours =
    (completedTasks * AVG_MINUTES_SAVED_PER_TASK) / 60;
  const estimatedValueDeliveredUSD =
    estimatedTimeSavedHours * DEV_HOURLY_RATE_USD;
  const estimatedApiCostUSD = totalTasks * AVG_API_COST_PER_TASK_USD;
  const roiMultiplier =
    estimatedApiCostUSD > 0
      ? estimatedValueDeliveredUSD / estimatedApiCostUSD
      : 0;
  const netValueUSD = estimatedValueDeliveredUSD - estimatedApiCostUSD;

  // ── Agent quality scores ──────────────────────────────────────────────────
  // Deduplicate: one entry per role (use latest record)
  const roleMap = new Map<string, (typeof agentPerfRows)[0]>();
  for (const row of agentPerfRows) {
    if (!roleMap.has(row.agentRole)) {
      roleMap.set(row.agentRole, row);
    }
  }
  const agentScores: AgentQualityScore[] = [...roleMap.values()].map((r) => ({
    role: r.agentRole,
    estimatedSuccessRate: r.estimatedSuccessRate,
    totalAttempts: r.successes + r.failures,
    successes: r.successes,
    failures: r.failures,
  }));
  const overallAgentQuality =
    agentScores.length > 0
      ? Math.round(
          agentScores.reduce((s, a) => s + a.estimatedSuccessRate, 0) /
            agentScores.length
        )
      : 0;

  // ── NATT security value ───────────────────────────────────────────────────
  const nattFindingsCount = nattAuditRows.length;
  let estimatedBreachCostPreventedUSD = 0;
  for (const row of nattAuditRows) {
    const details = row.details as Record<string, unknown> | null;
    const severity =
      typeof details?.severity === "string"
        ? details.severity.toLowerCase()
        : "info";
    estimatedBreachCostPreventedUSD +=
      BREACH_COST_BY_SEVERITY[severity] ?? 0;
  }

  // ── Task type breakdown ───────────────────────────────────────────────────
  const byTaskType: TaskTypeROI[] = taskTypeRows.map((r) => ({
    taskType: r.taskType,
    count: r.total,
    successRate: r.total > 0 ? r.completed / r.total : 0,
    avgCompletionTimeMs: r.avgMs ?? 0,
    timeSavedHours: (r.completed * AVG_MINUTES_SAVED_PER_TASK) / 60,
  }));

  // ── Repository breakdown ──────────────────────────────────────────────────
  const byRepository: RepositoryROI[] = repoRows
    .filter((r) => r.repository)
    .map((r) => ({
      repository: r.repository!,
      tasksCompleted: r.completed,
      timeSavedHours: (r.completed * AVG_MINUTES_SAVED_PER_TASK) / 60,
    }))
    .sort((a, b) => b.tasksCompleted - a.tasksCompleted)
    .slice(0, 5);

  // ── Top users ─────────────────────────────────────────────────────────────
  const topUsers: UserProductivity[] = userRows.map((r) => ({
    userId: r.userId,
    tasksRequested: r.total,
    tasksCompleted: r.completed,
    timeSavedHours: (r.completed * AVG_MINUTES_SAVED_PER_TASK) / 60,
  }));

  return {
    period: `${days}d`,
    generatedAt: new Date(),
    totalTasks,
    completedTasks,
    failedTasks,
    completionRate,
    avgCompletionTimeMs,
    avgCompletionTimeMinutes: Math.round(avgCompletionTimeMs / 60_000),
    agentScores,
    overallAgentQuality,
    estimatedTimeSavedHours: Math.round(estimatedTimeSavedHours * 10) / 10,
    estimatedValueDeliveredUSD: Math.round(estimatedValueDeliveredUSD),
    estimatedApiCostUSD: Math.round(estimatedApiCostUSD * 100) / 100,
    roiMultiplier: Math.round(roiMultiplier * 10) / 10,
    netValueUSD: Math.round(netValueUSD),
    nattFindingsCount,
    estimatedBreachCostPreventedUSD,
    byTaskType,
    byRepository,
    topUsers,
  };
}

// ─── Slack Block Kit Formatter ────────────────────────────────────────────────

export function formatROIReportBlocks(
  report: AgentROIReport,
  days: number
): object[] {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const usd = (n: number) =>
    n >= 1000
      ? `$${(n / 1000).toFixed(1)}k`
      : `$${n.toFixed(n < 10 ? 2 : 0)}`;
  const hrs = (n: number) => `${n.toFixed(1)}h`;

  const roiBar = (x: number): string => {
    if (x >= 50) return "🟢🟢🟢🟢🟢";
    if (x >= 20) return "🟢🟢🟢🟢⚫";
    if (x >= 10) return "🟢🟢🟢⚫⚫";
    if (x >= 5)  return "🟢🟢⚫⚫⚫";
    return "🟢⚫⚫⚫⚫";
  };

  const qualityBar = (score: number): string => {
    const filled = Math.round(score / 20);
    return "🟩".repeat(filled) + "⬜".repeat(5 - filled) + ` ${score}%`;
  };

  const blocks: object[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `📊 DevBot ROI Report — Last ${days} Days`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Tasks Completed*\n✅ ${report.completedTasks} / ${report.totalTasks} _(${pct(report.completionRate)})_`,
        },
        {
          type: "mrkdwn",
          text: `*Avg. Completion Time*\n⏱ ${report.avgCompletionTimeMinutes} min / task`,
        },
        {
          type: "mrkdwn",
          text: `*Time Saved*\n🕐 ${hrs(report.estimatedTimeSavedHours)} (${Math.round(report.estimatedTimeSavedHours / 8)} dev-days)`,
        },
        {
          type: "mrkdwn",
          text: `*Agent Quality*\n${qualityBar(report.overallAgentQuality)}`,
        },
      ],
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*💰 Financial ROI*`,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Value Delivered*\n${usd(report.estimatedValueDeliveredUSD)} _(${usd(DEV_HOURLY_RATE_USD)}/hr × ${hrs(report.estimatedTimeSavedHours)})_`,
        },
        {
          type: "mrkdwn",
          text: `*API Cost*\n${usd(report.estimatedApiCostUSD)} _(~${usd(AVG_API_COST_PER_TASK_USD)}/task)_`,
        },
        {
          type: "mrkdwn",
          text: `*Net Value*\n${usd(report.netValueUSD)}`,
        },
        {
          type: "mrkdwn",
          text: `*ROI Multiplier*\n${roiBar(report.roiMultiplier)} *${report.roiMultiplier}×*`,
        },
      ],
    },
  ];

  // Security value section (only if NATT has findings)
  if (report.nattFindingsCount > 0) {
    blocks.push(
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🛡 Security Value (NATT)*\n${report.nattFindingsCount} findings · *${usd(report.estimatedBreachCostPreventedUSD)}* estimated breach cost prevented`,
        },
      }
    );
  }

  // Task type breakdown
  if (report.byTaskType.length > 0) {
    blocks.push(
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📋 By Task Type*\n${report.byTaskType
            .slice(0, 5)
            .map(
              (t) =>
                `• \`${t.taskType}\` — ${t.count} tasks, ${pct(t.successRate)} success, ${hrs(t.timeSavedHours)} saved`
            )
            .join("\n")}`,
        },
      }
    );
  }

  // Agent quality detail
  if (report.agentScores.length > 0) {
    blocks.push(
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🤖 Agent Quality Scores*\n${report.agentScores
            .slice(0, 6)
            .map(
              (a) =>
                `• \`${a.role}\` — ${qualityBar(a.estimatedSuccessRate)} (${a.successes}W / ${a.failures}L)`
            )
            .join("\n")}`,
        },
      }
    );
  }

  // Top users
  if (report.topUsers.length > 0) {
    blocks.push(
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🏆 Top Contributors*\n${report.topUsers
            .map(
              (u, i) =>
                `${i + 1}. <@${u.userId}> — ${u.tasksCompleted}/${u.tasksRequested} tasks · ${hrs(u.timeSavedHours)} saved`
            )
            .join("\n")}`,
        },
      }
    );
  }

  // Footer
  blocks.push(
    { type: "divider" },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `_Generated at ${report.generatedAt.toISOString()} · Assumptions: ${AVG_MINUTES_SAVED_PER_TASK} min/task · ${usd(DEV_HOURLY_RATE_USD)}/hr dev rate · ${usd(AVG_API_COST_PER_TASK_USD)}/task API cost_`,
        },
      ],
    }
  );

  return blocks;
}
