import { fileURLToPath } from "node:url";

import { extractPdfPages } from "./pdf.extractor";

async function main() {
  const pages = await extractPdfPages(
    fileURLToPath(new URL("../data/source/constitution.pdf", import.meta.url))
  );

  console.log("Total PDF pages:", pages.length);

  console.log("\n========== FIRST PAGE ==========");
  console.log(pages[0]?.text);

  console.log("\n========== SECOND PAGE ==========");
  console.log(pages[1]?.text);

  const article21Page = pages.find(
  (page) =>
    page.pageNumber === 42 &&
    /21\.\s*Protection of life and personal liberty/i.test(page.text),
  );

  console.log("\n========== ARTICLE 21 SEARCH ==========");
console.log(article21Page?.text);
  const matchingPages = pages.filter((page) =>
    /21\.\s*Protection of life and personal liberty/i.test(
      page.text
    )
  );

  console.log(
    matchingPages.map((page) => ({
      pageNumber: page.pageNumber,
      text: page.text.slice(0, 1500),
    }))
  );
}

main().catch(console.error);
