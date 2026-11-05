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
  var sessionId = attr('data-session-id', '');
  var participantId = attr('data-participant-id', '');
  var mode = attr('data-mode', 'run'); // 'run' (participante) | 'map' (mapeamento)

  window.UXLab = window.UXLab || {
    init: function (config) {
      console.log('[UXLab SDK] init', config);
    }
  };
  window.UXLab.version = '3.0.0';
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
  function findStepLabel(scope) {
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
      if (found && isVisible(el)) return found;
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
    if (!title) title = clean(document.title) || 'Tela sem título';

    var stepLabel = findStepLabel(scope);
    var parts = [dialog ? 'modal' : '', title, stepLabel, subtitle].filter(Boolean);
    var screenId = slugify(parts.join(' ')) || 'tela';
    var screenName = (dialog ? 'Modal: ' : '') + title + (subtitle ? ' — ' + subtitle : '') + (stepLabel ? ' (' + stepLabel + ')' : '');
    return buildScene(screenId, screenName, title, subtitle, stepLabel, !!dialog, scope);
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

  function scheduleCheck(delay) {
    var now = Date.now();
    if (!pendingSince) pendingSince = now;
    if (pendingTimer) clearTimeout(pendingTimer);
    // espera o DOM "assentar", mas nunca mais que 1,5s (animações contínuas)
    var wait = now - pendingSince > 1500 ? 0 : delay || 450;
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
    if (currentScene && currentScene.screenId === scene.screenId) {
      currentScene = scene; // atualiza ações/campos sem emitir troca
      return;
    }
    var previous = currentScene;
    currentScene = scene;
    var trigger = lastClick && Date.now() - lastClick.t < 6000 ? lastClick.label : undefined;
    lastClick = null;
    emitScreenView(scene, previous, trigger);
    if (!capturedScreens[scene.screenId]) {
      capturedScreens[scene.screenId] = true;
      setTimeout(function () {
        if (currentScene && currentScene.screenId === scene.screenId) captureViewport(scene);
      }, 500);
    }
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

  function captureViewport(scene) {
    scene = scene || currentScene || computeScene();
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
    window
      .html2canvas(document.body, {
        useCORS: true,
        allowTaint: false,
        logging: false,
        scale: 1,
        x: window.scrollX,
        y: window.scrollY,
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight
      })
      .then(function (canvas) {
        var image = scaleCanvas(canvas, 1440, 0.82);
        var thumbnail = scaleCanvas(canvas, 360, 0.6);
        sendToParent({
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
          documentHeight: document.documentElement.scrollHeight,
          sessionId: sessionId,
          participantId: participantId,
          testId: testId,
          trackingId: trackingId,
          timestamp: new Date().toISOString()
        });
      })
      .catch(function (err) {
        sendToParent({
          type: 'SCREEN_CAPTURE_FAILED',
          screenId: scene.screenId,
          error: (err && err.message) || 'Falha na captura',
          timestamp: new Date().toISOString()
        });
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

  document.addEventListener(
    'click',
    function (e) {
      var target = e.target && e.target.closest ? e.target.closest(INTERACTIVE) || e.target : e.target;
      var label = labelOf(target) || (target && target.tagName ? target.tagName.toLowerCase() : 'elemento');
      lastClick = { label: label, t: Date.now() };
      sendToParent({
        type: 'INTERACTION',
        eventType: 'CLICK',
        x: e.clientX,
        y: e.clientY,
        normalizedX: e.clientX / window.innerWidth,
        normalizedY: e.clientY / window.innerHeight,
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

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'UXLAB_TRIGGER_CAPTURE') captureViewport(currentScene);
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

    var observer = new MutationObserver(function () { scheduleCheck(450); });
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
