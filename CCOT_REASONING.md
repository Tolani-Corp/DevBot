# CCOT Reasoning for DEBO

CCOT means Continuity and Change Over Time. In DEBO it is implemented as a deterministic reasoning primitive for comparing a baseline state with a current state while preserving evidence, uncertainty, and guardrails.

## Why It Belongs In DEBO

CCOT strengthens agent logic because it forces every temporal claim to answer:

- What was the baseline?
- What changed?
- What continued?
- What was the turning point?
- What evidence supports the claim?
- What is still uncertain?

This is useful for anti-hallucination because "major shift", "trend", "regression", "progress", and "turning point" become evidence-bound claims instead of narrative filler.

## Implementation

Primary module:

```text
src/reasoning/ccot.ts
```

Public SDK export:

```ts
import {
  analyzeCCOT,
  buildCCOTSurfaceModel,
  createCCOTDemoPackets,
  formatCCOTMarkdown,
} from "@tolani/devbot";
```

CCOT is exported from the lightweight package root. Agent and AI runtime modules stay on their subpaths so importing CCOT does not require database, worker, Slack, Discord, or model-provider environment variables.

Demo:

```bash
npm run demo:ccot
```

Tests:

```bash
npm run test -- tests/reasoning/ccot.test.ts
```

## Production Contract

CCOT now returns:

- strict or lightweight policy mode
- changes, continuities, uncertain observations, and turning points
- evidence gaps and confidence
- domain guardrails
- a minimal action queue
- UI-ready surface data

Strict mode is the default for security, release, customer, and BetTorsAce Warroom claims. Lightweight mode is the default for normal coding narration, student coaching, and low-risk engineering review.

## Action Queue

Each analysis returns a small deterministic queue:

- `continue`: keep stable behavior.
- `change`: update workflow, model, prompt, or UI.
- `review`: resolve evidence gaps or elevated risk.
- `pause`: stop automation until evidence improves.
- `escalate`: security, release, customer, or Warroom human review gate.

The queue is intentionally minimal so dashboards can use it without becoming noisy.

## UI Surface Model

`buildCCOTSurfaceModel` converts an analysis into:

- timeline lane: baseline, turning points, current state
- change, continuity, and uncertain split view
- evidence chips with source, timestamp, reliability, and summary
- learner or review prompts
- Warroom drift panel for assumptions, AAR deltas, stale context, and safety flags
- action queue

## Student Learning Pattern

For Tolani Labs students, CCOT should become a visible rubric:

1. Baseline: what the learner did before.
2. Change: what skill or behavior improved.
3. Continuity: what habit, misconception, or guardrail remains.
4. Turning point: the lesson, commit, or review that shifted behavior.
5. Evidence: terminal logs, commits, tests, PR review, or rubric notes.
6. Next step: one explanation, one misconception check, one exercise.

Recommended DEBO prompt:

```text
Run CCOT on this student workflow. Compare the first attempt with the latest review packet. Identify changes, continuities, evidence gaps, and the next practice step.
```

## BetTorsAce Warroom Pattern

For BetTorsAce, CCOT is a decision-hygiene tool, not a prediction engine.

Allowed:

- Compare current board state with prior board state.
- Review line movement, model drift, stale assumptions, and bankroll exposure.
- Produce post-event after-action reviews.
- Separate facts, interpretations, scenarios, and missing evidence.

Blocked:

- No picks.
- No guaranteed outcomes.
- No stake sizing.
- No "lock", "sure thing", or chase-language.
- No implied financial advice.

Recommended DEBO prompt:

```text
Run CCOT on this warroom board as a non-predictive risk review. Identify what changed, what stayed stable, stale assumptions, evidence gaps, and human-review items. Do not recommend picks or stakes.
```

## AAR Conversion

`createBettorsAceAARCCOTPacket` turns AAR lessons into structured observations:

- previous model behavior
- current model behavior
- stable strengths
- recurring failures
- changed context
- action taken

This pairs with BetTorsAce historical-intelligence gates: AAR findings can explain why a lane is guarded, watched, or escalated without producing picks or stake guidance.

## Demo Flows

`createCCOTDemoPackets` seeds polished examples for:

- Tolani student terminal learning journey
- DEBO release readiness review
- BettorsAce AAR-to-model-adjustment review
- BettorsAce Warroom assumption drift
- DevBot stale customer-claim scanner

## Source Grounding

The design follows common historical-thinking framing from:

- Historical Thinking Project: continuity and change as one of six historical-thinking concepts.
- College Board AP history skill framing: describe and explain patterns of continuity and change over time.
- OER Project CCOT activities: evaluate what changed and what stayed the same across defined intervals.
- NIST AI Risk Management Framework posture: document limitations, uncertainty, and evidence for high-impact claims.
