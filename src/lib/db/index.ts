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
    max: isWorker ? 3 : 5,
    idle_timeout: isWorker ? 20 : 5,
    max_lifetime: isWorker ? 30 : 300,
    connect_timeout: 10,
  });
}

function resolveDbEntry(): DbEntry {
  const isCloudflareRuntime =
    (typeof navigator !== "undefined" &&
      navigator.userAgent === "Cloudflare-Workers") ||
    typeof (globalThis as { WebSocketPair?: unknown }).WebSocketPair !==
      "undefined";

  try {
    const cfCtx = getCloudflareContext({ async: false });
    if (cfCtx?.ctx) {
      const cached = requestDbCache.get(cfCtx.ctx);
      if (cached) {
        return cached;
      }

      const env = cfCtx.env as Record<string, unknown> | undefined;
      const hyperdrive = env?.HYPERDRIVE as
        | { connectionString?: unknown }
        | undefined;
      const hyperdriveUrl =
        typeof hyperdrive?.connectionString === "string" &&
        hyperdrive.connectionString.trim().length > 0
          ? hyperdrive.connectionString
          : undefined;
      const envDbUrl = env?.DATABASE_URL;
      const workerDbUrl =
        typeof envDbUrl === "string" && envDbUrl.trim().length > 0
          ? envDbUrl
          : undefined;
      const connectionString =
        hyperdriveUrl ?? workerDbUrl ?? process.env.DATABASE_URL;

      if (!connectionString) {
        throw new Error(
          "HYPERDRIVE or DATABASE_URL is not set in Cloudflare Worker bindings or environment"
        );
      }

      const sqlClient = createSqlClient(connectionString, true);
      const dbInstance = drizzle(sqlClient, { schema });
      const entry: DbEntry = { sql: sqlClient, db: dbInstance };
      requestDbCache.set(cfCtx.ctx, entry);
      return entry;
    }

    if (isCloudflareRuntime) {
      throw new Error(
        "Cloudflare request context is unavailable in Workers runtime"
      );
    }
  } catch (error) {
    if (
      isCloudflareRuntime ||
      (error instanceof Error &&
        (error.message.includes("DATABASE_URL is not set") ||
          error.message.includes("Cloudflare request context")))
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
