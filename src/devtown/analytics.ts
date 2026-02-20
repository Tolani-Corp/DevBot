// ──────────────────────────────────────────────────────────────
// DevTown — Analytics Engine
// Aggregate performance data across polecats, hackathons,
// arenas, and bounties. Generate insights and reports.
// ──────────────────────────────────────────────────────────────

import type {
  Polecat,
  PolecatStats,
  Bead,
  Convoy,
  ConvoyProgress,
  AgentRuntime,
  RuntimeProvider,
} from "./types.js";
import type { AgentRole } from "../agents/types.js";
import type { ConvoyStore } from "./convoy.js";
import type { FleetManager } from "./fleet.js";
import type { HackathonManager, Hackathon, LeaderboardEntry } from "./hackathon.js";
import type { ArenaManager, Arena, CombatantStanding } from "./arena.js";
import type { BountyBoard, Bounty } from "./bounties.js";

// ─── Analytics Types ──────────────────────────────────────────

export interface FleetHealthReport {
  readonly timestamp: Date;
  readonly totalPolecats: number;
  readonly activePolecats: number;
  readonly idlePolecats: number;
  readonly utilizationPercent: number;
  readonly avgSuccessRate: number;
  readonly avgCompletionTimeMs: number;
  readonly totalLinesChanged: number;
  readonly polecatsByRole: Record<AgentRole, number>;
  readonly polecatsByStatus: {
    readonly healthy: number;
    readonly degraded: number;
    readonly failing: number;
  };
}

export interface PolecatPerformance {
  readonly polecatId: string;
  readonly polecatName: string;
  readonly role: AgentRole;
  readonly runtime: RuntimeProvider;
  readonly stats: PolecatStats;
  readonly performanceScore: number;
  readonly rank: number;
  readonly trend: "improving" | "stable" | "declining";
}

export interface ConvoyAnalytics {
  readonly convoyId: string;
  readonly convoyName: string;
  readonly status: string;
  readonly progress: ConvoyProgress;
  readonly beadBreakdown: {
    readonly byStatus: Record<string, number>;
    readonly byRole: Record<string, number>;
    readonly byPriority: Record<string, number>;
  };
  readonly avgBeadTimeMs: number;
  readonly estimatedCompletionMs: number | null;
}

export interface HackathonInsights {
  readonly totalHackathons: number;
  readonly activeHackathons: number;
  readonly completedHackathons: number;
  readonly totalParticipants: number;
  readonly avgParticipantsPerHackathon: number;
  readonly topPerformers: Array<{
    readonly name: string;
    readonly elo: number;
    readonly wins: number;
  }>;
  readonly eloDistribution: {
    readonly min: number;
    readonly max: number;
    readonly median: number;
    readonly avg: number;
  };
}

export interface ArenaStats {
  readonly totalArenas: number;
  readonly activeArenas: number;
  readonly completedArenas: number;
  readonly totalRounds: number;
  readonly winsByRuntime: Record<string, number>;
  readonly avgRoundsPerArena: number;
  readonly topCombatants: CombatantStanding[];
}

export interface BountyMetrics {
  readonly totalBounties: number;
  readonly openBounties: number;
  readonly completedBounties: number;
  readonly totalRewardsPaid: number;
  readonly avgRewardAmount: number;
  readonly avgCompletionHours: number;
  readonly successRate: number;
  readonly totalEscrowed: number;
  readonly topClaimants: Array<{
    readonly id: string;
    readonly name: string;
    readonly completed: number;
    readonly reputation: number;
  }>;
}

export interface TownDashboard {
  readonly generatedAt: Date;
  readonly fleet: FleetHealthReport;
  readonly convoys: ConvoyAnalytics[];
  readonly hackathons: HackathonInsights;
  readonly arenas: ArenaStats;
  readonly bounties: BountyMetrics;
  readonly alerts: DashboardAlert[];
}

export interface DashboardAlert {
  readonly severity: "info" | "warning" | "critical";
  readonly category: "fleet" | "convoy" | "hackathon" | "arena" | "bounty";
  readonly message: string;
  readonly timestamp: Date;
}

// ─── Analytics Engine ─────────────────────────────────────────

