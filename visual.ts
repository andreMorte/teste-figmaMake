// Raio-X da interface: armazenamento das análises visuais e o agente especialista (IA com a imagem da tela).
import fs from 'fs';
import path from 'path';
import type { Express } from 'express';
import type { Pool } from 'pg';
import { aiVision, aiEngine } from './qualitative';
import { knowledgeFor } from './visual-knowledge';

type Opts = { pool: Pool | null; dataDir: string };

const NIELSEN = [
  'Visibilidade do status do sistema',
  'Correspondência entre o sistema e o mundo real',
  'Controle e liberdade do usuário',
  'Consistência e padrões',
  'Prevenção de erros',
  'Reconhecimento em vez de memorização',
  'Flexibilidade e eficiência de uso',
  'Estética e design minimalista',
  'Ajudar a reconhecer, diagnosticar e recuperar erros',
  'Ajuda e documentação'
];
const ERGONOMIA = [
  'Condução',
  'Carga de trabalho',
  'Controle explícito',
  'Adaptabilidade',
  'Gestão de erros',
  'Homogeneidade e coerência',
  'Significado dos códigos e denominações',
  'Compatibilidade'
];

const safeId = (v: string) => String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);

// Resumo leve para a lista (sem imagens)
function metaOf(a: any) {
  const screens = Array.isArray(a.screens) ? a.screens : [];
  const scored = screens.filter((s: any) => s.metrics);
  const avg = (k: string) => (scored.length ? Math.round(scored.reduce((t: number, s: any) => t + (Number(s.metrics?.[k]) || 0), 0) / scored.length) : null);
  const experts = screens.filter((s: any) => s.expert && typeof s.expert.nota === 'number');
  return {
    id: a.id,
    name: a.name,
    prototypeUrl: a.prototypeUrl,
    device: a.device,
    goal: a.goal || '',
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    screens: screens.length,
    analyzed: experts.length,
    thumb: screens[0]?.thumb || null,
    clarity: avg('clarity'),
    focus: avg('focus'),
    expertScore: experts.length ? Math.round(experts.reduce((t: number, s: any) => t + s.expert.nota, 0) / experts.length) : null
  };
}

