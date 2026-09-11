/**
 * @file Traduz os motivos técnicos de falha vindos de scrapePage/refreshUrls
 * (ex.: "http_404", "Todas as chaves de embedding estão em cooldown.") em
 * uma frase curta e amigável para exibir na UI. O motivo técnico completo
 * continua disponível para quem quiser abrir e ver na íntegra.
 * @module lib/knowledge/friendlyScrapeError
 */

const RULES = [
  {
    test: (r) => /quota exceeded|cooldown/i.test(r),
    friendly: "Não verificada — limite diário de geração de embeddings atingido.",
  },
  { test: (r) => /^http_404\b/.test(r), friendly: "Página não encontrada (removida do site)." },
  { test: (r) => /^http_410\b/.test(r), friendly: "Página não encontrada (removida do site)." },
  { test: (r) => /^http_403\b/.test(r), friendly: "Acesso bloqueado pelo site (403)." },
  { test: (r) => /^http_5\d\d\b/.test(r), friendly: "O site respondeu com erro do servidor." },
  { test: (r) => /^http_\d+\b/.test(r), friendly: "O site recusou o acesso à página." },
  { test: (r) => r === "timeout", friendly: "Tempo esgotado ao tentar acessar a página." },
  { test: (r) => /^erro_de_rede/.test(r), friendly: "Erro de conexão com o site." },
  { test: (r) => /^tipo_invalido/.test(r), friendly: "Tipo de conteúdo não suportado." },
  {
    test: (r) => /^(muito_grande|corpo_muito_grande)/.test(r),
    friendly: "Página grande demais para processar.",
  },
  {
    test: (r) => /^conteudo_curto/.test(r),
    friendly: "Conteúdo da página muito curto para indexar.",
  },
];

/**
 * @param {string} reason  motivo técnico bruto (pode ser undefined)
 * @returns {{friendly: string, raw: string}}
 */
export function friendlyScrapeError(reason) {
  const raw = reason || "motivo desconhecido";
  const rule = RULES.find(({ test }) => test(raw));
  return { friendly: rule?.friendly || "Não foi possível processar esta página.", raw };
}

/** Verdadeiro quando o motivo indica que a página em si sumiu do site (não é
 * cota, rede ou timeout — é conteúdo removido de verdade). */
export function isPageGoneReason(reason) {
  return /^http_404\b/.test(reason || "") || /^http_410\b/.test(reason || "");
}

/** Verdadeiro quando a "falha" não é sobre a página em si, mas sobre a nossa
 * cota de embeddings ter estourado — a página continua acessível, só não deu
 * pra processar agora. Não deveria contar como "inacessível". */
export function isQuotaReason(reason) {
  return /quota exceeded|cooldown/i.test(reason || "");
}
