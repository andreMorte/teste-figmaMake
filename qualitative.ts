// Análise qualitativa (IA) das respostas abertas, comentários de dificuldade e perguntas configuradas.
// Motor: Gemini (GEMINI_API_KEY, tem plano grátis) ou Claude (ANTHROPIC_API_KEY).
// Sem chave configurada, usa uma análise local por regras para nunca deixar a tela vazia.
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';

export type QualCategory = 'dor' | 'positivo' | 'sugestao' | 'neutro';

export interface QualItem {
  id: string;
  participantKey: string;
  participantName: string;
  participantNumber?: number;
  source: 'pergunta' | 'dificuldade' | 'desistencia' | 'comentario_sus';
  questionId?: string;
  question?: string;
  questionType?: string;
  taskTitle?: string;
  text: string;
  value?: number | string;
  at?: string;
}

export interface QualParticipantContext {
  participantKey: string;
  participantName: string;
  participantNumber?: number;
  tasksDone: number;
  tasksTotal: number;
  abandoned: number;
  difficulties: number;
  susScore?: number;
  status: string;
}

export interface QualAnalysis {
  summary: string;
  items: { id: string; category: QualCategory; theme: string; intensity: number; emotion: string; insight: string }[];
  themes: { name: string; kind: 'dor' | 'positivo' | 'sugestao'; description: string; itemIds: string[]; severity: 'alta' | 'media' | 'baixa' }[];
  behavior: {
    overallTone: string;
    patterns: { pattern: string; evidence: string; meaning: string }[];
    participants: { participantKey: string; profile: string; tone: string; engagement: 'alto' | 'medio' | 'baixo'; signals: string[]; saysVsDoes: string }[];
  };
  recommendations: { title: string; detail: string; priority: 'alta' | 'media' | 'baixa'; themes: string[] }[];
}

export interface QualResult {
  testId: string;
  hash: string;
  engine: 'gemini' | 'claude' | 'local';
  model?: string;
  createdAt: string;
  aiError?: string;
  itemsInput: QualItem[];
  participants: QualParticipantContext[];
  analysis: QualAnalysis;
}

const DEFAULT_DIFFICULTY = /^(Dificuldade reportada pelo participante|Participante não conseguiu concluir a tarefa)$/i;

