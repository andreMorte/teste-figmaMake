// Raio-X da interface: estimativa de atenção visual, foco, contraste, áreas de interesse e notas.
// Modelo heurístico (sem eye-tracking real): saliência de baixo nível da imagem (contraste de cor e luz em
// várias escalas + bordas) combinada com o peso de cada elemento da tela (tamanho da fonte, botões
// preenchidos, campos, imagens), viés de posição (centro e leitura em F) e queda abaixo da primeira dobra.
import { VisualAoi, VisualElement, VisualMetrics, VisualScreen } from './types';

export const ENGINE_VERSION = 2;
const GRID_W = 200;

export interface AttentionField {
  gw: number;
  gh: number;
  data: Float32Array; // 0..1
  edges: Float32Array;
  lum: Float32Array;
  scale: number; // px da imagem por célula
}

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const lin = (v: number, a: number, b: number) => clamp((v - a) / (b - a));

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível ler a imagem'));
    img.src = src;
  });
}

// Desfoque de caixa separável (rápido) — aplicado 2x aproxima um gaussiano
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return src.slice();
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const pass = (a: Float32Array, b: Float32Array, horiz: boolean) => {
    const n = horiz ? w : h;
    const m = horiz ? h : w;
    for (let j = 0; j < m; j++) {
      let acc = 0;
      let cnt = 0;
      const at = (i: number) => (horiz ? j * w + i : i * w + j);
      for (let i = -r; i <= r; i++) if (i >= 0 && i < n) {
        acc += a[at(i)];
        cnt++;
      }
      for (let i = 0; i < n; i++) {
        b[at(i)] = acc / cnt;
        const add = i + r + 1;
        const rem = i - r;
        if (add < n) {
          acc += a[at(add)];
          cnt++;
        }
        if (rem >= 0) {
          acc -= a[at(rem)];
          cnt--;
        }
      }
    }
  };
  pass(src, tmp, true);
  pass(tmp, out, false);
  return out;
}
const blur = (a: Float32Array, w: number, h: number, r: number) => boxBlur(boxBlur(a, w, h, r), w, h, r);

function normalize(a: Float32Array) {
  let mx = 0;
  for (let i = 0; i < a.length; i++) if (a[i] > mx) mx = a[i];
  if (mx > 0) for (let i = 0; i < a.length; i++) a[i] /= mx;
  return a;
}
// Mapas com poucos picos fortes valem mais que mapas uniformes (normalização de Itti)
function itti(a: Float32Array) {
  normalize(a);
  let mean = 0;
  for (let i = 0; i < a.length; i++) mean += a[i];
  mean /= a.length;
  const k = (1 - mean) * (1 - mean);
  for (let i = 0; i < a.length; i++) a[i] *= k;
  return a;
}

export function prominence(e: VisualElement, vw: number) {
  const area = e.w * e.h;
  if (e.k === 'acao') {
    let p = 0.55;
    if (e.filled) p += 0.45 + (e.sat || 0) * 0.5 + lin(e.fillContrast || 1, 1, 4) * 0.4;
    p *= 0.7 + lin(area, 600, 12000) * 0.6;
    if (e.disabled) p *= 0.4;
    return p;
  }
  if (e.k === 'texto') {
    const fs = e.fs || 14;
    let p = 0.18 + Math.pow(fs / 16, 1.6) * 0.32 + (e.fw && e.fw >= 600 ? 0.12 : 0);
    if (e.hd) p += 0.35 * (4 - e.hd) / 3;
    if (e.cr) p *= 0.55 + lin(e.cr, 1.5, 7) * 0.45;
    return p * (fs > vw / 20 ? 1.15 : 1);
  }
  if (e.k === 'campo') return 0.5;
  if (e.k === 'imagem') return 0.45 + lin(area, 5000, 120000) * 0.35;
  return 0.22; // ícone
}

