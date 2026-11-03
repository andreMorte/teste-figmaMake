import { DiscoveredScript } from '../types';
import { FileCode, CheckCircle2, XCircle, AlertCircle, ExternalLink, HardDrive } from 'lucide-react';

interface BundlesTableProps {
  scripts: DiscoveredScript[];
  prototypeUrl: string;
}

export function BundlesTable({ scripts, prototypeUrl }: BundlesTableProps) {
  if (!scripts || scripts.length === 0) {
    return (
      <div className="p-8 text-center bg-[#0d0d0d] rounded-xl border border-[#222] text-[#666] text-xs font-mono">
        Nenhum script foi inspecionado ainda. Execute uma verificação para analisar os bundles.
      </div>
    );
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-[#0d0d0d] rounded-xl border border-[#222] shadow-2xl overflow-hidden">
      <div className="p-4 md:p-5 border-b border-[#222] flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-[#e5e5e5] uppercase tracking-widest font-mono flex items-center gap-2">
            <FileCode className="w-4 h-4 text-blue-400" />
            Bundles e Scripts Analisados em Tempo de Execução
          </h3>
          <p className="text-xs text-[#666] mt-0.5">
            Varredura profunda do HTML e de todos os arquivos JavaScript compilados pelo Figma Make
          </p>
        </div>
        <span className="text-xs font-mono bg-black border border-[#222] px-2.5 py-1 rounded text-blue-400 font-semibold">
          {scripts.length} arquivo(s)
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-[#070707] text-[#666] uppercase tracking-widest font-bold text-[10px] border-b border-[#222]">
            <tr>
              <th className="px-4 py-3">Arquivo / Bundle</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Tamanho</th>
              <th className="px-4 py-3">Ref. UXLab</th>
              <th className="px-4 py-3">UXLab.init()</th>
              <th className="px-4 py-3">Status da Varredura</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a1a] text-[#aaa]">
            {scripts.map((script, idx) => (
              <tr key={idx} className="hover:bg-[#121212] transition-colors">
                <td className="px-4 py-3 font-mono text-[#e5e5e5]">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-3.5 h-3.5 text-[#555] shrink-0" />
                    <span className="truncate max-w-[220px] sm:max-w-xs" title={script.url}>
                      {script.filename}
                    </span>
                    {script.url.startsWith('http') && (
                      <a
                        href={script.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#666] hover:text-blue-400 transition-colors"
                        title="Ver script no navegador"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      script.type === 'external'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                        : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                    }`}
                  >
                    {script.type === 'external' ? 'Bundle Externo' : 'Inline Script'}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-[#777]">
                  {formatBytes(script.sizeBytes)}
                </td>
                <td className="px-4 py-3">
                  {script.hasUXLabRef ? (
                    <span className="inline-flex items-center gap-1 text-green-400 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                      Detectado
                    </span>
                  ) : (
                    <span className="text-[#555]">Não</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {script.hasUXLabInit ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-500/15 text-green-400 border border-green-500/30">
                      <CheckCircle2 className="w-3 h-3 text-green-400" />
                      Inicializado
                    </span>
                  ) : (
                    <span className="text-[#555]">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {script.status === 'scanned' ? (
                    <span className="text-green-400/90 font-medium">Inspecionado com sucesso</span>
                  ) : (
                    <span className="text-rose-400 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Falha no download
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
