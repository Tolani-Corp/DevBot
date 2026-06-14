# Debug Loop: Fix a Failing Student API

Series: DEBO Student Terminal
Runtime: 120 seconds

## Hook

A failing endpoint becomes a readable debugging lesson.

## Script

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


## Terminal Snapshot

# Snapshot 03: Debug Loop

```terminal
student@debo:~/student-api$ npm test
FAIL tests/profile-api.test.ts
Expected status 200
Received status 500

student@debo:~/student-api$ debo debug "profile endpoint returns 500"
UNDERSTAND
- Symptom: GET /api/profile returns 500
- Likely area: request handler or profile fixture
- Safety: local test environment only

TRACE
1. Reproduce failing test
2. Read handler and schema
3. Compare expected response shape
4. Patch smallest defect
5. Rerun focused test

FINDING
src/routes/profile.ts reads user.displayName
tests fixture provides user.name

DEBO teaching note:
The bug is not in the HTTP layer. It is a contract mismatch between test data and handler code.

student@debo:~/student-api$ debo patch --lesson "contract mismatch"
Patch prepared:
- src/routes/profile.ts
- tests/profile-api.test.ts

student@debo:~/student-api$ npm test -- --run tests/profile-api.test.ts
PASS tests/profile-api.test.ts
4 tests passed

student@debo:~/student-api$ debo explain last-change --level beginner
You fixed a mismatch between what the route expected and what the test supplied.
Good debugging starts by reproducing the failure, then narrowing the surface area.

student@debo:~/student-api$ _
```


## Video Agent Safety

- Use synthetic data only.
- Keep security scenes authorized, scoped, and non-destructive.
- Do not imply deployment or release approval unless the transcript says so.