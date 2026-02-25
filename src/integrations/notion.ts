/**
 * Notion API Integration for DevBot
 * API: https://developers.notion.com/reference
 *
 * Env vars required:
 *   NOTION_API_KEY         - Internal integration token (secret_xxx)
 *   NOTION_TASKS_DB_ID     - Database ID for task intake
 *   NOTION_CHANGELOG_DB_ID - Database ID for PR/commit changelog
 *   NOTION_INCIDENTS_DB_ID - Database ID for incident log
 */

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function getHeaders(): Record<string, string> {
    const token = process.env.NOTION_API_KEY;
    if (!token) {
        throw new Error("NOTION_API_KEY is not configured");
    }
    return {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    };
}

// ==================== Types ====================

export interface NotionPage {
    id: string;
    url: string;
    created_time: string;
    last_edited_time: string;
    properties: Record<string, any>;
}

export interface NotionDatabase {
    id: string;
    title: Array<{ plain_text: string }>;
    properties: Record<string, any>;
}

export interface NotionTaskRow {
    title: string;
    repo?: string;
    branch?: string;
    priority?: "urgent" | "high" | "normal" | "low";
    status?: string;
    description?: string;
    taskId?: string;
}

export type CreateTaskRowInput = Partial<NotionTaskRow> & { title: string };

export interface PRChangelogRow {
    taskId: string;
    prUrl: string;
    commitSha: string;
    branch: string;
    filesChanged: number;
    description?: string;
    repo: string;
}

export interface IncidentRow {
    title: string;
    severity: "critical" | "high" | "medium" | "low";
    repo: string;
    description?: string;
    status?: string;
    suggestedFix?: string;
}

// ==================== API Functions ====================

/**
 * Query a Notion database with an optional filter.
 * Returns all matching page objects.
 */
