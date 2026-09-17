/**
 * @file Extração de texto de arquivos .docx (Word 2007+).
 * @module server/pdf/parseDocx
 */

import mammoth from "mammoth";
import { normalizeText } from "@/server/pdf/chunkText";

export async function parseDocxBuffer(buffer) {
  const { value } = await mammoth.extractRawText({ buffer });

  return {
    text: normalizeText(value),
  };
}
