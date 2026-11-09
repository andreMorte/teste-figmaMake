import React, { useEffect, useMemo, useState } from 'react';
import { Hypothesis, UsabilityTest } from '../../types';
import { metricDef, metricVerdict, fmtMetric, VERDICT_UI, Verdict } from '../../utils/hypotheses';
import { HypothesesEditor } from '../tests/HypothesesEditor';
import { Lightbulb, Pencil, Sparkles, Quote, X, ThumbsUp, ThumbsDown } from 'lucide-react';

export interface Measurement {
  value: number | null;
  base: number; // participantes que entram na conta
}

type Stance = 'apoia' | 'contradiz' | 'misto' | 'sem_evidencia';
interface AiResult {
  id: string;
  stance: Stance;
  summary: string;
  evidence: { quote: string; participantName: string; participantKey?: string; supports: boolean }[];
}

const STANCE: Record<Stance, string> = {
  apoia: 'As respostas apoiam',
  contradiz: 'As respostas contradizem',
  misto: 'Respostas divididas',
  sem_evidencia: 'Sem respostas sobre isso'
};

/**
 * Resultado das hipóteses do estudo: veredito pelo indicador escolhido (meta × resultado)
 * + leitura das respostas dos participantes pela IA (com citações reais).
 */
export const HypothesesPanel: React.FC<{
  test: UsabilityTest;
  measure: (h: Hypothesis) => Measurement;
  onOpenParticipant?: (key: string) => void;
}> = ({ test, measure, onOpenParticipant }) => {
  const [hyps, setHyps] = useState<Hypothesis[]>(test.hypotheses || []);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Hypothesis[]>([]);
  const [saving, setSaving] = useState(false);
  const [ai, setAi] = useState<{ engine?: string; results: AiResult[]; noAnswers?: boolean } | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => setHyps(test.hypotheses || []), [test.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(
    () =>
      hyps.map((h) => {
        const def = metricDef(h.metric);
        const m = h.metric === 'none' ? { value: null, base: 0 } : measure(h);
        const task = h.taskId ? test.tasks.findIndex((t) => t.id === h.taskId) : -1;
        return {
          h,
          def,
          m,
          taskLabel: task >= 0 ? `Tarefa ${task + 1}` : def.taskScoped && test.tasks.length > 1 ? 'todas as tarefas' : '',
          numeric: metricVerdict(h, m.value, m.base)
        };
      }),
    [hyps, measure, test.tasks]
  );

  // leitura das respostas pela IA (cacheada no servidor)
  const payload = JSON.stringify(
    rows.map((r) => ({
      id: r.h.id,
      statement: r.h.statement,
      metricLabel: r.h.metric === 'none' ? '' : `${r.def.label}${r.taskLabel ? ` (${r.taskLabel})` : ''}`,
      targetText: r.h.metric === 'none' ? '' : `${r.h.op === '>=' ? 'pelo menos' : 'no máximo'} ${fmtMetric(r.h.target, r.def.unit)}`,
      valueText: r.h.metric === 'none' ? '' : fmtMetric(r.m.value, r.def.unit),
      verdict: r.h.metric === 'none' ? '' : r.numeric,
      base: r.m.base
    }))
  );
  useEffect(() => {
    if (!hyps.length) return;
    let alive = true;
    setLoadingAi(true);
    fetch(`/api/tests/${encodeURIComponent(test.id)}/hypotheses/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ measures: JSON.parse(payload) })
    })
      .then((r) => r.json())
      .then((d) => alive && setAi(d))
      .catch(() => alive && setAi(null))
      .finally(() => alive && setLoadingAi(false));
    return () => {
      alive = false;
    };
  }, [payload, test.id, hyps.length]);

  const finalVerdict = (numeric: Verdict, metric: string, stance?: Stance): Verdict => {
    if (metric !== 'none') return numeric;
    if (stance === 'apoia') return 'confirmada';
    if (stance === 'contradiz') return 'refutada';
    if (stance === 'misto') return 'parcial';
    return 'inconclusiva';
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/tests/${encodeURIComponent(test.id)}/hypotheses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hypotheses: draft })
      });
      const body = await res.json();
      if (res.ok) {
        setHyps(body.hypotheses || []);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const verdicts = rows.map((r) => finalVerdict(r.numeric, r.h.metric, ai?.results.find((x) => x.id === r.h.id)?.stance));
  const confirmed = verdicts.filter((v) => v === 'confirmada').length;

  return (
    <div className="p-6 rounded-2xl bg-white border border-amber-200/80 shadow-xs space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" /> Hipóteses do estudo
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {hyps.length
              ? `${confirmed} de ${hyps.length} confirmada(s). Cada hipótese é checada pelo indicador escolhido e pelo que os participantes escreveram.`
              : 'Nenhuma hipótese cadastrada para este teste.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDraft(hyps.length ? hyps : []);
            setEditing(true);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Pencil className="w-3.5 h-3.5" /> {hyps.length ? 'Editar hipóteses' : 'Adicionar hipóteses'}
        </button>
      </div>

      {hyps.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            {(['confirmada', 'parcial', 'refutada', 'inconclusiva'] as Verdict[]).map((v) => {
              const n = verdicts.filter((x) => x === v).length;
              return n ? (
                <span key={v} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${VERDICT_UI[v].tone}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${VERDICT_UI[v].dot}`} /> {n} {VERDICT_UI[v].label.toLowerCase()}
                </span>
              ) : null;
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {rows.map((r, i) => {
              const res = ai?.results.find((x) => x.id === r.h.id);
              const v = verdicts[i];
              const ui = VERDICT_UI[v];
              const target = r.h.target;
              const val = r.m.value;
              // barra: resultado x meta na mesma régua
              const max = r.def.unit === '%' ? 100 : Math.max(target, val || 0) * 1.25 || 1;
              return (
                <div key={r.h.id} className="rounded-2xl border border-slate-200 p-4 space-y-3 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-bold">H{i + 1}</span>
                    <span className={`px-2.5 py-1 rounded-full border text-[11px] font-bold ${ui.tone}`}>{ui.label}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 leading-snug">{r.h.statement}</p>

                  {r.h.metric !== 'none' ? (
                    <div className="rounded-xl bg-slate-50 p-3 space-y-2">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-slate-500">
                          {r.def.label}
                          {r.taskLabel ? ` · ${r.taskLabel}` : ''}
                        </span>
                        <span className="text-slate-500">
                          meta: {r.h.op === '>=' ? '≥' : '≤'} {fmtMetric(target, r.def.unit)}
                        </span>
                      </div>
                      <div className={`text-2xl font-bold ${v === 'confirmada' ? 'text-emerald-600' : v === 'refutada' ? 'text-rose-600' : v === 'parcial' ? 'text-amber-600' : 'text-slate-700'}`}>
                        {fmtMetric(val, r.def.unit)}
                      </div>
                      {val !== null && (
                        <div className="relative h-2 rounded-full bg-slate-200">
                          <div className={`absolute inset-y-0 left-0 rounded-full ${ui.dot}`} style={{ width: `${Math.max(0, Math.min(100, ((r.def.key === 'nps' ? val + 100 : val) / (r.def.key === 'nps' ? 200 : max)) * 100))}%` }} />
                          <div
                            className="absolute -top-1 -bottom-1 w-0.5 bg-slate-800"
                            style={{ left: `${Math.max(0, Math.min(100, ((r.def.key === 'nps' ? target + 100 : target) / (r.def.key === 'nps' ? 200 : max)) * 100))}%` }}
                            title="meta"
                          />
                        </div>
                      )}
                      <div className="text-[11px] text-slate-400">
                        {r.m.base < 3 ? `Base de ${r.m.base} participante(s): poucos dados para concluir.` : `Base: ${r.m.base} participante(s).`}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500">Sem indicador numérico: o veredito vem das respostas dos participantes.</div>
                  )}

                  <div className="space-y-2 flex-1">
                    <div className="text-[11px] font-semibold text-violet-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      {loadingAi && !res ? 'Lendo as respostas…' : res ? STANCE[res.stance] : ai?.noAnswers ? 'Ainda não há respostas escritas' : 'Leitura das respostas indisponível'}
                    </div>
                    {res?.summary && <p className="text-xs text-slate-600 leading-relaxed">{res.summary}</p>}
                    {res && r.h.metric !== 'none' && ((v === 'confirmada' && res.stance === 'contradiz') || (v === 'refutada' && res.stance === 'apoia')) && (
                      <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                        Atenção: o número e as respostas apontam para lados diferentes. Vale abrir os participantes citados antes de concluir.
                      </div>
                    )}
                    {res?.evidence.map((e, k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => e.participantKey && onOpenParticipant?.(e.participantKey)}
                        className={`w-full text-left flex gap-2 px-2.5 py-2 rounded-lg text-[11px] ${e.supports ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'}`}
                      >
                        {e.supports ? <ThumbsUp className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <ThumbsDown className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                        <span>
                          <Quote className="w-3 h-3 inline -mt-0.5 opacity-50" /> {e.quote} <span className="opacity-60">— {e.participantName}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => !saving && setEditing(false)}>
          <div className="bg-slate-50 rounded-2xl max-w-3xl w-full my-10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white rounded-t-2xl">
              <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" /> Hipóteses do estudo
              </div>
              <button type="button" onClick={() => setEditing(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <HypothesesEditor value={draft} onChange={setDraft} tasks={test.tasks} />
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-white rounded-b-2xl">
              <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100">
                Cancelar
              </button>
              <button type="button" disabled={saving} onClick={save} className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Salvando…' : 'Salvar hipóteses'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
