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
