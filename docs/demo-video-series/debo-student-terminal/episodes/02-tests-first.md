# Episode 02: Tests First

Runtime target: 90 seconds

## Hook

Open on a failing test in red, then pause before the fix.

Voiceover:
"A failing test is not a setback. In a good learning workflow, it is the map."

## Shot List

| Time | Visual | Voiceover | Onscreen Note |
|---|---|---|---|
| 0:00-0:08 | Terminal shows `--tests-first` | "DEBO can teach students to describe behavior before changing code." | Tests first |
| 0:08-0:24 | Test file appears in a side panel | "The test names are plain English: return notes, reject bad input, create valid data." | Behavior before implementation |
| 0:24-0:38 | `FAIL` result appears | "Red is expected. The API does not exist yet." | Expected failure |
| 0:38-0:58 | DEBO explains the failure | "Instead of hiding the failure, DEBO explains why it is useful." | Failure as signal |
| 0:58-1:15 | Implementation logs and changed files | "Then it makes the smallest clear change needed to satisfy the tests." | Smallest clear change |
| 1:15-1:30 | `PASS` result and green cursor | "The lesson lands because the student saw the guardrail first." | Green with understanding |

## Video Agent Prompt

Render the terminal transcript from `snapshots/02-tests-first.terminal.md`. Show test failure in muted red, then the passing result in green. Avoid claiming production readiness. The scene is a local demo learning repo.

## Editor Notes

- Add a split view for `tests/notes-api.test.ts`.
- Use a subtle sound cue when tests switch from fail to pass.
- Keep the green cursor visible after the final prompt.
