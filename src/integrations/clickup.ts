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
