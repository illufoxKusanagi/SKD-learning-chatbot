import { GoogleGenAI, type EmbedContentResponse } from '@google/genai';

export type EmbeddingTaskType =
  | 'RETRIEVAL_DOCUMENT'
  | 'RETRIEVAL_QUERY'
  | 'SEMANTIC_SIMILARITY';

let genAIClient: GoogleGenAI | null = null;

function getGenAIClient(): GoogleGenAI {
  if (genAIClient) return genAIClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in environment variables.');
  }
  genAIClient = new GoogleGenAI({ apiKey });
  return genAIClient;
}

const getEmbeddingModel = () =>
  process.env.EMBEDDING_MODEL ?? 'gemini-embedding-001';

function isTransientEmbeddingError(error: unknown): boolean {
  const raw =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : String(error ?? '');
  return /\b(429|503|UNAVAILABLE|RESOURCE_EXHAUSTED|ECONNRESET)\b|overloaded|high\s+demand|try\s+again\s+later|fetch\s+failed/i.test(
    raw
  );
}

export async function generateEmbedding(
  content: string,
  options?: { taskType?: EmbeddingTaskType; title?: string }
): Promise<number[]> {
  try {
    if (
      !content ||
      typeof content !== 'string' ||
      content.trim().length === 0
    ) {
      throw new Error('Content must be a non-empty string');
    }

    const ai = getGenAIClient();
    // Preserve acronym casing (TWK, TIU, TKP, UUD 1945, BerAKHLAK); normalize whitespace only
    const cleanContent = content.trim().replace(/\s+/g, ' ');

    const maxRetries = 2;
    let result: EmbedContentResponse | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        result = await ai.models.embedContent({
          model: getEmbeddingModel(),
          contents: cleanContent,
          config: {
            taskType: options?.taskType ?? 'RETRIEVAL_QUERY',
            ...(options?.title ? { title: options.title } : {}),
            outputDimensionality: 768,
          },
        });
        break;
      } catch (embedErr) {
        if (!isTransientEmbeddingError(embedErr) || attempt === maxRetries) {
          throw embedErr;
        }
        const delayMs = Math.round(900 + Math.random() * 500);
        console.warn(
          `[EmbeddingsService] Transient embedContent failure (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delayMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    const embedding = result?.embeddings?.[0]?.values;

    if (!embedding || !Array.isArray(embedding) || embedding.length !== 768) {
      throw new Error(
        `Failed to generate embedding: expected 768 dimensions, got ${
          embedding
            ? Array.isArray(embedding)
              ? embedding.length
              : typeof embedding
            : 'null'
        }`
      );
    }

    const validEmbedding = embedding.map((value, index) => {
      const num = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(num)) {
        throw new Error(`Invalid embedding value at index ${index}: ${String(value)}`);
      }
      return num;
    });

    return validEmbedding;
  } catch (error) {
    console.error('❌ Error generating embedding:', error);
    console.error('Content that failed:', content?.substring(0, 100));

    if (error instanceof Error) {
      throw new Error(`Embedding generation failed: ${error.message}`);
    } else {
      throw new Error('Embedding generation failed: Unknown error');
    }
  }
}

export async function generateBatchEmbeddings(
  contents: string[],
  options?: { taskType?: EmbeddingTaskType }
): Promise<number[][]> {
  if (!contents || contents.length === 0) {
    return [];
  }

  const cleanContents = contents.map((c) => c.trim().replace(/\s+/g, ' '));
  const ai = getGenAIClient();

  try {
    const result: EmbedContentResponse = await ai.models.embedContent({
      model: getEmbeddingModel(),
      contents: cleanContents,
      config: {
        taskType: options?.taskType ?? 'RETRIEVAL_DOCUMENT',
        outputDimensionality: 768,
      },
    });

    const rawEmbeddings = result.embeddings;

    if (
      Array.isArray(rawEmbeddings) &&
      rawEmbeddings.length === cleanContents.length
    ) {
      return rawEmbeddings.map((item, idx) => {
        const values = item?.values;
        if (!Array.isArray(values) || values.length !== 768) {
          throw new Error(
            `Batch embedding at index ${idx} has invalid dimensions: ${
              values ? values.length : 'null'
            }`
          );
        }
        return values.map((val, valIdx) => {
          const num = typeof val === 'number' ? val : Number(val);
          if (!Number.isFinite(num)) {
            throw new Error(
              `Invalid batch embedding value at index ${idx}[${valIdx}]: ${String(val)}`
            );
          }
          return num;
        });
      });
    }

    // Fallback: sequential embedding if batch response is not directly structured
    const sequentialResults: number[][] = [];
    for (const text of cleanContents) {
      const emb = await generateEmbedding(text, options);
      sequentialResults.push(emb);
    }
    return sequentialResults;
  } catch (err) {
    console.warn(
      'Batch embedding call failed, falling back to sequential generation:',
      err
    );
    const fallbackResults: number[][] = [];
    for (const text of cleanContents) {
      const emb = await generateEmbedding(text, options);
      fallbackResults.push(emb);
    }
    return fallbackResults;
  }
}
