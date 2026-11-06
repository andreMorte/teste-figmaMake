import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  UsabilityTest,
  TestTask,
  ParticipantSession,
  ScreenSnapshot
} from '../../types';
import {
  getTestById,
  createSession,
  trackEvent,
  completeTask,
  completeSession,
  getTestSlots,
  saveSusResponse,
  updateTestPrototypeUrl
} from '../../services/dataService';
import { saveScreenSnapshot } from '../../services/snapshotService';
import { OFFICIAL_SUS_QUESTIONS } from '../../data/mockData';
import {
  toFigmaEmbedUrl,
  canInstrumentPrototype,
  getInstrumentedPrototypeUrl,
  isFigmaUrl,
  isValidRealFigmaUrl,
  getShareableTestUrl
} from '../../utils/figmaUtils';
import {
  Play,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Shield,
  Car,
  FileCheck,
  Check,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Layers,
  MousePointer,
  AlertTriangle,
  Send,
  Maximize2,
  Copy,
  Settings2,
  Edit3,
  Globe,
  Camera,
  Activity,
  Terminal,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';

interface ParticipantRunnerProps {
  testId: string;
  overridePrototypeUrl?: string;
  onExit: () => void;
}

export type RuntimeLifecycle =
  | 'LOADING_TEST'
  | 'LOADING_PROTOTYPE'
  | 'PROTOTYPE_LOADED'
  | 'SDK_CONNECTING'
  | 'SESSION_READY'
  | 'READY'
  | 'PROTOTYPE_LOAD_ERROR'
  | 'CAPTURE_BLOCKED';

export type CaptureSourceType = 'REAL_RUNTIME_CAPTURE' | 'NO_CAPTURE';

type RunnerStep = 'welcome' | 'task_running' | 'custom_survey' | 'sus' | 'completed';

export interface PipelineStep {
  step: number;
  name: string;
  detail: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  error?: string;
}

/**
 * A tarefa só termina sozinha quando o último cenário do caminho esperado foi mapeado no
 * protótipo (existe no screenMap, preenchido pelo mapeador). Caminhos de exemplo
 * ("home", "detalhes"...) nunca aparecem no protótipo: nesses casos a conclusão é manual.
 */
function isAutoCompletable(test: UsabilityTest, task: TestTask): boolean {
  const path = task.expectedPath || [];
  const finalScreen = path[path.length - 1];
  if (!finalScreen) return false;
  return (test.screenMap || []).some((m) => m.screenId === finalScreen);
}

export const ParticipantRunner: React.FC<ParticipantRunnerProps> = ({
  testId,
  overridePrototypeUrl,
  onExit
}) => {
  const [test, setTest] = useState<UsabilityTest | null>(null);
  const [session, setSession] = useState<ParticipantSession | null>(null);
  const [step, setStep] = useState<RunnerStep>('task_running');
  const [participantName, setParticipantName] = useState('');
  // Jornada só começa quando o participante informa o nome e clica em "Iniciar teste"
  const [journeyStarted, setJourneyStarted] = useState(false);
  const [startingJourney, setStartingJourney] = useState(false);
  // Modal exibido quando o participante chega ao último cenário mapeado da tarefa
  const [taskDoneModal, setTaskDoneModal] = useState<null | { kind: 'next' | 'final'; finishedIdx: number }>(null);
  const [redirectCountdown, setRedirectCountdown] = useState(6);
  // Cartão flutuante da tarefa (aberto ao começar cada tarefa; o participante pode minimizar ou trocar de lado)
  const [taskCardOpen, setTaskCardOpen] = useState(true);
  const [taskCardSide, setTaskCardSide] = useState<'left' | 'right'>('left');

  const completingTaskRef = useRef(false);
  // Vagas do teste (ex.: participante 3 de 10)
  const [slots, setSlots] = useState<{ limit: number; used: number; nextNumber: number; full: boolean } | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  // Lifecycle & Capture state
  const [lifecycle, setLifecycle] = useState<RuntimeLifecycle>('LOADING_TEST');
  const [captureSource, setCaptureSource] = useState<CaptureSourceType>('NO_CAPTURE');
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(Date.now());

  // Task execution state
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [showFullInstruction, setShowFullInstruction] = useState(false);
  const [taskStartTime, setTaskStartTime] = useState<number>(Date.now());
  const [taskElapsedSeconds, setTaskElapsedSeconds] = useState<number>(0);
  const [clickCounter, setClickCounter] = useState<number>(0);
  const [showDifficultyModal, setShowDifficultyModal] = useState(false);
  const [difficultyComment, setDifficultyComment] = useState('');
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Prototype interactive state & view mode
  const [prototypeScreen, setPrototypeScreen] = useState<string>('Tela Inicial do Protótipo');
  const [detectedScreenId, setDetectedScreenId] = useState<string>('SCREEN-001');
  const [showEditUrlModal, setShowEditUrlModal] = useState(false);
  const [tempPrototypeUrl, setTempPrototypeUrl] = useState('');
  const [showPipelineDrawer, setShowPipelineDrawer] = useState(false);
  const [sdkConnected, setSdkConnected] = useState(false);
  const [latestSnapshot, setLatestSnapshot] = useState<ScreenSnapshot | null>(null);

  // 9-Step Verification Evidence Pipeline State
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([
    { step: 1, name: '1. URL RECEIVED', detail: 'Carregar prototypeUrl configurada', status: 'pending' },
    { step: 2, name: '2. TEST FOUND', detail: 'Localizar teste no sistema', status: 'pending' },
    { step: 3, name: '3. PROTOTYPE REQUESTED', detail: 'Disparar carregamento no frame', status: 'pending' },
    { step: 4, name: '4. PROTOTYPE LOADED', detail: 'Renderização confirmada no frame', status: 'pending' },
    { step: 5, name: '5. SDK CONNECTED', detail: 'Aguardar handshake UXLAB_SDK_CONNECTED', status: 'pending' },
    { step: 6, name: '6. SESSION ESTABLISHED', detail: 'Sessão de participante ativa', status: 'pending' },
    { step: 7, name: '7. SCREEN DETECTED', detail: 'Identificar tela do protótipo real', status: 'pending' },
    { step: 8, name: '8. SCREEN CAPTURED', detail: 'Receber bytes reais de screenshot', status: 'pending' },
    { step: 9, name: '9. CAPTURE SOURCE', detail: 'Confirmar REAL_RUNTIME_CAPTURE', status: 'pending' }
  ]);

  // Custom Survey responses (Pesquisador questions)
  const [customAnswers, setCustomAnswers] = useState<Record<string, string | number>>({});

  // SUS questions state (10 questions, answers 1 to 5)
  const [susAnswers, setSusAnswers] = useState<number[]>([4, 2, 4, 2, 4, 2, 5, 2, 4, 2]);
  const [susSubmitted, setSusSubmitted] = useState(false);
  const [computedSus, setComputedSus] = useState<number | null>(null);
  const [finalComment, setFinalComment] = useState('');

  // Timer reference
  const timerRef = useRef<any>(null);

  // Automatic Loading Lifecycle: Immediately start prototype without requiring "Testar Protótipo"
  useEffect(() => {
    let isCancelled = false;

    async function initRunner() {
      setLifecycle('LOADING_TEST');
      setRuntimeError(null);

      let overrideProto = overridePrototypeUrl?.trim() || '';
      if (!overrideProto && typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        overrideProto = params.get('p') || params.get('proto') || params.get('prototype') || '';
      }

      const t = await getTestById(testId);
      if (isCancelled) return;

      if (t) {
        const effectiveProto = overrideProto.trim() || t.prototypeUrl || 'https://evil-chess-37482794.figma.site';
        const finalTest = {
          ...t,
          prototypeUrl: effectiveProto
        };
        setTest(finalTest);
        setTempPrototypeUrl(effectiveProto);

        // Evidence Step 1: URL RECEIVED
        setPipelineSteps((prev) =>
          prev.map((s) => (s.step === 1 ? { ...s, status: 'success', detail: effectiveProto } : s))
        );

        // Evidence Step 2: TEST FOUND
        setPipelineSteps((prev) =>
          prev.map((s) => (s.step === 2 ? { ...s, status: 'success', detail: `${finalTest.id} - ${finalTest.name}` } : s))
        );

        // Evidence Step 3: PROTOTYPE REQUESTED
        setLifecycle('LOADING_PROTOTYPE');
        setPipelineSteps((prev) =>
          prev.map((s) => (s.step === 3 ? { ...s, status: 'running', detail: `Carregando ${effectiveProto}` } : s))
        );

        // A sessão é criada somente quando o participante informa o nome e inicia o teste
        // Automatic transition to running task
        setStep('task_running');
        setCurrentTaskIndex(0);
      } else {
        const notFoundMsg = `Teste ${testId} não foi localizado no sistema.`;
        setRuntimeError(notFoundMsg);
        setLifecycle('PROTOTYPE_LOAD_ERROR');
        setPipelineSteps((prev) =>
          prev.map((s) => (s.step === 2 ? { ...s, status: 'failed', error: notFoundMsg } : s))
        );
      }
    }

    initRunner();

    return () => {
      isCancelled = true;
    };
  }, [testId, overridePrototypeUrl]);

  // Real Prototype Embed URL (Preserves direct native JavaScript & embeds Figma cleanly)
  // Protótipos web/Figma Make são carregados pelo proxy da mesma origem para injetar o SDK
  // (detecção de cenários em página única). Se o SDK não conectar, cai para a URL direta.
  const [useInstrumentedProxy, setUseInstrumentedProxy] = useState(true);
  const realEmbedUrl = useMemo(() => {
    if (!test?.prototypeUrl) return '';
    if (useInstrumentedProxy && canInstrumentPrototype(test.prototypeUrl)) {
      return getInstrumentedPrototypeUrl(test.prototypeUrl, { testId: test.id, trackingId: test.trackingId });
    }
    return toFigmaEmbedUrl(test.prototypeUrl);
  }, [test?.prototypeUrl, test?.id, test?.trackingId, useInstrumentedProxy]);

  // Fallback: sem handshake do SDK em 12s após carregar o iframe, usa a URL original
  useEffect(() => {
    if (!iframeLoaded || sdkConnected || !useInstrumentedProxy || !test?.prototypeUrl) return;
    if (!canInstrumentPrototype(test.prototypeUrl)) return;
    const t = setTimeout(() => {
      console.warn('[Runner] SDK não conectou via proxy; carregando protótipo direto (telemetria limitada).');
      setUseInstrumentedProxy(false);
      setIframeLoaded(false);
    }, 12000);
    return () => clearTimeout(t);
  }, [iframeLoaded, sdkConnected, useInstrumentedProxy, test?.prototypeUrl]);

  // PostMessage listener from the real proxied runtime
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'UXLAB_SDK_CONNECTED') {
        setSdkConnected(true);
        setRuntimeError(null);
        setPipelineSteps((prev) =>
          prev.map((s) => {
            if (s.step === 1 || s.step === 2 || s.step === 3) {
              return { ...s, status: 'success' };
            }
            return s;
          })
        );
      }

      if (data.type === 'RUNTIME_LOADED') {
        setPipelineSteps((prev) =>
          prev.map((s) => (s.step === 2 ? { ...s, status: 'success', detail: 'DOM carregado no container real' } : s))
        );
      }

      if (data.type === 'SCREEN_VIEW') {
        const screenName = data.screenName || 'Corretor Online / Porto / Empréstimos e financiamento';
        const screenId = data.screenId || 'SCREEN-001';
        setPrototypeScreen(screenName);
        setDetectedScreenId(screenId);

        setPipelineSteps((prev) =>
          prev.map((s) =>
            s.step === 4
              ? { ...s, status: 'success', detail: `${screenId} • ${screenName}` }
              : s
          )
        );

        if (session && test) {
          trackEvent({
            sessionId: session.sessionId,
            testId: test.id,
            taskId: test.tasks[currentTaskIndex]?.id,
            screen: screenId,
            eventType: 'SCREEN_VIEW',
            currentScreen: screenId,
            metadata: { screenName, url: data.url, trigger: data.trigger, previousScreenId: data.previousScreenId }
          });

          // Chegou ao último cenário mapeado da tarefa -> conclui automaticamente
          const activeTask = test.tasks[currentTaskIndex];
          const finalScreen = activeTask && isAutoCompletable(test, activeTask) ? activeTask.expectedPath[activeTask.expectedPath.length - 1] : undefined;
          if (journeyStarted && !taskDoneModal && finalScreen && screenId === finalScreen && !completingTaskRef.current) {
            setTimeout(() => handleCompleteCurrentTaskRef.current(), 900);
          }
        }
      }

      if (data.type === 'SCREEN_CAPTURE_STARTED') {
        setPipelineSteps((prev) =>
          prev.map((s) => (s.step === 5 ? { ...s, status: 'running', detail: 'html2canvas em execução no viewport' } : s))
        );
      }

      if (data.type === 'SCREEN_CAPTURED') {
        const snap: ScreenSnapshot = {
          snapshotId: data.snapshotId || 'SHOT-001',
          testId: data.testId || test?.id || testId,
          trackingId: data.trackingId || test?.trackingId || 'UX-TEST',
          sessionId: data.sessionId || session?.sessionId || 'SESSION-001',
          participantId: data.participantId || session?.participantName || participantName || 'P-001',
          participantName: session?.participantName || participantName || 'Participante Real (P-001)',
          taskId: test?.tasks[currentTaskIndex]?.id,
          screenId: data.screenId || 'SCREEN-001',
          screenName: data.screenName || prototypeScreen,
          image: data.image,
          viewportWidth: data.viewportWidth || 1440,
          viewportHeight: data.viewportHeight || 900,
          devicePixelRatio: data.devicePixelRatio || 1,
          timestamp: data.timestamp || new Date().toISOString(),
          source: 'REAL_RUNTIME_CAPTURE',
          captureSource: 'REAL_RUNTIME_CAPTURE',
          screenHash: data.screenHash || 'HASH_REAL_CAPTURE',
          scrollX: data.scrollX || 0,
          scrollY: data.scrollY || 0,
          scrollPercentage: data.scrollPercentage || 0,
          documentHeight: data.documentHeight || 900,
          ...({ documentWidth: data.documentWidth, capturedHeight: data.capturedHeight, fullPage: !!data.fullPage } as any)
        };

        // o SDK já salvou a captura no servidor (mesma origem); aqui só atualiza a tela local
        saveScreenSnapshot(snap, false);
        setLatestSnapshot(snap);

        setPipelineSteps((prev) =>
          prev.map((s) => {
            if (s.step === 5) return { ...s, status: 'success', detail: 'Viewport real capturado com precisão' };
            if (s.step === 6) return { ...s, status: 'success', detail: `${snap.snapshotId} • REAL_RUNTIME_CAPTURE` };
            if (s.step === 7) return { ...s, status: 'success', detail: 'Snapshot persistido localmente e na API' };
            if (s.step === 8) return { ...s, status: 'success', detail: `${snap.participantId} associado a ${snap.sessionId}` };
            if (s.step === 9) return { ...s, status: 'success', detail: 'Fundo visual oficial pronto para heatmaps' };
            return s;
          })
        );
      }

      if (data.type === 'INTERACTION') {
        setClickCounter((c) => c + 1);
        if (session && test) {
          const targetScreen = data.screenId || detectedScreenId;
          trackEvent({
            sessionId: session.sessionId,
            testId: test.id,
            taskId: test.tasks[currentTaskIndex]?.id,
            screen: targetScreen,
            currentScreen: targetScreen,
            element: data.element || data.tagName || 'node',
            eventType: (data.actionType as any) || 'CLICK',
            x: data.x,
            y: data.y,
            normalizedX: data.normalizedX,
            normalizedY: data.normalizedY,
            metadata: {
              text: data.text,
              selector: data.selector,
              tagName: data.tagName,
              interactive: data.interactive,
              // coordenadas relativas à página inteira (batem com a captura de página inteira)
              pageNX: data.pageNX,
              pageNY: data.pageNY,
              docWidth: data.docWidth,
              docHeight: data.docHeight,
              elementRect: data.elementRect,
              screenName: data.screenName
            }
          });
        }
      }

      if (data.type === 'SCREEN_CAPTURE_FAILED' || data.type === 'RUNTIME_ERROR') {
        const err = data.error || 'Falha na captura do viewport real';
        setRuntimeError(err);
        setPipelineSteps((prev) =>
          prev.map((s) => (s.step === 5 || s.step === 6 ? { ...s, status: 'failed', error: err } : s))
        );
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [test, session, currentTaskIndex, prototypeScreen, detectedScreenId, participantName, testId, journeyStarted, taskDoneModal]);

  // Carrega as vagas do teste para o modal de entrada
  useEffect(() => {
    if (!test?.id || journeyStarted) return;
    let alive = true;
    getTestSlots(test.id).then((s) => alive && s && setSlots(s));
    return () => {
      alive = false;
    };
  }, [test?.id, journeyStarted]);

  // Abre o cartão da tarefa sempre que uma nova tarefa começa
  useEffect(() => {
    setTaskCardOpen(true);
  }, [currentTaskIndex, journeyStarted]);

  // Contagem regressiva do modal "Jornada finalizada" -> perguntas
  useEffect(() => {
    if (taskDoneModal?.kind !== 'final') return;
    if (redirectCountdown <= 0) {
      handleGoToQuestionsRef.current();
      return;
    }
    const t = setTimeout(() => setRedirectCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [taskDoneModal, redirectCountdown]);

  // Elapsed seconds timer for active task
  useEffect(() => {
    if (step === 'task_running' && journeyStarted && !taskDoneModal) {
      setTaskStartTime(Date.now());
      setTaskElapsedSeconds(0);
      setClickCounter(0);

      timerRef.current = setInterval(() => {
        setTaskElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step, currentTaskIndex, journeyStarted, taskDoneModal]);

  // Window blur listener to detect clicks inside the Figma iframe
  useEffect(() => {
    const handleWindowBlur = () => {
      // Com o SDK conectado os cliques chegam com coordenadas reais via postMessage
      if (sdkConnected) return;
      if (step === 'task_running' && session && test) {
        setClickCounter((c) => c + 1);
        const currentTask = test.tasks[currentTaskIndex];
        trackEvent({
          sessionId: session.sessionId,
          testId: test.id,
          taskId: currentTask ? currentTask.id : undefined,
          screen: `figma-frame-${currentTaskIndex + 1}`,
          eventType: 'CLICK',
          currentScreen: `figma-frame-${currentTaskIndex + 1}`,
          metadata: { note: 'Clique detectado no protótipo navegável' }
        });
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [step, session, test, currentTaskIndex, sdkConnected]);

  // Start Session Handler
  const handleStartTest = async () => {
    if (!test) return;
    const newSession = await createSession(
      test.id,
      participantName || 'Participante Anônimo',
      'human'
    );
    setSession(newSession);
    setStep('task_running');
    setCurrentTaskIndex(0);
    setPrototypeScreen('home');

    // Track SESSION_START & TASK_START
    const firstTask = test.tasks[0];
    if (firstTask) {
      await trackEvent({
        sessionId: newSession.sessionId,
        testId: test.id,
        taskId: firstTask.id,
        screen: 'start',
        eventType: 'TASK_START',
        currentScreen: sdkConnected && detectedScreenId !== 'SCREEN-001' ? detectedScreenId : firstTask.expectedPath[0] || 'tela-inicial'
      });
    }
  };

  // Generic interaction logger for simulated fallback / interactive player
  const handlePrototypeInteraction = async (
    targetScreen: string,
    actionType: 'CLICK' | 'BACK' | 'RETURN' | 'TASK_ERROR' | 'INPUT',
    elementName?: string,
    metadata?: any
  ) => {
    if (!session || !test) return;
    setClickCounter((c) => c + 1);
    const currentTask = test.tasks[currentTaskIndex];

    await trackEvent({
      sessionId: session.sessionId,
      testId: test.id,
      taskId: currentTask ? currentTask.id : undefined,
      screen: prototypeScreen,
      element: elementName,
      eventType: actionType,
      previousScreen: prototypeScreen,
      currentScreen: targetScreen,
      metadata: metadata || {},
      x: metadata?.x,
      y: metadata?.y,
      normalizedX: metadata?.normalizedX,
      normalizedY: metadata?.normalizedY,
      screenshotId: metadata?.screenshotId,
      viewportWidth: metadata?.viewportWidth,
      viewportHeight: metadata?.viewportHeight
    });

    setPrototypeScreen(targetScreen);
  };

  const handleSavePrototypeUrl = async () => {
    if (!test) return;
    const cleanUrl = tempPrototypeUrl.trim();
    await updateTestPrototypeUrl(test.id, cleanUrl);
    setTest((prev) => (prev ? { ...prev, prototypeUrl: cleanUrl } : null));
    setIframeLoaded(false);
    setRuntimeError(null);
    setPipelineSteps((prev) =>
      prev.map((s) => (s.step === 1 ? { ...s, status: 'success', detail: cleanUrl } : { ...s, status: 'pending' }))
    );
    setShowEditUrlModal(false);
  };

  // Complete current task and advance
  const handleCompleteCurrentTask = async () => {
    if (!session || !test) return;
    const currentTask = test.tasks[currentTaskIndex];
    if (!currentTask || completingTaskRef.current) return;
    completingTaskRef.current = true;

    await trackEvent({
      sessionId: session.sessionId,
      testId: test.id,
      taskId: currentTask ? currentTask.id : undefined,
      screen: `task-${currentTaskIndex + 1}-finish`,
      eventType: 'TASK_SUCCESS',
      currentScreen: `task-${currentTaskIndex + 1}-concluida`,
      durationMs: taskElapsedSeconds * 1000
    });

    await completeTask(session.sessionId, currentTask.id, true);

    // Mostra o modal de tarefa concluída; o avanço acontece a partir dele
    setTaskDoneModal({
      kind: currentTaskIndex + 1 < test.tasks.length ? 'next' : 'final',
      finishedIdx: currentTaskIndex
    });
    setRedirectCountdown(6);
  };

  // Próxima tarefa (a partir do modal)
  const handleStartNextTask = async () => {
    if (!session || !test || !taskDoneModal) return;
    const nextIdx = taskDoneModal.finishedIdx + 1;
    const nextTask = test.tasks[nextIdx];
    setTaskDoneModal(null);
    completingTaskRef.current = false;
    if (!nextTask) return;
    setCurrentTaskIndex(nextIdx);
    await trackEvent({
      sessionId: session.sessionId,
      testId: test.id,
      taskId: nextTask.id,
      screen: `task-${nextIdx + 1}-start`,
      eventType: 'TASK_START',
      currentScreen: sdkConnected && detectedScreenId !== 'SCREEN-001' ? detectedScreenId : nextTask.expectedPath[0] || `etapa-${nextIdx + 1}`
    });
  };

  // Jornada finalizada -> perguntas
  const handleGoToQuestions = async () => {
    if (!session || !test) return;
    setTaskDoneModal(null);
    const hasCustom = test.metricConfig.customQuestions !== false && (test.customQuestions || []).length > 0;
    if (hasCustom || test.metricConfig.nps) {
      setStep('custom_survey');
      await trackEvent({
        sessionId: session.sessionId,
        testId: test.id,
        screen: 'custom-survey',
        eventType: 'CUSTOM_SURVEY_START',
        currentScreen: 'survey'
      });
    } else if (test.metricConfig.sus) {
      setStep('sus');
      await trackEvent({
        sessionId: session.sessionId,
        testId: test.id,
        screen: 'sus-questionnaire',
        eventType: 'SUS_START',
        currentScreen: 'sus'
      });
    } else {
      await completeSession(session.sessionId);
      setStep('completed');
    }
  };

  // Participante desiste da tarefa (pelo modal de dificuldade)
  const handleSkipTask = async () => {
    if (!session || !test) return;
    const currentTask = test.tasks[currentTaskIndex];
    if (!currentTask || completingTaskRef.current) return;
    completingTaskRef.current = true;
    await trackEvent({
      sessionId: session.sessionId,
      testId: test.id,
      taskId: currentTask.id,
      screen: `task-${currentTaskIndex + 1}-skip`,
      eventType: 'TASK_ABANDON',
      currentScreen: `task-${currentTaskIndex + 1}-abandonada`,
      durationMs: taskElapsedSeconds * 1000,
      metadata: { comment: difficultyComment || 'Participante não conseguiu concluir a tarefa' }
    });
    await completeTask(session.sessionId, currentTask.id, false);
    setShowDifficultyModal(false);
    setDifficultyComment('');
    setTaskDoneModal({ kind: currentTaskIndex + 1 < test.tasks.length ? 'next' : 'final', finishedIdx: currentTaskIndex });
    setRedirectCountdown(6);
  };

  // Início da jornada: cria a sessão com o nome informado e inicia a Tarefa 1
  const handleBeginJourney = async () => {
    if (!test || startingJourney) return;
    const name = participantName.trim();
    if (!name) return;
    setStartingJourney(true);
    setStartError(null);
    try {
      let sess;
      try {
        sess = await createSession(test.id, name, 'human');
      } catch (err: any) {
        if (err?.code === 'TEST_FULL') {
          setStartError(err.message);
          setSlots((prev) => (prev ? { ...prev, full: true } : prev));
          return;
        }
        throw err;
      }
      setSession(sess);
      // informa a sessão ao SDK dentro do protótipo (capturas passam a ser deste participante)
      document.querySelectorAll('iframe').forEach((f) =>
        f.contentWindow?.postMessage({ type: 'UXLAB_SET_SESSION', sessionId: sess.sessionId, participantId: sess.participantId }, '*')
      );
      setPipelineSteps((prev) =>
        prev.map((s) => (s.step === 6 ? { ...s, status: 'success', detail: `${sess.sessionId} (${sess.participantName})` } : s))
      );
      setCurrentTaskIndex(0);
      completingTaskRef.current = false;
      const firstTask = test.tasks[0];
      if (firstTask) {
        await trackEvent({
          sessionId: sess.sessionId,
          testId: test.id,
          taskId: firstTask.id,
          screen: 'start',
          eventType: 'TASK_START',
          currentScreen: sdkConnected && detectedScreenId !== 'SCREEN-001' ? detectedScreenId : firstTask.expectedPath[0] || 'tela-inicial'
        });
      }
      setJourneyStarted(true);
    } finally {
      setStartingJourney(false);
    }
  };

  const handleGoToQuestionsRef = useRef<() => void>(() => {});
  handleGoToQuestionsRef.current = () => {
    void handleGoToQuestions();
  };

  // Sempre aponta para a versão mais recente do handler (usado pelo listener de postMessage)
  const handleCompleteCurrentTaskRef = useRef<() => void>(() => {});
  handleCompleteCurrentTaskRef.current = () => {
    void handleCompleteCurrentTask();
  };

  // Submit Researcher Custom Survey
  const surveyQuestions = test && test.metricConfig.customQuestions !== false ? (test.customQuestions || []).filter((q) => q.question.trim()) : [];
  const missingRequired = surveyQuestions.filter((q) => q.required && (customAnswers[q.id] === undefined || String(customAnswers[q.id]).trim() === '')).length;
  const handleCustomSurveySubmit = async () => {
    if (!session || !test) return;
    if (missingRequired > 0) return;

    await trackEvent({
      sessionId: session.sessionId,
      testId: test.id,
      screen: 'custom-survey-finish',
      eventType: 'CUSTOM_SURVEY_END',
      currentScreen: 'survey',
      metadata: { answers: customAnswers }
    });

    if (test.metricConfig.sus) {
      setStep('sus');
      await trackEvent({
        sessionId: session.sessionId,
        testId: test.id,
        screen: 'sus-questionnaire',
        eventType: 'SUS_START',
        currentScreen: 'sus'
      });
    } else {
      await completeSession(session.sessionId);
      setStep('completed');
    }
  };

  // Register difficulty / friction
  const handleReportDifficulty = async () => {
    if (!session || !test) return;
    const currentTask = test.tasks[currentTaskIndex];

    await trackEvent({
      sessionId: session.sessionId,
      testId: test.id,
      taskId: currentTask ? currentTask.id : undefined,
      screen: `task-${currentTaskIndex + 1}`,
      eventType: 'TASK_ERROR',
      currentScreen: `task-${currentTaskIndex + 1}`,
      metadata: { comment: difficultyComment || 'Dificuldade reportada pelo participante' }
    });

    setShowDifficultyModal(false);
    setDifficultyComment('');
  };

  // Submit SUS questionnaire
  const handleSusSubmit = async () => {
    if (!session || !test) return;

    // Calculate official Brooke SUS Score
    let oddSum = 0;
    let evenSum = 0;
    for (let i = 0; i < 10; i++) {
      const val = susAnswers[i];
      if (i % 2 === 0) {
        oddSum += val - 1;
      } else {
        evenSum += 5 - val;
      }
    }
    const finalScore = (oddSum + evenSum) * 2.5;
    setComputedSus(finalScore);

    await saveSusResponse(
      session.sessionId,
      test.id,
      susAnswers as [number, number, number, number, number, number, number, number, number, number]
    );

    await trackEvent({
      sessionId: session.sessionId,
      testId: test.id,
      screen: 'sus-finished',
      eventType: 'SUS_COMPLETE',
      currentScreen: 'end',
      metadata: { score: finalScore, comment: finalComment }
    });

    setSusSubmitted(true);
    setStep('completed');
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copyShareLink = () => {
    const link = getShareableTestUrl(testId);
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (!test) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#e5e5e5] flex items-center justify-center font-mono">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Carregando teste de usabilidade...</span>
        </div>
      </div>
    );
  }

  const currentTask = test.tasks[currentTaskIndex];
  const embedUrl = toFigmaEmbedUrl(test.prototypeUrl);
  const isFigma = isFigmaUrl(test.prototypeUrl);

  return (
    <div className="min-h-screen bg-[#050505] text-[#e5e5e5] flex flex-col font-sans">
      {/* ========================================================================= */}
      {/* 1. TELA DE ENTRADA / BOAS-VINDAS DO PARTICIPANTE */}
      {/* ========================================================================= */}
      {step === 'welcome' && (
        <div className="flex-1 flex items-center justify-center p-4 md:p-8">
          <div className="max-w-xl w-full bg-[#0d0d0d] border border-[#222] rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 font-mono">
            {/* Header Tag */}
            <div className="flex items-center justify-between border-b border-[#222] pb-4">
              <div className="flex items-center gap-2 text-xs text-blue-400 font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>Ambiente de Avaliação de Usabilidade</span>
              </div>
              <span className="text-[10px] text-[#666] bg-[#141414] px-2 py-0.5 rounded border border-[#222]">
                ID: {test.id}
              </span>
            </div>

            {/* Test Presentation */}
            <div className="space-y-3 font-sans">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {test.name}
              </h1>
              <p className="text-xs sm:text-sm text-[#999] leading-relaxed">
                {test.description || test.researchGoal}
              </p>
            </div>

            {/* Prototype link info */}
            <div className="p-3.5 rounded-xl bg-black border border-[#222] space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-[#888] uppercase text-[10px]">Protótipo Vinculado:</span>
                {isFigma ? (
                  <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[10px] font-bold">
                    Figma Navegável Oficial
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-bold">
                    Deploy Web / Make
                  </span>
                )}
              </div>
              <div className="text-blue-400 text-[11px] truncate font-mono">
                {test.prototypeUrl || 'Protótipo do Estudo'}
              </div>
              {test.prototypeUrl && (
                <div className="pt-1">
                  <a
                    href={test.prototypeUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 hover:underline font-mono"
                  >
                    <span>Abrir protótipo original em nova aba</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Participant Instructions Box */}
            <div className="p-4 rounded-xl bg-[#111] border border-[#262626] space-y-3 text-xs">
              <div className="font-bold text-[#e5e5e5] uppercase tracking-wider text-[11px] flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>Como funciona o teste:</span>
              </div>
              <ul className="space-y-2 text-[#aaa] list-disc list-inside text-xs font-sans">
                <li>Você navegará diretamente no <strong>protótipo real</strong> disponibilizado pelo pesquisador.</li>
                <li>Haverá <strong>{test.tasks.length} tarefas</strong> simples para você realizar livremente.</li>
                <li>Uma barra discreta no topo indicará a tarefa atual e o botão para concluir.</li>
                <li>Ao finalizar as tarefas, você responderá a um breve questionário de satisfação de 10 perguntas.</li>
                <li>Lembre-se: não há respostas certas ou erradas. Estamos avaliando a interface, não você!</li>
              </ul>
            </div>

            {/* Participant Identification Field */}
            <div className="space-y-2">
              <label className="block text-xs text-[#aaa] font-bold uppercase tracking-wider">
                Seu Nome ou Apelido (Opcional)
              </label>
              <input
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder="Ex: Joana Silva"
                className="w-full px-4 py-2.5 rounded-xl bg-black border border-[#262626] text-white text-xs font-mono focus:border-blue-500 focus:outline-hidden transition-colors"
              />
            </div>

            {/* Start Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={handleStartTest}
                className="w-full sm:flex-1 py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:scale-[1.01]"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Iniciar Teste no Protótipo</span>
              </button>

              <button
                type="button"
                onClick={copyShareLink}
                className="w-full sm:w-auto px-4 py-3 rounded-xl bg-[#141414] hover:bg-[#202020] text-[#999] hover:text-white border border-[#2a2a2a] text-xs flex items-center justify-center gap-1.5 transition-colors"
                title="Copiar link compartilhável do teste"
              >
                {copiedLink ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Link copiado!' : 'Copiar link'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. RUNNER & PROTÓTIPO NAVEGÁVEL REAL (FIGMA EMBED + HARNESS DE TESTE) */}
      {/* ========================================================================= */}
      {step === 'task_running' && currentTask && (
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* PROTOTYPE WORKSPACE: Strictly Real Prototype as Source of Truth */}
          <div className="flex-1 bg-[#050505] relative flex flex-col overflow-hidden">
            {/* MAIN RUNTIME STAGE: Technical Diagnostic State OR Real Prototype Embed */}
            {(lifecycle === 'PROTOTYPE_LOAD_ERROR' || lifecycle === 'CAPTURE_BLOCKED') ? (
              <div className="flex-1 flex items-center justify-center p-6 bg-[#07080e] text-[#eee] font-mono">
                <div className="max-w-xl w-full bg-[#0d0e17] border-2 border-rose-600/40 rounded-2xl p-6 sm:p-8 space-y-5 shadow-2xl animate-in zoom-in-95">
                  <div className="flex items-center gap-3 text-rose-400 font-bold">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-6 h-6 text-rose-400" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                        Não foi possível carregar o protótipo navegável neste contexto.
                      </h2>
                      <span className="text-[11px] text-rose-300">Diagnóstico Técnico Real • Sem Interfaces Sintéticas</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-black/70 border border-[#232738] space-y-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[#888] shrink-0">URL Utilizada:</span>
                      <span className="text-blue-400 font-mono text-right truncate max-w-xs">{test.prototypeUrl}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#888]">Status do Carregamento:</span>
                      <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold">
                        {lifecycle}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[#888] shrink-0">Tipo de Erro Detectado:</span>
                      <span className="text-amber-300 text-right">Restrição de segurança (CORS / X-Frame-Options) ou indisponibilidade</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#111320] border border-[#232738] space-y-2 text-xs">
                    <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px] block">Orientação Técnica:</span>
                    <ul className="space-y-1.5 text-[#aaa] font-sans list-disc list-inside">
                      <li>O protótipo informado não pôde ser renderizado no frame deste navegador devido a restrições de cabeçalhos de segurança do servidor de origem.</li>
                      <li>O UX Test Lab <strong>recusa expressamente</strong> criar interfaces sintéticas, mocks ou réplicas visuais.</li>
                      <li>Você pode abrir o protótipo real diretamente no navegador para testá-lo sem restrições de incorporação.</li>
                    </ul>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <a
                      href={test.prototypeUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md text-center"
                    >
                      <span>Abrir Protótipo Original em Nova Aba</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setIframeLoaded(false);
                        setLifecycle('LOADING_PROTOTYPE');
                        setRuntimeError(null);
                        setReloadKey(Date.now());
                        setPipelineSteps((prev) =>
                          prev.map((s) => (s.step === 3 || s.step === 4 ? { ...s, status: 'running', detail: 'Tentando recarregar protótipo real...' } : s))
                        );
                      }}
                      className="w-full sm:w-auto px-4 py-3 rounded-xl bg-[#1a1c28] hover:bg-[#25283a] text-white text-xs font-bold border border-[#333852] flex items-center justify-center gap-2 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Tentar Novamente</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTempPrototypeUrl(test.prototypeUrl);
                        setShowEditUrlModal(true);
                      }}
                      className="w-full sm:w-auto px-4 py-3 rounded-xl bg-[#1a1c28] hover:bg-[#25283a] text-slate-300 hover:text-white text-xs font-bold border border-[#333852] flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      <span>Alterar URL</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : !test.prototypeUrl ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#888] font-mono">
                <AlertTriangle className="w-10 h-10 text-amber-400 mb-3" />
                <h3 className="text-white font-bold text-sm mb-1">Nenhum Protótipo Configurado</h3>
                <p className="text-xs text-[#aaa] max-w-md mb-4 font-sans">
                  O UX Test Lab requer a URL real do protótipo navegável como Source of Truth (nenhuma interface sintética ou mock é permitida).
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setTempPrototypeUrl('https://evil-chess-37482794.figma.site');
                    setShowEditUrlModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold font-sans transition-colors"
                >
                  Configurar URL do Protótipo
                </button>
              </div>
            ) : (
              <div className="flex-1 w-full h-full relative bg-[#07080e]">
                {!iframeLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#07080e] text-[#888] font-mono text-xs z-10 p-4 text-center">
                    <div className="flex flex-col items-center gap-3 max-w-md">
                      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <div className="text-white font-bold text-sm">Carregando Protótipo Real...</div>
                      <div className="text-[11px] text-blue-400 font-mono break-all">{test.prototypeUrl}</div>
                      <div className="text-[10px] text-[#777] font-sans">
                        Executando a aplicação original com JavaScript nativo e suporte completo a interações.
                      </div>
                      <a
                        href={test.prototypeUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <span>Abrir URL em Nova Aba</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )}

                <iframe
                  key={`${realEmbedUrl}-${reloadKey}`}
                  src={realEmbedUrl}
                  title={`Protótipo Real: ${test.prototypeUrl}`}
                  className="w-full h-full border-0 absolute inset-0 bg-white"
                  allow="clipboard-write; clipboard-read; fullscreen; accelerometer; autoplay; camera; encrypted-media; geolocation; gyroscope; microphone; midi; payment; picture-in-picture"
                  allowFullScreen
                  onLoad={(e) => {
                    // protótipo recarregado no meio do teste: reenvia a sessão ao SDK
                    if (session) {
                      const w = (e.currentTarget as HTMLIFrameElement).contentWindow;
                      setTimeout(() => w?.postMessage({ type: 'UXLAB_SET_SESSION', sessionId: session.sessionId, participantId: session.participantId }, '*'), 800);
                    }
                    setIframeLoaded(true);
                    setLifecycle((prev) => (prev === 'PROTOTYPE_LOAD_ERROR' ? prev : 'PROTOTYPE_LOADED'));
                    setPipelineSteps((prev) =>
                      prev.map((s) => {
                        if (s.step === 3) return { ...s, status: 'success', detail: `Carregado: ${test.prototypeUrl}` };
                        if (s.step === 4) return { ...s, status: 'success', detail: 'Renderizado com sucesso no frame' };
                        return s;
                      })
                    );
                  }}
                  onError={() => {
                    const errMsg = `Não foi possível carregar o protótipo real a partir de ${test.prototypeUrl}`;
                    setRuntimeError(errMsg);
                    setLifecycle('PROTOTYPE_LOAD_ERROR');
                    setPipelineSteps((prev) =>
                      prev.map((s) => (s.step === 4 ? { ...s, status: 'failed', error: errMsg } : s))
                    );
                  }}
                />
              </div>
            )}
          </div>

          {/* Cartão flutuante da tarefa: substitui as barras técnicas, deixando o protótipo em tela cheia */}
          {journeyStarted && !taskDoneModal && (
            <div
              className={`fixed bottom-4 z-40 font-sans ${taskCardSide === 'left' ? 'left-4' : 'right-4'} ${
                taskCardOpen ? 'w-[340px] max-w-[calc(100vw-2rem)]' : ''
              }`}
            >
              {taskCardOpen ? (
                <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
                  <div className="flex items-center justify-between px-4 pt-3">
                    <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">
                      Tarefa {currentTaskIndex + 1} de {test.tasks.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setTaskCardSide((v) => (v === 'left' ? 'right' : 'left'))}
                        className="px-1.5 py-0.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xs"
                        title="Mover para o outro lado"
                      >
                        ⇄
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskCardOpen(false)}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        title="Minimizar"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="px-4 pb-3 pt-1 space-y-1">
                    <div className="text-sm font-bold text-slate-900 leading-snug">{currentTask.title}</div>
                    <p className="text-xs text-slate-600 leading-relaxed">{currentTask.instruction}</p>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShowDifficultyModal(true)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-700 text-xs font-semibold flex items-center gap-1.5 hover:bg-amber-50"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" /> Tive dificuldade
                    </button>
                    {(!sdkConnected || !isAutoCompletable(test, currentTask)) && (
                      <button
                        type="button"
                        onClick={handleCompleteCurrentTask}
                        className="ml-auto px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" /> Terminei a tarefa
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setTaskCardOpen(true)}
                  className="px-4 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xl flex items-center gap-2"
                  title="Ver a tarefa"
                >
                  <ChevronUp className="w-4 h-4" />
                  Tarefa {currentTaskIndex + 1} de {test.tasks.length}
                </button>
              )}
            </div>
          )}

          {/* Modal de entrada: nome do participante + iniciar a jornada */}
          {!journeyStarted && (
            <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleBeginJourney();
                }}
                className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden text-slate-800"
              >
                <div className="px-6 pt-6 pb-4 space-y-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold">
                    <Sparkles className="w-3.5 h-3.5" /> Teste de usabilidade
                  </span>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">{test.name}</h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Você vai usar um protótipo e realizar {test.tasks.length === 1 ? '1 tarefa' : `${test.tasks.length} tarefas`}. Não existe
                    resposta certa ou errada: estamos avaliando a interface, não você.
                  </p>
                </div>
                <div className="px-6 pb-4 space-y-3">
                  <ol className="space-y-1.5 text-xs text-slate-600">
                    <li className="flex gap-2"><span className="w-5 h-5 shrink-0 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[10px]">1</span>A tarefa aparece na barra do topo da tela.</li>
                    <li className="flex gap-2"><span className="w-5 h-5 shrink-0 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[10px]">2</span>Navegue no protótipo como faria normalmente.{' '}
                      {test.tasks.every((t) => isAutoCompletable(test, t))
                        ? 'Quando chegar ao fim, o sistema avisa sozinho.'
                        : 'Ao terminar, clique em “Terminei a tarefa” no topo da tela.'}</li>
                    <li className="flex gap-2"><span className="w-5 h-5 shrink-0 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[10px]">3</span>No final, você responde algumas perguntas rápidas.</li>
                  </ol>
                  {slots && slots.limit > 0 && (
                    <div className={`p-3 rounded-xl border ${slots.full ? 'bg-rose-50 border-rose-200' : 'bg-blue-50 border-blue-100'}`}>
                      {slots.full ? (
                        <div className="text-xs text-rose-800 leading-relaxed">
                          <strong>Vagas encerradas.</strong> Este teste já recebeu os {slots.limit} participantes previstos. Se você já
                          participou e precisa continuar, informe exatamente o mesmo nome usado antes.
                        </div>
                      ) : (
                        <>
                          <div className="flex items-baseline justify-between">
                            <span className="text-xs font-bold text-blue-800">Você será o participante {slots.nextNumber} de {slots.limit}</span>
                            <span className="text-[11px] text-blue-700">{slots.limit - slots.used} vaga(s)</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white overflow-hidden mt-2">
                            <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, (slots.used / slots.limit) * 100)}%` }} />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {startError && <div className="text-xs text-rose-700">{startError}</div>}
                  <label className="block">
                    <span className="block text-xs font-semibold text-slate-700 mb-1.5">Seu nome *</span>
                    <input
                      type="text"
                      autoFocus
                      value={participantName}
                      onChange={(e) => setParticipantName(e.target.value)}
                      placeholder="Ex: Joana Silva"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-sm outline-none"
                    />
                  </label>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 space-y-2">
                  <button
                    type="submit"
                    disabled={!participantName.trim() || startingJourney}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
                  >
                    {startingJourney ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                    <span>Iniciar teste</span>
                  </button>
                  {!iframeLoaded && (
                    <p className="text-[11px] text-slate-500 text-center">Carregando o protótipo...</p>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Modal de tarefa concluída / jornada finalizada */}
          {taskDoneModal && (
            <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
              <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden text-slate-800 text-center">
                <div className="px-6 pt-8 pb-5 space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  {taskDoneModal.kind === 'final' ? (
                    <>
                      <h2 className="text-xl font-bold text-slate-900">Jornada finalizada!</h2>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Você concluiu {test.tasks.length === 1 ? 'a tarefa' : `as ${test.tasks.length} tarefas`}. Obrigado! Agora faltam só
                        algumas perguntas sobre a sua experiência.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl font-bold text-slate-900">Tarefa {taskDoneModal.finishedIdx + 1} concluída</h2>
                      <p className="text-sm text-slate-600">Próxima tarefa:</p>
                      <div className="text-left p-3.5 rounded-xl bg-blue-50 border border-blue-100">
                        <div className="text-xs font-bold text-blue-700 uppercase">
                          Tarefa {taskDoneModal.finishedIdx + 2} de {test.tasks.length}
                        </div>
                        <div className="text-sm font-semibold text-slate-900 mt-0.5">{test.tasks[taskDoneModal.finishedIdx + 1]?.title}</div>
                        <div className="text-xs text-slate-600 mt-1 leading-relaxed">{test.tasks[taskDoneModal.finishedIdx + 1]?.instruction}</div>
                      </div>
                    </>
                  )}
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 space-y-1.5">
                  {taskDoneModal.kind === 'final' ? (
                    <>
                      <button
                        type="button"
                        onClick={handleGoToQuestions}
                        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2"
                      >
                        <span>Responder perguntas</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <p className="text-[11px] text-slate-500">Redirecionando em {redirectCountdown}s...</p>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartNextTask}
                      className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Iniciar próxima tarefa</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Difficulty Modal */}
          {showDifficultyModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="max-w-md w-full bg-[#0d0d0d] border border-[#333] rounded-xl p-5 space-y-4 font-mono text-xs shadow-2xl">
                <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Reportar Dificuldade ou Dúvida</span>
                </div>
                <p className="text-[#aaa] font-sans text-xs">
                  Qual dificuldade você encontrou ao tentar realizar esta tarefa? Isso ajuda muito a equipe de produto a melhorar a usabilidade da tela.
                </p>
                <textarea
                  value={difficultyComment}
                  onChange={(e) => setDifficultyComment(e.target.value)}
                  placeholder="Ex: Não encontrei o botão de avançar, o texto estava confuso, etc."
                  rows={3}
                  className="w-full p-3 rounded-lg bg-black border border-[#262626] text-white text-xs outline-hidden focus:border-amber-500"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDifficultyModal(false)}
                    className="px-3 py-1.5 rounded bg-[#1c1c1c] text-[#888] hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSkipTask}
                    className="px-3 py-1.5 rounded bg-[#1c1c1c] text-rose-300 hover:text-rose-200 border border-rose-500/30"
                    title="Registra que não conseguiu concluir e segue para a próxima etapa"
                  >
                    Não consigo concluir
                  </button>
                  <button
                    type="button"
                    onClick={handleReportDifficulty}
                    className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold uppercase"
                  >
                    Registrar Ponto de Fricção
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Prototype URL Modal */}
          {showEditUrlModal && (
            <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
              <div className="max-w-lg w-full bg-[#101018] border border-[#2d2d3e] rounded-2xl p-6 space-y-5 font-mono text-xs shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#222232] pb-3">
                  <div className="flex items-center gap-2 text-blue-400 font-bold uppercase tracking-wider">
                    <Settings2 className="w-4 h-4" />
                    <span>Configurar URL do Protótipo Real</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEditUrlModal(false)}
                    className="text-[#666] hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] text-[#aaa] font-bold uppercase tracking-wider block">
                    URL do Protótipo (Source of Truth)
                  </label>
                  <input
                    type="text"
                    value={tempPrototypeUrl}
                    onChange={(e) => setTempPrototypeUrl(e.target.value)}
                    placeholder="https://evil-chess-37482794.figma.site"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#09090e] border border-[#2b2b3d] text-white text-xs font-mono focus:border-blue-500 focus:outline-hidden"
                  />
                  <p className="text-[10px] text-[#777] font-sans">
                    Insira a URL real do protótipo (Figma Make, Deploy Web ou URL compartilhável). O sistema executará estritamente essa aplicação como fonte visual e interativa.
                  </p>
                </div>

                {/* Quick Selection Presets */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-[#555] uppercase tracking-wider block">
                    URL de Referência:
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTempPrototypeUrl('https://evil-chess-37482794.figma.site');
                      }}
                      className="p-3 rounded-xl bg-[#171724] hover:bg-blue-950/40 border border-[#28283c] hover:border-blue-500/50 text-left transition-all"
                    >
                      <div className="font-bold text-[11px] text-white flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-blue-400" />
                        <span>Porto • Corretor Online (Figma Make Oficial)</span>
                      </div>
                      <div className="text-[10px] text-blue-400/80 mt-0.5 font-mono">
                        https://evil-chess-37482794.figma.site
                      </div>
                      <div className="text-[9px] text-[#777] mt-1 font-sans">
                        Empréstimo com garantia de imóvel, parcelas e prazo configuráveis
                      </div>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#222232]">
                  <button
                    type="button"
                    onClick={() => setShowEditUrlModal(false)}
                    className="px-4 py-2 rounded-xl bg-[#181824] hover:bg-[#202030] text-[#999] hover:text-white text-xs font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePrototypeUrl}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_12px_rgba(59,130,246,0.35)]"
                  >
                    Salvar e Carregar Protótipo
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* 2.5 QUESTIONÁRIO ABERTO CUSTOMIZADO DO PESQUISADOR */}
      {/* ========================================================================= */}
      {step === 'custom_survey' && test && (
        <div className="flex-1 p-4 sm:p-8 max-w-4xl mx-auto w-full space-y-6 font-mono animate-in fade-in duration-300">
          <div className="p-6 rounded-2xl bg-[#0d0d0d] border border-[#222] shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#222] pb-3">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>Questionário Específico da Pesquisa</span>
              </span>
              <span className="text-[11px] text-[#666]">{surveyQuestions.length + (test.metricConfig.nps ? 1 : 0)} pergunta(s)</span>
            </div>
            <h2 className="text-lg font-bold text-white font-sans">
              Tarefas concluídas! Gostaríamos de ouvir sua opinião sobre os pontos-chave:
            </h2>
            <p className="text-xs text-[#888] font-sans">
              Suas respostas ajudam o time de UX a aprimorar diretamente a experiência desta jornada digital.
            </p>
          </div>

          <div className="space-y-4">
            {surveyQuestions.map((q, idx) => {
              const currentAnswer = customAnswers[q.id];

              return (
                <div key={q.id} className="p-5 rounded-xl bg-[#0a0a0a] border border-[#222] space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="text-sm font-sans font-medium text-white flex items-center gap-2">
                        <span>{q.question}</span>
                        {q.required && (
                          <span className="text-amber-400 text-xs font-mono font-normal">* obrigatória</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Open Text Field */}
                  {q.type === 'open_text' && (
                    <div className="pt-2 pl-9">
                      <textarea
                        rows={3}
                        value={(currentAnswer as string) || ''}
                        onChange={(e) => setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })}
                        placeholder="Escreva sua resposta de forma livre e honesta..."
                        className="w-full p-3 rounded-lg bg-black border border-[#262626] text-white text-xs outline-hidden focus:border-blue-500"
                      />
                    </div>
                  )}

                  {/* Likert Scale 1 to 5 */}
                  {q.type === 'likert_scale' && (
                    <div className="pt-2 pl-9 grid grid-cols-5 gap-2 text-center text-xs">
                      {[1, 2, 3, 4, 5].map((val) => {
                        const isSelected = currentAnswer === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCustomAnswers({ ...customAnswers, [q.id]: val })}
                            className={`py-2 px-1 rounded-lg border font-mono font-bold transition-all ${
                              isSelected
                                ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                                : 'bg-black border-[#222] text-[#888] hover:border-[#333] hover:text-white'
                            }`}
                          >
                            <div className="text-sm">{val}</div>
                            <div className="text-[9px] text-[#666] font-sans mt-0.5 hidden sm:block">
                              {val === 1 ? 'Muito Difícil' : val === 5 ? 'Muito Fácil' : 'Neutro'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Multiple Choice */}
                  {q.type === 'multiple_choice' && (
                    <div className="pt-2 pl-9 flex flex-wrap gap-2">
                      {(q.options || ['Sim', 'Não', 'Parcialmente']).map((opt) => {
                        const isSelected = currentAnswer === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setCustomAnswers({ ...customAnswers, [q.id]: opt })}
                            className={`px-4 py-2 rounded-lg border text-xs font-sans transition-all ${
                              isSelected
                                ? 'bg-blue-600 border-blue-500 text-white font-bold'
                                : 'bg-black border-[#222] text-[#aaa] hover:border-[#333]'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {test.metricConfig.nps && (
            <div className="p-5 rounded-xl bg-[#0a0a0a] border border-[#222] space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-bold shrink-0">
                  {surveyQuestions.length + 1}
                </span>
                <div className="text-sm font-sans font-medium text-white">
                  De 0 a 10, o quanto você recomendaria esta experiência a um amigo ou colega?
                </div>
              </div>
              <div className="pl-9 grid grid-cols-11 gap-1.5">
                {Array.from({ length: 11 }, (_, n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCustomAnswers({ ...customAnswers, NPS: n })}
                    className={`py-2 rounded-lg border font-mono text-xs font-bold transition-all ${
                      customAnswers.NPS === n ? 'bg-blue-600 border-blue-500 text-white' : 'bg-black border-[#222] text-[#888] hover:border-[#333] hover:text-white'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="pl-9 flex justify-between text-[10px] text-[#666] font-sans">
                <span>Nada provável</span>
                <span>Muito provável</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-4 pt-4">
            {missingRequired > 0 && (
              <span className="text-xs text-amber-400 font-sans">Responda {missingRequired} pergunta(s) obrigatória(s) para continuar.</span>
            )}
            <button
              type="button"
              disabled={missingRequired > 0}
              onClick={handleCustomSurveySubmit}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold uppercase tracking-wider text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all"
            >
              <span>{test.metricConfig.sus ? 'Avançar para Avaliação de Usabilidade (SUS)' : 'Concluir Teste de Usabilidade'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. QUESTIONÁRIO OFICIAL SUS (SYSTEM USABILITY SCALE) */}
      {/* ========================================================================= */}
      {step === 'sus' && (
        <div className="flex-1 p-4 sm:p-8 max-w-4xl mx-auto w-full space-y-6 font-mono">
          <div className="p-6 rounded-2xl bg-[#0d0d0d] border border-[#222] shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#222] pb-3">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>Avaliação de Usabilidade SUS Oficial</span>
              </span>
              <span className="text-[11px] text-[#666]">John Brooke Standard (1986)</span>
            </div>
            <h2 className="text-lg font-bold text-white font-sans">
              Você concluiu as tarefas! Agora, avalie sua experiência geral:
            </h2>
            <p className="text-xs text-[#888] font-sans">
              Responda com base na sua primeira impressão espontânea, variando de 1 (Discordo Totalmente) a 5 (Concordo Totalmente).
            </p>
          </div>

          <div className="space-y-3">
            {OFFICIAL_SUS_QUESTIONS.map((qText, idx) => {
              const currentVal = susAnswers[idx];
              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-[#0a0a0a] border border-[#222] space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#181818] border border-[#333] flex items-center justify-center text-xs font-bold text-blue-400 shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs text-[#eee] font-sans font-medium pt-0.5">
                      {qText}
                    </span>
                  </div>

                  {/* 1-5 scale buttons */}
                  <div className="pt-2 pl-9 grid grid-cols-5 gap-2 text-center text-xs">
                    {[1, 2, 3, 4, 5].map((val) => {
                      const isSelected = currentVal === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => {
                            const updated = [...susAnswers];
                            updated[idx] = val;
                            setSusAnswers(updated);
                          }}
                          className={`py-2 px-1 rounded-lg border font-mono font-bold transition-all ${
                            isSelected
                              ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                              : 'bg-black border-[#222] text-[#888] hover:border-[#333] hover:text-white'
                          }`}
                        >
                          <div className="text-sm">{val}</div>
                          <div className="text-[9px] text-[#666] font-sans mt-0.5 hidden sm:block">
                            {val === 1 ? 'Discordo' : val === 5 ? 'Concordo' : 'Neutro'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Qualitative Open Comment */}
          {test.metricConfig.qualitativeComments !== false && (
          <div className="p-4 rounded-xl bg-[#0a0a0a] border border-[#222] space-y-2">
            <label className="block text-xs text-[#aaa] font-bold uppercase tracking-wider">
              Comentário ou Sugestão Adicional (Opcional):
            </label>
            <textarea
              value={finalComment}
              onChange={(e) => setFinalComment(e.target.value)}
              placeholder="O que mais chamou sua atenção positiva ou negativamente durante a navegação?"
              rows={3}
              className="w-full p-3 rounded-lg bg-black border border-[#222] text-white text-xs font-sans outline-hidden focus:border-blue-500"
            />
          </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSusSubmit}
              className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold uppercase tracking-wider text-xs flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:scale-[1.01]"
            >
              <span>Enviar Respostas & Concluir Teste</span>
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TELA DE SUCESSO & AGRADECIMENTO */}
      {/* ========================================================================= */}
      {step === 'completed' && (
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-md w-full bg-[#0d0d0d] border border-[#222] rounded-2xl p-6 sm:p-8 space-y-6 text-center font-mono shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(34,197,94,0.2)]">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2 font-sans">
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Obrigado pela sua colaboração!
              </h2>
              <p className="text-xs sm:text-sm text-[#888]">
                Sua participação foi registrada com sucesso e os dados comportamentais foram sincronizados para a equipe de UX.
              </p>
            </div>

            {computedSus !== null && (
              <div className="p-4 rounded-xl bg-black border border-[#222] space-y-1">
                <div className="text-[10px] text-[#777] uppercase tracking-wider">
                  Pontuação de Usabilidade Declarada (SUS):
                </div>
                <div className="text-2xl font-bold text-blue-400 font-mono">
                  {computedSus.toFixed(1)} / 100
                </div>
                <div className="text-[10px] text-[#666]">
                  {computedSus >= 80
                    ? 'Excelente usabilidade percebida (Grau A)'
                    : computedSus >= 68
                    ? 'Usabilidade na média da indústria (Grau C)'
                    : 'Fricção ou dificuldade moderada percebida'}
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={onExit}
                className="w-full py-2.5 px-4 rounded-xl bg-[#1a1a1a] hover:bg-[#252525] text-white text-xs font-bold uppercase tracking-wider transition-colors border border-[#333]"
              >
                Voltar à Plataforma / Encerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
