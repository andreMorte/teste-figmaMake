import { ShieldCheck, Activity, Terminal } from 'lucide-react';

interface HeaderProps {
  onSelectPreset: (preset: 'valid' | 'mismatch' | 'nosdk' | 'figma') => void;
  serverOnline: boolean;
}

export function Header({ onSelectPreset, serverOnline }: HeaderProps) {
  return (
    <header className="border-b border-[#222] bg-[#0a0a0a] sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500 flex items-center justify-center bg-blue-500/10 shrink-0">
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-semibold tracking-tight uppercase text-[#e5e5e5]">
                UX Test Lab Verification Engine
              </h1>
              <span className="text-[11px] text-blue-400 opacity-80 font-mono">
                v2.4.0-STABLE
              </span>
            </div>
            <p className="text-xs text-[#666]">
              Validação de instrumentação em tempo de execução e liberação de testes de usabilidade
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 px-2.5 py-1 bg-[#111] border border-[#222] rounded-md text-[#888] font-mono text-[11px]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                serverOnline
                  ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse'
                  : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
              }`}
            />
            <span className="uppercase tracking-wider">
              {serverOnline ? 'ENGINE ONLINE' : 'CONECTANDO...'}
            </span>
          </div>

          <div className="h-4 w-px bg-[#222] hidden sm:block" />

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-[#666] font-mono uppercase tracking-wider hidden lg:inline">
              Presets:
            </span>
            <button
              id="preset-valid-btn"
              onClick={() => onSelectPreset('valid')}
              className="px-2.5 py-1 rounded-md bg-green-500/10 hover:bg-green-500/20 text-green-400 font-mono text-[11px] border border-green-500/30 transition-all hover:border-green-500/50"
              title="Carregar protótipo Figma Make com SDK UXLab configurado com sucesso"
            >
              ✓ Válido (TEST-U92DU)
            </button>
            <button
              id="preset-figma-btn"
              onClick={() => onSelectPreset('figma')}
              className="px-2.5 py-1 rounded-md bg-[#141414] hover:bg-[#1f1f1f] text-[#ccc] font-mono text-[11px] border border-[#2a2a2a] transition-all"
              title="Carregar URL de exemplo do Figma Make (drums-baste-72876355.figma.site)"
            >
              Figma Site Real
            </button>
            <button
              id="preset-mismatch-btn"
              onClick={() => onSelectPreset('mismatch')}
              className="px-2.5 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-mono text-[11px] border border-amber-500/30 transition-all"
              title="Testar erro com trackingId divergente"
            >
              Divergente
            </button>
            <button
              id="preset-nosdk-btn"
              onClick={() => onSelectPreset('nosdk')}
              className="px-2.5 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-mono text-[11px] border border-rose-500/30 transition-all"
              title="Testar protótipo sem o SDK UXLab instalado"
            >
              Sem SDK
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
