import { ExpertResult, VisualAnalysis, VisualAoi, VisualMeta, VisualMetrics } from './types';

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any)?.error || `Erro ${res.status}`);
  return body as T;
}

export const visualApi = {
  list: () => fetch('/api/visual').then((r) => json<VisualMeta[]>(r)),
  get: (id: string) => fetch(`/api/visual/${encodeURIComponent(id)}`).then((r) => json<VisualAnalysis>(r)),
  save: (a: VisualAnalysis) =>
    fetch(`/api/visual/${encodeURIComponent(a.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) }).then((r) => json<VisualMeta>(r)),
  remove: (id: string) => fetch(`/api/visual/${encodeURIComponent(id)}`, { method: 'DELETE' }).then((r) => json<{ ok: boolean }>(r)),
  patchScreen: (id: string, sid: string, body: { name?: string; aois?: VisualAoi[]; metrics?: VisualMetrics }) =>
    fetch(`/api/visual/${encodeURIComponent(id)}/screens/${encodeURIComponent(sid)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then((r) => json<{ ok: boolean }>(r)),
  expert: (id: string, sid: string) =>
    fetch(`/api/visual/${encodeURIComponent(id)}/screens/${encodeURIComponent(sid)}/expert`, { method: 'POST' }).then((r) => json<ExpertResult>(r))
};

export const newVisualId = () => `RX-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
