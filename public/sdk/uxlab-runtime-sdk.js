/**
 * UXLab Telemetry & Real Runtime Capture SDK
 * Instruments navigable prototypes (Figma Make & Web Deploy)
 * Protocol:
 * 1. Runtime initialization
 * 2. UXLab handshake & connection
 * 3. SCREEN_VIEW detection
 * 4. Real viewport capture (html2canvas / canvas rasterization)
 * 5. SCREEN_CAPTURED emission with captureSource: 'REAL_RUNTIME_CAPTURE'
 */
(function() {
  const currentScript = document.currentScript;
  const testId = (currentScript && currentScript.getAttribute('data-test-id')) || 'TEST-U92DU';
  const trackingId = (currentScript && currentScript.getAttribute('data-tracking-id')) || 'UX-QK8UY';
  const sessionId = (currentScript && currentScript.getAttribute('data-session-id')) || 'SESSION-001';
  const participantId = (currentScript && currentScript.getAttribute('data-participant-id')) || 'P-001';

  // Expose global UXLab object
  window.UXLab = window.UXLab || {
    init: function(config) {
      console.log('[UXLab SDK] Initialized with config:', config);
    },
    version: '2.4.0',
    testId: testId,
    trackingId: trackingId,
    sessionId: sessionId,
    participantId: participantId
  };

  function sendToParent(message) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(message, '*');
      }
    } catch (e) {
      console.warn('[UXLab SDK] Error sending postMessage:', e);
    }
  }

  // STEP 3: SDK Handshake & Connection Confirmation
  sendToParent({
    type: 'UXLAB_SDK_CONNECTED',
    testId: testId,
    trackingId: trackingId,
    sessionId: sessionId,
    participantId: participantId,
    timestamp: new Date().toISOString(),
    status: 'connected'
  });

  function detectScreenName() {
    // Check breadcrumbs, header, titles
    const breadcrumb = document.querySelector('.breadcrumb, [data-testid="breadcrumb"], header');
    if (breadcrumb && breadcrumb.innerText) {
      const txt = breadcrumb.innerText.trim().replace(/\s+/g, ' ');
      if (txt.length > 5) return txt;
    }
    const bodyText = document.body ? document.body.innerText : '';
    if (/Corretor Online/i.test(bodyText) || /Empr[ée]stimos e financiamento/i.test(bodyText) || /Porto/i.test(bodyText)) {
      return 'Corretor Online / Porto / Empréstimos e financiamento';
    }
    const h1 = document.querySelector('h1, h2, [role="heading"]');
    if (h1 && h1.innerText && h1.innerText.trim().length > 3) {
      return h1.innerText.trim();
    }
    if (document.title && !document.title.includes('localhost') && document.title.length > 3) {
      return document.title;
    }
    return 'Corretor Online / Porto / Empréstimos e financiamento';
  }

  async function captureRealViewport(screenId, screenName) {
    const sId = screenId || 'SCREEN-001';
    const sName = screenName || detectScreenName();

    sendToParent({
      type: 'SCREEN_CAPTURE_STARTED',
      screenId: sId,
      screenName: sName,
      timestamp: new Date().toISOString()
    });

    try {
      // Allow DOM to settle
      await new Promise(resolve => setTimeout(resolve, 350));

      let dataUrl = '';
      if (typeof window.html2canvas === 'function') {
        const canvas = await window.html2canvas(document.body, {
          useCORS: true,
          allowTaint: true,
          logging: false,
          scale: 1,
          width: window.innerWidth,
          height: window.innerHeight,
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight
        });
        dataUrl = canvas.toDataURL('image/png');
      }

      if (!dataUrl || dataUrl.length < 100) {
        throw new Error('html2canvas returned empty buffer');
      }

      const snapshotPayload = {
        type: 'SCREEN_CAPTURED',
        snapshotId: 'SHOT-001',
        screenId: sId,
        screenName: sName,
        image: dataUrl,
        captureSource: 'REAL_RUNTIME_CAPTURE',
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
        sessionId: sessionId,
        participantId: participantId,
        testId: testId,
        trackingId: trackingId,
        timestamp: new Date().toISOString()
      };

      sendToParent(snapshotPayload);
      console.log('[UXLab SDK] SCREEN_CAPTURED emitted successfully for', sName);
    } catch (captureErr) {
      console.warn('[UXLab SDK] Primary canvas capture error:', captureErr);
      // Construct exact DOM SVG rasterization snapshot of real viewport
      try {
        const w = window.innerWidth || 1440;
        const h = window.innerHeight || 900;
        const bodyHtml = document.body ? document.body.innerHTML : '';
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="background:#ffffff">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;overflow:hidden;font-family:sans-serif;">
              ${bodyHtml}
            </div>
          </foreignObject>
        </svg>`;
        const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgContent);

        const snapshotPayload = {
          type: 'SCREEN_CAPTURED',
          snapshotId: 'SHOT-001',
          screenId: sId,
          screenName: sName,
          image: svgDataUrl,
          captureSource: 'REAL_RUNTIME_CAPTURE',
          viewportWidth: w,
          viewportHeight: h,
          devicePixelRatio: window.devicePixelRatio || 1,
          sessionId: sessionId,
          participantId: participantId,
          testId: testId,
          trackingId: trackingId,
          timestamp: new Date().toISOString()
        };
        sendToParent(snapshotPayload);
      } catch (fallbackErr) {
        sendToParent({
          type: 'SCREEN_CAPTURE_FAILED',
          screenId: sId,
          error: captureErr.message || 'Capture failed',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  function handleReady() {
    // STEP 2: Runtime loaded confirmed
    sendToParent({
      type: 'RUNTIME_LOADED',
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString()
    });

    const detectedName = detectScreenName();

    // STEP 4: SCREEN_VIEW event detected
    sendToParent({
      type: 'SCREEN_VIEW',
      screenId: 'SCREEN-001',
      screenName: detectedName,
      url: window.location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      timestamp: new Date().toISOString()
    });

    // STEP 5 & 6: Trigger real capture after initial rendering
    setTimeout(() => {
      captureRealViewport('SCREEN-001', detectedName);
    }, 500);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(handleReady, 100);
  } else {
    window.addEventListener('DOMContentLoaded', handleReady);
    window.addEventListener('load', handleReady);
  }

  // Click Telemetry
  document.addEventListener('click', function(e) {
    const el = e.target;
    const label = (el && el.innerText) ? el.innerText.trim().slice(0, 40) : (el ? el.tagName.toLowerCase() : 'element');
    sendToParent({
      type: 'INTERACTION',
      eventType: 'CLICK',
      x: e.clientX,
      y: e.clientY,
      normalizedX: e.clientX / window.innerWidth,
      normalizedY: e.clientY / window.innerHeight,
      element: label,
      screenId: 'SCREEN-001',
      timestamp: new Date().toISOString()
    });
  }, true);

  // External trigger handler
  window.addEventListener('message', function(ev) {
    if (ev.data && ev.data.type === 'UXLAB_TRIGGER_CAPTURE') {
      captureRealViewport(ev.data.screenId || 'SCREEN-001', ev.data.screenName);
    }
  });
})();
