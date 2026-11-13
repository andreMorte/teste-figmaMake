import React, { useState, useEffect } from 'react';
import { CreateTestWizard } from './components/tests/CreateTestWizard';
import { TestDetailLayout } from './components/tests/TestDetailLayout';
import { ParticipantRunner } from './components/runner/ParticipantRunner';
import { HomeView } from './components/home/HomeView';
import { ParticipantDetail } from './components/participants/ParticipantDetail';
import { QualitativeAnalysis } from './components/analytics/QualitativeAnalysis';
import { UsabilityTest } from './types';
import { getTests, deleteTest } from './services/dataService';
import { FlaskConical, Plus, ChevronRight, LayoutList, ScanEye, ClipboardList } from 'lucide-react';
import { VisualApp } from './visual/VisualApp';

type View = 'home' | 'create-test' | 'edit-test' | 'test-detail' | 'participant' | 'qualitative' | 'runner';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  // Seções do topo: testes de usabilidade | Raio-X da interface (análise visual do protótipo)
  const [section, setSection] = useState<'tests' | 'visual'>(() => (typeof window !== 'undefined' && window.location.hash.startsWith('#raio-x') ? 'visual' : 'tests'));
  const openSection = (next: 'tests' | 'visual') => {
    if (next === section) {
      if (next === 'tests') requestHome();
      return;
    }
    if (next === 'tests' && typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (next === 'visual' && (currentView === 'create-test' || currentView === 'edit-test')) {
      setLeaveConfirm(true);
      setPendingSection(true);
      return;
    }
    setSection(next);
    if (next === 'tests') goHome();
  };
  const [pendingSection, setPendingSection] = useState(false);
  const [tests, setTests] = useState<UsabilityTest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [runnerTestId, setRunnerTestId] = useState<string>('');
  const [runnerPrototypeUrl, setRunnerPrototypeUrl] = useState<string>('');
  const [runnerPreview, setRunnerPreview] = useState(false); // link de teste do design (nada é registrado)
  const [serverOnline, setServerOnline] = useState<boolean>(true);
  const [loaded, setLoaded] = useState(false);
  const [participantKey, setParticipantKey] = useState<string>('');
  const [participantName, setParticipantName] = useState<string>('');
  const [editingTest, setEditingTest] = useState<UsabilityTest | null>(null);

  // Carrega os testes e detecta link de participante (/run/ID ou ?test=ID)
  useEffect(() => {
    async function init() {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const testFromQuery = params.get('test') || params.get('run') || params.get('share') || params.get('runner');
        const protoFromQuery = params.get('p') || params.get('proto') || params.get('prototype');
        if (protoFromQuery) setRunnerPrototypeUrl(protoFromQuery);
        const pathMatch = window.location.pathname.match(/^\/(run|share|revisao)\/([^/]+)/);
        const runId = testFromQuery || (pathMatch ? decodeURIComponent(pathMatch[2]) : '');
        if (pathMatch?.[1] === 'revisao' || params.has('revisao')) setRunnerPreview(true);
        if (runId) {
          setRunnerTestId(runId);
          setCurrentView('runner');
          return; // o participante não precisa carregar o painel
        }
      }
      try {
        setTests(await getTests());
      } catch (err) {
        console.warn('Falha ao carregar testes', err);
      }
      setLoaded(true);
      try {
        const res = await fetch('/api/health');
        setServerOnline(res.ok);
      } catch {
        setServerOnline(false);
      }
    }
    init();
  }, []);

  const refreshTests = async () => setTests(await getTests());

  const goHome = () => {
    setCurrentView('home');
    setLeaveConfirm(false);
    if (pendingSection) {
      setPendingSection(false);
      setSection('visual');
    }
    refreshTests();
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  };

  // Voltar para a lista de testes de qualquer página. Na criação, confirma antes (o teste ainda não foi salvo).
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const requestHome = () => {
    if (currentView === 'create-test' || currentView === 'edit-test') setLeaveConfirm(true);
    else goHome();
  };

  const openTest = (id: string) => {
    setSelectedTestId(id);
    setCurrentView('test-detail');
  };

  const [participantReturn, setParticipantReturn] = useState<View>('test-detail');
  const openParticipant = (key: string) => {
    if (currentView !== 'participant') setParticipantReturn(currentView === 'qualitative' ? 'qualitative' : 'test-detail');
    setParticipantKey(key);
    setCurrentView('participant');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  };

  // Tela do participante: só o protótipo
  if (currentView === 'runner') {
    return (
      <ParticipantRunner
        testId={runnerTestId}
        preview={runnerPreview}
        overridePrototypeUrl={runnerPrototypeUrl}
        onExit={() => {
          refreshTests();
          openTest(runnerTestId);
        }}
      />
    );
  }

  const selectedTest = tests.find((t) => t.id === selectedTestId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased">
      {/* Barra superior mínima: marca, onde estou, ação principal */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200 print:hidden">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
          <button type="button" onClick={requestHome} className="flex items-center gap-2 shrink-0" title="Ir para os testes">
            <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <FlaskConical className="w-4 h-4" />
            </span>
            <span className="text-sm font-semibold text-slate-900">UX Test Lab</span>
          </button>

          {/* Menu principal */}
          <nav className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 shrink-0" aria-label="Seções">
            <button
              type="button"
              onClick={() => openSection('tests')}
              aria-current={section === 'tests' ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${section === 'tests' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <ClipboardList className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Testes de usabilidade</span><span className="sm:hidden">Testes</span>
            </button>
            <button
              type="button"
              onClick={() => openSection('visual')}
              aria-current={section === 'visual' ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${section === 'visual' ? 'bg-white text-violet-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <ScanEye className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Raio-X da interface</span><span className="sm:hidden">Raio-X</span>
            </button>
          </nav>

          {/* Caminho atual (heurística: visibilidade e liberdade para voltar) */}
          {section === 'tests' && (
          <nav className="hidden md:flex items-center gap-1 text-sm text-slate-500 min-w-0">
            <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            <button type="button" onClick={requestHome} className={`hover:text-slate-900 ${currentView === 'home' ? 'text-slate-900 font-medium' : ''}`}>
              Testes
            </button>
            {section === 'tests' && currentView === 'create-test' && (
              <>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                <span className="text-slate-900 font-medium">Novo teste</span>
              </>
            )}
            {currentView === 'edit-test' && (
              <>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                <button type="button" onClick={() => setLeaveConfirm(true)} className="hover:text-slate-900 truncate">
                  {editingTest?.name}
                </button>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                <span className="text-slate-900 font-medium">Editar</span>
              </>
            )}
            {(currentView === 'test-detail' || currentView === 'participant' || currentView === 'qualitative') && (
              <>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                {currentView !== 'test-detail' ? (
                  <button type="button" onClick={() => setCurrentView('test-detail')} className="hover:text-slate-900 truncate">
                    {selectedTest?.name || selectedTestId}
                  </button>
                ) : (
                  <span className="text-slate-900 font-medium truncate">{selectedTest?.name || selectedTestId}</span>
                )}
              </>
            )}
            {currentView === 'qualitative' && (
              <>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                <span className="text-slate-900 font-medium truncate">Análise qualitativa</span>
              </>
            )}
            {currentView === 'participant' && (
              <>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                <span className="text-slate-900 font-medium truncate">{participantName || 'Participante'}</span>
              </>
            )}
          </nav>
          )}

          <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
            {!serverOnline && <span className="text-xs text-rose-600 font-medium">Servidor indisponível</span>}
            {section === 'tests' && currentView !== 'home' && (
              <button
                type="button"
                onClick={requestHome}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
                title="Voltar para a lista de todos os testes"
                aria-label="Todos os testes"
              >
                <LayoutList className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Todos os testes</span>
              </button>
            )}
            {section === 'tests' && currentView !== 'create-test' && currentView !== 'edit-test' && currentView !== 'home' && (
              <button
                type="button"
                onClick={() => setCurrentView('create-test')}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Criar teste
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 print:p-0 print:max-w-none">
        {section === 'visual' && <VisualApp />}
        {section === 'tests' && currentView === 'home' &&
          (loaded ? (
            <HomeView
              tests={tests}
              onCreate={() => setCurrentView('create-test')}
              onOpen={openTest}
              onDelete={async (id) => {
                await deleteTest(id);
                await refreshTests();
              }}
            />
          ) : (
            <div className="py-24 text-center text-sm text-slate-400">Carregando testes...</div>
          ))}

        {section === 'tests' && currentView === 'create-test' && (
          <CreateTestWizard
            onSuccess={async (newTest) => {
              await refreshTests();
              openTest(newTest.id);
            }}
            onCancel={goHome}
            onOpenRunner={(id, proto) => {
              setRunnerTestId(id);
              if (proto) setRunnerPrototypeUrl(proto);
              setCurrentView('runner');
            }}
          />
        )}

        {section === 'tests' && currentView === 'edit-test' && editingTest && (
          <CreateTestWizard
            key={editingTest.id}
            editTest={editingTest}
            onSuccess={async (saved) => {
              await refreshTests();
              setEditingTest(null);
              openTest(saved.id);
            }}
            onCancel={() => {
              setEditingTest(null);
              openTest(editingTest.id);
            }}
            onOpenRunner={() => {}}
          />
        )}

        {section === 'tests' && currentView === 'test-detail' && selectedTestId && (
          <TestDetailLayout
            testId={selectedTestId}
            onNavigate={(view, id) => {
              if (id) setSelectedTestId(id);
              if (view === 'create-test') setCurrentView('create-test');
              else if (view === 'test-detail') setCurrentView('test-detail');
              else goHome();
            }}
            onOpenRunner={(id, proto) => {
              setRunnerTestId(id);
              if (proto) setRunnerPrototypeUrl(proto);
              setCurrentView('runner');
            }}
            onOpenValidationEngine={() => {}}
            onEdit={(t) => {
              setEditingTest(t);
              setCurrentView('edit-test');
              window.scrollTo({ top: 0 });
            }}
            onOpenParticipant={openParticipant}
            onOpenQualitative={() => {
              setCurrentView('qualitative');
              window.scrollTo({ top: 0 });
            }}
          />
        )}

        {section === 'tests' && currentView === 'qualitative' && selectedTestId && (
          <QualitativeAnalysis
            testId={selectedTestId}
            testName={selectedTest?.name}
            onBack={() => setCurrentView('test-detail')}
            onOpenParticipant={openParticipant}
          />
        )}

        {section === 'tests' && currentView === 'participant' && selectedTestId && participantKey && (
          <ParticipantDetail
            testId={selectedTestId}
            participantKey={participantKey}
            onBack={() => setCurrentView(participantReturn)}
            onOpenParticipant={openParticipant}
            onName={setParticipantName}
          />
        )}
      </main>

      {leaveConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => (setLeaveConfirm(false), setPendingSection(false))}>
          <div role="dialog" aria-modal="true" className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-1">
              <div className="text-base font-semibold text-slate-900">{currentView === 'edit-test' ? 'Sair sem salvar as alterações?' : 'Sair da criação do teste?'}</div>
              <p className="text-sm text-slate-500">
                {currentView === 'edit-test' ? 'O teste continua como estava; o que você mudou agora será descartado.' : 'O teste ainda não foi publicado. O que você preencheu até agora será perdido.'}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" autoFocus onClick={() => setLeaveConfirm(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100">
                {currentView === 'edit-test' ? 'Continuar editando' : 'Continuar criando'}
              </button>
              <button type="button" onClick={goHome} className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800">
                Sair sem salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
