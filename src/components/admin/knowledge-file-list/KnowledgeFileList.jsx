"use client";

import { useMemo, useState } from "react";
import SummaryCard from "./SummaryCard";
import SiteGroupSection from "./SiteGroupSection";
import PdfSection from "./PdfSection";
import OtherFilesSection from "./OtherFilesSection";
import {
  getFileKey,
  getFileUrl,
  getDomainFromUrl,
  getPathFromUrl,
  getFileName,
  isPdfFile,
  isSiteFile,
  getDateObject,
  getIndexedDate,
} from "./helpers";

/**
 * Lista da base de conhecimento, agrupada em Sites/PDFs/Outros. Orquestra
 * busca, filtro por tipo e seleção — o resto (agrupamento por domínio,
 * filtro de status por site, badges, ações por linha) vive nos
 * subcomponentes ao lado (SiteGroupSection, PdfSection, OtherFilesSection,
 * StatusBadge, DocActions) e em helpers.js (funções puras de formatação).
 */
export default function KnowledgeFileList({
  files,
  loading,
  onDelete,
  onReprocess,
  onReview,
  selectedFiles = [],
  onToggleSelection,
  onToggleSelectAll,
  allSelected,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  function isFileSelected(file) {
    const fileKey = getFileKey(file);
    return selectedFiles.some((selectedFile) => getFileKey(selectedFile) === fileKey);
  }

  const summary = useMemo(() => {
    const allFiles = files || [];

    const totalSources = allFiles.length;
    const totalSites = allFiles.filter(isSiteFile).length;
    const totalPdfs = allFiles.filter(isPdfFile).length;
    const totalOthers = totalSources - totalSites - totalPdfs;

    return {
      totalSources,
      totalSites,
      totalPdfs,
      totalOthers,
      selected: selectedFiles.length,
    };
  }, [files, selectedFiles]);

  const filteredFiles = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return (files || []).filter((file) => {
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "sites" && isSiteFile(file)) ||
        (activeFilter === "pdfs" && isPdfFile(file)) ||
        (activeFilter === "others" && !isSiteFile(file) && !isPdfFile(file));

      if (!matchesFilter) return false;

      if (!term) return true;

      const name = getFileName(file).toLowerCase();
      const url = getFileUrl(file).toLowerCase();
      const domain = getDomainFromUrl(url).toLowerCase();

      return name.includes(term) || url.includes(term) || domain.includes(term);
    });
  }, [files, searchTerm, activeFilter]);

  const groupedData = useMemo(() => {
    const siteGroupsMap = {};
    const pdfFiles = [];
    const otherFiles = [];

    filteredFiles.forEach((file) => {
      if (isSiteFile(file)) {
        const url = getFileUrl(file);
        const domain = getDomainFromUrl(url);

        if (!siteGroupsMap[domain]) {
          siteGroupsMap[domain] = [];
        }

        siteGroupsMap[domain].push(file);
        return;
      }

      if (isPdfFile(file)) {
        pdfFiles.push(file);
        return;
      }

      otherFiles.push(file);
    });

    const siteGroups = Object.entries(siteGroupsMap)
      .map(([domain, groupFiles]) => {
        const sortedFiles = [...groupFiles].sort((a, b) => {
          const aUrl = getFileUrl(a);
          const bUrl = getFileUrl(b);

          const aValue = getPathFromUrl(aUrl) || getFileName(a) || "";
          const bValue = getPathFromUrl(bUrl) || getFileName(b) || "";

          return aValue.localeCompare(bValue, "pt-BR", { sensitivity: "base" });
        });

        const latestDate = sortedFiles
          .map((file) => getDateObject(getIndexedDate(file)))
          .filter(Boolean)
          .sort((a, b) => b.getTime() - a.getTime())[0];

        return { domain, files: sortedFiles, latestDate };
      })
      .sort((a, b) => a.domain.localeCompare(b.domain, "pt-BR", { sensitivity: "base" }));

    const sortedPdfFiles = [...pdfFiles].sort((a, b) =>
      getFileName(a).localeCompare(getFileName(b), "pt-BR", { sensitivity: "base" }),
    );

    const sortedOtherFiles = [...otherFiles].sort((a, b) =>
      getFileName(a).localeCompare(getFileName(b), "pt-BR", { sensitivity: "base" }),
    );

    return { siteGroups, pdfFiles: sortedPdfFiles, otherFiles: sortedOtherFiles };
  }, [filteredFiles]);

  const filterButtons = [
    { id: "all", label: "Todos", count: summary.totalSources },
    { id: "sites", label: "Sites", count: summary.totalSites },
    { id: "pdfs", label: "PDFs", count: summary.totalPdfs },
    { id: "others", label: "Outros", count: summary.totalOthers },
  ];

  if (loading) {
    return (
      <div className="glass rounded-2xl p-6">
        <p className="text-sm text-zinc-400">Carregando arquivos...</p>
      </div>
    );
  }

  if (!files || files.length === 0) {
    return (
      <div className="glass rounded-2xl p-6">
        <p className="text-sm text-zinc-500">Nenhum item encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard label="Total de fontes" value={summary.totalSources} />
        <SummaryCard label="Sites" value={summary.totalSites} />
        <SummaryCard label="PDFs" value={summary.totalPdfs} />
        <SummaryCard label="Outros" value={summary.totalOthers} />
        <SummaryCard label="Selecionados" value={summary.selected} />
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                className="h-4 w-4 cursor-pointer accent-white"
              />

              <span className="text-sm text-zinc-400">Selecionar todos</span>
            </div>

            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nome, domínio ou URL..."
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-white/30 md:max-w-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {filterButtons.map((button) => (
              <button
                key={button.id}
                onClick={() => setActiveFilter(button.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  activeFilter === button.id
                    ? "border-white bg-white text-black"
                    : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                {button.label} ({button.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredFiles.length === 0 && (
        <div className="glass rounded-2xl p-6">
          <p className="text-sm text-zinc-500">Nenhum resultado encontrado para sua busca.</p>
        </div>
      )}

      <SiteGroupSection
        groups={groupedData.siteGroups}
        isFileSelected={isFileSelected}
        onToggleSelection={onToggleSelection}
        onReprocess={onReprocess}
        onReview={onReview}
        onDelete={onDelete}
      />

      <PdfSection
        files={groupedData.pdfFiles}
        isFileSelected={isFileSelected}
        onToggleSelection={onToggleSelection}
        onReprocess={onReprocess}
        onReview={onReview}
        onDelete={onDelete}
      />

      <OtherFilesSection
        files={groupedData.otherFiles}
        isFileSelected={isFileSelected}
        onToggleSelection={onToggleSelection}
        onDelete={onDelete}
      />
    </div>
  );
}
