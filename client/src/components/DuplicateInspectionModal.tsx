import React, { useState } from "react";
import { X, Copy, Trash2, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import type { DuplicateGroup } from "@lazydesk/shared";

interface DuplicateInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicates: DuplicateGroup[];
  onDeleteSelected: (filePaths: string[], moveToTrash: boolean) => Promise<void>;
}

export const DuplicateInspectionModal: React.FC<DuplicateInspectionModalProps> = ({
  isOpen,
  onClose,
  duplicates,
  onDeleteSelected,
}) => {
  if (!isOpen) return null;

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [moveToTrash, setMoveToTrash] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const toggleSelect = (path: string) => {
    const next = new Set(selectedPaths);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setSelectedPaths(next);
  };

  // Helper: auto-select all duplicate copies EXCEPT the first one in each group
  const selectAllExceptFirst = () => {
    const toSelect = new Set<string>();
    for (const group of duplicates) {
      if (group.files.length > 1) {
        // Keep index 0, mark indices 1..n
        for (let i = 1; i < group.files.length; i++) {
          toSelect.add(group.files[i].absolutePath);
        }
      }
    }
    setSelectedPaths(toSelect);
  };

  const handleExecuteDelete = async () => {
    if (selectedPaths.size === 0) return;
    setIsDeleting(true);
    setFeedback(null);
    try {
      await onDeleteSelected(Array.from(selectedPaths), moveToTrash);
      setSelectedPaths(new Set());
      setConfirmingDelete(false);
      setFeedback(`Successfully moved ${selectedPaths.size} duplicate file(s) to safe trash.`);
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-charcoal-900 border border-charcoal-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-charcoal-800 bg-charcoal-850">
          <div>
            <div className="flex items-center gap-2 text-charcoal-100 font-semibold text-sm">
              <Copy className="w-4 h-4 text-brand-400" />
              <span>Exact Duplicate Inspector ({duplicates.length} duplicate clusters)</span>
            </div>
            <p className="text-xs text-charcoal-400 mt-0.5">
              Verified by SHA-256 byte-by-byte hashes. Files are never deleted automatically.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-charcoal-400 hover:text-charcoal-200 hover:bg-charcoal-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 bg-charcoal-950 border-b border-charcoal-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={selectAllExceptFirst}
              className="px-2.5 py-1 rounded border border-charcoal-700 bg-charcoal-850 hover:bg-charcoal-800 text-charcoal-300 font-medium transition"
            >
              Select All Secondary Copies
            </button>
            <button
              onClick={() => setSelectedPaths(new Set())}
              className="text-charcoal-500 hover:text-charcoal-300 transition"
            >
              Clear Selection
            </button>
          </div>
          <span className="text-charcoal-400 font-mono text-[11px]">
            {selectedPaths.size} file(s) selected
          </span>
        </div>

        {feedback && (
          <div className="mx-6 mt-4 p-3 bg-brand-500/10 border border-brand-500/30 rounded-lg text-brand-300 text-xs">
            {feedback}
          </div>
        )}

        {/* Groups List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {duplicates.length === 0 ? (
            <div className="py-16 text-center text-charcoal-500 text-sm">
              <CheckCircle2 className="w-8 h-8 text-brand-400 mx-auto mb-2 opacity-60" />
              No duplicate files found in this workspace. Workspace is clean!
            </div>
          ) : (
            duplicates.map((group, idx) => (
              <div
                key={group.sha256Hash}
                className="bg-charcoal-850/70 border border-charcoal-800 rounded-lg overflow-hidden text-xs"
              >
                <div className="px-4 py-2 bg-charcoal-800/80 border-b border-charcoal-800 flex items-center justify-between font-mono text-[11px]">
                  <span className="text-charcoal-300 font-semibold">
                    Cluster #{idx + 1} • {group.totalCopies} copies • {formatBytes(group.size)} each
                  </span>
                  <span className="text-charcoal-500 truncate max-w-xs" title={group.sha256Hash}>
                    SHA-256: {group.sha256Hash.substring(0, 16)}...
                  </span>
                </div>

                <div className="p-3 space-y-2">
                  {group.files.map((file, fileIdx) => {
                    const isSelected = selectedPaths.has(file.absolutePath);
                    return (
                      <div
                        key={file.id}
                        onClick={() => toggleSelect(file.absolutePath)}
                        className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${
                          isSelected
                            ? "bg-red-950/20 border-red-800/40 text-red-200"
                            : "bg-charcoal-900 border-charcoal-800/80 hover:bg-charcoal-800/60 text-charcoal-300"
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(file.absolutePath)}
                            className="rounded border-charcoal-700 text-brand-500 focus:ring-0"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="truncate">
                            <div className="font-mono text-xs flex items-center gap-2">
                              <span className="font-semibold text-charcoal-200 truncate">
                                {file.filename}
                              </span>
                              {fileIdx === 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 text-[10px] uppercase font-bold">
                                  Original
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-charcoal-500 truncate mt-0.5">
                              {file.relativePath}
                            </div>
                          </div>
                        </div>

                        <div className="text-right text-[11px] text-charcoal-500 font-mono shrink-0 pl-4">
                          <div>{new Date(file.modifiedAt).toLocaleDateString()}</div>
                          <div>{formatBytes(file.size)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-charcoal-800 bg-charcoal-850">
          <label className="flex items-center gap-2 text-xs text-charcoal-400 cursor-pointer">
            <input
              type="checkbox"
              checked={moveToTrash}
              onChange={(e) => setMoveToTrash(e.target.checked)}
              className="rounded border-charcoal-700 text-brand-500 focus:ring-0"
            />
            <span>Move to safe workspace trash folder (<code className="text-charcoal-300">.lazydesk_trash/</code>)</span>
          </label>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-charcoal-700 text-charcoal-300 hover:bg-charcoal-800 text-xs font-medium transition"
            >
              Close
            </button>
            {confirmingDelete ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="px-3 py-2 rounded-lg border border-charcoal-700 text-charcoal-400 text-xs hover:bg-charcoal-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>{isDeleting ? "Processing..." : `Confirm Delete (${selectedPaths.size})`}</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                disabled={selectedPaths.size === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600/90 hover:bg-red-600 text-white text-xs font-semibold shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Selected ({selectedPaths.size})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
