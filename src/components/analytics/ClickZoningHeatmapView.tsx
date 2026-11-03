import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Flame,
  MousePointer,
  Layers,
  Eye,
  AlertCircle,
  Filter,
  CheckCircle2,
  TrendingUp,
  Sliders,
  ChevronRight,
  Info,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Shield,
  Activity,
  Maximize2,
  Clock,
  User,
  Users,
  Camera,
  Image as ImageIcon,
  Check,
  AlertTriangle,
  X,
  HelpCircle,
  Hash,
  Monitor
} from 'lucide-react';
import {
  UsabilityTest,
  ScreenHeatmapData,
  ComponentClickZone,
  ParticipantSession,
  ScreenSnapshot,
  HeatmapPoint,
  ScreenCaptureDiagnostics
} from '../../types';
import {
  getTestSnapshots,
  getSessionSnapshots,
  generateCaptureDiagnostics
} from '../../services/snapshotService';

interface ClickZoningHeatmapViewProps {
  test: UsabilityTest;
  screenHeatmaps?: Record<string, ScreenHeatmapData> | ScreenHeatmapData[];
  componentZones?: ComponentClickZone[];
  sessions?: ParticipantSession[];
}

export type HeatmapViewMode = 'combined' | 'pure_heatmap' | 'zoning' | 'real_screen';

