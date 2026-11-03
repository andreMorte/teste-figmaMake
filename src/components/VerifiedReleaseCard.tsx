import { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Sparkles,
  Smartphone,
  Eye,
  ShieldCheck,
  Calendar,
  Layers
} from 'lucide-react';
import { VerificationResult } from '../types';

interface VerifiedReleaseCardProps {
  result: VerificationResult;
  onOpenPreview: (url: string) => void;
}

export function VerifiedReleaseCard({ result, onOpenPreview }: VerifiedReleaseCardProps) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const authorizedUrl = result.usabilitySession?.authorizedUrl || '';
  const token = result.usabilitySession?.token || 'UXL-AUTH';
  const expiresAt = result.usabilitySession?.expiresAt
    ? new Date(result.usabilitySession.expiresAt).toLocaleTimeString()
    : '24 horas';

  const copyToClipboard = () => {
    if (!authorizedUrl) return;
    navigator.clipboard.writeText(authorizedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Generate lightweight SVG QR Code visual
  const qrSvgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    authorizedUrl
  )}&bgcolor=ffffff&color=1e293b`;

  return (
    <div
      id="verified-release-card"
      className="bg-[#0d0d0d] rounded-xl border border-green-500/30 shadow-2xl shadow-green-500/5 p-5 md:p-7 overflow-hidden relative"
    >
      {/* Decorative top accent badge */}
      <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-blue-500 via-green-500 to-emerald-400" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#222]">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-400 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-green-500/15 text-green-400 uppercase tracking-widest border border-green-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Handshake Success: Proxy Link Ready
              </span>
              <span className="text-xs text-[#888] font-mono">
                Token: <strong className="text-green-400 font-semibold">{token}</strong>
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[#e5e5e5] uppercase tracking-wide mt-1">
              Link de Teste de Usabilidade Liberado
            </h2>
            <p className="text-xs text-[#888]">
              O protótipo Figma Make está devidamente instrumentado com o SDK UXLab e pronto para coleta de métricas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowQr(!showQr)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono border transition-all ${
              showQr
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-[#141414] hover:bg-[#1f1f1f] text-[#aaa] border-[#2a2a2a]'
            }`}
          >
            <QrCode className="w-4 h-4 text-blue-400" />
            <span>{showQr ? 'Ocultar QR Code' : 'QR Code para Mobile'}</span>
          </button>
        </div>
      </div>

      {/* Authorized URL Box */}
      <div className="my-5 p-4 rounded-lg bg-black border border-blue-900/30 space-y-3">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="font-semibold text-blue-400 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            <Sparkles className="w-3.5 h-3.5" />
            Public Proxy Tunnel (UXLab Runner)
          </span>
          <span className="text-[10px] text-[#666] flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Válido até: {expiresAt}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-1 px-3 py-2.5 rounded bg-[#0a0a0a] border border-[#222] text-xs font-mono text-blue-400 truncate select-all">
            {authorizedUrl}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              id="copy-authorized-url-btn"
              onClick={copyToClipboard}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)]"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Link</span>
                </>
              )}
            </button>

            <a
              id="open-test-new-tab-btn"
              href={result.prototypeMetadata?.finalUrl || result.request.prototypeUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded bg-[#161616] hover:bg-[#202020] text-[#ccc] text-xs font-medium border border-[#2a2a2a] transition-all"
              title="Abrir o protótipo verificado em nova aba"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir Protótipo</span>
            </a>

            <button
              type="button"
              onClick={() => onOpenPreview(result.prototypeMetadata?.finalUrl || result.request.prototypeUrl)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded bg-[#161616] hover:bg-[#202020] text-[#ccc] text-xs font-medium border border-[#2a2a2a] transition-all"
              title="Visualizar em modo simulador com sandbox"
            >
              <Eye className="w-3.5 h-3.5 text-blue-400" />
              <span>Preview</span>
            </button>
          </div>
        </div>
      </div>

      {/* QR Code expansion for mobile testing */}
      {showQr && (
        <div className="p-4 mb-5 rounded-lg bg-[#111] border border-[#222] flex flex-col sm:flex-row items-center gap-4">
          <div className="p-2 bg-white rounded border border-[#333]">
            <img
              src={qrSvgUrl}
              alt="QR Code do Teste de Usabilidade"
              className="w-32 h-32 object-contain"
              loading="lazy"
            />
          </div>
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-xs font-bold text-[#e5e5e5] uppercase tracking-wider font-mono flex items-center justify-center sm:justify-start gap-1.5">
              <Smartphone className="w-4 h-4 text-blue-400" />
              Acesso Móvel para Participantes
            </h4>
            <p className="text-xs text-[#888]">
              Aponte a câmera do smartphone para abrir a sessão de teste instrumentada diretamente no navegador mobile.
            </p>
            <p className="text-[11px] text-[#666] font-mono">
              Captura toques, navegação de frames e rolagem em tempo real.
            </p>
          </div>
        </div>
      )}

      {/* Parameter Verification Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
        <div className="p-3.5 rounded-lg bg-black border border-[#222]">
          <span className="text-[10px] font-bold text-[#666] uppercase tracking-wider block">
            Test ID Verificado
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            <Check className="w-3.5 h-3.5 text-green-400" />
            <span className="font-mono font-bold text-green-400 text-sm">
              {result.detectedParameters.testIdFound}
            </span>
          </div>
          <span className="text-[10px] text-green-500/80 font-medium mt-0.5 block">
            ✓ Corresponde à configuração do teste
          </span>
        </div>

        <div className="p-3.5 rounded-lg bg-black border border-[#222]">
          <span className="text-[10px] font-bold text-[#666] uppercase tracking-wider block">
            Tracking ID Verificado
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            <Check className="w-3.5 h-3.5 text-green-400" />
            <span className="font-mono font-bold text-green-400 text-sm">
              {result.detectedParameters.trackingIdFound}
            </span>
          </div>
          <span className="text-[10px] text-green-500/80 font-medium mt-0.5 block">
            ✓ Rastreamento ativo para este projeto
          </span>
        </div>

        <div className="p-3.5 rounded-lg bg-black border border-[#222] sm:col-span-2 lg:col-span-1">
          <span className="text-[10px] font-bold text-[#666] uppercase tracking-wider block flex items-center gap-1">
            <Layers className="w-3 h-3 text-[#666]" />
            Bundle Localizado
          </span>
          <div className="mt-1 font-mono text-[#ccc] text-xs truncate">
            {result.detectedParameters.matchedInFile || 'Bundle React Compilado'}
          </div>
          <span className="text-[10px] text-[#666] mt-0.5 block">
            Compilação Figma Make / Vite
          </span>
        </div>
      </div>

      {/* Code Snippet Evidence Box */}
      {result.detectedParameters.matchedSnippet && (
        <div className="mt-3 p-3.5 rounded-lg bg-black text-gray-300 font-mono text-xs border border-green-900/30 overflow-x-auto">
          <div className="text-[10px] text-green-400 font-bold uppercase tracking-wider mb-1 font-mono">
            Evidência de Execução Detectada no Bundle:
          </div>
          <span className="text-green-300 font-semibold">{result.detectedParameters.matchedSnippet}</span>
        </div>
      )}
    </div>
  );
}
