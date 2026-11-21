import { prisma } from "@repo/db";

interface GeminiEmbeddingResponse {
  embedding?: {
    values?: unknown;
  };
}

interface AzureChatResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

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

export interface AnswerQuestionResult {
  question: string;
  answer: string;
  sources: Array<{
    articleNumber: string;
    articleTitle: string | null;
    part: string | null;
    partTitle: string | null;
    chapter: string | null;
    pageStart: number | null;
    pageEnd: number | null;
    chunkIndex: number;
    similarity: number;
  }>;
}

export interface AnswerQuestionOptions {
  limit?: number;
}

export async function answerQuestion(
  question: string,
  options?: AnswerQuestionOptions,
): Promise<AnswerQuestionResult> {
  const normalizedQuestion = question.trim();

  if (!normalizedQuestion) {
    throw new Error("Question is required");
  }

  const results = await searchSimilarChunks(normalizedQuestion, {
    limit: options?.limit ?? 5,
  });

  const context = results
    .map((result, index) => {
      const citation = `Source ${index + 1}: Article ${result.articleNumber}, ${result.articleTitle ?? "Untitled"}, pages ${result.pageStart}-${result.pageEnd}`;

      return `${citation}\n${result.content}`;
    })
    .join("\n\n---\n\n");

  const answer = await generateAzureChatCompletion([
    {
      role: "system",
      content: [
        "You are a careful legal RAG assistant for learning Indian constitutional law.",
        "Use only the provided context.",
        "If the context does not contain the answer, say you do not know from the provided context.",
        "Do not invent case law, statutes, article text, or legal conclusions.",
        "Cite the relevant Article number and page range in your answer.",
        "Keep the answer clear and concise.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Question: ${normalizedQuestion}`,
        "",
        "Context:",
        context,
        "",
        "Answer the question using only the context above.",
      ].join("\n"),
    },
  ]);

  return {
    question: normalizedQuestion,
    answer,
    sources: results.map((result) => ({
      articleNumber: result.articleNumber,
      articleTitle: result.articleTitle,
      part: result.part,
      partTitle: result.partTitle,
      chapter: result.chapter,
      pageStart: result.pageStart,
      pageEnd: result.pageEnd,
      chunkIndex: result.chunkIndex,
      similarity: Number(result.similarity),
    })),
  };
}

export async function searchSimilarChunks(
  query: string,
  options?: { limit?: number },
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

async function createGeminiEmbedding(
  text: string,
  options?: { taskType?: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" },
) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
  const dimensions = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS ?? 1536);

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: `models/${model}`,
        taskType: options?.taskType ?? "RETRIEVAL_QUERY",
        outputDimensionality: dimensions,
        content: {
          parts: [
            {
              text,
            },
          ],
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Gemini embedding failed: ${response.status} ${errorText}`,
    );
  }

  const result = (await response.json()) as GeminiEmbeddingResponse;
  const embedding = result.embedding?.values;

  if (!Array.isArray(embedding)) {
    throw new Error("No embedding returned");
  }

  if (!embedding.every((value) => typeof value === "number")) {
    throw new Error("Embedding contains non-number values");
  }

  if (embedding.length !== dimensions) {
    throw new Error(
      `Expected ${dimensions} dimensions, got ${embedding.length}`,
    );
  }

  return embedding;
}

type AzureChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

async function generateAzureChatCompletion(messages: AzureChatMessage[]) {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const baseUrl = getAzureOpenAIBaseUrl();
  const model = process.env.AZURE_OPENAI_CHAT_MODEL;
  const maxCompletionTokens = Number(
    process.env.AZURE_OPENAI_MAX_COMPLETION_TOKENS ?? 512,
  );

  if (!apiKey) {
    throw new Error("AZURE_OPENAI_API_KEY is not defined");
  }

  if (!model) {
    throw new Error("AZURE_OPENAI_CHAT_MODEL is not defined");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      model,
      messages,
      max_completion_tokens: maxCompletionTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(`Azure chat failed: ${response.status} ${errorText}`);
  }

  const result = (await response.json()) as AzureChatResponse;
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Azure chat returned no message content");
  }

  return content;
}

function getAzureOpenAIBaseUrl() {
  const rawBaseUrl = process.env.AZURE_OPENAI_BASE_URL;

  if (!rawBaseUrl) {
    throw new Error("AZURE_OPENAI_BASE_URL is not defined");
  }

  const baseUrl = rawBaseUrl.replace(/\/$/, "");

  if (baseUrl.endsWith("/openai/v1")) {
    return baseUrl;
  }

  return `${baseUrl}/openai/v1`;
}

function toPgVectorLiteral(vector: number[]) {
  return `[${vector.join(",")}]`;
}