export class AnalyticsEngine {
  private store: ConvoyStore;
  private fleetManager?: FleetManager;
  private hackathonManager?: HackathonManager;
  private arenaManager?: ArenaManager;
  private bountyBoard?: BountyBoard;

  constructor(
    store: ConvoyStore,
    options?: {
      fleetManager?: FleetManager;
      hackathonManager?: HackathonManager;
      arenaManager?: ArenaManager;
      bountyBoard?: BountyBoard;
    },
  ) {
    this.store = store;
    this.fleetManager = options?.fleetManager;
    this.hackathonManager = options?.hackathonManager;
    this.arenaManager = options?.arenaManager;
    this.bountyBoard = options?.bountyBoard;
  }

  // ─── Fleet Analytics ───────────────────────────────

  getFleetHealth(): FleetHealthReport {
    if (!this.fleetManager) {
      return this.emptyFleetReport();
    }

    const polecats = this.fleetManager.listPolecats();
    const active = this.fleetManager.listActive();
    const idle = this.fleetManager.listIdle();

    // Aggregate stats
    let totalSuccess = 0;
    let totalTasks = 0;
    let totalTime = 0;
    let totalLines = 0;
    const byRole: Record<AgentRole, number> = {
      frontend: 0,
      backend: 0,
      security: 0,
      devops: 0,
      "arb-runner": 0,
      media: 0,
      general: 0,
    };

    let healthy = 0;
    let degraded = 0;
    let failing = 0;

    for (const p of polecats) {
      byRole[p.role]++;
      totalSuccess += p.stats.tasksCompleted;
      totalTasks += p.stats.tasksCompleted + p.stats.tasksFailed;
      totalTime += p.stats.avgCompletionTimeMs;
      totalLines += p.stats.linesChanged;

      // Health classification
      if (p.stats.verificationPassRate >= 0.8) {
        healthy++;
      } else if (p.stats.verificationPassRate >= 0.5) {
        degraded++;
      } else {
        failing++;
      }
    }

    return {
      timestamp: new Date(),
      totalPolecats: polecats.length,
      activePolecats: active.length,
      idlePolecats: idle.length,
      utilizationPercent:
        polecats.length > 0
          ? Math.round((active.length / polecats.length) * 100)
          : 0,
      avgSuccessRate:
        totalTasks > 0 ? Math.round((totalSuccess / totalTasks) * 100) / 100 : 1,
      avgCompletionTimeMs:
        polecats.length > 0 ? Math.round(totalTime / polecats.length) : 0,
      totalLinesChanged: totalLines,
      polecatsByRole: byRole,
      polecatsByStatus: { healthy, degraded, failing },
    };
  }

  getPolecatPerformance(): PolecatPerformance[] {
    if (!this.fleetManager) return [];

    const polecats = this.fleetManager.listPolecats();
    const performances: PolecatPerformance[] = polecats.map((p) => ({
      polecatId: p.id,
      polecatName: p.name,
      role: p.role,
      runtime: p.runtime.provider,
      stats: p.stats,
      performanceScore: p.identity.performanceScore,
      rank: 0,
      trend: this.calculateTrend(p),
    }));

    // Sort by performance score
    performances.sort((a, b) => b.performanceScore - a.performanceScore);

    // Assign ranks
    return performances.map((p, i) => ({ ...p, rank: i + 1 }));
  }

  // ─── Convoy Analytics ──────────────────────────────

  getConvoyAnalytics(convoyId?: string): ConvoyAnalytics[] {
    const convoys = convoyId
      ? [this.store.getConvoy(convoyId)].filter(Boolean) as Convoy[]
      : this.store.listConvoys();

    return convoys.map((convoy) => {
      const beads = convoy.beadIds
        .map((id) => this.store.getBead(id))
        .filter(Boolean) as Bead[];

      const byStatus: Record<string, number> = {};
      const byRole: Record<string, number> = {};
      const byPriority: Record<string, number> = {};
      let totalTime = 0;
      let completedCount = 0;

      for (const bead of beads) {
        byStatus[bead.status] = (byStatus[bead.status] ?? 0) + 1;
        byRole[bead.role] = (byRole[bead.role] ?? 0) + 1;
        byPriority[bead.priority] = (byPriority[bead.priority] ?? 0) + 1;

        if (bead.completedAt && bead.createdAt) {
          totalTime += bead.completedAt.getTime() - bead.createdAt.getTime();
          completedCount++;
        }
      }

      const avgTime = completedCount > 0 ? totalTime / completedCount : 0;
      const remaining = convoy.progress.total - convoy.progress.completed;
      const estimatedCompletion =
        avgTime > 0 && remaining > 0 ? remaining * avgTime : null;

      return {
        convoyId: convoy.id,
        convoyName: convoy.name,
        status: convoy.status,
        progress: convoy.progress,
        beadBreakdown: { byStatus, byRole, byPriority },
        avgBeadTimeMs: Math.round(avgTime),
        estimatedCompletionMs: estimatedCompletion
          ? Math.round(estimatedCompletion)
          : null,
      };
    });
  }

