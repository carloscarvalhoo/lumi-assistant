import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/server/auth/checkAdminAccess";
import { refreshAllUrls } from "@/server/knowledge/refreshUrls";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request) {
  const authError = await checkAdminAccess();
  if (authError) return authError;

  try {
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

    const summary = await refreshAllUrls({ fileIds });
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    logger.error("Erro ao verificar atualizações das URLs:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao verificar atualizações." },
      { status: 500 },
    );
  }
}
