import React from 'react';
import { Hypothesis, TestTask } from '../../types';
import { HYP_METRICS, HYP_TEMPLATES, metricDef, newHypothesisId } from '../../utils/hypotheses';
import { Lightbulb, Plus, Trash2, Target, Sparkles } from 'lucide-react';

const MAX = 3;

/** Até 3 hipóteses: o que o time acredita + como vamos saber (indicador, meta e tarefa). */
export const HypothesesEditor: React.FC<{ value: Hypothesis[]; onChange: (h: Hypothesis[]) => void; tasks: TestTask[] }> = ({ value, onChange, tasks }) => {
  const update = (i: number, patch: Partial<Hypothesis>) => onChange(value.map((h, k) => (k === i ? { ...h, ...patch } : h)));
  const add = (tpl?: Omit<Hypothesis, 'id'>) =>
    value.length < MAX && onChange([...value, { id: newHypothesisId(), statement: '', metric: 'task_success', op: '>=', target: 80, ...(tpl || {}) }]);

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500">
          Escreva o que o time acredita antes do teste. No fim, o resultado mostra se cada hipótese se confirmou pelos números e pelas respostas dos participantes.
        </div>
      )}

      {value.map((h, i) => {
        const def = metricDef(h.metric);
        return (
          <div key={h.id} className="rounded-xl bg-white border border-slate-200 p-4 space-y-3 shadow-xs">
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0">H{i + 1}</span>
              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Acreditamos que…</label>
                <textarea
                  rows={2}
                  value={h.statement}
                  onChange={(e) => update(i, { statement: e.target.value })}
                  placeholder="Ex.: os corretores encontram a opção de nova cotação sem precisar de ajuda."
                  className={`w-full resize-none px-3 py-2 rounded-lg border text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 ${
                    h.statement.trim() ? 'border-slate-200 bg-slate-50 focus:bg-white' : 'border-amber-300 bg-amber-50/40'
                  }`}
                />
              </div>
              <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))} className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50" title="Remover hipótese">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="pl-10 space-y-2">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" /> Como vamos saber
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={h.metric}
                  onChange={(e) => {
                    const d = metricDef(e.target.value as Hypothesis['metric']);
                    update(i, { metric: d.key, op: d.op, target: d.target, taskId: d.taskScoped ? h.taskId : undefined });
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800"
                >
                  {HYP_METRICS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
                {h.metric !== 'none' && (
                  <>
                    {def.taskScoped && tasks.length > 1 && (
                      <select
                        value={h.taskId || ''}
                        onChange={(e) => update(i, { taskId: e.target.value || undefined })}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800"
                      >
                        <option value="">em todas as tarefas</option>
                        {tasks.map((t, k) => (
                          <option key={t.id} value={t.id}>
                            na Tarefa {k + 1}
                          </option>
                        ))}
                      </select>
                    )}
                    <select
                      value={h.op}
                      onChange={(e) => update(i, { op: e.target.value as Hypothesis['op'] })}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800"
                    >
                      <option value=">=">pelo menos</option>
                      <option value="<=">no máximo</option>
                    </select>
                    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                      <input
                        type="number"
                        value={h.target}
                        onChange={(e) => update(i, { target: Number(e.target.value) })}
                        className="w-20 px-2.5 py-1.5 bg-transparent text-slate-900 outline-none"
                      />
                      {def.unit && <span className="px-2 text-slate-500 border-l border-slate-200">{def.unit}</span>}
                    </div>
                  </>
                )}
              </div>
              <div className="text-[11px] text-slate-400">
                {h.metric === 'none' ? (
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Sem indicador: a IA julga pelas respostas e comentários dos participantes.
                  </span>
                ) : (
                  <>
                    {def.hint}. A IA também cruza com o que os participantes escreveram.
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {value.length < MAX && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => add()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" /> Nova hipótese
          </button>
          <span className="text-[11px] text-slate-400 inline-flex items-center gap-1 ml-1">
            <Lightbulb className="w-3 h-3" /> Modelos:
          </span>
          {HYP_TEMPLATES.filter((t) => !value.some((h) => h.statement === t.statement)).map((t) => (
            <button
              key={t.statement}
              type="button"
              onClick={() => add(t)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] text-slate-600 hover:border-amber-300 hover:text-amber-800 text-left"
            >
              + {t.statement}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-slate-400">
            {value.length} de {MAX}
          </span>
        </div>
      )}
    </div>
  );
};
