// Elementos citáveis de uma tela (E1, E2…), numerados do mesmo jeito no painel e no servidor.
export interface AgentElement {
  id: string;
  kind: string;
  t: string;
  box: { x: number; y: number; w: number; h: number };
  desc: string;
}

const KIND: Record<string, string> = { acao: 'botão/link', campo: 'campo', texto: 'texto', imagem: 'imagem', icone: 'ícone' };

/** Elementos citáveis da tela, numerados (E1, E2…), com caixa em coordenadas da imagem. */
export function elementList(s: any): AgentElement[] {
  const k = (s.imageWidth || 1) / (s.docWidth || s.imageWidth || 1);
  const vh = s.viewportHeight || 900;
  const vw = s.viewportWidth || s.docWidth || 1440;
  const els: any[] = (s.elements || []).filter((e: any) => !s.dialog || e.dl !== 0);
  const pick = els.filter(
    (e) =>
      (e.k === 'acao' && e.t) ||
      e.k === 'campo' ||
      (e.k === 'texto' && e.t && ((e.fs || 0) >= 16 || e.hd || e.t.length >= 4)) ||
      (e.k === 'imagem' && e.w * e.h > 6000)
  );
  const seen = new Set<string>();
  const uniq = pick.filter((e) => {
    const key = `${e.k}|${e.t}|${Math.round(e.y / 8)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // ações, campos e títulos primeiro; depois o resto, sempre na ordem de leitura
  const weight = (e: any) => (e.k === 'acao' || e.k === 'campo' || e.hd || (e.fs || 0) >= 20 ? 0 : 1);
  const chosen = uniq.sort((a, b) => weight(a) - weight(b) || a.y - b.y || a.x - b.x).slice(0, 45).sort((a, b) => a.y - b.y || a.x - b.x);
  const where = (e: any) => {
    const cx = e.x + e.w / 2;
    const col = cx < vw / 3 ? 'esquerda' : cx < (2 * vw) / 3 ? 'centro' : 'direita';
    const row = e.y > vh ? 'abaixo da dobra' : e.y < vh / 3 ? 'topo' : e.y < (2 * vh) / 3 ? 'meio' : 'parte de baixo';
    return `${row}, ${col}`;
  };
  return chosen.map((e, i) => ({
    id: `E${i + 1}`,
    kind: KIND[e.k] || e.k,
    t: e.t || '',
    box: { x: Math.round(e.x * k), y: Math.round(e.y * k), w: Math.round(e.w * k), h: Math.round(e.h * k) },
    desc: `${KIND[e.k] || e.k}${e.t ? ` "${e.t}"` : ''} · ${Math.round(e.w)}×${Math.round(e.h)}px${e.fs ? ` · fonte ${e.fs}px` : ''}${e.cr ? ` · contraste ${e.cr}:1` : ''}${e.filled ? ' · preenchido' : ''}${e.disabled ? ' · desabilitado' : ''} · ${where(e)}`
  }));
}

