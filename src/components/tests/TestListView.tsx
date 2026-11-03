import React, { useState } from 'react';
import { UsabilityTest, TestStatus } from '../../types';
import { getShareableTestUrl } from '../../utils/figmaUtils';
import {
  Search,
  Plus,
  ArrowRight,
  Play,
  Share2,
  Check,
  Calendar,
  Users,
  Award,
  Sparkles,
  Filter
} from 'lucide-react';

interface TestListViewProps {
  tests: UsabilityTest[];
  onNavigate: (view: string, testId?: string) => void;
  onOpenRunner: (testId: string) => void;
}

export const TestListView: React.FC<TestListViewProps> = ({
  tests,
  onNavigate,
  onOpenRunner
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredTests = tests.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.researchGoal.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = selectedStatus === 'all' || t.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const copyShareLink = (testId: string, customProto?: string) => {
    const url = getShareableTestUrl(testId, customProto);
    navigator.clipboard.writeText(url);
    setCopiedId(testId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (status: TestStatus) => {
    switch (status) {
      case 'Em andamento':
        return 'bg-blue-50 text-blue-700 border border-blue-200/80';
      case 'Publicado':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200/80';
      case 'Finalizado':
        return 'bg-purple-50 text-purple-700 border border-purple-200/80';
      case 'Rascunho':
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Testes de Usabilidade
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Gerencie estudos, configure tarefas e acompanhe resultados agregados.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('create-test')}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 transition-all self-start sm:self-auto shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>+ Criar teste</span>
        </button>
      </div>

      {/* Filters Bar (Maze / SaaS search & status pill bar) */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, produto, ID..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1 pr-1">
            <Filter className="w-3 h-3" />
            Status:
          </span>
          {['all', 'Em andamento', 'Publicado', 'Finalizado', 'Rascunho'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedStatus === st
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {st === 'all' ? 'Todos' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Tests Grid/List */}
      <div className="space-y-3">
        {filteredTests.map((test) => (
          <div
            key={test.id}
            className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-300 hover:shadow-xs transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(test.status)}`}>
                  {test.status}
                </span>
                <span className="text-xs font-mono font-bold text-blue-600">
                  {test.id}
                </span>
                <span className="text-xs text-slate-300">•</span>
                <span className="text-xs font-medium text-slate-700">
                  {test.productName}
                </span>
                <span className="text-xs text-slate-300">•</span>
                <span className="text-xs text-slate-600">
                  Pesquisador: {test.researcherName}
                </span>
              </div>

              <div>
                <h3
                  onClick={() => onNavigate('test-detail', test.id)}
                  className="text-base font-bold text-slate-900 hover:text-blue-600 cursor-pointer transition-colors truncate"
                >
                  {test.name}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                  {test.description}
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap pt-0.5">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-slate-600" />
                  {test.totalParticipants} participantes
                </span>
                <span>•</span>
                <span>{test.tasks.length} tarefas</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-600" />
                  Criado em: {new Date(test.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>

            {/* Metrics & Action Buttons */}
            <div className="flex items-center justify-between lg:justify-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
              {test.totalParticipants > 0 ? (
                <div className="flex items-center gap-4 text-center pr-3 border-r border-slate-200">
                  <div>
                    <div className="text-[10px] font-semibold text-slate-600 uppercase">Sucesso</div>
                    <div className="text-xs font-bold text-emerald-700">
                      {test.averageSuccessRate}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-slate-600 uppercase">SUS</div>
                    <div className="text-xs font-bold text-amber-700">
                      {test.averageSusScore}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-600 pr-3 italic">
                  Sem sessões ainda
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyShareLink(test.id, test.prototypeUrl)}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors shadow-xs"
                  title="Copiar link de participante (/share/...)"
                >
                  {copiedId === test.id ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onOpenRunner(test.id)}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-all shadow-xs"
                  title="Executar fluxo de participante"
                >
                  <Play className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden sm:inline">Executar</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('test-detail', test.id)}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <span>Resultados</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredTests.length === 0 && (
          <div className="p-10 text-center rounded-2xl bg-white border border-slate-200 text-xs text-slate-600">
            Nenhum teste encontrado para os critérios selecionados.
          </div>
        )}
      </div>
    </div>
  );
};
