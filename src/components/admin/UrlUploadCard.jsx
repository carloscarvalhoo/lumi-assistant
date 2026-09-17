"use client";

import { useState } from "react";
import SearchIcon from "@mui/icons-material/Search";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import LanguageIcon from "@mui/icons-material/Language";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import LoadingOverlay from "@/components/ui/LoadingOverlay";
import Alert from "@/components/admin/ui/Alert";

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export default function UrlUploadCard({
  uploading,
  error,
  successMessage,
  onUploadUrl,
  files = [],
}) {
  const confirm = useConfirm();
  const [url, setUrl] = useState("");
  const [urlsMapeadas, setUrlsMapeadas] = useState([]);
  const [urlsSelecionadas, setUrlsSelecionadas] = useState([]);
  const [loadingMap, setLoadingMap] = useState(false);
  const [mapMessage, setMapMessage] = useState("");
  const [mapError, setMapError] = useState("");

  async function handleMapUrls(e) {
    e.preventDefault();
    if (!url.trim()) return;

    const host = hostnameOf(url.trim());
    const matches = host
      ? files.filter((f) => f.sourceUrl && hostnameOf(f.sourceUrl) === host)
      : [];

    if (matches.length > 0) {
      const ok = await confirm({
        title: "Site já indexado",
        message: `"${host}" já tem ${matches.length} página(s) na base. Mapear de novo não duplica — as páginas iguais são atualizadas no lugar. Quer mapear mesmo assim?`,
        confirmLabel: "Mapear mesmo assim",
      });
      if (!ok) return;
    }

    setLoadingMap(true);
    setMapMessage("");
    setMapError("");
    setUrlsMapeadas([]);
    setUrlsSelecionadas([]);

    try {
      const res = await fetch("/api/admin/map-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.urls?.length) {
        setUrlsMapeadas(data.urls);
        const plural = data.urls.length > 1 ? "s" : "";
        const truncadoMsg = data.truncated
          ? ` (o site tem ${data.total}; mostrando as ${data.urls.length} primeiras)`
          : "";
        setMapMessage(`${data.urls.length} página${plural} encontrada${plural}${truncadoMsg}.`);
      } else {
        setMapError(data.error || "Nenhuma página encontrada nesse endereço.");
      }
    } catch {
      setMapError("Erro de conexão ao mapear o site.");
    } finally {
      setLoadingMap(false);
    }
  }

  function toggleUrl(link) {
    setUrlsSelecionadas((prev) =>
      prev.includes(link) ? prev.filter((i) => i !== link) : [...prev, link],
    );
  }

  function toggleSelectAll() {
    setUrlsSelecionadas(urlsSelecionadas.length === urlsMapeadas.length ? [] : [...urlsMapeadas]);
  }

  async function handleIndexar() {
    if (urlsSelecionadas.length === 0) return;
    const ok = await onUploadUrl(urlsSelecionadas);
    // Some bem-sucedido: a lista de páginas mapeadas não serve mais pra nada
    // (já foram indexadas), então some da tela em vez de ficar ali parada.
    if (ok) {
      setUrlsMapeadas([]);
      setUrlsSelecionadas([]);
      setMapMessage("");
    }
  }

  return (
    <section className="mb-8 rounded-[28px] border border-white/10 bg-[var(--surface-elevated)]/90 p-6 shadow-2xl shadow-black/30">
      <LoadingOverlay
        active={loadingMap}
        title="Mapeando o site…"
        subtitle="Descobrindo as páginas do domínio. Pode levar alguns segundos."
      />

      <div className="mb-5">
        <h2 className="text-lg font-semibold text-zinc-100">Indexar páginas da web</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Cole a URL de um site. O sistema mapeia todas as páginas, você seleciona quais indexar.
        </p>
      </div>

      <form onSubmit={handleMapUrls} className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        <div className="relative flex-1">
          <LanguageIcon
            fontSize="small"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"
          />
          <input
            type="url"
            required
            placeholder="https://exemplo.com.br"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loadingMap || uploading}
            className="glass-subtle w-full rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:border-white/25 focus:outline-none disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={loadingMap || uploading || !url.trim()}
          className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingMap ? (
            <AutorenewIcon fontSize="small" className="animate-spin" />
          ) : (
            <SearchIcon fontSize="small" />
          )}
          {loadingMap ? "Mapeando..." : "Mapear"}
        </button>
      </form>

      {mapMessage && (
        <p className="mt-3 text-sm text-zinc-400">{mapMessage} Selecione quais deseja indexar.</p>
      )}
      {mapError && (
        <div className="mt-3 flex items-center gap-2 text-sm text-red-400">
          <ErrorOutlineIcon fontSize="small" /> {mapError}
        </div>
      )}

      {/* Lista de URLs */}
      {urlsMapeadas.length > 0 && (
        <div className="mt-6 border-t border-white/5 pt-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-zinc-400">
              <span className="font-medium text-zinc-200">{urlsSelecionadas.length}</span> de{" "}
              {urlsMapeadas.length} selecionadas
            </span>
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-xs text-zinc-500 underline hover:text-zinc-300 transition"
            >
              {urlsSelecionadas.length === urlsMapeadas.length
                ? "Desmarcar todas"
                : "Selecionar todas"}
            </button>
          </div>

          <div className="max-h-64 space-y-1 overflow-y-auto glass-subtle rounded-2xl p-2">
            {urlsMapeadas.map((link) => {
              const selected = urlsSelecionadas.includes(link);
              return (
                <label
                  key={link}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors ${
                    selected ? "bg-white/8 text-zinc-100" : "text-zinc-400 hover:bg-white/5"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleUrl(link)}
                    className="hidden"
                  />
                  {selected ? (
                    <CheckBoxIcon fontSize="small" className="shrink-0 text-zinc-300" />
                  ) : (
                    <CheckBoxOutlineBlankIcon fontSize="small" className="shrink-0 text-zinc-600" />
                  )}
                  <span className="truncate text-sm">{link}</span>
                </label>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleIndexar}
            disabled={uploading || urlsSelecionadas.length === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? (
              <>
                <AutorenewIcon fontSize="small" className="animate-spin" />
                Gerando embeddings...
              </>
            ) : (
              `Indexar ${urlsSelecionadas.length > 0 ? urlsSelecionadas.length : ""} página${urlsSelecionadas.length !== 1 ? "s" : ""}`
            )}
          </button>
        </div>
      )}

      <Alert variant="error" className="mt-4">
        {error}
      </Alert>
      <Alert variant="success" className="mt-4">
        {successMessage}
      </Alert>
    </section>
  );
}
