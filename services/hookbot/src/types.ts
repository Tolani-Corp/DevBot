import { z } from 'zod';

/**
 * Workflow Step Types
 */
export type StepType =
  | 'http'
  | 'transform'
  | 'condition'
  | 'adapter_action'
  | 'junior_action'
  | 'loop'
  | 'delay';

/**
 * Workflow Step
 */
export interface Step {
  id: string;
  type: StepType;
  name?: string;
  when?: string; // Condition expression
  onError?: 'continue' | 'stop' | 'retry';
  maxRetries?: number;
  params: Record<string, any>;
  output?: string; // Variable name for output
}

/**
 * Workflow Definition
 */
export interface WorkflowDefinition {
  id?: string;
  name: string;
  description?: string;
  enabled?: boolean;
  trigger: {
    service: string;
    event: string;
  };
  steps: Step[];
  config?: {
    timeout?: number;
    retryPolicy?: {
      maxRetries: number;
      backoff: 'fixed' | 'exponential';
      initialDelay: number;
    };
  };
}

/**
 * Workflow Execution Context
 */
export interface ExecutionContext {
  workflowId: string;
  executionId: string;
  trigger: {
    service: string;
    event: string;
    payload: any;
  };
  variables: Record<string, any>;
  metadata: {
    startedAt: Date;
    currentStep?: string;
  };
}

/**
 * Adapter Interface
 */
export interface IAdapter {
  name: string;
  service: string;
  
  /**
   * Initialize adapter with configuration
   */
  initialize(config: Record<string, any>): Promise<void>;
  
  /**
   * Execute an action
   */
  execute(action: string, params: Record<string, any>, context: ExecutionContext): Promise<any>;
  
  /**
   * Handle incoming webhook
   */
  handleWebhook?(event: string, payload: any): Promise<void>;
  
  /**
   * Validate webhook signature
   */
  validateWebhook?(payload: any, signature: string, headers: Record<string, string>): boolean;
}

/**
 * HTTP Step Params
 */
export const HttpStepParamsSchema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  timeout: z.number().optional(),
});

export type HttpStepParams = z.infer<typeof HttpStepParamsSchema>;

/**
 * Transform Step Params
 */
export const TransformStepParamsSchema = z.object({
  input: z.string(), // Variable reference
  expression: z.string(), // JavaScript expression
});

export type TransformStepParams = z.infer<typeof TransformStepParamsSchema>;

/**
 * Condition Step Params
 */
export const ConditionStepParamsSchema = z.object({
  condition: z.string(), // Boolean expression
  onTrue: z.array(z.any()).optional(), // Steps to run if true
  onFalse: z.array(z.any()).optional(), // Steps to run if false
});

export type ConditionStepParams = z.infer<typeof ConditionStepParamsSchema>;

/**
 * Adapter Action Step Params
 */
export const AdapterActionStepParamsSchema = z.object({
  adapter: z.string(), // Adapter name (e.g., 'jira')
  action: z.string(), // Action name (e.g., 'createIssue')
  params: z.record(z.any()), // Action-specific parameters
});

export type AdapterActionStepParams = z.infer<typeof AdapterActionStepParamsSchema>;

/**
 * Junior Action Step Params
 */
export const JuniorActionStepParamsSchema = z.object({
  action: z.enum(['escalate', 'approve', 'reject', 'update', 'complete']),
  taskId: z.string(),
  data: z.record(z.any()).optional(),
});

export type JuniorActionStepParams = z.infer<typeof JuniorActionStepParamsSchema>;

/**
 * Loop Step Params
 */
export const LoopStepParamsSchema = z.object({
  items: z.string(), // Variable reference to array
  steps: z.array(z.any()), // Steps to run for each item
});

export type LoopStepParams = z.infer<typeof LoopStepParamsSchema>;

/**
 * Delay Step Params
 */
export const DelayStepParamsSchema = z.object({
  duration: z.number(), // Milliseconds
});

export type DelayStepParams = z.infer<typeof DelayStepParamsSchema>;
