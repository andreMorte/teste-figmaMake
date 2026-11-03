import { useState } from 'react';
import {
  AlertOctagon,
  Copy,
  Check,
  Code2,
  FileText,
  HelpCircle,
  ArrowRight,
  BookOpen
} from 'lucide-react';
import { VerificationResult } from '../types';

interface RemediationGuideProps {
  result: VerificationResult;
}

export function RemediationGuide({ result }: RemediationGuideProps) {
  const [activeTab, setActiveTab] = useState<'react' | 'html'>('react');
  const [copied, setCopied] = useState(false);

  const remediation = result.remediation;
  if (!remediation) return null;

  const currentCode = activeTab === 'react'
    ? remediation.codeSnippetReact
    : remediation.codeSnippetHtml;

  const copyCode = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const isMismatch = result.verdict === 'MISCONFIGURED';

  return (
    <div
      id="remediation-guide-card"
      className="bg-[#0d0d0d] rounded-xl border border-rose-500/30 shadow-2xl shadow-rose-500/5 p-5 md:p-7 space-y-5"
    >
      <div className="flex items-start gap-3.5 pb-4 border-b border-[#222]">
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
          <AlertOctagon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/15 text-rose-400 uppercase tracking-widest border border-rose-500/30">
              {isMismatch ? 'Configuração Incorreta' : 'SDK Não Detectado'}
            </span>
            <span className="text-xs text-[#666] font-mono">
              Acesso ao teste de usabilidade bloqueado
            </span>
          </div>
          <h3 className="text-base font-bold text-[#e5e5e5] uppercase tracking-wide mt-1">
            {remediation.reason}
          </h3>
          <p className="text-xs text-[#888] mt-0.5">
            {remediation.suggestedAction}
          </p>
        </div>
      </div>

      {/* Diagnostics Comparison Table if mismatch */}
      {isMismatch && (
        <div className="p-4 rounded-lg bg-black border border-amber-500/20 text-xs font-mono">
          <h4 className="font-bold text-amber-400 mb-2.5 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            Tabela Comparativa de Parâmetros
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-[#0a0a0a] p-3 rounded border border-[#222]">
              <span className="text-[10px] uppercase font-bold text-[#666] block tracking-wider">
                Test ID
              </span>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[#888]">Esperado:</span>
                <span className="font-mono font-bold text-blue-400">
                  {result.request.testId}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[#888]">No Protótipo:</span>
                <span
                  className={`font-mono font-bold ${
                    result.detectedParameters.isTestIdMatch
                      ? 'text-green-400'
                      : 'text-rose-400 underline'
                  }`}
                >
                  {result.detectedParameters.testIdFound || '(Não encontrado)'}
                </span>
              </div>
            </div>

            <div className="bg-[#0a0a0a] p-3 rounded border border-[#222]">
              <span className="text-[10px] uppercase font-bold text-[#666] block tracking-wider">
                Tracking ID
              </span>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[#888]">Esperado:</span>
                <span className="font-mono font-bold text-blue-400">
                  {result.request.trackingId}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[#888]">No Protótipo:</span>
                <span
                  className={`font-mono font-bold ${
                    result.detectedParameters.isTrackingIdMatch
                      ? 'text-green-400'
                      : 'text-rose-400 underline'
                  }`}
                >
                  {result.detectedParameters.trackingIdFound || '(Não encontrado)'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Code Snippet to Copy */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-black rounded-lg border border-[#222] w-fit">
            <button
              type="button"
              id="tab-code-react"
              onClick={() => setActiveTab('react')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-semibold transition-all ${
                activeTab === 'react'
                  ? 'bg-[#1c1c1c] text-white border border-[#333]'
                  : 'text-[#666] hover:text-[#ccc]'
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-blue-400" />
              Figma Make (App.tsx)
            </button>
            <button
              type="button"
              id="tab-code-html"
              onClick={() => setActiveTab('html')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-semibold transition-all ${
                activeTab === 'html'
                  ? 'bg-[#1c1c1c] text-white border border-[#333]'
                  : 'text-[#666] hover:text-[#ccc]'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-green-400" />
              HTML Clássico (index.html)
            </button>
          </div>

          <button
            type="button"
            id="copy-remediation-code-btn"
            onClick={copyCode}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] font-mono"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Código Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Snippet Formatado</span>
              </>
            )}
          </button>
        </div>

        <div className="relative rounded-lg bg-black text-green-300 font-mono text-xs p-4 overflow-x-auto border border-green-900/30">
          <pre className="text-[12px] leading-relaxed select-all">
            {currentCode}
          </pre>
        </div>
      </div>

      {/* How to deploy in Figma Make guide */}
      <div className="p-4 rounded-lg bg-[#111] border border-[#222] text-xs text-[#888] space-y-2 font-mono">
        <h4 className="font-bold text-[#e5e5e5] flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
          <BookOpen className="w-3.5 h-3.5 text-blue-400" />
          Passo a Passo para Instrumentar no Figma Make:
        </h4>
        <ol className="list-decimal list-inside space-y-1.5 text-[#888] pl-1">
          <li>
            Abra seu projeto no <strong className="text-[#ccc]">Figma Make</strong> e acesse a aba de código (<code className="font-mono bg-black text-blue-400 border border-[#222] px-1 py-0.5 rounded">App.tsx</code>).
          </li>
          <li>
            Cole a inicialização do SDK com o <strong className="text-blue-400">testId</strong> e <strong className="text-blue-400">trackingId</strong> configurados acima dentro de um <code className="font-mono bg-black text-blue-400 border border-[#222] px-1 py-0.5 rounded">useEffect</code>.
          </li>
          <li>
            Clique em <strong className="text-[#ccc]">Publish / Share Prototype</strong> para compilar um novo bundle JavaScript.
          </li>
          <li>
            Copie a URL atualizada e execute a verificação novamente neste motor.
          </li>
        </ol>
      </div>
    </div>
  );
}
