export interface VerificationRequest {
  prototypeUrl: string;
  testId: string;
  trackingId: string;
}

export type StepStatus = 'success' | 'warning' | 'error' | 'pending' | 'skipped';

export interface HandshakeStep {
  id: string;
  name: string;
  description: string;
  status: StepStatus;
  latencyMs?: number;
  details?: string;
  data?: Record<string, unknown>;
}

export interface DiscoveredScript {
  url: string;
  filename: string;
  type: 'external' | 'inline' | 'preload';
  sizeBytes: number;
  status: 'scanned' | 'fetch_failed' | 'empty';
  hasUXLabRef: boolean;
  hasUXLabInit: boolean;
  matchedSnippet?: string;
}

export interface VerificationResult {
  verified: boolean;
  verdict: 'VERIFIED' | 'MISCONFIGURED' | 'SDK_NOT_FOUND' | 'UNREACHABLE' | 'INVALID_INPUT';
  timestamp: string;
  request: VerificationRequest;
  summaryMessage: string;
  steps: HandshakeStep[];
  discoveredScripts: DiscoveredScript[];
  detectedParameters: {
    testIdFound: string | null;
    trackingIdFound: string | null;
    isTestIdMatch: boolean;
    isTrackingIdMatch: boolean;
    matchedInFile?: string;
    matchedSnippet?: string;
  };
  prototypeMetadata?: {
    title?: string;
    description?: string;
    server?: string;
    contentLength?: number;
    finalUrl?: string;
  };
  usabilitySession?: {
    authorizedUrl: string;
    token: string;
    expiresAt: string;
  };
  remediation?: {
    reason: string;
    suggestedAction: string;
    codeSnippetReact: string;
    codeSnippetHtml: string;
  };
}

// ==========================================
// UX TEST LAB — USABILITY TESTING PLATFORM TYPES
// ==========================================

export type TestStatus = 'Rascunho' | 'Publicado' | 'Em andamento' | 'Finalizado';

export interface ExpectedStep {
  id: string;
  name: string;
  screenKey: string;
  description?: string;
  isOptional?: boolean;
}

export interface TestTask {
  id: string;
  order: number;
  title: string;
  description: string;
  objective?: string;
  instruction: string;
  expectedPath: string[]; // Screen keys in sequence
  expectedPathDetails?: ExpectedPathStep[]; // Detalhe de cada troca de cenário (mapeador)
  successCriteria: string;
  errorCriteria: string;
}

/**
 * Cenário (tela lógica) detectado automaticamente pelo SDK em protótipos de página única
 * (Figma Make troca componentes sem mudar a URL).
 */
export interface MappedScreen {
  screenId: string; // chave estável derivada do título/etapa (usada no expectedPath)
  screenName: string; // nome exibido (editável pelo pesquisador)
  title: string; // maior texto/título visível
  subtitle?: string; // segundo título da hierarquia
  stepLabel?: string; // indicador de etapa (ex.: "1 de 3")
  dialog?: boolean; // cenário é um modal/diálogo sobre a tela
  url?: string;
  actions: string[]; // botões/ações visíveis
  inputs: string[]; // campos de formulário visíveis
  thumbnail?: string; // miniatura JPEG (data URL)
  firstSeenAt: string;
}

export interface ExpectedPathStep {
  screenId: string;
  screenName: string;
  trigger?: string; // ação que levou a este cenário (ex.: clique em "Nova cotação")
}

export type CustomQuestionType = 'open_text' | 'likert_scale' | 'multiple_choice';

export interface CustomQuestion {
  id: string;
  question: string;
  type: CustomQuestionType;
  options?: string[]; // for multiple_choice
  required?: boolean;
}

export interface NpsConfig {
  question: string;
  scaleMax: 5 | 10; // escala 0–5 ou 0–10
  minLabel: string; // texto do 0
  maxLabel: string; // texto da nota máxima
}

export interface MetricConfig {
  taskSuccessRate: boolean;
  completionRate: boolean;
  taskDuration: boolean;
  screenDuration: boolean;
  clickCount: boolean;
  errorClicks: boolean;
  backReturns: boolean;
  abandonmentRate: boolean;
  pathDeviation: boolean;
  mostUsedPath: boolean;
  idealPath: boolean;
  sus: boolean;
  nps: boolean;
  qualitativeComments: boolean;
  customQuestions?: boolean;
  clickZoning?: boolean;
}

