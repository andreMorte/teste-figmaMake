import { useState } from 'react';
import { X, BookOpen, Copy, Check, Terminal, Shield, CheckCircle2, FolderArchive, Download } from 'lucide-react';
import { downloadFigmaMakeZip } from '../services/figmaMakeExportService';

interface SdkDocsModalProps {
  onClose: () => void;
  testId?: string;
  trackingId?: string;
  testName?: string;
}

export function SdkDocsModal({ onClose, testId = 'TEST-U92DU', trackingId = 'UX-QK8UY', testName = 'Protótipo Figma Make' }: SdkDocsModalProps) {
  const [copied, setCopied] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const handleDownloadZip = async () => {
    try {
      setDownloadingZip(true);
      await downloadFigmaMakeZip({ testId, trackingId, testName });
    } catch (err) {
      console.error('Falha ao baixar zip do Figma Make:', err);
    } finally {
      setDownloadingZip(false);
    }
  };

  const snippet = `// 1. Instalação e Inicialização do UXLab SDK no Figma Make (App.tsx)
import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    // Inicialização da instrumentação em tempo de execução
    if (typeof window !== 'undefined') {
      window.UXLab = window.UXLab || { init: () => {} };
      UXLab.init({
        testId: "${testId}",
        trackingId: "${trackingId}"
      });
      console.log("[UXLab] Telemetria e mapa de calor ativos para o teste ${testId}");
    }
  }, []);

  return (
    <div className="prototype-container">
      {/* Telas e componentes do protótipo */}
    </div>
  );
}`;

  const copy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] w-full max-w-3xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-[#282828]">
        <div className="px-6 py-4 border-b border-[#222] flex items-center justify-between bg-[#0d0d0d]">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-xs font-bold text-[#e5e5e5] uppercase tracking-wider font-mono">
                Guia de Especificação & Instrumentação do SDK UXLab
              </h3>
              <p className="text-xs text-[#666]">
                Como integrar protótipos Figma Make para aprovação automática no Handshake
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-[#666] hover:text-white hover:bg-[#1c1c1c] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-xs text-[#aaa]">
          <div className="p-3.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-200 space-y-1">
            <h4 className="font-semibold flex items-center gap-1.5 text-xs text-blue-400 font-mono uppercase tracking-wider">
              <Shield className="w-4 h-4 text-blue-400" />
              Protocolo de Handshake UXLab
            </h4>
            <p className="text-blue-200/90 leading-relaxed font-mono text-[11px]">
              O motor de verificação inspeciona tanto o HTML quanto os bundles JavaScript compilados (<code className="font-mono bg-black px-1.5 py-0.5 rounded text-blue-300 border border-blue-900/40">/assets/*.js</code>) procurando pela assinatura exata: <code className="font-mono font-semibold bg-black px-1.5 py-0.5 rounded text-blue-300 border border-blue-900/40">UXLab.init(&#123; testId: "...", trackingId: "..." &#125;)</code>.
            </p>
          </div>

          {/* Download Zip Direct Box */}
          <div className="p-3.5 rounded-lg bg-gradient-to-r from-purple-950/40 to-indigo-950/40 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-purple-300 font-mono font-bold text-xs">
                <FolderArchive className="w-4 h-4 text-purple-400" />
                <span>Download do Projeto Figma Make Pronto (.zip)</span>
              </div>
              <p className="text-[11px] text-purple-200/70 font-mono">
                Baixe o template React/Vite completo, já com uxlab-sdk.ts, App.tsx e IDs {testId} configurados.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={downloadingZip}
              className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-bold transition-all shadow-[0_0_12px_rgba(147,51,234,0.3)] disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloadingZip ? 'Gerando .zip...' : 'Baixar .zip'}</span>
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-[#e5e5e5] uppercase tracking-wider text-[11px] font-mono flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                Snippet para App.tsx (Figma Make)
              </span>
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-1 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-[0_0_12px_rgba(59,130,246,0.3)]"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>

            <pre className="p-4 rounded-lg bg-black text-green-300 font-mono text-xs overflow-x-auto leading-relaxed border border-green-900/30 select-all">
              {snippet}
            </pre>
          </div>

          <div className="space-y-2 border-t border-[#222] pt-4 font-mono">
            <h4 className="font-bold text-[#e5e5e5] text-xs uppercase tracking-wider">Critérios de Aprovação:</h4>
            <ul className="space-y-1.5 text-[#888]">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                <span><strong className="text-[#ccc]">URL Pública:</strong> A URL deve responder HTTP 200 sem necessidade de credenciais corporativas.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                <span><strong className="text-[#ccc]">Bundles Compilados:</strong> O script precisa estar presente no código principal empacotado.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                <span><strong className="text-[#ccc]">Correspondência de IDs:</strong> O <code className="font-mono text-blue-400 bg-black border border-[#222] px-1 py-0.5 rounded">testId</code> e o <code className="font-mono text-blue-400 bg-black border border-[#222] px-1 py-0.5 rounded">trackingId</code> devem ser idênticos aos cadastrados na plataforma de teste.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
