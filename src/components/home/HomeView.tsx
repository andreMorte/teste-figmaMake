import React, { useEffect, useMemo, useState } from 'react';
import { UsabilityTest } from '../../types';
import { getShareableTestUrl } from '../../utils/figmaUtils';
import { Search, Plus, Link2, Check, Users, ArrowRight, Trash2, ScanSearch, Send, BarChart3, CalendarDays, ListChecks, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface HomeViewProps {
  tests: UsabilityTest[];
  onCreate: () => void;
  onOpen: (testId: string) => void;
  onDelete: (testId: string) => Promise<void>;
}

type Phase = 'waiting' | 'running' | 'done';

/** Situação do teste em linguagem do pesquisador (heurística: correspondência com o mundo real). */
function phaseOf(t: UsabilityTest): Phase {
  if (t.status === 'Finalizado') return 'done';
  if ((t.totalParticipants || 0) > 0) return 'running';
  return 'waiting';
}

const PHASE: Record<Phase, { label: string; dot: string; text: string }> = {
  waiting: { label: 'Aguardando participantes', dot: 'bg-slate-400', text: 'text-slate-600' },
  running: { label: 'Em andamento', dot: 'bg-blue-500', text: 'text-blue-700' },
  done: { label: 'Finalizado', dot: 'bg-emerald-500', text: 'text-emerald-700' }
};

const FILTERS: { key: 'all' | Phase; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'waiting', label: 'Aguardando' },
  { key: 'running', label: 'Em andamento' },
  { key: 'done', label: 'Finalizados' }
];

