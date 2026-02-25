/**
 * Linear API Integration for DevBot
 * API: https://developers.linear.app/docs/graphql/working-with-the-graphql-api
 *
 * Env vars required:
 *   LINEAR_API_KEY      - Linear personal API key
 *   LINEAR_TEAM_ID      - Default team ID for issue creation
 */

const LINEAR_API_URL = "https://api.linear.app/graphql";

function getHeaders(): Record<string, string> {
    const token = process.env.LINEAR_API_KEY;
    if (!token) {
        throw new Error("LINEAR_API_KEY is not configured");
    }
    return {
        Authorization: token,
        "Content-Type": "application/json",
    };
}

// ==================== Types ====================

export interface LinearIssue {
    id: string;
    identifier: string;
    title: string;
    description?: string;
    url: string;
    priority: number;
    state: {
        name: string;
    };
    assignee?: {
        name: string;
    };
}

export interface CreateIssueInput {
    title: string;
    description?: string;
    teamId?: string;
    /** Priority: 0=No priority, 1=Urgent, 2=High, 3=Normal, 4=Low */
    priority?: 0 | 1 | 2 | 3 | 4;
    assigneeId?: string;
    labelIds?: string[];
}

// ==================== Core GraphQL Client ====================

/**
 * Execute a GraphQL query or mutation against the Linear API.
 */
export async function linearQuery<T>(
    query: string,
    variables?: object
): Promise<T> {
    const response = await fetch(LINEAR_API_URL, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Linear API error: ${response.status} - ${error}`);
    }

    const json = await response.json() as { data: T; errors?: Array<{ message: string }> };

    if (json.errors && json.errors.length > 0) {
        throw new Error(`Linear GraphQL error: ${json.errors.map((e) => e.message).join(", ")}`);
    }

    return json.data;
}

// ==================== API Functions ====================

/**
 * Get open issues for a team. Defaults to LINEAR_TEAM_ID if no teamId is provided.
 */
export async function getIssues(teamId?: string): Promise<LinearIssue[]> {
    const targetTeamId = teamId ?? process.env.LINEAR_TEAM_ID;
    if (!targetTeamId) {
        throw new Error("No team ID provided and LINEAR_TEAM_ID not set");
    }

    const query = `
        query GetIssues($teamId: String!) {
            team(id: $teamId) {
                issues(filter: { state: { type: { nin: ["completed", "cancelled"] } } }) {
                    nodes {
                        id
                        identifier
                        title
                        description
                        url
                        priority
                        state {
                            name
                        }
                        assignee {
                            name
                        }
                    }
                }
            }
        }
    `;

    const data = await linearQuery<{
        team: { issues: { nodes: LinearIssue[] } };
    }>(query, { teamId: targetTeamId });

    return data.team.issues.nodes;
}

/**
 * Fetch a single Linear issue by its ID.
 */
export async function getIssue(id: string): Promise<LinearIssue> {
    const query = `
        query GetIssue($id: String!) {
            issue(id: $id) {
                id
                identifier
                title
                description
                url
                priority
                state {
                    name
                }
                assignee {
                    name
                }
            }
        }
    `;

    const data = await linearQuery<{ issue: LinearIssue }>(query, { id });
    return data.issue;
}

/**
 * Create a new Linear issue.
 * Uses LINEAR_TEAM_ID if input.teamId is not provided.
 */
export async function createIssue(input: CreateIssueInput): Promise<LinearIssue> {
    const targetTeamId = input.teamId ?? process.env.LINEAR_TEAM_ID;
    if (!targetTeamId) {
        throw new Error("No team ID provided and LINEAR_TEAM_ID not set");
    }

    const mutation = `
        mutation CreateIssue($input: IssueCreateInput!) {
            issueCreate(input: $input) {
                success
                issue {
                    id
                    identifier
                    title
                    description
                    url
                    priority
                    state {
                        name
                    }
                    assignee {
                        name
                    }
                }
            }
        }
    `;

    const variables = {
        input: {
            teamId: targetTeamId,
            title: input.title,
            description: input.description,
            priority: input.priority,
            assigneeId: input.assigneeId,
            labelIds: input.labelIds,
        },
    };

    const data = await linearQuery<{
        issueCreate: { success: boolean; issue: LinearIssue };
    }>(mutation, variables);

    if (!data.issueCreate.success) {
        throw new Error("Linear issueCreate mutation returned success: false");
    }

    return data.issueCreate.issue;
}

/**
 * Update the workflow state of a Linear issue.
 */
export async function updateIssueState(
    issueId: string,
    stateId: string
): Promise<LinearIssue> {
    const mutation = `
        mutation UpdateIssueState($id: String!, $stateId: String!) {
            issueUpdate(id: $id, input: { stateId: $stateId }) {
                success
                issue {
                    id
                    identifier
                    title
                    description
                    url
                    priority
                    state {
                        name
                    }
                    assignee {
                        name
                    }
                }
            }
        }
    `;

    const data = await linearQuery<{
        issueUpdate: { success: boolean; issue: LinearIssue };
    }>(mutation, { id: issueId, stateId });

    if (!data.issueUpdate.success) {
        throw new Error("Linear issueUpdate mutation returned success: false");
    }

    return data.issueUpdate.issue;
}

/**
 * Convenience function: create a Linear issue from a DevBot task.
 * Automatically uses LINEAR_TEAM_ID and formats the description with repo context.
 */
export async function createIssueFromTask(
    title: string,
    description: string,
    repo: string
): Promise<LinearIssue> {
    const teamId = process.env.LINEAR_TEAM_ID;
    if (!teamId) {
        throw new Error("LINEAR_TEAM_ID is not configured");
    }

    const formattedDescription = [
        description,
        "",
        "---",
        "",
        `**Repository:** \`${repo}\``,
        `**Created by:** DevBot`,
    ].join("\n");

    return createIssue({
        teamId,
        title,
        description: formattedDescription,
        priority: 3, // Normal
    });
}

/**
 * Post a comment on a Linear issue linking it to a GitHub PR and commit.
 * Creates a bidirectional link between Linear and GitHub.
 */
export async function writePRLinkToIssue(
    issueId: string,
    prUrl: string,
    commitSha: string
): Promise<void> {
    const mutation = `
        mutation CreateComment($input: CommentCreateInput!) {
            commentCreate(input: $input) {
                success
            }
        }
    `;

    const body = [
        "🔗 **Pull Request Linked**",
        "",
        `PR: ${prUrl}`,
        `Commit: \`${commitSha.slice(0, 7)}\``,
        "",
        "_Linked automatically by DevBot._",
    ].join("\n");

    const data = await linearQuery<{
        commentCreate: { success: boolean };
    }>(mutation, {
        input: { issueId, body },
    });

    if (!data.commentCreate.success) {
        throw new Error("Linear commentCreate mutation returned success: false");
    }
}
