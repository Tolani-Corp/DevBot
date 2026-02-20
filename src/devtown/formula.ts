// ──────────────────────────────────────────────────────────────
// DevTown — Fleet Formula (Chemistry-Inspired Composition)
//
// Empirical formula algorithm applied to agent fleet sizing:
//   1. Count beads by AgentRole → weight vector
//   2. Normalize to smallest → mole ratios
//   3. Multiply until integers → empirical formula
//   4. Scale to target fleet size → molecular formula
//
// Like C₆H₁₂O₆ tells you atom ratios in glucose,
// FleetFormula tells you agent ratios in your convoy.
// ──────────────────────────────────────────────────────────────

import type { Bead, Polecat } from "./types.js";
import type { AgentRole } from "../agents/types.js";

// ─── Types ────────────────────────────────────────────────────

/** Weight of each role — analogous to element mass fractions. */
export interface RoleWeight {
  readonly role: AgentRole;
  readonly count: number;
  readonly fraction: number;
}

/** Empirical formula — smallest integer ratios. */
export interface EmpiricalFormula {
  readonly roles: ReadonlyArray<{
    readonly role: AgentRole;
    readonly ratio: number;
  }>;
  readonly formulaUnit: number;
  readonly notation: string;
}

/** Molecular formula — scaled to actual fleet size. */
export interface MolecularFormula {
  readonly roles: ReadonlyArray<{
    readonly role: AgentRole;
    readonly count: number;
  }>;
  readonly totalAgents: number;
  readonly notation: string;
}

/** Full fleet formula result. */
export interface FleetFormulaResult {
  readonly weights: readonly RoleWeight[];
  readonly empirical: EmpiricalFormula;
  readonly molecular: MolecularFormula;
  readonly fidelity: number;
  readonly recommendation: ScalingRecommendation;
}

/** Scaling recommendation after comparing current vs optimal. */
export interface ScalingRecommendation {
  readonly action: "scale_up" | "scale_down" | "rebalance" | "hold";
  readonly currentSize: number;
  readonly optimalSize: number;
  readonly delta: number;
  readonly adjustments: ReadonlyArray<{
    readonly role: AgentRole;
    readonly current: number;
    readonly target: number;
    readonly delta: number;
  }>;
  readonly reason: string;
}

// ─── Constants ────────────────────────────────────────────────

const ALL_ROLES: readonly AgentRole[] = [
  "frontend", "backend", "security", "devops", "general",
] as const;

/** Maximum denominator when converting decimals to integers. */
const MAX_MULTIPLIER = 12;

/** Tolerance for considering a number an integer. */
const INTEGER_TOLERANCE = 0.05;

// ─── Core Algorithm ───────────────────────────────────────────

/** Greatest Common Divisor (Euclidean algorithm). */
function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b > 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

/** GCD of an array of numbers. */
function gcdArray(nums: readonly number[]): number {
  if (nums.length === 0) return 1;
  let result = nums[0]!;
  for (let i = 1; i < nums.length; i++) {
    result = gcd(result, nums[i]!);
  }
  return result === 0 ? 1 : result;
}

/** Check if a value is close to an integer within tolerance. */
function isNearInteger(value: number, tolerance: number = INTEGER_TOLERANCE): boolean {
  return Math.abs(value - Math.round(value)) < tolerance;
}

/** Convert a number to Unicode subscript characters. */
function subscript(n: number): string {
  const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";
  return String(n)
    .split("")
    .map((ch) => {
      const digit = parseInt(ch, 10);
      return digit >= 0 && digit <= 9 ? SUBSCRIPTS[digit]! : ch;
    })
    .join("");
}

/** Role → chemical-style symbol mapping. */
const ROLE_SYMBOLS: Record<AgentRole, string> = {
  frontend: "Fe",
  backend: "Ba",
  security: "Se",
  devops: "Dv",
  "arb-runner": "Ar",
  media: "Md",
  general: "Gn",
};

