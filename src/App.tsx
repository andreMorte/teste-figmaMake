import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { DashboardView } from './components/dashboard/DashboardView';
import { TestListView } from './components/tests/TestListView';
import { CreateTestWizard } from './components/tests/CreateTestWizard';
import { TestDetailLayout } from './components/tests/TestDetailLayout';
import { ParticipantRunner } from './components/runner/ParticipantRunner';
import { ValidationEngineView } from './components/validation/ValidationEngineView';
import { UsabilityTest } from './types';
import { getTests } from './services/dataService';
import { FigmaMakeExportModal } from './components/export/FigmaMakeExportModal';
import { FolderArchive, Download } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<
    'dashboard' | 'tests' | 'test-detail' | 'create-test' | 'runner' | 'engine-validation'
  >('dashboard');

  const [tests, setTests] = useState<UsabilityTest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>('TEST-U92DU');
  const [runnerTestId, setRunnerTestId] = useState<string>('TEST-U92DU');
  const [runnerPrototypeUrl, setRunnerPrototypeUrl] = useState<string>('');
  const [serverOnline, setServerOnline] = useState<boolean>(true);
  const [isExportFigmaModalOpen, setIsExportFigmaModalOpen] = useState<boolean>(false);

  // Validation engine custom launch parameters
  const [validationParams, setValidationParams] = useState<{
    prototypeUrl?: string;
    testId?: string;
    trackingId?: string;
  }>({});

  // Fetch tests, verify server status and check for incoming ?test= URL parameter
  useEffect(() => {
    async function init() {
      try {
        const t = await getTests();
        setTests(t);
      } catch (err) {
        console.warn('Failed to load initial tests', err);
      }

      // Check if URL has a test link parameter (e.g. ?test=TEST-8F72A or /run/TEST-8F72A)
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const testFromQuery = params.get('test') || params.get('run') || params.get('share') || params.get('runner');
        const protoFromQuery = params.get('p') || params.get('proto') || params.get('prototype');
        if (protoFromQuery) {
          setRunnerPrototypeUrl(protoFromQuery);
        }
        if (testFromQuery) {
          setRunnerTestId(testFromQuery);
          setSelectedTestId(testFromQuery);
          setCurrentView('runner');
        } else if (window.location.pathname.startsWith('/run/')) {
          const pathId = window.location.pathname.replace('/run/', '').trim();
          if (pathId) {
            setRunnerTestId(pathId);
            setSelectedTestId(pathId);
            setCurrentView('runner');
          }
        } else if (window.location.pathname.startsWith('/share/')) {
          const pathId = window.location.pathname.replace('/share/', '').trim();
          if (pathId) {
            setRunnerTestId(pathId);
            setSelectedTestId(pathId);
            setCurrentView('runner');
          }
        }
      }

      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          setServerOnline(data.status === 'ok');
        }
      } catch {
        setServerOnline(false);
      }
    }
    init();
  }, []);

  // Reload tests when returning to dashboard or test list
  const refreshTests = async () => {
    const updated = await getTests();
    setTests(updated);
  };

  const handleNavigate = (view: string, testId?: string) => {
    if (testId) {
      setSelectedTestId(testId);
    }
    setCurrentView(view as any);
    refreshTests();
  };

  const handleOpenRunner = (testId: string, customPrototypeUrl?: string) => {
    setRunnerTestId(testId);
    if (customPrototypeUrl) {
      setRunnerPrototypeUrl(customPrototypeUrl);
    }
    setCurrentView('runner');
  };

  const handleOpenValidationEngine = (
    prototypeUrl?: string,
    testId?: string,
    trackingId?: string
  ) => {
    setValidationParams({ prototypeUrl, testId, trackingId });
    setCurrentView('engine-validation');
  };

  // If in participant runner mode, render full-screen runner without researcher header
  if (currentView === 'runner') {
    return (
      <ParticipantRunner
        testId={runnerTestId}
        overridePrototypeUrl={runnerPrototypeUrl}
        onExit={() => {
          refreshTests();
          setCurrentView('test-detail');
          setSelectedTestId(runnerTestId);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col md:flex-row font-sans antialiased selection:bg-blue-500/20 selection:text-blue-900">
      {/* Platform Left Navigation Rail */}
      <Navigation
        currentView={currentView}
        onNavigate={handleNavigate}
        serverOnline={serverOnline}
        activeTestId={selectedTestId}
        onOpenExportFigma={() => setIsExportFigmaModalOpen(true)}
      />

      {/* Main App Workspace Container */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Top Header Bar (Desktop & Tablet) */}
        <header className="hidden md:flex items-center justify-between h-16 px-6 lg:px-8 bg-white/85 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-600">Workspace</span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {currentView === 'dashboard' && 'Dashboard Geral'}
              {currentView === 'tests' && 'Estudos & Testes'}
              {currentView === 'create-test' && 'Criador de Teste'}
              {currentView === 'test-detail' && `Resultados (${selectedTestId})`}
              {currentView === 'engine-validation' && 'Engine de Validação Runtime'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input Box */}
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Buscar estudos, tarefas..."
                onClick={() => {
                  if (currentView !== 'tests') handleNavigate('tests');
                }}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-800 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all cursor-pointer"
              />
              <svg className="w-3.5 h-3.5 text-slate-600 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Export Figma Make (.zip) Button */}
            <button
              type="button"
              onClick={() => setIsExportFigmaModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500/10 to-indigo-500/10 hover:from-purple-500/20 hover:to-indigo-500/20 text-purple-700 text-xs font-semibold border border-purple-200/80 shadow-xs flex items-center gap-1.5 transition-all"
              title="Exportar código React/Vite completo do protótipo em arquivo .zip para Figma Make"
            >
              <FolderArchive className="w-3.5 h-3.5 text-purple-600" />
              <span>Exportar Figma Make (.zip)</span>
            </button>

            {/* Quick Create Test Button */}
            {currentView !== 'create-test' && (
              <button
                type="button"
                onClick={() => handleNavigate('create-test')}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
              >
                <span>+ Criar Teste</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Content View */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          {currentView === 'dashboard' && (
            <DashboardView
              tests={tests}
              onNavigate={handleNavigate}
              onOpenRunner={handleOpenRunner}
            />
          )}

          {currentView === 'tests' && (
            <TestListView
              tests={tests}
              onNavigate={handleNavigate}
              onOpenRunner={handleOpenRunner}
            />
          )}

          {currentView === 'create-test' && (
            <CreateTestWizard
              onSuccess={(newTest) => {
                refreshTests();
                setSelectedTestId(newTest.id);
                setCurrentView('test-detail');
              }}
              onCancel={() => setCurrentView('dashboard')}
              onOpenRunner={handleOpenRunner}
            />
          )}

          {currentView === 'test-detail' && (
            <TestDetailLayout
              testId={selectedTestId}
              onNavigate={handleNavigate}
              onOpenRunner={handleOpenRunner}
              onOpenValidationEngine={handleOpenValidationEngine}
            />
          )}

          {currentView === 'engine-validation' && (
            <ValidationEngineView
              initialUrl={validationParams.prototypeUrl}
              initialTestId={validationParams.testId}
              initialTrackingId={validationParams.trackingId}
              onBackToDashboard={() => setCurrentView('dashboard')}
            />
          )}
        </main>
      </div>

      {/* Modal de Exportação para Figma Make (.zip) */}
      {isExportFigmaModalOpen && (
        <FigmaMakeExportModal
          onClose={() => setIsExportFigmaModalOpen(false)}
          tests={tests}
          activeTestId={selectedTestId}
        />
      )}
    </div>
  );
}
