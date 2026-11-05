import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExpectedPathStep, MappedScreen, TestTask } from '../../types';
import { canInstrumentPrototype, getInstrumentedPrototypeUrl } from '../../utils/figmaUtils';
import {
  X,
  Play,
  Square,
  RefreshCw,
  Monitor,
  Smartphone,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  MousePointerClick,
  Layers,
  ScanSearch,
  Info,
  Check
} from 'lucide-react';

interface ScreenMapperProps {
  prototypeUrl: string;
  onPrototypeUrlChange: (url: string) => void;
  testId: string;
  trackingId: string;
  tasks: TestTask[];
  activeTaskIndex: number;
  onActiveTaskIndexChange: (idx: number) => void;
  onTasksChange: (tasks: TestTask[]) => void;
  screens: MappedScreen[];
  onScreensChange: (screens: MappedScreen[]) => void;
  onClose: () => void;
}

/** Passos do caminho esperado de uma tarefa (com detalhes quando existirem). */
export function getTaskSteps(task: TestTask, screens: MappedScreen[] = []): ExpectedPathStep[] {
  const details = task.expectedPathDetails || [];
  return task.expectedPath.map((id, idx) => {
    const d = details[idx] && details[idx].screenId === id ? details[idx] : details.find((x) => x.screenId === id);
    const mapped = screens.find((s) => s.screenId === id);
    return {
      screenId: id,
      screenName: mapped?.screenName || d?.screenName || id,
      trigger: d?.trigger
    };
  });
}

export function withTaskSteps(task: TestTask, steps: ExpectedPathStep[]): TestTask {
  return {
    ...task,
    expectedPath: steps.map((s) => s.screenId),
    expectedPathDetails: steps
  };
}

