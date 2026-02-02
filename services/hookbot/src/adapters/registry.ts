import { IAdapter } from '../types';
import { InquiryAdapter } from './inquiry';

/**
 * Adapter Registry
 * Manages all available adapters
 */
export class AdapterRegistry {
  private adapters = new Map<string, IAdapter>();

  constructor() {
    this.register(new InquiryAdapter());
  }

  /**
   * Register an adapter
   */
  register(adapter: IAdapter): void {
    this.adapters.set(adapter.service, adapter);
  }

  /**
   * Get an adapter by service name
   */
  get(service: string): IAdapter {
    const adapter = this.adapters.get(service);
    if (!adapter) {
      throw new Error(`Adapter not found for service: ${service}`);
    }
    return adapter;
  }

  /**
   * Check if adapter exists
   */
  has(service: string): boolean {
    return this.adapters.has(service);
  }

  /**
   * List all registered adapters
   */
  list(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Initialize all adapters
   */
  async initializeAll(configs: Record<string, Record<string, any>>): Promise<void> {
    for (const [service, config] of Object.entries(configs)) {
      const adapter = this.adapters.get(service);
      if (adapter) {
        await adapter.initialize(config);
      }
    }
  }
}
