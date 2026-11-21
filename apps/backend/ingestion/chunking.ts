import type { ConstitutionalArticle } from "./parsers/constitution.types";

interface ChunkArticleOptions {
  documentTitle: string;
  maxCharacters?: number;
  overlapCharacters?: number;
}

export interface ArticleChunkInput {
  article: ConstitutionalArticle;
  documentTitle: string;
}

export interface ArticleChunk {
  chunkIndex: number;
  content: string;
}

export function chunkArticle(
  input: ArticleChunkInput,
  options?: Pick<ChunkArticleOptions, "maxCharacters" | "overlapCharacters">,
): ArticleChunk[] {
  const maxCharacters = options?.maxCharacters ?? 1800;
  const overlapCharacters = options?.overlapCharacters ?? 200;

  const contextPrefix = buildContextPrefix(
    input.documentTitle,
    input.article,
  );

  const normalizedContent = normalizeArticleContent(input.article.content);

  const fullText = `${contextPrefix}\n\n${normalizedContent}`;

  if (fullText.length <= maxCharacters) {
    return [
      {
        chunkIndex: 0,
        content: fullText,
      },
    ];
  }

  const chunks: ArticleChunk[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < fullText.length) {
    const end = Math.min(start + maxCharacters, fullText.length);

    const chunkText = fullText.slice(start, end).trim();

    chunks.push({
      chunkIndex,
      content: chunkText,
    });

    if (end === fullText.length) break;

    start = Math.max(0, end - overlapCharacters);
    chunkIndex++;
  }

  return chunks;
}

function buildContextPrefix(
  documentTitle: string,
  article: ConstitutionalArticle,
) {
  const lines = [`Document: ${documentTitle}`];

  if (article.part && article.partTitle) {
    lines.push(`Part ${article.part}: ${article.partTitle}`);
  }

  if (article.chapter) {
    lines.push(`Chapter ${article.chapter}`);
  }

  lines.push(`Article ${article.number}: ${article.title ?? "Untitled"}`);

  if (article.pageStart && article.pageEnd) {
    lines.push(`Pages: ${article.pageStart}-${article.pageEnd}`);
  }

  return lines.join("\n");
}

function normalizeArticleContent(content: string) {
  return content.replace(/\n{3,}/g, "\n\n").trim();
}
