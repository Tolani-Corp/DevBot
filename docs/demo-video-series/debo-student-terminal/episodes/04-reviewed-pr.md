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
