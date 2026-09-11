"use client";

/**
 * Tela de carregamento em tela cheia genérica (spinner + título + legenda).
 * Usada em ações longas sem progresso incremental conhecido (verificar
 * atualizações, reindexar tudo, reprocessar) — diferente do EmbeddingLoader,
 * que tem passos específicos do fluxo de upload.
 */
export default function LoadingOverlay({ active, title, subtitle }) {
  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="glass-strong mx-4 flex w-full max-w-sm flex-col items-center rounded-3xl p-8 text-center">
        <div className="relative mb-6 h-14 w-14">
          <div className="absolute inset-0 rounded-full border-2 border-white/5" />
          <div className="absolute inset-0 rounded-full border-t-2 border-zinc-300 animate-spin" />
        </div>
        <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
        {subtitle && <p className="mt-1.5 text-sm text-zinc-500">{subtitle}</p>}
      </div>
    </div>
  );
}
