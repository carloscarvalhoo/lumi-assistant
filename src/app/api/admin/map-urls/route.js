import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { checkAdminAccess } from "@/server/auth/checkAdminAccess";
import { loadSitemapUrls } from "@/server/knowledge/sitemap";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Percorrer o sitemap de um site grande (índice -> vários sitemaps filhos)
// pode levar um tempo; sem isso a função corta no timeout padrão da Vercel.
export const maxDuration = 60;

// Teto de segurança pra não devolver um site gigante inteiro de uma vez pro
// painel (a lista de checkboxes ficaria inviável de navegar).
const MAX_URLS = 500;

export async function POST(request) {
  const authError = await checkAdminAccess();
  if (authError) return authError;

  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: "A URL é obrigatória." }, { status: 400 });

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      Number(process.env.SCRAPE_TIMEOUT_MS) || 15000,
    );

    let response;
    try {
      response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timer);
      const reason =
        fetchError?.name === "AbortError"
          ? "tempo esgotado"
          : fetchError?.cause?.code || fetchError?.code || fetchError?.message || "erro de rede";
      return NextResponse.json(
        { error: `Não foi possível acessar ${url} (${reason}).` },
        { status: 502 },
      );
    }
    clearTimeout(timer);

    if (!response.ok) {
      return NextResponse.json(
        { error: `${url} respondeu HTTP ${response.status}.` },
        { status: 502 },
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const urlOriginal = new URL(url);

    const urlsEncontradas = new Set();
    urlsEncontradas.add(urlOriginal.href);

    // Se a URL colada tiver um caminho (ex: ifpr.edu.br/ivaipora/), restringe
    // o mapeamento a esse caminho — sem isso, sites grandes (rede inteira do
    // IFPR, por exemplo) devolveriam o sitemap inteiro em vez de só o campus
    // que a pessoa quis mapear.
    const basePath =
      urlOriginal.pathname === "/" ? "/" : `${urlOriginal.pathname.replace(/\/$/, "")}/`;

    function ehMesmoDominioEValido(urlAbsoluta) {
      const mesmoDominio = urlAbsoluta.origin === urlOriginal.origin;
      const ehArquivo = /\.(pdf|jpg|jpeg|png|zip|gif|doc|docx)$/i.test(urlAbsoluta.pathname);
      if (!mesmoDominio || ehArquivo) return false;
      if (basePath === "/") return true;
      const path = urlAbsoluta.pathname.endsWith("/")
        ? urlAbsoluta.pathname
        : `${urlAbsoluta.pathname}/`;
      return path.startsWith(basePath);
    }

    // Coleta os links válidos do HTML da página em si (funciona bem em sites
    // simples, mas fica cego quando o menu de navegação é montado via JS).
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (href) {
        try {
          const urlAbsoluta = new URL(href, urlOriginal.origin);
          if (ehMesmoDominioEValido(urlAbsoluta)) {
            // Remove a barra final para evitar duplicatas (ex: site.com/ e site.com)
            urlsEncontradas.add(urlAbsoluta.href.replace(/\/$/, ""));
          }
        } catch {
          // Ignora links inválidos
        }
      }
    });

    // Complementa com o sitemap.xml do site — é o jeito confiável de mapear
    // o site inteiro, já que não depende do HTML expor os links (menus
    // montados via JS não aparecem no fetch acima).
    try {
      const sitemapUrls = await loadSitemapUrls(urlOriginal.origin);
      for (const loc of sitemapUrls) {
        try {
          const urlAbsoluta = new URL(loc);
          if (ehMesmoDominioEValido(urlAbsoluta)) {
            urlsEncontradas.add(urlAbsoluta.href.replace(/\/$/, ""));
          }
        } catch {
          // Ignora entradas de sitemap com URL inválida
        }
      }
    } catch (error) {
      logger.warn(`⚠️ Falha ao ler sitemap de ${urlOriginal.origin}: ${error?.message}`);
      // Sem sitemap, segue só com o que achou no HTML da própria página.
    }

    const urls = Array.from(urlsEncontradas).slice(0, MAX_URLS);

    return NextResponse.json({
      success: true,
      urls,
      truncated: urlsEncontradas.size > MAX_URLS,
      total: urlsEncontradas.size,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao mapear o site." }, { status: 500 });
  }
}
