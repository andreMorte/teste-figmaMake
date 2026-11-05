import express from 'express';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import { createServer as createViteServer } from 'vite';
import { Pool } from 'pg';
import { collectQualitative, hashInput, analyzeQualitative, aiEngine, QualResult } from './qualitative';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Render/hosts behind proxies: respeita X-Forwarded-Proto/Host para gerar links corretos
app.set('trust proxy', true);

// Snapshots (PNG base64) excedem o limite padrão de 100kb
app.use(express.json({ limit: '20mb' }));

// =========================================================================
// PERSISTÊNCIA EM DISCO (JSON) — os dados sobrevivem a reinícios/deploys
// =========================================================================
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SNAPSHOTS_FILE = path.join(DATA_DIR, 'snapshots.json');
let saveTimer: NodeJS.Timeout | null = null;
let saving: Promise<void> = Promise.resolve();

// Se DATABASE_URL existir (ex.: Neon/Supabase grátis), os dados vão para o Postgres.
// Necessário no plano Free do Render, onde o disco é apagado a cada reinício/hibernação.
const DATABASE_URL = process.env.DATABASE_URL || '';
const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: /sslmode=disable/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
      max: 3
    })
  : null;
const persistedSnapshotIds = new Set<string>();

function writeJsonAtomic(file: string, data: unknown) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, file);
}

function buildDbPayload() {
  return {
    savedAt: new Date().toISOString(),
    tests: serverTestsStore,
    participants: serverParticipantsStore,
    sessions: serverSessionsStore,
    events: serverEventsStore,
    susResponses: serverSusResponsesStore,
    verifications: recentVerifications,
    aiAnalyses: serverAiAnalysesStore
  };
}

async function saveToPostgres() {
  if (!pool) return;
  await pool.query(
    `INSERT INTO uxlab_store (key, value, updated_at) VALUES ('db', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(buildDbPayload())]
  );
  // Snapshots: cada um em sua linha (imagens grandes); sincroniza só o que mudou
  const currentIds = new Set(serverSnapshotsStore.map((sn) => sn.snapshotId));
  const removed = [...persistedSnapshotIds].filter((id) => !currentIds.has(id));
  if (removed.length > 0) {
    await pool.query('DELETE FROM uxlab_snapshots WHERE snapshot_id = ANY($1)', [removed]);
    removed.forEach((id) => persistedSnapshotIds.delete(id));
  }
  for (const sn of serverSnapshotsStore) {
    if (persistedSnapshotIds.has(sn.snapshotId)) continue;
    await pool.query(
      `INSERT INTO uxlab_snapshots (snapshot_id, test_id, data, created_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (snapshot_id) DO UPDATE SET data = EXCLUDED.data`,
      [sn.snapshotId, sn.testId || null, JSON.stringify(sn)]
    );
    persistedSnapshotIds.add(sn.snapshotId);
  }
}

function saveToDisk() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  writeJsonAtomic(DB_FILE, buildDbPayload());
  writeJsonAtomic(SNAPSHOTS_FILE, serverSnapshotsStore);
}

function saveDataNow(): Promise<void> {
  saving = saving
    .then(async () => {
      if (pool) await saveToPostgres();
      else saveToDisk();
    })
    .catch((err) => console.error('[Persistence] Falha ao salvar dados:', err));
  return saving;
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveDataNow();
  }, 500);
}

function replaceArray(target: any[], source: unknown) {
  if (!Array.isArray(source)) return;
  target.splice(0, target.length, ...source);
}

function applyDb(db: any) {
  replaceArray(serverTestsStore, db.tests);
  replaceArray(serverParticipantsStore, db.participants);
  replaceArray(serverSessionsStore, db.sessions);
  replaceArray(serverEventsStore, db.events);
  replaceArray(serverSusResponsesStore, db.susResponses);
  replaceArray(recentVerifications, db.verifications);
  replaceArray(serverAiAnalysesStore, db.aiAnalyses);
}

async function loadData() {
  try {
    if (pool) {
      await pool.query(`CREATE TABLE IF NOT EXISTS uxlab_store (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz DEFAULT now())`);
      await pool.query(`CREATE TABLE IF NOT EXISTS uxlab_snapshots (snapshot_id text PRIMARY KEY, test_id text, data jsonb NOT NULL, created_at timestamptz DEFAULT now())`);
      const r = await pool.query(`SELECT value FROM uxlab_store WHERE key = 'db'`);
      if (r.rows[0]) applyDb(r.rows[0].value);
      const snaps = await pool.query(`SELECT data FROM uxlab_snapshots ORDER BY created_at DESC LIMIT 200`);
      replaceArray(serverSnapshotsStore, snaps.rows.map((row) => row.data));
      serverSnapshotsStore.forEach((sn) => persistedSnapshotIds.add(sn.snapshotId));
      console.log(`[Persistence] Postgres: ${serverTestsStore.length} teste(s), ${serverSessionsStore.length} sessão(ões), ${serverSnapshotsStore.length} snapshot(s)`);
    } else if (fs.existsSync(DB_FILE)) {
      applyDb(JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')));
      if (fs.existsSync(SNAPSHOTS_FILE)) {
        replaceArray(serverSnapshotsStore, JSON.parse(fs.readFileSync(SNAPSHOTS_FILE, 'utf-8')));
      }
      console.log(`[Persistence] Disco: ${serverTestsStore.length} teste(s), ${serverSessionsStore.length} sessão(ões) carregados de ${DB_FILE}`);
    } else {
      console.log(`[Persistence] Nenhum banco encontrado. Criando novo em ${DB_FILE}`);
    }
  } catch (err) {
    console.error('[Persistence] Falha ao carregar dados:', err);
    if (pool) throw err; // não sobrescrever o banco com dados vazios
  }
  await saveDataNow();
}

// Qualquer escrita na API agenda um salvamento em disco
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET') res.on('finish', scheduleSave);
  next();
});

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

interface VerificationRequest {
  prototypeUrl: string;
  testId: string;
  trackingId: string;
}

interface DiscoveredScript {
  url: string;
  filename: string;
  type: 'external' | 'inline' | 'preload';
  sizeBytes: number;
  status: 'scanned' | 'fetch_failed' | 'empty';
  hasUXLabRef: boolean;
  hasUXLabInit: boolean;
  matchedSnippet?: string;
}

// In-memory verification log for diagnostics
const recentVerifications: Array<{
  id: string;
  timestamp: string;
  prototypeUrl: string;
  testId: string;
  trackingId: string;
  verdict: string;
}> = [];

// Helper to normalize input URL
function normalizeUrl(rawUrl: string, reqHost: string): string {
  let trimmed = rawUrl.trim();
  if (trimmed.startsWith('/')) {
    return `http://${reqHost}${trimmed}`;
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}

// Extract script snippet safely
function getCodeContext(content: string, index: number, radius = 80): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(content.length, index + radius);
  return content.substring(start, end).replace(/[\r\n]+/g, ' ');
}

// API: Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'UX Test Lab Verification Engine',
    timestamp: new Date().toISOString(),
    persistence: { mode: pool ? 'postgres' : 'disk', dataDir: pool ? undefined : DATA_DIR, tests: serverTestsStore.length, sessions: serverSessionsStore.length }
  });
});

