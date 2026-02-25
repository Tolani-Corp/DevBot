/**
 * Jira Cloud REST API Integration for DevBot
 * API: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
 *
 * Env vars required:
 *   JIRA_BASE_URL    - e.g. https://yourorg.atlassian.net
 *   JIRA_USER_EMAIL  - Atlassian account email
 *   JIRA_API_TOKEN   - API token from id.atlassian.com
 *   JIRA_PROJECT_KEY - Default project key (e.g. DEV)
 */

function getHeaders(): Record<string, string> {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_USER_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!baseUrl) throw new Error("JIRA_BASE_URL is not configured");
  if (!email) throw new Error("JIRA_USER_EMAIL is not configured");
  if (!token) throw new Error("JIRA_API_TOKEN is not configured");
  const encoded = Buffer.from(`${email}:${token}`).toString("base64");
  return {
    Authorization: `Basic ${encoded}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function getBaseUrl(): string {
  const url = process.env.JIRA_BASE_URL;
  if (!url) throw new Error("JIRA_BASE_URL is not configured");
  return url.replace(/\/$/, "");
}

function toAdf(text: string): unknown {
  return {
    version: 1,
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}

function mapIssue(raw: Record<string, unknown>): JiraIssue {
  const fields = raw.fields as Record<string, unknown>;
  const status = fields.status as Record<string, unknown>;
  const priority = fields.priority as Record<string, unknown> | null;
  const assignee = fields.assignee as Record<string, unknown> | null;
  const baseUrl = getBaseUrl();
  return {
    id: raw.id as string,
    key: raw.key as string,
    summary: fields.summary as string,
    status: { name: status.name as string },
    priority: { name: (priority?.name as string) ?? "Medium" },
    assignee: assignee ? { displayName: assignee.displayName as string } : undefined,
    url: `${baseUrl}/browse/${raw.key as string}`,
    description: fields.description ?? null,
  };
}

export interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  status: { name: string };
  priority: { name: string };
  assignee?: { displayName: string };
  url: string;
  description: unknown;
}

export interface CreateJiraIssueInput {
  summary: string;
  description?: string;
  projectKey?: string;
  issueType: "Task" | "Bug" | "Story";
  priority: "Highest" | "High" | "Medium" | "Low" | "Lowest";
  assigneeAccountId?: string;
}

/** Get a single Jira issue by key (e.g. DEV-123) */
export async function getIssue(issueKey: string): Promise<JiraIssue> {
  const res = await fetch(`${getBaseUrl()}/rest/api/3/issue/${issueKey}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Jira API error: ${res.status} ${await res.text()}`);
  return mapIssue((await res.json()) as Record<string, unknown>);
}

/** Search issues using JQL */
export async function searchIssues(jql: string, maxResults = 50): Promise<JiraIssue[]> {
  const res = await fetch(`${getBaseUrl()}/rest/api/3/issue/search`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ jql, maxResults, fields: ["summary", "status", "priority", "assignee", "description"] }),
  });
  if (!res.ok) throw new Error(`Jira API error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { issues: Record<string, unknown>[] };
  return data.issues.map(mapIssue);
}

/** Create a new Jira issue */
export async function createIssue(input: CreateJiraIssueInput): Promise<JiraIssue> {
  const projectKey = input.projectKey ?? process.env.JIRA_PROJECT_KEY;
  if (!projectKey) throw new Error("projectKey is required (or set JIRA_PROJECT_KEY)");

  const fields: Record<string, unknown> = {
    project: { key: projectKey },
    summary: input.summary,
    issuetype: { name: input.issueType },
    priority: { name: input.priority },
  };

  if (input.description) {
    fields.description = toAdf(input.description);
  }
  if (input.assigneeAccountId) {
    fields.assignee = { accountId: input.assigneeAccountId };
  }

  const res = await fetch(`${getBaseUrl()}/rest/api/3/issue`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Jira API error: ${res.status} ${await res.text()}`);
  const created = (await res.json()) as { key: string };
  return getIssue(created.key);
}

/** Transition an issue to a new status via transitionId */
export async function updateIssueStatus(issueKey: string, transitionId: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/rest/api/3/issue/${issueKey}/transitions`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ transition: { id: transitionId } }),
  });
  if (!res.ok) throw new Error(`Jira API error: ${res.status} ${await res.text()}`);
}

/** Get available transitions for an issue */
export async function getTransitions(issueKey: string): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch(`${getBaseUrl()}/rest/api/3/issue/${issueKey}/transitions`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Jira API error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { transitions: Array<{ id: string; name: string }> };
  return data.transitions.map((t) => ({ id: t.id, name: t.name }));
}

/** Add a comment to a Jira issue */
export async function addComment(issueKey: string, body: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/rest/api/3/issue/${issueKey}/comment`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ body: toAdf(body) }),
  });
  if (!res.ok) throw new Error(`Jira API error: ${res.status} ${await res.text()}`);
}

/** Link a PR to a Jira issue via a formatted comment */
export async function linkPRToIssue(issueKey: string, prUrl: string, commitSha: string): Promise<void> {
  const body = `Pull Request linked by DevBot:\n\nPR: ${prUrl}\nCommit: ${commitSha}`;
  await addComment(issueKey, body);
}

/** Get all open issues for a project */
export async function getIssuesForProject(projectKey?: string): Promise<JiraIssue[]> {
  const key = projectKey ?? process.env.JIRA_PROJECT_KEY;
  if (!key) throw new Error("projectKey is required (or set JIRA_PROJECT_KEY)");
  return searchIssues(`project = ${key} AND statusCategory != Done ORDER BY created DESC`);
}
