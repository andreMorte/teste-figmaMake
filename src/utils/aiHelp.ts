import { ParticipantSession, UsabilityTest } from '../types';

// Cada pedido de "Ajuda da IA" e o que aconteceu depois dele.
export type AiHelpOutcome = 'avancou' | 'concluiu' | 'pediu_de_novo' | 'travou';

export interface AiHelpRecord {
  participantKey: string;
  participantName: string;
  participantNumber?: number;
  taskId?: string;
  taskTitle?: string;
  screenId: string;
  screenName: string;
  question: string;
  answer: string;
  engine?: string;
  at: string;
  outcome: AiHelpOutcome;
  resolved: boolean;
  secondsToProgress?: number;
  nextScreenName?: string;
}

export const OUTCOME_LABEL: Record<AiHelpOutcome, string> = {
  avancou: 'Avançou depois da ajuda',
  concluiu: 'Concluiu a tarefa depois da ajuda',
  pediu_de_novo: 'Pediu ajuda de novo na mesma tela',
  travou: 'Não avançou depois da ajuda'
};

const LIMIT_MS = 3 * 60 * 1000; // avanço em até 3 min conta como ajuda que resolveu

/**
 * Lê os eventos AI_HELP e classifica cada um olhando o que veio depois na mesma sessão:
 * - concluiu: a tarefa terminou (TASK_SUCCESS) antes de outro pedido;
 * - avancou: foi para outra tela (SCREEN_VIEW) antes de outro pedido;
 * - pediu_de_novo: pediu ajuda outra vez ainda na mesma tela;
 * - travou: nada disso em até 3 minutos (ou desistiu).
 */
export function collectAiHelps(test: UsabilityTest, sessions: ParticipantSession[]): AiHelpRecord[] {
  const nameOf = (id: string, fallback?: string) => (test.screenMap || []).find((m) => m.screenId === id)?.screenName || fallback || id;
  const taskTitle = (id?: string) => test.tasks.find((t) => t.id === id)?.title;
  const out: AiHelpRecord[] = [];
  for (const s of sessions) {
    const evs = [...(s.events || [])].sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
    evs.forEach((e, i) => {
      if ((e.eventType as string) !== 'AI_HELP') return;
      const meta: any = e.metadata || {};
      const screenId = e.currentScreen || e.screen || '';
      const t0 = new Date(e.timestamp).getTime();
      let outcome: AiHelpOutcome = 'travou';
      let seconds: number | undefined;
      let nextScreen: string | undefined;
      for (let j = i + 1; j < evs.length; j++) {
        const n = evs[j];
        const dt = new Date(n.timestamp).getTime() - t0;
        if (dt > LIMIT_MS) break;
        if ((n.eventType as string) === 'AI_HELP' && (n.currentScreen || n.screen) === screenId) {
          outcome = 'pediu_de_novo';
          break;
        }
        if (n.eventType === 'TASK_SUCCESS' && n.taskId === e.taskId) {
          outcome = 'concluiu';
          seconds = Math.round(dt / 1000);
          break;
        }
        if (n.eventType === 'SCREEN_VIEW' && n.currentScreen && n.currentScreen !== screenId) {
          outcome = 'avancou';
          seconds = Math.round(dt / 1000);
          nextScreen = nameOf(n.currentScreen, (n.metadata as any)?.screenName);
          break;
        }
        if (n.eventType === 'TASK_ABANDON') break;
      }
      out.push({
        participantKey: s.participantId || s.sessionId,
        participantName: s.participantName,
        participantNumber: s.participantNumber,
        taskId: e.taskId,
        taskTitle: taskTitle(e.taskId),
        screenId,
        screenName: nameOf(screenId, meta.screenName),
        question: String(meta.question || ''),
        answer: String(meta.answer || ''),
        engine: meta.engine,
        at: e.timestamp,
        outcome,
        resolved: outcome === 'avancou' || outcome === 'concluiu',
        secondsToProgress: seconds,
        nextScreenName: nextScreen
      });
    });
  }
  return out;
}

export interface AiHelpSummary {
  total: number;
  people: number;
  participants: number;
  resolved: number;
  resolutionRate: number; // 0-100
  avgSecondsToProgress?: number;
  autonomousSuccess: number; // tarefas concluídas sem pedir ajuda
  assistedSuccess: number; // tarefas concluídas depois de pedir ajuda
  byScreen: {
    screenId: string;
    screenName: string;
    helps: number;
    people: number;
    resolved: number;
    questions: string[];
  }[];
}

export function summarizeAiHelps(test: UsabilityTest, sessions: ParticipantSession[], helps: AiHelpRecord[]): AiHelpSummary {
  const resolved = helps.filter((h) => h.resolved);
  const times = resolved.map((h) => h.secondsToProgress || 0).filter((x) => x > 0);
  const map = new Map<string, AiHelpSummary['byScreen'][number] & { _people: Set<string> }>();
  helps.forEach((h) => {
    if (!map.has(h.screenId)) map.set(h.screenId, { screenId: h.screenId, screenName: h.screenName, helps: 0, people: 0, resolved: 0, questions: [], _people: new Set() });
    const r = map.get(h.screenId)!;
    r.helps += 1;
    r._people.add(h.participantKey);
    if (h.resolved) r.resolved += 1;
    if (h.question && r.questions.length < 4 && !r.questions.includes(h.question)) r.questions.push(h.question);
  });
  // sucesso autônomo x assistido, por tarefa concluída
  let autonomous = 0;
  let assisted = 0;
  sessions.forEach((s) => {
    const done = new Set((s.events || []).filter((e) => e.eventType === 'TASK_SUCCESS').map((e) => e.taskId));
    done.forEach((tid) => {
      const asked = (s.events || []).some((e) => (e.eventType as string) === 'AI_HELP' && e.taskId === tid);
      if (asked) assisted += 1;
      else autonomous += 1;
    });
  });
  const keys = new Set(sessions.map((s) => s.participantId || s.sessionId));
  return {
    total: helps.length,
    people: new Set(helps.map((h) => h.participantKey)).size,
    participants: keys.size,
    resolved: resolved.length,
    resolutionRate: helps.length ? Math.round((resolved.length / helps.length) * 100) : 0,
    avgSecondsToProgress: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : undefined,
    autonomousSuccess: autonomous,
    assistedSuccess: assisted,
    byScreen: [...map.values()]
      .map(({ _people, ...r }) => ({ ...r, people: _people.size }))
      .sort((a, b) => b.helps - a.helps)
  };
}
