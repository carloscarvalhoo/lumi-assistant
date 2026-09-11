"use client";

import { useEffect } from "react";

/**
 * Tela de carregamento em tela cheia genérica (spinner + título + legenda).
 * Usada em ações longas sem progresso incremental conhecido (mapear site,
 * reprocessar um documento) — diferente do EmbeddingLoader, que tem passos
 * específicos do fluxo de upload.
 *
 * Quando `progress` é passado ({ done, total, label }), mostra uma barra real
 * ("42 de 138" + a página/fonte sendo processada agora) em vez do spinner
 * indeterminado — usado por Verificar atualizações/Reindexar, que streamam
 * progresso em tempo real do servidor via SSE.
 */
export default function LoadingOverlay({ active, title, subtitle, progress }) {
  useEffect(() => {
    if (!active) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [active]);

  if (!active) return null;

  const hasProgress = progress && Number(progress.total) > 0;
  const pct = hasProgress ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="glass-strong mx-4 flex w-full max-w-sm flex-col items-center rounded-3xl p-8 text-center">
        {hasProgress ? (
          <div className="mb-6 w-full">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="font-semibold text-zinc-100">
                {progress.done} de {progress.total}
              </span>
              <span className="text-zinc-500">{pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-zinc-500 to-zinc-200 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="relative mb-6 h-14 w-14">
            <div className="absolute inset-0 rounded-full border-2 border-white/5" />
            <div className="absolute inset-0 rounded-full border-t-2 border-zinc-300 animate-spin" />
          </div>
        )}

        <h3 className="w-full truncate text-base font-semibold text-zinc-100">{title}</h3>
        {progress?.label ? (
          <p className="mt-1.5 w-full truncate text-sm text-zinc-500" title={progress.label}>
            {progress.label}
          </p>
        ) : (
          subtitle && <p className="mt-1.5 w-full text-sm text-zinc-500">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
