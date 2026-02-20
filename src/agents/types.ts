export type AgentRole =
  | "frontend"
  | "backend"
  | "security"
  | "devops"
  | "arb-runner"
  | "media"
  | "general";

export type AgentStatus = "idle" | "working" | "completed" | "failed" | "requeued";

export interface AgentTask {
  id: string;
  description: string;
  role: AgentRole;
  parentTaskId: string;
  dependencies: string[]; // IDs of tasks that must complete first
  status: AgentStatus;
  result?: AgentResult;
  assignedAt?: Date;
  completedAt?: Date;
  attempt: number; // Track retry attempts
  maxAttempts: number;
  requeueReason?: string;
}

export interface AgentResult {
  success: boolean;
  output: string;
  changes?: Array<{
    file: string;
    content: string;
    explanation: string;
  }>;
  error?: string;
  verificationPassed?: boolean; // Set after redevelopment verification
}

export interface AgentConfig {
  role: AgentRole;
  systemPrompt: string;
  filePatterns: string[]; // glob patterns this agent handles
  capabilities: string[];
}

export interface OrchestratorPlan {
  subtasks: AgentTask[];
  executionOrder: string[][]; // groups of task IDs that can run in parallel
  estimatedComplexity: "simple" | "moderate" | "complex";
}

/**
 * Redevelopment queue: completed tasks go here for verification.
 * If verification fails, the task is retried with error context.
 */
export interface RedevelopmentEntry {
  task: AgentTask;
  originalResult: AgentResult;
  verificationErrors: string[];
  requeuedAt: Date;
}

export interface RedevelopmentQueue {
  entries: RedevelopmentEntry[];
  maxRetries: number;
  verifyFn?: (task: AgentTask, result: AgentResult) => Promise<VerificationResult>;
}

export interface VerificationResult {
  passed: boolean;
  errors: string[];
  suggestions: string[];
}