export async function computeAttention(screen: VisualScreen): Promise<AttentionField> {
  const img = await loadImage(screen.image);
  const gw = GRID_W;
  const scale = img.width / gw;
  const gh = Math.max(1, Math.round(img.height / scale));
  const cv = document.createElement('canvas');
  cv.width = gw;
  cv.height = gh;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, gw, gh);
  const px = ctx.getImageData(0, 0, gw, gh).data;
  const n = gw * gh;
  const L = new Float32Array(n);
  const RG = new Float32Array(n);
  const BY = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = px[i * 4] / 255;
    const g = px[i * 4 + 1] / 255;
    const b = px[i * 4 + 2] / 255;
    L[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    RG[i] = r - g;
    BY[i] = b - (r + g) / 2;
  }
  // centro × entorno em duas escalas
  const cs = (ch: Float32Array) => {
    const c = blur(ch, gw, gh, 1);
    const s1 = blur(ch, gw, gh, 5);
    const s2 = blur(ch, gw, gh, 12);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = Math.abs(c[i] - s1[i]) + 0.7 * Math.abs(c[i] - s2[i]);
    return itti(out);
  };
  const bu = new Float32Array(n);
  const cl = cs(L);
  const crg = cs(RG);
  const cby = cs(BY);
  for (let i = 0; i < n; i++) bu[i] = 0.5 * cl[i] + 0.25 * crg[i] + 0.25 * cby[i];
  normalize(bu);

  // bordas (Sobel na luminância)
  const edges = new Float32Array(n);
  for (let y = 1; y < gh - 1; y++)
    for (let x = 1; x < gw - 1; x++) {
      const i = y * gw + x;
      const gx = -L[i - gw - 1] - 2 * L[i - 1] - L[i + gw - 1] + L[i - gw + 1] + 2 * L[i + 1] + L[i + gw + 1];
      const gy = -L[i - gw - 1] - 2 * L[i - gw] - L[i - gw + 1] + L[i + gw - 1] + 2 * L[i + gw] + L[i + gw + 1];
      edges[i] = Math.sqrt(gx * gx + gy * gy);
    }
  const edgesRaw = edges.slice();
  const edgeMap = normalize(blur(edges, gw, gh, 2));

  // peso dos elementos da tela
  const k = (img.width / (screen.docWidth || img.width)) / scale; // px do documento → célula
  const vw = screen.viewportWidth || screen.docWidth;
  const vh = screen.viewportHeight || 900;
  const dom = new Float32Array(n);
  const vArea = vw * vh;
  for (const e of screen.elements || []) {
    const p = prominence(e, vw);
    const area = e.w * e.h;
    const density = p / (1 + area / (0.12 * vArea));
    const x0 = Math.floor(e.x * k), y0 = Math.floor(e.y * k);
    const x1 = Math.min(gw - 1, Math.ceil((e.x + e.w) * k)), y1 = Math.min(gh - 1, Math.ceil((e.y + e.h) * k));
    for (let y = Math.max(0, y0); y <= y1; y++) for (let x = Math.max(0, x0); x <= x1; x++) {
      const i = y * gw + x;
      dom[i] = Math.max(dom[i], density);
    }
  }
  const domMap = normalize(blur(dom, gw, gh, 3));

  // posição: centro + leitura em F (desktop) e queda abaixo da dobra
  const foldCells = vh * k;
  const desktop = vw >= 768;
  const S = new Float32Array(n);
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      const nx = x / gw;
      const ny = y / Math.max(1, foldCells);
      const center = Math.exp(-((nx - 0.5) ** 2) / (2 * 0.28 ** 2) - ((ny - 0.42) ** 2) / (2 * 0.45 ** 2));
      const fpat = desktop ? Math.exp(-nx * 1.4 - Math.max(0, ny) * 0.6) : 0;
      const pos = desktop ? 0.6 * center + 0.4 * fpat : center;
      const fold = y < foldCells ? 1 : Math.exp(-(y - foldCells) / (0.85 * foldCells));
      S[i] = (0.3 * bu[i] + 0.12 * edgeMap[i] + 0.43 * domMap[i] + 0.15 * pos) * fold;
    }
  const data = normalize(blur(S, gw, gh, 2));
  // contraste local de luminância (para o mapa de contraste)
  return { gw, gh, data, edges: edgesRaw, lum: L, scale };
}

/** Fração da atenção dentro de um retângulo (coordenadas da imagem). */
export function shareIn(f: AttentionField, r: { x: number; y: number; w: number; h: number }) {
  let total = 0;
  let inside = 0;
  const x0 = Math.floor(r.x / f.scale), y0 = Math.floor(r.y / f.scale);
  const x1 = Math.ceil((r.x + r.w) / f.scale), y1 = Math.ceil((r.y + r.h) / f.scale);
  for (let y = 0; y < f.gh; y++)
    for (let x = 0; x < f.gw; x++) {
      const v = f.data[y * f.gw + x];
      total += v;
      if (x >= x0 && x < x1 && y >= y0 && y < y1) inside += v;
    }
  return total ? inside / total : 0;
}

