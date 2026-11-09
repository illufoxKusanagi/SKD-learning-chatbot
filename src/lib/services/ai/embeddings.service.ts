import { GoogleGenAI } from '@google/genai';

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

    const result = await ai.models.embedContent({
      model: getEmbeddingModel(),
      contents: cleanContent,
      config: {
        taskType: options?.taskType ?? 'RETRIEVAL_QUERY',
        ...(options?.title ? { title: options.title } : {}),
        outputDimensionality: 768,
      },
    });

    // Cast to any to handle SDK response variations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = result as any;
    let embedding: number[] | undefined;

    if (response.embeddings?.[0]?.values) {
      embedding = response.embeddings[0].values;
    } else if (response.embedding?.values) {
      embedding = response.embedding.values;
    } else if (response.embeddings?.values) {
      embedding = response.embeddings.values;
    }

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
      const num =
        typeof value === 'number' ? value : parseFloat(value as string);
      if (isNaN(num)) {
        throw new Error(`Invalid embedding value at index ${index}: ${value}`);
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
    const result = await ai.models.embedContent({
      model: getEmbeddingModel(),
      contents: cleanContents,
      config: {
        taskType: options?.taskType ?? 'RETRIEVAL_DOCUMENT',
        outputDimensionality: 768,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = result as any;
    const rawEmbeddings = response.embeddings;

    if (
      Array.isArray(rawEmbeddings) &&
      rawEmbeddings.length === cleanContents.length
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return rawEmbeddings.map((item: any, idx: number) => {
        const values = item?.values || item;
        if (!Array.isArray(values) || values.length !== 768) {
          throw new Error(
            `Batch embedding at index ${idx} has invalid dimensions: ${
              values ? values.length : 'null'
            }`
          );
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return values.map((val: any) =>
          typeof val === 'number' ? val : parseFloat(val)
        );
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
