import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
const isTestRuntime = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

if (!connectionString && !isTestRuntime) {
  throw new Error("DATABASE_URL environment variable is required");
}

function createUnavailableDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (isTestRuntime) {
    const createQuery = (rows: unknown[] = []) => {
      const query = Promise.resolve(rows) as Promise<unknown[]> & Record<string, unknown>;
      query.from = () => query;
      query.where = () => query;
      query.limit = () => Promise.resolve(rows);
      query.set = () => query;
      query.values = () => Promise.resolve(undefined);
      query.returning = () => Promise.resolve(rows);
      query.execute = () => Promise.resolve(rows);
      return query;
    };

    return {
      select: () => createQuery([]),
      delete: () => createQuery([]),
      update: () => createQuery([]),
      insert: () => createQuery([]),
    } as unknown as ReturnType<typeof drizzle<typeof schema>>;
  }

  return new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "then") {
          return undefined;
        }

        throw new Error("DATABASE_URL environment variable is required");
      },
    },
  ) as ReturnType<typeof drizzle<typeof schema>>;
}

export const db = connectionString
  ? drizzle(postgres(connectionString), { schema })
  : createUnavailableDb();
