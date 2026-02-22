# Learned Patterns

This file is auto-populated through the self-correction loop.
When Claude makes a mistake and gets corrected, the lesson goes here.

## Format

### [Date] - Category: [Brief Title]
**Mistake:** What went wrong
**Correction:** What should have happened
**Rule:** The pattern to follow going forward

---

## Active Patterns

### 2026-02-15 - Workflow: Parallel Build + Redevelopment Queue
**Discovery:** Building features sequentially and waiting for each build/test pass wastes time. Errors in completed work block forward progress.
**Pattern:** Launch background subagents to verify completed tasks (type check, test, lint) while the main thread continues building new features. When verification fails, requeue the task with error context appended. Retry up to 3 times before escalating.
**Rule:** Never block the main thread on error fixing. Always keep producing. Use background agents for verification. Feed errors back as context for retries.

### 2026-02-15 - Security: execSync is a command injection vector
**Mistake:** Original git/operations.ts used `execSync` with string interpolation, allowing shell metacharacter injection through user-controlled branch names, file paths, and commit messages.
**Correction:** Replaced all `execSync(string)` calls with `execFileSync("git", [...args])` using array arguments. Added Zod validators and sanitizer middleware.
**Rule:** Never use `execSync` with string interpolation. Always use `execFileSync` with array arguments. Validate all user input with Zod schemas before passing to any system call.

### 2026-02-15 - Testing: Mock factories prevent module-level crashes
**Mistake:** Pre-existing `onboarding.test.ts` crashes because `src/db/index.ts` throws at module load when DATABASE_URL is missing.
**Correction:** All new test files use `vi.mock()` at the top level to intercept module imports before they execute side effects.
**Rule:** Always mock modules with side effects (database connections, Redis, external SDKs) before importing the module under test. Use mock factories in `tests/helpers/`.

### 2026-02-15 - Types: Octokit response types are wider than expected
**Mistake:** `github-actions.ts` type for `name` was `string` but Octokit returns `string | null | undefined`.
**Correction:** Changed parameter type to `name?: string | null` and used nullish coalescing: `raw.name ?? "unknown"`.
**Rule:** When typing mapper functions for external API responses, use the widest type (include null/undefined) and coalesce to defaults.

---

## Archived Patterns

(Move patterns here when they become second nature or are superseded)

### 2026-02-19 - Operations: PowerShell Here-Strings Escaping
**Mistake:** Used interpolated here-strings (`@" ... "@`) in PowerShell to overwrite a TypeScript file containing backticks and template literals, causing syntax errors (`console.error(\[WS]...` and `\${var}`).
**Correction:** Use literal here-strings (`@' ... '@`) when writing code content to files via PowerShell to prevent variable expansion and escape character interpretation.
**Rule:** Always prefer `create_file` tool for full file creation. If using `run_in_terminal` to write file content, strictly use single-quoted here-strings (`@' ... '@`).
