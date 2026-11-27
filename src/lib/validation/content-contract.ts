import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

export const CANONICAL_SUBTOPICS = {
  TWK: [
    "Nasionalisme",
    "Integritas",
    "Bela Negara",
    "Pilar Negara - Pancasila",
    "Pilar Negara - UUD NRI 1945",
    "Pilar Negara - NKRI",
    "Pilar Negara - Bhinneka Tunggal Ika",
    "Bahasa Indonesia",
    "Sejarah Kebangsaan",
  ],
  TIU: [
    "Verbal - Analogi",
    "Verbal - Silogisme",
    "Verbal - Analitis",
    "Numerik - Deret",
    "Numerik - Perbandingan Kuantitatif",
    "Numerik - Aritmetika Sosial",
    "Numerik - Soal Cerita",
    "Figural - Ketidaksamaan",
    "Figural - Analogi",
    "Figural - Serial",
    "Figural - Spasial",
  ],
  TKP: [
    "Pelayanan Publik",
    "Jejaring Kerja",
    "Sosial Budaya",
    "TIK",
    "Anti-Radikalisme",
    "Profesionalisme",
  ],
} as const;

export const REQUIRED_MATERIAL_HEADINGS = [
  "## Inti Konsep",
  "## Logika Sebab-Akibat",
  "## Jembatan Soal HOTS",
  "## Jebakan Klasik",
] as const;

export const OPTION_KEYS = ["A", "B", "C", "D", "E"] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

export const SlugSchema = z
  .string()
  .trim()
  .min(4, "Slug must be at least 4 characters")
  .max(160, "Slug must be at most 160 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must be lowercase kebab-case (a-z, 0-9, single hyphens)"
  );

export const OptionKeySchema = z.enum(OPTION_KEYS);

export const OptionMapSchema = z.object({
  A: z.string().trim().min(1, "Option A cannot be empty"),
  B: z.string().trim().min(1, "Option B cannot be empty"),
  C: z.string().trim().min(1, "Option C cannot be empty"),
  D: z.string().trim().min(1, "Option D cannot be empty"),
  E: z.string().trim().min(1, "Option E cannot be empty"),
});

const PlainUrlSchema = z
  .string()
  .trim()
  .superRefine((val, ctx) => {
    if (/^\[.*\]\(.*\)$/.test(val) || val.includes("](http")) {
      ctx.addIssue({
        code: "custom",
        message: "URL must be a raw plain https:// URL, not Markdown link syntax",
      });
      return;
    }
    const parsed = z.string().url().safeParse(val);
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        message: parsed.error.issues[0]?.message ?? "Invalid URL",
      });
    }
  });

export const SourceMetaSchema = z.object({
  type: z.enum(["youtube", "tryout", "regulation", "book", "manual"]),
  title: z.string().trim().min(2, "Source title must be at least 2 characters"),
  channelName: z.string().trim().optional(),
  url: PlainUrlSchema.optional(),
  originalImageUrl: PlainUrlSchema.optional(),
  timestamp: z.string().optional(),
  timestamps: z.array(z.string()).optional(),
});

export type SourceMeta = z.infer<typeof SourceMetaSchema>;

function makeSubtopicSchema(category: "TWK" | "TIU" | "TKP") {
  const allowed: readonly string[] = CANONICAL_SUBTOPICS[category];
  return z
    .string()
    .trim()
    .min(1, "Subtopic cannot be empty")
    .superRefine((val, ctx) => {
      if (!allowed.includes(val)) {
        ctx.addIssue({
          code: "custom",
          message: `Invalid ${category} subtopic "${val}". Allowed: ${allowed.join(", ")}`,
        });
      }
    });
}

const TwkSubtopicSchema = makeSubtopicSchema("TWK");
const TiuSubtopicSchema = makeSubtopicSchema("TIU");
const TkpSubtopicSchema = makeSubtopicSchema("TKP");

