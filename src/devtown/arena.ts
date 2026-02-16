// ──────────────────────────────────────────────────────────────
// DevTown — Arena Module
// AI vs AI competitive battles. Pit polecats against each other
// to solve the same challenge, then compare & rank results.
// Inspired by Colosseum-style code duels.
// ──────────────────────────────────────────────────────────────

import { nanoid } from "nanoid";
import type {
  Bead,
  BeadPriority,
  Polecat,
  FleetEvent,
  FleetEventHandler,
  AgentRuntime,
} from "./types.js";
import type { AgentResult, VerificationResult } from "../agents/types.js";
import { createBead, ConvoyStore } from "./convoy.js";
import {
  DEFAULT_ELO,
  DEFAULT_K_FACTOR,
  calculateEloChange,
} from "./hackathon.js";

// ─── Arena Types ──────────────────────────────────────────────

export type ArenaStatus = "setup" | "battling" | "judging" | "completed" | "cancelled";

export interface Arena {
  readonly id: string;
  readonly name: string;
  readonly challenge: ArenaChallenge;
  readonly combatants: Combatant[];
  readonly rounds: ArenaRound[];
  readonly config: ArenaConfig;
  readonly status: ArenaStatus;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
}

export interface ArenaChallenge {
  readonly beadId: string;
  readonly title: string;
  readonly description: string;
  readonly difficulty: ChallengeDifficulty;
  /** Time limit per round in seconds (0 = unlimited). */
  readonly timeLimitSeconds: number;
  /** Reference solution (for auto-judging). */
  readonly referenceSolution?: string;
  /** Test cases to run on submissions. */
  readonly testCases: TestCase[];
}

export type ChallengeDifficulty = "easy" | "medium" | "hard" | "nightmare";

export interface TestCase {
  readonly id: string;
  readonly input: string;
  readonly expectedOutput: string;
  readonly weight: number; // Points for this case
  readonly isHidden: boolean; // Don't show to combatants
}

export interface Combatant {
  readonly id: string;
  readonly polecatId: string | null;
  readonly name: string;
  readonly runtime: AgentRuntime;
  readonly elo: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
}

export interface ArenaRound {
  readonly roundNumber: number;
  readonly submissions: RoundSubmission[];
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly rankings: RoundRanking[];
}

export interface RoundSubmission {
  readonly combatantId: string;
  readonly result: AgentResult | null;
  readonly verification: VerificationResult | null;
  readonly testResults: TestResult[];
  readonly timeMs: number;
  readonly submittedAt: Date;
}

export interface TestResult {
  readonly testCaseId: string;
  readonly passed: boolean;
  readonly actualOutput: string;
  readonly executionMs: number;
}

export interface RoundRanking {
  readonly rank: number;
  readonly combatantId: string;
  readonly score: number;
  readonly testsPassed: number;
  readonly totalTests: number;
  readonly timeBonus: number;
  readonly eloChange: number;
}

export interface ArenaConfig {
  /** Number of rounds per match. */
  readonly rounds: number;
  /** K-factor for ELO changes. */
  readonly kFactor: number;
  /** Points for fastest solve (time bonus). */
  readonly speedBonusMax: number;
  /** Enable instant elimination on verification failure. */
  readonly suddenDeath: boolean;
  /** Min combatants to start. */
  readonly minCombatants: number;
  /** Max combatants (0 = unlimited). */
  readonly maxCombatants: number;
}

// ─── Default Config ───────────────────────────────────────────

export const DEFAULT_ARENA_CONFIG: ArenaConfig = {
  rounds: 3,
  kFactor: DEFAULT_K_FACTOR,
  speedBonusMax: 50,
  suddenDeath: false,
  minCombatants: 2,
  maxCombatants: 8,
};

// ─── Arena Manager ────────────────────────────────────────────

export class ArenaManager {
  private arenas = new Map<string, Arena>();
  private combatantElos = new Map<string, number>(); // persistent ELO store
  private eventHandlers: FleetEventHandler[] = [];
  private store: ConvoyStore;

  constructor(store: ConvoyStore) {
    this.store = store;
  }

  // ─── Events ────────────────────────────────────────

  on(handler: FleetEventHandler): void {
    this.eventHandlers.push(handler);
  }

