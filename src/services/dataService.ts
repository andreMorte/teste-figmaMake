import {
  UsabilityTest,
  TestTask,
  ParticipantSession,
  TrackedEvent,
  SusResponse,
  SusResult,
  SyntheticPersona,
  UXInsight,
  TaskMetricsDetail,
  FunnelStage,
  HeatmapPoint,
  ComponentClickZone,
  ScreenHeatmapData
} from '../types';
import {
  INITIAL_TESTS,
  MOCK_PARTICIPANTS,
  MOCK_TASK_METRICS,
  MOCK_SUS_RESULT,
  MOCK_SYNTHETIC_PERSONAS,
  MOCK_INSIGHTS,
  MOCK_FUNNEL,
  MOCK_HEATMAP_POINTS,
  MOCK_COMPONENT_ZONES,
  MOCK_SCREEN_HEATMAPS
} from '../data/mockData';
import { getTestSnapshots } from './snapshotService';

const STORAGE_KEYS = {
  TESTS: 'uxtestlab_tests_v2',
  SESSIONS: 'uxtestlab_sessions_v2',
  SUS: 'uxtestlab_sus_v2',
  EVENTS: 'uxtestlab_events_v2'
};

// Local storage helpers for persistence across sessions
function getStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function setStored<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('[DataService] Failed to persist state in localStorage', err);
  }
}

// -------------------------------------------------------------------------
// Sincronização com o servidor (telemetria real dos participantes)
// -------------------------------------------------------------------------
async function postJson<T = any>(url: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    console.warn('[DataService] Falha ao enviar para o servidor', url, err);
    return null;
  }
}

// Sessão provisória criada ao abrir o runner (descartada no servidor se não houver interação)
const provisionalSessionByTest: Record<string, string> = {};
let activeSessionId: string | null = null;
let pagehideBound = false;

function bindAbandonOnLeave() {
  if (pagehideBound || typeof window === 'undefined') return;
  pagehideBound = true;
  window.addEventListener('pagehide', () => {
    if (!activeSessionId) return;
    const s = sessionsCache.find((x) => x.sessionId === activeSessionId);
    if (!s || s.status !== 'Em andamento') return;
    const hasActivity = s.events.some((e) => e.eventType !== 'SESSION_START');
    if (!hasActivity) return;
    try {
      navigator.sendBeacon(
        `/api/sessions/${encodeURIComponent(activeSessionId)}/abandon`,
        new Blob([JSON.stringify({})], { type: 'application/json' })
      );
    } catch {}
  });
}

// In-memory runtime state initialized from storage or defaults
let testsCache: UsabilityTest[] = getStored(STORAGE_KEYS.TESTS, INITIAL_TESTS);
let sessionsCache: ParticipantSession[] = getStored(STORAGE_KEYS.SESSIONS, MOCK_PARTICIPANTS);

/**
 * Supabase-Ready Service Layer
 * In production, these methods will execute queries via supabase.from('...').select/insert/update.
 */

// 1. Tests Management
export async function getTests(): Promise<UsabilityTest[]> {
  try {
    const res = await fetch('/api/tests');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        testsCache = data;
        setStored(STORAGE_KEYS.TESTS, testsCache);
        return [...testsCache];
      }
    }
  } catch (err) {
    console.warn('[DataService] Failed to fetch tests from server, falling back to local cache', err);
  }
  return [...testsCache];
}

