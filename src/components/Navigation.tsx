import React from 'react';
import {
  LayoutDashboard,
  FileCheck2,
  PlusCircle,
  ShieldCheck,
  FlaskConical,
  Settings,
  Sparkles,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Menu,
  X,
  FolderArchive
} from 'lucide-react';

interface NavigationProps {
  currentView: string;
  onNavigate: (view: string, testId?: string) => void;
  serverOnline: boolean;
  activeTestId?: string;
  onOpenExportFigma?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentView,
  onNavigate,
  serverOnline,
  activeTestId,
  onOpenExportFigma
}) => {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      view: 'dashboard',
      badge: undefined
    },
    {
      id: 'tests',
      label: 'Testes',
      icon: FileCheck2,
      view: 'tests',
      activeViews: ['tests', 'test-detail'],
      badge: undefined
    },
    {
      id: 'create-test',
      label: 'Criar Teste',
      icon: PlusCircle,
      view: 'create-test',
      highlight: true
    },
    {
      id: 'engine-validation',
      label: 'Validador Runtime',
      icon: ShieldCheck,
      view: 'engine-validation',
      badge: 'Figma Make'
    }
  ];

  const handleItemClick = (view: string) => {
    onNavigate(view);
    setMobileOpen(false);
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* DESKTOP VERTICAL NAVIGATION RAIL (As shown in user's reference print)     */}
      {/* ========================================================================= */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-white border-r border-slate-200/90 min-h-screen sticky top-0 h-screen z-30">
        {/* Brand / Logo Header */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-100 cursor-pointer" onClick={() => onNavigate('dashboard')}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs shadow-blue-500/20 shrink-0">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 text-sm tracking-tight truncate">
                UX Test Lab
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 shrink-0">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-600 truncate">
              Maze-inspired Platform
            </p>
          </div>
        </div>

        {/* Workspace Selector Pill (Reference from uploaded print) */}
        <div className="px-3 pt-4 pb-2">
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-700 font-medium">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate font-semibold text-slate-900">Workspace Principal</span>
            </div>
            <span className="text-[10px] text-slate-600 font-normal shrink-0">v2.4</span>
          </div>
        </div>

        {/* Navigation Items List */}
        <div className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
            Navegação Principal
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentView === item.view ||
              (item.activeViews && item.activeViews.includes(currentView));

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item.view)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-blue-600' : 'text-slate-600'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-4 px-3 py-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
            Recursos Rápidos
          </div>

          <button
            type="button"
            onClick={() => onNavigate('create-test')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-blue-600 bg-blue-50/50 hover:bg-blue-100/60 border border-blue-200/60 font-semibold transition-all mb-2"
          >
            <PlusCircle className="w-4 h-4 text-blue-600" />
            <span>Novo Estudo / Teste</span>
          </button>

          {onOpenExportFigma && (
            <button
              type="button"
              onClick={onOpenExportFigma}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-purple-700 bg-purple-50/60 hover:bg-purple-100/70 border border-purple-200/60 font-semibold transition-all"
              title="Baixar pacote .zip do projeto pronto para Figma Make"
            >
              <div className="flex items-center gap-2">
                <FolderArchive className="w-4 h-4 text-purple-600" />
                <span>Figma Make (.zip)</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-mono">
                ZIP
              </span>
            </button>
          )}
        </div>

        {/* Footer Area: User Profile & Runtime Status (Reference from uploaded print) */}
        <div className="p-3 border-t border-slate-100 space-y-2 bg-slate-50/50">
          {/* Server Status Pill */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/80 text-[11px]">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  serverOnline ? 'bg-emerald-500 shadow-xs shadow-emerald-400' : 'bg-rose-500 animate-ping'
                }`}
              />
              <span className="text-slate-600 font-medium">Servidor Runtime</span>
            </div>
            <span className={`text-[10px] font-bold ${serverOnline ? 'text-emerald-700' : 'text-rose-700'}`}>
              {serverOnline ? 'Online' : 'Off'}
            </span>
          </div>

          {/* User Profile Card */}
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white transition-colors cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-blue-500 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0 ring-2 ring-white">
              UX
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 truncate">UX Researcher</p>
              <p className="text-[11px] text-slate-600 truncate">design.ux.web@gmail.com</p>
            </div>
            <Settings className="w-4 h-4 text-slate-600 hover:text-slate-900 shrink-0" />
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MOBILE TOP BAR & SLIDE-OVER DRAWER                                       */}
      {/* ========================================================================= */}
      <header className="md:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onNavigate('dashboard')}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
            <FlaskConical className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-900 text-sm tracking-tight">UX Test Lab</span>
            <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
              PRO
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('create-test')}
            className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs"
            title="Criar novo teste"
          >
            <PlusCircle className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileOpen && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-slate-200 shadow-xl p-3 space-y-1 z-50">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.view;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item.view)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold ${
                    isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {onOpenExportFigma && (
              <button
                type="button"
                onClick={() => {
                  onOpenExportFigma();
                  setMobileOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FolderArchive className="w-4 h-4 text-purple-600" />
                  <span>Exportar Figma Make (.zip)</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-200/80 text-purple-900 font-mono">
                  ZIP
                </span>
              </button>
            )}
          </div>
        )}
      </header>
    </>
  );
};

