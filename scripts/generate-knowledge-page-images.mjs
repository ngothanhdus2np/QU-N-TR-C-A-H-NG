import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const previewDir = path.join(repoRoot, 'public', 'knowledge-previews');
const outputRoot = path.join(repoRoot, 'public', 'knowledge-page-images');
const seedPath = path.join(repoRoot, 'constants', 'systemKnowledgeSeed.ts');

class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext('2d') };
  }

  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

const renderPdf = async pdfPath => {
  const id = path.basename(pdfPath, '.pdf');
  const bytes = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data: bytes, disableWorker: true }).promise;
  const outputDir = path.join(outputRoot, id);
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 4 });
    const canvasFactory = new NodeCanvasFactory();
    const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
    await page.render({
      canvasContext: canvasAndContext.context,
      viewport,
      canvasFactory,
    }).promise;

    const outputPath = path.join(outputDir, `page-${pageNumber}.png`);
    fs.writeFileSync(outputPath, canvasAndContext.canvas.toBuffer('image/png'));
    page.cleanup();
    canvasFactory.destroy(canvasAndContext);
  }

  await pdf.destroy();
  return { id, pages: pdf.numPages };
};

const pdfFiles = fs
  .readdirSync(previewDir)
  .filter(file => file.endsWith('.pdf'))
  .sort()
  .map(file => path.join(previewDir, file));

fs.mkdirSync(outputRoot, { recursive: true });

const counts = {};
for (const pdfPath of pdfFiles) {
  const result = await renderPdf(pdfPath);
  counts[result.id] = result.pages;
  console.log(`${result.id}: ${result.pages} trang`);
}

const seedSource = fs.readFileSync(seedPath, 'utf8');
const countsBlock = `const KNOWLEDGE_PAGE_IMAGE_COUNTS: Record<string, number> = {\n${Object.entries(counts)
  .map(([id, pages]) => `  '${id}': ${pages},`)
  .join('\n')}\n};`;

const nextSeedSource = seedSource.replace(
  /const KNOWLEDGE_PAGE_IMAGE_COUNTS: Record<string, number> = \{[\s\S]*?\};/,
  countsBlock
);

if (nextSeedSource !== seedSource) {
  fs.writeFileSync(seedPath, nextSeedSource);
}
console.log(`Đã tạo ảnh trang trong ${path.relative(repoRoot, outputRoot)}`);
