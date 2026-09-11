/**
 * @file Funções puras de leitura/formatação usadas pela lista de arquivos da
 * base de conhecimento — nenhuma depende de estado de componente, então
 * ficam fora do KnowledgeFileList (que só orquestra estado + renderização).
 * @module components/admin/knowledge-file-list/helpers
 */

export function getFileKey(file) {
  return (
    file?.id ||
    file?.docId ||
    file?._id ||
    file?.path ||
    file?.storagePath ||
    file?.url ||
    file?.sourceUrl ||
    file?.siteUrl ||
    file?.link ||
    file?.originalName
  );
}

export function getFileUrl(file) {
  return file?.url || file?.sourceUrl || file?.siteUrl || file?.link || "";
}

export function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url || "site-sem-dominio";
  }
}

export function getPathFromUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.pathname || "/";
  } catch {
    return url;
  }
}

export function isPdfFile(file) {
  const name = (file?.originalName || file?.fileName || file?.name || "").toLowerCase();

  const type = (
    file?.type ||
    file?.mimeType ||
    file?.contentType ||
    file?.sourceType ||
    ""
  ).toLowerCase();

  return name.endsWith(".pdf") || type.includes("pdf") || type.includes("application/pdf");
}

export function isSiteFile(file) {
  const sourceType = (file?.sourceType || file?.type || file?.kind || "").toLowerCase();

  const url = getFileUrl(file);

  if (isPdfFile(file)) return false;

  return (
    sourceType.includes("url") ||
    sourceType.includes("site") ||
    sourceType.includes("link") ||
    sourceType.includes("web") ||
    Boolean(url)
  );
}

export function getFileName(file) {
  const url = getFileUrl(file);

  if (isSiteFile(file) && url) {
    return file?.title || getPathFromUrl(url) || getDomainFromUrl(url);
  }

  return file?.originalName || file?.fileName || file?.name || file?.title || "Arquivo sem nome";
}

export function formatFileSize(bytes) {
  const size = Number(bytes);

  if (!size || Number.isNaN(size)) return "";

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value = value / 1024;
    unitIndex++;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export function getDateObject(value) {
  if (!value) return null;

  let date;

  if (typeof value?.toDate === "function") {
    date = value.toDate();
  } else if (value?.seconds) {
    date = new Date(value.seconds * 1000);
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

export function formatDate(value) {
  const date = getDateObject(value);

  if (!date) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getIndexedDate(file) {
  // updatedAt/lastCheckedAt refletem o processamento mais recente (reindex,
  // verificação de atualização); uploadedAt fica congelado na data original
  // de quando o documento foi adicionado pela primeira vez.
  return (
    file?.updatedAt || file?.lastCheckedAt || file?.createdAt || file?.indexedAt || file?.uploadedAt
  );
}

export function getPageCount(file) {
  return file?.pageCount || file?.pages || file?.totalPages || file?.metadata?.pageCount || 0;
}

export function getPdfDetails(file) {
  const details = [];

  const size = formatFileSize(
    file?.size || file?.fileSize || file?.sizeBytes || file?.metadata?.size,
  );

  const pages = getPageCount(file);
  const createdAt = formatDate(getIndexedDate(file));

  if (size) details.push(`Tamanho: ${size}`);
  if (pages) details.push(`${pages} página(s)`);
  if (createdAt) details.push(`Enviado em ${createdAt}`);

  return details;
}

export function getSiteDetails(file) {
  const details = [];

  const indexedAt = formatDate(getIndexedDate(file));

  if (indexedAt) details.push(`Indexado em ${indexedAt}`);

  return details;
}
