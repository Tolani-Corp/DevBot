// ──────────────────────────────────────────────────────────────
// DevTown — Bounty Board Module
// External task marketplace with escrow, claims, and deadlines.
// Supports both human and AI claimants (polecats).
// ──────────────────────────────────────────────────────────────

import { nanoid } from "nanoid";
import type {
  Bead,
  BeadPriority,
  FleetEvent,
  FleetEventHandler,
} from "./types.js";
import type { AgentRole, AgentResult, VerificationResult } from "../agents/types.js";
import { createBead, ConvoyStore } from "./convoy.js";

// ─── Bounty Types ─────────────────────────────────────────────

export type BountyStatus =
  | "draft"
  | "open"
  | "claimed"
  | "in_progress"
  | "submitted"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";

export interface Bounty {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly beadId: string;
  readonly poster: BountyPoster;
  readonly reward: BountyReward;
  readonly requirements: BountyRequirements;
  readonly status: BountyStatus;
  readonly claims: BountyClaim[];
  readonly activeClaim: string | null; // claimId
  readonly createdAt: Date;
  readonly expiresAt: Date | null;
  readonly completedAt: Date | null;
}

export interface BountyPoster {
  readonly id: string;
  readonly name: string;
  readonly type: "human" | "organization" | "system";
  readonly reputation: number; // 0-100
}

export interface BountyReward {
  readonly amount: number;
  readonly currency: string; // "uTUT", "USD", "credits"
  /** Escrow: amount locked until approval. */
  readonly escrowed: boolean;
  /** Bonus for early completion. */
  readonly earlyBonus: number;
  /** Penalty per day late (if allowed). */
  readonly latePenaltyPerDay: number;
}

export interface BountyRequirements {
  readonly role: AgentRole;
  readonly difficulty: BountyDifficulty;
  /** Must pass verification to be approved. */
  readonly requiresVerification: boolean;
  /** Must pass test cases. */
  readonly testCases: BountyTestCase[];
  /** Max claim duration in hours. */
  readonly maxClaimHours: number;
  /** Allow AI (polecat) claimants. */
  readonly allowAI: boolean;
  /** Allow human claimants. */
  readonly allowHuman: boolean;
  /** Min reputation to claim. */
  readonly minReputation: number;
}

export type BountyDifficulty = "trivial" | "easy" | "medium" | "hard" | "extreme";

export interface BountyTestCase {
  readonly id: string;
  readonly description: string;
  readonly weight: number;
}

export type ClaimStatus =
  | "pending"
  | "approved_to_work"
  | "working"
  | "submitted"
  | "approved"
  | "rejected"
  | "abandoned"
  | "expired";

export interface BountyClaim {
  readonly id: string;
  readonly bountyId: string;
  readonly claimant: Claimant;
  readonly status: ClaimStatus;
  readonly claimedAt: Date;
  readonly deadline: Date;
  readonly submission: BountySubmission | null;
  readonly reviewNotes: string[];
}

export interface Claimant {
  readonly id: string;
  readonly name: string;
  readonly type: "human" | "ai";
  readonly polecatId: string | null;
  readonly reputation: number;
}

export interface BountySubmission {
  readonly result: AgentResult;
  readonly verification: VerificationResult | null;
  readonly submittedAt: Date;
  readonly testResults: Array<{ testId: string; passed: boolean }>;
}

// ─── Default Values ───────────────────────────────────────────

export const DEFAULT_REQUIREMENTS: BountyRequirements = {
  role: "general",
  difficulty: "medium",
  requiresVerification: true,
  testCases: [],
  maxClaimHours: 24,
  allowAI: true,
  allowHuman: true,
  minReputation: 0,
};

// ─── Bounty Board ─────────────────────────────────────────────

export class BountyBoard {
  private bounties = new Map<string, Bounty>();
  private claimantReputations = new Map<string, number>();
  private escrowBalance = new Map<string, number>(); // bountyId → escrowed amount
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

  // ─── Bounty Lifecycle ──────────────────────────────

