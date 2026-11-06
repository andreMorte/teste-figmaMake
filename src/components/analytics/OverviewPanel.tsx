import React, { useMemo, useRef, useState } from 'react';
import { ParticipantSession, TestTask, TrackedEvent, UsabilityTest } from '../../types';
import { AiHelpInsights } from './AiHelpInsights';
import {
  Award,
  CheckCircle2,
  Clock,
  Sparkles,
  MousePointer,
  RotateCcw,
  TrendingDown,
  Compass,
  Users,
  ArrowLeft,
  ChevronRight,
  Info,
  XCircle,
  CircleDashed
} from 'lucide-react';

interface OverviewPanelProps {
  test: UsabilityTest;
  sessions: ParticipantSession[];
  isDemo?: boolean;
  onOpenTab: (tab: 'tasks' | 'journey' | 'sus' | 'participants') => void;
  onOpenParticipant?: (key: string) => void;
  onOpenQualitative?: () => void;
}

// ---------------------------------------------------------------------------
// Cálculos (sempre a partir dos eventos reais das sessões)
// ---------------------------------------------------------------------------
type TaskOutcome = 'success' | 'abandoned' | 'in_progress' | 'not_started';

interface TaskAttempt {
  task: TestTask;
  outcome: TaskOutcome;
  durationSec: number;
  clicks: number;
  deadClicks: number;
  difficulties: number;
  hadReturn: boolean;
  deviated: boolean;
  idealPath: boolean;
  hasExpected: boolean;
}

interface ParticipantRow {
  key: string;
  number?: number;
  name: string;
  sessions: ParticipantSession[];
  status: 'Concluiu' | 'Em andamento' | 'Abandonou';
  attempts: TaskAttempt[];
  journeySec: number;
  gaveUp: boolean; // desistiu de alguma tarefa ou saiu no meio
  susScore?: number;
  startedAt: string;
}

const NON_INTERACTIVE_TAGS = ['DIV', 'SPAN', 'P', 'IMG', 'SECTION', 'MAIN', 'HEADER', 'FOOTER', 'H1', 'H2', 'H3', 'H4', 'LI', 'UL', 'SVG', 'PATH'];

const ts = (e: TrackedEvent) => new Date(e.timestamp).getTime();

/** Ida e volta (A → B → A) que não faz parte do caminho esperado (ex.: abrir e fechar um modal previsto). */
function hasLoop(path: string[], expected: string[] = []) {
  const expectedTriples = new Set<string>();
  for (let i = 0; i < expected.length - 2; i++) expectedTriples.add(`${expected[i]}>${expected[i + 1]}>${expected[i + 2]}`);
  for (let i = 0; i < path.length - 2; i++) {
    if (path[i] === path[i + 2] && path[i] !== path[i + 1] && !expectedTriples.has(`${path[i]}>${path[i + 1]}>${path[i + 2]}`)) return true;
  }
  return false;
}

