// ──────────────────────────────────────────────────────────────
// DevTown — Hackathon Module
// Thin layer over convoy/bead system for hackathon semantics.
// Includes ELO rating system for participant ranking.
// ──────────────────────────────────────────────────────────────

import { nanoid } from "nanoid";
import type {
  Convoy,
  ConvoyProgress,
  Bead,
  BeadPriority,
  Polecat,
  PolecatStats,
  FleetEvent,
  FleetEventHandler,
} from "./types.js";
import type { AgentRole, AgentResult, VerificationResult } from "../agents/types.js";
import { createBead, createConvoy, ConvoyStore, calculateProgress } from "./convoy.js";

// ─── ELO Rating System ────────────────────────────────────────

/** Default starting ELO for new participants. */
export const DEFAULT_ELO = 1200;

/** K-factor determines how much ratings change per match. */
export const DEFAULT_K_FACTOR = 32;

/** Calculate expected win probability using ELO formula. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/** Calculate new ELO rating after a match. */
export function calculateEloChange(
  currentRating: number,
  opponentRating: number,
  actualScore: number, // 1 = win, 0.5 = draw, 0 = loss
  kFactor: number = DEFAULT_K_FACTOR,
): { newRating: number; change: number } {
  const expected = expectedScore(currentRating, opponentRating);
  const change = Math.round(kFactor * (actualScore - expected));
  return {
    newRating: currentRating + change,
    change,
  };
}

/** Batch update ELO ratings for all participants based on final rankings. */
export function updateEloFromRankings(
  participants: ParticipantRating[],
  kFactor: number = DEFAULT_K_FACTOR,
): ParticipantRating[] {
  if (participants.length < 2) return participants;

  // Sort by score (descending) to get rankings
  const sorted = [...participants].sort((a, b) => b.score - a.score);

  // Each participant "plays" against every other participant
  // Win = higher score, Loss = lower score, Draw = same score
  const updates = new Map<string, number>();

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const pA = sorted[i]!;
      const pB = sorted[j]!;

      let scoreA: number;
      let scoreB: number;

      if (pA.score > pB.score) {
        scoreA = 1;
        scoreB = 0;
      } else if (pA.score < pB.score) {
        scoreA = 0;
        scoreB = 1;
      } else {
        scoreA = 0.5;
        scoreB = 0.5;
      }

      const changeA = calculateEloChange(pA.elo, pB.elo, scoreA, kFactor).change;
      const changeB = calculateEloChange(pB.elo, pA.elo, scoreB, kFactor).change;

      updates.set(pA.id, (updates.get(pA.id) ?? 0) + changeA);
      updates.set(pB.id, (updates.get(pB.id) ?? 0) + changeB);
    }
  }

  return participants.map((p) => ({
    ...p,
    elo: p.elo + (updates.get(p.id) ?? 0),
  }));
}

// ─── Hackathon Types ──────────────────────────────────────────

export interface Hackathon {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly convoyId: string;
  readonly challenges: Challenge[];
  readonly participants: Participant[];
  readonly config: HackathonConfig;
  readonly status: HackathonStatus;
  readonly startedAt: Date | null;
  readonly endsAt: Date | null;
  readonly completedAt: Date | null;
}

export type HackathonStatus = "draft" | "registration" | "active" | "judging" | "completed" | "cancelled";

export interface HackathonConfig {
  /** Max participants (0 = unlimited). */
  readonly maxParticipants: number;
  /** Duration in minutes (0 = no limit). */
  readonly durationMinutes: number;
  /** Allow AI participants (polecats). */
  readonly allowAI: boolean;
  /** Allow human participants. */
  readonly allowHumans: boolean;
  /** Scoring rubric weights. */
  readonly rubric: ScoringRubric;
  /** K-factor for ELO updates. */
  readonly kFactor: number;
  /** Prize pool (uTUT or other token). */
  readonly prizePool: number;
  /** Prize distribution (e.g., [0.5, 0.3, 0.2] for top 3). */
  readonly prizeDistribution: number[];
}

export interface ScoringRubric {
  /** Weight for code quality (0-1). */
  readonly codeQuality: number;
  /** Weight for test coverage (0-1). */
  readonly testCoverage: number;
  /** Weight for completion speed (0-1). */
  readonly speed: number;
  /** Weight for verification passing (0-1). */
  readonly verification: number;
  /** Weight for creativity/innovation (0-1, judge-assigned). */
  readonly creativity: number;
}

export interface Challenge {
  readonly id: string;
  readonly beadId: string;
  readonly title: string;
  readonly description: string;
  readonly difficulty: ChallengeDifficulty;
  readonly maxPoints: number;
  readonly timeBonus: number; // Bonus points per minute under par
  readonly parTimeMinutes: number; // Expected completion time
}

