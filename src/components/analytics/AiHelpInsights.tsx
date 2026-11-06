import React, { useMemo } from 'react';
import { ParticipantSession, UsabilityTest } from '../../types';
import { collectAiHelps, summarizeAiHelps, OUTCOME_LABEL } from '../../utils/aiHelp';
import { Sparkles, AlertTriangle, CheckCircle2, Clock, Users } from 'lucide-react';

/**
 * Visão do time sobre a "Ajuda da IA" (testes não moderados): quantos precisaram,
 * se a ajuda resolveu e quais telas concentram os pedidos (sinal de fricção na interface).
 */
export const AiHelpInsights: React.FC<{ test: UsabilityTest; sessions: ParticipantSession[]; onOpenParticipant?: (key: string) => void }> = ({
  test,
  sessions,
  onOpenParticipant
}) => {
  const helps = useMemo(() => collectAiHelps(test, sessions), [test, sessions]);
  const sum = useMemo(() => summarizeAiHelps(test, sessions, helps), [test, sessions, helps]);
  if (test.moderation !== 'unmoderated' && helps.length === 0) return null;

  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const doneTotal = sum.autonomousSuccess + sum.assistedSuccess;
  const tiles = [
    { icon: Users, label: 'Pediram ajuda', value: `${sum.people} de ${sum.participants}`, sub: `${pct(sum.people, sum.participants)}% dos participantes` },
    { icon: Sparkles, label: 'Pedidos de ajuda', value: sum.total, sub: sum.people ? `${(sum.total / sum.people).toFixed(1)} por pessoa que pediu` : 'nenhum ainda' },
    { icon: CheckCircle2, label: 'Ajuda resolveu', value: `${sum.resolutionRate}%`, sub: `${sum.resolved} de ${sum.total} avançaram depois` },
    { icon: Clock, label: 'Tempo até avançar', value: sum.avgSecondsToProgress !== undefined ? `${sum.avgSecondsToProgress}s` : '—', sub: 'depois de ler a resposta' }
  ];

  return (
    <div className="p-6 rounded-2xl bg-white border border-violet-200/80 shadow-xs space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-600" /> Ajuda da IA
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Onde as pessoas travaram, o que perguntaram e se a ajuda fez elas avançarem.</p>
        </div>
        {doneTotal > 0 && (
          <div className="min-w-[220px]">
            <div className="flex justify-between gap-4 text-[11px] text-slate-500">
              <span>Tarefas concluídas sozinhas: <b className="text-slate-800">{sum.autonomousSuccess}</b></span>
              <span>com ajuda: <b className="text-violet-700">{sum.assistedSuccess}</b></span>
            </div>
            <div className="h-2 rounded-full bg-violet-100 overflow-hidden mt-1 flex">
              <div className="h-full bg-emerald-500" style={{ width: `${pct(sum.autonomousSuccess, doneTotal)}%` }} />
              <div className="h-full bg-violet-500" style={{ width: `${pct(sum.assistedSuccess, doneTotal)}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.label} className="p-4 rounded-xl bg-violet-50/50 border border-violet-100">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Icon className="w-3.5 h-3.5 text-violet-500" /> {t.label}
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">{t.value}</div>
              <div className="text-[11px] text-slate-500">{t.sub}</div>
            </div>
          );
        })}
      </div>

      {helps.length === 0 ? (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-800">
          Ninguém precisou pedir ajuda até agora. Bom sinal de que as telas estão claras.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-700">Telas que mais geraram pedidos de ajuda</div>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
            {sum.byScreen.map((r) => {
              const rate = r.helps ? Math.round((r.resolved / r.helps) * 100) : 0;
              const signal =
                rate < 50
                  ? { text: 'Ajuda não resolveu: revisar interface', tone: 'bg-rose-50 text-rose-700' }
                  : r.people >= 2 || r.helps >= 3
                  ? { text: 'Ponto de fricção recorrente', tone: 'bg-amber-50 text-amber-800' }
                  : { text: 'Dúvida pontual', tone: 'bg-slate-100 text-slate-600' };
              return (
                <div key={r.screenId} className="p-3.5 grid grid-cols-1 md:grid-cols-[1.3fr_auto_2fr] gap-3 items-start bg-white">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{r.screenName}</div>
                    <span className={`inline-flex mt-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${signal.tone}`}>
                      {rate < 50 && <AlertTriangle className="w-3 h-3 mr-1" />}
                      {signal.text}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-slate-600">
                    <div>
                      <div className="text-base font-bold text-slate-900">{r.helps}</div>pedidos
                    </div>
                    <div>
                      <div className="text-base font-bold text-slate-900">{r.people}</div>pessoa(s)
                    </div>
                    <div>
                      <div className={`text-base font-bold ${rate >= 50 ? 'text-emerald-600' : 'text-rose-600'}`}>{rate}%</div>resolvidos
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.questions.map((q) => (
                      <span key={q} className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
                        “{q}”
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold text-violet-700 hover:text-violet-800">Ver todos os {helps.length} pedidos</summary>
            <div className="mt-2 space-y-2">
              {helps.map((h, i) => (
                <div key={i} className="p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-slate-500">
                    <button type="button" onClick={() => onOpenParticipant?.(h.participantKey)} className="font-semibold text-slate-800 hover:text-blue-600">
                      {h.participantNumber ? `#${String(h.participantNumber).padStart(2, '0')} ` : ''}
                      {h.participantName}
                    </button>
                    <span>· {h.screenName}</span>
                    {h.taskTitle && <span>· {h.taskTitle}</span>}
                    <span className={`ml-auto px-2 py-0.5 rounded-md font-semibold ${h.resolved ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                      {OUTCOME_LABEL[h.outcome]}
                      {h.secondsToProgress !== undefined ? ` em ${h.secondsToProgress}s` : ''}
                    </span>
                  </div>
                  <div className="text-slate-800">“{h.question}”</div>
                  <div className="text-violet-700 whitespace-pre-line">↳ {h.answer.replace(/\*\*/g, '')}</div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
};
