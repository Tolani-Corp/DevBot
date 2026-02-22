import { nanoid } from "nanoid";

/**
 * Reasoning step types following chain-of-thought decomposition.
 */
export type ReasoningStepType = 
  | "thought"      // Internal reasoning, planning
  | "action"       // Concrete action taken
  | "observation"  // Result of an action
  | "reflection";  // Analysis of outcomes, lessons learned

/**
 * A single step in the reasoning process.
 */
export interface ReasoningStep {
  id: string;
  type: ReasoningStepType;
  timestamp: Date;
  content: string;
  
  // Optional metadata
  confidence?: number; // 0-1, how confident the agent is
  alternatives?: string[]; // Other options considered
  metadata?: Record<string, unknown>;
  
  // Link to parent step (for branching reasoning)
  parentStepId?: string;
}

/**
 * Complete reasoning trace for a task or subtask.
 */
export interface ReasoningTrace {
  id: string;
  taskId: string;
  agentRole?: string;
  
  steps: ReasoningStep[];
  
  // Summary statistics
  startedAt: Date;
  completedAt?: Date;
  totalSteps: number;
  
  // Outcome
  success: boolean;
  finalDecision?: string;
  
  metadata?: Record<string, unknown>;
}

/**
 * Captures reasoning steps during agent execution.
 * Used by orchestrator and individual agents to record decision-making.
 */
export class TraceCapture {
  private trace: ReasoningTrace;
  private currentStepId?: string;

  constructor(taskId: string, agentRole?: string) {
    this.trace = {
      id: nanoid(),
      taskId,
      agentRole,
      steps: [],
      startedAt: new Date(),
      totalSteps: 0,
      success: false,
    };
  }

  /**
   * Add a thought step - internal reasoning.
   */
  thought(
    content: string, 
    options?: { confidence?: number; alternatives?: string[]; metadata?: Record<string, unknown> }
  ): string {
    return this.addStep("thought", content, options);
  }

  /**
   * Add an action step - concrete action taken.
   */
  action(
    content: string,
    options?: { confidence?: number; alternatives?: string[]; metadata?: Record<string, unknown> }
  ): string {
    return this.addStep("action", content, options);
  }

  /**
   * Add an observation step - result of an action.
   */
  observation(
    content: string,
    options?: { metadata?: Record<string, unknown> }
  ): string {
    return this.addStep("observation", content, options);
  }

  /**
   * Add a reflection step - analysis of outcomes.
   */
  reflection(
    content: string,
    options?: { confidence?: number; metadata?: Record<string, unknown> }
  ): string {
    return this.addStep("reflection", content, options);
  }

  /**
   * Internal method to add any step type.
   */
  private addStep(
    type: ReasoningStepType,
    content: string,
    options?: {
      confidence?: number;
      alternatives?: string[];
      metadata?: Record<string, unknown>;
      parentStepId?: string;
    }
  ): string {
    const step: ReasoningStep = {
      id: nanoid(),
      type,
      timestamp: new Date(),
      content,
      confidence: options?.confidence,
      alternatives: options?.alternatives,
      metadata: options?.metadata,
      parentStepId: options?.parentStepId || this.currentStepId,
    };

    this.trace.steps.push(step);
    this.trace.totalSteps++;
    this.currentStepId = step.id;

    return step.id;
  }

  /**
   * Mark the trace as complete with a final decision.
   */
  complete(success: boolean, finalDecision?: string): void {
    this.trace.completedAt = new Date();
    this.trace.success = success;
    this.trace.finalDecision = finalDecision;
  }

  /**
   * Get the current trace.
   */
  getTrace(): ReasoningTrace {
    return { ...this.trace };
  }

  /**
   * Add metadata to the trace.
   */
  setMetadata(key: string, value: unknown): void {
    if (!this.trace.metadata) {
      this.trace.metadata = {};
    }
    this.trace.metadata[key] = value;
  }

