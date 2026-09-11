/**
 * @file Re-fragmenta e re-embeda um documento (ou todos) com os parâmetros atuais.
 * @module server/knowledge/reprocessKnowledgeFile
 */

import { adminDb } from "@/server/firebase/admin";
import { splitTextIntoChunks } from "@/server/pdf/chunkText";
import { persistKnowledgeDocument } from "@/server/knowledge/saveKnowledgeFile";
import { loadRawText } from "@/server/knowledge/rawText";
import { scrapePage } from "@/server/knowledge/scrapePage";
import { createHttpError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";

/**
 * Reprocessa UM documento já indexado, aplicando o chunking/embedding atuais:
 *  - se tem `sourceUrl`: re-raspa a página;
 *  - senão: usa o texto bruto guardado (rawText).
 *
 * @param {string} fileId
 * @returns {Promise<{ fileId: string, chunksCount: number, changed: boolean }>}
 */
export async function reprocessKnowledgeFile(fileId) {
  if (!fileId) throw createHttpError("ID do documento não informado.", 400);

  const fileRef = adminDb.collection("knowledgeFiles").doc(fileId);
  const snapshot = await fileRef.get();
  if (!snapshot.exists) throw createHttpError("Documento não encontrado.", 404);

  const data = snapshot.data();
  const sourceUrl = data.sourceUrl || null;

  let text = "";
  let title = data.originalName || "documento";
  const meta = {
    contentType: data.contentType,
    size: data.size,
    totalPages: data.totalPages,
    uploadedAt: data.uploadedAt,
    sourceUrl,
  };

  if (sourceUrl) {
    const scraped = await scrapePage(sourceUrl);
    if (!scraped.ok) {
      throw createHttpError(
        `Não foi possível acessar a página (${scraped.reason || "motivo desconhecido"}): ${sourceUrl}`,
        502,
      );
    }
    text = scraped.text;
    title = scraped.title || title;
    meta.lastCheckedAt = new Date();
  } else {
    text = await loadRawText(fileId);
    if (!text) {
      throw createHttpError(
        "Sem texto bruto guardado para este documento. Faça o upload do PDF novamente.",
        409,
      );
    }
  }

  const chunks = splitTextIntoChunks(text);
  logger.debug(`♻️ Reprocessando ${fileId}: ${chunks.length} chunks`);

  const result = await persistKnowledgeDocument({
    fileId,
    originalName: title,
    safeName: data.safeName || "documento",
    meta,
    extractedText: text,
    chunks,
  });

  return { fileId, chunksCount: result.chunksCount, changed: true };
}

/**
 * Reprocessa vários documentos, um a um.
 * @param {{ onProgress?: (done: number, total: number, label?: string) => void, fileIds?: string[] }} [options]
 *   `fileIds` restringe a operação a esses documentos; sem isso, processa a
 *   base inteira (usado pelo cron/migração — nunca pelo clique manual no
 *   painel, que sempre exige uma seleção explícita).
 */
export async function reprocessAllKnowledgeFiles({ onProgress, fileIds } = {}) {
  let ids;
  if (Array.isArray(fileIds) && fileIds.length) {
    ids = fileIds;
  } else {
    const snapshot = await adminDb.collection("knowledgeFiles").get();
    ids = snapshot.docs.map((doc) => doc.id);
  }

  const results = [];
  for (let i = 0; i < ids.length; i++) {
    // Busca um rótulo legível (URL ou nome) só pra mostrar progresso — não
    // custa muito perto do trabalho pesado de reprocessar (scrape + embeddings).
    let label = ids[i];
    try {
      const snap = await adminDb.collection("knowledgeFiles").doc(ids[i]).get();
      label = snap.data()?.sourceUrl || snap.data()?.originalName || ids[i];
    } catch {
      // Segue com o fileId como rótulo se a busca falhar.
    }

    try {
      const result = await reprocessKnowledgeFile(ids[i]);
      results.push({ ...result, ok: true });
    } catch (error) {
      results.push({ fileId: ids[i], ok: false, error: error?.message });
      logger.warn(`⚠️ Falha ao reprocessar ${ids[i]}: ${error?.message}`);
    }
    onProgress?.(i + 1, ids.length, label);
  }

  return {
    total: ids.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok),
    results,
  };
}
