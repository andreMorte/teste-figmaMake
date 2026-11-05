import React, { useMemo, useState } from 'react';
import { ExpectedPathStep, ParticipantSession, ScreenHeatmapData, TrackedEvent, UsabilityTest } from '../../types';
import {
  Compass,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MousePointerClick,
  Users,
  Route,
  Repeat,
  GitBranch,
  X,
  ImageOff,
  Flag,
  ArrowRight
} from 'lucide-react';

interface JourneyVisualizerProps {
  test: UsabilityTest;
  sessions: ParticipantSession[];
  screenHeatmaps?: Record<string, ScreenHeatmapData> | ScreenHeatmapData[];
  isDemo?: boolean;
}

interface JourneyNode {
  index: number;
  screenId: string;
  name: string;
  trigger?: string;
  stepLabel?: string;
  thumb?: string;
  fullImage?: string;
  imageSource?: 'participante' | 'mapeamento';
  reached: number;
  reachedPct: number;
  directNext: number;
  directNextPct: number;
  returns: number;
  returnPct: number;
  deviations: number;
  deviationPct: number;
  avgDwellSec: number;
  avgClicks: number;
  difficulties: number;
  dropPct: number;
  friction: string[];
}

interface OffPathScreen {
  screenId: string;
  name: string;
  sessions: number;
  fromName: string;
  thumb?: string;
  fullImage?: string;
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

const fmtSec = (s: number) => {
  if (!s) return '—';
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
};

function hasAdjacent(path: string[], a: string, b: string) {
  for (let i = 0; i < path.length - 1; i++) if (path[i] === a && path[i + 1] === b) return true;
  return false;
}

/** Quantos passos do caminho esperado o participante cumpriu em ordem (subsequência). */
function orderedProgress(path: string[], expected: string[]) {
  let j = 0;
  for (const s of path) {
    if (j < expected.length && s === expected[j]) j++;
  }
  return j;
}

export const JourneyVisualizer: React.FC<JourneyVisualizerProps> = ({ test, sessions, screenHeatmaps, isDemo }) => {
  const tasks = test.tasks || [];
  const [taskIdx, setTaskIdx] = useState(0);
  const [lightbox, setLightbox] = useState<{ src: string; title: string; caption?: string } | null>(null);
  const task = tasks[Math.min(taskIdx, tasks.length - 1)];

  const heatmapList: ScreenHeatmapData[] = useMemo(
    () => (Array.isArray(screenHeatmaps) ? screenHeatmaps : Object.values(screenHeatmaps || {})),
    [screenHeatmaps]
  );

  const realSessions = useMemo(() => (isDemo ? [] : sessions.filter((s) => s.testId === test.id)), [isDemo, sessions, test.id]);

  const data = useMemo(() => {
    if (!task) return null;
    const details: ExpectedPathStep[] = task.expectedPathDetails || [];
    const expected = task.expectedPath || [];

    // nomes: mapeamento > detalhes do caminho > nome capturado nos eventos dos participantes
    const eventNames: Record<string, string> = {};
    realSessions.forEach((s) =>
      (s.events || []).forEach((e) => {
        const n = (e.metadata as any)?.screenName;
        if (e.eventType === 'SCREEN_VIEW' && e.currentScreen && typeof n === 'string') eventNames[e.currentScreen] = n;
      })
    );
    const nameOf = (id: string) =>
      test.screenMap?.find((m) => m.screenId === id)?.screenName ||
      details.find((d) => d.screenId === id)?.screenName ||
      eventNames[id] ||
      id;

    const imageOf = (id: string) => {
      const hm = heatmapList.find((h) => h.screenId === id);
      const snap: any = hm?.snapshot || hm?.snapshots?.[0];
      const real = snap ? snap.image || snap.imageUrl : undefined;
      const fromParticipant = !!real && snap.sessionId !== 'MAPEAMENTO';
      const mapped = test.screenMap?.find((m) => m.screenId === id)?.thumbnail;
      return {
        thumb: real || mapped,
        full: real || mapped,
        source: fromParticipant ? ('participante' as const) : real || mapped ? ('mapeamento' as const) : undefined
      };
    };

    // sessões que executaram esta tarefa
    const attempts = realSessions
      .map((s) => ({ session: s, path: (s.actualPaths || {})[task.id] || [] }))
      .filter((a) => a.path.length > 0 || (a.session.events || []).some((e) => e.taskId === task.id));
    const N = attempts.length;

    const taskEvents = (s: ParticipantSession) =>
      (s.events || [])
        .filter((e) => e.taskId === task.id)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // tempo de permanência e cliques por cenário
    const dwell: Record<string, { total: number; sessions: number }> = {};
    const clicks: Record<string, number> = {};
    const difficulties: Record<string, number> = {};
    attempts.forEach(({ session }) => {
      const evs = taskEvents(session);
      const seenHere: Record<string, number> = {};
      let currentScreen: string | undefined;
      let enteredAt = 0;
      const close = (until: number) => {
        if (currentScreen && enteredAt) seenHere[currentScreen] = (seenHere[currentScreen] || 0) + Math.max(0, (until - enteredAt) / 1000);
      };
      evs.forEach((e: TrackedEvent) => {
        const t = new Date(e.timestamp).getTime();
        if ((e.eventType === 'SCREEN_VIEW' || e.eventType === 'TASK_START') && e.currentScreen && e.currentScreen !== currentScreen) {
          close(t);
          currentScreen = e.currentScreen;
          enteredAt = t;
        }
        if (e.eventType === 'CLICK') {
          const s = e.currentScreen && !/^figma-frame/.test(e.currentScreen) ? e.currentScreen : currentScreen;
          if (s) clicks[s] = (clicks[s] || 0) + 1;
        }
        if (e.eventType === 'TASK_ERROR' && currentScreen) difficulties[currentScreen] = (difficulties[currentScreen] || 0) + 1;
        if (e.eventType === 'TASK_SUCCESS' || e.eventType === 'TASK_ABANDON') {
          close(t);
          currentScreen = undefined;
        }
      });
      Object.entries(seenHere).forEach(([sid, sec]) => {
        dwell[sid] = dwell[sid] || { total: 0, sessions: 0 };
        dwell[sid].total += sec;
        dwell[sid].sessions += 1;
      });
    });

    const completed = attempts.filter(({ session }) =>
      (session.events || []).some((e) => e.taskId === task.id && e.eventType === 'TASK_SUCCESS')
    ).length;
    const exactIdeal = attempts.filter(({ path }) => path.join('>') === expected.join('>')).length;

    const progress = attempts.map(({ path }) => orderedProgress(path, expected));
    const dwellValues = expected.map((id) => (dwell[id]?.sessions ? dwell[id].total / dwell[id].sessions : 0)).filter((v) => v > 0);
    const medianDwell = dwellValues.length ? [...dwellValues].sort((a, b) => a - b)[Math.floor(dwellValues.length / 2)] : 0;

    const nodes: JourneyNode[] = expected.map((id, i) => {
      const reached = progress.filter((p) => p > i).length;
      const nextId = expected[i + 1];
      const prevId = expected[i - 1];
      const reachedPaths = attempts.filter((_, k) => progress[k] > i).map((a) => a.path);
      const directNext = nextId ? reachedPaths.filter((p) => hasAdjacent(p, id, nextId)).length : 0;
      const returns = prevId ? reachedPaths.filter((p) => hasAdjacent(p, id, prevId)).length : 0;
      const deviations = reachedPaths.filter((p) =>
        p.some((s, k) => s === id && p[k + 1] !== undefined && !expected.includes(p[k + 1]))
      ).length;
      const avgDwellSec = dwell[id]?.sessions ? dwell[id].total / dwell[id].sessions : 0;
      const nextReached = nextId ? progress.filter((p) => p > i + 1).length : reached;
      const dropPct = nextId && reached > 0 ? pct(reached - nextReached, reached) : 0;
      const img = imageOf(id);

      const friction: string[] = [];
      if (reached > 0) {
        if (pct(returns, reached) >= 20) friction.push(`${pct(returns, reached)}% voltaram para a tela anterior`);
        if (pct(deviations, reached) >= 20) friction.push(`${pct(deviations, reached)}% saíram do caminho esperado`);
        if (dropPct >= 30) friction.push(`${dropPct}% não chegaram ao próximo cenário`);
        if (medianDwell > 0 && avgDwellSec > Math.max(10, medianDwell * 1.8)) friction.push(`tempo ${fmtSec(avgDwellSec)} (acima da mediana ${fmtSec(medianDwell)})`);
        if (difficulties[id]) friction.push(`${difficulties[id]} dificuldade(s) reportada(s)`);
      }

      return {
        index: i,
        screenId: id,
        name: nameOf(id),
        trigger: details[i]?.screenId === id ? details[i]?.trigger : details.find((d) => d.screenId === id)?.trigger,
        stepLabel: test.screenMap?.find((m) => m.screenId === id)?.stepLabel,
        thumb: img.thumb,
        fullImage: img.full,
        imageSource: img.source,
        reached,
        reachedPct: pct(reached, N),
        directNext,
        directNextPct: pct(directNext, reached),
        returns,
        returnPct: pct(returns, reached),
        deviations,
        deviationPct: pct(deviations, reached),
        avgDwellSec,
        avgClicks: dwell[id]?.sessions ? Math.round(((clicks[id] || 0) / dwell[id].sessions) * 10) / 10 : 0,
        difficulties: difficulties[id] || 0,
        dropPct,
        friction
      };
    });

    // cenários fora do caminho esperado
    const offMap: Record<string, { sessions: Set<string>; from: Record<string, number> }> = {};
    attempts.forEach(({ session, path }) => {
      path.forEach((s, k) => {
        if (expected.includes(s)) return;
        offMap[s] = offMap[s] || { sessions: new Set(), from: {} };
        offMap[s].sessions.add(session.sessionId);
        const prev = path[k - 1];
        if (prev) offMap[s].from[prev] = (offMap[s].from[prev] || 0) + 1;
      });
    });
    const offPath: OffPathScreen[] = Object.entries(offMap)
      .map(([sid, v]) => {
        const from = Object.entries(v.from).sort((a, b) => b[1] - a[1])[0]?.[0];
        const img = imageOf(sid);
        return { screenId: sid, name: nameOf(sid), sessions: v.sessions.size, fromName: from ? nameOf(from) : 'início', thumb: img.thumb, fullImage: img.full };
      })
      .sort((a, b) => b.sessions - a.sessions);

    // laço pendular mais frequente (A → B → A)
    const loops: Record<string, { seq: string[]; sessions: Set<string> }> = {};
    attempts.forEach(({ session, path }) => {
      for (let k = 0; k < path.length - 2; k++) {
        if (path[k] === path[k + 2] && path[k] !== path[k + 1]) {
          const key = `${path[k]}>${path[k + 1]}`;
          loops[key] = loops[key] || { seq: [path[k], path[k + 1], path[k]], sessions: new Set() };
          loops[key].sessions.add(session.sessionId);
        }
      }
    });
    const topLoop = Object.values(loops).sort((a, b) => b.sessions.size - a.sessions.size)[0];

    const worst = [...nodes].filter((n) => n.friction.length).sort((a, b) => b.friction.length - a.friction.length || b.returnPct - a.returnPct)[0];

    return { N, nodes, completed, exactIdeal, offPath, topLoop, worst, nameOf };
  }, [task, realSessions, heatmapList, test.screenMap]);

  if (!task || !data) {
    return null;
  }

  const { N, nodes, completed, exactIdeal, offPath, topLoop, worst, nameOf } = data;
  const hasMapping = (task.expectedPathDetails && task.expectedPathDetails.length > 0) || (test.screenMap && test.screenMap.length > 0);

  return (
    <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Compass className="w-5 h-5 text-blue-600" />
            <span>Visualizador de Jornada: Nós, Tráfego e Pontos de Fricção</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Caminho mapeado no protótipo × o que os participantes fizeram de verdade. Cada nó é um cenário capturado em tempo real.
          </p>
        </div>
        {tasks.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {tasks.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTaskIdx(i)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                  i === taskIdx ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:text-slate-900'
                }`}
              >
                Tarefa {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KPIs reais da tarefa */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold"><Users className="w-3.5 h-3.5" /> Participantes na tarefa</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{N}</div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold"><Route className="w-3.5 h-3.5" /> Caminho ideal exato</div>
          <div className="text-xl font-bold text-blue-700 mt-1">{pct(exactIdeal, N)}% <span className="text-xs text-slate-500 font-medium">({exactIdeal})</span></div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Concluíram a tarefa</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">{pct(completed, N)}% <span className="text-xs text-slate-500 font-medium">({completed})</span></div>
        </div>
        <div className={`p-3.5 rounded-xl border ${worst ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className={`flex items-center gap-1.5 font-semibold ${worst ? 'text-amber-700' : 'text-slate-500'}`}><AlertTriangle className="w-3.5 h-3.5" /> Maior fricção</div>
          <div className={`text-sm font-bold mt-1 leading-snug ${worst ? 'text-amber-900' : 'text-slate-400'}`}>{worst ? worst.name : N ? 'Nenhuma detectada' : '—'}</div>
        </div>
      </div>

      {isDemo || N === 0 ? (
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
          <Flag className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
          <span>
            Nenhum participante executou esta tarefa ainda. O caminho abaixo é o mapeado no protótipo; tráfego, tempo e fricção aparecem
            assim que as primeiras sessões reais chegarem.
          </span>
        </div>
      ) : null}

      {!hasMapping && (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
          Este teste foi criado sem o mapeador de cenários. Para ver as telas reais em cada nó, crie o teste usando
          <strong> Etapa 2 → Mapear cenários do protótipo</strong>.
        </div>
      )}

      {/* Trilha da jornada */}
      <div className="rounded-xl bg-gradient-to-b from-slate-50 to-white border border-slate-200/80 p-4 overflow-x-auto">
        <div className="flex items-stretch gap-0 min-w-max">
          {/* Início */}
          <div className="flex flex-col items-center justify-center w-20 shrink-0">
            <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex flex-col items-center justify-center shadow-xs">
              <Users className="w-4 h-4" />
              <span className="text-[10px] font-bold">{N}</span>
            </div>
            <span className="text-[10px] text-slate-500 font-semibold mt-1.5 uppercase">Início</span>
          </div>

          {nodes.map((node, i) => {
            const isFriction = node.friction.length > 0;
            const prev = nodes[i - 1];
            const edgePct = i === 0 ? (N ? node.reachedPct : 0) : prev.directNextPct;
            const edgeLabel = i === 0 ? `${node.reachedPct}% começaram aqui` : `${prev.directNextPct}% direto`;
            return (
              <React.Fragment key={`${node.screenId}-${i}`}>
                {/* Conector */}
                <div className="flex flex-col items-center justify-center w-28 shrink-0 px-1">
                  {node.trigger && i > 0 && (
                    <span className="text-[10px] text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5 mb-1.5 max-w-full truncate" title={`Ação esperada: ${node.trigger}`}>
                      <MousePointerClick className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                      {node.trigger}
                    </span>
                  )}
                  <div className="w-full flex items-center">
                    <div className="flex-1 bg-slate-200 rounded-full overflow-hidden" style={{ height: 6 }}>
                      <div
                        className={`h-full rounded-full ${N === 0 ? 'bg-slate-300' : edgePct >= 70 ? 'bg-blue-500' : edgePct >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${N === 0 ? 100 : Math.max(edgePct, 4)}%` }}
                      />
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 -ml-0.5" />
                  </div>
                  <span className="text-[10px] text-slate-600 font-semibold mt-1.5 text-center">{N ? edgeLabel : 'aguardando'}</span>
                  {i > 0 && node.returnPct > 0 && (
                    <span className="text-[10px] text-amber-700 font-bold flex items-center gap-0.5 mt-0.5">
                      <Repeat className="w-3 h-3" /> {node.returnPct}% voltaram
                    </span>
                  )}
                </div>

                {/* Nó (cenário) */}
                <div
                  className={`w-56 shrink-0 rounded-2xl bg-white border-2 shadow-xs overflow-hidden flex flex-col relative ${
                    isFriction ? 'border-amber-400 ring-4 ring-amber-100' : 'border-slate-200'
                  }`}
                >
                  {isFriction && (
                    <span className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold uppercase shadow-xs flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Fricção
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => node.fullImage && setLightbox({ src: node.fullImage, title: node.name, caption: node.imageSource === 'participante' ? 'Captura real de participante' : 'Captura do mapeamento' })}
                    className="relative block w-full aspect-[16/10] bg-slate-100 border-b border-slate-200 overflow-hidden group"
                    title={node.fullImage ? 'Ampliar print' : 'Sem captura'}
                  >
                    {node.thumb ? (
                      <img src={node.thumb} alt={node.name} className="w-full h-full object-cover object-top group-hover:scale-[1.03] transition-transform" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-[10px] gap-1">
                        <ImageOff className="w-5 h-5" />
                        sem captura
                      </div>
                    )}
                    <span className="absolute top-2 left-2 w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shadow">
                      {i + 1}
                    </span>
                    {node.imageSource && (
                      <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-slate-900/70 text-white text-[9px]">
                        {node.imageSource === 'participante' ? 'print real' : 'mapeamento'}
                      </span>
                    )}
                  </button>
                  <div className="p-3 space-y-2 flex-1 flex flex-col">
                    <div>
                      <div className="font-bold text-slate-900 text-xs leading-snug line-clamp-2" title={node.screenId}>{node.name}</div>
                      {node.stepLabel && <div className="text-[10px] text-amber-700 font-semibold mt-0.5">Etapa {node.stepLabel}</div>}
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-bold text-slate-900">{node.reachedPct}%</span>
                        <span className="text-[10px] text-slate-500">{node.reached} de {N} participantes</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1">
                        <div className={`h-full rounded-full ${isFriction ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${node.reachedPct}%` }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-600">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-slate-400" /> {fmtSec(node.avgDwellSec)}</span>
                      <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3 text-slate-400" /> {node.avgClicks || 0} cliques</span>
                      <span className="flex items-center gap-1"><GitBranch className="w-3 h-3 text-slate-400" /> {node.deviationPct}% desvio</span>
                      <span className="flex items-center gap-1"><Repeat className="w-3 h-3 text-slate-400" /> {node.returnPct}% retorno</span>
                    </div>
                    {isFriction && (
                      <ul className="mt-auto pt-2 border-t border-amber-100 space-y-0.5">
                        {node.friction.map((f, k) => (
                          <li key={k} className="text-[10px] text-amber-800 leading-snug">• {f}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {/* Sucesso */}
          <div className="flex flex-col items-center justify-center w-28 shrink-0 px-1">
            <div className="w-full flex items-center">
              <div className="flex-1 bg-slate-200 rounded-full overflow-hidden" style={{ height: 6 }}>
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${N ? Math.max(pct(completed, N), 4) : 100}%` }} />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 -ml-0.5" />
            </div>
            <span className="text-[10px] text-slate-600 font-semibold mt-1.5">{N ? `${pct(completed, N)}% concluíram` : 'aguardando'}</span>
          </div>
          <div className="flex flex-col items-center justify-center w-20 shrink-0">
            <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex flex-col items-center justify-center shadow-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-[10px] font-bold">{completed}</span>
            </div>
            <span className="text-[10px] text-emerald-700 font-semibold mt-1.5 uppercase">Sucesso</span>
          </div>
        </div>
        {nodes.length === 0 && (
          <div className="text-xs text-slate-500 text-center py-6">Esta tarefa não tem caminho esperado definido.</div>
        )}
      </div>

      {/* Laço pendular + desvios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`p-4 rounded-xl border text-xs ${topLoop ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className={`font-bold flex items-center gap-1.5 mb-1.5 ${topLoop ? 'text-amber-900' : 'text-slate-700'}`}>
            <Repeat className="w-4 h-4" /> Laço pendular (ida e volta)
          </div>
          {topLoop ? (
            <div className="space-y-2">
              <div className="text-slate-700">
                <strong>{topLoop.sessions.size}</strong> participante(s) ({pct(topLoop.sessions.size, N)}%) foram e voltaram entre estes cenários:
              </div>
              <div className="flex items-stretch gap-2">
                <span className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-amber-200 text-amber-900 font-semibold leading-snug">{nameOf(topLoop.seq[0])}</span>
                <span className="flex flex-col items-center justify-center text-amber-600 shrink-0">
                  <ArrowRight className="w-3.5 h-3.5" />
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                </span>
                <span className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-amber-200 text-amber-900 font-semibold leading-snug">{nameOf(topLoop.seq[1])}</span>
              </div>
            </div>
          ) : (
            <div className="text-slate-500">{N ? 'Nenhum laço de retorno detectado nas sessões reais.' : 'Aguardando sessões reais.'}</div>
          )}
        </div>

        <div className="p-4 rounded-xl border bg-slate-50 border-slate-200 text-xs">
          <div className="font-bold text-slate-700 flex items-center gap-1.5 mb-2">
            <GitBranch className="w-4 h-4 text-rose-500" /> Cenários fora do caminho esperado
          </div>
          {offPath.length === 0 ? (
            <div className="text-slate-500">{N ? 'Todos os participantes ficaram dentro do caminho mapeado.' : 'Aguardando sessões reais.'}</div>
          ) : (
            <div className="space-y-2">
              {offPath.slice(0, 5).map((o) => (
                <div key={o.screenId} className="flex items-center gap-2.5 bg-white rounded-lg border border-slate-200 p-2">
                  <button
                    type="button"
                    onClick={() => o.fullImage && setLightbox({ src: o.fullImage, title: o.name, caption: 'Cenário fora do caminho' })}
                    className="w-16 h-10 shrink-0 rounded-md bg-slate-100 border border-slate-200 overflow-hidden"
                  >
                    {o.thumb ? <img src={o.thumb} alt="" className="w-full h-full object-cover object-top" /> : <ImageOff className="w-4 h-4 m-auto text-slate-300" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 truncate">{o.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">a partir de: {o.fromName}</div>
                  </div>
                  <span className="text-rose-600 font-bold shrink-0">{o.sessions} ({pct(o.sessions, N)}%)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="max-w-6xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200">
              <div>
                <div className="text-sm font-bold text-slate-900">{lightbox.title}</div>
                {lightbox.caption && <div className="text-[11px] text-slate-500">{lightbox.caption}</div>}
              </div>
              <button type="button" onClick={() => setLightbox(null)} className="p-1.5 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[80vh] overflow-auto bg-slate-100">
              <img src={lightbox.src} alt={lightbox.title} className="w-full h-auto" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