/**
 * Compute the empirical ratio from role weights.
 *
 * Algorithm (mirrors empirical formula determination):
 *   1. Divide each count by the smallest count → raw ratios
 *   2. If all near-integer, round → done
 *   3. Otherwise multiply by 2, 3, ... up to MAX_MULTIPLIER
 *      until all are near-integer
 *   4. Reduce by GCD
 */
export function computeEmpiricalRatio(
  weights: readonly RoleWeight[],
): EmpiricalFormula {
  const nonZero = weights.filter((w) => w.count > 0);

  if (nonZero.length === 0) {
    return { roles: [], formulaUnit: 0, notation: "∅" };
  }

  // Step 1: divide by smallest
  const minCount = Math.min(...nonZero.map((w) => w.count));
  const rawRatios = nonZero.map((w) => ({
    role: w.role,
    ratio: w.count / minCount,
  }));

  // Step 2–3: find multiplier that makes all near-integer
  let multiplier = 1;
  for (let m = 1; m <= MAX_MULTIPLIER; m++) {
    if (rawRatios.every((r) => isNearInteger(r.ratio * m))) {
      multiplier = m;
      break;
    }
  }

  // Round to integers
  const intRatios = rawRatios.map((r) => ({
    role: r.role,
    ratio: Math.round(r.ratio * multiplier),
  }));

  // Step 4: reduce by GCD
  const ratioValues = intRatios.map((r) => r.ratio);
  const divisor = gcdArray(ratioValues);

  const reduced = intRatios.map((r) => ({
    role: r.role,
    ratio: Math.max(1, Math.round(r.ratio / divisor)),
  }));

  const formulaUnit = reduced.reduce((sum, r) => sum + r.ratio, 0);

  // Build notation: Fe₂Ba₃Se₁ etc.
  const notation = reduced
    .filter((r) => r.ratio > 0)
    .map((r) => {
      const sym = ROLE_SYMBOLS[r.role];
      return r.ratio === 1 ? sym : `${sym}${subscript(r.ratio)}`;
    })
    .join("");

  return { roles: reduced, formulaUnit, notation };
}

/**
 * Scale an empirical formula to a target fleet size using
 * Hamilton's largest remainder method (proportional allocation).
 *
 * This ensures:
 *   - Sum of allocations === targetSize
 *   - Distribution respects the empirical ratio as closely as possible
 *   - Every role with ratio > 0 gets at least 1 agent
 */
export function scaleToTarget(
  formula: EmpiricalFormula,
  targetSize: number,
): MolecularFormula {
  if (formula.roles.length === 0 || targetSize <= 0) {
    return { roles: [], totalAgents: 0, notation: "∅" };
  }

  // Ensure minimum 1 per role
  const minSize = formula.roles.length;
  const effectiveTarget = Math.max(targetSize, minSize);

  const totalRatio = formula.roles.reduce((s, r) => s + r.ratio, 0);

  // Exact fractional allocation
  const fractional = formula.roles.map((r) => ({
    role: r.role,
    exact: (r.ratio / totalRatio) * effectiveTarget,
  }));

  // Hamilton's method: floor all, then distribute remainders
  const floored = fractional.map((f) => ({
    role: f.role,
    count: Math.max(1, Math.floor(f.exact)),
    remainder: f.exact - Math.floor(f.exact),
  }));

  let allocated = floored.reduce((s, f) => s + f.count, 0);
  const remaining = effectiveTarget - allocated;

  // Sort by largest remainder descending
  const sorted = [...floored].sort((a, b) => b.remainder - a.remainder);

  for (let i = 0; i < remaining && i < sorted.length; i++) {
    sorted[i]!.count++;
    allocated++;
  }

  // Build result in original role order
  const roleMap = new Map(sorted.map((s) => [s.role, s.count]));

  const roles = formula.roles.map((r) => ({
    role: r.role,
    count: roleMap.get(r.role) ?? 1,
  }));

  const notation = roles
    .filter((r) => r.count > 0)
    .map((r) => {
      const sym = ROLE_SYMBOLS[r.role];
      return r.count === 1 ? sym : `${sym}${subscript(r.count)}`;
    })
    .join("");

  return {
    roles,
    totalAgents: roles.reduce((s, r) => s + r.count, 0),
    notation,
  };
}

