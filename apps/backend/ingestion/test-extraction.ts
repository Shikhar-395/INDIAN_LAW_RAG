import { fileURLToPath } from "node:url";

import { extractPdfPages } from "./pdf.extractor";
import { parseArticles } from "./parsers/constitution.parser";

async function main() {
  const pages = await extractPdfPages(
    fileURLToPath(new URL("../data/source/constitution.pdf", import.meta.url)),
  );

  const articles = parseArticles(pages);

  console.log("Total parsed articles:", articles.length);

  const articleNumbersToCheck = [
    "1",
    "3",
    "4",
    "12",
    "14",
    "19",
    "21",
    "21A",
    "32",
    "44",
    "51A",
    "72",
    "124",
    "226",
    "239AA",
    "243G",
    "300A",
    "323A",
    "368",
    "370",
    "371-I",
    "395",
  ];

  const missing: string[] = [];

  for (const articleNumber of articleNumbersToCheck) {
    const article = articles.find(
      (article) => article.number === articleNumber,
    );

    console.log(`\n========== ARTICLE ${articleNumber} ==========`);

    if (!article) {
      console.log("Missing");
      missing.push(articleNumber);
      continue;
    }

    console.dir(
      {
        number: article.number,
        title: article.title,
        part: article.part,
        partTitle: article.partTitle,
        pageStart: article.pageStart,
        pageEnd: article.pageEnd,
        contentPreview: article.content.slice(0, 300),
      },
      { depth: null },
    );
  }

  console.log("\n========== SUMMARY ==========");
  console.log("Total parsed articles:", articles.length);
  console.log("Missing checked articles:", missing.length ? missing : "none");
}

main().catch(console.error);
