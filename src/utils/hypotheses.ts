import { Hypothesis, HypothesisMetric } from '../types';

export interface MetricDef {
  key: HypothesisMetric;
  label: string;
  unit: '%' | 's' | 'pts' | '';
  op: '>=' | '<=';
  target: number;
  taskScoped: boolean; // pode ser medido por tarefa
  hint: string;
}

// Indicadores que uma hipótese pode usar para ser validada automaticamente
export const HYP_METRICS: MetricDef[] = [
  { key: 'task_success', label: 'Taxa de sucesso', unit: '%', op: '>=', target: 80, taskScoped: true, hint: 'tarefas concluídas ÷ iniciadas' },
  { key: 'completion', label: 'Taxa de conclusão da jornada', unit: '%', op: '>=', target: 80, taskScoped: false, hint: 'quem terminou todas as tarefas' },
  { key: 'avg_task_time', label: 'Tempo médio na tarefa', unit: 's', op: '<=', target: 60, taskScoped: true, hint: 'segundos por tarefa' },
  { key: 'sus', label: 'SUS médio', unit: 'pts', op: '>=', target: 68, taskScoped: false, hint: '68 é a média de mercado' },
  { key: 'nps', label: 'NPS', unit: 'pts', op: '>=', target: 30, taskScoped: false, hint: '% promotores − % detratores' },
  { key: 'help_rate', label: 'Pessoas que travaram', unit: '%', op: '<=', target: 20, taskScoped: true, hint: 'relataram dificuldade ou pediram ajuda à IA' },
  { key: 'dead_click_rate', label: 'Cliques sem efeito', unit: '%', op: '<=', target: 10, taskScoped: true, hint: '% dos cliques que não fizeram nada' },
  { key: 'return_rate', label: 'Taxa de retorno', unit: '%', op: '<=', target: 20, taskScoped: true, hint: 'voltaram a telas anteriores' },
  { key: 'abandon_rate', label: 'Taxa de abandono', unit: '%', op: '<=', target: 10, taskScoped: false, hint: 'desistiram no meio' },
  { key: 'deviation_rate', label: 'Desvio de caminho', unit: '%', op: '<=', target: 20, taskScoped: true, hint: 'saíram do caminho mapeado' },
  { key: 'none', label: 'Só pelas respostas (IA)', unit: '', op: '>=', target: 0, taskScoped: false, hint: 'a IA avalia pelas respostas dos participantes' }
];

export const metricDef = (k: HypothesisMetric) => HYP_METRICS.find((m) => m.key === k) || HYP_METRICS[0];

export const HYP_TEMPLATES: Omit<Hypothesis, 'id'>[] = [
  { statement: 'Os participantes conseguem concluir a tarefa principal sem ajuda.', metric: 'task_success', op: '>=', target: 80 },
  { statement: 'O fluxo é rápido: cada tarefa leva menos de 1 minuto.', metric: 'avg_task_time', op: '<=', target: 60 },
  { statement: 'A experiência é percebida como fácil de usar (SUS acima da média).', metric: 'sus', op: '>=', target: 68 },
  { statement: 'Os campos e rótulos são claros: poucas pessoas travam ou pedem ajuda.', metric: 'help_rate', op: '<=', target: 20 },
  { statement: 'As pessoas recomendariam esta experiência.', metric: 'nps', op: '>=', target: 30 }
];

export const fmtMetric = (v: number | null | undefined, unit: MetricDef['unit']) =>
  v === null || v === undefined ? '—' : unit === '%' ? `${Math.round(v)}%` : unit === 's' ? `${Math.round(v)}s` : unit === 'pts' ? `${Math.round(v * 10) / 10}` : String(v);

export type Verdict = 'confirmada' | 'parcial' | 'refutada' | 'inconclusiva';

/** Veredito pelo indicador: bateu a meta, ficou a até 10% dela, ou não bateu. Amostra < 3 é inconclusiva. */
export function metricVerdict(h: Hypothesis, value: number | null, base: number): Verdict {
  if (h.metric === 'none') return 'inconclusiva';
  if (value === null || base < 3) return 'inconclusiva';
  const met = h.op === '>=' ? value >= h.target : value <= h.target;
  if (met) return 'confirmada';
  const gap = Math.abs(value - h.target);
  const tol = Math.max(Math.abs(h.target) * 0.1, metricDef(h.metric).unit === '%' ? 5 : 3);
  return gap <= tol ? 'parcial' : 'refutada';
}

export const VERDICT_UI: Record<Verdict, { label: string; tone: string; dot: string }> = {
  confirmada: { label: 'Confirmada', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  parcial: { label: 'Parcialmente', tone: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-400' },
  refutada: { label: 'Refutada', tone: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  inconclusiva: { label: 'Inconclusiva', tone: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' }
};

export const newHypothesisId = () => `H-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
