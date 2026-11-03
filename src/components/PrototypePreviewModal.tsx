import { useState } from 'react';
import { X, Monitor, Smartphone, ExternalLink, RefreshCw } from 'lucide-react';

interface PrototypePreviewModalProps {
  url: string;
  onClose: () => void;
  title?: string;
}

export function PrototypePreviewModal({ url, onClose, title }: PrototypePreviewModalProps) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [key, setKey] = useState(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] w-full max-w-5xl h-[88vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-[#282828]">
        {/* Modal Top Bar */}
        <div className="px-4 py-3 bg-[#0d0d0d] text-[#e5e5e5] flex items-center justify-between border-b border-[#222]">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.7)] animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider font-mono">
              {title || 'Simulador de Execução do Protótipo'}
            </span>
            <span className="text-xs text-blue-400 font-mono truncate max-w-xs sm:max-w-md">
              {url}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-black border border-[#262626] p-0.5 rounded text-xs font-mono">
              <button
                type="button"
                onClick={() => setDevice('desktop')}
                className={`px-2 py-1 rounded flex items-center gap-1 transition-all ${
                  device === 'desktop'
                    ? 'bg-[#222] text-white'
                    : 'text-[#666] hover:text-white'
                }`}
                title="Visualização Desktop"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="text-[10px] hidden sm:inline uppercase">Desktop</span>
              </button>
              <button
                type="button"
                onClick={() => setDevice('mobile')}
                className={`px-2 py-1 rounded flex items-center gap-1 transition-all ${
                  device === 'mobile'
                    ? 'bg-[#222] text-white'
                    : 'text-[#666] hover:text-white'
                }`}
                title="Visualização Mobile (375x667)"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="text-[10px] hidden sm:inline uppercase">Mobile</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setKey(k => k + 1)}
              className="p-1.5 rounded text-[#666] hover:text-white hover:bg-[#1c1c1c] transition-colors"
              title="Recarregar Frame"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded text-[#666] hover:text-white hover:bg-[#1c1c1c] transition-colors"
              title="Abrir em Nova Aba"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded text-[#666] hover:text-white hover:bg-rose-600 transition-colors"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewport Frame */}
        <div className="flex-1 bg-black flex items-center justify-center p-4 overflow-hidden">
          <div
            className={`transition-all duration-300 bg-white shadow-2xl overflow-hidden ${
              device === 'mobile'
                ? 'w-[375px] h-[667px] rounded-[36px] border-[10px] border-[#181818] ring-1 ring-[#333]'
                : 'w-full h-full rounded-lg border border-[#222]'
            }`}
          >
            <iframe
              key={key}
              src={url}
              title="Prototype Execution Sandbox"
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