export const HomeView: React.FC<HomeViewProps> = ({ tests, onCreate, onOpen, onDelete }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | Phase>('all');
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UsabilityTest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  const sorted = useMemo(
    () => [...tests].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [tests]
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: sorted.length, waiting: 0, running: 0, done: 0 };
    sorted.forEach((t) => (c[phaseOf(t)] += 1));
    return c;
  }, [sorted]);
  const visible = sorted.filter((t) => {
    if (filter !== 'all' && phaseOf(t) !== filter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [t.name, t.id, t.productName, t.researchGoal].some((v) => (v || '').toLowerCase().includes(q));
  });

  // Paginação: 10 testes por página; volta para a 1ª ao buscar/filtrar e não fica em página vazia após excluir
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  useEffect(() => setPage(1), [query, filter]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const current = Math.min(page, totalPages);
  const pageItems = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const goTo = (p: number) => {
    setPage(Math.min(totalPages, Math.max(1, p)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const pageNumbers = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const set = new Set([1, totalPages, current - 1, current, current + 1].filter((n) => n >= 1 && n <= totalPages));
    const sortedNums = [...set].sort((a, b) => a - b);
    const out: (number | '…')[] = [];
    sortedNums.forEach((n, i) => {
      if (i > 0 && n - sortedNums[i - 1] > 1) out.push('…');
      out.push(n);
    });
    return out;
  })();

  const copyLink = (e: React.MouseEvent, t: UsabilityTest) => {
    e.stopPropagation();
    navigator.clipboard.writeText(getShareableTestUrl(t.id));
    setCopied(t.id);
    setTimeout(() => setCopied(null), 2000);
  };

  // Estado vazio: explica o fluxo em 3 passos (heurística: ajuda e documentação)
  if (tests.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Crie seu primeiro teste de usabilidade</h1>
          <p className="text-sm text-slate-500">Em poucos minutos você mapeia o protótipo, envia o link e acompanha o comportamento real das pessoas.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 text-left">
          {[
            { icon: ScanSearch, title: 'Mapeie o protótipo', text: 'Navegue no Figma Make e grave o caminho esperado de cada tarefa.' },
            { icon: Send, title: 'Envie o link', text: 'Cada participante informa o nome e faz as tarefas no protótipo.' },
            { icon: BarChart3, title: 'Analise', text: 'Jornada, heatmap, tempos e SUS de cada pessoa e do time.' }
          ].map((s, i) => (
            <div key={s.title} className="p-5 rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <span>{i + 1}</span>
                <s.icon className="w-4 h-4 text-blue-600" />
              </div>
              <div className="mt-3 text-sm font-semibold text-slate-900">{s.title}</div>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
        <button type="button" onClick={onCreate} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Criar teste
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Testes de usabilidade</h1>
          <p className="text-sm text-slate-500 mt-1">Abra um teste para ver jornada, heatmap e métricas de cada participante.</p>
        </div>
        <button type="button" onClick={onCreate} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2 self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Criar teste
        </button>
      </div>

      {/* Busca e filtros */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou código"
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border border-slate-200 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700" title="Limpar busca">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start overflow-x-auto max-w-full">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f.key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {f.label} <span className="text-slate-400">{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {visible.length === 0 && (
          <div className="p-10 text-center text-sm text-slate-500">
            Nenhum teste encontrado{query ? ` para “${query}”` : ''}.{' '}
            <button type="button" onClick={() => { setQuery(''); setFilter('all'); }} className="text-blue-600 font-medium hover:underline">
              Mostrar todos
            </button>
          </div>
        )}
        {pageItems.map((t) => {
          const phase = PHASE[phaseOf(t)];
          const limit = t.participantLimit || 0;
          const done = t.totalParticipants || 0;
          return (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(t.id)}
              onKeyDown={(e) => e.key === 'Enter' && onOpen(t.id)}
              className="group flex flex-col md:flex-row md:items-center gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer outline-none focus-visible:bg-blue-50"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full ${phase.dot}`} />
                  <span className={`font-medium ${phase.text}`}>{phase.label}</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono text-slate-400">{t.id}</span>
                </div>
                <div className="text-base font-semibold text-slate-900 truncate">{t.name}</div>
                <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                  <span className="inline-flex items-center gap-1"><ListChecks className="w-3.5 h-3.5" /> {t.tasks.length} {t.tasks.length === 1 ? 'tarefa' : 'tarefas'}</span>
                  <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {t.createdAt ? new Date(t.createdAt).toLocaleDateString('pt-BR') : '—'}</span>
                  {!(t.screenMap && t.screenMap.length) && <span className="text-amber-600">sem mapeamento</span>}
                </div>
              </div>

              {/* Participação (visibilidade do status) */}
              <div className="md:w-48 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 text-slate-500"><Users className="w-3.5 h-3.5" /> Participantes</span>
                  <span className="font-semibold text-slate-800">{limit ? `${done} de ${limit}` : done}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${phaseOf(t) === 'done' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                    style={{ width: `${limit ? Math.min(100, (done / limit) * 100) : done ? 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 md:justify-end">
                <button
                  type="button"
                  onClick={(e) => copyLink(e, t)}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 inline-flex items-center gap-1.5"
                  title="Copiar o link para enviar aos participantes"
                >
                  {copied === t.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Link2 className="w-3.5 h-3.5" />}
                  {copied === t.id ? 'Link copiado' : 'Copiar link'}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(t);
                  }}
                  className="p-2 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 focus:opacity-100"
                  title="Excluir teste"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <span className="p-2 text-slate-300 group-hover:text-blue-600">
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {visible.length > PAGE_SIZE && (
        <nav className="flex flex-col sm:flex-row items-center justify-between gap-3" aria-label="Paginação dos testes">
          <div className="text-xs text-slate-500">
            Mostrando <b className="text-slate-700">{(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, visible.length)}</b> de{' '}
            <b className="text-slate-700">{visible.length}</b> testes
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goTo(current - 1)}
              disabled={current === 1}
              className="inline-flex items-center gap-1 px-3 h-9 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" /> <span className="hidden sm:inline">Anterior</span>
            </button>
            {pageNumbers.map((n, i) =>
              n === '…' ? (
                <span key={`e${i}`} className="w-9 text-center text-xs text-slate-400">…</span>
              ) : (
                <button
                  key={n}
                  type="button"
                  onClick={() => goTo(n)}
                  aria-current={n === current ? 'page' : undefined}
                  className={`w-9 h-9 rounded-lg text-xs font-semibold ${n === current ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {n}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => goTo(current + 1)}
              disabled={current === totalPages}
              className="inline-flex items-center gap-1 px-3 h-9 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Próxima página"
            >
              <span className="hidden sm:inline">Próxima</span> <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </nav>
      )}

      {/* Confirmação de exclusão (heurística: prevenção de erros) */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => !deleting && setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-1">
              <div className="text-base font-semibold text-slate-900">Excluir “{confirmDelete.name}”?</div>
              <p className="text-sm text-slate-500">
                O teste, os {confirmDelete.totalParticipants || 0} participante(s), os prints e o heatmap serão apagados. Essa ação não pode ser desfeita.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" disabled={deleting} onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100">
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await onDelete(confirmDelete.id);
                    setConfirmDelete(null);
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? 'Excluindo...' : 'Excluir teste'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
