import { prisma } from "@repo/db";

import { createGeminiEmbedding } from "../ai/gemini-embeddings";

export interface SearchResult {
  chunkId: string;
  articleNumber: string;
  articleTitle: string | null;
  part: string | null;
  partTitle: string | null;
  chapter: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  chunkIndex: number;
  content: string;
  similarity: number;
}

export interface SearchSimilarChunksOptions {
  limit?: number;
}

export async function searchSimilarChunks(
  query: string,
  options?: SearchSimilarChunksOptions,
) {
  const limit = options?.limit ?? 5;
  const queryEmbedding = await createGeminiEmbedding(query, {
    taskType: "RETRIEVAL_QUERY",
  });

  const queryVector = toPgVectorLiteral(queryEmbedding);

  return prisma.$queryRaw<SearchResult[]>`
    SELECT
      c."id" AS "chunkId",
      a."number" AS "articleNumber",
      a."title" AS "articleTitle",
      a."part" AS "part",
      a."partTitle" AS "partTitle",
      a."chapter" AS "chapter",
      a."pageStart" AS "pageStart",
      a."pageEnd" AS "pageEnd",
      c."chunkIndex" AS "chunkIndex",
      c."content" AS "content",
      1 - (e."vector" <=> ${queryVector}::vector) AS "similarity"
    FROM "Embedding" e
    JOIN "Chunk" c ON c."id" = e."chunkId"
    JOIN "Article" a ON a."id" = c."articleId"
    ORDER BY e."vector" <=> ${queryVector}::vector
    LIMIT ${limit}
  `;
}

function toPgVectorLiteral(vector: number[]) {
  return `[${vector.join(",")}]`;
}
