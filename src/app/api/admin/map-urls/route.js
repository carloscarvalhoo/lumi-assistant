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
const MAX_URLS = Number(process.env.MAP_MAX_URLS) || 2000;

// Alguns sites (o IFPR, por exemplo) têm sitemap.xml que NÃO cobre certas
// seções (subsites de campus). Nesses casos, uma página "hub" descoberta no
// menu (ex: /sepae/) pode ter links pros programas específicos dela que só
// existem no HTML da própria página hub, não na página raiz nem no sitemap.
// Por isso o crawl entra em CADA página nova que descobre (busca em
// largura), não só na raiz — até este teto total de páginas VISITADAS (não
// de URLs encontradas), que existe só pra nunca rodar pra sempre caso
// alguém mapeie um domínio inteiro por engano.
const MAX_CRAWL_PAGES = Number(process.env.MAP_MAX_CRAWL_PAGES) || 2000;
const CRAWL_CONCURRENCY = 8;

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
    urlsEncontradas.add(urlOriginal.href.replace(/\/$/, ""));

    // Se a URL colada tiver um caminho (ex: ifpr.edu.br/ivaipora/), restringe
    // o mapeamento a esse caminho — sem isso, sites grandes (rede inteira do
    // IFPR, por exemplo) devolveriam o sitemap inteiro em vez de só o campus
    // que a pessoa quis mapear.
    const basePath =
      urlOriginal.pathname === "/" ? "/" : `${urlOriginal.pathname.replace(/\/$/, "")}/`;

    function ehMesmoDominioEValido(urlAbsoluta) {
      const mesmoDominio = urlAbsoluta.origin === urlOriginal.origin;
      const ehArquivo = /\.(pdf|jpg|jpeg|png|zip|gif|doc|docx)$/i.test(urlAbsoluta.pathname);
      // Paginação de listagem (blog, categoria etc.) não é conteúdo em si, só
      // um índice pras páginas 2, 3... 101 de novidades — os posts de verdade
      // já são descobertos direto (link próprio ou sitemap), então essas
      // páginas de índice só duplicam trabalho sem agregar conteúdo.
      const ehPaginacao = /\/page\/\d+\/?$/i.test(urlAbsoluta.pathname);
      if (!mesmoDominio || ehArquivo || ehPaginacao) return false;
      if (basePath === "/") return true;
      const path = urlAbsoluta.pathname.endsWith("/")
        ? urlAbsoluta.pathname
        : `${urlAbsoluta.pathname}/`;
      return path.startsWith(basePath);
    }

    // Normaliza pra evitar duplicata: "/pagina#topo" e "/pagina" são a MESMA
    // URL pro nosso propósito (a âncora só rola a tela, não muda conteúdo).
    function normalizarUrl(urlAbsoluta) {
      urlAbsoluta.hash = "";
      return urlAbsoluta.href.replace(/\/$/, "");
    }

    // Coleta os links válidos do HTML da página em si (funciona bem em sites
    // simples, mas fica cego quando o menu de navegação é montado via JS).
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (href) {
        try {
          const urlAbsoluta = new URL(href, urlOriginal.origin);
          if (ehMesmoDominioEValido(urlAbsoluta)) {
            urlsEncontradas.add(normalizarUrl(urlAbsoluta));
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
            urlsEncontradas.add(normalizarUrl(urlAbsoluta));
          }
        } catch {
          // Ignora entradas de sitemap com URL inválida
        }
      }
    } catch (error) {
      logger.warn(`⚠️ Falha ao ler sitemap de ${urlOriginal.origin}: ${error?.message}`);
      // Sem sitemap, segue só com o que achou no HTML da própria página.
    }

    async function coletarLinksDe(pageUrl) {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), Number(process.env.SCRAPE_TIMEOUT_MS) || 15000);
      try {
        const res = await fetch(pageUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
          signal: ctl.signal,
        });
        if (!res.ok) return [];
        const $$ = cheerio.load(await res.text());
        const encontrados = [];
        $$("a[href]").each((_, el) => {
          const href = $$(el).attr("href");
          if (!href) return;
          try {
            const urlAbsoluta = new URL(href, pageUrl);
            if (ehMesmoDominioEValido(urlAbsoluta)) {
              encontrados.push(normalizarUrl(urlAbsoluta));
            }
          } catch {
            // Ignora link inválido
          }
        });
        return encontrados;
      } catch {
        return [];
      } finally {
        clearTimeout(t);
      }
    }

    // Busca em largura de verdade: entra em cada página nova que encontra, e
    // nos links que ELA traz, e assim por diante — não só um nível fixo.
    // Só para quando a fila esvazia (achou tudo que dava pra achar dentro do
    // domínio/caminho) ou quando bate o teto de páginas VISITADAS.
    const urlRaizNormalizada = urlOriginal.href.replace(/\/$/, "");
    const jaVisitadas = new Set([urlRaizNormalizada]);
    let filaParaVisitar = Array.from(urlsEncontradas).filter((u) => u !== urlRaizNormalizada);
    let visitadas = 0;

    while (filaParaVisitar.length && visitadas < MAX_CRAWL_PAGES) {
      const lote = [];
      while (lote.length < CRAWL_CONCURRENCY && filaParaVisitar.length) {
        const proxima = filaParaVisitar.shift();
        if (jaVisitadas.has(proxima)) continue;
        jaVisitadas.add(proxima);
        lote.push(proxima);
      }
      if (!lote.length) break;
      visitadas += lote.length;

      const resultados = await Promise.all(lote.map(coletarLinksDe));
      for (const links of resultados) {
        for (const link of links) {
          if (!urlsEncontradas.has(link)) {
            urlsEncontradas.add(link);
            filaParaVisitar.push(link);
          }
        }
      }
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
