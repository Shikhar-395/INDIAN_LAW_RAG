interface GeminiEmbeddingResponse {
  embedding?: {
    values?: unknown;
  };
}

interface GeminiBatchEmbeddingResponse {
  embeddings?: Array<{
    values?: unknown;
  }>;
}

export interface CreateGeminiEmbeddingOptions {
  taskType?: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";
  title?: string;
}

export function getGeminiEmbeddingModel() {
  return process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
}

export function getGeminiEmbeddingDimensions() {
  return Number(process.env.GEMINI_EMBEDDING_DIMENSIONS ?? 1536);
}

export async function createGeminiEmbedding(
  text: string,
  options?: CreateGeminiEmbeddingOptions,
) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = getGeminiEmbeddingModel();
  const dimensions = getGeminiEmbeddingDimensions();

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
        taskType: options?.taskType ?? "RETRIEVAL_DOCUMENT",
        title: options?.title,
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

export async function createGeminiEmbeddings(
  texts: string[],
  options?: CreateGeminiEmbeddingOptions,
) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = getGeminiEmbeddingModel();
  const dimensions = getGeminiEmbeddingDimensions();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined");
  }

  if (texts.length === 0) {
    return [];
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: `models/${model}`,
        requests: texts.map((text) => ({
          model: `models/${model}`,
          taskType: options?.taskType ?? "RETRIEVAL_DOCUMENT",
          title: options?.title,
          outputDimensionality: dimensions,
          content: {
            parts: [
              {
                text,
              },
            ],
          },
        })),
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Gemini batch embedding failed: ${response.status} ${errorText}`,
    );
  }

  const result = (await response.json()) as GeminiBatchEmbeddingResponse;
  const embeddings = result.embeddings;

  if (!Array.isArray(embeddings)) {
    throw new Error("No embeddings returned");
  }

  if (embeddings.length !== texts.length) {
    throw new Error(
      `Expected ${texts.length} embeddings, got ${embeddings.length}`,
    );
  }

  return embeddings.map((item, index) => {
    const embedding = item.values;

    if (!Array.isArray(embedding)) {
      throw new Error(`No embedding returned at index ${index}`);
    }

    if (!embedding.every((value) => typeof value === "number")) {
      throw new Error(`Embedding at index ${index} contains non-number values`);
    }

    if (embedding.length !== dimensions) {
      throw new Error(
        `Expected ${dimensions} dimensions at index ${index}, got ${embedding.length}`,
      );
    }

    return embedding;
  });
}
