"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { isQuotaReason } from "@/lib/knowledge/friendlyScrapeError";
import {
  deleteKnowledgeFile,
  getKnowledgeFiles,
  uploadKnowledgeFile,
  indexKnowledgeUrl,
  patchKnowledgeFile,
  reindexAllFiles,
  refreshUrls,
} from "@/features/admin/knowledge-files/services/knowledgeFilesClient";

export function useKnowledgeFiles() {
  const router = useRouter();
  const confirm = useConfirm();

  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [reindexingLabel, setReindexingLabel] = useState("");
  const [progress, setProgress] = useState(0);
  const [bulkProgress, setBulkProgress] = useState(null);
  const [urlProgress, setUrlProgress] = useState(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [refreshResult, setRefreshResult] = useState(null);

  async function loadFiles() {
    try {
      setLoadingFiles(true);
      setError("");
      setFiles(await getKnowledgeFiles());
    } catch (err) {
      if (err?.message?.includes("autorizado")) {
        router.push("/admin/login");
        return;
      }
      setError(err?.message || "Erro ao carregar arquivos.");
    } finally {
      setLoadingFiles(false);
    }
  }

  async function uploadFile(file) {
    setUploading(true);
    setProgress(0);
    setError("");
    setSuccessMessage("");
    try {
      await uploadKnowledgeFile(file, setProgress);
      setSuccessMessage("PDF processado e salvo.");
      await loadFiles();
    } catch (err) {
      setError(err?.message || "Erro ao enviar arquivo.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function uploadUrl(urls) {
    setUploading(true);
    setUrlProgress({ done: 0, total: urls.length, label: "" });
    setError("");
    setSuccessMessage("");
    try {
      const result = await indexKnowledgeUrl(urls, setUrlProgress);
      setSuccessMessage(result?.message || `${urls.length} página(s) indexada(s).`);
      await loadFiles();
      return true;
    } catch (err) {
      setError(err?.message || "Erro ao indexar as URLs.");
      return false;
    } finally {
      setUploading(false);
      setUrlProgress(null);
    }
  }

  async function removeFile(fileDoc) {
    const name = fileDoc?.originalName || fileDoc?.url || "esta fonte";
    const ok = await confirm({
      title: "Apagar fonte",
      message: `"${name}" será removida da base de conhecimento.`,
      confirmLabel: "Apagar",
      danger: true,
    });
    if (!ok) return false;

    setError("");
    setSuccessMessage("");
    try {
      await deleteKnowledgeFile(fileDoc);
      setSuccessMessage("Fonte removida.");
      await loadFiles();
      return true;
    } catch (err) {
      setError(err?.message || "Erro ao remover.");
      return false;
    }
  }

  async function removeManyFiles(fileDocs) {
    if (!fileDocs?.length) return false;
    const ok = await confirm({
      title: "Apagar selecionadas",
      message: `${fileDocs.length} fonte(s) serão removidas da base.`,
      confirmLabel: "Apagar",
      danger: true,
    });
    if (!ok) return false;

    setError("");
    setSuccessMessage("");
    try {
      await Promise.all(fileDocs.map(deleteKnowledgeFile));
      setSuccessMessage("Fontes removidas.");
      await loadFiles();
      return true;
    } catch (err) {
      setError(err?.message || "Erro ao remover.");
      return false;
    }
  }

  async function markReviewed(fileId) {
    if (!fileId) return false;
    setError("");
    setSuccessMessage("");
    try {
      await patchKnowledgeFile(fileId, { action: "review" });
      setSuccessMessage("Marcado como revisado.");
      await loadFiles();
      return true;
    } catch (err) {
      setError(err?.message || "Erro ao marcar revisão.");
      return false;
    }
  }

  async function reprocessFile(fileId) {
    if (!fileId) return false;
    const ok = await confirm({
      title: "Reprocessar",
      message: "O documento será re-fragmentado e os embeddings refeitos.",
      confirmLabel: "Reprocessar",
    });
    if (!ok) return false;

    setReindexing(true);
    setReindexingLabel("Reprocessando documento");
    setError("");
    setSuccessMessage("");
    try {
      await patchKnowledgeFile(fileId, { action: "reprocess" });
      setSuccessMessage("Documento reprocessado.");
      await loadFiles();
      return true;
    } catch (err) {
      setError(err?.message || "Erro ao reprocessar.");
      return false;
    } finally {
      setReindexing(false);
      setReindexingLabel("");
    }
  }

  /** As duas ações abaixo exigem uma seleção explícita — evita disparar sem
   * querer uma operação cara (minutos + cota de embedding) na base inteira. */
  async function reindexAll(selectedFiles) {
    const fileIds = (selectedFiles || []).map((f) => f.id).filter(Boolean);
    if (!fileIds.length) return "needs-selection";

    const ok = await confirm({
      title: "Reindexar selecionadas",
      message: `${fileIds.length} fonte(s) serão re-fragmentadas e re-embedadas. Pode levar alguns minutos e consome cota de embeddings.`,
      confirmLabel: "Reindexar",
    });
    if (!ok) return false;

    setReindexing(true);
    setReindexingLabel("Reindexando fontes selecionadas");
    setBulkProgress({ done: 0, total: fileIds.length, label: "" });
    setError("");
    setSuccessMessage("");
    try {
      const r = await reindexAllFiles(fileIds, setBulkProgress);
      const failedList = r.failed || [];
      const quotaFailed = failedList.filter((f) => isQuotaReason(f.error));
      const realFailed = failedList.filter((f) => !isQuotaReason(f.error));
      setRefreshResult({
        title: "Reindexação concluída",
        stats: [
          { label: "processadas", value: r.ok ?? 0 },
          { label: "total", value: r.total ?? fileIds.length },
          ...(quotaFailed.length
            ? [{ label: "não processada(s) — limite de cota", value: quotaFailed.length }]
            : []),
          ...(realFailed.length ? [{ label: "com erro", value: realFailed.length }] : []),
        ],
        failed: failedList.map((f) => ({ url: f.url || f.fileId, error: f.error })),
      });
      await loadFiles();
      return true;
    } catch (err) {
      setError(err?.message || "Erro ao reindexar.");
      return false;
    } finally {
      setReindexing(false);
      setReindexingLabel("");
      setBulkProgress(null);
    }
  }

  async function checkUrlUpdates(selectedFiles) {
    const fileIds = (selectedFiles || []).map((f) => f.id).filter(Boolean);
    if (!fileIds.length) return "needs-selection";

    const ok = await confirm({
      title: "Verificar atualizações",
      message: `Compara ${fileIds.length} fonte(s) selecionada(s) com o site e re-processa só o que mudou.`,
      confirmLabel: "Verificar",
    });
    if (!ok) return false;

    setReindexing(true);
    setReindexingLabel("Verificando fontes selecionadas");
    setBulkProgress({ done: 0, total: fileIds.length, label: "" });
    setError("");
    setSuccessMessage("");
    try {
      const r = await refreshUrls(fileIds, setBulkProgress);
      const failedList = r.failed || [];
      const quotaFailed = failedList.filter((f) => isQuotaReason(f.error));
      const realFailed = failedList.filter((f) => !isQuotaReason(f.error));
      setRefreshResult({
        title: "Verificação concluída",
        stats: [
          { label: "iguais", value: r.unchanged ?? 0 },
          { label: "atualizada(s)", value: r.updated ?? 0 },
          ...(quotaFailed.length
            ? [{ label: "não verificada(s) — limite de cota", value: quotaFailed.length }]
            : []),
          ...(realFailed.length ? [{ label: "inacessível(is)", value: realFailed.length }] : []),
        ],
        failed: failedList.map((f) => ({ url: f.url, error: f.error })),
      });
      await loadFiles();
      return true;
    } catch (err) {
      setError(err?.message || "Erro ao verificar.");
      return false;
    } finally {
      setReindexing(false);
      setReindexingLabel("");
      setBulkProgress(null);
    }
  }

  useEffect(() => {
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    files,
    loadingFiles,
    uploading,
    reindexing,
    reindexingLabel,
    bulkProgress,
    urlProgress,
    progress,
    error,
    successMessage,
    refreshResult,
    clearRefreshResult: () => setRefreshResult(null),
    uploadFile,
    uploadUrl,
    removeFile,
    removeManyFiles,
    markReviewed,
    reprocessFile,
    reindexAll,
    checkUrlUpdates,
    reloadFiles: loadFiles,
  };
}