export interface UsabilityTest {
  id: string; // e.g. "TEST-001" or "TEST-U92DU"
  name: string;
  description: string;
  researchGoal: string;
  productName: string;
  researcherName: string;
  category?: 'SaaS / B2B' | 'E-commerce' | 'Mobile App / Fintech' | 'Healthtech' | 'Geral / Customizado';
  status: TestStatus;
  createdAt: string;
  updatedAt: string;
  prototypeUrl: string;
  trackingId: string;
  tasks: TestTask[];
  participantLimit?: number; // quantidade de clientes/participantes previstos (fecha o link ao atingir)
  screenMap?: MappedScreen[]; // catálogo de cenários mapeados do protótipo
  customQuestions?: CustomQuestion[];
  moderation?: 'moderated' | 'unmoderated'; // moderado: facilitador acompanha; não moderado: participante tem ajuda da IA
  npsConfig?: NpsConfig; // pergunta e escala do NPS editáveis
  ignoredScreens?: string[]; // cenários de transição removidos do mapeamento (servidor)
  susQuestions?: string[]; // 10 afirmações do SUS (texto editável; ordem e sentido mantidos)
  metricConfig: MetricConfig;
  verifiedAt?: string;
  shareUrl: string;
  totalParticipants: number;
  totalExecutions?: number;
  averageSusScore: number;
  averageSuccessRate: number;
  averageDurationSeconds: number;
}

export interface Participant {
  participantId: string;
  participantName: string;
  testId: string;
  firstAccess: string;
  lastAccess: string;
  sessionIds: string[];
  totalSessions: number; // Execuções
  tasksCompleted: number;
  tasksFailed: number;
  tasksAbandoned: number;
  totalDurationSeconds: number;
  averageDurationSeconds: number;
  status: 'Ativo' | 'Concluído' | 'Abandonado';
}

export type EventType =
  | 'PAGE_VIEW'
  | 'AI_HELP' // participante pediu ajuda à IA (teste não moderado)
  | 'SCREEN_VIEW'
  | 'CLICK'
  | 'TASK_START'
  | 'TASK_SUCCESS'
  | 'TASK_ERROR'
  | 'TASK_ABANDON'
  | 'BACK'
  | 'RETURN'
  | 'INPUT'
  | 'SCREEN_CHANGE'
  | 'FORM_START'
  | 'FORM_COMPLETE'
  | 'OPTION_SELECT'
  | 'COMMENT'
  | 'SUS_START'
  | 'SUS_COMPLETE'
  | 'CUSTOM_SURVEY_START'
  | 'CUSTOM_SURVEY_END'
  | 'SESSION_START'
  | 'SESSION_END';

export interface TrackedEvent {
  eventId: string;
  sessionId: string;
  testId: string;
  participantId?: string;
  taskId?: string;
  timestamp: string;
  screen: string;
  element?: string;
  eventType: EventType;
  metadata?: Record<string, unknown>;
  durationMs?: number;
  previousScreen?: string;
  currentScreen: string;
  screenshotId?: string; // Links event directly to ScreenSnapshot
  x?: number; // raw x (px)
  y?: number; // raw y (px)
  normalizedX?: number; // x / viewportWidth (0.0 - 1.0)
  normalizedY?: number; // y / viewportHeight (0.0 - 1.0)
  viewportWidth?: number;
  viewportHeight?: number;
}

export interface ParticipantSession {
  sessionId: string;
  participantId?: string;
  participantNumber?: number; // ordem de entrada do cliente no teste (1, 2, 3...)
  testId: string;
  participantName: string;
  participantType: 'human' | 'synthetic';
  status: 'Concluído' | 'Abandonado' | 'Em andamento';
  startTime: string;
  endTime?: string;
  durationSeconds: number;
  tasksCompleted: number;
  totalTasks: number;
  successRate: number;
  clickCount: number;
  errorCount: number;
  returnCount: number;
  susScore?: number;
  events: TrackedEvent[];
  actualPaths: Record<string, string[]>; // taskId -> screens visited
}

export interface SusResponse {
  sessionId: string;
  testId: string;
  // 10 official SUS Likert answers (1 to 5)
  answers: [number, number, number, number, number, number, number, number, number, number];
  computedScore: number;
  submittedAt: string;
}

export interface SusResult {
  averageScore: number;
  classification: 'Excelente' | 'Bom' | 'Neutro' | 'Ruim' | 'Muito ruim';
  totalResponses: number;
  questionAverages: number[];
  scoreDistribution: { range: string; count: number }[];
  perceptionVsBehavior: {
    susScore: number;
    successRate: number;
    averageDuration: string;
    pathDeviationRate: number;
    discrepancyDetected: boolean;
    discrepancyMessage: string;
  };
}

