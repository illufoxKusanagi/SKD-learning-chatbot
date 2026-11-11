import dotenv from "dotenv";

// Load .env.local then .env without overriding shell environment variables
dotenv.config({ path: [".env.local", ".env"] });

function requireDatabaseEnv(): void {
  if (!process.env.DATABASE_URL) {
    console.error(
      "Missing required DATABASE_URL in environment (.env.local / .env)."
    );
    process.exit(1);
  }
}

async function main() {
  requireDatabaseEnv();
  const { ensureDatabaseSchema, closeConnection } = await import("../src/lib/db");
  try {
    await ensureDatabaseSchema({ throwOnError: true });
    console.log("[ensure-schema] Database schema and extensions ensured successfully.");
    await closeConnection();
    process.exit(0);
  } catch (err) {
    console.error("[ensure-schema] Failed to ensure database schema:", err);
    try {
      await closeConnection();
    } catch {
      // ignore secondary error on connection close
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[ensure-schema] Fatal:", err);
  process.exit(1);
});