// ---------------------------------------------------------------------------
// Coleta
// ---------------------------------------------------------------------------
export function collectQualitative(test: any, sessions: any[], events: any[], susResponses: any[]) {
  const keyOf = (s: any) => s.participantId || s.sessionId;
  const bySession = new Map<string, any>();
  sessions.forEach((s) => bySession.set(s.sessionId, s));
  const items: QualItem[] = [];
  const questions: any[] = test.customQuestions || [];
  const taskTitle = (taskId?: string) => (test.tasks || []).find((t: any) => t.id === taskId)?.title;
  const seen = new Set<string>();
  const push = (it: Omit<QualItem, 'id'>) => {
    const sig = `${it.participantKey}|${it.source}|${it.questionId || it.taskTitle || ''}|${it.text}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    items.push({ ...it, id: `Q${items.length + 1}` });
  };

  const ordered = [...events].sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));
  for (const e of ordered) {
    const s = bySession.get(e.sessionId);
    if (!s) continue;
    const who = { participantKey: keyOf(s), participantName: s.participantName || 'Participante', participantNumber: s.participantNumber, at: e.timestamp };
    const meta = e.metadata || {};
    if (e.eventType === 'CUSTOM_SURVEY_END' && meta.answers && typeof meta.answers === 'object') {
      for (const q of questions) {
        const v = meta.answers[q.id];
        if (v === undefined || v === null || String(v).trim() === '') continue;
        const text = q.type === 'likert_scale' ? `${v} de 5` : String(v).trim();
        push({ ...who, source: 'pergunta', questionId: q.id, question: q.question, questionType: q.type, text, value: q.type === 'likert_scale' ? Number(v) : String(v) });
      }
    }
    if ((e.eventType === 'TASK_ERROR' || e.eventType === 'TASK_ABANDON') && meta.comment && !DEFAULT_DIFFICULTY.test(String(meta.comment).trim())) {
      push({ ...who, source: e.eventType === 'TASK_ERROR' ? 'dificuldade' : 'desistencia', taskTitle: taskTitle(e.taskId), text: String(meta.comment).trim() });
    }
    if (e.eventType === 'SUS_COMPLETE' && meta.comment && String(meta.comment).trim()) {
      push({ ...who, source: 'comentario_sus', text: String(meta.comment).trim() });
    }
  }

  // Contexto comportamental (o que a pessoa fez), para cruzar com o que ela escreveu
  const people = new Map<string, QualParticipantContext>();
  for (const s of sessions) {
    const k = keyOf(s);
    const evs = events.filter((e) => e.sessionId === s.sessionId);
    const done = new Set(evs.filter((e) => e.eventType === 'TASK_SUCCESS').map((e) => e.taskId)).size;
    const ab = new Set(evs.filter((e) => e.eventType === 'TASK_ABANDON').map((e) => e.taskId)).size;
    const sus = susResponses.find((r) => r.sessionId === s.sessionId);
    const prev = people.get(k);
    const ctx: QualParticipantContext = {
      participantKey: k,
      participantName: s.participantName || 'Participante',
      participantNumber: s.participantNumber,
      tasksDone: (prev?.tasksDone || 0) + done,
      tasksTotal: (test.tasks || []).length,
      abandoned: (prev?.abandoned || 0) + ab,
      difficulties: (prev?.difficulties || 0) + evs.filter((e) => e.eventType === 'TASK_ERROR').length,
      susScore: typeof s.susScore === 'number' ? s.susScore : sus?.computedScore ?? prev?.susScore,
      status: s.status === 'Concluído' || prev?.status === 'Concluído' ? 'Concluiu' : s.status === 'Abandonado' ? 'Saiu antes de terminar' : 'Em andamento'
    };
    people.set(k, ctx);
  }
  return { items, participants: [...people.values()].sort((a, b) => (a.participantNumber || 999) - (b.participantNumber || 999)) };
}

export function hashInput(test: any, items: QualItem[]) {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify({ v: 2, goal: test.researchGoal, items: items.map((i) => [i.participantKey, i.source, i.questionId, i.text]) }))
    .digest('hex');
}

// ---------------------------------------------------------------------------
// IA
// ---------------------------------------------------------------------------
const SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          category: { type: 'string', enum: ['dor', 'positivo', 'sugestao', 'neutro'] },
          theme: { type: 'string' },
          intensity: { type: 'integer' },
          emotion: { type: 'string' },
          insight: { type: 'string' }
        },
        required: ['id', 'category', 'theme', 'intensity', 'emotion', 'insight']
      }
    },
    themes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          kind: { type: 'string', enum: ['dor', 'positivo', 'sugestao'] },
          description: { type: 'string' },
          itemIds: { type: 'array', items: { type: 'string' } },
          severity: { type: 'string', enum: ['alta', 'media', 'baixa'] }
        },
        required: ['name', 'kind', 'description', 'itemIds', 'severity']
      }
    },
    behavior: {
      type: 'object',
      properties: {
        overallTone: { type: 'string' },
        patterns: {
          type: 'array',
          items: {
            type: 'object',
            properties: { pattern: { type: 'string' }, evidence: { type: 'string' }, meaning: { type: 'string' } },
            required: ['pattern', 'evidence', 'meaning']
          }
        },
        participants: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              participantKey: { type: 'string' },
              profile: { type: 'string' },
              tone: { type: 'string' },
              engagement: { type: 'string', enum: ['alto', 'medio', 'baixo'] },
              signals: { type: 'array', items: { type: 'string' } },
              saysVsDoes: { type: 'string' }
            },
            required: ['participantKey', 'profile', 'tone', 'engagement', 'signals', 'saysVsDoes']
          }
        }
      },
      required: ['overallTone', 'patterns', 'participants']
    },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          priority: { type: 'string', enum: ['alta', 'media', 'baixa'] },
          themes: { type: 'array', items: { type: 'string' } }
        },
        required: ['title', 'detail', 'priority', 'themes']
      }
    }
  },
  required: ['summary', 'items', 'themes', 'behavior', 'recommendations']
};

function buildPrompt(test: any, items: QualItem[], participants: QualParticipantContext[]) {
  const data = {
    teste: { nome: test.name, objetivo: test.researchGoal, produto: test.productName, tarefas: (test.tasks || []).map((t: any) => t.title) },
    participantes: participants,
    respostas: items.map((i) => ({
      id: i.id,
      participante: i.participantKey,
      nome: i.participantName,
      origem: i.source,
      pergunta: i.question,
      tipo: i.questionType,
      tarefa: i.taskTitle,
      texto: i.text
    }))
  };
  return `Você é um(a) UX Researcher sênior analisando um teste de usabilidade. Escreva tudo em português do Brasil.

Dados (JSON):
${JSON.stringify(data)}

Origem das respostas: "pergunta" = pergunta configurada pelo pesquisador (likert de 1 a 5 vem como "N de 5"); "dificuldade" = participante clicou em "Tive dificuldade" durante a tarefa; "desistencia" = comentário ao desistir da tarefa; "comentario_sus" = comentário livre no final.

Faça:
1. items: classifique CADA resposta (use o mesmo id) em "dor" (fricção, confusão, crítica, nota baixa), "positivo" (algo que funcionou bem), "sugestao" (pedido ou ideia de melhoria) ou "neutro". Para likert: 1-2 = dor, 3 = neutro, 4-5 = positivo, considerando o sentido da pergunta. Dê um tema curto (2 a 4 palavras), intensidade de 1 a 5, a emoção predominante (ex.: frustração, confusão, insegurança, satisfação, confiança, alívio, indiferença) e um insight de uma frase.
2. themes: agrupe as respostas em temas, separando dores, pontos positivos e sugestões, com severidade e os ids das respostas.
3. behavior: análise comportamental da ESCRITA: tom geral; padrões de linguagem (ex.: frases curtas e secas, hesitação "acho/talvez", intensificadores, ironia, culpa em si mesmo vs no produto, vocabulário técnico), com evidência citada e o que isso indica. Para cada participante com respostas, um perfil, tom, engajamento e sinais, e "saysVsDoes": compare o que escreveu com o que fez (tarefas, desistências, SUS); aponte contradições.
4. recommendations: ações priorizadas e concretas para o produto.
5. summary: 2 a 4 frases com a conclusão principal.

Regras: use somente os dados fornecidos, não invente falas nem participantes; cite trechos curtos entre aspas como evidência; se houver poucas respostas, diga isso no resumo.

Responda SOMENTE com um JSON válido, sem texto antes ou depois, exatamente neste formato:
{"summary":"...","items":[{"id":"Q1","category":"dor|positivo|sugestao|neutro","theme":"...","intensity":1,"emotion":"...","insight":"..."}],"themes":[{"name":"...","kind":"dor|positivo|sugestao","description":"...","itemIds":["Q1"],"severity":"alta|media|baixa"}],"behavior":{"overallTone":"...","patterns":[{"pattern":"...","evidence":"...","meaning":"..."}],"participants":[{"participantKey":"<id do participante>","profile":"...","tone":"...","engagement":"alto|medio|baixo","signals":["..."],"saysVsDoes":"..."}]},"recommendations":[{"title":"...","detail":"...","priority":"alta|media|baixa","themes":["..."]}]}`;
}

const parseJson = (text: string) => {
  const t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  return JSON.parse(a >= 0 && b > a ? t.slice(a, b + 1) : t);
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const withTimeout = <T,>(p: Promise<T>, ms: number, label: string) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label}: tempo esgotado (${Math.round(ms / 1000)}s)`)), ms))]);

