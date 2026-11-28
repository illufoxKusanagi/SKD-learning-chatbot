import {
  quizQuestions,
  ragData,
  studyMaterials,
  type QuizOptions,
  type QuizScoringRubric,
} from '@/lib/db/schema';
import { sql, desc, eq, and, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/index';
import { generateEmbedding } from './embeddings.service';
import {
  SKD_KNOWLEDGE_BASE,
  SkdKnowledgeEntry,
} from '@/lib/datas/skd-knowledge';
import {
  detectSkdCategoryAndIntent,
  type QuizCategoryCounts,
  type SkdSubtestCategory,
} from './quiz-intent';
import {
  pickAndRecordByCategories,
  pickAndRecordFromPool,
} from '@/lib/services/question-access.service';

export { detectSkdCategoryAndIntent } from './quiz-intent';

export interface SkdQuizMetadata {
  questionId?: string | null;
  ragSourceId?: string;
  category: 'TWK' | 'TIU' | 'TKP';
  subtopic: string;
  questionStem: string;
  imageUrl?: string | null;
  options: { A: string; B: string; C: string; D: string; E: string };
  correctOption: 'A' | 'B' | 'C' | 'D' | 'E';
  scoringRubric: { A: number; B: number; C: number; D: number; E: number };
  rubricRationale: string;
}

export interface RagChunk {
  id: string;
  title: string;
  content: string;
  category: 'TWK' | 'TIU' | 'TKP' | 'GENERAL';
  subtopic: string;
  docType: 'kisi_kisi_rubrik' | 'rumus_trik_cepat' | 'contoh_soal_hots';
  similarity: number;
  quizPayload?: SkdQuizMetadata | null;
}

export interface SkdRetrievalResult {
  detectedCategory: 'TWK' | 'TIU' | 'TKP' | null;
  isQuizRequest: boolean;
  wantsNewVariation: boolean;
  requestedQuizCounts: QuizCategoryCounts | null;
  rawTotalQuizRequested: number;
  totalQuizRequested: number;
  wasQuizCapped: boolean;
  isBlockedInjection: boolean;
  unattemptedBenchmark: SkdQuizMetadata | null;
  unattemptedBenchmarks: SkdQuizMetadata[];
  contextChunks: RagChunk[];
  formattedContext: string;
}

function scoreInMemoryEntry(
  entry: SkdKnowledgeEntry,
  effectiveQuery: string,
  detectedCategory: 'TWK' | 'TIU' | 'TKP' | null
): number {
  let score = 0;
  if (detectedCategory && entry.category === detectedCategory) {
    score += 0.5;
  }

  const queryWords = effectiveQuery
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  if (queryWords.length > 0) {
    const titleSub = `${entry.title} ${entry.subtopic}`.toLowerCase();
    const titleMatches = queryWords.filter((w) => titleSub.includes(w)).length;
    score += Math.min(0.3, (titleMatches / queryWords.length) * 0.3);

    const contentLower = entry.content.toLowerCase();
    const contentMatches = queryWords.filter((w) =>
      contentLower.includes(w)
    ).length;
    score += Math.min(0.2, (contentMatches / queryWords.length) * 0.2);
  }

  return score;
}

interface QuizQuestionCandidateRow {
  id: string;
  slug: string;
  category: string;
  subtopic: string;
  reasoningChain: string;
  stem: string;
  imageUrl: string | null;
  options: QuizOptions;
  correctOption: string | null;
  scoringRubric: QuizScoringRubric | null;
  optionRationales: QuizOptions;
}

export interface RagDataPayload {
  category?: 'TWK' | 'TIU' | 'TKP' | 'GENERAL';
  subtopic?: string;
  docType?: 'kisi_kisi_rubrik' | 'rumus_trik_cepat' | 'contoh_soal_hots';
  quizPayload?: SkdQuizMetadata | null;
}

function isSkdQuizMetadata(value: unknown): value is SkdQuizMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const v = value as Record<string, unknown>;
  if (
    (v.category !== 'TWK' && v.category !== 'TIU' && v.category !== 'TKP') ||
    typeof v.subtopic !== 'string' ||
    typeof v.questionStem !== 'string' ||
    (v.correctOption !== 'A' &&
      v.correctOption !== 'B' &&
      v.correctOption !== 'C' &&
      v.correctOption !== 'D' &&
      v.correctOption !== 'E') ||
    typeof v.rubricRationale !== 'string'
  ) {
    return false;
  }

  if (!v.options || typeof v.options !== 'object' || Array.isArray(v.options)) {
    return false;
  }
  const opts = v.options as Record<string, unknown>;

  if (
    !v.scoringRubric ||
    typeof v.scoringRubric !== 'object' ||
    Array.isArray(v.scoringRubric)
  ) {
    return false;
  }
  const rubric = v.scoringRubric as Record<string, unknown>;

  const keys = ['A', 'B', 'C', 'D', 'E'] as const;
  return keys.every(
    (key) =>
      typeof opts[key] === 'string' &&
      typeof rubric[key] === 'number' &&
      Number.isFinite(rubric[key])
  );
}