export async function queryDatabase(
    databaseId: string,
    filter?: object
): Promise<NotionPage[]> {
    const body: Record<string, any> = {};
    if (filter) {
        body.filter = filter;
    }

    const response = await fetch(
        `${NOTION_API_BASE}/databases/${databaseId}/query`,
        {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(body),
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Notion API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as { results: NotionPage[] };
    return data.results;
}

/**
 * Create a new page (row) in a Notion database.
 */
export async function createPage(
    databaseId: string,
    properties: Record<string, any>
): Promise<NotionPage> {
    const response = await fetch(`${NOTION_API_BASE}/pages`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
            parent: { database_id: databaseId },
            properties,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Notion API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<NotionPage>;
}

/**
 * Update properties on an existing Notion page.
 */
export async function updatePage(
    pageId: string,
    properties: Record<string, any>
): Promise<NotionPage> {
    const response = await fetch(`${NOTION_API_BASE}/pages/${pageId}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Notion API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<NotionPage>;
}

/**
 * Retrieve a single Notion page by ID.
 */
export async function getPage(pageId: string): Promise<NotionPage> {
    const response = await fetch(`${NOTION_API_BASE}/pages/${pageId}`, {
        headers: getHeaders(),
    });

    if (!response.ok) {
        throw new Error(`Notion API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<NotionPage>;
}

/**
 * Get tasks from NOTION_TASKS_DB_ID.
 * Optionally filter by the "Status" select property.
 */
export async function getTasks(status?: string): Promise<NotionPage[]> {
    const databaseId = process.env.NOTION_TASKS_DB_ID;
    if (!databaseId) {
        throw new Error("NOTION_TASKS_DB_ID is not configured");
    }

    const filter = status
        ? {
              property: "Status",
              select: { equals: status },
          }
        : undefined;

    return queryDatabase(databaseId, filter);
}

/**
 * Create a task row in NOTION_TASKS_DB_ID.
 * Maps DevBot task fields to Notion property format.
 */
export async function createTaskRow(
    input: CreateTaskRowInput
): Promise<NotionPage> {
    const databaseId = process.env.NOTION_TASKS_DB_ID;
    if (!databaseId) {
        throw new Error("NOTION_TASKS_DB_ID is not configured");
    }

    const properties: Record<string, any> = {
        Name: {
            title: [{ text: { content: input.title } }],
        },
    };

    if (input.status) {
        properties["Status"] = { select: { name: input.status } };
    }

    if (input.priority) {
        properties["Priority"] = { select: { name: input.priority } };
    }

    if (input.repo) {
        properties["Repo"] = { rich_text: [{ text: { content: input.repo } }] };
    }

    if (input.branch) {
        properties["Branch"] = { rich_text: [{ text: { content: input.branch } }] };
    }

    if (input.description) {
        properties["Description"] = {
            rich_text: [{ text: { content: input.description } }],
        };
    }

    if (input.taskId) {
        properties["Task ID"] = {
            rich_text: [{ text: { content: input.taskId } }],
        };
    }

    return createPage(databaseId, properties);
}

/**
 * Write a PR/commit changelog entry to NOTION_CHANGELOG_DB_ID.
 */
export async function writeChangelogEntry(
    input: PRChangelogRow
): Promise<NotionPage> {
    const databaseId = process.env.NOTION_CHANGELOG_DB_ID;
    if (!databaseId) {
        throw new Error("NOTION_CHANGELOG_DB_ID is not configured");
    }

    const properties: Record<string, any> = {
        Name: {
            title: [{ text: { content: `PR: ${input.branch} → ${input.repo}` } }],
        },
        "Task ID": {
            rich_text: [{ text: { content: input.taskId } }],
        },
        "PR URL": {
            url: input.prUrl,
        },
        "Commit SHA": {
            rich_text: [{ text: { content: input.commitSha } }],
        },
        Branch: {
            rich_text: [{ text: { content: input.branch } }],
        },
        Repo: {
            rich_text: [{ text: { content: input.repo } }],
        },
        "Files Changed": {
            number: input.filesChanged,
        },
    };

    if (input.description) {
        properties["Description"] = {
            rich_text: [{ text: { content: input.description } }],
        };
    }

    return createPage(databaseId, properties);
}

/**
 * Log an incident to NOTION_INCIDENTS_DB_ID.
 */
export async function logIncident(input: IncidentRow): Promise<NotionPage> {
    const databaseId = process.env.NOTION_INCIDENTS_DB_ID;
    if (!databaseId) {
        throw new Error("NOTION_INCIDENTS_DB_ID is not configured");
    }

    const properties: Record<string, any> = {
        Name: {
            title: [{ text: { content: input.title } }],
        },
        Severity: {
            select: { name: input.severity },
        },
        Repo: {
            rich_text: [{ text: { content: input.repo } }],
        },
    };

    if (input.status) {
        properties["Status"] = { select: { name: input.status } };
    }

    if (input.description) {
        properties["Description"] = {
            rich_text: [{ text: { content: input.description } }],
        };
    }

    if (input.suggestedFix) {
        properties["Suggested Fix"] = {
            rich_text: [{ text: { content: input.suggestedFix } }],
        };
    }

    return createPage(databaseId, properties);
}

/**
 * Update the Status select property on a Notion task page.
 */
export async function updateTaskStatus(
    pageId: string,
    status: string
): Promise<NotionPage> {
    return updatePage(pageId, {
        Status: { select: { name: status } },
    });
}

/**
 * Fetch all block children for a page and concatenate rich_text content
 * from paragraph and heading blocks into a plain string.
 * Suitable for RAG ingestion.
 */
export async function getPageContent(pageId: string): Promise<string> {
    const response = await fetch(
        `${NOTION_API_BASE}/blocks/${pageId}/children?page_size=100`,
        { headers: getHeaders() }
    );

    if (!response.ok) {
        throw new Error(`Notion API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
        results: Array<{
            type: string;
            [key: string]: any;
        }>;
    };

    const textBlocks = [
        "paragraph",
        "heading_1",
        "heading_2",
        "heading_3",
        "bulleted_list_item",
        "numbered_list_item",
        "quote",
        "callout",
    ];

    const lines: string[] = [];

    for (const block of data.results) {
        if (textBlocks.includes(block.type)) {
            const richText: Array<{ plain_text?: string }> =
                block[block.type]?.rich_text ?? [];
            const text = richText.map((t) => t.plain_text ?? "").join("");
            if (text.trim()) {
                lines.push(text);
            }
        }
    }

    return lines.join("\n");
}

/**
 * Sync all pages from a Notion database for RAG ingestion.
 * Queries every page, fetches its block content, and returns
 * an array of { id, title, content } objects.
 */
export async function syncPagesForRAG(
    databaseId: string
): Promise<Array<{ id: string; title: string; content: string }>> {
    const pages = await queryDatabase(databaseId);

    const results = await Promise.all(
        pages.map(async (page) => {
            // Extract title from the first title-type property
            let title = page.id;
            for (const [, value] of Object.entries(page.properties)) {
                const prop = value as any;
                if (prop?.type === "title" && Array.isArray(prop.title)) {
                    title = prop.title.map((t: any) => t.plain_text ?? "").join("");
                    break;
                }
            }

            const content = await getPageContent(page.id);

            return { id: page.id, title, content };
        })
    );

    return results;
}