// Diagnóstico das últimas tentativas (sem segredos), exposto em GET /api/ai/status
export const aiStatus: { discovered: string[]; discoveredAt?: string; discoverError?: string; attempts: { at: string; model: string; ms: number; ok: boolean; error?: string }[] } = {
  discovered: [],
  attempts: []
};
const logAttempt = (a: { model: string; ms: number; ok: boolean; error?: string }) => {
  aiStatus.attempts.unshift({ at: new Date().toISOString(), ...a });
  aiStatus.attempts.length = Math.min(aiStatus.attempts.length, 30);
};

// Pergunta ao Google quais modelos esta chave pode usar e ordena os "Flash" do mais novo para o mais antigo.
let discoveredUntil = 0;
async function discoverModels(): Promise<string[]> {
  if (Date.now() < discoveredUntil) return aiStatus.discovered;
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! }
    });
    const body: any = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);
    const version = (n: string) => Number((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
    const names: string[] = (body.models || [])
      .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m: any) => String(m.name || '').replace(/^models\//, ''))
      .filter((n: string) => /^gemini-.*flash/.test(n) && !/image|tts|audio|live|embed|vision|thinking|exp|8b/i.test(n));
    const rank = (n: string) => {
      const stable = /^gemini-\d+(\.\d+)?-flash$/.test(n) ? 0 : /^gemini-\d+(\.\d+)?-flash-lite$/.test(n) ? 1 : /latest$/.test(n) ? 2 : 3;
      return stable * 100 - version(n);
    };
    aiStatus.discovered = [...new Set(names)].sort((a, b) => rank(a) - rank(b));
    aiStatus.discoverError = undefined;
    discoveredUntil = Date.now() + 6 * 3600 * 1000;
  } catch (err: any) {
    aiStatus.discoverError = String(err?.message || err).slice(0, 200);
    discoveredUntil = Date.now() + 10 * 60 * 1000;
  }
  aiStatus.discoveredAt = new Date().toISOString();
  return aiStatus.discovered;
}

