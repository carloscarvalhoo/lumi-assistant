import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/server/auth/checkAdminAccess";
import { saveKnowledgeUrl } from "@/server/knowledge/saveKnowledgeUrl";
import { scrapePage } from "@/server/knowledge/scrapePage";
import { saveKnowledgeDocumentLinks } from "@/server/knowledge/saveKnowledgeDocumentLink";
import { createProgressStream, SSE_HEADERS } from "@/server/utils/sse";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Indexar centenas de páginas em paralelo ainda leva minutos; sem isso corta
// no timeout padrão da Vercel bem antes de terminar.
export const maxDuration = 300;

// A maior parte do tempo de cada página é espera de rede (baixar a página,
// esperar o Gemini responder o embedding), não CPU — processar várias em
// paralelo encurta bastante o tempo total sem multiplicar as requisições.
const CONCURRENCY = Number(process.env.INDEX_URLS_CONCURRENCY) || 5;

export async function POST(request) {
  const authError = await checkAdminAccess();
  if (authError) return authError;

  const { urlsSelecionadas } = await request.json();

  if (!Array.isArray(urlsSelecionadas) || urlsSelecionadas.length === 0) {
    return NextResponse.json(
      { error: "Nenhuma URL fornecida para processamento." },
      { status: 400 },
    );
  }

  // Streaming SSE — mesmo motivo do /api/admin/refresh-urls: progresso em
  // tempo real em vez de um spinner genérico até a resposta inteira (minutos
  // pra centenas de páginas) voltar de uma vez.
  const stream = createProgressStream(async (onProgress) => {
    let processed = 0;
    let pdfsProcessed = 0;
    const skipped = [];
    const pdfsSkipped = [];
    // O mesmo documento (PPP, mapa do site etc) costuma estar linkado em
    // várias páginas selecionadas — processa cada URL só uma vez na rodada.
    const documentResultCache = new Map();

    async function processarUrl(url) {
      logger.debug(`🤖 Processando: ${url}`);
      const scraped = await scrapePage(url);
      if (!scraped.ok) {
        return { ok: false, url, reason: scraped.reason };
      }

      await saveKnowledgeUrl(scraped.title, url, scraped.text);

      let pdfsOk = 0;
      const pdfsFailed = [];
      // Editais, formulários, portarias etc linkados na página (PDF ou
      // .docx) — baixa e indexa cada um como documento próprio, igual o
      // upload manual de arquivo.
      if (scraped.documentLinks?.length) {
        const pdfResult = await saveKnowledgeDocumentLinks(scraped.documentLinks, {
          resultCache: documentResultCache,
        });
        pdfsOk = pdfResult.ok;
        pdfsFailed.push(...pdfResult.failed);
      }
      return { ok: true, url, pdfsOk, pdfsFailed };
    }

    const total = urlsSelecionadas.length;
    let concluidas = 0;

    for (let i = 0; i < urlsSelecionadas.length; i += CONCURRENCY) {
      const lote = urlsSelecionadas.slice(i, i + CONCURRENCY);
      const resultados = await Promise.all(
        lote.map((url) =>
          processarUrl(url).catch((error) => ({
            ok: false,
            url,
            reason: error?.message || "erro desconhecido",
          })),
        ),
      );

      for (const resultado of resultados) {
        concluidas += 1;
        if (!resultado.ok) {
          skipped.push({ url: resultado.url, reason: resultado.reason });
        } else {
          processed += 1;
          pdfsProcessed += resultado.pdfsOk;
          pdfsSkipped.push(...resultado.pdfsFailed);
        }
        onProgress({ done: concluidas, total, label: resultado.url });
      }
    }

    const pdfMsg = pdfsProcessed
      ? ` ${pdfsProcessed} documento(s) linkado(s) também indexado(s).`
      : "";

    return {
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
    };
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
