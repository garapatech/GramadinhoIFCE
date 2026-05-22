// Extrai labels com bbox dos PDFs das plantas e gera JSON com coordenadas em
// (a) pontos PDF e (b) pixels da imagem renderizada a 200dpi (2200x1700).
//
// Uso:
//   node scripts/blocoTelematica/extractLabels.mjs \
//     /tmp/plantas/sup-bbox.html /tmp/plantas/sup-labels.json
//
// pdftotext -bbox-layout já agrupa palavras em <block>. Cada block é tratado
// como um label, com o texto sendo a junção das palavras na ordem lida.

import { readFileSync, writeFileSync } from "node:fs";

const PDF_W_PT = 792;
const PDF_H_PT = 612;
const PNG_W_PX = 2200;
const PNG_H_PX = 1700;
const SCALE_X = PNG_W_PX / PDF_W_PT;
const SCALE_Y = PNG_H_PX / PDF_H_PT;

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("uso: extractLabels.mjs <bbox.html> <labels.json>");
  process.exit(1);
}

const html = readFileSync(inputPath, "utf8");

const blockRegex = /<block\s+xMin="([\d.]+)"\s+yMin="([\d.]+)"\s+xMax="([\d.]+)"\s+yMax="([\d.]+)">([\s\S]*?)<\/block>/g;
const wordRegex = /<word[^>]*>([^<]+)<\/word>/g;

const labels = [];
let blockMatch;
while ((blockMatch = blockRegex.exec(html)) !== null) {
  const [, xMin, yMin, xMax, yMax, inner] = blockMatch;
  const words = [];
  let w;
  wordRegex.lastIndex = 0;
  while ((w = wordRegex.exec(inner)) !== null) {
    words.push(w[1].trim());
  }
  if (words.length === 0) continue;
  const text = words.join(" ").replace(/\s+/g, " ").trim();
  if (!text) continue;

  const pdf = {
    xMin: Number(xMin),
    yMin: Number(yMin),
    xMax: Number(xMax),
    yMax: Number(yMax),
  };
  pdf.cx = (pdf.xMin + pdf.xMax) / 2;
  pdf.cy = (pdf.yMin + pdf.yMax) / 2;

  const px = {
    xMin: Math.round(pdf.xMin * SCALE_X),
    yMin: Math.round(pdf.yMin * SCALE_Y),
    xMax: Math.round(pdf.xMax * SCALE_X),
    yMax: Math.round(pdf.yMax * SCALE_Y),
  };
  px.cx = Math.round(pdf.cx * SCALE_X);
  px.cy = Math.round(pdf.cy * SCALE_Y);

  labels.push({ text, pdf, px });
}

const result = {
  source: inputPath,
  pdfSize: { width: PDF_W_PT, height: PDF_H_PT },
  pngSize: { width: PNG_W_PX, height: PNG_H_PX },
  labels,
};

writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log(`Escritos ${labels.length} labels em ${outputPath}`);