// JSON simples (sem schema rígido, que deixava o Gemini lento a ponto de dar 504).
// Sobrecarga (503/429): tenta o mesmo modelo mais uma vez; lentidão, modelo desativado etc.: passa para o próximo.
async function runGemini(prompt: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const discovered = await discoverModels();
  const models = [...new Set([process.env.GEMINI_MODEL, ...discovered.slice(0, 3), 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'].filter(Boolean) as string[])].slice(0, 5);
  const deadline = Date.now() + 85000;
  let lastErr: any;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = deadline - Date.now();
      if (left < 5000) throw lastErr || new Error('IA sem resposta no tempo limite');
      const t0 = Date.now();
      try {
        const r = await withTimeout(
          ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.3,
              maxOutputTokens: 8192,
              // sem etapa de "pensamento" onde é possível desligar (2.5 Flash): responde bem mais rápido
              ...(/^gemini-2\.5-flash(-lite)?$/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {})
            } as any
          }),
          Math.min(35000, left),
          model
        );
        const json = parseJson(r.text || '');
        logAttempt({ model, ms: Date.now() - t0, ok: true });
        console.log(`[IA] ${model} respondeu em ${Date.now() - t0}ms`);
        return { model, json };
      } catch (err: any) {
        lastErr = err;
        const msg = String(err?.message || err);
        logAttempt({ model, ms: Date.now() - t0, ok: false, error: msg.slice(0, 220) });
        console.warn(`[IA] ${model} tentativa ${attempt + 1} (${Date.now() - t0}ms): ${msg.slice(0, 160)}`);
        if (/503|UNAVAILABLE|overload|high demand/i.test(msg) && attempt === 0) {
          await sleep(2000);
          continue; // mesmo modelo, mais uma vez
        }
        if (/JSON|Unexpected token|Unterminated/i.test(msg) && attempt === 0) continue; // resposta mal formada
        if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(msg)) throw err; // chave inválida: não adianta trocar
        break; // próximo modelo
      }
    }
  }
  throw lastErr;
}

async function runClaude(prompt: string) {
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      tools: [{ name: 'registrar_analise', description: 'Registra a análise qualitativa', input_schema: SCHEMA }],
      tool_choice: { type: 'tool', name: 'registrar_analise' },
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const body: any = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);
  const tool = (body.content || []).find((c: any) => c.type === 'tool_use');
  if (!tool) throw new Error('Resposta sem análise');
  return { model, json: tool.input };
}

export function aiEngine(): 'gemini' | 'claude' | null {
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.ANTHROPIC_API_KEY) return 'claude';
  return null;
}

