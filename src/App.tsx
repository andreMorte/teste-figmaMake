import React, { useState, useEffect } from 'react';
import { CreateTestWizard } from './components/tests/CreateTestWizard';
import { TestDetailLayout } from './components/tests/TestDetailLayout';
import { ParticipantRunner } from './components/runner/ParticipantRunner';
import { HomeView } from './components/home/HomeView';
import { ParticipantDetail } from './components/participants/ParticipantDetail';
import { UsabilityTest } from './types';
import { getTests, deleteTest } from './services/dataService';
import { FlaskConical, Plus, ChevronRight } from 'lucide-react';

type View = 'home' | 'create-test' | 'test-detail' | 'participant' | 'runner';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [tests, setTests] = useState<UsabilityTest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [runnerTestId, setRunnerTestId] = useState<string>('');
  const [runnerPrototypeUrl, setRunnerPrototypeUrl] = useState<string>('');
  const [serverOnline, setServerOnline] = useState<boolean>(true);
  const [loaded, setLoaded] = useState(false);
  const [participantKey, setParticipantKey] = useState<string>('');
  const [participantName, setParticipantName] = useState<string>('');

  // Carrega os testes e detecta link de participante (/run/ID ou ?test=ID)
  useEffect(() => {
    async function init() {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const testFromQuery = params.get('test') || params.get('run') || params.get('share') || params.get('runner');
        const protoFromQuery = params.get('p') || params.get('proto') || params.get('prototype');
        if (protoFromQuery) setRunnerPrototypeUrl(protoFromQuery);
        const pathMatch = window.location.pathname.match(/^\/(?:run|share)\/([^/]+)/);
        const runId = testFromQuery || (pathMatch ? decodeURIComponent(pathMatch[1]) : '');
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
    refreshTests();
  };

  const openTest = (id: string) => {
    setSelectedTestId(id);
    setCurrentView('test-detail');
  };

  const openParticipant = (key: string) => {
    setParticipantKey(key);
    setCurrentView('participant');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  };

  // Tela do participante: só o protótipo
  if (currentView === 'runner') {
    return (
      <ParticipantRunner
        testId={runnerTestId}
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
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
          <button type="button" onClick={goHome} className="flex items-center gap-2 shrink-0" title="Ir para os testes">
            <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <FlaskConical className="w-4 h-4" />
            </span>
            <span className="text-sm font-semibold text-slate-900">UX Test Lab</span>
          </button>

          {/* Caminho atual (heurística: visibilidade e liberdade para voltar) */}
          <nav className="flex items-center gap-1 text-sm text-slate-500 min-w-0">
            <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            <button type="button" onClick={goHome} className={`hover:text-slate-900 ${currentView === 'home' ? 'text-slate-900 font-medium' : ''}`}>
              Testes
            </button>
            {currentView === 'create-test' && (
              <>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                <span className="text-slate-900 font-medium">Novo teste</span>
              </>
            )}
            {(currentView === 'test-detail' || currentView === 'participant') && (
              <>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                {currentView === 'participant' ? (
                  <button type="button" onClick={() => setCurrentView('test-detail')} className="hover:text-slate-900 truncate">
                    {selectedTest?.name || selectedTestId}
                  </button>
                ) : (
                  <span className="text-slate-900 font-medium truncate">{selectedTest?.name || selectedTestId}</span>
                )}
              </>
            )}
            {currentView === 'participant' && (
              <>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                <span className="text-slate-900 font-medium truncate">{participantName || 'Participante'}</span>
              </>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {!serverOnline && <span className="text-xs text-rose-600 font-medium">Servidor indisponível</span>}
            {currentView !== 'create-test' && currentView !== 'home' && (
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

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {currentView === 'home' &&
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

        {currentView === 'create-test' && (
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

        {currentView === 'test-detail' && selectedTestId && (
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
            onOpenParticipant={openParticipant}
          />
        )}

        {currentView === 'participant' && selectedTestId && participantKey && (
          <ParticipantDetail
            testId={selectedTestId}
            participantKey={participantKey}
            onBack={() => setCurrentView('test-detail')}
            onOpenParticipant={openParticipant}
            onName={setParticipantName}
          />
        )}
      </main>
    </div>
  );
}
