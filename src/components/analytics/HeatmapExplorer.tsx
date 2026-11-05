import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ParticipantSession, UsabilityTest } from '../../types';
import { Flame, MousePointerClick, LayoutGrid, Image as ImageIcon, Users, Clock, Target, Ban, Layers, ImageOff, Maximize2, X } from 'lucide-react';

// Ponto de clique vindo de /api/tests/:id/results (heatmap)
export interface ClickPoint {
  id: string;
  screen: string;
  element?: string;
  taskId?: string;
  interactive?: boolean;
  pageNX?: number;
  pageNY?: number;
  docWidth?: number;
  docHeight?: number;
  elementRect?: { x: number; y: number; w: number; h: number };
  normalizedX: number;
  normalizedY: number;
  timestamp: string;
  sessionId: string;
  participantId?: string;
}

interface SnapshotMeta {
  snapshotId: string;
  screenId: string;
  screenName?: string;
  sessionId?: string;
  imageUrl?: string;
  image?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  documentWidth?: number;
  documentHeight?: number;
  capturedHeight?: number;
  fullPage?: boolean;
  timestamp?: string;
}

interface HeatmapExplorerProps {
  test: UsabilityTest;
  sessions: ParticipantSession[];
  points: ClickPoint[];
  screenHeatmaps?: Record<string, any> | any[];
  isDemo?: boolean;
  /** Página do participante: fixa o filtro nesta pessoa e prefere os prints da sessão dela */
  fixedParticipantKey?: string;
  preferSessionIds?: string[];
}

type Layer = 'heat' | 'clicks' | 'zones';

