import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/server/auth/checkAdminAccess";
import { refreshAllUrls } from "@/server/knowledge/refreshUrls";
import { createProgressStream, SSE_HEADERS } from "@/server/utils/sse";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request) {
  const authError = await checkAdminAccess();
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const fileIds = Array.isArray(body?.fileIds) ? body.fileIds.filter(Boolean) : [];

  // O clique manual no painel sempre exige seleção — evita disparar sem
  // querer uma verificação cara (138 páginas) na base inteira. O cron
  // automático (rota separada) continua processando tudo.
  if (!fileIds.length) {
    return NextResponse.json(
      { error: "Selecione pelo menos uma fonte antes de verificar." },
      { status: 400 },
    );
  }

  // Streaming SSE: o painel mostra progresso em tempo real ("42 de 138 —
  // ifpr.edu.br/cursos") em vez de um spinner genérico até a resposta
  // inteira (que pode levar minutos) voltar de uma vez.
  const stream = createProgressStream(async (onProgress) => {
    try {
      const summary = await refreshAllUrls({
        fileIds,
        onProgress: (done, total, label) => onProgress({ done, total, label }),
      });
      return { success: true, ...summary };
    } catch (error) {
      logger.error("Erro ao verificar atualizações das URLs:", error);
      throw error;
    }
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
