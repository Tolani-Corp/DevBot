import { IntegrationTemplate } from '../types';

/**
 * Pre-built Make.com scenario templates for Tolani Bots
 */

export const BOTTLENECK_TO_JIRA: IntegrationTemplate = {
  id: 'bottleneck-to-jira',
  name: 'Bottleneck → Jira Ticket',
  description: 'Automatically create Jira tickets when Junior detects bottlenecks',
  category: 'project_management',
  services: ['Junior Bot', 'Jira'],
  blueprint: {
    name: 'Junior Bottleneck → Jira',
    flow: [
      {
        id: 1,
        module: 'webhook:CustomWebHook',
        version: 1,
        parameters: {},
        mapper: {},
      },
      {
        id: 2,
        module: 'jira:CreateIssue',
        version: 2,
        parameters: {
          connection: '{{jira.connection}}',
        },
        mapper: {
          project: '{{jira.projectKey}}',
          issuetype: 'Bug',
          summary: '{{1.data.title}}',
          description: '{{1.data.description}}',
          priority: '{{if(1.data.priority = "CRITICAL"; "Blocker"; if(1.data.priority = "HIGH"; "High"; "Medium"))}}',
          assignee: '{{1.data.assignedTo}}',
          customfield_junior_id: '{{1.data.id}}',
        },
      },
      {
        id: 3,
        module: 'slack:CreateMessage',
        version: 2,
        parameters: {
          connection: '{{slack.connection}}',
        },
        mapper: {
          channel: '#engineering',
          text: 'Urgent ticket created: {{2.key}} - {{2.fields.summary}}\\nAssigned to: @{{1.data.assignedTo}}\\n{{2.webUrl}}',
        },
      },
    ],
  },
  setupInstructions: [
    'Copy webhook URL from Module 1',
    'Add to Junior config: MAKE_WEBHOOK_BOTTLENECK_URL',
    'Configure Jira connection in Module 2',
    'Set your Jira project key',
    'Configure Slack connection in Module 3',
    'Enable the scenario',
  ],
};

export const APPROVAL_FROM_SALESFORCE: IntegrationTemplate = {
  id: 'approval-from-salesforce',
  name: 'Salesforce Customer → Junior Escalation',
  description: 'Escalate high-value customer issues to Junior for priority handling',
  category: 'crm',
  services: ['Salesforce', 'Junior Bot'],
  blueprint: {
    name: 'Salesforce → Junior Priority',
    flow: [
      {
        id: 1,
        module: 'salesforce:WatchRecords',
        version: 3,
        parameters: {
          connection: '{{salesforce.connection}}',
          object: 'Case',
        },
        mapper: {},
      },
      {
        id: 2,
        module: 'salesforce:GetRecord',
        version: 3,
        parameters: {
          connection: '{{salesforce.connection}}',
          object: 'Account',
          recordId: '{{1.AccountId}}',
        },
        mapper: {},
      },
      {
        id: 3,
        module: 'builtin:BasicFilter',
        version: 1,
        parameters: {},
        mapper: {
          condition: '{{2.AnnualRevenue > 100000}}',
        },
      },
      {
        id: 4,
        module: 'http:ActionSendData',
        version: 3,
        parameters: {
          url: '{{junior.webhookUrl}}',
          method: 'POST',
        },
        mapper: {
          body: {
            action: 'escalate',
            taskId: '{{1.Id}}',
            priority: 'CRITICAL',
            metadata: {
              customerName: '{{2.Name}}',
              annualRevenue: '{{2.AnnualRevenue}}',
              caseSubject: '{{1.Subject}}',
              caseDescription: '{{1.Description}}',
            },
          },
        },
      },
    ],
  },
  setupInstructions: [
    'Configure Salesforce connection in Module 1',
    'Set Junior webhook URL in Module 4',
    'Adjust revenue threshold in Module 3 (default: $100K)',
    'Enable the scenario',
  ],
};

export const STRIPE_PAYMENT_APPROVAL: IntegrationTemplate = {
  id: 'stripe-payment-approval',
  name: 'Stripe Large Payment → Approval',
  description: 'Route large payments to CFO/CEO for approval via Junior',
  category: 'finance',
  services: ['Stripe', 'Junior Bot'],
  blueprint: {
    name: 'Stripe → Junior Approval',
    flow: [
      {
        id: 1,
        module: 'stripe:WatchEvents',
        version: 3,
        parameters: {
          connection: '{{stripe.connection}}',
          eventType: 'payment_intent.succeeded',
        },
        mapper: {},
      },
      {
        id: 2,
        module: 'builtin:BasicFilter',
        version: 1,
        parameters: {},
        mapper: {
          condition: '{{1.data.object.amount > 5000000}}', // $50K in cents
        },
      },
      {
        id: 3,
        module: 'http:ActionSendData',
        version: 3,
        parameters: {
          url: '{{junior.webhookUrl}}',
          method: 'POST',
        },
        mapper: {
          body: {
            event: 'approval_needed',
            data: {
              id: '{{1.id}}',
              title: 'Large payment received: ${{formatNumber(1.data.object.amount / 100; 0; ","; ".")}}',
              description: 'Payment ID: {{1.data.object.id}}\\nCustomer: {{1.data.object.customer}}',
              priority: 'HIGH',
              assignedTo: 'CFO',
              metadata: {
                amount: '{{1.data.object.amount}}',
                currency: '{{1.data.object.currency}}',
                customer: '{{1.data.object.customer}}',
              },
            },
          },
        },
      },
    ],
  },
  setupInstructions: [
    'Configure Stripe webhook in Module 1',
    'Adjust payment threshold in Module 2 (default: $50K)',
    'Set Junior webhook URL in Module 3',
    'Enable the scenario',
  ],
};