export const ScreenMapper: React.FC<ScreenMapperProps> = ({
  prototypeUrl,
  onPrototypeUrlChange,
  testId,
  trackingId,
  tasks,
  activeTaskIndex,
  onActiveTaskIndexChange,
  onTasksChange,
  screens,
  onScreensChange,
  onClose
}) => {
  const [urlDraft, setUrlDraft] = useState(prototypeUrl);
  const [loadedUrl, setLoadedUrl] = useState<string>(prototypeUrl);
  const [reloadKey, setReloadKey] = useState(0);
  const [sdkConnected, setSdkConnected] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [current, setCurrent] = useState<MappedScreen | null>(null);
  const [recording, setRecording] = useState(false);
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [expandedScreen, setExpandedScreen] = useState<string | null>(null);
  const [transitions, setTransitions] = useState<{ from?: string; to: string; trigger?: string; at: string }[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Refs para o listener de postMessage enxergar o estado mais recente
  const stateRef = useRef({ tasks, screens, activeTaskIndex, recording });
  stateRef.current = { tasks, screens, activeTaskIndex, recording };

  const canInstrument = canInstrumentPrototype(loadedUrl);
  const iframeSrc = useMemo(
    () => (loadedUrl && canInstrument ? getInstrumentedPrototypeUrl(loadedUrl, { testId, trackingId, mode: 'map' }) : ''),
    [loadedUrl, canInstrument, testId, trackingId]
  );

  const activeTask = tasks[activeTaskIndex];
  const steps = activeTask ? getTaskSteps(activeTask, screens) : [];

  const setSteps = (taskIdx: number, newSteps: ExpectedPathStep[]) => {
    const { tasks: latest } = stateRef.current;
    const updated = latest.map((t, i) => (i === taskIdx ? withTaskSteps(t, newSteps) : t));
    stateRef.current.tasks = updated;
    onTasksChange(updated);
  };

  const upsertScreen = (incoming: Partial<MappedScreen> & { screenId: string }) => {
    const latest = stateRef.current.screens;
    const idx = latest.findIndex((s) => s.screenId === incoming.screenId);
    let next: MappedScreen[];
    if (idx === -1) {
      next = [
        ...latest,
        {
          screenId: incoming.screenId,
          screenName: incoming.screenName || incoming.title || incoming.screenId,
          title: incoming.title || incoming.screenName || incoming.screenId,
          subtitle: incoming.subtitle,
          stepLabel: incoming.stepLabel,
          dialog: incoming.dialog,
          url: incoming.url,
          actions: incoming.actions || [],
          inputs: incoming.inputs || [],
          thumbnail: incoming.thumbnail,
          firstSeenAt: new Date().toISOString()
        }
      ];
    } else {
      const prev = latest[idx];
      next = [...latest];
      next[idx] = {
        ...prev,
        // o nome editado pelo pesquisador é preservado
        actions: incoming.actions && incoming.actions.length ? incoming.actions : prev.actions,
        inputs: incoming.inputs && incoming.inputs.length ? incoming.inputs : prev.inputs,
        thumbnail: prev.thumbnail || incoming.thumbnail
      };
    }
    stateRef.current.screens = next;
    onScreensChange(next);
    return next.find((s) => s.screenId === incoming.screenId)!;
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'UXLAB_SDK_CONNECTED') setSdkConnected(true);

      if (data.type === 'SCREEN_VIEW' && data.screenId) {
        const params = data.params || {};
        const screen = upsertScreen({
          screenId: data.screenId,
          screenName: data.screenName,
          title: params.title,
          subtitle: params.subtitle,
          stepLabel: params.stepLabel,
          dialog: params.dialog,
          url: params.url,
          actions: params.actions,
          inputs: params.inputs
        });
        setCurrent(screen);
        setTransitions((prev) => [
          { from: data.previousScreenId, to: data.screenId, trigger: data.trigger, at: data.timestamp },
          ...prev
        ].slice(0, 40));

        const { recording: isRec, activeTaskIndex: taskIdx, tasks: latestTasks, screens: latestScreens } = stateRef.current;
        if (isRec && latestTasks[taskIdx]) {
          const currentSteps = getTaskSteps(latestTasks[taskIdx], latestScreens);
          if (currentSteps[currentSteps.length - 1]?.screenId !== data.screenId) {
            setSteps(taskIdx, [
              ...currentSteps,
              { screenId: data.screenId, screenName: screen.screenName, trigger: data.trigger }
            ]);
          }
        }
      }

      // A captura do mapeamento é salva no servidor pelo próprio SDK (imagem-base do mapa de calor)
      if (data.type === 'SCREEN_CAPTURED' && data.screenId && data.thumbnail) {
        const latest = stateRef.current.screens;
        const idx = latest.findIndex((s) => s.screenId === data.screenId);
        if (idx !== -1 && !latest[idx].thumbnail) {
          const next = [...latest];
          next[idx] = { ...next[idx], thumbnail: data.thumbnail };
          stateRef.current.screens = next;
          onScreensChange(next);
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPrototype = () => {
    const clean = urlDraft.trim();
    if (!clean) return;
    onPrototypeUrlChange(clean);
    setLoadedUrl(clean);
    setSdkConnected(false);
    setIframeLoaded(false);
    setCurrent(null);
    setReloadKey((k) => k + 1);
  };

  const toggleRecording = () => {
    if (recording) {
      setRecording(false);
      return;
    }
    // ao começar a gravar, o cenário atual vira o primeiro passo (se o caminho estiver vazio)
    if (activeTask && current) {
      let currentSteps = getTaskSteps(activeTask, screens);
      // caminho com apenas nomes de exemplo (nenhum cenário mapeado) é substituído pela gravação
      const hasMappedStep = currentSteps.some((st) => screens.some((sc) => sc.screenId === st.screenId));
      if (!hasMappedStep) currentSteps = [];
      if (currentSteps.length === 0) {
        setSteps(activeTaskIndex, [{ screenId: current.screenId, screenName: current.screenName }]);
      } else if (currentSteps[currentSteps.length - 1].screenId !== current.screenId) {
        setSteps(activeTaskIndex, [...currentSteps, { screenId: current.screenId, screenName: current.screenName }]);
      }
    }
    setRecording(true);
  };

  const clearPath = () => setSteps(activeTaskIndex, []);

  const addScreenToPath = (screen: MappedScreen) => {
    setSteps(activeTaskIndex, [...steps, { screenId: screen.screenId, screenName: screen.screenName }]);
  };

  const removeStep = (idx: number) => setSteps(activeTaskIndex, steps.filter((_, i) => i !== idx));

  const moveStep = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[idx], next[target]] = [next[target], next[idx]];
    setSteps(activeTaskIndex, next);
  };

  const renameScreen = (screenId: string, name: string) => {
    const next = screens.map((s) => (s.screenId === screenId ? { ...s, screenName: name } : s));
    stateRef.current.screens = next;
    onScreensChange(next);
    // mantém os nomes dos passos sincronizados
    const updatedTasks = tasks.map((t) =>
      t.expectedPathDetails
        ? { ...t, expectedPathDetails: t.expectedPathDetails.map((d) => (d.screenId === screenId ? { ...d, screenName: name } : d)) }
        : t
    );
    stateRef.current.tasks = updatedTasks;
    onTasksChange(updatedTasks);
  };

  const removeScreen = (screenId: string) => {
    const next = screens.filter((s) => s.screenId !== screenId);
    stateRef.current.screens = next;
    onScreensChange(next);
  };

  const recaptureCurrent = () => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'UXLAB_TRIGGER_CAPTURE' }, '*');
  };

  const statusLabel = !loadedUrl
    ? 'Informe a URL do protótipo'
    : !canInstrument
    ? 'Links figma.com não permitem leitura de cenários — use a URL publicada do Figma Make (*.figma.site)'
    : !iframeLoaded
    ? 'Carregando protótipo...'
    : sdkConnected
    ? 'SDK conectado — navegue no protótipo para mapear os cenários'
    : 'Aguardando conexão do SDK...';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-stretch justify-center p-2 sm:p-4">
      <div className="bg-white w-full max-w-[1500px] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2 mr-2">
            <ScanSearch className="w-5 h-5 text-blue-600" />
            <div>
              <div className="text-sm font-bold text-slate-900 leading-tight">Mapeador de Cenários</div>
              <div className="text-[11px] text-slate-500 leading-tight">Cada troca de componente vira um passo do caminho esperado</div>
            </div>
          </div>
          <div className="flex-1 min-w-[240px] flex items-center gap-2">
            <input
              type="text"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadPrototype()}
              placeholder="https://seu-prototipo.figma.site"
              className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            />
            <button
              type="button"
              onClick={loadPrototype}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Carregar
            </button>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setViewport('desktop')}
              className={`p-1.5 rounded-lg ${viewport === 'desktop' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'}`}
              title="Desktop"
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewport('mobile')}
              className={`p-1.5 rounded-lg ${viewport === 'mobile' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'}`}
              title="Mobile (390px)"
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Concluir mapeamento
          </button>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700" title="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Prototype */}
          <div className="flex-1 min-h-[420px] bg-slate-100 flex flex-col">
            <div className="px-4 py-2 text-[11px] flex items-center gap-2 border-b border-slate-200 bg-slate-50">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${sdkConnected ? 'bg-emerald-500' : canInstrument && loadedUrl ? 'bg-amber-400 animate-pulse' : 'bg-rose-500'}`}
              />
              <span className="text-slate-600 truncate">{statusLabel}</span>
              {current && (
                <span className="ml-auto px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold truncate max-w-[45%]" title={current.screenId}>
                  Cenário atual: {current.screenName}
                </span>
              )}
            </div>
            <div className="flex-1 flex items-stretch justify-center overflow-auto p-2">
              {iframeSrc ? (
                <iframe
                  ref={iframeRef}
                  key={`${iframeSrc}-${reloadKey}`}
                  src={iframeSrc}
                  title="Protótipo em mapeamento"
                  onLoad={() => setIframeLoaded(true)}
                  className="bg-white border border-slate-200 rounded-lg shadow-xs"
                  style={{ width: viewport === 'mobile' ? 390 : '100%', height: '100%', minHeight: 400 }}
                />
              ) : (
                <div className="m-auto text-center text-xs text-slate-500 max-w-sm p-6">
                  {canInstrument || !loadedUrl
                    ? 'Informe a URL publicada do protótipo e clique em Carregar.'
                    : 'Para mapear cenários, use a URL publicada do Figma Make (ex.: https://nome.figma.site). Links do figma.com/proto rodam em outro domínio e não podem ser lidos.'}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-[400px] border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col min-h-0 text-xs">
            {/* Task selector + record */}
            <div className="p-4 border-b border-slate-200 space-y-3">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {tasks.map((t, idx) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setRecording(false);
                      onActiveTaskIndexChange(idx);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap ${
                      idx === activeTaskIndex ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tarefa {idx + 1}
                  </button>
                ))}
              </div>
              {activeTask && <div className="text-slate-800 font-semibold leading-snug">{activeTask.title}</div>}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!sdkConnected}
                  onClick={toggleRecording}
                  className={`flex-1 px-3 py-2 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 ${
                    recording ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {recording ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {recording ? 'Parar gravação' : 'Gravar caminho desta tarefa'}
                </button>
                <button
                  type="button"
                  onClick={clearPath}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                  title="Limpar caminho da tarefa"
                >
                  Limpar
                </button>
              </div>
              {recording && (
                <div className="flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  Gravando: execute a tarefa no protótipo como o participante faria.
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Expected path detail */}
              <div className="p-4 border-b border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-600" />
                    Caminho esperado
                  </span>
                  <span className="text-slate-500">{steps.length} passo(s)</span>
                </div>
                {steps.length === 0 && (
                  <div className="text-slate-500 leading-relaxed">
                    Clique em <strong>Gravar</strong> e navegue no protótipo, ou adicione cenários do catálogo abaixo.
                  </div>
                )}
                <ol className="space-y-1.5">
                  {steps.map((st, idx) => (
                    <li key={`${st.screenId}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                      {st.trigger && idx > 0 && (
                        <div className="flex items-center gap-1 text-[11px] text-violet-700 mb-1">
                          <MousePointerClick className="w-3 h-3" />
                          ao clicar em “{st.trigger}”
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 shrink-0 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 leading-snug">{st.screenName}</div>
                          <div className="text-[10px] font-mono text-slate-400 truncate">{st.screenId}</div>
                        </div>
                        <div className="flex items-center">
                          <button type="button" onClick={() => moveStep(idx, -1)} className="p-0.5 text-slate-400 hover:text-slate-700" title="Subir">
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => moveStep(idx, 1)} className="p-0.5 text-slate-400 hover:text-slate-700" title="Descer">
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => removeStep(idx)} className="p-0.5 text-slate-400 hover:text-rose-500" title="Remover">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Catalog */}
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Cenários detectados ({screens.length})</span>
                  {current && (
                    <button type="button" onClick={recaptureCurrent} className="text-blue-600 hover:underline font-semibold">
                      Recapturar imagem
                    </button>
                  )}
                </div>
                {screens.length === 0 && <div className="text-slate-500">Nenhum cenário ainda. Navegue no protótipo.</div>}
                {screens.map((sc) => {
                  const isCurrent = current?.screenId === sc.screenId;
                  const isOpen = expandedScreen === sc.screenId;
                  return (
                    <div
                      key={sc.screenId}
                      className={`rounded-xl border p-2.5 space-y-2 ${isCurrent ? 'border-blue-400 bg-blue-50/40' : 'border-slate-200'}`}
                    >
                      <div className="flex gap-2.5">
                        <div className="w-24 h-16 shrink-0 rounded-md bg-slate-100 border border-slate-200 overflow-hidden">
                          {sc.thumbnail ? (
                            <img src={sc.thumbnail} alt="" className="w-full h-full object-cover object-top" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">sem imagem</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <input
                            type="text"
                            value={sc.screenName}
                            onChange={(e) => renameScreen(sc.screenId, e.target.value)}
                            className="w-full px-1.5 py-0.5 -mx-1.5 rounded-md bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-blue-400 font-semibold text-slate-900 outline-none"
                            title="Clique para renomear"
                          />
                          <div className="flex flex-wrap gap-1">
                            {sc.stepLabel && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold">etapa {sc.stepLabel}</span>}
                            {sc.dialog && <span className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 text-[10px] font-semibold">modal</span>}
                            {isCurrent && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-semibold">atual</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => addScreenToPath(sc)}
                              className="text-blue-600 hover:underline font-semibold flex items-center gap-0.5"
                            >
                              <Plus className="w-3 h-3" /> ao caminho
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedScreen(isOpen ? null : sc.screenId)}
                              className="text-slate-500 hover:text-slate-800"
                            >
                              {isOpen ? 'ocultar parâmetros' : 'parâmetros'}
                            </button>
                            <button type="button" onClick={() => removeScreen(sc.screenId)} className="ml-auto text-slate-400 hover:text-rose-500" title="Remover do catálogo">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                      {isOpen && (
                        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 space-y-1 text-[11px] text-slate-600">
                          <div><strong className="text-slate-800">ID:</strong> <span className="font-mono">{sc.screenId}</span></div>
                          <div><strong className="text-slate-800">Título:</strong> {sc.title}</div>
                          {sc.subtitle && <div><strong className="text-slate-800">Subtítulo:</strong> {sc.subtitle}</div>}
                          {sc.actions.length > 0 && <div><strong className="text-slate-800">Ações:</strong> {sc.actions.join(' · ')}</div>}
                          {sc.inputs.length > 0 && <div><strong className="text-slate-800">Campos:</strong> {sc.inputs.join(' · ')}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Transition log */}
              {transitions.length > 0 && (
                <div className="p-4 border-t border-slate-200 space-y-1">
                  <div className="font-bold text-slate-800 mb-1">Trocas de cenário detectadas</div>
                  {transitions.slice(0, 12).map((tr, i) => {
                    const toName = screens.find((s) => s.screenId === tr.to)?.screenName || tr.to;
                    return (
                      <div key={i} className="text-[11px] text-slate-600 leading-snug">
                        <span className="text-slate-400">{new Date(tr.at).toLocaleTimeString('pt-BR')}</span>{' '}
                        {tr.trigger ? <>“{tr.trigger}” → </> : '→ '}
                        <span className="font-semibold text-slate-800">{toName}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="p-4 border-t border-slate-200 flex gap-2 text-[11px] text-slate-500 leading-relaxed">
                <Info className="w-4 h-4 shrink-0 text-slate-400" />
                <span>
                  Os cenários são identificados pelo título principal, subtítulo, indicador de etapa (“1 de 3”) e modais abertos. Para
                  controle total, peça ao Figma Make para adicionar <code className="font-mono text-blue-600">data-uxlab-screen="nome-da-tela"</code> no
                  container de cada tela.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