  /** Create a new bounty (poster funds escrow). */
  createBounty(
    title: string,
    description: string,
    poster: BountyPoster,
    reward: BountyReward,
    requirements?: Partial<BountyRequirements>,
    expiresInHours?: number,
  ): Bounty {
    const bountyId = `bounty-${nanoid(6)}`;
    const mergedReqs = { ...DEFAULT_REQUIREMENTS, ...requirements };

    // Create underlying bead
    const bead = createBead({
      prefix: bountyId,
      title,
      description,
      role: mergedReqs.role,
      priority: this.difficultyToPriority(mergedReqs.difficulty),
    });
    this.store.addBead(bead);

    const bounty: Bounty = {
      id: bountyId,
      title,
      description,
      beadId: bead.id,
      poster,
      reward,
      requirements: mergedReqs,
      status: "draft",
      claims: [],
      activeClaim: null,
      createdAt: new Date(),
      expiresAt: expiresInHours
        ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
        : null,
      completedAt: null,
    };

    this.bounties.set(bountyId, bounty);

    // Escrow the reward
    if (reward.escrowed) {
      this.escrowBalance.set(bountyId, reward.amount);
    }

    return bounty;
  }

  /** Publish bounty (make it open for claims). */
  publish(bountyId: string): Bounty {
    const bounty = this.getOrThrow(bountyId);
    if (bounty.status !== "draft") {
      throw new Error(`Cannot publish: bounty is ${bounty.status}`);
    }

    const updated = { ...bounty, status: "open" as const };
    this.bounties.set(bountyId, updated);
    return updated;
  }

  /** Claim a bounty (request to work on it). */
  claim(
    bountyId: string,
    claimant: Omit<Claimant, "reputation">,
  ): BountyClaim {
    const bounty = this.getOrThrow(bountyId);
    if (bounty.status !== "open") {
      throw new Error(`Cannot claim: bounty is ${bounty.status}`);
    }

    // Check claimant eligibility
    if (claimant.type === "ai" && !bounty.requirements.allowAI) {
      throw new Error("AI claimants not allowed");
    }
    if (claimant.type === "human" && !bounty.requirements.allowHuman) {
      throw new Error("Human claimants not allowed");
    }

    const reputation = this.claimantReputations.get(claimant.id) ?? 50;
    if (reputation < bounty.requirements.minReputation) {
      throw new Error(
        `Insufficient reputation: ${reputation} < ${bounty.requirements.minReputation}`,
      );
    }

    const claim: BountyClaim = {
      id: `claim-${nanoid(5)}`,
      bountyId,
      claimant: { ...claimant, reputation },
      status: "pending",
      claimedAt: new Date(),
      deadline: new Date(
        Date.now() + bounty.requirements.maxClaimHours * 60 * 60 * 1000,
      ),
      submission: null,
      reviewNotes: [],
    };

    const updated = {
      ...bounty,
      claims: [...bounty.claims, claim],
    };
    this.bounties.set(bountyId, updated);

    return claim;
  }

  /** Approve a claim (allow claimant to start work). */
  approveClaim(bountyId: string, claimId: string): Bounty {
    const bounty = this.getOrThrow(bountyId);
    const claimIdx = bounty.claims.findIndex((c) => c.id === claimId);
    if (claimIdx === -1) throw new Error(`Claim ${claimId} not found`);

    const claim = bounty.claims[claimIdx]!;
    if (claim.status !== "pending") {
      throw new Error(`Cannot approve: claim is ${claim.status}`);
    }

    const updatedClaims = [...bounty.claims];
    updatedClaims[claimIdx] = { ...claim, status: "approved_to_work" };

    const updated: Bounty = {
      ...bounty,
      status: "claimed",
      claims: updatedClaims,
      activeClaim: claimId,
    };
    this.bounties.set(bountyId, updated);

    return updated;
  }

  /** Start work on a claimed bounty. */
  startWork(bountyId: string, claimId: string): Bounty {
    const bounty = this.getOrThrow(bountyId);
    const claimIdx = bounty.claims.findIndex((c) => c.id === claimId);
    if (claimIdx === -1) throw new Error(`Claim ${claimId} not found`);

    const claim = bounty.claims[claimIdx]!;
    if (claim.status !== "approved_to_work") {
      throw new Error(`Cannot start: claim is ${claim.status}`);
    }

    const updatedClaims = [...bounty.claims];
    updatedClaims[claimIdx] = { ...claim, status: "working" };

    const updated: Bounty = {
      ...bounty,
      status: "in_progress",
      claims: updatedClaims,
    };
    this.bounties.set(bountyId, updated);

    // Mark bead as in-progress
    this.store.startBead(bounty.beadId);

    return updated;
  }

