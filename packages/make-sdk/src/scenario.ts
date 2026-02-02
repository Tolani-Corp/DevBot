import { MakeClient } from './client';
import { Scenario, ScenarioExecution } from './types';

/**
 * Make.com Scenario Manager
 * High-level interface for managing Make scenarios
 */
export class MakeScenario {
  constructor(private client: MakeClient) {}

  /**
   * Create a scenario from a template
   */
  async createFromTemplate(
    name: string,
    template: {
      blueprint: any;
      scheduling?: {
        type: 'interval' | 'cron';
        interval?: number;
        cron?: string;
      };
    }
  ): Promise<Scenario> {
    const scenario = await this.client.createScenario(name, template.blueprint);

    if (template.scheduling) {
      return this.client.updateScenario(scenario.id, {
        scheduling: template.scheduling,
      });
    }

    return scenario;
  }

  /**
   * Clone an existing scenario
   */
  async clone(scenarioId: string, newName: string): Promise<Scenario> {
    const original = await this.client.getScenario(scenarioId);
    return this.client.createScenario(newName, original.blueprint);
  }

  /**
   * Enable/disable a scenario with safety checks
   */
  async toggle(scenarioId: string, enabled: boolean): Promise<Scenario> {
    if (enabled) {
      return this.client.enableScenario(scenarioId);
    } else {
      return this.client.disableScenario(scenarioId);
    }
  }

  /**
   * Get scenario performance metrics
   */
  async getMetrics(scenarioId: string, days = 7): Promise<{
    totalExecutions: number;
    successRate: number;
    averageDuration: number;
    totalOperations: number;
    errorRate: number;
  }> {
    const executions = await this.client.getExecutions(scenarioId, 100);

    const totalExecutions = executions.length;
    const successful = executions.filter((e) => e.status === 'success').length;
    const totalDuration = executions
      .filter((e) => e.duration)
      .reduce((sum, e) => sum + (e.duration || 0), 0);
    const totalOperations = executions.reduce((sum, e) => sum + e.operationsUsed, 0);
    const errors = executions.filter((e) => e.status === 'error').length;

    return {
      totalExecutions,
      successRate: totalExecutions > 0 ? (successful / totalExecutions) * 100 : 0,
      averageDuration: totalExecutions > 0 ? totalDuration / totalExecutions : 0,
      totalOperations,
      errorRate: totalExecutions > 0 ? (errors / totalExecutions) * 100 : 0,
    };
  }

  /**
   * Wait for scenario execution to complete
   */
  async waitForExecution(
    executionId: string,
    options: {
      timeout?: number;
      pollInterval?: number;
    } = {}
  ): Promise<ScenarioExecution> {
    const timeout = options.timeout || 60000; // 60 seconds default
    const pollInterval = options.pollInterval || 2000; // 2 seconds default
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const execution = await this.client.getExecution(executionId);

      if (execution.status !== 'running') {
        return execution;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Execution ${executionId} timed out after ${timeout}ms`);
  }

  /**
   * Run scenario and wait for completion
   */
  async runAndWait(
    scenarioId: string,
    data?: any,
    timeout = 60000
  ): Promise<ScenarioExecution> {
    const execution = await this.client.runScenario(scenarioId, data);
    return this.waitForExecution(execution.id, { timeout });
  }

  /**
   * Get recent errors for a scenario
   */
  async getRecentErrors(scenarioId: string, limit = 10): Promise<ScenarioExecution[]> {
    const executions = await this.client.getExecutions(scenarioId, limit * 2);
    return executions
      .filter((e) => e.status === 'error')
      .slice(0, limit);
  }

  /**
   * Check if scenario is healthy
   */
  async healthCheck(scenarioId: string): Promise<{
    healthy: boolean;
    issues: string[];
    metrics: any;
  }> {
    const issues: string[] = [];
    const scenario = await this.client.getScenario(scenarioId);
    const metrics = await this.getMetrics(scenarioId);

    // Check if scenario is running
    if (!scenario.isRunning) {
      issues.push('Scenario is disabled');
    }

    // Check error rate
    if (metrics.errorRate > 10) {
      issues.push(`High error rate: ${metrics.errorRate.toFixed(1)}%`);
    }

    // Check recent executions
    if (metrics.totalExecutions === 0) {
      issues.push('No recent executions');
    }

    return {
      healthy: issues.length === 0,
      issues,
      metrics,
    };
  }
}
