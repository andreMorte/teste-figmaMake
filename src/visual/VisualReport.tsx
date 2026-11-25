import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Send, MessageSquareText, X, Copy, Check, Link2, Wand2, MousePointerClick, Search, Download, Eye, Focus, Contrast, Image as ImageIcon, SquareDashed, Plus, Loader2, Sparkles, RefreshCw, Trash2, AlertTriangle, CheckCircle2,
  Layers, FileText, FileSpreadsheet, ImageDown, ChevronDown, Brain, Heart, ListOrdered, Monitor, Smartphone, Info
} from 'lucide-react';
import { visualApi } from './api';
import { ExpertResult, VisualAnalysis, VisualAoi, VisualScreen } from './types';
import { AttentionField, ENGINE_VERSION, clarityLabel, computeAttention, computeMetrics, contrastFailures, focusLabel, paintLayer, withShares, autoAois, loadImage, aoiTone } from './engine';
import { MapLegend, MapMode, MapView } from './MapView';
import { elementList } from './elements';
import { ChatMsg, ChatBlock, LinkableTest, ScreenEvidence } from './types';
import { A11yIssue, Consistency, ConsistencyCard, SEV_LABEL, SEV_TONE as QSEV_TONE, flowConsistency, screenA11y } from './quality';

const tone = (v: number | null | undefined, good = 70, mid = 45) => (v === null || v === undefined ? 'text-slate-400' : v >= good ? 'text-emerald-600' : v >= mid ? 'text-amber-600' : 'text-rose-600');
const ring = (v: number | null | undefined, good = 70, mid = 45) => (v === null || v === undefined ? '#cbd5e1' : v >= good ? '#059669' : v >= mid ? '#d97706' : '#e11d48');
const SEV = ['Nenhum', 'Cosmético', 'Menor', 'Maior', 'Catastrófico'];
const SEV_TONE = ['bg-slate-100 text-slate-600', 'bg-slate-100 text-slate-700', 'bg-amber-50 text-amber-800', 'bg-orange-100 text-orange-800', 'bg-rose-100 text-rose-700'];
const uid = () => Math.random().toString(36).slice(2, 9);

const Gauge: React.FC<{ value: number | null | undefined; label: string; sub?: string; good?: number; mid?: number; suffix?: string }> = ({ value, label, sub, good, mid, suffix }) => {
  const v = value ?? 0;
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="rounded-xl border border-slate-200 p-3 flex items-center gap-3">
      <svg viewBox="0 0 72 72" className="w-16 h-16 shrink-0" role="img" aria-label={`${label}: ${value ?? 'sem dado'}`}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={ring(value, good, mid)} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 36 36)" />
        <text x="36" y="41" textAnchor="middle" fontSize="17" fontWeight="700" fill="#0f172a">
          {value ?? '—'}
          {value !== null && value !== undefined && suffix ? <tspan fontSize="10">{suffix}</tspan> : null}
        </text>
      </svg>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-800">{label}</div>
        {sub && <div className={`text-[11px] ${tone(value, good, mid)}`}>{sub}</div>}
      </div>
    </div>
  );
};

/** Sinais medidos (sem IA): o que os números já mostram sobre a tela. */
function measuredSignals(s: VisualScreen) {
  const good: string[] = [];
  const bad: string[] = [];
  const m = s.metrics;
  if (!m) return { good, bad };
  const cta = s.aois.find((a) => /^CTA/.test(a.name));
  const title = s.aois.find((a) => a.name === 'Título');
  if (cta) {
    const p = Math.round((cta.share || 0) * 100);
    const t = aoiTone(cta);
    if (t === 'low') bad.push(`O ${cta.name} chama pouca atenção para o tamanho que tem (${p}% da atenção estimada): tende a passar despercebido.`);
    else if (t === 'good') good.push(`O ${cta.name} se destaca: atrai ${String(cta.lift).replace('.', ',')}× mais atenção do que o espaço que ocupa.`);
    if (cta.firstFold === false) bad.push(`O ${cta.name} fica abaixo da primeira dobra: o usuário precisa rolar para encontrá-lo.`);
  } else if (m.actions > 0) bad.push('Nenhuma ação se destaca como principal: os botões têm pesos visuais parecidos.');
  if (title) {
    const t = aoiTone(title);
    if (t === 'good') good.push(`O título conduz a leitura (${Math.round((title.share || 0) * 100)}% da atenção estimada).`);
    else if (t === 'low') bad.push('O título chama pouca atenção: a tela não deixa claro do que se trata logo de cara.');
  }
  if (m.contrastFails > 0) bad.push(`${m.contrastFails} ${m.contrastFails === 1 ? 'texto está' : 'textos estão'} abaixo do contraste mínimo do WCAG AA (veja o modo Contraste).`);
  else if (m.contrastPass !== null) good.push('Todos os textos medidos passam no contraste mínimo do WCAG AA.');
  if (m.focus < 40) bad.push(`Atenção espalhada (foco ${m.focus}): muitos elementos disputam o olhar.`);
  else if (m.focus >= 66) good.push(`Atenção concentrada em poucos pontos (foco ${m.focus}).`);
  if (m.clarity < 45) bad.push(`Tela visualmente carregada (clareza ${m.clarity}): ${m.elementsAboveFold} elementos e ${m.textChars} caracteres na primeira dobra.`);
  else if (m.clarity >= 70) good.push(`Tela limpa e fácil de escanear (clareza ${m.clarity}).`);
  if (m.fields > 6) bad.push(`${m.fields} campos na primeira dobra: considere agrupar ou dividir em etapas.`);
  return { good, bad };
}