export const StudyMaterialSeedSchema = z.object({
  slug: SlugSchema,
  title: z.string().trim().min(5, "Material title must be at least 5 characters"),
  category: z.literal("TWK"),
  subtopic: TwkSubtopicSchema,
  summary: z.string().trim().min(20, "Material summary must be at least 20 characters"),
  contentMarkdown: z
    .string()
    .min(120, "Material contentMarkdown must be at least 120 characters")
    .superRefine((markdown, ctx) => {
      for (const heading of REQUIRED_MATERIAL_HEADINGS) {
        if (!markdown.includes(heading)) {
          ctx.addIssue({
            code: "custom",
            message: `contentMarkdown is missing mandatory HOTS heading: "${heading}"`,
          });
        }
      }
    }),
  source: SourceMetaSchema.optional(),
});

export type StudyMaterialSeed = z.infer<typeof StudyMaterialSeedSchema>;

export const FIGURAL_IMAGE_URL_REGEX =
  /^\/figural\/[a-z0-9-]+\.(png|jpg|jpeg|webp|svg)$/;

const sharedQuestionFields = {
  slug: SlugSchema,
  difficulty: z.enum(["medium", "hots"]).default("hots"),
  reasoningChain: z
    .string()
    .trim()
    .min(30, "reasoningChain must be at least 30 characters"),
  stem: z
    .string()
    .trim()
    .min(20, "stem must be at least 20 characters")
    .refine(
      (s) => !/^\s*[A-E][.)]\s+/m.test(s),
      "Options (A./B./...) must not leak into stem"
    ),
  imageUrl: z
    .string()
    .trim()
    .regex(
      FIGURAL_IMAGE_URL_REGEX,
      "imageUrl must be a local /figural/<slug>.(png|jpg|jpeg|webp|svg) path"
    )
    .optional(),
  options: OptionMapSchema,
  hint: z.string().trim().min(10, "hint must be at least 10 characters"),
  optionRationales: OptionMapSchema,
  source: SourceMetaSchema.optional(),
};

const TkpScoringRubricSchema = z
  .object({
    A: z.number().int().min(1).max(5),
    B: z.number().int().min(1).max(5),
    C: z.number().int().min(1).max(5),
    D: z.number().int().min(1).max(5),
    E: z.number().int().min(1).max(5),
  })
  .superRefine((rubric, ctx) => {
    const sorted = OPTION_KEYS.map((k) => rubric[k]).sort((a, b) => a - b);
    if (sorted.join(",") !== "1,2,3,4,5") {
      ctx.addIssue({
        code: "custom",
        message: `TKP scoringRubric must be an exact permutation of [1,2,3,4,5], got [${sorted.join(",")}]`,
      });
    }
  });

const TwkQuestionSchema = z.object({
  ...sharedQuestionFields,
  category: z.literal("TWK"),
  subtopic: TwkSubtopicSchema,
  materialSlugs: z
    .array(SlugSchema)
    .min(1, "TWK question must link to at least one study material"),
  correctOption: OptionKeySchema,
  scoringRubric: z.null(),
});

const TiuQuestionSchema = z
  .object({
    ...sharedQuestionFields,
    category: z.literal("TIU"),
    subtopic: TiuSubtopicSchema,
    materialSlugs: z
      .array(SlugSchema)
      .max(0, "TIU questions must have empty materialSlugs []")
      .default([]),
    correctOption: OptionKeySchema,
    scoringRubric: z.null(),
  })
  .superRefine((q, ctx) => {
    const isFigural =
      q.subtopic.startsWith("Figural - ") ||
      q.subtopic.toLowerCase().includes("figural");
    if (isFigural && !q.imageUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["imageUrl"],
        message: `TIU Figural question "${q.slug}" must include a valid local imageUrl (/figural/...); text-only Figural questions are not allowed.`,
      });
    }
  });

const TkpQuestionSchema = z.object({
  ...sharedQuestionFields,
  category: z.literal("TKP"),
  subtopic: TkpSubtopicSchema,
  materialSlugs: z
    .array(SlugSchema)
    .max(0, "TKP questions must have empty materialSlugs []")
    .default([]),
  correctOption: z.null(),
  scoringRubric: TkpScoringRubricSchema,
});

export const QuizQuestionSeedSchema = z.discriminatedUnion("category", [
  TwkQuestionSchema,
  TiuQuestionSchema,
  TkpQuestionSchema,
]);

export type QuizQuestionSeed = z.infer<typeof QuizQuestionSeedSchema>;

