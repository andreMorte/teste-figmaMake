import JSZip from 'jszip';
import { UsabilityTest } from '../types';

export interface ExportFigmaMakeOptions {
  testId?: string;
  trackingId?: string;
  testName?: string;
  researcherName?: string;
  productName?: string;
  prototypeUrl?: string;
}

/**
 * Gera todos os arquivos do projeto de protótipo Figma Make (React + Vite + Tailwind + UXLab SDK)
 */
export function generateFigmaMakePrototypeFiles(options: ExportFigmaMakeOptions = {}): Record<string, string> {
  const testId = options.testId || 'TEST-001';
  const trackingId = options.trackingId || 'UX-001';
  const testName = options.testName || 'Simulador de Empréstimo com Garantia';
  const productName = options.productName || 'Fintech Mobile App';
  const researcherName = options.researcherName || 'Equipe UX Research';

  const packageJson = JSON.stringify(
    {
      name: 'figma-make-prototype',
      private: true,
      version: '1.0.0',
      description: `Protótipo interativo Figma Make instrumentado para UX Test Lab (${testId})`,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview'
      },
      dependencies: {
        react: '^19.0.0',
        'react-dom': '^19.0.0',
        'lucide-react': '^0.546.0'
      },
      devDependencies: {
        '@types/react': '^19.0.0',
        '@types/react-dom': '^19.0.0',
        '@vitejs/plugin-react': '^5.0.0',
        typescript: '~5.8.0',
        vite: '^6.2.0',
        tailwindcss: '^4.1.0',
        '@tailwindcss/vite': '^4.1.0'
      }
    },
    null,
    2
  );

  const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Configuração para Figma Make & Local Dev
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    host: true
  },
  build: {
    target: 'esnext',
    assetsDir: 'assets'
  }
});
`;

  const tsconfigJson = JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
        noFallthroughCasesInSwitch: true
      },
      include: ['src']
    },
    null,
    2
  );

  const indexHtml = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%232563eb'><path d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'/></svg>" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>${testName} - Figma Make Prototype</title>
    <!-- UXLab SDK Telemetry Hook Pre-init -->
    <script>
      window.UXLab = window.UXLab || {
        init: function(config) {
          window.__UXLAB_CONFIG__ = config;
          console.log('[UXLab SDK] Inicializado com sucesso para Figma Make:', config);
        },
        version: '2.4.0',
        testId: '${testId}',
        trackingId: '${trackingId}'
      };
    </script>
  </head>
  <body class="bg-slate-50 text-slate-900 antialiased min-h-screen select-none">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

  const indexCss = `@import "tailwindcss";

@layer base {
  body {
    margin: 0;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }
}
`;

  const mainTsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;

  const uxlabSdkTs = `/**
 * UXLab Telemetry & Interaction Capture SDK for Figma Make
 * Test ID: ${testId} | Tracking ID: ${trackingId}
 */

export interface UXLabEvent {
  eventType: 'CLICK' | 'SCREEN_VIEW' | 'TASK_SUCCESS' | 'TASK_ERROR' | 'BACK' | 'PAGE_VIEW';
  screen: string;
  element?: string;
  x?: number;
  y?: number;
  normalizedX?: number;
  normalizedY?: number;
  taskId?: string;
  metadata?: Record<string, any>;
}

class UXLabClient {
  private testId: string = '${testId}';
  private trackingId: string = '${trackingId}';
  private currentScreen: string = 'simulacao';
  private initialized: boolean = false;

  public init(config: { testId: string; trackingId: string }) {
    this.testId = config.testId;
    this.trackingId = config.trackingId;
    this.initialized = true;

    // Disparar confirmação de handshake
    this.sendToParent({
      type: 'UXLAB_SDK_CONNECTED',
      testId: this.testId,
      trackingId: this.trackingId,
      timestamp: new Date().toISOString(),
      status: 'connected'
    });

    // Anexar listener global de cliques para telemetria e mapa de calor
    if (typeof window !== 'undefined') {
      window.addEventListener('click', (e) => this.handleGlobalClick(e), true);
    }
  }

