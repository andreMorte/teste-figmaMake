import { History, CheckCircle2, XCircle, AlertTriangle, ArrowRight, Trash2 } from 'lucide-react';
import { VerificationRequest } from '../types';

interface HistoryItem {
  id: string;
  timestamp: string;
  request: VerificationRequest;
  verdict: string;
  verified: boolean;
}

interface HistoryPanelProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
}

export function HistoryPanel({ history, onSelect, onClear }: HistoryPanelProps) {
  if (history.length === 0) return null;

  return (
    <div className="bg-[#0d0d0d] rounded-xl border border-[#222] shadow-2xl p-4 md:p-5">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#222]">
        <h3 className="text-xs font-bold text-[#e5e5e5] uppercase tracking-widest font-mono flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-blue-400" />
          Execution History Log
        </h3>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] font-mono text-[#666] hover:text-rose-400 flex items-center gap-1 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          Limpar
        </button>
      </div>

      <div className="space-y-2">
        {history.slice(0, 5).map((item) => {
          const isSuccess = item.verified;
          const time = new Date(item.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });

          return (
            <div
              key={item.id}
              onClick={() => onSelect(item)}
              className="p-2.5 rounded-lg border border-[#222] bg-black/40 hover:border-[#383838] hover:bg-[#121212] cursor-pointer transition-all flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5 truncate">
                {isSuccess ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                ) : item.verdict === 'MISCONFIGURED' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <div className="truncate">
                  <div className="font-mono text-xs text-[#e5e5e5] truncate max-w-xs">
                    {item.request.prototypeUrl}
                  </div>
                  <div className="text-[10px] font-mono text-[#666] flex items-center gap-2 mt-0.5">
                    <span className="text-blue-400">{item.request.testId}</span>
                    <span>•</span>
                    <span className="text-blue-400">{item.request.trackingId}</span>
                    <span>•</span>
                    <span>{time}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                    isSuccess
                      ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {isSuccess ? 'Aprovado' : item.verdict}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#555]" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
