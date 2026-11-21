import "dotenv/config";

import { prisma } from "@repo/db";

import { generateAzureChatCompletion } from "../ai/azure-chat";
import { searchSimilarChunks } from "../retrieval/search";

const question = process.argv.slice(2).join(" ") ||
  "What does Article 21 say about personal liberty?";

const results = await searchSimilarChunks(question, {
  limit: 5,
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
      `Question: ${question}`,
      "",
      "Context:",
      context,
      "",
      "Answer the question using only the context above.",
    ].join("\n"),
  },
]);

console.log("\n========== QUESTION ==========");
console.log(question);

console.log("\n========== ANSWER ==========");
console.log(answer);

console.log("\n========== RETRIEVED SOURCES ==========");
for (const [index, result] of results.entries()) {
  console.log(
    `${index + 1}. Article ${result.articleNumber} — ${result.articleTitle} ` +
      `(pages ${result.pageStart}-${result.pageEnd}, similarity ${Number(result.similarity).toFixed(4)})`,
  );
}

await prisma.$disconnect();