// In-memory stores on the server to guarantee persistence across tabs, iframes and windows
const serverTestsStore: any[] = [
  {
    id: 'TEST-001',
    name: 'Avaliação de Usabilidade do Protótipo Real',
    description: 'Teste de usabilidade com medição em tempo real de cliques, tempo de execução, caminho percorrido e satisfação (SUS) no protótipo navegável.',
    researchGoal: 'Identificar gargalos de usabilidade, fricções de navegação e esforço cognitivo do usuário durante o fluxo real do protótipo.',
    productName: 'Simulador de Empréstimo com Garantia',
    researcherName: 'Equipe de UX Research',
    category: 'Mobile App / Fintech',
    status: 'Em andamento',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    prototypeUrl: 'https://evil-chess-37482794.figma.site',
    trackingId: 'UX-001',
    shareUrl: '?test=TEST-001',
    totalParticipants: 0,
    totalExecutions: 0,
    averageSusScore: 0,
    averageSuccessRate: 0,
    averageDurationSeconds: 0,
    metricConfig: {
      taskSuccessRate: true,
      completionRate: true,
      taskDuration: true,
      screenDuration: true,
      clickCount: true,
      errorClicks: true,
      backReturns: true,
      abandonmentRate: true,
      pathDeviation: true,
      mostUsedPath: true,
      idealPath: true,
      sus: true,
      nps: true,
      qualitativeComments: true,
      customQuestions: true,
      clickZoning: true
    },
    tasks: [
      {
        id: 'TASK-1',
        order: 1,
        title: 'Simular empréstimo com garantia de imóvel',
        description: 'Simula o momento em que o participante preenche o valor desejado e prazo.',
        instruction: 'Selecione o valor do empréstimo de R$ 150.000, ajuste o prazo para 120 meses e clique em "Continuar Simulação".',
        objective: 'Avaliar a facilidade e clareza do simulador inicial de crédito.',
        expectedPath: ['simulacao', 'dados-proponente'],
        successCriteria: 'Avançar para a etapa de preenchimento dos dados do proponente.',
        errorCriteria: 'Dificuldade em ajustar os campos de simulação ou abandono.'
      },
      {
        id: 'TASK-2',
        order: 2,
        title: 'Preencher dados do proponente e renda',
        description: 'Avalia a facilidade de preenchimento dos dados do participante e validação em tempo real.',
        instruction: 'Informe seus dados cadastrais, renda mensal comprovada e valor estimado do imóvel em garantia.',
        objective: 'Avaliar a fluidez do formulário com validação de dados em tempo real.',
        expectedPath: ['dados-proponente', 'revisao-proposta'],
        successCriteria: 'Chegar à tela de análise e revisão de proposta calculada.',
        errorCriteria: 'Erros repetidos em validações cadastrais ou abandono.'
      },
      {
        id: 'TASK-3',
        order: 3,
        title: 'Revisar proposta e confirmar envio',
        description: 'Avalia a revisão do Custo Efetivo Total (CET) e confirmação da solicitação.',
        instruction: 'Revise as condições da simulação calculada e confirme o envio da sua proposta de crédito.',
        objective: 'Validar a transparência dos custos da operação financeira.',
        expectedPath: ['revisao-proposta', 'proposta-enviada'],
        successCriteria: 'Visualizar a confirmação de proposta enviada com sucesso.',
        errorCriteria: 'Abandono na tela de revisão antes de confirmar a solicitação.'
      }
    ]
  },
  {
    id: 'TEST-U92DU',
    name: 'Jornada de Empréstimo com Garantia (Figma Make)',
    description: 'Avaliação de usabilidade da jornada de simulação de crédito com garantia de imóvel, preenchimento de dados cadastrais e envio de proposta.',
    researchGoal: 'Avaliar a clareza e facilidade de realização da simulação de empréstimo e envio da proposta sem dúvidas no valor das parcelas.',
    productName: 'Simulador de Crédito Imobiliário',
    researcherName: 'Ana Silva (Staff UX Researcher)',
    category: 'Mobile App / Fintech',
    status: 'Em andamento',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    prototypeUrl: 'https://evil-chess-37482794.figma.site',
    trackingId: 'UX-QK8UY',
    shareUrl: '?test=TEST-U92DU',
    totalParticipants: 0,
    totalExecutions: 0,
    averageSusScore: 0,
    averageSuccessRate: 0,
    averageDurationSeconds: 0,
    metricConfig: {
      taskSuccessRate: true,
      completionRate: true,
      taskDuration: true,
      screenDuration: true,
      clickCount: true,
      errorClicks: true,
      backReturns: true,
      abandonmentRate: true,
      pathDeviation: true,
      mostUsedPath: true,
      idealPath: true,
      sus: true,
      nps: true,
      qualitativeComments: true,
      customQuestions: true,
      clickZoning: true
    },
    customQuestions: [
      {
        id: 'CQ-1',
        question: 'Qual foi sua maior facilidade ou dificuldade ao simular o valor e prazo das parcelas?',
        type: 'open_text',
        required: true
      },
      {
        id: 'CQ-2',
        question: 'Quão clara foi a explicação sobre a taxa de juros e o Custo Efetivo Total (CET)?',
        type: 'likert_scale',
        required: true
      }
    ],
    tasks: [
      {
        id: 'TASK-1',
        order: 1,
        title: 'Simular empréstimo com garantia de imóvel',
        description: 'Simula o momento em que o participante preenche o valor desejado e prazo.',
        instruction: 'Selecione o valor do empréstimo de R$ 150.000, ajuste o prazo para 120 meses e clique em "Continuar Simulação".',
        objective: 'Avaliar a facilidade e clareza do simulador inicial de crédito.',
        expectedPath: ['simulacao', 'dados-proponente'],
        successCriteria: 'Avançar para a etapa de preenchimento dos dados do proponente.',
        errorCriteria: 'Dificuldade em ajustar os campos de simulação ou abandono.'
      },
      {
        id: 'TASK-2',
        order: 2,
        title: 'Preencher dados do proponente e renda',
        description: 'Avalia a facilidade de preenchimento dos dados do participante e validação em tempo real.',
        instruction: 'Informe seus dados cadastrais, renda mensal comprovada e valor estimado do imóvel em garantia.',
        objective: 'Avaliar a fluidez do formulário com validação de dados em tempo real.',
        expectedPath: ['dados-proponente', 'revisao-proposta'],
        successCriteria: 'Chegar à tela de análise e revisão de proposta calculada.',
        errorCriteria: 'Erros repetidos em validações cadastrais ou abandono.'
      },
      {
        id: 'TASK-3',
        order: 3,
        title: 'Revisar proposta e confirmar envio',
        description: 'Avalia a revisão do Custo Efetivo Total (CET) e confirmação da solicitação.',
        instruction: 'Revise as condições da simulação calculada e confirme o envio da sua proposta de crédito.',
        objective: 'Validar a transparência dos custos da operação financeira.',
        expectedPath: ['revisao-proposta', 'proposta-enviada'],
        successCriteria: 'Visualizar a confirmação de proposta enviada com sucesso.',
        errorCriteria: 'Abandono na tela de revisão antes de confirmar a solicitação.'
      }
    ]
  }
];

// Persistent stores for real telemetry data
const serverParticipantsStore: any[] = [];
const serverSessionsStore: any[] = [];
const serverEventsStore: any[] = [];
const serverSusResponsesStore: any[] = [];
const serverAiAnalysesStore: QualResult[] = [];

// Uma "visita" que só abriu o link (apenas SESSION_START) não conta como execução no painel
function isRealSession(s: any) {
  return s.status !== 'Em andamento' || (s.events || []).some((e: any) => e.eventType !== 'SESSION_START');
}
function realParticipantsFor(testId: string, sessions: any[]) {
  const ids = new Set(sessions.map((s) => s.participantId));
  return serverParticipantsStore.filter((p) => p.testId === testId && ids.has(p.participantId));
}

// Helper to update test aggregated counters from real telemetry
function updateTestCounters(testId: string) {
  const test = serverTestsStore.find((t) => t.id === testId);
  if (!test) return;

  const testSessions = serverSessionsStore.filter((s) => s.testId === testId && isRealSession(s));
  const testParticipants = realParticipantsFor(testId, testSessions);
  const completedSessions = testSessions.filter((s) => s.status === 'Concluído');
  const susList = serverSusResponsesStore.filter((s) => s.testId === testId);

  test.totalParticipants = testParticipants.length;
  test.totalExecutions = testSessions.length;

  if (completedSessions.length > 0) {
    const totalDuration = completedSessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
    test.averageDurationSeconds = Math.round(totalDuration / completedSessions.length);
  } else {
    test.averageDurationSeconds = 0;
  }

  if (testSessions.length > 0) {
    const totalSuccess = testSessions.reduce((acc, s) => acc + (s.successRate || 0), 0);
    test.averageSuccessRate = Math.round((totalSuccess / testSessions.length) * 10) / 10;
  } else {
    test.averageSuccessRate = 0;
  }

  // Todas as vagas usadas e nenhuma sessão em andamento -> teste finalizado
  const limit = Number(test.participantLimit) || 0;
  if (limit > 0 && testParticipants.length >= limit && testSessions.every((s) => s.status !== 'Em andamento')) {
    test.status = 'Finalizado';
  }

  if (susList.length > 0) {
    const sumSus = susList.reduce((acc, s) => acc + s.computedScore, 0);
    test.averageSusScore = Math.round((sumSus / susList.length) * 10) / 10;
  } else {
    test.averageSusScore = 0;
  }
}

// API: Tests Collection
app.get('/api/tests', (req, res) => {
  res.json(serverTestsStore);
});

// API: Single Test by ID
app.get('/api/tests/:id', (req, res) => {
  const { id } = req.params;
  const normalizedId = id === 'TEST-8F72A' ? 'TEST-U92DU' : id;
  const found = serverTestsStore.find((t) => t.id === normalizedId || t.id === id);
  if (found) {
    return res.json(found);
  }
  if (serverTestsStore.length > 0) {
    return res.json(serverTestsStore[0]);
  }
  return res.status(404).json({ error: 'Test not found' });
});

