import type { ExtractedPage } from "../pdf.extractor";
import type { ConstitutionalArticle } from "./constitution.types";

export function parseArticles(
  pages: ExtractedPage[]
): ConstitutionalArticle[] {
  const articles: ConstitutionalArticle[] = [];

  let currentPart: string | null = null;
  let currentPartTitle: string | null = null;
  let currentArticle: ConstitutionalArticle | null = null;

  const articleRegex = /^(\d+[A-Z]?)\.\s+(.+)$/;

  const partRegex =
    /^PART\s+([IVXLCDM]+)\s+(.+)$/i;

  for (const page of pages) {
    const lines = page.text.split(/\s{2,}|\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line) continue;

      const partMatch = line.match(partRegex);

      if (partMatch) {
        const [, partNumber, partTitle] = partMatch;

        if (!partNumber || !partTitle) continue;

        if (currentArticle) {
          articles.push(currentArticle);
          currentArticle = null;
        }

        currentPart = partNumber;
        currentPartTitle = partTitle;

        continue;
      }

      const articleMatch = line.match(articleRegex);

      if (articleMatch) {
        const [, articleNumber, articleTitle] = articleMatch;

        if (!articleNumber || !articleTitle) continue;

        if (currentArticle) {
          articles.push(currentArticle);
        }

        currentArticle = {
          number: articleNumber,
          title: articleTitle,
          part: currentPart,
          partTitle: currentPartTitle,
          chapter: null,
          content: line,
          pageStart: page.pageNumber,
          pageEnd: page.pageNumber,
        };

        continue;
      }

      if (currentArticle) {
        currentArticle.content += " " + line;
        currentArticle.pageEnd = page.pageNumber;
      }
    }
  }

  if (currentArticle) {
    articles.push(currentArticle);
  }

  return articles;
}
