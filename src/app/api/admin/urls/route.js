import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/server/auth/checkAdminAccess";
import { saveKnowledgeUrl } from "@/server/knowledge/saveKnowledgeUrl";
import { scrapePage } from "@/server/knowledge/scrapePage";
import { saveKnowledgePdfLinks } from "@/server/knowledge/saveKnowledgePdfLink";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const authError = await checkAdminAccess();
  if (authError) return authError;

  try {
    const { urlsSelecionadas } = await request.json();

    if (!Array.isArray(urlsSelecionadas) || urlsSelecionadas.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma URL fornecida para processamento." },
        { status: 400 },
      );
    }

    let processed = 0;
    let pdfsProcessed = 0;
    const skipped = [];
    const pdfsSkipped = [];

    for (const url of urlsSelecionadas) {
      logger.debug(`🤖 Processando: ${url}`);
      const scraped = await scrapePage(url);

      if (!scraped.ok) {
        skipped.push({ url, reason: scraped.reason });
        continue;
      }

      await saveKnowledgeUrl(scraped.title, url, scraped.text);
      processed += 1;

      // Editais, formulários, portarias etc linkados na página — baixa e
      // indexa cada um como documento próprio, igual o upload manual de PDF.
      if (scraped.pdfLinks?.length) {
        const pdfResult = await saveKnowledgePdfLinks(scraped.pdfLinks);
        pdfsProcessed += pdfResult.ok;
        pdfsSkipped.push(...pdfResult.failed);
      }
    }

    const pdfMsg = pdfsProcessed ? ` ${pdfsProcessed} PDF(s) linkado(s) também indexado(s).` : "";

    return NextResponse.json({
      success: true,
      message: `${processed} página(s) indexada(s).${
        skipped.length
          ? ` ${skipped.length} ignorada(s) (${skipped[0].reason || "inacessível ou vazia"}).`
          : ""
      }${pdfMsg}`,
      processed,
      skipped,
      pdfsProcessed,
      pdfsSkipped,
    });
  } catch (error) {
    logger.error("Erro no processamento das URLs:", error);
    return NextResponse.json({ error: "Erro interno ao indexar as URLs." }, { status: 500 });
  }
}