const uid = () => Math.random().toString(36).slice(2, 9);
const nameOf = (t: string, max = 28) => (t.length > max ? `${t.slice(0, max - 1)}…` : t);

/** Áreas de interesse sugeridas a partir dos elementos (o pesquisador pode editar). */
export function autoAois(screen: VisualScreen): VisualAoi[] {
  const k = screen.imageWidth / (screen.docWidth || screen.imageWidth);
  const vw = screen.viewportWidth || screen.docWidth;
  const vh = screen.viewportHeight || 900;
  // num diálogo, só o que está dentro dele
  const dlg = screen.dialog;
  const inDlg = (e: VisualElement) => !dlg || (e.dl !== undefined ? e.dl === 1 : e.x >= dlg.x - 4 && e.y >= dlg.y - 4 && e.x + e.w <= dlg.x + dlg.w + 4 && e.y + e.h <= dlg.y + dlg.h + 4);
  const els = (screen.elements || []).filter(inDlg);
  const box = (e: { x: number; y: number; w: number; h: number }) => ({ x: Math.round(e.x * k), y: Math.round(e.y * k), w: Math.round(e.w * k), h: Math.round(e.h * k) });
  const out: VisualAoi[] = [];
  const taken: VisualElement[] = [];
  const overlaps = (a: VisualElement, b: VisualElement) => {
    const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return ix * iy > 0.5 * Math.min(a.w * a.h, b.w * b.h);
  };
  const add = (name: string, e: VisualElement | { x: number; y: number; w: number; h: number }) => {
    if ('k' in e) {
      if (taken.some((t) => overlaps(t, e as VisualElement))) return;
      taken.push(e as VisualElement);
    }
    out.push({ id: `A-${uid()}`, name, auto: true, ...box(e) });
  };

  const texts = els.filter((e) => e.k === 'texto' && e.t && e.y < vh * 1.5);
  const title = [...texts].sort((a, b) => (b.fs || 0) - (a.fs || 0) || (a.hd || 9) - (b.hd || 9))[0];
  if (title && (title.fs || 0) >= 18) add('Título', title);

  // logo: imagem/ícone pequeno no topo à esquerda
  const logo = dlg ? undefined : els.find((e) => (e.k === 'imagem' || e.k === 'icone') && e.y < vh * 0.12 && e.x < vw * 0.35 && e.w * e.h < vw * vh * 0.05 && e.w > 24);
  if (logo) add('Logo', logo);

  const actions = els
    .filter((e) => e.k === 'acao' && e.t && !e.disabled)
    .map((e) => ({ e, p: prominence(e, vw) * (e.y < vh ? 1 : 0.6) }))
    .sort((a, b) => b.p - a.p);
  // menu: ações no topo
  const nav = actions.filter((a) => a.e.y + a.e.h < vh * 0.12 && a.e.h < 64);
  if (nav.length >= 3) {
    const xs = nav.map((a) => a.e);
    const x0 = Math.min(...xs.map((e) => e.x)), y0 = Math.min(...xs.map((e) => e.y));
    const x1 = Math.max(...xs.map((e) => e.x + e.w)), y1 = Math.max(...xs.map((e) => e.y + e.h));
    add('Menu', { x: x0 - 4, y: y0 - 4, w: x1 - x0 + 8, h: y1 - y0 + 8 });
    nav.forEach((a) => taken.push(a.e));
  }
  const main = actions.filter((a) => !nav.includes(a));
  if (main[0]) add(`CTA: ${nameOf(main[0].e.t, 22)}`, main[0].e);
  main.slice(1, 3).forEach((a) => add(`Ação: ${nameOf(a.e.t, 20)}`, a.e));

  const fields = els.filter((e) => e.k === 'campo');
  if (fields.length) {
    const x0 = Math.min(...fields.map((e) => e.x)), y0 = Math.min(...fields.map((e) => e.y));
    const x1 = Math.max(...fields.map((e) => e.x + e.w)), y1 = Math.max(...fields.map((e) => e.y + e.h));
    add(fields.length > 1 ? 'Formulário' : `Campo${fields[0].t ? `: ${nameOf(fields[0].t, 18)}` : ''}`, { x: x0 - 6, y: y0 - 22, w: x1 - x0 + 12, h: y1 - y0 + 28 });
  }

  const image = els.filter((e) => e.k === 'imagem' && e !== logo).sort((a, b) => b.w * b.h - a.w * a.h)[0];
  if (image && image.w * image.h > 9000) add('Imagem', image);

  // texto de apoio: o maior bloco de texto comum perto do título
  const support = texts
    .filter((e) => e !== title && (e.fs || 0) < (title?.fs || 99) && e.t.length > 18 && (!title || e.y >= title.y))
    .sort((a, b) => (title ? Math.abs(a.y - title.y) - Math.abs(b.y - title.y) : b.w * b.h - a.w * a.h))[0];
  if (support) add('Texto de apoio', support);

  return out.slice(0, 9);
}

