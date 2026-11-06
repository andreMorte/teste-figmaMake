import React, { useState } from 'react';
import { CustomQuestion, CustomQuestionType, MetricConfig, NpsConfig } from '../../types';
import { DEFAULT_SUS_QUESTIONS, npsCategory, npsDefaultQuestion } from '../../utils/surveyDefaults';
import {
  ChevronLeft,
  ChevronRight,
  Target,
  Clock,
  Route,
  MousePointerClick,
  MessageSquare,
  ClipboardCheck,
  Gauge,
  Plus,
  Trash2,
  Sparkles,
  AlertTriangle,
  ListChecks,
  ArrowRight,
  Flag,
  Zap,
  Type,
  Star,
  ListOrdered,
  X,
  Pencil,
  ChevronDown
} from 'lucide-react';

interface Props {
  metrics: MetricConfig;
  setMetrics: React.Dispatch<React.SetStateAction<MetricConfig>>;
  customQuestions: CustomQuestion[];
  setCustomQuestions: (q: CustomQuestion[]) => void;
  tasksCount: number;
  npsConfig: NpsConfig;
  setNpsConfig: (c: NpsConfig) => void;
  susQuestions: string[];
  setSusQuestions: (q: string[]) => void;
  onBack: () => void;
  onNext: () => void;
}

type Key = keyof MetricConfig;

const GROUPS: { title: string; hint: string; icon: React.ElementType; tone: string; items: { key: Key; label: string; desc: string }[] }[] = [
  {
    title: 'Resultado',
    hint: 'A pessoa conseguiu?',
    icon: Target,
    tone: 'text-emerald-600 bg-emerald-50',
    items: [
      { key: 'taskSuccessRate', label: 'Taxa de sucesso', desc: 'Tarefas concluídas ÷ iniciadas' },
      { key: 'completionRate', label: 'Taxa de conclusão', desc: 'Quem terminou a jornada inteira' },
      { key: 'abandonmentRate', label: 'Taxa de abandono', desc: 'Desistências antes do fim' }
    ]
  },
  {
    title: 'Tempo e esforço',
    hint: 'Quanto custou?',
    icon: Clock,
    tone: 'text-sky-600 bg-sky-50',
    items: [
      { key: 'taskDuration', label: 'Tempo de tarefa', desc: 'Média e mediana por tarefa' },
      { key: 'screenDuration', label: 'Tempo por tela', desc: 'Permanência em cada cenário' },
      { key: 'clickCount', label: 'Cliques totais', desc: 'Interações por participante' }
    ]
  },
  {
    title: 'Caminho',
    hint: 'Por onde foi?',
    icon: Route,
    tone: 'text-violet-600 bg-violet-50',
    items: [
      { key: 'idealPath', label: 'Caminho ideal', desc: '% que seguiu o caminho esperado' },
      { key: 'pathDeviation', label: 'Desvio de caminho', desc: 'Telas fora do caminho esperado' },
      { key: 'mostUsedPath', label: 'Caminho mais usado', desc: 'Rota mais frequente' },
      { key: 'backReturns', label: 'Retornos', desc: 'Voltas a telas anteriores' }
    ]
  },
  {
    title: 'Cliques',
    hint: 'Onde clicou?',
    icon: MousePointerClick,
    tone: 'text-rose-600 bg-rose-50',
    items: [
      { key: 'clickZoning', label: 'Mapa de calor e zonas', desc: 'Cliques sobre o print de cada tela' },
      { key: 'errorClicks', label: 'Cliques sem efeito', desc: 'Áreas que não respondem' }
    ]
  }
];

const TEMPLATES: { label: string; q: Omit<CustomQuestion, 'id'> }[] = [
  { label: 'Facilidade (1 a 5)', q: { question: 'De 1 a 5, quão fácil foi concluir as tarefas?', type: 'likert_scale', required: true } },
  { label: 'Maior dificuldade', q: { question: 'Em que momento você sentiu mais dificuldade? Por quê?', type: 'open_text', required: false } },
  { label: 'O que melhoraria', q: { question: 'Se pudesse mudar uma coisa nessa experiência, o que seria?', type: 'open_text', required: false } },
  { label: 'Encontrou o que procurava?', q: { question: 'Você encontrou o que procurava?', type: 'multiple_choice', options: ['Sim', 'Parcialmente', 'Não'], required: true } }
];

