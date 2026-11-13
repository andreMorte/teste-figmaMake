/**
 * UXLab Runtime SDK v3 — telemetria + mapeamento de cenários
 *
 * Protótipos Figma Make são aplicações de página única: a URL não muda, os
 * componentes é que trocam. Este SDK observa o DOM e identifica cada "cenário"
 * (tela lógica) por uma impressão digital estável:
 *   1. [data-uxlab-screen="id"] visível (marcação explícita, se existir)
 *   2. modal/diálogo aberto (role=dialog, aria-modal ou overlay fixo)
 *   3. hierarquia tipográfica: maior título + subtítulo + indicador de etapa ("1 de 3")
 *
 * Mensagens enviadas ao parent (postMessage):
 *   UXLAB_SDK_CONNECTED, RUNTIME_LOADED, SCREEN_VIEW, SCREEN_CAPTURE_STARTED,
 *   SCREEN_CAPTURED, SCREEN_CAPTURE_FAILED, INTERACTION
 * Mensagens aceitas do parent:
 *   UXLAB_TRIGGER_CAPTURE, UXLAB_REQUEST_STATE
 */
(function () {
  if (window.__UXLAB_SDK_LOADED__) return;
  window.__UXLAB_SDK_LOADED__ = true;

  var currentScript = document.currentScript;
  var attr = function (name, fallback) {
    return (currentScript && currentScript.getAttribute(name)) || fallback;
  };
  var testId = attr('data-test-id', '');
  var trackingId = attr('data-tracking-id', '');
  var sessionId = attr('data-session-id', ''); // atualizado pelo runner quando o participante inicia
  var participantId = attr('data-participant-id', '');
  var mode = attr('data-mode', 'run'); // 'run' (participante) | 'map' (mapeamento) | 'visual' (Raio-X) | 'preview' (revisão do design: nada é registrado)

  window.UXLab = window.UXLab || {
    init: function (config) {
      console.log('[UXLab SDK] init', config);
    }
  };
  window.UXLab.version = '3.6.0';
  window.UXLab.getCurrentScreen = function () {
    return currentScene;
  };

  function sendToParent(message) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(message, '*');
      }
    } catch (e) {
      console.warn('[UXLab SDK] postMessage falhou', e);
    }
  }

  // ---------------------------------------------------------------------------
  // Utilidades de DOM
  // ---------------------------------------------------------------------------
  function clean(t) {
    return (t || '').replace(/\s+/g, ' ').trim();
  }

  function slugify(t) {
    return clean(t)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false; // texto que transborda pode ter largura ~1px
    var s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
    if (el.closest && el.closest('[aria-hidden="true"],[hidden],[inert]')) return false;
    return true;
  }

  var NUMERIC_ONLY = /^[\s\dR$€£US.,%+\-–—:/()x×#*]+$/;
  function isNoiseText(t) {
    if (!t || t.length < 2 || t.length > 90) return true;
    if (NUMERIC_ONLY.test(t)) return true;
    var digits = (t.match(/\d/g) || []).length;
    if (digits / t.length > 0.4) return true;
    return false;
  }

  var INTERACTIVE = 'button,a,[role=button],[role=tab],[role=option],[role=menuitem],[role=link],input,select,textarea,label,summary';
  var IGNORE = 'script,style,noscript,svg,[data-uxlab-ignore]';

  function getRoot() {
    return document.getElementById('container') || document.body;
  }

  // Modal/diálogo aberto (semântico ou overlay fixo cobrindo boa parte da tela)
  function findDialog() {
    var semantic = document.querySelectorAll('[role=dialog],[role=alertdialog],[aria-modal="true"],dialog[open]');
    for (var i = semantic.length - 1; i >= 0; i--) {
      if (isVisible(semantic[i]) && clean(semantic[i].innerText).length > 3) return semantic[i];
    }
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var fixedCandidates = document.querySelectorAll('[class*="fixed"],[style*="fixed"]');
    var best = null;
    for (var j = 0; j < fixedCandidates.length; j++) {
      var el = fixedCandidates[j];
      if (el === document.body || el.closest(IGNORE)) continue;
      var s = window.getComputedStyle(el);
      if (s.position !== 'fixed') continue;
      var r = el.getBoundingClientRect();
      if (r.width * r.height < vw * vh * 0.35) continue;
      if (!isVisible(el)) continue;
      if (clean(el.innerText).length < 8) continue;
      var z = parseInt(s.zIndex, 10) || 0;
      if (!best || z >= best.z) best = { el: el, z: z };
    }
    return best ? best.el : null;
  }

  // Valores digitados pelo participante (nome, CPF...) nunca entram na identificação do cenário
  var typedValues = [];
  function isTypedValue(text) {
    var low = text.toLowerCase();
    for (var i = 0; i < typedValues.length; i++) {
      if (typedValues[i].length >= 3 && low.indexOf(typedValues[i]) !== -1) return true;
    }
    return false;
  }
  document.addEventListener(
    'input',
    function (e) {
      var el = e.target;
      if (!el || el.type === 'password') return;
      var v = clean(el.value || el.textContent || '').toLowerCase();
      if (v.length >= 3 && typedValues.indexOf(v) === -1) {
        typedValues.push(v);
        if (typedValues.length > 40) typedValues.shift();
      }
    },
    true
  );

  // Blocos de texto com tamanho de fonte (para hierarquia tipográfica)
  function collectTextBlocks(scope) {
    var blocks = [];
    var seen = new Set();
    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
    var node;
    var count = 0;
    while ((node = walker.nextNode()) && count < 4000) {
      count++;
      var raw = node.nodeValue;
      if (!raw || raw.trim().length < 2) continue;
      var el = node.parentElement;
      if (!el || seen.has(el)) continue;
      seen.add(el);
      if (el.closest(IGNORE) || el.closest(INTERACTIVE)) continue;
      var text = clean(el.innerText || el.textContent);
      if (isNoiseText(text)) continue;
      if (matchStep(text) || /^\d+\s*(de|of|\/)\s*\d+/i.test(text)) continue; // indicador de etapa não é título
      if (isTypedValue(text)) continue;
      if (!isVisible(el)) continue;
      var s = window.getComputedStyle(el);
      var fs = parseFloat(s.fontSize) || 0;
      var fw = parseInt(s.fontWeight, 10) || 400;
      var isHeading = /^H[1-4]$/.test(el.tagName) || el.getAttribute('role') === 'heading';
      blocks.push({
        text: text,
        fs: fs,
        score: fs + (isHeading ? 4 : 0) + (fw >= 600 ? 1 : 0)
      });
    }
    return blocks;
  }

  // React costuma quebrar "{atual} de {total}" em vários nós de texto: testamos o elemento pai.
  var STEP_PATTERN = /\b(?:etapa|passo|step)\s*(\d{1,2})(?:\s*(?:de|of|\/)\s*(\d{1,2}))?\b|\b(\d{1,2})\s*(de|of|\/)\s*(\d{1,2})\b/i;
  var PAGINATION = /p[aá]gina|page|resultado|registro|ite(m|ns)|linha|mostrando|exibindo/i;
  function matchStep(text) {
    if (PAGINATION.test(text)) return ''; // "Página 1 de 10" é paginação, não etapa
    var m = text.match(STEP_PATTERN);
    if (!m) return '';
    if (m[3]) {
      var a = parseInt(m[3], 10);
      var b = parseInt(m[5], 10);
      // descarta datas (15/03), zeros à esquerda e frações improváveis
      if (/^0/.test(m[3]) || /^0/.test(m[5]) || a < 1 || a > b || b < 2 || b > 8) return '';
      if (m[4] === '/' && b > 8) return '';
    }
    return clean(m[0]);
  }
  // Indicador de etapa + nome da etapa ("3 de 3 - Simulação" -> {label: "3 de 3", name: "Simulação"})
  function findStepInfo(scope) {
    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
    var seen = new Set();
    var node;
    var count = 0;
    while ((node = walker.nextNode()) && count < 4000) {
      count++;
      var el = node.parentElement;
      if (!el || seen.has(el) || !node.nodeValue || !node.nodeValue.trim()) continue;
      seen.add(el);
      var v = clean(el.textContent);
      if (!v || v.length > 40) continue;
      var found = matchStep(v);
      if (found && isVisible(el)) return { label: found, name: stepNameNear(el, found) };
    }
    return { label: '', name: '' };
  }

  function stepNameNear(el, label) {
    var containers = [el, el.parentElement];
    for (var c = 0; c < containers.length; c++) {
      var box = containers[c];
      if (!box) continue;
      var lines = (box.innerText || '').split('\n').map(clean).filter(Boolean);
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf(label) === -1) continue;
        var rest = clean(lines[i].replace(label, '').replace(/^[\s\-–—:|•·]+/, ''));
        if (rest && rest.length <= 40 && !isTypedValue(rest)) return rest;
        var next = lines[i + 1];
        if (next && next.length <= 40 && !/pr[óo]xim|passo|anterior/i.test(next) && !isTypedValue(next)) {
          return clean(next.replace(/^[\s\-–—:|•·]+/, ''));
        }
      }
    }
    return '';
  }

  function labelOf(el) {
    if (!el) return '';
    var t =
      el.getAttribute('aria-label') ||
      clean(el.innerText) ||
      el.getAttribute('placeholder') ||
      el.getAttribute('title') ||
      el.getAttribute('name') ||
      el.getAttribute('value') ||
      '';
    if (!t && el.id) {
      var lab = document.querySelector('label[for="' + el.id + '"]');
      if (lab) t = clean(lab.innerText);
    }
    return clean(t).slice(0, 48);
  }

  function collectActions(scope) {
    var out = [];
    var els = scope.querySelectorAll('button,a,[role=button],[role=tab],[role=menuitem]');
    for (var i = 0; i < els.length && out.length < 14; i++) {
      if (!isVisible(els[i])) continue;
      var l = labelOf(els[i]).split(' ').slice(0, 6).join(' ');
      if (l && out.indexOf(l) === -1) out.push(l);
    }
    return out;
  }

  function collectInputs(scope) {
    var out = [];
    var els = scope.querySelectorAll('input:not([type=hidden]),select,textarea,[role=combobox],[role=slider],[role=checkbox],[role=radio],[role=switch]');
    for (var i = 0; i < els.length && out.length < 14; i++) {
      if (!isVisible(els[i])) continue;
      var l = labelOf(els[i]) || els[i].getAttribute('type') || els[i].tagName.toLowerCase();
      if (l && out.indexOf(l) === -1) out.push(l);
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Impressão digital do cenário atual
  // ---------------------------------------------------------------------------
  function computeScene() {
    var root = getRoot();

    // 1. Marcação explícita
    var marked = root.querySelectorAll('[data-uxlab-screen]');
    for (var i = marked.length - 1; i >= 0; i--) {
      if (isVisible(marked[i])) {
        var val = marked[i].getAttribute('data-uxlab-screen');
        var name = marked[i].getAttribute('data-uxlab-screen-name') || val;
        return buildScene(slugify(val), name, name, '', '', false, marked[i]);
      }
    }

    // 2. Modal / diálogo
    var dialog = findDialog();
    var scope = dialog || root;

    // 3. Hierarquia tipográfica
    var blocks = collectTextBlocks(scope);
    var title = '';
    var subtitle = '';
    if (blocks.length) {
      var maxScore = 0;
      for (var b = 0; b < blocks.length; b++) if (blocks[b].score > maxScore) maxScore = blocks[b].score;
      // Faixa tipográfica superior (relativa), em ordem do DOM: o resultado não depende
      // de qual título ficou maior em cada breakpoint (desktop x mobile).
      var tierMin = Math.max(14, maxScore * 0.75);
      var titleIdx = -1;
      for (var k = 0; k < blocks.length; k++) {
        if (blocks[k].score >= tierMin) {
          titleIdx = k;
          break;
        }
      }
      if (titleIdx === -1) titleIdx = 0;
      title = blocks[titleIdx].text;
      for (var n = titleIdx + 1; n < blocks.length; n++) {
        if (blocks[n].text !== title && blocks[n].score >= tierMin && blocks[n].fs >= 16) {
          subtitle = blocks[n].text;
          break;
        }
      }
    }
    // Sem nenhum texto na tela (transição entre componentes do Figma Make): o único "título" seria
    // o da aba do navegador, igual em todas as telas. Isso não é um cenário: espera a tela montar.
    var noContent = !title;
    if (!title) title = clean(document.title) || 'Tela sem título';
    // tela ainda carregando (só textos pequenos de cabeçalho): não identifica cenário
    var loading = !dialog && ((blocks.length > 0 && maxScoreOf(blocks) < 15) || noContent);

    var step = dialog ? { label: '', name: '' } : findStepInfo(scope);
    var stepLabel = step.label;
    var parts;
    var screenName;
    if (stepLabel && step.name) {
      // Etapa nomeada ("3 de 3 - Simulação"): é o identificador mais estável do fluxo,
      // não depende de qual título/cartão aparece maior na tela.
      parts = [step.name, stepLabel];
      screenName = step.name + ' (' + stepLabel + ')' + (title && title !== step.name ? ' — ' + title : '');
    } else {
      parts = [dialog ? 'modal' : '', title, stepLabel, stepLabel ? '' : subtitle].filter(Boolean);
      screenName = (dialog ? 'Modal: ' : '') + title + (subtitle ? ' — ' + subtitle : '') + (stepLabel ? ' (' + stepLabel + ')' : '');
    }
    var screenId = slugify(parts.join(' ')) || 'tela';
    var scene = buildScene(screenId, screenName, title, subtitle, stepLabel, !!dialog, scope);
    scene.loading = loading || undefined;
    return scene;
  }

  function maxScoreOf(blocks) {
    var mx = 0;
    for (var i = 0; i < blocks.length; i++) if (blocks[i].score > mx) mx = blocks[i].score;
    return mx;
  }

  function buildScene(screenId, screenName, title, subtitle, stepLabel, isDialog, scope) {
    return {
      screenId: screenId,
      screenName: clean(screenName).slice(0, 140),
      title: title,
      subtitle: subtitle || undefined,
      stepLabel: stepLabel || undefined,
      dialog: isDialog || undefined,
      url: location.pathname + location.hash,
      actions: collectActions(scope),
      inputs: collectInputs(scope)
    };
  }

  // ---------------------------------------------------------------------------
  // Detecção de troca de cenário
  // ---------------------------------------------------------------------------
  var currentScene = null;
  var capturedScreens = {};
  var lastClick = null;
  var pendingTimer = null;
  var pendingSince = 0;
  var candidate = null;

  function scheduleCheck(delay) {
    var now = Date.now();
    if (!pendingSince) pendingSince = now;
    if (pendingTimer) clearTimeout(pendingTimer);
    // espera o DOM "assentar", mas nunca mais que 1,5s (animações contínuas)
    var wait = now - pendingSince > 1500 ? 0 : delay || 300;
    pendingTimer = setTimeout(runCheck, wait);
  }

  function runCheck() {
    pendingTimer = null;
    pendingSince = 0;
    var scene;
    try {
      scene = computeScene();
    } catch (e) {
      console.warn('[UXLab SDK] falha ao calcular cenário', e);
      return;
    }
    if (scene.loading) {
      scheduleCheck(500);
      return;
    }
    if (currentScene && currentScene.screenId === scene.screenId) {
      currentScene = scene; // atualiza ações/campos sem emitir troca
      candidate = null;
      return;
    }
    // só confirma a troca se o cenário continuar o mesmo após o DOM assentar (evita estados de transição)
    if (!candidate || candidate.screenId !== scene.screenId) {
      candidate = scene;
      if (pendingTimer) clearTimeout(pendingTimer);
      pendingTimer = setTimeout(runCheck, 350);
      return;
    }
    candidate = null;
    commitScene(scene, true);
  }

  function commitScene(scene, useTrigger) {
    var previous = currentScene;
    currentScene = scene;
    var trigger = useTrigger && lastClick && Date.now() - lastClick.t < 6000 ? lastClick.label : undefined;
    if (useTrigger) lastClick = null;
    emitScreenView(scene, previous, trigger);
    if (!capturedScreens[scene.screenId]) {
      setTimeout(function () {
        if (capturedScreens[scene.screenId]) return;
        // confere o DOM de novo: se já abriu um modal ou mudou de tela, a captura fica para depois
        var now;
        try {
          now = computeScene();
        } catch (err) {}
        if (currentScene && currentScene.screenId === scene.screenId && now && now.screenId === scene.screenId) {
          captureViewport(scene);
        }
      }, 450);
    }
  }

  // Antes de cada clique: garante que o cenário visível foi registrado e capturado
  // (modais e telas rápidas, que a pessoa fecha em menos de 1s, não se perdem).
  function syncBeforeClick() {
    var scene;
    try {
      scene = computeScene();
    } catch (err) {
      return;
    }
    if (scene.loading) return;
    if (!currentScene || currentScene.screenId !== scene.screenId) {
      if (pendingTimer) clearTimeout(pendingTimer);
      pendingTimer = null;
      pendingSince = 0;
      candidate = null;
      commitScene(scene, true);
    }
    if (!capturedScreens[scene.screenId]) captureViewport(scene); // clona o DOM antes do clique ter efeito
  }

  function emitScreenView(scene, previous, trigger) {
    sendToParent({
      type: 'SCREEN_VIEW',
      screenId: scene.screenId,
      screenName: scene.screenName,
      previousScreenId: previous ? previous.screenId : undefined,
      trigger: trigger,
      params: scene,
      url: window.location.href,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      timestamp: new Date().toISOString()
    });
  }

  // ---------------------------------------------------------------------------
  // Captura visual do cenário (html2canvas)
  // ---------------------------------------------------------------------------
  function scaleCanvas(canvas, maxWidth, quality) {
    var ratio = Math.min(1, maxWidth / canvas.width);
    var c = document.createElement('canvas');
    c.width = Math.round(canvas.width * ratio);
    c.height = Math.round(canvas.height * ratio);
    c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  }

  var MAX_CAPTURE_HEIGHT = 4000;

  // O SDK roda na mesma origem do painel: salva a captura direto no servidor
  // (não depende da versão do painel aberta no navegador).
  function currentSessionId() {
    if (sessionId) return sessionId;
    return mode === 'map' ? 'MAPEAMENTO' : 'PRE-START';
  }
  function persistSnapshot(payload) {
    if (!testId) return;
    try {
      var body = {};
      for (var k in payload) if (k !== 'type' && k !== 'thumbnail') body[k] = payload[k];
      if (mode === 'map') body.participantName = 'Mapeamento do pesquisador';
      fetch('/api/snapshots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(function () {});
    } catch (e) {}
  }
  function reportDiagnostic(kind, data) {
    if (mode === 'preview') return; // revisão do design: nada é registrado
    try {
      var body = { kind: kind, testId: testId, sessionId: currentSessionId(), mode: mode, url: location.pathname, ua: navigator.userAgent, viewport: [window.innerWidth, window.innerHeight], data: data, timestamp: new Date().toISOString() };
      fetch('/api/diagnostics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(function () {});
    } catch (e) {}
  }
  function docSize() {
    var de = document.documentElement;
    var b = document.body;
    return {
      w: Math.max(window.innerWidth, de.clientWidth || 0),
      h: Math.max(window.innerHeight, de.scrollHeight || 0, b ? b.scrollHeight : 0)
    };
  }

  function captureViewport(scene, attempt, force) {
    if ((mode === 'visual' || mode === 'preview') && !force) return; // Raio-X: só quando o painel pede; revisão do design: nunca
    scene = scene || currentScene || computeScene();
    attempt = attempt || 1;
    capturedScreens[scene.screenId] = true;
    sendToParent({
      type: 'SCREEN_CAPTURE_STARTED',
      screenId: scene.screenId,
      screenName: scene.screenName,
      timestamp: new Date().toISOString()
    });
    if (typeof window.html2canvas !== 'function') {
      sendToParent({ type: 'SCREEN_CAPTURE_FAILED', screenId: scene.screenId, error: 'html2canvas indisponível' });
      return;
    }
    // Página inteira (não só a parte visível): os cliques são normalizados pelo documento,
    // então o mapa de calor bate mesmo quando o participante rolou a tela.
    var doc = docSize();
    var capH = Math.min(doc.h, MAX_CAPTURE_HEIGHT);
    window
      .html2canvas(document.body, {
        useCORS: true,
        allowTaint: false,
        logging: false,
        scale: attempt === 1 ? 1 : 0.6,
        imageTimeout: 4000,
        ignoreElements: function (el) {
          return el.tagName === 'IFRAME' || el.tagName === 'VIDEO' || (el.hasAttribute && el.hasAttribute('data-uxlab-ignore'));
        },
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        width: doc.w,
        height: capH,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight
      })
      .then(function (canvas) {
        var image = scaleCanvas(canvas, 1280, 0.72);
        var thumbnail = scaleCanvas(canvas, 360, 0.6);
        var payload = {
          type: 'SCREEN_CAPTURED',
          snapshotId: 'SHOT-' + scene.screenId.slice(0, 24) + '-' + Date.now().toString(36),
          screenId: scene.screenId,
          screenName: scene.screenName,
          image: image,
          thumbnail: thumbnail,
          captureSource: 'REAL_RUNTIME_CAPTURE',
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio || 1,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          documentWidth: doc.w,
          documentHeight: doc.h,
          capturedHeight: capH,
          fullPage: true,
          sessionId: sessionId,
          participantId: participantId,
          testId: testId,
          trackingId: trackingId,
          timestamp: new Date().toISOString()
        };
        payload.sessionId = currentSessionId();
        payload.participantId = participantId || payload.sessionId;
        persistSnapshot(payload);
        sendToParent(payload);
      })
      .catch(function (err) {
        var msg = (err && err.message) || 'Falha na captura';
        reportDiagnostic('capture_failed', { screenId: scene.screenId, attempt: attempt, error: msg });
        if (attempt === 1) {
          capturedScreens[scene.screenId] = false;
          setTimeout(function () {
            if (currentScene && currentScene.screenId === scene.screenId) captureViewport(scene, 2);
          }, 600);
          return;
        }
        sendToParent({ type: 'SCREEN_CAPTURE_FAILED', screenId: scene.screenId, error: msg, timestamp: new Date().toISOString() });
      });
  }

  // ---------------------------------------------------------------------------
  // Eventos
  // ---------------------------------------------------------------------------
  function isPointer(el) {
    for (var i = 0; el && el !== document.body && i < 6; i++, el = el.parentElement) {
      try {
        if (window.getComputedStyle(el).cursor === 'pointer') return true;
      } catch (err) {}
    }
    return false;
  }

  function isFixedLayer(el) {
    for (var i = 0; el && el !== document.body && i < 20; i++, el = el.parentElement) {
      try {
        var pos = window.getComputedStyle(el).position;
        if (pos === 'fixed' || pos === 'sticky') return true;
      } catch (err) {}
    }
    return false;
  }

  // pointerdown chega antes de qualquer efeito do clique (alguns componentes reagem já no pointerdown)
  document.addEventListener('pointerdown', function () { syncBeforeClick(); }, true);

  document.addEventListener(
    'click',
    function (e) {
      syncBeforeClick();
      var target = e.target && e.target.closest ? e.target.closest(INTERACTIVE) || e.target : e.target;
      var label = labelOf(target) || (target && target.tagName ? target.tagName.toLowerCase() : 'elemento');
      lastClick = { label: label, t: Date.now() };
      var doc = docSize();
      // Elementos fixos (modais, cabeçalhos) aparecem na captura como se a página estivesse
      // no topo: para eles a posição vale sem o deslocamento da rolagem.
      var fixed = isFixedLayer(e.target);
      var offX = fixed ? 0 : window.scrollX;
      var offY = fixed ? 0 : window.scrollY;
      var px = e.clientX + offX;
      var py = e.clientY + offY;
      var rect;
      try {
        var r = target.getBoundingClientRect();
        rect = {
          x: (r.left + offX) / doc.w,
          y: (r.top + offY) / doc.h,
          w: r.width / doc.w,
          h: r.height / doc.h
        };
      } catch (err) {}
      sendToParent({
        type: 'INTERACTION',
        eventType: 'CLICK',
        x: e.clientX,
        y: e.clientY,
        normalizedX: e.clientX / window.innerWidth,
        normalizedY: e.clientY / window.innerHeight,
        pageX: px,
        pageY: py,
        pageNX: px / doc.w,
        pageNY: py / doc.h,
        docWidth: doc.w,
        docHeight: doc.h,
        elementRect: rect,
        element: label,
        tagName: target && target.tagName,
        // clicável de verdade: elemento interativo ou com cursor de mão (divs com onClick no Figma Make)
        interactive: !!(e.target && e.target.closest && e.target.closest(INTERACTIVE)) || isPointer(e.target),
        screenId: currentScene ? currentScene.screenId : undefined,
        screenName: currentScene ? currentScene.screenName : undefined,
        timestamp: new Date().toISOString()
      });
      scheduleCheck(500);
    },
    true
  );

  window.addEventListener('popstate', function () { scheduleCheck(300); });
  window.addEventListener('hashchange', function () { scheduleCheck(300); });


  // ---------------------------------------------------------------------------
  // Leitura completa da tela (pedida pela "Ajuda da IA"): textos, campos, opções, botões e erros.
  // Valores digitados NÃO são enviados (podem ser dados pessoais): só se o campo está preenchido.
  // ---------------------------------------------------------------------------
  function fieldLabel(el) {
    var t = el.getAttribute('aria-label') || '';
    if (!t && el.getAttribute('aria-labelledby')) {
      var ref = document.getElementById(el.getAttribute('aria-labelledby'));
      if (ref) t = clean(ref.innerText);
    }
    if (!t && el.id) {
      var lab = document.querySelector('label[for="' + el.id + '"]');
      if (lab) t = clean(lab.innerText);
    }
    if (!t && el.closest('label')) t = clean(el.closest('label').innerText);
    if (!t) t = el.getAttribute('placeholder') || '';
    // rótulo como texto vizinho: sobe até 3 níveis procurando um texto curto que não seja as opções do próprio campo
    var node = el.parentElement;
    for (var up = 0; !t && node && up < 3; up++, node = node.parentElement) {
      var txt = '';
      for (var c = 0; c < node.childNodes.length; c++) {
        var ch = node.childNodes[c];
        if (ch === el || (ch.contains && ch.contains(el))) continue;
        if (ch.nodeType === 1 && /^(SELECT|OPTION|INPUT|TEXTAREA|BUTTON)$/.test(ch.tagName)) continue;
        txt += ' ' + (ch.nodeType === 3 ? ch.textContent : ch.innerText || '');
      }
      txt = clean(txt);
      if (txt && txt.length <= 60) t = txt;
    }
    return clean(t).slice(0, 80);
  }

  function readScreen() {
    var root = getRoot();
    var dialog = findDialog();
    var scope = dialog || root;
    var scene = null;
    try {
      scene = computeScene();
    } catch (e) {}
    var fields = [];
    var els = scope.querySelectorAll('input:not([type=hidden]),select,textarea,[role=combobox],[role=slider],[role=checkbox],[role=radio],[role=switch],[contenteditable=true]');
    for (var i = 0; i < els.length && fields.length < 30; i++) {
      var el = els[i];
      if (!isVisible(el)) continue;
      var f = { label: fieldLabel(el), type: (el.getAttribute('type') || el.getAttribute('role') || el.tagName).toLowerCase() };
      if (el.tagName === 'SELECT') {
        f.type = 'lista';
        f.options = [];
        for (var o = 0; o < el.options.length && f.options.length < 20; o++) {
          var ot = clean(el.options[o].text);
          if (ot && !/^selecione/i.test(ot)) f.options.push(ot);
        }
        var sel = el.options[el.selectedIndex];
        f.selected = sel && el.value ? clean(sel.text) : '';
      } else if (/checkbox|radio|switch/.test(f.type)) {
        f.checked = !!(el.checked || el.getAttribute('aria-checked') === 'true');
      } else {
        f.filled = !!(el.value || clean(el.innerText || ''));
      }
      if (el.required || el.getAttribute('aria-required') === 'true') f.required = true;
      if (el.getAttribute('aria-invalid') === 'true') f.invalid = true;
      if (el.disabled || el.readOnly) f.locked = true;
      ['min', 'max', 'maxlength', 'pattern', 'inputmode'].forEach(function (a) {
        if (el.getAttribute(a)) f[a] = el.getAttribute(a);
      });
      if (el.getAttribute('placeholder')) f.placeholder = el.getAttribute('placeholder');
      fields.push(f);
    }
    var buttons = [];
    var bs = scope.querySelectorAll('button,a,[role=button],[role=tab]');
    for (var b = 0; b < bs.length && buttons.length < 40; b++) {
      if (!isVisible(bs[b])) continue;
      var bl = labelOf(bs[b]);
      if (!bl) continue;
      var label = bl + (bs[b].disabled || bs[b].getAttribute('aria-disabled') === 'true' ? ' (desabilitado)' : '');
      if (buttons.indexOf(label) === -1) buttons.push(label);
    }
    var errors = [];
    var es = scope.querySelectorAll('[role=alert],[aria-live=assertive],[class*=error],[class*=erro],[class*=invalid]');
    for (var e = 0; e < es.length && errors.length < 8; e++) {
      var et = clean(es[e].innerText || '');
      if (et && et.length < 160 && isVisible(es[e]) && errors.indexOf(et) === -1) errors.push(et);
    }
    var text = clean((scope.innerText || '').replace(/\s*\n\s*/g, ' | ')).slice(0, 4000);
    return {
      screenId: scene && scene.screenId,
      screenName: scene && scene.screenName,
      title: scene && scene.title,
      stepLabel: scene && scene.stepLabel,
      dialog: !!dialog,
      text: text,
      fields: fields,
      buttons: buttons,
      errors: errors
    };
  }


  // ---------------------------------------------------------------------------
  // Raio-X da interface: captura + inventário visual (posição, tipo, cor, contraste)
  // ---------------------------------------------------------------------------
  var colorCanvas = null;
  var colorCache = {};
  function toRgb(str) {
    if (!str || str === 'transparent') return null;
    if (colorCache[str] !== undefined) return colorCache[str];
    var out = null;
    try {
      if (!colorCanvas) {
        colorCanvas = document.createElement('canvas');
        colorCanvas.width = colorCanvas.height = 1;
      }
      var cx = colorCanvas.getContext('2d', { willReadFrequently: true });
      cx.clearRect(0, 0, 1, 1);
      cx.fillStyle = '#000';
      cx.fillStyle = str; // aceita rgb, hex, oklch, color(), etc.
      cx.fillRect(0, 0, 1, 1);
      var d = cx.getImageData(0, 0, 1, 1).data;
      out = { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    } catch (e) {}
    colorCache[str] = out;
    return out;
  }
  function hex(c) {
    if (!c) return null;
    var h = function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); };
    return '#' + h(c.r) + h(c.g) + h(c.b);
  }
  function lum(c) {
    var f = function (v) { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function ratio(a, b) {
    if (!a || !b) return null;
    var l1 = lum(a), l2 = lum(b);
    return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;
  }
  // Fundo efetivo: sobe pelos pais até achar cor sólida (ou imagem/gradiente, que não dá para medir)
  function backgroundOf(el) {
    for (var n = el, i = 0; n && n.nodeType === 1 && i < 25; n = n.parentElement, i++) {
      var s = window.getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== 'none') return { image: true };
      var c = toRgb(s.backgroundColor);
      if (c && c.a > 0.55) return { color: c };
    }
    return { color: { r: 255, g: 255, b: 255, a: 1 } };
  }
  function ownText(el) {
    var t = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3) t += n.nodeValue;
    }
    return clean(t);
  }
  function inventory() {
    var root = getRoot();
    var sx = window.scrollX || 0, sy = window.scrollY || 0;
    var out = [];
    var dlgEl = null;
    try { dlgEl = findDialog(); } catch (e) {}
    var all = root.querySelectorAll('*');
    var limit = Math.min(all.length, 4000);
    for (var i = 0; i < limit; i++) {
      var el = all[i];
      var tag = el.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'IFRAME' || tag === 'TEMPLATE') continue;
      if (el.closest('[data-uxlab-ignore]')) continue;
      var r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      var kind = null, label = '';
      var role = el.getAttribute('role') || '';
      var insideAction = el.parentElement && el.parentElement.closest('button,a[href],[role=button],input,select,textarea,label');
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(tag) || /combobox|textbox|slider|checkbox|radio|switch/.test(role)) {
        if (tag === 'INPUT' && /hidden/.test(el.type)) continue;
        kind = /submit|button/.test(el.type || '') ? 'acao' : 'campo';
        label = kind === 'acao' ? labelOf(el) : fieldLabel(el);
      } else if (tag === 'BUTTON' || (tag === 'A' && el.getAttribute('href') !== null) || role === 'button' || role === 'tab' || role === 'link') {
        if (insideAction) continue;
        kind = 'acao';
        label = labelOf(el);
      } else if (tag === 'IMG' || tag === 'PICTURE' || tag === 'VIDEO' || tag === 'CANVAS') {
        if (insideAction && r.width * r.height < 4000) continue;
        kind = r.width * r.height < 2500 ? 'icone' : 'imagem';
        label = el.getAttribute('alt') || '';
      } else if (tag === 'svg' || tag === 'SVG') {
        if (insideAction) continue;
        if (el.parentElement && el.parentElement.closest('svg')) continue;
        kind = r.width * r.height < 2500 ? 'icone' : 'imagem';
        label = el.getAttribute('aria-label') || '';
      } else {
        var ot = ownText(el);
        if (ot && ot.length > 1 && !insideAction) {
          kind = 'texto';
          label = clean(el.innerText || ot);
        } else {
          var bi = window.getComputedStyle(el).backgroundImage;
          if (bi && /url\(/.test(bi) && r.width * r.height > 6000) kind = 'imagem';
        }
      }
      if (!kind) continue;
      if (!isVisible(el)) continue;
      var st = window.getComputedStyle(el);
      if (kind === 'texto') {
        // caixa justa ao texto (um <p> ocupa a largura toda, o texto não)
        try {
          var rg = document.createRange();
          rg.selectNodeContents(el);
          var tr = rg.getBoundingClientRect();
          if (tr.width > 2 && tr.height > 2) r = tr;
        } catch (e) {}
      }
      var item = { k: kind, x: Math.round(r.left + sx), y: Math.round(r.top + sy), w: Math.round(r.width), h: Math.round(r.height), t: clean(label).slice(0, 70), tag: tag.toLowerCase() };
      if (dlgEl) item.dl = dlgEl.contains(el) ? 1 : 0; // dentro do diálogo aberto?
      if (kind === 'texto' || kind === 'acao' || kind === 'campo') {
        var fg = toRgb(st.color);
        var bg = backgroundOf(kind === 'texto' ? el.parentElement || el : el);
        item.fs = Math.round(parseFloat(st.fontSize) || 0);
        item.fw = parseInt(st.fontWeight, 10) || 400;
        item.fg = hex(fg);
        if (bg.image) item.bgImage = true;
        else {
          item.bg = hex(bg.color);
          item.cr = ratio(fg, bg.color);
        }
        if (/^H[1-3]$/.test(tag)) item.hd = Number(tag.slice(1));
      }
      if (kind === 'acao') {
        var own = toRgb(st.backgroundColor);
        if (own && own.a > 0.55) {
          var pageBg = backgroundOf(el.parentElement || el);
          item.filled = true;
          item.fillContrast = pageBg.color ? ratio(own, pageBg.color) : null;
          var mx = Math.max(own.r, own.g, own.b), mn = Math.min(own.r, own.g, own.b);
          item.sat = mx ? Math.round(((mx - mn) / mx) * 100) / 100 : 0;
        }
        if (el.disabled || el.getAttribute('aria-disabled') === 'true') item.disabled = true;
      }
      out.push(item);
    }
    // os maiores primeiro; corta para não pesar
    out.sort(function (a, b) { return b.w * b.h - a.w * a.h; });
    return out.slice(0, 380);
  }
  function visualScan(requestId) {
    var reply = function (extra) {
      var msg = { type: 'UXLAB_VISUAL_RESULT', requestId: requestId };
      for (var k in extra) msg[k] = extra[k];
      sendToParent(msg);
    };
    if (typeof window.html2canvas !== 'function') return reply({ error: 'html2canvas indisponível' });
    var scene = null, ctx = null, items = [];
    try { scene = computeScene(); } catch (e) {}
    try { ctx = readScreen(); } catch (e) {}
    try { items = inventory(); } catch (e) { reportDiagnostic('visual_inventory_failed', { error: String(e) }); }
    var dialogBox = null;
    try {
      var dlg = findDialog();
      if (dlg) {
        // o cartão do diálogo (não o fundo escurecido que cobre a tela inteira)
        var card = dlg;
        var dr = dlg.getBoundingClientRect();
        if (dr.width >= window.innerWidth * 0.95 && dr.height >= window.innerHeight * 0.9) {
          var kids = dlg.querySelectorAll('*');
          for (var q = 0; q < kids.length && q < 200; q++) {
            var kr = kids[q].getBoundingClientRect();
            if (kr.width > 120 && kr.height > 60 && kr.width < dr.width * 0.95 && isVisible(kids[q])) { card = kids[q]; break; }
          }
        }
        var cr2 = card.getBoundingClientRect();
        dialogBox = { x: Math.round(cr2.left + window.scrollX), y: Math.round(cr2.top + window.scrollY), w: Math.round(cr2.width), h: Math.round(cr2.height) };
      }
    } catch (e) {}
    var doc = docSize();
    var capH = Math.min(doc.h, MAX_CAPTURE_HEIGHT);
    var go = function (scale) {
      return window.html2canvas(document.body, {
        useCORS: true, allowTaint: false, logging: false, scale: scale, imageTimeout: 5000,
        ignoreElements: function (el) { return el.tagName === 'IFRAME' || (el.hasAttribute && el.hasAttribute('data-uxlab-ignore')); },
        x: 0, y: 0, scrollX: 0, scrollY: 0, width: doc.w, height: capH, windowWidth: window.innerWidth, windowHeight: window.innerHeight
      });
    };
    var hi = doc.w < 700 ? 2 : 1; // celular: captura em 2x para a imagem não ficar borrada
    go(hi)
      .catch(function () { return go(hi === 2 ? 1 : 0.6); })
      .then(function (canvas) {
        var ratioW = Math.min(1, 1280 / canvas.width);
        var c = document.createElement('canvas');
        c.width = Math.round(canvas.width * ratioW);
        c.height = Math.round(canvas.height * ratioW);
        c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
        reply({
          image: c.toDataURL('image/jpeg', 0.82),
          imageWidth: c.width,
          imageHeight: c.height,
          docWidth: doc.w,
          docHeight: doc.h,
          capturedHeight: capH,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          scene: scene ? { screenId: scene.screenId, screenName: scene.screenName, title: scene.title, stepLabel: scene.stepLabel } : null,
          context: ctx,
          elements: items,
          dialog: dialogBox,
          url: location.pathname + location.search + location.hash
        });
      })
      .catch(function (err) {
        reply({ error: (err && err.message) || 'Falha na captura' });
      });
  }

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'UXLAB_TRIGGER_CAPTURE') captureViewport(currentScene, 1, true);
    if (d.type === 'UXLAB_VISUAL_SCAN') visualScan(d.requestId);
    if (d.type === 'UXLAB_READ_SCREEN') {
      var ctx;
      try {
        ctx = readScreen();
      } catch (err) {
        ctx = { error: String(err) };
      }
      sendToParent({ type: 'UXLAB_SCREEN_CONTEXT', requestId: d.requestId, context: ctx });
    }
    if (d.type === 'UXLAB_SET_SESSION' && d.sessionId) {
      sessionId = String(d.sessionId);
      if (d.participantId) participantId = String(d.participantId);
      // nova sessão: captura de novo os cenários para este participante
      capturedScreens = {};
      if (currentScene) setTimeout(function () { captureViewport(currentScene); }, 300);
    }
    if (d.type === 'UXLAB_REQUEST_STATE') {
      sendToParent({ type: 'UXLAB_SDK_CONNECTED', testId: testId, trackingId: trackingId, mode: mode, status: 'connected', timestamp: new Date().toISOString() });
      if (currentScene) emitScreenView(currentScene, null, undefined);
    }
  });

  function start() {
    sendToParent({
      type: 'UXLAB_SDK_CONNECTED',
      testId: testId,
      trackingId: trackingId,
      sessionId: sessionId,
      participantId: participantId,
      mode: mode,
      timestamp: new Date().toISOString(),
      status: 'connected'
    });
    sendToParent({ type: 'RUNTIME_LOADED', url: window.location.href, title: document.title, timestamp: new Date().toISOString() });

    var observer = new MutationObserver(function () { scheduleCheck(300); });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'open', 'aria-hidden', 'aria-expanded', 'aria-selected', 'data-state', 'data-uxlab-screen']
    });
    scheduleCheck(800);
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