function normalize(a: any, items: QualItem[], fallback: QualAnalysis): QualAnalysis {
  const ids = new Set(items.map((i) => i.id));
  const cats: QualCategory[] = ['dor', 'positivo', 'sugestao', 'neutro'];
  const got = new Map<string, any>();
  (a?.items || []).forEach((it: any) => ids.has(it?.id) && got.set(it.id, it));
  return {
    summary: String(a?.summary || fallback.summary),
    items: items.map((i) => {
      const it = got.get(i.id) || fallback.items.find((f) => f.id === i.id)!;
      return {
        id: i.id,
        category: cats.includes(it.category) ? it.category : 'neutro',
        theme: String(it.theme || 'Geral'),
        intensity: Math.min(5, Math.max(1, Math.round(Number(it.intensity) || 3))),
        emotion: String(it.emotion || 'indiferença'),
        insight: String(it.insight || '')
      };
    }),
    themes: (Array.isArray(a?.themes) ? a.themes : [])
      .filter((t: any) => t && ['dor', 'positivo', 'sugestao'].includes(t.kind))
      .map((t: any) => ({
        name: String(t.name || 'Tema'),
        kind: t.kind,
        description: String(t.description || ''),
        itemIds: (Array.isArray(t.itemIds) ? t.itemIds : []).filter((x: string) => ids.has(x)),
        severity: ['alta', 'media', 'baixa'].includes(t.severity) ? t.severity : 'media'
      })),
    behavior: {
      overallTone: String(a?.behavior?.overallTone || fallback.behavior.overallTone),
      patterns: Array.isArray(a?.behavior?.patterns) ? a.behavior.patterns : [],
      participants: (Array.isArray(a?.behavior?.participants) ? a.behavior.participants : fallback.behavior.participants).map((p: any) => ({
        ...p,
        signals: Array.isArray(p.signals) ? p.signals : [],
        engagement: ['alto', 'medio', 'baixo'].includes(p.engagement) ? p.engagement : 'medio'
      }))
    },
    recommendations: (Array.isArray(a?.recommendations) ? a.recommendations : []).map((r: any) => ({
      title: String(r.title || ''),
      detail: String(r.detail || ''),
      priority: ['alta', 'media', 'baixa'].includes(r.priority) ? r.priority : 'media',
      themes: Array.isArray(r.themes) ? r.themes : []
    }))
  };
}

export async function analyzeQualitative(test: any, items: QualItem[], participants: QualParticipantContext[]): Promise<Omit<QualResult, 'testId' | 'hash' | 'createdAt' | 'itemsInput' | 'participants'>> {
  const local = localAnalysis(items, participants);
  const engine = aiEngine();
  if (!engine || items.length === 0) return { engine: 'local', analysis: local };
  try {
    const prompt = buildPrompt(test, items, participants);
    const { model, json } = engine === 'gemini' ? await runGemini(prompt) : await runClaude(prompt);
    return { engine, model, analysis: normalize(json, items, local) };
  } catch (err: any) {
    console.error('[IA] Falha na análise qualitativa:', err?.message || err);
    return { engine: 'local', aiError: String(err?.message || err).slice(0, 300), analysis: local };
  }
}

// ---------------------------------------------------------------------------
// Análise local (sem IA): regras simples em português
// ---------------------------------------------------------------------------
const NEG = ['difícil', 'dificil', 'confus', 'não consegui', 'nao consegui', 'demor', 'trav', 'perdid', 'ruim', 'erro', 'complicad', 'não entendi', 'nao entendi', 'chato', 'lent', 'frustr', 'problema', 'dúvida', 'duvida', 'não achei', 'não encontrei', 'nao achei', 'nao encontrei', 'faltou', 'pouco claro', 'escondid', 'estranho', 'péssim', 'horrível', 'irritante', 'cansativ'];
const POS = ['amei', 'adorei', 'top', 'perfeit', 'show', 'incrível', 'incrivel', 'curti', 'maravilh', 'fácil', 'facil', 'simples', 'rápid', 'rapid', 'intuitiv', 'clar', 'gostei', 'ótim', 'otim', 'bom', 'boa', 'legal', 'prátic', 'pratic', 'bonit', 'tranquil', 'excelente', 'agradável', 'organizad', 'direto', 'fluid'];
const SUG = ['poderia', 'deveria', 'seria bom', 'seria legal', 'sugiro', 'sugestão', 'sugestao', 'gostaria', 'precisa ter', 'falta um', 'falta uma', 'se tivesse'];
const HEDGE = ['acho', 'talvez', 'parece', 'meio', 'um pouco', 'não sei', 'nao sei', 'acredito'];
const INTENS = ['muito', 'super', 'bem ', 'demais', 'extremamente', 'totalmente', 'nada'];

