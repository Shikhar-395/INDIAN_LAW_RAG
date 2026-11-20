import type { ExtractedPage } from "../pdf.extractor";
import type { ConstitutionalArticle } from "./constitution.types";

const ARTICLE_NUMBER_PATTERN = "\\d+(?:-?[A-Z]+)?";
const ARTICLE_REGEX = new RegExp(
  `^[*]*\\s*\\[?\\s*(${ARTICLE_NUMBER_PATTERN})\\s*\\.\\s+(.+?)\\s*\\.\\s*[—⎯-]\\s*(.*)$`,
);
const ARTICLE_START_REGEX = new RegExp(
  `^[*]*\\s*\\[?\\s*${ARTICLE_NUMBER_PATTERN}\\s*\\.\\s+`,
);
const PART_REGEX =
  /^[*]*\s*\[?\s*PART\s+([IVXLCDM]+(?:-?[A-Z]+)?)\s*$/i;
const CHAPTER_REGEX =
  /^CHAPTER\s+([IVXLCDM]+)\.?\s*(?:[—⎯-]\s*(.*))?$/i;

export function parseArticles(
  pages: ExtractedPage[],
): ConstitutionalArticle[] {
  const articles: ConstitutionalArticle[] = [];

  let currentPart: string | null = null;
  let currentPartTitle: string | null = null;
  let currentChapter: string | null = null;
  let currentArticle: ConstitutionalArticle | null = null;

  const bodyPages = getConstitutionBodyPages(pages);

  function saveCurrentArticle() {
    if (!currentArticle) return;

    currentArticle.title = cleanArticleTitle(currentArticle.title ?? "");
    currentArticle.content = cleanArticleContent(currentArticle.content);

    articles.push(currentArticle);
    currentArticle = null;
  }

  for (const page of bodyPages) {
    const lines = page.text.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = cleanLine(lines[i] ?? "");

      if (!line) continue;
      if (isIgnorableLine(line)) continue;
      if (isFootnoteStart(line)) break;

      const normalizedHeadingLine = cleanHeadingText(line);

      // Detect Part headings, including bracketed inserted parts like:
      // [ PART IVA
      // [ PART XIVA
      const partMatch = normalizedHeadingLine.match(PART_REGEX);

      if (partMatch) {
        saveCurrentArticle();

        currentPart = partMatch[1]?.toUpperCase() ?? null;
        currentChapter = null;

        const partTitle = readPartTitle(lines, i + 1);
        currentPartTitle = partTitle.title;
        i = Math.max(i, partTitle.endIndex);

        continue;
      }

      const chapter = parseChapterHeading(normalizedHeadingLine);

      if (chapter) {
        saveCurrentArticle();
        currentChapter = chapter;
        continue;
      }

      // Detect article headings. Some headings wrap across multiple PDF lines,
      // so collect heading text until the title/content separator dash appears.
      if (ARTICLE_START_REGEX.test(line)) {
        const heading = readArticleHeading(lines, i);
        const articleMatch = heading.text.match(ARTICLE_REGEX);

        if (articleMatch) {
          const [, articleNumber, articleTitle, initialContent] =
            articleMatch;

          if (!articleNumber || !articleTitle) continue;

          saveCurrentArticle();

          currentArticle = {
            number: articleNumber,
            title: cleanArticleTitle(articleTitle),
            part: currentPart,
            partTitle: currentPartTitle,
            chapter: currentChapter,
            content: cleanArticleContent(initialContent ?? ""),
            pageStart: page.pageNumber,
            pageEnd: page.pageNumber,
          };

          i = heading.endIndex;

          continue;
        }
      }

      if (currentArticle && isSectionHeadingBeforeArticle(lines, i)) {
        continue;
      }

      // Append remaining lines to the current article.
      if (currentArticle) {
        currentArticle.content +=
          (currentArticle.content ? "\n" : "") + line;

        currentArticle.pageEnd = page.pageNumber;
      }
    }
  }

  saveCurrentArticle();

  return articles;
}

