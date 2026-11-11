import * as fs from "fs";
import * as path from "path";
import { embedAndUpsertRagEntry, requireSeedEnv } from "./seed-utils";
import {
  LABELS,
  batchSchema,
  normalizeStem,
  questionSchema,
} from "./quiz-bank-schema";

function resolveJsonFiles(args: string[]): string[] {
  const targets = args.length > 0 ? args : ["data/quiz-bank"];
  const files = new Set<string>();
  for (const target of targets) {
    const abs = path.resolve(process.cwd(), target);
    if (!fs.existsSync(abs)) continue;
    if (fs.statSync(abs).isDirectory()) {
      for (const f of fs.readdirSync(abs)) {
        if (f.endsWith(".json")) files.add(path.join(abs, f));
      }
    } else if (abs.endsWith(".json")) {
      files.add(abs);
    }
  }
  return [...files].sort();
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const dryRun = rawArgs.includes("--dry-run");
  const force = rawArgs.includes("--force");
  const pathArgs = rawArgs.filter((a) => a !== "--force" && a !== "--dry-run");

  if (!dryRun) {
    requireSeedEnv();
  }

  let closeConnection: (() => Promise<void>) | null = null;
  if (!dryRun) {
    const { ensureDatabaseSchema, closeConnection: close } = await import("../src/lib/db");
    await ensureDatabaseSchema({ throwOnError: true });
    closeConnection = close;
  }

  const files = resolveJsonFiles(pathArgs);
  if (files.length === 0) {
    console.log(dryRun ? "[Dry-run] No JSON files found." : "[Import] No JSON files found.");
    if (closeConnection) {
      await closeConnection();
    }
    return;
  }

  let hasErrors = false;
  let hasDuplicates = false;
  let totalValid = 0;
  let totalRejected = 0;
  const seenExternalIds = new Map<string, string>();
  const stemMap = new Map<string, string>();

  for (const file of files) {
    const fileName = path.basename(file);
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch (err) {
      console.error(`[Reject File] ${fileName}: Invalid JSON (${err instanceof Error ? err.message : err})`);
      hasErrors = true;
      if (dryRun) {
        totalRejected += 1;
        console.log(`[Dry-run] ${fileName}: 0 valid, 1 rejected`);
      }
      continue;
    }

    const batchRes = batchSchema.safeParse(raw);
    if (!batchRes.success) {
      console.error(`[Reject File] ${fileName}:`, batchRes.error.issues);
      hasErrors = true;
      if (dryRun) {
        const rejectedCount =
          raw && typeof raw === "object" && "questions" in raw && Array.isArray((raw as { questions: unknown[] }).questions)
            ? (raw as { questions: unknown[] }).questions.length
            : 1;
        totalRejected += rejectedCount;
        console.log(`[Dry-run] ${fileName}: 0 valid, ${rejectedCount} rejected`);
      }
      continue;
    }

    const { batchMetadata, questions } = batchRes.data;
    let fileValid = 0;
    let fileRejected = 0;
    let upserted = 0;
    let skipped = 0;

    for (let i = 0; i < questions.length; i++) {
      const position = i + 1;
      const parsed = questionSchema.safeParse(questions[i]);
      if (!parsed.success) {
        console.error(`[Reject #${position}] ${fileName}:`, parsed.error.issues);
        hasErrors = true;
        fileRejected++;
        continue;
      }
      const q = parsed.data;
      if (batchMetadata.category !== "MIXED" && q.category !== batchMetadata.category) {
        console.error(`[Reject #${position}] Category ${q.category} !== ${batchMetadata.category}`);
        hasErrors = true;
        fileRejected++;
        continue;
      }

      const externalId = `skd-${q.category.toLowerCase()}-bank-${batchMetadata.batchId}-${String(position).padStart(2, "0")}`;

      const existingFile = seenExternalIds.get(externalId);
      if (existingFile) {
        console.error(`[Reject] duplicate externalId ${externalId} in ${existingFile} and ${fileName}`);
        hasErrors = true;
        fileRejected++;
        continue;
      }
      seenExternalIds.set(externalId, fileName);

      fileValid++;

      const normalizedStem = normalizeStem(q.questionStem);
      const existingStemLoc = stemMap.get(normalizedStem);
      if (existingStemLoc) {
        console.warn(`[Warn] duplicate questionStem: ${fileName}#${position} matches ${existingStemLoc}`);
        hasDuplicates = true;
      } else {
        stemMap.set(normalizedStem, `${fileName}#${position}`);
      }

      if (dryRun) {
        continue;
      }

      const content = `Soal Latihan HOTS ${q.category} - ${q.subtopic}:\n${q.questionStem}\n${q.options.map((o) => `${o.label}. ${o.text}`).join("\n")}`;
      const options = Object.fromEntries(q.options.map((o) => [o.label, o.text])) as Record<(typeof LABELS)[number], string>;
      const scoringRubric = Object.fromEntries(q.options.map((o) => [o.label, o.score])) as Record<(typeof LABELS)[number], number>;
      const correctOption = q.options.find((o) => o.score === 5)!.label;

      try {
        const result = await embedAndUpsertRagEntry(
          {
            externalId,
            title: q.title,
            subtopic: q.subtopic,
            content,
            data: {
              category: q.category,
              subtopic: q.subtopic,
              docType: "contoh_soal_hots",
              scoringRule: q.category === "TKP" ? "scale_1_to_5" : "binary_5_0",
              reasoningChain: q.reasoningChain,
              batchId: batchMetadata.batchId,
              quizPayload: {
                category: q.category,
                subtopic: q.subtopic,
                questionStem: q.questionStem,
                options,
                correctOption,
                scoringRubric,
                rubricRationale: q.rubricRationale,
              },
            },
          },
          force
        );
        if (result === "skipped") skipped++;
        else upserted++;
      } catch (err) {
        console.error(`[Error] ${externalId}:`, err instanceof Error ? err.message : err);
        hasErrors = true;
      }
    }

    if (dryRun) {
      totalValid += fileValid;
      totalRejected += fileRejected;
      console.log(`[Dry-run] ${fileName}: ${fileValid} valid, ${fileRejected} rejected`);
    } else {
      console.log(
        `[Import] ${fileName}: ${upserted} upserted, ${skipped} unchanged/skipped.`
      );
    }
  }

  if (dryRun) {
    console.log(
      `[Dry-run] Total: ${totalValid} valid, ${totalRejected} rejected across ${files.length} file(s).`
    );
    process.exit(hasErrors || hasDuplicates ? 1 : 0);
  }

  if (closeConnection) {
    await closeConnection();
  }
  process.exit(hasErrors ? 1 : 0);
}

main().catch((err) => {
  console.error("[Import] Fatal:", err);
  process.exit(1);
});
