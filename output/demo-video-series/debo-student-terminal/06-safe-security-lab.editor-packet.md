# Safe Security Lab: Learn Defense With Written Scope

Series: DEBO Student Terminal
Runtime: 120 seconds

## Hook

Security learning starts with authorization and non-destructive checks.

## Script

# Episode 06: Safe Security Lab

Runtime target: 120 seconds

## Hook

Open with a blocked security command until scope is provided.

Voiceover:
"Security learning starts before the scan. It starts with permission and scope."

## Shot List

| Time | Visual | Voiceover | Onscreen Note |
|---|---|---|---|
| 0:00-0:14 | Scope file passed to NATT lesson | "DEBO requires written scope for security workflows." | Authorized lab only |
| 0:14-0:36 | Scope checklist appears | "The target is local, the mode is non-destructive, and public internet testing is out of scope." | Non-destructive |
| 0:36-0:58 | Defensive checks run | "The baseline checks are defensive: dependencies, secrets, headers, and auth configuration." | Defensive baseline |
| 0:58-1:20 | Findings appear | "The output is practical and bounded. No secrets found, one dependency finding, and a missing header." | Bounded findings |
| 1:20-1:45 | Safe fixes recommended | "DEBO recommends fixes that improve the lab app without crossing scope." | Safe recommendations |
| 1:45-2:00 | Final cursor and safety text | "Students learn security discipline as part of the workflow." | Scope first, always |

## Video Agent Prompt

Render `snapshots/06-safe-security-lab.terminal.md`. Use amber for scope gates and green only after scope passes. Include onscreen disclaimer: "Authorized local lab only. Non-destructive checks." Do not show exploit commands, credential capture, or real targets.

## Editor Notes

- This is a trust-building episode.
- Keep the scope checklist onscreen long enough to read.
- End with a clear safety posture, not a dramatic hack visual.


## Terminal Snapshot

# Snapshot 06: Safe Security Lab

```terminal
student@debo:~/security-lab$ debo natt lesson --target local-demo-api --scope roe/student-lab.yml
SCOPE CHECK
- Target: local-demo-api
- Authorization: present
- Environment: local lab
- Mode: non-destructive
- Out of scope: public internet, credentials, persistence, exploitation

student@debo:~/security-lab$ debo natt run --profile defensive-baseline
NATT defensive baseline started

CHECKS
- dependency audit
- secret pattern scan
- security headers review
- auth route configuration review

RESULT
No secrets found in tracked files.
Dependency audit has 1 moderate finding.
Security headers missing content-security-policy.

DEBO teaching note:
Security learning begins with scope. We are checking our own lab app and producing defensive fixes.

student@debo:~/security-lab$ debo natt recommend-fixes --safe
Recommended safe changes:
1. Add baseline content security policy
2. Pin vulnerable demo dependency
3. Add regression test for security headers

student@debo:~/security-lab$ _
```


## Video Agent Safety

- Use synthetic data only.
- Keep security scenes authorized, scoped, and non-destructive.
- Do not imply deployment or release approval unless the transcript says so.