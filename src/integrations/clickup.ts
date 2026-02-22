/**
 * ClickUp API Integration for DevBot
 * API v2 Documentation: https://clickup.com/api
 */

const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";

function getHeaders(): Record<string, string> {
    const token = process.env.CLICKUP_API_TOKEN;
    if (!token) {
        throw new Error("CLICKUP_API_TOKEN is not configured");
    }
    return {
        Authorization: token,
        "Content-Type": "application/json",
    };
}

// ==================== Types ====================

export interface ClickUpTask {
    id: string;
    name: string;
    description?: string;
    status: {
        status: string;
        color: string;
    };
    priority?: {
        id: string;
        priority: string;
        color: string;
    };
    assignees: Array<{
        id: number;
        username: string;
        email: string;
    }>;
    due_date?: string;
    start_date?: string;
    url: string;
    list: {
        id: string;
        name: string;
    };
}

export interface CreateTaskInput {
    name: string;
    description?: string;
    assignees?: number[];
    priority?: 1 | 2 | 3 | 4; // 1=Urgent, 2=High, 3=Normal, 4=Low
    due_date?: number; // Unix timestamp in milliseconds
    status?: string;
}

export interface UpdateTaskInput {
    name?: string;
    description?: string;
    status?: string;
    priority?: 1 | 2 | 3 | 4;
    assignees?: { add?: number[]; rem?: number[] };
    due_date?: number;
}

// ==================== API Functions ====================

/**
 * Get all tasks in a list
 */