export interface SyntheticPersona {
  personaId: string;
  personaName: string;
  personaProfile: string;
  behaviorProfile: string;
  status: 'Pronto' | 'Executando' | 'Concluído';
  result?: {
    successRate: number;
    durationSeconds: number;
    frictionObserved: string;
    susEstimated: number;
  };
  sessionId?: string;
}

export interface UXInsight {
  id: string;
  severity: 'critical' | 'friction' | 'attention' | 'positive';
  title: string;
  evidence: string[];
  hypothesis: string;
  recommendation: string;
  impact: string;
  affectedTask?: string;
}

export interface TaskMetricsDetail {
  taskId: string;
  title: string;
  participants: number;
  successRate: number;
  completionRate: number;
  averageTimeSeconds: number;
  medianTimeSeconds: number;
  totalClicks: number;
  errorClicks: number;
  returnsCount: number;
  abandonmentCount: number;
  idealPathRate: number;
  expectedPath: string[];
  mostUsedPath: string[];
  pathFrequencies: { path: string[]; count: number; percentage: number }[];
}

export interface FunnelStage {
  label: string;
  count: number;
  percentage: number;
  dropoffPercentage: number;
}

export interface ScreenSnapshot {
  snapshotId: string;
  testId: string;
  trackingId?: string;
  sessionId: string;
  participantId: string;
  participantName?: string;
  taskId?: string;
  screenId: string;
  screenName: string;
  image: string; // Real capture image data URL / URI
  imageUrl?: string;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  timestamp: string;
  source: 'participant-prototype' | 'figma-make-runtime' | 'REAL_RUNTIME_CAPTURE'; // Regra: Nunca 'mock' ou 'synthetic'
  captureSource?: 'REAL_RUNTIME_CAPTURE' | string;
  screenHash?: string;
  scrollX: number;
  scrollY: number;
  scrollPercentage?: number;
  documentHeight?: number;
}

export interface ScreenCaptureDiagnostics {
  prototypeUrl: string;
  currentScreen: string;
  screenshotStatus: 'captured' | 'failed' | 'capturing' | 'unsupported_environment';
  lastScreenshotId?: string;
  lastScreenshotTimestamp?: string;
  viewport: string;
  devicePixelRatio: number;
  scrollPosition: string;
  sessionId: string;
  participantId: string;
  failureReason?: string;
  accessibleUrl?: boolean;
  sdkConnected?: boolean;
  eventsReceived?: boolean;
}

export interface HeatmapPoint {
  id: string;
  screen: string;
  element: string;
  xPercent: number;
  yPercent: number;
  normalizedX?: number; // 0.0 - 1.0 relative to real screenshot
  normalizedY?: number; // 0.0 - 1.0 relative to real screenshot
  x?: number; // raw coordinate in px
  y?: number; // raw coordinate in px
  screenshotId?: string; // Pointer to ScreenSnapshot.snapshotId
  intensity: 'baixa' | 'media' | 'alta' | number;
  clickCount: number;
  isError: boolean;
  timestamp?: string;
  sessionId?: string;
  participantId?: string;
}

export interface ComponentClickZone {
  id: string;
  screen?: string;
  screenId?: string;
  componentName: string;
  componentSelector: string;
  bounds: {
    top?: number;
    left?: number;
    width: number;
    height: number;
    x?: number;
    y?: number;
  }; // percentages 0-100%
  clickCount?: number;
  clicks?: number;
  errorClickCount?: number;
  deadClickCount?: number; // clicks with no progression
  deadClickRate?: number;
  percentageOfTotal?: number;
  clickPercentage?: number;
  uniqueUsers?: number;
  avgTimeToFirstClickMs?: number;
  intendedTaskStep?: boolean;
  classification?: 'primary_action' | 'navigation' | 'content_card' | 'input_field' | 'dead_zone' | 'error_zone';
}

export interface ScreenHeatmapPointItem {
  x: number;
  y: number;
  intensity: number;
  element?: string;
}

export interface ScreenHeatmapData {
  screenId: string;
  screenName: string;
  totalClicks: number;
  rageClicks?: number;
  deadClicks?: number;
  snapshot?: ScreenSnapshot; // Primary real prototype screenshot
  snapshots?: ScreenSnapshot[]; // Multiple session screenshots for multi-user comparison
  points: (HeatmapPoint | ScreenHeatmapPointItem)[];
  zones?: ComponentClickZone[];
}

