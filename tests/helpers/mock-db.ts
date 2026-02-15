import { vi } from "vitest";

/**
 * Mock database factory for tests.
 * Returns a chainable mock matching Drizzle ORM's query builder pattern.
 */
export function createMockDb() {
  const chainable = () => {
    const chain: any = {};
    const methods = ["select", "from", "where", "limit", "offset", "orderBy", "insert", "values", "returning", "update", "set", "delete", "innerJoin", "leftJoin"];
    for (const method of methods) {
      chain[method] = vi.fn().mockReturnValue(chain);
    }
    // Terminal methods return promises
    chain.then = undefined; // Make it thenable
    chain.execute = vi.fn().mockResolvedValue([]);
    return chain;
  };

  const mockDb = {
    select: vi.fn().mockImplementation(() => {
      const chain = chainable();
      chain.from = vi.fn().mockReturnValue(chain);
      // Default: resolve to empty array
      (chain as any)[Symbol.toStringTag] = "Promise";
      const origWhere = chain.where;
      chain.where = vi.fn().mockImplementation(() => {
        const inner = chainable();
        inner.limit = vi.fn().mockResolvedValue([]);
        return inner;
      });
      return chain;
    }),
    insert: vi.fn().mockImplementation(() => {
      const chain = chainable();
      chain.values = vi.fn().mockResolvedValue([]);
      return chain;
    }),
    update: vi.fn().mockImplementation(() => {
      const chain = chainable();
      return chain;
    }),
    delete: vi.fn().mockImplementation(() => {
      const chain = chainable();
      return chain;
    }),
    query: {},
  };

  return mockDb;
}

/**
 * Setup vi.mock for @/db module
 */
export function mockDbModule() {
  const mockDb = createMockDb();
  vi.mock("@/db", () => ({ db: mockDb }));
  return mockDb;
}
