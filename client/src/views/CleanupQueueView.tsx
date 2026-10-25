import React, { useState, useMemo } from "react";
import {
  CheckCircle,
  XCircle,
  Edit2,
  Eye,
  Play,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Filter,
  CheckCheck,
} from "lucide-react";
import type { AISuggestion } from "@lazydesk/shared";

interface CleanupQueueViewProps {
  suggestions: AISuggestion[];
  scanId?: string;
  onUpdateSuggestion: (id: string, updates: Partial<AISuggestion>) => Promise<void>;
  onApplySuggestions: (suggestionIds: string[]) => Promise<void>;
  onTriggerPreview: (selectedSuggestions: AISuggestion[]) => void;
  onEditSuggestion: (suggestion: AISuggestion) => void;
  isApplying: boolean;
}

export const CleanupQueueView: React.FC<CleanupQueueViewProps> = ({
  suggestions,
  scanId,
  onUpdateSuggestion,
  onApplySuggestions,
  onTriggerPreview,
  onEditSuggestion,
  isApplying,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const s of suggestions) {
      if (s.category) cats.add(s.category);
    }
    return Array.from(cats).sort();
  }, [suggestions]);

  const filteredSuggestions = useMemo(() => {
    return suggestions.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
      return true;
    });
  }, [suggestions, statusFilter, categoryFilter]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const selectAllSafe = () => {
    const safeIds = new Set<string>();
    for (const s of filteredSuggestions) {
      if (s.validationStatus === "valid" && s.status === "pending") {
        safeIds.add(s.id);
      }
    }
    setSelectedIds(safeIds);
  };

  const handleApproveSelected = async () => {
    for (const id of selectedIds) {
      await onUpdateSuggestion(id, { status: "approved" });
    }
    setSelectedIds(new Set());
  };

  const handleRejectSelected = async () => {
    for (const id of selectedIds) {
      await onUpdateSuggestion(id, { status: "rejected" });
    }
    setSelectedIds(new Set());
  };

  const selectedSuggestionsList = useMemo(() => {
    return suggestions.filter((s) => selectedIds.has(s.id));
  }, [suggestions, selectedIds]);

  return (
    <div className="space-y-4">
      {/* Top Action Toolbar */}
      <div className="p-4 bg-charcoal-900 border border-charcoal-800 rounded-xl flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={selectAllSafe}
            className="px-3 py-1.5 rounded-lg border border-charcoal-700 bg-charcoal-850 hover:bg-charcoal-800 text-charcoal-200 font-medium transition flex items-center gap-1.5"
          >
            <CheckCheck className="w-4 h-4 text-brand-400" />
            <span>Select All Safe</span>
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            disabled={selectedIds.size === 0}
            className="px-3 py-1.5 rounded-lg text-charcoal-400 hover:text-charcoal-200 disabled:opacity-40 transition"
          >
            Clear Selection
          </button>

          <div className="h-4 w-px bg-charcoal-800 mx-1" />

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-charcoal-950 border border-charcoal-700 rounded-lg text-charcoal-300 text-xs focus:outline-none focus:border-brand-500 capitalize"
          >
            <option value="all">All ({suggestions.length})</option>
            <option value="pending">Pending ({suggestions.filter((s) => s.status === "pending").length})</option>
            <option value="approved">Approved ({suggestions.filter((s) => s.status === "approved").length})</option>
            <option value="applied">Applied ({suggestions.filter((s) => s.status === "applied").length})</option>
            <option value="rejected">Rejected ({suggestions.filter((s) => s.status === "rejected").length})</option>
          </select>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-charcoal-950 border border-charcoal-700 rounded-lg text-charcoal-300 text-xs focus:outline-none focus:border-brand-500"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Action Buttons for Selected Items */}
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={handleRejectSelected}
                className="px-3 py-1.5 rounded-lg border border-red-800/60 bg-red-950/20 hover:bg-red-900/40 text-red-300 text-xs font-medium transition flex items-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Reject ({selectedIds.size})</span>
              </button>
              <button
                onClick={handleApproveSelected}
                className="px-3 py-1.5 rounded-lg border border-brand-700 bg-brand-950/20 hover:bg-brand-900/40 text-brand-300 text-xs font-medium transition flex items-center gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Approve ({selectedIds.size})</span>
              </button>
            </>
          )}

          <button
            onClick={() => onTriggerPreview(selectedSuggestionsList.length > 0 ? selectedSuggestionsList : filteredSuggestions)}
            disabled={filteredSuggestions.length === 0}
            className="px-3 py-1.5 rounded-lg border border-charcoal-700 bg-charcoal-850 hover:bg-charcoal-800 text-charcoal-200 text-xs font-medium transition flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5 text-brand-400" />
            <span>Preview Diff</span>
          </button>

          <button
            onClick={() => onApplySuggestions(Array.from(selectedIds.size > 0 ? selectedIds : new Set(filteredSuggestions.filter((s) => s.validationStatus === "valid" && s.status !== "applied").map((s) => s.id))))}
            disabled={isApplying || filteredSuggestions.length === 0}
            className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-charcoal-950 text-xs font-bold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isApplying ? "Applying..." : "Apply Changes"}</span>
          </button>
        </div>
      </div>

      {/* Interactive Table */}
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-charcoal-850/80 border-b border-charcoal-800 text-charcoal-400 font-medium font-mono text-[11px]">
              <tr>
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === filteredSuggestions.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(new Set(filteredSuggestions.map((s) => s.id)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                    className="rounded border-charcoal-700 text-brand-500 focus:ring-0"
                  />
                </th>
                <th className="px-4 py-3">Original File</th>
                <th className="px-4 py-3">Proposed Organization</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Validation</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-800/80">
              {filteredSuggestions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-charcoal-500">
                    No suggestions in the queue matching the selected status.
                  </td>
                </tr>
              ) : (
                filteredSuggestions.map((s) => {
                  const isSelected = selectedIds.has(s.id);
                  const isValid = s.validationStatus === "valid";
                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-charcoal-850/50 transition ${
                        isSelected ? "bg-brand-500/5" : ""
                      }`}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(s.id)}
                          className="rounded border-charcoal-700 text-brand-500 focus:ring-0"
                        />
                      </td>

                      <td className="px-4 py-3 max-w-xs truncate">
                        <div className="font-mono text-xs font-semibold text-charcoal-200 truncate">
                          {s.originalFilename}
                        </div>
                        <div className="text-[11px] text-charcoal-500 truncate" title={s.reason}>
                          Reason: {s.reason}
                        </div>
                      </td>

                      <td className="px-4 py-3 max-w-sm">
                        <div className="flex items-center gap-1.5 font-mono text-xs text-brand-300 font-semibold truncate">
                          <span>{s.destinationFolder ? `${s.destinationFolder}/` : ""}</span>
                          <span className="text-white">{s.suggestedName}</span>
                        </div>
                        <div className="text-[10px] text-charcoal-500 truncate font-mono">
                          Target: {s.targetPath}
                        </div>
                      </td>

                      <td className="px-4 py-3 shrink-0">
                        <span className="px-2 py-0.5 rounded bg-charcoal-800 text-charcoal-300 font-mono text-[10px] uppercase">
                          {s.category}
                        </span>
                      </td>

                      <td className="px-4 py-3 shrink-0 font-mono text-xs">
                        <span
                          className={
                            s.confidence >= 0.85
                              ? "text-brand-400 font-semibold"
                              : s.confidence >= 0.7
                              ? "text-amber-400"
                              : "text-red-400"
                          }
                        >
                          {(s.confidence * 100).toFixed(0)}%
                        </span>
                      </td>

                      <td className="px-4 py-3 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            isValid
                              ? "bg-brand-500/10 text-brand-400"
                              : "bg-red-500/10 text-red-300"
                          }`}
                          title={s.validationMessage}
                        >
                          {isValid ? "Valid" : s.validationStatus}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right shrink-0">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onEditSuggestion(s)}
                            className="p-1 rounded bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 transition"
                            title="Edit filename and folder"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {s.status !== "approved" && (
                            <button
                              onClick={() => onUpdateSuggestion(s.id, { status: "approved" })}
                              className="p-1 rounded bg-brand-950/40 hover:bg-brand-900/60 text-brand-400 transition"
                              title="Approve suggestion"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {s.status !== "rejected" && (
                            <button
                              onClick={() => onUpdateSuggestion(s.id, { status: "rejected" })}
                              className="p-1 rounded bg-red-950/40 hover:bg-red-900/60 text-red-400 transition"
                              title="Reject suggestion"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
