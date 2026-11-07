import { ragData } from "@/lib/db/schema";
import { generateEmbedding } from "./embeddings.service";
import { sql, gt, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";

export interface SearchOptions {
  topK?: number;
  similarityThreshold?: number;
  cacheEnabled?: boolean;
  cacheTtl?: number;
}

export interface SearchResult {
  id: string;
  content: string;
  data: unknown;
  similarity: number;
  source: string;
  title?: string | null;
  resultType?: "internal" | "external";
}

export class DynamicEmbeddingCacheHelper {
  private options: SearchOptions;
  private db = getDb();

  constructor(options: SearchOptions = {}) {
    this.options = {
      topK: 5,
      similarityThreshold: 0.5,
      cacheEnabled: true,
      cacheTtl: 3600,
      ...options,
    };
  }

  async search(query: string): Promise<SearchResult[]> {
    return this.searchInternalData(query, this.options.topK || 5);
  }

  async searchInternalData(
    query: string,
    limit: number
  ): Promise<SearchResult[]> {
    try {
      const embedding = await generateEmbedding(query, {
        taskType: "RETRIEVAL_QUERY",
      });
      if (!Array.isArray(embedding) || embedding.length !== 768) {
        console.error("[CACHE HELPER] Invalid query embedding dimension");
        return [];
      }

      const similarity = sql<number>`1 - (${
        ragData.embedding
      } <=> ${JSON.stringify(embedding)})`;

      const results = await this.db
        .select({
          id: ragData.id,
          content: ragData.content,
          data: ragData.data,
          similarity: similarity,
          source: sql<string>`COALESCE(${ragData.source}, 'internal')`,
          title: ragData.title,
        })
        .from(ragData)
        .where(gt(similarity, this.options.similarityThreshold || 0.5))
        .orderBy(desc(similarity))
        .limit(limit);

      return results.map((r) => ({
        ...r,
        resultType: "internal" as const,
      }));
    } catch (error) {
      console.error("[CACHE HELPER] Error in internal search:", error);
      return [];
    }
  }
}

export const createDynamicEmbeddingCache = (options: SearchOptions = {}) => {
  return new DynamicEmbeddingCacheHelper(options);
};
