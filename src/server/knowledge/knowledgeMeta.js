/**
 * @file Operações de metadados de documentos: marcar como revisado, definir validade. Re-exporta computeFreshness.
 * @module server/knowledge/knowledgeMeta
 */

import { createHttpError } from "@/server/utils/errors";
import { computeFreshness, DEFAULT_REVIEW_INTERVAL_MONTHS } from "@/server/knowledge/freshness";
import { updateKnowledgeFile } from "@/server/knowledge/knowledgeFilesRepository";

export async function markFileReviewed(id) {
  if (!id) throw createHttpError("ID não informado.", 400);
  await updateKnowledgeFile(id, { lastReviewedAt: new Date(), updatedAt: new Date() });
}

export async function setFileValidity(id, { sourceDate, expiresAt, reviewIntervalMonths } = {}) {
  if (!id) throw createHttpError("ID não informado.", 400);

  const patch = { updatedAt: new Date() };
  if (sourceDate !== undefined) patch.sourceDate = sourceDate ? new Date(sourceDate) : null;
  if (expiresAt !== undefined) patch.expiresAt = expiresAt ? new Date(expiresAt) : null;
  if (reviewIntervalMonths !== undefined) {
    patch.reviewIntervalMonths = Number(reviewIntervalMonths) || DEFAULT_REVIEW_INTERVAL_MONTHS;
  }

  await updateKnowledgeFile(id, patch);
}

// Reexporta o cálculo puro (fica em freshness.js para ser testável sem Firestore).
export { computeFreshness };
