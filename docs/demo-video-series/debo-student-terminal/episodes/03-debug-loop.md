# Episode 03: Debug Loop

Runtime target: 120 seconds

## Hook

Show a student staring at a 500 error. Cut immediately to DEBO narrowing the cause.

Voiceover:
"Debugging gets easier when the terminal teaches the shape of the problem."

## Shot List

| Time | Visual | Voiceover | Onscreen Note |
|---|---|---|---|
| 0:00-0:12 | Failing `profile-api` test | "The endpoint returns 500. That tells us where the symptom is, not the cause." | Symptom, not cause |
| 0:12-0:30 | `debo debug` command | "DEBO starts by reproducing the failure and naming the likely surface area." | Reproduce first |
| 0:30-0:52 | TRACE list appears | "The debug loop is simple: reproduce, read, compare, patch, verify." | Five-step loop |
| 0:52-1:12 | Finding highlights `displayName` vs `name` | "Here the bug is a contract mismatch. The handler expects one field, the fixture provides another." | Contract mismatch |
| 1:12-1:35 | Patch prepared and tests rerun | "The fix is narrow, and the focused test confirms it." | Narrow fix |
| 1:35-2:00 | DEBO explanation at beginner level | "The student leaves with a method, not just a patched file." | Learn the method |

## Video Agent Prompt

Use the transcript from `snapshots/03-debug-loop.terminal.md`. Animate the mismatch as two highlighted code tokens: `displayName` and `name`. Keep the tone practical and calm.

## Editor Notes

- The main takeaway is the repeatable debug loop.
- Do not show unrelated files.
- End with "method, not magic" as optional lower-third text.
