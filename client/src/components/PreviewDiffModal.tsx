import React from "react";
import { X, ArrowRight, ShieldCheck, AlertTriangle, CheckCircle } from "lucide-react";
import type { AISuggestion } from "@lazydesk/shared";

interface PreviewDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmApply: () => void;
  suggestions: AISuggestion[];
  isApplying: boolean;
}

export const PreviewDiffModal: React.FC<PreviewDiffModalProps> = ({
  isOpen,
  onClose,
  onConfirmApply,
  suggestions,
  isApplying,
}) => {
  if (!isOpen) return null;

  const validCount = suggestions.filter((s) => s.validationStatus === "valid").length;
  const invalidCount = suggestions.length - validCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-charcoal-900 border border-charcoal-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-charcoal-800 bg-charcoal-850">
          <div>
            <div className="flex items-center gap-2 text-charcoal-100 font-semibold text-sm">
              <ShieldCheck className="w-4 h-4 text-brand-400" />
              <span>Review Planned File Operations ({suggestions.length})</span>
            </div>
            <p className="text-xs text-charcoal-400 mt-0.5">
              Operations will be applied sequentially and recorded in the rollback journal.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-charcoal-400 hover:text-charcoal-200 hover:bg-charcoal-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status banner */}
        <div className="px-6 py-3 bg-charcoal-950 border-b border-charcoal-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-brand-400">
              <CheckCircle className="w-4 h-4" /> {validCount} Safe Operations
            </span>
            {invalidCount > 0 && (
              <span className="flex items-center gap-1.5 text-amber-400">
                <AlertTriangle className="w-4 h-4" /> {invalidCount} Needs Attention / Collisions
              </span>
            )}
          </div>
          <span className="text-charcoal-500 font-mono text-[11px]">
            Zero data loss • 100% Undoable
          </span>
        </div>

        {/* Diff List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {suggestions.map((s) => {
            const isValid = s.validationStatus === "valid";
            return (
              <div
                key={s.id}
                className={`p-3.5 rounded-lg border text-xs space-y-2 transition ${
                  isValid
                    ? "bg-charcoal-850/70 border-charcoal-800"
                    : "bg-red-950/20 border-red-800/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-charcoal-800 text-charcoal-300 font-mono text-[11px]">
                    {s.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                        isValid
                          ? "bg-brand-500/10 text-brand-300"
                          : "bg-red-500/10 text-red-300"
                      }`}
                    >
                      {isValid ? "Ready" : s.validationMessage || s.validationStatus}
                    </span>
                    <span className="text-[11px] text-charcoal-500 font-mono">
                      {(s.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-2 items-center font-mono">
                  <div className="bg-charcoal-950 px-3 py-2 rounded border border-charcoal-800/80 truncate text-charcoal-400">
                    <span className="text-charcoal-600 block text-[10px] uppercase">
                      Current
                    </span>
                    <span className="text-charcoal-300 truncate block">
                      {s.originalFilename}
                    </span>
                  </div>

                  <div className="flex justify-center text-charcoal-600">
                    <ArrowRight className="w-4 h-4" />
                  </div>

                  <div className="bg-charcoal-950 px-3 py-2 rounded border border-brand-500/30 truncate text-brand-300">
                    <span className="text-charcoal-600 block text-[10px] uppercase">
                      Proposed Target
                    </span>
                    <span className="truncate block font-semibold">
                      {s.destinationFolder ? `${s.destinationFolder}/` : ""}
                      {s.suggestedName}
                    </span>
                  </div>
                </div>

                <div className="text-charcoal-400 text-[11px] italic">
                  Rationale: "{s.reason}"
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-charcoal-800 bg-charcoal-850">
          <p className="text-xs text-charcoal-500">
            Files will be moved sequentially. Safe directory traversal guaranteed.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2 rounded-lg border border-charcoal-700 text-charcoal-300 hover:bg-charcoal-800 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              onClick={onConfirmApply}
              disabled={isApplying || validCount === 0}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-charcoal-950 text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{isApplying ? "Applying Changes..." : `Apply ${validCount} Changes`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
