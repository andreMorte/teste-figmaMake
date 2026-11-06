import React, { useEffect, useMemo, useState } from 'react';
import { ParticipantSession, TrackedEvent, UsabilityTest } from '../../types';
import { HeatmapExplorer } from '../analytics/HeatmapExplorer';
import { npsOf, susQuestionsOf, npsCategory, NPS_LABEL } from '../../utils/surveyDefaults';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  MousePointerClick,
  CheckCircle2,
  XCircle,
  CircleDashed,
  RotateCcw,
  GitBranch,
  AlertTriangle,
  Monitor,
  CalendarDays,
  MessageSquareText,
  ImageOff,
  X,
  Flag,
  Sparkles
} from 'lucide-react';

interface ParticipantDetailProps {
  testId: string;
  participantKey: string;
  onBack: () => void;
  onOpenParticipant: (key: string) => void;
  onName?: (name: string) => void;
}

interface Results {
  test: UsabilityTest;
  sessions: ParticipantSession[];
  heatmap: any[];
  screenHeatmaps: Record<string, any>;
  snapshots: any[];
  susResponses?: { sessionId: string; answers: number[]; computedScore: number }[];
}

const ts = (e: TrackedEvent) => new Date(e.timestamp).getTime();
const fmt = (sec: number) => {
  if (!sec || sec < 0) return '00:00';
  const s = Math.round(sec);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const keyOf = (s: ParticipantSession) => s.participantId || s.sessionId;
const susClass = (s: number) => (s >= 85 ? 'Excelente' : s >= 70 ? 'Bom' : s >= 50 ? 'Neutro' : s >= 35 ? 'Ruim' : 'Muito ruim');
const susTone = (s: number) => (s >= 70 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : s >= 50 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-rose-600 bg-rose-50 border-rose-200');
const IGNORE_SCREENS = /^(task-|figma-frame|inicio$|start$|survey$|sus$|end$|fim$|SCREEN-001$)/;

interface Step {
  screenId: string;
  name: string;
  enteredAt: number;
  dwell: number;
  clicks: number;
  deadClicks: number;
  trigger?: string;
  offPath: boolean;
  revisit: boolean;
  image?: string;
}

interface TaskBlock {
  taskId: string;
  title: string;
  outcome: 'success' | 'abandoned' | 'in_progress' | 'not_started';
  duration: number;
  steps: Step[];
  difficulties: string[];
  aiHelps: { q: string; a: string; screen?: string }[];
  ideal: boolean | null;
}

export const ParticipantDetail: React.FC<ParticipantDetailProps> = ({ testId, participantKey, onBack, onOpenParticipant, onName }) => {
  const [data, setData] = useState<Results | null>(null);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState<{ src: string; title: string } | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    fetch(`/api/tests/${encodeURIComponent(testId)}/results`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(String(e.message || e)));
    return () => {
      alive = false;
    };
  }, [testId]);

  // participantes em ordem (para navegar entre pessoas)
  const roster = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, ParticipantSession>();
    data.sessions.forEach((s) => {
      const k = keyOf(s);
      if (!m.has(k)) m.set(k, s);
    });
    return [...m.entries()].map(([key, s]) => ({ key, number: s.participantNumber || 999, name: s.participantName })).sort((a, b) => a.number - b.number);
  }, [data]);

  const view = useMemo(() => {
    if (!data) return null;
    const test = data.test;
    const sessions = data.sessions.filter((s) => keyOf(s) === participantKey).sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (!sessions.length) return null;
    const sessionIds = sessions.map((s) => s.sessionId);
    const mappedIds = new Set((test.screenMap || []).map((m) => m.screenId));

    const names: Record<string, string> = {};
    (test.screenMap || []).forEach((m) => (names[m.screenId] = m.screenName));
    Object.values(data.screenHeatmaps || {}).forEach((h: any) => (names[h.screenId] = names[h.screenId] || h.screenName));
    sessions.forEach((s) =>
      s.events.forEach((e) => {
        const n = (e.metadata as any)?.screenName;
        if (e.currentScreen && typeof n === 'string' && !names[e.currentScreen]) names[e.currentScreen] = n;
      })
    );
    const nameOf = (id: string) => names[id] || id;

    const imageOf = (screenId: string) => {
      const snaps = (data.snapshots || []).filter((sn) => sn.screenId === screenId);
      const own = snaps.find((sn) => sessionIds.includes(sn.sessionId)) || snaps.find((sn) => sn.sessionId === 'PRE-START');
      const any = own || snaps.find((sn) => sn.sessionId !== 'MAPEAMENTO') || snaps[0];
      return any ? any.image || any.imageUrl : (test.screenMap || []).find((m) => m.screenId === screenId)?.thumbnail;
    };

    const allEvents = sessions.flatMap((s) => s.events).sort((a, b) => ts(a) - ts(b));
    const sessionEnd = (s: ParticipantSession) => (s.endTime ? new Date(s.endTime).getTime() : ts(s.events[s.events.length - 1] || ({ timestamp: s.startTime } as any)));

    const tasks: TaskBlock[] = test.tasks.map((task) => {
      const evs = allEvents.filter((e) => e.taskId === task.id);
      const start = evs.find((e) => e.eventType === 'TASK_START');
      const success = evs.find((e) => e.eventType === 'TASK_SUCCESS');
      const abandon = evs.find((e) => e.eventType === 'TASK_ABANDON');
      const end = success || abandon;
      const outcome: TaskBlock['outcome'] = success ? 'success' : abandon ? 'abandoned' : evs.length ? 'in_progress' : 'not_started';
      const endTime = end ? ts(end) : evs.length ? ts(evs[evs.length - 1]) : 0;
      const duration = end?.durationMs ? end.durationMs / 1000 : start && endTime ? (endTime - ts(start)) / 1000 : 0;
      const expected = (task.expectedPath || []).filter((id) => mappedIds.has(id)).length ? task.expectedPath : [];

      // passos: cada entrada em um cenário
      const entries = evs.filter((e) => (e.eventType === 'SCREEN_VIEW' || e.eventType === 'TASK_START') && e.currentScreen && !IGNORE_SCREENS.test(e.currentScreen));
      const steps: Step[] = [];
      const seen = new Set<string>();
      entries.forEach((e, i) => {
        if (steps.length && steps[steps.length - 1].screenId === e.currentScreen) return;
        const t = ts(e);
        const nextEntry = entries.slice(i + 1).find((x) => x.currentScreen !== e.currentScreen);
        const until = nextEntry ? ts(nextEntry) : end ? ts(end) : endTime || t;
        const clicks = evs.filter((c) => c.eventType === 'CLICK' && ts(c) >= t && ts(c) < (nextEntry ? ts(nextEntry) : Infinity));
        const dead = clicks.filter((c) => (c.metadata as any)?.interactive === false && !allEvents.some((x) => x.eventType === 'SCREEN_VIEW' && ts(x) > ts(c) && ts(x) - ts(c) <= 2000)).length;
        steps.push({
          screenId: e.currentScreen,
          name: nameOf(e.currentScreen),
          enteredAt: start ? (t - ts(start)) / 1000 : 0,
          dwell: Math.max(0, (until - t) / 1000),
          clicks: clicks.length,
          deadClicks: dead,
          trigger: (e.metadata as any)?.trigger,
          offPath: expected.length > 0 && !expected.includes(e.currentScreen),
          revisit: seen.has(e.currentScreen),
          image: imageOf(e.currentScreen)
        });
        seen.add(e.currentScreen);
      });
      const path = steps.map((s) => s.screenId);
      return {
        taskId: task.id,
        title: task.title,
        outcome,
        duration,
        steps,
        difficulties: evs
          .filter((e) => e.eventType === 'TASK_ERROR' || e.eventType === 'TASK_ABANDON')
          .map((e) => String((e.metadata as any)?.comment || ''))
          .filter(Boolean),
        aiHelps: evs
          .filter((e) => (e.eventType as string) === 'AI_HELP')
          .map((e) => ({ q: String((e.metadata as any)?.question || ''), a: String((e.metadata as any)?.answer || ''), screen: (e.metadata as any)?.screenName })),
        ideal: expected.length ? path.join('>') === expected.join('>') : null
      };
    });

    const clicks = allEvents.filter((e) => e.eventType === 'CLICK').length;
    const dead = tasks.reduce((a, t) => a + t.steps.reduce((b, s) => b + s.deadClicks, 0), 0);
    const returns = tasks.reduce((a, t) => a + t.steps.filter((s) => s.revisit).length, 0);
    const offPath = tasks.reduce((a, t) => a + t.steps.filter((s) => s.offPath).length, 0);
    const last = sessions[sessions.length - 1];
    const sus = data.susResponses?.find((r) => sessionIds.includes(r.sessionId));
    const custom = allEvents.filter((e) => e.eventType === 'CUSTOM_SURVEY_END').map((e) => (e.metadata as any)?.answers || {})[0] || {};
    const susComment = allEvents.filter((e) => e.eventType === 'SUS_COMPLETE').map((e) => (e.metadata as any)?.comment).find(Boolean);
    const viewport = allEvents.find((e) => (e.metadata as any)?.docWidth)?.metadata as any;
    const totalSession = sessions.reduce((a, s) => a + Math.max(0, (sessionEnd(s) - new Date(s.startTime).getTime()) / 1000), 0);

    return {
      test,
      sessions,
      sessionIds,
      last,
      tasks,
      ok: tasks.filter((t) => t.outcome === 'success').length,
      taskTime: tasks.reduce((a, t) => a + t.duration, 0),
      totalSession,
      clicks,
      dead,
      returns,
      offPath,
      difficulties: tasks.reduce((a, t) => a + t.difficulties.length, 0),
      aiHelps: tasks.reduce((a, t) => a + t.aiHelps.length, 0),
      susScore: typeof last.susScore === 'number' ? last.susScore : sus?.computedScore,
      susAnswers: sus?.answers,
      susComment,
      custom,
      width: viewport?.docWidth ? Math.round(viewport.docWidth) : undefined,
      status: sessions.some((s) => s.status === 'Concluído') ? 'Concluiu' : sessions.some((s) => s.status === 'Abandonado') ? 'Saiu antes de terminar' : 'Em andamento'
    };
  }, [data, participantKey]);

  useEffect(() => {
    if (view && onName) onName(view.last.participantName);
  }, [view, onName]);

  if (error) return <div className="p-10 text-center text-sm text-rose-600">Não foi possível carregar: {error}</div>;
  if (!data) return <div className="py-24 text-center text-sm text-slate-400">Carregando participante...</div>;
  if (!view) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="text-sm text-slate-500">Participante não encontrado neste teste.</div>
        <button type="button" onClick={onBack} className="text-sm text-blue-600 font-medium hover:underline">Voltar ao teste</button>
      </div>
    );
  }

  const idx = roster.findIndex((r) => r.key === participantKey);
  const prev = idx > 0 ? roster[idx - 1] : null;
  const next = idx >= 0 && idx < roster.length - 1 ? roster[idx + 1] : null;
  const number = view.last.participantNumber;
  const limit = view.test.participantLimit;

  const outcomeChip = (o: TaskBlock['outcome']) =>
    o === 'success' ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Concluiu</span>
    ) : o === 'abandoned' ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-xs font-semibold"><XCircle className="w-3.5 h-3.5" /> Desistiu</span>
    ) : o === 'in_progress' ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold"><CircleDashed className="w-3.5 h-3.5" /> Não terminou</span>
    ) : (
      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold">Não iniciou</span>
    );

  const kpis = [
    { label: 'Tarefas concluídas', value: `${view.ok}/${view.tasks.length}`, icon: CheckCircle2, tone: view.ok === view.tasks.length ? 'text-emerald-600' : 'text-amber-600' },
    { label: 'Tempo nas tarefas', value: fmt(view.taskTime), sub: `sessão inteira ${fmt(view.totalSession)}`, icon: Clock, tone: 'text-slate-900' },
    { label: 'Cliques', value: view.clicks, sub: `${view.dead} sem efeito`, icon: MousePointerClick, tone: 'text-slate-900' },
    { label: 'Voltou a telas', value: view.returns, icon: RotateCcw, tone: view.returns ? 'text-amber-600' : 'text-slate-900' },
    { label: 'Telas fora do caminho', value: view.offPath, icon: GitBranch, tone: view.offPath ? 'text-violet-600' : 'text-slate-900' },
    {
      label: 'Dificuldades',
      value: view.difficulties,
      sub: view.test.moderation === 'unmoderated' ? `${view.aiHelps} pedido(s) de ajuda à IA` : undefined,
      icon: AlertTriangle,
      tone: view.difficulties || view.aiHelps ? 'text-rose-600' : 'text-slate-900'
    }
  ];

  const pointsOfPerson = (data.heatmap || []).filter((p: any) => view.sessionIds.includes(p.sessionId));

  return (
    <div className="space-y-6">
      {/* Navegação */}
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Voltar ao teste
        </button>
        {roster.length > 1 && (
          <div className="flex items-center gap-1">
            <button type="button" disabled={!prev} onClick={() => prev && onOpenParticipant(prev.key)} className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-30 hover:bg-slate-50" title={prev ? `Anterior: ${prev.name}` : ''}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-500 px-2">{idx + 1} de {roster.length}</span>
            <button type="button" disabled={!next} onClick={() => next && onOpenParticipant(next.key)} className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-30 hover:bg-slate-50" title={next ? `Próximo: ${next.name}` : ''}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Cabeçalho da pessoa */}
      <div className="rounded-3xl bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 text-white p-6 sm:p-8 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center text-xl font-bold shrink-0">
              {number ? `#${String(number).padStart(2, '0')}` : view.last.participantName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-blue-100 text-xs font-medium">
                {view.test.name}
                {number && limit ? ` · participante ${number} de ${limit}` : ''}
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight truncate">{view.last.participantName}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-blue-100 mt-1.5">
                <span className="inline-flex items-center gap-1"><Flag className="w-3.5 h-3.5" /> {view.status}</span>
                <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {new Date(view.sessions[0].startTime).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                {view.width && <span className="inline-flex items-center gap-1"><Monitor className="w-3.5 h-3.5" /> tela de {view.width}px</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-white/10 rounded-2xl px-5 py-4 self-start lg:self-auto">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-blue-100 font-semibold">SUS</div>
              <div className="text-4xl font-bold leading-none mt-1">{typeof view.susScore === 'number' ? view.susScore : '—'}</div>
            </div>
            <div className="text-sm font-semibold">{typeof view.susScore === 'number' ? susClass(view.susScore) : 'Não respondeu'}</div>
          </div>
        </div>
      </div>

      {/* Métricas da pessoa */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium"><k.icon className="w-3.5 h-3.5" /> {k.label}</div>
            <div className={`text-2xl font-semibold mt-1.5 ${k.tone}`}>{k.value}</div>
            {k.sub && <div className="text-[11px] text-slate-400 mt-0.5">{k.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start">
        {/* Jornada passo a passo */}
        <div className="space-y-5">
          {view.tasks.map((task, ti) => (
            <div key={task.taskId} className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <div className="text-xs text-slate-400 font-semibold">Tarefa {ti + 1}</div>
                  <div className="text-base font-semibold text-slate-900">{task.title}</div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {outcomeChip(task.outcome)}
                  <span className="inline-flex items-center gap-1 text-slate-500"><Clock className="w-3.5 h-3.5" /> {fmt(task.duration)}</span>
                  {task.ideal !== null && (
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${task.ideal ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>
                      {task.ideal ? 'Caminho ideal' : 'Caminho diferente do ideal'}
                    </span>
                  )}
                </div>
              </div>
              {task.steps.length === 0 ? (
                <div className="p-6 text-sm text-slate-400">Nenhuma tela registrada nesta tarefa.</div>
              ) : (
                <ol className="p-5 space-y-0">
                  {task.steps.map((st, si) => (
                    <li key={`${st.screenId}-${si}`} className="relative flex gap-4 pb-5 last:pb-0">
                      {si < task.steps.length - 1 && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200" />}
                      <span
                        className={`relative z-10 w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                          st.offPath ? 'bg-violet-100 text-violet-700' : st.revisit ? 'bg-amber-100 text-amber-700' : 'bg-blue-600 text-white'
                        }`}
                      >
                        {si + 1}
                      </span>
                      <div className="flex-1 min-w-0 flex flex-col sm:flex-row gap-4">
                        <button
                          type="button"
                          onClick={() => st.image && setLightbox({ src: st.image, title: st.name })}
                          className="w-full sm:w-44 aspect-[16/10] shrink-0 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group"
                          title={st.image ? 'Ampliar print' : 'Sem print'}
                        >
                          {st.image ? (
                            <img src={st.image} alt={st.name} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform" />
                          ) : (
                            <span className="w-full h-full flex items-center justify-center text-slate-300"><ImageOff className="w-5 h-5" /></span>
                          )}
                        </button>
                        <div className="min-w-0 space-y-1.5">
                          {st.trigger && si > 0 && <div className="text-xs text-violet-700">depois de clicar em “{st.trigger}”</div>}
                          <div className="text-sm font-semibold text-slate-900 leading-snug">{st.name}</div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span>entrou em {fmt(st.enteredAt)}</span>
                            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> ficou {fmt(st.dwell)}</span>
                            <span className="inline-flex items-center gap-1"><MousePointerClick className="w-3 h-3" /> {st.clicks} clique(s)</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {st.revisit && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold">voltou a esta tela</span>}
                            {st.offPath && <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[11px] font-semibold">fora do caminho esperado</span>}
                            {st.deadClicks > 0 && <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[11px] font-semibold">{st.deadClicks} clique(s) sem efeito</span>}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {task.aiHelps.length > 0 && (
                <div className="px-5 py-3 bg-violet-50 border-t border-violet-100 text-xs space-y-2">
                  <div className="font-semibold text-violet-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Pediu ajuda à IA {task.aiHelps.length}×
                  </div>
                  {task.aiHelps.map((h, i) => (
                    <div key={i} className="space-y-0.5">
                      <div className="text-slate-800">
                        “{h.q}” {h.screen && <span className="text-slate-400">· em {h.screen}</span>}
                      </div>
                      <div className="text-violet-700">↳ {h.a}</div>
                    </div>
                  ))}
                </div>
              )}
              {task.difficulties.length > 0 && (
                <div className="px-5 py-3 bg-rose-50 border-t border-rose-100 text-xs text-rose-800 space-y-1">
                  {task.difficulties.map((d, i) => (
                    <div key={i} className="flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> “{d}”</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Respostas */}
        <div className="space-y-5 xl:sticky xl:top-20">
          {(view.test.customQuestions || []).length > 0 && (
            <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><MessageSquareText className="w-4 h-4 text-blue-600" /> Perguntas do teste</div>
              {(view.test.customQuestions || []).map((q) => {
                const a = view.custom[q.id];
                return (
                  <div key={q.id} className="space-y-1.5">
                    <div className="text-xs text-slate-500">{q.question}</div>
                    {a === undefined || a === '' ? (
                      <div className="text-sm text-slate-300">Sem resposta</div>
                    ) : q.type === 'likert_scale' ? (
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} className={`w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center ${Number(a) === n ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{n}</span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-900 bg-slate-50 rounded-xl px-3 py-2">“{String(a)}”</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {view.custom.NPS !== undefined && view.custom.NPS !== '' && (() => {
            const cfg = npsOf(view.test);
            const max = Number(view.custom.NPS_MAX) || cfg.scaleMax;
            const n = Number(view.custom.NPS);
            const cat = npsCategory(n, max);
            const tone = cat === 'promotor' ? 'bg-emerald-50 text-emerald-700' : cat === 'neutro' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700';
            return (
              <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">NPS</div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${tone}`}>
                    {n} de {max} · {NPS_LABEL[cat]}
                  </span>
                </div>
                <div className="text-xs text-slate-500">{cfg.question}</div>
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: max + 1 }, (_, k) => (
                    <span key={k} className={`w-7 h-7 rounded-md text-[11px] font-semibold flex items-center justify-center ${n === k ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      {k}
                    </span>
                  ))}
                </div>
                <div className="text-[10px] text-slate-400">
                  0 = {cfg.minLabel} · {max} = {cfg.maxLabel}
                </div>
              </div>
            );
          })()}

          <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Sparkles className="w-4 h-4 text-amber-500" /> Questionário SUS</div>
              {typeof view.susScore === 'number' && (
                <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${susTone(view.susScore)}`}>{view.susScore} · {susClass(view.susScore)}</span>
              )}
            </div>
            {view.susAnswers ? (
              <div className="space-y-3">
                {susQuestionsOf(view.test).map((q, i) => (
                  <div key={i} className="space-y-1">
                    <div className="text-xs text-slate-600 leading-snug">{i + 1}. {q}</div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span
                          key={n}
                          className={`flex-1 h-1.5 rounded-full ${n <= (view.susAnswers![i] || 0) ? (i % 2 === 0 ? 'bg-blue-500' : 'bg-slate-500') : 'bg-slate-100'}`}
                        />
                      ))}
                      <span className="w-6 text-right text-xs font-semibold text-slate-700">{view.susAnswers![i]}</span>
                    </div>
                  </div>
                ))}
                <div className="text-[11px] text-slate-400">1 = discordo totalmente · 5 = concordo totalmente. Itens pares são negativos (quanto menor, melhor).</div>
              </div>
            ) : (
              <div className="text-sm text-slate-400">Ainda não respondeu o questionário.</div>
            )}
            {view.susComment && <div className="text-sm text-slate-900 bg-slate-50 rounded-xl px-3 py-2">“{view.susComment}”</div>}
          </div>
        </div>
      </div>

      {/* Mapa de calor só desta pessoa */}
      <div className="space-y-3">
        <div className="text-base font-semibold text-slate-900">Mapa de calor de {view.last.participantName}</div>
        <HeatmapExplorer
          test={view.test}
          sessions={view.sessions}
          points={pointsOfPerson}
          screenHeatmaps={data.screenHeatmaps}
          fixedParticipantKey={participantKey}
          preferSessionIds={view.sessionIds}
        />
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-slate-900/85 p-4 overflow-auto flex items-start justify-center" onClick={() => setLightbox(null)}>
          <div className="max-w-6xl w-full bg-white rounded-2xl overflow-hidden mt-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div className="text-sm font-semibold text-slate-900">{lightbox.title}</div>
              <button type="button" onClick={() => setLightbox(null)} className="p-1.5 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <img src={lightbox.src} alt={lightbox.title} className="w-full h-auto" />
          </div>
        </div>
      )}
    </div>
  );
};
