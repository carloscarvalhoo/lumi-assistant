/**
 * @file Baixa e limpa o texto de uma página HTML, com timeout, limite de tamanho e suporte a GET condicional (ETag / If-Modified-Since).
 * @module server/knowledge/scrapePage
 */

import * as cheerio from "cheerio";
import { logger } from "@/server/utils/logger";

const FETCH_TIMEOUT_MS = Number(process.env.SCRAPE_TIMEOUT_MS) || 15000;
const MAX_HTML_BYTES = Number(process.env.SCRAPE_MAX_BYTES) || 3_000_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 ChatbotIFPR/1.0";

/**
 * Baixa e limpa o texto de uma página.
 *
 * @param {string} url
 * @param {object} [conditional] Se informado, envia If-None-Match /
 *   If-Modified-Since. Uma resposta 304 devolve `{ notModified: true }` sem
 *   baixar o corpo.
 * @param {string} [conditional.etag]
 * @param {string} [conditional.lastModified]
 * @returns {Promise<
 *   | { ok: false, reason: string }
 *   | { ok: true, notModified: true }
 *   | { ok: true, title: string, text: string, etag: (string|null), lastModified: (string|null) }
 * >}
 *   `reason` diz exatamente por que falhou (ex: "http_403", "timeout",
 *   "network_error: ENOTFOUND ...") — importante pra diagnosticar bloqueios
 *   de rede/WAF em produção, onde não dá pra simplesmente testar de novo.
 */
export async function scrapePage(url, conditional = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  function fail(reason) {
    logger.warn(`⚠️ scrape: ${url} falhou (${reason})`);
    return { ok: false, reason };
  }

  try {
    const headers = { "User-Agent": USER_AGENT, Accept: "text/html" };
    if (conditional.etag) headers["If-None-Match"] = conditional.etag;
    if (conditional.lastModified) headers["If-Modified-Since"] = conditional.lastModified;

    const response = await fetch(url, {
      headers,
      signal: controller.signal,
      redirect: "follow",
    });

    if (response.status === 304) {
      return { ok: true, notModified: true };
    }

    if (!response.ok) {
      return fail(`http_${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("html") && !contentType.includes("text")) {
      return fail(`tipo_invalido: ${contentType || "desconhecido"}`);
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength && contentLength > MAX_HTML_BYTES) {
      return fail(`muito_grande: ${contentLength} bytes`);
    }

    const html = await response.text();
    if (html.length > MAX_HTML_BYTES) {
      return fail(`corpo_muito_grande: ${html.length} bytes`);
    }

    const $ = cheerio.load(html);
    const title = $("title").first().text().trim() || "Página Web";

    // Links pra PDF (editais, formulários, portarias...) — coletados ANTES de
    // remover nav/menu/sidebar, porque é comum esse tipo de documento estar
    // linkado justamente num menu lateral, não no corpo do texto.
    const pdfLinks = new Set();
    $('a[href$=".pdf"], a[href*=".pdf?"], a[href*=".pdf#"]').each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      try {
        pdfLinks.add(new URL(href, url).href);
      } catch {
        // Ignora link inválido
      }
    });

    $(
      "script, style, nav, footer, header, iframe, noscript, .menu, #sidebar, [role=navigation]",
    ).remove();

    const text = $("main, article, #content, .content, body")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();

    if (text.length < 50) {
      return fail(`conteudo_curto: ${text.length} chars`);
    }

    return {
      ok: true,
      title,
      text,
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      pdfLinks: [...pdfLinks],
    };
  } catch (error) {
    const reason =
      error?.name === "AbortError"
        ? "timeout"
        : `erro_de_rede: ${error?.cause?.code || error?.code || error?.message || "desconhecido"}`;
    return fail(reason);
  } finally {
    clearTimeout(timer);
  }
}
