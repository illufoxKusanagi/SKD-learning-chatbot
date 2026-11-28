import {
  quizQuestions,
  ragData,
  studyMaterials,
  type QuizOptions,
  type QuizScoringRubric,
} from '@/lib/db/schema';
import { sql, desc, eq, and, notInArray } from 'drizzle-orm';
import { db } from '@/lib/db/index';
import { generateEmbedding } from './embeddings.service';
import {
  SKD_KNOWLEDGE_BASE,
  SkdKnowledgeEntry,
} from '@/lib/datas/skd-knowledge';

export interface SkdQuizMetadata {
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
  unattemptedBenchmark: SkdQuizMetadata | null;
  contextChunks: RagChunk[];
  formattedContext: string;
}

export function detectSkdCategoryAndIntent(
  userQuery: string,
  history?: { role: string; content: string }[]
): {
  detectedCategory: 'TWK' | 'TIU' | 'TKP' | null;
  isQuizRequest: boolean;
  wantsNewVariation: boolean;
  inheritedTopic?: string;
} {
  const queryLower = userQuery.toLowerCase();

  const twkPattern =
    /\b(twk|wawasan\s+kebangsaan|pancasila|uud|pasal|bhinneka|nkri|bela\s+negara|nasionalisme|integritas|bahasa\s+indonesia|eyd|bpupki|ppki|sejarah)\b/i;
  const tiuPattern =
    /\b(tiu|inteligensia\s+umum|silogisme|analogi|deret|numerik|berhitung|pecahan|perbandingan|kecepatan|jarak|waktu|kuantitatif|analitis|figural|jaring-jaring|ketidaksamaan\s+gambar|analogi\s+gambar|matriks\s+gambar|logika|premis)\b/i;
  const tkpPattern =
    /\b(tkp|karakteristik\s+pribadi|pelayanan\s+publik|jejaring\s+kerja|sosial\s+budaya|tik|profesionalisme|anti\s+radikalisme|radikalisme|berakhlak|tempat\s+kerja|atasan|rekan\s+kerja|masyarakat)\b/i;

  let detectedCategory: 'TWK' | 'TIU' | 'TKP' | null = null;
  let inheritedTopic = '';

  // 1. Direct explicit category or keyword detection in user query
  if (/\b(twk|wawasan\s+kebangsaan)\b/i.test(queryLower)) {
    detectedCategory = 'TWK';
  } else if (/\b(tiu|inteligensia\s+umum)\b/i.test(queryLower)) {
    detectedCategory = 'TIU';
  } else if (/\b(tkp|karakteristik\s+pribadi)\b/i.test(queryLower)) {
    detectedCategory = 'TKP';
  } else if (twkPattern.test(queryLower)) {
    detectedCategory = 'TWK';
  } else if (tiuPattern.test(queryLower)) {
    detectedCategory = 'TIU';
  } else if (tkpPattern.test(queryLower)) {
    detectedCategory = 'TKP';
  }

  // 2. Short follow-up query context inheritance from recent turns
  if (
    !detectedCategory &&
    userQuery.trim().length < 60 &&
    history &&
    history.length > 0
  ) {
    const recentTurns = history.slice(-2);
    for (let i = recentTurns.length - 1; i >= 0; i--) {
      const histText = recentTurns[i].content.toLowerCase();
      if (
        /\b(twk|wawasan\s+kebangsaan)\b/i.test(histText) ||
        twkPattern.test(histText)
      ) {
        detectedCategory = 'TWK';
        inheritedTopic = recentTurns[i].content.slice(0, 80);
        break;
      }
      if (
        /\b(tiu|inteligensia\s+umum)\b/i.test(histText) ||
        tiuPattern.test(histText)
      ) {
        detectedCategory = 'TIU';
        inheritedTopic = recentTurns[i].content.slice(0, 80);
        break;
      }
      if (
        /\b(tkp|karakteristik\s+pribadi)\b/i.test(histText) ||
        tkpPattern.test(histText)
      ) {
        detectedCategory = 'TKP';
        inheritedTopic = recentTurns[i].content.slice(0, 80);
        break;
      }
    }
  }

  const isGeneralInfoOnly =
    /^(apa itu skd|apa itu cpns|pengertian skd|informasi skd|passing grade|ambang batas)\??$/i.test(
      queryLower.trim()
    );

  const quizRequestPattern =
    /\b((berikan|beri|kasih|minta|buatkan|mau|ingin|coba)\s+(\d+\s+)?(soal|latihan|kuis|quiz|simulasi)|latihan\s+soal|contoh\s+soal|soal\s+lagi|lanjut\s+soal|(kasih|tes|simulasi)\s+(twk|tiu|tkp|skd))\b/i;
  const refersToPreviousQuiz =
    /\b(soal\s+(tadi|ini|sebelumnya|itu|tersebut|barusan)|jawaban\s+(tadi|saya|benar)|kenapa|mengapa|jelaskan|pembahasan|bahas\s+soal)\b/i.test(
      queryLower
    );

  const isQuizRequest =
    !isGeneralInfoOnly &&
    !refersToPreviousQuiz &&
    quizRequestPattern.test(queryLower);

  const wantsNewVariation =
    /\b(variasi\s+baru|soal\s+baru\s+buatan\s+ai|isu\s+terkini|karang\s+soal\s+baru)\b/i.test(
      queryLower
    );

  return {
    detectedCategory,
    isQuizRequest,
    wantsNewVariation,
    inheritedTopic,
  };
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
  }
): Promise<SkdRetrievalResult> {
  const { detectedCategory, isQuizRequest, wantsNewVariation, inheritedTopic } =
    detectSkdCategoryAndIntent(userQuery, options?.history);

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
    const nonEmptyAttemptedSlugs = Array.from(attemptedIds)
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    const questionConditions = [eq(quizQuestions.isValidated, true)];
    if (detectedCategory) {
      questionConditions.push(eq(quizQuestions.category, detectedCategory));
    }
    if (nonEmptyAttemptedSlugs.length > 0) {
      questionConditions.push(
        notInArray(quizQuestions.slug, nonEmptyAttemptedSlugs)
      );
    }

    // Zero-Embedding Fast Path for validated DB quiz requests
    if (isQuizRequest && !wantsNewVariation) {
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
        .where(and(...questionConditions))
        .limit(60);

      for (const qRow of questionRows) {
        validatedQuizCandidates.push(
          mapQuizQuestionRowToCandidate(qRow, detectedCategory, queryWords)
        );
      }

      const fastPicked = pickUnattemptedBenchmarkFromCandidates(
        validatedQuizCandidates,
        detectedCategory,
        attemptedIds
      );
      if (fastPicked) {
        return {
          detectedCategory,
          isQuizRequest,
          wantsNewVariation,
          unattemptedBenchmark: fastPicked,
          contextChunks: [],
          formattedContext: '',
        };
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

  // Merge DB and In-Memory candidates
  let contextChunks: RagChunk[] = [];
  if (filteredDbChunks.length >= 2) {
    // Sort DB chunks by hybrid boosted similarity
    filteredDbChunks.sort((a, b) => b.similarity - a.similarity);
    contextChunks = [...filteredDbChunks];

    // Supplement with high-scoring in-memory items if needed
    const existingTitles = new Set(contextChunks.map((c) => c.title));
    for (const mem of inMemoryCandidates) {
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
            ...inMemoryCandidates.filter(
              (mem) =>
                !filteredDbChunks.some((dbItem) => dbItem.title === mem.title)
            ),
          ]
        : inMemoryCandidates;
  }

  // 3. Dual Question Source Selection (validated quiz_questions first, then legacy rag_data / SKD_KNOWLEDGE_BASE)
  let unattemptedBenchmark: SkdQuizMetadata | null = null;

  if (isQuizRequest && !wantsNewVariation) {
    unattemptedBenchmark =
      pickUnattemptedBenchmarkFromCandidates(
        validatedQuizCandidates,
        detectedCategory,
        attemptedIds
      ) ??
      pickUnattemptedBenchmarkFromCandidates(
        [
          ...contextChunks.filter(
            (chunk) => chunk.docType === 'contoh_soal_hots' && chunk.quizPayload
          ),
          ...inMemoryCandidates.filter(
            (mem) => mem.docType === 'contoh_soal_hots' && mem.quizPayload
          ),
        ],
        detectedCategory,
        attemptedIds
      );
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
    unattemptedBenchmark,
    contextChunks: topChunks,
    formattedContext,
  };
}
