import StatusBadge from "./StatusBadge";
import DocActions from "./DocActions";
import { getFileKey, getFileName, getPdfDetails } from "./helpers";

export default function PdfSection({
  files,
  isFileSelected,
  onToggleSelection,
  onReprocess,
  onReview,
  onDelete,
}) {
  if (files.length === 0) return null;

  return (
    <section className="glass rounded-2xl">
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-200">PDFs enviados</h3>
      </div>

      <div className="divide-y divide-white/10">
        {files.map((file, index) => {
          const fileKey = getFileKey(file) || index;
          const fileName = getFileName(file);
          const selected = isFileSelected(file);
          const details = getPdfDetails(file);

          return (
            <div
              key={fileKey}
              className={`flex flex-col gap-4 px-4 py-4 transition md:flex-row md:items-center md:justify-between ${
                selected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleSelection(file)}
                  className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-white"
                />

                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="min-w-0 truncate text-sm font-medium text-white">{fileName}</p>

                    <span className="shrink-0 rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[11px] font-medium text-red-300">
                      PDF
                    </span>

                    <span className="shrink-0">
                      <StatusBadge file={file} />
                    </span>
                  </div>

                  {details.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {details.map((detail) => (
                        <span
                          key={detail}
                          className="rounded-full bg-white/[0.05] px-2 py-1 text-[11px] text-zinc-400"
                        >
                          {detail}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DocActions
                file={file}
                onReprocess={onReprocess}
                onReview={onReview}
                onDelete={onDelete}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
