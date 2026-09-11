"use client";

import Modal from "@/components/ui/Modal";
import Button from "@/components/admin/ui/Button";
import { friendlyScrapeError } from "@/lib/knowledge/friendlyScrapeError";

const MAX_FAILED_SHOWN = 15;

/**
 * Mostra o resultado de "Verificar atualizações" / "Reindexar tudo" num modal,
 * em vez de um textinho apagado no canto da página — com a contagem de cada
 * categoria e, se algo falhou, a lista com o motivo de cada falha (agora que
 * scrapePage devolve a razão real em vez de um "inacessível" genérico).
 */
export default function RefreshResultModal({ result, onClose }) {
  if (!result) return null;

  const { title, stats = [], failed = [] } = result;
  const shownFailed = failed.slice(0, MAX_FAILED_SHOWN);
  const extraCount = failed.length - shownFailed.length;

  return (
    <Modal
      open={Boolean(result)}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <Button size="sm" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2">
        {stats.map((stat) => (
          <span
            key={stat.label}
            className="glass-subtle rounded-full px-3 py-1.5 text-xs text-zinc-300"
          >
            <span className="font-semibold text-zinc-100">{stat.value}</span> {stat.label}
          </span>
        ))}
      </div>

      {failed.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium text-zinc-500">
            O que falhou {extraCount > 0 && `(mostrando ${shownFailed.length} de ${failed.length})`}
          </p>
          <ul className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-white/[0.06] p-3">
            {shownFailed.map((item, i) => {
              const { friendly, raw } = friendlyScrapeError(item.error);
              return (
                <li key={i} className="text-xs leading-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-all text-zinc-400">{item.url}</span>
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-300/90">
                      {friendly}
                    </span>
                  </div>
                  {item.error && (
                    <details className="mt-1 text-zinc-600">
                      <summary className="cursor-pointer select-none text-[11px] text-zinc-500 hover:text-zinc-300">
                        Ver erro completo
                      </summary>
                      <p className="mt-1 break-all rounded-lg bg-black/30 p-2 text-[11px] text-zinc-400">
                        {raw}
                      </p>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
          {extraCount > 0 && (
            <p className="mt-2 text-xs text-zinc-600">
              + {extraCount} outra(s) com o mesmo tipo de erro.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
