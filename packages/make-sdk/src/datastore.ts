import { MakeClient } from './client';
import { DataStore, DataStoreRecord } from './types';

/**
 * Make.com Data Store Manager
 * Manages Make.com data stores for persistent state
 */
export class MakeDataStore {
  constructor(
    private client: MakeClient,
    private dataStoreId: string
  ) {}

  /**
   * Add or update a record
   */
  async set(key: string, value: any): Promise<DataStoreRecord> {
    const response = await (this.client as any).api.put(
      `/datastores/${this.dataStoreId}/data/${key}`,
      { value }
    );
    return response.data;
  }

  /**
   * Get a record by key
   */
  async get(key: string): Promise<DataStoreRecord | null> {
    try {
      const response = await (this.client as any).api.get(
        `/datastores/${this.dataStoreId}/data/${key}`
      );
      return response.data;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete a record
   */
  async delete(key: string): Promise<void> {
    await (this.client as any).api.delete(
      `/datastores/${this.dataStoreId}/data/${key}`
    );
  }

  /**
   * List all records
   */
  async list(options?: {
    limit?: number;
    offset?: number;
  }): Promise<DataStoreRecord[]> {
    const response = await (this.client as any).api.get(
      `/datastores/${this.dataStoreId}/data`,
      { params: options }
    );
    return response.data.records;
  }

  /**
   * Clear all records
   */
  async clear(): Promise<void> {
    const records = await this.list();
    await Promise.all(records.map((r) => this.delete(r.key)));
  }

  /**
   * Get data store info
   */
  async getInfo(): Promise<DataStore> {
    const response = await (this.client as any).api.get(
      `/datastores/${this.dataStoreId}`
    );
    return response.data;
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const record = await this.get(key);
    return record !== null;
  }

  /**
   * Increment a numeric value
   */
  async increment(key: string, delta = 1): Promise<number> {
    const record = await this.get(key);
    const currentValue = record?.value || 0;
    const newValue = currentValue + delta;
    await this.set(key, newValue);
    return newValue;
  }

  /**
   * Append to an array value
   */
  async append(key: string, item: any): Promise<any[]> {
    const record = await this.get(key);
    const currentArray = Array.isArray(record?.value) ? record.value : [];
    const newArray = [...currentArray, item];
    await this.set(key, newArray);
    return newArray;
  }
}
