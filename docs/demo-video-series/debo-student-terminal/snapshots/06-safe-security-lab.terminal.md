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
