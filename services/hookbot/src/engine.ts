import { Database } from './db';
import { executions } from './db/schema';
import { ExecutionContext, Step } from './types';
import { AdapterRegistry } from './adapters/registry';
import logger from './utils/logger';
import axios from 'axios';

/**
 * Workflow Engine
 * Executes workflow steps in sequence
 */
export class WorkflowEngine {
  private adapters: AdapterRegistry;

  constructor(private db: Database) {
    this.adapters = new AdapterRegistry();
  }

  /**
   * Execute a workflow
   */
  async execute(
    workflowId: string,
    trigger: { service: string; event: string; payload: any }
  ): Promise<any> {
    logger.info(`Executing workflow: ${workflowId}`);

    // Get workflow
    const { workflows } = await import('./db/schema');
    const { eq } = await import('drizzle-orm');
    const [workflow] = await this.db.select().from(workflows).where(eq(workflows.id, workflowId));

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (!workflow.enabled) {
      throw new Error(`Workflow is disabled: ${workflowId}`);
    }

    // Create execution record
    const [execution] = await this.db
      .insert(executions)
      .values({
        workflowId: workflow.id,
        status: 'running',
        input: trigger.payload,
      })
      .returning();

    const context: ExecutionContext = {
      workflowId: workflow.id,
      executionId: execution.id,
      trigger,
      variables: {
        trigger: trigger.payload,
      },
      metadata: {
        startedAt: new Date(),
      },
    };

    try {
      // Execute steps
      for (const step of workflow.steps as Step[]) {
        context.metadata.currentStep = step.id;

        // Evaluate condition if present
        if (step.when && !this.evaluateCondition(step.when, context)) {
          logger.info(`Skipping step ${step.id} (condition not met)`);
          continue;
        }

        // Execute step
        const result = await this.executeStep(step, context);

        // Store result in variables
        if (step.output) {
          context.variables[step.output] = result;
        }
      }

      // Mark as successful
      const duration = Date.now() - context.metadata.startedAt.getTime();
      await this.db
        .update(executions)
        .set({
          status: 'success',
          output: context.variables,
          finishedAt: new Date(),
          duration,
        })
        .where(eq(executions.id, execution.id));

      logger.info(`Workflow completed: ${workflowId} (${duration}ms)`);

      return context.variables;
    } catch (error: any) {
      logger.error(`Workflow failed: ${workflowId}`, error);

      // Mark as failed
      await this.db
        .update(executions)
        .set({
          status: 'error',
          error: {
            message: error.message,
            stack: error.stack,
          },
          finishedAt: new Date(),
        })
        .where(eq(executions.id, execution.id));

      throw error;
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: Step, context: ExecutionContext): Promise<any> {
    logger.info(`Executing step: ${step.id} (${step.type})`);

    switch (step.type) {
      case 'http':
        return this.executeHttpStep(step, context);

      case 'transform':
        return this.executeTransformStep(step, context);

      case 'condition':
        return this.executeConditionStep(step, context);

      case 'adapter_action':
        return this.executeAdapterStep(step, context);

      case 'junior_action':
        return this.executeJuniorStep(step, context);

      case 'loop':
        return this.executeLoopStep(step, context);

      case 'delay':
        return this.executeDelayStep(step, context);

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  /**
   * Execute HTTP request step
   */
  private async executeHttpStep(step: Step, context: ExecutionContext): Promise<any> {
    const params = this.interpolateParams(step.params, context);

    const response = await axios({
      url: params.url,
      method: params.method,
      headers: params.headers,
      data: params.body,
      timeout: params.timeout || 30000,
    });

    return response.data;
  }

  /**
   * Execute transform step
   */
  private executeTransformStep(step: Step, context: ExecutionContext): any {
    const params = this.interpolateParams(step.params, context);
    const input = this.resolveVariable(params.input, context);

    // Simple JavaScript expression evaluation
    // In production, use a safer sandbox like vm2
    const fn = new Function('input', 'context', `return ${params.expression}`);
    return fn(input, context.variables);
  }

  /**
   * Execute condition step
   */
  private async executeConditionStep(step: Step, context: ExecutionContext): Promise<void> {
    const params = this.interpolateParams(step.params, context);
    const condition = this.evaluateCondition(params.condition, context);

    const steps = condition ? params.onTrue : params.onFalse;

    if (steps) {
      for (const subStep of steps) {
        await this.executeStep(subStep, context);
      }
    }
  }

  /**
   * Execute adapter action step
   */
  private async executeAdapterStep(step: Step, context: ExecutionContext): Promise<any> {
    const params = this.interpolateParams(step.params, context);
    const adapter = this.adapters.get(params.adapter);

    return adapter.execute(params.action, params.params, context);
  }

  /**
   * Execute Junior action step
   */
  private async executeJuniorStep(step: Step, context: ExecutionContext): Promise<any> {
    const params = this.interpolateParams(step.params, context);

    const response = await axios.post(
      process.env.JUNIOR_WEBHOOK_URL!,
      {
        action: params.action,
        taskId: params.taskId,
        ...params.data,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.JUNIOR_API_KEY}`,
        },
      }
    );

    return response.data;
  }

  /**
   * Execute loop step
   */
  private async executeLoopStep(step: Step, context: ExecutionContext): Promise<any[]> {
    const params = this.interpolateParams(step.params, context);
    const items = this.resolveVariable(params.items, context);

    if (!Array.isArray(items)) {
      throw new Error('Loop items must be an array');
    }

    const results = [];

    for (let i = 0; i < items.length; i++) {
      const loopContext = {
        ...context,
        variables: {
          ...context.variables,
          item: items[i],
          index: i,
        },
      };

      for (const subStep of params.steps) {
        const result = await this.executeStep(subStep, loopContext);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Execute delay step
   */
  private async executeDelayStep(step: Step, context: ExecutionContext): Promise<void> {
    const params = this.interpolateParams(step.params, context);
    await new Promise((resolve) => setTimeout(resolve, params.duration));
  }

  /**
   * Evaluate a boolean condition
   */
  private evaluateCondition(condition: string, context: ExecutionContext): boolean {
    // Simple expression evaluation
    // In production, use a safer sandbox
    const fn = new Function('context', `with(context) { return ${condition}; }`);
    return fn(context.variables);
  }

  /**
   * Interpolate parameters with variables
   */
  private interpolateParams(params: any, context: ExecutionContext): any {
    if (typeof params === 'string') {
      return this.interpolateString(params, context);
    }

    if (Array.isArray(params)) {
      return params.map((p) => this.interpolateParams(p, context));
    }

    if (typeof params === 'object' && params !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(params)) {
        result[key] = this.interpolateParams(value, context);
      }
      return result;
    }

    return params;
  }

  /**
   * Interpolate a string with variables
   */
  private interpolateString(str: string, context: ExecutionContext): string {
    return str.replace(/\{\{(.+?)\}\}/g, (_match: string, expression: string) => {
      const value = this.resolveVariable(expression.trim(), context);
      return String(value);
    });
  }

  /**
   * Resolve a variable reference
   */
  private resolveVariable(path: string, context: ExecutionContext): any {
    const parts = path.split('.');
    let value: any = context.variables;

    for (const part of parts) {
      value = value?.[part];
    }

    return value;
  }
}
