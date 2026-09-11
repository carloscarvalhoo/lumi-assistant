/**
 * @file Cron de atualização: para cada documento de URL, decide se mudou (sitemap lastmod -> GET condicional -> hash) e reprocessa só o que mudou.
 * @module server/knowledge/refreshUrls
 */

import { adminDb } from "@/server/firebase/admin";
import { scrapePage } from "@/server/knowledge/scrapePage";
import { splitTextIntoChunks } from "@/server/pdf/chunkText";
import { persistKnowledgeDocument } from "@/server/knowledge/saveKnowledgeFile";
import { loadSitemapLastmod, normalizeSitemapUrl } from "@/server/knowledge/sitemap";
import { hashContent } from "@/server/utils/hash";
import { logger } from "@/server/utils/logger";

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Verifica se cada página indexada mudou e re-processa SÓ as que mudaram.
 *
 * Cascata de detecção (mais barata primeiro):
 *  1. `<lastmod>` do sitemap do site — se não for mais novo que a última
 *     verificação, nem baixa a página.
 *  2. Requisição condicional (If-None-Match / If-Modified-Since) — 304 = igual.
 *  3. Hash do conteúdo — comparação final.
 *
 * @param {{ onProgress?: (done: number, total: number, label?: string) => void, fileIds?: string[] }} [options]
 *   `fileIds` restringe a verificação a esses documentos; sem isso, verifica
 *   a base inteira (usado pelo cron — o clique manual no painel sempre exige
 *   uma seleção explícita).
 */
export async function refreshAllUrls({ onProgress, fileIds } = {}) {
  const snapshot = await adminDb.collection("knowledgeFiles").get();
  const idFilter = Array.isArray(fileIds) && fileIds.length ? new Set(fileIds) : null;
  const urlDocs = snapshot.docs.filter(
    (doc) => doc.data().sourceUrl && (!idFilter || idFilter.has(doc.id)),
  );

  const summary = {
    total: urlDocs.length,
    checked: 0,
    unchanged: 0,
    skippedBySitemap: 0,
    updated: 0,
    failed: [],
    changedTitles: [],
  };

  // Carrega o sitemap de cada origem uma vez só.
  const origins = [...new Set(urlDocs.map((d) => originOf(d.data().sourceUrl)).filter(Boolean))];
  const sitemaps = new Map();
  for (const origin of origins) {
    sitemaps.set(origin, await loadSitemapLastmod(origin));
  }

  for (let i = 0; i < urlDocs.length; i++) {
    const doc = urlDocs[i];
    const data = doc.data();
    const url = data.sourceUrl;
    const now = new Date();
    const lastChecked =
      toDate(data.lastCheckedAt) || toDate(data.updatedAt) || toDate(data.uploadedAt);

    try {
      const sitemap = sitemaps.get(originOf(url));
      const lastmod = sitemap?.get(normalizeSitemapUrl(url)) || null;

      // 1) Sitemap diz que não mudou desde a última checagem → pula sem baixar.
      if (lastmod && lastChecked && data.contentHash && lastmod <= lastChecked) {
        summary.skippedBySitemap += 1;
        summary.unchanged += 1;
        await doc.ref.set({ lastCheckedAt: now, lastCheckFailed: false }, { merge: true });
        onProgress?.(i + 1, urlDocs.length, url);
        continue;
      }

      // 2) + 3) Baixa (com requisição condicional) e compara hash.
      const scraped = await scrapePage(url, {
        etag: data.httpEtag || undefined,
        lastModified: data.httpLastModified || undefined,
      });
      summary.checked += 1;

      if (scraped.notModified) {
        summary.unchanged += 1;
        await doc.ref.set({ lastCheckedAt: now, lastCheckFailed: false }, { merge: true });
        onProgress?.(i + 1, urlDocs.length, url);
        continue;
      }

      if (!scraped.ok) {
        summary.failed.push({ fileId: doc.id, url, error: scraped.reason });
        await doc.ref.set(
          { lastCheckedAt: now, lastCheckFailed: true, lastCheckError: scraped.reason || null },
          { merge: true },
        );
        onProgress?.(i + 1, urlDocs.length, url);
        continue;
      }

      const newHash = hashContent(scraped.text);
      const hadHash = Boolean(data.contentHash);

      if (hadHash && newHash === data.contentHash) {
        summary.unchanged += 1;
        await doc.ref.set(
          {
            lastCheckedAt: now,
            lastCheckFailed: false,
            httpEtag: scraped.etag || data.httpEtag || null,
            httpLastModified: scraped.lastModified || data.httpLastModified || null,
          },
          { merge: true },
        );
        onProgress?.(i + 1, urlDocs.length, url);
        continue;
      }

      // Mudou (ou nunca teve hash) → reprocessa.
      const chunks = splitTextIntoChunks(scraped.text);
      await persistKnowledgeDocument({
        fileId: doc.id,
        originalName: scraped.title || data.originalName || url,
        safeName: data.safeName || "link-site",
        meta: {
          contentType: "text/html-url",
          sourceUrl: url,
          size: scraped.text.length,
          totalPages: 1,
          uploadedAt: data.uploadedAt,
          lastCheckedAt: now,
          lastCheckFailed: false,
          httpEtag: scraped.etag || null,
          httpLastModified: scraped.lastModified || null,
          sourceUpdatedAt: lastmod || now,
          contentChangedAt: hadHash ? now : data.contentChangedAt || null,
          needsReview: hadHash, // marca revisão só se REALMENTE mudou
        },
        extractedText: scraped.text,
        chunks,
      });

      summary.updated += 1;
      if (hadHash) summary.changedTitles.push(scraped.title || url);
      logger.info(`♻️ refresh: "${scraped.title || url}" mudou — reprocessado`);
    } catch (error) {
      summary.failed.push({ fileId: doc.id, url, error: error?.message });
      logger.warn(`⚠️ refresh falhou em ${url}: ${error?.message}`);
      // Sem isso o documento fica com o estado antigo (ou "em dia" indevido)
      // quando a página foi baixada com sucesso mas o passo seguinte (embedding,
      // por exemplo) falhou — como quando a cota/cooldown de embedding estoura.
      try {
        await doc.ref.set(
          { lastCheckedAt: now, lastCheckFailed: true, lastCheckError: error?.message || null },
          { merge: true },
        );
      } catch {
        // Se nem isso funcionar (Firestore fora do ar), segue sem travar o resto do loop.
      }
    }

    onProgress?.(i + 1, urlDocs.length, url);
  }

  logger.info(
    `♻️ refresh: ${summary.unchanged} iguais (${summary.skippedBySitemap} pelo sitemap), ` +
      `${summary.updated} atualizadas, ${summary.failed.length} falhas`,
  );

  return summary;
}
