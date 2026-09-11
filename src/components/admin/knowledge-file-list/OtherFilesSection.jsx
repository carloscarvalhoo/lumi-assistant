import { getFileKey, getFileName } from "./helpers";

export default function OtherFilesSection({ files, isFileSelected, onToggleSelection, onDelete }) {
  if (files.length === 0) return null;

  return (
    <section className="glass rounded-2xl">
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-200">Outras fontes</h3>
      </div>

      <div className="divide-y divide-white/10">
        {files.map((file, index) => {
          const fileKey = getFileKey(file) || index;
          const fileName = getFileName(file);
          const selected = isFileSelected(file);

          return (
            <div
              key={fileKey}
              className={`flex items-center justify-between gap-4 px-4 py-4 transition ${
                selected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleSelection(file)}
                  className="h-4 w-4 shrink-0 cursor-pointer accent-white"
                />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-white">{fileName}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onDelete(file)}
                className="shrink-0 rounded-lg border border-red-500/25 bg-red-500/[0.06] px-3 py-1.5 text-sm text-red-400 transition hover:bg-red-500/[0.14]"
              >
                Apagar
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
