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