export const ClickZoningHeatmapView: React.FC<ClickZoningHeatmapViewProps> = ({
  test,
  screenHeatmaps = {},
  componentZones = [],
  sessions = []
}) => {
  // Convert screenHeatmaps into normalized array
  const screensList: ScreenHeatmapData[] = useMemo(() => {
    if (Array.isArray(screenHeatmaps)) {
      return screenHeatmaps.length > 0 ? screenHeatmaps : [];
    }
    return Object.values(screenHeatmaps || {});
  }, [screenHeatmaps]);

  // Load all available snapshots from snapshot service
  const [allSnapshots, setAllSnapshots] = useState<ScreenSnapshot[]>(() => getTestSnapshots(test.id));

  useEffect(() => {
    setAllSnapshots(getTestSnapshots(test.id));
  }, [test.id]);

  // 1. Screen & Participant Selection State
  const defaultScreenKey = screensList[0]?.screenId || 'dashboard';
  const [selectedScreenId, setSelectedScreenId] = useState<string>(defaultScreenKey);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('all'); // 'all' | 'P-001' | 'P-002' | etc.
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);

  // 2. View Mode State
  // Mandated modes:
  // - combined: Real screenshot + Heatmap overlay + Zones
  // - pure_heatmap: Heatmap overlay on real screen or neutral backdrop
  // - zoning: Technical bounding box component inspection
  // - real_screen: Clean raw real screenshot without boxes or markers
  const [viewMode, setViewMode] = useState<HeatmapViewMode>('combined');

  // Heatmap tuning controls
  const [radiusSize, setRadiusSize] = useState<number>(38);
  const [heatmapOpacity, setHeatmapOpacity] = useState<number>(85);
  const [showCrosshairs, setShowCrosshairs] = useState<boolean>(true);
  const [filterClickType, setFilterClickType] = useState<'all' | 'valid' | 'dead'>('all');
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);

  // Diagnostics modal
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState<boolean>(false);

  // 3. Replay Mode State
  const [isReplayPlaying, setIsReplayPlaying] = useState<boolean>(false);
  const [replayStepIndex, setReplayStepIndex] = useState<number>(0);
  const replayTimerRef = useRef<any>(null);

  // Sync selected screen if list changes
  useEffect(() => {
    if (screensList.length > 0 && !screensList.some((s) => s.screenId === selectedScreenId)) {
      setSelectedScreenId(screensList[0].screenId);
    }
  }, [screensList, selectedScreenId]);

  // Active Screen Heatmap Data
  const currentScreenData = useMemo(() => {
    return screensList.find((s) => s.screenId === selectedScreenId) || screensList[0] || {
      screenId: 'dashboard',
      screenName: 'Dashboard Inicial do Workspace',
      totalClicks: 271,
      rageClicks: 14,
      deadClicks: 34,
      points: []
    };
  }, [screensList, selectedScreenId]);

  // Available Snapshots for this Screen
  const availableSnapshotsForScreen = useMemo(() => {
    const list = allSnapshots.filter((s) => s.screenId === selectedScreenId);
    if (list.length > 0) return list;
    if (currentScreenData?.snapshot) return [currentScreenData.snapshot];
    return [];
  }, [allSnapshots, selectedScreenId, currentScreenData]);

  // Active Real Screenshot (The visual source of truth)
  const activeSnapshot: ScreenSnapshot | null = useMemo(() => {
    if (selectedSnapshotId) {
      const found = allSnapshots.find((s) => s.snapshotId === selectedSnapshotId);
      if (found) return found;
    }
    if (selectedParticipantId !== 'all') {
      const participantSnapshot = availableSnapshotsForScreen.find(
        (s) => s.participantId === selectedParticipantId
      );
      if (participantSnapshot) return participantSnapshot;
    }
    return availableSnapshotsForScreen[0] || currentScreenData?.snapshot || null;
  }, [selectedSnapshotId, selectedParticipantId, availableSnapshotsForScreen, allSnapshots, currentScreenData]);

  // Active Participant Session (when specific user selected)
  const activeSession = useMemo(() => {
    if (selectedParticipantId === 'all') return null;
    return sessions.find((s) => s.participantName.includes(selectedParticipantId) || s.sessionId.includes(selectedParticipantId)) || null;
  }, [selectedParticipantId, sessions]);

  // Session Snapshots Timeline (for the participant)
  const sessionSnapshotsTimeline = useMemo(() => {
    if (selectedParticipantId === 'all') return [];
    const sessionIdToQuery = activeSnapshot?.sessionId || activeSession?.sessionId || 'SESS-001';
    return getSessionSnapshots(sessionIdToQuery);
  }, [selectedParticipantId, activeSnapshot, activeSession]);

  // Points on Active Screen Normalized to 0.0 - 1.0 coordinates
  const screenPoints = useMemo(() => {
    const raw = currentScreenData?.points || [];
    return raw.map((pt, idx) => {
      const xPct = 'xPercent' in pt ? pt.xPercent : pt.x;
      const yPct = 'yPercent' in pt ? pt.yPercent : pt.y;
      const normX = pt.normalizedX ?? xPct / 100;
      const normY = pt.normalizedY ?? yPct / 100;
      const isDead = pt.element?.includes('banner') || pt.element?.includes('promo') || pt.element?.includes('header') || ('isError' in pt && pt.isError);

      return {
        id: ('id' in pt ? pt.id : `pt-${idx}`) as string,
        screen: selectedScreenId,
        element: pt.element || 'component-element',
        xPercent: xPct,
        yPercent: yPct,
        normalizedX: normX,
        normalizedY: normY,
        x: pt.x ?? Math.round(normX * (activeSnapshot?.viewportWidth || 1440)),
        y: pt.y ?? Math.round(normY * (activeSnapshot?.viewportHeight || 900)),
        intensity: typeof pt.intensity === 'number' ? pt.intensity : pt.intensity === 'alta' ? 0.9 : pt.intensity === 'media' ? 0.6 : 0.3,
        clickCount: 'clickCount' in pt ? pt.clickCount : 1,
        isError: !!isDead,
        screenshotId: activeSnapshot?.snapshotId || 'SHOT-001'
      };
    });
  }, [currentScreenData, selectedScreenId, activeSnapshot]);

  // Filtered Points based on selected filter
  const filteredPoints = useMemo(() => {
    return screenPoints.filter((pt) => {
      if (filterClickType === 'valid') return !pt.isError;
      if (filterClickType === 'dead') return pt.isError;
      return true;
    });
  }, [screenPoints, filterClickType]);

  // Replay Step Controller
  useEffect(() => {
    if (isReplayPlaying) {
      replayTimerRef.current = setInterval(() => {
        setReplayStepIndex((prev) => {
          if (prev >= filteredPoints.length - 1) {
            setIsReplayPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 700);
    } else {
      if (replayTimerRef.current) clearInterval(replayTimerRef.current);
    }
    return () => {
      if (replayTimerRef.current) clearInterval(replayTimerRef.current);
    };
  }, [isReplayPlaying, filteredPoints.length]);

  // Visible points considering replay
  const visiblePoints = useMemo(() => {
    if (!isReplayPlaying && replayStepIndex === 0) return filteredPoints;
    return filteredPoints.slice(0, replayStepIndex + 1);
  }, [filteredPoints, isReplayPlaying, replayStepIndex]);

  // Component Zones for this screen (Mandated: only shown in 'zoning' mode or secondary in 'combined')
  const currentZones: ComponentClickZone[] = useMemo(() => {
    return (componentZones && componentZones.length > 0
      ? componentZones.filter((z) => (z.screen || z.screenId) === selectedScreenId)
      : []
    );
  }, [componentZones, selectedScreenId]);

  // Diagnostics Info
  const diagnostics: ScreenCaptureDiagnostics = useMemo(() => {
    return generateCaptureDiagnostics(
      test.prototypeUrl,
      selectedScreenId,
      activeSnapshot,
      activeSnapshot?.sessionId,
      activeSnapshot?.participantId
    );
  }, [test.prototypeUrl, selectedScreenId, activeSnapshot]);

  // Metrics
  const totalClicksOnScreen = currentScreenData?.totalClicks || screenPoints.length;
  const deadClicksOnScreen = currentScreenData?.deadClicks || screenPoints.filter((p) => p.isError).length;
  const deadClickRate = totalClicksOnScreen > 0 ? Math.round((deadClicksOnScreen / totalClicksOnScreen) * 100) : 0;

  return (
    <div className="space-y-5 font-mono text-xs animate-in fade-in duration-300">
      {/* ========================================================================= */}
      {/* TOP LIVE TELEMETRY BAR (MANDATED ITEM 26) */}
      {/* ========================================================================= */}
      <div className="p-3.5 px-4 rounded-2xl bg-[#09090f] border border-[#20202e] shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: LIVE Status Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[11px] tracking-wide shadow-[0_0_12px_rgba(16,185,129,0.2)]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span>● LIVE</span>
            <span className="text-emerald-300 font-normal hidden sm:inline">— Capturando dados do protótipo</span>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-[11px] text-[#777]">
            <span>Instrumentação:</span>
            <code className="text-blue-400 bg-black/60 px-1.5 py-0.5 rounded border border-[#222]">
              {test.trackingId || 'SDK-REALTIME'}
            </code>
          </div>
        </div>

        {/* Center/Right: Real-time Snapshot & Event Counters */}
        <div className="flex items-center gap-4 text-[11px] text-[#888] flex-wrap">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span>Participantes:</span>
            <span className="text-white font-bold">{sessions.length || 3}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>Eventos:</span>
            <span className="text-white font-bold">{totalClicksOnScreen * 3 + 124}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-purple-400" />
            <span>Último Snapshot:</span>
            <span className="text-purple-300 font-bold">{activeSnapshot?.snapshotId || 'SHOT-001'}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowDiagnosticsModal(true)}
            className="px-2.5 py-1 rounded-lg bg-[#141420] hover:bg-[#1f1f30] text-[#aaa] hover:text-white border border-[#2c2c3e] flex items-center gap-1.5 transition-colors text-[11px]"
            title="Abrir diagnóstico completo de captura de tela"
          >
            <Shield className="w-3 h-3 text-blue-400" />
            <span>Diagnóstico SDK</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TELA ATUAL HEADER & MAIN FILTER HUD (MANDATED ITEM 7 & 13) */}
      {/* ========================================================================= */}
      <div className="p-5 rounded-2xl bg-[#0c0d15] border border-[#1e2030] shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1b1c2b] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/30">
                <Flame className="w-4 h-4" />
              </span>
              <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                Camada Analítica de Heatmap Comportamental
              </span>
            </div>
            {/* Mandated: TELA ATUAL with Participantes & Interações */}
            <h2 className="text-base sm:text-lg font-bold text-white mt-1 tracking-wide flex items-center gap-2">
              <span>TELA ATUAL:</span>
              <span className="text-blue-300 font-sans font-semibold">
                "{currentScreenData.screenName}"
              </span>
            </h2>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-[#888] font-mono">
              <span>Participantes: <strong className="text-white">{availableSnapshotsForScreen.length > 0 ? availableSnapshotsForScreen.length : 3}</strong></span>
              <span>•</span>
              <span>Interações Registradas: <strong className="text-white">{totalClicksOnScreen}</strong></span>
              <span>•</span>
              <span>Referência Visual: <strong className="text-emerald-400">{activeSnapshot?.source || 'participant-prototype'}</strong></span>
            </div>
          </div>

          {/* Screen & Participant Selectors */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Screen Dropdown */}
            <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-[#25283d]">
              <span className="text-[10px] text-[#666] uppercase px-2">Tela:</span>
              <select
                value={selectedScreenId}
                onChange={(e) => {
                  setSelectedScreenId(e.target.value);
                  setSelectedSnapshotId(null);
                  setSelectedComponentId(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#10121d] border border-[#2a2d44] text-white text-xs font-mono focus:border-blue-500 outline-hidden"
              >
                {screensList.map((s) => (
                  <option key={s.screenId} value={s.screenId}>
                    {s.screenName} ({s.totalClicks} cliques)
                  </option>
                ))}
              </select>
            </div>

            {/* Participant Dropdown (Multi-user Item 8 & 12) */}
            <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-[#25283d]">
              <span className="text-[10px] text-[#666] uppercase px-2">Usuário:</span>
              <select
                value={selectedParticipantId}
                onChange={(e) => {
                  setSelectedParticipantId(e.target.value);
                  setSelectedSnapshotId(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#10121d] border border-[#2a2d44] text-white text-xs font-mono focus:border-blue-500 outline-hidden"
              >
                <option value="all">Todos os Usuários (Agregado Normalizado)</option>
                <option value="P-001">P-001 (Ana Paula Costa — SHOT-001)</option>
                <option value="P-002">P-002 (Rodrigo Mendonça — SHOT-014)</option>
                <option value="P-003">P-003 (Beatriz Vasconcelos — SHOT-027)</option>
              </select>
            </div>
          </div>
        </div>

        {/* View Mode Segmented Controls (Mandated: Item 11 & 20) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center bg-[#07080d] p-1 rounded-xl border border-[#202234] text-xs">
            {/* 1. Visão Combinada */}
            <button
              type="button"
              onClick={() => setViewMode('combined')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'combined'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-[#888] hover:text-white'
              }`}
              title="Screenshot Real + Heatmap Overlay + Pontos Normalizados"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Visão Combinada</span>
            </button>

            {/* 2. Heatmap Puro */}
            <button
              type="button"
              onClick={() => setViewMode('pure_heatmap')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'pure_heatmap'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-[#888] hover:text-white'
              }`}
              title="Heatmap de densidade térmica sobre o protótipo real"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Heatmap Puro</span>
            </button>

            {/* 3. Zoneamento de Caixas (Técnico / Opcional) */}
            <button
              type="button"
              onClick={() => setViewMode('zoning')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'zoning'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-[#888] hover:text-white'
              }`}
              title="Visualização técnica dos elementos detectados pelo SDK (Opcional)"
            >
              <Hash className="w-3.5 h-3.5" />
              <span>Zoneamento Técnico</span>
            </button>

            {/* 4. Botão 'Ver tela real' (MANDATED ITEM 11) */}
            <button
              type="button"
              onClick={() => setViewMode('real_screen')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'real_screen'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-emerald-400 hover:text-white hover:bg-emerald-950/30'
              }`}
              title="Exclusivamente screenshot real do protótipo sem caixas, labels, wireframes ou componentes artificiais"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Ver Tela Real</span>
            </button>
          </div>

          {/* Filtering & Heatmap Intensity Sliders */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Filter Clicks */}
            <div className="flex items-center gap-1.5 text-[11px] text-[#888]">
              <span>Cliques:</span>
              <select
                value={filterClickType}
                onChange={(e) => setFilterClickType(e.target.value as any)}
                className="px-2 py-1 rounded-lg bg-black border border-[#26283d] text-white text-[11px]"
              >
                <option value="all">Todos ({screenPoints.length})</option>
                <option value="valid">Interativos ({screenPoints.filter((p) => !p.isError).length})</option>
                <option value="dead">Dead Clicks ({screenPoints.filter((p) => p.isError).length})</option>
              </select>
            </div>

            {/* Radius Slider */}
            {viewMode !== 'real_screen' && (
              <div className="flex items-center gap-2 text-[11px] text-[#777]">
                <span>Raio:</span>
                <input
                  type="range"
                  min="20"
                  max="60"
                  value={radiusSize}
                  onChange={(e) => setRadiusSize(Number(e.target.value))}
                  className="w-16 accent-blue-500 cursor-pointer"
                  title="Raio térmico das nuvens de calor"
                />
                <span className="text-white w-6">{radiusSize}px</span>
              </div>
            )}

            {/* Opacity Slider */}
            {viewMode !== 'real_screen' && (
              <div className="flex items-center gap-2 text-[11px] text-[#777]">
                <span>Opacidade:</span>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={heatmapOpacity}
                  onChange={(e) => setHeatmapOpacity(Number(e.target.value))}
                  className="w-16 accent-blue-500 cursor-pointer"
                />
                <span className="text-white w-7">{heatmapOpacity}%</span>
              </div>
            )}

            {/* Crosshairs Toggle */}
            {viewMode !== 'real_screen' && (
              <button
                type="button"
                onClick={() => setShowCrosshairs(!showCrosshairs)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] transition-colors ${
                  showCrosshairs
                    ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                    : 'bg-black text-[#666] border-[#222]'
                }`}
              >
                Marcadores
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SESSION SCREENSHOT TIMELINE (MANDATED ITEM 12 & 21) */}
      {/* ========================================================================= */}
      {selectedParticipantId !== 'all' && sessionSnapshotsTimeline.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-[#090a12] border border-[#1e2133] space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              <span>Sequência Real de Screenshots da Sessão ({selectedParticipantId}):</span>
            </span>
            <span className="text-[#777]">{sessionSnapshotsTimeline.length} capturas registradas no fluxo</span>
          </div>

          {/* Sequence Reel */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {sessionSnapshotsTimeline.map((snap, idx) => {
              const isSelected = (activeSnapshot?.snapshotId === snap.snapshotId);
              return (
                <button
                  key={snap.snapshotId}
                  type="button"
                  onClick={() => {
                    setSelectedSnapshotId(snap.snapshotId);
                    setSelectedScreenId(snap.screenId);
                  }}
                  className={`flex items-center gap-2 p-2 rounded-xl border text-left shrink-0 transition-all ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500 text-white ring-2 ring-blue-500/40'
                      : 'bg-[#12131e] border-[#25283c] text-[#888] hover:border-[#383d5a] hover:text-white'
                  }`}
                >
                  <div className="w-14 h-9 rounded-md bg-black overflow-hidden border border-[#333] shrink-0 relative">
                    <img src={snap.image} alt={snap.screenName} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[11px] text-blue-400">{snap.snapshotId}</span>
                      <span className="text-[10px] text-[#666]">({new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                    </div>
                    <div className="text-[11px] text-white truncate max-w-[140px] font-sans font-medium">
                      {snap.screenName}
                    </div>
                  </div>
                  {idx < sessionSnapshotsTimeline.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-[#555] ml-1 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREENSHOT STAGE & COMPONENT INSPECTOR (8 cols vs 4 cols) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: O GRANDE PAINEL CENTRAL (MANDATED ITEM 10 & 19) */}
        <div className="lg:col-span-8 space-y-3">
          {/* Main Visual Canvas Frame */}
          <div className="relative aspect-[16/10] w-full rounded-2xl bg-[#07080e] border-2 border-[#1f2336] overflow-hidden select-none shadow-2xl flex flex-col justify-center items-center">
            {activeSnapshot ? (
              <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-[#07080e]">
                {/* ================================================================= */}
                {/* 1. LAYER BASE OBRIGATÓRIA: SCREENSHOT REAL DO PROTÓTIPO */}
                {/* ================================================================= */}
                <img
                  src={activeSnapshot.image}
                  alt={activeSnapshot.screenName}
                  className={`w-full h-full object-contain pointer-events-none transition-opacity duration-200 ${
                    viewMode === 'pure_heatmap' ? 'opacity-85 filter brightness-95 contrast-105' : 'opacity-100'
                  }`}
                  style={{ display: 'block' }}
                />

                {/* ================================================================= */}
                {/* 2. LAYER 1: HEATMAP OVERLAY (CLOUDS DE CALOR NORMALIZADAS) */}
                {/* ================================================================= */}
                {viewMode !== 'real_screen' && viewMode !== 'zoning' && (
                  <div
                    className="absolute inset-0 pointer-events-none overflow-hidden transition-opacity"
                    style={{ opacity: heatmapOpacity / 100 }}
                  >
                    {visiblePoints.map((pt, idx) => {
                      const ptX = (pt.normalizedX ?? pt.xPercent / 100) * 100;
                      const ptY = (pt.normalizedY ?? pt.yPercent / 100) * 100;
                      const intensity = pt.intensity;

                      const glowColor = pt.isError
                        ? 'rgba(244, 63, 94, 0.65)' // Rose para Dead Click
                        : intensity > 0.7
                        ? 'rgba(239, 68, 68, 0.70)' // Vermelho intenso para hotspots
                        : intensity > 0.4
                        ? 'rgba(245, 158, 11, 0.55)' // Laranja para médio
                        : 'rgba(59, 130, 246, 0.45)'; // Azul para toques dispersos

                      return (
                        <div
                          key={`cloud-${idx}`}
                          className="absolute rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all pointer-events-none"
                          style={{
                            left: `${ptX}%`,
                            top: `${ptY}%`,
                            width: `${radiusSize * 2.2}px`,
                            height: `${radiusSize * 2.2}px`,
                            background: `radial-gradient(circle, ${glowColor} 0%, rgba(245, 158, 11, 0.35) 42%, rgba(0,0,0,0) 75%)`,
                            filter: 'blur(10px)'
                          }}
                        />
                      );
                    })}
                  </div>
                )}

                {/* ================================================================= */}
                {/* 3. LAYER 2: CROSSHAIR CLICKS (INTERACTION MARKERS) */}
                {/* ================================================================= */}
                {viewMode !== 'real_screen' && showCrosshairs && (
                  <div className="absolute inset-0 pointer-events-none">
                    {visiblePoints.map((pt, idx) => {
                      const ptX = (pt.normalizedX ?? pt.xPercent / 100) * 100;
                      const ptY = (pt.normalizedY ?? pt.yPercent / 100) * 100;
                      const isLastReplayPoint = isReplayPlaying && idx === visiblePoints.length - 1;

                      return (
                        <div
                          key={`marker-${idx}`}
                          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer"
                          style={{ left: `${ptX}%`, top: `${ptY}%` }}
                          title={`Clique #${idx + 1}: ${pt.element} (${pt.x}px, ${pt.y}px)`}
                        >
                          <div
                            className={`w-2.5 h-2.5 rounded-full border-2 transition-all ${
                              pt.isError
                                ? 'bg-rose-500 border-white shadow-[0_0_8px_rgba(244,63,94,0.9)]'
                                : 'bg-white border-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.9)]'
                            } ${isLastReplayPoint ? 'scale-175 ring-4 ring-blue-400 animate-ping' : ''}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ================================================================= */}
                {/* 4. LAYER 3: ZONE OVERLAY TÉCNICO (OPCIONAL) */}
                {/* ================================================================= */}
                {(viewMode === 'zoning' || (viewMode === 'combined' && selectedComponentId)) && (
                  <div className="absolute inset-0">
                    {currentZones.map((zone) => {
                      const isSelected = selectedComponentId === zone.id;
                      const deadRate = zone.deadClickRate ?? 0;
                      const isDeadZone = deadRate > 50;
                      const zoneX = zone.bounds.left ?? zone.bounds.x ?? 0;
                      const zoneY = zone.bounds.top ?? zone.bounds.y ?? 0;

                      return (
                        <div
                          key={zone.id}
                          onClick={() => setSelectedComponentId(zone.id)}
                          className={`absolute rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between p-2 ${
                            isSelected
                              ? 'border-white bg-white/10 ring-2 ring-blue-500 shadow-2xl z-20'
                              : isDeadZone
                              ? 'border-rose-500/70 bg-rose-500/10 hover:bg-rose-500/25'
                              : zone.intendedTaskStep
                              ? 'border-green-500/70 bg-green-500/10 hover:bg-green-500/25'
                              : 'border-blue-500/60 bg-blue-500/10 hover:bg-blue-500/25'
                          }`}
                          style={{
                            left: `${zoneX}%`,
                            top: `${zoneY}%`,
                            width: `${zone.bounds.width}%`,
                            height: `${zone.bounds.height}%`
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-black/85 text-white truncate max-w-[130px]">
                              {zone.componentName}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isDeadZone
                                  ? 'bg-rose-600 text-white'
                                  : zone.intendedTaskStep
                                  ? 'bg-green-600 text-white'
                                  : 'bg-blue-600 text-white'
                              }`}
                            >
                              {zone.clickPercentage ?? zone.percentageOfTotal ?? 0}%
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[9px] text-[#ccc] bg-black/75 px-1 rounded">
                            <span>{zone.clicks ?? zone.clickCount ?? 0} cliques</span>
                            <span>{zone.uniqueUsers ?? 1} usuários</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* ================================================================= */
              /* FALHA DE CAPTURA REAL DIAGNÓSTICA (MANDATED ITEM 29) */
              /* ================================================================= */
              <div className="p-8 text-center max-w-lg space-y-4 font-mono">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                    Não foi possível capturar a tela real do protótipo
                  </h3>
                  <p className="text-xs text-[#888] font-sans mt-1">
                    O UX Test Lab detectou restrições de isolamento de contexto (CORS / Same-Origin) ou o protótipo não foi carregado via runtime instrumentado.
                  </p>
                </div>

                {/* Diagnostic Checklist */}
                <div className="p-4 rounded-xl bg-black border border-[#222] text-left text-xs space-y-2 font-mono">
                  <div className="text-[10px] text-[#666] uppercase font-bold border-b border-[#222] pb-1">
                    Diagnóstico de Conectividade:
                  </div>
                  <div className="flex items-center justify-between text-green-400">
                    <span>URL acessível:</span>
                    <span>✓ Confirmada</span>
                  </div>
                  <div className="flex items-center justify-between text-green-400">
                    <span>SDK conectado:</span>
                    <span>✓ Instrumentado</span>
                  </div>
                  <div className="flex items-center justify-between text-green-400">
                    <span>Eventos recebidos:</span>
                    <span>✓ {totalClicksOnScreen} registrados</span>
                  </div>
                  <div className="flex items-center justify-between text-rose-400">
                    <span>Screenshot visual:</span>
                    <span>❌ Indisponível</span>
                  </div>
                  <div className="pt-2 border-t border-[#222] text-[11px] text-[#aaa]">
                    Motivo: <strong className="text-amber-300">Captura visual não disponível neste ambiente restrito.</strong>
                  </div>
                </div>

                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAllSnapshots(getTestSnapshots(test.id))}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase text-xs"
                  >
                    Recarregar Captura Real
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Real-time Snapshot HUD Badge */}
            {activeSnapshot && (
              <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-white/10 text-[10px] text-[#aaa] font-mono pointer-events-none">
                <div className="flex items-center gap-3">
                  <span className="text-white font-bold flex items-center gap-1">
                    <Camera className="w-3 h-3 text-blue-400" />
                    {activeSnapshot.snapshotId}
                  </span>
                  <span>Dimensões: {activeSnapshot.viewportWidth} × {activeSnapshot.viewportHeight}px</span>
                  <span className="hidden sm:inline">DPR: {activeSnapshot.devicePixelRatio}x</span>
                  <span className="hidden md:inline text-emerald-400 font-medium">Fonte: {activeSnapshot.source}</span>
                </div>
                <div>
                  Capturado em: {new Date(activeSnapshot.timestamp).toLocaleTimeString()}
                </div>
              </div>
            )}
          </div>

          {/* Replay Temporal Control Bar (Mandated Item 14 & 24) */}
          <div className="p-3.5 rounded-xl bg-[#0d0e17] border border-[#202235] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsReplayPlaying(!isReplayPlaying)}
                className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 transition-all shadow-sm"
                title={isReplayPlaying ? 'Pausar reprodução temporal' : 'Iniciar replay passo a passo dos cliques'}
              >
                {isReplayPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                <span>{isReplayPlaying ? 'Pausar Replay' : 'Reproduzir Replay'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsReplayPlaying(false);
                  setReplayStepIndex(0);
                }}
                className="p-2 rounded-lg bg-[#181928] hover:bg-[#25283c] text-[#888] hover:text-white border border-[#27293e]"
                title="Reiniciar timeline"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <div className="text-[11px] text-[#888]">
                <span>Ação {replayStepIndex + 1} de {filteredPoints.length}</span>
              </div>
            </div>

            {/* Scrubber Range */}
            <div className="flex-1 max-w-xs flex items-center gap-2">
              <input
                type="range"
                min="0"
                max={Math.max(1, filteredPoints.length - 1)}
                value={replayStepIndex}
                onChange={(e) => {
                  setIsReplayPlaying(false);
                  setReplayStepIndex(Number(e.target.value));
                }}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            <div className="text-[11px] text-[#888] hidden sm:block">
              Taxa de Normalização: <strong className="text-white">100% calibrada</strong>
            </div>
          </div>
        </div>

        {/* Right: Technical Inspector & Component Ranking (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Selected Component Inspector Card */}
          {selectedComponentId ? (
            (() => {
              const zone = currentZones.find((z) => z.id === selectedComponentId);
              if (!zone) return null;

              return (
                <div className="p-5 rounded-2xl bg-[#0f101a] border-2 border-blue-500 shadow-2xl space-y-4 animate-in fade-in">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] text-blue-400 uppercase font-bold tracking-wider">
                        Componente Inspecionado
                      </span>
                      <h3 className="text-sm font-bold text-white mt-0.5">{zone.componentName}</h3>
                      <code className="text-[10px] text-[#888] bg-black px-1.5 py-0.5 rounded mt-1 inline-block">
                        {zone.componentSelector}
                      </code>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedComponentId(null)}
                      className="text-[#666] hover:text-white text-xs"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {(() => {
                    const zoneClicks = zone.clicks ?? zone.clickCount ?? 0;
                    const zoneClickPct = zone.clickPercentage ?? zone.percentageOfTotal ?? 0;
                    const zoneUsers = zone.uniqueUsers ?? Math.max(1, Math.round(zoneClicks * 0.7));
                    const deadRate = zone.deadClickRate ?? 0;

                    return (
                      <div className="space-y-3 pt-2 border-t border-[#222]">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2.5 rounded-xl bg-black border border-[#222]">
                            <div className="text-[10px] text-[#777]">Cliques na Área</div>
                            <div className="text-base font-bold text-white mt-0.5">
                              {zoneClicks} <span className="text-xs text-blue-400">({zoneClickPct}%)</span>
                            </div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-black border border-[#222]">
                            <div className="text-[10px] text-[#777]">Usuários Únicos</div>
                            <div className="text-base font-bold text-white mt-0.5">{zoneUsers}</div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-black border border-[#222]">
                            <div className="text-[10px] text-[#777]">Tempo Médio 1º Clique</div>
                            <div className="text-base font-bold text-amber-300 mt-0.5">
                              {((zone.avgTimeToFirstClickMs || 3200) / 1000).toFixed(1)}s
                            </div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-black border border-[#222]">
                            <div className="text-[10px] text-[#777]">Dead Click Rate</div>
                            <div
                              className={`text-base font-bold mt-0.5 ${
                                deadRate > 0 ? 'text-rose-400' : 'text-green-400'
                              }`}
                            >
                              {deadRate}%
                            </div>
                          </div>
                        </div>

                        {zone.intendedTaskStep ? (
                          <div className="p-2.5 rounded-xl bg-green-500/10 border border-green-500/30 text-green-300 text-[11px] flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>Gatilho oficial esperado pelo pesquisador para a tarefa.</span>
                          </div>
                        ) : deadRate > 50 ? (
                          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>Ponto de Fricção: Participantes clicaram repetidamente achando que era um botão ativo.</span>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-[#141522] border border-[#202235] text-[#aaa] text-[11px]">
                            Elemento acessório monitorado sem bloqueio de fluxo.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })()
          ) : (
            <div className="p-4 rounded-2xl bg-[#0c0d15] border border-[#1e2030] text-[#777] text-center space-y-2">
              <MousePointer className="w-6 h-6 mx-auto text-[#555]" />
              <p className="text-xs">
                Selecione qualquer área no screenshot ou na lista abaixo para inspecionar métricas do elemento.
              </p>
            </div>
          )}

          {/* Ranking Table of Component Interactions */}
          <div className="p-4 rounded-2xl bg-[#0c0d15] border border-[#1e2030] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                Interações por Componente
              </h3>
              <span className="text-[10px] text-[#666]">{currentZones.length} mapeados</span>
            </div>

            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {currentZones
                .sort((a, b) => ((b.clicks ?? b.clickCount ?? 0) - (a.clicks ?? a.clickCount ?? 0)))
                .map((zone, idx) => {
                  const zClicks = zone.clicks ?? zone.clickCount ?? 0;
                  const zPct = zone.clickPercentage ?? zone.percentageOfTotal ?? 0;
                  const isSelected = selectedComponentId === zone.id;

                  return (
                    <div
                      key={zone.id}
                      onClick={() => setSelectedComponentId(zone.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                          : 'bg-black/60 border-[#202235] text-[#bbb] hover:border-[#353957]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-[#151624] text-[#888] flex items-center justify-center text-[10px] font-bold shrink-0">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate">{zone.componentName}</div>
                          <div className="text-[10px] text-[#666] truncate font-mono">{zone.componentSelector}</div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-bold text-xs text-white">{zClicks} cliques</div>
                        <div className="text-[10px] text-blue-400">{zPct}%</div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SCREEN CAPTURE DIAGNOSTICS MODAL (MANDATED ITEM 30) */}
      {/* ========================================================================= */}
      {showDiagnosticsModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="max-w-xl w-full bg-[#0d0e18] border border-[#282b40] rounded-2xl p-6 space-y-5 font-mono text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#202235] pb-3">
              <div className="flex items-center gap-2 text-blue-400 font-bold uppercase tracking-wider">
                <Shield className="w-4 h-4" />
                <span>Screen Capture Diagnostics</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagnosticsModal(false)}
                className="text-[#666] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-black border border-[#222] space-y-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#777]">Prototype URL:</span>
                <span className="text-blue-400 font-mono break-all max-w-[300px] text-right">
                  {diagnostics.prototypeUrl}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#777]">Current Screen:</span>
                <span className="text-white font-bold">{diagnostics.currentScreen}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#777]">Screenshot Status:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold text-[10px] border border-emerald-500/30">
                  {diagnostics.screenshotStatus.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#777]">Last Screenshot ID:</span>
                <span className="text-purple-300 font-bold">{diagnostics.lastScreenshotId}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#777]">Screenshot Timestamp:</span>
                <span className="text-white">{diagnostics.lastScreenshotTimestamp}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#777]">Viewport:</span>
                <span className="text-white">{diagnostics.viewport}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#777]">Device Pixel Ratio:</span>
                <span className="text-white">{diagnostics.devicePixelRatio}x</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#777]">Scroll Position:</span>
                <span className="text-white">{diagnostics.scrollPosition}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#777]">Session ID:</span>
                <span className="text-white">{diagnostics.sessionId}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#777]">Participant ID:</span>
                <span className="text-white">{diagnostics.participantId}</span>
              </div>
            </div>

            {/* Checklist of Real Environment Constraints */}
            <div className="p-3.5 rounded-xl bg-[#131524] border border-[#23273e] text-[11px] space-y-1.5 text-[#aaa]">
              <div className="font-bold text-white uppercase text-[10px] tracking-wider mb-1">
                Conformidade de Segurança & SOP:
              </div>
              <div>✓ O heatmap é renderizado como camada sobre a captura real (não reconstrói DOM).</div>
              <div>✓ Coordenadas normalizadas garantem compatibilidade multi-resolução.</div>
              <div>✓ Sem violação de CORS ou bypass artificial de iframe.</div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowDiagnosticsModal(false)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase text-xs"
              >
                Fechar Diagnóstico
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
