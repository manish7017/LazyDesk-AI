import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  FileText,
  FileCode,
  FileSpreadsheet,
  Image,
  File,
  Copy,
  Eye,
  Check,
  X,
} from "lucide-react";
import type { ScannedFile, DuplicateGroup } from "@lazydesk/shared";

interface FileExplorerViewProps {
  files: ScannedFile[];
  duplicates: DuplicateGroup[];
  workspaceRoot?: string;
}

export const FileExplorerView: React.FC<FileExplorerViewProps> = ({
  files,
  duplicates,
  workspaceRoot,
}) => {
  const [search, setSearch] = useState("");
  const [selectedExtension, setSelectedExtension] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [inspectedFile, setInspectedFile] = useState<ScannedFile | null>(null);

  // Set of duplicate hashes for quick lookup
  const duplicateHashSet = useMemo(() => {
    return new Set(duplicates.map((d) => d.sha256Hash));
  }, [duplicates]);

  const uniqueExtensions = useMemo(() => {
    const exts = new Set<string>();
    for (const f of files) {
      if (f.extension) exts.add(f.extension.toLowerCase());
    }
    return Array.from(exts).sort();
  }, [files]);

  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      if (search && !f.filename.toLowerCase().includes(search.toLowerCase()) && !f.relativePath.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (selectedExtension !== "all" && f.extension.toLowerCase() !== selectedExtension) {
        return false;
      }
      if (selectedStatus !== "all" && f.status !== selectedStatus) {
        return false;
      }
      return true;
    });
  }, [files, search, selectedExtension, selectedStatus]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getFileIcon = (ext: string) => {
    switch (ext) {
      case ".ts":
      case ".js":
      case ".py":
      case ".sh":
      case ".json":
      case ".tsx":
      case ".jsx":
        return <FileCode className="w-4 h-4 text-amber-400" />;
      case ".csv":
      case ".tsv":
      case ".xlsx":
      case ".xlsb":
      case ".xls":
      case ".ods":
        return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
      case ".png":
      case ".jpg":
      case ".jpeg":
      case ".svg":
      case ".webp":
        return <Image className="w-4 h-4 text-purple-400" />;
      case ".md":
      case ".txt":
      case ".pdf":
        return <FileText className="w-4 h-4 text-blue-400" />;
      default:
        return <File className="w-4 h-4 text-charcoal-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="p-4 bg-charcoal-900 border border-charcoal-800 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-charcoal-500 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by filename or relative path..."
            className="w-full pl-9 pr-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-xs font-mono text-charcoal-200 placeholder:text-charcoal-600 focus:outline-none focus:border-brand-500 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
          <div className="flex items-center gap-1.5 text-charcoal-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          <select
            value={selectedExtension}
            onChange={(e) => setSelectedExtension(e.target.value)}
            className="px-2.5 py-1.5 bg-charcoal-950 border border-charcoal-700 rounded-lg text-charcoal-300 text-xs focus:outline-none focus:border-brand-500"
          >
            <option value="all">All Types ({files.length})</option>
            {uniqueExtensions.map((ext) => (
              <option key={ext} value={ext}>
                {ext} ({files.filter((f) => f.extension.toLowerCase() === ext).length})
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-charcoal-950 border border-charcoal-700 rounded-lg text-charcoal-300 text-xs focus:outline-none focus:border-brand-500 capitalize"
          >
            <option value="all">All Statuses</option>
            <option value="scanned">Scanned</option>
            <option value="organized">Organized</option>
            <option value="unsupported">Unsupported</option>
          </select>

          <span className="text-charcoal-500 font-mono text-[11px] ml-auto">
            Showing {filteredFiles.length} of {files.length}
          </span>
        </div>
      </div>

      {/* Main Files Table */}
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-charcoal-850/80 border-b border-charcoal-800 text-charcoal-400 font-medium font-mono text-[11px]">
              <tr>
                <th className="px-4 py-3">File Name</th>
                <th className="px-4 py-3">Relative Path</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-800/80 font-mono">
              {filteredFiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-charcoal-500">
                    No files found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredFiles.map((file) => {
                  const isDuplicate = duplicateHashSet.has(file.sha256Hash);
                  return (
                    <tr
                      key={file.id}
                      className="hover:bg-charcoal-850/60 transition group cursor-pointer"
                      onClick={() => setInspectedFile(file)}
                    >
                      <td className="px-4 py-3 truncate max-w-xs">
                        <div className="flex items-center gap-2">
                          {getFileIcon(file.extension)}
                          <span className="font-semibold text-charcoal-200 truncate">
                            {file.filename}
                          </span>
                          {isDuplicate && (
                            <span
                              className="px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] flex items-center gap-1 font-bold shrink-0"
                              title="Exact duplicate match found in workspace"
                            >
                              <Copy className="w-2.5 h-2.5" /> DUP
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-charcoal-500 truncate max-w-xs">
                        {file.relativePath}
                      </td>
                      <td className="px-4 py-3 text-charcoal-400 shrink-0">
                        {formatBytes(file.size)}
                      </td>
                      <td className="px-4 py-3 text-charcoal-500 shrink-0">
                        {file.extension || "none"}
                      </td>
                      <td className="px-4 py-3 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                            file.status === "organized"
                              ? "bg-brand-500/10 text-brand-400"
                              : file.status === "scanned"
                              ? "bg-blue-500/10 text-blue-300"
                              : "bg-charcoal-800 text-charcoal-400"
                          }`}
                        >
                          {file.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectedFile(file);
                          }}
                          className="px-2 py-1 rounded bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 text-[11px] font-sans inline-flex items-center gap-1 transition"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* File Content Inspection Drawer/Modal */}
      {inspectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-charcoal-900 border border-charcoal-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-charcoal-800 bg-charcoal-850">
              <div className="flex items-center gap-2 truncate pr-4">
                {getFileIcon(inspectedFile.extension)}
                <span className="font-mono font-semibold text-charcoal-100 text-xs truncate">
                  {inspectedFile.filename}
                </span>
              </div>
              <button
                onClick={() => setInspectedFile(null)}
                className="p-1 rounded-md text-charcoal-400 hover:text-charcoal-200 hover:bg-charcoal-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-charcoal-950 rounded-lg border border-charcoal-800 font-mono text-[11px]">
                <div>
                  <span className="text-charcoal-500 block">File Size</span>
                  <span className="text-charcoal-200">{formatBytes(inspectedFile.size)}</span>
                </div>
                <div>
                  <span className="text-charcoal-500 block">MIME Type</span>
                  <span className="text-charcoal-200">{inspectedFile.mimeType}</span>
                </div>
                <div className="col-span-2 truncate">
                  <span className="text-charcoal-500 block">SHA-256 Hash</span>
                  <span className="text-charcoal-400 select-all" title={inspectedFile.sha256Hash}>
                    {inspectedFile.sha256Hash || "Not calculated"}
                  </span>
                </div>
                <div className="col-span-2 truncate">
                  <span className="text-charcoal-500 block">Absolute Path</span>
                  <span className="text-charcoal-400 select-all">
                    {inspectedFile.absolutePath}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-charcoal-300 mb-2">
                  Bounded Content Sample (Safe Preview)
                </label>
                <div className="p-4 bg-charcoal-950 rounded-lg border border-charcoal-800/80 font-mono text-[11px] text-charcoal-300 max-h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text">
                  {inspectedFile.contentSample || "[No text sample available or binary file]"}
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-charcoal-800 bg-charcoal-850 flex justify-end">
              <button
                onClick={() => setInspectedFile(null)}
                className="px-4 py-1.5 rounded-lg bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 text-xs font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