export const VisualReport: React.FC<{ id: string; onBack: () => void; onAddScreens: (a: VisualAnalysis) => void }> = ({ id, onBack, onAddScreens }) => {
  const [a, setA] = useState<VisualAnalysis | null>(null);
  const [error, setError] = useState('');
  const [sel, setSel] = useState<string>('flow');
  const [fields, setFields] = useState<Record<string, AttentionField>>({});
  const [mode, setMode] = useState<MapMode>('attention');
  const [showAois, setShowAois] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [selAoi, setSelAoi] = useState<string | null>(null);
  const [tab, setTab] = useState<'geral' | 'areas' | 'acessibilidade' | 'especialista'>('geral');
  const [activeIssue, setActiveIssue] = useState<number | null>(null);
  // conversa com o especialista
  const [chatOpen, setChatOpen] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatErr, setChatErr] = useState('');
  const [chatFocus, setChatFocus] = useState<{ ref?: string; label?: string } | null>(null);
  const [pin, setPin] = useState<{ msg: number | null; ref: string | null }>({ msg: null, ref: null });
  // vínculo com testes de usabilidade
  const [linkOpen, setLinkOpen] = useState(false);
  const [evidence, setEvidence] = useState<Record<string, ScreenEvidence>>({});
  const [showClicks, setShowClicks] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [expertErr, setExpertErr] = useState<Record<string, string>>({});
  const [stopQueue, setStopQueue] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [printImgs, setPrintImgs] = useState<Record<string, string> | null>(null);
  const layerRef = useRef<HTMLCanvasElement | null>(null);
  const saveTimer = useRef<number | null>(null);
  const aRef = useRef<VisualAnalysis | null>(null);
  aRef.current = a;

  useEffect(() => {
    visualApi
      .get(id)
      .then((x) => {
        setA(x);
        if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const screen = a?.screens.find((s) => s.id === sel) || null;
  const a11y = useMemo(() => (screen ? screenA11y(screen) : null), [screen]);

  // campo de atenção da tela aberta (e métricas atualizadas se o motor mudou)
  useEffect(() => {
    if (!screen || fields[screen.id]) return;
    let off = false;
    computeAttention(screen).then((f) => {
      if (off) return;
      setFields((m) => ({ ...m, [screen.id]: f }));
      if (!screen.metrics || screen.metrics.version !== ENGINE_VERSION || !screen.aois.length) {
        const aois = withShares(f, screen, screen.aois.length ? screen.aois : autoAois(screen));
        const metrics = computeMetrics(f, screen);
        updateScreen(screen.id, { aois, metrics }, true);
      }
    });
    return () => {
      off = true;
    };
  }, [screen?.id]); // eslint-disable-line

  const updateScreen = useCallback(
    (sid: string, patch: Partial<VisualScreen>, persist = true) => {
      setA((cur) => (cur ? { ...cur, screens: cur.screens.map((s) => (s.id === sid ? { ...s, ...patch } : s)) } : cur));
      if (!persist) return;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        const s = aRef.current?.screens.find((x) => x.id === sid);
        if (s) visualApi.patchScreen(id, sid, { name: s.name, aois: s.aois, metrics: s.metrics }).catch(() => {});
      }, 700);
    },
    [id]
  );

  // fila do especialista: gera o parecer das telas que ainda não têm
  const runExpert = useCallback(
    async (sid: string) => {
      setRunning(sid);
      setExpertErr((m) => ({ ...m, [sid]: '' }));
      try {
        const ex = await visualApi.expert(id, sid);
        setA((cur) => (cur ? { ...cur, screens: cur.screens.map((s) => (s.id === sid ? { ...s, expert: ex } : s)) } : cur));
        return true;
      } catch (err: any) {
        setExpertErr((m) => ({ ...m, [sid]: err.message }));
        if (/não configurada|Limite de uso/i.test(err.message)) setStopQueue(err.message);
        return false;
      } finally {
        setRunning(null);
      }
    },
    [id]
  );
  const sendChat = useCallback(
    async (sid: string, message?: string, focus?: { ref?: string; label?: string } | null, mode?: 'proposta') => {
      setChatBusy(true);
      setChatErr('');
      if (message) {
        // mostra a pergunta na hora; a resposta chega depois
        setA((cur) =>
          cur
            ? { ...cur, screens: cur.screens.map((x) => (x.id === sid ? { ...x, chat: [...(x.chat || []), { role: 'user', text: message, focus, at: new Date().toISOString() } as ChatMsg] } : x)) }
            : cur
        );
      }
      try {
        const r = await visualApi.chat(id, sid, mode ? { mode } : { message, focus });
        setA((cur) => (cur ? { ...cur, screens: cur.screens.map((x) => (x.id === sid ? { ...x, chat: r.chat } : x)) } : cur));
        setPin({ msg: null, ref: null });
        setChatFocus(null);
      } catch (err: any) {
        setChatErr(err.message);
        if (message) setA((cur) => (cur ? { ...cur, screens: cur.screens.map((x) => (x.id === sid ? { ...x, chat: (x.chat || []).slice(0, -1) } : x)) } : cur));
      } finally {
        setChatBusy(false);
      }
    },
    [id]
  );
  const openChat = () => {
    setChatOpen(true);
    setChatErr('');
    if (screen && !(screen.chat || []).length && !chatBusy) sendChat(screen.id); // abertura proativa
  };
  const elementsForChat = useMemo(() => (screen ? elementList(screen) : []), [screen]);
  const linkedCount = a?.linkedTests?.length || 0;
  useEffect(() => {
    if (!chatOpen || !screen) return;
    let off = false;
    visualApi
      .evidence(id, screen.id)
      .then((ev) => !off && setEvidence((m) => ({ ...m, [screen.id]: ev })))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [chatOpen, screen?.id, linkedCount, id]); // eslint-disable-line
  const ev = screen ? evidence[screen.id] : undefined;
  const chatMsgs = screen?.chat || [];
  const pinnedIdx = pin.msg ?? (() => {
    for (let i = chatMsgs.length - 1; i >= 0; i--) if (chatMsgs[i].role === 'agent' && (chatMsgs[i].refs || []).length) return i;
    return null;
  })();
  const pinRefs = pinnedIdx !== null ? chatMsgs[pinnedIdx]?.refs || [] : [];

  const queueStarted = useRef(false);
  useEffect(() => {
    if (!a || queueStarted.current) return;
    queueStarted.current = true;
    (async () => {
      for (const s of a.screens) {
        if (s.expert) continue;
        if (stopRef.current) break;
        const ok = await runExpert(s.id);
        if (!ok && stopRef.current) break;
      }
    })();
  }, [a, runExpert]);
  const stopRef = useRef('');
  stopRef.current = stopQueue;

  // ---------- áreas ----------
  const setAois = (aois: VisualAoi[]) => {
    if (!screen) return;
    const f = fields[screen.id];
    updateScreen(screen.id, { aois: f ? withShares(f, screen, aois) : aois });
  };

  // ---------- exportações ----------
  const composite = async (s: VisualScreen, m: MapMode, f?: AttentionField) => {
    const img = await loadImage(s.image);
    const c = document.createElement('canvas');
    c.width = s.imageWidth;
    c.height = s.imageHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const field = f || (await computeAttention(s));
    if (m !== 'original') {
      const l = document.createElement('canvas');
      paintLayer(l, field, m, s);
      ctx.drawImage(l, 0, 0);
    }
    ctx.lineWidth = 3;
    ctx.font = 'bold 15px system-ui, sans-serif';
    for (const ar of s.aois) {
      ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.strokeRect(ar.x, ar.y, ar.w, ar.h);
      const label = `${ar.name} ${Math.round((ar.share || 0) * 100)}%`;
      const w = ctx.measureText(label).width + 10;
      ctx.fillStyle = { good: '#059669', mid: '#d97706', low: '#e11d48' }[aoiTone(ar)];
      ctx.fillRect(ar.x - 1, Math.max(0, ar.y - 21), w, 20);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, ar.x + 4, Math.max(15, ar.y - 6));
    }
    return c.toDataURL('image/jpeg', 0.85);
  };
  const download = (href: string, name: string) => {
    const el = document.createElement('a');
    el.href = href;
    el.download = name;
    document.body.appendChild(el);
    el.click();
    el.remove();
  };
  const slug = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40);
  const exportPng = async () => {
    if (!screen) return;
    download(await composite(screen, mode, fields[screen.id]), `raio-x-${slug(a!.name)}-${slug(screen.name)}-${mode}.jpg`);
  };
  const exportCsv = () => {
    if (!a) return;
    const rows = [['passo', 'tela', 'area', 'atencao_estimada_pct', 'primeira_dobra', 'x', 'y', 'largura', 'altura', 'clareza', 'foco', 'contraste_aa_pct', 'nota_especialista']];
    a.screens.forEach((s, i) =>
      s.aois.forEach((ar) =>
        rows.push([
          String(i + 1), s.name, ar.name, String(Math.round((ar.share || 0) * 1000) / 10), ar.firstFold ? 'sim' : 'não',
          String(ar.x), String(ar.y), String(ar.w), String(ar.h),
          String(s.metrics?.clarity ?? ''), String(s.metrics?.focus ?? ''), String(s.metrics?.contrastPass ?? ''), String(s.expert?.nota ?? '')
        ])
      )
    );
    const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    download(URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), `raio-x-${slug(a.name)}-areas.csv`);
  };
  const exportPdf = async () => {
    if (!a) return;
    setExportOpen(false);
    const imgs: Record<string, string> = {};
    for (const s of a.screens) imgs[s.id] = await composite(s, 'attention', fields[s.id]);
    setPrintImgs(imgs);
  };
  useEffect(() => {
    if (!printImgs) return;
    const done = () => setPrintImgs(null);
    window.addEventListener('afterprint', done, { once: true });
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, [printImgs]);

  if (error) return <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-3">Não foi possível abrir a análise: {error}</div>;
  if (!a)
    return (
      <div className="py-24 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando análise…
      </div>
    );

  const pendingExperts = a.screens.filter((s) => !s.expert).length;

  return (
    <>
      <div className="space-y-4 print:hidden">
        {/* topo */}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onBack} className="text-sm text-slate-500 hover:text-slate-900 inline-flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Análises
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold text-slate-900 truncate">{a.name}</div>
            <div className="text-xs text-slate-500 flex items-center gap-1.5 truncate">
              {a.device === 'mobile' ? <Smartphone className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />} {a.screens.length} telas ·{' '}
              <a href={a.prototypeUrl} target="_blank" rel="noreferrer" className="hover:underline truncate">
                {a.prototypeUrl}
              </a>
            </div>
          </div>
          {(running || (pendingExperts > 0 && !stopQueue)) && (
            <span className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-3 py-1.5 inline-flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Especialista analisando · faltam {pendingExperts}
            </span>
          )}
          <button
            type="button"
            onClick={() => setLinkOpen(true)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 ${
              linkedCount ? 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" /> {linkedCount ? `${linkedCount} ${linkedCount === 1 ? 'teste vinculado' : 'testes vinculados'}` : 'Vincular teste de usabilidade'}
          </button>
          <button type="button" onClick={() => onAddScreens(a)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Adicionar telas
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((o) => !o)}
              aria-expanded={exportOpen}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Exportar <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white border border-slate-200 shadow-xl z-30 py-1 text-sm" onMouseLeave={() => setExportOpen(false)}>
                <button type="button" onClick={exportPdf} className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" /> Relatório completo (PDF)
                </button>
                <button type="button" onClick={() => (exportCsv(), setExportOpen(false))} className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-slate-500" /> Áreas de interesse (CSV)
                </button>
                <button
                  type="button"
                  disabled={!screen}
                  onClick={() => (exportPng(), setExportOpen(false))}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-40 flex items-center gap-2"
                >
                  <ImageDown className="w-4 h-4 text-slate-500" /> Imagem do mapa atual
                </button>
              </div>
            )}
          </div>
        </div>

        {stopQueue && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2.5 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> Parecer do especialista pausado: {stopQueue} Os mapas e as métricas continuam disponíveis.
          </div>
        )}

        <div className="grid lg:grid-cols-[220px_1fr] gap-4 items-start">
          {/* passos */}
          <nav className="rounded-2xl bg-white border border-slate-200 p-2 space-y-1 lg:sticky lg:top-20" aria-label="Telas do fluxo">
            <button
              type="button"
              onClick={() => setSel('flow')}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-sm ${sel === 'flow' ? 'bg-violet-50 text-violet-800 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              <Layers className="w-4 h-4" /> Visão do fluxo
            </button>
            <div className="h-px bg-slate-100 my-1" />
            <ol className="space-y-1 max-h-[70vh] overflow-y-auto">
              {a.screens.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSel(s.id);
                      setSelAoi(null);
                      setActiveIssue(null);
                      setChatFocus(null);
                      setPin({ msg: null, ref: null });
                      setDrawing(false);
                    }}
                    className={`w-full flex items-center gap-2 p-1.5 rounded-xl text-left ${sel === s.id ? 'bg-violet-50 ring-1 ring-violet-200' : 'hover:bg-slate-50'}`}
                  >
                    <img src={s.thumb || s.image} alt="" className="w-12 h-9 rounded-md object-cover object-top bg-slate-100 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] text-slate-400">Passo {i + 1}</span>
                      <span className="block text-xs font-medium text-slate-800 truncate">{s.name}</span>
                    </span>
                    {running === s.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
                    ) : s.expert ? (
                      <span className={`text-xs font-bold ${tone(s.expert.nota)}`}>{s.expert.nota}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          {sel === 'flow' || !screen ? (
            <FlowOverview a={a} onOpen={(sid) => setSel(sid)} />
          ) : (
            <div className="grid xl:grid-cols-[1fr_400px] gap-4 items-start min-w-0">
              {/* mapa */}
              <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden min-w-0">
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-100">
                  <div className="inline-flex p-1 rounded-xl bg-slate-100" role="tablist" aria-label="Modo do mapa">
                    {(
                      [
                        ['attention', 'Atenção', Eye],
                        ['focus', 'Foco', Focus],
                        ['contrast', 'Contraste', Contrast],
                        ['original', 'Original', ImageIcon]
                      ] as const
                    ).map(([k, l, Icon]) => (
                      <button
                        key={k}
                        type="button"
                        role="tab"
                        aria-selected={mode === k}
                        onClick={() => setMode(k)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${mode === k ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                      >
                        <Icon className="w-3.5 h-3.5" /> {l}
                      </button>
                    ))}
                  </div>
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer ml-1">
                    <input type="checkbox" checked={showAois} onChange={(e) => setShowAois(e.target.checked)} className="accent-violet-600" /> Áreas
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setDrawing((d) => !d);
                      setShowAois(true);
                      setTab('areas');
                    }}
                    aria-pressed={drawing}
                    className={`ml-auto px-2.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border ${drawing ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                  >
                    <SquareDashed className="w-3.5 h-3.5" /> {drawing ? 'Arraste sobre a tela…' : 'Marcar área'}
                  </button>
                </div>
                <div className="p-3 bg-slate-50 max-h-[78vh] overflow-auto">
                  {fields[screen.id] ? (
                    <MapView
                      screen={screen}
                      field={fields[screen.id]}
                      mode={mode}
                      aois={screen.aois}
                      showAois={showAois && !chatOpen}
                      drawing={drawing}
                      selected={selAoi}
                      onSelect={setSelAoi}
                      canvasRef={layerRef}
                      markers={
                        chatOpen
                          ? [
                              ...pinRefs.map((r) => ({ n: Number(r.id.slice(1)), box: r.box, active: pin.ref === r.id })),
                              ...(chatFocus?.ref && !pinRefs.some((r) => r.id === chatFocus.ref)
                                ? elementsForChat.filter((e) => e.id === chatFocus.ref).map((e) => ({ n: Number(e.id.slice(1)), box: e.box, active: true }))
                                : [])
                            ]
                          : tab === 'acessibilidade' && a11y
                          ? a11y.issues.filter((i) => i.box).map((i, n) => ({ n: n + 1, box: i.box!, active: activeIssue === n + 1 }))
                          : undefined
                      }
                      markerTone={chatOpen ? 'violet' : 'rose'}
                      dots={chatOpen && showClicks && ev ? ev.clicks : undefined}
                      onMarker={(n) => (chatOpen ? setPin((p) => ({ ...p, ref: `E${n}` })) : setActiveIssue(n))}
                      onPick={
                        chatOpen
                          ? (pt) => {
                              const hit = elementsForChat
                                .filter((e) => pt.x >= e.box.x && pt.x <= e.box.x + e.box.w && pt.y >= e.box.y && pt.y <= e.box.y + e.box.h)
                                .sort((x, y) => x.box.w * x.box.h - y.box.w * y.box.h)[0];
                              if (hit) setChatFocus({ ref: hit.id, label: `${hit.kind}${hit.t ? ` "${hit.t}"` : ''}` });
                            }
                          : undefined
                      }
                      onDrawn={(r) => {
                        const n = screen.aois.filter((x) => !x.auto).length + 1;
                        const ar: VisualAoi = { id: `A-${uid()}`, name: `Área ${n}`, ...r };
                        setAois([...screen.aois, ar]);
                        setSelAoi(ar.id);
                        setDrawing(false);
                      }}
                    />
                  ) : (
                    <div className="py-24 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Calculando mapas…
                    </div>
                  )}
                </div>
                <div className="px-3 py-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <MapLegend mode={mode} />
                  <span className="text-[11px] text-slate-400">Estimativa por modelo visual, não eye-tracking real.</span>
                </div>
              </div>

              {/* painel */}
              <div className="rounded-2xl bg-white border border-slate-200 min-w-0">
                {chatOpen ? (
                  <ChatPanel
                    msgs={chatMsgs}
                    busy={chatBusy}
                    error={chatErr}
                    focus={chatFocus}
                    pinnedIdx={pinnedIdx}
                    activeRef={pin.ref}
                    onClose={() => {
                      setChatOpen(false);
                      setChatFocus(null);
                    }}
                    onClearFocus={() => setChatFocus(null)}
                    onRef={(msg, ref) => setPin({ msg, ref })}
                    onSend={(text) => sendChat(screen.id, text, chatFocus)}
                    onPropose={() => sendChat(screen.id, undefined, null, 'proposta')}
                    linkedCount={linkedCount}
                    onLink={() => setLinkOpen(true)}
                    evidence={ev}
                    showClicks={showClicks}
                    onToggleClicks={() => setShowClicks((v) => !v)}
                    onRestart={async () => {
                      await visualApi.clearChat(id, screen.id).catch(() => {});
                      updateScreen(screen.id, { chat: [] }, false);
                      sendChat(screen.id);
                    }}
                  />
                ) : (
                <>
                <button
                  type="button"
                  onClick={openChat}
                  className="m-3 mb-0 w-[calc(100%-1.5rem)] px-3 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:opacity-95 text-white text-xs font-semibold inline-flex items-center justify-center gap-2"
                >
                  <MessageSquareText className="w-4 h-4" /> Conversar com o especialista
                  {chatMsgs.length > 0 && <span className="text-white/70 font-normal">· {chatMsgs.filter((m) => m.role === 'user').length} perguntas</span>}
                </button>
                <div className="flex p-1 m-3 mb-0 rounded-xl bg-slate-100" role="tablist">
                  {(
                    [
                      ['geral', 'Visão geral'],
                      ['areas', 'Áreas'],
                      ['acessibilidade', 'Acessibilidade'],
                      ['especialista', 'Especialista']
                    ] as const
                  ).map(([k, l]) => (
                    <button
                      key={k}
                      type="button"
                      role="tab"
                      aria-selected={tab === k}
                      onClick={() => setTab(k)}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold ${tab === k ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      {l}
                      {k === 'acessibilidade' && a11y && a11y.issues.length > 0 && <span className="ml-1 text-[10px] font-bold text-rose-600">{a11y.issues.length}</span>}
                    </button>
                  ))}
                </div>
                <div className="p-4 space-y-4">
                  <input
                    value={screen.name}
                    onChange={(e) => updateScreen(screen.id, { name: e.target.value })}
                    className="w-full text-sm font-semibold text-slate-900 bg-transparent outline-none focus:bg-slate-50 rounded px-1 -mx-1"
                    aria-label="Nome da tela"
                  />
                  {tab === 'geral' && <OverviewTab s={screen} running={running === screen.id} error={expertErr[screen.id]} />}
                  {tab === 'areas' && (
                    <AreasTab
                      s={screen}
                      selected={selAoi}
                      onSelect={setSelAoi}
                      onChange={setAois}
                      onReset={() => setAois(autoAois(screen))}
                    />
                  )}
                  {tab === 'acessibilidade' && a11y && <A11yTab mobile={a11y.mobile} issues={a11y.issues} active={activeIssue} onActive={setActiveIssue} />}
                  {tab === 'especialista' && (
                    <ExpertTab ex={screen.expert} running={running === screen.id} error={expertErr[screen.id]} onRun={() => runExpert(screen.id)} />
                  )}
                </div>
                </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {printImgs && <PrintReport a={a} imgs={printImgs} />}
      {linkOpen && (
        <LinkModal
          analysisId={a.id}
          onClose={() => setLinkOpen(false)}
          onSaved={(linked) => {
            setA((cur) => (cur ? { ...cur, linkedTests: linked } : cur));
            setEvidence({});
            setLinkOpen(false);
          }}
        />
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
const OverviewTab: React.FC<{ s: VisualScreen; running: boolean; error?: string }> = ({ s, running, error }) => {
  const m = s.metrics;
  const sig = measuredSignals(s);
  const ex = s.expert;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Gauge value={m?.clarity} label="Clareza" sub={m ? clarityLabel(m.clarity) : ''} />
        <Gauge value={m?.focus} label="Foco" sub={m ? focusLabel(m.focus) : ''} good={66} mid={40} />
        <Gauge value={m?.contrastPass ?? null} label="Contraste AA" sub={m ? (m.contrastFails ? `${m.contrastFails} abaixo do mínimo` : 'Todos passam') : ''} good={95} mid={80} suffix="%" />
        <Gauge value={ex?.nota ?? null} label="Especialista" sub={running ? 'analisando…' : ex ? 'nota da revisão' : error ? 'não gerado' : 'na fila'} />
      </div>
      {ex?.resumo && <p className="text-sm text-slate-700 leading-relaxed">{ex.resumo}</p>}
      {ex?.proposito_percebido && (
        <div className="rounded-xl bg-violet-50 border border-violet-100 p-3">
          <div className="text-[11px] font-semibold text-violet-800 mb-0.5">O que o usuário entende em 5 segundos</div>
          <div className="text-xs text-violet-900">{ex.proposito_percebido}</div>
        </div>
      )}
      <List title="Funciona bem" icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />} items={[...(ex?.funciona_bem || []), ...sig.good]} empty="Nada de destaque ainda." />
      <List
        title="Precisa de atenção"
        icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
        items={[...(ex?.problemas || []).slice(0, 4).map((p) => `${p.titulo}${p.severidade >= 3 ? ' (grave)' : ''}`), ...sig.bad]}
        empty="Nenhum ponto crítico medido."
      />
      <div className="text-[11px] text-slate-400 flex gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0" /> Viewport {s.viewportWidth}×{s.viewportHeight} · capturada em {new Date(s.capturedAt).toLocaleString('pt-BR')}
      </div>
    </div>
  );
};

const List: React.FC<{ title: string; icon: React.ReactNode; items: string[]; empty: string }> = ({ title, icon, items, empty }) => (
  <div className="space-y-1.5">
    <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
      {icon} {title}
    </div>
    {items.length ? (
      <ul className="space-y-1">
        {items.map((t, i) => (
          <li key={i} className="text-xs text-slate-600 pl-3 relative before:content-[''] before:absolute before:left-0 before:top-[7px] before:w-1 before:h-1 before:rounded-full before:bg-slate-400">
            {t}
          </li>
        ))}
      </ul>
    ) : (
      <div className="text-xs text-slate-400">{empty}</div>
    )}
  </div>
);

const AreasTab: React.FC<{ s: VisualScreen; selected: string | null; onSelect: (id: string | null) => void; onChange: (a: VisualAoi[]) => void; onReset: () => void }> = ({
  s,
  selected,
  onSelect,
  onChange,
  onReset
}) => {
  const sorted = [...s.aois].sort((x, y) => (y.share || 0) - (x.share || 0));
  const max = Math.max(0.01, ...sorted.map((x) => x.share || 0));
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Quanto da atenção estimada cai em cada área. A cor compara a atenção com o tamanho da área: verde chama mais o olhar do que o espaço que ocupa, vermelho passa despercebido. Use “Marcar área”
        para medir qualquer parte da tela.
      </p>
      {sorted.length === 0 && <div className="text-xs text-slate-400">Nenhuma área. Marque uma sobre a tela.</div>}
      <ol className="space-y-2">
        {sorted.map((ar, i) => (
          <li
            key={ar.id}
            className={`rounded-xl border p-2.5 space-y-1.5 ${selected === ar.id ? 'border-violet-300 bg-violet-50/50' : 'border-slate-200'}`}
            onClick={() => onSelect(ar.id)}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 w-4">{i + 1}º</span>
              <input
                value={ar.name}
                onChange={(e) => onChange(s.aois.map((x) => (x.id === ar.id ? { ...x, name: e.target.value } : x)))}
                className="flex-1 min-w-0 text-xs font-medium text-slate-800 bg-transparent outline-none focus:bg-white rounded px-1"
                aria-label="Nome da área"
              />
              <span className={`text-xs font-bold ${{ good: 'text-emerald-600', mid: 'text-amber-600', low: 'text-rose-600' }[aoiTone(ar)]}`}>
                {Math.round((ar.share || 0) * 1000) / 10}%
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(s.aois.filter((x) => x.id !== ar.id));
                }}
                className="p-1 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50"
                title="Remover área"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-violet-500" style={{ width: `${((ar.share || 0) / max) * 100}%` }} />
            </div>
            <div className="text-[10px] text-slate-400">
              {ar.lift !== undefined && (
                <span className={{ good: 'text-emerald-700', mid: 'text-amber-700', low: 'text-rose-700' }[aoiTone(ar)]}>
                  {ar.lift >= 4 ? 'Destaca-se' : ar.lift >= 2 ? 'Destaque moderado' : 'Pouco destaque'} ({String(ar.lift).replace('.', ',')}× o esperado pelo tamanho) ·{' '}
                </span>
              )}
              {ar.firstFold ? 'na primeira dobra' : 'abaixo da dobra: exige rolagem'}
              {ar.auto ? ' · sugerida' : ' · marcada por você'}
            </div>
          </li>
        ))}
      </ol>
      <button type="button" onClick={onReset} className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1.5">
        <RefreshCw className="w-3.5 h-3.5" /> Voltar às áreas sugeridas
      </button>
    </div>
  );
};

const Bar: React.FC<{ v: number; max?: number }> = ({ v, max = 5 }) => (
  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden w-full">
    <div className={`h-full rounded-full ${v === 0 ? 'bg-slate-300' : v >= 4 ? 'bg-emerald-500' : v >= 3 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${(v / max) * 100}%` }} />
  </div>
);

const Section: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode; open?: boolean }> = ({ title, icon, children, open }) => (
  <details open={open} className="group rounded-xl border border-slate-200">
    <summary className="list-none cursor-pointer px-3 py-2.5 flex items-center gap-2 text-xs font-semibold text-slate-800">
      {icon} {title} <ChevronDown className="w-3.5 h-3.5 ml-auto text-slate-400 group-open:rotate-180 transition" />
    </summary>
    <div className="px-3 pb-3 space-y-2">{children}</div>
  </details>
);

const ExpertTab: React.FC<{ ex?: ExpertResult; running: boolean; error?: string; onRun: () => void }> = ({ ex, running, error, onRun }) => {
  if (running && !ex)
    return (
      <div className="py-10 text-center text-sm text-slate-500 space-y-2">
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-violet-500" />
        <div>O especialista está revisando esta tela…</div>
        <div className="text-xs text-slate-400">Heurísticas, ergonomia, design emocional e cognitivo, UI, arquitetura e estratégia.</div>
      </div>
    );
  if (!ex)
    return (
      <div className="py-8 text-center space-y-3">
        <div className="text-sm text-slate-600">{error ? `Não foi possível gerar o parecer: ${error}` : 'Parecer ainda não gerado.'}</div>
        <button type="button" onClick={onRun} className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Gerar parecer
        </button>
      </div>
    );
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className={`text-3xl font-bold ${tone(ex.nota)}`}>{ex.nota}</div>
        <p className="text-xs text-slate-600 leading-relaxed">{ex.resumo}</p>
      </div>

      <Section title={`Problemas (${ex.problemas.length})`} icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-600" />} open>
        {ex.problemas.length === 0 && <div className="text-xs text-slate-400">Nenhum problema relevante.</div>}
        {ex.problemas.map((p, i) => (
          <div key={i} className="rounded-lg bg-slate-50 p-2.5 space-y-1.5">
            <div className="flex items-start gap-2">
              <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 shrink-0 ${SEV_TONE[p.severidade]}`}>{SEV[p.severidade]}</span>
              <span className="text-xs font-semibold text-slate-800">{p.titulo}</span>
            </div>
            {p.descricao && <div className="text-xs text-slate-600">{p.descricao}</div>}
            {p.evidencia && <div className="text-[11px] text-slate-500 italic">Na tela: {p.evidencia}</div>}
            {p.recomendacao && (
              <div className="text-xs text-emerald-800 bg-emerald-50 rounded-md px-2 py-1.5">
                <b>Recomendação:</b> {p.recomendacao}
              </div>
            )}
            {p.principios.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {p.principios.map((x) => (
                  <span key={x} className="text-[10px] rounded bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5">
                    {x}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </Section>

      <Section title="Primeira impressão (design emocional)" icon={<Heart className="w-3.5 h-3.5 text-rose-500" />}>
        {(
          [
            ['Visceral', 'o que a aparência provoca de imediato', ex.primeira_impressao.visceral],
            ['Comportamental', 'como é usar', ex.primeira_impressao.comportamental],
            ['Reflexivo', 'o que fica, a imagem da marca', ex.primeira_impressao.reflexivo]
          ] as const
        ).map(([k, h, v]) => (
          <div key={k}>
            <div className="text-[11px] font-semibold text-slate-700">
              {k} <span className="font-normal text-slate-400">· {h}</span>
            </div>
            <div className="text-xs text-slate-600">{v || '—'}</div>
          </div>
        ))}
      </Section>

      <Section title="Hierarquia visual" icon={<ListOrdered className="w-3.5 h-3.5 text-violet-600" />}>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['Ideal', ex.hierarquia.ordem_ideal],
              ['Percebida', ex.hierarquia.ordem_percebida]
            ] as const
          ).map(([k, list]) => (
            <div key={k}>
              <div className="text-[11px] font-semibold text-slate-700 mb-1">{k}</div>
              <ol className="space-y-0.5">
                {list.map((x, i) => (
                  <li key={i} className="text-[11px] text-slate-600">
                    {i + 1}. {x}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
        {ex.hierarquia.comentario && <div className="text-xs text-slate-600">{ex.hierarquia.comentario}</div>}
      </Section>

      <Section title="Heurísticas de Nielsen" icon={<CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />}>
        {ex.heuristicas_nielsen.map((h) => (
          <div key={h.n} className="space-y-1">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-semibold text-slate-700 flex-1">
                {h.n}. {h.nome}
              </span>
              <span className="text-slate-500">{h.nota ? `${h.nota}/5` : 'n/a'}</span>
            </div>
            <Bar v={h.nota} />
            <div className="text-[11px] text-slate-500">{h.comentario}</div>
          </div>
        ))}
      </Section>

      <Section title="Critérios ergonômicos (Bastien & Scapin)" icon={<CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />}>
        {ex.ergonomia.map((h) => (
          <div key={h.criterio} className="space-y-1">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-semibold text-slate-700 flex-1">{h.criterio}</span>
              <span className="text-slate-500">{h.nota ? `${h.nota}/5` : 'n/a'}</span>
            </div>
            <Bar v={h.nota} />
            <div className="text-[11px] text-slate-500">{h.comentario}</div>
          </div>
        ))}
      </Section>

      <Section title={`Carga cognitiva: ${ex.cognitivo.carga}`} icon={<Brain className="w-3.5 h-3.5 text-sky-600" />}>
        <div className="text-xs text-slate-600">{ex.cognitivo.comentario}</div>
        {ex.cognitivo.leis.map((l, i) => (
          <div key={i} className="text-[11px] text-slate-600">
            <b className="text-slate-700">{l.lei}:</b> {l.observacao}
          </div>
        ))}
      </Section>

      <Section title="UI, acessibilidade, arquitetura e estratégia" icon={<Layers className="w-3.5 h-3.5 text-slate-500" />}>
        {(
          [
            ['Tipografia', ex.ui.tipografia],
            ['Cor', ex.ui.cor],
            ['Espaçamento', ex.ui.espacamento],
            ['Consistência', ex.ui.consistencia],
            ['Acessibilidade', ex.acessibilidade],
            ['Arquitetura de informação', ex.arquitetura],
            ['Estratégia', ex.estrategia]
          ] as const
        )
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <div className="text-[11px] font-semibold text-slate-700">{k}</div>
              <div className="text-xs text-slate-600">{v}</div>
            </div>
          ))}
      </Section>

      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span>Gerado {ex.createdAt ? new Date(ex.createdAt).toLocaleString('pt-BR') : ''}</span>
        <button type="button" onClick={onRun} disabled={running} className="inline-flex items-center gap-1 hover:text-slate-700 disabled:opacity-40">
          <RefreshCw className={`w-3 h-3 ${running ? 'animate-spin' : ''}`} /> Refazer parecer
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
const avg = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === 'number');
  return v.length ? Math.round(v.reduce((t, x) => t + x, 0) / v.length) : null;
};

const FlowOverview: React.FC<{ a: VisualAnalysis; onOpen: (sid: string) => void }> = ({ a, onOpen }) => {
  const [view, setView] = useState<'resumo' | 'consistencia' | 'acessibilidade'>('resumo');
  const cons = useMemo(() => flowConsistency(a.screens), [a]);
  const a11yAll = useMemo(() => a.screens.map((s) => screenA11y(s)), [a]);
  const a11yCount = a11yAll.reduce((t, x) => t + x.issues.length, 0);
  const consCount = cons.cards.filter((c) => c.sev > 0).length;
  const tabs = (
    <div className="inline-flex p-1 rounded-xl bg-slate-100 w-fit" role="tablist" aria-label="Visão do fluxo">
      {(
        [
          ['resumo', 'Resumo', 0],
          ['consistencia', 'Consistência', consCount],
          ['acessibilidade', 'Acessibilidade', a11yCount]
        ] as const
      ).map(([k, l, n]) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={view === k}
          onClick={() => setView(k)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${view === k ? 'bg-white text-violet-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
        >
          {l}
          {n > 0 && <span className="ml-1.5 text-[10px] font-bold text-rose-600">{n}</span>}
        </button>
      ))}
    </div>
  );
  if (view === 'consistencia')
    return (
      <div className="space-y-4 min-w-0">
        {tabs}
        <ConsistencyView c={cons} total={a.screens.length} mobile={a.device === 'mobile'} />
      </div>
    );
  if (view === 'acessibilidade')
    return (
      <div className="space-y-4 min-w-0">
        {tabs}
        <FlowA11yView a={a} all={a11yAll} onOpen={onOpen} />
      </div>
    );
  return <FlowSummary a={a} onOpen={onOpen} tabs={tabs} />;
};

const FlowSummary: React.FC<{ a: VisualAnalysis; onOpen: (sid: string) => void; tabs: React.ReactNode }> = ({ a, onOpen, tabs }) => {
  const problems = useMemo(
    () =>
      a.screens
        .flatMap((s, i) => (s.expert?.problemas || []).map((p) => ({ ...p, step: i + 1, sid: s.id, screen: s.name })))
        .sort((x, y) => y.severidade - x.severidade)
        .slice(0, 10),
    [a]
  );
  const withExpert = a.screens.filter((s) => s.expert);
  return (
    <div className="space-y-4 min-w-0">
      {tabs}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Gauge value={avg(a.screens.map((s) => s.metrics?.clarity))} label="Clareza média" />
        <Gauge value={avg(a.screens.map((s) => s.metrics?.focus))} label="Foco médio" good={66} mid={40} />
        <Gauge value={avg(a.screens.map((s) => s.metrics?.contrastPass))} label="Contraste AA" good={95} mid={80} suffix="%" />
        <Gauge value={avg(a.screens.map((s) => s.expert?.nota))} label="Nota do especialista" sub={`${withExpert.length} de ${a.screens.length} telas`} />
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold text-slate-900">Passo a passo</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500 bg-slate-50">
              <tr>
                <th className="text-left font-medium px-4 py-2">Tela</th>
                <th className="font-medium px-2 py-2">Clareza</th>
                <th className="font-medium px-2 py-2">Foco</th>
                <th className="font-medium px-2 py-2">Contraste AA</th>
                <th className="font-medium px-2 py-2">Especialista</th>
                <th className="font-medium px-2 py-2">Problemas graves</th>
                <th className="text-left font-medium px-2 py-2">Mais atenção em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {a.screens.map((s, i) => {
                const top = [...s.aois].sort((x, y) => (y.share || 0) - (x.share || 0))[0];
                const grave = (s.expert?.problemas || []).filter((p) => p.severidade >= 3).length;
                return (
                  <tr key={s.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onOpen(s.id)}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2 min-w-[180px]">
                        <img src={s.thumb || s.image} alt="" className="w-14 h-10 rounded-md object-cover object-top bg-slate-100" />
                        <div className="min-w-0">
                          <div className="text-[10px] text-slate-400">Passo {i + 1}</div>
                          <div className="font-medium text-slate-800 truncate">{s.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className={`text-center font-semibold ${tone(s.metrics?.clarity)}`}>{s.metrics?.clarity ?? '—'}</td>
                    <td className={`text-center font-semibold ${tone(s.metrics?.focus, 66, 40)}`}>{s.metrics?.focus ?? '—'}</td>
                    <td className={`text-center font-semibold ${tone(s.metrics?.contrastPass, 95, 80)}`}>{s.metrics?.contrastPass ?? '—'}{s.metrics?.contrastPass != null ? '%' : ''}</td>
                    <td className={`text-center font-semibold ${tone(s.expert?.nota)}`}>{s.expert?.nota ?? '—'}</td>
                    <td className={`text-center font-semibold ${grave ? 'text-rose-600' : 'text-slate-400'}`}>{s.expert ? grave : '—'}</td>
                    <td className="px-2 py-2 text-slate-600 whitespace-nowrap">{top ? `${top.name} (${Math.round((top.share || 0) * 100)}%)` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {withExpert.length > 0 && (
        <div className="grid xl:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
            <div className="text-sm font-semibold text-slate-900">Prioridades do fluxo</div>
            {problems.length === 0 && <div className="text-xs text-slate-400">Nenhum problema relevante apontado.</div>}
            <ol className="space-y-2">
              {problems.map((p, i) => (
                <li key={i} className="flex items-start gap-2 cursor-pointer hover:bg-slate-50 rounded-lg p-1.5 -m-1.5" onClick={() => onOpen(p.sid)}>
                  <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 shrink-0 ${SEV_TONE[p.severidade]}`}>{SEV[p.severidade]}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-800">{p.titulo}</div>
                    <div className="text-[11px] text-slate-500">
                      Passo {p.step} · {p.screen}
                      {p.recomendacao ? ` — ${p.recomendacao}` : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3 overflow-x-auto">
            <div className="text-sm font-semibold text-slate-900">Heurísticas de Nielsen por tela</div>
            <table className="text-[11px]">
              <thead>
                <tr>
                  <th />
                  {a.screens.map((s, i) => (
                    <th key={s.id} className="px-1 font-medium text-slate-500" title={s.name}>
                      {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(withExpert[0].expert!.heuristicas_nielsen || []).map((h) => (
                  <tr key={h.n}>
                    <td className="pr-2 py-0.5 text-slate-600 whitespace-nowrap">
                      {h.n}. {h.nome}
                    </td>
                    {a.screens.map((s) => {
                      const v = s.expert?.heuristicas_nielsen.find((x) => x.n === h.n)?.nota;
                      return (
                        <td key={s.id} className="px-0.5 py-0.5">
                          <span
                            className={`block w-7 h-6 rounded text-center leading-6 font-semibold ${
                              !v ? 'bg-slate-100 text-slate-400' : v >= 4 ? 'bg-emerald-100 text-emerald-800' : v >= 3 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {v || '–'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};



// ---------------------------------------------------------------------------
// Conversa com o especialista: cada parte citada vira um número na tela
const RefText: React.FC<{ text: string; msg: number; activeRef: string | null; pinned: boolean; refs: ChatMsg['refs']; onRef: (msg: number, ref: string) => void }> = ({
  text,
  msg,
  activeRef,
  pinned,
  refs,
  onRef
}) => {
  const parts = text.split(/(\[E\d+\])/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = /^\[(E\d+)\]$/.exec(p);
        if (!m) return <React.Fragment key={i}>{p}</React.Fragment>;
        const r = (refs || []).find((x) => x.id === m[1]);
        if (!r) return null;
        const on = pinned && activeRef === r.id;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onRef(msg, r.id)}
            className={`inline-flex items-center gap-1 rounded-full border pl-0.5 pr-2 align-[1px] text-[11px] font-semibold mx-0.5 ${
              on ? 'bg-violet-600 border-violet-600 text-white' : 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100'
            }`}
          >
            <span className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center ${on ? 'bg-white text-violet-700' : 'bg-violet-600 text-white'}`}>{r.id.slice(1)}</span>
            <span className="max-w-[150px] truncate">{r.label}</span>
          </button>
        );
      })}
    </>
  );
};

const ChatPanel: React.FC<{
  msgs: ChatMsg[];
  busy: boolean;
  error: string;
  focus: { ref?: string; label?: string } | null;
  pinnedIdx: number | null;
  activeRef: string | null;
  onClose: () => void;
  onClearFocus: () => void;
  onRef: (msg: number, ref: string) => void;
  onSend: (text: string) => void;
  onRestart: () => void;
  onPropose: () => void;
  linkedCount: number;
  onLink: () => void;
  evidence?: ScreenEvidence;
  showClicks: boolean;
  onToggleClicks: () => void;
}> = ({ msgs, busy, error, focus, pinnedIdx, activeRef, onClose, onClearFocus, onRef, onSend, onRestart, onPropose, linkedCount, onLink, evidence, showClicks, onToggleClicks }) => {
  const [text, setText] = useState('');
  const [copied, setCopied] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [msgs.length, busy]);
  const last = [...msgs].reverse().find((m) => m.role === 'agent');
  const quick = last?.proximas?.length ? last.proximas : ['Por que isso é grave?', 'Reescreva os textos desta tela', 'Como um corretor usaria esta tela?'];
  const send = (t: string) => {
    const v = t.trim();
    if (!v || busy) return;
    setText('');
    onSend(v);
  };
  return (
    <div className="flex flex-col h-[78vh] min-h-[520px]">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 text-white flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">Especialista em produto</div>
          <div className="text-[11px] text-slate-500 truncate">UX, interface e rotina do corretor · baseado no que já foi estudado e testado</div>
        </div>
        <button type="button" onClick={onRestart} disabled={busy} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40" title="Recomeçar a conversa">
          <RefreshCw className="w-4 h-4" />
        </button>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Voltar ao parecer" aria-label="Fechar conversa">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* insumo real: testes de usabilidade vinculados */}
      <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/60 space-y-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={onLink}
            className={`text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 border ${
              linkedCount ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" /> {linkedCount ? `Testes vinculados (${linkedCount})` : 'Vincular teste'}
          </button>
          {evidence && evidence.clicks.length > 0 && (
            <button type="button" onClick={onToggleClicks} aria-pressed={showClicks} className={`whitespace-nowrap text-[11px] font-semibold inline-flex items-center gap-1 rounded-lg px-2 py-1 border ${showClicks ? 'border-slate-300 bg-white text-slate-800' : 'border-slate-200 text-slate-500'}`}>
              <MousePointerClick className="w-3.5 h-3.5" /> Cliques ({evidence.clicks.length})
            </button>
          )}
          <button
            type="button"
            onClick={onPropose}
            disabled={busy}
            className="ml-auto whitespace-nowrap text-[11px] font-semibold inline-flex items-center gap-1 rounded-lg px-2.5 py-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white"
          >
            <Wand2 className="w-3.5 h-3.5" /> Propor melhorias
          </button>
        </div>
        {evidence && evidence.summary.length > 0 && (
          <div className="text-[10.5px] text-slate-500 leading-snug">
            {evidence.summary.map((t) => (
              <div key={t.testId}>
                <b className="text-slate-700">{t.name}</b>: {t.participants} participante(s)
                {t.matched ? ` · ${t.visitors} passaram nesta tela · ${t.clicks} cliques (${t.dead} sem efeito)` : ' · esta tela não foi encontrada no teste'}
                {t.tasks.length > 0 && ` · ${t.tasks.map((k) => `"${k.title}" ${k.ok}/${k.total}`).join(', ')}`}
              </div>
            ))}
            {evidence.clicks.length > 0 && showClicks && (
              <div className="flex items-center gap-3 pt-0.5">
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500" /> clique com efeito</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> clique sem efeito</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex flex-col items-end gap-1">
              {m.focus?.label && <span className="text-[10px] text-violet-700">sobre {m.focus.label}</span>}
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-slate-100 px-3 py-2 text-xs text-slate-900">{m.text}</div>
            </div>
          ) : (
            <div key={i} className={`space-y-2 text-xs leading-relaxed text-slate-700 rounded-xl p-2 -m-2 ${pinnedIdx === i ? 'bg-violet-50/40' : ''}`}>
              {m.opening && !m.proposal && <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-600">O que merece atenção nesta tela</div>}
              {m.proposal && (
                <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-600">
                  Melhorias propostas{m.linked ? ' · cruzando Raio-X e teste de usabilidade' : ' · com base no Raio-X'}
                </div>
              )}
              {(m.blocks || []).map((b: ChatBlock, k) =>
                b.tipo === 'melhoria' ? (
                  <div key={k} className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${
                          b.prioridade === 1 ? 'bg-orange-100 text-orange-800' : b.prioridade === 2 ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {b.prioridade === 1 ? 'Alta' : b.prioridade === 2 ? 'Média' : 'Baixa'}
                      </span>
                      <span
                        className={`text-[10px] font-semibold rounded px-1.5 py-0.5 border ${
                          b.evidencia === 'ambos'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : b.evidencia === 'teste'
                            ? 'bg-sky-50 text-sky-800 border-sky-200'
                            : 'bg-violet-50 text-violet-700 border-violet-200'
                        }`}
                      >
                        {b.evidencia === 'ambos' ? 'Previsto e confirmado no teste' : b.evidencia === 'teste' ? 'Visto no teste' : 'Previsto pelo Raio-X'}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-900">
                      <RefText text={b.titulo} msg={i} activeRef={activeRef} pinned={pinnedIdx === i} refs={m.refs} onRef={onRef} />
                    </div>
                    <div className="text-[11.5px] text-slate-600">
                      <RefText text={b.texto} msg={i} activeRef={activeRef} pinned={pinnedIdx === i} refs={m.refs} onRef={onRef} />
                    </div>
                  </div>
                ) : b.tipo === 'texto_sugerido' ? (
                  <div key={k} className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5 space-y-1">
                    <div className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">Texto sugerido</div>
                    <div className="text-[11px] text-slate-500 line-through">{b.de}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 flex-1">{b.para}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(b.para);
                          setCopied(b.para);
                          setTimeout(() => setCopied(''), 1500);
                        }}
                        className="text-[11px] font-semibold text-emerald-800 inline-flex items-center gap-1"
                      >
                        {copied === b.para ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied === b.para ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                    {b.motivo && (
                      <div className="text-[11px] text-slate-600">
                        <RefText text={b.motivo} msg={i} activeRef={activeRef} pinned={pinnedIdx === i} refs={m.refs} onRef={onRef} />
                      </div>
                    )}
                  </div>
                ) : b.tipo === 'alternativa' ? (
                  <div key={k} className="rounded-lg border border-slate-200 bg-white p-2.5">
                    {b.titulo && <b className="text-slate-900">{b.titulo} · </b>}
                    <RefText text={b.texto} msg={i} activeRef={activeRef} pinned={pinnedIdx === i} refs={m.refs} onRef={onRef} />
                  </div>
                ) : (
                  <p key={k}>
                    <RefText text={b.texto} msg={i} activeRef={activeRef} pinned={pinnedIdx === i} refs={m.refs} onRef={onRef} />
                  </p>
                )
              )}
            </div>
          )
        )}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" /> {msgs.length ? 'Analisando…' : 'Olhando a tela e o que já foi testado…'}
          </div>
        )}
        {error && <div className="text-xs text-rose-600">{error}</div>}
        <div ref={endRef} />
      </div>

      <div className="border-t border-slate-100 p-3 space-y-2">
        {!busy && msgs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {quick.map((q) => (
              <button key={q} type="button" onClick={() => send(q)} className="text-[11px] rounded-full border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1 text-slate-700">
                {q}
              </button>
            ))}
          </div>
        )}
        {focus?.label ? (
          <div className="flex items-center gap-2 text-[11px] text-violet-800 bg-violet-50 border border-violet-100 rounded-lg px-2 py-1.5">
            <span className="truncate">Sobre: {focus.label}</span>
            <button type="button" onClick={onClearFocus} className="ml-auto text-violet-600 hover:text-violet-900" aria-label="Tirar seleção">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="text-[10px] text-slate-400">Dica: clique numa parte da tela para perguntar sobre ela.</div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Pergunte sobre esta tela…"
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
          />
          <button type="submit" disabled={busy || !text.trim()} className="p-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white" aria-label="Enviar">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};


const LinkModal: React.FC<{ analysisId: string; onClose: () => void; onSaved: (linked: string[]) => void }> = ({ analysisId, onClose, onSaved }) => {
  const [tests, setTests] = useState<LinkableTest[] | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    visualApi
      .linkable(analysisId)
      .then((r) => {
        setTests(r.tests);
        setSel(r.linked);
      })
      .catch((e) => setErr(e.message));
  }, [analysisId]);
  const list = (tests || []).filter((t) => !q.trim() || `${t.name} ${t.id}`.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 3 ? s : [...s, id]));
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="link-title" className="bg-white rounded-2xl max-w-lg w-full shadow-2xl flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 pb-3 space-y-1">
          <div id="link-title" className="text-base font-semibold text-slate-900">Vincular teste de usabilidade</div>
          <p className="text-xs text-slate-500">
            O especialista passa a usar o que os participantes viveram: onde clicaram, onde travaram, o que pediram e comentaram. Escolha até 3 testes desta jornada.
          </p>
        </div>
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50">
            <Search className="w-4 h-4 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou código" className="flex-1 bg-transparent text-sm outline-none" autoFocus />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 space-y-1.5">
          {!tests && !err && (
            <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando testes…
            </div>
          )}
          {tests && list.length === 0 && <div className="py-8 text-center text-xs text-slate-400">Nenhum teste encontrado.</div>}
          {list.map((t) => {
            const on = sel.includes(t.id);
            const full = !on && sel.length >= 3;
            return (
              <button
                key={t.id}
                type="button"
                disabled={full}
                onClick={() => toggle(t.id)}
                className={`w-full text-left rounded-xl border p-3 flex items-start gap-3 ${on ? 'border-sky-300 bg-sky-50/60' : 'border-slate-200 hover:bg-slate-50'} disabled:opacity-40`}
              >
                <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-sky-600 border-sky-600 text-white' : 'border-slate-300'}`}>
                  {on && <Check className="w-3 h-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-900">{t.name}</span>
                    {t.sameProto && <span className="text-[10px] font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5">mesmo protótipo</span>}
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    {t.id} · {t.participants} {t.participants === 1 ? 'participante' : 'participantes'} · {t.tasks} {t.tasks === 1 ? 'tarefa' : 'tarefas'}
                    {t.createdAt ? ` · ${new Date(t.createdAt).toLocaleDateString('pt-BR')}` : ''}
                  </span>
                  {t.participants === 0 && <span className="block text-[11px] text-amber-700 mt-0.5">Ainda sem participantes: não traz insumo por enquanto.</span>}
                </span>
              </button>
            );
          })}
        </div>
        {err && <div className="px-5 pt-2 text-xs text-rose-600">{err}</div>}
        <div className="p-5 pt-4 flex items-center gap-2 border-t border-slate-100 mt-3">
          <span className="text-[11px] text-slate-400">{sel.length} de 3 selecionados</span>
          <button type="button" onClick={onClose} className="ml-auto px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || !tests}
            onClick={async () => {
              setSaving(true);
              try {
                const r = await visualApi.link(analysisId, sel);
                onSaved(r.linked);
              } catch (e: any) {
                setErr(e.message);
              } finally {
                setSaving(false);
              }
            }}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-40"
          >
            {saving ? 'Salvando…' : 'Vincular'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
const CritBadge: React.FC<{ mobile: boolean }> = ({ mobile }) => (
  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${mobile ? 'bg-violet-50 text-violet-700 border-violet-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
    {mobile ? 'Critérios de celular' : 'Critérios web'}
  </span>
);

const A11yTab: React.FC<{ mobile: boolean; issues: A11yIssue[]; active: number | null; onActive: (n: number | null) => void }> = ({ mobile, issues, active, onActive }) => {
  const [copied, setCopied] = useState('');
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-slate-900">{issues.length ? `${issues.length} ${issues.length === 1 ? 'ponto' : 'pontos'} nesta tela` : 'Nenhum problema medido'}</span>
        <CritBadge mobile={mobile} />
      </div>
      {issues.length === 0 && (
        <div className="text-xs text-emerald-700 bg-emerald-50 rounded-xl p-3 flex gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Contraste, tamanho dos alvos, rótulos e posição da ação principal dentro dos critérios.
        </div>
      )}
      <ol className="space-y-2">
        {issues.map((it, i) => (
          <li
            key={i}
            onClick={() => onActive(active === i + 1 ? null : i + 1)}
            className={`rounded-xl border p-3 flex gap-2.5 cursor-pointer ${active === i + 1 ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200 hover:bg-slate-50'}`}
          >
            <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-slate-900">{it.title}</span>
                <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${QSEV_TONE[it.sev]}`}>{SEV_LABEL[it.sev]}</span>
              </div>
              <p className="text-[11px] text-slate-600">{it.desc}</p>
              {it.color && (
                <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-600">
                  <span className="w-6 h-6 rounded-md border border-black/10" style={{ background: it.color.from }} />
                  <span>
                    atual <b className="text-slate-800">{it.color.from}</b> · {String(it.color.fromRatio).replace('.', ',')}:1
                  </span>
                  <span className="text-slate-300">→</span>
                  <span className="w-6 h-6 rounded-md border border-black/10" style={{ background: it.color.to }} />
                  <span>
                    sugerida <b className="text-slate-800">{it.color.to}</b> · {String(it.color.toRatio).replace('.', ',')}:1
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard?.writeText(it.color!.to);
                      setCopied(it.color!.to);
                      setTimeout(() => setCopied(''), 1500);
                    }}
                    className="ml-auto font-semibold text-blue-700 hover:underline"
                  >
                    {copied === it.color.to ? 'Copiada!' : 'Copiar cor'}
                  </button>
                </div>
              )}
              <div className="text-[11px] text-emerald-800 bg-emerald-50 rounded-md px-2 py-1.5">
                <b>Correção:</b> {it.fix}
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-[10px] text-slate-400">
        {mobile
          ? 'Celular: alvo de toque de 44–48px, fonte de campo a partir de 16px, ação principal ao alcance sem rolar. Contraste segundo o WCAG AA.'
          : 'Web: alvo mínimo de 24px (WCAG 2.2), linhas de até ~75 caracteres, ação principal na primeira dobra (900px). Contraste segundo o WCAG AA.'}
      </p>
    </div>
  );
};

const ConsistencyView: React.FC<{ c: Consistency; total: number; mobile: boolean }> = ({ c, total, mobile }) => (
  <div className="space-y-4">
    <div className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-wrap items-center gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
          Consistência do fluxo <CritBadge mobile={mobile} />
        </div>
        <p className="text-xs text-slate-500 mt-0.5">Compara as {total} telas entre si e mostra onde o protótipo foge de um padrão único de tipografia, cor, botões e campos.</p>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {(
          [
            [c.fontSizes, 'tamanhos de fonte'],
            [c.nearColors, 'cores quase iguais'],
            [c.buttonStyles, 'estilos de botão principal'],
            [c.fieldStyles, 'estilos de campo']
          ] as const
        ).map(([v, l]) => (
          <div key={l} className="rounded-xl border border-slate-200 px-3 py-2 min-w-[92px]">
            <div className="text-lg font-bold text-slate-900">{v}</div>
            <div className="text-[10px] text-slate-500 leading-tight">{l}</div>
          </div>
        ))}
      </div>
    </div>
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {c.cards.map((card) => (
        <ConsistencyCardView key={card.key} card={card} />
      ))}
    </div>
    {total < 2 && <p className="text-xs text-slate-400">Com uma tela só, a comparação fica limitada. Adicione as outras telas do fluxo para ver a consistência entre elas.</p>}
  </div>
);

const ConsistencyCardView: React.FC<{ card: ConsistencyCard }> = ({ card }) => (
  <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-slate-900">{card.title}</span>
      <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${QSEV_TONE[card.sev]}`}>{SEV_LABEL[card.sev]}</span>
    </div>
    {card.fonts && (
      <div className="flex flex-wrap gap-1.5">
        {card.fonts.map((f) => (
          <span key={f.size} className={`text-[11px] rounded-md border px-1.5 py-0.5 ${f.rare && f.to ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
            {f.size}px <b>·{f.count}</b>
          </span>
        ))}
      </div>
    )}
    {card.colors && card.colors.length > 0 && (
      <div className="space-y-1.5">
        {card.colors.map((co) => (
          <div key={co.hex} className="flex items-center gap-2 text-[11px] text-slate-600">
            <span className="w-6 h-6 rounded-md border border-black/10 shrink-0" style={{ background: co.hex }} />
            <b className="text-slate-800">{co.hex}</b>
            <span className="truncate">
              · {co.use} · {co.count} {co.count === 1 ? 'uso' : 'usos'} · passo {co.steps.join(', ')}
            </span>
          </div>
        ))}
      </div>
    )}
    {card.styles && (
      <div className="space-y-2">
        {card.styles.map((st, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px] text-slate-600">
            <span
              className="px-2.5 text-[11px] font-semibold inline-flex items-center shrink-0 max-w-[130px] truncate"
              style={{
                height: Math.max(22, Math.min(st.h, 48)) * 0.75,
                borderRadius: st.br ?? 6,
                background: st.filled ? st.bg : '#fff',
                color: st.filled ? '#fff' : st.fg,
                border: st.filled ? 'none' : `1px solid ${st.fg}`
              }}
            >
              {st.label}
            </span>
            <span>
              {st.h}px{st.br !== undefined ? ` · raio ${st.br}` : ''} · passo {st.steps.join(', ')}
              {st.main && card.styles!.length > 1 ? (card.tie ? ' · referência' : ' · mais usado') : ''}
            </span>
          </div>
        ))}
      </div>
    )}
    <p className="text-xs text-slate-600">{card.summary}</p>
    {card.suggestion && <div className="text-[11px] text-emerald-800 bg-emerald-50 rounded-md px-2 py-1.5">{card.suggestion}</div>}
    {card.where.length > 0 && <div className="text-[11px] text-slate-400">Aparece em: passo {card.where.join(', ')}</div>}
  </div>
);

const FlowA11yView: React.FC<{ a: VisualAnalysis; all: { mobile: boolean; issues: A11yIssue[] }[]; onOpen: (sid: string) => void }> = ({ a, all, onOpen }) => {
  const kinds: [A11yIssue['kind'], string][] = [
    ['contraste', 'Contraste'],
    ['alvo', 'Alvo pequeno'],
    ['rotulo', 'Sem rótulo'],
    ['fonte-campo', 'Fonte de campo'],
    ['dobra', 'Abaixo da dobra'],
    ['linha', 'Linha longa']
  ];
  const used = kinds.filter(([k]) => all.some((x) => x.issues.some((i) => i.kind === k)));
  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-slate-900">Acessibilidade por tela</span>
        <CritBadge mobile={a.device === 'mobile'} />
        <span className="text-xs text-slate-500">Clique numa tela para ver cada ponto com a correção pronta.</span>
      </div>
      {used.length === 0 ? (
        <div className="p-4 text-xs text-emerald-700">Nenhum problema de acessibilidade medido no fluxo.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left font-medium px-4 py-2">Tela</th>
                {used.map(([k, l]) => (
                  <th key={k} className="font-medium px-2 py-2">
                    {l}
                  </th>
                ))}
                <th className="font-medium px-2 py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {a.screens.map((s, i) => {
                const iss = all[i].issues;
                return (
                  <tr key={s.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onOpen(s.id)}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2 min-w-[180px]">
                        <img src={s.thumb || s.image} alt="" className="w-12 h-9 rounded-md object-cover object-top bg-slate-100" />
                        <div className="min-w-0">
                          <div className="text-[10px] text-slate-400">Passo {i + 1}</div>
                          <div className="font-medium text-slate-800 truncate">{s.name}</div>
                        </div>
                      </div>
                    </td>
                    {used.map(([k]) => {
                      const n = iss.filter((x) => x.kind === k).length;
                      return (
                        <td key={k} className={`text-center font-semibold ${n ? 'text-rose-600' : 'text-slate-300'}`}>
                          {n || '–'}
                        </td>
                      );
                    })}
                    <td className={`text-center font-bold ${iss.length ? 'text-slate-900' : 'text-emerald-600'}`}>{iss.length || 'ok'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
const PrintReport: React.FC<{ a: VisualAnalysis; imgs: Record<string, string> }> = ({ a, imgs }) => (
  <div className="hidden print:block text-slate-900 text-[11px]">
    <h1 className="text-xl font-bold">Raio-X da interface · {a.name}</h1>
    <div className="text-slate-500 mb-4">
      {a.prototypeUrl} · {a.device === 'mobile' ? 'Celular' : 'Desktop'} · {a.screens.length} telas · {new Date().toLocaleDateString('pt-BR')}
      {a.goal ? ` · Objetivo: ${a.goal}` : ''}
    </div>
    <table className="w-full border-collapse mb-6">
      <thead>
        <tr className="border-b border-slate-300 text-left">
          <th className="py-1">Passo</th>
          <th>Tela</th>
          <th>Clareza</th>
          <th>Foco</th>
          <th>Contraste AA</th>
          <th>Especialista</th>
        </tr>
      </thead>
      <tbody>
        {a.screens.map((s, i) => (
          <tr key={s.id} className="border-b border-slate-200">
            <td className="py-1">{i + 1}</td>
            <td>{s.name}</td>
            <td>{s.metrics?.clarity ?? '—'}</td>
            <td>{s.metrics?.focus ?? '—'}</td>
            <td>{s.metrics?.contrastPass ?? '—'}%</td>
            <td>{s.expert?.nota ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
    {(() => {
      const c = flowConsistency(a.screens);
      const cards = c.cards.filter((x) => x.sev > 0);
      return cards.length ? (
        <div className="mb-6">
          <h2 className="text-base font-bold">Consistência do fluxo</h2>
          <ul className="list-disc pl-5">
            {cards.map((x) => (
              <li key={x.key}>
                [{SEV_LABEL[x.sev]}] {x.title}: {x.summary} {x.suggestion}
              </li>
            ))}
          </ul>
        </div>
      ) : null;
    })()}
    {a.screens.map((s, i) => {
      const sig = measuredSignals(s);
      const acc = screenA11y(s);
      return (
        <section key={s.id} style={{ breakBefore: 'page' }} className="space-y-2">
          <h2 className="text-base font-bold">
            Passo {i + 1} · {s.name}
          </h2>
          <div>
            Clareza {s.metrics?.clarity ?? '—'} · Foco {s.metrics?.focus ?? '—'} · Contraste AA {s.metrics?.contrastPass ?? '—'}% · Especialista {s.expert?.nota ?? '—'}
          </div>
          <img src={imgs[s.id]} alt="" style={{ maxHeight: '120mm', maxWidth: '100%' }} />
          <div>
            <b>Atenção por área:</b> {[...s.aois].sort((x, y) => (y.share || 0) - (x.share || 0)).map((x) => `${x.name} ${Math.round((x.share || 0) * 100)}%`).join(' · ')}
          </div>
          {s.expert?.resumo && <p>{s.expert.resumo}</p>}
          {[...(s.expert?.funciona_bem || []), ...sig.good].length > 0 && (
            <div>
              <b>Funciona bem:</b>
              <ul className="list-disc pl-5">
                {[...(s.expert?.funciona_bem || []), ...sig.good].map((t, k) => (
                  <li key={k}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {(s.expert?.problemas || []).length > 0 && (
            <div>
              <b>Problemas e recomendações:</b>
              <ul className="list-disc pl-5">
                {s.expert!.problemas.map((p, k) => (
                  <li key={k}>
                    [{SEV[p.severidade]}] {p.titulo}. {p.recomendacao} {p.principios.length ? `(${p.principios.join('; ')})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {acc.issues.length > 0 && (
            <div>
              <b>Acessibilidade ({acc.mobile ? 'critérios de celular' : 'critérios web'}):</b>
              <ul className="list-disc pl-5">
                {acc.issues.map((t, k) => (
                  <li key={k}>
                    [{SEV_LABEL[t.sev]}] {t.title}: {t.desc} Correção: {t.fix}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {sig.bad.length > 0 && (
            <div>
              <b>Sinais medidos:</b>
              <ul className="list-disc pl-5">
                {sig.bad.map((t, k) => (
                  <li key={k}>{t}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      );
    })}
    <p className="mt-6 text-slate-500">Mapas de atenção são estimativas por modelo visual, não eye-tracking real. Pareceres gerados por IA com base na imagem e no texto da tela.</p>
  </div>
);