export function verifyReasoningBeforeOptions(
  rawQuestionObj: Record<string, unknown>
): boolean {
  const keys = Object.keys(rawQuestionObj);
  const reasoningIdx = keys.indexOf("reasoningChain");
  const optionsIdx = keys.indexOf("options");
  if (reasoningIdx === -1 || optionsIdx === -1) {
    return false;
  }
  return reasoningIdx < optionsIdx;
}

export function computeContentHash(markdown: string): string {
  return createHash("sha256").update(markdown.trim(), "utf8").digest("hex");
}

export function checkTkpOptionLengthWarning(
  question: QuizQuestionSeed
): string | null {
  if (question.category !== "TKP") {
    return null;
  }

  const bestKey = OPTION_KEYS.find((k) => question.scoringRubric[k] === 5);
  if (!bestKey) {
    return null;
  }

  const bestLength = question.options[bestKey].trim().length;
  const otherLengths = OPTION_KEYS.filter((k) => k !== bestKey)
    .map((k) => question.options[k].trim().length)
    .sort((a, b) => a - b);

  // otherLengths has 4 elements [a, b, c, d]; median = (b + c) / 2
  const median = (otherLengths[1] + otherLengths[2]) / 2;
  if (median > 0 && bestLength > median * 1.35) {
    const pctOver = Math.round(((bestLength - median) / median) * 100);
    return `TKP question "${question.slug}" option ${bestKey} (5 pts, ${bestLength} chars) exceeds median of other 4 options (${median} chars) by ${pctOver}% (>35%).`;
  }

  return null;
}

export interface ContentBundleFile<T = unknown> {
  fileName: string;
  items: T[];
}

export interface ValidateContentBundlesInput {
  materialFiles: ContentBundleFile[];
  questionFiles: ContentBundleFile[];
  existingDbMaterialSlugs?: Iterable<string>;
}

export interface ContentValidationReport {
  valid: boolean;
  materials: StudyMaterialSeed[];
  questions: QuizQuestionSeed[];
  errors: string[];
  warnings: string[];
}