// Paleta clássica de mapa de calor (frio → quente)
const PALETTE: [number, number, number][] = [
  [37, 99, 235],
  [6, 182, 212],
  [34, 197, 94],
  [234, 179, 8],
  [249, 115, 22],
  [220, 38, 38]
];
function paletteAt(t: number): [number, number, number] {
  const x = Math.max(0, Math.min(0.9999, t)) * (PALETTE.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = PALETTE[i];
  const b = PALETTE[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

const fmtSec = (s: number) => (!s ? '—' : s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`);

/** Posição do clique (0..1) sobre a imagem-base do cenário. */
function project(p: ClickPoint, snap?: SnapshotMeta): { x: number; y: number } | null {
  if (snap?.fullPage && snap.capturedHeight) {
    if (typeof p.pageNX === 'number' && typeof p.pageNY === 'number') {
      const docH = p.docHeight || snap.documentHeight || snap.capturedHeight;
      const y = (p.pageNY * docH) / snap.capturedHeight;
      return y <= 1 ? { x: p.pageNX, y } : null;
    }
    // clique antigo (só área visível): assume topo da página
    const vh = snap.viewportHeight || 900;
    const y = (p.normalizedY * vh) / snap.capturedHeight;
    return y <= 1 ? { x: p.normalizedX, y } : null;
  }
  return { x: p.normalizedX, y: p.normalizedY };
}

function projectRect(r: ClickPoint['elementRect'], p: ClickPoint, snap?: SnapshotMeta) {
  if (!r || !snap?.fullPage || !snap.capturedHeight) return null;
  const docH = p.docHeight || snap.documentHeight || snap.capturedHeight;
  const k = docH / snap.capturedHeight;
  return { x: r.x, y: r.y * k, w: r.w, h: r.h * k };
}

const HeatCanvas: React.FC<{ pts: { x: number; y: number }[]; radius: number; opacity: number }> = ({ pts, radius, opacity }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = ref.current;
    if (!c || !size.w || !size.h) return;
    c.width = size.w;
    c.height = size.h;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, size.w, size.h);
    if (!pts.length) return;
    const r = Math.max(8, (radius / 1000) * size.w * 1.6);
    // 1) intensidade acumulada em tons de alfa
    pts.forEach((p) => {
      const x = p.x * size.w;
      const y = p.y * size.h;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,0.42)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
    // 2) colorização pela paleta
    const img = ctx.getImageData(0, 0, size.w, size.h);
    const d = img.data;
    let max = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > max) max = d[i];
    if (!max) return;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (!a) continue;
      const t = a / max;
      const [rr, gg, bb] = paletteAt(t);
      d[i] = rr;
      d[i + 1] = gg;
      d[i + 2] = bb;
      d[i + 3] = Math.min(255, (0.25 + t * 0.75) * 255 * opacity);
    }
    ctx.putImageData(img, 0, 0);
  }, [pts, radius, opacity, size]);

  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" />;
};

export const HeatmapExplorer: React.FC<HeatmapExplorerProps> = ({ test, sessions, points, screenHeatmaps, isDemo, fixedParticipantKey, preferSessionIds }) => {
  const realSessions = useMemo(() => (isDemo ? [] : sessions.filter((s) => s.testId === test.id)), [isDemo, sessions, test.id]);
  const allPoints = isDemo ? [] : points;
  const hmMap: Record<string, any> = useMemo(() => {
    if (!screenHeatmaps) return {};
    if (Array.isArray(screenHeatmaps)) return Object.fromEntries(screenHeatmaps.map((h: any) => [h.screenId, h]));
    return screenHeatmaps;
  }, [screenHeatmaps]);

  // Participantes (número + nome) por sessão
  const participantBySession = useMemo(() => {
    const m: Record<string, { key: string; label: string }> = {};
    realSessions.forEach((s) => {
      const key = s.participantId || s.sessionId;
      m[s.sessionId] = { key, label: `${s.participantNumber ? `#${String(s.participantNumber).padStart(2, '0')} ` : ''}${s.participantName}` };
    });
    return m;
  }, [realSessions]);
  const participants = useMemo(() => {
    const seen = new Map<string, string>();
    (Object.values(participantBySession) as { key: string; label: string }[]).forEach((p) => seen.set(p.key, p.label));
    return [...seen.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [participantBySession]);

  // Nomes dos cenários
  const nameOf = useMemo(() => {
    const names: Record<string, string> = {};
    realSessions.forEach((s) =>
      (s.events || []).forEach((e) => {
        const n = (e.metadata as any)?.screenName;
        if (e.eventType === 'SCREEN_VIEW' && e.currentScreen && typeof n === 'string') names[e.currentScreen] = n;
      })
    );
    test.tasks.forEach((t) => (t.expectedPathDetails || []).forEach((d) => (names[d.screenId] = names[d.screenId] || d.screenName)));
    (test.screenMap || []).forEach((m) => (names[m.screenId] = m.screenName));
    Object.values(hmMap).forEach((h: any) => (names[h.screenId] = names[h.screenId] || h.screenName));
    return (id: string) => names[id] || id;
  }, [realSessions, test, hmMap]);

  // Lista de cenários: tudo o que o participante realmente viu, na ordem em que navegou,
  // mesmo que o teste não tenha sido mapeado. Caminhos de exemplo sem dados ficam de fora.
  const screens = useMemo(() => {
    const order: string[] = [];
    const add = (id?: string) => id && !order.includes(id) && order.push(id);
    const mappedIds = new Set((test.screenMap || []).map((m) => m.screenId));
    // 1) caminho esperado (só cenários mapeados de verdade)
    if (!fixedParticipantKey) test.tasks.forEach((t) => (t.expectedPath || []).filter((id) => mappedIds.has(id)).forEach(add));
    // 2) ordem real de navegação dos participantes
    realSessions
      .slice()
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .forEach((s) =>
        (s.events || [])
          .slice()
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
          .filter((e) => (e.eventType === 'SCREEN_VIEW' || e.eventType === 'TASK_START' || e.eventType === 'CLICK') && e.currentScreen)
          .forEach((e) => add(e.currentScreen))
      );
    // 3) cenários mapeados não visitados, e qualquer tela com print ou clique
    const counts: Record<string, number> = {};
    allPoints.forEach((p) => (counts[p.screen] = (counts[p.screen] || 0) + 1));
    if (!fixedParticipantKey) {
      (test.screenMap || []).forEach((m) => add(m.screenId));
      Object.keys(counts).forEach(add);
      Object.keys(hmMap).forEach(add);
    } else {
      // página da pessoa: só as telas que ela viu ou clicou
      allPoints.filter((p) => participantBySession[p.sessionId]?.key === fixedParticipantKey).forEach((p) => add(p.screen));
    }
    return order
      .filter((id) => !/^(figma-frame|task-|SCREEN-001|inicio$|start$|survey$|sus$|end$|fim$)/.test(id))
      .map((id) => {
        const hm = hmMap[id];
        const snap: SnapshotMeta | undefined = hm?.snapshot;
        const mapped = test.screenMap?.find((m) => m.screenId === id);
        return {
          id,
          name: nameOf(id),
          snap,
          snaps: ((hm?.snapshots as SnapshotMeta[]) || (snap ? [snap] : [])).filter(Boolean),
          imageSrc: snap ? snap.image || snap.imageUrl : mapped?.thumbnail,
          lowRes: !snap && !!mapped?.thumbnail,
          thumbSrc: mapped?.thumbnail || (snap ? snap.image || snap.imageUrl : undefined),
          clicks: counts[id] || 0,
          inExpected: true
        };
      });
  }, [test, allPoints, hmMap, nameOf, realSessions, fixedParticipantKey, participantBySession]);

  const [screenId, setScreenId] = useState<string>('');
  const [participant, setParticipant] = useState(fixedParticipantKey || 'all');
  const [taskId, setTaskId] = useState('all');
  const [clickType, setClickType] = useState<'all' | 'valid' | 'dead'>('all');
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ heat: true, clicks: false, zones: false });
  const [radius, setRadius] = useState(40);
  const [opacity, setOpacity] = useState(0.75);
  const [hoverZone, setHoverZone] = useState<string | null>(null);
  const [imgRatio, setImgRatio] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!screens.length) return;
    if (!screens.find((s) => s.id === screenId)) {
      setScreenId((screens.find((s) => s.clicks > 0) || screens[0]).id);
    }
  }, [screens, screenId]);
  useEffect(() => setImgRatio(null), [screenId]);

  const screenBase = screens.find((s) => s.id === screenId);

  // Larguras de tela: o layout muda com a largura, então cada largura tem o seu print-base
  const [widthKey, setWidthKey] = useState<string>('auto');
  useEffect(() => setWidthKey('auto'), [screenId]);
  const bucket = (w?: number) => (w ? String(Math.round(w / 40) * 40) : '');
  const widthOptions = useMemo(() => {
    const m: Record<string, { width: number; clicks: number; hasImage: boolean }> = {};
    allPoints
      .filter((p) => p.screen === screenId && p.docWidth)
      .forEach((p) => {
        const k = bucket(p.docWidth);
        m[k] = m[k] || { width: Math.round(p.docWidth!), clicks: 0, hasImage: false };
        m[k].clicks += 1;
      });
    (screenBase?.snaps || []).forEach((sn) => {
      const k = bucket(sn.documentWidth || sn.viewportWidth);
      if (!k) return;
      m[k] = m[k] || { width: Math.round((sn.documentWidth || sn.viewportWidth)!), clicks: 0, hasImage: false };
      m[k].hasImage = true;
    });
    return Object.entries(m)
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.clicks - a.clicks || Number(b.hasImage) - Number(a.hasImage));
  }, [allPoints, screenId, screenBase]);
  const activeWidth = widthKey === 'auto' ? widthOptions[0]?.key : widthKey;
  const current = useMemo(() => {
    if (!screenBase) return undefined;
    if (!activeWidth || !screenBase.snaps.length) return screenBase;
    const target = Number(activeWidth);
    // print da mesma largura (participante > mapeamento); senão o mais próximo
    const ranked = [...screenBase.snaps].sort((a, b) => {
      const da = Math.abs((a.documentWidth || a.viewportWidth || 0) - target);
      const db = Math.abs((b.documentWidth || b.viewportWidth || 0) - target);
      const own = (x: SnapshotMeta) => (preferSessionIds && x.sessionId && preferSessionIds.includes(x.sessionId) ? 0 : 1);
      return own(a) - own(b) || da - db || (a.sessionId === 'MAPEAMENTO' ? 1 : 0) - (b.sessionId === 'MAPEAMENTO' ? 1 : 0);
    });
    const snap = ranked[0];
    return { ...screenBase, snap, imageSrc: snap.image || snap.imageUrl, lowRes: false };
  }, [screenBase, activeWidth]);
  const sameWidth = (p: ClickPoint) => !p.docWidth || !activeWidth || Math.abs(p.docWidth - Number(activeWidth)) / Number(activeWidth) <= 0.06;

  const filtered = useMemo(
    () =>
      allPoints.filter((p) => {
        if (p.screen !== screenId) return false;
        if (!sameWidth(p)) return false;
        if (participant !== 'all' && participantBySession[p.sessionId]?.key !== participant) return false;
        if (taskId !== 'all' && p.taskId !== taskId) return false;
        if (clickType === 'valid' && p.interactive === false) return false;
        if (clickType === 'dead' && p.interactive !== false) return false;
        return true;
      }),
    [allPoints, screenId, participant, taskId, clickType, participantBySession, activeWidth]
  );

  const projected = useMemo(
    () =>
      filtered
        .map((p) => ({ p, pos: project(p, current?.snap) }))
        .filter((x): x is { p: ClickPoint; pos: { x: number; y: number } } => !!x.pos),
    [filtered, current]
  );

  // Zonas (elementos clicados)
  const zones = useMemo(() => {
    const m: Record<string, { label: string; count: number; dead: number; sessions: Set<string>; rect: { x: number; y: number; w: number; h: number } | null }> = {};
    filtered.forEach((p) => {
      const label = (p.element || 'elemento').slice(0, 60);
      const z = (m[label] = m[label] || { label, count: 0, dead: 0, sessions: new Set(), rect: null });
      z.count += 1;
      if (p.interactive === false) z.dead += 1;
      z.sessions.add(p.sessionId);
      if (!z.rect) z.rect = projectRect(p.elementRect, p, current?.snap);
    });
    return Object.values(m).sort((a, b) => b.count - a.count);
  }, [filtered, current]);

  // Métricas do cenário
  const stats = useMemo(() => {
    const viewers = new Set<string>();
    const dwell: number[] = [];
    const firstClicks: Record<string, number> = {};
    realSessions.forEach((s) => {
      if (participant !== 'all' && participantBySession[s.sessionId]?.key !== participant) return;
      const evs = (s.events || [])
        .filter((e) => taskId === 'all' || e.taskId === taskId)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      let enteredAt = 0;
      let firstDone = false;
      evs.forEach((e, i) => {
        // entrada no cenário: troca de tela ou início de tarefa já nele
        if ((e.eventType === 'SCREEN_VIEW' || e.eventType === 'TASK_START') && e.currentScreen === screenId) {
          viewers.add(s.sessionId);
          enteredAt = new Date(e.timestamp).getTime();
          const next = evs
            .slice(i + 1)
            .find((x) => (x.eventType === 'SCREEN_VIEW' && x.currentScreen !== screenId) || x.eventType === 'TASK_SUCCESS' || x.eventType === 'TASK_ABANDON');
          if (next) dwell.push((new Date(next.timestamp).getTime() - enteredAt) / 1000);
        }
        if (!firstDone && e.eventType === 'CLICK' && e.currentScreen === screenId) {
          firstDone = true;
          const label = (e.element || 'elemento').slice(0, 60);
          firstClicks[label] = (firstClicks[label] || 0) + 1;
        }
      });
    });
    const first = Object.entries(firstClicks).sort((a, b) => b[1] - a[1])[0];
    const firstTotal = Object.values(firstClicks).reduce((a, b) => a + b, 0);
    return {
      viewers: viewers.size,
      avgDwell: dwell.length ? dwell.reduce((a, b) => a + b, 0) / dwell.length : 0,
      firstClick: first ? { label: first[0], pct: Math.round((first[1] / firstTotal) * 100) } : null,
      dead: filtered.filter((p) => p.interactive === false).length,
      clickers: new Set(filtered.map((p) => participantBySession[p.sessionId]?.key || p.sessionId)).size
    };
  }, [realSessions, screenId, participant, taskId, participantBySession, filtered]);

  const outOfFrame = filtered.length - projected.length;
  const toggle = (l: Layer) => setLayers((prev) => ({ ...prev, [l]: !prev[l] }));

  if (!screens.length) {
    return (
      <div className="p-8 rounded-2xl bg-white border border-dashed border-slate-300 text-center space-y-2">
        <Flame className="w-8 h-8 text-slate-300 mx-auto" />
        <div className="text-sm font-bold text-slate-800">Ainda não há cliques nem telas capturadas</div>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          O mapa de calor aparece quando os participantes navegarem no protótipo. Cada cenário (troca de componente na página) ganha o seu print e os seus cliques.
        </p>
      </div>
    );
  }

  const stage = (
    <div className="relative w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200" style={{ aspectRatio: imgRatio ? `${imgRatio}` : '16 / 10' }}>
      {current?.imageSrc ? (
        <img
          src={current.imageSrc}
          alt={current.name}
          className="absolute inset-0 w-full h-full object-fill select-none"
          draggable={false}
          onLoad={(e) => {
            const im = e.currentTarget;
            if (im.naturalWidth && im.naturalHeight) setImgRatio(im.naturalWidth / im.naturalHeight);
          }}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-xs gap-2 bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_75%,#f1f5f9_75%),linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_75%,#f1f5f9_75%)] bg-[length:24px_24px] bg-[position:0_0,12px_12px]">
          <ImageOff className="w-6 h-6" />
          <span>Sem print desta tela — os cliques aparecem na posição da área visível</span>
        </div>
      )}
      {layers.heat && <HeatCanvas pts={projected.map((x) => x.pos)} radius={radius} opacity={opacity} />}
      {layers.zones &&
        zones
          .filter((z) => z.rect)
          .map((z) => (
            <div
              key={z.label}
              className={`absolute rounded-md border-2 transition-all ${hoverZone === z.label ? 'border-blue-600 bg-blue-500/15' : 'border-blue-500/70 bg-blue-500/5'}`}
              style={{ left: `${z.rect!.x * 100}%`, top: `${z.rect!.y * 100}%`, width: `${z.rect!.w * 100}%`, height: `${z.rect!.h * 100}%` }}
              onMouseEnter={() => setHoverZone(z.label)}
              onMouseLeave={() => setHoverZone(null)}
            >
              <span className="absolute -top-2.5 -right-2.5 min-w-[22px] h-[22px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shadow">
                {z.count}
              </span>
            </div>
          ))}
      {layers.clicks &&
        projected.map(({ p, pos }) => (
          <span
            key={p.id}
            title={`${p.element || 'elemento'} • ${participantBySession[p.sessionId]?.label || ''}`}
            className={`absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white shadow ${
              p.interactive === false ? 'bg-rose-500' : 'bg-emerald-500'
            } ${hoverZone && (p.element || 'elemento').slice(0, 60) === hoverZone ? 'scale-150 ring-2 ring-blue-500' : ''}`}
            style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
          />
        ))}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-wrap items-end gap-3 text-xs">
        <div className={fixedParticipantKey ? 'hidden' : ''}>
          <div className="text-[11px] font-semibold text-slate-500 mb-1">Participante</div>
          <select value={participant} onChange={(e) => setParticipant(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 min-w-[180px]">
            <option value="all">Todos ({participants.length})</option>
            {participants.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-[11px] font-semibold text-slate-500 mb-1">Tarefa</div>
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 min-w-[180px]">
            <option value="all">Todas</option>
            {test.tasks.map((t, i) => (
              <option key={t.id} value={t.id}>
                T{i + 1} — {t.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-[11px] font-semibold text-slate-500 mb-1">Cliques</div>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {(
              [
                ['all', 'Todos'],
                ['valid', 'Em elementos clicáveis'],
                ['dead', 'Sem efeito']
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setClickType(k)} className={`px-3 py-2 ${clickType === k ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {(
            [
              ['heat', 'Mapa de calor', Flame],
              ['clicks', 'Cliques', MousePointerClick],
              ['zones', 'Zonas', LayoutGrid]
            ] as const
          ).map(([k, l, Icon]) => (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              className={`px-3 py-2 rounded-lg border flex items-center gap-1.5 font-semibold ${
                layers[k] ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {l}
            </button>
          ))}
        </div>
      </div>

      {/* Cenários */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" /> Cenários da jornada ({screens.length})
          </div>
          <span className="text-[11px] text-slate-500">O Figma Make troca componentes na mesma página: cada cenário tem o seu print e os seus cliques.</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {screens.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScreenId(s.id)}
              className={`w-40 shrink-0 text-left rounded-xl border-2 overflow-hidden transition-all ${
                s.id === screenId ? 'border-blue-600 shadow-md' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="relative h-24 bg-slate-100">
                {s.thumbSrc ? (
                  <img src={s.thumbSrc} alt="" className="w-full h-full object-cover object-top" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                )}
                {s.inExpected && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-blue-600 text-white text-[9px] font-bold">{i + 1}</span>
                )}
                <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-slate-900/75 text-white text-[10px] font-semibold flex items-center gap-1">
                  <MousePointerClick className="w-3 h-3" /> {s.clicks}
                </span>
              </div>
              <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-800 leading-snug line-clamp-2 min-h-[34px]">{s.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Palco + painel lateral */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-slate-900">{current?.name}</div>
              <div className="text-[11px] text-slate-500">
                {filtered.length} clique(s){' '}
                {current?.snap
                  ? `• print ${current.snap.sessionId === 'MAPEAMENTO' ? 'do mapeamento' : 'de participante'}`
                  : current?.lowRes
                  ? '• só miniatura (baixa resolução) — tela sem captura completa'
                  : ''}
                {outOfFrame > 0 ? ` • ${outOfFrame} fora da área capturada` : ''}
              </div>
            </div>
            {widthOptions.length > 1 && (
              <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                Largura da tela
                <select value={activeWidth} onChange={(e) => setWidthKey(e.target.value)} className="px-2 py-1 rounded-lg border border-slate-200 bg-slate-50">
                  {widthOptions.map((w) => (
                    <option key={w.key} value={w.key}>
                      {w.width}px — {w.clicks} clique(s){w.hasImage ? '' : ' (sem print)'}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="flex items-center gap-3 text-[11px] text-slate-600">
              <label className="flex items-center gap-1.5">
                Raio
                <input type="range" min={15} max={90} value={radius} onChange={(e) => setRadius(+e.target.value)} className="w-20 accent-blue-600" />
              </label>
              <label className="flex items-center gap-1.5">
                Opacidade
                <input type="range" min={20} max={100} value={opacity * 100} onChange={(e) => setOpacity(+e.target.value / 100)} className="w-20 accent-blue-600" />
              </label>
              <button type="button" onClick={() => setExpanded(true)} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50" title="Ampliar">
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="max-h-[720px] overflow-y-auto rounded-xl">{stage}</div>
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <span>Menos</span>
            <div className="h-2 w-40 rounded-full" style={{ background: 'linear-gradient(90deg,#2563eb,#06b6d4,#22c55e,#eab308,#f97316,#dc2626)' }} />
            <span>Mais cliques</span>
            {layers.clicks && (
              <span className="ml-3 flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> clicável</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> sem efeito</span>
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-white border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 font-semibold"><Users className="w-3.5 h-3.5" /> Viram a tela</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{stats.viewers}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 font-semibold"><Clock className="w-3.5 h-3.5" /> Tempo médio</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{fmtSec(stats.avgDwell)}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 font-semibold"><MousePointerClick className="w-3.5 h-3.5" /> Cliques</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{filtered.length}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 font-semibold"><Ban className="w-3.5 h-3.5" /> Sem efeito</div>
              <div className={`text-lg font-bold mt-0.5 ${stats.dead ? 'text-rose-600' : 'text-slate-900'}`}>{stats.dead}</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs space-y-1">
            <div className="flex items-center gap-1.5 text-slate-500 font-semibold"><Target className="w-3.5 h-3.5" /> Primeiro clique mais comum</div>
            {stats.firstClick ? (
              <div className="text-slate-900 font-semibold">
                “{stats.firstClick.label}” <span className="text-slate-500 font-normal">— {stats.firstClick.pct}% dos participantes</span>
              </div>
            ) : (
              <div className="text-slate-400">Sem cliques nesta tela</div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs space-y-2.5">
            <div className="font-bold text-slate-800 flex items-center gap-1.5"><LayoutGrid className="w-3.5 h-3.5 text-blue-600" /> Zonas mais clicadas</div>
            {zones.length === 0 && <div className="text-slate-400">Sem cliques nesta tela.</div>}
            {zones.slice(0, 10).map((z) => {
              const p = Math.round((z.count / Math.max(1, filtered.length)) * 100);
              return (
                <div
                  key={z.label}
                  onMouseEnter={() => setHoverZone(z.label)}
                  onMouseLeave={() => setHoverZone(null)}
                  className={`rounded-lg p-2 -mx-2 cursor-default ${hoverZone === z.label ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-slate-800" title={z.label}>{z.label}</span>
                    <span className="shrink-0 text-slate-600">
                      {z.count} <span className="text-slate-400">({p}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                    <div className={`h-full rounded-full ${z.dead === z.count ? 'bg-rose-500' : 'bg-blue-500'}`} style={{ width: `${p}%` }} />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {z.sessions.size} participante(s){z.dead ? ` • ${z.dead} sem efeito` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="fixed inset-0 z-50 bg-slate-900/85 p-4 overflow-auto" onClick={() => setExpanded(false)}>
          <div className="max-w-6xl mx-auto bg-white rounded-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-slate-900">{current?.name}</div>
              <button type="button" onClick={() => setExpanded(false)} className="p-1.5 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            {stage}
          </div>
        </div>
      )}
    </div>
  );
};
