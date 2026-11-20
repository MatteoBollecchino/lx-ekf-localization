(function () {
  'use strict';

  const registry = [];
  let currentLang = (document.body && document.body.dataset.lang) || 'en';

  const UI_LABELS = {
    en: {
      play: 'Play',
      pause: 'Pause',
      step: 'Step',
      reset: 'Reset',
      speed: 'Speed'
    },
    it: {
      play: 'Avvia',
      pause: 'Pausa',
      step: 'Passo',
      reset: 'Reset',
      speed: 'Velocità'
    }
  };

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeInOutCubic(t) {
    t = clamp(t, 0, 1);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function easeOutCubic(t) {
    t = clamp(t, 0, 1);
    return 1 - Math.pow(1 - t, 3);
  }

  function wrapAngle(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }

  function gaussian(x, mu, sigma) {
    const s = Math.max(sigma, 1e-4);
    const z = (x - mu) / s;
    return Math.exp(-0.5 * z * z) / (s * Math.sqrt(2 * Math.PI));
  }

  function randn() {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  function covEllipse2x2(p00, p01, p11) {
    const tr = p00 + p11;
    const diff = p00 - p11;
    const disc = Math.sqrt(diff * diff + 4 * p01 * p01);
    const l1 = Math.max(1e-6, 0.5 * (tr + disc));
    const l2 = Math.max(1e-6, 0.5 * (tr - disc));
    const angle = 0.5 * Math.atan2(2 * p01, diff);
    return {
      rx: Math.sqrt(l1),
      ry: Math.sqrt(l2),
      angle: angle
    };
  }

  function mat3Mul(A, B) {
    const C = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        C[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
      }
    }
    return C;
  }

  function mat3T(A) {
    return [
      [A[0][0], A[1][0], A[2][0]],
      [A[0][1], A[1][1], A[2][1]],
      [A[0][2], A[1][2], A[2][2]]
    ];
  }

  function mat3Add(A, B) {
    const C = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        C[i][j] = A[i][j] + B[i][j];
      }
    }
    return C;
  }

  function mat3Sub(A, B) {
    const C = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        C[i][j] = A[i][j] - B[i][j];
      }
    }
    return C;
  }

  function mat2Inv(M) {
    const det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
    const safeDet = Math.abs(det) < 1e-9 ? (det >= 0 ? 1e-9 : -1e-9) : det;
    const inv = 1 / safeDet;
    return [
      [M[1][1] * inv, -M[0][1] * inv],
      [-M[1][0] * inv, M[0][0] * inv]
    ];
  }

  function drawObsidianBg(ctx, w, h) {
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, w, h);
  }

  function drawHairlineGrid(ctx, x, y, w, h, stepPx, alpha) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, ' + (alpha || 0.045) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = x; gx <= x + w + 0.5; gx += stepPx) {
      const px = Math.round(gx) + 0.5;
      ctx.moveTo(px, y);
      ctx.lineTo(px, y + h);
    }
    for (let gy = y; gy <= y + h + 0.5; gy += stepPx) {
      const py = Math.round(gy) + 0.5;
      ctx.moveTo(x, py);
      ctx.lineTo(x + w, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawPoseArrow(ctx, x, y, theta, radius, strokeColor, fillColor) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(theta);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = fillColor || 'rgba(10, 10, 12, 0.9)';
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = strokeColor || '#f4f4f6';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(radius * 1.18, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(radius * 1.18, 0, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = strokeColor || '#f4f4f6';
    ctx.fill();
    ctx.restore();
  }

  function drawLabelPill(ctx, text, x, y, align, color, bg) {
    ctx.save();
    ctx.font = '600 10.5px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    if (bg) {
      const metrics = ctx.measureText(text);
      const pw = metrics.width + 10;
      const ph = 18;
      let rx = x;
      if (align === 'center') rx = x - pw / 2;
      else if (align === 'right') rx = x - pw;
      ctx.fillStyle = bg;
      ctx.fillRect(rx, y - ph / 2, pw, ph);
    }
    ctx.fillStyle = color || '#a1a1aa';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function createLab(containerId, spec) {
    const root = document.getElementById(containerId);
    if (!root) return null;

    const canvas = root.querySelector('[data-sim-canvas]');
    const btnPlay = root.querySelector('[data-sim-play]');
    const btnStep = root.querySelector('[data-sim-step]');
    const btnReset = root.querySelector('[data-sim-reset]');
    const speedInput = root.querySelector('[data-sim-speed]');
    const speedLabel = root.querySelector('[data-sim-speed-lbl]');
    const timelineEls = Array.prototype.slice.call(root.querySelectorAll('[data-sim-timeline] .phase-step'));
    const titleEl = root.querySelector('[data-sim-title]');
    const descEl = root.querySelector('[data-sim-desc]');
    const eqEl = root.querySelector('[data-sim-eq]');
    const telemEl = root.querySelector('[data-sim-telemetry]');

    var eqHintEl = null;
    var currentEqSnapshot = null;
    if (eqEl && eqEl.parentNode && typeof document.createElement === 'function') {
      eqEl.setAttribute('role', 'button');
      eqEl.setAttribute('tabindex', '0');
      eqHintEl = document.createElement('div');
      eqHintEl.className = 'narrator-eq-hint';
      eqHintEl.setAttribute('role', 'button');
      eqHintEl.setAttribute('tabindex', '0');
      eqHintEl.innerHTML = '<span class="narrator-eq-hint-icon">i</span><span class="narrator-eq-hint-text"></span>';
      eqEl.parentNode.insertBefore(eqHintEl, eqEl.nextSibling);
    }

    const ctx = canvas.getContext('2d');
    const durations = spec.phaseDurations || [2.4, 3.0, 3.0, 3.2];

    const state = {
      phase: 0,
      progress: 0,
      cycle: 1,
      playing: true,
      stepping: false,
      stepTargetProgress: 0.99,
      speed: speedInput ? parseFloat(speedInput.value) || 1.0 : 1.0,
      inView: true,
      lastTs: 0,
      lastTelemTs: 0,
      width: 600,
      height: 360,
      dpr: 1,
      user: {}
    };

    const api = {
      root: root,
      canvas: canvas,
      state: state,
      getLang: function () {
        return currentLang;
      },
      refresh: function () {
        syncNarrator();
        syncTelemetry(true);
        renderFrame(0);
      },
      reset: function () {
        state.phase = 0;
        state.progress = 0;
        state.cycle = 1;
        state.stepping = false;
        if (spec.onReset) spec.onReset(state.user, api);
        if (spec.onEnterPhase) spec.onEnterPhase(0, state.user, api);
        syncNarrator();
        syncTelemetry(true);
        renderFrame(0);
      }
    };

    function syncStaticChrome() {
      const ui = UI_LABELS[currentLang] || UI_LABELS.en;
      if (btnPlay) {
        btnPlay.textContent = state.playing ? ui.pause : ui.play;
        btnPlay.classList.toggle('primary', !state.playing);
      }
      if (btnStep) btnStep.textContent = ui.step;
      if (btnReset) btnReset.textContent = ui.reset;
      if (speedLabel) speedLabel.textContent = ui.speed + ' ' + state.speed.toFixed(1) + 'x';
      const labels = (spec.phaseLabels && spec.phaseLabels[currentLang]) || (spec.phaseLabels && spec.phaseLabels.en) || [];
      timelineEls.forEach(function (el, idx) {
        if (labels[idx] !== undefined) el.textContent = labels[idx];
      });
      if (eqHintEl) {
        var hintSpan = eqHintEl.querySelector('.narrator-eq-hint-text');
        if (hintSpan) {
          hintSpan.textContent =
            currentLang === 'it'
              ? 'Clicca o tocca la formula per il significato dei termini'
              : 'Click or tap the formula to inspect each term';
        }
      }
      if (spec.onLangChange) spec.onLangChange(currentLang, state.user, api);
    }

    function renderEquationEl(el, rawEq) {
      if (!el) return;
      var tex = typeof rawEq === 'object' && rawEq !== null ? rawEq.tex : rawEq;
      var plain = typeof rawEq === 'object' && rawEq !== null ? rawEq.plain : rawEq;
      if (window.katex && typeof window.katex.render === 'function' && tex) {
        try {
          el.classList.add('has-katex');
          window.katex.render(tex, el, { displayMode: true, throwOnError: false });
          return;
        } catch (err) {
          el.classList.remove('has-katex');
        }
      }
      el.classList.remove('has-katex');
      el.textContent = plain || tex || '';
    }

    function renderInlineMath(el) {
      if (!el || typeof window.renderMathInElement !== 'function') return;
      try {
        window.renderMathInElement(el, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '\\(', right: '\\)', display: false }
          ],
          throwOnError: false
        });
      } catch (err) {
        // ignore fallback
      }
    }

    function syncNarrator() {
      timelineEls.forEach(function (el, idx) {
        el.classList.toggle('active', idx === state.phase);
      });
      const list = (spec.phases && spec.phases[currentLang]) || (spec.phases && spec.phases.en) || [];
      const info = list[state.phase];
      if (!info) return;
      if (titleEl) {
        titleEl.textContent = typeof info.title === 'function' ? info.title(state.user, state) : info.title;
        renderInlineMath(titleEl);
      }
      if (descEl) {
        descEl.textContent = typeof info.desc === 'function' ? info.desc(state.user, state) : info.desc;
        renderInlineMath(descEl);
      }
      if (eqEl) {
        var rawEq = typeof info.eq === 'function' ? info.eq(state.user, state) : info.eq;
        renderEquationEl(eqEl, rawEq);

        var explainItems = typeof info.eqExplain === 'function' ? info.eqExplain(state.user, state) : info.eqExplain;
        var hasExplain = Array.isArray(explainItems) && explainItems.length > 0;
        eqEl.classList.toggle('is-interactive', hasExplain);
        if (eqHintEl) eqHintEl.style.display = hasExplain ? 'flex' : 'none';
        if (hasExplain) {
          var labels = (spec.phaseLabels && spec.phaseLabels[currentLang]) || (spec.phaseLabels && spec.phaseLabels.en) || [];
          var texStr = typeof rawEq === 'object' && rawEq !== null ? rawEq.tex : rawEq;
          currentEqSnapshot = {
            kicker: containerId.replace('lab-', 'LAB ').toUpperCase() + (labels[state.phase] ? ' · ' + labels[state.phase] : ''),
            title: typeof info.title === 'function' ? info.title(state.user, state) : info.title,
            tex: texStr || '',
            explain: explainItems
          };
        } else {
          currentEqSnapshot = null;
        }
      }
    }

    function syncTelemetry(force) {
      if (!telemEl || !spec.getTelemetry) return;
      const now = performance.now();
      if (!force && now - state.lastTelemTs < 75) return;
      state.lastTelemTs = now;
      const items = spec.getTelemetry(currentLang, state.user, state);
      if (!items || !items.length) return;
      if (telemEl.children.length !== items.length) {
        telemEl.innerHTML = items
          .map(function (item) {
            return (
              '<div class="telem-item">' +
              '<span class="telem-k"></span>' +
              '<span class="telem-v' + (item.gold ? ' gold' : '') + '"></span>' +
              '</div>'
            );
          })
          .join('');
      }
      for (let i = 0; i < items.length; i++) {
        const node = telemEl.children[i];
        node.children[0].textContent = items[i].label;
        node.children[1].textContent = items[i].value;
        node.children[1].className = 'telem-v' + (items[i].gold ? ' gold' : '');
      }
    }

    function resizeCanvas() {
      const wrap = canvas.parentElement;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(300, Math.round(rect.width));
      const h = Math.max(280, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      state.width = w;
      state.height = h;
      state.dpr = dpr;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderFrame(0);
    }

    function enterPhase(nextPhase) {
      if (nextPhase === 0 && state.phase === 3) {
        state.cycle += 1;
      }
      state.phase = nextPhase;
      state.progress = 0;
      if (spec.onEnterPhase) spec.onEnterPhase(nextPhase, state.user, api);
      syncNarrator();
      syncTelemetry(true);
    }

    function renderFrame(dt) {
      ctx.save();
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      if (spec.onRender) {
        spec.onRender(ctx, state.width, state.height, state.phase, state.progress, dt, currentLang, state.user, state);
      }
      ctx.restore();
    }

    function tick(ts) {
      if (!state.lastTs) state.lastTs = ts;
      const rawDt = Math.min(0.05, Math.max(0, (ts - state.lastTs) / 1000));
      state.lastTs = ts;

      if (state.inView && (state.playing || state.stepping)) {
        const effectiveSpeed = state.stepping ? Math.max(state.speed, 1.45) : state.speed;
        const dur = durations[state.phase] || 2.8;
        state.progress += (rawDt * effectiveSpeed) / dur;

        if (state.stepping) {
          if (state.progress >= state.stepTargetProgress) {
            state.progress = state.stepTargetProgress;
            state.stepping = false;
            state.playing = false;
            syncStaticChrome();
            syncNarrator();
            syncTelemetry(true);
          }
        } else if (state.progress >= 1) {
          state.progress = 0;
          enterPhase((state.phase + 1) % 4);
        }

        renderFrame(rawDt);
        syncTelemetry(false);
      }

      requestAnimationFrame(tick);
    }

    if (btnPlay) {
      btnPlay.addEventListener('click', function () {
        state.stepping = false;
        state.playing = !state.playing;
        syncStaticChrome();
      });
    }

    if (btnStep) {
      btnStep.addEventListener('click', function () {
        state.playing = false;
        if (state.progress >= 0.85 || (state.phase === 0 && state.progress < 0.08)) {
          enterPhase((state.phase + 1) % 4);
        }
        state.stepTargetProgress = 0.985;
        state.stepping = true;
        syncStaticChrome();
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', function () {
        api.reset();
        syncStaticChrome();
      });
    }

    if (speedInput) {
      speedInput.addEventListener('input', function () {
        state.speed = parseFloat(speedInput.value) || 1.0;
        syncStaticChrome();
      });
    }

    timelineEls.forEach(function (el, idx) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function () {
        state.playing = false;
        enterPhase(idx);
        state.stepTargetProgress = 0.985;
        state.stepping = true;
        syncStaticChrome();
      });
    });

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(function () {
        resizeCanvas();
      });
      ro.observe(canvas.parentElement);
    } else {
      window.addEventListener('resize', resizeCanvas);
    }

    if (typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            state.inView = entry.isIntersecting;
            if (state.inView) state.lastTs = performance.now();
          });
        },
        { threshold: 0.08 }
      );
      io.observe(root);
    }

    api._syncLang = function () {
      syncStaticChrome();
      syncNarrator();
      syncTelemetry(true);
      renderFrame(0);
    };

    api._rerenderMath = function () {
      syncNarrator();
    };

    var openInspector = function () {
      if (currentEqSnapshot) {
        showFormulaModal(currentEqSnapshot, renderEquationEl, renderInlineMath);
      }
    };
    if (eqEl) {
      eqEl.addEventListener('click', openInspector);
      eqEl.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openInspector();
        }
      });
    }
    if (eqHintEl) {
      eqHintEl.addEventListener('click', openInspector);
      eqHintEl.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openInspector();
        }
      });
    }

    registry.push(api);
    if (spec.onReset) spec.onReset(state.user, api);
    if (spec.onEnterPhase) spec.onEnterPhase(0, state.user, api);
    syncStaticChrome();
    syncNarrator();
    syncTelemetry(true);
    resizeCanvas();
    requestAnimationFrame(tick);
    return api;
  }

  var modalEls = null;
  function getFormulaModal() {
    if (modalEls || typeof document.createElement !== 'function' || !document.body) return modalEls;
    var backdrop = document.createElement('div');
    backdrop.className = 'fi-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.innerHTML =
      '<div class="fi-modal" data-fi-modal>' +
      '  <div class="fi-head">' +
      '    <div>' +
      '      <div class="fi-kicker" data-fi-kicker></div>' +
      '      <div class="fi-title" data-fi-title></div>' +
      '    </div>' +
      '    <div class="fi-head-actions">' +
      '      <button type="button" class="fi-sim-toggle" data-fi-sim-toggle style="display:none;"></button>' +
      '      <button type="button" class="fi-close" aria-label="Close">&times;</button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="fi-eq-box" data-fi-eq></div>' +
      '  <div class="fi-terms" data-fi-terms></div>' +
      '  <div class="fi-sim-mount" data-fi-sim style="display:none;"></div>' +
      '</div>';
    document.body.appendChild(backdrop);

    var closeBtn = backdrop.querySelector('.fi-close');
    function closeModal() {
      backdrop.classList.remove('open');
      if (document.body) document.body.classList.remove('modal-open');
      if (window.FormulaSims && typeof window.FormulaSims.unmount === 'function') {
        window.FormulaSims.unmount();
      }
    }
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', function (ev) {
      if (ev.target === backdrop) closeModal();
    });
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && backdrop.classList.contains('open')) closeModal();
      });
    }

    modalEls = {
      backdrop: backdrop,
      modal: backdrop.querySelector('[data-fi-modal]'),
      kicker: backdrop.querySelector('[data-fi-kicker]'),
      title: backdrop.querySelector('[data-fi-title]'),
      simToggle: backdrop.querySelector('[data-fi-sim-toggle]'),
      eq: backdrop.querySelector('[data-fi-eq]'),
      terms: backdrop.querySelector('[data-fi-terms]'),
      simMount: backdrop.querySelector('[data-fi-sim]')
    };
    return modalEls;
  }

  function showFormulaModal(snapshot, renderEquationFn, renderInlineFn) {
    var m = getFormulaModal();
    if (!m) return;
    if (window.FormulaSims && typeof window.FormulaSims.unmount === 'function') {
      window.FormulaSims.unmount();
    }
    var eqFn = renderEquationFn || function (el, rawEq) {
      var tex = typeof rawEq === 'object' && rawEq !== null ? rawEq.tex : rawEq;
      if (window.katex && typeof window.katex.render === 'function' && tex) {
        try {
          el.classList.add('has-katex');
          window.katex.render(tex, el, { displayMode: true, throwOnError: false });
          return;
        } catch (err) {
          el.classList.remove('has-katex');
        }
      }
      el.textContent = tex || '';
    };
    var inlineFn = renderInlineFn || function (el) {
      if (!el || typeof window.renderMathInElement !== 'function') return;
      try {
        window.renderMathInElement(el, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '\\(', right: '\\)', display: false }
          ],
          throwOnError: false
        });
      } catch (err) { /* ignore */ }
    };
    m.kicker.textContent = snapshot.kicker || '';
    m.title.textContent = snapshot.title || '';
    inlineFn(m.title);
    eqFn(m.eq, snapshot.tex || '');

    var hasSim = !!(snapshot.simKey && window.FormulaSims && window.FormulaSims.has(snapshot.simKey));
    var inSimMode = hasSim && snapshot.initialMode === 'sim';

    function syncModeView(showSim) {
      inSimMode = showSim;
      if (m.modal) m.modal.classList.toggle('is-sim', showSim);
      m.eq.style.display = showSim ? 'none' : 'block';
      m.terms.style.display = showSim ? 'none' : 'flex';
      if (m.simMount) m.simMount.style.display = showSim ? 'block' : 'none';

      if (m.simToggle) {
        m.simToggle.style.display = hasSim ? 'inline-flex' : 'none';
        m.simToggle.classList.toggle('active', showSim);
        var isIt = currentLang === 'it';
        m.simToggle.textContent = showSim
          ? (isIt ? '← Spiegazione termini' : '← Term breakdown')
          : (isIt ? '▶ Simula la formula' : '▶ Simulate formula');
      }

      if (showSim && window.FormulaSims) {
        window.FormulaSims.mount(snapshot.simKey, m.simMount, currentLang);
      } else if (window.FormulaSims) {
        window.FormulaSims.unmount();
      }
    }

    if (m.simToggle) {
      m.simToggle.onclick = function () {
        syncModeView(!inSimMode);
      };
    }

    m.terms.innerHTML = '';
    snapshot.explain.forEach(function (item, idx) {
      var row = document.createElement('div');
      row.className = 'fi-term' + (idx === 0 ? ' active' : '');

      var symEl = document.createElement('div');
      symEl.className = 'fi-term-sym';
      if (window.katex && typeof window.katex.render === 'function') {
        try {
          window.katex.render(item.sym, symEl, { displayMode: false, throwOnError: false });
        } catch (err) {
          symEl.textContent = item.sym;
        }
      } else {
        symEl.textContent = item.sym;
      }

      var bodyEl = document.createElement('div');
      bodyEl.className = 'fi-term-body';
      var lblEl = document.createElement('div');
      lblEl.className = 'fi-term-label';
      lblEl.textContent = item.label;
      var descEl = document.createElement('div');
      descEl.className = 'fi-term-desc';
      descEl.textContent = item.desc;
      inlineFn(descEl);

      bodyEl.appendChild(lblEl);
      bodyEl.appendChild(descEl);
      row.appendChild(symEl);
      row.appendChild(bodyEl);

      row.addEventListener('click', function () {
        Array.prototype.slice.call(m.terms.children).forEach(function (c) {
          c.classList.remove('active');
        });
        row.classList.add('active');
      });
      m.terms.appendChild(row);
    });

    m.backdrop.classList.add('open');
    if (document.body) document.body.classList.add('modal-open');
    syncModeView(inSimMode);
  }

  window.LocSims = {
    createLab: createLab,
    registerCustomLab: function (hooks) {
      if (hooks) registry.push(hooks);
    },
    openFormulaInspector: function (snapshot) {
      if (snapshot) showFormulaModal(snapshot);
    },
    setLang: function (lang) {
      currentLang = lang === 'it' ? 'it' : 'en';
      registry.forEach(function (lab) {
        lab._syncLang();
      });
    },
    rerenderEquations: function () {
      registry.forEach(function (lab) {
        lab._rerenderMath();
      });
    },
    getLang: function () {
      return currentLang;
    },
    math: {
      clamp: clamp,
      lerp: lerp,
      easeInOutCubic: easeInOutCubic,
      easeOutCubic: easeOutCubic,
      wrapAngle: wrapAngle,
      gaussian: gaussian,
      randn: randn,
      covEllipse2x2: covEllipse2x2,
      mat3Mul: mat3Mul,
      mat3T: mat3T,
      mat3Add: mat3Add,
      mat3Sub: mat3Sub,
      mat2Inv: mat2Inv
    },
    draw: {
      obsidianBg: drawObsidianBg,
      hairlineGrid: drawHairlineGrid,
      poseArrow: drawPoseArrow,
      labelPill: drawLabelPill
    }
  };
})();