  /** Submit work for review. */
  submit(
    bountyId: string,
    claimId: string,
    result: AgentResult,
    verification: VerificationResult | null,
    testResults: Array<{ testId: string; passed: boolean }>,
  ): Bounty {
    const bounty = this.getOrThrow(bountyId);
    const claimIdx = bounty.claims.findIndex((c) => c.id === claimId);
    if (claimIdx === -1) throw new Error(`Claim ${claimId} not found`);

    const claim = bounty.claims[claimIdx]!;
    if (claim.status !== "working") {
      throw new Error(`Cannot submit: claim is ${claim.status}`);
    }

    // Check deadline
    if (new Date() > claim.deadline) {
      // Late submission — apply penalty or reject
      const daysLate = Math.ceil(
        (Date.now() - claim.deadline.getTime()) / (24 * 60 * 60 * 1000),
      );
      if (bounty.reward.latePenaltyPerDay === 0 && daysLate > 0) {
        throw new Error("Deadline passed, submission rejected");
      }
    }

    const submission: BountySubmission = {
      result,
      verification,
      submittedAt: new Date(),
      testResults,
    };

    const updatedClaims = [...bounty.claims];
    updatedClaims[claimIdx] = {
      ...claim,
      status: "submitted",
      submission,
    };

    const updated: Bounty = {
      ...bounty,
      status: "submitted",
      claims: updatedClaims,
    };
    this.bounties.set(bountyId, updated);

    return updated;
  }

  /** Approve submission and release reward. */
  approve(bountyId: string, claimId: string, notes?: string): BountyApprovalResult {
    const bounty = this.getOrThrow(bountyId);
    const claimIdx = bounty.claims.findIndex((c) => c.id === claimId);
    if (claimIdx === -1) throw new Error(`Claim ${claimId} not found`);

    const claim = bounty.claims[claimIdx]!;
    if (claim.status !== "submitted") {
      throw new Error(`Cannot approve: claim is ${claim.status}`);
    }

    // Check verification
    if (
      bounty.requirements.requiresVerification &&
      !claim.submission?.verification?.passed
    ) {
      throw new Error("Verification must pass before approval");
    }

    // Calculate reward
    let finalReward = bounty.reward.amount;
    const now = new Date();

    // Early bonus
    if (now < claim.deadline && bounty.reward.earlyBonus > 0) {
      const hoursEarly =
        (claim.deadline.getTime() - now.getTime()) / (60 * 60 * 1000);
      finalReward += Math.min(bounty.reward.earlyBonus, hoursEarly * 10);
    }

    // Late penalty
    if (now > claim.deadline && bounty.reward.latePenaltyPerDay > 0) {
      const daysLate = Math.ceil(
        (now.getTime() - claim.deadline.getTime()) / (24 * 60 * 60 * 1000),
      );
      finalReward -= daysLate * bounty.reward.latePenaltyPerDay;
      finalReward = Math.max(0, finalReward);
    }

    // Update claim
    const updatedClaims = [...bounty.claims];
    updatedClaims[claimIdx] = {
      ...claim,
      status: "approved",
      reviewNotes: notes ? [...claim.reviewNotes, notes] : claim.reviewNotes,
    };

    const updated: Bounty = {
      ...bounty,
      status: "approved",
      claims: updatedClaims,
      completedAt: new Date(),
    };
    this.bounties.set(bountyId, updated);

    // Update claimant reputation (+5 for success)
    const currentRep = this.claimantReputations.get(claim.claimant.id) ?? 50;
    this.claimantReputations.set(claim.claimant.id, Math.min(100, currentRep + 5));

    // Release escrow
    this.escrowBalance.delete(bountyId);

    // Update bead
    this.store.completeBead(
      bounty.beadId,
      claim.submission!.result,
      claim.submission!.verification ?? { passed: true, errors: [], suggestions: [] },
    );

    this.emit({
      type: "convoy_completed",
      convoyId: bountyId,
      successRate: 1,
    });

    return {
      bountyId,
      claimId,
      claimantId: claim.claimant.id,
      originalReward: bounty.reward.amount,
      finalReward,
      currency: bounty.reward.currency,
      newReputation: this.claimantReputations.get(claim.claimant.id)!,
    };
  }