export type ChallengeDifficulty = "beginner" | "intermediate" | "advanced" | "expert";

export interface Participant {
  readonly id: string;
  readonly name: string;
  readonly type: "human" | "ai";
  readonly polecatId: string | null; // If AI, link to polecat
  readonly registeredAt: Date;
}

export interface ParticipantRating {
  readonly id: string;
  readonly name: string;
  elo: number;
  score: number;
}

export interface Submission {
  readonly id: string;
  readonly participantId: string;
  readonly challengeId: string;
  readonly beadId: string;
  readonly result: AgentResult | null;
  readonly verification: VerificationResult | null;
  readonly submittedAt: Date;
  readonly score: SubmissionScore | null;
}

export interface SubmissionScore {
  readonly codeQuality: number; // 0-100
  readonly testCoverage: number; // 0-100
  readonly speedBonus: number; // Can be negative if over par
  readonly verificationScore: number; // 0-100
  readonly creativityScore: number; // 0-100 (judge-assigned)
  readonly totalPoints: number;
  readonly rank: number;
}

export interface LeaderboardEntry {
  readonly rank: number;
  readonly participantId: string;
  readonly participantName: string;
  readonly participantType: "human" | "ai";
  readonly totalScore: number;
  readonly challengesCompleted: number;
  readonly challengesFailed: number;
  readonly avgCompletionTimeMs: number;
  readonly elo: number;
  readonly eloChange: number;
  readonly prizeAmount: number;
}

// ─── Default Config ───────────────────────────────────────────

export const DEFAULT_RUBRIC: ScoringRubric = {
  codeQuality: 0.25,
  testCoverage: 0.20,
  speed: 0.15,
  verification: 0.25,
  creativity: 0.15,
};

export const DEFAULT_HACKATHON_CONFIG: HackathonConfig = {
  maxParticipants: 0,
  durationMinutes: 120,
  allowAI: true,
  allowHumans: true,
  rubric: DEFAULT_RUBRIC,
  kFactor: DEFAULT_K_FACTOR,
  prizePool: 0,
  prizeDistribution: [0.5, 0.3, 0.2],
};

// ─── Hackathon Manager ────────────────────────────────────────

export class HackathonManager {
  private hackathons = new Map<string, Hackathon>();
  private submissions = new Map<string, Submission[]>(); // hackathonId → submissions
  private participantElos = new Map<string, number>(); // participantId → elo
  private store: ConvoyStore;
  private eventHandlers: FleetEventHandler[] = [];

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

  // ─── Hackathon Lifecycle ───────────────────────────

  /** Create a new hackathon. */
  create(
    name: string,
    description: string,
    challenges: Array<Omit<Challenge, "id" | "beadId">>,
    config?: Partial<HackathonConfig>,
  ): Hackathon {
    const hackathonId = `hack-${nanoid(6)}`;
    const mergedConfig = { ...DEFAULT_HACKATHON_CONFIG, ...config };

    // Create beads for each challenge
    const challengeObjs: Challenge[] = challenges.map((c) => {
      const bead = createBead({
        prefix: hackathonId,
        title: c.title,
        description: c.description,
        role: "general",
        priority: this.difficultyToPriority(c.difficulty),
      });
      this.store.addBead(bead);

      return {
        id: `chal-${nanoid(5)}`,
        beadId: bead.id,
        title: c.title,
        description: c.description,
        difficulty: c.difficulty,
        maxPoints: c.maxPoints,
        timeBonus: c.timeBonus,
        parTimeMinutes: c.parTimeMinutes,
      };
    });

    // Create convoy for this hackathon
    const convoy = createConvoy(
      `Hackathon: ${name}`,
      description,
      challengeObjs.map((c) => c.beadId),
      "human",
    );
    this.store.addConvoy(convoy);

    const hackathon: Hackathon = {
      id: hackathonId,
      name,
      description,
      convoyId: convoy.id,
      challenges: challengeObjs,
      participants: [],
      config: mergedConfig,
      status: "draft",
      startedAt: null,
      endsAt: null,
      completedAt: null,
    };

    this.hackathons.set(hackathonId, hackathon);
    this.submissions.set(hackathonId, []);

    return hackathon;
  }

  /** Open registration for a hackathon. */
  openRegistration(hackathonId: string): Hackathon {
    const hackathon = this.getOrThrow(hackathonId);
    if (hackathon.status !== "draft") {
      throw new Error(`Cannot open registration: hackathon is ${hackathon.status}`);
    }

    const updated = { ...hackathon, status: "registration" as const };
    this.hackathons.set(hackathonId, updated);
    return updated;
  }

