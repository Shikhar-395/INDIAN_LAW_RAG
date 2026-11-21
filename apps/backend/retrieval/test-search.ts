import "dotenv/config";

import { prisma } from "@repo/db";

import { searchSimilarChunks } from "./search";

const query = process.argv.slice(2).join(" ") ||
  "What does Article 21 say about personal liberty?";

const results = await searchSimilarChunks(query, {
  limit: 5,
});

console.log(`Query: ${query}`);

for (const [index, result] of results.entries()) {
  console.log(`\n========== RESULT ${index + 1} ==========`);
  console.log({
    similarity: Number(result.similarity).toFixed(4),
    article: result.articleNumber,
    title: result.articleTitle,
    part: result.part,
    partTitle: result.partTitle,
    chapter: result.chapter,
    pages: `${result.pageStart}-${result.pageEnd}`,
    chunkIndex: result.chunkIndex,
  });
  console.log(result.content.slice(0, 800));
}

await prisma.$disconnect();
