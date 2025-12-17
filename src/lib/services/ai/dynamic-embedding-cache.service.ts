import { ragData } from "@/lib/db/schema";
import { generateEmbedding } from "./embeddings.service";
import { ExternalAPIClient } from "../external/api-client.service";
import { sql } from "drizzle-orm";
import { eq, gt, desc, and } from "drizzle-orm";
import { getDb } from "@/lib/db";

// interface CacheEntry {
//   id: string;
//   content: string;
//   embedding: number[];
//   source: string;
//   metadata: Record<string, unknown>;
//   timestamp: Date;
// }

// interface ExternalDocument {
//   id: string;
//   content: string;
//   source: string;
//   metadata: Record<string, unknown>;
//   timestamp: Date;
//   title?: string;
// }

interface SearchOptions {
  topK?: number;
  similarityThreshold?: number;
  cacheEnabled?: boolean;
  cacheTtl?: number;
}

interface SearchResult {
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

  async search(query: string) {
    console.log(`[CACHE HELPER] Memulai pencarian untuk: "${query}"`);

    try {
      // Step 1: Search internal data
      const internalResults = await this.searchInternalData(
        query,
        Math.ceil((this.options.topK || 5) / 2)
      );
      console.log(
        `[CACHE HELPER] Menemukan ${internalResults.length} hasil internal`
      );

      // Step 2: Search external APIs
      const externalResults = await this.searchExternalData(
        query,
        this.options.topK || 5
      );
      console.log(
        `[CACHE HELPER] Menemukan ${externalResults.length} hasil eksternal`
      );

      // Step 3: Combine and rerank results
      return await this.combineAndRerankResults(
        query,
        internalResults,
        externalResults,
        this.options.topK || 5
      );
    } catch (error) {
      console.error("[CACHE HELPER] Error dalam pencarian:", error);
      // Fallback to internal search only
      return await this.searchInternalData(query, this.options.topK || 5);
    }
  }

  private async searchInternalData(
    query: string,
    limit: number
  ): Promise<SearchResult[]> {
    try {
      const embedding = await generateEmbedding(query);
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
        .where(
          and(
            gt(similarity, this.options.similarityThreshold || 0.5),
            eq(ragData.source, "internal")
          )
        )
        .orderBy(desc(similarity))
        .limit(limit);

      return results.map((r) => ({
        ...r,
        resultType: "internal",
      }));
    } catch (error) {
      console.error("[CACHE HELPER] Error in internal search:", error);
      return [];
    }
  }

  private async searchExternalData(
    query: string,
    limit: number
  ): Promise<SearchResult[]> {
    try {
      console.log("[CACHE HELPER] Fetching from external APIs...");
      const apiClient = new ExternalAPIClient();
      const candidateDocs = await apiClient.keywordSearch(query, 20);

      if (candidateDocs.length === 0) {
        console.log("[CACHE HELPER] Tidak ada kandidat eksternal ditemukan");
        return [];
      }

      return candidateDocs.slice(0, limit).map((doc) => ({
        id: doc.id,
        content: doc.content,
        data: doc.metadata,
        similarity: 0.8, // Fake similarity for external data
        source: doc.source,
        title: doc.title || "External Source",
        resultType: "external",
      }));
    } catch (error) {
      console.error("[CACHE HELPER] Error in external search:", error);
      return [];
    }
  }

  private async combineAndRerankResults(
    query: string,
    internalResults: SearchResult[],
    externalResults: SearchResult[],
    topK: number
  ) {
    try {
      const allResults = [...internalResults, ...externalResults];
      const sortedResults = allResults.sort(
        (a, b) => b.similarity - a.similarity
      );
      return this.applyDiversityFilter(sortedResults, topK);
    } catch (error) {
      console.error("[CACHE HELPER] Error in combining results:", error);
      return [...internalResults, ...externalResults].slice(0, topK);
    }
  }

  private applyDiversityFilter(results: SearchResult[], topK: number) {
    const finalResults: SearchResult[] = [];
    const usedInternal = new Set<string>();
    const usedExternal = new Set<string>();

    for (const result of results) {
      if (finalResults.length >= topK) break;

      const isInternal = result.resultType === "internal";
      const isExternal = result.resultType === "external";
      const isNotUsedInternal = !usedInternal.has(result.id);
      const isNotUsedExternal = !usedExternal.has(result.id);

      if (isInternal && isNotUsedInternal) {
        finalResults.push(result);
        usedInternal.add(result.id);
      } else if (isExternal && isNotUsedExternal) {
        finalResults.push(result);
        usedExternal.add(result.id);
      }
    }

    return finalResults;
  }
}

// Export factory for backward compatibility if needed, or just use the class
export const createDynamicEmbeddingCache = (options: SearchOptions = {}) => {
  return new DynamicEmbeddingCacheHelper(options);
};
