import axios, { AxiosInstance, AxiosError } from 'axios';
import { MakeConfig, MakeError, Scenario, ScenarioExecution, DataStore } from './types';

/**
 * Make.com API Client
 * Handles authentication, API requests, and error handling
 */
export class MakeClient {
  private api: AxiosInstance;
  private config: Required<MakeConfig>;

  constructor(config: MakeConfig) {
    this.config = {
      baseUrl: 'https://www.make.com/api/v2',
      timeout: 30000,
      retry: { maxRetries: 3, retryDelay: 1000 },
      ...config,
    };

    this.api = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Token ${this.config.apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Error interceptor
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const makeError: MakeError = {
          message: error.message,
          statusCode: error.response?.status,
          code: (error.response?.data as any)?.code,
          details: error.response?.data,
        };

        // Retry logic for 5xx errors
        if (
          error.response?.status &&
          error.response.status >= 500 &&
          error.config &&
          !(error.config as any).__retryCount
        ) {
          (error.config as any).__retryCount = 0;
        }

        if (
          (error.config as any).__retryCount < this.config.retry.maxRetries &&
          error.response?.status &&
          error.response.status >= 500
        ) {
          (error.config as any).__retryCount++;
          await this.delay(this.config.retry.retryDelay);
          return this.api.request(error.config!);
        }

        throw makeError;
      }
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get all scenarios
   */
  async getScenarios(): Promise<Scenario[]> {
    const response = await this.api.get(`/scenarios`, {
      params: { teamId: this.config.teamId },
    });
    return response.data.scenarios;
  }

  /**
   * Get a specific scenario
   */
  async getScenario(scenarioId: string): Promise<Scenario> {
    const response = await this.api.get(`/scenarios/${scenarioId}`);
    return response.data;
  }

  /**
   * Create a new scenario
   */
  async createScenario(name: string, blueprint?: any): Promise<Scenario> {
    const response = await this.api.post('/scenarios', {
      teamId: this.config.teamId,
      name,
      blueprint,
    });
    return response.data;
  }

  /**
   * Update a scenario
   */
  async updateScenario(scenarioId: string, updates: Partial<Scenario>): Promise<Scenario> {
    const response = await this.api.patch(`/scenarios/${scenarioId}`, updates);
    return response.data;
  }

  /**
   * Delete a scenario
   */
  async deleteScenario(scenarioId: string): Promise<void> {
    await this.api.delete(`/scenarios/${scenarioId}`);
  }

  /**
   * Run a scenario manually
   */
  async runScenario(scenarioId: string, data?: any): Promise<ScenarioExecution> {
    const response = await this.api.post(`/scenarios/${scenarioId}/run`, data);
    return response.data;
  }

  /**
   * Get scenario execution history
   */
  async getExecutions(scenarioId: string, limit = 10): Promise<ScenarioExecution[]> {
    const response = await this.api.get(`/scenarios/${scenarioId}/executions`, {
      params: { limit },
    });
    return response.data.executions;
  }

  /**
   * Get a specific execution
   */
  async getExecution(executionId: string): Promise<ScenarioExecution> {
    const response = await this.api.get(`/executions/${executionId}`);
    return response.data;
  }

  /**
   * Enable a scenario
   */
  async enableScenario(scenarioId: string): Promise<Scenario> {
    return this.updateScenario(scenarioId, { isRunning: true });
  }

  /**
   * Disable a scenario
   */
  async disableScenario(scenarioId: string): Promise<Scenario> {
    return this.updateScenario(scenarioId, { isRunning: false });
  }

  /**
   * Get all data stores
   */
  async getDataStores(): Promise<DataStore[]> {
    const response = await this.api.get('/datastores', {
      params: { teamId: this.config.teamId },
    });
    return response.data.datastores;
  }

  /**
   * Create a data store
   */
  async createDataStore(name: string, maxSize?: number): Promise<DataStore> {
    const response = await this.api.post('/datastores', {
      teamId: this.config.teamId,
      name,
      maxSize,
    });
    return response.data;
  }

  /**
   * Get organization usage statistics
   */
  async getUsageStats(): Promise<{
    operationsUsed: number;
    operationsLimit: number;
    period: string;
  }> {
    const response = await this.api.get(`/organizations/${this.config.teamId}/usage`);
    return response.data;
  }
}
