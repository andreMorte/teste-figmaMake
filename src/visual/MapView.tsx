import React, { useEffect, useRef, useState } from 'react';
import { AttentionField, aoiTone, contrastFailures, paintLayer } from './engine';
import { VisualAoi, VisualScreen } from './types';

export type MapMode = 'attention' | 'focus' | 'contrast' | 'original';

const TONE = { good: 'bg-emerald-600', mid: 'bg-amber-500', low: 'bg-rose-600' } as const;

/** A tela capturada com a camada escolhida e as áreas de interesse por cima. */
export const MapView: React.FC<{
  screen: VisualScreen;
  field: AttentionField | null;
  mode: MapMode;
  aois: VisualAoi[];
  showAois: boolean;
  drawing: boolean;
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  onDrawn?: (r: { x: number; y: number; w: number; h: number }) => void;
  canvasRef?: React.MutableRefObject<HTMLCanvasElement | null>;
}> = ({ screen, field, mode, aois, showAois, drawing, selected, onSelect, onDrawn, canvasRef }) => {
  const layer = useRef<HTMLCanvasElement | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  useEffect(() => {
    if (!layer.current) return;
    if (canvasRef) canvasRef.current = layer.current;
    if (!field || mode === 'original') {
      const c = layer.current.getContext('2d');
      layer.current.width = screen.imageWidth;
      layer.current.height = screen.imageHeight;
      c?.clearRect(0, 0, screen.imageWidth, screen.imageHeight);
      return;
    }
    paintLayer(layer.current, field, mode, screen);
  }, [field, mode, screen, canvasRef]);

  const W = screen.imageWidth;
  const H = screen.imageHeight;
  const pct = (v: number, t: number) => `${(v / t) * 100}%`;
  const toImg = (e: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const fails = mode === 'contrast' ? contrastFailures(screen) : [];
  const foldY = (screen.viewportHeight || 900) * (W / (screen.docWidth || W));

  return (
    <div
      ref={wrap}
      className={`relative select-none mx-auto ${drawing ? 'cursor-crosshair' : ''}`}
      style={{ aspectRatio: `${W} / ${H}`, maxWidth: (screen.docWidth || W) < 700 ? 460 : undefined }}
      onPointerDown={(e) => {
        if (!drawing) return;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        const p = toImg(e);
        setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
      }}
      onPointerMove={(e) => {
        if (!drag) return;
        const p = toImg(e);
        setDrag({ ...drag, x1: p.x, y1: p.y });
      }}
      onPointerUp={() => {
        if (!drag) return;
        const r = { x: Math.min(drag.x0, drag.x1), y: Math.min(drag.y0, drag.y1), w: Math.abs(drag.x1 - drag.x0), h: Math.abs(drag.y1 - drag.y0) };
        setDrag(null);
        if (r.w > 8 && r.h > 8) onDrawn?.({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) });
      }}
    >
      <img src={screen.image} alt={`Tela: ${screen.name}`} className="absolute inset-0 w-full h-full" draggable={false} />
      <canvas ref={layer} className="absolute inset-0 w-full h-full pointer-events-none" />

      {foldY < H && (
        <div className="absolute left-0 right-0 border-t-2 border-dashed border-white/80 pointer-events-none" style={{ top: pct(foldY, H) }}>
          <span className="absolute right-1 -top-5 text-[10px] font-semibold text-white bg-slate-900/70 rounded px-1.5 py-0.5">fim da primeira dobra</span>
        </div>
      )}

      {fails.map((f, i) => (
        <div key={i} className="absolute border-2 border-rose-600 pointer-events-none" style={{ left: pct(f.x, W), top: pct(f.y, H), width: pct(f.w, W), height: pct(f.h, H) }}>
          <span className="absolute -top-4 left-0 text-[9px] font-bold text-white bg-rose-600 rounded px-1 whitespace-nowrap">{f.cr}:1</span>
        </div>
      ))}

      {showAois &&
        aois.map((a) => (
          <button
            type="button"
            key={a.id}
            onClick={(e) => {
              e.stopPropagation();
              if (!drawing) onSelect?.(selected === a.id ? null : a.id);
            }}
            className={`absolute border-2 text-left ${selected === a.id ? 'border-violet-500 bg-violet-500/10' : 'border-white/90 hover:bg-white/10'} ${drawing ? 'pointer-events-none' : ''}`}
            style={{ left: pct(a.x, W), top: pct(a.y, H), width: pct(a.w, W), height: pct(a.h, H), boxShadow: '0 0 0 1px rgba(15,23,42,.35)' }}
            aria-label={`${a.name}: ${Math.round((a.share || 0) * 100)}% da atenção`}
          >
            <span className={`absolute -top-[18px] left-[-2px] text-[10px] font-semibold text-white rounded-t px-1.5 py-0.5 whitespace-nowrap ${TONE[aoiTone(a)]}`}>
              {a.name} <b>{Math.round((a.share || 0) * 100)}%</b>
            </span>
          </button>
        ))}

      {drag && (
        <div
          className="absolute border-2 border-violet-500 bg-violet-500/15 pointer-events-none"
          style={{
            left: pct(Math.min(drag.x0, drag.x1), W),
            top: pct(Math.min(drag.y0, drag.y1), H),
            width: pct(Math.abs(drag.x1 - drag.x0), W),
            height: pct(Math.abs(drag.y1 - drag.y0), H)
          }}
        />
      )}
    </div>
  );
};

export const MapLegend: React.FC<{ mode: MapMode }> = ({ mode }) =>
  mode === 'original' ? null : (
    <div className="inline-flex items-center gap-2 text-[11px] text-slate-500">
      {mode === 'attention' && (
        <>
          <span>Menos</span>
          <span className="w-28 h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#1e40ff,#00e5ff,#33ff66,#ffee00,#ff2200)' }} />
          <span>Mais atenção</span>
        </>
      )}
      {mode === 'focus' && (
        <>
          <span className="w-4 h-3 rounded bg-slate-900/80" /> fica de fora no primeiro olhar
          <span className="w-4 h-3 rounded border border-slate-300 bg-white ml-2" /> é visto
        </>
      )}
      {mode === 'contrast' && (
        <>
          <span className="w-3 h-3 rounded bg-orange-500/60" /> baixo
          <span className="w-3 h-3 rounded bg-yellow-400/60" /> médio
          <span className="w-3 h-3 rounded bg-green-500/60" /> alto
          <span className="w-3 h-3 rounded border-2 border-rose-600 ml-2" /> texto abaixo do WCAG AA
        </>
      )}
    </div>
  );
