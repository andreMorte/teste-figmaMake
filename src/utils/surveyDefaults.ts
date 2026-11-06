import { OFFICIAL_SUS_QUESTIONS } from '../data/mockData';
import { NpsConfig, UsabilityTest } from '../types';

// Afirmações oficiais do SUS sem o número na frente (o número é mostrado à parte)
export const DEFAULT_SUS_QUESTIONS = OFFICIAL_SUS_QUESTIONS.map((q) => q.replace(/^\d+\.\s*/, ''));

export const npsDefaultQuestion = (max: number) => `De 0 a ${max}, o quanto você recomendaria esta experiência a um amigo ou colega?`;

export const DEFAULT_NPS: NpsConfig = {
  question: npsDefaultQuestion(10),
  scaleMax: 10,
  minLabel: 'Nada provável',
  maxLabel: 'Muito provável'
};

export const npsOf = (test?: Partial<UsabilityTest> | null): NpsConfig => ({ ...DEFAULT_NPS, ...(test?.npsConfig || {}) });

export const susQuestionsOf = (test?: Partial<UsabilityTest> | null): string[] =>
  test?.susQuestions && test.susQuestions.length === 10
    ? test.susQuestions.map((q, i) => (q && q.trim() ? q : DEFAULT_SUS_QUESTIONS[i]))
    : DEFAULT_SUS_QUESTIONS;

// Classificação NPS. Na escala 0–10 é a oficial (0–6 detrator, 7–8 neutro, 9–10 promotor);
// na 0–5 a nota é convertida proporcionalmente (0–3 detrator, 4 neutro, 5 promotor).
export type NpsCategory = 'promotor' | 'neutro' | 'detrator';
export const npsCategory = (value: number, max: number): NpsCategory => {
  const n = (value / (max || 10)) * 10;
  return n >= 9 ? 'promotor' : n >= 7 ? 'neutro' : 'detrator';
};
export const NPS_LABEL: Record<NpsCategory, string> = { promotor: 'Promotor', neutro: 'Neutro', detrator: 'Detrator' };
