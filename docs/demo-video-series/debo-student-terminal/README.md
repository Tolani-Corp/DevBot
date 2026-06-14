# DEBO Student Terminal Video Series

This folder is the source package for a marketing demo series showing DEBO as a student learning terminal for governed software engineering.

The assets are designed for video agents, editors, and voiceover workflows. They use synthetic data only, avoid secret exposure, and keep security scenes defensive, authorized, and lab-only.

## Series Positioning

Title: `DEBO Student Terminal`

Promise: Students learn real engineering workflows by giving DEBO outcome-driven requests, watching the terminal explain its reasoning, and reviewing evidence before changes ship.

Audience:
- Students learning modern development workflows
- Bootcamps and university labs
- Engineering managers evaluating supervised AI learning
- Developer advocates building demo content

Core story:
1. DEBO turns a vague student goal into a scoped task.
2. DEBO explains the plan in plain language.
3. The student watches tests, fixes, docs, and review evidence appear.
4. Risky claims and security work stay gated by policy.
5. The terminal becomes a learning coach, not a black box.

## Folder Map

- `video-agent-context.json`: canonical scene, brand, safety, and voiceover context.
- `episodes/*.md`: human-readable episode scripts with shot timing.
- `snapshots/*.terminal.md`: terminal transcripts for screen capture or synthetic terminal renderers.
- `scripts/build-video-agent-packets.mjs`: builds per-episode JSON and Markdown packets into `output/demo-video-series/debo-student-terminal/`.

## Generate Agent Packets

From the repo root:

```bash
node docs/demo-video-series/debo-student-terminal/scripts/build-video-agent-packets.mjs
```

Or:

```bash
npm run demo:student-terminal:packets
```

## Visual Direction

- Background: dark workstation shell, near-black slate.
- Cursor: bright green, blinking block or bar.
- Accent: green for active cursor and successful checks, cyan for context, amber for review gates.
- Logo: DEBO mark appears as a terminal boot animation, then settles into a small top-left workstation identity.
- Pace: crisp, educational, calm. Avoid hype that implies unsupervised release or guaranteed outcomes.

## Production Rules

- Do not show real customer repos, tokens, credentials, private IPs, or live student data.
- Use synthetic project names: `campus-labs`, `student-api`, `learning-dashboard`.
- Security or NATT workflows must show written scope, lab-only targets, and non-destructive checks.
- High-risk claims require onscreen qualifiers: `demo environment`, `example workflow`, `human review required`.
- Do not imply DEBO replaces instructors, reviewers, or security authorization.
