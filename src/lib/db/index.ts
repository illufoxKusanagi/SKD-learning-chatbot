import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

type SqlClient = ReturnType<typeof postgres>;
type DbInstance = PostgresJsDatabase<typeof schema>;

interface DbEntry {
  sql: SqlClient;
  db: DbInstance;
}

const requestDbCache = new WeakMap<object, DbEntry>();

let nodeSqlClient: SqlClient | null = null;
let nodeDbInstance: DbInstance | null = null;

function createSqlClient(connectionString: string, isWorker: boolean): SqlClient {
  return postgres(connectionString, {
    prepare: false,
    fetch_types: false,
    max: isWorker ? 2 : 5,
    idle_timeout: isWorker ? 2 : 5,
    connect_timeout: 10,
  });
}

function resolveDbEntry(): DbEntry {
  try {
    const cfCtx = getCloudflareContext({ async: false });
    if (cfCtx?.ctx) {
      const cached = requestDbCache.get(cfCtx.ctx);
      if (cached) {
        return cached;
      }

      const envDbUrl = (cfCtx.env as Record<string, unknown> | undefined)
        ?.DATABASE_URL;
      const connectionString =
        typeof envDbUrl === "string" && envDbUrl.trim().length > 0
          ? envDbUrl
          : process.env.DATABASE_URL;

      if (!connectionString) {
        throw new Error(
          "DATABASE_URL is not set in Cloudflare Worker bindings or environment"
        );
      }

      const sqlClient = createSqlClient(connectionString, true);
      const dbInstance = drizzle(sqlClient, { schema });
      const entry: DbEntry = { sql: sqlClient, db: dbInstance };
      requestDbCache.set(cfCtx.ctx, entry);
      return entry;
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("DATABASE_URL is not set")
    ) {
      throw error;
    }
  }

  if (!nodeSqlClient || !nodeDbInstance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set in environment variables");
    }
    nodeSqlClient = createSqlClient(connectionString, false);
    nodeDbInstance = drizzle(nodeSqlClient, { schema });
  }

  return { sql: nodeSqlClient, db: nodeDbInstance };
}

export const db: DbInstance = new Proxy({} as DbInstance, {
  get(_target, prop) {
    const instance = resolveDbEntry().db;
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export const getSqlClient = (): SqlClient => resolveDbEntry().sql;

export const closeConnection = async (): Promise<void> => {
  if (nodeSqlClient) {
    await nodeSqlClient.end();
    nodeSqlClient = null;
    nodeDbInstance = null;
  }
};

export * from "./schema";
