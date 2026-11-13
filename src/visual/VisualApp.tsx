import React, { useEffect, useState } from 'react';
import { VisualHome } from './VisualHome';
import { VisualCapture } from './VisualCapture';
import { VisualReport } from './VisualReport';
import { VisualAnalysis } from './types';

type V = { view: 'home' } | { view: 'new'; existing?: VisualAnalysis } | { view: 'report'; id: string };

const readHash = (): V => {
  const m = typeof window !== 'undefined' ? window.location.hash.match(/^#raio-x\/([\w-]+)/) : null;
  return m ? { view: 'report', id: m[1] } : { view: 'home' };
};

/** Raio-X da interface: lista → nova análise (captura) → relatório. O endereço guarda onde a pessoa está (F5 volta ao mesmo lugar). */
export const VisualApp: React.FC = () => {
  const [v, setV] = useState<V>(readHash);
  useEffect(() => {
    const h = v.view === 'report' ? `#raio-x/${v.id}` : '#raio-x';
    if (window.location.hash !== h) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${h}`);
    window.scrollTo({ top: 0 });
  }, [v]);

  if (v.view === 'new')
    return (
      <VisualCapture
        existing={v.existing}
        onCancel={() => setV(v.existing ? { view: 'report', id: v.existing.id } : { view: 'home' })}
        onDone={(id) => setV({ view: 'report', id })}
      />
    );
  if (v.view === 'report')
    return <VisualReport key={v.id} id={v.id} onBack={() => setV({ view: 'home' })} onAddScreens={(a) => setV({ view: 'new', existing: a })} />;
  return <VisualHome onNew={() => setV({ view: 'new' })} onOpen={(id) => setV({ view: 'report', id })} />;
};
