import { conversations, ragData } from "@/lib/db/schema";
import { sql, desc, eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db/index";
import { generateEmbedding } from "./embeddings.service";
import { SKD_KNOWLEDGE_BASE, SkdKnowledgeEntry } from "@/lib/datas/skd-knowledge";

export interface SkdQuizMetadata {
  ragSourceId?: string;
  category: "TWK" | "TIU" | "TKP";
  subtopic: string;
  questionStem: string;
  options: { A: string; B: string; C: string; D: string; E: string };
  correctOption: "A" | "B" | "C" | "D" | "E";
  scoringRubric: { A: number; B: number; C: number; D: number; E: number };
  rubricRationale: string;
}

export interface RagChunk {
  id: string;
  title: string;
  content: string;
  category: "TWK" | "TIU" | "TKP" | "GENERAL";
  subtopic: string;
  docType: "kisi_kisi_rubrik" | "rumus_trik_cepat" | "contoh_soal_hots";
  similarity: number;
  quizPayload?: SkdQuizMetadata | null;
}

export interface SkdRetrievalResult {
  detectedCategory: "TWK" | "TIU" | "TKP" | null;
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
  detectedCategory: "TWK" | "TIU" | "TKP" | null;
  isQuizRequest: boolean;
  wantsNewVariation: boolean;
  inheritedTopic?: string;
} {
  const queryLower = userQuery.toLowerCase();

  const twkPattern =
    /\b(twk|wawasan\s+kebangsaan|pancasila|uud|pasal|bhinneka|nkri|bela\s+negara|nasionalisme|integritas|bahasa\s+indonesia|eyd|bpupki|ppki|sejarah)\b/i;
  const tiuPattern =
    /\b(tiu|inteligensia\s+umum|silogisme|analogi|deret|numerik|berhitung|pecahan|perbandingan|kecepatan|jarak|waktu|kuantitatif|analitis|figural|logika|premis)\b/i;
  const tkpPattern =
    /\b(tkp|karakteristik\s+pribadi|pelayanan\s+publik|jejaring\s+kerja|sosial\s+budaya|tik|profesionalisme|anti\s+radikalisme|radikalisme|berakhlak|tempat\s+kerja|atasan|rekan\s+kerja|masyarakat)\b/i;

  let detectedCategory: "TWK" | "TIU" | "TKP" | null = null;
  let inheritedTopic = "";

  // 1. Direct explicit category or keyword detection in user query
  if (/\b(twk|wawasan\s+kebangsaan)\b/i.test(queryLower)) {
    detectedCategory = "TWK";
  } else if (/\b(tiu|inteligensia\s+umum)\b/i.test(queryLower)) {
    detectedCategory = "TIU";
  } else if (/\b(tkp|karakteristik\s+pribadi)\b/i.test(queryLower)) {
    detectedCategory = "TKP";
  } else if (twkPattern.test(queryLower)) {
    detectedCategory = "TWK";
  } else if (tiuPattern.test(queryLower)) {
    detectedCategory = "TIU";
  } else if (tkpPattern.test(queryLower)) {
    detectedCategory = "TKP";
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
        detectedCategory = "TWK";
        inheritedTopic = recentTurns[i].content.slice(0, 80);
        break;
      }
      if (
        /\b(tiu|inteligensia\s+umum)\b/i.test(histText) ||
        tiuPattern.test(histText)
      ) {
        detectedCategory = "TIU";
        inheritedTopic = recentTurns[i].content.slice(0, 80);
        break;
      }
      if (
        /\b(tkp|karakteristik\s+pribadi)\b/i.test(histText) ||
        tkpPattern.test(histText)
      ) {
        detectedCategory = "TKP";
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
    /\b(soal|latihan|kuis|quiz|tes|simulasi|pertanyaan|kasih\s+twk|kasih\s+tiu|kasih\s+tkp|soal\s+lagi|lanjut\s+soal)\b/i;

  const isQuizRequest =
    !isGeneralInfoOnly && quizRequestPattern.test(queryLower);

  const wantsNewVariation =
    /\b(variasi\s+baru|soal\s+baru|isu\s+terkini|ikn|terbaru|buatkan|karang)\b/i.test(
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
  detectedCategory: "TWK" | "TIU" | "TKP" | null
): number {
  let score = 0;
  if (detectedCategory && entry.category === detectedCategory) {
    score += 0.5;
  }

  const queryWords = effectiveQuery
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
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

export async function findRelevantContents(
  userQuery: string,
  options?: {
    history?: { role: string; content: string }[];
    attemptedSourceIds?: string[];
  }
): Promise<SkdRetrievalResult> {
  const {
    detectedCategory,
    isQuizRequest,
    wantsNewVariation,
    inheritedTopic,
  } = detectSkdCategoryAndIntent(userQuery, options?.history);

  // Build effective search query with enriched topic context for follow-ups
  const effectiveQuery =
    userQuery.trim().length < 60 && inheritedTopic
      ? `${userQuery} ${detectedCategory || ""} ${inheritedTopic}`.trim()
      : userQuery;

  const attemptedIds = new Set(options?.attemptedSourceIds || []);

  // 1. Database Hybrid Search (pgvector + Keyword & Category Boost)
  let dbChunks: RagChunk[] = [];
  try {
    const queryEmbedding = await generateEmbedding(effectiveQuery, {
      taskType: "RETRIEVAL_QUERY",
    });

    if (Array.isArray(queryEmbedding) && queryEmbedding.length === 768) {
      const db = getDb();
      const similarity = sql<number>`1 - (${
        ragData.embedding
      } <=> ${JSON.stringify(queryEmbedding)})`;

      const rows = await db
        .select({
          id: ragData.id,
          title: ragData.title,
          content: ragData.content,
          data: ragData.data,
          externalId: ragData.external_id,
          similarity: similarity,
        })
        .from(ragData)
        .where(sql`${ragData.embedding} IS NOT NULL`)
        .orderBy(desc(similarity))
        .limit(10);

      const queryWords = effectiveQuery
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3);

      for (const row of rows) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dataObj = (row.data as any) || {};
        const cat = (dataObj.category || "GENERAL") as
          | "TWK"
          | "TIU"
          | "TKP"
          | "GENERAL";
        const sub = dataObj.subtopic || "";
        const docType = (dataObj.docType || "kisi_kisi_rubrik") as
          | "kisi_kisi_rubrik"
          | "rumus_trik_cepat"
          | "contoh_soal_hots";
        let score = Number(row.similarity) || 0;

        // Category match boost
        if (detectedCategory && cat === detectedCategory) {
          score += 0.18;
        }

        // Title and subtopic keyword boost
        const titleAndSub = `${row.title || ""} ${sub}`.toLowerCase();
        if (queryWords.some((w) => titleAndSub.includes(w))) {
          score += 0.12;
        }

        const canonicalId = row.externalId || row.id;
        dbChunks.push({
          id: canonicalId,
          title: row.title || "Materi SKD",
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
    }
  } catch (dbErr) {
    console.warn(
      "[RAG SERVICE] DB vector search error (using in-memory knowledge):",
      dbErr
    );
  }

  // 2. Guaranteed In-Memory Fallback & Augmentation from SKD_KNOWLEDGE_BASE
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
  if (dbChunks.length >= 2) {
    // Sort DB chunks by hybrid boosted similarity
    dbChunks.sort((a, b) => b.similarity - a.similarity);
    contextChunks = [...dbChunks];

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
    // Guaranteed fallback when DB is empty or unseeded
    contextChunks = inMemoryCandidates;
  }

  // 3. Dual Question Source Selection (unattemptedBenchmark)
  let unattemptedBenchmark: SkdQuizMetadata | null = null;

  if (isQuizRequest && !wantsNewVariation) {
    // Collect all HOTS questions with quizPayload from both context and knowledge base
    const benchmarkCandidates: RagChunk[] = [];
    const seenIds = new Set<string>();

    const evaluateCandidate = (chunk: RagChunk) => {
      if (!chunk.quizPayload || seenIds.has(chunk.id)) return;
      seenIds.add(chunk.id);

      // Check category match if category detected
      if (detectedCategory && chunk.category !== detectedCategory) return;

      // Check not attempted
      const sourceId = chunk.quizPayload.ragSourceId || chunk.id;
      if (attemptedIds.has(chunk.id) || attemptedIds.has(sourceId)) return;

      benchmarkCandidates.push(chunk);
    };

    // First scan contextChunks
    for (const chunk of contextChunks) {
      if (chunk.docType === "contoh_soal_hots" && chunk.quizPayload) {
        evaluateCandidate(chunk);
      }
    }

    // Also scan all in-memory HOTS questions
    for (const mem of inMemoryCandidates) {
      if (mem.docType === "contoh_soal_hots" && mem.quizPayload) {
        evaluateCandidate(mem);
      }
    }

    if (benchmarkCandidates.length > 0) {
      // Pick the highest scoring unattempted question
      benchmarkCandidates.sort((a, b) => b.similarity - a.similarity);
      const chosen = benchmarkCandidates[0];
      unattemptedBenchmark = {
        ...chosen.quizPayload!,
        ragSourceId: chosen.quizPayload!.ragSourceId || chosen.id,
      };
    }
  }

  // 4. Format top 4 chunks for LLM Context
  const top4Chunks = contextChunks.slice(0, 4);
  const formattedContext = top4Chunks
    .map(
      (chunk, idx) =>
        `[SUMBER ${idx + 1}: ${chunk.title} (${chunk.category} - ${
          chunk.subtopic
        } - ${chunk.docType})]\n${chunk.content}`
    )
    .join("\n\n---\n\n");

  return {
    detectedCategory,
    isQuizRequest,
    wantsNewVariation,
    unattemptedBenchmark,
    contextChunks: top4Chunks,
    formattedContext,
  };
}

export async function getChatHistoryTitle(
  chatId: string,
  userId: string
): Promise<string> {
  try {
    const db = getDb();
    const [chat] = await db
      .select({
        title: conversations.title,
      })
      .from(conversations)
      .where(
        and(eq(conversations.id, chatId), eq(conversations.userId, userId))
      )
      .limit(1);

    if (!chat || !chat.title || chat.title.trim() === "") {
      return `Chat #${chatId}`;
    }

    return chat.title.trim();
  } catch (error) {
    console.error("Failed to get chat history title:", error);
    return `Chat #${chatId}`;
  }
}

export async function getChatHistoryTitleWithAuth(
  chatId: string,
  userId: string
): Promise<{
  title: string;
  success: boolean;
  error?: string;
}> {
  try {
    if (!chatId) {
      return {
        title: "New Chat",
        success: false,
        error: "Invalid chat ID",
      };
    }
    if (!userId) {
      return {
        title: `Chat #${chatId}`,
        success: false,
        error: "User ID is required",
      };
    }

    const db = getDb();
    const [chat] = await db
      .select({
        title: conversations.title,
      })
      .from(conversations)
      .where(
        and(eq(conversations.id, chatId), eq(conversations.userId, userId))
      )
      .limit(1);

    if (!chat) {
      return {
        title: `Chat #${chatId}`,
        success: false,
        error: "Chat not found or access denied",
      };
    }

    const title = chat.title;
    if (!title || title.trim() === "") {
      return {
        title: `Chat #${chatId}`,
        success: true,
      };
    }

    return {
      title: title.trim(),
      success: true,
    };
  } catch (error) {
    console.error("Failed to get chat history title with auth:", error);
    return {
      title: `Chat #${chatId}`,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