  /** Register a participant. */
  register(
    hackathonId: string,
    name: string,
    type: "human" | "ai",
    polecatId?: string,
  ): Participant {
    const hackathon = this.getOrThrow(hackathonId);
    if (hackathon.status !== "registration") {
      throw new Error(`Cannot register: hackathon is ${hackathon.status}`);
    }

    if (type === "ai" && !hackathon.config.allowAI) {
      throw new Error("AI participants not allowed");
    }
    if (type === "human" && !hackathon.config.allowHumans) {
      throw new Error("Human participants not allowed");
    }
    if (
      hackathon.config.maxParticipants > 0 &&
      hackathon.participants.length >= hackathon.config.maxParticipants
    ) {
      throw new Error("Max participants reached");
    }

    const participant: Participant = {
      id: `part-${nanoid(6)}`,
      name,
      type,
      polecatId: polecatId ?? null,
      registeredAt: new Date(),
    };

    // Initialize ELO if not exists
    if (!this.participantElos.has(participant.id)) {
      this.participantElos.set(participant.id, DEFAULT_ELO);
    }

    const updated = {
      ...hackathon,
      participants: [...hackathon.participants, participant],
    };
    this.hackathons.set(hackathonId, updated);

    return participant;
  }

  /** Start the hackathon. */
  start(hackathonId: string): Hackathon {
    const hackathon = this.getOrThrow(hackathonId);
    if (hackathon.status !== "registration") {
      throw new Error(`Cannot start: hackathon is ${hackathon.status}`);
    }
    if (hackathon.participants.length === 0) {
      throw new Error("Cannot start with no participants");
    }

    const now = new Date();
    const endsAt = hackathon.config.durationMinutes > 0
      ? new Date(now.getTime() + hackathon.config.durationMinutes * 60 * 1000)
      : null;

    const updated: Hackathon = {
      ...hackathon,
      status: "active",
      startedAt: now,
      endsAt,
    };
    this.hackathons.set(hackathonId, updated);

    this.emit({
      type: "convoy_created",
      convoyId: hackathon.convoyId,
      beadCount: hackathon.challenges.length,
    });

    return updated;
  }

  /** Submit a solution for a challenge. */
  submit(
    hackathonId: string,
    participantId: string,
    challengeId: string,
    result: AgentResult,
    verification: VerificationResult,
  ): Submission {
    const hackathon = this.getOrThrow(hackathonId);
    if (hackathon.status !== "active") {
      throw new Error(`Cannot submit: hackathon is ${hackathon.status}`);
    }

    // Check deadline
    if (hackathon.endsAt && new Date() > hackathon.endsAt) {
      throw new Error("Hackathon has ended");
    }

    const challenge = hackathon.challenges.find((c) => c.id === challengeId);
    if (!challenge) throw new Error(`Challenge ${challengeId} not found`);

    const participant = hackathon.participants.find((p) => p.id === participantId);
    if (!participant) throw new Error(`Participant ${participantId} not registered`);

    const submission: Submission = {
      id: `sub-${nanoid(6)}`,
      participantId,
      challengeId,
      beadId: challenge.beadId,
      result,
      verification,
      submittedAt: new Date(),
      score: null,
    };

    const subs = this.submissions.get(hackathonId) ?? [];
    subs.push(submission);
    this.submissions.set(hackathonId, subs);

    // Update bead in store
    const bead = this.store.getBead(challenge.beadId);
    if (bead) {
      this.store.completeBead(challenge.beadId, result, verification);
    }

    return submission;
  }

  /** End the hackathon and move to judging. */
  endAndJudge(hackathonId: string): Hackathon {
    const hackathon = this.getOrThrow(hackathonId);
    if (hackathon.status !== "active") {
      throw new Error(`Cannot end: hackathon is ${hackathon.status}`);
    }

    const updated: Hackathon = { ...hackathon, status: "judging" };
    this.hackathons.set(hackathonId, updated);
    return updated;
  }

  /** Score a submission (used during judging). */
  scoreSubmission(
    hackathonId: string,
    submissionId: string,
    scores: Omit<SubmissionScore, "totalPoints" | "rank">,
  ): Submission {
    const hackathon = this.getOrThrow(hackathonId);
    const subs = this.submissions.get(hackathonId) ?? [];
    const idx = subs.findIndex((s) => s.id === submissionId);
    if (idx === -1) throw new Error(`Submission ${submissionId} not found`);

    const submission = subs[idx]!;
    const challenge = hackathon.challenges.find((c) => c.id === submission.challengeId);
    if (!challenge) throw new Error(`Challenge not found`);

    // Calculate weighted total
    const rubric = hackathon.config.rubric;
    const totalPoints = Math.round(
      scores.codeQuality * rubric.codeQuality +
      scores.testCoverage * rubric.testCoverage +
      scores.speedBonus * rubric.speed +
      scores.verificationScore * rubric.verification +
      scores.creativityScore * rubric.creativity,
    );

    const scored: Submission = {
      ...submission,
      score: { ...scores, totalPoints, rank: 0 },
    };

    subs[idx] = scored;
    this.submissions.set(hackathonId, subs);

    return scored;
  }

