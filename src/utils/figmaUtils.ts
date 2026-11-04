/**
 * Utilitários para detecção e formatação de links de protótipos do Figma e protótipos web.
 */

export function isPlaceholderPrototypeUrl(url?: string): boolean {
  if (!url) return true;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed === '' ||
    trimmed === 'about:blank' ||
    trimmed.includes('sample-prototype') ||
    trimmed.includes('exemplo.com')
  );
}

export function isFigmaUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.includes('figma.com/proto') ||
    trimmed.includes('figma.com/file') ||
    trimmed.includes('figma.com/design') ||
    trimmed.includes('figma.com/embed') ||
    trimmed.includes('figma.site')
  );
}

export function isFigmaProtoOrFileUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  return (
    (trimmed.includes('figma.com/proto') ||
     trimmed.includes('figma.com/file') ||
     trimmed.includes('figma.com/design')) &&
    !trimmed.includes('figma.com/embed')
  );
}

export function isValidRealFigmaUrl(url?: string): boolean {
  if (!url) return false;
  return isFigmaUrl(url) && !isPlaceholderPrototypeUrl(url);
}

export function toFigmaEmbedUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let trimmed = rawUrl.trim();

  // Prepend https:// if not starting with protocol or relative slash
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/')) {
    trimmed = `https://${trimmed}`;
  }

  // Se já é uma URL de embed do Figma, retorna diretamente
  if (trimmed.includes('figma.com/embed')) {
    return trimmed;
  }

  // Se for uma URL oficial de protótipo, design ou arquivo figma.com, encapsula no serviço de embed oficial do Figma
  if (isFigmaProtoOrFileUrl(trimmed)) {
    return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(trimmed)}`;
  }

  // Se for uma URL relativa local (ex: /api/mock/figma-valid), resolve com a origin atual
  if (trimmed.startsWith('/') && typeof window !== 'undefined') {
    return `${window.location.origin}${trimmed}`;
  }

  // URLs web externas (figma.site deployado, Vercel, Netlify, sites web) carregam diretamente no iframe
  return trimmed;
}

export function getPrototypeType(url?: string): 'figma_make' | 'figma_embed' | 'web_deploy' {
  if (!url) return 'web_deploy';
  const lower = url.toLowerCase();
  if (lower.includes('figma.site')) return 'figma_make';
  if (lower.includes('figma.com/proto') || lower.includes('figma.com/file') || lower.includes('figma.com/design')) return 'figma_embed';
  return 'web_deploy';
}

export function getShareableTestUrl(testId: string, prototypeUrl?: string): string {
  if (typeof window === 'undefined') {
    const base = `/run/${testId}`;
    return prototypeUrl ? `${base}?p=${encodeURIComponent(prototypeUrl)}` : base;
  }
  const base = `${window.location.origin}/run/${encodeURIComponent(testId)}`;
  if (prototypeUrl && prototypeUrl.trim()) {
    return `${base}?p=${encodeURIComponent(prototypeUrl.trim())}`;
  }
  return base;
}

/**
 * Protótipos publicados na web (Figma Make *.figma.site, Vercel, Netlify...) podem ser
 * carregados pelo proxy da mesma origem, que injeta o SDK UXLab. Links figma.com usam o embed oficial.
 */
export function canInstrumentPrototype(url?: string): boolean {
  if (!url) return false;
  const t = url.trim();
  if (t.startsWith('/')) return false;
  return !isFigmaProtoOrFileUrl(t);
}

export function getInstrumentedPrototypeUrl(
  url: string,
  opts: { testId?: string; trackingId?: string; sessionId?: string; participantId?: string; mode?: 'run' | 'map' } = {}
): string {
  const params = new URLSearchParams({ url: url.trim() });
  if (opts.testId) params.set('testId', opts.testId);
  if (opts.trackingId) params.set('trackingId', opts.trackingId);
  if (opts.sessionId) params.set('sessionId', opts.sessionId);
  if (opts.participantId) params.set('participantId', opts.participantId);
  if (opts.mode) params.set('mode', opts.mode);
  return `/api/prototype-runtime?${params.toString()}`;
}