function analyzeTask(session: ParticipantSession, task: TestTask, mappedIds: Set<string>): TaskAttempt {
  const evs = (session.events || []).filter((e) => e.taskId === task.id).sort((a, b) => ts(a) - ts(b));
  const start = evs.find((e) => e.eventType === 'TASK_START');
  const success = evs.find((e) => e.eventType === 'TASK_SUCCESS');
  const abandon = evs.find((e) => e.eventType === 'TASK_ABANDON');
  const end = success || abandon;
  const outcome: TaskOutcome = success ? 'success' : abandon ? 'abandoned' : evs.length ? 'in_progress' : 'not_started';

  let durationSec = 0;
  if (end?.durationMs) durationSec = end.durationMs / 1000;
  else if (start && end) durationSec = (ts(end) - ts(start)) / 1000;
  else if (start && evs.length) durationSec = (ts(evs[evs.length - 1]) - ts(start)) / 1000;

  const allEvents = (session.events || []).slice().sort((a, b) => ts(a) - ts(b));
  const clicksEvs = evs.filter((e) => e.eventType === 'CLICK' && typeof e.x === 'number');
  // clique sem efeito: elemento não clicável que não trocou o cenário em até 2s
  const deadClicks = clicksEvs.filter((c) => {
    const meta = (c.metadata || {}) as any;
    const interactive = typeof meta.interactive === 'boolean' ? meta.interactive : meta.tagName ? !NON_INTERACTIVE_TAGS.includes(String(meta.tagName).toUpperCase()) : true;
    if (interactive) return false;
    const t = ts(c);
    return !allEvents.some((e) => e.eventType === 'SCREEN_VIEW' && ts(e) > t && ts(e) - t <= 2000);
  }).length;

  const path = (session.actualPaths || {})[task.id] || [];
  const expected = task.expectedPath || [];
  // caminho de exemplo (sem nenhum cenário mapeado) não conta como caminho esperado
  const hasExpected = expected.length > 0 && expected.some((id) => mappedIds.has(id));

  return {
    task,
    outcome,
    durationSec,
    clicks: evs.filter((e) => e.eventType === 'CLICK').length,
    deadClicks,
    difficulties: evs.filter((e) => e.eventType === 'TASK_ERROR').length,
    hadReturn: hasLoop(path, hasExpected ? expected : []) || evs.some((e) => e.eventType === 'BACK' || e.eventType === 'RETURN'),
    deviated: hasExpected && path.some((s) => !expected.includes(s)),
    idealPath: hasExpected && path.join('>') === expected.join('>'),
    hasExpected
  };
}