  /** Reject submission. */
  reject(bountyId: string, claimId: string, reason: string): Bounty {
    const bounty = this.getOrThrow(bountyId);
    const claimIdx = bounty.claims.findIndex((c) => c.id === claimId);
    if (claimIdx === -1) throw new Error(`Claim ${claimId} not found`);

    const claim = bounty.claims[claimIdx]!;
    if (claim.status !== "submitted") {
      throw new Error(`Cannot reject: claim is ${claim.status}`);
    }

    const updatedClaims = [...bounty.claims];
    updatedClaims[claimIdx] = {
      ...claim,
      status: "rejected",
      reviewNotes: [...claim.reviewNotes, `REJECTED: ${reason}`],
    };

    // Update claimant reputation (-3 for rejection)
    const currentRep = this.claimantReputations.get(claim.claimant.id) ?? 50;
    this.claimantReputations.set(claim.claimant.id, Math.max(0, currentRep - 3));

    const updated: Bounty = {
      ...bounty,
      status: "rejected",
      claims: updatedClaims,
      activeClaim: null,
    };
    this.bounties.set(bountyId, updated);

    return updated;
  }

  /** Mark bounty as expired (called by scheduler). */
  expire(bountyId: string): Bounty {
    const bounty = this.getOrThrow(bountyId);
    if (bounty.status === "approved" || bounty.status === "cancelled") {
      throw new Error(`Cannot expire: bounty is ${bounty.status}`);
    }

    // Refund escrow
    this.escrowBalance.delete(bountyId);

    const updated: Bounty = {
      ...bounty,
      status: "expired",
    };
    this.bounties.set(bountyId, updated);

    return updated;
  }

  /** Cancel bounty (poster action). */
  cancel(bountyId: string, reason: string): Bounty {
    const bounty = this.getOrThrow(bountyId);
    if (bounty.status === "approved") {
      throw new Error("Cannot cancel approved bounty");
    }
    if (bounty.status === "in_progress" || bounty.status === "submitted") {
      throw new Error("Cannot cancel bounty with active work");
    }

    // Refund escrow
    this.escrowBalance.delete(bountyId);

    const updated: Bounty = {
      ...bounty,
      status: "cancelled",
    };
    this.bounties.set(bountyId, updated);

    return updated;
  }

  // ─── Querying ──────────────────────────────────────

  get(bountyId: string): Bounty | undefined {
    return this.bounties.get(bountyId);
  }

  private getOrThrow(bountyId: string): Bounty {
    const b = this.bounties.get(bountyId);
    if (!b) throw new Error(`Bounty ${bountyId} not found`);
    return b;
  }

  list(): Bounty[] {
    return Array.from(this.bounties.values());
  }

  listOpen(): Bounty[] {
    return this.list().filter((b) => b.status === "open");
  }

  listByPoster(posterId: string): Bounty[] {
    return this.list().filter((b) => b.poster.id === posterId);
  }

  listByClaimant(claimantId: string): Bounty[] {
    return this.list().filter((b) =>
      b.claims.some((c) => c.claimant.id === claimantId),
    );
  }

  getClaimantReputation(claimantId: string): number {
    return this.claimantReputations.get(claimantId) ?? 50;
  }

  getEscrowedAmount(bountyId: string): number {
    return this.escrowBalance.get(bountyId) ?? 0;
  }

  getTotalEscrow(): number {
    let total = 0;
    for (const amount of this.escrowBalance.values()) {
      total += amount;
    }
    return total;
  }

  // ─── Helpers ───────────────────────────────────────

  private difficultyToPriority(difficulty: BountyDifficulty): BeadPriority {
    switch (difficulty) {
      case "extreme":
        return "critical";
      case "hard":
        return "high";
      case "medium":
        return "medium";
      case "easy":
      case "trivial":
        return "low";
    }
  }
}

// ─── Result Types ─────────────────────────────────────────────

export interface BountyApprovalResult {
  readonly bountyId: string;
  readonly claimId: string;
  readonly claimantId: string;
  readonly originalReward: number;
  readonly finalReward: number;
  readonly currency: string;
  readonly newReputation: number;
}