export async function getTasks(
    listId?: string
): Promise<{ tasks: ClickUpTask[] }> {
    const targetListId = listId ?? process.env.CLICKUP_DEFAULT_LIST_ID;
    if (!targetListId) {
        throw new Error("No list ID provided and CLICKUP_DEFAULT_LIST_ID not set");
    }

    const response = await fetch(
        `${CLICKUP_API_BASE}/list/${targetListId}/task`,
        { headers: getHeaders() }
    );

    if (!response.ok) {
        throw new Error(`ClickUp API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<{ tasks: ClickUpTask[] }>;
}

/**
 * Get a single task by ID
 */
export async function getTask(taskId: string): Promise<ClickUpTask> {
    const response = await fetch(
        `${CLICKUP_API_BASE}/task/${taskId}`,
        { headers: getHeaders() }
    );

    if (!response.ok) {
        throw new Error(`ClickUp API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<ClickUpTask>;
}

/**
 * Create a new task in a list
 */
export async function createTask(
    input: CreateTaskInput,
    listId?: string
): Promise<ClickUpTask> {
    const targetListId = listId ?? process.env.CLICKUP_DEFAULT_LIST_ID;
    if (!targetListId) {
        throw new Error("No list ID provided and CLICKUP_DEFAULT_LIST_ID not set");
    }

    const response = await fetch(
        `${CLICKUP_API_BASE}/list/${targetListId}/task`,
        {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({
                name: input.name,
                description: input.description,
                assignees: input.assignees,
                priority: input.priority,
                due_date: input.due_date,
                status: input.status,
            }),
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`ClickUp API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<ClickUpTask>;
}

/**
 * Update an existing task
 */
export async function updateTask(
    taskId: string,
    updates: UpdateTaskInput
): Promise<ClickUpTask> {
    const response = await fetch(
        `${CLICKUP_API_BASE}/task/${taskId}`,
        {
            method: "PUT",
            headers: getHeaders(),
            body: JSON.stringify(updates),
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`ClickUp API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<ClickUpTask>;
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<void> {
    const response = await fetch(
        `${CLICKUP_API_BASE}/task/${taskId}`,
        {
            method: "DELETE",
            headers: getHeaders(),
        }
    );

    if (!response.ok) {
        throw new Error(`ClickUp API error: ${response.status} ${response.statusText}`);
    }
}

/**
 * Get workspaces (teams) the user has access to
 */
export async function getWorkspaces(): Promise<{
    teams: Array<{ id: string; name: string }>;
}> {
    const response = await fetch(`${CLICKUP_API_BASE}/team`, {
        headers: getHeaders(),
    });

    if (!response.ok) {
        throw new Error(`ClickUp API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<{ teams: Array<{ id: string; name: string }> }>;
}

/**
 * Get spaces in a workspace
 */
export async function getSpaces(
    workspaceId?: string
): Promise<{ spaces: Array<{ id: string; name: string }> }> {
    const targetId = workspaceId ?? process.env.CLICKUP_WORKSPACE_ID;
    if (!targetId) {
        throw new Error("No workspace ID provided and CLICKUP_WORKSPACE_ID not set");
    }

    const response = await fetch(
        `${CLICKUP_API_BASE}/team/${targetId}/space`,
        { headers: getHeaders() }
    );

    if (!response.ok) {
        throw new Error(`ClickUp API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<{ spaces: Array<{ id: string; name: string }> }>;
}

/**
 * Get lists in a folder
 */
export async function getLists(
    folderId: string
): Promise<{ lists: Array<{ id: string; name: string }> }> {
    const response = await fetch(
        `${CLICKUP_API_BASE}/folder/${folderId}/list`,
        { headers: getHeaders() }
    );

    if (!response.ok) {
        throw new Error(`ClickUp API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<{ lists: Array<{ id: string; name: string }> }>;
}

// ==================== Helper Functions ====================

/**
 * Format task for Slack display
 */
export function formatTaskForSlack(task: ClickUpTask): string {
    const priority = task.priority?.priority ?? "None";
    const status = task.status.status;
    const assignees = task.assignees.map((a) => a.username).join(", ") || "Unassigned";
    const dueDate = task.due_date
        ? new Date(parseInt(task.due_date)).toLocaleDateString()
        : "No due date";

    return `• *${task.name}* (\`${task.id}\`)
  Status: ${status} | Priority: ${priority}
  Assigned: ${assignees} | Due: ${dueDate}
  <${task.url}|View in ClickUp>`;
}

/**
 * Parse priority from text
 */
export function parsePriority(text: string): 1 | 2 | 3 | 4 | undefined {
    const lower = text.toLowerCase();
    if (lower.includes("urgent") || lower.includes("p0")) return 1;
    if (lower.includes("high") || lower.includes("p1")) return 2;
    if (lower.includes("normal") || lower.includes("p2")) return 3;
    if (lower.includes("low") || lower.includes("p3")) return 4;
    return undefined;
}

// ==================== GitHub Integration ====================
// Bridges ClickUp tasks with GitHub branches, commits, and PRs.
// ClickUp auto-links activity when a valid task ID appears in
// commit messages, branch names, or PR titles/descriptions.
// Formats: #{task_id} | CU-{task_id} | {custom_task_id}
// Status update format: #{task_id}[status] or CU-{task_id}[status]
// Docs: https://help.clickup.com/hc/en-us/articles/6305771568791

/**
 * Format a ClickUp task ID for embedding in Git artifacts.
 * Uses the `CU-{id}` format which ClickUp recognizes automatically.
 */
export function formatTaskRef(clickUpTaskId: string): string {
    return `CU-${clickUpTaskId}`;
}

/**
 * Format a ClickUp task ID with an optional status update.
 * When included in a commit message or PR title, ClickUp will
 * automatically update the task to the specified status.
 * 
 * @example formatTaskRefWithStatus("abc123", "in progress") → "CU-abc123[in progress]"
 */
export function formatTaskRefWithStatus(
    clickUpTaskId: string,
    status: string
): string {
    return `CU-${clickUpTaskId}[${status}]`;
}

/**
 * Generate a branch name that includes the ClickUp task ID.
 * ClickUp auto-links branches when the task ID appears in the name.
 * 
 * @example buildBranchName("abc123", "xK9mP2qr") → "funbot/CU-abc123/xK9mP2qr"
 */
export function buildBranchName(
    clickUpTaskId: string,
    internalTaskId: string
): string {
    return `funbot/CU-${clickUpTaskId}/${internalTaskId.slice(0, 8)}`;
}

/**
 * Prefix a commit message with the ClickUp task reference.
 * ClickUp detects the ID and links the commit to the task.
 * Optionally appends a status update tag.
 * 
 * @example prefixCommitMessage("abc123", "feat: add login page")
 *   → "feat: add login page\n\nCU-abc123"
 * @example prefixCommitMessage("abc123", "feat: add login page", "in progress")
 *   → "feat: add login page\n\nCU-abc123[in progress]"
 */
export function prefixCommitMessage(
    clickUpTaskId: string,
    commitMessage: string,
    status?: string
): string {
    const ref = status
        ? formatTaskRefWithStatus(clickUpTaskId, status)
        : formatTaskRef(clickUpTaskId);
    return `${commitMessage}\n\n${ref}`;
}

/**
 * Enrich a PR title with the ClickUp task reference.
 * ClickUp detects the ID and links the PR to the task.
 * 
 * @example buildPrTitle("abc123", "feat: add login page") → "feat: add login page (CU-abc123)"
 */
export function buildPrTitle(
    clickUpTaskId: string,
    originalTitle: string
): string {
    return `${originalTitle} (CU-${clickUpTaskId})`;
}

/**
 * Enrich a PR description with the ClickUp task reference and link.
 * Adds a ClickUp section at the top of the description body.
 */
export function buildPrDescription(
    clickUpTaskId: string,
    originalBody: string,
    clickUpTaskUrl?: string
): string {
    const lines = [
        `## ClickUp`,
        ``,
        `Task: \`CU-${clickUpTaskId}\``,
    ];

    if (clickUpTaskUrl) {
        lines.push(`Link: ${clickUpTaskUrl}`);
    }

    lines.push(``, `---`, ``, originalBody);
    return lines.join("\n");
}

/**
 * Extract a ClickUp task ID from user text input.
 * Recognizes formats: CU-{id}, #{id}, or bare IDs following "clickup" mention.
 * 
 * @returns The bare task ID (without CU- or # prefix), or undefined
 */
export function extractClickUpId(text: string): string | undefined {
    // Match CU-{id} format
    const cuMatch = text.match(/\bCU-([a-z0-9]+)\b/i);
    if (cuMatch) return cuMatch[1];

    // Match #{id} format (ClickUp IDs are lowercase alphanumeric)
    const hashMatch = text.match(/#([a-z0-9]{6,})\b/i);
    if (hashMatch) return hashMatch[1];

    // Match "clickup:{id}" or "clickup {id}" format
    const clickupMatch = text.match(/\bclickup[:\s]+([a-z0-9]+)\b/i);
    if (clickupMatch) return clickupMatch[1];

    return undefined;
}

/**
 * Post a comment on a ClickUp task with a GitHub PR link.
 * This creates a bidirectional link between ClickUp and GitHub.
 */
export async function addTaskComment(
    taskId: string,
    commentText: string
): Promise<void> {
    const response = await fetch(
        `${CLICKUP_API_BASE}/task/${taskId}/comment`,
        {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ comment_text: commentText }),
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`ClickUp API error: ${response.status} - ${error}`);
    }
}

/**
 * Post a GitHub PR link as a comment on the ClickUp task.
 * Called after a PR is created to close the bidirectional loop.
 */
export async function linkPrToClickUp(
    clickUpTaskId: string,
    prUrl: string,
    commitSha?: string
): Promise<void> {
    const parts = [`🔗 **Pull Request Created**`, ``, prUrl];
    if (commitSha) {
        parts.push(``, `Commit: \`${commitSha.slice(0, 7)}\``);
    }
    parts.push(``, `_Linked automatically by DevBot._`);

    await addTaskComment(clickUpTaskId, parts.join("\n"));
}

/**
 * Update a ClickUp task status when Git activity happens.
 * Maps common Git events to ClickUp status names.
 */
export function gitEventToClickUpStatus(
    event: "branch_created" | "commit_pushed" | "pr_created" | "pr_merged"
): string {
    const statusMap: Record<string, string> = {
        branch_created: "in progress",
        commit_pushed: "in progress",
        pr_created: "in review",
        pr_merged: "complete",
    };
    return statusMap[event] ?? "in progress";
}

/**
 * Update a ClickUp task status in response to a Git event.
 * Uses the task API to set the new status.
 */
export async function syncStatusFromGitEvent(
    clickUpTaskId: string,
    event: "branch_created" | "commit_pushed" | "pr_created" | "pr_merged"
): Promise<void> {
    const status = gitEventToClickUpStatus(event);
    try {
        await updateTask(clickUpTaskId, { status });
    } catch (error) {
        // Non-fatal: log but don't break the workflow
        console.warn(
            `[clickup] Failed to sync status for CU-${clickUpTaskId} → ${status}:`,
            error
        );
    }
}