function formatZodIssues(issues: z.ZodIssue[]): string {
  return issues
    .map((issue) => {
      const pathStr = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${pathStr}${issue.message}`;
    })
    .join("; ");
}

export function validateContentBundles(
  input: ValidateContentBundlesInput
): ContentValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const materials: StudyMaterialSeed[] = [];
  const questions: QuizQuestionSeed[] = [];

  const seenMaterialSlugs = new Map<string, string>();
  const seenQuestionSlugs = new Map<string, string>();

  for (const file of input.materialFiles) {
    for (let i = 0; i < file.items.length; i++) {
      const raw = file.items[i];
      const parsed = StudyMaterialSeedSchema.safeParse(raw);
      if (!parsed.success) {
        const label =
          raw && typeof raw === "object" && "slug" in raw && typeof raw.slug === "string"
            ? raw.slug
            : `#${i + 1}`;
        errors.push(
          `[material] ${file.fileName} (${label}): ${formatZodIssues(parsed.error.issues)}`
        );
        continue;
      }

      const prevFile = seenMaterialSlugs.get(parsed.data.slug);
      if (prevFile) {
        errors.push(
          `[material] Duplicate slug "${parsed.data.slug}" in ${file.fileName} (already defined in ${prevFile})`
        );
        continue;
      }

      seenMaterialSlugs.set(parsed.data.slug, file.fileName);
      materials.push(parsed.data);
    }
  }

  const validMaterialSlugs = new Set<string>([
    ...materials.map((m) => m.slug),
    ...(input.existingDbMaterialSlugs ?? []),
  ]);

  for (const file of input.questionFiles) {
    const batchValidQuestions: QuizQuestionSeed[] = [];

    for (let i = 0; i < file.items.length; i++) {
      const raw = file.items[i];
      const label =
        raw && typeof raw === "object" && "slug" in raw && typeof raw.slug === "string"
          ? raw.slug
          : `#${i + 1}`;

      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        errors.push(`[question] ${file.fileName} (${label}): Expected a JSON object`);
        continue;
      }

      const rawObj = raw as Record<string, unknown>;
      if (
        "reasoningChain" in rawObj &&
        "options" in rawObj &&
        !verifyReasoningBeforeOptions(rawObj)
      ) {
        errors.push(
          `[question] ${file.fileName} (${label}): "reasoningChain" key must appear before "options"`
        );
        continue;
      }

      const parsed = QuizQuestionSeedSchema.safeParse(rawObj);
      if (!parsed.success) {
        errors.push(
          `[question] ${file.fileName} (${label}): ${formatZodIssues(parsed.error.issues)}`
        );
        continue;
      }

      const q = parsed.data;
      const prevFile = seenQuestionSlugs.get(q.slug);
      if (prevFile) {
        errors.push(
          `[question] Duplicate slug "${q.slug}" in ${file.fileName} (already defined in ${prevFile})`
        );
        continue;
      }

      if (q.category === "TWK") {
        const missingSlugs = q.materialSlugs.filter(
          (slug) => !validMaterialSlugs.has(slug)
        );
        if (missingSlugs.length > 0) {
          errors.push(
            `[question] ${file.fileName} (${q.slug}): Unknown materialSlugs [${missingSlugs.join(", ")}]`
          );
          continue;
        }
      }

      seenQuestionSlugs.set(q.slug, file.fileName);
      questions.push(q);
      batchValidQuestions.push(q);

      const tkpWarning = checkTkpOptionLengthWarning(q);
      if (tkpWarning) {
        warnings.push(`${file.fileName}: ${tkpWarning}`);
      }
    }

    // Check answer-key skew (>30%) for batches with >=10 TWK/TIU questions
    const keyedQuestions = batchValidQuestions.filter(
      (q): q is Extract<QuizQuestionSeed, { category: "TWK" | "TIU" }> =>
        q.category === "TWK" || q.category === "TIU"
    );
    if (keyedQuestions.length >= 10) {
      const counts: Record<OptionKey, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
      for (const q of keyedQuestions) {
        counts[q.correctOption]++;
      }
      for (const key of OPTION_KEYS) {
        const ratio = counts[key] / keyedQuestions.length;
        if (ratio > 0.3) {
          warnings.push(
            `${file.fileName}: Answer-key skew — option ${key} accounts for ${counts[key]}/${keyedQuestions.length} (${Math.round(ratio * 100)}%, >30%).`
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    materials,
    questions,
    errors,
    warnings,
  };
}

export interface ValidateContentDirectoriesOptions {
  materialsDir: string;
  quizDir: string;
  publicDir?: string;
  existingDbMaterialSlugs?: Iterable<string>;
}

function readTopLevelJsonArrayFiles(
  dirPath: string,
  kindLabel: string,
  fileErrors: string[]
): ContentBundleFile[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const entries = fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .sort((a, b) => a.name.localeCompare(b.name));

  const bundles: ContentBundleFile[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    } catch (err) {
      fileErrors.push(
        `[${kindLabel}] ${entry.name}: Invalid JSON (${err instanceof Error ? err.message : String(err)})`
      );
      continue;
    }

    if (!Array.isArray(parsed)) {
      fileErrors.push(
        `[${kindLabel}] ${entry.name}: Expected a top-level JSON array`
      );
      continue;
    }

    bundles.push({
      fileName: entry.name,
      items: parsed,
    });
  }

  return bundles;
}

export function validateContentDirectories(
  options: ValidateContentDirectoriesOptions
): ContentValidationReport {
  const fileErrors: string[] = [];
  const materialFiles = readTopLevelJsonArrayFiles(
    options.materialsDir,
    "material",
    fileErrors
  );
  const questionFiles = readTopLevelJsonArrayFiles(
    options.quizDir,
    "question",
    fileErrors
  );

  const report = validateContentBundles({
    materialFiles,
    questionFiles,
    existingDbMaterialSlugs: options.existingDbMaterialSlugs,
  });

  const publicDir = options.publicDir ?? path.resolve(process.cwd(), "public");
  for (const q of report.questions) {
    if (q.imageUrl) {
      const resolvedImagePath = path.resolve(publicDir, q.imageUrl.slice(1));
      if (!fs.existsSync(resolvedImagePath)) {
        fileErrors.push(
          `[question] (${q.slug}): Referenced figural image "${q.imageUrl}" does not exist on disk at ${resolvedImagePath}`
        );
      }
    }
  }

  const allErrors = [...fileErrors, ...report.errors];
  return {
    ...report,
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}
