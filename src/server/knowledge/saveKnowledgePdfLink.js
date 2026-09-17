/**
 * @file Baixa e indexa um PDF encontrado como link dentro de uma página
 * mapeada (edital, formulário, portaria...) — mesmo pipeline do upload
 * manual de PDF, só que a origem é uma URL em vez de um arquivo enviado.
 * @module server/knowledge/saveKnowledgePdfLink
 */

import { persistKnowledgeDocument } from "@/server/knowledge/saveKnowledgeFile";
import { parsePdfBuffer } from "@/server/pdf/parsePdf";
import { splitTextIntoChunks } from "@/server/pdf/chunkText";
import { findKnowledgeFileIdByUrl } from "@/server/knowledge/knowledgeFilesRepository";
import { logger } from "@/server/utils/logger";

const FETCH_TIMEOUT_MS = Number(process.env.SCRAPE_TIMEOUT_MS) || 15000;
const MAX_PDF_BYTES = Number(process.env.SCRAPE_MAX_PDF_BYTES) || 15_000_000;
// Teto por página pra não sair baixando dezenas de PDFs de uma vez só porque
// uma página linka pra um monte de documento (ex: página "Editais" com anos
// de histórico) — prioriza os primeiros encontrados no HTML.
const MAX_PDF_LINKS_PER_PAGE = Number(process.env.MAX_PDF_LINKS_PER_PAGE) || 8;

function sanitizeName(name) {
  return String(name || "documento")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function fileNameFromUrl(pdfUrl) {
  try {
    const path = new URL(pdfUrl).pathname;
    const last = path.split("/").filter(Boolean).pop();
    return decodeURIComponent(last || "documento.pdf");
  } catch {
    return "documento.pdf";
  }
}

async function downloadPdf(pdfUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(pdfUrl, {
      headers: { "User-Agent": "Mozilla/5.0 ChatbotIFPR/1.0", Accept: "application/pdf" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) return { ok: false, reason: `http_${response.status}` };

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength && contentLength > MAX_PDF_BYTES) {
      return { ok: false, reason: `muito_grande: ${contentLength} bytes` };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_PDF_BYTES) {
      return { ok: false, reason: `muito_grande: ${buffer.length} bytes` };
    }

    return { ok: true, buffer };
  } catch (error) {
    const reason =
      error?.name === "AbortError"
        ? "timeout"
        : `erro_de_rede: ${error?.cause?.code || error?.code || error?.message || "desconhecido"}`;
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Baixa e indexa um único PDF pela URL. Reaproveita o dedup por sourceUrl —
 * se o PDF já foi indexado antes (de outra página, por exemplo), substitui
 * os chunks em vez de criar um documento duplicado.
 *
 * @param {string} pdfUrl
 * @returns {Promise<{ok: true, fileId: string} | {ok: false, reason: string}>}
 */
export async function saveKnowledgePdfLink(pdfUrl) {
  const downloaded = await downloadPdf(pdfUrl);
  if (!downloaded.ok) {
    logger.warn(`⚠️ PDF linkado falhou (${downloaded.reason}): ${pdfUrl}`);
    return { ok: false, reason: downloaded.reason };
  }

  let parsed;
  try {
    parsed = await parsePdfBuffer(downloaded.buffer);
  } catch (error) {
    logger.warn(`⚠️ Não foi possível ler o PDF ${pdfUrl}: ${error?.message}`);
    return { ok: false, reason: `pdf_invalido: ${error?.message || "erro ao ler"}` };
  }

  if (!parsed.text || parsed.text.length < 50) {
    return { ok: false, reason: "conteudo_curto" };
  }

  const fileName = fileNameFromUrl(pdfUrl);
  const existingId = await findKnowledgeFileIdByUrl(pdfUrl);
  const chunks = splitTextIntoChunks(parsed.text);

  const result = await persistKnowledgeDocument({
    fileId: existingId || crypto.randomUUID(),
    originalName: fileName,
    safeName: sanitizeName(fileName),
    meta: {
      contentType: "application/pdf",
      sourceUrl: pdfUrl,
      size: downloaded.buffer.length,
      totalPages: parsed.totalPages,
      lastCheckedAt: new Date(),
    },
    extractedText: parsed.text,
    chunks,
  });

  logger.info(`📎 PDF linkado indexado: ${fileName} (${pdfUrl})`);
  return { ok: true, fileId: result.fileId };
}

/**
 * Baixa e indexa todos os PDFs encontrados numa página (até o teto de
 * segurança). Falhas em PDFs individuais não derrubam o processamento da
 * página em si — cada um é tentado de forma independente.
 *
 * @param {string[]} pdfLinks
 * @returns {Promise<{ok: number, failed: {url: string, reason: string}[]}>}
 */
export async function saveKnowledgePdfLinks(pdfLinks) {
  const links = (pdfLinks || []).slice(0, MAX_PDF_LINKS_PER_PAGE);
  const failed = [];
  let ok = 0;

  for (const pdfUrl of links) {
    try {
      const result = await saveKnowledgePdfLink(pdfUrl);
      if (result.ok) ok += 1;
      else failed.push({ url: pdfUrl, reason: result.reason });
    } catch (error) {
      failed.push({ url: pdfUrl, reason: error?.message || "erro desconhecido" });
    }
  }

  return { ok, failed };
}
