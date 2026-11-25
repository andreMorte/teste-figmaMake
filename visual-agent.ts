// Raio-X: agente especialista em conversa com o time de design.
// Autônomo e proativo (abre a conversa com o que mais importa), mas nunca inventa: tudo o que diz precisa
// estar amarrado à biblioteca interna (regras com código), aos dados medidos da tela ou ao que já foi testado
// com usuários reais. O que não tiver base é descartado antes de chegar ao designer.
import type { Express } from 'express';
import { aiVision, aiEngine } from './qualitative';
import { libraryFor } from './visual-knowledge';
import { screenA11y, flowConsistency } from './src/visual/quality';
import { elementList } from './src/visual/elements';

export type Evidence = { text: string; ids: Set<string> } | null;

type Deps = {
  load: (id: string) => Promise<any | null>;
  save: (a: any) => Promise<void>;
  evidence: (prototypeUrl: string) => Evidence;
  safeId: (v: string) => string;
};

const norm = (t: string) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[“”"'`´«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function buildPrompt(a: any, s: any, idx: number, chat: any[], message: string | null, focus: any, lib: { text: string }, ev: Evidence, list: any[]) {
  const ctx = s.context || {};
  const acc = screenA11y(s);
  const cons = flowConsistency(a.screens || []);
  const ex = s.expert;
  const aois = (s.aois || [])
    .filter((x: any) => typeof x.share === 'number')
    .sort((x: any, y: any) => y.share - x.share)
    .map((x: any) => `${x.name}: ${Math.round(x.share * 100)}% da atenção estimada${x.firstFold === false ? ' (abaixo da dobra)' : ''}`);
  const history = chat
    .slice(-8)
    .map((m: any) => (m.role === 'user' ? `DESIGNER: ${m.text}${m.focus?.label ? ` (sobre: ${m.focus.label})` : ''}` : `VOCÊ: ${(m.blocks || []).map((b: any) => b.texto || (b.de ? `trocar "${b.de}" por "${b.para}"` : '')).join(' ')}`))
    .join('\n');
  const task = message
    ? `PERGUNTA DO DESIGNER: ${message}${focus?.label ? `\nEle selecionou na tela: ${focus.label}${focus.ref ? ` (${focus.ref})` : ''}.` : ''}`
    : `ABERTURA PROATIVA: o designer acabou de abrir a conversa sobre esta tela. Sem esperar perguntas, traga os 3 pontos que mais merecem a atenção do time agora, em ordem de impacto para quem usa a tela, cada um apontando o elemento e o que fazer. Termine com perguntas que ajudem o designer a seguir.`;

  return `Você é o especialista de produto do time de design: um Product Designer sênior que conhece a rotina do corretor de seguros. Você é autônomo e proativo: antecipa riscos, aponta o que importa e sugere o próximo passo sem esperar ser perguntado.
Mas você NUNCA cria nada da sua cabeça. Tudo o que afirmar precisa estar apoiado em pelo menos uma destas fontes:
(1) a BIBLIOTECA abaixo, citando os códigos das regras (ex.: "hierarquia.2");
(2) os DADOS MEDIDOS desta tela (elementos, atenção, acessibilidade, consistência, parecer);
(3) a EVIDÊNCIA DE TESTES com usuários reais, citando os códigos (ex.: "T3"), quando existir.
Se não houver base para responder, diga que não há base suficiente e sugira o que poderia ser analisado. A biblioteca é interna: nunca a mencione, nem autores ou livros.

CONTEXTO
- Fluxo: ${a.name}${a.goal ? ` · objetivo: ${a.goal}` : ''}${a.audience ? ` · público: ${a.audience}` : ''}
- Dispositivo: ${a.device === 'mobile' ? 'celular' : 'web (desktop)'} · viewport ${s.viewportWidth}×${s.viewportHeight}px
- Tela ${idx + 1} de ${(a.screens || []).length}: ${s.name}${ctx.dialog ? ' (modal)' : ''}. Telas do fluxo: ${(a.screens || []).map((x: any, i: number) => `${i + 1}. ${x.name}`).join(' | ')}

ELEMENTOS DA TELA (cite SEMPRE pelo código entre colchetes, ex.: [E3]; não cite elementos que não estão aqui)
${list.map((e) => `[${e.id}] ${e.desc}`).join('\n')}

TEXTO REAL DA TELA
${String(ctx.text || '').slice(0, 2500)}

DADOS MEDIDOS
- Clareza ${s.metrics?.clarity ?? '—'}/100 · Foco ${s.metrics?.focus ?? '—'}/100 · Contraste AA ok em ${s.metrics?.contrastPass ?? '—'}% dos textos
- Atenção por área: ${aois.join('; ') || '—'}
- Acessibilidade (${acc.mobile ? 'critérios de celular' : 'critérios web'}): ${acc.issues.map((i) => `${i.title}: ${i.desc}`).join(' | ') || 'nenhum problema medido'}
- Consistência do fluxo: ${cons.cards.filter((c) => c.sev > 0).map((c) => `${c.title}: ${c.summary}`).join(' | ') || 'sem problemas'}
${ex ? `- Parecer já emitido (nota ${ex.nota}): ${ex.resumo} Problemas: ${(ex.problemas || []).map((p: any) => `[${p.severidade}] ${p.titulo}`).join('; ')}` : '- Parecer: ainda não emitido'}

EVIDÊNCIA DE TESTES COM USUÁRIOS REAIS
${ev ? ev.text : 'Nenhum teste de usabilidade com este protótipo ainda.'}

BIBLIOTECA (interna)
${lib.text}

${history ? `CONVERSA ATÉ AGORA\n${history}\n` : ''}
${task}

REGRAS DE RESPOSTA
- Português do Brasil, direto e claro, como um colega sênior. Frases curtas. Nada de jargão vazio.
- Cada bloco precisa de "base" com códigos da biblioteca e/ou dos testes. Bloco sem base será descartado.
- Aponte as partes da tela com [E#] dentro do texto. Ao citar texto existente na tela, copie exatamente entre aspas.
- Texto novo que você sugerir vai em um bloco "texto_sugerido" (de: texto atual exato; para: texto proposto).
- Não invente dados, números, pesquisas, funcionalidades ou comportamentos que não estão no contexto. O que não dá para ver numa imagem parada (resposta a clique, tempo de carregamento), diga que não dá para avaliar.
- Máximo de 6 blocos. Em "proximas", até 3 perguntas curtas que o designer pode fazer em seguida.

Responda SOMENTE este JSON:
{"blocos": [
  {"tipo": "texto", "texto": "... [E2] ...", "base": ["codigo"]},
  {"tipo": "alternativa", "titulo": "A", "texto": "...", "base": ["codigo"]},
  {"tipo": "texto_sugerido", "de": "texto atual exato", "para": "texto proposto", "motivo": "...", "base": ["codigo"]}
],
"proximas": ["...", "..."]}`;
}

