/**
 * @file Apaga um documento da base e tudo que é dele (chunks, texto bruto).
 * @module server/knowledge/deleteKnowledgeFile
 */

import { deleteKnowledgeFileWithSubcollections } from "@/server/knowledge/knowledgeFilesRepository";
import { createHttpError } from "@/server/utils/errors";

export async function deleteKnowledgeFile(id) {
  if (!id) {
    throw createHttpError("ID do arquivo não informado.", 400);
  }

  await deleteKnowledgeFileWithSubcollections(id);

  return {
    success: true,
    message: "Arquivo removido com sucesso.",
  };
}
