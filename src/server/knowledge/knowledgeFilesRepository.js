/**
 * @file Único lugar que constrói queries do Firestore para a coleção
 * `knowledgeFiles` (fora da gravação de chunks/embeddings — essa continua
 * em saveKnowledgeFile.js por ser específica do formato de escrita vetorial,
 * e da busca vetorial — essa continua em searchKnowledge.js por usar
 * collectionGroup/findNearest, uma query bem diferente das daqui).
 *
 * Antes desse arquivo, `adminDb.collection("knowledgeFiles")` era retindado
 * em 6 arquivos diferentes — separar isso do resto da regra de negócio deixa
 * mais fácil testar sem Firestore de verdade e trocar a forma de guardar os
 * dados no futuro sem caçar cada lugar que monta a query.
 * @module server/knowledge/knowledgeFilesRepository
 */

import { adminDb } from "@/server/firebase/admin";
import { commitInBatches } from "@/server/firebase/commitInBatches";

const COLLECTION = "knowledgeFiles";

/** Referência direta ao documento — quem já tem isso pode continuar usando
 * `.get()`/`.set()`/`.collection()` nela normalmente, só a query pra chegar
 * até ela fica centralizada aqui. */
export function knowledgeFileRef(id) {
  return adminDb.collection(COLLECTION).doc(id);
}

/** @returns {Promise<{id: string, ref: FirebaseFirestore.DocumentReference, data: object} | null>} */
export async function getKnowledgeFile(id) {
  const snap = await knowledgeFileRef(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ref: snap.ref, data: snap.data() };
}

/** Todos os documentos da coleção, sem ordenação — usado por operações em
 * massa (verificar tudo, reindexar tudo) que já filtram/ordenam do jeito
 * delas em seguida. */
export async function listKnowledgeFileDocs() {
  const snapshot = await adminDb.collection(COLLECTION).get();
  return snapshot.docs;
}

/** Para a listagem do painel: mais recentes primeiro. */
export async function listKnowledgeFileDocsOrderedByUpload() {
  const snapshot = await adminDb.collection(COLLECTION).orderBy("uploadedAt", "desc").get();
  return snapshot.docs;
}

/** Acha o id do documento existente pra essa URL (dedup do saveKnowledgeUrl). */
export async function findKnowledgeFileIdByUrl(normalizedUrl) {
  const snapshot = await adminDb
    .collection(COLLECTION)
    .where("sourceUrl", "==", normalizedUrl)
    .limit(1)
    .get();
  return snapshot.empty ? null : snapshot.docs[0].id;
}

/** Merge parcial — equivalente a `fileRef.set(patch, { merge: true })`. */
export async function updateKnowledgeFile(id, patch) {
  await knowledgeFileRef(id).set(patch, { merge: true });
}

/** Apaga o documento e tudo que é dele (chunks, texto bruto), em lote. */
export async function deleteKnowledgeFileWithSubcollections(id) {
  const fileRef = knowledgeFileRef(id);
  const [chunksSnapshot, rawTextSnapshot] = await Promise.all([
    fileRef.collection("chunks").get(),
    fileRef.collection("rawText").get(),
  ]);

  const writeOperations = [];
  for (const chunkDoc of chunksSnapshot.docs) {
    writeOperations.push({ type: "delete", ref: chunkDoc.ref });
  }
  for (const rawDoc of rawTextSnapshot.docs) {
    writeOperations.push({ type: "delete", ref: rawDoc.ref });
  }
  writeOperations.push({ type: "delete", ref: fileRef });

  await commitInBatches(writeOperations);
}
