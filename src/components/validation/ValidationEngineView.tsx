import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Layers,
  HelpCircle,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { VerificationRequest, VerificationResult } from '../../types';
import { VerificationForm } from '../VerificationForm';
import { HandshakePipeline } from '../HandshakePipeline';
import { VerifiedReleaseCard } from '../VerifiedReleaseCard';
import { RemediationGuide } from '../RemediationGuide';
import { BundlesTable } from '../BundlesTable';
import { PrototypePreviewModal } from '../PrototypePreviewModal';
import { SdkDocsModal } from '../SdkDocsModal';
import { HistoryPanel } from '../HistoryDrawer';

interface ValidationEngineViewProps {
  initialUrl?: string;
  initialTestId?: string;
  initialTrackingId?: string;
  onBackToDashboard?: () => void;
}

export const ValidationEngineView: React.FC<ValidationEngineViewProps> = ({
  initialUrl,
  initialTestId,
  initialTrackingId,
  onBackToDashboard
}) => {
  const [request, setRequest] = useState<VerificationRequest>({
    prototypeUrl: initialUrl || '/api/mock/figma-valid',
    testId: initialTestId || 'TEST-U92DU',
    trackingId: initialTrackingId || 'UX-QK8UY'
  });

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [activeTab, setActiveTab] = useState<'handshake' | 'bundles'>('handshake');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showDocs, setShowDocs] = useState(false);
  const [history, setHistory] = useState<Array<{
    id: string;
    timestamp: string;
    request: VerificationRequest;
    verdict: string;
    verified: boolean;
  }>>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('uxlab_verification_history');
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch {
      // Ignore local storage error
    }
  }, []);

  const handleSelectPreset = (preset: 'valid' | 'mismatch' | 'nosdk' | 'figma') => {
    if (preset === 'valid') {
      setRequest({
        prototypeUrl: '/api/mock/figma-valid',
        testId: 'TEST-U92DU',
        trackingId: 'UX-QK8UY'
      });
    } else if (preset === 'figma') {
      setRequest({
        prototypeUrl: 'https://drums-baste-72876355.figma.site/',
        testId: 'TEST-U92DU',
        trackingId: 'UX-QK8UY'
      });
    } else if (preset === 'mismatch') {
      setRequest({
        prototypeUrl: '/api/mock/figma-mismatch',
        testId: 'TEST-U92DU',
        trackingId: 'UX-QK8UY'
      });
    } else if (preset === 'nosdk') {
      setRequest({
        prototypeUrl: '/api/mock/figma-missing-sdk',
        testId: 'TEST-U92DU',
        trackingId: 'UX-QK8UY'
      });
    }
  };

  const handleClear = () => {
    setRequest({
      prototypeUrl: '',
      testId: '',
      trackingId: ''
    });
    setResult(null);
  };

  const runVerification = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!request.prototypeUrl.trim() || !request.testId.trim() || !request.trackingId.trim()) {
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      const data: VerificationResult = await response.json();
      setResult(data);

      const newHistoryItem = {
        id: `HIST-${Date.now().toString(36)}`,
        timestamp: new Date().toISOString(),
        request: { ...request },
        verdict: data.verdict,
        verified: data.verified
      };

      setHistory((prev) => {
        const updated = [newHistoryItem, ...prev.filter(h => h.request.prototypeUrl !== request.prototypeUrl)].slice(0, 15);
        try {
          localStorage.setItem('uxlab_verification_history', JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
    } catch (err: any) {
      setResult({
        verified: false,
        verdict: 'UNREACHABLE',
        timestamp: new Date().toISOString(),
        request,
        summaryMessage: `Erro inesperado na chamada do motor de verificação: ${err?.message || 'Falha de comunicação'}`,
        steps: [
          {
            id: 'step-1-fetch',
            name: 'Passo 1: Leitura do HTML e Conectividade',
            description: 'Falha ao executar o agente de verificação.',
            status: 'error',
            details: err?.message || 'Erro de rede'
          }
        ],
        discoveredScripts: [],
        detectedParameters: {
          testIdFound: null,
          trackingIdFound: null,
          isTestIdMatch: false,
          isTrackingIdMatch: false
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222] pb-5">
        <div>
          <div className="flex items-center gap-2">
            {onBackToDashboard && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="p-1.5 rounded-lg bg-[#141414] hover:bg-[#202020] text-[#888] hover:text-white mr-1"
                title="Voltar ao Dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h1 className="text-xl font-bold font-mono text-[#f5f5f5] uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-400" />
              UX Test Lab Verification Engine
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-green-500/10 text-green-400 border border-green-500/30 font-bold uppercase">
              Zero Falso-Verdadeiro
            </span>
          </div>
          <p className="text-xs text-[#888] font-mono mt-1">
            Inspeção estática e em tempo de execução de protótipos Figma Make. Validação de bundles <code className="text-blue-400">/assets/*.js</code> e confirmação de <code className="text-blue-400">UXLab.init</code>.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDocs(true)}
            className="px-3 py-1.5 rounded-lg bg-[#141414] hover:bg-[#1f1f1f] text-blue-400 border border-blue-500/30 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Docs do SDK</span>
          </button>
        </div>
      </div>

      {/* Verification Form Console */}
      <VerificationForm
        request={request}
        onChange={(updates) => setRequest((prev) => ({ ...prev, ...updates }))}
        onSubmit={runVerification}
        isLoading={isLoading}
        onClear={handleClear}
      />

      {/* Verification Results Console */}
      {result && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Release Card if verified */}
          {result.verified ? (
            <VerifiedReleaseCard result={result} onOpenPreview={(url) => setPreviewUrl(url)} />
          ) : (
            <RemediationGuide result={result} />
          )}

          {/* Detailed Verification Tabs (Handshake vs Bundles) */}
          <div className="bg-[#0d0d0d] border border-[#222] rounded-xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222] px-4 py-2 bg-[#121212]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('handshake')}
                  className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 ${
                    activeTab === 'handshake'
                      ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                      : 'text-[#888] hover:text-[#ddd] hover:bg-[#1a1a1a]'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Pipeline de Handshake (4 Passos)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('bundles')}
                  className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 ${
                    activeTab === 'bundles'
                      ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                      : 'text-[#888] hover:text-[#ddd] hover:bg-[#1a1a1a]'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>
                    Bundles Compilados ({result.discoveredScripts.length})
                  </span>
                </button>
              </div>

              <div className="text-[11px] font-mono text-[#666] hidden sm:block">
                Verificado em: {new Date(result.timestamp).toLocaleTimeString()}
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {activeTab === 'handshake' ? (
                <HandshakePipeline steps={result.steps} />
              ) : (
                <BundlesTable
                  scripts={result.discoveredScripts}
                  prototypeUrl={request.prototypeUrl}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* History of Verifications */}
      <HistoryPanel
        history={history}
        onSelect={(item) => {
          setRequest(item.request);
        }}
        onClear={() => {
          setHistory([]);
          localStorage.removeItem('uxlab_verification_history');
        }}
      />

      {/* Modals */}
      {previewUrl && (
        <PrototypePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />
      )}

      {showDocs && <SdkDocsModal onClose={() => setShowDocs(false)} />}
    </div>
  );
};
