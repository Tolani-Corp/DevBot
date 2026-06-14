# Snapshot 02: Tests First

```terminal
student@debo:~/campus-labs$ debo run lesson-api-basics --tests-first
DEBO lesson: API basics
Mode: tests first

CHECK
- package.json found
- test runner found: vitest
- source folder found: src

WRITE TEST
tests/notes-api.test.ts
- returns an empty notes list
- rejects missing title
- creates a valid note

student@debo:~/campus-labs$ npm test -- --run tests/notes-api.test.ts
FAIL tests/notes-api.test.ts
3 tests failed

DEBO explains:
This is expected. The tests describe the behavior before the API exists.
Your job is to make the red test turn green with the smallest clear change.

student@debo:~/campus-labs$ debo implement --target notes-api --explain
Changed:
- src/routes/notes.ts
- src/server.ts

student@debo:~/campus-labs$ npm test -- --run tests/notes-api.test.ts
PASS tests/notes-api.test.ts
3 tests passed

student@debo:~/campus-labs$ _
```