  /** Finalize hackathon and generate leaderboard. */
  finalize(hackathonId: string): LeaderboardEntry[] {
    const hackathon = this.getOrThrow(hackathonId);
    if (hackathon.status !== "judging") {
      throw new Error(`Cannot finalize: hackathon is ${hackathon.status}`);
    }

    const leaderboard = this.generateLeaderboard(hackathonId);

    // Update ELOs based on final rankings
    const ratings: ParticipantRating[] = leaderboard.map((entry) => ({
      id: entry.participantId,
      name: entry.participantName,
      elo: this.participantElos.get(entry.participantId) ?? DEFAULT_ELO,
      score: entry.totalScore,
    }));

    const updatedRatings = updateEloFromRankings(ratings, hackathon.config.kFactor);
    for (const rating of updatedRatings) {
      this.participantElos.set(rating.id, rating.elo);
    }

    // Mark completed
    const updated: Hackathon = {
      ...hackathon,
      status: "completed",
      completedAt: new Date(),
    };
    this.hackathons.set(hackathonId, updated);

    this.emit({
      type: "convoy_completed",
      convoyId: hackathon.convoyId,
      successRate: leaderboard.length > 0 ? leaderboard[0]!.totalScore / 100 : 0,
    });

    return leaderboard;
  }

  // ─── Leaderboard ───────────────────────────────────

  /** Generate leaderboard from submissions. */
  generateLeaderboard(hackathonId: string): LeaderboardEntry[] {
    const hackathon = this.getOrThrow(hackathonId);
    const subs = this.submissions.get(hackathonId) ?? [];

    // Aggregate scores per participant
    const aggregated = new Map<string, {
      totalScore: number;
      completed: number;
      failed: number;
      totalTimeMs: number;
    }>();

    for (const participant of hackathon.participants) {
      aggregated.set(participant.id, {
        totalScore: 0,
        completed: 0,
        failed: 0,
        totalTimeMs: 0,
      });
    }

    for (const sub of subs) {
      const agg = aggregated.get(sub.participantId);
      if (!agg) continue;

      if (sub.score) {
        agg.totalScore += sub.score.totalPoints;
        agg.completed++;
      } else if (sub.verification && !sub.verification.passed) {
        agg.failed++;
      }

      if (hackathon.startedAt && sub.submittedAt) {
        agg.totalTimeMs += sub.submittedAt.getTime() - hackathon.startedAt.getTime();
      }
    }

    // Build leaderboard entries
    const entries: LeaderboardEntry[] = [];
    for (const participant of hackathon.participants) {
      const agg = aggregated.get(participant.id)!;
      const currentElo = this.participantElos.get(participant.id) ?? DEFAULT_ELO;

      entries.push({
        rank: 0,
        participantId: participant.id,
        participantName: participant.name,
        participantType: participant.type,
        totalScore: agg.totalScore,
        challengesCompleted: agg.completed,
        challengesFailed: agg.failed,
        avgCompletionTimeMs: agg.completed > 0 ? Math.round(agg.totalTimeMs / agg.completed) : 0,
        elo: currentElo,
        eloChange: 0,
        prizeAmount: 0,
      });
    }

    // Sort by score (descending)
    entries.sort((a, b) => b.totalScore - a.totalScore);

    // Assign ranks and prizes
    const prizePool = hackathon.config.prizePool;
    const distribution = hackathon.config.prizeDistribution;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      entries[i] = {
        ...entry,
        rank: i + 1,
        prizeAmount: i < distribution.length
          ? Math.round(prizePool * distribution[i]!)
          : 0,
      };
    }

    return entries;
  }

  // ─── Queries ───────────────────────────────────────

  get(hackathonId: string): Hackathon | undefined {
    return this.hackathons.get(hackathonId);
  }

  private getOrThrow(hackathonId: string): Hackathon {
    const h = this.hackathons.get(hackathonId);
    if (!h) throw new Error(`Hackathon ${hackathonId} not found`);
    return h;
  }

  list(): Hackathon[] {
    return Array.from(this.hackathons.values());
  }

  listActive(): Hackathon[] {
    return this.list().filter((h) => h.status === "active");
  }

  getSubmissions(hackathonId: string): Submission[] {
    return this.submissions.get(hackathonId) ?? [];
  }

  getParticipantElo(participantId: string): number {
    return this.participantElos.get(participantId) ?? DEFAULT_ELO;
  }

  // ─── Helpers ───────────────────────────────────────

  private difficultyToPriority(difficulty: ChallengeDifficulty): BeadPriority {
    switch (difficulty) {
      case "expert":
        return "critical";
      case "advanced":
        return "high";
      case "intermediate":
        return "medium";
      case "beginner":
        return "low";
    }
  }
}
