
import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

interface PositionedText {
  text: string;
  x: number;
  y: number;
}

export async function extractPdfPages(
  filePath: string
): Promise<ExtractedPage[]> {
  const buffer = await readFile(filePath);

  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
  });

  const pdf = await loadingTask.promise;

  const pages: ExtractedPage[] = [];

  try {
    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber++
    ) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();

      const positionedItems: PositionedText[] = [];

      for (const item of textContent.items) {
        if (!("str" in item) || !("transform" in item)) {
          continue;
        }

        if (!item.str.trim()) continue;

        positionedItems.push({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
        });
      }

      // PDF coordinates start from the bottom-left.
      // Therefore, higher Y coordinates appear first.
      positionedItems.sort((a, b) => {
        if (Math.abs(a.y - b.y) > 2) {
          return b.y - a.y;
        }

        return a.x - b.x;
      });

      const lines: PositionedText[][] = [];

      for (const item of positionedItems) {
        const currentLine = lines.find((line) => {
          const firstItem = line[0];

          return firstItem
            ? Math.abs(firstItem.y - item.y) <= 2
            : false;
        });

        if (currentLine) {
          currentLine.push(item);
        } else {
          lines.push([item]);
        }
      }

      const text = lines
        .map((line) =>
          line
            .sort((a, b) => a.x - b.x)
            .map((item) => item.text)
            .join(" ")
        )
        .join("\n")
        .trim();

      pages.push({
        pageNumber,
        text,
      });
    }
  } finally {
    await loadingTask.destroy();
  }

  return pages;
}
