# First Run: From Blank Terminal to Learning Plan

Series: DEBO Student Terminal
Runtime: 90 seconds

## Hook

A student opens DEBO and turns a vague goal into a guided learning path.

## Script

# Episode 01: First Run

Runtime target: 90 seconds

## Hook

Show a blank terminal. A green cursor blinks after the prompt.

Voiceover:
"Most students do not need more mystery in the terminal. They need a guided path from a goal to the next safe step."

## Shot List

| Time | Visual | Voiceover | Onscreen Note |
|---|---|---|---|
| 0:00-0:06 | DEBO logo types into terminal, cursor blinks after O | "This is DEBO Student Terminal." | DEBO by Tolani Labs |
| 0:06-0:18 | Student runs `debo start --mode student` | "It opens in a learning profile, where explanations and review gates are on by default." | Student learning mode |
| 0:18-0:35 | Student asks vague API question | "The student can start with ordinary language, not perfect requirements." | Goal first |
| 0:35-0:58 | UNDERSTAND and PLAN sections reveal | "DEBO turns the goal into a scoped lesson: inspect, test, implement, explain." | Request to plan |
| 0:58-1:15 | DEBO suggests notes API | "The important move is small scope. One endpoint, one learning objective, one reviewable change." | Small scope wins |
| 1:15-1:30 | Cursor returns, ready for next command | "The terminal is no longer a wall. It is a guided workshop." | Subscribe for workflow 2 |

## Video Agent Prompt

Create a dark terminal scene with a crisp green blinking cursor. Animate the DEBO logo as text typed into the header. Use the transcript from `snapshots/01-first-run.terminal.md`. Keep pacing calm and readable. Do not add real repo names or credentials.

## Editor Notes

- Highlight `UNDERSTAND` and `PLAN` with subtle cyan bars.
- Use a soft zoom when DEBO suggests the `notes API`.
- End on the blinking green cursor.


## Terminal Snapshot

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


## Video Agent Safety

- Use synthetic data only.
- Keep security scenes authorized, scoped, and non-destructive.
- Do not imply deployment or release approval unless the transcript says so.