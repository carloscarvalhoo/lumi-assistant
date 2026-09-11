import { isPageGoneReason } from "@/lib/knowledge/friendlyScrapeError";

const FRESHNESS = {
  fresh: { label: "Em dia", cls: "border-green-400/30 bg-green-400/10 text-green-300" },
  dueForReview: { label: "Revisar", cls: "border-amber-400/30 bg-amber-400/10 text-amber-300" },
  expired: { label: "Vencido", cls: "border-red-400/30 bg-red-400/10 text-red-300" },
};

export const STATUS_FILTERS = [
  { id: "all", label: "Todos os status" },
  { id: "fresh", label: FRESHNESS.fresh.label },
  { id: "dueForReview", label: FRESHNESS.dueForReview.label },
  { id: "expired", label: FRESHNESS.expired.label },
  { id: "notFound", label: "Página não encontrada" },
];

function FreshnessBadge({ freshness }) {
  const info = FRESHNESS[freshness];
  if (!info) return null;
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${info.cls}`}>
      {info.label}
    </span>
  );
}

// Mesma lógica do StatusBadge, mas como valor filtrável — "notFound" tem
// prioridade sobre o freshness normal (ver comentário abaixo).
export function getFileStatus(file) {
  if (file?.lastCheckFailed && isPageGoneReason(file?.lastCheckError)) return "notFound";
  return file?.freshness || "fresh";
}

// "Vencido" (freshness) significa "conteúdo pode estar desatualizado, revise".
// Isso é enganoso quando a página em si sumiu do site (404/410) — nesse caso
// mostramos uma etiqueta própria em vez do "Vencido" genérico.
export default function StatusBadge({ file }) {
  if (getFileStatus(file) === "notFound") {
    return (
      <span className="rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-400">
        Página não encontrada
      </span>
    );
  }
  return <FreshnessBadge freshness={file?.freshness} />;
}
