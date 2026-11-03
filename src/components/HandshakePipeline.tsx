import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  Terminal,
  FileCode2,
  Cpu,
  Fingerprint,
  KeyRound
} from 'lucide-react';
import { HandshakeStep } from '../types';

interface HandshakePipelineProps {
  steps: HandshakeStep[];
  isLoading?: boolean;
}

const stepIcons: Record<string, React.ElementType> = {
  'step-1-fetch': FileCode2,
  'step-2-bundles': Cpu,
  'step-3-sdk': Terminal,
  'step-4-params': Fingerprint,
  'step-5-release': KeyRound
};

export function HandshakePipeline({ steps, isLoading = false }: HandshakePipelineProps) {
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  const toggleStep = (id: string) => {
    setExpandedStepId(expandedStepId === id ? null : id);
  };

  const getStatusIcon = (status: HandshakeStep['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-rose-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      default:
        return <Clock className="w-5 h-5 text-[#555]" />;
    }
  };

  const getStatusBadge = (status: HandshakeStep['status']) => {
    switch (status) {
      case 'success':
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded bg-green-500/10 text-green-400 border border-green-500/30">
            Aprovado
          </span>
        );
      case 'error':
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
            Falha
          </span>
        );
      case 'warning':
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
            Atenção
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded bg-[#181818] text-[#777] border border-[#282828]">
            Pendente
          </span>
        );
    }
  };

  return (
    <div className="bg-[#0d0d0d] rounded-xl border border-[#222] shadow-2xl p-5 md:p-6">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#222]">
        <div>
          <h3 className="text-xs font-bold text-[#e5e5e5] uppercase tracking-widest font-mono flex items-center gap-2">
            <Terminal className="w-4 h-4 text-blue-400" />
            Execution Logic Log (Handshake Pipeline)
          </h3>
          <p className="text-xs text-[#666] mt-0.5">
            Inspeção sequencial de código-fonte, bundles React/Figma Make e inicialização do SDK UXLab
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-[#888] bg-black px-2.5 py-1 rounded border border-[#222]">
            {steps.filter(s => s.status === 'success').length}/{steps.length} Aprovados
          </span>
          <div className="hidden sm:flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#333]" />
            <div className="w-2 h-2 rounded-full bg-[#333]" />
            <div className="w-2 h-2 rounded-full bg-[#333]" />
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {steps.map((step, idx) => {
          const Icon = stepIcons[step.id] || Terminal;
          const isExpanded = expandedStepId === step.id;

          return (
            <div
              key={step.id}
              className={`rounded-lg border transition-all ${
                step.status === 'success'
                  ? 'border-green-500/20 bg-green-500/5 hover:border-green-500/30'
                  : step.status === 'error'
                  ? 'border-rose-500/20 bg-rose-500/5 hover:border-rose-500/30'
                  : step.status === 'warning'
                  ? 'border-amber-500/20 bg-amber-500/5 hover:border-amber-500/30'
                  : 'border-[#222] bg-black/40 hover:border-[#333]'
              }`}
            >
              <button
                type="button"
                id={`step-toggle-${step.id}`}
                onClick={() => toggleStep(step.id)}
                className="w-full text-left p-3.5 flex items-start sm:items-center justify-between gap-3"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <div className="mt-0.5 sm:mt-0">{getStatusIcon(step.status)}</div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#e5e5e5] tracking-wide font-mono">
                        {step.name}
                      </span>
                      {getStatusBadge(step.status)}
                      {step.latencyMs !== undefined && (
                        <span className="text-[10px] font-mono text-[#666]">
                          {step.latencyMs}ms
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#888] mt-0.5 line-clamp-1 font-mono">
                      {step.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {step.details && (
                    <span className="text-[#666]">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </span>
                  )}
                </div>
              </button>

              {isExpanded && step.details && (
                <div className="px-4 pb-3.5 pt-2 text-xs text-[#aaa] border-t border-[#222] bg-black/70 rounded-b-lg space-y-2.5">
                  <div className="p-3 rounded bg-black text-gray-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap border border-[#222] leading-relaxed">
                    {step.details}
                  </div>

                  {step.data && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {step.data.expected && (
                        <div className="p-2.5 rounded bg-[#0d0d0d] border border-[#262626]">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-[#666] block font-bold">
                            Valores Esperados
                          </span>
                          <pre className="text-[11px] font-mono text-blue-400 mt-1">
                            {JSON.stringify(step.data.expected, null, 2)}
                          </pre>
                        </div>
                      )}
                      {step.data.detected && (
                        <div className="p-2.5 rounded bg-[#0d0d0d] border border-[#262626]">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-[#666] block font-bold">
                            Valores Detectados no Bundle
                          </span>
                          <pre className="text-[11px] font-mono text-emerald-400 mt-1">
                            {JSON.stringify(step.data.detected, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
