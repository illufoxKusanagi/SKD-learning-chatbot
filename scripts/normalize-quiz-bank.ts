import * as fs from "fs";
import * as path from "path";
import {
  LABELS,
  SUBTOPICS,
  batchSchema,
  normalizeStem,
  questionSchema,
  type QuizQuestion,
} from "./quiz-bank-schema";

function slugify(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function normSubtopic(s: string): string {
  return s.replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").trim().replace(/\s*-\s*/g, " - ").toLowerCase();
}

function normalizeString(s: string): string {
  return s
    .replace(/\r\n|\r/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/[^\S\n]+$/gm, "")
    .trim();
}

function escapeInternalQuotes(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const m = line.match(/^(\s*"[a-zA-Z0-9_]+"\s*:\s*")(.*)(",?\s*)$/);
      if (!m) return line;
      const [, prefix, middle, suffix] = m;
      const escapedMiddle = middle.replace(/(?<!\\)"/g, '\\"');
      return prefix + escapedMiddle + suffix;
    })
    .join("\n");
}

function extractTopLevelJsonValues(text: string): unknown[] {
  const results: unknown[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      if (inString) escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{" || ch === "[") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0 && start !== -1) {
        const chunk = text.slice(start, i + 1).replace(/,\s*([}\]])/g, "$1");
        results.push(JSON.parse(chunk));
        start = -1;
      }
    }
  }
  return results;
}