  public setScreen(screenName: string) {
    this.currentScreen = screenName;
    this.sendToParent({
      type: 'SCREEN_VIEW',
      screen: screenName,
      screenId: screenName,
      screenName: screenName,
      testId: this.testId,
      timestamp: new Date().toISOString()
    });
  }

  public completeTask(taskId: string, metadata?: Record<string, any>) {
    this.sendToParent({
      type: 'TASK_COMPLETED',
      taskId,
      testId: this.testId,
      screen: this.currentScreen,
      timestamp: new Date().toISOString(),
      metadata
    });
  }

  public reportError(taskId?: string, message?: string) {
    this.sendToParent({
      type: 'TASK_ERROR',
      taskId,
      screen: this.currentScreen,
      message,
      timestamp: new Date().toISOString()
    });
  }

  private handleGlobalClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null;
    const elementTag = target ? (target.getAttribute('data-tracking') || target.id || target.tagName.toLowerCase()) : 'unknown';
    const rect = target?.getBoundingClientRect();

    const x = Math.round(e.clientX);
    const y = Math.round(e.clientY);
    const normalizedX = window.innerWidth > 0 ? Math.round((x / window.innerWidth) * 1000) / 1000 : 0.5;
    const normalizedY = window.innerHeight > 0 ? Math.round((y / window.innerHeight) * 1000) / 1000 : 0.5;

    this.sendToParent({
      type: 'TRACK_EVENT',
      eventType: 'CLICK',
      screen: this.currentScreen,
      element: elementTag,
      x,
      y,
      normalizedX,
      normalizedY,
      testId: this.testId,
      trackingId: this.trackingId,
      timestamp: new Date().toISOString()
    });
  }

  private sendToParent(data: any) {
    try {
      if (typeof window !== 'undefined') {
        // Enviar para o parent (UXLab runner iframe)
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(data, '*');
        }
      }
    } catch (err) {
      console.warn('[UXLab SDK] postMessage error:', err);
    }
  }
}

export const uxlab = new UXLabClient();
`;

  const appTsx = `import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  Calculator, 
  ArrowRight, 
  CheckCircle2, 
  User, 
  FileText, 
  ChevronLeft,
  Sparkles,
  Lock,
  Percent,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { uxlab } from './uxlab-sdk';