// API: Create or Update Test
app.post('/api/tests', (req, res) => {
  const testData = req.body;
  if (!testData) return res.status(400).json({ error: 'Missing body' });
  const id = testData.id?.trim() || `TEST-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  const newTest = {
    ...testData,
    id,
    shareUrl: `?test=${id}`,
    totalParticipants: 0,
    totalExecutions: 0,
    averageSusScore: 0,
    averageSuccessRate: 0,
    averageDurationSeconds: 0,
    createdAt: testData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const existingIdx = serverTestsStore.findIndex((t) => t.id === id);
  if (existingIdx !== -1) {
    serverTestsStore[existingIdx] = {
      ...serverTestsStore[existingIdx],
      ...newTest,
      prototypeUrl: testData.prototypeUrl || serverTestsStore[existingIdx].prototypeUrl
    };
    updateTestCounters(id);
    return res.json(serverTestsStore[existingIdx]);
  } else {
    serverTestsStore.unshift(newTest);
    return res.json(newTest);
  }
});

// API: Update Prototype URL or other fields
app.put('/api/tests/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const idx = serverTestsStore.findIndex((t) => t.id === id);
  if (idx === -1) {
    const created = {
      id,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    serverTestsStore.unshift(created);
    return res.json(created);
  }
  serverTestsStore[idx] = {
    ...serverTestsStore[idx],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  return res.json(serverTestsStore[idx]);
});

// API: Verification History
app.get('/api/history', (req, res) => {
  res.json(recentVerifications.slice(0, 10));
});

// =========================================================================
// REAL TELEMETRY & PARTICIPATION ENDPOINTS (100% REAL DATA, ZERO MOCKS)
// =========================================================================

// 1. Start Session / Register Participant
app.post('/api/sessions/start', (req, res) => {
  const { testId, participantName, participantId, replaceSessionId } = req.body;
  if (!testId) return res.status(400).json({ error: 'testId is required' });

  // O runner cria uma sessão provisória ao carregar a página e outra ao clicar em "Iniciar".
  // Se a provisória ainda não teve nenhuma interação, ela é descartada para não poluir o painel.
  if (replaceSessionId) {
    const prevIdx = serverSessionsStore.findIndex((s) => s.sessionId === replaceSessionId && s.testId === testId);
    if (prevIdx !== -1) {
      const prev = serverSessionsStore[prevIdx];
      const hasActivity = (prev.events || []).some((e: any) => e.eventType !== 'SESSION_START');
      if (!hasActivity && prev.status === 'Em andamento') {
        serverSessionsStore.splice(prevIdx, 1);
        for (let i = serverEventsStore.length - 1; i >= 0; i--) {
          if (serverEventsStore[i].sessionId === replaceSessionId) serverEventsStore.splice(i, 1);
        }
        const prevP = serverParticipantsStore.find((p) => p.participantId === prev.participantId && p.testId === testId);
        if (prevP) {
          prevP.sessionIds = prevP.sessionIds.filter((id: string) => id !== replaceSessionId);
          prevP.totalSessions = prevP.sessionIds.length;
          if (prevP.totalSessions === 0) {
            serverParticipantsStore.splice(serverParticipantsStore.indexOf(prevP), 1);
          }
        }
      }
    }
  }

  const cleanName = (participantName || '').trim() || 'Participante';
  const now = new Date().toISOString();
  const testForLimit = serverTestsStore.find((t) => t.id === testId);

  // Deduplicate Participant: Find existing by participantId OR by matching name for this test
  let participant = serverParticipantsStore.find(
    (p) => p.testId === testId &&
           ((participantId && p.participantId === participantId) ||
            p.participantName.toLowerCase() === cleanName.toLowerCase())
  );

  if (!participant) {
    const testParticipants = serverParticipantsStore.filter((p) => p.testId === testId);
    // Limite de clientes do teste: novos nomes são recusados quando todas as vagas foram usadas
    const limit = Number(testForLimit?.participantLimit) || 0;
    if (limit > 0 && testParticipants.length >= limit) {
      return res.status(409).json({
        error: 'TEST_FULL',
        message: `Este teste já recebeu os ${limit} participantes previstos.`,
        limit,
        used: testParticipants.length
      });
    }
    const pNumber = testParticipants.reduce((max, p) => Math.max(max, p.participantNumber || 0), 0) + 1;
    const newPId = participantId?.trim() || `PARTICIPANT-${pNumber.toString().padStart(3, '0')}`;
    participant = {
      participantId: newPId,
      participantNumber: pNumber,
      participantName: cleanName,
      testId,
      firstAccess: now,
      lastAccess: now,
      sessionIds: [],
      totalSessions: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      tasksAbandoned: 0,
      totalDurationSeconds: 0,
      averageDurationSeconds: 0,
      status: 'Ativo'
    };
    serverParticipantsStore.push(participant);
  } else {
    participant.lastAccess = now;
    participant.status = 'Ativo';
  }

  // Generate new Execution / Session ID
  // ID único globalmente (antes era SESSION-001 por teste e colidia entre testes/resets)
  const newSessionId = uniqueId('SESSION');

  const test = serverTestsStore.find((t) => t.id === testId);
  const totalTasks = test?.tasks?.length || 3;

  const session = {
    sessionId: newSessionId,
    participantId: participant.participantId,
    testId,
    participantName: participant.participantName,
    participantNumber: participant.participantNumber,
    participantType: 'human',
    status: 'Em andamento',
    startTime: now,
    durationSeconds: 0,
    tasksCompleted: 0,
    totalTasks,
    successRate: 0,
    clickCount: 0,
    errorCount: 0,
    returnCount: 0,
    events: [],
    actualPaths: {}
  };

  serverSessionsStore.push(session);
  participant.sessionIds.push(newSessionId);
  participant.totalSessions = participant.sessionIds.length;

  // Record initial session event
  const startEvent = {
    eventId: `EVT-${Date.now().toString(36)}-0`,
    sessionId: newSessionId,
    participantId: participant.participantId,
    testId,
    timestamp: now,
    screen: 'inicio',
    eventType: 'SESSION_START',
    currentScreen: 'inicio'
  };
  serverEventsStore.push(startEvent);
  session.events.push(startEvent as any);

  updateTestCounters(testId);
  return res.json({ session, participant });
});

// Vagas do teste (quantos clientes já entraram e qual o próximo número)
app.get('/api/tests/:id/slots', (req, res) => {
  const test = serverTestsStore.find((t) => t.id === req.params.id);
  if (!test) return res.status(404).json({ error: 'Test not found' });
  const participants = serverParticipantsStore.filter((p) => p.testId === test.id);
  const limit = Number(test.participantLimit) || 0;
  const used = participants.length;
  return res.json({
    limit,
    used,
    nextNumber: participants.reduce((max, p) => Math.max(max, p.participantNumber || 0), 0) + 1,
    full: limit > 0 && used >= limit,
    participants: participants
      .map((p) => ({ number: p.participantNumber, name: p.participantName, status: p.status }))
      .sort((a, b) => (a.number || 0) - (b.number || 0))
  });
});

// 2. Track Event in Real-Time
app.post('/api/events', (req, res) => {
  const event = req.body;
  if (!event || !event.testId) {
    return res.status(400).json({ error: 'Invalid event data' });
  }

  const fullEvent = {
    ...event,
    eventId: event.eventId || `EVT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: event.timestamp || new Date().toISOString()
  };

  serverEventsStore.push(fullEvent);

  const session = serverSessionsStore.find((s) => s.sessionId === event.sessionId);
  if (session) {
    session.events.push(fullEvent);
    if (event.eventType === 'CLICK') session.clickCount += 1;
    if (event.eventType === 'TASK_ERROR') session.errorCount += 1;
    if (event.eventType === 'BACK' || event.eventType === 'RETURN') session.returnCount += 1;
    updateTestCounters(session.testId);

    // Caminho real por tarefa: apenas cenários do protótipo (ignora marcadores de tarefa/questionário)
    const PATH_EVENTS = ['SCREEN_VIEW', 'CLICK', 'TASK_START', 'SCREEN_CHANGE', 'PAGE_VIEW', 'BACK', 'RETURN', 'INPUT'];
    const isScreenKey = event.currentScreen && !/^(task-|etapa-\d|figma-frame|sus|survey|end|fim|inicio|start)/.test(event.currentScreen);
    if (event.taskId && PATH_EVENTS.includes(event.eventType) && isScreenKey) {
      if (!session.actualPaths[event.taskId]) {
        session.actualPaths[event.taskId] = [];
      }
      const currentPath = session.actualPaths[event.taskId];
      if (event.currentScreen && currentPath[currentPath.length - 1] !== event.currentScreen) {
        currentPath.push(event.currentScreen);
      }
    }
  }

  if (['CUSTOM_SURVEY_END', 'SUS_COMPLETE', 'TASK_ERROR', 'TASK_ABANDON'].includes(event.eventType)) scheduleQualitative(event.testId);
  return res.json({ success: true, eventId: fullEvent.eventId });
});