export function registerVisualRoutes(app: Express, { pool, dataDir }: Opts) {
  const dir = path.join(dataDir, 'visual');
  let ready: Promise<void> | null = null;
  const ensure = () => {
    if (!ready) {
      ready = (async () => {
        if (pool) {
          await pool.query(`CREATE TABLE IF NOT EXISTS uxlab_visual (id text PRIMARY KEY, meta jsonb NOT NULL, data jsonb NOT NULL, updated_at timestamptz DEFAULT now())`);
        } else fs.mkdirSync(dir, { recursive: true });
      })().catch((err) => {
        ready = null;
        throw err;
      });
    }
    return ready;
  };

  async function load(id: string): Promise<any | null> {
    await ensure();
    if (pool) {
      const r = await pool.query('SELECT data FROM uxlab_visual WHERE id = $1', [id]);
      return r.rows[0]?.data || null;
    }
    const f = path.join(dir, `${id}.json`);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
  }
  async function save(a: any) {
    await ensure();
    a.updatedAt = new Date().toISOString();
    if (pool) {
      await pool.query(
        `INSERT INTO uxlab_visual (id, meta, data, updated_at) VALUES ($1, $2, $3, now())
         ON CONFLICT (id) DO UPDATE SET meta = EXCLUDED.meta, data = EXCLUDED.data, updated_at = now()`,
        [a.id, JSON.stringify(metaOf(a)), JSON.stringify(a)]
      );
    } else {
      const f = path.join(dir, `${a.id}.json`);
      fs.writeFileSync(`${f}.tmp`, JSON.stringify(a));
      fs.renameSync(`${f}.tmp`, f);
    }
  }

  app.get('/api/visual', async (_req, res) => {
    try {
      await ensure();
      if (pool) {
        const r = await pool.query('SELECT meta FROM uxlab_visual ORDER BY updated_at DESC LIMIT 500');
        return res.json(r.rows.map((x) => x.meta));
      }
      const list = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => {
          try {
            return metaOf(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .sort((a: any, b: any) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/visual/:id', async (req, res) => {
    try {
      const a = await load(safeId(req.params.id));
      if (!a) return res.status(404).json({ error: 'Análise não encontrada' });
      res.json(a);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/visual/:id', async (req, res) => {
    try {
      const id = safeId(req.params.id);
      const body = req.body || {};
      if (!id || !body.prototypeUrl) return res.status(400).json({ error: 'Faltam dados da análise' });
      const prev = await load(id);
      const a = {
        ...body,
        id,
        createdAt: prev?.createdAt || body.createdAt || new Date().toISOString(),
        screens: (Array.isArray(body.screens) ? body.screens : []).slice(0, 40).map((s: any) => {
          // o parecer da IA fica no servidor: o painel pode ter uma cópia antiga
          const old = prev?.screens?.find((p: any) => p.id === s.id);
          return { ...s, expert: s.expert || old?.expert || undefined };
        })
      };
      await save(a);
      res.json(metaOf(a));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/visual/:id', async (req, res) => {
    try {
      const id = safeId(req.params.id);
      await ensure();
      if (pool) await pool.query('DELETE FROM uxlab_visual WHERE id = $1', [id]);
      else {
        const f = path.join(dir, `${id}.json`);
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Ajustes leves numa tela (nome, áreas, métricas) sem reenviar as imagens
  app.patch('/api/visual/:id/screens/:sid', async (req, res) => {
    try {
      const a = await load(safeId(req.params.id));
      if (!a) return res.status(404).json({ error: 'Análise não encontrada' });
      const s = (a.screens || []).find((x: any) => x.id === req.params.sid);
      if (!s) return res.status(404).json({ error: 'Tela não encontrada' });
      const b = req.body || {};
      if (typeof b.name === 'string') s.name = b.name.slice(0, 120);
      if (Array.isArray(b.aois)) s.aois = b.aois.slice(0, 30);
      if (b.metrics && typeof b.metrics === 'object') s.metrics = b.metrics;
      await save(a);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Parecer do especialista para uma tela
  app.post('/api/visual/:id/screens/:sid/expert', async (req, res) => {
    try {
      if (!aiEngine()) return res.status(503).json({ error: 'IA não configurada no servidor (GEMINI_API_KEY).' });
      const a = await load(safeId(req.params.id));
      if (!a) return res.status(404).json({ error: 'Análise não encontrada' });
      const idx = (a.screens || []).findIndex((s: any) => s.id === req.params.sid);
      if (idx < 0) return res.status(404).json({ error: 'Tela não encontrada' });
      const screen = a.screens[idx];
      const m = /^data:(image\/\w+);base64,(.+)$/.exec(screen.image || '');
      if (!m) return res.status(400).json({ error: 'Tela sem imagem' });

      const prompt = buildExpertPrompt(a, screen, idx);
      let out: any = null;
      let model = '';
      let lastErr: any;
      for (let tries = 0; tries < 2 && !out; tries++) {
        try {
          const r = await aiVision(prompt, m[2], m[1]);
          model = r.model;
          const checked = groundExpert(r.json, screen);
          if (checked.dropped > 3 && tries === 0) {
            lastErr = new Error('parecer citou textos que não estão na tela');
            continue; // pede de novo uma vez
          }
          out = checked.result;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!out) throw lastErr || new Error('IA sem resposta');
      // segunda opinião: um revisor confere o parecer contra a tela e o repertório e corta o que for genérico
      try {
        const rev = await aiVision(buildCriticPrompt(a, screen, idx, out), m[2], m[1]);
        const checked = groundExpert(rev.json, screen);
        if (checked.result.resumo && checked.result.problemas.length + checked.result.funciona_bem.length > 0) {
          out = checked.result;
          model = rev.model;
          out.revisado = true;
        }
      } catch (err: any) {
        console.warn('[Raio-X] revisão do parecer falhou, mantendo a primeira versão:', String(err?.message || err).slice(0, 160));
      }
      out.model = model;
      out.createdAt = new Date().toISOString();
      a.screens[idx].expert = out;
      await save(a);
      res.json(out);
    } catch (err: any) {
      const msg = String(err?.message || err);
      res.status(/429|quota|RESOURCE_EXHAUSTED/i.test(msg) ? 429 : 502).json({
        error: /429|quota|RESOURCE_EXHAUSTED/i.test(msg) ? 'Limite de uso da IA atingido. Tente de novo mais tarde.' : `A IA não conseguiu analisar a tela: ${msg.slice(0, 200)}`
      });
    }
  });
}

function buildExpertPrompt(a: any, s: any, idx: number) {
  const total = a.screens.length;
  const prev = idx > 0 ? a.screens[idx - 1]?.name : '';
  const next = idx < total - 1 ? a.screens[idx + 1]?.name : '';
  const ctx = s.context || {};
  const els: any[] = Array.isArray(s.elements) ? s.elements : [];
  const heads = els
    .filter((e) => e.k === 'texto' && (e.hd || e.fs >= 20))
    .sort((x, y) => (y.fs || 0) - (x.fs || 0))
    .slice(0, 8)
    .map((e) => `"${e.t}" (${e.fs}px, peso ${e.fw})`);
  const actions = els
    .filter((e) => e.k === 'acao' && e.t)
    .slice(0, 14)
    .map((e) => `"${e.t}"${e.filled ? ' [preenchido]' : ''}${e.disabled ? ' [desabilitado]' : ''} ${e.w}x${e.h}px`);
  const lowContrast = els
    .filter((e) => e.cr && e.t && e.cr < (e.fs >= 24 || (e.fs >= 18.66 && e.fw >= 700) ? 3 : 4.5))
    .slice(0, 10)
    .map((e) => `"${e.t}" contraste ${e.cr}:1 (${e.fg} sobre ${e.bg}, ${e.fs}px)`);
  const met = s.metrics || {};
  const aois = (s.aois || [])
    .filter((x: any) => typeof x.share === 'number')
    .sort((x: any, y: any) => y.share - x.share)
    .map((x: any) => `${x.name}: ${Math.round(x.share * 100)}% da atenção estimada${x.firstFold === false ? ' (abaixo da dobra)' : ''}`);

  return `Você é um(a) Product Designer sênior, especialista em análise heurística (Nielsen), critérios ergonômicos (Bastien & Scapin), design emocional (Don Norman: visceral, comportamental, reflexivo), design cognitivo (carga cognitiva, Gestalt, leis de Hick, Fitts, Miller e Jakob), UI (tipografia, cor, espaçamento, grid), arquitetura de informação e estratégia de produto.
Você recebe a IMAGEM de uma tela de um protótipo navegável (Figma Make) e dados medidos dela. Avalie como faria numa revisão de design profissional.

CONTEXTO DO ESTUDO
- Análise: ${a.name}
- Objetivo do fluxo: ${a.goal || 'não informado'}
- Público: ${a.audience || 'não informado'}
- Dispositivo: ${a.device === 'mobile' ? 'celular' : 'desktop'} (viewport ${s.viewportWidth}x${s.viewportHeight}px)
- Posição: tela ${idx + 1} de ${total}${prev ? `, vem depois de "${prev}"` : ''}${next ? `, a próxima é "${next}"` : ''}
- Nome detectado da tela: ${s.name || ctx.title || 'sem título'}${ctx.stepLabel ? ` (${ctx.stepLabel})` : ''}${ctx.dialog ? ' — é um diálogo/modal' : ''}

O QUE ESTÁ ESCRITO NA TELA (texto real, use só isto para citar)
${String(ctx.text || '').slice(0, 3000)}
Botões/links: ${(ctx.buttons || []).join(' | ') || 'nenhum'}
Campos: ${(ctx.fields || []).map((f: any) => `${f.label || '(sem rótulo)'} [${f.type}${f.required ? ', obrigatório' : ''}${f.placeholder ? `, placeholder "${f.placeholder}"` : ''}]`).join(' | ') || 'nenhum'}
Mensagens de erro visíveis: ${(ctx.errors || []).join(' | ') || 'nenhuma'}

MEDIDAS (calculadas pelo sistema, são estimativas de atenção, não eye-tracking real)
- Títulos: ${heads.join('; ') || 'nenhum detectado'}
- Ações: ${actions.join('; ') || 'nenhuma'}
- Textos com contraste abaixo do WCAG AA: ${lowContrast.join('; ') || 'nenhum'}
- Clareza ${met.clarity ?? '—'}/100, Foco ${met.focus ?? '—'}/100, ${met.elementsAboveFold ?? '—'} elementos na primeira dobra, contraste AA ok em ${met.contrastPass ?? '—'}% dos textos
- Atenção por área: ${aois.join('; ') || 'sem áreas'}

REPERTÓRIO TÉCNICO (é o seu conhecimento de base; use para julgar e para recomendar, mas não o mencione)
${knowledgeFor(a, s, idx).text}

REGRAS
- Fundamente cada julgamento no repertório acima e no que está visível. Não mencione livros, autores nem "o repertório"; os princípios podem ser nomeados pelo conceito (ex.: "Lei de Hick", "Prevenção de erros").
- Português do Brasil, direto, específico, sem jargão vazio.
- Só afirme o que se vê na imagem ou nos dados. Ao citar um texto da tela, copie exatamente entre aspas.
- Não invente funcionalidades, dados, telas ou comportamentos. O que não dá para avaliar numa imagem parada (ex.: feedback após clique, tempo de carregamento), diga "não avaliável na captura" e dê nota 0.
- Severidade dos problemas (escala de Nielsen): 0 nenhum, 1 cosmético, 2 menor, 3 maior, 4 catastrófico.
- Recomendações acionáveis, que um designer consiga aplicar na próxima versão.

Responda SOMENTE este JSON:
{
 "resumo": "2 a 3 frases com o diagnóstico da tela",
 "proposito_percebido": "o que um usuário entende que deve fazer nesta tela nos primeiros 5 segundos",
 "nota": 0-100,
 "primeira_impressao": {"visceral": "...", "comportamental": "...", "reflexivo": "..."},
 "hierarquia": {"ordem_ideal": ["elementos na ordem em que deveriam ser vistos"], "ordem_percebida": ["ordem em que a tela de fato conduz o olhar"], "comentario": "..."},
 "funciona_bem": ["..."],
 "problemas": [{"titulo": "...", "descricao": "...", "evidencia": "texto exato ou elemento visível", "principios": ["ex.: Nielsen 8 - Estética e design minimalista", "Bastien & Scapin - Carga de trabalho", "Lei de Hick"], "severidade": 0-4, "recomendacao": "...", "area": "nome da área de interesse ou vazio"}],
 "heuristicas_nielsen": [{"n": 1-10, "nota": 0-5, "comentario": "..."}],
 "ergonomia": [{"criterio": "um destes: ${ERGONOMIA.join(', ')}", "nota": 0-5, "comentario": "..."}],
 "cognitivo": {"carga": "baixa|média|alta", "comentario": "...", "leis": [{"lei": "...", "observacao": "..."}]},
 "ui": {"tipografia": "...", "cor": "...", "espacamento": "...", "consistencia": "..."},
 "acessibilidade": "...",
 "arquitetura": "como a informação está organizada e agrupada, e o lugar desta tela no fluxo",
 "estrategia": "o quanto a tela serve ao objetivo do fluxo e ao negócio"
}
Inclua as 10 heurísticas de Nielsen e os 8 critérios ergonômicos.`;
}

function buildCriticPrompt(a: any, s: any, idx: number, draft: any) {
  const ctx = s.context || {};
  return `Você é um(a) Design Lead revisando o parecer de outro designer sobre a tela da imagem (tela ${idx + 1} de ${a.screens.length} do fluxo "${a.name}"${a.goal ? `, objetivo: ${a.goal}` : ''}${a.audience ? `, público: ${a.audience}` : ''}).
Seu papel é tornar o parecer mais certeiro e real. Faça assim:
1. Corte o que for genérico (vale para qualquer tela), o que não tiver um elemento visível que o comprove e o que for gosto pessoal sem impacto no uso.
2. Ajuste a severidade quando estiver exagerada ou subestimada (0 a 4, escala de Nielsen).
3. Torne as recomendações concretas: qual elemento, o que mudar e, se for texto, a frase sugerida em português do Brasil.
4. Acrescente um problema só se for importante, visível na imagem e tiver ficado de fora.
5. Revise as notas das heurísticas e dos critérios para que batam com os problemas apontados. Nota 0 = não avaliável na captura.
6. Não invente nada que não esteja na tela. Ao citar texto da tela, copie exatamente entre aspas.

TEXTO REAL DA TELA
${String(ctx.text || '').slice(0, 2500)}
Botões/links: ${(ctx.buttons || []).join(' | ') || 'nenhum'}
Campos: ${(ctx.fields || []).map((f: any) => f.label || '(sem rótulo)').join(' | ') || 'nenhum'}

REPERTÓRIO TÉCNICO (base para julgar; não o mencione)
${knowledgeFor(a, s, idx).text}

PARECER A REVISAR
${JSON.stringify(draft).slice(0, 12000)}

Devolva SOMENTE o parecer revisado, no mesmo formato JSON (mesmos campos), completo.`;
}

const norm = (t: string) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[“”"'`´]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Tudo que a IA cita entre aspas precisa existir na tela; o que não existe é descartado.
function groundExpert(raw: any, screen: any) {
  const ctx = screen.context || {};
  const corpus = norm(
    [ctx.text, ...(ctx.buttons || []), ...(ctx.fields || []).map((f: any) => `${f.label} ${f.placeholder || ''}`), ...(ctx.errors || []), ...((screen.elements || []) as any[]).map((e) => e.t)].join(' | ')
  );
  let dropped = 0;
  const quotesOk = (s: string) => {
    const qs = [...String(s || '').matchAll(/["“]([^"”]{3,140})["”]/g)].map((m) => m[1]);
    return qs.every((q) => corpus.includes(norm(q).replace(/\.\.\.|…/g, '').trim()));
  };
  const str = (v: any, max = 600) => (typeof v === 'string' ? v.slice(0, max) : '');
  const num = (v: any, lo: number, hi: number) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Math.round(Number(v)))) : null);
  const r = raw || {};

  const funciona = (Array.isArray(r.funciona_bem) ? r.funciona_bem : [])
    .map((x: any) => str(x, 300))
    .filter((x: string) => {
      if (!x) return false;
      if (quotesOk(x)) return true;
      dropped++;
      return false;
    })
    .slice(0, 8);

  const problemas = (Array.isArray(r.problemas) ? r.problemas : [])
    .map((p: any) => ({
      titulo: str(p?.titulo, 140),
      descricao: str(p?.descricao, 600),
      evidencia: str(p?.evidencia, 300),
      principios: (Array.isArray(p?.principios) ? p.principios : []).map((x: any) => str(x, 90)).filter(Boolean).slice(0, 4),
      severidade: num(p?.severidade, 0, 4) ?? 2,
      recomendacao: str(p?.recomendacao, 500),
      area: str(p?.area, 60)
    }))
    .filter((p: any) => {
      if (!p.titulo) return false;
      if (!quotesOk(`${p.titulo} ${p.descricao} ${p.recomendacao}`)) {
        dropped++;
        return false;
      }
      if (p.evidencia && !quotesOk(p.evidencia)) {
        p.evidencia = '';
        dropped++;
      }
      return true;
    })
    .sort((x: any, y: any) => y.severidade - x.severidade)
    .slice(0, 12);

  const nielsen = NIELSEN.map((nome, i) => {
    const h = (Array.isArray(r.heuristicas_nielsen) ? r.heuristicas_nielsen : []).find((x: any) => Number(x?.n) === i + 1);
    return { n: i + 1, nome, nota: num(h?.nota, 0, 5) ?? 0, comentario: str(h?.comentario, 400) || 'não avaliável na captura' };
  });
  const ergonomia = ERGONOMIA.map((criterio) => {
    const list = Array.isArray(r.ergonomia) ? r.ergonomia : [];
    const e = list.find((x: any) => norm(x?.criterio).startsWith(norm(criterio).slice(0, 10)));
    return { criterio, nota: num(e?.nota, 0, 5) ?? 0, comentario: str(e?.comentario, 400) || 'não avaliável na captura' };
  });
  const pi = r.primeira_impressao || {};
  const hi = r.hierarquia || {};
  const cg = r.cognitivo || {};
  const ui = r.ui || {};
  const result = {
    resumo: str(r.resumo, 700),
    proposito_percebido: str(r.proposito_percebido, 400),
    nota: num(r.nota, 0, 100) ?? 0,
    primeira_impressao: { visceral: str(pi.visceral, 400), comportamental: str(pi.comportamental, 400), reflexivo: str(pi.reflexivo, 400) },
    hierarquia: {
      ordem_ideal: (Array.isArray(hi.ordem_ideal) ? hi.ordem_ideal : []).map((x: any) => str(x, 80)).filter(Boolean).slice(0, 8),
      ordem_percebida: (Array.isArray(hi.ordem_percebida) ? hi.ordem_percebida : []).map((x: any) => str(x, 80)).filter(Boolean).slice(0, 8),
      comentario: str(hi.comentario, 500)
    },
    funciona_bem: funciona,
    problemas,
    heuristicas_nielsen: nielsen,
    ergonomia,
    cognitivo: {
      carga: ['baixa', 'média', 'alta'].includes(norm(cg.carga) === 'media' ? 'média' : norm(cg.carga)) ? (norm(cg.carga) === 'media' ? 'média' : norm(cg.carga)) : 'média',
      comentario: str(cg.comentario, 500),
      leis: (Array.isArray(cg.leis) ? cg.leis : []).map((l: any) => ({ lei: str(l?.lei, 60), observacao: str(l?.observacao, 300) })).filter((l: any) => l.lei && l.observacao).slice(0, 6)
    },
    ui: { tipografia: str(ui.tipografia, 400), cor: str(ui.cor, 400), espacamento: str(ui.espacamento, 400), consistencia: str(ui.consistencia, 400) },
    acessibilidade: str(r.acessibilidade, 500),
    arquitetura: str(r.arquitetura, 500),
    estrategia: str(r.estrategia, 500)
  };
  return { result, dropped };
}
