import React from 'react';
import { Globe, Hash, Activity, Search, RefreshCw, Sparkles, ExternalLink } from 'lucide-react';
import { VerificationRequest } from '../types';

interface VerificationFormProps {
  request: VerificationRequest;
  onChange: (updates: Partial<VerificationRequest>) => void;
  onSubmit: (e?: React.FormEvent) => void;
  isLoading: boolean;
  onClear: () => void;
}

export function VerificationForm({
  request,
  onChange,
  onSubmit,
  isLoading,
  onClear
}: VerificationFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(e);
  };

  const isFormValid =
    request.prototypeUrl.trim().length > 0 &&
    request.testId.trim().length > 0 &&
    request.trackingId.trim().length > 0;

  return (
    <form
      id="verification-form"
      onSubmit={handleSubmit}
      className="bg-[#0d0d0d] rounded-xl border border-[#222] shadow-2xl p-5 md:p-6"
    >
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#222]">
        <div>
          <h2 className="text-sm font-bold text-[#e5e5e5] uppercase tracking-widest flex items-center gap-2 font-mono">
            <Search className="w-4 h-4 text-blue-400" />
            Input Parameters
          </h2>
          <p className="text-xs text-[#666] mt-0.5">
            Informe a URL do protótipo Figma Make e os identificadores para inspeção do SDK UXLab
          </p>
        </div>

        <button
          type="button"
          id="clear-form-btn"
          onClick={onClear}
          className="text-xs font-mono text-[#666] hover:text-[#bbb] px-2.5 py-1 rounded border border-transparent hover:border-[#333] hover:bg-[#161616] transition-all"
        >
          Limpar Campos
        </button>
      </div>

      <div className="space-y-4">
        {/* Prototype URL Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="prototypeUrl-input"
              className="block text-[10px] text-[#888] uppercase font-mono tracking-wider"
            >
              1. Prototype URL (Figma Make ou Web)
            </label>
            <span className="text-[11px] text-[#555] font-mono">
              Ex: drums-baste-72876355.figma.site
            </span>
          </div>

          <div className="relative rounded-lg">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#555]">
              <Globe className="w-4 h-4" />
            </div>
            <input
              type="text"
              id="prototypeUrl-input"
              value={request.prototypeUrl}
              onChange={(e) => onChange({ prototypeUrl: e.target.value })}
              placeholder="https://sua-url.figma.site/ ou /api/mock/figma-valid"
              required
              className="block w-full pl-10 pr-24 py-2.5 bg-black hover:border-[#444] focus:border-blue-500 text-xs text-blue-400 placeholder:text-[#444] border border-[#333] rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all font-mono leading-relaxed"
            />
            {request.prototypeUrl.startsWith('http') && (
              <a
                href={request.prototypeUrl}
                target="_blank"
                rel="noreferrer"
                className="absolute inset-y-0 right-2 flex items-center px-2.5 my-1 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded font-mono text-xs transition-colors border border-transparent hover:border-blue-500/20"
                title="Abrir URL em nova aba"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                Abrir
              </a>
            )}
          </div>
          <p className="text-[11px] text-[#666] mt-1 font-mono">
            O motor fará o download do HTML e inspecionará os bundles <code className="text-blue-400 font-mono bg-black border border-[#222] px-1 py-0.5 rounded">/assets/*.js</code> gerados pelo Figma Make.
          </p>
        </div>

        {/* Identifiers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Test ID */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="testId-input"
                className="block text-[10px] text-[#888] uppercase font-mono tracking-wider"
              >
                2. Test ID
              </label>
              <button
                type="button"
                onClick={() => onChange({ testId: 'TEST-U92DU' })}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-mono tracking-wide hover:underline"
              >
                Usar TEST-U92DU
              </button>
            </div>
            <div className="relative rounded-lg">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#555]">
                <Hash className="w-4 h-4" />
              </div>
              <input
                type="text"
                id="testId-input"
                value={request.testId}
                onChange={(e) => onChange({ testId: e.target.value.trim() })}
                placeholder="ex: TEST-U92DU"
                required
                className="block w-full pl-10 pr-3 py-2.5 bg-black hover:border-[#444] focus:border-blue-500 text-xs text-[#e5e5e5] placeholder:text-[#444] border border-[#333] rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all font-mono uppercase"
              />
            </div>
            <p className="text-[11px] text-[#666] mt-1 font-mono">
              Esperado: <code className="text-blue-400 font-mono bg-black border border-[#222] px-1 py-0.5 rounded">UXLab.init(&#123; testId: "{request.testId || 'TEST-...'}" &#125;)</code>
            </p>
          </div>

          {/* Tracking ID */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="trackingId-input"
                className="block text-[10px] text-[#888] uppercase font-mono tracking-wider"
              >
                3. Tracking ID
              </label>
              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                <button
                  type="button"
                  onClick={() => onChange({ trackingId: 'UX-QK8UY' })}
                  className="text-blue-400 hover:text-blue-300 hover:underline"
                >
                  UX-QK8UY
                </button>
                <span className="text-[#444]">|</span>
                <button
                  type="button"
                  onClick={() => onChange({ trackingId: 'UX-DIXD8' })}
                  className="text-blue-400 hover:text-blue-300 hover:underline"
                >
                  UX-DIXD8
                </button>
              </div>
            </div>
            <div className="relative rounded-lg">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#555]">
                <Activity className="w-4 h-4" />
              </div>
              <input
                type="text"
                id="trackingId-input"
                value={request.trackingId}
                onChange={(e) => onChange({ trackingId: e.target.value.trim() })}
                placeholder="ex: UX-QK8UY"
                required
                className="block w-full pl-10 pr-3 py-2.5 bg-black hover:border-[#444] focus:border-blue-500 text-xs text-[#e5e5e5] placeholder:text-[#444] border border-[#333] rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all font-mono uppercase"
              />
            </div>
            <p className="text-[11px] text-[#666] mt-1 font-mono">
              Esperado: <code className="text-blue-400 font-mono bg-black border border-[#222] px-1 py-0.5 rounded">trackingId: "{request.trackingId || 'UX-...'}"</code>
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-[#1c1c1c]">
          <div className="text-xs text-[#666] flex items-center gap-1.5 font-mono">
            <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>Inspeção AST e decodificação profunda de pacotes minificados.</span>
          </div>

          <button
            type="submit"
            id="start-verification-btn"
            disabled={!isFormValid || isLoading}
            className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded font-bold text-xs uppercase tracking-widest transition-all ${
              !isFormValid || isLoading
                ? 'bg-[#1a1a1a] text-[#555] border border-[#262626] cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] active:scale-[0.99]'
            }`}
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                <span>Inspecionando Bundles...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Validar Instrumentação UXLab</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