function parseJsonTolerant(text: string): unknown {
  let cleaned = text.trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?\s*```\s*$/i, "")
    .replace(/,\s*([}\]])/g, "$1");
  try {
    return JSON.parse(cleaned);
  } catch {
    cleaned = escapeInternalQuotes(cleaned);
    try {
      return JSON.parse(cleaned);
    } catch {
      const multi = extractTopLevelJsonValues(cleaned);
      if (multi.length === 1) return multi[0];
      if (multi.length > 1) return multi;
      throw new Error("Unable to parse JSON");
    }
  }
}

const ANSWER_KEY_RES = [
  /opsi\s+([A-E])\s+bernilai\s+5/i,
  /jawaban benar:?\s*([A-E])\b/i,
  /pilihan\s+([A-E])\s*\(skor\s*5\)/i,
];

function extractStatedAnswerKey(text: string): string | null {
  for (const re of ANSWER_KEY_RES) {
    const m = text.match(re);
    if (m?.[1]) return m[1].toUpperCase();
  }
  return null;
}

const LEAKED_STEM_RE =
  /(?:(?:\n\s*)+|^)[ \t]*A[.)][ \t]+[^\n]*(?:\n\s*)+[ \t]*B[.)][ \t]+[^\n]*(?:\n\s*)+[ \t]*C[.)][ \t]+[^\n]*(?:\n\s*)+[ \t]*D[.)][ \t]+[^\n]*(?:\n\s*)+[ \t]*E[.)][ \t]+[^\n]*\s*$/;

function processFile(file: string, outDir: string, cliBatchId: string | null, force: boolean): boolean {
  if (!fs.existsSync(file)) {
    console.error(`[Error] ${file}: file not found`);
    return false;
  }

  let text: string;
  try {
    text = fs.readFileSync(file, "utf-8");
  } catch (err) {
    console.error(`[Error] ${file}: could not read file (${err instanceof Error ? err.message : err})`);
    return false;
  }

  let rawData: unknown;
  try {
    rawData = parseJsonTolerant(text);
  } catch (err) {
    console.error(`[Error] ${file}: not valid JSON (${err instanceof Error ? err.message : err})`);
    return false;
  }

  let questions: unknown[];
  let fileBatchId: string | null = null;

  if (Array.isArray(rawData)) {
    const isBatches =
      rawData.length > 0 &&
      rawData.every(
        (item) =>
          item &&
          typeof item === "object" &&
          "questions" in item &&
          Array.isArray((item as { questions: unknown[] }).questions)
      );

    if (isBatches) {
      questions = [];
      for (const batch of rawData as Array<{ batchMetadata?: { batchId?: unknown }; questions: unknown[] }>) {
        questions.push(...batch.questions);
        if (typeof batch.batchMetadata?.batchId === "string") {
          fileBatchId = batch.batchMetadata.batchId;
        }
      }
    } else {
      questions = rawData;
      if (!cliBatchId) {
        console.error(`[Error] ${file}: bare array input requires --batch-id`);
        return false;
      }
    }
  } else if (
    rawData &&
    typeof rawData === "object" &&
    "questions" in rawData &&
    Array.isArray((rawData as { questions: unknown[] }).questions)
  ) {
    questions = (rawData as { questions: unknown[] }).questions;
    const meta = (rawData as { batchMetadata?: { batchId?: unknown } }).batchMetadata;
    if (meta && typeof meta.batchId === "string") fileBatchId = meta.batchId;
  } else {
    console.error(`[Error] ${file}: input must be { batchMetadata, questions } or a bare array of questions`);
    return false;
  }

  const batchId = cliBatchId ?? (fileBatchId ? slugify(fileBatchId) : null);
  if (!batchId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(batchId)) {
    console.error(`[Error] ${file}: invalid or missing batchId "${batchId}"`);
    return false;
  }

  const outPath = path.join(outDir, `${batchId}.json`);
  const rejectedPath = path.join(outDir, "_rejected", `${batchId}.json`);

  // Index existing question stems in outDir (excluding current outPath target)
  const existingTargetStems = new Set<string>();
  if (fs.existsSync(outDir)) {
    const targetBaseName = path.basename(outPath);
    for (const entry of fs.readdirSync(outDir)) {
      if (entry.endsWith(".json") && entry !== targetBaseName) {
        const fullPath = path.join(outDir, entry);
        try {
          if (fs.statSync(fullPath).isFile()) {
            const content = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
            if (content && typeof content === "object" && Array.isArray(content.questions)) {
              for (const q of content.questions) {
                if (q && typeof q.questionStem === "string") {
                  existingTargetStems.add(normalizeStem(q.questionStem));
                }
              }
            }
          }
        } catch {
          // ignore unreadable/non-batch files in outDir
        }
      }
    }
  }

  const fixCounts: Record<string, number> = {};
  const recordFix = (name: string) => { fixCounts[name] = (fixCounts[name] || 0) + 1; };

  const validQuestions: QuizQuestion[] = [];
  const rejected: Array<{ position: number; reasons: string[]; question: unknown }> = [];
  const warnings: Array<{ position: number; message: string }> = [];
  const seenStems = new Map<string, number>();
  let skippedDuplicates = 0;

  for (let i = 0; i < questions.length; i++) {
    const position = i + 1;
    const origQ = questions[i];
    const q = JSON.parse(JSON.stringify(origQ));

    if (!q || typeof q !== "object") {
      rejected.push({ position, reasons: ["question: expected object"], question: origQ });
      continue;
    }

    // 1. category: trim + uppercase
    if (typeof q.category === "string") {
      const trimmed = q.category.trim().toUpperCase();
      if (trimmed !== q.category) {
        q.category = trimmed;
        recordFix("category");
      }
    }

    // 2. subtopic: normalize and match canonical SUBTOPICS
    if ((q.category === "TWK" || q.category === "TIU" || q.category === "TKP") && typeof q.subtopic === "string") {
      const canonList = SUBTOPICS[q.category as keyof typeof SUBTOPICS];
      const normInput = normSubtopic(q.subtopic);
      const exact = canonList.find((c) => normSubtopic(c) === normInput);
      if (exact && q.subtopic !== exact) {
        q.subtopic = exact;
        recordFix("subtopic-alias");
      } else if (!exact) {
        const candidates = canonList.filter((c) => normSubtopic(c).includes(normInput));
        if (candidates.length === 1) {
          q.subtopic = candidates[0];
          recordFix("subtopic-alias");
        }
      }
    }

    // 3. Strings: trim, normalize newlines to \n, collapse runs of spaces/tabs
    for (const f of ["title", "questionStem", "reasoningChain", "rubricRationale"] as const) {
      if (typeof q[f] === "string" && normalizeString(q[f]) !== q[f]) {
        q[f] = normalizeString(q[f]);
        recordFix("whitespace");
      }
    }
    if (Array.isArray(q.options)) {
      for (const opt of q.options) {
        if (opt && typeof opt.text === "string" && normalizeString(opt.text) !== opt.text) {
          opt.text = normalizeString(opt.text);
          recordFix("whitespace");
        }
      }
    }

    // 4. Options: sort permutation A..E, strip prefix, coerce score
    if (Array.isArray(q.options) && q.options.length === 5) {
      const rawLabels = q.options.map((o: { label?: unknown }) =>
        typeof o?.label === "string" ? o.label.trim().toUpperCase() : ""
      );
      if (LABELS.every((l) => rawLabels.includes(l)) && new Set(rawLabels).size === 5) {
        let labelsFixed = false;
        for (let idx = 0; idx < q.options.length; idx++) {
          if (q.options[idx].label !== rawLabels[idx]) {
            q.options[idx].label = rawLabels[idx];
            labelsFixed = true;
          }
        }
        if (!q.options.every((o: { label?: unknown }, idx: number) => o.label === LABELS[idx])) {
          q.options.sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label));
          recordFix("option-order");
        } else if (labelsFixed) {
          recordFix("option-order");
        }
      }

      for (const o of q.options) {
        if (o && typeof o.label === "string" && typeof o.text === "string") {
          const lbl = o.label.trim().toUpperCase();
          if (LABELS.includes(lbl as (typeof LABELS)[number])) {
            const re = new RegExp(`^(?:${lbl}[.):]|\\(${lbl}\\))\\s+`, "i");
            if (re.test(o.text)) {
              o.text = o.text.replace(re, "").trim();
              recordFix("option-prefix");
            }
          }
        }
        if (o && typeof o.score === "string" && /^-?\d+$/.test(o.score.trim())) {
          o.score = Number(o.score.trim());
          recordFix("score-type");
        }
      }
    }

    // 5. Leaked options in stem
    if (typeof q.questionStem === "string" && LEAKED_STEM_RE.test(q.questionStem)) {
      q.questionStem = q.questionStem.replace(LEAKED_STEM_RE, "").trim();
      recordFix("leaked-stem-options");
    }

    // Validation against schema
    const parsed = questionSchema.safeParse(q);
    if (!parsed.success) {
      const reasons = parsed.error.issues.map((iss) => (iss.path.length > 0 ? `${iss.path.join(".")}: ${iss.message}` : iss.message));
      rejected.push({ position, reasons, question: origQ });
      continue;
    }

    const v = parsed.data;
    const stemNorm = normalizeStem(v.questionStem);

    // Skip duplicates (existing in target directory or earlier in same input)
    if (existingTargetStems.has(stemNorm) || seenStems.has(stemNorm)) {
      skippedDuplicates++;
      recordFix("skip-duplicate-stem");
      continue;
    }
    seenStems.set(stemNorm, position);

    validQuestions.push({
      category: v.category,
      subtopic: v.subtopic,
      title: v.title,
      questionStem: v.questionStem,
      reasoningChain: v.reasoningChain,
      options: v.options.map((o) => ({ label: o.label, text: o.text, score: o.score })),
      rubricRationale: v.rubricRationale,
    });

    // Check answer-key-mismatch
    const stated = extractStatedAnswerKey(v.reasoningChain) || extractStatedAnswerKey(v.rubricRationale);
    const opt5 = v.options.find((o) => o.score === 5);
    if (stated && opt5 && stated !== opt5.label) {
      warnings.push({ position, message: `answer-key-mismatch (text says ${stated}, score 5 is ${opt5.label})` });
    }
  }

  if (validQuestions.length === 0) {
    if (rejected.length > 0) {
      if (fs.existsSync(rejectedPath) && !force) {
        console.error(`[Error] Rejected file already exists: ${rejectedPath} (use --force to overwrite)`);
        return false;
      }
      fs.mkdirSync(path.join(outDir, "_rejected"), { recursive: true });
      fs.writeFileSync(rejectedPath, JSON.stringify({ batchId, rejected }, null, 2) + "\n", "utf-8");
      console.log(`[Reject File] ${file} -> ${rejectedPath} (0 valid, ${rejected.length} rejected)`);
      for (const r of rejected) console.log(`  rejected #${r.position}: ${r.reasons.join("; ")}`);
    }
    console.error(`[Error] ${file}: zero valid questions remain`);
    return false;
  }

  if (fs.existsSync(outPath) && !force) {
    console.error(`[Error] Output file already exists: ${outPath} (use --force to overwrite)`);
    return false;
  }

  if (rejected.length > 0 && fs.existsSync(rejectedPath) && !force) {
    console.error(`[Error] Rejected file already exists: ${rejectedPath} (use --force to overwrite)`);
    return false;
  }

  const distinctCats = new Set(validQuestions.map((q) => q.category));
  const finalBatch = {
    batchMetadata: {
      batchId,
      category: distinctCats.size === 1 ? ([...distinctCats][0] as "TWK" | "TIU" | "TKP") : ("MIXED" as const),
      totalQuestions: validQuestions.length,
      difficulty: "HOTS" as const,
    },
    questions: validQuestions,
  };

  const batchValidation = batchSchema.safeParse(finalBatch);
  if (!batchValidation.success) {
    console.error(`[Error] ${file}: final batch schema validation failed:`, batchValidation.error.issues);
    return false;
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(finalBatch, null, 2) + "\n", "utf-8");

  if (rejected.length > 0) {
    fs.mkdirSync(path.join(outDir, "_rejected"), { recursive: true });
    fs.writeFileSync(rejectedPath, JSON.stringify({ batchId, rejected }, null, 2) + "\n", "utf-8");
  }

  console.log(`[Normalize] ${file} -> ${outPath}`);
  console.log(
    `  in: ${questions.length}, valid: ${validQuestions.length}, skipped-duplicates: ${skippedDuplicates}, rejected: ${rejected.length}`
  );
  const fixEntries = Object.entries(fixCounts).filter(([, count]) => count > 0).map(([name, count]) => `${name} x${count}`);
  console.log(`  fixes: ${fixEntries.length > 0 ? fixEntries.join(", ") : "none"}`);
  for (const r of rejected) console.log(`  rejected #${r.position}: ${r.reasons.join("; ")}`);
  for (const w of warnings) console.log(`  warning #${w.position}: ${w.message}`);

  return true;
}