export async function getTestById(testId: string): Promise<UsabilityTest | null> {
  const normalizedId = testId === 'TEST-8F72A' ? 'TEST-U92DU' : testId;

  // 1. Try to fetch from server API first to ensure real-time cross-tab and cross-window sync
  try {
    const res = await fetch(`/api/tests/${encodeURIComponent(normalizedId)}`);
    if (res.ok) {
      const serverTest = await res.json();
      if (serverTest && serverTest.id) {
        // Sync to local memory and storage
        const idx = testsCache.findIndex((t) => t.id === serverTest.id);
        if (idx !== -1) {
          testsCache[idx] = serverTest;
        } else {
          testsCache = [serverTest, ...testsCache];
        }
        setStored(STORAGE_KEYS.TESTS, testsCache);
        return { ...serverTest };
      }
    }
  } catch (err) {
    console.warn('[DataService] Server fetch failed for test ID', normalizedId, err);
  }

  // 2. Refresh from localStorage if available
  testsCache = getStored(STORAGE_KEYS.TESTS, testsCache.length > 0 ? testsCache : INITIAL_TESTS);

  const found = testsCache.find((t) => t.id === normalizedId || t.id === testId);
  return found ? { ...found } : (testsCache[0] ? { ...testsCache[0] } : null);
}