/**
 * Fidelity score — how closely the actual distribution matches
 * the empirical formula. Uses cosine similarity.
 *
 * Returns 0..1 where 1 = perfect match.
 */
export function computeFidelity(
  actual: ReadonlyArray<{ role: AgentRole; count: number }>,
  formula: EmpiricalFormula,
): number {
  if (formula.roles.length === 0) return 1;

  // Build vectors aligned to ALL_ROLES
  const aVec = ALL_ROLES.map((r) => actual.find((a) => a.role === r)?.count ?? 0);
  const fVec = ALL_ROLES.map((r) => formula.roles.find((f) => f.role === r)?.ratio ?? 0);

  // Cosine similarity
  let dot = 0;
  let aMag = 0;
  let fMag = 0;
  for (let i = 0; i < ALL_ROLES.length; i++) {
    dot += aVec[i]! * fVec[i]!;
    aMag += aVec[i]! * aVec[i]!;
    fMag += fVec[i]! * fVec[i]!;
  }

  if (aMag === 0 || fMag === 0) return 0;
  return dot / (Math.sqrt(aMag) * Math.sqrt(fMag));
}

// ─── Fleet Formula (Main Entry Point) ─────────────────────────

/**
 * Compute the fleet formula from a set of beads.
 *
 * @param beads - Work units with assigned roles
 * @param currentFleet - Current polecats (for comparison)
 * @param targetSize - Desired fleet size (default: calculated from beads)
 */
export function computeFleetFormula(
  beads: readonly Bead[],
  currentFleet: readonly Polecat[],
  targetSize?: number,
): FleetFormulaResult {
  // Step 1: Count beads by role
  const roleCounts = new Map<AgentRole, number>();
  for (const bead of beads) {
    roleCounts.set(bead.role, (roleCounts.get(bead.role) ?? 0) + 1);
  }

  const totalBeads = beads.length;

  // Step 2: Build weight vector
  const weights: RoleWeight[] = ALL_ROLES
    .filter((r) => roleCounts.has(r))
    .map((r) => ({
      role: r,
      count: roleCounts.get(r)!,
      fraction: roleCounts.get(r)! / (totalBeads || 1),
    }));

  // Step 3: Compute empirical formula
  const empirical = computeEmpiricalRatio(weights);

  // Step 4: Scale to target
  const effectiveTarget = targetSize ?? Math.max(
    empirical.formulaUnit,
    Math.min(beads.length, 10),
  );
  const molecular = scaleToTarget(empirical, effectiveTarget);

  // Step 5: Compare with current fleet
  const currentByRole = ALL_ROLES
    .map((r) => ({
      role: r,
      count: currentFleet.filter((p) => p.role === r).length,
    }))
    .filter((r) => r.count > 0 || molecular.roles.some((m) => m.role === r.role));

  const fidelity = computeFidelity(currentByRole, empirical);

  // Step 6: Generate recommendation
  const recommendation = recommendScaling(
    currentByRole,
    molecular,
    fidelity,
  );

  return {
    weights,
    empirical,
    molecular,
    fidelity,
    recommendation,
  };
}

/**
 * Compare current fleet to optimal molecular formula and
 * produce a scaling recommendation.
 */
