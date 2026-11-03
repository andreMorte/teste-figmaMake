import React from 'react';
import {
  UsabilityTest
} from '../../types';
import {
  Plus,
  Users,
  Activity,
  Award,
  Clock,
  ArrowRight,
  ShieldCheck,
  Play,
  Share2,
  Calendar,
  Sparkles,
  ExternalLink
} from 'lucide-react';

interface DashboardViewProps {
  tests: UsabilityTest[];
  onNavigate: (view: string, testId?: string) => void;
  onOpenRunner: (testId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  tests,
  onNavigate,
  onOpenRunner
}) => {
  // Compute aggregated KPI totals
  const activeTestsCount = tests.filter((t) => t.status === 'Em andamento' || t.status === 'Publicado').length;
  const totalParticipants = tests.reduce((acc, t) => acc + t.totalParticipants, 0);

  const testsWithParticipants = tests.filter((t) => t.totalParticipants > 0);
  const averageSuccessRate = testsWithParticipants.length > 0
    ? (testsWithParticipants.reduce((acc, t) => acc + t.averageSuccessRate, 0) / testsWithParticipants.length).toFixed(1)
    : '0.0';

  const averageSus = testsWithParticipants.length > 0
    ? (testsWithParticipants.reduce((acc, t) => acc + t.averageSusScore, 0) / testsWithParticipants.length).toFixed(1)
    : '0.0';

  const averageDurationSeconds = testsWithParticipants.length > 0
    ? Math.round(testsWithParticipants.reduce((acc, t) => acc + t.averageDurationSeconds, 0) / testsWithParticipants.length)
    : 0;

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: UsabilityTest['status']) => {
    switch (status) {
      case 'Em andamento':
        return 'bg-blue-50 text-blue-700 border border-blue-200/80';
      case 'Publicado':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200/80';
      case 'Finalizado':
        return 'bg-purple-50 text-purple-700 border border-purple-200/80';
      case 'Rascunho':
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Title & Master Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              UX Test Lab
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
              Research Operations
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Crie, acompanhe e analise testes de usabilidade com captura de eventos em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => onNavigate('engine-validation')}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-emerald-700 text-xs font-semibold border border-emerald-300/80 shadow-xs flex items-center gap-2 transition-all"
            title="Validar protótipos Figma Make em tempo de execução"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Validar Protótipo (Runtime)</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('create-test')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Criar teste</span>
          </button>
        </div>
      </div>

      {/* Main Aggregated KPI Cards (Maze-style modern metric cards) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Testes ativos */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-600 text-xs font-medium">
            <span>Testes Ativos</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {activeTestsCount}
            </span>
            <span className="text-[11px] text-slate-600">
              de {tests.length}
            </span>
          </div>
        </div>

        {/* Participantes */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-600 text-xs font-medium">
            <span>Participantes</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {totalParticipants}
            </span>
            <span className="text-[11px] font-medium text-emerald-700">
              Sessões
            </span>
          </div>
        </div>

        {/* Taxa média de sucesso */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-600 text-xs font-medium">
            <span>Taxa de Sucesso</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Award className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-700">
              {averageSuccessRate}%
            </span>
            <span className="text-[11px] text-slate-600">
              Média
            </span>
          </div>
        </div>

        {/* SUS médio */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-600 text-xs font-medium">
            <span>SUS Médio</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-700">
              {averageSus}
            </span>
            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md border ${
              Number(averageSus) === 0
                ? 'bg-slate-100 text-slate-600 border-slate-200'
                : Number(averageSus) >= 85
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                : Number(averageSus) >= 70
                ? 'bg-amber-50 text-amber-700 border-amber-200/70'
                : 'bg-rose-50 text-rose-700 border-rose-200/70'
            }`}>
              {Number(averageSus) === 0
                ? 'Sem dados'
                : Number(averageSus) >= 85
                ? 'Excelente'
                : Number(averageSus) >= 70
                ? 'Bom'
                : 'Abaixo da média'}
            </span>
          </div>
        </div>

        {/* Tempo médio de tarefa */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-slate-600 text-xs font-medium">
            <span>Tempo Médio</span>
            <div className="p-1.5 rounded-lg bg-cyan-50 text-cyan-600">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {formatDuration(averageDurationSeconds)}
            </span>
            <span className="text-[11px] text-slate-600 font-mono">
              mm:ss
            </span>
          </div>
        </div>
      </div>

      {/* Validation Engine Callout Banner (Clean modern Maze-style card) */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center shrink-0 mt-0.5 text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Engine de Validação em Tempo de Execução (Figma Make)
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Zero Falso-Verdadeiro
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Inspeciona pacotes compilados <code className="text-blue-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono">/assets/*.js</code> e confirma a assinatura <code className="text-blue-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono">UXLab.init(&#123; testId, trackingId &#125;)</code> antes de liberar o link aos participantes.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('engine-validation')}
          className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200 flex items-center gap-2 transition-all self-start md:self-auto shrink-0 shadow-xs"
        >
          <span>Abrir Validador Completo</span>
          <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
        </button>
      </div>

      {/* Recent Tests List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Testes Recentes
            </h2>
            <p className="text-xs text-slate-600">
              Estudos de usabilidade ativos e histórico de avaliações.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('tests')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
          >
            <span>Ver todos ({tests.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          {tests.map((test) => (
            <div
              key={test.id}
              className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-300 hover:shadow-xs transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              {/* Test Details */}
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(test.status)}`}>
                    {test.status}
                  </span>
                  <span className="text-xs font-mono font-bold text-blue-600">
                    {test.id}
                  </span>
                  <span className="text-xs text-slate-300">•</span>
                  <span className="text-xs font-medium text-slate-700">
                    {test.productName}
                  </span>
                </div>

                <div>
                  <h3
                    onClick={() => onNavigate('test-detail', test.id)}
                    className="text-sm sm:text-base font-bold text-slate-900 hover:text-blue-600 cursor-pointer transition-colors truncate"
                  >
                    {test.name}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">
                    <strong className="text-slate-700 font-semibold">Objetivo:</strong> {test.researchGoal}
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap pt-0.5">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-600" />
                    {test.totalParticipants} participantes
                  </span>
                  <span>•</span>
                  <span>{test.tasks.length} tarefas</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-600" />
                    {new Date(test.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* Metrics Snapshot & Actions */}
              <div className="flex items-center justify-between lg:justify-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                {test.totalParticipants > 0 ? (
                  <div className="flex items-center gap-4 text-center pr-3 border-r border-slate-200">
                    <div>
                      <div className="text-[10px] font-semibold text-slate-600 uppercase">Sucesso</div>
                      <div className="text-xs font-bold text-emerald-700">
                        {test.averageSuccessRate}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-slate-600 uppercase">SUS</div>
                      <div className="text-xs font-bold text-amber-700">
                        {test.averageSusScore}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-600 pr-3 italic">
                    Aguardando respostas
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenRunner(test.id)}
                    className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-all shadow-xs"
                    title="Simular execução de teste como participante"
                  >
                    <Play className="w-3.5 h-3.5 text-blue-600" />
                    <span className="hidden sm:inline">Executar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('test-detail', test.id)}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    <span>Ver resultados</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