  /**
   * Get a specific step by ID.
   */
  getStep(stepId: string): ReasoningStep | undefined {
    return this.trace.steps.find(s => s.id === stepId);
  }

  /**
   * Get all steps of a specific type.
   */
  getStepsByType(type: ReasoningStepType): ReasoningStep[] {
    return this.trace.steps.filter(s => s.type === type);
  }

  /**
   * Calculate average confidence across all steps that have it.
   */
  getAverageConfidence(): number | null {
    const stepsWithConfidence = this.trace.steps.filter(s => s.confidence !== undefined);
    if (stepsWithConfidence.length === 0) return null;
    
    const sum = stepsWithConfidence.reduce((acc, s) => acc + (s.confidence || 0), 0);
    return sum / stepsWithConfidence.length;
  }
}

/**
 * Format a trace for human-readable display (basic text format).
 */
export function formatTraceForDisplay(trace: ReasoningTrace): string {
  const lines: string[] = [];
  
  lines.push(`=== Reasoning Trace: ${trace.id} ===`);
  lines.push(`Task: ${trace.taskId}`);
  if (trace.agentRole) {
    lines.push(`Agent: ${trace.agentRole}`);
  }
  lines.push(`Started: ${trace.startedAt.toISOString()}`);
  if (trace.completedAt) {
    const duration = trace.completedAt.getTime() - trace.startedAt.getTime();
    lines.push(`Completed: ${trace.completedAt.toISOString()} (${duration}ms)`);
  }
  lines.push(`Success: ${trace.success}`);
  if (trace.finalDecision) {
    lines.push(`Final Decision: ${trace.finalDecision}`);
  }
  lines.push(`Total Steps: ${trace.totalSteps}`);
  lines.push("");

  for (const step of trace.steps) {
    const emoji = getStepEmoji(step.type);
    const timestamp = step.timestamp.toISOString().split("T")[1].slice(0, 12);
    
    lines.push(`[${timestamp}] ${emoji} ${step.type.toUpperCase()}`);
    lines.push(`  ${step.content}`);
    
    if (step.confidence !== undefined) {
      const confidencePercent = (step.confidence * 100).toFixed(0);
      lines.push(`  Confidence: ${confidencePercent}%`);
    }
    
    if (step.alternatives && step.alternatives.length > 0) {
      lines.push(`  Alternatives considered:`);
      for (const alt of step.alternatives) {
        lines.push(`    - ${alt}`);
      }
    }
    
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Export trace to structured JSON format.
 */
export function exportTraceToJSON(trace: ReasoningTrace): string {
  return JSON.stringify(trace, null, 2);
}

/**
 * Get emoji for step type.
 */
function getStepEmoji(type: ReasoningStepType): string {
  switch (type) {
    case "thought": return "💭";
    case "action": return "⚡";
    case "observation": return "👁️";
    case "reflection": return "🔄";
    default: return "•";
  }
}

/**
 * Merge multiple traces (e.g., from parallel subtasks) into a timeline.
 */
export function mergeTraces(traces: ReasoningTrace[]): ReasoningTrace {
  if (traces.length === 0) {
    throw new Error("Cannot merge empty traces array");
  }

  const allSteps = traces.flatMap(t => t.steps);
  allSteps.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const earliest = traces.reduce((min, t) => 
    t.startedAt < min ? t.startedAt : min, traces[0].startedAt);
  
  const latest = traces.reduce((max, t) => {
    const completed = t.completedAt || t.startedAt;
    return completed > max ? completed : max;
  }, traces[0].completedAt || traces[0].startedAt);

  const allSuccess = traces.every(t => t.success);

  return {
    id: nanoid(),
    taskId: traces[0].taskId,
    agentRole: "merged",
    steps: allSteps,
    startedAt: earliest,
    completedAt: latest,
    totalSteps: allSteps.length,
    success: allSuccess,
    metadata: {
      sourceTraces: traces.map(t => t.id),
      tracesCount: traces.length,
    },
  };
}
