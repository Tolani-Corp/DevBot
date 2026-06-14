# Reviewed PR: From Change to Evidence Packet

Series: DEBO Student Terminal
Runtime: 120 seconds

## Hook

DEBO shows students what professional review discipline looks like.

## Script

# Episode 04: Reviewed PR

Runtime target: 120 seconds

## Hook

Start with a terminal request, then show the same request becoming a reviewable PR packet.

Voiceover:
"Professional engineering is not just changing files. It is proving what changed, how it was checked, and who reviews it."

## Shot List

| Time | Visual | Voiceover | Onscreen Note |
|---|---|---|---|
| 0:00-0:12 | Student asks for progress cards | "DEBO normalizes the task before it edits." | Request normalized |
| 0:12-0:32 | Lane, risk, review required | "Even a low-risk student UI change keeps review explicit." | Review required |
| 0:32-0:55 | Plan appears | "The plan connects UI work, demo data, tests, and evidence." | Plan before edits |
| 0:55-1:15 | Changed files list | "The student sees exactly which files moved." | Operator visibility |
| 1:15-1:40 | Verification commands pass | "Checks are part of the story, not an afterthought." | Check and test |
| 1:40-2:00 | Evidence packet and draft PR | "The outcome is ready for human review. DEBO does not pretend review already happened." | Human review required |

## Video Agent Prompt

Render `snapshots/04-reviewed-pr.terminal.md` with a side panel showing the evidence packet files. Use amber for review-required states. Do not say or imply the change is deployed.

## Editor Notes

- Onscreen disclaimer near the PR scene: "Demo workspace. Human review required."
- Keep changed file names readable.
- End on `Release: not deployed`.


## Terminal Snapshot

# Snapshot 04: Reviewed PR

```terminal
student@debo:~/learning-dashboard$ debo task "add progress cards to the learning dashboard"
REQUEST NORMALIZED
Lane: student-ui
Risk: low
Review: required
Release claim: blocked until human approval

PLAN
1. Inspect existing dashboard components
2. Add progress card component
3. Seed synthetic learning data
4. Run typecheck and tests
5. Create evidence packet for review

student@debo:~/learning-dashboard$ debo execute --reviewed-pr
EDIT
- web/src/components/ProgressCards.tsx
- web/src/lib/demo-learning-data.ts
- tests/progress-cards.test.ts

VERIFY
npm run check
Status: pass

npm test -- --run tests/progress-cards.test.ts
Status: pass

EVIDENCE PACKET
- request-summary.md
- changed-files.txt
- verification-log.txt
- review-notes.md

PR DRAFT
Title: Add student progress cards to learning dashboard
Status: ready for human review
Release: not deployed

student@debo:~/learning-dashboard$ _
```


## Video Agent Safety

- Use synthetic data only.
- Keep security scenes authorized, scoped, and non-destructive.
- Do not imply deployment or release approval unless the transcript says so.