  private emit(event: FleetEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // swallow
      }
    }
  }

  // ─── Arena Lifecycle ───────────────────────────────

  /** Create a new arena with a challenge. */
  createArena(
    name: string,
    challenge: Omit<ArenaChallenge, "beadId">,
    config?: Partial<ArenaConfig>,
  ): Arena {
    const arenaId = `arena-${nanoid(6)}`;
    const mergedConfig = { ...DEFAULT_ARENA_CONFIG, ...config };

    // Create bead for the challenge
    const bead = createBead({
      prefix: arenaId,
      title: challenge.title,
      description: challenge.description,
      role: "general",
      priority: this.difficultyToPriority(challenge.difficulty),
    });
    this.store.addBead(bead);

    const arena: Arena = {
      id: arenaId,
      name,
      challenge: { ...challenge, beadId: bead.id },
      combatants: [],
      rounds: [],
      config: mergedConfig,
      status: "setup",
      createdAt: new Date(),
      completedAt: null,
    };

    this.arenas.set(arenaId, arena);
    return arena;
  }

  /** Add a combatant to the arena (polecat or named AI). */
  addCombatant(
    arenaId: string,
    name: string,
    runtime: AgentRuntime,
    polecatId?: string,
  ): Combatant {
    const arena = this.getOrThrow(arenaId);
    if (arena.status !== "setup") {
      throw new Error(`Cannot add combatants: arena is ${arena.status}`);
    }
    if (
      arena.config.maxCombatants > 0 &&
      arena.combatants.length >= arena.config.maxCombatants
    ) {
      throw new Error("Max combatants reached");
    }

    const combatantId = `cmb-${nanoid(5)}`;
    const existingElo = polecatId
      ? this.combatantElos.get(polecatId)
      : undefined;

    const combatant: Combatant = {
      id: combatantId,
      polecatId: polecatId ?? null,
      name,
      runtime,
      elo: existingElo ?? DEFAULT_ELO,
      wins: 0,
      losses: 0,
      draws: 0,
    };

    const updated = {
      ...arena,
      combatants: [...arena.combatants, combatant],
    };
    this.arenas.set(arenaId, updated);

    return combatant;
  }

  /** Start the battle! */
  startBattle(arenaId: string): Arena {
    const arena = this.getOrThrow(arenaId);
    if (arena.status !== "setup") {
      throw new Error(`Cannot start: arena is ${arena.status}`);
    }
    if (arena.combatants.length < arena.config.minCombatants) {
      throw new Error(
        `Need at least ${arena.config.minCombatants} combatants to start`,
      );
    }

    const updated: Arena = {
      ...arena,
      status: "battling",
      rounds: [this.createRound(1)],
    };
    this.arenas.set(arenaId, updated);

    return updated;
  }

  /** Submit a result for a combatant in the current round. */
  submitResult(
    arenaId: string,
    combatantId: string,
    result: AgentResult,
    verification: VerificationResult,
    testResults: TestResult[],
    timeMs: number,
  ): RoundSubmission {
    const arena = this.getOrThrow(arenaId);
    if (arena.status !== "battling") {
      throw new Error(`Cannot submit: arena is ${arena.status}`);
    }

    const currentRound = arena.rounds[arena.rounds.length - 1];
    if (!currentRound) throw new Error("No active round");

    const combatant = arena.combatants.find((c) => c.id === combatantId);
    if (!combatant) throw new Error(`Combatant ${combatantId} not found`);

    // Check for duplicate submission
    if (currentRound.submissions.some((s) => s.combatantId === combatantId)) {
      throw new Error(`Combatant ${combatantId} already submitted`);
    }

    const submission: RoundSubmission = {
      combatantId,
      result,
      verification,
      testResults,
      timeMs,
      submittedAt: new Date(),
    };

    // Update round with new submission
    const updatedRound: ArenaRound = {
      ...currentRound,
      submissions: [...currentRound.submissions, submission],
    };

    const updatedRounds = [...arena.rounds];
    updatedRounds[updatedRounds.length - 1] = updatedRound;

    this.arenas.set(arenaId, { ...arena, rounds: updatedRounds });

    return submission;
  }

  /** End the current round, calculate rankings, update ELOs. */
  endRound(arenaId: string): RoundRanking[] {
    const arena = this.getOrThrow(arenaId);
    if (arena.status !== "battling") {
      throw new Error(`Cannot end round: arena is ${arena.status}`);
    }

    const currentRound = arena.rounds[arena.rounds.length - 1];
    if (!currentRound) throw new Error("No active round");

    // Calculate rankings
    const rankings = this.calculateRankings(arena, currentRound);

    // Update ELOs based on rankings
    this.updateElosFromRankings(arena, rankings);

    // Finalize round
    const finalizedRound: ArenaRound = {
      ...currentRound,
      endedAt: new Date(),
      rankings,
    };

    const updatedRounds = [...arena.rounds];
    updatedRounds[updatedRounds.length - 1] = finalizedRound;

    // Check if we need another round
    const nextRoundNum = arena.rounds.length + 1;
    const isLastRound = arena.rounds.length >= arena.config.rounds;

    let updated: Arena;
    if (isLastRound) {
      updated = {
        ...arena,
        rounds: updatedRounds,
        status: "judging",
      };
    } else {
      updated = {
        ...arena,
        rounds: [...updatedRounds, this.createRound(nextRoundNum)],
      };
    }

    this.arenas.set(arenaId, updated);
    return rankings;
  }

  /** Finalize the arena and declare winner(s). */
  finalize(arenaId: string): ArenaSummary {
    const arena = this.getOrThrow(arenaId);
    if (arena.status !== "judging") {
      throw new Error(`Cannot finalize: arena is ${arena.status}`);
    }

    const summary = this.calculateSummary(arena);

    const updated: Arena = {
      ...arena,
      status: "completed",
      completedAt: new Date(),
    };
    this.arenas.set(arenaId, updated);

    this.emit({
      type: "convoy_completed",
      convoyId: arena.id,
      successRate: summary.winner ? 1 : 0,
    });

    return summary;
  }

  // ─── Querying ──────────────────────────────────────

  get(arenaId: string): Arena | undefined {
    return this.arenas.get(arenaId);
  }

  private getOrThrow(arenaId: string): Arena {
    const a = this.arenas.get(arenaId);
    if (!a) throw new Error(`Arena ${arenaId} not found`);
    return a;
  }

  list(): Arena[] {
    return Array.from(this.arenas.values());
  }

  listActive(): Arena[] {
    return this.list().filter((a) => a.status === "battling");
  }

  getLeaderboard(arenaId: string): CombatantStanding[] {
    const arena = this.getOrThrow(arenaId);
    return this.buildStandings(arena);
  }

  getCombatantElo(combatantId: string): number {
    return this.combatantElos.get(combatantId) ?? DEFAULT_ELO;
  }

  // ─── Private Helpers ───────────────────────────────

  private createRound(roundNumber: number): ArenaRound {
    return {
      roundNumber,
      submissions: [],
      startedAt: new Date(),
      endedAt: null,
      rankings: [],
    };
  }

  private calculateRankings(arena: Arena, round: ArenaRound): RoundRanking[] {
    const scores: Array<{
      combatantId: string;
      testScore: number;
      testsPassed: number;
      totalTests: number;
      timeMs: number;
    }> = [];

    for (const sub of round.submissions) {
      const testsPassed = sub.testResults.filter((t) => t.passed).length;
      const totalTests = sub.testResults.length;

      // Calculate weighted test score
      let testScore = 0;
      for (const tr of sub.testResults) {
        const testCase = arena.challenge.testCases.find((tc) => tc.id === tr.testCaseId);
        if (tr.passed && testCase) {
          testScore += testCase.weight;
        }
      }

      scores.push({
        combatantId: sub.combatantId,
        testScore,
        testsPassed,
        totalTests,
        timeMs: sub.timeMs,
      });
    }

    // Sort by test score (desc), then by time (asc)
    scores.sort((a, b) => {
      if (b.testScore !== a.testScore) return b.testScore - a.testScore;
      return a.timeMs - b.timeMs;
    });

    // Calculate time bonus for fastest solver
    const fastestTime = Math.min(...scores.map((s) => s.timeMs));

    return scores.map((s, i) => {
      const timeBonus =
        s.timeMs === fastestTime ? arena.config.speedBonusMax : 0;

      return {
        rank: i + 1,
        combatantId: s.combatantId,
        score: s.testScore + timeBonus,
        testsPassed: s.testsPassed,
        totalTests: s.totalTests,
        timeBonus,
        eloChange: 0, // Updated by updateElosFromRankings
      };
    });
  }

  private updateElosFromRankings(arena: Arena, rankings: RoundRanking[]): void {
    if (rankings.length < 2) return;

    // Everyone "plays" against everyone
    const changes = new Map<string, number>();

    for (let i = 0; i < rankings.length; i++) {
      for (let j = i + 1; j < rankings.length; j++) {
        const rA = rankings[i]!;
        const rB = rankings[j]!;

        const cA = arena.combatants.find((c) => c.id === rA.combatantId);
        const cB = arena.combatants.find((c) => c.id === rB.combatantId);
        if (!cA || !cB) continue;

        const eloA = this.combatantElos.get(cA.polecatId ?? cA.id) ?? cA.elo;
        const eloB = this.combatantElos.get(cB.polecatId ?? cB.id) ?? cB.elo;

        // Higher rank = win
        const scoreA = rA.rank < rB.rank ? 1 : rA.rank > rB.rank ? 0 : 0.5;
        const scoreB = 1 - scoreA;

        const changeA = calculateEloChange(eloA, eloB, scoreA, arena.config.kFactor).change;
        const changeB = calculateEloChange(eloB, eloA, scoreB, arena.config.kFactor).change;

        const keyA = cA.polecatId ?? cA.id;
        const keyB = cB.polecatId ?? cB.id;

        changes.set(keyA, (changes.get(keyA) ?? 0) + changeA);
        changes.set(keyB, (changes.get(keyB) ?? 0) + changeB);
      }
    }

    // Apply changes
    for (const [key, delta] of changes) {
      const current = this.combatantElos.get(key) ?? DEFAULT_ELO;
      this.combatantElos.set(key, current + delta);
    }
  }

  private buildStandings(arena: Arena): CombatantStanding[] {
    const totals = new Map<string, {
      totalScore: number;
      roundsWon: number;
      roundsPlayed: number;
    }>();

    for (const combatant of arena.combatants) {
      totals.set(combatant.id, { totalScore: 0, roundsWon: 0, roundsPlayed: 0 });
    }

    for (const round of arena.rounds) {
      if (round.rankings.length === 0) continue;

      for (const ranking of round.rankings) {
        const t = totals.get(ranking.combatantId);
        if (!t) continue;

        t.totalScore += ranking.score;
        t.roundsPlayed++;
        if (ranking.rank === 1) t.roundsWon++;
      }
    }

    const standings: CombatantStanding[] = arena.combatants.map((c) => {
      const t = totals.get(c.id)!;
      const currentElo = this.combatantElos.get(c.polecatId ?? c.id) ?? c.elo;

      return {
        combatantId: c.id,
        combatantName: c.name,
        runtime: c.runtime.provider,
        totalScore: t.totalScore,
        roundsWon: t.roundsWon,
        roundsPlayed: t.roundsPlayed,
        elo: currentElo,
        eloChange: currentElo - c.elo,
      };
    });

    standings.sort((a, b) => {
      if (b.roundsWon !== a.roundsWon) return b.roundsWon - a.roundsWon;
      return b.totalScore - a.totalScore;
    });

    return standings;
  }

  private calculateSummary(arena: Arena): ArenaSummary {
    const standings = this.buildStandings(arena);
    const winner = standings.length > 0 && standings[0]!.roundsWon > 0
      ? standings[0]
      : null;

    return {
      arenaId: arena.id,
      arenaName: arena.name,
      challengeTitle: arena.challenge.title,
      totalRounds: arena.rounds.length,
      combatantsCount: arena.combatants.length,
      winner: winner ? {
        combatantId: winner.combatantId,
        combatantName: winner.combatantName,
        runtime: winner.runtime,
        finalElo: winner.elo,
      } : null,
      standings,
    };
  }

  private difficultyToPriority(difficulty: ChallengeDifficulty): BeadPriority {
    switch (difficulty) {
      case "nightmare":
        return "critical";
      case "hard":
        return "high";
      case "medium":
        return "medium";
      case "easy":
        return "low";
    }
  }
}

// ─── Summary Types ────────────────────────────────────────────

export interface CombatantStanding {
  readonly combatantId: string;
  readonly combatantName: string;
  readonly runtime: string;
  readonly totalScore: number;
  readonly roundsWon: number;
  readonly roundsPlayed: number;
  readonly elo: number;
  readonly eloChange: number;
}

export interface ArenaSummary {
  readonly arenaId: string;
  readonly arenaName: string;
  readonly challengeTitle: string;
  readonly totalRounds: number;
  readonly combatantsCount: number;
  readonly winner: {
    readonly combatantId: string;
    readonly combatantName: string;
    readonly runtime: string;
    readonly finalElo: number;
  } | null;
  readonly standings: CombatantStanding[];
}
