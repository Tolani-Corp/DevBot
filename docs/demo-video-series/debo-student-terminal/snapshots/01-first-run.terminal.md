# Snapshot 01: First Run

```terminal
student@debo:~/campus-labs$ debo start --mode student --repo campus-labs
DEBO Workstation online
Profile: student-learning
Policy: explain steps, require review before release claims
Workspace: campus-labs

student@debo:~/campus-labs$ debo ask "I want to build a small API but I do not know where to start"
UNDERSTAND
- Goal: build a small API
- Learner level: beginner
- Risk: low
- Missing context: language, route, data model

PLAN
1. Inspect project shape
2. Pick one endpoint
3. Add tests first
4. Implement smallest working route
5. Explain what changed

DEBO suggestion:
Start with a notes API:
GET /api/notes returns sample notes
POST /api/notes validates title and body

student@debo:~/campus-labs$ debo accept-plan --episode first-run
Plan accepted for demo workspace.
Next command: debo run lesson-api-basics

student@debo:~/campus-labs$ _
```