function getConstitutionBodyPages(pages: ExtractedPage[]) {
  const bodyStartIndex = pages.findIndex(
    (page) =>
      page.text.includes("1. Name and territory of the Union") &&
      !/\bcontents\b/i.test(page.text),
  );

  if (bodyStartIndex === -1) return pages;

  const scheduleStartIndex = pages.findIndex(
    (page, index) =>
      index > bodyStartIndex &&
      page.text
        .split("\n")
        .some((line) => /^\[?\s*FIRST\s+SCHEDULE\s*$/i.test(cleanLine(line))),
  );

  return pages.slice(
    bodyStartIndex,
    scheduleStartIndex === -1 ? undefined : scheduleStartIndex,
  );
}

function readArticleHeading(lines: string[], startIndex: number) {
  let text = cleanLine(lines[startIndex] ?? "");
  let endIndex = startIndex;

  while (!/[—⎯-]/.test(text) && endIndex - startIndex < 8) {
    const nextIndex = endIndex + 1;
    const nextLine = cleanLine(lines[nextIndex] ?? "");

    if (!nextLine) break;
    if (isFootnoteStart(nextLine)) break;

    const normalizedNextLine = cleanHeadingText(nextLine);

    if (normalizedNextLine.match(PART_REGEX)) break;
    if (parseChapterHeading(normalizedNextLine)) break;
    if (ARTICLE_START_REGEX.test(nextLine)) break;

    endIndex = nextIndex;

    if (isIgnorableLine(nextLine)) continue;

    text += ` ${nextLine}`;
  }

  return {
    text: cleanHeadingText(text),
    endIndex,
  };
}

function readPartTitle(lines: string[], startIndex: number) {
  const titleLines: string[] = [];
  let endIndex = startIndex - 1;

  for (let i = startIndex; i < lines.length && titleLines.length < 5; i++) {
    const line = cleanLine(lines[i] ?? "");

    if (!line) {
      endIndex = i;
      continue;
    }

    if (isFootnoteStart(line)) break;

    const normalizedLine = cleanHeadingText(line);

    if (normalizedLine.match(PART_REGEX)) break;
    if (parseChapterHeading(normalizedLine)) break;
    if (ARTICLE_START_REGEX.test(line)) break;
    if (titleLines.length > 0 && !isPartTitleLine(line)) break;

    endIndex = i;

    if (isIgnorableLine(line)) continue;

    titleLines.push(line);
  }

  return {
    title: cleanPartTitle(titleLines.join(" ")) || null,
    endIndex,
  };
}

function isPartTitleLine(line: string) {
  const cleanedLine = cleanPartTitle(line);

  if (!cleanedLine) return false;

  return !/[a-z]/.test(cleanedLine);
}

function parseChapterHeading(line: string) {
  const cleanedLine = stripOuterBrackets(cleanHeadingText(line));
  const match = cleanedLine.match(CHAPTER_REGEX);

  if (!match) return null;

  const chapterNumber = match[1] ?? "";
  const chapterTitle = cleanTitle(match[2] ?? "");

  return chapterTitle
    ? `${chapterNumber.toUpperCase()} — ${chapterTitle}`
    : chapterNumber.toUpperCase();
}

function isSectionHeadingBeforeArticle(lines: string[], index: number) {
  const line = cleanLine(lines[index] ?? "");

  if (!line) return false;
  if (/[.;:—⎯-]$/.test(line)) return false;
  if (ARTICLE_START_REGEX.test(line)) return false;
  if (line.length > 90) return false;

  for (let i = index + 1; i < lines.length; i++) {
    const nextLine = cleanLine(lines[i] ?? "");

    if (!nextLine) continue;
    if (isIgnorableLine(nextLine)) continue;
    if (isFootnoteStart(nextLine)) return false;

    return ARTICLE_START_REGEX.test(nextLine);
  }

  return false;
}

function isIgnorableLine(line: string) {
  return isPageHeader(line) || isStandaloneMarker(line);
}

function isPageHeader(line: string) {
  return (
    /^THE CONSTITUTION OF INDIA$/i.test(line) ||
    /^\d+\s+THE CONSTITUTION OF INDIA$/i.test(line) ||
    /^\(Part .+\)$/i.test(line)
  );
}

function isStandaloneMarker(line: string) {
  return /^\d+$/.test(line) || /^[*]+\s*\d*$/.test(line);
}

function isFootnoteStart(line: string) {
  return /^(?:\d+|[*]+)\s*\.?\s+(?:Subs?\.|Ins\.|Inserted|Added|Omitted|The words|The brackets|For |See |Cf\.|Cl\.|Cls\.|Art\.|Article |Certain|Now |This article|Clause|Sub-clause|Paragraph|In exercise)/i.test(
    line,
  );
}

function cleanArticleTitle(title: string) {
  return cleanTitle(title).replace(/\.$/, "").trim();
}

function cleanPartTitle(title: string) {
  return cleanTitle(title).replace(/\*+/g, "").trim();
}

function cleanTitle(title: string) {
  return stripOuterBrackets(cleanHeadingText(title))
    .replace(/\s+([,.;:!?\])])/g, "$1")
    .replace(/([([])\s+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanArticleContent(content: string) {
  return content
    .trim()
    .replace(/\]+\s*$/g, "")
    .trim();
}

function cleanHeadingText(value: string) {
  return repairLetterSpacing(cleanLine(value))
    .replace(/[]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripOuterBrackets(value: string) {
  let result = value.trim();

  while (result.startsWith("[") && result.endsWith("]")) {
    result = result.slice(1, -1).trim();
  }

  return result;
}

function repairLetterSpacing(value: string) {
  let result = value;
  let previous: string;

  do {
    previous = result;
    result = result.replace(/\b([A-Z])\s+([A-Z]{2,})\b/g, "$1$2");
  } while (result !== previous);

  return result;
}