const TYPE_OPTIONS: { value: CustomQuestionType; label: string; icon: React.ElementType }[] = [
  { value: 'open_text', label: 'Texto livre', icon: Type },
  { value: 'likert_scale', label: 'Escala 1–5', icon: Star },
  { value: 'multiple_choice', label: 'Múltipla escolha', icon: ListOrdered }
];

// segundos estimados para responder cada bloco
const SECONDS: Record<CustomQuestionType, number> = { open_text: 40, likert_scale: 8, multiple_choice: 8 };

const Switch: React.FC<{ on: boolean; onChange: () => void; label: string; size?: 'sm' | 'md' }> = ({ on, onChange, label, size = 'sm' }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={(e) => {
      e.stopPropagation();
      onChange();
    }}
    className={`relative inline-flex shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
      size === 'md' ? 'h-6 w-11' : 'h-5 w-9'
    } ${on ? 'bg-blue-600' : 'bg-slate-300'}`}
  >
    <span
      className={`inline-block rounded-full bg-white shadow transition-transform ${size === 'md' ? 'h-5 w-5' : 'h-4 w-4'} ${
        on ? (size === 'md' ? 'translate-x-5' : 'translate-x-4') : 'translate-x-0.5'
      }`}
    />
  </button>
);

export const MetricsStep: React.FC<Props> = ({
  metrics,
  setMetrics,
  customQuestions,
  setCustomQuestions,
  tasksCount,
  npsConfig,
  setNpsConfig,
  susQuestions,
  setSusQuestions,
  onBack,
  onNext
}) => {
  const [susOpen, setSusOpen] = useState(false);
  const susCustomized = susQuestions.filter((q, i) => q.trim() !== DEFAULT_SUS_QUESTIONS[i]).length;
  const [optionDraft, setOptionDraft] = useState<Record<string, string>>({});
  const toggle = (k: Key) => setMetrics((p) => ({ ...p, [k]: !p[k] }));
  const setMany = (keys: Key[], v: boolean) => setMetrics((p) => ({ ...p, ...Object.fromEntries(keys.map((k) => [k, v])) }));

  const allKeys = GROUPS.flatMap((g) => g.items.map((i) => i.key));
  const activeCount = allKeys.filter((k) => metrics[k]).length;

  const questionsOn = metrics.customQuestions !== false;
  const nextId = () => {
    const nums = customQuestions.map((q) => Number(q.id.replace(/\D/g, '')) || 0);
    return `CQ-${Math.max(0, ...nums) + 1}`;
  };
  const addQuestion = (q?: Omit<CustomQuestion, 'id'>) =>
    setCustomQuestions([...customQuestions, { id: nextId(), question: '', type: 'open_text', required: false, ...(q || {}) }]);
  const update = (i: number, u: Partial<CustomQuestion>) => setCustomQuestions(customQuestions.map((q, idx) => (idx === i ? { ...q, ...u } : q)));
  const remove = (i: number) => setCustomQuestions(customQuestions.filter((_, idx) => idx !== i));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= customQuestions.length) return;
    const arr = [...customQuestions];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setCustomQuestions(arr);
  };

  // Jornada do participante e tempo estimado do questionário
  const validQuestions = questionsOn ? customQuestions.filter((q) => q.question.trim()) : [];
  const flow = [
    { label: `${tasksCount} tarefa(s)`, icon: Flag, on: true },
    { label: `${validQuestions.length} pergunta(s)`, icon: MessageSquare, on: validQuestions.length > 0 },
    { label: 'NPS', icon: Gauge, on: metrics.nps },
    { label: 'SUS', icon: ClipboardCheck, on: metrics.sus },
    { label: 'Comentário', icon: Type, on: metrics.sus && metrics.qualitativeComments }
  ].filter((f) => f.on);
  const surveySeconds =
    validQuestions.reduce((a, q) => a + SECONDS[q.type], 0) + (metrics.sus ? 100 : 0) + (metrics.sus && metrics.qualitativeComments ? 30 : 0) + (metrics.nps ? 10 : 0);
  const surveyMin = Math.max(0, Math.round(surveySeconds / 60));
  const hasOpenText = validQuestions.some((q) => q.type === 'open_text') || (metrics.sus && metrics.qualitativeComments);
  const emptyQuestions = questionsOn ? customQuestions.filter((q) => !q.question.trim()).length : 0;

  return (
    <div className="p-5 sm:p-7 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-8">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Etapa 3 — O que medir</h2>
        <p className="text-sm text-slate-500 mt-1">
          Escolha o que aparece nos resultados e o que o participante responde ao terminar as tarefas.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* A. Métricas automáticas */}
      {/* ------------------------------------------------------------------ */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900">Medido automaticamente</h3>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">sem esforço do participante</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Calculado a partir do que a pessoa faz no protótipo.</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-500">
              <b className="text-slate-800">{activeCount}</b> de {allKeys.length} ativas
            </span>
            <button
              type="button"
              onClick={() => setMany(allKeys, activeCount !== allKeys.length)}
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              {activeCount === allKeys.length ? 'Desativar todas' : 'Ativar todas'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {GROUPS.map((g) => {
            const Icon = g.icon;
            const keys = g.items.map((i) => i.key);
            const on = keys.filter((k) => metrics[k]).length;
            return (
              <div key={g.title} className={`rounded-xl border p-4 transition-colors ${on ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50/60'}`}>
                <div className="flex items-center gap-2.5">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${g.tone}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">{g.title}</div>
                    <div className="text-[11px] text-slate-500">{g.hint}</div>
                  </div>
                  <span className="text-[11px] text-slate-400 mr-1">
                    {on}/{keys.length}
                  </span>
                  <Switch on={on === keys.length} onChange={() => setMany(keys, on !== keys.length)} label={`Todas de ${g.title}`} />
                </div>
                <div className="mt-3 divide-y divide-slate-100">
                  {g.items.map((m) => (
                    <label key={m.key} className="flex items-center gap-3 py-2 cursor-pointer group">
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-medium ${metrics[m.key] ? 'text-slate-800' : 'text-slate-400'}`}>{m.label}</div>
                        <div className="text-[11px] text-slate-400">{m.desc}</div>
                      </div>
                      <Switch on={!!metrics[m.key]} onChange={() => toggle(m.key)} label={m.label} />
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* B. Questionário pós-teste */}
      {/* ------------------------------------------------------------------ */}
      <section className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Questionário pós-teste</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">O participante responde depois das tarefas, nesta ordem. Desligue o que não precisar.</p>
        </div>

        {/* Prévia da jornada */}
        <div className="rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            {flow.map((f, i) => {
              const Icon = f.icon;
              return (
                <React.Fragment key={f.label}>
                  {i > 0 && <ArrowRight className="w-3.5 h-3.5 text-white/30" />}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 text-xs">
                    <Icon className="w-3.5 h-3.5 text-white/70" /> {f.label}
                  </span>
                </React.Fragment>
              );
            })}
            <ArrowRight className="w-3.5 h-3.5 text-white/30" />
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-200 text-xs">Fim</span>
            <span className="ml-auto text-xs text-white/70">
              Questionário: <b className="text-white">{surveySeconds === 0 ? 'nenhum' : surveyMin < 1 ? 'menos de 1 min' : `~${surveyMin} min`}</b>
            </span>
          </div>
          {(surveySeconds > 300 || !hasOpenText) && (
            <div className="mt-3 flex items-start gap-2 text-[11px] text-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                {surveySeconds > 300
                  ? 'Questionários com mais de 5 minutos aumentam o abandono. Considere tirar perguntas.'
                  : 'Sem perguntas abertas, a Análise qualitativa (IA) só terá os comentários de "Tive dificuldade".'}
              </span>
            </div>
          )}
        </div>

        {/* 1. Perguntas do pesquisador */}
        <div className={`rounded-xl border transition-colors ${questionsOn ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-3 p-4">
            <span className="w-7 h-7 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-600 flex items-center justify-center">1</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900">Perguntas do pesquisador</div>
              <div className="text-[11px] text-slate-500">
                {questionsOn
                  ? `${validQuestions.length} pergunta(s) · texto livre, escala de 1 a 5 ou múltipla escolha`
                  : 'Desligado: o participante não verá perguntas personalizadas.'}
              </div>
            </div>
            <Switch size="md" on={questionsOn} onChange={() => toggle('customQuestions')} label="Perguntas do pesquisador" />
          </div>

          {questionsOn && (
            <div className="px-4 pb-4 space-y-3">
              {customQuestions.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-xs text-slate-500">
                  Nenhuma pergunta ainda. Comece por um modelo abaixo ou crie a sua.
                </div>
              )}

              {customQuestions.map((q, i) => (
                <div key={q.id} className="rounded-xl bg-white border border-slate-200 p-3.5 space-y-3 shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <div className="flex flex-col items-center gap-0.5 pt-1">
                      <span className="w-6 h-6 rounded-md bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-slate-300 hover:text-slate-600 disabled:opacity-0 text-[10px] leading-none" title="Subir">
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={i === customQuestions.length - 1}
                        className="text-slate-300 hover:text-slate-600 disabled:opacity-0 text-[10px] leading-none"
                        title="Descer"
                      >
                        ▼
                      </button>
                    </div>
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <textarea
                        rows={1}
                        value={q.question}
                        onChange={(e) => update(i, { question: e.target.value })}
                        placeholder="Escreva a pergunta…"
                        className={`w-full resize-none px-3 py-2 rounded-lg border text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 ${
                          q.question.trim() ? 'border-slate-200 bg-slate-50 focus:bg-white' : 'border-amber-300 bg-amber-50/40'
                        }`}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                          {TYPE_OPTIONS.map((t) => {
                            const Icon = t.icon;
                            const sel = q.type === t.value;
                            return (
                              <button
                                key={t.value}
                                type="button"
                                onClick={() => update(i, { type: t.value, options: t.value === 'multiple_choice' ? q.options?.length ? q.options : ['Sim', 'Não'] : q.options })}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium ${sel ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                              >
                                <Icon className="w-3 h-3" /> {t.label}
                              </button>
                            );
                          })}
                        </div>
                        <label className="ml-auto inline-flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer">
                          Obrigatória
                          <Switch on={!!q.required} onChange={() => update(i, { required: !q.required })} label="Obrigatória" />
                        </label>
                        <button type="button" onClick={() => remove(i)} className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50" title="Remover pergunta">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {q.type === 'likert_scale' && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span key={n} className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center text-slate-500">
                              {n}
                            </span>
                          ))}
                          <span className="ml-2">1 = muito difícil · 5 = muito fácil</span>
                        </div>
                      )}

                      {q.type === 'multiple_choice' && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(q.options || []).map((opt, oi) => (
                            <span key={`${opt}-${oi}`} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-slate-100 text-[11px] text-slate-700">
                              {opt}
                              <button
                                type="button"
                                onClick={() => update(i, { options: (q.options || []).filter((_, k) => k !== oi) })}
                                className="p-0.5 rounded text-slate-400 hover:text-rose-600"
                                title="Remover opção"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                          <input
                            value={optionDraft[q.id] || ''}
                            onChange={(e) => setOptionDraft({ ...optionDraft, [q.id]: e.target.value })}
                            onKeyDown={(e) => {
                              const v = (optionDraft[q.id] || '').trim();
                              if ((e.key === 'Enter' || e.key === ',') && v) {
                                e.preventDefault();
                                update(i, { options: [...(q.options || []), v] });
                                setOptionDraft({ ...optionDraft, [q.id]: '' });
                              }
                            }}
                            placeholder="+ opção (Enter)"
                            className="w-32 px-2 py-1 rounded-lg border border-dashed border-slate-300 text-[11px] outline-none focus:border-blue-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => addQuestion()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" /> Nova pergunta
                </button>
                <span className="text-[11px] text-slate-400 inline-flex items-center gap-1 ml-1">
                  <Sparkles className="w-3 h-3" /> Modelos:
                </span>
                {TEMPLATES.filter((t) => !customQuestions.some((q) => q.question === t.q.question)).map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => addQuestion(t.q)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] text-slate-600 hover:border-blue-300 hover:text-blue-700"
                  >
                    + {t.label}
                  </button>
                ))}
              </div>
              {emptyQuestions > 0 && (
                <div className="text-[11px] text-amber-700">
                  {emptyQuestions} pergunta(s) sem texto não serão mostradas ao participante.
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. NPS */}
        <div className={`rounded-xl border transition-colors ${metrics.nps ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-3 p-4">
            <span className="w-7 h-7 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-600 flex items-center justify-center">2</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900">
                NPS <span className="font-normal text-slate-500">· Net Promoter Score</span>
              </div>
              <div className="text-[11px] text-slate-500">Pergunta de recomendação, escala de 0 a {npsConfig.scaleMax} · cerca de 10 s</div>
            </div>
            <Switch size="md" on={metrics.nps} onChange={() => toggle('nps')} label="NPS" />
          </div>
          {metrics.nps && (
            <div className="mx-4 mb-4 rounded-lg bg-white border border-slate-200 p-3.5 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Pergunta</label>
                <textarea
                  rows={2}
                  value={npsConfig.question}
                  onChange={(e) => setNpsConfig({ ...npsConfig, question: e.target.value })}
                  className="w-full resize-none px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-sm text-slate-900 outline-none"
                />
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 mb-1">Escala</div>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                    {([5, 10] as const).map((mx) => (
                      <button
                        key={mx}
                        type="button"
                        onClick={() =>
                          setNpsConfig({
                            ...npsConfig,
                            scaleMax: mx,
                            // se a pergunta ainda é a padrão, acompanha a escala
                            question: npsConfig.question === npsDefaultQuestion(npsConfig.scaleMax) ? npsDefaultQuestion(mx) : npsConfig.question
                          })
                        }
                        className={`px-3 py-1 rounded-md text-[11px] font-semibold ${npsConfig.scaleMax === mx ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        0 a {mx}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Texto do 0</label>
                  <input
                    value={npsConfig.minLabel}
                    onChange={(e) => setNpsConfig({ ...npsConfig, minLabel: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 text-xs text-slate-900 outline-none"
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Texto do {npsConfig.scaleMax}</label>
                  <input
                    value={npsConfig.maxLabel}
                    onChange={(e) => setNpsConfig({ ...npsConfig, maxLabel: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 text-xs text-slate-900 outline-none"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-400">Sugestões:</span>
                {[
                  ['Nada provável', 'Muito provável'],
                  ['Muito ruim', 'Muito bom'],
                  ['Muito insatisfeito', 'Muito satisfeito']
                ].map(([a, b]) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setNpsConfig({ ...npsConfig, minLabel: a, maxLabel: b })}
                    className={`px-2 py-1 rounded-md border ${npsConfig.minLabel === a && npsConfig.maxLabel === b ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
                  >
                    {a} → {b}
                  </button>
                ))}
              </div>

              {/* Prévia como o participante verá */}
              <div className="rounded-lg bg-slate-50 p-3 space-y-2">
                <div className="text-[11px] font-semibold text-slate-500">Prévia</div>
                <div className="text-xs text-slate-800">{npsConfig.question || 'Escreva a pergunta…'}</div>
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: npsConfig.scaleMax + 1 }, (_, n) => {
                    const c = npsCategory(n, npsConfig.scaleMax);
                    return (
                      <span
                        key={n}
                        className={`w-8 h-8 rounded-md text-[11px] font-semibold flex items-center justify-center ${
                          c === 'detrator' ? 'bg-rose-50 text-rose-600' : c === 'neutro' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {n}
                      </span>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-slate-500" style={{ maxWidth: `${(npsConfig.scaleMax + 1) * 36}px` }}>
                  <span>0 = {npsConfig.minLabel}</span>
                  <span>
                    {npsConfig.scaleMax} = {npsConfig.maxLabel}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {npsConfig.scaleMax === 10
                    ? 'Classificação oficial: 0–6 detratores, 7–8 neutros, 9–10 promotores.'
                    : 'Na escala 0 a 5 a nota é convertida para a régua oficial: 0–3 detratores, 4 neutros, 5 promotores.'}
                </div>
              </div>
            </div>
          )}
        </div>
        {/* 3. SUS */}
        <div className={`rounded-xl border transition-colors ${metrics.sus ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-3 p-4">
            <span className="w-7 h-7 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-600 flex items-center justify-center">3</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900">
                SUS <span className="font-normal text-slate-500">· System Usability Scale</span>
              </div>
              <div className="text-[11px] text-slate-500">10 afirmações padronizadas, nota de 0 a 100 · cerca de 2 min</div>
            </div>
            <Switch size="md" on={metrics.sus} onChange={() => toggle('sus')} label="SUS" />
          </div>
          {metrics.sus && (
            <div className="mx-4 mb-4 space-y-2">
              <label className="flex items-center gap-3 rounded-lg bg-white border border-slate-200 px-3 py-2.5 cursor-pointer">
                <MessageSquare className="w-4 h-4 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-slate-800">Comentário livre no final</div>
                  <div className="text-[11px] text-slate-500">Campo aberto depois do SUS. Também alimenta a Análise qualitativa (IA).</div>
                </div>
                <Switch on={metrics.qualitativeComments} onChange={() => toggle('qualitativeComments')} label="Comentário livre no final" />
              </label>

              <div className="rounded-lg bg-white border border-slate-200">
                <button type="button" onClick={() => setSusOpen(!susOpen)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
                  <Pencil className="w-4 h-4 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-slate-800 flex items-center gap-2">
                      Editar as 10 afirmações
                      {susCustomized > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">{susCustomized} alterada(s)</span>}
                    </div>
                    <div className="text-[11px] text-slate-500">Adapte a linguagem ao seu produto (ex.: "este sistema" → "este app").</div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${susOpen ? 'rotate-180' : ''}`} />
                </button>
                {susOpen && (
                  <div className="px-3 pb-3 space-y-2">
                    <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-900">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                      <span>
                        A nota do SUS depende da ordem e do sentido: itens <b>ímpares são positivos</b> e <b>pares são negativos</b>. Ao reescrever, mantenha o sentido de
                        cada item. Mudar o texto reduz a comparação com o benchmark (média 68).
                      </span>
                    </div>
                    {susQuestions.map((q, i) => {
                      const positive = i % 2 === 0;
                      const changed = q.trim() !== DEFAULT_SUS_QUESTIONS[i];
                      return (
                        <div key={i} className="flex items-start gap-2">
                          <span className="w-6 h-6 mt-1 rounded-md bg-slate-100 text-[11px] font-bold text-slate-600 flex items-center justify-center shrink-0">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <textarea
                              rows={1}
                              value={q}
                              onChange={(e) => setSusQuestions(susQuestions.map((x, k) => (k === i ? e.target.value : x)))}
                              className={`w-full resize-none px-3 py-1.5 rounded-lg border text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 ${
                                changed ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 bg-slate-50'
                              }`}
                            />
                            <div className="mt-0.5 flex items-center gap-2 text-[10px]">
                              <span className={positive ? 'text-emerald-600' : 'text-rose-600'}>{positive ? 'positiva (concordar = melhor)' : 'negativa (concordar = pior)'}</span>
                              {changed && (
                                <button
                                  type="button"
                                  onClick={() => setSusQuestions(susQuestions.map((x, k) => (k === i ? DEFAULT_SUS_QUESTIONS[i] : x)))}
                                  className="text-slate-400 hover:text-blue-600"
                                >
                                  restaurar
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {susCustomized > 0 && (
                      <button type="button" onClick={() => setSusQuestions(DEFAULT_SUS_QUESTIONS)} className="text-[11px] font-semibold text-blue-600 hover:text-blue-700">
                        Restaurar todas as afirmações oficiais
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </section>

      <div className="flex justify-between gap-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-200"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>
        <button type="button" onClick={onNext} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs">
          Avançar para Publicação <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
