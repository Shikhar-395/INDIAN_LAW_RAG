import "dotenv/config";
import { randomUUID } from "node:crypto";

import { prisma } from "@repo/db";

import {
  createGeminiEmbeddings,
  getGeminiEmbeddingDimensions,
  getGeminiEmbeddingModel,
} from "../ai/gemini-embeddings";

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_BATCH_DELAY_MS = 2_000;

function readPositiveIntegerEnv(name: string, fallback: number) {
  const value = process.env[name];

  if (!value) return fallback;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function readOptionalPositiveIntegerEnv(name: string) {
  const value = process.env[name];

  if (!value) return null;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toPgVectorLiteral(vector: number[]) {
  return `[${vector.join(",")}]`;
}

async function createEmbeddingsWithRetry(texts: string[]) {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await createGeminiEmbeddings(texts, {
        taskType: "RETRIEVAL_DOCUMENT",
      });
    } catch (error) {
      if (attempt === maxAttempts) throw error;

      const waitMs = 5_000 * attempt;

      console.warn(
        `Embedding batch failed on attempt ${attempt}; retrying in ${waitMs}ms...`,
      );
      await sleep(waitMs);
    }
  }

  throw new Error("Embedding retries exhausted");
}

async function main() {
  const model = getGeminiEmbeddingModel();
  const dimensions = getGeminiEmbeddingDimensions();
  const batchSize = readPositiveIntegerEnv(
    "EMBEDDING_BATCH_SIZE",
    DEFAULT_BATCH_SIZE,
  );
  const batchDelayMs = readPositiveIntegerEnv(
    "EMBEDDING_BATCH_DELAY_MS",
    DEFAULT_BATCH_DELAY_MS,
  );
  const limit = readOptionalPositiveIntegerEnv("EMBEDDING_INGEST_LIMIT");

  const chunks = await prisma.chunk.findMany({
    where: {
      embedding: {
        is: null,
      },
    },
    select: {
      id: true,
      content: true,
      chunkIndex: true,
      article: {
        select: {
          number: true,
          title: true,
        },
      },
    },
    orderBy: [
      {
        articleId: "asc",
      },
      {
        chunkIndex: "asc",
      },
    ],
    take: limit ?? undefined,
  });

  console.log({
    model,
    dimensions,
    batchSize,
    batchDelayMs,
    chunksToEmbed: chunks.length,
  });

  let embeddedCount = 0;

  for (let start = 0; start < chunks.length; start += batchSize) {
    const batch = chunks.slice(start, start + batchSize);
    const embeddings = await createEmbeddingsWithRetry(
      batch.map((chunk) => chunk.content),
    );

    for (let i = 0; i < batch.length; i++) {
      const chunk = batch[i];
      const embedding = embeddings[i];

      if (!chunk || !embedding) continue;

      await prisma.$executeRaw`
        INSERT INTO "Embedding" ("id", "chunkId", "model", "dimensions", "vector")
        VALUES (${randomUUID()}, ${chunk.id}, ${model}, ${dimensions}, ${toPgVectorLiteral(embedding)}::vector)
        ON CONFLICT ("chunkId") DO UPDATE SET
          "model" = EXCLUDED."model",
          "dimensions" = EXCLUDED."dimensions",
          "vector" = EXCLUDED."vector"
      `;

      embeddedCount++;
    }

    console.log(
      `Embedded ${embeddedCount}/${chunks.length} chunks. Last batch started with article ${batch[0]?.article.number}.`,
    );

    if (start + batchSize < chunks.length) {
      await sleep(batchDelayMs);
    }
  }

  console.log("Embedding ingestion complete.");
  console.log({
    model,
    dimensions,
    embeddedCount,
  });
}

main()
  .catch((error) => {
    console.error("Embedding ingestion failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
