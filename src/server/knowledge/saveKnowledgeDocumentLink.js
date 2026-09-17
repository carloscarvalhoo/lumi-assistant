/**
 * @file Baixa e indexa um documento (PDF ou .docx) encontrado como link
 * dentro de uma página mapeada (edital, formulário, portaria...) — mesmo
 * pipeline do upload manual de arquivo, só que a origem é uma URL em vez de
 * um arquivo enviado.
 * @module server/knowledge/saveKnowledgeDocumentLink
 */

import { persistKnowledgeDocument } from "@/server/knowledge/saveKnowledgeFile";
import { parsePdfBuffer } from "@/server/pdf/parsePdf";
import { parseDocxBuffer } from "@/server/pdf/parseDocx";
import { splitTextIntoChunks } from "@/server/pdf/chunkText";
import { findKnowledgeFileIdByUrl } from "@/server/knowledge/knowledgeFilesRepository";
import { logger } from "@/server/utils/logger";

const FETCH_TIMEOUT_MS = Number(process.env.SCRAPE_TIMEOUT_MS) || 15000;
const MAX_DOCUMENT_BYTES = Number(process.env.SCRAPE_MAX_PDF_BYTES) || 15_000_000;
// Teto por página pra não sair baixando dezenas de documentos de uma vez só
// porque uma página linka pra um monte deles (ex: página "Editais" com anos
// de histórico) — prioriza os primeiros encontrados no HTML.
const MAX_DOCUMENT_LINKS_PER_PAGE = Number(process.env.MAX_PDF_LINKS_PER_PAGE) || 8;

const PARSERS = {
  ".pdf": { parse: parsePdfBuffer, contentType: "application/pdf", accept: "application/pdf" },
  ".docx": {
    parse: parseDocxBuffer,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    accept: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
};

function sanitizeName(name) {
  return String(name || "documento")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function fileNameFromUrl(docUrl, fallback) {
  try {
    const path = new URL(docUrl).pathname;
    const last = path.split("/").filter(Boolean).pop();
    return decodeURIComponent(last || fallback);
  } catch {
    return fallback;
  }
}

function extensionOf(docUrl) {
  try {
    const path = new URL(docUrl).pathname.toLowerCase();
    return Object.keys(PARSERS).find((ext) => path.endsWith(ext)) || null;
  } catch {
    return null;
  }
}

async function downloadDocument(docUrl, accept) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(docUrl, {
      headers: { "User-Agent": "Mozilla/5.0 ChatbotIFPR/1.0", Accept: accept },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) return { ok: false, reason: `http_${response.status}` };

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength && contentLength > MAX_DOCUMENT_BYTES) {
      return { ok: false, reason: `muito_grande: ${contentLength} bytes` };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_DOCUMENT_BYTES) {
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
 * Baixa e indexa um único documento (PDF ou .docx) pela URL. Reaproveita o
 * dedup por sourceUrl — se o documento já foi indexado antes (de outra
 * página, por exemplo), substitui os chunks em vez de criar um duplicado.
 *
 * @param {string} docUrl
 * @returns {Promise<{ok: true, fileId: string} | {ok: false, reason: string}>}
 */
export async function saveKnowledgeDocumentLink(docUrl) {
  const ext = extensionOf(docUrl);
  if (!ext) {
    return { ok: false, reason: "tipo_nao_suportado" };
  }
  const { parse, contentType, accept } = PARSERS[ext];

  const downloaded = await downloadDocument(docUrl, accept);
  if (!downloaded.ok) {
    logger.warn(`⚠️ Documento linkado falhou (${downloaded.reason}): ${docUrl}`);
    return { ok: false, reason: downloaded.reason };
  }

  let parsed;
  try {
    parsed = await parse(downloaded.buffer);
  } catch (error) {
    logger.warn(`⚠️ Não foi possível ler o documento ${docUrl}: ${error?.message}`);
    return { ok: false, reason: `documento_invalido: ${error?.message || "erro ao ler"}` };
  }

  if (!parsed.text || parsed.text.length < 50) {
    return { ok: false, reason: "conteudo_curto" };
  }

  const fileName = fileNameFromUrl(docUrl, `documento${ext}`);
  const existingId = await findKnowledgeFileIdByUrl(docUrl);
  const chunks = splitTextIntoChunks(parsed.text);

  const result = await persistKnowledgeDocument({
    fileId: existingId || crypto.randomUUID(),
    originalName: fileName,
    safeName: sanitizeName(fileName),
    meta: {
      contentType,
      sourceUrl: docUrl,
      size: downloaded.buffer.length,
      totalPages: parsed.totalPages || null,
      lastCheckedAt: new Date(),
    },
    extractedText: parsed.text,
    chunks,
  });

  logger.info(`📎 Documento linkado indexado: ${fileName} (${docUrl})`);
  return { ok: true, fileId: result.fileId };
}

/**
 * Baixa e indexa todos os documentos encontrados numa página (até o teto de
 * segurança). Falhas em documentos individuais não derrubam o processamento
 * da página em si — cada um é tentado de forma independente.
 *
 * @param {string[]} documentLinks
 * @returns {Promise<{ok: number, failed: {url: string, reason: string}[]}>}
 */
export async function saveKnowledgeDocumentLinks(documentLinks) {
  const links = (documentLinks || []).slice(0, MAX_DOCUMENT_LINKS_PER_PAGE);
  const failed = [];
  let ok = 0;

  for (const docUrl of links) {
    try {
      const result = await saveKnowledgeDocumentLink(docUrl);
      if (result.ok) ok += 1;
      else failed.push({ url: docUrl, reason: result.reason });
    } catch (error) {
      failed.push({ url: docUrl, reason: error?.message || "erro desconhecido" });
    }
  }

  return { ok, failed };
}
