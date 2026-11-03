import React, { useState } from 'react';
import {
  X,
  Download,
  FolderArchive,
  FileCode,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Layers,
  Sparkles,
  Terminal,
  ShieldCheck,
  PackageCheck,
  ArrowDownToLine,
  Loader2
} from 'lucide-react';
import { downloadFigmaMakeZip, generateFigmaMakePrototypeFiles } from '../../services/figmaMakeExportService';
import { UsabilityTest } from '../../types';

interface FigmaMakeExportModalProps {
  onClose: () => void;
  tests: UsabilityTest[];
  activeTestId?: string;
}

export const FigmaMakeExportModal: React.FC<FigmaMakeExportModalProps> = ({
  onClose,
  tests,
  activeTestId
}) => {
  const defaultTest = tests.find((t) => t.id === activeTestId) || tests[0] || {
    id: 'TEST-001',
    trackingId: 'UX-001',
    name: 'Avaliação de Usabilidade do Protótipo Real',
    productName: 'Simulador de Empréstimo com Garantia',
    researcherName: 'Equipe de UX Research'
  };

  const [selectedTestId, setSelectedTestId] = useState<string>(defaultTest.id);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'app' | 'sdk' | 'readme'>('overview');
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const currentTest = tests.find((t) => t.id === selectedTestId) || defaultTest;

  const files = generateFigmaMakePrototypeFiles({
    testId: currentTest.id,
    trackingId: currentTest.trackingId,
    testName: currentTest.name,
    productName: currentTest.productName,
    researcherName: currentTest.researcherName
  });

  const handleDownload = async () => {
    try {
      setDownloading(true);
      // Dispara o download do ZIP
      await downloadFigmaMakeZip({
        testId: currentTest.id,
        trackingId: currentTest.trackingId,
        testName: currentTest.name,
        productName: currentTest.productName,
        researcherName: currentTest.researcherName
      });
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error('Erro ao gerar o ZIP:', err);
      // Fallback para endpoint do backend
      window.open(`/api/export/figma-make/${currentTest.id}`, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const fileList = [
    { name: 'package.json', desc: 'Configuração de dependências React 19 + Vite + Tailwind', size: '~600 B' },
    { name: 'vite.config.ts', desc: 'Configuração do bundler Vite para Figma Make', size: '~320 B' },
    { name: 'tsconfig.json', desc: 'Configuração TypeScript para o protótipo', size: '~540 B' },
    { name: 'index.html', desc: 'HTML de entrada com gancho de telemetria UXLab', size: '~980 B' },
    { name: 'src/main.tsx', desc: 'Ponto de entrada React DOM', size: '~240 B' },
    { name: 'src/index.css', desc: 'Estilização Tailwind CSS v4', size: '~210 B' },
    { name: 'src/App.tsx', desc: 'Jornada navegável com formulários e 3 tarefas do teste', size: '~14 KB' },
    { name: 'src/uxlab-sdk.ts', desc: 'SDK UXLab de mensageria e telemetria de cliques em tempo real', size: '~3.2 KB' },
    { name: 'README.md', desc: 'Instruções de importação no Figma Make e execução local', size: '~1.8 KB' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">Exportar para Figma Make (.zip)</h2>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/40">
                  Pronto para Download
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Gere e baixe o pacote completo com código React/Vite navegável e SDK UXLab integrado.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-xs flex-1">
          {/* Seletor de Teste */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1">
                Selecione o Estudo / Teste para Instrumentação:
              </label>
              <select
                value={selectedTestId}
                onChange={(e) => setSelectedTestId(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 w-full sm:w-80"
              >
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} - {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Badges */}
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="px-2 py-1 rounded bg-purple-50 text-purple-700 border border-purple-200">
                Test ID: <strong>{currentTest.id}</strong>
              </span>
              <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
                Tracking ID: <strong>{currentTest.trackingId}</strong>
              </span>
            </div>
          </div>

          {/* Download Action Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50 via-indigo-50/50 to-blue-50 border border-purple-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="space-y-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-purple-900 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Pacote ZIP Pronto: figma-make-prototype-{currentTest.id}.zip</span>
              </div>
              <p className="text-slate-600 max-w-lg leading-relaxed">
                Contém todos os 9 arquivos do projeto, com telas navegáveis em React 19, Vite, Tailwind CSS v4 e telemetria de cliques em tempo real já configurada.
              </p>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
              >
                {downloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Gerando ZIP...</span>
                  </>
                ) : downloadSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Download Concluído!</span>
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="w-4 h-4" />
                    <span>Baixar Arquivo ZIP (.zip)</span>
                  </>
                )}
              </button>

              <a
                href={`/api/export/figma-make/${currentTest.id}`}
                download={`figma-make-prototype-${currentTest.id}.zip`}
                className="px-3 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Download direto via API do servidor"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Link Direto</span>
              </a>
            </div>
          </div>

          {/* Abas de Inspeção */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 bg-slate-50">
              <div className="flex space-x-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`py-3 px-3.5 font-semibold text-xs border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'overview'
                      ? 'border-purple-600 text-purple-700 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Conteúdo do Arquivo ZIP (9 arquivos)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('app')}
                  className={`py-3 px-3.5 font-semibold text-xs border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'app'
                      ? 'border-purple-600 text-purple-700 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Código App.tsx</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('sdk')}
                  className={`py-3 px-3.5 font-semibold text-xs border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'sdk'
                      ? 'border-purple-600 text-purple-700 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>uxlab-sdk.ts</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('readme')}
                  className={`py-3 px-3.5 font-semibold text-xs border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'readme'
                      ? 'border-purple-600 text-purple-700 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>README.md</span>
                </button>
              </div>

              {activeTab !== 'overview' && (
                <button
                  type="button"
                  onClick={() => copyCode(activeTab === 'app' ? files['src/App.tsx'] : activeTab === 'sdk' ? files['src/uxlab-sdk.ts'] : files['README.md'])}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono font-medium transition-colors"
                >
                  {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSnippet ? 'Copiado!' : 'Copiar'}</span>
                </button>
              )}
            </div>

            <div className="p-4">
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <p className="text-slate-600 leading-relaxed">
                    Abaixo está a lista exata dos arquivos incluídos na raiz do arquivo <strong>.zip</strong>. Você pode extrair e importar no Figma Make ou abrir com qualquer IDE:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {fileList.map((file) => (
                      <div
                        key={file.name}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 flex items-start gap-3 transition-colors"
                      >
                        <div className="p-2 rounded-lg bg-white border border-slate-200/80 text-purple-600 shrink-0">
                          <FileCode className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono font-bold text-slate-900 truncate">{file.name}</span>
                            <span className="text-[10px] text-slate-600 font-mono shrink-0">{file.size}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{file.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 mt-2">
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <PackageCheck className="w-4 h-4 text-emerald-600" />
                      Como usar este protótipo no Figma Make:
                    </h4>
                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 leading-relaxed">
                      <li>Extraia o arquivo <strong>figma-make-prototype-{currentTest.id}.zip</strong> no seu computador.</li>
                      <li>Importe os arquivos ou copie o código de <strong>App.tsx</strong> para o seu projeto no Figma Make.</li>
                      <li>Publique o site no Figma Make (ex: <code>https://seu-prototipo.figma.site</code>).</li>
                      <li>O protótipo já se conecta automaticamente ao teste <strong>{currentTest.id}</strong> com o tracking <strong>{currentTest.trackingId}</strong>!</li>
                    </ol>
                  </div>
                </div>
              )}

              {activeTab === 'app' && (
                <div className="relative">
                  <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-96 leading-relaxed select-all">
                    {files['src/App.tsx']}
                  </pre>
                </div>
              )}

              {activeTab === 'sdk' && (
                <div className="relative">
                  <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-96 leading-relaxed select-all">
                    {files['src/uxlab-sdk.ts']}
                  </pre>
                </div>
              )}

              {activeTab === 'readme' && (
                <div className="relative">
                  <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-96 leading-relaxed select-all">
                    {files['README.md']}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Formato: <strong>Arquivo .zip padrão</strong> compativel com Figma Make, Vite e React 19
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
            >
              {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowDownToLine className="w-3.5 h-3.5" />}
              <span>Baixar ZIP</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
