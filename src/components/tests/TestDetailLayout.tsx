import React, { useState, useEffect } from 'react';
import {
  UsabilityTest,
  TaskMetricsDetail,
  SusResult,
  SyntheticPersona,
  UXInsight,
  ParticipantSession,
  FunnelStage,
  HeatmapPoint,
  ComponentClickZone,
  ScreenHeatmapData
} from '../../types';
import {
  getTestResults,
  getInsights,
  getSyntheticPersonas,
  runAiAnalysis
} from '../../services/dataService';
import { getShareableTestUrl } from '../../utils/figmaUtils';
import { JourneyVisualizer } from '../analytics/JourneyVisualizer';
import { OverviewPanel } from '../analytics/OverviewPanel';
import { HeatmapExplorer } from '../analytics/HeatmapExplorer';
import {
  Activity,
  Award,
  Clock,
  MousePointer,
  RotateCcw,
  AlertTriangle,
  Compass,
  ArrowRight,
  TrendingDown,
  Sparkles,
  Users,
  Bot,
  FileText,
  ShieldCheck,
  Play,
  Share2,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  Eye,
  Calendar,
  Layers,
  Flame,
  CheckCircle2,
  XCircle,
  BarChart3,
  ExternalLink,
  Globe,
  HelpCircle,
  FolderArchive
} from 'lucide-react';
import { FigmaMakeExportModal } from '../export/FigmaMakeExportModal';

interface TestDetailLayoutProps {
  testId: string;
  onNavigate: (view: string, testId?: string) => void;
  onOpenRunner: (testId: string, customPrototypeUrl?: string) => void;
  onOpenValidationEngine: (prototypeUrl: string, testId: string, trackingId: string) => void;
  onOpenParticipant?: (participantKey: string) => void;
}

