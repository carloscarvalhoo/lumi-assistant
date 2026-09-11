"use client";

import { useState } from "react";
import StatusBadge, { STATUS_FILTERS, getFileStatus } from "./StatusBadge";
import DocActions from "./DocActions";
import { getFileKey, getFileName, getFileUrl, getSiteDetails, formatDate } from "./helpers";

/**
 * Bloco "Sites indexados": um card por domínio, cada um com seu próprio
 * abrir/fechar e seu próprio filtro de status (Em dia/Revisar/Vencido/Página
 * não encontrada) — por isso o estado (`openGroups`, `groupStatusFilter`)
 * vive aqui dentro, e não no KnowledgeFileList, já que nada fora deste
 * bloco precisa dele.
 */
export default function SiteGroupSection({
  groups,
  isFileSelected,
  onToggleSelection,
  onReprocess,
  onReview,
  onDelete,
}) {
  const [openGroups, setOpenGroups] = useState({});
  const [groupStatusFilter, setGroupStatusFilter] = useState({});

  if (groups.length === 0) return null;

  function toggleGroup(domain) {
    setOpenGroups((prev) => ({ ...prev, [domain]: !prev[domain] }));
  }

  function isGroupSelected(groupFiles) {
    return groupFiles.every((file) => isFileSelected(file));
  }

  function toggleGroupSelection(groupFiles) {
    const groupSelected = isGroupSelected(groupFiles);

    groupFiles.forEach((file) => {
      const selected = isFileSelected(file);
      if (groupSelected && selected) onToggleSelection(file);
      if (!groupSelected && !selected) onToggleSelection(file);
    });
  }

  function selectDomain(groupFiles) {
    const anyUnselected = groupFiles.some((file) => !isFileSelected(file));
    groupFiles.forEach((file) => {
      const selected = isFileSelected(file);
      if (anyUnselected ? !selected : selected) onToggleSelection(file);
    });
  }

  function getGroupStatusFilter(domain) {
    return groupStatusFilter[domain] || "all";
  }

  function setGroupStatus(domain, status) {
    setGroupStatusFilter((prev) => ({ ...prev, [domain]: status }));
  }

  function getGroupStatusCounts(groupFiles) {
    const counts = { all: groupFiles.length, fresh: 0, dueForReview: 0, expired: 0, notFound: 0 };
    groupFiles.forEach((file) => {
      const status = getFileStatus(file);
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }

  return (
    <section className="glass rounded-2xl">
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-200">Sites indexados</h3>
      </div>

      <div className="divide-y divide-white/10">
        {groups.map((group) => {
          const opened = openGroups[group.domain];
          const groupSelected = isGroupSelected(group.files);
          const activeGroupStatus = getGroupStatusFilter(group.domain);
          const statusCounts = getGroupStatusCounts(group.files);

          return (
            <div key={group.domain}>
              <div className="flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={groupSelected}
                    onChange={() => toggleGroupSelection(group.files)}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-white"
                  />

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-white">{group.domain}</p>

                      <span className="rounded-full border border-blue-400/30 bg-blue-400/10 px-2 py-0.5 text-[11px] font-medium text-blue-300">
                        Site
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[11px] text-zinc-400">
                        {group.files.length} página(s)
                      </span>

                      {group.latestDate && (
                        <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[11px] text-zinc-400">
                          Última indexação em {formatDate(group.latestDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleGroup(group.domain)}
                    className="glass glass-hover rounded-lg px-3 py-1.5 text-sm text-zinc-300 transition"
                  >
                    {opened ? "Fechar" : "Abrir"}
                  </button>

                  <button
                    onClick={() => selectDomain(group.files)}
                    className="glass glass-hover rounded-lg px-3 py-1.5 text-sm text-zinc-300 transition"
                  >
                    Selecionar tudo
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-white/[0.06] px-4 py-3">
                {STATUS_FILTERS.map((status) => (
                  <button
                    key={status.id}
                    onClick={() => setGroupStatus(group.domain, status.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      activeGroupStatus === status.id
                        ? "border-white bg-white text-black"
                        : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.07] hover:text-white"
                    }`}
                  >
                    {status.label} ({statusCounts[status.id] ?? 0})
                  </button>
                ))}
              </div>

              {opened && (
                <div className="space-y-2 border-t border-white/[0.06] px-4 pb-4 pt-3">
                  {group.files
                    .filter(
                      (file) =>
                        activeGroupStatus === "all" || getFileStatus(file) === activeGroupStatus,
                    )
                    .map((file, index) => {
                      const fileKey = getFileKey(file) || index;
                      const fileName = getFileName(file);
                      const fileUrl = getFileUrl(file);
                      const selected = isFileSelected(file);
                      const details = getSiteDetails(file);

                      return (
                        <div
                          key={fileKey}
                          className={`rounded-xl border border-white/10 p-3 transition ${
                            selected ? "bg-white/[0.08]" : "bg-white/[0.03] hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => onToggleSelection(file)}
                                className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-white"
                              />

                              <div className="min-w-0">
                                <div className="flex min-w-0 items-center gap-2">
                                  <p className="min-w-0 truncate text-sm font-medium text-white">
                                    {fileName}
                                  </p>
                                  <span className="shrink-0">
                                    <StatusBadge file={file} />
                                  </span>
                                </div>

                                {fileUrl && (
                                  <a
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-1 block max-w-xl truncate text-xs text-blue-300 transition hover:text-blue-200 hover:underline"
                                  >
                                    {fileUrl}
                                  </a>
                                )}

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
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
