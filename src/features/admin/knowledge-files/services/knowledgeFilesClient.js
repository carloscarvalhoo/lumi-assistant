export async function getKnowledgeFiles() {
  const response = await fetch("/api/admin/files", {
    method: "GET",
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Erro ao listar arquivos.");
  }

  return data.files || [];
}

export async function uploadKnowledgeFile(file, onProgress) {
  if (!file) {
    throw new Error("Nenhum arquivo selecionado.");
  }

  const fileName = file.name || "";

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    throw new Error("Formato inválido. Envie apenas arquivos PDF.");
  }

  const formData = new FormData();
  formData.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", "/api/admin/files");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === "function") {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}");

        if (xhr.status >= 200 && xhr.status < 300) {
          if (typeof onProgress === "function") {
            onProgress(100);
          }

          resolve(data);
          return;
        }

        reject(new Error(data?.error || "Erro ao enviar PDF."));
      } catch {
        reject(new Error("Erro ao processar resposta do servidor."));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Erro de conexão ao enviar PDF."));
    };

    xhr.send(formData);
  });
}

export async function deleteKnowledgeFile(fileDoc) {
  if (!fileDoc?.id) {
    throw new Error("Documento inválido.");
  }

  const response = await fetch("/api/admin/files", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: fileDoc.id,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Erro ao remover arquivo.");
  }

  return data;
}

export async function patchKnowledgeFile(id, payload) {
  const response = await fetch("/api/admin/files", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...payload }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || "Erro ao atualizar documento.");
  }

  return data;
}

/**
 * Lê uma resposta SSE (event: .../data: {...}\n\n) chamando `onProgress` a
 * cada evento "progress" e resolvendo com o payload do evento "done" (ou
 * rejeitando com o do "error"). Usado por reindexAllFiles/refreshUrls, que
 * levam minutos e agora mostram progresso em tempo real em vez de esperar a
 * resposta inteira de uma vez.
 */
async function readProgressStream(response, onProgress) {
  if (!response.body) {
    // Fallback (ex.: ambiente sem streaming) — tenta ler como JSON comum.
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || "Erro na requisição.");
    return data;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIndex;
    while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);

      const eventLine = rawEvent.split("\n").find((l) => l.startsWith("event:"));
      const dataLine = rawEvent.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;

      const type = eventLine?.slice(6).trim() || "message";
      let payload;
      try {
        payload = JSON.parse(dataLine.slice(5).trim());
      } catch {
        continue;
      }

      if (type === "progress") {
        onProgress?.(payload);
      } else if (type === "error") {
        throw new Error(payload?.message || "Erro na requisição.");
      } else if (type === "done") {
        return payload;
      }
    }
  }

  throw new Error("Conexão encerrada antes de concluir.");
}

export async function reindexAllFiles(fileIds, onProgress) {
  const response = await fetch("/api/admin/reindex", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileIds }),
  });

  if (!response.ok && response.headers.get("content-type")?.includes("application/json")) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || "Erro ao reindexar.");
  }

  return readProgressStream(response, onProgress);
}

export async function refreshUrls(fileIds, onProgress) {
  const response = await fetch("/api/admin/refresh-urls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileIds }),
  });

  if (!response.ok && response.headers.get("content-type")?.includes("application/json")) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || "Erro ao verificar atualizações.");
  }

  return readProgressStream(response, onProgress);
}

export async function logoutAdmin() {
  const response = await fetch("/api/admin/logout", {
    method: "POST",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Erro ao sair.");
  }

  return data;
}

/* ==========================================================================
   NOVA FUNÇÃO: INDEXAR URL / LINKS
   ========================================================================== */
// Dentro do seu arquivo de serviços (knowledgeFilesClient.js)
export async function indexKnowledgeUrl(urlsSelecionadas) {
  const response = await fetch("/api/admin/urls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // O backend agora espera a chave 'urlsSelecionadas'
    body: JSON.stringify({ urlsSelecionadas }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Erro ao processar URLs");
  }

  return data;
}
