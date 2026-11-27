import { eq, or, sql } from "drizzle-orm";
import { hashPassword } from "../src/lib/auth/password";
import { embedAndUpsertRagEntry, requireSeedEnv } from "./seed-utils";
import { SKD_KNOWLEDGE_BASE } from "../src/lib/datas/skd-knowledge";
import type { InsertUser } from "../src/lib/db/schema";

interface SeedUserConfig {
  username: string;
  email: string;
  role: "admin" | "user";
  avatar: string | null;
  password: string;
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,50}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildSeedUsers(): SeedUserConfig[] {
  const isProduction = process.env.NODE_ENV === "production";

  return [
    {
      username: process.env.SEED_ADMIN_USERNAME?.trim() || "admin_skd",
      email: (
        process.env.SEED_ADMIN_EMAIL?.trim() || "admin@skd-chatbot.local"
      ).toLowerCase(),
      role: "admin",
      avatar: null,
      password:
        process.env.SEED_ADMIN_PASSWORD ||
        (isProduction ? "" : "AdminSkd!2026"),
    },
    {
      username: process.env.SEED_DEMO_USERNAME?.trim() || "peserta_skd",
      email: (
        process.env.SEED_DEMO_EMAIL?.trim() || "peserta@skd-chatbot.local"
      ).toLowerCase(),
      role: "user",
      avatar: null,
      password:
        process.env.SEED_DEMO_PASSWORD ||
        (isProduction ? "" : "PesertaSkd!2026"),
    },
  ];
}

async function seedUsers(force: boolean): Promise<{
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
}> {
  const { db, users } = await import("../src/lib/db");
  const candidates = buildSeedUsers();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const email = candidate.email.trim().toLowerCase();
    const username = candidate.username.trim();

    if (!USERNAME_PATTERN.test(username)) {
      failed++;
      console.error(
        `[Seed:User] ✗ Invalid username "${username}" (must match /^[a-zA-Z0-9_]{3,50}$/).`
      );
      continue;
    }

    if (!EMAIL_PATTERN.test(email)) {
      failed++;
      console.error(`[Seed:User] ✗ Invalid email "${email}".`);
      continue;
    }

    if (!candidate.password) {
      skipped++;
      console.warn(
        `[Seed:User] - Skipped "${username}" (set SEED_ADMIN_PASSWORD / SEED_DEMO_PASSWORD in production).`
      );
      continue;
    }

    try {
      const existingRows = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
        })
        .from(users)
        .where(
          or(
            sql`lower(${users.email}) = ${email}`,
            eq(users.username, username)
          )
        )
        .limit(2);

      if (existingRows.length > 1) {
        failed++;
        console.error(
          `[Seed:User] ✗ Conflict for "${username}" <${email}>: email and username belong to different existing users.`
        );
        continue;
      }

      const now = new Date();
      if (existingRows.length === 1) {
        const existing = existingRows[0];
        const sameIdentity =
          existing.email.toLowerCase() === email &&
          existing.username === username;

        if (!sameIdentity) {
          failed++;
          console.error(
            `[Seed:User] ✗ Conflict: existing user "${existing.username}" <${existing.email}> collides with "${username}" <${email}>.`
          );
          continue;
        }

        if (!force) {
          skipped++;
          console.log(`[Seed:User] ✓ ${username} <${email}> (skipped)`);
          continue;
        }

        const hashedPassword = await hashPassword(candidate.password);
        await db
          .update(users)
          .set({
            email,
            role: candidate.role,
            avatar: candidate.avatar,
            password: hashedPassword,
            updatedAt: now,
          })
          .where(eq(users.id, existing.id));

        updated++;
        console.log(`[Seed:User] ✓ ${username} <${email}> (updated)`);
        continue;
      }

      const hashedPassword = await hashPassword(candidate.password);
      const values: InsertUser = {
        username,
        email,
        role: candidate.role,
        avatar: candidate.avatar,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(users).values(values);
      inserted++;
      console.log(
        `[Seed:User] ✓ ${username} <${email}> (inserted, role=${candidate.role})`
      );
    } catch (err) {
      failed++;
      console.error(
        `[Seed:User] ✗ ${username}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return { inserted, updated, skipped, failed };
}

async function main() {
  const force = process.argv.includes("--force");
  const usersOnly = process.argv.includes("--users-only");
  const ragOnly = process.argv.includes("--rag-only");

  if (usersOnly && ragOnly) {
    console.error("[Seed] Choose at most one of --users-only or --rag-only.");
    process.exit(1);
  }

  if (usersOnly) {
    if (!process.env.DATABASE_URL) {
      console.error(
        "Missing required DATABASE_URL in environment (.env.local / .env)."
      );
      process.exit(1);
    }
  } else {
    requireSeedEnv();
  }

  const [{ ensureDatabaseSchema }, { closeConnection }] = await Promise.all([
    import("../src/lib/db/ensure-schema"),
    import("../src/lib/db"),
  ]);

  let userStats = { inserted: 0, updated: 0, skipped: 0, failed: 0 };
  let upserted = 0;
  let skipped = 0;
  let failed = 0;

  try {
    await ensureDatabaseSchema({ throwOnError: true });

    if (!ragOnly) {
      userStats = await seedUsers(force);
      console.log(
        `[Seed:User] Summary: ${userStats.inserted} inserted, ${userStats.updated} updated, ${userStats.skipped} skipped, ${userStats.failed} failed.`
      );
    }

    if (!usersOnly) {
      for (const entry of SKD_KNOWLEDGE_BASE) {
        try {
          const result = await embedAndUpsertRagEntry(
            {
              externalId: entry.externalId,
              title: entry.title,
              subtopic: entry.subtopic,
              content: entry.content,
              data: {
                category: entry.category,
                subtopic: entry.subtopic,
                docType: entry.docType,
                scoringRule: entry.scoringRule,
                quizPayload: entry.quizPayload ?? null,
              },
            },
            force
          );
          if (result === "skipped") skipped++;
          else upserted++;
          console.log(`[Seed] ✓ ${entry.externalId} (${result})`);
        } catch (err) {
          failed++;
          console.error(
            `[Seed] ✗ ${entry.externalId}:`,
            err instanceof Error ? err.message : err
          );
        }
      }

      console.log(
        `[Seed] Done: ${upserted} upserted, ${skipped} skipped, ${failed} failed.`
      );
    }
  } finally {
    await closeConnection();
  }

  process.exit(failed > 0 || userStats.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[Seed] Fatal:", err);
  process.exit(1);
});
