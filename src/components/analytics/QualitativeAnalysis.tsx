import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Sparkles,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Lightbulb,
  MessageSquareQuote,
  Brain,
  Users,
  Target,
  AlertTriangle,
  Cpu,
  Quote,
  ChevronRight,
  Filter
} from 'lucide-react';

type Category = 'dor' | 'positivo' | 'sugestao' | 'neutro';

interface QualItem {
  id: string;
  participantKey: string;
  participantName: string;
  participantNumber?: number;
  source: 'pergunta' | 'dificuldade' | 'desistencia' | 'comentario_sus' | 'ajuda_ia';
  questionId?: string;
  question?: string;
  questionType?: string;
  taskTitle?: string;
  text: string;
}

interface Ctx {
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

interface Result {
  engine: 'gemini' | 'claude' | 'local';
  model?: string;
  createdAt: string;
  aiError?: string;
  aiConfigured: boolean;
  itemsInput: QualItem[];
  participants: Ctx[];
  analysis: {
    summary: string;
    items: { id: string; category: Category; theme: string; intensity: number; emotion: string; insight: string }[];
    themes: { name: string; kind: 'dor' | 'positivo' | 'sugestao'; description: string; itemIds: string[]; severity: 'alta' | 'media' | 'baixa' }[];
    behavior: {
      overallTone: string;
      patterns: { pattern: string; evidence: string; meaning: string }[];
      participants: { participantKey: string; profile: string; tone: string; engagement: 'alto' | 'medio' | 'baixo'; signals: string[]; saysVsDoes: string }[];
    };
    recommendations: { title: string; detail: string; priority: 'alta' | 'media' | 'baixa'; themes: string[] }[];
  };
}

interface Props {
  testId: string;
  testName?: string;
  onBack: () => void;
  onOpenParticipant?: (key: string) => void;
}

const SOURCE_LABEL: Record<QualItem['source'], string> = {
  pergunta: 'Pergunta do teste',
  dificuldade: '"Tive dificuldade"',
  desistencia: 'Ao desistir',
  comentario_sus: 'Comentário final',
  ajuda_ia: 'Pediu ajuda à IA'
};

const CAT = {
  dor: { label: 'Dores', one: 'Dor', icon: ThumbsDown, text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', bar: 'bg-rose-500', dot: 'bg-rose-500' },
  positivo: { label: 'O que funcionou', one: 'Positivo', icon: ThumbsUp, text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  sugestao: { label: 'Sugestões', one: 'Sugestão', icon: Lightbulb, text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', bar: 'bg-amber-400', dot: 'bg-amber-400' },
  neutro: { label: 'Neutras', one: 'Neutro', icon: MessageSquareQuote, text: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', bar: 'bg-slate-300', dot: 'bg-slate-300' }
} as const;

const SEV = { alta: 'bg-rose-600 text-white', media: 'bg-amber-100 text-amber-800', baixa: 'bg-slate-100 text-slate-600' };

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'agora mesmo';
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const Avatar: React.FC<{ n?: number; name: string; tone?: string }> = ({ n, name, tone = 'bg-slate-900 text-white' }) => (
  <span className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${tone}`} title={name}>
    {n ? `#${String(n).padStart(2, '0')}` : name.slice(0, 2).toUpperCase()}
  </span>
);

const Intensity: React.FC<{ v: number; color: string }> = ({ v, color }) => (
  <span className="inline-flex gap-0.5" title={`Intensidade ${v} de 5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <span key={i} className={`w-1.5 h-3 rounded-sm ${i <= v ? color : 'bg-slate-200'}`} />
    ))}
  </span>
);

export const QualitativeAnalysis: React.FC<Props> = ({ testId, testName, onBack, onOpenParticipant }) => {
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Category | 'todas'>('todas');

  const load = (refresh = false) => {
    setLoading(true);
    setError('');
    fetch(`/api/tests/${encodeURIComponent(testId)}/qualitative${refresh ? '?refresh=1' : ''}`)
      .then((r) => (r.ok ? r.json() : r.json().then((b) => Promise.reject(new Error(b?.error || `HTTP ${r.status}`)))))
      .then((d) => setData(d))
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  const view = useMemo(() => {
    if (!data) return null;
    const cls = new Map(data.analysis.items.map((i) => [i.id, i]));
    const items = data.itemsInput.map((i) => ({ ...i, c: cls.get(i.id) || { id: i.id, category: 'neutro' as Category, theme: 'Geral', intensity: 2, emotion: '—', insight: '' } }));
    const byId = new Map(items.map((i) => [i.id, i]));
    const count = (c: Category) => items.filter((i) => i.c.category === c).length;
    const counts = { dor: count('dor'), positivo: count('positivo'), sugestao: count('sugestao'), neutro: count('neutro') };
    // temas por categoria; respostas sem tema viram um grupo "Outras menções"
    const groups = (kind: 'dor' | 'positivo' | 'sugestao') => {
      const themes = data.analysis.themes
        .filter((t) => t.kind === kind)
        .map((t) => ({ ...t, items: t.itemIds.map((id) => byId.get(id)!).filter((i) => i && i.c.category === kind) }))
        .filter((t) => t.items.length > 0);
      const used = new Set(themes.flatMap((t) => t.items.map((i) => i.id)));
      const rest = items.filter((i) => i.c.category === kind && !used.has(i.id));
      if (rest.length) themes.push({ name: 'Outras menções', kind, description: '', itemIds: rest.map((r) => r.id), severity: 'baixa', items: rest });
      const sevRank = { alta: 0, media: 1, baixa: 2 };
      return themes.sort((a, b) => sevRank[a.severity] - sevRank[b.severity] || b.items.length - a.items.length);
    };
    const emotions = new Map<string, number>();
    items.forEach((i) => i.c.emotion && i.c.emotion !== '—' && emotions.set(i.c.emotion, (emotions.get(i.c.emotion) || 0) + 1));
    const writers = new Set(items.map((i) => i.participantKey)).size;
    const questions = new Map<string, { title: string; items: typeof items }>();
    items.forEach((i) => {
      const k = i.questionId || i.source + (i.taskTitle || '');
      const title = i.question || (i.taskTitle ? `${SOURCE_LABEL[i.source]} — ${i.taskTitle}` : SOURCE_LABEL[i.source]);
      if (!questions.has(k)) questions.set(k, { title, items: [] });
      questions.get(k)!.items.push(i);
    });
    return {
      items,
      counts,
      writers,
      dores: groups('dor'),
      bons: groups('positivo'),
      sugs: groups('sugestao'),
      emotions: [...emotions.entries()].sort((a, b) => b[1] - a[1]),
      questions: [...questions.values()]
    };
  }, [data]);

  // ------------------------------------------------------------------
  if (loading && !data) {
    return (
      <div className="space-y-6">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Voltar ao teste
        </button>
        <div className="rounded-3xl p-10 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-64 h-64 rounded-full bg-white/10 blur-2xl animate-pulse" />
          <div className="relative flex items-center gap-4">
            <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
              <Brain className="w-6 h-6 animate-pulse" />
            </span>
            <div>
              <div className="text-xl font-semibold">A IA está lendo as respostas…</div>
              <div className="text-sm text-white/80 mt-1">Separando dores e pontos positivos e analisando a forma de escrever de cada pessoa. Leva alguns segundos.</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-56 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="text-sm text-rose-600">Não foi possível carregar a análise: {error}</div>
        <button type="button" onClick={() => load()} className="text-sm text-blue-600 font-medium hover:underline">Tentar de novo</button>
      </div>
    );
  }
  if (!data || !view) return null;

  const total = view.items.length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const engineLabel =
    data.engine === 'gemini' ? `Analisado por IA · ${data.model || 'Gemini'}` : data.engine === 'claude' ? `Analisado por IA · ${data.model || 'Claude'}` : 'Análise local por regras';
  const ctxOf = (k: string) => data.participants.find((p) => p.participantKey === k);
  const filtered = filter === 'todas' ? view.items : view.items.filter((i) => i.c.category === filter);

  const ItemQuote: React.FC<{ it: (typeof view.items)[number]; compact?: boolean; hideSource?: boolean }> = ({ it, compact, hideSource }) => {
    const cat = CAT[it.c.category];
    return (
      <div className="group rounded-xl bg-white border border-slate-200/80 p-3 hover:border-slate-300 hover:shadow-sm transition">
        <div className="flex items-start gap-2.5">
          <button type="button" onClick={() => onOpenParticipant?.(it.participantKey)} title={`Abrir ${it.participantName}`}>
            <Avatar n={it.participantNumber} name={it.participantName} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-slate-800 leading-snug break-words">“{it.text}”</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
              <span className="font-medium text-slate-700">{it.participantName}</span>
              {!hideSource && <span>·</span>}
              {!hideSource && <span>{it.taskTitle ? `${SOURCE_LABEL[it.source]} em ${it.taskTitle}` : it.question ? it.question : SOURCE_LABEL[it.source]}</span>}
              {!compact && it.c.emotion && it.c.emotion !== '—' && <span className={`px-1.5 py-0.5 rounded-md ${cat.bg} ${cat.text} font-medium`}>{it.c.emotion}</span>}
              <Intensity v={it.c.intensity} color={cat.bar} />
            </div>
            {it.c.insight && <div className="mt-1.5 text-[11px] text-slate-500 italic">{it.c.insight}</div>}
          </div>
        </div>
      </div>
    );
  };

  const Column: React.FC<{ kind: 'dor' | 'positivo' | 'sugestao'; groups: typeof view.dores }> = ({ kind, groups }) => {
    const cat = CAT[kind];
    const Icon = cat.icon;
    return (
      <section className={`rounded-2xl border ${cat.border} ${cat.bg} p-4 flex flex-col gap-3 min-w-0`}>
        <header className="flex items-center justify-between">
          <div className={`flex items-center gap-2 font-semibold ${cat.text}`}>
            <span className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-xs">
              <Icon className="w-4 h-4" />
            </span>
            {cat.label}
          </div>
          <span className={`text-xs font-bold ${cat.text}`}>{view.counts[kind]} menção(ões)</span>
        </header>
        {groups.length === 0 && <div className="text-sm text-slate-500 bg-white/70 rounded-xl p-4 text-center">Nada nesta categoria ainda.</div>}
        {groups.map((g) => (
          <div key={g.name} className="rounded-xl bg-white/70 border border-white p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">{g.name}</div>
                {g.description && <div className="text-xs text-slate-500 mt-0.5">{g.description}</div>}
              </div>
              {kind === 'dor' && g.name !== 'Outras menções' && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0 ${SEV[g.severity]}`}>{g.severity === 'media' ? 'média' : g.severity}</span>
              )}
            </div>
            <div className="space-y-2">
              {g.items.map((it) => (
                <ItemQuote key={it.id} it={it} compact />
              ))}
            </div>
          </div>
        ))}
      </section>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Voltar ao teste
        </button>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          title="Pede uma nova leitura para a IA"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Analisando…' : 'Reanalisar'}
        </button>
      </div>