function parseRagDataPayload(raw: unknown): RagDataPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const obj = raw as Record<string, unknown>;
  const category =
    obj.category === 'TWK' ||
    obj.category === 'TIU' ||
    obj.category === 'TKP' ||
    obj.category === 'GENERAL'
      ? obj.category
      : undefined;
  const subtopic = typeof obj.subtopic === 'string' ? obj.subtopic : undefined;
  const docType =
    obj.docType === 'kisi_kisi_rubrik' ||
    obj.docType === 'rumus_trik_cepat' ||
    obj.docType === 'contoh_soal_hots'
      ? obj.docType
      : undefined;
  const quizPayload = isSkdQuizMetadata(obj.quizPayload)
    ? obj.quizPayload
    : null;

  return { category, subtopic, docType, quizPayload };
}

function mapQuizQuestionRowToCandidate(
  qRow: QuizQuestionCandidateRow,
  detectedCategory: 'TWK' | 'TIU' | 'TKP' | null,
  queryWords: string[]
): RagChunk {
  const cat = (
    ['TWK', 'TIU', 'TKP'].includes(qRow.category) ? qRow.category : 'TWK'
  ) as 'TWK' | 'TIU' | 'TKP';
  const canonicalId = qRow.slug || qRow.id;
  const optionKeys = ['A', 'B', 'C', 'D', 'E'] as const;

  const resolvedCorrect =
    qRow.correctOption &&
    optionKeys.includes(qRow.correctOption as (typeof optionKeys)[number])
      ? (qRow.correctOption as (typeof optionKeys)[number])
      : optionKeys.find((opt) => qRow.scoringRubric?.[opt] === 5) ?? 'A';

  const resolvedRubric = qRow.scoringRubric ?? {
    A: resolvedCorrect === 'A' ? 5 : 0,
    B: resolvedCorrect === 'B' ? 5 : 0,
    C: resolvedCorrect === 'C' ? 5 : 0,
    D: resolvedCorrect === 'D' ? 5 : 0,
    E: resolvedCorrect === 'E' ? 5 : 0,
  };

  const rationalesText = optionKeys
    .map((opt) => `${opt}: ${qRow.optionRationales[opt]}`)
    .join('\n');
  const rubricRationale = qRow.reasoningChain
    ? `${qRow.reasoningChain}\n\n${rationalesText}`
    : rationalesText;

  let score = detectedCategory && cat === detectedCategory ? 0.5 : 0.2;
  const searchText = `${qRow.subtopic} ${qRow.stem}`.toLowerCase();
  if (queryWords.length > 0) {
    const matches = queryWords.filter((w) => searchText.includes(w)).length;
    score += Math.min(0.4, (matches / queryWords.length) * 0.4);
  }

  return {
    id: canonicalId,
    title: `Soal ${cat} — ${qRow.subtopic}`,
    content: qRow.stem,
    category: cat,
    subtopic: qRow.subtopic,
    docType: 'contoh_soal_hots',
    similarity: score,
    quizPayload: {
      questionId: qRow.id,
      ragSourceId: canonicalId,
      category: cat,
      subtopic: qRow.subtopic,
      questionStem: qRow.stem,
      imageUrl: qRow.imageUrl ?? null,
      options: qRow.options,
      correctOption: resolvedCorrect,
      scoringRubric: resolvedRubric,
      rubricRationale,
    },
  };
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function orderBySubtopicDiversity(chunks: RagChunk[]): RagChunk[] {
  const bySubtopic = new Map<string, RagChunk[]>();
  for (const chunk of shuffleArray(chunks)) {
    const key = chunk.subtopic || 'Umum';
    const group = bySubtopic.get(key);
    if (group) {
      group.push(chunk);
    } else {
      bySubtopic.set(key, [chunk]);
    }
  }

  const queues = shuffleArray(Array.from(bySubtopic.values()));
  const result: RagChunk[] = [];
  let hasMore = true;

  while (hasMore) {
    hasMore = false;
    for (const queue of queues) {
      const next = queue.shift();
      if (next) {
        result.push(next);
        hasMore = true;
      }
    }
  }

  return result;
}

function pickFromCategoryPool(
  pool: RagChunk[],
  needed: number,
  attemptedIds: Set<string>,
  usedSourceIds: Set<string>
): SkdQuizMetadata[] {
  if (needed <= 0 || pool.length === 0) {
    return [];
  }

  const unattempted: RagChunk[] = [];
  const attemptedBackfill: RagChunk[] = [];

  for (const chunk of pool) {
    if (!chunk.quizPayload) continue;
    const sourceId = chunk.quizPayload.ragSourceId || chunk.id;
    if (usedSourceIds.has(chunk.id) || usedSourceIds.has(sourceId)) continue;

    if (attemptedIds.has(chunk.id) || attemptedIds.has(sourceId)) {
      attemptedBackfill.push(chunk);
    } else {
      unattempted.push(chunk);
    }
  }

  const ordered = [
    ...orderBySubtopicDiversity(unattempted),
    ...orderBySubtopicDiversity(attemptedBackfill),
  ];

  const picked: SkdQuizMetadata[] = [];
  for (const chunk of ordered) {
    if (picked.length >= needed) break;
    if (!chunk.quizPayload) continue;

    const sourceId = chunk.quizPayload.ragSourceId || chunk.id;
    if (usedSourceIds.has(chunk.id) || usedSourceIds.has(sourceId)) continue;

    usedSourceIds.add(chunk.id);
    usedSourceIds.add(sourceId);
    picked.push({
      ...chunk.quizPayload,
      ragSourceId: sourceId,
    });
  }

  return picked;
}

function pickMultipleBenchmarksByCounts(
  candidates: RagChunk[],
  requestedQuizCounts: QuizCategoryCounts | null,
  totalQuizRequested: number,
  detectedCategory: SkdSubtestCategory | null,
  attemptedIds: Set<string>
): SkdQuizMetadata[] {
  const usedSourceIds = new Set<string>();

  if (requestedQuizCounts) {
    const categoryOrder: readonly SkdSubtestCategory[] = ['TWK', 'TIU', 'TKP'];
    const picked: SkdQuizMetadata[] = [];

    for (const cat of categoryOrder) {
      const count = requestedQuizCounts[cat];
      if (count <= 0) continue;
      const catPool = candidates.filter(
        (chunk) => chunk.category === cat && Boolean(chunk.quizPayload)
      );
      picked.push(
        ...pickFromCategoryPool(catPool, count, attemptedIds, usedSourceIds)
      );
    }

    return picked;
  }

  const filteredPool = detectedCategory
    ? candidates.filter(
        (chunk) =>
          chunk.category === detectedCategory && Boolean(chunk.quizPayload)
      )
    : candidates.filter((chunk) => Boolean(chunk.quizPayload));

  return pickFromCategoryPool(
    filteredPool,
    Math.max(1, totalQuizRequested),
    attemptedIds,
    usedSourceIds
  );
}

function pickUnattemptedBenchmarkFromCandidates(
  candidates: RagChunk[],
  detectedCategory: 'TWK' | 'TIU' | 'TKP' | null,
  attemptedIds: Set<string>
): SkdQuizMetadata | null {
  const eligible: RagChunk[] = [];
  const seenIds = new Set<string>();

  for (const chunk of candidates) {
    if (!chunk.quizPayload || seenIds.has(chunk.id)) continue;
    seenIds.add(chunk.id);

    if (detectedCategory && chunk.category !== detectedCategory) continue;

    const sourceId = chunk.quizPayload.ragSourceId || chunk.id;
    if (attemptedIds.has(chunk.id) || attemptedIds.has(sourceId)) continue;

    eligible.push(chunk);
  }

  if (eligible.length === 0) return null;
  eligible.sort((a, b) => b.similarity - a.similarity);
  const topSimilarity = eligible[0].similarity;
  const topTied = eligible.filter(
    (c) => Math.abs(c.similarity - topSimilarity) < 1e-6
  );
  const chosen = topTied[Math.floor(Math.random() * topTied.length)] ?? eligible[0];
  if (!chosen.quizPayload) return null;

  return {
    ...chosen.quizPayload,
    ragSourceId: chosen.quizPayload.ragSourceId || chosen.id,
  };
}

export async function findRelevantContents(
  userQuery: string,
  options?: {
    history?: { role: string; content: string }[];
    attemptedSourceIds?: string[];
    userId?: string | null;
    guestSessionId?: string | null;
  }
): Promise<SkdRetrievalResult> {
  const {
    detectedCategory,
    isQuizRequest,
    wantsNewVariation,
    inheritedTopic,
    isBlockedInjection,
    requestedQuizCounts,
    rawTotalQuizRequested,
    totalQuizRequested,
    wasQuizCapped,
  } = detectSkdCategoryAndIntent(userQuery, options?.history);

  if (isBlockedInjection) {
    return {
      detectedCategory: null,
      isQuizRequest: false,
      wantsNewVariation: false,
      requestedQuizCounts: null,
      rawTotalQuizRequested: 0,
      totalQuizRequested: 0,
      wasQuizCapped: false,
      isBlockedInjection: true,
      unattemptedBenchmark: null,
      unattemptedBenchmarks: [],
      contextChunks: [],
      formattedContext: '',
    };
  }

  // Build effective search query with enriched topic context for follow-ups
  const effectiveQuery =
    userQuery.trim().length < 60 && inheritedTopic
      ? `${userQuery} ${detectedCategory || ''} ${inheritedTopic}`.trim()
      : userQuery;

  const attemptedIds = new Set(options?.attemptedSourceIds || []);

  // 1. Database Hybrid Search (Zero-embedding fast path for DB quiz requests + pgvector RAG)
  const dbChunks: RagChunk[] = [];
  const validatedQuizCandidates: RagChunk[] = [];
  const queryWords = effectiveQuery
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  try {
    // Zero-Embedding Fast Path for validated DB quiz requests (Curated-Only)
    if (isQuizRequest) {
      const targetCategories: SkdSubtestCategory[] = requestedQuizCounts
        ? (['TWK', 'TIU', 'TKP'] as const).filter(
            (cat) => requestedQuizCounts[cat] > 0
          )
        : detectedCategory
          ? [detectedCategory]
          : ['TWK', 'TIU', 'TKP'];

      const questionRows = await db
        .select({
          id: quizQuestions.id,
          slug: quizQuestions.slug,
          category: quizQuestions.category,
          subtopic: quizQuestions.subtopic,
          reasoningChain: quizQuestions.reasoningChain,
          stem: quizQuestions.stem,
          imageUrl: quizQuestions.imageUrl,
          options: quizQuestions.options,
          correctOption: quizQuestions.correctOption,
          scoringRubric: quizQuestions.scoringRubric,
          optionRationales: quizQuestions.optionRationales,
        })
        .from(quizQuestions)
        .where(
          and(
            eq(quizQuestions.isValidated, true),
            inArray(quizQuestions.category, targetCategories)
          )
        )
        .limit(500);

      if (questionRows.length > 0) {
        const actor = {
          userId: options?.userId,
          guestSessionId: options?.guestSessionId,
        };
        const selectedRows = requestedQuizCounts
          ? await pickAndRecordByCategories({
              actor,
              candidates: questionRows,
              countsByCategory: requestedQuizCounts,
            })
          : await pickAndRecordFromPool({
              actor,
              candidates: questionRows,
              needed: Math.max(1, totalQuizRequested),
            });

        const pickedList = selectedRows
          .map(
            (qRow) =>
              mapQuizQuestionRowToCandidate(qRow, detectedCategory, queryWords)
                .quizPayload
          )
          .filter((payload): payload is SkdQuizMetadata => Boolean(payload));

        if (pickedList.length > 0) {
          return {
            detectedCategory,
            isQuizRequest,
            wantsNewVariation,
            requestedQuizCounts,
            rawTotalQuizRequested,
            totalQuizRequested,
            wasQuizCapped,
            isBlockedInjection: false,
            unattemptedBenchmark: pickedList[0] ?? null,
            unattemptedBenchmarks: pickedList,
            contextChunks: [],
            formattedContext: '',
          };
        }
      }
    }

    const queryEmbedding = await generateEmbedding(effectiveQuery, {
      taskType: 'RETRIEVAL_QUERY',
    });

    if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== 768) {
      throw new Error(
        `Invalid query embedding length: expected 768, got ${
          Array.isArray(queryEmbedding) ? queryEmbedding.length : typeof queryEmbedding
        }`
      );
    }

    const studySimilarity = sql<number>`1 - (${
      studyMaterials.embedding
    } <=> ${JSON.stringify(queryEmbedding)})`;
    const ragSimilarity = sql<number>`1 - (${
      ragData.embedding
    } <=> ${JSON.stringify(queryEmbedding)})`;

    const [studyRows, ragRows] = await Promise.all([
      db
        .select({
          id: studyMaterials.id,
          slug: studyMaterials.slug,
          title: studyMaterials.title,
          category: studyMaterials.category,
          subtopic: studyMaterials.subtopic,
          contentMarkdown: studyMaterials.contentMarkdown,
          similarity: studySimilarity,
        })
        .from(studyMaterials)
        .where(sql`${studyMaterials.embedding} IS NOT NULL`)
        .orderBy(desc(studySimilarity))
        .limit(8),
      db
        .select({
          id: ragData.id,
          title: ragData.title,
          content: ragData.content,
          data: ragData.data,
          externalId: ragData.external_id,
          similarity: ragSimilarity,
        })
        .from(ragData)
        .where(sql`${ragData.embedding} IS NOT NULL`)
        .orderBy(desc(ragSimilarity))
        .limit(10),
    ]);

    for (const row of studyRows) {
      const cat = (
        ['TWK', 'TIU', 'TKP', 'GENERAL'].includes(row.category)
          ? row.category
          : 'GENERAL'
      ) as 'TWK' | 'TIU' | 'TKP' | 'GENERAL';
      let score = Number(row.similarity) || 0;

      if (detectedCategory && cat === detectedCategory) {
        score += 0.18;
      }

      const titleAndSub = `${row.title} ${row.subtopic}`.toLowerCase();
      if (queryWords.some((w) => titleAndSub.includes(w))) {
        score += 0.12;
      }

      dbChunks.push({
        id: row.slug || row.id,
        title: row.title,
        content: row.contentMarkdown,
        category: cat,
        subtopic: row.subtopic,
        docType: 'kisi_kisi_rubrik',
        similarity: score,
        quizPayload: null,
      });
    }

    for (const row of ragRows) {
      const dataObj = parseRagDataPayload(row.data);
      const cat = dataObj.category ?? 'GENERAL';
      const sub = dataObj.subtopic ?? '';
      const docType = dataObj.docType ?? 'kisi_kisi_rubrik';
      let score = Number(row.similarity) || 0;

      // Category match boost
      if (detectedCategory && cat === detectedCategory) {
        score += 0.18;
      }

      // Title and subtopic keyword boost
      const titleAndSub = `${row.title || ''} ${sub}`.toLowerCase();
      if (queryWords.some((w) => titleAndSub.includes(w))) {
        score += 0.12;
      }

      const canonicalId = row.externalId || row.id;
      dbChunks.push({
        id: canonicalId,
        title: row.title || 'Materi SKD',
        content: row.content,
        category: cat,
        subtopic: sub,
        docType: docType,
        similarity: score,
        quizPayload: dataObj.quizPayload
          ? {
              ...dataObj.quizPayload,
              ragSourceId: canonicalId,
            }
          : null,
      });
    }
  } catch (dbErr) {
    console.error('[RAG_VECTOR_QUERY_ERROR] Explicit vector retrieval failure:', {
      query: effectiveQuery.slice(0, 120),
      error: dbErr instanceof Error ? dbErr.message : String(dbErr),
    });
    throw dbErr;
  }

  const rawThreshold = Number(process.env.RAG_SIMILARITY_THRESHOLD);
  const similarityThreshold =
    Number.isFinite(rawThreshold) && rawThreshold > 0 ? rawThreshold : 0.42;
  const filteredDbChunks = dbChunks.filter(
    (chunk) => chunk.similarity >= similarityThreshold
  );

  // 2. Guaranteed In-Memory Fallback & Augmentation from SKD_KNOWLEDGE_BASE (only when DB succeeds with < 2 rows)
  const inMemoryCandidates: RagChunk[] = SKD_KNOWLEDGE_BASE.map((entry) => {
    const score = scoreInMemoryEntry(entry, effectiveQuery, detectedCategory);
    return {
      id: entry.externalId,
      title: entry.title,
      content: entry.content,
      category: entry.category,
      subtopic: entry.subtopic,
      docType: entry.docType,
      similarity: score,
      quizPayload: entry.quizPayload
        ? {
            ...entry.quizPayload,
            ragSourceId: entry.externalId,
          }
        : null,
    };
  });

  inMemoryCandidates.sort((a, b) => b.similarity - a.similarity);
  const relevantInMemory = inMemoryCandidates.filter(
    (mem) => mem.similarity >= 0.25
  );

  // Merge DB and In-Memory candidates
  let contextChunks: RagChunk[] = [];
  if (filteredDbChunks.length >= 2) {
    // Sort DB chunks by hybrid boosted similarity
    filteredDbChunks.sort((a, b) => b.similarity - a.similarity);
    contextChunks = [...filteredDbChunks];

    // Supplement with high-scoring in-memory items if needed
    const existingTitles = new Set(contextChunks.map((c) => c.title));
    for (const mem of relevantInMemory) {
      if (contextChunks.length >= 6) break;
      if (!existingTitles.has(mem.title)) {
        contextChunks.push(mem);
        existingTitles.add(mem.title);
      }
    }
  } else {
    // Fallback when DB query succeeded with < 2 rows (e.g., fresh unseeded database)
    contextChunks =
      filteredDbChunks.length > 0
        ? [
            ...filteredDbChunks,
            ...relevantInMemory.filter(
              (mem) =>
                !filteredDbChunks.some((dbItem) => dbItem.title === mem.title)
            ),
          ]
        : relevantInMemory;
  }

  // 3. Dual Question Source Selection (validated quiz_questions first, then legacy rag_data / SKD_KNOWLEDGE_BASE)
  let unattemptedBenchmark: SkdQuizMetadata | null = null;
  let unattemptedBenchmarks: SkdQuizMetadata[] = [];

  if (isQuizRequest) {
    const fallbackPool = [
      ...contextChunks.filter(
        (chunk) => chunk.docType === 'contoh_soal_hots' && chunk.quizPayload
      ),
      ...inMemoryCandidates.filter(
        (mem) => mem.docType === 'contoh_soal_hots' && mem.quizPayload
      ),
    ];

    if (totalQuizRequested > 1) {
      unattemptedBenchmarks = pickMultipleBenchmarksByCounts(
        [...validatedQuizCandidates, ...fallbackPool],
        requestedQuizCounts,
        totalQuizRequested,
        detectedCategory,
        attemptedIds
      );
      unattemptedBenchmark = unattemptedBenchmarks[0] ?? null;
    } else {
      unattemptedBenchmark =
        pickUnattemptedBenchmarkFromCandidates(
          validatedQuizCandidates,
          detectedCategory,
          attemptedIds
        ) ??
        pickUnattemptedBenchmarkFromCandidates(
          fallbackPool,
          detectedCategory,
          attemptedIds
        );
      unattemptedBenchmarks = unattemptedBenchmark
        ? [unattemptedBenchmark]
        : [];
    }
  }

  // 4. Format top 3 chunks for LLM Context (<= 1,600 chars per chunk)
  const topChunks = contextChunks.slice(0, 3);
  const formattedContext = topChunks
    .map((chunk, idx) => {
      const boundedContent =
        chunk.content.length > 1600
          ? `${chunk.content.slice(0, 1597)}...`
          : chunk.content;
      return `[SUMBER ${idx + 1}: ${chunk.title} (${chunk.category} - ${
        chunk.subtopic
      } - ${chunk.docType})]\n${boundedContent}`;
    })
    .join('\n\n---\n\n');

  return {
    detectedCategory,
    isQuizRequest,
    wantsNewVariation,
    requestedQuizCounts,
    rawTotalQuizRequested,
    totalQuizRequested,
    wasQuizCapped,
    isBlockedInjection: false,
    unattemptedBenchmark,
    unattemptedBenchmarks,
    contextChunks: topChunks,
    formattedContext,
  };
}
