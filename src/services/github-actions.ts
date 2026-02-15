import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const GITHUB_ORG = process.env.GITHUB_ORG ?? "Tolani-Corp";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkflowRun {
  id: number;
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion:
    | "success"
    | "failure"
    | "cancelled"
    | "skipped"
    | "timed_out"
    | null;
  branch: string;
  commitSha: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRunResult {
  run: WorkflowRun;
  jobs: WorkflowJob[];
  logs?: string;
}

export interface WorkflowJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  steps: Array<{ name: string; status: string; conclusion: string | null }>;
}

export interface CIStatus {
  passing: boolean;
  runs: WorkflowRun[];
  failedJobs: WorkflowJob[];
  summary: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a raw workflow run from the GitHub API to our WorkflowRun shape.
 */
function toWorkflowRun(raw: {
  id: number;
  name?: string | null;
  status: string | null;
  conclusion: string | null;
  head_branch: string | null;
  head_sha: string;
  html_url: string;
  created_at: string;
  updated_at: string;
}): WorkflowRun {
  return {
    id: raw.id,
    name: raw.name ?? "unknown",
    status: (raw.status ?? "queued") as WorkflowRun["status"],
    conclusion: (raw.conclusion as WorkflowRun["conclusion"]) ?? null,
    branch: raw.head_branch ?? "unknown",
    commitSha: raw.head_sha,
    url: raw.html_url,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

/**
 * Map a raw job from the GitHub API to our WorkflowJob shape.
 */
function toWorkflowJob(raw: {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  steps?: Array<{
    name: string;
    status: string;
    conclusion: string | null;
  }>;
}): WorkflowJob {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status,
    conclusion: raw.conclusion,
    steps: (raw.steps ?? []).map((s) => ({
      name: s.name,
      status: s.status,
      conclusion: s.conclusion,
    })),
  };
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Trigger a GitHub Actions workflow via the `workflow_dispatch` event.
 *
 * @param repo        Repository name (without the org prefix).
 * @param workflowId  Workflow file name (e.g. `ci.yml`) or numeric ID.
 * @param ref         Git ref to run the workflow against (branch, tag, or SHA).
 * @param inputs      Optional key/value inputs defined in the workflow file.
 */
export async function triggerWorkflow(
  repo: string,
  workflowId: string | number,
  ref: string,
  inputs?: Record<string, string>,
): Promise<void> {
  await octokit.actions.createWorkflowDispatch({
    owner: GITHUB_ORG,
    repo,
    workflow_id: workflowId,
    ref,
    inputs,
  });
}

/**
 * List recent workflow runs for a repository.
 *
 * @param repo    Repository name (without the org prefix).
 * @param branch  Optional branch filter.
 * @param limit   Maximum number of runs to return (default 10).
 */
export async function getWorkflowRuns(
  repo: string,
  branch?: string,
  limit: number = 10,
): Promise<WorkflowRun[]> {
  const params: Parameters<typeof octokit.actions.listWorkflowRunsForRepo>[0] =
    {
      owner: GITHUB_ORG,
      repo,
      per_page: limit,
    };

  if (branch) {
    params.branch = branch;
  }

  const { data } = await octokit.actions.listWorkflowRunsForRepo(params);

  return data.workflow_runs.map(toWorkflowRun);
}

/**
 * Get detailed information about a specific workflow run, including its jobs
 * and (when available) failure logs.
 *
 * @param repo   Repository name (without the org prefix).
 * @param runId  Numeric workflow run ID.
 */
export async function getWorkflowRunDetails(
  repo: string,
  runId: number,
): Promise<WorkflowRunResult> {
  const [runResponse, jobsResponse] = await Promise.all([
    octokit.actions.getWorkflowRun({
      owner: GITHUB_ORG,
      repo,
      run_id: runId,
    }),
    octokit.actions.listJobsForWorkflowRun({
      owner: GITHUB_ORG,
      repo,
      run_id: runId,
    }),
  ]);

  const run = toWorkflowRun(runResponse.data);
  const jobs = jobsResponse.data.jobs.map(toWorkflowJob);

  // Attempt to fetch logs for any failed jobs.
  let logs: string | undefined;
  const failedJob = jobs.find((j) => j.conclusion === "failure");
  if (failedJob) {
    try {
      logs = await getFailedJobLogs(repo, failedJob.id);
    } catch {
      // Logs may have expired or be unavailable -- not critical.
    }
  }

  return { run, jobs, logs };
}

/**
 * Get the current CI status for a branch. Looks at the most recent workflow
 * runs and determines whether CI is green.
 *
 * @param repo    Repository name (without the org prefix).
 * @param branch  Branch to check (defaults to the repo's default branch).
 */
export async function getLatestCIStatus(
  repo: string,
  branch?: string,
): Promise<CIStatus> {
  const runs = await getWorkflowRuns(repo, branch, 20);

  if (runs.length === 0) {
    return {
      passing: true,
      runs: [],
      failedJobs: [],
      summary: "No workflow runs found.",
    };
  }

  // Collect jobs for the most recent completed run of each workflow name.
  const seen = new Set<string>();
  const latestRuns: WorkflowRun[] = [];
  const failedJobs: WorkflowJob[] = [];

  for (const run of runs) {
    if (seen.has(run.name)) continue;
    if (run.status !== "completed") continue;
    seen.add(run.name);
    latestRuns.push(run);

    if (run.conclusion === "failure") {
      try {
        const details = await getWorkflowRunDetails(repo, run.id);
        failedJobs.push(
          ...details.jobs.filter((j) => j.conclusion === "failure"),
        );
      } catch {
        // If we cannot fetch details, we still report the run itself.
      }
    }
  }

  const passing = latestRuns.every((r) => r.conclusion === "success");

  const statusLine = latestRuns
    .map((r) => `${r.name}: ${r.conclusion ?? r.status}`)
    .join(", ");

  const summary = passing
    ? `All CI checks passing (${latestRuns.length} workflow(s)). ${statusLine}`
    : `CI failing. ${statusLine}`;

  return { passing, runs: latestRuns, failedJobs, summary };
}

/**
 * Poll a workflow run until it reaches a terminal state or the timeout is
 * exceeded.
 *
 * @param repo            Repository name (without the org prefix).
 * @param runId           Numeric workflow run ID.
 * @param timeoutMs       Maximum time to wait in milliseconds (default 10 min).
 * @param pollIntervalMs  How often to poll in milliseconds (default 15 s).
 */
export async function waitForWorkflowCompletion(
  repo: string,
  runId: number,
  timeoutMs: number = 600_000,
  pollIntervalMs: number = 15_000,
): Promise<WorkflowRunResult> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await getWorkflowRunDetails(repo, runId);

    if (result.run.status === "completed") {
      return result;
    }

    await sleep(pollIntervalMs);
  }

  // One final check in case the run just completed.
  const finalResult = await getWorkflowRunDetails(repo, runId);
  if (finalResult.run.status === "completed") {
    return finalResult;
  }

  throw new Error(
    `Workflow run ${runId} in ${GITHUB_ORG}/${repo} did not complete within ${timeoutMs}ms.`,
  );
}

/**
 * Download the logs for a specific job.
 *
 * @param repo   Repository name (without the org prefix).
 * @param jobId  Numeric job ID.
 * @returns The plain-text log content.
 */
export async function getFailedJobLogs(
  repo: string,
  jobId: number,
): Promise<string> {
  const { data } = await octokit.actions.downloadJobLogsForWorkflowRun({
    owner: GITHUB_ORG,
    repo,
    job_id: jobId,
  });

  // Octokit returns the data as a string (redirected download).
  return typeof data === "string" ? data : String(data);
}

/**
 * Format a CIStatus object into a Slack-friendly message using mrkdwn.
 */
export function formatCIStatusForSlack(status: CIStatus): string {
  const icon = status.passing ? ":white_check_mark:" : ":x:";
  const headline = status.passing ? "CI is green" : "CI is failing";

  const lines: string[] = [`${icon} *${headline}*`];

  for (const run of status.runs) {
    const runIcon =
      run.conclusion === "success"
        ? ":white_check_mark:"
        : run.conclusion === "failure"
          ? ":x:"
          : ":hourglass:";
    lines.push(
      `${runIcon} <${run.url}|${run.name}> on \`${run.branch}\` -- ${run.conclusion ?? run.status}`,
    );
  }

  if (status.failedJobs.length > 0) {
    lines.push("");
    lines.push("*Failed jobs:*");
    for (const job of status.failedJobs) {
      lines.push(`  - *${job.name}*`);
      const failedSteps = job.steps.filter((s) => s.conclusion === "failure");
      for (const step of failedSteps) {
        lines.push(`    - Step: ${step.name}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * List all workflows defined in a repository.
 *
 * @param repo  Repository name (without the org prefix).
 */
export async function listWorkflows(
  repo: string,
): Promise<
  Array<{ id: number; name: string; path: string; state: string }>
> {
  const { data } = await octokit.actions.listRepoWorkflows({
    owner: GITHUB_ORG,
    repo,
  });

  return data.workflows.map((w) => ({
    id: w.id,
    name: w.name,
    path: w.path,
    state: w.state,
  }));
}
