import { ragData } from "@/lib/db/schema";
import { generateEmbedding } from "./embeddings.service";
import { ExternalAPIClient } from "../external/api-client.service";
import { sql } from "drizzle-orm";
import { eq, inArray, gt, desc, and } from "drizzle-orm";
import { getDb } from "@/lib/db";

interface CacheEntry {
  id: string;
  content: string;
  embedding: number[];
  source: string;
  metadata: any;
  timestamp: Date;
}

interface ExternalDocument {
  id: string;
  content: string;
  source: string;
  metadata: any;
  timestamp: Date;
  title?: string; // Added optional title property
}

interface SearchOptions {
  topK?: number;
  similarityThreshold?: number;
  cacheEnabled?: boolean;
  cacheTtl?: number;
}

const getConfig = () => ({
  cacheEnabled: process.env.EMBEDDING_CACHE_ENABLED === "true",
  cacheTtl: parseInt(process.env.EXTERNAL_API_CACHE_TTL || "3600"),
  similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || "0.5"),
});

const cosineDistance = (embedding1: any, embedding2: number[]) => {
  // return sql<number>`1 - (${embedding1} <=> ${JSON.stringify(embedding2)})`;
  return sql<number>`1 - (${embedding1} <=> ${embedding2})`;
};

const db = getDb();

export const searchWithDynamicCache = async (
  query: string,
  options: SearchOptions = {}
) => {
  const { topK = 5 } = options;
  console.log(`[CACHE HELPER] Memulai pencarian untuk: "${query}"`);

  try {
    // Step 1: Search internal data
    const internalResults = await searchInternalData(
      query,
      Math.ceil(topK / 2)
    );
    console.log(
      `[CACHE HELPER] Menemukan ${internalResults.length} hasil internal`
    );

    // Step 2: Search external APIs
    const externalResults = await searchExternalData(query, topK);
    console.log(
      `[CACHE HELPER] Menemukan ${externalResults.length} hasil eksternal`
    );

    // Step 3: Combine and rerank results
    const combinedResults = await combineAndRerankResults(
      query,
      internalResults,
      externalResults,
      topK
    );

    return combinedResults; // Edited here: Added missing return statement
  } catch (error) {
    console.error("[CACHE HELPER] Error dalam pencarian:", error);
    // Fallback to internal search only
    return await searchInternalData(query, topK);
  }
};

const searchInternalData = async (query: string, limit: number) => {
  try {
    const embedding = await generateEmbedding(query);
    if (!Array.isArray(embedding) || embedding.length !== 768) {
      console.error("[CACHE HELPER] Invalid query embedding dimension");
      return [];
    }

    const config = getConfig();
    const similarity = sql<number>`1 - (${
      ragData.embedding
    } <=> ${JSON.stringify(embedding)})`;

    const results = await db
      .select({
        id: ragData.id,
        content: ragData.content,
        data: ragData.data,
        similarity: similarity,
        source: sql<string>`COALESCE(${ragData.source}, 'internal')`,
        title: ragData.title, // Edited here: Added title field
      })
      .from(ragData)
      .where(
        and(
          gt(similarity, config.similarityThreshold),
          eq(ragData.source, "internal")
        )
      )
      .orderBy(desc(similarity))
      .limit(limit);
    return results;
  } catch (error) {
    console.error("[CACHE HELPER] Error in internal search:", error);
    return [];
  }
};

const searchExternalData = async (query: string, limit: number) => {
  try {
    console.log("[CACHE HELPER] Fetching from external APIs...");
    const apiClient = createExternalApiClient();
    const candidateDocs = await apiClient.keywordSearch(query, 20);
    if (candidateDocs.length === 0) {
      console.log("[CACHE HELPER] Tidak ada kandidat eksternal ditemukan");
      return [];
    }
    console.log(
      `[CACHE HELPER] Got ${candidateDocs.length} external candidates`
    );
    return candidateDocs.slice(0, limit).map((doc) => ({
      id: doc.id,
      content: doc.content,
      data: doc.metadata,
      similarity: 0.8, // Fake similarity for external data
      source: doc.source,
      title: doc.title || "External Source", // Edited here: Added title field
    }));
  } catch (error) {
    console.error("[CACHE HELPER] Error in external search:", error);
    return [];
  }
};
const combineAndRerankResults = async (
  query: string,
  internalResults: any[],
  externalResults: any[],
  topK: number
) => {
  try {
    const allResults = [
      ...internalResults.map((r) => ({ ...r, resultType: "internal" })),
      ...externalResults.map((r) => ({ ...r, resultType: "external" })),
    ];
    const sortedResults = allResults.sort(
      (a, b) => b.similarity - a.similarity
    );
    return applyDiversityFilter(sortedResults, topK);
  } catch (error) {
    console.error("[CACHE HELPER] Error in combining results:", error);
    return [...internalResults, ...externalResults].slice(0, topK);
  }
};

// Edited here: Pure function for diversity filtering
// Reason: Functional approach - separate concern, easier to test and modify
const applyDiversityFilter = (results: any[], topK: number) => {
  const finalResults: any[] = [];
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
};

// Edited here: Factory function instead of class instantiation
// Reason: Functional approach - create instances without classes
const createExternalApiClient = () => {
  // This should be refactored to functional approach too, but for now keeping it
  return new ExternalAPIClient();
};

// Edited here: Additional utility functions for cache management
// Reason: Functional approach - separate utilities that can be composed

export const validateEmbedding = (embedding: any): number[] => {
  if (!Array.isArray(embedding)) {
    throw new Error("Embedding must be an array");
  }

  if (embedding.length !== 768) {
    throw new Error(
      `Expected embedding dimension 768, got ${embedding.length}`
    );
  }

  return embedding.map((value, index) => {
    const num =
      typeof value === "number" ? value : parseFloat(value.toString());
    if (isNaN(num)) {
      throw new Error(`Invalid embedding value at index ${index}`);
    }
    return num;
  });
};

export const validateSearchQuery = (query: string): string => {
  if (typeof query !== "string" || !query.trim()) {
    throw new Error("Query must be a non-empty string");
  }
  return query.trim();
};

export const getCacheStats = async () => {
  try {
    const db = getDb(); // Edited here: Get db instance
    const [result] = await db.execute(
      sql`SELECT COUNT(*) as total FROM ${ragData}`
    );

    return {
      total: parseInt(result.total.toString()),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("❌ Error getting cache stats:", error);
    return { total: 0, timestamp: new Date().toISOString() };
  }
};

// Edited here: Main export function that replaces class usage
// Reason: Functional approach - single entry point instead of class instantiation
export const createDynamicEmbeddingCache = (options: SearchOptions = {}) => ({
  search: (query: string) => searchWithDynamicCache(query, options),
  getStats: getCacheStats,
  validateQuery: validateSearchQuery,
  validateEmbedding: validateEmbedding,
});

// Edited here: Default export for backward compatibility
// Reason: Provides easy migration from class-based approach
export default {
  search: searchWithDynamicCache,
  getStats: getCacheStats,
  validateQuery: validateSearchQuery,
  validateEmbedding: validateEmbedding,
};