function groundChat(raw: any, s: any, list: any[], valid: Set<string>) {
  const ctx = s.context || {};
  const corpus = norm([ctx.text, ...(ctx.buttons || []), ...(ctx.fields || []).map((f: any) => `${f.label} ${f.placeholder || ''}`), ...list.map((e) => e.t)].join(' | '));
  const refIds = new Set(list.map((e) => e.id));
  const quotesOk = (t: string) =>
    [...String(t || '').matchAll(/["“]([^"”]{3,140})["”]/g)].every((m) => corpus.includes(norm(m[1]).replace(/\.\.\.|…/g, '').trim()));
  const cleanRefs = (t: string) =>
    String(t || '')
      .replace(/\[(E\d+)\]/g, (m, id) => (refIds.has(id) ? m : ''))
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([.,;:!?])/g, '$1')
      .trim();
  let dropped = 0;
  const blocks: any[] = [];
  for (const b of Array.isArray(raw?.blocos) ? raw.blocos.slice(0, 8) : []) {
    const base = (Array.isArray(b?.base) ? b.base : []).map((x: any) => String(x).trim()).filter((x: string) => valid.has(x));
    if (!base.length) {
      dropped++;
      continue;
    }
    const tipo = String(b?.tipo || 'texto');
    if (tipo === 'texto_sugerido') {
      const de = String(b?.de || '').trim();
      const para = String(b?.para || '').trim();
      if (!de || !para || !corpus.includes(norm(de))) {
        dropped++;
        continue;
      }
      blocks.push({ tipo, de: de.slice(0, 160), para: para.slice(0, 160), motivo: cleanRefs(String(b?.motivo || '')).slice(0, 300), base });
      continue;
    }
    const texto = cleanRefs(String(b?.texto || '')).slice(0, 900);
    if (!texto) {
      dropped++;
      continue;
    }
    // alternativas podem propor rótulos novos entre aspas; texto comum só cita o que existe
    if (tipo !== 'alternativa' && !quotesOk(texto)) {
      dropped++;
      continue;
    }
    blocks.push(tipo === 'alternativa' ? { tipo, titulo: String(b?.titulo || '').slice(0, 40), texto, base } : { tipo: 'texto', texto, base });
  }
  const used = new Set<string>();
  blocks.forEach((b) => [...`${b.texto || ''} ${b.motivo || ''}`.matchAll(/\[(E\d+)\]/g)].forEach((m) => used.add(m[1])));
  const refs = list.filter((e) => used.has(e.id)).map((e) => ({ id: e.id, label: e.t || e.kind, kind: e.kind, box: e.box }));
  const proximas = (Array.isArray(raw?.proximas) ? raw.proximas : []).map((x: any) => String(x).slice(0, 120)).filter(Boolean).slice(0, 3);
  return { blocks, refs, proximas, dropped };
}

export function registerAgentRoutes(app: Express, { load, save, evidence, safeId }: Deps) {
  app.post('/api/visual/:id/screens/:sid/chat', async (req, res) => {
    try {
      const a = await load(safeId(req.params.id));
      if (!a) return res.status(404).json({ error: 'Análise não encontrada' });
      const idx = (a.screens || []).findIndex((x: any) => x.id === req.params.sid);
      if (idx < 0) return res.status(404).json({ error: 'Tela não encontrada' });
      const s = a.screens[idx];
      const chat: any[] = Array.isArray(s.chat) ? s.chat : [];
      const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 1000) : '';
      const focus = req.body?.focus && typeof req.body.focus === 'object' ? { ref: String(req.body.focus.ref || '').slice(0, 8), label: String(req.body.focus.label || '').slice(0, 160) } : null;
      if (!message && chat.length) return res.json({ chat });
      if (!aiEngine()) return res.status(503).json({ error: 'IA não configurada no servidor (GEMINI_API_KEY).' });
      const m = /^data:(image\/\w+);base64,(.+)$/.exec(s.image || '');
      if (!m) return res.status(400).json({ error: 'Tela sem imagem' });

      const list = elementList(s);
      const lib = libraryFor(a, s, idx);
      const ev = evidence(a.prototypeUrl);
      const valid = new Set<string>([...lib.ids, ...(ev ? [...ev.ids] : [])]);
      const prompt = buildPrompt(a, s, idx, chat, message || null, focus, lib, ev, list);

      let out: ReturnType<typeof groundChat> | null = null;
      let model = '';
      let lastErr: any;
      for (let tries = 0; tries < 2; tries++) {
        try {
          const r = await aiVision(prompt + (tries ? '\n\nATENÇÃO: na tentativa anterior faltou "base" válida nos blocos. Use só códigos que aparecem na biblioteca ou nos testes.' : ''), m[2], m[1]);
          model = r.model;
          const g = groundChat(r.json, s, list, valid);
          if (g.blocks.length || tries === 1) {
            out = g;
            break;
          }
        } catch (err) {
          lastErr = err;
        }
      }
      if (!out) throw lastErr || new Error('IA sem resposta');
      if (!out.blocks.length)
        out.blocks = [
          {
            tipo: 'texto',
            texto: 'Não encontrei base suficiente na biblioteca, nos dados desta tela ou nos testes para responder isso com segurança. Posso analisar a hierarquia, os textos, os campos ou a acessibilidade desta tela.',
            base: []
          }
        ];
      const now = new Date().toISOString();
      if (message) chat.push({ role: 'user', text: message, focus, at: now });
      chat.push({ role: 'agent', blocks: out.blocks, refs: out.refs, proximas: out.proximas, opening: !message, at: now, model, dropped: out.dropped });
      a.screens[idx].chat = chat.slice(-40);
      await save(a);
      res.json({ chat: a.screens[idx].chat });
    } catch (err: any) {
      const msg = String(err?.message || err);
      res.status(/429|quota|RESOURCE_EXHAUSTED/i.test(msg) ? 429 : 502).json({
        error: /429|quota|RESOURCE_EXHAUSTED/i.test(msg) ? 'Limite de uso da IA atingido. Tente de novo mais tarde.' : `O especialista não conseguiu responder: ${msg.slice(0, 200)}`
      });
    }
  });

  app.delete('/api/visual/:id/screens/:sid/chat', async (req, res) => {
    try {
      const a = await load(safeId(req.params.id));
      if (!a) return res.status(404).json({ error: 'Análise não encontrada' });
      const s = (a.screens || []).find((x: any) => x.id === req.params.sid);
      if (!s) return res.status(404).json({ error: 'Tela não encontrada' });
      s.chat = [];
      await save(a);
      res.json({ chat: [] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