      {/* Hero */}
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white relative overflow-hidden shadow-lg shadow-violet-200">
        <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute right-40 -bottom-24 w-72 h-72 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <div className="relative grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-6 items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/80">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/15 font-semibold text-white">
                {data.engine === 'local' ? <Cpu className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />} {engineLabel}
              </span>
              <span>atualizado {ago(data.createdAt)}</span>
              {testName && <span>· {testName}</span>}
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight">Análise qualitativa</h1>
            <p className="mt-3 text-sm sm:text-base text-white/90 leading-relaxed max-w-4xl">{data.analysis.summary}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 xl:w-[360px]">
            {(['dor', 'positivo', 'sugestao'] as const).map((k) => {
              const Icon = CAT[k].icon;
              return (
                <div key={k} className="rounded-2xl bg-white/15 backdrop-blur p-3">
                  <Icon className="w-4 h-4 text-white/80" />
                  <div className="text-2xl font-semibold mt-1">{view.counts[k]}</div>
                  <div className="text-[11px] text-white/80">{CAT[k].label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {total > 0 && (
          <div className="relative mt-6">
            <div className="flex h-2.5 rounded-full overflow-hidden bg-white/20">
              {(['dor', 'neutro', 'sugestao', 'positivo'] as const).map((k) =>
                view.counts[k] ? <div key={k} className={`${CAT[k].bar} transition-all`} style={{ width: `${pct(view.counts[k])}%` }} title={`${CAT[k].label}: ${pct(view.counts[k])}%`} /> : null
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/85">
              {(['dor', 'neutro', 'sugestao', 'positivo'] as const).map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${CAT[k].dot}`} /> {CAT[k].one} {pct(view.counts[k])}%
                </span>
              ))}
              <span className="ml-auto">{total} resposta(s) de {view.writers} pessoa(s)</span>
            </div>
          </div>
        )}
      </div>

      {(data.engine === 'local' || data.aiError) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
          <div>
            {data.aiError ? (
              /503|504|429|UNAVAILABLE|DEADLINE|RESOURCE_EXHAUSTED|high demand|tempo esgotado/i.test(data.aiError) ? (
                <>O Gemini está sobrecarregado ou lento agora (problema temporário do Google). Enquanto isso, mostramos a análise local por regras. O sistema tenta de novo sozinho nos próximos minutos, ou clique em <b>Reanalisar</b>.</>
              ) : (
                <>A IA não respondeu desta vez ({data.aiError.slice(0, 160)}). Mostrando a análise local por regras; clique em <b>Reanalisar</b> para tentar de novo.</>
              )
            ) : (
              <>
                A IA ainda não está ligada no servidor, então esta é uma análise local por regras (sem temas nem leitura comportamental completa). Para ligar, adicione a variável{' '}
                <code className="px-1 rounded bg-white">GEMINI_API_KEY</code> no Render (chave grátis no Google AI Studio).
              </>
            )}
          </div>
        </div>
      )}

      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <MessageSquareQuote className="w-8 h-8 text-slate-300 mx-auto" />
          <div className="mt-3 text-sm font-semibold text-slate-800">Ainda não há respostas escritas</div>
          <div className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            A análise usa as respostas das perguntas do teste, os comentários de "Tive dificuldade" e o comentário final. Assim que alguém responder, a IA analisa sozinha.
          </div>
        </div>
      ) : (
        <>
          {/* Dores x positivos x sugestões */}
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 items-start">
            <Column kind="dor" groups={view.dores} />
            <Column kind="positivo" groups={view.bons} />
            <Column kind="sugestao" groups={view.sugs} />
          </div>

          {/* Leitura comportamental */}
          <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-violet-600" /> Leitura comportamental da escrita
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Como as pessoas escrevem diz tanto quanto o que escrevem. Cruzado com o que cada uma fez no protótipo.</p>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-violet-50 text-violet-800 text-xs font-semibold">Tom geral: {data.analysis.behavior.overallTone}</div>
            </div>

            {view.emotions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {view.emotions.map(([e, n]) => (
                  <span key={e} className="px-2.5 py-1 rounded-full bg-slate-100 text-xs text-slate-700" style={{ fontSize: `${Math.min(15, 11 + n)}px` }}>
                    {e} <b className="text-slate-900">{n}</b>
                  </span>
                ))}
              </div>
            )}

            {data.analysis.behavior.patterns.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {data.analysis.behavior.patterns.map((p, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 p-4 bg-gradient-to-b from-white to-slate-50">
                    <div className="text-sm font-semibold text-slate-900">{p.pattern}</div>
                    <div className="mt-2 text-xs text-slate-600 flex gap-1.5">
                      <Quote className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5" /> <span className="italic">{p.evidence}</span>
                    </div>
                    <div className="mt-2 text-xs text-violet-700">→ {p.meaning}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
              {data.analysis.behavior.participants.map((bp) => {
                const ctx = ctxOf(bp.participantKey);
                const name = ctx?.participantName || bp.participantKey;
                const eng = { alto: 3, medio: 2, baixo: 1 }[bp.engagement] || 1;
                return (
                  <button
                    type="button"
                    key={bp.participantKey}
                    onClick={() => onOpenParticipant?.(bp.participantKey)}
                    className="text-left rounded-xl border border-slate-200 p-4 hover:border-violet-300 hover:shadow-sm transition group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar n={ctx?.participantNumber} name={name} tone="bg-violet-600 text-white" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900 truncate">{name}</div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {bp.profile} · {bp.tone}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-500" />
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                      Engajamento
                      <span className="flex gap-0.5">
                        {[1, 2, 3].map((i) => (
                          <span key={i} className={`w-5 h-1.5 rounded-full ${i <= eng ? 'bg-violet-500' : 'bg-slate-200'}`} />
                        ))}
                      </span>
                      {ctx && (
                        <span className="ml-auto">
                          {ctx.tasksDone}/{ctx.tasksTotal} tarefas{typeof ctx.susScore === 'number' ? ` · SUS ${ctx.susScore}` : ''}
                        </span>
                      )}
                    </div>
                    {bp.signals.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {bp.signals.map((s, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] text-slate-600">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 text-xs text-slate-700 rounded-lg bg-slate-50 p-2.5">
                      <span className="font-semibold text-slate-900">Diz × faz: </span>
                      {bp.saysVsDoes}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Recomendações */}
          {data.analysis.recommendations.length > 0 && (
            <section className="rounded-2xl bg-slate-900 text-white p-5 sm:p-6">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Target className="w-5 h-5 text-fuchsia-300" /> O que fazer agora
              </h2>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {[...data.analysis.recommendations]
                  .sort((a, b) => ({ alta: 0, media: 1, baixa: 2 }[a.priority] - { alta: 0, media: 1, baixa: 2 }[b.priority]))
                  .map((r, i) => (
                    <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-semibold">{r.title}</div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                            r.priority === 'alta' ? 'bg-rose-500' : r.priority === 'media' ? 'bg-amber-400 text-slate-900' : 'bg-white/20'
                          }`}
                        >
                          {r.priority === 'media' ? 'média' : r.priority}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-white/75 leading-relaxed">{r.detail}</div>
                      {r.themes.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {r.themes.map((t) => (
                            <span key={t} className="px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] text-white/80">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Todas as respostas, por pergunta */}
          <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" /> Todas as respostas
              </h2>
              <div className="flex flex-wrap items-center gap-1 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
                {(['todas', 'dor', 'positivo', 'sugestao', 'neutro'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFilter(k)}
                    className={`px-2.5 py-1 rounded-lg font-medium ${filter === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {k === 'todas' ? `Todas (${total})` : `${CAT[k].label} (${view.counts[k]})`}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {view.questions
                .map((q) => ({ ...q, items: q.items.filter((i) => filtered.includes(i)) }))
                .filter((q) => q.items.length)
                .map((q) => (
                  <div key={q.title} className="rounded-xl border border-slate-200 p-4 space-y-2 min-w-0">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{q.title}</div>
                    {q.items.map((it) => (
                      <div key={it.id} className="flex items-start gap-2">
                        <span className={`mt-2 w-2 h-2 rounded-full shrink-0 ${CAT[it.c.category].dot}`} title={CAT[it.c.category].one} />
                        <div className="flex-1 min-w-0">
                          <ItemQuote it={it} hideSource />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};