export default function App() {
  // Telas da Jornada: 'simulacao' -> 'dados-proponente' -> 'revisao-proposta' -> 'proposta-enviada'
  const [currentScreen, setCurrentScreen] = useState<'simulacao' | 'dados-proponente' | 'revisao-proposta' | 'proposta-enviada'>('simulacao');

  // Estado da Simulação
  const [loanAmount, setLoanAmount] = useState<number>(150000);
  const [termMonths, setTermMonths] = useState<number>(120);
  const [propertyValue, setPropertyValue] = useState<number>(450000);

  // Estado dos Dados Cadastrais
  const [fullName, setFullName] = useState<string>('Carlos Eduardo Mendes');
  const [cpf, setCpf] = useState<string>('123.456.789-00');
  const [email, setEmail] = useState<string>('carlos.mendes@email.com');
  const [phone, setPhone] = useState<string>('(11) 98765-4321');
  const [income, setIncome] = useState<number>(12500);

  // Validação
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Inicializar SDK UXLab no Figma Make
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.UXLab = window.UXLab || { init: () => {} };
      window.UXLab.init({
        testId: '${testId}',
        trackingId: '${trackingId}'
      });
      uxlab.init({
        testId: '${testId}',
        trackingId: '${trackingId}'
      });
      console.log('[UXLab] Telemetria e mapa de calor ativos para o teste ${testId}');
    }
  }, []);

  // Notificar troca de tela
  useEffect(() => {
    uxlab.setScreen(currentScreen);
  }, [currentScreen]);

  // Cálculos Financeiros
  const monthlyRate = 0.0109; // 1.09% ao mês
  const estimatedMonthlyPayment = Math.round(
    (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, termMonths))) /
    (Math.pow(1 + monthlyRate, termMonths) - 1)
  );
  const totalAmountToPay = estimatedMonthlyPayment * termMonths;

  // Ações de Navegação e Conclusão de Tarefas
  const handleAdvanceToApplicant = () => {
    uxlab.completeTask('TASK-1', {
      loanAmount,
      termMonths,
      estimatedMonthlyPayment
    });
    setCurrentScreen('dados-proponente');
  };

  const handleAdvanceToReview = () => {
    const errors: string[] = [];
    if (!fullName.trim()) errors.push('Nome completo obrigatório');
    if (!cpf.trim()) errors.push('CPF obrigatório');
    if (income <= 0) errors.push('Informe a renda mensal');

    if (errors.length > 0) {
      setFormErrors(errors);
      uxlab.reportError('TASK-2', 'Validação de dados falhou');
      return;
    }

    setFormErrors([]);
    uxlab.completeTask('TASK-2', {
      fullName,
      cpf,
      income,
      propertyValue
    });
    setCurrentScreen('revisao-proposta');
  };

  const handleConfirmProposal = () => {
    uxlab.completeTask('TASK-3', {
      confirmed: true,
      protocol: 'PR-98214-SP'
    });
    setCurrentScreen('proposta-enviada');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-start p-4 sm:p-6 font-sans">
      {/* Top Banner Figma Make & UXLab Telemetry */}
      <header className="w-full max-w-xl bg-white border border-slate-200/80 rounded-2xl shadow-xs px-5 py-3 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">Porto • Crédito com Garantia</h1>
            <p className="text-[11px] text-slate-500 font-mono">Figma Make Prototype • ${testId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-[11px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            UXLab Ativo
          </span>
        </div>
      </header>

      {/* Container Principal do Protótipo */}
      <main className="w-full max-w-xl bg-white border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden flex flex-col">
        {/* Barra de Progresso da Jornada */}
        <div className="px-6 pt-5 pb-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className={\`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold \${
              currentScreen === 'simulacao' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
            }\`}>
              {currentScreen === 'simulacao' ? '1' : '✓'}
            </span>
            <span className="font-semibold text-slate-700">Simulação</span>
          </div>

          <div className="h-0.5 w-6 bg-slate-200" />

          <div className="flex items-center gap-2">
            <span className={\`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold \${
              currentScreen === 'dados-proponente' 
                ? 'bg-blue-600 text-white' 
                : currentScreen === 'revisao-proposta' || currentScreen === 'proposta-enviada'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 text-slate-500'
            }\`}>
              {currentScreen === 'revisao-proposta' || currentScreen === 'proposta-enviada' ? '✓' : '2'}
            </span>
            <span className="font-semibold text-slate-700">Proponente</span>
          </div>

          <div className="h-0.5 w-6 bg-slate-200" />

          <div className="flex items-center gap-2">
            <span className={\`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold \${
              currentScreen === 'revisao-proposta' 
                ? 'bg-blue-600 text-white' 
                : currentScreen === 'proposta-enviada'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 text-slate-500'
            }\`}>
              {currentScreen === 'proposta-enviada' ? '✓' : '3'}
            </span>
            <span className="font-semibold text-slate-700">Revisão</span>
          </div>
        </div>

        {/* TELA 1: SIMULAÇÃO */}
        {currentScreen === 'simulacao' && (
          <div className="p-6 space-y-6">
            <div>
              <div className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md mb-2">
                <Calculator className="w-3.5 h-3.5" />
                Tarefa 1: Simular Empréstimo
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Quanto você precisa emprestado?</h2>
              <p className="text-xs text-slate-500 mt-1">Taxas a partir de 1,09% a.m. com garantia do seu imóvel.</p>
            </div>

            {/* Slider de Valor */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Valor do Crédito</span>
                <span className="text-lg font-bold text-blue-600">
                  R$ {loanAmount.toLocaleString('pt-BR')}
                </span>
              </div>
              <input
                type="range"
                min="50000"
                max="1000000"
                step="10000"
                value={loanAmount}
                onChange={(e) => setLoanAmount(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
                data-tracking="slider-valor-credito"
              />
              <div className="flex justify-between text-[11px] text-slate-600 font-medium">
                <span>R$ 50.000</span>
                <span>R$ 1.000.000</span>
              </div>
            </div>

            {/* Seleção de Prazo */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Prazo de Pagamento</label>
              <div className="grid grid-cols-4 gap-2">
                {[60, 120, 180, 240].map((months) => (
                  <button
                    key={months}
                    type="button"
                    onClick={() => setTermMonths(months)}
                    className={\`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all \${
                      termMonths === months
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }\`}
                    data-tracking={\`btn-prazo-\${months}m\`}
                  >
                    {months} meses
                  </button>
                ))}
              </div>
            </div>

            {/* Resumo Estimado */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/70 to-indigo-50/70 border border-blue-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Parcela Estimada</span>
                <span className="text-2xl font-bold text-slate-900 tracking-tight">
                  R$ {estimatedMonthlyPayment.toLocaleString('pt-BR')}
                  <span className="text-xs font-normal text-slate-500"> /mês</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-500 font-medium block">Taxa Estimada</span>
                <span className="text-sm font-bold text-emerald-600">1,09% a.m.</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAdvanceToApplicant}
              className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
              data-tracking="btn-continuar-simulacao"
            >
              <span>Continuar Simulação</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TELA 2: DADOS DO PROPONENTE */}
        {currentScreen === 'dados-proponente' && (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md mb-1">
                  <User className="w-3.5 h-3.5" />
                  Tarefa 2: Preencher Dados do Proponente
                </div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Seus Dados Cadastrais</h2>
              </div>
              <button
                type="button"
                onClick={() => setCurrentScreen('simulacao')}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                data-tracking="btn-voltar-simulacao"
              >
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </button>
            </div>

            {formErrors.length > 0 && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formErrors.join(', ')}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  data-tracking="input-nome-completo"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">CPF</label>
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    data-tracking="input-cpf"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Celular</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    data-tracking="input-celular"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">E-mail Profissional</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  data-tracking="input-email"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Renda Mensal Comprovada (R$)</label>
                  <input
                    type="number"
                    value={income}
                    onChange={(e) => setIncome(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    data-tracking="input-renda-mensal"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor Estimado do Imóvel (R$)</label>
                  <input
                    type="number"
                    value={propertyValue}
                    onChange={(e) => setPropertyValue(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    data-tracking="input-valor-imovel"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAdvanceToReview}
              className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all mt-4"
              data-tracking="btn-avancar-revisao"
            >
              <span>Avançar para Revisão</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TELA 3: REVISÃO DE PROPOSTA */}
        {currentScreen === 'revisao-proposta' && (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md mb-1">
                  <FileText className="w-3.5 h-3.5" />
                  Tarefa 3: Revisar e Confirmar Envio
                </div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Resumo da sua Proposta</h2>
              </div>
              <button
                type="button"
                onClick={() => setCurrentScreen('dados-proponente')}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                data-tracking="btn-voltar-dados"
              >
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Valor do Empréstimo:</span>
                <span className="font-bold text-slate-900">R$ {loanAmount.toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Prazo Solicitado:</span>
                <span className="font-bold text-slate-900">{termMonths} meses</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Parcela Estimada:</span>
                <span className="font-bold text-blue-600">R$ {estimatedMonthlyPayment.toLocaleString('pt-BR')}/mês</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Proponente:</span>
                <span className="font-medium text-slate-800">{fullName} ({cpf})</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Garantia Imobiliária:</span>
                <span className="font-medium text-slate-800">Avaliada em R$ {propertyValue.toLocaleString('pt-BR')}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200/70 rounded-xl text-[11px] text-amber-800 leading-relaxed flex items-start gap-2">
              <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Ao confirmar, sua solicitação será enviada para análise automática de crédito e vistoria documental da garantia imobiliária.
              </span>
            </div>

            <button
              type="button"
              onClick={handleConfirmProposal}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
              data-tracking="btn-confirmar-proposta"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmar Envio da Proposta</span>
            </button>
          </div>
        )}

        {/* TELA 4: SUCESSO / CONCLUÍDO */}
        {currentScreen === 'proposta-enviada' && (
          <div className="p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-100 border-4 border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full mb-2">
                Jornada Concluída com Sucesso
              </span>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Proposta Enviada para Análise!</h2>
              <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
                Parabéns! Todas as tarefas do teste de usabilidade foram concluídas e a telemetria comportamental foi registrada pelo UXLab SDK.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs font-mono text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>Protocolo:</span>
                <span className="font-bold text-slate-800">PR-98214-SP</span>
              </div>
              <div className="flex justify-between">
                <span>Status da Análise:</span>
                <span className="text-blue-600 font-semibold">Em Análise Técnica</span>
              </div>
              <div className="flex justify-between">
                <span>Teste UXLab:</span>
                <span className="text-emerald-700 font-semibold">${testId} (Verificado)</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCurrentScreen('simulacao')}
              className="py-2.5 px-5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all"
              data-tracking="btn-reiniciar-simulador"
            >
              Reiniciar Simulação do Teste
            </button>
          </div>
        )}
      </main>

      {/* Rodapé Informativo */}
      <footer className="mt-6 text-center text-xs text-slate-600">
        Desenvolvido para execução e exportação no Figma Make • Totalmente instrumentado com o UXLab SDK
      </footer>
    </div>
  );
}
`;

  const readmeMd = `# Protótipo Figma Make (${testName})
**Instrumentado para UX Test Lab (ID: \`${testId}\` | Tracking: \`${trackingId}\`)**

Este pacote contém o projeto completo em **React 19 + TypeScript + Vite + Tailwind CSS**, já configurado com a instrumentação de telemetria em tempo real do **UXLab SDK**.

---

## 🚀 Como importar no Figma Make

1. Abra seu espaço no **Figma Make** (ou publique em seu domínio \`*.figma.site\`).
2. Copie os arquivos deste pacote para a estrutura do seu projeto:
   - \`src/App.tsx\` (Componente com as telas interativas da jornada e eventos de teste)
   - \`src/uxlab-sdk.ts\` (SDK de telemetria e mensageria postMessage)
   - \`src/main.tsx\` e \`src/index.css\`
   - \`index.html\`
   - \`package.json\` e \`vite.config.ts\`
3. No painel de publicação do Figma Make, confirme a geração do deploy navegável.
4. Utilize a URL gerada (ex: \`https://seu-prototipo.figma.site\`) no **UX Test Lab** para validação imediata no Verifier Handshake e execução com participantes!

---

## 💻 Como executar e testar localmente

Se desejar executar este protótipo na sua máquina local:

\`\`\`bash
# 1. Instalar as dependências
npm install

# 2. Iniciar o servidor de desenvolvimento Vite
npm run dev
\`\`\`

Acesse \`http://localhost:3000\` no seu navegador.

---

## 📊 Instrumentação e Handshake UXLab

O protótipo já contém a inicialização necessária para o handshake automático:

\`\`\`tsx
useEffect(() => {
  window.UXLab = window.UXLab || { init: () => {} };
  window.UXLab.init({
    testId: "${testId}",
    trackingId: "${trackingId}"
  });
}, []);
\`\`\`

Todas as interações de clique geram eventos com coordenadas (\`x\`, \`y\`, \`normalizedX\`, \`normalizedY\`), trocas de telas e taxas de sucesso das tarefas.
`;

  return {
    'package.json': packageJson,
    'vite.config.ts': viteConfig,
    'tsconfig.json': tsconfigJson,
    'index.html': indexHtml,
    'src/main.tsx': mainTsx,
    'src/index.css': indexCss,
    'src/uxlab-sdk.ts': uxlabSdkTs,
    'src/App.tsx': appTsx,
    'README.md': readmeMd
  };
}

/**
 * Cria o arquivo ZIP binário do projeto Figma Make utilizando JSZip
 */
export async function createFigmaMakeZip(options: ExportFigmaMakeOptions = {}): Promise<Blob> {
  const zip = new JSZip();
  const files = generateFigmaMakePrototypeFiles(options);

  // Adicionar arquivos à estrutura do ZIP
  Object.entries(files).forEach(([filePath, content]) => {
    zip.file(filePath, content);
  });

  // Gerar o blob binário do ZIP
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  return blob;
}

/**
 * Dispara o download automático do arquivo ZIP no navegador do usuário
 */
export async function downloadFigmaMakeZip(options: ExportFigmaMakeOptions = {}): Promise<string> {
  const testId = options.testId || 'TEST-001';
  const filename = `figma-make-prototype-${testId}.zip`;

  const blob = await createFigmaMakeZip(options);
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Revogar a URL temporária após o download
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return filename;
}