// 3. Update Task Status
app.post('/api/sessions/:sessionId/task-status', (req, res) => {
  const { sessionId } = req.params;
  const { taskId, status, elapsedSeconds } = req.body;
  const session = serverSessionsStore.find((s) => s.sessionId === sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const participant = serverParticipantsStore.find((p) => p.participantId === session.participantId && p.testId === session.testId);

  if (status === 'COMPLETED') {
    session.tasksCompleted += 1;
    if (participant) participant.tasksCompleted += 1;
  } else if (status === 'FAILED') {
    if (participant) participant.tasksFailed += 1;
  } else if (status === 'ABANDONED') {
    if (participant) participant.tasksAbandoned += 1;
  }

  if (session.totalTasks > 0) {
    session.successRate = Math.round((session.tasksCompleted / session.totalTasks) * 1000) / 10;
  }

  const evtType = status === 'COMPLETED' ? 'TASK_SUCCESS' : status === 'FAILED' ? 'TASK_ABANDON' : 'TASK_ABANDON';
  // O runner já registra o evento de conclusão/abandono com a duração; evita duplicar
  const alreadyTracked = (session.events || []).some((e: any) => e.taskId === taskId && e.eventType === evtType);
  if (alreadyTracked) {
    updateTestCounters(session.testId);
    return res.json({ success: true, session });
  }
  const evt = {
    eventId: `EVT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
    sessionId,
    participantId: session.participantId,
    testId: session.testId,
    taskId,
    timestamp: new Date().toISOString(),
    screen: session.actualPaths[taskId]?.[session.actualPaths[taskId].length - 1] || 'task',
    currentScreen: session.actualPaths[taskId]?.[session.actualPaths[taskId].length - 1] || 'task',
    eventType: evtType,
    metadata: { elapsedSeconds, status }
  };
  serverEventsStore.push(evt);
  session.events.push(evt as any);

  updateTestCounters(session.testId);
  return res.json({ success: true, session });
});

// 4. Complete Session
app.post('/api/sessions/:sessionId/complete', (req, res) => {
  const { sessionId } = req.params;
  const { durationSeconds } = req.body;
  const session = serverSessionsStore.find((s) => s.sessionId === sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  session.status = 'Concluído';
  session.endTime = new Date().toISOString();
  if (typeof durationSeconds === 'number') {
    session.durationSeconds = durationSeconds;
  } else if (session.startTime) {
    session.durationSeconds = Math.max(1, Math.round((Date.now() - new Date(session.startTime).getTime()) / 1000));
  }

  const participant = serverParticipantsStore.find((p) => p.participantId === session.participantId && p.testId === session.testId);
  if (participant) {
    participant.status = 'Concluído';
    participant.totalDurationSeconds += session.durationSeconds;
    participant.averageDurationSeconds = Math.round(participant.totalDurationSeconds / (participant.totalSessions || 1));
  }

  const endEvent = {
    eventId: `EVT-${Date.now().toString(36)}-end`,
    sessionId,
    participantId: session.participantId,
    testId: session.testId,
    timestamp: session.endTime,
    screen: 'fim',
    currentScreen: 'fim',
    eventType: 'SESSION_END'
  };
  serverEventsStore.push(endEvent);
  session.events.push(endEvent as any);

  updateTestCounters(session.testId);
  return res.json({ success: true, session });
});

// 5. Abandon Session
app.post('/api/sessions/:sessionId/abandon', (req, res) => {
  const { sessionId } = req.params;
  const session = serverSessionsStore.find((s) => s.sessionId === sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.status !== 'Em andamento') return res.json({ success: true, session });

  session.status = 'Abandonado';
  session.endTime = new Date().toISOString();
  if (session.startTime) {
    session.durationSeconds = Math.max(1, Math.round((Date.now() - new Date(session.startTime).getTime()) / 1000));
  }

  const participant = serverParticipantsStore.find((p) => p.participantId === session.participantId && p.testId === session.testId);
  if (participant) {
    participant.status = 'Abandonado';
  }

  updateTestCounters(session.testId);
  return res.json({ success: true, session });
});

// 6. Submit SUS Answers & Score
app.post('/api/sus', (req, res) => {
  const { testId, sessionId, participantId, answers } = req.body;
  if (!testId || !answers || !Array.isArray(answers) || answers.length !== 10) {
    return res.status(400).json({ error: 'Invalid SUS response. Must provide 10 answers.' });
  }

  // Brooke formula: (odd - 1) + (5 - even) * 2.5
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const val = Number(answers[i]) || 3;
    if (i % 2 === 0) {
      sum += (val - 1);
    } else {
      sum += (5 - val);
    }
  }
  const computedScore = Math.min(100, Math.max(0, Math.round(sum * 2.5 * 10) / 10));

  const responseRecord = {
    sessionId: sessionId || '',
    testId,
    participantId: participantId || '',
    answers,
    computedScore,
    submittedAt: new Date().toISOString()
  };

  serverSusResponsesStore.push(responseRecord);

  if (sessionId) {
    const session = serverSessionsStore.find((s) => s.sessionId === sessionId);
    if (session) {
      session.susScore = computedScore;
    }
  }

  updateTestCounters(testId);
  return res.json({ success: true, score: computedScore, susResponse: responseRecord });
});

// 7. Get All Results strictly calculated from real telemetry
app.get('/api/tests/:id/results', (req, res) => {
  const { id } = req.params;
  const test = serverTestsStore.find((t) => t.id === id);
  if (!test) return res.status(404).json({ error: 'Test not found' });

  const sessions = serverSessionsStore.filter((s) => s.testId === id && isRealSession(s));
  const participants = realParticipantsFor(id, sessions);
  const events = serverEventsStore.filter((e) => e.testId === id);
  const susResponses = serverSusResponsesStore.filter((s) => s.testId === id);
  const snapshots = serverSnapshotsStore.filter((s) => s.testId === id);

  const completedSessions = sessions.filter((s) => s.status === 'Concluído');
  const abandonedSessions = sessions.filter((s) => s.status === 'Abandonado');
  const totalExecutions = sessions.length;
  const totalUniqueParticipants = participants.length;

  const totalClicks = events.filter((e) => e.eventType === 'CLICK').length;
  const totalErrors = events.filter((e) => e.eventType === 'TASK_ERROR').length;
  const totalReturns = events.filter((e) => e.eventType === 'BACK' || e.eventType === 'RETURN').length;

  const completionRate = totalExecutions > 0 ? Math.round((completedSessions.length / totalExecutions) * 1000) / 10 : 0;
  const abandonmentRate = totalExecutions > 0 ? Math.round((abandonedSessions.length / totalExecutions) * 1000) / 10 : 0;
  const returnRate = totalClicks > 0 ? Math.round((totalReturns / totalClicks) * 1000) / 10 : 0;

  // Task metrics calculation
  const taskMetrics = (test.tasks || []).map((t: any) => {
    const taskEvents = events.filter((e) => e.taskId === t.id);
    const taskClicks = taskEvents.filter((e) => e.eventType === 'CLICK').length;
    const taskErrors = taskEvents.filter((e) => e.eventType === 'TASK_ERROR').length;
    const taskReturns = taskEvents.filter((e) => e.eventType === 'BACK' || e.eventType === 'RETURN').length;
    const taskSuccessEvts = taskEvents.filter((e) => e.eventType === 'TASK_SUCCESS');
    const taskAbandonEvts = taskEvents.filter((e) => e.eventType === 'TASK_ABANDON');

    // Unique participants who attempted this task
    const attemptedPIds = new Set(taskEvents.map((e) => e.participantId).filter(Boolean));
    const pCount = attemptedPIds.size;

    const completedCount = taskSuccessEvts.length;
    const successRate = totalExecutions > 0 ? Math.round((completedCount / totalExecutions) * 1000) / 10 : 0;

    // Collect paths used
    const pathList: string[][] = [];
    sessions.forEach((s) => {
      if (s.actualPaths && s.actualPaths[t.id] && s.actualPaths[t.id].length > 0) {
        pathList.push(s.actualPaths[t.id]);
      }
    });

    // Frequência de caminhos
    const freqMap = new Map<string, { path: string[]; count: number }>();
    pathList.forEach((p) => {
      const key = p.join('>');
      const entry = freqMap.get(key) || { path: p, count: 0 };
      entry.count += 1;
      freqMap.set(key, entry);
    });
    const pathFrequencies = [...freqMap.values()]
      .sort((a, b) => b.count - a.count)
      .map((f) => ({ path: f.path, count: f.count, percentage: Math.round((f.count / pathList.length) * 100) }));

    // Check ideal path match
    let idealMatches = 0;
    pathList.forEach((p) => {
      if (JSON.stringify(p) === JSON.stringify(t.expectedPath)) idealMatches += 1;
    });
    const idealPathRate = pathList.length > 0 ? Math.round((idealMatches / pathList.length) * 100) : 0;

    return {
      taskId: t.id,
      title: t.title,
      participants: pCount,
      successRate,
      completionRate: successRate,
      averageTimeSeconds: totalExecutions > 0 && completedSessions.length > 0 ? Math.round(test.averageDurationSeconds / (test.tasks.length || 1)) : 0,
      medianTimeSeconds: totalExecutions > 0 && completedSessions.length > 0 ? Math.round(test.averageDurationSeconds / (test.tasks.length || 1)) : 0,
      totalClicks: taskClicks,
      errorClicks: taskErrors,
      returnsCount: taskReturns,
      abandonmentCount: taskAbandonEvts.length,
      idealPathRate,
      expectedPath: t.expectedPath || [],
      mostUsedPath: pathFrequencies[0]?.path || [],
      pathFrequencies
    };
  });

  // Funnel calculation (strictly from real sessions)
  const funnel: any[] = [];
  if (totalExecutions > 0) {
    funnel.push({
      label: 'Início do Teste',
      count: totalExecutions,
      percentage: 100,
      dropoffPercentage: 0
    });

    (test.tasks || []).forEach((t: any, idx: number) => {
      const completedThisTask = events.filter((e) => e.taskId === t.id && e.eventType === 'TASK_SUCCESS').length;
      const pct = Math.round((completedThisTask / totalExecutions) * 100);
      const prevCount = idx === 0 ? totalExecutions : funnel[idx].count;
      const dropoff = prevCount > 0 ? Math.max(0, Math.round(((prevCount - completedThisTask) / prevCount) * 100)) : 0;
      funnel.push({
        label: t.title,
        count: completedThisTask,
        percentage: pct,
        dropoffPercentage: dropoff
      });
    });

    funnel.push({
      label: 'Conclusão Total',
      count: completedSessions.length,
      percentage: Math.round((completedSessions.length / totalExecutions) * 100),
      dropoffPercentage: totalExecutions > 0 ? Math.round(((totalExecutions - completedSessions.length) / totalExecutions) * 100) : 0
    });
  }

  // SUS Result calculation (strictly from real responses)
  let susResult = null;
  if (susResponses.length > 0) {
    const avgScore = Math.round((susResponses.reduce((acc, r) => acc + r.computedScore, 0) / susResponses.length) * 10) / 10;
    const classification = avgScore >= 85 ? 'Excelente' : avgScore >= 70 ? 'Bom' : avgScore >= 50 ? 'Neutro' : avgScore >= 35 ? 'Ruim' : 'Muito ruim';

    const questionAverages = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let q = 0; q < 10; q++) {
      const qSum = susResponses.reduce((acc, r) => acc + (r.answers[q] || 3), 0);
      questionAverages[q] = Math.round((qSum / susResponses.length) * 10) / 10;
    }

    susResult = {
      averageScore: avgScore,
      classification,
      totalResponses: susResponses.length,
      questionAverages,
      scoreDistribution: [
        { range: '90-100', count: susResponses.filter((r) => r.computedScore >= 90).length },
        { range: '80-89', count: susResponses.filter((r) => r.computedScore >= 80 && r.computedScore < 90).length },
        { range: '70-79', count: susResponses.filter((r) => r.computedScore >= 70 && r.computedScore < 80).length },
        { range: '50-69', count: susResponses.filter((r) => r.computedScore >= 50 && r.computedScore < 70).length },
        { range: '0-49', count: susResponses.filter((r) => r.computedScore < 50).length }
      ],
      perceptionVsBehavior: {
        susScore: avgScore,
        successRate: test.averageSuccessRate,
        averageDuration: `${Math.floor(test.averageDurationSeconds / 60)}m ${test.averageDurationSeconds % 60}s`,
        pathDeviationRate: 0,
        discrepancyDetected: avgScore >= 70 && returnRate > 30,
        discrepancyMessage: avgScore >= 70 && returnRate > 30
          ? 'Alerta de Discrepância: Usuários avaliaram a experiência positivamente no SUS, mas a telemetria comportamental comprovou retornos e correções.'
          : 'Consistência entre satisfação declarada e fluidez comportamental.'
      }
    };
  }

  // Pontos de clique reais. Preferência: coordenadas da página inteira (pageNX/pageNY),
  // que casam com a captura de página inteira; senão, coordenadas da área visível.
  const clickEvents = events.filter((e) => e.eventType === 'CLICK' && (typeof e.normalizedX === 'number' || typeof e.x === 'number'));
  const heatmap = clickEvents.map((evt, idx) => {
    const meta = evt.metadata || {};
    const hasPage = typeof meta.pageNX === 'number' && typeof meta.pageNY === 'number';
    return {
      id: `HP-${idx + 1}`,
      screen: evt.currentScreen || evt.screen || 'tela',
      element: evt.element || 'elemento',
      taskId: evt.taskId,
      interactive: typeof meta.interactive === 'boolean' ? meta.interactive : undefined,
      pageNX: hasPage ? meta.pageNX : undefined,
      pageNY: hasPage ? meta.pageNY : undefined,
      docWidth: meta.docWidth,
      docHeight: meta.docHeight,
      elementRect: meta.elementRect,
      xPercent: Math.round((evt.normalizedX ?? 0.5) * 100),
      yPercent: Math.round((evt.normalizedY ?? 0.5) * 100),
      normalizedX: evt.normalizedX ?? 0.5,
      normalizedY: evt.normalizedY ?? 0.5,
      x: evt.x,
      y: evt.y,
      clickCount: 1,
      timestamp: evt.timestamp,
      sessionId: evt.sessionId,
      participantId: evt.participantId
    };
  });

  // Capturas sem a imagem embutida (a imagem é servida por /api/snapshots/:id/image)
  const lightSnapshots = snapshots.map(snapshotMeta);

  const screenHeatmaps: Record<string, any> = {};
  lightSnapshots.forEach((snap) => {
    const entry = screenHeatmaps[snap.screenId] || {
      screenId: snap.screenId,
      screenName: snap.screenName,
      points: heatmap.filter((p) => p.screen === snap.screenId),
      snapshots: [],
      zones: []
    };
    entry.snapshots.push(snap);
    screenHeatmaps[snap.screenId] = entry;
  });
  Object.values(screenHeatmaps).forEach((entry: any) => {
    // imagem-base: captura de participante mais recente; senão a do mapeamento
    entry.snapshots.sort((a: any, b: any) => (a.sessionId === 'MAPEAMENTO' ? 1 : 0) - (b.sessionId === 'MAPEAMENTO' ? 1 : 0) || String(b.timestamp).localeCompare(String(a.timestamp)));
    entry.snapshot = entry.snapshots[0];
    entry.totalClicks = entry.points.length;
  });

  return res.json({
    test,
    totalUniqueParticipants,
    totalExecutions,
    completionRate,
    abandonmentRate,
    returnRate,
    totalClicks,
    totalErrors,
    totalReturns,
    taskMetrics,
    susResult,
    funnel,
    heatmap,
    componentZones: [],
    screenHeatmaps,
    sessions,
    participants,
    snapshots: lightSnapshots,
    susResponses
  });
});

// Excluir teste (com participantes, sessões, eventos, SUS e capturas)
app.delete('/api/tests/:id', (req, res) => {
  const { id } = req.params;
  const idx = serverTestsStore.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Test not found' });
  serverTestsStore.splice(idx, 1);
  const purge = (arr: any[], pred: (x: any) => boolean) => {
    for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) arr.splice(i, 1);
  };
  purge(serverParticipantsStore, (p) => p.testId === id);
  purge(serverSessionsStore, (s) => s.testId === id);
  purge(serverEventsStore, (e) => e.testId === id);
  purge(serverSusResponsesStore, (s) => s.testId === id);
  purge(serverAiAnalysesStore, (s: any) => s.testId === id);
  purge(serverSnapshotsStore, (s) => s.testId === id);
  return res.json({ success: true });
});

// 8. Reset Test Data (Empty State Testing)
app.post('/api/tests/:id/reset', (req, res) => {
  const { id } = req.params;
  for (let i = serverParticipantsStore.length - 1; i >= 0; i--) {
    if (serverParticipantsStore[i].testId === id) serverParticipantsStore.splice(i, 1);
  }
  for (let i = serverSessionsStore.length - 1; i >= 0; i--) {
    if (serverSessionsStore[i].testId === id) serverSessionsStore.splice(i, 1);
  }
  for (let i = serverEventsStore.length - 1; i >= 0; i--) {
    if (serverEventsStore[i].testId === id) serverEventsStore.splice(i, 1);
  }
  for (let i = serverSusResponsesStore.length - 1; i >= 0; i--) {
    if (serverSusResponsesStore[i].testId === id) serverSusResponsesStore.splice(i, 1);
  }
  for (let i = serverAiAnalysesStore.length - 1; i >= 0; i--) {
    if (serverAiAnalysesStore[i].testId === id) serverAiAnalysesStore.splice(i, 1);
  }
  // mantém as capturas do mapeamento (imagem-base do heatmap); apaga só as de participantes
  for (let i = serverSnapshotsStore.length - 1; i >= 0; i--) {
    if (serverSnapshotsStore[i].testId === id && serverSnapshotsStore[i].sessionId !== 'MAPEAMENTO') serverSnapshotsStore.splice(i, 1);
  }

  const test = serverTestsStore.find((t) => t.id === id);
  if (test) {
    test.totalParticipants = 0;
    test.totalExecutions = 0;
    test.averageSusScore = 0;
    test.averageSuccessRate = 0;
    test.averageDurationSeconds = 0;
  }

  return res.json({ success: true, message: `Dados do teste ${id} redefinidos com sucesso.` });
});

// ---------------------------------------------------------------------------
// Análise qualitativa por IA (respostas abertas, perguntas configuradas, dificuldades)
// Roda sozinha alguns segundos depois de chegar resposta nova e fica em cache.
// ---------------------------------------------------------------------------
const qualInFlight = new Map<string, Promise<QualResult | null>>();
const qualTimers = new Map<string, NodeJS.Timeout>();
const qualRetries = new Map<string, number>();

function qualInputFor(testId: string) {
  const test = serverTestsStore.find((t) => t.id === testId);
  if (!test) return null;
  const sessions = serverSessionsStore.filter((s) => s.testId === testId && isRealSession(s));
  const sessionIds = new Set(sessions.map((s) => s.sessionId));
  const events = serverEventsStore.filter((e) => e.testId === testId && sessionIds.has(e.sessionId));
  const sus = serverSusResponsesStore.filter((r) => r.testId === testId);
  const { items, participants } = collectQualitative(test, sessions, events, sus);
  return { test, items, participants, hash: hashInput(test, items) };
}

function runQualitative(testId: string, force = false): Promise<QualResult | null> {
  if (qualInFlight.has(testId)) return qualInFlight.get(testId)!;
  const job = (async () => {
    const input = qualInputFor(testId);
    if (!input) return null;
    const cached = serverAiAnalysesStore.find((a) => a.testId === testId);
    const engine = aiEngine() || 'local';
    if (!force && cached && cached.hash === input.hash && (cached.engine === engine || engine === 'local') && !cached.aiError) return cached;
    const out = await analyzeQualitative(input.test, input.items, input.participants);
    const result: QualResult = {
      testId,
      hash: input.hash,
      createdAt: new Date().toISOString(),
      itemsInput: input.items,
      participants: input.participants,
      ...out
    };
    const idx = serverAiAnalysesStore.findIndex((a) => a.testId === testId);
    if (idx >= 0) serverAiAnalysesStore[idx] = result;
    else serverAiAnalysesStore.push(result);
    scheduleSave();
    // IA indisponível (sobrecarga): tenta de novo sozinha mais tarde, até 3 vezes
    if (result.aiError && aiEngine()) {
      const n = (qualRetries.get(testId) || 0) + 1;
      qualRetries.set(testId, n);
      if (n <= 3) setTimeout(() => runQualitative(testId, true).catch(() => {}), n * 120000);
    } else qualRetries.delete(testId);
    return result;
  })().finally(() => qualInFlight.delete(testId));
  qualInFlight.set(testId, job);
  return job;
}

function scheduleQualitative(testId: string) {
  if (!aiEngine()) return;
  clearTimeout(qualTimers.get(testId));
  qualTimers.set(
    testId,
    setTimeout(() => {
      qualTimers.delete(testId);
      runQualitative(testId).catch((err) => console.error('[IA] análise em segundo plano falhou', err));
    }, 15000)
  );
}

app.get('/api/tests/:id/qualitative', async (req, res) => {
  const { id } = req.params;
  if (!serverTestsStore.find((t) => t.id === id)) return res.status(404).json({ error: 'Test not found' });
  try {
    const result = await runQualitative(id, req.query.refresh === '1');
    if (!result) return res.status(404).json({ error: 'Test not found' });
    return res.json({ ...result, aiConfigured: !!aiEngine() });
  } catch (err: any) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

// 9. EXPORT FIGMA MAKE PROJECT AS ZIP (.zip)
app.get('/api/export/figma-make/:id?', async (req, res) => {
  try {
    const testId = req.params.id || (req.query.testId as string) || 'TEST-001';
    const test = serverTestsStore.find((t) => t.id === testId) || serverTestsStore[0];

    const specificZipPath = path.join(process.cwd(), 'public', 'downloads', `figma-make-prototype-${test ? test.id : testId}.zip`);
    const defaultZipPath = path.join(process.cwd(), 'public', 'downloads', 'figma-make-prototype.zip');

    if (fs.existsSync(specificZipPath)) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="figma-make-prototype-${test ? test.id : testId}.zip"`);
      return res.sendFile(specificZipPath);
    }

    if (fs.existsSync(defaultZipPath)) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="figma-make-prototype-${test ? test.id : testId}.zip"`);
      return res.sendFile(defaultZipPath);
    }

    // Se nenhum arquivo físico existir, gerar em tempo real
    const zip = new JSZip();
    zip.file('README.md', `# Protótipo Figma Make (${test ? test.name : testId})\nInstrumentado para UX Test Lab ID: ${test ? test.id : testId}\n`);
    zip.file('package.json', JSON.stringify({ name: 'figma-make-prototype', version: '1.0.0' }, null, 2));

    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="figma-make-prototype-${testId}.zip"`);
    return res.send(buffer);
  } catch (err: any) {
    console.error('Error generating Figma Make zip:', err);
    return res.status(500).json({ error: 'EXPORT_FAILED', message: err.message });
  }
});

// CORE VERIFICATION ENGINE: POST /api/verify
app.post('/api/verify', async (req, res) => {
  const startTime = Date.now();
  const { prototypeUrl, testId, trackingId } = req.body as VerificationRequest;

  if (!prototypeUrl || !testId || !trackingId) {
    return res.status(400).json({
      verified: false,
      verdict: 'INVALID_INPUT',
      timestamp: new Date().toISOString(),
      summaryMessage: 'Parâmetros obrigatórios ausentes. Informe prototypeUrl, testId e trackingId.',
      steps: [],
      discoveredScripts: [],
      detectedParameters: {
        testIdFound: null,
        trackingIdFound: null,
        isTestIdMatch: false,
        isTrackingIdMatch: false
      }
    });
  }

  const cleanTestId = testId.trim();
  const cleanTrackingId = trackingId.trim();
  const normalizedUrl = normalizeUrl(prototypeUrl, req.get('host') || 'localhost:3000');

  const steps: any[] = [];
  const discoveredScripts: DiscoveredScript[] = [];
  let htmlContent = '';
  let finalUrl = normalizedUrl;
  let pageTitle = '';
  let pageDescription = '';
  let contentLength = 0;

  // STEP 1: Fetch HTML & Page Reachability
  const step1Start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 UXTestLab-VerificationEngine/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    clearTimeout(timeoutId);

    finalUrl = response.url || normalizedUrl;
    contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    htmlContent = await response.text();

    if (!response.ok) {
      steps.push({
        id: 'step-1-fetch',
        name: 'Passo 1: Leitura do HTML e Conectividade',
        description: `Falha na requisição HTTP: status ${response.status} (${response.statusText})`,
        status: 'error',
        latencyMs: Date.now() - step1Start,
        details: `O protótipo em ${normalizedUrl} retornou código HTTP ${response.status}. Certifique-se de que o protótipo está publicado e com acesso público.`
      });

      return res.json({
        verified: false,
        verdict: 'UNREACHABLE',
        timestamp: new Date().toISOString(),
        request: { prototypeUrl, testId: cleanTestId, trackingId: cleanTrackingId },
        summaryMessage: `Não foi possível acessar a URL do protótipo (HTTP ${response.status}).`,
        steps,
        discoveredScripts: [],
        detectedParameters: {
          testIdFound: null,
          trackingIdFound: null,
          isTestIdMatch: false,
          isTrackingIdMatch: false
        },
        remediation: {
          reason: `Servidor retornou código ${response.status}`,
          suggestedAction: 'Verifique se a URL do Figma Make foi publicada corretamente e se não exige login privado corporativo restrito.',
          codeSnippetReact: `// Certifique-se de que a URL é acessível publicamente\n// Exemplo: https://drums-baste-72876355.figma.site/`,
          codeSnippetHtml: ''
        }
      });
    }

    // Extract Title & Meta
    const titleMatch = htmlContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    pageTitle = titleMatch ? titleMatch[1].trim() : 'Protótipo sem título';

    const descMatch = htmlContent.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i);
    pageDescription = descMatch ? descMatch[1].trim() : '';

    steps.push({
      id: 'step-1-fetch',
      name: 'Passo 1: Leitura do HTML e Conectividade',
      description: 'Download do documento HTML realizado com sucesso.',
      status: 'success',
      latencyMs: Date.now() - step1Start,
      details: `Status 200 OK • Tamanho: ${(htmlContent.length / 1024).toFixed(1)} KB • Título: "${pageTitle}"`
    });
  } catch (err: any) {
    steps.push({
      id: 'step-1-fetch',
      name: 'Passo 1: Leitura do HTML e Conectividade',
      description: `Erro de conexão ao acessar a URL: ${err?.message || 'Falha de rede'}`,
      status: 'error',
      latencyMs: Date.now() - step1Start,
      details: `Não foi possível estabelecer conexão com ${normalizedUrl}. Verifique se o endereço está correto e online.`
    });

    return res.json({
      verified: false,
      verdict: 'UNREACHABLE',
      timestamp: new Date().toISOString(),
      request: { prototypeUrl, testId: cleanTestId, trackingId: cleanTrackingId },
      summaryMessage: `Falha de rede ao conectar à URL do protótipo: ${err?.message || 'Erro desconhecido'}`,
      steps,
      discoveredScripts: [],
      detectedParameters: {
        testIdFound: null,
        trackingIdFound: null,
        isTestIdMatch: false,
        isTrackingIdMatch: false
      },
      remediation: {
        reason: 'Erro de conectividade DNS/Rede ou timeout.',
        suggestedAction: 'Confirme se a URL do Figma Make está ativa no navegador.',
        codeSnippetReact: `UXLab.init({ testId: "${cleanTestId}", trackingId: "${cleanTrackingId}" });`,
        codeSnippetHtml: ''
      }
    });
  }

  // STEP 2: Extraction of Script Tags and Bundles
  const step2Start = Date.now();
  const scriptSrcUrls: string[] = [];

  // Match <script ... src="..." ...>
  const scriptRegex = /<script\b([^>]*?)>([\s\S]*?)<\/script>/gi;
  let match;
  let inlineIndex = 1;

  while ((match = scriptRegex.exec(htmlContent)) !== null) {
    const attributes = match[1] || '';
    const body = match[2] || '';

    const srcMatch = attributes.match(/src=["']([^"']+)["']/i);
    if (srcMatch && srcMatch[1]) {
      const rawSrc = srcMatch[1].trim();
      try {
        const absoluteUrl = new URL(rawSrc, finalUrl).href;
        if (!scriptSrcUrls.includes(absoluteUrl)) {
          scriptSrcUrls.push(absoluteUrl);
        }
      } catch {
        // Ignore invalid URL
      }
    } else if (body.trim().length > 0) {
      // Inline script
      discoveredScripts.push({
        url: `inline-script-${inlineIndex}.js`,
        filename: `Inline Script #${inlineIndex}`,
        type: 'inline',
        sizeBytes: Buffer.byteLength(body, 'utf-8'),
        status: 'scanned',
        hasUXLabRef: /(?:\bwindow\.UXLab\b|\bUXLab\b|uxlab-sdk|\/uxlab[\.-]|uxlab\.io)/i.test(body),
        hasUXLabInit: /UXLab\.init/i.test(body)
      });
      inlineIndex++;
    }
  }

  // Also check <link rel="modulepreload" ...> or <link rel="preload" as="script" ...>
  const preloadRegex = /<link\b[^>]*?(?:rel=["'](?:modulepreload|preload)["'][^>]*?href=["']([^"']+)["']|href=["']([^"']+)["'][^>]*?rel=["'](?:modulepreload|preload)["'])[^>]*>/gi;
  let preloadMatch;
  while ((preloadMatch = preloadRegex.exec(htmlContent)) !== null) {
    const rawHref = preloadMatch[1] || preloadMatch[2];
    if (rawHref && (rawHref.endsWith('.js') || rawHref.includes('/assets/'))) {
      try {
        const absoluteUrl = new URL(rawHref, finalUrl).href;
        if (!scriptSrcUrls.includes(absoluteUrl)) {
          scriptSrcUrls.push(absoluteUrl);
        }
      } catch {
        // Ignore
      }
    }
  }

  // Also directly check raw HTML for UXLab references in case of SSR or simple pages
  const htmlHasUXLab = /UXLab/i.test(htmlContent);
  const htmlHasUXLabInit = /UXLab\.init/i.test(htmlContent);

  // Fetch external bundles (limit to max 12 scripts)
  const scriptsToFetch = scriptSrcUrls.slice(0, 12);
  const bundleContents: Map<string, string> = new Map();

  await Promise.all(
    scriptsToFetch.map(async (scriptUrl) => {
      const urlObj = new URL(scriptUrl);
      const filename = path.basename(urlObj.pathname) || 'bundle.js';
      try {
        const scriptController = new AbortController();
        const scriptTimeout = setTimeout(() => scriptController.abort(), 6000);

        const res = await fetch(scriptUrl, {
          signal: scriptController.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) UXTestLab-VerificationEngine/1.0'
          }
        });
        clearTimeout(scriptTimeout);

        if (res.ok) {
          const text = await res.text();
          // Store max 3MB per script
          const cappedText = text.length > 3000000 ? text.substring(0, 3000000) : text;
          bundleContents.set(scriptUrl, cappedText);

          const hasRef = /(?:\bwindow\.UXLab\b|\bUXLab\b|uxlab-sdk|\/uxlab[\.-]|uxlab\.io)/i.test(cappedText);
          const hasInit = /UXLab\.init/i.test(cappedText);

          let snippet = undefined;
          if (hasInit) {
            const initIdx = cappedText.indexOf('UXLab.init');
            snippet = getCodeContext(cappedText, initIdx, 70);
          }

          discoveredScripts.push({
            url: scriptUrl,
            filename,
            type: 'external',
            sizeBytes: Buffer.byteLength(cappedText, 'utf-8'),
            status: 'scanned',
            hasUXLabRef: hasRef,
            hasUXLabInit: hasInit,
            matchedSnippet: snippet
          });
        } else {
          discoveredScripts.push({
            url: scriptUrl,
            filename,
            type: 'external',
            sizeBytes: 0,
            status: 'fetch_failed',
            hasUXLabRef: false,
            hasUXLabInit: false
          });
        }
      } catch (scriptErr) {
        discoveredScripts.push({
          url: scriptUrl,
          filename,
          type: 'external',
          sizeBytes: 0,
          status: 'fetch_failed',
          hasUXLabRef: false,
          hasUXLabInit: false
        });
      }
    })
  );

  steps.push({
    id: 'step-2-bundles',
    name: 'Passo 2: Descoberta e Extração de Bundles (.js)',
    description: `Inspeção de ${discoveredScripts.length} script(s) e bundles compilados React/Figma Make.`,
    status: discoveredScripts.length > 0 ? 'success' : 'warning',
    latencyMs: Date.now() - step2Start,
    details: `Localizados ${scriptSrcUrls.length} script(s) externos e ${discoveredScripts.filter(s => s.type === 'inline').length} script(s) inline.`
  });

  // STEP 3 & 4: Search for UXLab SDK and Parameter Handshake
  const step3Start = Date.now();
  let foundSDK = false;
  let foundInit = false;
  let detectedTestId: string | null = null;
  let detectedTrackingId: string | null = null;
  let matchedLocation = '';
  let matchedSnippet = '';

  // Aggregate sources to analyze: external bundles, inline scripts, and raw HTML
  const inspectionTargets: Array<{ name: string; content: string }> = [];

  for (const [url, text] of bundleContents.entries()) {
    const filename = path.basename(new URL(url).pathname);
    inspectionTargets.push({ name: filename, content: text });
  }

  // Also include inline scripts from HTML
  const inlineScripts = discoveredScripts.filter(s => s.type === 'inline');
  if (inlineScripts.length > 0) {
    // re-extract inline scripts text for parameter detection
    const inlineRegex = /<script\b(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
    let inlineM;
    let idx = 1;
    while ((inlineM = inlineRegex.exec(htmlContent)) !== null) {
      if (inlineM[1] && inlineM[1].trim()) {
        inspectionTargets.push({ name: `Inline Script #${idx}`, content: inlineM[1] });
      }
      idx++;
    }
  }

  // Fallback: check full HTML
  inspectionTargets.push({ name: 'Documento HTML', content: htmlContent });

  // Pattern detection
  for (const target of inspectionTargets) {
    const isCode = target.name !== 'Documento HTML';
    const sdkRegex = isCode
      ? /(?:\bwindow\.UXLab\b|\bUXLab\b|uxlab-sdk|\/uxlab[\.-]|uxlab\.io)/i
      : /(?:<script\b[^>]*\b(?:UXLab|uxlab)[^>]*>|src=["'][^"']*uxlab[^"']*["']|<script\b[^>]*>[\s\S]*?\bUXLab\b)/i;

    if (sdkRegex.test(target.content)) {
      foundSDK = true;
    }

    if (/UXLab\.init/i.test(target.content)) {
      foundInit = true;

      // Extract parameter object around UXLab.init(...)
      // Supports: UXLab.init({ ... }) or window.UXLab.init({ ... })
      const initPattern = /UXLab\.init\s*\(\s*(\{[\s\S]*?\})\s*\)/i;
      const initMatch = target.content.match(initPattern);

      let configBlock = '';
      if (initMatch && initMatch[1]) {
        configBlock = initMatch[1];
        const matchPos = target.content.indexOf(initMatch[0]);
        matchedSnippet = getCodeContext(target.content, matchPos, 90);
        matchedLocation = target.name;
      } else {
        // Fallback: grab surrounding 150 chars around "UXLab.init"
        const pos = target.content.indexOf('UXLab.init');
        configBlock = target.content.substring(pos, pos + 250);
        matchedSnippet = getCodeContext(target.content, pos, 80);
        matchedLocation = target.name;
      }

      // Extract testId
      // Match patterns: testId: "...", "testId": '...', testId:'...'
      const testIdMatch = configBlock.match(/["']?testId["']?\s*:\s*["']([^"']+)["']/i) ||
                          target.content.match(/["']?testId["']?\s*:\s*["']([^"']+)["']/i);
      if (testIdMatch && testIdMatch[1]) {
        detectedTestId = testIdMatch[1].trim();
      }

      // Extract trackingId
      // Match patterns: trackingId: "...", "trackingId": '...', trackingId:'...'
      const trackingIdMatch = configBlock.match(/["']?trackingId["']?\s*:\s*["']([^"']+)["']/i) ||
                              target.content.match(/["']?trackingId["']?\s*:\s*["']([^"']+)["']/i);
      if (trackingIdMatch && trackingIdMatch[1]) {
        detectedTrackingId = trackingIdMatch[1].trim();
      }

      // If we found both or at least one, we can stop searching or keep best match
      if (detectedTestId || detectedTrackingId) {
        break;
      }
    }
  }

  // If UXLab.init wasn't found in standard pattern, do a fuzzy parameter scan across bundles
  if (!detectedTestId || !detectedTrackingId) {
    for (const target of inspectionTargets) {
      if (!detectedTestId) {
        const m = target.content.match(/["']?testId["']?\s*:\s*["']([^"']+)["']/i);
        if (m && m[1]) detectedTestId = m[1].trim();
      }
      if (!detectedTrackingId) {
        const m = target.content.match(/["']?trackingId["']?\s*:\s*["']([^"']+)["']/i);
        if (m && m[1]) detectedTrackingId = m[1].trim();
      }
    }
  }

  // Register STEP 3: UXLab SDK Presence
  if (foundInit) {
    steps.push({
      id: 'step-3-sdk',
      name: 'Passo 3: Busca pelo SDK do UXLab',
      description: `Chamada UXLab.init(...) detectada com sucesso em [${matchedLocation}].`,
      status: 'success',
      latencyMs: Date.now() - step3Start,
      details: `Snippet identificado: "${matchedSnippet.slice(0, 100)}..."`
    });
  } else if (foundSDK) {
    steps.push({
      id: 'step-3-sdk',
      name: 'Passo 3: Busca pelo SDK do UXLab',
      description: 'Referência ao objeto UXLab encontrada, porém a chamada UXLab.init(...) não foi localizada.',
      status: 'warning',
      latencyMs: Date.now() - step3Start,
      details: 'O script do UXLab foi carregado, mas a inicialização UXLab.init({ testId, trackingId }) não foi executada.'
    });
  } else {
    steps.push({
      id: 'step-3-sdk',
      name: 'Passo 3: Busca pelo SDK do UXLab',
      description: 'Nenhuma menção ao SDK do UXLab ou método UXLab.init(...) foi encontrada no HTML ou nos bundles JavaScript.',
      status: 'error',
      latencyMs: Date.now() - step3Start,
      details: 'O protótipo não contém a instrumentação do UXLab. É necessário adicionar o snippet no App.tsx ou index.html do Figma Make.'
    });
  }

  // Register STEP 4: Parameters Handshake
  const isTestIdMatch = detectedTestId === cleanTestId;
  const isTrackingIdMatch = detectedTrackingId === cleanTrackingId;

  const step4Status = isTestIdMatch && isTrackingIdMatch ? 'success' : 'error';
  const step4Description = isTestIdMatch && isTrackingIdMatch
    ? `Identificadores validados: testId (${cleanTestId}) e trackingId (${cleanTrackingId}) conferem perfeitamente.`
    : !foundInit
      ? 'Não foi possível validar os identificadores porque UXLab.init(...) não foi executado.'
      : `Divergência de parâmetros: testId [esperado: "${cleanTestId}", encontrado: "${detectedTestId || 'Nenhum'}"] | trackingId [esperado: "${cleanTrackingId}", encontrado: "${detectedTrackingId || 'Nenhum'}"]`;

  steps.push({
    id: 'step-4-params',
    name: 'Passo 4: Validação dos Identificadores (testId & trackingId)',
    description: step4Description,
    status: step4Status,
    latencyMs: 15,
    data: {
      expected: { testId: cleanTestId, trackingId: cleanTrackingId },
      detected: { testId: detectedTestId, trackingId: detectedTrackingId },
      isTestIdMatch,
      isTrackingIdMatch
    }
  });

  // STEP 5: Clearance Gate & Usability Link Release
  const isAllVerified = foundInit && isTestIdMatch && isTrackingIdMatch;

  let verdict: 'VERIFIED' | 'MISCONFIGURED' | 'SDK_NOT_FOUND' = 'VERIFIED';
  let summaryMessage = '';
  let usabilitySession: any = undefined;
  let remediation: any = undefined;

  const reactSnippet = `// Adicione no App.tsx do seu protótipo Figma Make:
import { useEffect } from "react";

export default function App() {
  useEffect(() => {
    // Inicialização do SDK UXLab
    if (typeof window !== "undefined") {
      window.UXLab = window.UXLab || { init: () => {} };
      UXLab.init({
        testId: "${cleanTestId}",
        trackingId: "${cleanTrackingId}"
      });
    }
  }, []);

  return (
    <div>
      {/* Seu protótipo aqui */}
    </div>
  );
}`;

  const htmlSnippet = `<!-- Adicione no index.html do protótipo -->
<script src="https://cdn.uxlab.io/v1/uxlab-sdk.js"></script>
<script>
  UXLab.init({
    testId: "${cleanTestId}",
    trackingId: "${cleanTrackingId}"
  });
</script>`;

  if (isAllVerified) {
    verdict = 'VERIFIED';
    summaryMessage = `Instrumentação validada com sucesso! O protótipo está devidamente conectado ao UXLab para o teste ${cleanTestId}.`;

    const token = `UXL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    // Link real do runner de participantes nesta mesma instância
    const publicBase = process.env.APP_URL && /^https?:\/\//.test(process.env.APP_URL)
      ? process.env.APP_URL.replace(/\/$/, '')
      : `${req.protocol}://${req.get('host')}`;
    const authorizedUrl = `${publicBase}/run/${encodeURIComponent(cleanTestId)}?p=${encodeURIComponent(finalUrl)}&token=${token}`;

    usabilitySession = {
      authorizedUrl,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    steps.push({
      id: 'step-5-release',
      name: 'Passo 5: Liberação do Teste de Usabilidade',
      description: 'Handshake concluído! Link de teste de usabilidade liberado e ativo.',
      status: 'success',
      latencyMs: 5,
      details: `Sessão autorizada: token ${token}. O link do teste está pronto para distribuição aos participantes.`
    });
  } else if (!foundInit) {
    verdict = foundSDK ? 'MISCONFIGURED' : 'SDK_NOT_FOUND';
    summaryMessage = foundSDK
      ? 'O SDK do UXLab está presente, mas o método UXLab.init(...) com os identificadores não foi invocado.'
      : 'O SDK do UXLab não foi localizado no protótipo. O teste não pode ser liberado.';

    steps.push({
      id: 'step-5-release',
      name: 'Passo 5: Liberação do Teste de Usabilidade',
      description: 'Acesso bloqueado. A instrumentação necessária não foi encontrada no protótipo.',
      status: 'error',
      latencyMs: 5,
      details: 'Liberação do link suspensa até que o SDK seja instalado e inicializado.'
    });

    remediation = {
      reason: foundSDK ? 'Chamada UXLab.init({ testId, trackingId }) ausente' : 'SDK do UXLab não instalado no protótipo',
      suggestedAction: 'Insira o código de inicialização no componente principal (App.tsx) ou no index.html do Figma Make e publique uma nova versão.',
      codeSnippetReact: reactSnippet,
      codeSnippetHtml: htmlSnippet
    };
  } else {
    verdict = 'MISCONFIGURED';
    summaryMessage = 'A chamada UXLab.init foi encontrada, mas os valores de testId ou trackingId estão divergentes do esperado.';

    steps.push({
      id: 'step-5-release',
      name: 'Passo 5: Liberação do Teste de Usabilidade',
      description: 'Acesso bloqueado devido a divergência nos identificadores de teste/rastreamento.',
      status: 'error',
      latencyMs: 5,
      details: `Esperado: [testId=${cleanTestId}, trackingId=${cleanTrackingId}] vs Encontrado: [testId=${detectedTestId || 'N/A'}, trackingId=${detectedTrackingId || 'N/A'}].`
    });

    remediation = {
      reason: 'Divergência nos parâmetros testId ou trackingId',
      suggestedAction: 'Atualize os valores no código do protótipo para corresponderem exatamente aos parâmetros deste teste.',
      codeSnippetReact: reactSnippet,
      codeSnippetHtml: htmlSnippet
    };
  }

  // Record into history
  recentVerifications.unshift({
    id: `VER-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    prototypeUrl,
    testId: cleanTestId,
    trackingId: cleanTrackingId,
    verdict
  });
  if (recentVerifications.length > 20) {
    recentVerifications.pop();
  }

  const result = {
    verified: isAllVerified,
    verdict,
    timestamp: new Date().toISOString(),
    request: {
      prototypeUrl,
      testId: cleanTestId,
      trackingId: cleanTrackingId
    },
    summaryMessage,
    steps,
    discoveredScripts,
    detectedParameters: {
      testIdFound: detectedTestId,
      trackingIdFound: detectedTrackingId,
      isTestIdMatch,
      isTrackingIdMatch,
      matchedInFile: matchedLocation || undefined,
      matchedSnippet: matchedSnippet || undefined
    },
    prototypeMetadata: {
      title: pageTitle,
      description: pageDescription,
      contentLength,
      finalUrl
    },
    usabilitySession,
    remediation
  };

  return res.json(result);
});

// In-memory snapshots store on the server
const serverSnapshotsStore: any[] = [];

function snapshotMeta(snap: any) {
  const { image, thumbnail, ...rest } = snap;
  return { ...rest, hasImage: typeof image === 'string', imageUrl: `/api/snapshots/${encodeURIComponent(snap.snapshotId)}/image` };
}

// Serve UXLab SDK files directly
app.use('/sdk', express.static(path.join(process.cwd(), 'public/sdk')));

// =========================================================================
// PROXY DO PROTÓTIPO (mesma origem) — permite injetar o SDK UXLab
// Figma Make carrega tudo por caminhos absolutos (/_runtimes, /_components,
// /_json, /_woff, /__figma__...). Servimos esses caminhos aqui e buscamos no
// site original; a origem vem de ?origin, do cookie uxlab_proto ou do Referer.
// =========================================================================
const PROXY_PREFIXES = ['/_runtimes', '/_components', '/_woff', '/_assets', '/_json', '/__figma__', '/_images', '/_fonts'];
const DEFAULT_PROTO_ORIGIN = 'https://evil-chess-37482794.figma.site';

function readCookie(req: express.Request, name: string): string {
  const raw = req.headers.cookie || '';
  const found = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.substring(name.length + 1)) : '';
}

function resolveProtoOrigin(req: express.Request): string {
  const fromQuery = req.query.origin as string;
  if (fromQuery && /^https?:\/\//.test(fromQuery)) return new URL(fromQuery).origin;
  const fromCookie = readCookie(req, 'uxlab_proto');
  if (fromCookie && /^https?:\/\//.test(fromCookie)) return fromCookie;
  try {
    const ref = req.get('referer');
    if (ref) {
      const u = new URL(ref).searchParams.get('url');
      if (u) return new URL(/^https?:\/\//.test(u) ? u : `https://${u}`).origin;
    }
  } catch {}
  return DEFAULT_PROTO_ORIGIN;
}

app.use(PROXY_PREFIXES, async (req, res) => {
  const targetOrigin = resolveProtoOrigin(req);
  const query = new URLSearchParams(req.query as Record<string, string>);
  query.delete('origin');
  const qs = query.toString();
  const targetUrl = `${targetOrigin}${req.baseUrl}${req.path === '/' ? '' : req.path}${qs ? `?${qs}` : ''}`;
  try {
    const upstreamRes = await fetch(targetUrl, {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 UXLabRunner/3.0', Accept: req.get('accept') || '*/*' }
    });
    res.status(upstreamRes.status);
    const contentType = upstreamRes.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    const cache = upstreamRes.headers.get('cache-control');
    if (cache) res.setHeader('Cache-Control', cache);
    res.setHeader('Access-Control-Allow-Origin', '*');
    const buffer = await upstreamRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    res.status(502).json({ error: 'Proxy asset failure', message: err.message, targetUrl });
  }
});

// Carrega o HTML real do protótipo e injeta o SDK de telemetria/mapeamento
app.get('/api/prototype-runtime', async (req, res) => {
  const rawUrl = (req.query.url as string) || DEFAULT_PROTO_ORIGIN;
  const esc = (v: string) => String(v).replace(/[^A-Za-z0-9_\-.:]/g, '');
  const testId = esc((req.query.testId as string) || '');
  const trackingId = esc((req.query.trackingId as string) || '');
  const sessionId = esc((req.query.sessionId as string) || '');
  const participantId = esc((req.query.participantId as string) || '');
  const mode = (req.query.mode as string) === 'map' ? 'map' : 'run';

  try {
    let targetUrl = rawUrl.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }
    const urlObj = new URL(targetUrl);

    const upstream = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) UXLabRunner/3.0' }
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: 'UPSTREAM_HTTP_ERROR',
        status: upstream.status,
        statusText: upstream.statusText,
        url: targetUrl,
        diagnostic: `O protótipo em [${targetUrl}] retornou código HTTP ${upstream.status}.`
      });
    }

    let html = await upstream.text();
    const targetOrigin = urlObj.origin;

    // URLs absolutas do próprio site passam a ser servidas pelo proxy
    html = html.split(`${targetOrigin}/`).join('/');

    // Sem <base>: os caminhos absolutos (/_runtimes, /_json...) caem no proxy acima.
    // O roteador do site precisa ver o caminho original do protótipo, não /api/prototype-runtime.
    const routePath = JSON.stringify((urlObj.pathname || '/') + urlObj.search + urlObj.hash);
    const headInjection = `
      <script>try{history.replaceState(history.state,'',${routePath});}catch(e){}</script>
      <script src="/sdk/html2canvas.min.js"></script>
      <script src="/sdk/uxlab-runtime-sdk.js" data-mode="${mode}" data-test-id="${testId}" data-tracking-id="${trackingId}" data-session-id="${sessionId}" data-participant-id="${participantId}"></script>
    `;

    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (m) => `${m}${headInjection}`);
    } else if (html.includes('<html')) {
      html = html.replace(/<html[^>]*>/, `$&<head>${headInjection}</head>`);
    } else {
      html = `<head>${headInjection}</head>${html}`;
    }

    res.setHeader('Set-Cookie', `uxlab_proto=${encodeURIComponent(targetOrigin)}; Path=/; SameSite=Lax`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(html);
  } catch (err: any) {
    return res.status(502).json({
      error: 'PROTOTYPE_CONNECTION_FAILED',
      message: err.message,
      url: rawUrl,
      diagnostic: `Falha ao conectar ao protótipo real [${rawUrl}].`
    });
  }
});

// Snapshot persistence API
app.post('/api/snapshots', (req, res) => {
  const snapshot = req.body;
  if (!snapshot || !snapshot.image) {
    return res.status(400).json({ error: 'Invalid snapshot data' });
  }
  const fullSnapshot = {
    ...snapshot,
    snapshotId: !snapshot.snapshotId || snapshot.snapshotId === 'SHOT-001' ? uniqueId('SHOT') : snapshot.snapshotId,
    captureSource: 'REAL_RUNTIME_CAPTURE',
    source: 'REAL_RUNTIME_CAPTURE',
    timestamp: snapshot.timestamp || new Date().toISOString()
  };
  // Mantém apenas a captura mais recente por sessão + tela
  const dupIdx = serverSnapshotsStore.findIndex(
    (s) => s.testId === fullSnapshot.testId && s.sessionId === fullSnapshot.sessionId && s.screenId === fullSnapshot.screenId
  );
  if (dupIdx !== -1) serverSnapshotsStore.splice(dupIdx, 1);
  serverSnapshotsStore.unshift(fullSnapshot);
  // Por teste + tela: guarda a do mapeamento e as 2 capturas de participante mais recentes
  const sameScreen = serverSnapshotsStore.filter(
    (s) => s.testId === fullSnapshot.testId && s.screenId === fullSnapshot.screenId && s.sessionId !== 'MAPEAMENTO'
  );
  sameScreen.slice(2).forEach((old) => {
    const i = serverSnapshotsStore.indexOf(old);
    if (i !== -1) serverSnapshotsStore.splice(i, 1);
  });
  while (serverSnapshotsStore.length > 400) serverSnapshotsStore.pop();
  return res.json({ success: true, snapshotId: fullSnapshot.snapshotId });
});

app.get('/api/snapshots', (req, res) => {
  const { testId, sessionId } = req.query;
  let filtered = [...serverSnapshotsStore];
  if (testId) filtered = filtered.filter(s => s.testId === testId);
  if (sessionId) filtered = filtered.filter(s => s.sessionId === sessionId);
  return res.json(filtered.map(snapshotMeta));
});

// Diagnóstico do SDK (falhas de captura etc.) — últimos 200 registros em memória
const diagnosticsLog: any[] = [];
app.post('/api/diagnostics', (req, res) => {
  diagnosticsLog.unshift({ ...req.body, receivedAt: new Date().toISOString() });
  if (diagnosticsLog.length > 200) diagnosticsLog.pop();
  res.json({ ok: true });
});
app.get('/api/diagnostics', (req, res) => {
  const { testId } = req.query;
  res.json(testId ? diagnosticsLog.filter((d) => d.testId === testId) : diagnosticsLog);
});

// Imagem da captura (binário, com cache) — evita trafegar base64 dentro do JSON de resultados
app.get('/api/snapshots/:id/image', (req, res) => {
  const snap = serverSnapshotsStore.find((s) => s.snapshotId === req.params.id);
  if (!snap || typeof snap.image !== 'string') return res.status(404).end();
  const m = snap.image.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
  if (!m) return res.status(415).end();
  const body = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]));
  res.setHeader('Content-Type', m[1]);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.send(body);
});

// Setup Vite middleware in dev, static files in production
async function startServer() {
  await loadData();
  const flush = async () => {
    await saveDataNow();
    if (pool) await pool.end().catch(() => {});
    process.exit(0);
  };
  process.on('SIGTERM', flush);
  process.on('SIGINT', flush);
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[UXLab Verification Engine] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