  // ─── Hackathon Analytics ───────────────────────────

  getHackathonInsights(): HackathonInsights {
    if (!this.hackathonManager) {
      return this.emptyHackathonInsights();
    }

    const hackathons = this.hackathonManager.list();
    const active = hackathons.filter((h) => h.status === "active");
    const completed = hackathons.filter((h) => h.status === "completed");

    // Collect all participants
    const participantElos = new Map<string, { name: string; elo: number; wins: number }>();
    let totalParticipants = 0;

    for (const h of hackathons) {
      totalParticipants += h.participants.length;
      for (const p of h.participants) {
        const elo = this.hackathonManager.getParticipantElo(p.id);
        const existing = participantElos.get(p.id);
        participantElos.set(p.id, {
          name: p.name,
          elo,
          wins: (existing?.wins ?? 0),
        });
      }
    }

    // Calculate ELO distribution
    const elos = Array.from(participantElos.values()).map((p) => p.elo);
    elos.sort((a, b) => a - b);

    const eloDistribution =
      elos.length > 0
        ? {
            min: elos[0]!,
            max: elos[elos.length - 1]!,
            median: elos[Math.floor(elos.length / 2)]!,
            avg: Math.round(elos.reduce((a, b) => a + b, 0) / elos.length),
          }
        : { min: 0, max: 0, median: 0, avg: 0 };

    // Top performers
    const topPerformers = Array.from(participantElos.values())
      .sort((a, b) => b.elo - a.elo)
      .slice(0, 5);

    return {
      totalHackathons: hackathons.length,
      activeHackathons: active.length,
      completedHackathons: completed.length,
      totalParticipants,
      avgParticipantsPerHackathon:
        hackathons.length > 0
          ? Math.round(totalParticipants / hackathons.length)
          : 0,
      topPerformers,
      eloDistribution,
    };
  }

  // ─── Arena Analytics ───────────────────────────────

  getArenaStats(): ArenaStats {
    if (!this.arenaManager) {
      return this.emptyArenaStats();
    }

    const arenas = this.arenaManager.list();
    const active = arenas.filter((a) => a.status === "battling");
    const completed = arenas.filter((a) => a.status === "completed");

    let totalRounds = 0;
    const winsByRuntime: Record<string, number> = {};
    const allStandings: CombatantStanding[] = [];

    for (const arena of arenas) {
      totalRounds += arena.rounds.length;

      // Count wins by runtime
      for (const round of arena.rounds) {
        const winner = round.rankings.find((r) => r.rank === 1);
        if (winner) {
          const combatant = arena.combatants.find((c) => c.id === winner.combatantId);
          if (combatant) {
            const runtime = combatant.runtime.provider;
            winsByRuntime[runtime] = (winsByRuntime[runtime] ?? 0) + 1;
          }
        }
      }

      // Collect standings
      if (arena.status === "completed") {
        const standings = this.arenaManager.getLeaderboard(arena.id);
        allStandings.push(...standings);
      }
    }

    // Top combatants (by ELO)
    const topCombatants = allStandings
      .sort((a, b) => b.elo - a.elo)
      .slice(0, 5);

    return {
      totalArenas: arenas.length,
      activeArenas: active.length,
      completedArenas: completed.length,
      totalRounds,
      winsByRuntime,
      avgRoundsPerArena:
        arenas.length > 0 ? Math.round(totalRounds / arenas.length) : 0,
      topCombatants,
    };
  }

  // ─── Bounty Analytics ──────────────────────────────