export function withShares(f: AttentionField, screen: VisualScreen, aois: VisualAoi[]): VisualAoi[] {
  const k = screen.imageWidth / (screen.docWidth || screen.imageWidth);
  const fold = (screen.viewportHeight || 900) * k;
  // tamanho comparado à primeira dobra (onde o olhar começa)
  const ref = screen.imageWidth * Math.min(screen.imageHeight, fold);
  return aois.map((a) => {
    const share = shareIn(f, a);
    const areaFrac = Math.max(0.0005, (a.w * a.h) / ref);
    return { ...a, share, lift: Math.round((share / areaFrac) * 10) / 10, firstFold: a.y < fold };
  });
}

/** Cor da área: pelo destaque relativo ao tamanho (um botão pequeno com 4% pode estar ótimo). */
export const aoiTone = (a: VisualAoi) => ((a.lift ?? 0) >= 4 ? 'good' : (a.lift ?? 0) >= 2 ? 'mid' : 'low');

export function computeMetrics(f: AttentionField, screen: VisualScreen): VisualMetrics {
  const vh = screen.viewportHeight || 900;
  const k = screen.imageWidth / (screen.docWidth || screen.imageWidth);
  const foldRows = Math.min(f.gh, Math.round((vh * k) / f.scale));
  // foco: quanto da atenção cai nos 10% de células mais fortes (primeira dobra)
  const vals: number[] = [];
  for (let y = 0; y < foldRows; y++) for (let x = 0; x < f.gw; x++) vals.push(f.data[y * f.gw + x]);
  vals.sort((a, b) => b - a);
  const total = vals.reduce((t, v) => t + v, 0) || 1;
  const top = vals.slice(0, Math.max(1, Math.round(vals.length * 0.1))).reduce((t, v) => t + v, 0);
  const focus = Math.round(lin(top / total, 0.14, 0.42) * 100);

  // clareza: o inverso da complexidade visual da primeira dobra
  let edge = 0;
  for (let y = 0; y < foldRows; y++) for (let x = 0; x < f.gw; x++) edge += f.edges[y * f.gw + x];
  edge /= Math.max(1, foldRows * f.gw);
  const els = (screen.elements || []).filter((e) => e.y < vh);
  const textChars = els.filter((e) => e.k === 'texto').reduce((t, e) => t + (e.t || '').length, 0);
  const colors = new Set(els.filter((e) => e.fg).map((e) => e.fg));
  const complexity =
    0.35 * lin(edge, 0.05, 0.38) + 0.3 * lin(els.length, 10, 90) + 0.15 * lin(colors.size, 4, 18) + 0.2 * lin(textChars, 120, 1400);
  const clarity = Math.round(clamp(1 - complexity, 0.05, 0.98) * 100);

  const texts = (screen.elements || []).filter((e) => (e.k === 'texto' || e.k === 'acao' || e.k === 'campo') && e.t && e.cr && !e.bgImage);
  const large = (e: VisualElement) => (e.fs || 0) >= 24 || ((e.fs || 0) >= 18.66 && (e.fw || 400) >= 700);
  const fails = texts.filter((e) => (e.cr as number) < (large(e) ? 3 : 4.5));
  return {
    clarity,
    focus,
    contrastPass: texts.length ? Math.round(((texts.length - fails.length) / texts.length) * 100) : null,
    contrastFails: fails.length,
    elementsAboveFold: els.length,
    textChars,
    actions: els.filter((e) => e.k === 'acao').length,
    fields: els.filter((e) => e.k === 'campo').length,
    version: ENGINE_VERSION
  };
}

export const clarityLabel = (v: number) => (v >= 70 ? 'Fácil de entender' : v >= 45 ? 'Dificuldade moderada' : 'Difícil de entender');
export const focusLabel = (v: number) => (v >= 66 ? 'Atenção concentrada' : v >= 40 ? 'Atenção dividida' : 'Atenção espalhada');

