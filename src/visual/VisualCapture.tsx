import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Camera, Check, Loader2, Monitor, RefreshCw, ScanEye, Smartphone, Trash2, Wand2, AlertTriangle, Info } from 'lucide-react';
import { canInstrumentPrototype, getInstrumentedPrototypeUrl } from '../utils/figmaUtils';
import { DEVICE_SIZE, VisualAnalysis, VisualDevice, VisualScreen } from './types';
import { autoAois, computeAttention, computeMetrics, makeThumb, withShares } from './engine';
import { newVisualId, visualApi } from './api';

type Captured = VisualScreen & { sceneKey?: string };

const uid = () => Math.random().toString(36).slice(2, 9);

/** Nova análise (ou mais telas numa existente): link do Figma Make → navegar → capturar tela a tela. */
export const VisualCapture: React.FC<{ existing?: VisualAnalysis | null; onCancel: () => void; onDone: (id: string) => void }> = ({ existing, onCancel, onDone }) => {
  const [step, setStep] = useState<'setup' | 'capture'>(existing ? 'capture' : 'setup');
  const [name, setName] = useState(existing?.name || '');
  const [url, setUrl] = useState(existing?.prototypeUrl || '');
  const [device, setDevice] = useState<VisualDevice>(existing?.device || 'desktop');
  const [goal, setGoal] = useState(existing?.goal || '');
  const [audience, setAudience] = useState(existing?.audience || '');
  const [tried, setTried] = useState(false);

  const urlOk = useMemo(() => {
    const t = url.trim();
    if (!t) return false;
    try {
      new URL(/^https?:/.test(t) ? t : `https://${t}`);
    } catch {
      return false;
    }
    return canInstrumentPrototype(t);
  }, [url]);
  const isFigmaFile = /figma\.com\/(proto|file|design)/i.test(url);

  return step === 'setup' ? (
    <div className="max-w-2xl mx-auto space-y-6">
      <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-900 inline-flex items-center gap-1.5">
        <ArrowLeft className="w-4 h-4" /> Análises
      </button>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900">Nova análise</h1>
        <p className="text-sm text-slate-500">Depois você navega pelo protótipo e captura cada tela do fluxo, na ordem em que o usuário passaria.</p>
      </div>
      <div className="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100">
        <Field label="Link do protótipo" hint="O link publicado do Figma Make (termina em .figma.site).">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://seu-prototipo.figma.site"
            className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 ${
              tried && !urlOk ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200 bg-slate-50 focus:bg-white'
            }`}
          />
          {tried && !urlOk && (
            <p className="text-xs text-rose-600 mt-1.5">
              {isFigmaFile ? 'Esse é um link do arquivo no Figma. Use o link publicado do Figma Make (Publicar → .figma.site).' : 'Informe um link válido do protótipo publicado.'}
            </p>
          )}
        </Field>
        <Field label="Nome da análise">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Cotação Auto — versão 2"
            className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 ${
              tried && !name.trim() ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200 bg-slate-50 focus:bg-white'
            }`}
          />
        </Field>
        <Field label="Dispositivo">
          <div className="grid grid-cols-2 gap-2">
            {(['desktop', 'mobile'] as VisualDevice[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDevice(d)}
                aria-pressed={device === d}
                className={`px-3 py-2.5 rounded-xl border text-sm inline-flex items-center gap-2 ${device === d ? 'border-violet-500 bg-violet-50 text-violet-800 font-semibold' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {d === 'mobile' ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />} {DEVICE_SIZE[d].label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Objetivo do fluxo" hint="Opcional. Ajuda o especialista a julgar se cada tela cumpre o papel dela.">
          <textarea
            rows={2}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Ex.: o corretor consegue iniciar uma cotação de auto a partir do CPF do cliente"
            className="w-full resize-none px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
          />
        </Field>
        <Field label="Para quem é" hint="Opcional.">
          <input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="Ex.: corretores de seguros, uso diário no escritório"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100">
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            setTried(true);
            if (urlOk && name.trim()) setStep('capture');
          }}
          className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold"
        >
          Abrir protótipo
        </button>
      </div>
    </div>
  ) : (
    <CaptureStudio
      existing={existing}
      base={{ id: existing?.id || newVisualId(), name: name.trim(), prototypeUrl: url.trim(), device, goal: goal.trim(), audience: audience.trim(), createdAt: existing?.createdAt }}
      onBack={() => (existing ? onCancel() : setStep('setup'))}
      onDone={onDone}
    />
  );
};

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div className="p-5 grid sm:grid-cols-[180px_1fr] gap-2 sm:gap-6">
    <div>
      <div className="text-sm font-medium text-slate-800">{label}</div>
      {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
    </div>
    <div>{children}</div>
  </div>
);

const CaptureStudio: React.FC<{
  existing?: VisualAnalysis | null;
  base: Omit<VisualAnalysis, 'screens'>;
  onBack: () => void;
  onDone: (id: string) => void;
}> = ({ existing, base, onBack, onDone }) => {
  const dev = DEVICE_SIZE[base.device];
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(900);
  const [connected, setConnected] = useState(false);
  const [slow, setSlow] = useState(false);
  const [current, setCurrent] = useState<{ key: string; name: string } | null>(null);
  const [auto, setAuto] = useState(true);
  const [shots, setShots] = useState<Captured[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const pending = useRef(new Map<string, (d: any) => void>());
  const autoTimer = useRef<number | null>(null);
  const shotsRef = useRef<Captured[]>([]);
  shotsRef.current = shots;
  const busyRef = useRef(false);

  const src = useMemo(() => getInstrumentedPrototypeUrl(base.prototypeUrl, { mode: 'visual' }), [base.prototypeUrl]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el);
    setBoxW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const scale = Math.min(1, (boxW - 2) / dev.w);
  // altura real do dispositivo: define onde fica a primeira dobra (não depende do tamanho da janela de quem captura)
  const frameH = dev.h;

  const scan = useCallback(
    (reason: 'auto' | 'manual') =>
      new Promise<void>((resolve) => {
        const win = frameRef.current?.contentWindow;
        if (!win || busyRef.current) return resolve();
        busyRef.current = true;
        setBusy(true);
        setMsg('');
        const requestId = uid();
        const timer = window.setTimeout(() => {
          pending.current.delete(requestId);
          busyRef.current = false;
          setBusy(false);
          setMsg('A captura demorou demais. Tente de novo.');
          resolve();
        }, 25000);
        pending.current.set(requestId, async (d) => {
          window.clearTimeout(timer);
          try {
            if (d.error || !d.image) throw new Error(d.error || 'sem imagem');
            const key = d.scene?.screenId || d.url || uid();
            if (reason === 'auto' && shotsRef.current.some((s) => s.sceneKey === key)) return;
            const n = shotsRef.current.length + (existing?.screens.length || 0) + 1;
            const shot: Captured = {
              id: `S-${uid()}`,
              sceneKey: key,
              name: d.scene?.screenName || d.context?.title || `Tela ${n}`,
              url: d.url,
              image: d.image,
              thumb: await makeThumb(d.image),
              imageWidth: d.imageWidth,
              imageHeight: d.imageHeight,
              docWidth: d.docWidth,
              docHeight: d.docHeight,
              viewportWidth: d.viewportWidth,
              viewportHeight: d.viewportHeight,
              context: d.context,
              elements: d.elements || [],
              dialog: d.dialog || null,
              aois: [],
              capturedAt: new Date().toISOString()
            };
            setShots((s) => [...s, shot]);
          } catch (err: any) {
            setMsg(`Não foi possível capturar esta tela (${err.message}).`);
          } finally {
            busyRef.current = false;
            setBusy(false);
            resolve();
          }
        });
        win.postMessage({ type: 'UXLAB_VISUAL_SCAN', requestId }, '*');
      }),
    [existing]
  );

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.source !== frameRef.current?.contentWindow) return;
      const d = ev.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'UXLAB_SDK_CONNECTED') setConnected(true);
      if (d.type === 'SCREEN_VIEW') {
        setConnected(true);
        setCurrent({ key: d.screenId, name: d.screenName || 'Tela' });
        if (autoTimer.current) window.clearTimeout(autoTimer.current);
        // espera a tela assentar (animações, carregamento) antes de capturar
        autoTimer.current = window.setTimeout(() => {
          if (autoRef.current && !shotsRef.current.some((s) => s.sceneKey === d.screenId)) scan('auto');
        }, 1600);
      }
      if (d.type === 'UXLAB_VISUAL_RESULT' && d.requestId) {
        const fn = pending.current.get(d.requestId);
        pending.current.delete(d.requestId);
        fn?.(d);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [scan]);
  const autoRef = useRef(auto);
  autoRef.current = auto;

  useEffect(() => {
    setConnected(false);
    setSlow(false);
    const t = window.setTimeout(() => setSlow(true), 12000);
    return () => window.clearTimeout(t);
  }, [reloadKey]);

  const total = shots.length + (existing?.screens.length || 0);

  const analyze = async () => {
    if (!shots.length) return;
    try {
      const done: VisualScreen[] = [];
      for (let i = 0; i < shots.length; i++) {
        setProcessing(`Calculando atenção, foco e contraste · tela ${i + 1} de ${shots.length}`);
        const { sceneKey, ...s } = shots[i];
        const field = await computeAttention(s);
        const aois = withShares(field, s, autoAois(s));
        done.push({ ...s, aois, metrics: computeMetrics(field, s) });
      }
      setProcessing('Salvando…');
      const analysis: VisualAnalysis = { ...base, screens: [...(existing?.screens || []), ...done] };
      await visualApi.save(analysis);
      onDone(analysis.id);
    } catch (err: any) {
      setProcessing(null);
      setMsg(`Não foi possível salvar a análise: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack} className="text-sm text-slate-500 hover:text-slate-900 inline-flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="min-w-0">
          <div className="text-base font-semibold text-slate-900 truncate">{base.name}</div>
          <div className="text-xs text-slate-500">Navegue pelo protótipo como o usuário faria. Cada tela nova é capturada sozinha; use o botão para capturar estados que não mudam de tela (um menu aberto, um erro).</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
        <div ref={boxRef} className="min-w-0">
          <div className="rounded-2xl border border-slate-200 bg-slate-200/60 p-0 overflow-hidden mx-auto" style={{ width: dev.w * scale + 2, height: frameH * scale + 2 }}>
            <iframe
              key={reloadKey}
              ref={frameRef}
              src={src}
              title="Protótipo"
              style={{ width: dev.w, height: frameH, transform: `scale(${scale})`, transformOrigin: '0 0', border: 0, background: 'white' }}
            />
          </div>
        </div>

        <aside className="rounded-2xl bg-white border border-slate-200 p-4 space-y-4 lg:sticky lg:top-20">
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
            <span className="text-slate-600">{connected ? 'Protótipo conectado' : 'Conectando ao protótipo…'}</span>
            <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="ml-auto p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Recarregar protótipo">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          {!connected && slow && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> O protótipo não respondeu. Confira se o link é o publicado do Figma Make e recarregue.
            </div>
          )}
          <div className="rounded-xl bg-slate-50 p-3 space-y-1">
            <div className="text-[11px] text-slate-500">Tela atual</div>
            <div className="text-sm font-medium text-slate-900 truncate">{current?.name || '—'}</div>
          </div>
          <button
            type="button"
            disabled={!connected || busy}
            onClick={() => scan('manual')}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} {busy ? 'Capturando…' : 'Capturar esta tela'}
          </button>
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-violet-600" /> Capturar sozinho a cada tela nova
          </label>
          {msg && <div className="text-xs text-rose-600">{msg}</div>}

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>Telas do fluxo</span>
              <span className="text-slate-400 font-normal">{total}</span>
            </div>
            {existing && existing.screens.length > 0 && <div className="text-[11px] text-slate-400">{existing.screens.length} já analisadas · as novas entram depois delas</div>}
            {shots.length === 0 ? (
              <div className="text-xs text-slate-400 rounded-xl border border-dashed border-slate-200 p-3 flex gap-2">
                <Info className="w-4 h-4 shrink-0" /> As telas capturadas aparecem aqui, na ordem do fluxo.
              </div>
            ) : (
              <ol className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
                {shots.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-2 rounded-xl border border-slate-200 p-1.5">
                    <img src={s.thumb} alt="" className="w-14 h-10 rounded-md object-cover object-top bg-slate-100" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-slate-400">Passo {(existing?.screens.length || 0) + i + 1}</div>
                      <input
                        value={s.name}
                        onChange={(e) => setShots((all) => all.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))}
                        className="w-full text-xs font-medium text-slate-800 bg-transparent outline-none focus:bg-slate-50 rounded px-1 -mx-1"
                        aria-label={`Nome da tela ${i + 1}`}
                      />
                    </div>
                    <button type="button" onClick={() => setShots((all) => all.filter((x) => x.id !== s.id))} className="p-1 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50" title="Remover">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <button
            type="button"
            disabled={!shots.length || !!processing}
            onClick={analyze}
            className="w-full px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : shots.length ? <Wand2 className="w-4 h-4" /> : <ScanEye className="w-4 h-4" />}
            {processing ? 'Analisando…' : shots.length ? `Analisar ${shots.length} ${shots.length === 1 ? 'tela' : 'telas'}` : 'Capture ao menos uma tela'}
          </button>
          {processing && (
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500" /> {processing}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