  getBountyMetrics(): BountyMetrics {
    if (!this.bountyBoard) {
      return this.emptyBountyMetrics();
    }

    const bounties = this.bountyBoard.list();
    const open = bounties.filter((b) => b.status === "open");
    const completed = bounties.filter((b) => b.status === "approved");

    let totalRewardsPaid = 0;
    let totalCompletionHours = 0;
    const claimantStats = new Map<string, { name: string; completed: number }>();

    for (const bounty of completed) {
      totalRewardsPaid += bounty.reward.amount;

      const approvedClaim = bounty.claims.find((c) => c.status === "approved");
      if (approvedClaim) {
        const hours =
          (approvedClaim.submission!.submittedAt.getTime() -
            approvedClaim.claimedAt.getTime()) /
          (60 * 60 * 1000);
        totalCompletionHours += hours;

        const existing = claimantStats.get(approvedClaim.claimant.id);
        claimantStats.set(approvedClaim.claimant.id, {
          name: approvedClaim.claimant.name,
          completed: (existing?.completed ?? 0) + 1,
        });
      }
    }

    // Top claimants
    const topClaimants = Array.from(claimantStats.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        completed: data.completed,
        reputation: this.bountyBoard!.getClaimantReputation(id),
      }))
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 5);

    return {
      totalBounties: bounties.length,
      openBounties: open.length,
      completedBounties: completed.length,
      totalRewardsPaid,
      avgRewardAmount:
        completed.length > 0 ? Math.round(totalRewardsPaid / completed.length) : 0,
      avgCompletionHours:
        completed.length > 0
          ? Math.round((totalCompletionHours / completed.length) * 10) / 10
          : 0,
      successRate:
        bounties.length > 0
          ? Math.round((completed.length / bounties.length) * 100) / 100
          : 0,
      totalEscrowed: this.bountyBoard.getTotalEscrow(),
      topClaimants,
    };
  }

  // ─── Full Dashboard ────────────────────────────────

  generateDashboard(): TownDashboard {
    const fleet = this.getFleetHealth();
    const convoys = this.getConvoyAnalytics();
    const hackathons = this.getHackathonInsights();
    const arenas = this.getArenaStats();
    const bounties = this.getBountyMetrics();

    const alerts = this.generateAlerts(fleet, convoys, hackathons, arenas, bounties);

    return {
      generatedAt: new Date(),
      fleet,
      convoys,
      hackathons,
      arenas,
      bounties,
      alerts,
    };
  }

  /** Generate markdown report for export/display. */
  generateReport(): string {
    const dashboard = this.generateDashboard();
    const lines: string[] = [
      `# DevTown Analytics Report`,
      `_Generated: ${dashboard.generatedAt.toISOString()}_`,
      ``,
      `## Fleet Health`,
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Total Polecats | ${dashboard.fleet.totalPolecats} |`,
      `| Active | ${dashboard.fleet.activePolecats} |`,
      `| Idle | ${dashboard.fleet.idlePolecats} |`,
      `| Utilization | ${dashboard.fleet.utilizationPercent}% |`,
      `| Avg Success Rate | ${(dashboard.fleet.avgSuccessRate * 100).toFixed(1)}% |`,
      `| Total Lines Changed | ${dashboard.fleet.totalLinesChanged.toLocaleString()} |`,
      ``,
      `## Convoys`,
    ];

    for (const convoy of dashboard.convoys) {
      lines.push(`### ${convoy.convoyName}`);
      lines.push(`- Status: ${convoy.status}`);
      lines.push(`- Progress: ${convoy.progress.percentComplete}%`);
      lines.push(`- Completed: ${convoy.progress.completed}/${convoy.progress.total}`);
      lines.push(``);
    }

    lines.push(`## Hackathons`);
    lines.push(`- Total: ${dashboard.hackathons.totalHackathons}`);
    lines.push(`- Active: ${dashboard.hackathons.activeHackathons}`);
    lines.push(`- Participants: ${dashboard.hackathons.totalParticipants}`);
    lines.push(``);

    lines.push(`## Arenas`);
    lines.push(`- Total: ${dashboard.arenas.totalArenas}`);
    lines.push(`- Completed: ${dashboard.arenas.completedArenas}`);
    lines.push(`- Total Rounds: ${dashboard.arenas.totalRounds}`);
    lines.push(``);

    lines.push(`## Bounties`);
    lines.push(`- Total: ${dashboard.bounties.totalBounties}`);
    lines.push(`- Open: ${dashboard.bounties.openBounties}`);
    lines.push(`- Total Paid: ${dashboard.bounties.totalRewardsPaid}`);
    lines.push(`- Escrowed: ${dashboard.bounties.totalEscrowed}`);
    lines.push(``);

    if (dashboard.alerts.length > 0) {
      lines.push(`## Alerts`);
      for (const alert of dashboard.alerts) {
        const icon =
          alert.severity === "critical"
            ? "🔴"
            : alert.severity === "warning"
              ? "🟡"
              : "🔵";
        lines.push(`${icon} **${alert.category}**: ${alert.message}`);
      }
    }

    return lines.join("\n");
  }

  // ─── Private Helpers ───────────────────────────────

  private calculateTrend(polecat: Polecat): "improving" | "stable" | "declining" {
    // Simple heuristic based on performance score
    const score = polecat.identity.performanceScore;
    if (score >= 70) return "improving";
    if (score >= 40) return "stable";
    return "declining";
  }

  private generateAlerts(
    fleet: FleetHealthReport,
    convoys: ConvoyAnalytics[],
    hackathons: HackathonInsights,
    arenas: ArenaStats,
    bounties: BountyMetrics,
  ): DashboardAlert[] {
    const alerts: DashboardAlert[] = [];
    const now = new Date();

    // Fleet alerts
    if (fleet.totalPolecats === 0) {
      alerts.push({
        severity: "warning",
        category: "fleet",
        message: "No polecats registered",
        timestamp: now,
      });
    } else if (fleet.polecatsByStatus.failing > fleet.polecatsByStatus.healthy) {
      alerts.push({
        severity: "critical",
        category: "fleet",
        message: `${fleet.polecatsByStatus.failing} polecats are failing`,
        timestamp: now,
      });
    }

    if (fleet.utilizationPercent > 90) {
      alerts.push({
        severity: "warning",
        category: "fleet",
        message: "Fleet utilization above 90%",
        timestamp: now,
      });
    }

    // Convoy alerts
    for (const convoy of convoys) {
      if (convoy.progress.failed > convoy.progress.completed) {
        alerts.push({
          severity: "warning",
          category: "convoy",
          message: `Convoy "${convoy.convoyName}" has high failure rate`,
          timestamp: now,
        });
      }
    }

    // Bounty alerts
    if (bounties.openBounties > 20) {
      alerts.push({
        severity: "info",
        category: "bounty",
        message: `${bounties.openBounties} open bounties waiting for claims`,
        timestamp: now,
      });
    }

    return alerts;
  }

  private emptyFleetReport(): FleetHealthReport {
    return {
      timestamp: new Date(),
      totalPolecats: 0,
      activePolecats: 0,
      idlePolecats: 0,
      utilizationPercent: 0,
      avgSuccessRate: 0,
      avgCompletionTimeMs: 0,
      totalLinesChanged: 0,
      polecatsByRole: { frontend: 0, backend: 0, security: 0, "arb-runner": 0, devops: 0, media: 0, general: 0 },
      polecatsByStatus: { healthy: 0, degraded: 0, failing: 0 },
    };
  }

  private emptyHackathonInsights(): HackathonInsights {
    return {
      totalHackathons: 0,
      activeHackathons: 0,
      completedHackathons: 0,
      totalParticipants: 0,
      avgParticipantsPerHackathon: 0,
      topPerformers: [],
      eloDistribution: { min: 0, max: 0, median: 0, avg: 0 },
    };
  }

  private emptyArenaStats(): ArenaStats {
    return {
      totalArenas: 0,
      activeArenas: 0,
      completedArenas: 0,
      totalRounds: 0,
      winsByRuntime: {},
      avgRoundsPerArena: 0,
      topCombatants: [],
    };
  }

  private emptyBountyMetrics(): BountyMetrics {
    return {
      totalBounties: 0,
      openBounties: 0,
      completedBounties: 0,
      totalRewardsPaid: 0,
      avgRewardAmount: 0,
      avgCompletionHours: 0,
      successRate: 0,
      totalEscrowed: 0,
      topClaimants: [],
    };
  }
}