function classifyText(i: QualItem): { category: QualCategory; intensity: number; emotion: string } {
  if (i.questionType === 'likert_scale' && typeof i.value === 'number') {
    const v = i.value;
    return v <= 2 ? { category: 'dor', intensity: v === 1 ? 5 : 4, emotion: 'frustração' } : v >= 4 ? { category: 'positivo', intensity: v === 5 ? 5 : 3, emotion: 'satisfação' } : { category: 'neutro', intensity: 2, emotion: 'indiferença' };
  }
  const t = ` ${i.text.toLowerCase()} `;
  const negated = (w: string) => new RegExp(`n[ãa]o\\s+(foi\\s+|é\\s+|e\\s+|muito\\s+|tão\\s+)?${w}`).test(t);
  let neg = NEG.filter((w) => t.includes(w)).length + POS.filter((w) => t.includes(w) && negated(w)).length;
  const pos = POS.filter((w) => new RegExp(`\\b${w}`).test(t) && !negated(w)).length;
  const sug = SUG.some((w) => t.includes(w));
  if (i.source === 'dificuldade' || i.source === 'desistencia') neg += 1;
  const intensity = Math.min(5, 2 + INTENS.filter((w) => t.includes(w)).length + (/[!]{1,}/.test(t) ? 1 : 0));
  if (sug && neg <= pos) return { category: 'sugestao', intensity, emotion: 'expectativa' };
  if (neg > pos) return { category: 'dor', intensity, emotion: /confus|entendi|perdid|dúvida|duvida/.test(t) ? 'confusão' : 'frustração' };
  if (pos > 0) return { category: 'positivo', intensity, emotion: 'satisfação' };
  return { category: sug ? 'sugestao' : 'neutro', intensity: 2, emotion: 'indiferença' };
}

function localAnalysis(items: QualItem[], participants: QualParticipantContext[]): QualAnalysis {
  const cls = items.map((i) => {
    const c = classifyText(i);
    const theme = i.taskTitle ? `Tarefa: ${i.taskTitle}` : i.question ? i.question.slice(0, 40) : 'Comentário final';
    return { id: i.id, ...c, theme, insight: '' };
  });
  const byTheme = new Map<string, { kind: QualCategory; ids: string[] }>();
  cls.forEach((c) => {
    if (c.category === 'neutro') return;
    const k = `${c.category}|${c.theme}`;
    if (!byTheme.has(k)) byTheme.set(k, { kind: c.category, ids: [] });
    byTheme.get(k)!.ids.push(c.id);
  });
  const dores = cls.filter((c) => c.category === 'dor').length;
  const bons = cls.filter((c) => c.category === 'positivo').length;
  const textItems = items.filter((i) => i.questionType !== 'likert_scale');
  return {
    summary: items.length
      ? `${items.length} resposta(s) analisada(s) por regras locais: ${dores} dor(es), ${bons} ponto(s) positivo(s). Com a IA ativa, a análise traz temas, leitura comportamental e recomendações.`
      : 'Ainda não há respostas qualitativas neste teste.',
    items: cls,
    themes: [...byTheme.entries()].map(([k, v]) => ({
      name: k.split('|')[1],
      kind: v.kind as any,
      description: `${v.ids.length} menção(ões)`,
      itemIds: v.ids,
      severity: v.kind === 'dor' && v.ids.length > 1 ? 'alta' : 'media'
    })),
    behavior: {
      overallTone: dores > bons ? 'Predominantemente crítico' : bons > dores ? 'Predominantemente positivo' : 'Equilibrado',
      patterns: [],
      participants: participants
        .filter((p) => items.some((i) => i.participantKey === p.participantKey))
        .map((p) => {
          const mine = textItems.filter((i) => i.participantKey === p.participantKey);
          const words = mine.reduce((a, i) => a + i.text.split(/\s+/).length, 0);
          const hedges = mine.filter((i) => HEDGE.some((h) => i.text.toLowerCase().includes(h))).length;
          const signals = [
            `${words} palavra(s) escrita(s)`,
            hedges ? `${hedges} resposta(s) com hesitação` : '',
            mine.some((i) => /!/.test(i.text)) ? 'usa exclamações' : ''
          ].filter(Boolean);
          return {
            participantKey: p.participantKey,
            profile: words > 40 ? 'Detalhista' : words > 10 ? 'Objetivo' : 'Respostas curtas',
            tone: '—',
            engagement: words > 40 ? 'alto' : words > 10 ? 'medio' : 'baixo',
            signals,
            saysVsDoes: `${p.tasksDone}/${p.tasksTotal} tarefa(s) concluída(s)${typeof p.susScore === 'number' ? `, SUS ${p.susScore}` : ''}.`
          } as any;
        })
    },
    recommendations: []
  };
}