function buildParticipants(test: UsabilityTest, sessions: ParticipantSession[]): ParticipantRow[] {
  const groups = new Map<string, ParticipantSession[]>();
  sessions.forEach((s) => {
    const key = s.participantId || s.sessionId;
    groups.set(key, [...(groups.get(key) || []), s]);
  });
  return [...groups.entries()]
    .map(([key, list]) => {
      const sorted = list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      // por tarefa, vale a melhor tentativa (sucesso > abandono > em andamento)
      const rank: Record<TaskOutcome, number> = { success: 3, abandoned: 2, in_progress: 1, not_started: 0 };
      const mappedIds = new Set((test.screenMap || []).map((m) => m.screenId));
      const attempts = test.tasks.map((task) =>
        sorted.map((s) => analyzeTask(s, task, mappedIds)).sort((a, b) => rank[b.outcome] - rank[a.outcome])[0]
      );
      const anyCompleted = sorted.some((s) => s.status === 'Concluído') || (attempts.length > 0 && attempts.every((a) => a.outcome !== 'not_started' && a.outcome !== 'in_progress'));
      const anyAbandon = sorted.some((s) => s.status === 'Abandonado') || attempts.some((a) => a.outcome === 'abandoned');
      const last = sorted[sorted.length - 1];
      const sus = [...sorted].reverse().find((s) => typeof s.susScore === 'number')?.susScore;
      return {
        key,
        number: last.participantNumber,
        name: last.participantName,
        sessions: sorted,
        status: anyCompleted ? ('Concluiu' as const) : sorted.some((s) => s.status === 'Abandonado') ? ('Abandonou' as const) : ('Em andamento' as const),
        gaveUp: anyAbandon,
        attempts,
        journeySec: attempts.reduce((acc, a) => acc + a.durationSec, 0),
        susScore: sus,
        startedAt: sorted[0].startTime
      };
    })
    .sort((a, b) => (a.number || 999) - (b.number || 999) || a.startedAt.localeCompare(b.startedAt));
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
const fmt = (sec: number) => {
  if (!sec || sec < 0) return '00:00';
  const s = Math.round(sec);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const median = (vals: number[]) => {
  if (!vals.length) return 0;
  const v = [...vals].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const susClass = (s: number) => (s >= 85 ? 'Excelente' : s >= 70 ? 'Bom' : s >= 50 ? 'Neutro' : s >= 35 ? 'Ruim' : 'Muito ruim');
const susTone = (s: number) =>
  s >= 70 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : s >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200';

function summarize(rows: ParticipantRow[]) {
  const attempts = rows.flatMap((r) => r.attempts).filter((a) => a.outcome !== 'not_started');
  const success = attempts.filter((a) => a.outcome === 'success').length;
  const finished = rows.filter((r) => r.status === 'Concluiu').length;
  const abandoned = rows.filter((r) => r.gaveUp);
  const journeyTimes = rows.filter((r) => r.journeySec > 0).map((r) => r.journeySec);
  const sus = rows.map((r) => r.susScore).filter((s): s is number => typeof s === 'number');
  const withExpected = attempts.filter((a) => a.hasExpected);
  const returnsAttempts = attempts.filter((a) => a.hadReturn);

  // tarefa onde mais aconteceram retornos / abandonos (para os subtítulos dos cards)
  const byTask = (pred: (a: TaskAttempt) => boolean) => {
    const counts: Record<string, { title: string; n: number }> = {};
    attempts.filter(pred).forEach((a) => {
      counts[a.task.id] = counts[a.task.id] || { title: a.task.title, n: 0 };
      counts[a.task.id].n += 1;
    });
    return Object.values(counts).sort((a, b) => b.n - a.n)[0];
  };

  return {
    participants: rows.length,
    attempts: attempts.length,
    success,
    successRate: pct(success, attempts.length),
    finished,
    finishedRate: pct(finished, rows.length),
    avgJourney: journeyTimes.length ? journeyTimes.reduce((a, b) => a + b, 0) / journeyTimes.length : 0,
    medianJourney: median(journeyTimes),
    sus: sus.length ? Math.round((sus.reduce((a, b) => a + b, 0) / sus.length) * 10) / 10 : null,
    susCount: sus.length,
    deadClicks: attempts.reduce((acc, a) => acc + a.deadClicks, 0),
    totalClicks: attempts.reduce((acc, a) => acc + a.clicks, 0),
    returnRate: pct(returnsAttempts.length, attempts.length),
    returnTop: byTask((a) => a.hadReturn),
    abandoned: abandoned.length,
    abandonRate: pct(abandoned.length, rows.length),
    abandonTop: byTask((a) => a.outcome === 'abandoned'),
    deviationRate: pct(withExpected.filter((a) => a.deviated).length, withExpected.length),
    deviationBase: withExpected.length
  };
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
const Kpi: React.FC<{ label: string; icon: React.ReactNode; value: React.ReactNode; hint: React.ReactNode; tone?: string }> = ({
  label,
  icon,
  value,
  hint,
  tone = 'text-slate-900'
}) => (
  <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
    <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
      <span>{label}</span>
      {icon}
    </div>
    <div className={`mt-2 text-2xl font-bold ${tone}`}>{value}</div>
    <p className="text-[11px] text-slate-500 mt-1 leading-snug">{hint}</p>
  </div>
);

const OutcomeBadge: React.FC<{ outcome: TaskOutcome }> = ({ outcome }) => {
  if (outcome === 'success') return <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Concluiu</span>;
  if (outcome === 'abandoned') return <span className="inline-flex items-center gap-1 text-rose-600 font-semibold"><XCircle className="w-3.5 h-3.5" /> Desistiu</span>;
  if (outcome === 'in_progress') return <span className="inline-flex items-center gap-1 text-amber-600 font-semibold"><CircleDashed className="w-3.5 h-3.5" /> Não terminou</span>;
  return <span className="text-slate-400">Não iniciou</span>;
};

export const OverviewPanel: React.FC<OverviewPanelProps> = ({ test, sessions, isDemo, onOpenTab, onOpenParticipant, onOpenQualitative }) => {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const selectParticipant = (key: string | null) => {
    setSelectedKey(key);
    // leva o pesquisador para os indicadores da pessoa escolhida
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const rows = useMemo(
    () => (isDemo ? [] : buildParticipants(test, sessions.filter((s) => s.testId === test.id))),
    [test, sessions, isDemo]
  );
  const selected = rows.find((r) => r.key === selectedKey) || null;
  const scope = selected ? [selected] : rows;
  const m = useMemo(() => summarize(scope), [scope]);
  const team = useMemo(() => summarize(rows), [rows]);
  const limit = test.participantLimit || 0;

  // Discrepância percepção x comportamento: só com dados suficientes
  const MIN_SUS = 3;
  const discrepancy = (() => {
    if (selected) {
      if (typeof selected.susScore !== 'number') return null;
      const s = selected.susScore;
      const ok = selected.attempts.filter((a) => a.outcome === 'success').length;
      const total = selected.attempts.length;
      const returns = selected.attempts.filter((a) => a.hadReturn).length;
      if (s >= 70 && (ok < total || returns > 0))
        return { tone: 'amber', text: `${selected.name} avaliou bem a experiência (SUS ${s}), mas ${ok < total ? `não concluiu ${total - ok} de ${total} tarefa(s)` : `voltou telas em ${returns} tarefa(s)`}. A percepção está mais positiva que o comportamento.` };
      if (s < 50 && ok === total)
        return { tone: 'amber', text: `${selected.name} concluiu todas as tarefas, mas deu SUS ${s} (${susClass(s)}). Concluiu com esforço: vale olhar os pontos de fricção da jornada.` };
      return { tone: 'slate', text: `Percepção e comportamento de ${selected.name} estão coerentes: SUS ${s} (${susClass(s)}) e ${ok} de ${total} tarefa(s) concluída(s).` };
    }
    if (m.susCount < MIN_SUS || m.sus === null) return null;
    const behaviorIssues: string[] = [];
    if (m.successRate < 80) behaviorIssues.push(`sucesso de ${m.successRate}% nas tarefas`);
    if (m.returnRate >= 30) behaviorIssues.push(`${m.returnRate}% de retornos`);
    if (m.deviationBase > 0 && m.deviationRate >= 30) behaviorIssues.push(`${m.deviationRate}% de desvio de caminho`);
    if (m.abandonRate >= 20) behaviorIssues.push(`${m.abandonRate}% de abandono`);
    if (m.sus >= 70 && behaviorIssues.length)
      return { tone: 'amber', text: `Discrepância: o time de participantes avaliou bem (SUS ${m.sus}), mas o comportamento mostra atrito — ${behaviorIssues.join(', ')}. As pessoas podem não perceber o esforço que estão fazendo.` };
    if (m.sus < 50 && !behaviorIssues.length)
      return { tone: 'amber', text: `Discrepância: as tarefas foram concluídas com fluidez, mas o SUS médio é ${m.sus} (${susClass(m.sus)}). A insatisfação pode vir de visual, linguagem ou confiança, não da navegação.` };
    return {
      tone: 'slate',
      text: `Percepção e comportamento coerentes: SUS ${m.sus} (${susClass(m.sus)}) e ${behaviorIssues.length ? behaviorIssues.join(', ') : `${m.successRate}% de sucesso nas tarefas, sem atrito relevante`}.`
    };
  })();

  // Tabela por tarefa (no escopo atual)
  const taskRows = test.tasks.map((task, idx) => {
    const atts = scope.map((r) => r.attempts[idx]).filter((a) => a && a.outcome !== 'not_started');
    const ok = atts.filter((a) => a.outcome === 'success');
    const times = atts.filter((a) => a.durationSec > 0).map((a) => a.durationSec);
    const withExp = atts.filter((a) => a.hasExpected);
    return {
      task,
      attempts: atts,
      tried: atts.length,
      ok: ok.length,
      avgTime: times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0,
      clicks: atts.reduce((acc, a) => acc + a.clicks, 0),
      dead: atts.reduce((acc, a) => acc + a.deadClicks, 0),
      difficulties: atts.reduce((acc, a) => acc + a.difficulties, 0),
      returns: atts.filter((a) => a.hadReturn).length,
      ideal: withExp.filter((a) => a.idealPath).length,
      idealBase: withExp.length
    };
  });

  const empty = rows.length === 0;

  return (
    <div className="space-y-6 scroll-mt-20" ref={topRef}>
      {/* Escopo */}
      {selected ? (
        <div className="p-4 rounded-2xl bg-blue-600 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center font-bold text-sm">
              {selected.number ? `#${String(selected.number).padStart(2, '0')}` : selected.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <div className="text-xs text-blue-100">Métricas individuais</div>
              <div className="text-base font-bold">{selected.name}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => selectParticipant(null)}
            className="px-3.5 py-2 rounded-xl bg-white text-blue-700 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar para a visão do time
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Visão do time</h3>
            <p className="text-xs text-slate-500">
              Compilado de {team.participants} participante(s){limit ? ` de ${limit} previstos` : ''}. Clique em uma pessoa na lista para ver as métricas dela.
            </p>
          </div>
        </div>
      )}

      {empty ? (
        <div className="p-8 rounded-2xl bg-white border border-dashed border-slate-300 text-center space-y-2">
          <Users className="w-8 h-8 text-slate-300 mx-auto" />
          <div className="text-sm font-bold text-slate-800">Nenhum participante fez este teste ainda</div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Envie o link do teste aos participantes. Assim que cada pessoa informar o nome e iniciar, os indicadores aparecem aqui com dados reais.
          </p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <Kpi
              label="Taxa de Sucesso"
              icon={<Award className="w-4 h-4 text-emerald-600" />}
              value={`${m.successRate}%`}
              hint={`${m.success} de ${m.attempts} tarefa(s) concluída(s)`}
            />
            <Kpi
              label={selected ? 'Jornada' : 'Taxa de Conclusão'}
              icon={<CheckCircle2 className="w-4 h-4 text-blue-600" />}
              value={selected ? selected.status : `${m.finishedRate}%`}
              hint={selected ? `${selected.attempts.filter((a) => a.outcome === 'success').length} de ${test.tasks.length} tarefas` : `${m.finished} de ${m.participants} participante(s) terminaram a jornada`}
              tone={selected ? (selected.status === 'Concluiu' ? 'text-emerald-700' : selected.status === 'Abandonou' ? 'text-rose-600' : 'text-amber-600') : 'text-slate-900'}
            />
            <Kpi
              label={selected ? 'Tempo da Jornada' : 'Tempo Médio / Mediana'}
              icon={<Clock className="w-4 h-4 text-cyan-600" />}
              value={
                selected ? (
                  fmt(selected.journeySec)
                ) : (
                  <span className="flex items-baseline gap-2">
                    {fmt(m.avgJourney)} <span className="text-xs text-slate-400 font-mono font-normal">/ {fmt(m.medianJourney)}</span>
                  </span>
                )
              }
              hint={selected ? 'Soma do tempo nas tarefas' : 'Tempo nas tarefas por participante (mm:ss)'}
            />
            <Kpi
              label={selected ? 'SUS do participante' : 'Score SUS Geral'}
              icon={<Sparkles className="w-4 h-4 text-amber-500" />}
              value={
                m.sus === null ? (
                  <span className="text-slate-300">—</span>
                ) : (
                  <span className="flex items-baseline gap-2">
                    {m.sus}
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${susTone(m.sus)}`}>{susClass(m.sus)}</span>
                  </span>
                )
              }
              hint={m.sus === null ? 'Aguardando respostas do questionário' : `${m.susCount} resposta(s) • escala 0 a 100`}
            />
            <Kpi
              label="Cliques sem efeito"
              icon={<MousePointer className="w-4 h-4 text-rose-500" />}
              value={m.deadClicks}
              hint={`De ${m.totalClicks} cliques: em áreas não clicáveis que não mudaram a tela`}
              tone={m.deadClicks > 0 ? 'text-rose-600' : 'text-slate-900'}
            />
            <Kpi
              label="Taxa de Retorno"
              icon={<RotateCcw className="w-4 h-4 text-amber-500" />}
              value={`${m.returnRate}%`}
              hint={m.returnTop ? `Mais em: ${m.returnTop.title}` : 'Ninguém voltou telas durante as tarefas'}
              tone={m.returnRate > 0 ? 'text-amber-600' : 'text-slate-900'}
            />
            {selected ? (
              <Kpi
                label="Desistências"
                icon={<TrendingDown className="w-4 h-4 text-rose-500" />}
                value={selected.attempts.filter((a) => a.outcome === 'abandoned').length}
                hint={selected.gaveUp ? `Em: ${selected.attempts.filter((a) => a.outcome === 'abandoned').map((a) => a.task.title).join(', ') || 'saiu no meio do teste'}` : 'Não desistiu de nenhuma tarefa'}
                tone={selected.gaveUp ? 'text-rose-600' : 'text-slate-900'}
              />
            ) : (
              <Kpi
                label="Taxa de Abandono"
                icon={<TrendingDown className="w-4 h-4 text-rose-500" />}
                value={`${m.abandonRate}%`}
                hint={m.abandoned ? `${m.abandoned} participante(s) desistiram de tarefa ou saíram${m.abandonTop ? ` • mais em: ${m.abandonTop.title}` : ''}` : 'Nenhum abandono registrado'}
                tone={m.abandoned > 0 ? 'text-rose-600' : 'text-slate-900'}
              />
            )}
            <Kpi
              label="Desvio de Caminho"
              icon={<Compass className="w-4 h-4 text-purple-600" />}
              value={m.deviationBase ? `${m.deviationRate}%` : <span className="text-slate-300">—</span>}
              hint={m.deviationBase ? 'Tarefas com telas fora do caminho mapeado' : 'Tarefas sem caminho mapeado'}
              tone={m.deviationRate > 0 ? 'text-purple-600' : 'text-slate-900'}
            />
          </div>

          {/* Discrepância (só com dados reais suficientes) */}
          {discrepancy ? (
            <div
              className={`p-5 rounded-2xl border shadow-xs space-y-2 ${
                discrepancy.tone === 'amber' ? 'bg-gradient-to-r from-amber-50/80 via-white to-purple-50/60 border-amber-200' : 'bg-white border-slate-200'
              }`}
            >
              <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${discrepancy.tone === 'amber' ? 'text-amber-800' : 'text-slate-600'}`}>
                <Sparkles className="w-4 h-4" />
                <span>Percepção (SUS) × Comportamento real</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{discrepancy.text}</p>
            </div>
          ) : (
            !selected && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  A análise de percepção (SUS) × comportamento aparece a partir de {MIN_SUS} questionários respondidos (agora: {m.susCount}). Com
                  menos respostas, a comparação não é confiável.
                </span>
              </div>
            )
          )}

          {/* Ajuda da IA (testes não moderados) */}
          <AiHelpInsights test={test} sessions={sessions.filter((s) => s.testId === test.id)} onOpenParticipant={onOpenParticipant} />

          {/* Participantes */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" /> Participantes ({rows.length}{limit ? ` de ${limit}` : ''})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Clique em uma pessoa para ver a página dela.</p>
              </div>
              {onOpenQualitative && rows.length > 0 && (
                <button
                  type="button"
                  onClick={onOpenQualitative}
                  className="ml-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white text-xs font-semibold shadow-sm shadow-violet-200 hover:brightness-110"
                  title="Dores, pontos positivos e leitura comportamental das respostas escritas"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Análise qualitativa (IA)
                </button>
              )}
              {limit > 0 && (
                <div className="w-40">
                  <div className="text-[11px] text-slate-500 text-right">{Math.round((rows.length / limit) * 100)}% das vagas</div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(100, (rows.length / limit) * 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="pb-3">Participante</th>
                    <th className="pb-3">Situação</th>
                    <th className="pb-3">Tarefas</th>
                    <th className="pb-3">Tempo</th>
                    <th className="pb-3">Cliques</th>
                    <th className="pb-3">Retornos</th>
                    <th className="pb-3">SUS</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => {
                    const ok = r.attempts.filter((a) => a.outcome === 'success').length;
                    const isSel = selected?.key === r.key;
                    return (
                      <tr
                        key={r.key}
                        onClick={() => (onOpenParticipant ? onOpenParticipant(r.key) : selectParticipant(isSel ? null : r.key))}
                        title="Abrir a página desta pessoa"
                        className={`cursor-pointer transition-colors ${isSel ? 'bg-blue-50' : 'hover:bg-slate-50/70'}`}
                      >
                        <td className="py-3">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-8 h-8 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${isSel ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                              {r.number ? `#${String(r.number).padStart(2, '0')}` : '—'}
                            </span>
                            <div>
                              <div className="font-semibold text-slate-900">{r.name}</div>
                              <div className="text-[10px] text-slate-400">{new Date(r.startedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.status === 'Concluiu' ? 'bg-emerald-50 text-emerald-700' : r.status === 'Abandonou' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {r.status}
                          </span>
                          {r.gaveUp && r.status === 'Concluiu' && (
                            <div className="text-[10px] text-rose-600 mt-1">desistiu de {r.attempts.filter((a) => a.outcome === 'abandoned').length} tarefa(s)</div>
                          )}
                        </td>
                        <td className="py-3 font-semibold text-slate-800">{ok}/{test.tasks.length}</td>
                        <td className="py-3 font-mono text-slate-700">{fmt(r.journeySec)}</td>
                        <td className="py-3 font-mono text-slate-700">{r.attempts.reduce((acc, a) => acc + a.clicks, 0)}</td>
                        <td className="py-3 text-slate-700">{r.attempts.filter((a) => a.hadReturn).length}</td>
                        <td className="py-3">
                          {typeof r.susScore === 'number' ? (
                            <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${susTone(r.susScore)}`}>{r.susScore}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <ChevronRight className={`w-4 h-4 inline ${isSel ? 'text-blue-600' : 'text-slate-300'}`} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Desempenho por tarefa (no escopo atual) */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Desempenho por Tarefa {selected ? `— ${selected.name}` : '— time'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selected ? 'Resultado desta pessoa em cada tarefa.' : 'Médias de todos os participantes em cada tarefa.'}
                </p>
              </div>
              <button type="button" onClick={() => onOpenTab('journey')} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                Ver jornada →
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="pb-3">Tarefa</th>
                    <th className="pb-3">{selected ? 'Resultado' : 'Sucesso'}</th>
                    <th className="pb-3">{selected ? 'Tempo' : 'Tempo médio'}</th>
                    <th className="pb-3">Cliques</th>
                    <th className="pb-3">Sem efeito</th>
                    <th className="pb-3">Dificuldades</th>
                    <th className="pb-3">Retornos</th>
                    <th className="pb-3">Caminho ideal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {taskRows.map((t, idx) => (
                    <tr key={t.task.id} className="hover:bg-slate-50/60">
                      <td className="py-3.5 font-medium text-slate-900">
                        <span className="font-mono text-blue-600 font-bold mr-1.5">T{idx + 1}</span>
                        {t.task.title}
                      </td>
                      <td className="py-3.5">
                        {selected ? (
                          <OutcomeBadge outcome={selected.attempts[idx]?.outcome || 'not_started'} />
                        ) : t.tried ? (
                          <span className={`font-bold ${pct(t.ok, t.tried) >= 80 ? 'text-emerald-600' : pct(t.ok, t.tried) >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {pct(t.ok, t.tried)}% <span className="text-slate-400 font-normal">({t.ok}/{t.tried})</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3.5 font-mono text-slate-700">{t.tried ? fmt(t.avgTime) : '—'}</td>
                      <td className="py-3.5 font-mono text-slate-700">{selected ? t.clicks : t.tried ? (Math.round((t.clicks / t.tried) * 10) / 10).toString().replace('.', ',') : '—'}{!selected && t.tried ? <span className="text-slate-400"> /pessoa</span> : null}</td>
                      <td className={`py-3.5 font-bold ${t.dead ? 'text-rose-600' : 'text-slate-400'}`}>{t.dead}</td>
                      <td className={`py-3.5 font-bold ${t.difficulties ? 'text-rose-600' : 'text-slate-400'}`}>{t.difficulties}</td>
                      <td className={`py-3.5 font-bold ${t.returns ? 'text-amber-600' : 'text-slate-400'}`}>
                        {selected ? (t.returns ? 'Sim' : 'Não') : t.tried ? `${t.returns} (${pct(t.returns, t.tried)}%)` : '—'}
                      </td>
                      <td className="py-3.5 text-blue-600 font-medium">
                        {!t.idealBase && !t.task.expectedPath?.some((id) => (test.screenMap || []).some((m) => m.screenId === id)) ? (
                          <span className="text-slate-300">sem mapa</span>
                        ) : selected ? (
                          t.idealBase ? (t.ideal ? 'Sim' : 'Não') : '—'
                        ) : t.idealBase ? (
                          `${pct(t.ideal, t.idealBase)}%`
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