export function contrastFailures(screen: VisualScreen) {
  const k = screen.imageWidth / (screen.docWidth || screen.imageWidth);
  const large = (e: VisualElement) => (e.fs || 0) >= 24 || ((e.fs || 0) >= 18.66 && (e.fw || 400) >= 700);
  return (screen.elements || [])
    .filter((e) => (e.k === 'texto' || e.k === 'acao' || e.k === 'campo') && e.t && e.cr && !e.bgImage && (e.cr as number) < (large(e) ? 3 : 4.5))
    .map((e) => ({ x: e.x * k, y: e.y * k, w: e.w * k, h: e.h * k, cr: e.cr as number, t: e.t, need: large(e) ? 3 : 4.5 }));
}

// ---- desenho ----
function jet(v: number): [number, number, number] {
  const r = clamp(1.5 - Math.abs(4 * v - 3));
  const g = clamp(1.5 - Math.abs(4 * v - 2));
  const b = clamp(1.5 - Math.abs(4 * v - 1));
  return [r * 255, g * 255, b * 255];
}

/** Pinta a camada do modo escolhido num canvas do tamanho da imagem. */
export function paintLayer(canvas: HTMLCanvasElement, f: AttentionField, mode: 'attention' | 'focus' | 'contrast', screen: VisualScreen) {
  const W = screen.imageWidth;
  const H = screen.imageHeight;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);
  if (mode === 'contrast') {
    // grade de contraste local de luminância
    const cell = Math.max(10, Math.round(W / 56));
    const step = cell / f.scale;
    for (let gy = 0; gy * cell < H; gy++)
      for (let gx = 0; gx * cell < W; gx++) {
        let mn = 1, mx = 0;
        const x0 = Math.floor(gx * step), y0 = Math.floor(gy * step);
        for (let y = y0; y < Math.min(f.gh, y0 + Math.ceil(step)); y++)
          for (let x = x0; x < Math.min(f.gw, x0 + Math.ceil(step)); x++) {
            const l = f.lum[y * f.gw + x];
            if (l < mn) mn = l;
            if (l > mx) mx = l;
          }
        const c = clamp((mx - mn) / 0.6);
        if (c < 0.06) continue;
        const [r, g, b] = c > 0.5 ? [34, 197, 94] : c > 0.25 ? [250, 204, 21] : [249, 115, 22];
        ctx.fillStyle = `rgba(${r},${g},${b},${0.18 + c * 0.32})`;
        ctx.fillRect(gx * cell + 1, gy * cell + 1, cell - 2, cell - 2);
      }
    return;
  }
  const small = document.createElement('canvas');
  small.width = f.gw;
  small.height = f.gh;
  const sctx = small.getContext('2d')!;
  const id = sctx.createImageData(f.gw, f.gh);
  if (mode === 'attention') {
    for (let i = 0; i < f.data.length; i++) {
      const v = f.data[i];
      if (v < 0.12) continue;
      const [r, g, b] = jet(v);
      id.data[i * 4] = r;
      id.data[i * 4 + 1] = g;
      id.data[i * 4 + 2] = b;
      id.data[i * 4 + 3] = Math.round(clamp((v - 0.12) * 1.25, 0, 0.72) * 255);
    }
  } else {
    // foco: escurece o que fica fora dos pontos que concentram ~65% da atenção
    const sorted = Array.from(f.data).sort((a, b) => b - a);
    const total = sorted.reduce((t, v) => t + v, 0);
    let acc = 0;
    let thr = 0;
    for (const v of sorted) {
      acc += v;
      if (acc >= total * 0.65) {
        thr = v;
        break;
      }
    }
    for (let i = 0; i < f.data.length; i++) {
      const v = f.data[i];
      const vis = clamp((v - thr * 0.6) / (thr * 0.8 || 1));
      id.data[i * 4 + 3] = Math.round((1 - vis) * 0.82 * 255);
    }
  }
  sctx.putImageData(id, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, W, H);
}

export function makeThumb(dataUrl: string, width = 360): Promise<string> {
  return loadImage(dataUrl).then((img) => {
    const r = Math.min(1, width / img.width);
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * r);
    c.height = Math.round(Math.min(img.height, img.width * 0.75) * r);
    c.getContext('2d')!.drawImage(img, 0, 0, img.width, c.height / r, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  });
}
