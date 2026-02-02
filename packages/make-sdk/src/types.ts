import { z } from 'zod';

/**
 * Make.com API Configuration
 */
export interface MakeConfig {
  /** Make.com API token (from account settings) */
  apiToken: string;
  /** Team/Organization ID */
  teamId: string;
  /** Base URL (default: https://www.make.com/api/v2) */
  baseUrl?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Retry configuration */
  retry?: {
    maxRetries: number;
    retryDelay: number;
  };
}

/**
 * Make.com Webhook Configuration
 */
export interface WebhookConfig {
  /** Webhook URL from Make scenario */
  url: string;
  /** Optional webhook secret for validation */
  secret?: string;
  /** Custom headers to include */
  headers?: Record<string, string>;
  /** Timeout for webhook requests (ms) */
  timeout?: number;
}

/**
 * Make.com Scenario
 */
export interface Scenario {
  id: string;
  name: string;
  teamId: string;
  folderId?: string;
  isRunning: boolean;
  scheduling?: {
    type: 'interval' | 'cron';
    interval?: number;
    cron?: string;
  };
  blueprint?: any;
  createdAt: string;
  updatedAt: string;
}

/**
 * Scenario Execution
 */
export interface ScenarioExecution {
  id: string;
  scenarioId: string;
  status: 'success' | 'error' | 'running' | 'incomplete';
  startedAt: string;
  finishedAt?: string;
  duration?: number;
  operationsUsed: number;
  error?: {
    message: string;
    code?: string;
  };
}

/**
 * Make.com Data Store
 */
export interface DataStore {
  id: string;
  name: string;
  teamId: string;
  size: number;
  maxSize: number;
  createdAt: string;
}

/**
 * Data Store Record
 */
export interface DataStoreRecord {
  key: string;
  value: any;
  createdAt: string;
  updatedAt: string;
}

/**
 * Webhook Payload (generic)
 */
export const WebhookPayloadSchema = z.object({
  event: z.string(),
  timestamp: z.string().datetime().optional(),
  data: z.record(z.any()),
});

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

/**
 * Junior Bot → Make.com Events
 */
export type JuniorEvent =
  | 'bottleneck_detected'
  | 'approval_needed'
  | 'approval_completed'
  | 'task_escalated'
  | 'sla_breach'
  | 'crisis_mode_activated'
  | 'daily_brief_ready'
  | 'recommendation_generated';

export interface JuniorWebhookPayload {
  event: JuniorEvent;
  timestamp: string;
  data: {
    id: string;
    title: string;
    description?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    assignedTo?: string;
    metadata?: Record<string, any>;
  };
}

/**
 * Make.com → Junior Bot Response
 */
export interface MakeToJuniorPayload {
  action: 'approve' | 'reject' | 'escalate' | 'update' | 'complete';
  taskId: string;
  decision?: string;
  rationale?: string;
  metadata?: Record<string, any>;
}

/**
 * Integration Template
 */
export interface IntegrationTemplate {
  id: string;
  name: string;
  description: string;
  category: 'project_management' | 'crm' | 'finance' | 'devops' | 'hr' | 'analytics' | 'custom';
  services: string[];
  webhookUrl?: string;
  blueprint: any;
  setupInstructions: string[];
}

/**
 * Make.com Error Response
 */
export interface MakeError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: any;
}

/**
 * Webhook Response
 */
export interface WebhookResponse {
  success: boolean;
  accepted: boolean;
  executionId?: string;
  error?: MakeError;
}
