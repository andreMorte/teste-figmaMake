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
  capturedAt: string;
}

export interface VisualAnalysis {
  id: string;
  name: string;
  prototypeUrl: string;
  device: VisualDevice;
  goal?: string;
  audience?: string;
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
