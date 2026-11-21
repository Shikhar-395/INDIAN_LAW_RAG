import "dotenv/config";

import {
  createGeminiEmbedding,
  getGeminiEmbeddingDimensions,
  getGeminiEmbeddingModel,
} from "./gemini-embeddings";

const embedding = await createGeminiEmbedding(
  "Article 21 protects life and personal liberty.",
);

console.log({
  model: getGeminiEmbeddingModel(),
  dimensions: getGeminiEmbeddingDimensions(),
  embeddingLength: embedding.length,
  firstFiveValues: embedding.slice(0, 5),
});
