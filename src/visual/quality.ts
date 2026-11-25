// Raio-X: consistência do fluxo e acessibilidade com correção pronta.
// Tudo calculado a partir das medidas da captura (sem IA). Web e celular usam critérios próprios.
import { prominence } from './engine';
import { VisualElement, VisualScreen } from './types';

export type Sev = 1 | 2 | 3; // 1 cosmético · 2 menor · 3 maior (escala de Nielsen)

const isMobile = (s: VisualScreen) => (s.viewportWidth || 1440) < 700;

// ---------- cores ----------
const hexToRgb = (h: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
const rgbToHex = (c: { r: number; g: number; b: number }) =>
  '#' + [c.r, c.g, c.b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
const lum = (c: { r: number; g: number; b: number }) => {
  const f = (v: number) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};
export const contrastRatio = (a: string, b: string) => {
  const x = hexToRgb(a), y = hexToRgb(b);
  if (!x || !y) return null;
  const l1 = lum(x), l2 = lum(y);
  return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;
};
/** A cor mais próxima da original (mesmo tom) que atinge o contraste pedido sobre o fundo. */
export function fixColor(fg: string, bg: string, need: number): { hex: string; ratio: number } | null {
  const f = hexToRgb(fg), b = hexToRgb(bg);
  if (!f || !b) return null;
  const towards = lum(b) > 0.5 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 }; // fundo claro → escurece o texto
  for (let t = 0.02; t <= 1.0001; t += 0.02) {
    const c = { r: f.r + (towards.r - f.r) * t, g: f.g + (towards.g - f.g) * t, b: f.b + (towards.b - f.b) * t };
    const hex = rgbToHex(c);
    const r = contrastRatio(hex, bg) || 0;
    if (r >= need + 0.05) return { hex, ratio: Math.round(r * 10) / 10 };
  }
  return null;
}
const colorDist = (a: string, b: string) => {
  const x = hexToRgb(a), y = hexToRgb(b);
  if (!x || !y) return 999;
  return Math.sqrt((x.r - y.r) ** 2 + (x.g - y.g) ** 2 + (x.b - y.b) ** 2);
};

// ---------- consistência do fluxo ----------
export interface ConsistencyCard {
  key: 'tipografia' | 'cores' | 'botoes' | 'campos';
  title: string;
  sev: Sev | 0;
  summary: string;
  suggestion: string;
  where: number[]; // passos (1..n)
  fonts?: { size: number; count: number; rare: boolean; to?: number }[];
  colors?: { hex: string; count: number; use: string; steps: number[]; to?: string }[];
  styles?: { label: string; h: number; br?: number; filled: boolean; bg?: string; fg?: string; steps: number[]; main: boolean }[];
  tie?: boolean;
}
export interface Consistency {
  fontSizes: number;
  nearColors: number;
  buttonStyles: number;
  fieldStyles: number;
  cards: ConsistencyCard[];
}

const round4 = (v: number) => Math.round(v / 4) * 4;
/** Botão realmente preenchido: fundo próprio que se destaca da página (branco sobre branco é contorno). */
export const isFilled = (e: VisualElement) => !!e.filled && (e.fillContrast ?? 2) >= 1.3;

function primaryAction(s: VisualScreen): VisualElement | null {
  const vw = s.viewportWidth || s.docWidth;
  const acts = (s.elements || []).filter((e) => e.k === 'acao' && e.t && !e.disabled && (!s.dialog || e.dl !== 0));
  // menus no topo não contam como ação principal
  const cand = acts.filter((e) => !(e.y < (s.viewportHeight || 900) * 0.1 && e.h < 64));
  return cand.sort((a, b) => prominence(b, vw) - prominence(a, vw))[0] || null;
}

export function flowConsistency(screens: VisualScreen[]): Consistency {
  const steps = (set: Set<number>) => [...set].sort((a, b) => a - b);

  // Tipografia
  const fonts = new Map<number, { count: number; steps: Set<number> }>();
  screens.forEach((s, i) =>
    (s.elements || []).forEach((e) => {
      if (!e.fs || !(e.k === 'texto' || e.k === 'acao' || e.k === 'campo')) return;
      const f = fonts.get(e.fs) || { count: 0, steps: new Set<number>() };
      f.count++;
      f.steps.add(i + 1);
      fonts.set(e.fs, f);
    })
  );
  const sizes = [...fonts.entries()].sort((a, b) => a[0] - b[0]);
  // corpo de texto (< 18px) e títulos (>= 18px) têm escalas próprias: um título nunca vira tamanho de corpo
  const groupOf = (px: number) => (px >= 18 ? 'titulo' : 'corpo');
  const fontList = sizes.map(([size, v]) => {
    const group = sizes.filter(([sz]) => groupOf(sz) === groupOf(size));
    const limit = groupOf(size) === 'titulo' ? 2 : 3; // até 2 tamanhos de título e 3 de corpo é saudável
    if (group.length <= limit || v.count > 2) return { size, count: v.count, rare: false };
    const targets = group.filter(([sz, gv]) => sz !== size && gv.count > v.count).map(([sz]) => sz);
    const to = targets.reduce<number | undefined>((best, c) => (best === undefined || Math.abs(c - size) < Math.abs(best - size) ? c : best), undefined);
    const close = to !== undefined && Math.abs(to - size) <= Math.max(2, size * 0.15);
    return { size, count: v.count, rare: close, to: close ? to : undefined };
  });
  const keep = fontList.filter((f) => !f.rare).map((f) => f.size);
  const common = keep;
  const rareFonts = fontList.filter((f) => f.rare && f.to);
  const fontWhere = new Set<number>();
  rareFonts.forEach((f) => fonts.get(f.size)!.steps.forEach((x) => fontWhere.add(x)));

  // Cores (texto + fundo de botões preenchidos): tons quase iguais
  const cols = new Map<string, { count: number; steps: Set<number>; uses: Set<string> }>();
  const addCol = (hex: string | undefined, step: number, use: string) => {
    if (!hex) return;
    const h = hex.toUpperCase();
    const c = cols.get(h) || { count: 0, steps: new Set<number>(), uses: new Set<string>() };
    c.count++;
    c.steps.add(step);
    c.uses.add(use);
    cols.set(h, c);
  };
  screens.forEach((s, i) =>
    (s.elements || []).forEach((e) => {
      if (e.k === 'texto') addCol(e.fg, i + 1, 'texto');
      if (e.k === 'acao' && isFilled(e)) addCol(e.bg, i + 1, 'botão');
      else if (e.k === 'acao') addCol(e.fg, i + 1, 'link');
    })
  );
  const colEntries = [...cols.entries()].sort((a, b) => b[1].count - a[1].count);
  const pairs: { keep: string; drop: string }[] = [];
  colEntries.forEach(([hex, v], i) => {
    for (let j = 0; j < i; j++) {
      const [other] = colEntries[j];
      const d = colorDist(hex, other);
      if (d > 0 && d < 14 && !pairs.some((p) => p.drop === other)) {
        pairs.push({ keep: other, drop: hex });
        break;
      }
    }
  });
  const colorList = colEntries
    .filter(([hex]) => pairs.some((p) => p.keep === hex || p.drop === hex))
    .map(([hex, v]) => ({ hex, count: v.count, use: [...v.uses].join(', '), steps: steps(v.steps), to: pairs.find((p) => p.drop === hex)?.keep }));
  const colorWhere = new Set<number>();
  colorList.filter((c) => c.to).forEach((c) => c.steps.forEach((x) => colorWhere.add(x)));

  // Botão principal: um estilo por fluxo
  const sigs = new Map<string, { label: string; h: number; br?: number; filled: boolean; bg?: string; fg?: string; steps: Set<number> }>();
  screens.forEach((s, i) => {
    const p = primaryAction(s);
    if (!p) return;
    const filled = isFilled(p);
    const sig = `${filled ? 'cheio' : 'contorno'}|${round4(p.h)}|${p.br ?? '?'}|${filled ? p.bg : p.fg}`;
    const cur = sigs.get(sig) || { label: p.t, h: round4(p.h), br: p.br, filled, bg: p.bg, fg: p.fg, steps: new Set<number>() };
    cur.steps.add(i + 1);
    sigs.set(sig, cur);
  });
  const styleList = [...sigs.values()]
    .sort((a, b) => b.steps.size - a.steps.size || Math.min(...a.steps) - Math.min(...b.steps))
    .map((v, i) => ({ ...v, steps: steps(v.steps), main: i === 0 }));
  const mainStyle = styleList[0];
  const tie = styleList.length > 1 && styleList[0].steps.length === styleList[1].steps.length;

  // Campos: mesma altura e raio
  const fsig = new Map<string, Set<number>>();
  screens.forEach((s, i) =>
    (s.elements || [])
      .filter((e) => e.k === 'campo' && e.h >= 20)
      .forEach((e) => {
        const k = `${round4(e.h)}|${e.br ?? '?'}`;
        const set = fsig.get(k) || new Set<number>();
        set.add(i + 1);
        fsig.set(k, set);
      })
  );
  const fieldStyles = [...fsig.entries()].sort((a, b) => b[1].size - a[1].size);

  const cards: ConsistencyCard[] = [];
  cards.push({
    key: 'tipografia',
    title: 'Tipografia',
    sev: rareFonts.length ? 2 : 0,
    summary: rareFonts.length
      ? `${sizes.length} tamanhos de fonte no fluxo; ${rareFonts.length} ${rareFonts.length === 1 ? 'aparece' : 'aparecem'} pouco e ${rareFonts.length === 1 ? 'fica' : 'ficam'} muito perto de outro tamanho, quebrando a escala.`
      : `${sizes.length} tamanhos de fonte, todos usados com frequência.`,
    suggestion: rareFonts.length ? `Escala sugerida: ${common.join(' · ')}px. Trocar ${rareFonts.map((f) => `${f.size}→${f.to}`).join(', ')}.` : '',
    where: steps(fontWhere),
    fonts: fontList
  });
  cards.push({
    key: 'cores',
    title: 'Cores',
    sev: pairs.length ? 2 : 0,
    summary: pairs.length ? `${pairs.length} ${pairs.length === 1 ? 'par de cores quase iguais' : 'pares de cores quase iguais'}: provavelmente cores soltas, fora do sistema.` : 'Nenhuma cor quase repetida.',
    suggestion: pairs.map((p) => `Unificar ${p.drop} em ${p.keep}`).join('. ') + (pairs.length ? '.' : ''),
    where: steps(colorWhere),
    colors: colorList
  });
  if (styleList.length) {
    const others = styleList.slice(1);
    cards.push({
      key: 'botoes',
      title: 'Botão principal',
      sev: others.length ? 3 : 0,
      summary: others.length ? `${styleList.length} estilos diferentes para a ação principal ao longo do fluxo.` : 'A ação principal tem o mesmo estilo em todas as telas.',
      suggestion: others.length
        ? `Padronizar no estilo ${tie ? 'da primeira tela' : 'mais usado'}: ${mainStyle.filled ? 'preenchido' : 'contorno'}, ${mainStyle.h}px de altura${mainStyle.br !== undefined ? `, raio ${mainStyle.br}` : ''}. Ajustar ${others.map((o) => `"${o.label}" (passo ${o.steps.join(', ')})`).join(', ')}.`
        : '',
      where: others.flatMap((o) => o.steps),
      styles: styleList,
      tie
    });
  }
  if (fieldStyles.length > 1) {
    const [main, ...rest] = fieldStyles;
    const [h, br] = main[0].split('|');
    cards.push({
      key: 'campos',
      title: 'Campos',
      sev: 2,
      summary: `${fieldStyles.length} alturas ou raios diferentes de campo.`,
      suggestion: `Padronizar em ${h}px de altura${br !== '?' ? `, raio ${br}` : ''}.`,
      where: [...new Set(rest.flatMap(([, s]) => [...s]))].sort((a, b) => a - b)
    });
  }
  return { fontSizes: sizes.length, nearColors: pairs.length, buttonStyles: styleList.length, fieldStyles: fieldStyles.length, cards };
}

// ---------- acessibilidade por tela ----------
export interface A11yIssue {
  kind: 'contraste' | 'alvo' | 'rotulo' | 'fonte-campo' | 'dobra' | 'linha';
  sev: Sev;
  title: string;
  desc: string;
  fix: string;
  box?: { x: number; y: number; w: number; h: number }; // coordenadas da imagem
  color?: { from: string; fromRatio: number; to: string; toRatio: number };
}

export function screenA11y(s: VisualScreen): { mobile: boolean; issues: A11yIssue[] } {
  const mobile = isMobile(s);
  const k = s.imageWidth / (s.docWidth || s.imageWidth);
  const box = (e: VisualElement) => ({ x: e.x * k, y: e.y * k, w: e.w * k, h: e.h * k });
  const els = (s.elements || []).filter((e) => !s.dialog || e.dl !== 0);
  const issues: A11yIssue[] = [];
  const q = (t: string) => `"${t.length > 40 ? t.slice(0, 39) + '…' : t}"`;

  // contraste (WCAG AA) com a cor corrigida
  const large = (e: VisualElement) => (e.fs || 0) >= 24 || ((e.fs || 0) >= 18.66 && (e.fw || 400) >= 700);
  els
    .filter((e) => (e.k === 'texto' || e.k === 'acao' || e.k === 'campo') && e.t && e.cr && e.fg && e.bg && !e.bgImage)
    .forEach((e) => {
      const need = large(e) ? 3 : 4.5;
      if ((e.cr as number) >= need) return;
      const fix = fixColor(e.fg!, e.bg!, need);
      issues.push({
        kind: 'contraste',
        sev: (e.cr as number) < need - 1.5 ? 3 : 2,
        title: 'Contraste abaixo do mínimo',
        desc: `${q(e.t)} tem ${String(e.cr).replace('.', ',')}:1. ${large(e) ? 'Texto grande' : `Texto de ${e.fs}px`} precisa de ${String(need).replace('.', ',')}:1.`,
        fix: fix ? `Trocar a cor do texto de ${e.fg} para ${fix.hex} (mesmo tom, ${String(fix.ratio).replace('.', ',')}:1).` : 'Escurecer o texto ou clarear o fundo.',
        box: box(e),
        color: fix ? { from: e.fg!, fromRatio: e.cr as number, to: fix.hex, toRatio: fix.ratio } : undefined
      });
    });

  // tamanho do alvo de clique/toque
  const minT = mobile ? 44 : 24;
  els
    .filter((e) => e.k === 'acao' && e.t && !e.disabled && (e.h < minT || (mobile && e.w < minT)))
    .forEach((e) => {
      // link dentro de um parágrafo segue a regra do texto, não a de alvo
      if (!isFilled(e) && e.h < 22 && !mobile) return;
      issues.push({
        kind: 'alvo',
        sev: e.h < minT * 0.75 ? 3 : 2,
        title: mobile ? 'Alvo de toque pequeno' : 'Alvo de clique pequeno',
        desc: mobile
          ? `${q(e.t)} tem ${Math.round(e.w)}×${Math.round(e.h)}px. No celular o mínimo recomendado é 44px (iOS) ou 48px (Android).`
          : `${q(e.t)} tem ${Math.round(e.w)}×${Math.round(e.h)}px. O mínimo na web (WCAG 2.2) é 24×24px.`,
        fix: mobile ? `Altura de 48px${e.w < 44 ? ' e largura de pelo menos 48px' : ''}, com 8px de espaço até o próximo toque.` : 'Pelo menos 24px de altura; para ações principais, 36 a 44px.',
        box: box(e)
      });
    });

  // campo sem rótulo visível (placeholder no lugar do rótulo) e fonte pequena no celular
  const fields = (s.context?.fields || []) as any[];
  els
    .filter((e) => e.k === 'campo')
    .forEach((e) => {
      const f = fields.find((x) => x.label === e.t);
      const placeholderOnly = !e.t || (f && f.placeholder && f.placeholder === f.label);
      if (placeholderOnly)
        issues.push({
          kind: 'rotulo',
          sev: 2,
          title: 'Campo sem rótulo visível',
          desc: `${e.t ? `O campo ${q(e.t)} usa` : 'Um campo usa'} só o texto de exemplo dentro dele. Ao digitar, a pessoa perde a referência do que está preenchendo.`,
          fix: 'Colocar um rótulo fixo acima do campo e deixar o exemplo como texto de apoio.',
          box: box(e)
        });
      if (mobile && e.fs && e.fs < 16)
        issues.push({
          kind: 'fonte-campo',
          sev: 2,
          title: 'Fonte do campo menor que 16px',
          desc: `${e.t ? q(e.t) : 'O campo'} usa ${e.fs}px. No iPhone, campos abaixo de 16px dão zoom ao tocar e desalinham a tela.`,
          fix: 'Usar 16px no texto digitado.',
          box: box(e)
        });
    });

  // ação principal abaixo da dobra
  const p = primaryAction(s);
  const vh = s.viewportHeight || (mobile ? 844 : 900);
  if (p && p.y + p.h > vh) {
    const screensDown = Math.max(1, Math.round((p.y + p.h - vh) / vh + 0.5));
    issues.push({
      kind: 'dobra',
      sev: 2,
      title: 'Ação principal abaixo da dobra',
      desc: `${q(p.t)} só aparece depois de rolar ${screensDown === 1 ? 'uma tela' : `${screensDown} telas`}.${mobile ? ' No celular, ações importantes ficam ao alcance do polegar.' : ''}`,
      fix: mobile ? 'Subir a ação para a primeira dobra ou fixá-la no rodapé.' : 'Trazer a ação para a primeira dobra (900px) ou repeti-la no topo.',
      box: box(p)
    });
  }

  // linhas longas demais (web)
  if (!mobile)
    els
      .filter((e) => e.k === 'texto' && e.fs && e.fs <= 20 && e.h > e.fs * 2.2 && e.t.length >= 60)
      .forEach((e) => {
        const perLine = Math.round(e.w / ((e.fs as number) * 0.5));
        if (perLine <= 90) return;
        issues.push({
          kind: 'linha',
          sev: 1,
          title: 'Linha de texto longa demais',
          desc: `O texto ${q(e.t)} tem cerca de ${perLine} caracteres por linha. Acima de ~75 a leitura cansa e a pessoa perde a linha seguinte.`,
          fix: `Limitar a largura do bloco a cerca de ${Math.round(75 * (e.fs as number) * 0.5)}px.`,
          box: box(e)
        });
      });

  // um apontamento por elemento e tipo; os mais graves primeiro
  const seen = new Set<string>();
  const out = issues.filter((i) => {
    const key = `${i.kind}|${Math.round(i.box?.x || 0)}|${Math.round(i.box?.y || 0)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  out.sort((a, b) => b.sev - a.sev || (a.box?.y || 0) - (b.box?.y || 0));
  return { mobile, issues: out.slice(0, 20) };
}

export const SEV_LABEL: Record<number, string> = { 0: 'Ok', 1: 'Cosmético', 2: 'Menor', 3: 'Maior' };
export const SEV_TONE: Record<number, string> = {
  0: 'bg-emerald-50 text-emerald-700',
  1: 'bg-slate-100 text-slate-700',
  2: 'bg-amber-50 text-amber-800',
  3: 'bg-orange-100 text-orange-800'
};