export function recommendScaling(
  current: ReadonlyArray<{ role: AgentRole; count: number }>,
  optimal: MolecularFormula,
  fidelity: number,
): ScalingRecommendation {
  const currentSize = current.reduce((s, c) => s + c.count, 0);
  const optimalSize = optimal.totalAgents;
  const delta = optimalSize - currentSize;

  // Per-role adjustments
  const adjustments = ALL_ROLES
    .map((role) => {
      const cur = current.find((c) => c.role === role)?.count ?? 0;
      const tgt = optimal.roles.find((o) => o.role === role)?.count ?? 0;
      return { role, current: cur, target: tgt, delta: tgt - cur };
    })
    .filter((a) => a.delta !== 0 || a.current > 0 || a.target > 0);

  // Determine action
  let action: ScalingRecommendation["action"];
  let reason: string;

  if (fidelity > 0.95 && Math.abs(delta) <= 1) {
    action = "hold";
    reason = `Fleet composition is optimal (fidelity=${(fidelity * 100).toFixed(1)}%)`;
  } else if (delta > 0 && fidelity > 0.7) {
    action = "scale_up";
    reason = `Need ${delta} more agent(s) to match workload distribution`;
  } else if (delta < 0 && fidelity > 0.7) {
    action = "scale_down";
    reason = `${Math.abs(delta)} excess agent(s) can be retired`;
  } else {
    action = "rebalance";
    reason = `Composition mismatch (fidelity=${(fidelity * 100).toFixed(1)}%); adjust role distribution`;
  }

  return { action, currentSize, optimalSize, delta, adjustments, reason };
}

/**
 * Compute exact agent counts per role (no ratio reduction).
 * Like molecular formula = n × empirical formula.
 */
export function computeMolecularFormula(
  beads: readonly Bead[],
): MolecularFormula {
  const roleCounts = new Map<AgentRole, number>();
  for (const bead of beads) {
    roleCounts.set(bead.role, (roleCounts.get(bead.role) ?? 0) + 1);
  }

  const roles = ALL_ROLES
    .filter((r) => roleCounts.has(r))
    .map((r) => ({
      role: r,
      count: roleCounts.get(r)!,
    }));

  const totalAgents = roles.reduce((s, r) => s + r.count, 0);
  const notation = roles
    .map((r) => {
      const sym = ROLE_SYMBOLS[r.role];
      return r.count === 1 ? sym : `${sym}${subscript(r.count)}`;
    })
    .join("");

  return { roles, totalAgents, notation };
}

// ─── Markdown Export ──────────────────────────────────────────

/**
 * Render a FleetFormulaResult as a detailed markdown report.
 */
export function formulaToMarkdown(result: FleetFormulaResult): string {
  const lines: string[] = [
    "# Fleet Composition Formula",
    "",
    `**Empirical:** ${result.empirical.notation}`,
    `**Molecular:** ${result.molecular.notation} (${result.molecular.totalAgents} agents)`,
    `**Fidelity:** ${(result.fidelity * 100).toFixed(1)}%`,
    "",
    "## Role Weights",
    "",
    "| Role | Beads | Fraction | Ratio |",
    "|------|-------|----------|-------|",
  ];

  for (const w of result.weights) {
    const ratio = result.empirical.roles.find((r) => r.role === w.role)?.ratio ?? 0;
    lines.push(
      `| ${w.role} | ${w.count} | ${(w.fraction * 100).toFixed(1)}% | ${ratio} |`,
    );
  }

  lines.push("", "## Allocation", "");
  lines.push("| Role | Current | Target | Delta |");
  lines.push("|------|---------|--------|-------|");

  for (const adj of result.recommendation.adjustments) {
    const arrow = adj.delta > 0 ? "↑" : adj.delta < 0 ? "↓" : "=";
    lines.push(
      `| ${adj.role} | ${adj.current} | ${adj.target} | ${arrow}${Math.abs(adj.delta)} |`,
    );
  }

  // Visual bar chart
  lines.push("", "## Distribution", "");
  const maxCount = Math.max(
    ...result.molecular.roles.map((r) => r.count),
    1,
  );
  for (const r of result.molecular.roles) {
    const barLen = Math.round((r.count / maxCount) * 20);
    const bar = "█".repeat(barLen) + "░".repeat(20 - barLen);
    lines.push(`\`${r.role.padEnd(8)}\` ${bar} ${r.count}`);
  }

  lines.push(
    "",
    "## Recommendation",
    "",
    `**Action:** \`${result.recommendation.action}\``,
    `**Reason:** ${result.recommendation.reason}`,
    `**Current → Optimal:** ${result.recommendation.currentSize} → ${result.recommendation.optimalSize} (Δ${result.recommendation.delta >= 0 ? "+" : ""}${result.recommendation.delta})`,
  );

  return lines.join("\n");
}
