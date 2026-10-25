import React, { useState } from "react";
import { X, Check, Edit3, Folder, FileText, Tag, AlertCircle } from "lucide-react";
import type { AISuggestion } from "@lazydesk/shared";

interface EditSuggestionModalProps {
  suggestion: AISuggestion | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<AISuggestion>) => Promise<void>;
}

export const EditSuggestionModal: React.FC<EditSuggestionModalProps> = ({
  suggestion,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen || !suggestion) return null;

  const [suggestedName, setSuggestedName] = useState(suggestion.suggestedName);
  const [destinationFolder, setDestinationFolder] = useState(suggestion.destinationFolder);
  const [category, setCategory] = useState(suggestion.category);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestedName.trim()) {
      setError("Filename cannot be empty");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(suggestion.id, {
        suggestedName: suggestedName.trim(),
        destinationFolder: destinationFolder.trim(),
        category: category.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update suggestion");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-charcoal-900 border border-charcoal-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-charcoal-800 bg-charcoal-850">
          <div className="flex items-center gap-2 text-charcoal-100 font-semibold text-sm">
            <Edit3 className="w-4 h-4 text-brand-400" />
            <span>Customize Organization Plan</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-charcoal-400 hover:text-charcoal-200 hover:bg-charcoal-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-charcoal-950 rounded-lg border border-charcoal-800 space-y-1">
            <span className="text-[11px] font-mono text-charcoal-500 uppercase tracking-wider">
              Original File
            </span>
            <div className="text-xs font-mono text-charcoal-300 truncate">
              {suggestion.originalFilename}
            </div>
            <div className="text-[11px] text-charcoal-500 truncate">
              {suggestion.originalPath}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-charcoal-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-brand-400" />
              Proposed Filename
            </label>
            <input
              type="text"
              value={suggestedName}
              onChange={(e) => setSuggestedName(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-xs font-mono text-charcoal-200 focus:outline-none focus:border-brand-500 transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-charcoal-300 mb-1.5 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-brand-400" />
              Destination Subfolder
            </label>
            <input
              type="text"
              value={destinationFolder}
              onChange={(e) => setDestinationFolder(e.target.value)}
              placeholder="e.g. Coding/React or Documents/Finance"
              className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-xs font-mono text-charcoal-200 focus:outline-none focus:border-brand-500 transition"
            />
            <p className="text-[11px] text-charcoal-500 mt-1">
              Relative to workspace root. Subdirectories will be created automatically.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-charcoal-300 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-brand-400" />
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Coding, Finance, Personal"
              className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-xs text-charcoal-200 focus:outline-none focus:border-brand-500 transition"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-charcoal-700 text-charcoal-300 hover:bg-charcoal-800 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-charcoal-950 text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