export const GITHUB_DEPLOY_NOTIFICATION: IntegrationTemplate = {
  id: 'github-deploy-notification',
  name: 'GitHub Deploy → OpsBot Notification',
  description: 'Notify OpsBot when production deployments happen',
  category: 'devops',
  services: ['GitHub', 'OpsBot'],
  blueprint: {
    name: 'GitHub → OpsBot',
    flow: [
      {
        id: 1,
        module: 'github:WatchEvents',
        version: 3,
        parameters: {
          connection: '{{github.connection}}',
          repository: '{{github.repository}}',
          event: 'deployment',
        },
        mapper: {},
      },
      {
        id: 2,
        module: 'builtin:BasicFilter',
        version: 1,
        parameters: {},
        mapper: {
          condition: '{{1.deployment.environment = "production"}}',
        },
      },
      {
        id: 3,
        module: 'http:ActionSendData',
        version: 3,
        parameters: {
          url: '{{opsbot.webhookUrl}}',
          method: 'POST',
        },
        mapper: {
          body: {
            event: 'deployment_started',
            data: {
              id: '{{1.deployment.id}}',
              environment: '{{1.deployment.environment}}',
              ref: '{{1.deployment.ref}}',
              creator: '{{1.deployment.creator.login}}',
              timestamp: '{{1.deployment.created_at}}',
            },
          },
        },
      },
    ],
  },
  setupInstructions: [
    'Configure GitHub webhook in Module 1',
    'Set repository name',
    'Set OpsBot webhook URL in Module 3',
    'Enable the scenario',
  ],
};

export const DATADOG_ALERT_CRISIS: IntegrationTemplate = {
  id: 'datadog-alert-crisis',
  name: 'Datadog Alert → Junior Crisis Mode',
  description: 'Activate Junior crisis mode when critical Datadog alerts fire',
  category: 'analytics',
  services: ['Datadog', 'Junior Bot'],
  blueprint: {
    name: 'Datadog → Junior Crisis',
    flow: [
      {
        id: 1,
        module: 'webhook:CustomWebHook',
        version: 1,
        parameters: {},
        mapper: {},
      },
      {
        id: 2,
        module: 'builtin:BasicFilter',
        version: 1,
        parameters: {},
        mapper: {
          condition: '{{1.alert_type = "error" or 1.priority = "critical"}}',
        },
      },
      {
        id: 3,
        module: 'http:ActionSendData',
        version: 3,
        parameters: {
          url: '{{junior.webhookUrl}}',
          method: 'POST',
        },
        mapper: {
          body: {
            event: 'crisis_mode_activated',
            data: {
              id: '{{1.id}}',
              title: 'Production Alert: {{1.title}}',
              description: '{{1.body}}',
              priority: 'CRITICAL',
              metadata: {
                alertType: '{{1.alert_type}}',
                metric: '{{1.metric}}',
                value: '{{1.snapshot}}',
              },
            },
          },
        },
      },
      {
        id: 4,
        module: 'slack:CreateMessage',
        version: 2,
        parameters: {
          connection: '{{slack.connection}}',
        },
        mapper: {
          channel: '#incidents',
          text: '🚨 CRISIS MODE ACTIVATED\\n{{1.title}}\\n{{1.body}}',
        },
      },
    ],
  },
  setupInstructions: [
    'Copy webhook URL from Module 1',
    'Add to Datadog webhook integrations',
    'Set Junior webhook URL in Module 3',
    'Configure Slack connection in Module 4',
    'Enable the scenario',
  ],
};

/**
 * All available templates
 */
export const TEMPLATES: IntegrationTemplate[] = [
  BOTTLENECK_TO_JIRA,
  APPROVAL_FROM_SALESFORCE,
  STRIPE_PAYMENT_APPROVAL,
  GITHUB_DEPLOY_NOTIFICATION,
  DATADOG_ALERT_CRISIS,
];

/**
 * Get template by ID
 */
export function getTemplate(id: string): IntegrationTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(
  category: IntegrationTemplate['category']
): IntegrationTemplate[] {
  return TEMPLATES.filter((t) => t.category === category);
}

/**
 * Get templates by service
 */
export function getTemplatesByService(service: string): IntegrationTemplate[] {
  return TEMPLATES.filter((t) =>
    t.services.some((s) => s.toLowerCase().includes(service.toLowerCase()))
  );
}
