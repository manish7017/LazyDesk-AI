import React from "react";
import { History, RotateCcw, FolderCheck, AlertCircle, FileText, Check } from "lucide-react";
import type { ScanRecord, OperationLog } from "@lazydesk/shared";

interface ScanHistoryViewProps {
  scans: ScanRecord[];
  operations: OperationLog[];
  onRollback: (operationId: string) => Promise<void>;
  onSelectScan: (scanId: string) => Promise<void>;
}

export const ScanHistoryView: React.FC<ScanHistoryViewProps> = ({
  scans,
  operations,
  onRollback,
  onSelectScan,
}) => {
  return (
    <div className="space-y-6">
      {/* Previous Scans Card */}
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-charcoal-800 bg-charcoal-850 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-semibold text-charcoal-100">
              Workspace Scan Records ({scans.length})
            </h3>
          </div>
          <span className="text-xs text-charcoal-500 font-mono">Persistent SQLite Ledger</span>
        </div>

        <div className="divide-y divide-charcoal-800/80">
          {scans.length === 0 ? (
            <div className="py-12 text-center text-charcoal-500 text-xs">
              No previous scan records found.
            </div>
          ) : (
            scans.map((scan) => (
              <div
                key={scan.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-charcoal-850/50 transition cursor-pointer"
                onClick={() => onSelectScan(scan.id)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-semibold text-charcoal-200 truncate">
                      {scan.folderPath}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        scan.status === "completed"
                          ? "bg-brand-500/10 text-brand-400"
                          : "bg-amber-500/10 text-amber-300"
                      }`}
                    >
                      {scan.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-charcoal-500 font-mono">
                    <span>{scan.totalFiles} files</span>
                    <span>•</span>
                    <span>{scan.duplicateCount} duplicates</span>
                    <span>•</span>
                    <span>{new Date(scan.startedAt).toLocaleString()}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectScan(scan.id);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-charcoal-700 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 text-xs font-medium transition shrink-0"
                >
                  Load Scan Results
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recoverable Operation Journal */}
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-charcoal-800 bg-charcoal-850 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FolderCheck className="w-4 h-4 text-brand-400" />
              <h3 className="text-sm font-semibold text-charcoal-100">
                Recoverable Operation Journal ({operations.length})
              </h3>
            </div>
            <p className="text-xs text-charcoal-500 mt-0.5">
              Every file relocation is tracked with original and resulting paths. Rollback restores files to their exact previous location.
            </p>
          </div>
        </div>

        <div className="divide-y divide-charcoal-800/80">
          {operations.length === 0 ? (
            <div className="py-12 text-center text-charcoal-500 text-xs">
              No operations recorded in the journal yet.
            </div>
          ) : (
            operations.map((op) => (
              <div
                key={op.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-charcoal-850/50 transition text-xs"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        op.status === "applied"
                          ? "bg-brand-500/10 text-brand-400"
                          : op.status === "rolled_back"
                          ? "bg-blue-500/10 text-blue-300"
                          : "bg-red-500/10 text-red-300"
                      }`}
                    >
                      {op.status.replace("_", " ")}
                    </span>
                    <span className="text-charcoal-500 font-mono text-[11px]">
                      {new Date(op.appliedAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="font-mono text-charcoal-300 truncate">
                    <span className="text-charcoal-500 text-[11px]">Source: </span>
                    {op.sourcePath}
                  </div>
                  {op.targetPath && (
                    <div className="font-mono text-brand-400/90 truncate">
                      <span className="text-charcoal-500 text-[11px]">Destination: </span>
                      {op.targetPath}
                    </div>
                  )}
                  {op.error && (
                    <div className="text-red-400 text-[11px] flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{op.error}</span>
                    </div>
                  )}
                </div>

                {op.status === "applied" && (
                  <button
                    onClick={() => onRollback(op.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-charcoal-700 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 text-xs font-mono font-medium transition shrink-0"
                    title="Rollback this operation"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Rollback</span>
                  </button>
                )}

                {op.status === "rolled_back" && (
                  <span className="text-[11px] font-mono text-charcoal-500 shrink-0">
                    Restored
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
