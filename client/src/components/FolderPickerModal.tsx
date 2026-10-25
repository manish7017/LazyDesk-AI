import React, { useState, useEffect } from "react";
import { Folder, ArrowUp, Check, X, Bookmark, HardDrive } from "lucide-react";
import { api } from "../services/api";

interface FolderPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (folderPath: string) => void;
  initialPath?: string;
}

export const FolderPickerModal: React.FC<FolderPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialPath,
}) => {
  const [currentPath, setCurrentPath] = useState(initialPath || "");
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [subdirectories, setSubdirectories] = useState<{ name: string; path: string }[]>([]);
  const [quickBookmarks, setQuickBookmarks] = useState<{ name: string; path: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadDirectory(currentPath || initialPath || "");
    }
  }, [isOpen]);

  const loadDirectory = async (dirPath?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.browseDirectory(dirPath);
      setCurrentPath(data.currentPath);
      setParentPath(data.parentPath);
      setSubdirectories(data.subdirectories);
      setQuickBookmarks(data.quickBookmarks);
    } catch (err: any) {
      setError(err.message || "Failed to load directory");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-charcoal-900 border border-charcoal-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-charcoal-800 bg-charcoal-850">
          <div className="flex items-center gap-2 text-charcoal-100 font-semibold">
            <HardDrive className="w-5 h-5 text-brand-400" />
            <span>Select Folder to Organize</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-charcoal-400 hover:text-charcoal-200 hover:bg-charcoal-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Bookmarks */}
        <div className="px-6 py-2.5 bg-charcoal-900/60 border-b border-charcoal-800/80 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-charcoal-500 flex items-center gap-1 shrink-0">
            <Bookmark className="w-3.5 h-3.5" /> Bookmarks:
          </span>
          {quickBookmarks.map((bm) => (
            <button
              key={bm.path}
              onClick={() => loadDirectory(bm.path)}
              className="px-2.5 py-1 rounded bg-charcoal-800/80 text-charcoal-300 hover:text-brand-300 hover:bg-charcoal-700 transition shrink-0"
            >
              {bm.name}
            </button>
          ))}
        </div>

        {/* Current Path Bar & Up button */}
        <div className="px-6 py-3 bg-charcoal-900 flex items-center gap-2 border-b border-charcoal-800">
          <button
            disabled={!parentPath || loading}
            onClick={() => parentPath && loadDirectory(parentPath)}
            className="p-1.5 rounded-lg border border-charcoal-700 bg-charcoal-850 hover:bg-charcoal-800 text-charcoal-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Go up to parent directory"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <div className="flex-1 font-mono text-xs text-charcoal-300 bg-charcoal-950 px-3 py-2 rounded-lg border border-charcoal-800 truncate">
            {currentPath}
          </div>
        </div>

        {/* Directory Listing */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-red-300 text-xs mb-2">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-charcoal-500 text-sm">
              Loading directories...
            </div>
          ) : subdirectories.length === 0 ? (
            <div className="py-12 text-center text-charcoal-500 text-sm">
              No subdirectories found in this folder.
            </div>
          ) : (
            subdirectories.map((dir) => (
              <div
                key={dir.path}
                onDoubleClick={() => loadDirectory(dir.path)}
                onClick={() => setCurrentPath(dir.path)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition text-sm ${
                  currentPath === dir.path
                    ? "bg-brand-500/10 border border-brand-500/30 text-brand-300"
                    : "hover:bg-charcoal-800 text-charcoal-300"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Folder className="w-4 h-4 text-brand-400 shrink-0" />
                  <span className="truncate">{dir.name}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    loadDirectory(dir.path);
                  }}
                  className="text-xs text-charcoal-500 hover:text-charcoal-300 px-2 py-0.5 rounded border border-charcoal-800 hover:bg-charcoal-700"
                >
                  Open
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-charcoal-800 bg-charcoal-850">
          <p className="text-xs text-charcoal-500">
            Double-click to open subfolder or select current path.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-charcoal-700 text-charcoal-300 hover:bg-charcoal-800 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSelect(currentPath);
                onClose();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-charcoal-950 text-xs font-semibold shadow-sm transition"
            >
              <Check className="w-4 h-4" />
              <span>Select This Folder</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
