import axios from 'axios';
import { IAdapter, ExecutionContext } from '../types';

/**
 * Jira Adapter
 * Handles Jira API interactions and webhooks
 */
export class JiraAdapter implements IAdapter {
  name = 'Jira';
  service = 'jira';

  private baseUrl!: string;
  private auth!: { email: string; apiToken: string };

  async initialize(config: Record<string, any>): Promise<void> {
    this.baseUrl = config.url;
    this.auth = {
      email: config.email,
      apiToken: config.apiToken,
    };
  }

  async execute(action: string, params: Record<string, any>, _context: ExecutionContext): Promise<any> {
    switch (action) {
      case 'createIssue':
        return this.createIssue(params as any);

      case 'updateIssue':
        return this.updateIssue(params.issueKey, params.fields);

      case 'addComment':
        return this.addComment(params.issueKey, params.body);

      case 'transitionIssue':
        return this.transitionIssue(params.issueKey, params.transitionId);

      default:
        throw new Error(`Unknown Jira action: ${action}`);
    }
  }

  /**
   * Create a Jira issue
   */
  private async createIssue(params: {
    project: string;
    summary: string;
    description?: string;
    issuetype?: string;
    priority?: string;
    assignee?: string;
    [key: string]: any;
  }): Promise<any> {
    const response = await axios.post(
      `${this.baseUrl}/rest/api/3/issue`,
      {
        fields: {
          project: { key: params.project },
          summary: params.summary,
          description: params.description ? {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: params.description }],
              },
            ],
          } : undefined,
          issuetype: { name: params.issuetype || 'Task' },
          priority: params.priority ? { name: params.priority } : undefined,
          assignee: params.assignee ? { name: params.assignee } : undefined,
          ...params.customFields,
        },
      },
      {
        auth: {
          username: this.auth.email,
          password: this.auth.apiToken,
        },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      key: response.data.key,
      id: response.data.id,
      self: response.data.self,
      webUrl: `${this.baseUrl}/browse/${response.data.key}`,
    };
  }

  /**
   * Update a Jira issue
   */
  private async updateIssue(issueKey: string, fields: Record<string, any>): Promise<void> {
    await axios.put(
      `${this.baseUrl}/rest/api/3/issue/${issueKey}`,
      { fields },
      {
        auth: {
          username: this.auth.email,
          password: this.auth.apiToken,
        },
      }
    );
  }

  /**
   * Add a comment to an issue
   */
  private async addComment(issueKey: string, body: string): Promise<any> {
    const response = await axios.post(
      `${this.baseUrl}/rest/api/3/issue/${issueKey}/comment`,
      {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: body }],
            },
          ],
        },
      },
      {
        auth: {
          username: this.auth.email,
          password: this.auth.apiToken,
        },
      }
    );

    return response.data;
  }

  /**
   * Transition an issue
   */
  private async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    await axios.post(
      `${this.baseUrl}/rest/api/3/issue/${issueKey}/transitions`,
      {
        transition: { id: transitionId },
      },
      {
        auth: {
          username: this.auth.email,
          password: this.auth.apiToken,
        },
      }
    );
  }

  /**
   * Validate Jira webhook
   */
  validateWebhook(payload: any, _signature: string, _headers: Record<string, string>): boolean {
    // Jira doesn't use signatures, but you can validate by checking payload structure
    return payload.webhookEvent !== undefined && payload.issue !== undefined;
  }

  /**
   * Handle incoming Jira webhook
   */
  async handleWebhook(event: string, payload: any): Promise<void> {
    // Process webhook events (e.g., issue updated, commented)
    console.log(`Jira webhook: ${event}`, payload);
  }
}
