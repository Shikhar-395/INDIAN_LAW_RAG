import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { prisma } from "@repo/db";

import { chunkArticle } from "./chunking";
import { extractPdfPages } from "./pdf.extractor";
import { parseArticles } from "./parsers/constitution.parser";

interface SourceMetadata {
  title: string;
  publisher?: string;
  version?: string;
  language?: string;
  source?: string;
  filename: string;
}

async function readMetadata() {
  const metadataPath = fileURLToPath(
    new URL("../data/source/metadata.json", import.meta.url),
  );

  const rawMetadata = await readFile(metadataPath, "utf8");

  return JSON.parse(rawMetadata) as SourceMetadata;
}

async function main() {
  const metadata = await readMetadata();

  const pdfPath = fileURLToPath(
    new URL(`../data/source/${metadata.filename}`, import.meta.url),
  );

  console.log("Extracting PDF pages...");
  const pages = await extractPdfPages(pdfPath);

  console.log("Parsing articles...");
  const articles = parseArticles(pages);

  console.log(`Parsed ${articles.length} articles.`);

  let document = await prisma.document.findFirst({
    where: {
      title: metadata.title,
      version: metadata.version,
    },
  });

  if (!document) {
    document = await prisma.document.create({
      data: {
        title: metadata.title,
        description: metadata.publisher,
        sourceUrl: metadata.source,
        version: metadata.version,
        language: metadata.language ?? "en",
      },
    });
  } else {
    document = await prisma.document.update({
      where: {
        id: document.id,
      },
      data: {
        description: metadata.publisher,
        sourceUrl: metadata.source,
        version: metadata.version,
        language: metadata.language ?? "en",
      },
    });
  }

  const articleRows = articles.map((article) => ({
    number: article.number,
    title: article.title,
    part: article.part,
    partTitle: article.partTitle,
    chapter: article.chapter,
    content: article.content,
    pageStart: article.pageStart,
    pageEnd: article.pageEnd,
    documentId: document.id,
  }));

  console.log("Saving articles and chunks to database...");

  const chunkCount = await prisma.$transaction(
    async (tx) => {
      await tx.article.deleteMany({
        where: {
          documentId: document.id,
        },
      });

      await tx.article.createMany({
        data: articleRows,
      });

      const savedArticles = await tx.article.findMany({
        where: {
          documentId: document.id,
        },
        orderBy: [
          {
            pageStart: "asc",
          },
          {
            number: "asc",
          },
        ],
      });

      const chunkRows = savedArticles.flatMap((article) => {
        const chunks = chunkArticle({
          documentTitle: document.title,
          article: {
            number: article.number,
            title: article.title,
            part: article.part,
            partTitle: article.partTitle,
            chapter: article.chapter,
            content: article.content,
            pageStart: article.pageStart ?? 0,
            pageEnd: article.pageEnd ?? 0,
          },
        });

        return chunks.map((chunk) => ({
          articleId: article.id,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
        }));
      });

      await tx.chunk.createMany({
        data: chunkRows,
      });

      return chunkRows.length;
    },
    {
      timeout: 60_000,
    },
  );

  console.log("Ingestion complete.");
  console.log({
    documentId: document.id,
    documentTitle: document.title,
    articleCount: articleRows.length,
    chunkCount,
  });
}

main()
  .catch((error) => {
    console.error("Ingestion failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