export const TestDetailLayout: React.FC<TestDetailLayoutProps> = ({
  testId,
  onNavigate,
  onOpenRunner,
  onOpenValidationEngine,
  onOpenParticipant
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'journey' | 'heatmaps' | 'sus' | 'participants' | 'insights'>('overview');
  const [loading, setLoading] = useState(true);
  const [test, setTest] = useState<UsabilityTest | null>(null);
  const [taskMetrics, setTaskMetrics] = useState<TaskMetricsDetail[]>([]);
  const [susResult, setSusResult] = useState<SusResult | null>(null);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [screenHeatmaps, setScreenHeatmaps] = useState<ScreenHeatmapData[]>([]);
  const [componentZones, setComponentZones] = useState<ComponentClickZone[]>([]);
  const [sessions, setSessions] = useState<ParticipantSession[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [personas, setPersonas] = useState<SyntheticPersona[]>([]);
  const [insights, setInsights] = useState<UXInsight[]>([]);

  // Session Detail Modal
  const [selectedSession, setSelectedSession] = useState<ParticipantSession | null>(null);

  // AI Analysis trigger state
  const [aiRunning, setAiRunning] = useState(false);
  const [aiReport, setAiReport] = useState<any | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedProtoLink, setCopiedProtoLink] = useState(false);
  const [isExportFigmaOpen, setIsExportFigmaOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const res = await getTestResults(testId);
      setTest(res.test);
      setTaskMetrics(res.taskMetrics);
      setSusResult(res.susResult);
      setFunnel(res.funnel);
      setHeatmap(res.heatmap);
      setSessions(res.sessions);
      setIsDemo(!!res.isDemo);
      if (res.screenHeatmaps) setScreenHeatmaps(res.screenHeatmaps);
      if (res.componentZones) setComponentZones(res.componentZones);

      const pers = await getSyntheticPersonas(testId);
      setPersonas(pers);

      const ins = await getInsights(testId);
      setInsights(ins);

      setLoading(false);
    }
    loadData();
  }, [testId]);

  // Nome legível do cenário (mapeado no protótipo) a partir do screenId
  const screenLabel = (screenId: string) => {
    const mapped = test?.screenMap?.find((sc) => sc.screenId === screenId);
    if (mapped) return mapped.screenName;
    for (const t of test?.tasks || []) {
      const d = t.expectedPathDetails?.find((x) => x.screenId === screenId);
      if (d) return d.screenName;
    }
    return screenId;
  };

  const handleRunAi = async () => {
    setAiRunning(true);
    const result = await runAiAnalysis(testId);
    setAiReport(result);
    setAiRunning(false);
    setActiveTab('insights');
  };

  const copyShareLink = () => {
    const url = getShareableTestUrl(testId);
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyPrototypeUrl = () => {
    if (!test?.prototypeUrl) return;
    navigator.clipboard.writeText(test.prototypeUrl);
    setCopiedProtoLink(true);
    setTimeout(() => setCopiedProtoLink(false), 2000);
  };

  if (loading || !test) {
    return (
      <div className="p-16 text-center text-sm font-medium text-slate-500 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto mb-3" />
        Carregando métricas do teste {testId}...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Test Top Banner & Master Header */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-5">
        <div className="flex flex-col gap-5">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold tracking-wide ${
                test.status === 'Ativo'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                {test.status}
              </span>
              <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                {test.id}
              </span>
              <span className="text-xs text-slate-300">•</span>
              <span className="text-xs font-medium text-slate-600">
                {test.productName}
              </span>
              <span className="text-xs text-slate-300">•</span>
              <span className="text-xs text-slate-500">
                Pesquisador: <span className="font-medium text-slate-700">{test.researcherName}</span>
              </span>
            </div>

            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {test.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
              <strong className="text-slate-800 font-semibold">Objetivo de Pesquisa:</strong> {test.researchGoal}
            </p>

            {/* Prototype Link Quick Reference */}
            {test.prototypeUrl && (
              <div className="flex items-center gap-2 text-xs pt-1 text-slate-500 flex-wrap">
                <Globe className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="font-semibold text-slate-700">Protótipo Cadastrado:</span>
                <span className="font-mono text-purple-700 truncate max-w-xs sm:max-w-md bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                  {test.prototypeUrl}
                </span>
                <a
                  href={test.prototypeUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 hover:underline"
                  title="Abrir o link do protótipo que foi colocado e validado em uma nova aba"
                >
                  <span>Abrir Protótipo em Nova Aba</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Link que vai para os participantes */}
            <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <Share2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="font-semibold text-slate-700">Link dos participantes:</span>
              <span className="font-mono text-blue-700 truncate max-w-xs sm:max-w-md bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                {getShareableTestUrl(test.id)}
              </span>
              <button type="button" onClick={copyShareLink} className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 hover:underline">
                {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedLink ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
          </div>

        </div>

        {/* Global Navigation Tabs inside Test */}
        <div className="flex flex-wrap items-center gap-1 pt-3 border-t border-slate-100">
          {[
            { key: 'overview', label: 'Visão Geral & KPIs', icon: Activity },
            { key: 'tasks', label: 'Tarefas Cadastradas', icon: Layers },
            { key: 'journey', label: 'Jornada & Funil', icon: Compass },
            { key: 'heatmaps', label: 'Zoneamento & Heatmap', icon: Flame },
            { key: 'sus', label: 'SUS & Comportamento', icon: Sparkles },
            { key: 'participants', label: `Participantes (${sessions.length})`, icon: Users },
            { key: 'insights', label: 'IA UX Researcher', icon: Bot }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: VISÃO GERAL & KPIS */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && test && (
        <OverviewPanel test={test} sessions={sessions} isDemo={isDemo} onOpenTab={(tab) => setActiveTab(tab)} onOpenParticipant={onOpenParticipant} />
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TAREFAS CADASTRADAS */}
      {/* ========================================================================= */}
      {activeTab === 'tasks' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Detalhamento de Métricas e Caminhos por Tarefa
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              {taskMetrics.length} tarefas analisadas
            </span>
          </div>

          <div className="space-y-4">
            {taskMetrics.map((task) => {
              const fullTask = test.tasks.find((t) => t.id === task.taskId);
              return (
                <div
                  key={task.taskId}
                  className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          {task.taskId}
                        </span>
                        <h3 className="text-base font-bold text-slate-900">
                          {task.title}
                        </h3>
                      </div>
                      {fullTask && (
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          {fullTask.instruction}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-semibold">Sucesso</span>
                        <span className="font-bold text-emerald-600 text-sm">{task.successRate}%</span>
                      </div>
                      <div className="border-l border-slate-100 pl-4">
                        <span className="text-[10px] text-slate-400 block uppercase font-semibold">Tempo Médio</span>
                        <span className="font-bold text-slate-800 text-sm font-mono">{task.averageTimeSeconds}s</span>
                      </div>
                    </div>
                  </div>

                  {/* Path Comparison: Ideal vs Most Used */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Ideal Path */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-700 font-semibold flex items-center gap-1.5">
                          <Compass className="w-3.5 h-3.5 text-blue-600" />
                          <span>Caminho Ideal (expectedPath)</span>
                        </span>
                        <span className="text-blue-700 font-bold">{task.idealPathRate}% dos usuários</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {task.expectedPath.map((step, idx) => (
                          <React.Fragment key={idx}>
                            <span className="px-2.5 py-1 rounded-lg bg-white text-slate-700 border border-slate-200 text-xs font-medium shadow-xs" title={step}>
                              {screenLabel(step)}
                            </span>
                            {idx < task.expectedPath.length - 1 && (
                              <span className="text-slate-400 font-bold">→</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>

                    {/* Most Used Path */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-700 font-semibold flex items-center gap-1.5">
                          <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                          <span>Caminho Mais Utilizado</span>
                        </span>
                        <span className="text-amber-700 font-bold">
                          {task.pathFrequencies[0]?.percentage}% adesão
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {task.mostUsedPath.map((step, idx) => (
                          <React.Fragment key={idx}>
                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border shadow-xs ${
                                step === 'coberturas' && task.taskId === 'TASK-2'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300 font-bold'
                                  : 'bg-white text-slate-700 border-slate-200'
                              }`}
                              title={step}
                            >
                              {screenLabel(step)}
                            </span>
                            {idx < task.mostUsedPath.length - 1 && (
                              <span className="text-amber-500 font-bold">→</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Path Breakdown frequencies */}
                  <div className="pt-2 text-xs space-y-2">
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">
                      Frequência de Caminhos Percorridos pelos Participantes:
                    </span>
                    {task.pathFrequencies.map((pf, pIdx) => (
                      <div key={pIdx} className="flex items-center justify-between text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                        <span className="truncate pr-2 text-[11px]" title={pf.path.join(' → ')}>{pf.path.map(screenLabel).join(' → ')}</span>
                        <span className="font-semibold text-slate-900 shrink-0 text-xs">{pf.count} usuários ({pf.percentage}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: JORNADA, FUNIL & DROP-OFF */}
      {/* ========================================================================= */}
      {activeTab === 'journey' && (
        <div className="space-y-6">
          {/* Visual Journey Flow — dados reais + prints dos cenários mapeados */}
          {test && <JourneyVisualizer test={test} sessions={sessions} screenHeatmaps={screenHeatmaps} isDemo={isDemo} />}

          {/* Interactive Loss Funnel */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-rose-600" />
              <span>Funil de Perda Interativo (Drop-off Analysis)</span>
            </h3>

            <div className="space-y-3.5 text-xs">
              {funnel.map((stage, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-medium text-slate-800">{stage.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-900 font-bold">{stage.count} usuários ({stage.percentage}%)</span>
                      {stage.dropoffPercentage > 0 && (
                        <span className="text-rose-600 font-bold">-{stage.dropoffPercentage}% dropoff</span>
                      )}
                    </div>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        idx === 0 ? 'bg-blue-600' : idx === funnel.length - 1 ? 'bg-emerald-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${stage.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: ZONEAMENTO DE CLIQUES EM COMPONENTES & HEATMAP COMPORTAMENTAL */}
      {/* ========================================================================= */}
      {activeTab === 'heatmaps' && test && (
        <HeatmapExplorer test={test} sessions={sessions} points={heatmap as any} screenHeatmaps={screenHeatmaps as any} isDemo={isDemo} />
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SISTEMA SUS & CORRELAÇÃO PSICOMÉTRICA */}
      {/* ========================================================================= */}
      {activeTab === 'sus' && susResult && (
        <div className="space-y-6">
          {/* Main SUS Score Card */}
          <div className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md font-semibold border border-amber-200 uppercase tracking-wider inline-block">
                System Usability Scale (SUS) Oficial
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Pontuação Geral de Usabilidade
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-xl leading-relaxed">
                Calculado com a fórmula psicométrica padrão de John Brooke (0 a 100), ponderando 10 questões em escala Likert de 1 a 5.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-amber-50/50 border border-amber-200 text-center min-w-[200px] shadow-xs">
              <div className="text-5xl font-extrabold text-amber-600 tracking-tight">
                {susResult.averageScore}
              </div>
              <div className="mt-2 inline-block px-3 py-1 rounded-full text-xs font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                {susResult.classification}
              </div>
              <div className="text-xs text-slate-500 mt-2 font-medium">
                {susResult.totalResponses} respondentes
              </div>
            </div>
          </div>

          {/* PERCEPTION VS BEHAVIOR CORRELATION BLOCK */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-50/60 via-white to-purple-50/60 border border-amber-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-amber-800 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-5 h-5 text-amber-600" />
              <span>Cruzamento Estratégico: Percepção (SUS) vs Comportamento Real</span>
            </div>

            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {susResult.perceptionVsBehavior.discrepancyMessage}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">Percepção SUS</span>
                <span className="text-base font-bold text-amber-600">78.5 (Bom)</span>
              </div>
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">Taxa de Sucesso</span>
                <span className="text-base font-bold text-emerald-600">82.0%</span>
              </div>
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">Retornos (Back)</span>
                <span className="text-base font-bold text-rose-600">38.0%</span>
              </div>
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">Desvio do Ideal</span>
                <span className="text-base font-bold text-purple-600">39.0%</span>
              </div>
            </div>
          </div>

          {/* Score Distribution & Question Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Score Distribution */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">
                Distribuição das Notas SUS
              </h3>
              <div className="space-y-3">
                {susResult.scoreDistribution.map((dist, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-slate-600 text-xs">
                      <span>{dist.range}</span>
                      <span className="font-bold text-slate-900">{dist.count} respostas</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${(dist.count / susResult.totalResponses) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Average by Question */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">
                Média por Questão (Escala 1 a 5)
              </h3>
              <div className="space-y-2">
                {susResult.questionAverages.map((avg, qIdx) => (
                  <div key={qIdx} className="flex items-center justify-between text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                    <span className="truncate pr-2 font-medium">Questão {qIdx + 1}</span>
                    <span className="font-bold text-amber-700">{avg.toFixed(1)} / 5.0</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* PERGUNTAS CUSTOMIZADAS CADASTRADAS PELO PESQUISADOR */}
          {test.customQuestions && test.customQuestions.length > 0 && (
            <div className="p-6 rounded-2xl bg-white border border-blue-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-blue-700 text-xs font-bold uppercase tracking-wider">
                  <FileText className="w-4 h-4" />
                  <span>Questionário Customizado do Pesquisador ({test.customQuestions.length} perguntas)</span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">Respostas Qualitativas</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {test.customQuestions.map((q, idx) => (
                  <div key={q.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded uppercase">
                        Pergunta #{idx + 1} • {q.type === 'open_text' ? 'Dissertativa' : q.type === 'likert_scale' ? 'Escala 1-5' : 'Múltipla Escolha'}
                      </span>
                      {q.required && (
                        <span className="text-[10px] text-amber-700 font-semibold">Obrigatória</span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-900 pt-1">{q.question}</div>

                    {q.type === 'open_text' && (
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-600 italic">
                        Respostas qualitativas coletadas nas sessões de participantes.
                      </div>
                    )}

                    {q.type === 'likert_scale' && (
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-[11px] text-slate-500">Média observada:</span>
                        <span className="font-bold text-amber-700">4.2 / 5.0 ⭐⭐⭐⭐</span>
                      </div>
                    )}

                    {q.type === 'multiple_choice' && q.options && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {q.options.map((opt, oIdx) => (
                          <span key={oIdx} className="text-[11px] px-2.5 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200">
                            {opt}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PARTICIPANTES & SESSION REPLAY PREP */}
      {/* ========================================================================= */}
      {activeTab === 'participants' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Sessões Registradas & Event Tracking
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Clique em um participante para abrir o Session Replay Prep e inspecionar a timeline de eventos.
              </p>
            </div>
          </div>

          {/* Participant Table */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[11px] font-semibold tracking-wider">
                  <th className="pb-3">Participante / Sessão</th>
                  <th className="pb-3">Tipo</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Tempo</th>
                  <th className="pb-3">Tarefas</th>
                  <th className="pb-3">Cliques</th>
                  <th className="pb-3">Erros</th>
                  <th className="pb-3">Retornos</th>
                  <th className="pb-3">SUS</th>
                  <th className="pb-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((sess) => (
                  <tr
                    key={sess.sessionId}
                    onClick={() => (onOpenParticipant ? onOpenParticipant(sess.participantId || sess.sessionId) : setSelectedSession(sess))}
                    className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        {sess.participantNumber ? (
                          <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold shrink-0">
                            #{String(sess.participantNumber).padStart(2, '0')}
                            {test?.participantLimit ? `/${test.participantLimit}` : ''}
                          </span>
                        ) : null}
                        <span>{sess.participantName}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{sess.sessionId}</span>
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          sess.participantType === 'synthetic'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {sess.participantType === 'synthetic' ? 'Sintética' : 'Humano'}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          sess.status === 'Concluído'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {sess.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-slate-700 font-mono">{sess.durationSeconds}s</td>
                    <td className="py-3.5 text-slate-700">{sess.tasksCompleted} / {sess.totalTasks}</td>
                    <td className="py-3.5 text-slate-700 font-mono">{sess.clickCount}</td>
                    <td className="py-3.5 text-rose-600 font-bold">{sess.errorCount}</td>
                    <td className="py-3.5 text-amber-600 font-bold">{sess.returnCount}</td>
                    <td className="py-3.5 text-amber-600 font-bold">{sess.susScore ?? '—'}</td>
                    <td className="py-3.5 text-right">
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-semibold transition-colors"
                      >
                        Ver Replay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Synthetic Personas Section */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-purple-700 text-xs font-bold uppercase tracking-wider">
              <Bot className="w-4 h-4" />
              <span>Personas Sintéticas & Agentes de Usabilidade (Simulação Autônoma)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {personas.map((per) => (
                <div key={per.personaId} className="p-5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-sm">{per.personaName}</h4>
                    <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">
                      {per.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {per.personaProfile}
                  </p>

                  <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1 text-xs">
                    <div className="text-amber-700 font-semibold">Fricção Observada:</div>
                    <div className="text-slate-600">{per.result.frictionObserved}</div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-xs text-slate-500 font-medium">
                    <span>Tempo: <strong className="text-slate-800 font-mono">{per.result.durationSeconds}s</strong></span>
                    <span>SUS Est.: <strong className="text-amber-700">{per.result.susEstimated}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: IA UX RESEARCHER */}
      {/* ========================================================================= */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          {/* Header & Run AI Button */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Bot className="w-5 h-5 text-blue-600" />
                <span>Agente IA UX Researcher: Diagnóstico & Recomendações</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Gera hipóteses e recomendações sem alucinação, estritamente ancoradas na telemetria empírica.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRunAi}
              disabled={aiRunning}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-xs disabled:opacity-50 shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>{aiRunning ? 'Analisando Evidências...' : 'Analisar Teste com IA'}</span>
            </button>
          </div>

          {/* Executive Summary Block */}
          {aiReport && (
            <div className="p-6 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs space-y-3 shadow-xs">
              <div className="font-bold text-blue-800 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Sumário Executivo da Pesquisa</span>
              </div>
              <p className="text-slate-700 leading-relaxed text-sm">
                {aiReport.executiveSummary}
              </p>
              <div className="p-3.5 rounded-xl bg-white border border-blue-200 text-amber-800 font-medium">
                <strong>{aiReport.perceptionVsBehavior}</strong>
              </div>
            </div>
          )}

          {/* Categorized Insights */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Diagnóstico Estruturado por Severidade
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.map((insight) => (
                <div
                  key={insight.id}
                  className={`p-6 rounded-2xl bg-white border shadow-xs space-y-3.5 text-xs ${
                    insight.severity === 'critical'
                      ? 'border-rose-200'
                      : insight.severity === 'friction'
                      ? 'border-amber-200'
                      : insight.severity === 'attention'
                      ? 'border-purple-200'
                      : 'border-emerald-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                        insight.severity === 'critical'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : insight.severity === 'friction'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : insight.severity === 'attention'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {insight.severity === 'critical' && '🔴 Problema Crítico'}
                      {insight.severity === 'friction' && '🟠 Fricção Comportamental'}
                      {insight.severity === 'attention' && '🟡 Ponto de Atenção'}
                      {insight.severity === 'positive' && '🟢 Destaque Positivo'}
                    </span>
                    <span className="text-slate-400 text-[11px] font-mono">{insight.affectedTask}</span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm">
                    {insight.title}
                  </h4>

                  {/* Evidence Bullets */}
                  <div className="space-y-1.5 text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                    <div className="font-semibold text-slate-700 uppercase text-[10px]">Evidências Coletadas:</div>
                    {insight.evidence.map((ev, eIdx) => (
                      <div key={eIdx} className="flex items-start gap-1.5">
                        <span className="text-blue-600 font-bold">•</span>
                        <span>{ev}</span>
                      </div>
                    ))}
                  </div>

                  {/* Hypothesis */}
                  <div className="text-slate-700 text-xs">
                    <strong className="text-amber-800">Hipótese:</strong> {insight.hypothesis}
                  </div>

                  {/* Recommendation */}
                  <div className="text-slate-900 text-xs p-3 rounded-xl bg-emerald-50/60 border border-emerald-200">
                    <strong className="text-emerald-800">Recomendação Acionável:</strong> {insight.recommendation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SESSION REPLAY PREP / TIMELINE MODAL */}
      {/* ========================================================================= */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div>
                <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-bold uppercase">
                  Session Replay Prep
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {selectedSession.participantName} <span className="text-slate-400 font-mono text-xs">({selectedSession.sessionId})</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
              >
                ✕ Fechar
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Duração</div>
                <div className="text-slate-900 font-bold font-mono text-sm">{selectedSession.durationSeconds}s</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Cliques</div>
                <div className="text-slate-900 font-bold font-mono text-sm">{selectedSession.clickCount}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Erros</div>
                <div className="text-rose-600 font-bold font-mono text-sm">{selectedSession.errorCount}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">SUS Score</div>
                <div className="text-amber-600 font-bold font-mono text-sm">{selectedSession.susScore ?? '—'}</div>
              </div>
            </div>

            {/* Event Timeline List */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Timeline Cronológica de Eventos Registrados:
              </h4>

              <div className="space-y-2 max-h-60 overflow-y-auto p-3 bg-slate-50 rounded-xl border border-slate-200">
                {selectedSession.events && selectedSession.events.length > 0 ? (
                  selectedSession.events.map((evt) => (
                    <div
                      key={evt.eventId}
                      className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs shadow-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono text-[11px]">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold uppercase text-[9px] ${
                            evt.eventType.includes('SUCCESS')
                              ? 'bg-emerald-50 text-emerald-700'
                              : evt.eventType.includes('ERROR')
                              ? 'bg-rose-50 text-rose-700'
                              : evt.eventType.includes('BACK') || evt.eventType.includes('RETURN')
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          {evt.eventType}
                        </span>
                        <span className="text-slate-900 font-medium">{evt.screen}</span>
                        {evt.element && <span className="text-slate-500">({evt.element})</span>}
                      </div>
                      <span className="text-slate-400 text-[10px] font-mono">{evt.eventId}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-500 py-4">
                    Sessão gerada por dados de teste com {selectedSession.clickCount} interações registradas.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exportação Figma Make (.zip) */}
      {isExportFigmaOpen && test && (
        <FigmaMakeExportModal
          onClose={() => setIsExportFigmaOpen(false)}
          tests={[test]}
          activeTestId={test.id}
        />
      )}
    </div>
  );
};