async function main() {
  const rawArgs = process.argv.slice(2);
  let outDir: string | null = null;
  let batchIdArg: string | null = null;
  let force = false;
  const inputFiles: string[] = [];

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === "--out") {
      outDir = rawArgs[++i] ?? "";
      if (!outDir || outDir.startsWith("--")) {
        console.error("[Error] Missing value for --out");
        process.exit(1);
      }
    } else if (arg === "--batch-id") {
      batchIdArg = rawArgs[++i] ?? "";
      if (!batchIdArg || batchIdArg.startsWith("--")) {
        console.error("[Error] Missing value for --batch-id");
        process.exit(1);
      }
    } else if (arg === "--force") {
      force = true;
    } else if (arg.startsWith("--")) {
      console.error(`[Error] Unknown option: ${arg}`);
      process.exit(1);
    } else {
      inputFiles.push(arg);
    }
  }

  if (!outDir) {
    console.error("[Error] --out <dir> is required");
    process.exit(1);
  }
  if (inputFiles.length === 0) {
    console.error("[Error] No input files specified");
    process.exit(1);
  }
  if (batchIdArg !== null) {
    if (inputFiles.length !== 1) {
      console.error("[Error] --batch-id is only valid when exactly one input is given");
      process.exit(1);
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(batchIdArg)) {
      console.error(`[Error] Invalid batch-id "${batchIdArg}". Must match /^[a-z0-9]+(?:-[a-z0-9]+)*$/`);
      process.exit(1);
    }
  }

  let anyErrors = false;
  for (const file of inputFiles) {
    if (!processFile(file, outDir, batchIdArg, force)) anyErrors = true;
  }
  process.exit(anyErrors ? 1 : 0);
}

main().catch((err) => {
  console.error("[Normalize] Fatal:", err);
  process.exit(1);
});
