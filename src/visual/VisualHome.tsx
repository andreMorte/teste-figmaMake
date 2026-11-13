import React, { useEffect, useState } from 'react';
import { ScanEye, Plus, Trash2, Monitor, Smartphone, Layers, Loader2 } from 'lucide-react';
import { visualApi } from './api';
import { VisualMeta } from './types';

const host = (u: string) => {
  try {
    return new URL(/^https?:/.test(u) ? u : `https://${u}`).host;
  } catch {
    return u;
  }
};
const tone = (v: number | null) => (v === null ? 'text-slate-400' : v >= 70 ? 'text-emerald-600' : v >= 45 ? 'text-amber-600' : 'text-rose-600');

export const VisualHome: React.FC<{ onNew: () => void; onOpen: (id: string) => void }> = ({ onNew, onOpen }) => {
  const [items, setItems] = useState<VisualMeta[] | null>(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<VisualMeta | null>(null);

  const load = () =>
    visualApi
      .list()
      .then(setItems)
      .catch((e) => {
        setError(e.message);
        setItems([]);
      });
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <ScanEye className="w-5 h-5 text-violet-600" /> Raio-X da interface
          </h1>
          <p className="text-sm text-slate-500">
            Cole o link do protótipo do Figma Make, navegue tela a tela e receba, para cada uma, os mapas de atenção, foco e contraste, as áreas que mais chamam o olhar e o parecer de um
            especialista em produto.
          </p>
        </div>
        <button type="button" onClick={onNew} className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nova análise
        </button>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-3">Não foi possível carregar as análises: {error}</div>}

      {items === null ? (
        <div className="py-20 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
        </div>
      ) : items.length === 0 ? (
        <button
          type="button"
          onClick={onNew}
          className="w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white hover:border-violet-400 hover:bg-violet-50/30 p-10 text-center space-y-2"
        >
          <ScanEye className="w-8 h-8 text-violet-500 mx-auto" />
          <div className="text-sm font-semibold text-slate-800">Nenhuma análise ainda</div>
          <div className="text-xs text-slate-500">Comece pelo link do protótipo. Leva poucos minutos.</div>
        </button>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((a) => (
            <div key={a.id} className="group rounded-2xl bg-white border border-slate-200 hover:border-violet-300 hover:shadow-md transition overflow-hidden flex flex-col">
              <button type="button" onClick={() => onOpen(a.id)} className="text-left flex-1 flex flex-col">
                <div className="aspect-[16/9] bg-slate-100 overflow-hidden border-b border-slate-100">
                  {a.thumb ? <img src={a.thumb} alt="" className="w-full h-full object-cover object-top" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Layers className="w-8 h-8" /></div>}
                </div>
                <div className="p-4 space-y-3 flex-1">
                  <div className="space-y-0.5">
                    <div className="text-sm font-semibold text-slate-900 truncate">{a.name}</div>
                    <div className="text-xs text-slate-500 truncate flex items-center gap-1.5">
                      {a.device === 'mobile' ? <Smartphone className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
                      {host(a.prototypeUrl)} · {a.screens} {a.screens === 1 ? 'tela' : 'telas'}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      ['Clareza', a.clarity],
                      ['Foco', a.focus],
                      ['Especialista', a.expertScore]
                    ].map(([l, v]) => (
                      <div key={l as string} className="rounded-lg bg-slate-50 py-1.5">
                        <div className={`text-base font-semibold ${tone(v as number | null)}`}>{v ?? '—'}</div>
                        <div className="text-[10px] text-slate-500">{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </button>
              <div className="px-4 pb-3 flex items-center justify-between text-[11px] text-slate-400">
                <span>{a.updatedAt ? new Date(a.updatedAt).toLocaleDateString('pt-BR') : ''}</span>
                <button type="button" onClick={() => setConfirm(a)} className="p-1.5 rounded-lg hover:bg-rose-50 hover:text-rose-600" title="Excluir análise" aria-label={`Excluir ${a.name}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setConfirm(null)}>
          <div role="dialog" aria-modal="true" className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-1">
              <div className="text-base font-semibold text-slate-900">Excluir “{confirm.name}”?</div>
              <p className="text-sm text-slate-500">As telas capturadas e os pareceres serão apagados. Não dá para desfazer.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" autoFocus onClick={() => setConfirm(null)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100">
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await visualApi.remove(confirm.id).catch(() => {});
                  setConfirm(null);
                  load();
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