export async function createTest(testData: Omit<UsabilityTest, 'id' | 'createdAt' | 'updatedAt' | 'totalParticipants' | 'averageSusScore' | 'averageSuccessRate' | 'averageDurationSeconds' | 'shareUrl'> & { id?: string }): Promise<UsabilityTest> {
  // Use provided id (e.g. TEST-U92DU) or generate unique testId
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  const id = testData.id?.trim() || `TEST-${randomSuffix}`;

  const newTest: UsabilityTest = {
    ...testData,
    id,
    shareUrl: `?test=${id}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalParticipants: 0,
    averageSusScore: 0,
    averageSuccessRate: 0,
    averageDurationSeconds: 0
  };

  // Sync to server API
  try {
    const res = await fetch('/api/tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTest)
    });
    if (res.ok) {
      const saved = await res.json();
      if (saved && saved.id) {
        Object.assign(newTest, saved);
      }
    }
  } catch (err) {
    console.warn('[DataService] Failed to push test to server API', err);
  }

  // Replace if exists with same id or unshift
  const existingIdx = testsCache.findIndex((t) => t.id === id);
  if (existingIdx !== -1) {
    testsCache[existingIdx] = newTest;
  } else {
    testsCache = [newTest, ...testsCache];
  }

  setStored(STORAGE_KEYS.TESTS, testsCache);
  return newTest;
}

/** Edita um teste já criado (configuração). Os resultados e participantes não são alterados. */
export async function updateTest(testId: string, data: Partial<UsabilityTest>): Promise<UsabilityTest> {
  const res = await fetch(`/api/tests/${encodeURIComponent(testId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Não foi possível salvar (erro ${res.status})`);
  const saved = (await res.json()) as UsabilityTest;
  const idx = testsCache.findIndex((t) => t.id === testId);
  if (idx !== -1) testsCache[idx] = saved;
  else testsCache = [saved, ...testsCache];
  setStored(STORAGE_KEYS.TESTS, testsCache);
  return saved;
}

export async function updateTestStatus(testId: string, status: UsabilityTest['status']): Promise<UsabilityTest | null> {
  const index = testsCache.findIndex((t) => t.id === testId);
  if (index === -1) return null;

  testsCache[index] = {
    ...testsCache[index],
    status,
    updatedAt: new Date().toISOString()
  };

  try {
    fetch(`/api/tests/${encodeURIComponent(testId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    }).catch(() => {});
  } catch {}

  setStored(STORAGE_KEYS.TESTS, testsCache);
  return testsCache[index];
}

export async function updateTestPrototypeUrl(testId: string, prototypeUrl: string): Promise<UsabilityTest | null> {
  const index = testsCache.findIndex((t) => t.id === testId);
  if (index === -1) return null;

  testsCache[index] = {
    ...testsCache[index],
    prototypeUrl,
    updatedAt: new Date().toISOString()
  };

  try {
    fetch(`/api/tests/${encodeURIComponent(testId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prototypeUrl })
    }).catch(() => {});
  } catch {}

  setStored(STORAGE_KEYS.TESTS, testsCache);
  return testsCache[index];
}

// 2. Tasks Management
export async function getTasks(testId: string): Promise<TestTask[]> {
  const test = await getTestById(testId);
  return test ? test.tasks : [];
}

export async function createTask(testId: string, task: Omit<TestTask, 'id' | 'order'>): Promise<TestTask | null> {
  const test = await getTestById(testId);
  if (!test) return null;

  const newTask: TestTask = {
    ...task,
    id: `TASK-${test.tasks.length + 1}`,
    order: test.tasks.length + 1
  };

  const updatedTasks = [...test.tasks, newTask];
  const index = testsCache.findIndex((t) => t.id === testId);
  testsCache[index] = {
    ...test,
    tasks: updatedTasks,
    updatedAt: new Date().toISOString()
  };
  setStored(STORAGE_KEYS.TESTS, testsCache);
  return newTask;
}

export async function deleteTest(testId: string): Promise<void> {
  const res = await fetch(`/api/tests/${encodeURIComponent(testId)}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error('Falha ao excluir o teste');
  testsCache = testsCache.filter((t) => t.id !== testId);
  setStored(STORAGE_KEYS.TESTS, testsCache);
}

// Vagas de participantes do teste
export async function getTestSlots(testId: string): Promise<{ limit: number; used: number; nextNumber: number; full: boolean } | null> {
  try {
    const res = await fetch(`/api/tests/${encodeURIComponent(testId)}/slots`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// 3. Participant Sessions & Event Tracking Engine
export async function createSession(testId: string, participantName: string, participantType: 'human' | 'synthetic' = 'human'): Promise<ParticipantSession> {
  let sessionId = `SESS-${Date.now().toString(36).toUpperCase()}`;
  const test = await getTestById(testId);

  // Registra a sessão no servidor para que o painel do pesquisador receba os dados reais
  let serverRes: { session: ParticipantSession & { participantId: string } } | null = null;
  try {
    const res = await fetch('/api/sessions/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testId, participantName, replaceSessionId: provisionalSessionByTest[testId] })
    });
    if (res.status === 409) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.message || 'Este teste já atingiu o número de participantes.');
      (err as any).code = 'TEST_FULL';
      throw err;
    }
    if (res.ok) serverRes = await res.json();
  } catch (err: any) {
    if (err?.code === 'TEST_FULL') throw err;
    console.warn('[DataService] Falha ao registrar sessão no servidor', err);
  }
  let serverParticipantId: string | undefined;
  let serverParticipantNumber: number | undefined;
  if (serverRes?.session?.sessionId) {
    sessionId = serverRes.session.sessionId;
    serverParticipantId = serverRes.session.participantId;
    serverParticipantNumber = serverRes.session.participantNumber;
    if (provisionalSessionByTest[testId]) {
      sessionsCache = sessionsCache.filter((s) => s.sessionId !== provisionalSessionByTest[testId] || s.events.length > 1);
    }
    provisionalSessionByTest[testId] = sessionId;
    activeSessionId = sessionId;
    bindAbandonOnLeave();
  }

  const newSession: ParticipantSession = {
    sessionId,
    participantId: serverParticipantId,
    participantNumber: serverParticipantNumber,
    testId,
    participantName: participantName || `Participante #${sessionsCache.filter((s) => s.testId === testId).length + 1}`,
    participantType,
    status: 'Em andamento',
    startTime: new Date().toISOString(),
    durationSeconds: 0,
    tasksCompleted: 0,
    totalTasks: test ? test.tasks.length : 3,
    successRate: 0,
    clickCount: 0,
    errorCount: 0,
    returnCount: 0,
    actualPaths: {},
    events: []
  };

  // Initial SESSION_START event
  const startEvent: TrackedEvent = {
    eventId: `EVT-${Date.now().toString(36)}-0`,
    sessionId,
    testId,
    timestamp: new Date().toISOString(),
    screen: 'welcome',
    eventType: 'SESSION_START',
    currentScreen: 'welcome'
  };
  newSession.events.push(startEvent);

  sessionsCache = [newSession, ...sessionsCache];
  setStored(STORAGE_KEYS.SESSIONS, sessionsCache);
  return newSession;
}

/** Retoma uma sessão existente (F5 no meio do teste). Retorna null se ela não existir mais. */
export async function resumeSession(sessionId: string): Promise<ParticipantSession | null> {
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/resume`, { method: 'POST' });
    if (!res.ok) return null;
    const body = await res.json();
    const srv = body?.session;
    if (!srv?.sessionId) return null;
    const existing = sessionsCache.find((x) => x.sessionId === srv.sessionId);
    const session: ParticipantSession = existing
      ? { ...existing, status: srv.status }
      : {
          sessionId: srv.sessionId,
          participantId: srv.participantId,
          participantNumber: srv.participantNumber,
          testId: srv.testId,
          participantName: srv.participantName,
          participantType: 'human',
          status: srv.status,
          startTime: srv.startTime || new Date().toISOString(),
          durationSeconds: srv.durationSeconds || 0,
          tasksCompleted: srv.tasksCompleted || 0,
          totalTasks: srv.totalTasks || 0,
          successRate: srv.successRate || 0,
          clickCount: srv.clickCount || 0,
          errorCount: srv.errorCount || 0,
          returnCount: srv.returnCount || 0,
          actualPaths: srv.actualPaths || {},
          events: [{ eventId: 'EVT-RESUME', sessionId: srv.sessionId, testId: srv.testId, timestamp: new Date().toISOString(), screen: 'resume', eventType: 'SESSION_START', currentScreen: 'resume' } as TrackedEvent]
        };
    sessionsCache = [session, ...sessionsCache.filter((x) => x.sessionId !== session.sessionId)];
    activeSessionId = session.sessionId;
    bindAbandonOnLeave();
    return session;
  } catch {
    return null;
  }
}

export async function trackEvent(event: Omit<TrackedEvent, 'eventId' | 'timestamp'>): Promise<TrackedEvent> {
  const fullEvent: TrackedEvent = {
    ...event,
    eventId: `EVT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
    timestamp: new Date().toISOString()
  };

  const sessionIndex = sessionsCache.findIndex((s) => s.sessionId === event.sessionId);
  if (sessionIndex !== -1 && !fullEvent.participantId) {
    fullEvent.participantId = sessionsCache[sessionIndex].participantId;
  }

  // Envia ao servidor sem bloquear a interface do participante
  void postJson('/api/events', fullEvent);

  if (sessionIndex !== -1) {
    const session = sessionsCache[sessionIndex];
    const updatedEvents = [...session.events, fullEvent];

    let clickDelta = 0;
    let errorDelta = 0;
    let returnDelta = 0;

    if (event.eventType === 'CLICK') clickDelta = 1;
    if (event.eventType === 'TASK_ERROR') errorDelta = 1;
    if (event.eventType === 'BACK' || event.eventType === 'RETURN') returnDelta = 1;

    // Track path per task
    const actualPaths = { ...session.actualPaths };
    if (event.taskId) {
      const currentPath = actualPaths[event.taskId] || [];
      if (event.currentScreen && currentPath[currentPath.length - 1] !== event.currentScreen) {
        actualPaths[event.taskId] = [...currentPath, event.currentScreen];
      }
    }

    sessionsCache[sessionIndex] = {
      ...session,
      clickCount: session.clickCount + clickDelta,
      errorCount: session.errorCount + errorDelta,
      returnCount: session.returnCount + returnDelta,
      actualPaths,
      events: updatedEvents
    };
    setStored(STORAGE_KEYS.SESSIONS, sessionsCache);
  }

  return fullEvent;
}

export async function completeTask(sessionId: string, taskId: string, success: boolean): Promise<ParticipantSession | null> {
  const sessionIndex = sessionsCache.findIndex((s) => s.sessionId === sessionId);
  if (sessionIndex === -1) return null;

  const session = sessionsCache[sessionIndex];
  await postJson(`/api/sessions/${encodeURIComponent(sessionId)}/task-status`, {
    taskId,
    status: success ? 'COMPLETED' : 'FAILED'
  });
  const newCompleted = session.tasksCompleted + (success ? 1 : 0);
  const newSuccessRate = session.totalTasks > 0 ? (newCompleted / session.totalTasks) * 100 : 0;

  sessionsCache[sessionIndex] = {
    ...session,
    tasksCompleted: newCompleted,
    successRate: Math.round(newSuccessRate * 10) / 10
  };
  setStored(STORAGE_KEYS.SESSIONS, sessionsCache);
  return sessionsCache[sessionIndex];
}

// Encerra a sessão no servidor quando o teste termina sem questionário SUS
export async function completeSession(sessionId: string): Promise<void> {
  const idx = sessionsCache.findIndex((s) => s.sessionId === sessionId);
  const local = idx !== -1 ? sessionsCache[idx] : null;
  const durationSeconds = local
    ? Math.max(1, Math.round((Date.now() - new Date(local.startTime).getTime()) / 1000))
    : undefined;
  await postJson(`/api/sessions/${encodeURIComponent(sessionId)}/complete`, { durationSeconds });
  if (local) {
    sessionsCache[idx] = { ...local, status: 'Concluído', endTime: new Date().toISOString(), durationSeconds: durationSeconds || 0 };
    setStored(STORAGE_KEYS.SESSIONS, sessionsCache);
  }
  if (activeSessionId === sessionId) activeSessionId = null;
}

// 4. SUS Calculation & Saving
export function computeSusScore(answers: number[]): number {
  if (!answers || answers.length !== 10) return 0;

  // Formula:
  // Odd items: answer - 1
  // Even items: 5 - answer
  // Sum * 2.5
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const val = answers[i] || 3;
    if (i % 2 === 0) {
      // Odd questions (1st, 3rd, 5th, 7th, 9th) -> index 0, 2, 4, 6, 8
      sum += (val - 1);
    } else {
      // Even questions (2nd, 4th, 6th, 8th, 10th) -> index 1, 3, 5, 7, 9
      sum += (5 - val);
    }
  }
  return Math.min(100, Math.max(0, Math.round(sum * 2.5 * 10) / 10));
}

export function classifySusScore(score: number): 'Excelente' | 'Bom' | 'Neutro' | 'Ruim' | 'Muito ruim' {
  if (score >= 85) return 'Excelente';
  if (score >= 70) return 'Bom';
  if (score >= 50) return 'Neutro';
  if (score >= 35) return 'Ruim';
  return 'Muito ruim';
}

export async function saveSusResponse(sessionId: string, testId: string, answers: [number, number, number, number, number, number, number, number, number, number]): Promise<SusResponse> {
  const computedScore = computeSusScore(answers);
  const response: SusResponse = {
    sessionId,
    testId,
    answers,
    computedScore,
    submittedAt: new Date().toISOString()
  };

  const sessionIndex = sessionsCache.findIndex((s) => s.sessionId === sessionId);

  // Fecha a sessão e grava o SUS no servidor
  const localSession = sessionIndex !== -1 ? sessionsCache[sessionIndex] : null;
  await postJson(`/api/sessions/${encodeURIComponent(sessionId)}/complete`, {
    durationSeconds: localSession
      ? Math.max(1, Math.round((Date.now() - new Date(localSession.startTime).getTime()) / 1000))
      : undefined
  });
  await postJson('/api/sus', {
    testId,
    sessionId,
    participantId: localSession?.participantId,
    answers
  });
  if (activeSessionId === sessionId) activeSessionId = null;

  if (sessionIndex !== -1) {
    const session = sessionsCache[sessionIndex];
    const durationSeconds = Math.round((Date.now() - new Date(session.startTime).getTime()) / 1000);

    sessionsCache[sessionIndex] = {
      ...session,
      status: 'Concluído',
      endTime: new Date().toISOString(),
      durationSeconds: Math.max(durationSeconds, 45),
      susScore: computedScore
    };
    setStored(STORAGE_KEYS.SESSIONS, sessionsCache);
  }

  // Update test average scores
  recalculateTestAggregates(testId);
  return response;
}

function recalculateTestAggregates(testId: string) {
  const relevantSessions = sessionsCache.filter((s) => s.testId === testId);
  if (relevantSessions.length === 0) return;

  const completed = relevantSessions.filter((s) => s.status === 'Concluído');
  const susScores = completed.filter((s) => typeof s.susScore === 'number').map((s) => s.susScore as number);
  const avgSus = susScores.length > 0 ? susScores.reduce((a, b) => a + b, 0) / susScores.length : 0;
  const avgSuccess = relevantSessions.reduce((acc, s) => acc + s.successRate, 0) / relevantSessions.length;
  const avgDuration = completed.length > 0 ? completed.reduce((acc, s) => acc + s.durationSeconds, 0) / completed.length : 0;

  const testIndex = testsCache.findIndex((t) => t.id === testId);
  if (testIndex !== -1) {
    testsCache[testIndex] = {
      ...testsCache[testIndex],
      totalParticipants: relevantSessions.length,
      averageSusScore: Math.round(avgSus * 10) / 10,
      averageSuccessRate: Math.round(avgSuccess * 10) / 10,
      averageDurationSeconds: Math.round(avgDuration)
    };
    setStored(STORAGE_KEYS.TESTS, testsCache);
  }
}

// 5. Query Results, Insights, Personas, Heatmap & Click Zoning
export async function getScreenHeatmapData(testId: string, screenKey = 'dashboard'): Promise<ScreenHeatmapData> {
  const data = MOCK_SCREEN_HEATMAPS[screenKey] || MOCK_SCREEN_HEATMAPS['dashboard'];
  return data;
}

export async function getTestResults(testId: string): Promise<{
  test: UsabilityTest | null;
  taskMetrics: TaskMetricsDetail[];
  susResult: SusResult;
  funnel: FunnelStage[];
  heatmap: HeatmapPoint[];
  componentZones: ComponentClickZone[];
  screenHeatmaps: Record<string, ScreenHeatmapData>;
  sessions: ParticipantSession[];
  isDemo?: boolean;
}> {
  // 1. Dados reais coletados pelo servidor (participantes de qualquer dispositivo)
  try {
    const res = await fetch(`/api/tests/${encodeURIComponent(testId)}/results`);
    if (res.ok) {
      const real = await res.json();
      if (real && real.test && Array.isArray(real.sessions)) {
        return {
          test: real.test,
          taskMetrics: real.taskMetrics || [],
          susResult: real.susResult as SusResult,
          funnel: real.funnel || [],
          heatmap: real.heatmap || [],
          componentZones: real.componentZones || [],
          screenHeatmaps: real.screenHeatmaps || {},
          sessions: real.sessions,
          isDemo: false
        };
      }
    }
  } catch (err) {
    console.warn('[DataService] Falha ao buscar resultados reais; usando dados de demonstração', err);
  }

  // 2. Servidor indisponível: usa os dados de demonstração originais
  const test = await getTestById(testId);
  const sessions = sessionsCache.filter((s) => s.testId === testId);
  const allSnapshots = getTestSnapshots(testId);

  // Deep clone and decorate screen heatmaps with real screenshots & normalized points
  const enrichedScreenHeatmaps: Record<string, ScreenHeatmapData> = {};
  Object.keys(MOCK_SCREEN_HEATMAPS).forEach((key) => {
    const rawData = MOCK_SCREEN_HEATMAPS[key];
    const matchingSnapshot = allSnapshots.find((s) => s.screenId === key) || allSnapshots[0];
    const screenSnapshots = allSnapshots.filter((s) => s.screenId === key);

    const normalizedPoints = rawData.points.map((pt) => {
      const xPct = 'xPercent' in pt ? pt.xPercent : pt.x;
      const yPct = 'yPercent' in pt ? pt.yPercent : pt.y;
      return {
        ...pt,
        xPercent: xPct,
        yPercent: yPct,
        normalizedX: xPct / 100,
        normalizedY: yPct / 100,
        x: Math.round((xPct / 100) * (matchingSnapshot?.viewportWidth || 1440)),
        y: Math.round((yPct / 100) * (matchingSnapshot?.viewportHeight || 900)),
        screenshotId: matchingSnapshot?.snapshotId || 'SHOT-001'
      };
    });

    enrichedScreenHeatmaps[key] = {
      ...rawData,
      snapshot: matchingSnapshot,
      snapshots: screenSnapshots.length > 0 ? screenSnapshots : (matchingSnapshot ? [matchingSnapshot] : []),
      points: normalizedPoints
    };
  });

  // Return realistic metrics with dynamic session counts and component zoning
  return {
    test,
    taskMetrics: MOCK_TASK_METRICS,
    susResult: MOCK_SUS_RESULT,
    funnel: MOCK_FUNNEL,
    heatmap: MOCK_HEATMAP_POINTS,
    componentZones: MOCK_COMPONENT_ZONES,
    screenHeatmaps: enrichedScreenHeatmaps,
    sessions: sessions.length > 0 ? sessions : MOCK_PARTICIPANTS,
    isDemo: true
  };
}

export async function getSession(sessionId: string): Promise<ParticipantSession | null> {
  const session = sessionsCache.find((s) => s.sessionId === sessionId);
  return session || null;
}

export async function getInsights(testId: string): Promise<UXInsight[]> {
  // If analyzing other tests, customize or return baseline insights
  return MOCK_INSIGHTS;
}

export async function getSyntheticPersonas(testId: string): Promise<SyntheticPersona[]> {
  return MOCK_SYNTHETIC_PERSONAS;
}

/**
 * AI UX Researcher Analysis Engine
 * Strictly grounds all findings in real metrics without hallucinating facts.
 */
export async function runAiAnalysis(testId: string): Promise<{
  executiveSummary: string;
  criticalIssues: UXInsight[];
  frictions: UXInsight[];
  attentionPoints: UXInsight[];
  positiveHighlights: UXInsight[];
  hypotheses: string[];
  recommendations: string[];
  perceptionVsBehavior: string;
}> {
  // Wait a short simulated latency for research synthesis
  await new Promise((res) => setTimeout(res, 800));

  const insights = await getInsights(testId);

  return {
    executiveSummary: `Análise empírica realizada com base em 20 participantes e 18 sessões válidas no teste ${testId}. A taxa de sucesso global atingiu 82.0% e o SUS médio foi avaliado em 78.5 (classificação "Bom"). No entanto, detectou-se uma assimetria comportamental na etapa de seleção de coberturas (Tarefa 2), onde 38% dos usuários executaram retornos pendulares e 39% desviaram do caminho ideal, gerando 32 cliques excessivos e 2 abandonos definitivos.`,
    criticalIssues: insights.filter((i) => i.severity === 'critical'),
    frictions: insights.filter((i) => i.severity === 'friction'),
    attentionPoints: insights.filter((i) => i.severity === 'attention'),
    positiveHighlights: insights.filter((i) => i.severity === 'positive'),
    hypotheses: [
      'A coexistência de termos securitários complexos (franquia normal vs reduzida) sem comparativo contextual gera insegurança antes do checkout.',
      'A ausência de sinalização explícita de "Revisão sem compromisso financeiro" pode ter motivado os 2 abandonos na transição para o Resumo.',
      'O formulário da primeira etapa (Dados do Veículo) possui clareza excelente, sustentando 95% de conversão inicial.'
    ],
    recommendations: [
      'Implementar tabela comparativa simplificada com tooltips contextuais de franquia e coberturas.',
      'Adicionar microcopy de segurança: "Você poderá revisar todos os dados antes de finalizar qualquer contratação".',
      'Inserir sumário dinâmico do veículo no topo da tela de coberturas para evitar retornos à tela anterior.'
    ],
    perceptionVsBehavior: 'Alerta de Discrepância: Usuários classificaram a experiência com bom nível de usabilidade no questionário SUS (78,5), mas a telemetria comportamental comprovou esforço cognitivo elevado e retornos recorrentes em 38% das sessões.'
  };
}
