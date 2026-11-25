// Raio-X da interface: tipos compartilhados

export type VisualDevice = 'desktop' | 'mobile';

/** Elemento medido na tela (coordenadas do documento, em px CSS). */
export interface VisualElement {
  k: 'texto' | 'acao' | 'campo' | 'imagem' | 'icone';
  x: number;
  y: number;
  w: number;
  h: number;
  t: string;
  tag?: string;
  fs?: number; // tamanho da fonte
  fw?: number; // peso
  fg?: string;
  bg?: string;
  bgImage?: boolean;
  cr?: number; // contraste WCAG
  hd?: number; // h1..h3
  filled?: boolean;
  fillContrast?: number | null;
  sat?: number;
  disabled?: boolean;
  dl?: 0 | 1; // dentro do diálogo aberto
  br?: number; // raio da borda (ações e campos)
}

/** Área de interesse em coordenadas da IMAGEM capturada. */
export interface VisualAoi {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  auto?: boolean;
  share?: number; // fração da atenção estimada (0..1)
  lift?: number; // atenção ÷ tamanho: >1 chama mais atenção do que o espaço que ocupa
  firstFold?: boolean;
}

export interface VisualMetrics {
  clarity: number; // 0..100 (alto = fácil de entender)
  focus: number; // 0..100 (alto = atenção concentrada)
  contrastPass: number | null; // % dos textos que passam no WCAG AA
  contrastFails: number;
  elementsAboveFold: number;
  textChars: number;
  actions: number;
  fields: number;
  version: number;
}

export interface ExpertProblem {
  titulo: string;
  descricao: string;
  evidencia: string;
  principios: string[];
  severidade: number; // 0..4
  recomendacao: string;
  area: string;
}

export interface ExpertResult {
  resumo: string;
  proposito_percebido: string;
  nota: number;
  primeira_impressao: { visceral: string; comportamental: string; reflexivo: string };
  hierarquia: { ordem_ideal: string[]; ordem_percebida: string[]; comentario: string };
  funciona_bem: string[];
  problemas: ExpertProblem[];
  heuristicas_nielsen: { n: number; nome: string; nota: number; comentario: string }[];
  ergonomia: { criterio: string; nota: number; comentario: string }[];
  cognitivo: { carga: 'baixa' | 'média' | 'alta'; comentario: string; leis: { lei: string; observacao: string }[] };
  ui: { tipografia: string; cor: string; espacamento: string; consistencia: string };
  acessibilidade: string;
  arquitetura: string;
  estrategia: string;
  model?: string;
  createdAt?: string;
}

export interface VisualScreen {
  id: string;
  name: string;
  url?: string;
  image: string; // data URL
  thumb?: string;
  imageWidth: number;
  imageHeight: number;
  docWidth: number;
  docHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  context?: any;
  elements: VisualElement[];
  dialog?: { x: number; y: number; w: number; h: number } | null;
  aois: VisualAoi[];
  metrics?: VisualMetrics;
  expert?: ExpertResult;
  chat?: ChatMsg[];
  sceneId?: string; // id da cena no protótipo (casa com os testes de usabilidade)
  capturedAt: string;
}

export type ChatBlock =
  | { tipo: 'texto'; texto: string; base: string[] }
  | { tipo: 'alternativa'; titulo: string; texto: string; base: string[] }
  | { tipo: 'texto_sugerido'; de: string; para: string; motivo?: string; base: string[] }
  | { tipo: 'melhoria'; prioridade: number; titulo: string; texto: string; evidencia: 'raiox' | 'teste' | 'ambos'; base: string[] };

export interface ChatMsg {
  role: 'user' | 'agent';
  text?: string;
  focus?: { ref?: string; label?: string } | null;
  blocks?: ChatBlock[];
  refs?: { id: string; label: string; kind: string; box: { x: number; y: number; w: number; h: number } }[];
  proximas?: string[];
  opening?: boolean;
  proposal?: boolean;
  linked?: boolean;
  at: string;
}

export interface LinkableTest {
  id: string;
  name: string;
  createdAt?: string;
  status?: string;
  participants: number;
  tasks: number;
  prototypeUrl?: string;
  sameProto: boolean;
}

export interface ScreenEvidence {
  linked: boolean;
  summary: { testId: string; name: string; participants: number; matched: boolean; clicks: number; dead: number; visitors: number; tasks: { title: string; ok: number; abandoned: number; total: number }[] }[];
  clicks: { x: number; y: number; dead: boolean }[];
}

export interface VisualAnalysis {
  id: string;
  name: string;
  prototypeUrl: string;
  device: VisualDevice;
  goal?: string;
  audience?: string;
  linkedTests?: string[];
  createdAt?: string;
  updatedAt?: string;
  screens: VisualScreen[];
}

export interface VisualMeta {
  id: string;
  name: string;
  prototypeUrl: string;
  device: VisualDevice;
  goal?: string;
  createdAt?: string;
  updatedAt?: string;
  screens: number;
  analyzed: number;
  thumb?: string | null;
  clarity: number | null;
  focus: number | null;
  expertScore: number | null;
}

export const DEVICE_SIZE: Record<VisualDevice, { w: number; h: number; label: string }> = {
  desktop: { w: 1440, h: 900, label: 'Desktop 1440×900' },
  mobile: { w: 390, h: 844, label: 'Celular 390×844' }
};
