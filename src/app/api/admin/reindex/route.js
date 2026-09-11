import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/server/auth/checkAdminAccess";
import { reprocessAllKnowledgeFiles } from "@/server/knowledge/reprocessKnowledgeFile";
import { createProgressStream, SSE_HEADERS } from "@/server/utils/sse";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Reprocessamento é lento (embeddings em lote por documento). Em produção,
// rodar via script/CLI; em dev o timeout maior dá conta.
export const maxDuration = 300;

export async function POST(request) {
  const authError = await checkAdminAccess();
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const fileIds = Array.isArray(body?.fileIds) ? body.fileIds.filter(Boolean) : [];

  // Exige seleção no clique manual — reindexar tudo sem querer consome
  // muita cota de embedding e demora minutos.
  if (!fileIds.length) {
    return NextResponse.json(
      { error: "Selecione pelo menos uma fonte antes de reindexar." },
      { status: 400 },
    );
  }

  // Streaming SSE — mesmo motivo do /api/admin/refresh-urls: progresso em
  // tempo real em vez de esperar a resposta inteira (minutos) de uma vez.
  const stream = createProgressStream(async (onProgress) => {
    try {
      const summary = await reprocessAllKnowledgeFiles({
        fileIds,
        onProgress: (done, total, label) => onProgress({ done, total, label }),
      });
      return { success: true, ...summary };
    } catch (error) {
      logger.error("Erro no reindex:", error);
      throw error;
    }
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
