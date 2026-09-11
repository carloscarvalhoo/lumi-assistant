export default function DocActions({ file, onReprocess, onReview, onDelete }) {
  return (
    <div className="flex shrink-0 flex-nowrap gap-2">
      {onReview &&
        file?.id &&
        (file.freshness === "dueForReview" || file.freshness === "expired") && (
          <button
            onClick={() => onReview(file.id)}
            className="glass glass-hover rounded-lg px-3 py-1.5 text-sm text-zinc-300 transition"
          >
            Marcar revisado
          </button>
        )}
      {onReprocess && file?.id && (
        <button
          onClick={() => onReprocess(file.id)}
          className="glass glass-hover rounded-lg px-3 py-1.5 text-sm text-zinc-300 transition"
        >
          Reprocessar
        </button>
      )}
      <button
        onClick={() => onDelete(file)}
        className="shrink-0 rounded-lg border border-red-500/25 bg-red-500/[0.06] px-3 py-1.5 text-sm text-red-400 transition hover:bg-red-500/[0.14]"
      >
        Apagar
      </button>
    </div>
  );
}
