(function () {
  'use strict';

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function wrapRad(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a <= -Math.PI) a += 2 * Math.PI;
    return a;
  }

  function degToRad(d) {
    return (d * Math.PI) / 180;
  }

  function radToDeg(r) {
    return (r * 180) / Math.PI;
  }

  function easeInOutCubic(t) {
    var c = t < 0 ? 0 : t > 1 ? 1 : t;
    return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
  }

  function signedFixed(n, digits) {
    var val = Math.abs(n) < 0.5 * Math.pow(10, -digits) ? 0 : n;
    var s = val.toFixed(digits);
    return (val >= 0 && !s.startsWith('-') ? '+' : '') + s;
  }

  function covEllipse2x2(p00, p01, p11) {
    var tr = p00 + p11;
    var diff = p00 - p11;
    var disc = Math.sqrt(diff * diff + 4 * p01 * p01);
    var l1 = Math.max(1e-6, 0.5 * (tr + disc));
    var l2 = Math.max(1e-6, 0.5 * (tr - disc));
    var angle = 0.5 * Math.atan2(2 * p01, diff);
    return {
      rx: Math.sqrt(l1),
      ry: Math.sqrt(l2),
      angle: angle
    };
  }

  function renderTex(el, tex) {
    if (window.katex && typeof window.katex.render === 'function') {
      try {
        window.katex.render(tex, el, { displayMode: true, throwOnError: false });
        return;
      } catch (e) { /* fallback */ }
    }
    el.textContent = tex;
  }

  // Note: world frame uses standard math axes (+x right, +y UP, theta CCW from +x)
  function drawRobotMath(ctx, px, py, thetaMathRad, color, isGhost, robScale) {
    var sc = robScale || 1.32;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-thetaMathRad);
    ctx.globalAlpha = isGhost ? 0.58 : 1.0;

    ctx.fillStyle = '#09090b';
    ctx.strokeStyle = isGhost ? 'rgba(148, 163, 184, 0.5)' : 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.1;
    ctx.fillRect(-8 * sc, -11 * sc, 11 * sc, 3.5 * sc);
    ctx.strokeRect(-8 * sc, -11 * sc, 11 * sc, 3.5 * sc);
    ctx.fillRect(-8 * sc, 7.5 * sc, 11 * sc, 3.5 * sc);
    ctx.strokeRect(-8 * sc, 7.5 * sc, 11 * sc, 3.5 * sc);

    ctx.fillStyle = isGhost ? '#17171d' : '#1b1a14';
    ctx.strokeStyle = color;
    ctx.lineWidth = isGhost ? 1.5 : 2.2;
    ctx.fillRect(-9 * sc, -7.5 * sc, 19 * sc, 15 * sc);
    ctx.strokeRect(-9 * sc, -7.5 * sc, 19 * sc, 15 * sc);

    ctx.fillStyle = color;
    ctx.fillRect(5 * sc, -4 * sc, 4 * sc, 8 * sc);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(10 * sc, 0);
    ctx.lineTo(19 * sc, 0);
    ctx.stroke();

    ctx.restore();
  }

  function drawAprilTag(ctx, px, py, idStr) {
    ctx.save();
    ctx.fillStyle = '#0d0d10';
    ctx.strokeStyle = '#e07a5f';
    ctx.lineWidth = 2.0;
    ctx.fillRect(px - 12, py - 12, 24, 24);
    ctx.strokeRect(px - 12, py - 12, 24, 24);
    ctx.fillStyle = '#e07a5f';
    ctx.fillRect(px - 6, py - 6, 5.5, 5.5);
    ctx.fillRect(px + 0.5, py + 0.5, 5.5, 5.5);
    ctx.restore();
    drawPill(ctx, idStr || 'Tag #37', px, py + 23, '#e07a5f', 'rgba(9,9,12,0.92)', 'center');
  }

  function drawArrow(ctx, x1, y1, x2, y2, color, width, dash) {
    var ang = Math.atan2(y2 - y1, x2 - x1);
    var len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 3) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width || 2.2;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.translate(x2, y2);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-8.5, -4.2);
    ctx.lineTo(-8.5, 4.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawEllipseMath(ctx, cx, cy, ell, nSigma, scale, stroke, fill, dash) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-ell.angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(5, ell.rx * nSigma * scale), Math.max(5, ell.ry * nSigma * scale), 0, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2.0;
      if (dash) ctx.setLineDash(dash);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPill(ctx, text, x, y, color, bg, align) {
    ctx.save();
    ctx.font = '600 11.5px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    var m = ctx.measureText(text);
    var pw = m.width + 12;
    var ph = 20;
    var rx = align === 'left' ? x : align === 'right' ? x - pw : x - pw / 2;
    ctx.fillStyle = bg || 'rgba(10, 10, 12, 0.92)';
    ctx.fillRect(rx, y - ph / 2, pw, ph);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, y - ph / 2, pw, ph);
    ctx.fillStyle = color || '#f4f4f6';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawWorldGrid(ctx, w, h, ox, oy, scale, step) {
    ctx.fillStyle = '#09090c';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    var stepPx = step * scale;
    var startX = ((ox % stepPx) + stepPx) % stepPx;
    var startY = ((oy % stepPx) + stepPx) % stepPx;
    for (var gx = startX; gx <= w; gx += stepPx) {
      var px = Math.round(gx) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
    }
    for (var gy = startY; gy <= h; gy += stepPx) {
      var py = Math.round(gy) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.moveTo(0, oy + 0.5);
    ctx.lineTo(w, oy + 0.5);
    ctx.moveTo(ox + 0.5, 0);
    ctx.lineTo(ox + 0.5, h);
    ctx.stroke();

    drawPill(ctx, '+X', w - 22, oy - 13, '#71717a', 'rgba(9,9,12,0.88)', 'center');
    drawPill(ctx, '+Y', ox + 18, 15, '#71717a', 'rgba(9,9,12,0.88)', 'center');
  }

  // Reusable two-column interactive simulator scaffold
  function mountCanvasSim(container, lang, cfg) {
    var isIt = lang === 'it';
    var state = Object.assign({}, cfg.defaults, { playing: true, loop: false });
    var animT = 0;
    var holdTimer = 0;
    var lastTex = '';
    var lastEqTs = 0;

    var sliderHtml = cfg.sliders
      .map(function (s) {
        return (
          '<div class="fi-slider-row">' +
          '  <div class="fi-slider-head">' +
          '    <span class="fi-slider-name" data-lbl="' + s.key + '"></span>' +
          '    <span class="fi-slider-val" data-val="' + s.key + '"></span>' +
          '  </div>' +
          '  <input type="range" min="' + s.min + '" max="' + s.max + '" step="' + s.step + '" data-inp="' + s.key + '" />' +
          '</div>'
        );
      })
      .join('');

    var guideTxt = cfg.guide ? (isIt ? cfg.guide.it : cfg.guide.en) : '';

    container.innerHTML =
      '<div class="fi-sim-grid">' +
      '  <div class="fi-sim-left">' +
      '    <div class="fi-live-eq" data-fsim-eq></div>' +
      (guideTxt ? '    <div class="fi-sim-guide">' + guideTxt + '</div>' : '') +
      '    <div class="fi-presets" data-fsim-presets></div>' +
      '    <div class="fi-sliders">' + sliderHtml + '</div>' +
      '    <div class="fi-sim-controls">' +
      '      <button type="button" class="sim-btn primary" data-fsim-play></button>' +
      '      <button type="button" class="sim-btn" data-fsim-loop></button>' +
      '      <button type="button" class="sim-btn" data-fsim-reset></button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="fi-sim-right">' +
      '    <div class="fi-sim-canvas-wrap">' +
      '      <canvas data-fsim-canvas></canvas>' +
      '    </div>' +
      '    <div class="fi-sim-legend" data-fsim-legend></div>' +
      '  </div>' +
      '</div>';

    var eqBox = container.querySelector('[data-fsim-eq]');
    var presetsWrap = container.querySelector('[data-fsim-presets]');
    var btnPlay = container.querySelector('[data-fsim-play]');
    var btnLoop = container.querySelector('[data-fsim-loop]');
    var btnReset = container.querySelector('[data-fsim-reset]');
    var canvas = container.querySelector('[data-fsim-canvas]');
    var legendEl = container.querySelector('[data-fsim-legend]');

    legendEl.innerHTML = isIt ? cfg.legend.it : cfg.legend.en;
    btnReset.textContent = isIt ? 'Ripristina' : 'Reset';

    var presets = (cfg.presets && (isIt ? cfg.presets.it : cfg.presets.en)) || [];
    presets.forEach(function (p, idx) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'fi-preset-btn' + (idx === cfg.defaultPresetIdx ? ' active' : '');
      b.textContent = p.label;
      b.addEventListener('click', function () {
        Object.keys(p.vals).forEach(function (k) {
          state[k] = p.vals[k];
        });
        animT = 0;
        holdTimer = 0;
        state.playing = true;
        Array.prototype.slice.call(presetsWrap.children).forEach(function (c) {
          c.classList.remove('active');
        });
        b.classList.add('active');
        syncControls();
        updateEq(true);
        drawFrame();
      });
      presetsWrap.appendChild(b);
    });

    function syncControls() {
      cfg.sliders.forEach(function (s) {
        var lbl = container.querySelector('[data-lbl="' + s.key + '"]');
        var val = container.querySelector('[data-val="' + s.key + '"]');
        var inp = container.querySelector('[data-inp="' + s.key + '"]');
        if (lbl) lbl.textContent = isIt ? s.labelIt : s.labelEn;
        if (inp) inp.value = state[s.key];
        if (val) val.textContent = s.fmt ? s.fmt(state[s.key]) : String(state[s.key]);
      });

      var isDone = !state.playing && animT >= 0.999;
      btnPlay.textContent = state.playing
        ? isIt ? 'Pausa' : 'Pause'
        : isDone
          ? isIt ? '▶ Rivedi (Replay)' : '▶ Replay'
          : isIt ? '▶ Riprendi' : '▶ Resume';
      btnPlay.classList.toggle('primary', !state.playing);

      if (btnLoop) {
        btnLoop.textContent = (isIt ? 'Loop: ' : 'Loop: ') + (state.loop ? 'ON' : 'OFF');
        btnLoop.classList.toggle('active-toggle', !!state.loop);
      }
    }

    function updateEq(force) {
      var now = performance.now ? performance.now() : Date.now();
      if (!force && now - lastEqTs < 55) return;
      var tFrac = animT >= 0.999 && !state.playing ? 1.0 : easeInOutCubic(animT);
      var tex = cfg.renderEq(state, tFrac, isIt);
      if (force || tex !== lastTex) {
        lastTex = tex;
        lastEqTs = now;
        renderTex(eqBox, tex);
      }
    }

    cfg.sliders.forEach(function (s) {
      var inp = container.querySelector('[data-inp="' + s.key + '"]');
      if (!inp) return;
      inp.addEventListener('input', function () {
        state[s.key] = parseFloat(inp.value);
        // Dragging a slider pauses cleanly at final evolved pose so changes show immediately
        state.playing = false;
        animT = 1.0;
        Array.prototype.slice.call(presetsWrap.children).forEach(function (c) {
          c.classList.remove('active');
        });
        syncControls();
        updateEq(true);
        drawFrame();
      });
    });

    btnPlay.addEventListener('click', function () {
      if (!state.playing && animT >= 0.999) {
        animT = 0;
        holdTimer = 0;
        state.playing = true;
      } else {
        state.playing = !state.playing;
      }
      syncControls();
      updateEq(true);
      drawFrame();
    });

    if (btnLoop) {
      btnLoop.addEventListener('click', function () {
        state.loop = !state.loop;
        if (state.loop && !state.playing && animT >= 0.999) {
          animT = 0;
          holdTimer = 0;
          state.playing = true;
        }
        syncControls();
      });
    }

    btnReset.addEventListener('click', function () {
      var keepLoop = state.loop;
      Object.assign(state, cfg.defaults);
      state.playing = true;
      state.loop = keepLoop;
      animT = 0;
      holdTimer = 0;
      Array.prototype.slice.call(presetsWrap.children).forEach(function (c, i) {
        c.classList.toggle('active', i === cfg.defaultPresetIdx);
      });
      syncControls();
      updateEq(true);
      drawFrame();
    });

    var ctx = canvas.getContext('2d');
    var w = 640;
    var h = 440;
    var dpr = 1;

    function measure() {
      var wrap = canvas.parentElement;
      if (!wrap) return;
      var rect = wrap.getBoundingClientRect();
      var nextW = Math.max(280, Math.round(rect.width));
      var nextH = Math.max(300, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (w !== nextW || h !== nextH || canvas.width !== Math.round(nextW * dpr)) {
        w = nextW;
        h = nextH;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
    }

    function drawFrame() {
      measure();
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var tFrac = easeInOutCubic(animT);
      cfg.draw(ctx, w, h, state, tFrac, isIt);
      ctx.restore();
    }

    var rafId = null;
    var lastTs = 0;
    var SWEEP_SECONDS = 3.6;
    function loop(ts) {
      if (!lastTs) lastTs = ts;
      var rawDt = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000));
      lastTs = ts;
      if (state.playing) {
        if (animT < 1.0) {
          animT = Math.min(1.0, animT + rawDt / SWEEP_SECONDS);
          updateEq(animT >= 1.0);
          drawFrame();
        } else if (state.loop) {
          holdTimer += rawDt;
          if (holdTimer >= 1.6) {
            animT = 0;
            holdTimer = 0;
            updateEq(true);
            drawFrame();
          }
        } else {
          state.playing = false;
          syncControls();
          updateEq(true);
          drawFrame();
        }
      }
      rafId = requestAnimationFrame(loop);
    }

    syncControls();
    updateEq(true);
    drawFrame();
    rafId = requestAnimationFrame(loop);

    return function destroy() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      container.innerHTML = '';
    };
  }

  var activeController = null;

  var SIM_REGISTRY = {
    // ------------------------------------------------------------------
    // ROW 1: (1. Non-Linear Motion)
    // ------------------------------------------------------------------
    'ekf-motion': function (container, lang) {
      return mountCanvasSim(container, lang, {
        defaults: { v: 1.35, thetaDeg: 34, omega: 0.90, dt: 0.75 },
        defaultPresetIdx: 1,
        guide: {
          it: '<strong>Cosa osservare:</strong> la velocità <code>v</code> viene scomposta nei cateti <span class="leg-blue">Δx = v·cos(θ)·Δt</span> e <span class="leg-coral">Δy = v·sin(θ)·Δt</span>, mentre il quadrante in alto mostra come <code>wrap()</code> riporta l’angolo in [−180°, +180°].',
          en: '<strong>What to watch:</strong> speed <code>v</code> decomposes into legs <span class="leg-blue">Δx = v·cos(θ)·Δt</span> and <span class="leg-coral">Δy = v·sin(θ)·Δt</span>, while the top-right dial shows how <code>wrap()</code> keeps heading inside [−180°, +180°].'
        },
        legend: {
          it: '<span class="leg-blue">■ Δx = v·cos(θ)·Δt</span><span class="leg-coral">■ Δy = v·sin(θ)·Δt</span><span class="leg-gold">■ Posa q̄ₜ</span>',
          en: '<span class="leg-blue">■ Δx = v·cos(θ)·Δt</span><span class="leg-coral">■ Δy = v·sin(θ)·Δt</span><span class="leg-gold">■ Pose q̄ₜ</span>'
        },
        presets: {
          it: [
            { label: 'Marcia Dritta (ω=0)', vals: { v: 1.40, thetaDeg: 28, omega: 0.0, dt: 0.75 } },
            { label: 'Curva Fluida', vals: { v: 1.35, thetaDeg: 34, omega: 0.90, dt: 0.75 } },
            { label: 'Taglio ±180°', vals: { v: 1.15, thetaDeg: 162, omega: 1.25, dt: 0.65 } }
          ],
          en: [
            { label: 'Straight (ω=0)', vals: { v: 1.40, thetaDeg: 28, omega: 0.0, dt: 0.75 } },
            { label: 'Smooth Arc', vals: { v: 1.35, thetaDeg: 34, omega: 0.90, dt: 0.75 } },
            { label: '±180° Wrap Seam', vals: { v: 1.15, thetaDeg: 162, omega: 1.25, dt: 0.65 } }
          ]
        },
        sliders: [
          { key: 'v', min: 0, max: 2.0, step: 0.05, labelIt: 'Velocità lineare (v)', labelEn: 'Linear velocity (v)', fmt: function (v) { return v.toFixed(2) + ' m/s'; } },
          { key: 'thetaDeg', min: -180, max: 180, step: 1, labelIt: 'Orientamento iniziale (θ)', labelEn: 'Initial heading (θ)', fmt: function (v) { return signedFixed(v, 0) + '°'; } },
          { key: 'omega', min: -2.5, max: 2.5, step: 0.05, labelIt: 'Velocità angolare (ω)', labelEn: 'Turn rate (ω)', fmt: function (v) { return signedFixed(v, 2) + ' rad/s'; } },
          { key: 'dt', min: 0.1, max: 1.0, step: 0.05, labelIt: 'Passo temporale (Δt)', labelEn: 'Time step (Δt)', fmt: function (v) { return v.toFixed(2) + ' s'; } }
        ],
        renderEq: function (s, tFrac) {
          var th = degToRad(s.thetaDeg);
          var curDt = s.dt * tFrac;
          var curDx = s.v * Math.cos(th) * curDt;
          var curDy = s.v * Math.sin(th) * curDt;
          var curWrap = wrapRad(th + s.omega * curDt);
          var thStr = signedFixed(s.thetaDeg, 0) + '^\\circ';
          return (
            '\\bar{q}(t) = \\begin{bmatrix} ' +
            '{\\color{#60a5fa} ' + s.v.toFixed(2) + '\\cos(' + thStr + ')(' + curDt.toFixed(2) + ')} \\\\[4pt]' +
            '{\\color{#e07a5f} ' + s.v.toFixed(2) + '\\sin(' + thStr + ')(' + curDt.toFixed(2) + ')} \\\\[4pt]' +
            '{\\color{#ffd000} \\operatorname{wrap}(' + thStr + ' ' + signedFixed(radToDeg(s.omega * curDt), 0) + '^\\circ)}' +
            '\\end{bmatrix} = \\begin{bmatrix}' +
            '{\\color{#60a5fa} ' + signedFixed(curDx, 2) + '\\text{ m}} \\\\[4pt]' +
            '{\\color{#e07a5f} ' + signedFixed(curDy, 2) + '\\text{ m}} \\\\[4pt]' +
            '{\\color{#ffd000} ' + signedFixed(radToDeg(curWrap), 0) + '^\\circ}' +
            '\\end{bmatrix}'
          );
        },
        draw: function (ctx, w, h, s, tFrac) {
          var th0 = degToRad(s.thetaDeg);
          var fullDx = s.v * Math.cos(th0) * s.dt;
          var fullDy = s.v * Math.sin(th0) * s.dt;
          var midX = fullDx * 0.45;
          var midY = fullDy * 0.45;
          var spanMeters = Math.max(1.45, Math.hypot(fullDx, fullDy) * 1.45);
          var scale = (Math.min(w, h) - 68) / (spanMeters * 2);
          var ox = Math.round(w * 0.46 - midX * scale);
          var oy = Math.round(h * 0.54 + midY * scale);
          function toPx(wx, wy) { return { x: ox + wx * scale, y: oy - wy * scale }; }

          drawWorldGrid(ctx, w, h, ox, oy, scale, 0.5);

          var effDt = s.dt * tFrac;
          var dx = s.v * Math.cos(th0) * effDt;
          var dy = s.v * Math.sin(th0) * effDt;
          var thRaw = th0 + s.omega * effDt;
          var thWrap = wrapRad(thRaw);
          var wrappedCross = Math.abs(radToDeg(thRaw)) > 180.0;

          var p0 = toPx(0, 0);
          var pX = toPx(dx, 0);
          var pEnd = toPx(dx, dy);
          var pFull = toPx(fullDx, fullDy);

          if (tFrac < 0.999) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 208, 0, 0.25)';
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(pFull.x, pFull.y);
            ctx.stroke();
            ctx.restore();
          }

          ctx.save();
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 2.8;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(pX.x, pX.y);
          ctx.stroke();

          ctx.strokeStyle = '#e07a5f';
          ctx.lineWidth = 2.8;
          ctx.beginPath();
          ctx.moveTo(pX.x, pX.y);
          ctx.lineTo(pEnd.x, pEnd.y);
          ctx.stroke();

          ctx.strokeStyle = '#ffd000';
          ctx.lineWidth = 2.2;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(pEnd.x, pEnd.y);
          ctx.stroke();
          ctx.restore();

          drawRobotMath(ctx, p0.x, p0.y, th0, '#94a3b8', true, 1.32);
          drawRobotMath(ctx, pEnd.x, pEnd.y, thWrap, '#ffd000', false, 1.38);

          if (Math.hypot(pX.x - p0.x, pX.y - p0.y) > 28) {
            drawPill(ctx, 'Δx=' + signedFixed(dx, 2) + 'm', (p0.x + pX.x) * 0.5, p0.y + (dy >= 0 ? 18 : -18), '#60a5fa');
          }
          if (Math.hypot(pEnd.x - pX.x, pEnd.y - pX.y) > 28) {
            drawPill(ctx, 'Δy=' + signedFixed(dy, 2) + 'm', pX.x + (dx >= 0 ? 52 : -52), (pX.y + pEnd.y) * 0.5, '#e07a5f');
          }

          // Top-right wrap(theta + omega*dt) gauge
          var gx = w - 62;
          var gy = 62;
          var gr = 34;
          ctx.save();
          ctx.fillStyle = 'rgba(15, 15, 19, 0.94)';
          ctx.strokeStyle = wrappedCross ? 'rgba(224, 122, 95, 0.78)' : 'rgba(255, 255, 255, 0.16)';
          ctx.lineWidth = wrappedCross ? 1.8 : 1.1;
          ctx.beginPath();
          ctx.arc(gx, gy, gr + 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.strokeStyle = wrappedCross ? '#e07a5f' : 'rgba(224, 122, 95, 0.55)';
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(gx - gr - 5, gy);
          ctx.lineTo(gx, gy);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(gx, gy);
          ctx.lineTo(gx + Math.cos(th0) * (gr * 0.8), gy - Math.sin(th0) * (gr * 0.8));
          ctx.stroke();

          ctx.strokeStyle = wrappedCross ? 'rgba(224, 122, 95, 0.8)' : 'rgba(255, 208, 0, 0.5)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(gx, gy, gr * 0.58, -th0, -thRaw, thRaw > th0);
          ctx.stroke();

          ctx.strokeStyle = '#ffd000';
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(gx, gy);
          ctx.lineTo(gx + Math.cos(thWrap) * gr, gy - Math.sin(thWrap) * gr);
          ctx.stroke();
          ctx.restore();

          drawPill(ctx, wrappedCross ? 'WRAP ±180°!' : 'wrap(θ+ωΔt)', gx, gy + gr + 18, wrappedCross ? '#e07a5f' : '#a1a1aa');
          drawPill(ctx, 'Δt = ' + effDt.toFixed(2) + 's  |  q̄ = [' + signedFixed(dx, 2) + ', ' + signedFixed(dy, 2) + ', ' + signedFixed(radToDeg(thWrap), 0) + '°]', 12, h - 16, '#ffd000', null, 'left');
        }
      });
    },

    // ------------------------------------------------------------------
    // ROW 2: (2. Motion Jacobians)
    // ------------------------------------------------------------------
    'ekf-jac': function (container, lang) {
      return mountCanvasSim(container, lang, {
        defaults: { v: 1.40, thetaDeg: 30, dThetaDeg: 18, dt: 0.85 },
        defaultPresetIdx: 1,
        guide: {
          it: '<strong>Cosa osservare:</strong> un errore sull’angolo <code>±δθ</code> apre un ventaglio curvo a banana; lo Jacobiano <span class="leg-gold">F_t</span> lo approssima con la freccia tangente perpendicolare al moto (termini <code>−v·sin(θ)Δt</code> e <code>v·cos(θ)Δt</code>).',
          en: '<strong>What to watch:</strong> heading uncertainty <code>±δθ</code> sweeps a curved banana fan; Jacobian <span class="leg-gold">F_t</span> approximates it with the perpendicular tangent chord (<code>−v·sin(θ)Δt</code> and <code>v·cos(θ)Δt</code>).'
        },
        legend: {
          it: '<span class="leg-slate">■ Ventaglio curvo reale</span><span class="leg-gold">■ Tangente Jacobiano F·δθ</span><span class="leg-blue">■ Asse controllo W_t</span>',
          en: '<span class="leg-slate">■ True curved fan</span><span class="leg-gold">■ Jacobian tangent F·δθ</span><span class="leg-blue">■ Control axis W_t</span>'
        },
        presets: {
          it: [
            { label: 'θ = 0° (Solo Y)', vals: { v: 1.50, thetaDeg: 0, dThetaDeg: 16, dt: 0.85 } },
            { label: 'Curva a 30°', vals: { v: 1.40, thetaDeg: 30, dThetaDeg: 18, dt: 0.85 } },
            { label: 'δθ Alto (Errore 1° Ordine)', vals: { v: 1.60, thetaDeg: 25, dThetaDeg: 32, dt: 0.90 } }
          ],
          en: [
            { label: 'θ = 0° (Pure Lateral)', vals: { v: 1.50, thetaDeg: 0, dThetaDeg: 16, dt: 0.85 } },
            { label: '30° Angled Heading', vals: { v: 1.40, thetaDeg: 30, dThetaDeg: 18, dt: 0.85 } },
            { label: 'Large δθ (Approx. Gap)', vals: { v: 1.60, thetaDeg: 25, dThetaDeg: 32, dt: 0.90 } }
          ]
        },
        sliders: [
          { key: 'v', min: 0.3, max: 2.0, step: 0.05, labelIt: 'Velocità lineare (v)', labelEn: 'Linear velocity (v)', fmt: function (v) { return v.toFixed(2) + ' m/s'; } },
          { key: 'thetaDeg', min: -180, max: 180, step: 1, labelIt: 'Orientamento (θ)', labelEn: 'Heading (θ)', fmt: function (v) { return signedFixed(v, 0) + '°'; } },
          { key: 'dThetaDeg', min: 2, max: 32, step: 1, labelIt: 'Ampiezza ventaglio (±δθ)', labelEn: 'Fan angle (±δθ)', fmt: function (v) { return '±' + v.toFixed(0) + '°'; } },
          { key: 'dt', min: 0.2, max: 1.0, step: 0.05, labelIt: 'Passo Δt', labelEn: 'Time step (Δt)', fmt: function (v) { return v.toFixed(2) + ' s'; } }
        ],
        renderEq: function (s, tFrac) {
          var th = degToRad(s.thetaDeg);
          var effDt = s.dt * Math.max(0.05, tFrac);
          var f02 = -s.v * Math.sin(th) * effDt;
          var f12 = s.v * Math.cos(th) * effDt;
          var w00 = Math.cos(th) * effDt;
          var w10 = Math.sin(th) * effDt;
          return (
            '\\begin{aligned}' +
            'F_t &= \\begin{bmatrix} 1 & 0 & {\\color{#ffd000}' + signedFixed(f02, 2) + '} \\\\ 0 & 1 & {\\color{#ffd000}' + signedFixed(f12, 2) + '} \\\\ 0 & 0 & 1 \\end{bmatrix} \\\\[6pt]' +
            'W_t &= \\begin{bmatrix} {\\color{#60a5fa}' + signedFixed(w00, 2) + '} & 0 \\\\ {\\color{#e07a5f}' + signedFixed(w10, 2) + '} & 0 \\\\ 0 & ' + effDt.toFixed(2) + ' \\end{bmatrix}' +
            '\\end{aligned}'
          );
        },
        draw: function (ctx, w, h, s, tFrac) {
          var th = degToRad(s.thetaDeg);
          var dTh = degToRad(s.dThetaDeg);
          var fullR = s.v * s.dt;
          var curR = Math.max(0.08, fullR * tFrac);
          var nomX = curR * Math.cos(th);
          var nomY = curR * Math.sin(th);

          var focusX = fullR * Math.cos(th) * 0.48;
          var focusY = fullR * Math.sin(th) * 0.48;
          var worldHalf = Math.max(1.25, fullR * 1.12);
          var scale = (Math.min(w, h) - 68) / (worldHalf * 2);
          var ox = Math.round(w * 0.48 - focusX * scale);
          var oy = Math.round(h * 0.54 + focusY * scale);
          function toPx(wx, wy) { return { x: ox + wx * scale, y: oy - wy * scale }; }

          drawWorldGrid(ctx, w, h, ox, oy, scale, 0.5);

          var p0 = toPx(0, 0);
          var pNom = toPx(nomX, nomY);

          // True curved non-linear arc fan (theta - dTh -> theta + dTh) at current arc radius curR
          ctx.save();
          ctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          for (var a = th - dTh; a <= th + dTh + 1e-4; a += Math.max(0.02, dTh / 12)) {
            var pa = toPx(curR * Math.cos(a), curR * Math.sin(a));
            ctx.lineTo(pa.x, pa.y);
          }
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = 'rgba(244, 244, 246, 0.78)';
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          for (var a2 = th - dTh; a2 <= th + dTh + 1e-4; a2 += Math.max(0.02, dTh / 14)) {
            var pb = toPx(curR * Math.cos(a2), curR * Math.sin(a2));
            if (a2 === th - dTh) ctx.moveTo(pb.x, pb.y);
            else ctx.lineTo(pb.x, pb.y);
          }
          ctx.stroke();
          ctx.restore();

          // Jacobian perpendicular tangent vectors: +/- F[:,2] * dTh
          var f02 = -curR * Math.sin(th);
          var f12 = curR * Math.cos(th);
          var pTanPlus = toPx(nomX + f02 * dTh, nomY + f12 * dTh);
          var pTanMinus = toPx(nomX - f02 * dTh, nomY - f12 * dTh);

          drawArrow(ctx, pNom.x, pNom.y, pTanPlus.x, pTanPlus.y, '#ffd000', 2.8);
          drawArrow(ctx, pNom.x, pNom.y, pTanMinus.x, pTanMinus.y, '#ffd000', 2.8);

          // W_t forward control sensitivity vector
          var wStep = 0.42 * s.dt * Math.max(0.25, tFrac);
          var pW = toPx(nomX + Math.cos(th) * wStep, nomY + Math.sin(th) * wStep);
          drawArrow(ctx, pNom.x, pNom.y, pW.x, pW.y, '#60a5fa', 2.4, [4, 3]);

          ctx.save();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(pNom.x, pNom.y);
          ctx.stroke();
          ctx.restore();

          drawRobotMath(ctx, p0.x, p0.y, th, '#94a3b8', true, 1.3);
          drawRobotMath(ctx, pNom.x, pNom.y, th, '#ffd000', false, 1.38);

          drawPill(ctx, 'F·(+δθ)', pTanPlus.x, pTanPlus.y - 16, '#ffd000');
          drawPill(ctx, 'W_t·δv', pW.x, pW.y + 18, '#60a5fa');

          var pTruePlus = toPx(curR * Math.cos(th + dTh), curR * Math.sin(th + dTh));
          var gapM = Math.hypot(nomX + f02 * dTh - curR * Math.cos(th + dTh), nomY + f12 * dTh - curR * Math.sin(th + dTh));
          if (gapM > 0.02) {
            ctx.save();
            ctx.strokeStyle = '#e07a5f';
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.moveTo(pTruePlus.x, pTruePlus.y);
            ctx.lineTo(pTanPlus.x, pTanPlus.y);
            ctx.stroke();
            ctx.restore();
          }
          drawPill(ctx, 'Δt·t = ' + (s.dt * tFrac).toFixed(2) + 's  |  err_lin = ' + gapM.toFixed(3) + ' m', 12, h - 16, gapM > 0.08 ? '#e07a5f' : '#a1a1aa', null, 'left');
        }
      });
    },

    // ------------------------------------------------------------------
    // ROW 3: (3. Prior Covariance)
    // ------------------------------------------------------------------
    'ekf-cov': function (container, lang) {
      function computeCov(s, tFrac) {
        var dt = 0.80 * tFrac;
        var th = degToRad(s.thetaDeg);
        var p00 = 0.028;
        var p11 = 0.028;
        var pTh = Math.pow(degToRad(s.sigThetaDeg), 2);
        var qV = s.sigV * s.sigV;
        var qW = 0.05 * 0.05;

        var c = Math.cos(th);
        var sn = Math.sin(th);
        var f02 = -s.v * sn * dt;
        var f12 = s.v * c * dt;

        var pf00 = p00 + f02 * f02 * pTh;
        var pf01 = f02 * f12 * pTh;
        var pf11 = p11 + f12 * f12 * pTh;

        var w00 = c * dt;
        var w10 = sn * dt;
        var pq00 = w00 * w00 * qV;
        var pq01 = w00 * w10 * qV;
        var pq11 = w10 * w10 * qV;

        return {
          th: th,
          dt: dt,
          cx: s.v * c * dt,
          cy: s.v * sn * dt,
          p0: { p00: p00, p01: 0, p11: p11 },
          pf: { p00: pf00, p01: pf01, p11: pf11 },
          pTot: { p00: pf00 + pq00, p01: pf01 + pq01, p11: pf11 + pq11, pTh: pTh + dt * dt * qW }
        };
      }

      return mountCanvasSim(container, lang, {
        defaults: { v: 1.50, thetaDeg: 32, sigThetaDeg: 15, sigV: 0.22 },
        defaultPresetIdx: 1,
        guide: {
          it: '<strong>Cosa osservare:</strong> <span class="leg-blue">F·P·Fᵀ</span> gonfia l’ellisse <em>lateralmente</em> se l’angolo iniziale <code>σ_θ</code> è incerto, mentre <span class="leg-coral">W·Q·Wᵀ</span> la allunga <em>in avanti</em> lungo la marcia quando le ruote slittano (<code>σ_v</code>).',
          en: '<strong>What to watch:</strong> <span class="leg-blue">F·P·Fᵀ</span> stretches the ellipse <em>sideways</em> when heading <code>σ_θ</code> is uncertain, while <span class="leg-coral">W·Q·Wᵀ</span> elongates it <em>forward</em> along motion when wheels slip (<code>σ_v</code>).'
        },
        legend: {
          it: '<span class="leg-slate">■ Prior P_{t-1}</span><span class="leg-blue">■ Moto FPFᵀ</span><span class="leg-gold">■ Totale P̄_t = FPFᵀ + WQWᵀ</span>',
          en: '<span class="leg-slate">■ Prior P_{t-1}</span><span class="leg-blue">■ Dynamics FPFᵀ</span><span class="leg-gold">■ Final P̄_t = FPFᵀ + WQWᵀ</span>'
        },
        presets: {
          it: [
            { label: 'Alta Deriva Ruote (σ_v↑)', vals: { v: 1.30, thetaDeg: 30, sigThetaDeg: 4, sigV: 0.35 } },
            { label: 'Angolo Incerto (σ_θ↑)', vals: { v: 1.65, thetaDeg: 32, sigThetaDeg: 22, sigV: 0.12 } },
            { label: 'Fermo (v = 0)', vals: { v: 0.00, thetaDeg: 30, sigThetaDeg: 18, sigV: 0.25 } }
          ],
          en: [
            { label: 'High Wheel Slip (σ_v↑)', vals: { v: 1.30, thetaDeg: 30, sigThetaDeg: 4, sigV: 0.35 } },
            { label: 'Uncertain Heading (σ_θ↑)', vals: { v: 1.65, thetaDeg: 32, sigThetaDeg: 22, sigV: 0.12 } },
            { label: 'Stationary (v = 0)', vals: { v: 0.00, thetaDeg: 30, sigThetaDeg: 18, sigV: 0.25 } }
          ]
        },
        sliders: [
          { key: 'v', min: 0, max: 2.0, step: 0.05, labelIt: 'Velocità v', labelEn: 'Speed v', fmt: function (v) { return v.toFixed(2) + ' m/s'; } },
          { key: 'thetaDeg', min: -180, max: 180, step: 1, labelIt: 'Orientamento θ', labelEn: 'Heading θ', fmt: function (v) { return signedFixed(v, 0) + '°'; } },
          { key: 'sigThetaDeg', min: 2, max: 26, step: 1, labelIt: 'Incertezza angolo σ_θ (in P)', labelEn: 'Heading std σ_θ (in P)', fmt: function (v) { return v.toFixed(0) + '°'; } },
          { key: 'sigV', min: 0.02, max: 0.35, step: 0.01, labelIt: 'Rumore ruote σ_v (in Q)', labelEn: 'Wheel slip σ_v (in Q)', fmt: function (v) { return v.toFixed(2) + ' m/s'; } }
        ],
        renderEq: function (s, tFrac) {
          var r = computeCov(s, tFrac);
          return (
            '\\begin{aligned}' +
            '\\bar{P}_{xy}(t) &= {\\color{#60a5fa}\\begin{bmatrix}' + r.pf.p00.toFixed(3) + ' & ' + signedFixed(r.pf.p01, 3) + ' \\\\ ' + signedFixed(r.pf.p01, 3) + ' & ' + r.pf.p11.toFixed(3) + '\\end{bmatrix}} + ' +
            '{\\color{#e07a5f}\\begin{bmatrix}' + (r.pTot.p00 - r.pf.p00).toFixed(3) + ' & ' + signedFixed(r.pTot.p01 - r.pf.p01, 3) + ' \\\\ ' + signedFixed(r.pTot.p01 - r.pf.p01, 3) + ' & ' + (r.pTot.p11 - r.pf.p11).toFixed(3) + '\\end{bmatrix}} \\\\[6pt]' +
            '&= {\\color{#ffd000}\\begin{bmatrix}' + r.pTot.p00.toFixed(3) + ' & ' + signedFixed(r.pTot.p01, 3) + ' \\\\ ' + signedFixed(r.pTot.p01, 3) + ' & ' + r.pTot.p11.toFixed(3) + '\\end{bmatrix}}' +
            '\\end{aligned}'
          );
        },
        draw: function (ctx, w, h, s, tFrac) {
          var endCov = computeCov(s, 1.0);
          var c = computeCov(s, tFrac);
          var focusX = endCov.cx * 0.45;
          var focusY = endCov.cy * 0.45;
          var worldHalf = Math.max(1.45, Math.hypot(endCov.cx, endCov.cy) * 0.9 + 0.95);
          var scale = (Math.min(w, h) - 64) / (worldHalf * 2);
          var ox = Math.round(w * 0.46 - focusX * scale);
          var oy = Math.round(h * 0.54 + focusY * scale);
          function toPx(wx, wy) { return { x: ox + wx * scale, y: oy - wy * scale }; }

          drawWorldGrid(ctx, w, h, ox, oy, scale, 0.5);

          var p0 = toPx(0, 0);
          var pEnd = toPx(c.cx, c.cy);

          var ell0 = covEllipse2x2(c.p0.p00, c.p0.p01, c.p0.p11);
          drawEllipseMath(ctx, p0.x, p0.y, ell0, 2.3, scale, 'rgba(148,163,184,0.65)', 'rgba(148,163,184,0.1)', [4, 3]);

          ctx.save();
          ctx.strokeStyle = 'rgba(255,255,255,0.28)';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(pEnd.x, pEnd.y);
          ctx.stroke();
          ctx.restore();

          var ellF = covEllipse2x2(c.pf.p00, c.pf.p01, c.pf.p11);
          drawEllipseMath(ctx, pEnd.x, pEnd.y, ellF, 2.3, scale, '#60a5fa', 'rgba(96, 165, 250, 0.16)', [5, 3]);

          var ellTot = covEllipse2x2(c.pTot.p00, c.pTot.p01, c.pTot.p11);
          drawEllipseMath(ctx, pEnd.x, pEnd.y, ellTot, 2.3, scale, '#ffd000', 'rgba(255, 208, 0, 0.12)', null);

          drawRobotMath(ctx, p0.x, p0.y, c.th, '#94a3b8', true, 1.3);
          drawRobotMath(ctx, pEnd.x, pEnd.y, c.th, '#ffd000', false, 1.38);

          drawPill(ctx, 'Δt = ' + c.dt.toFixed(2) + 's  |  tr(P̄) = ' + (c.pTot.p00 + c.pTot.p11 + c.pTot.pTh).toFixed(3), 12, h - 16, '#ffd000', null, 'left');
        }
      });
    },

    // ------------------------------------------------------------------
    // ROW 4: (4. Measurement & Jacobian)
    // ------------------------------------------------------------------
    'ekf-meas': function (container, lang) {
      var TAG_X = 1.15;
      var TAG_Y = 0.70;
      var START_X = -1.05;
      var START_Y = -0.65;

      function effPose(s, tFrac) {
        var startTh = s.thetaDeg - 44;
        return {
          x: lerp(START_X, s.x, tFrac),
          y: lerp(START_Y, s.y, tFrac),
          thetaDeg: lerp(startTh, s.thetaDeg, tFrac)
        };
      }

      function computeMeas(pose) {
        var dx = TAG_X - pose.x;
        var dy = TAG_Y - pose.y;
        var r = Math.max(0.28, Math.hypot(dx, dy));
        var r2 = r * r;
        var th = degToRad(pose.thetaDeg);
        var absAng = Math.atan2(dy, dx);
        var phi = wrapRad(absAng - th);
        return {
          dx: dx, dy: dy, r: r, r2: r2, th: th, absAng: absAng, phi: phi,
          h00: -dx / r, h01: -dy / r,
          h10: dy / r2, h11: -dx / r2
        };
      }

      return mountCanvasSim(container, lang, {
        defaults: { x: 0.25, y: 0.15, thetaDeg: 28 },
        defaultPresetIdx: 0,
        guide: {
          it: '<strong>Cosa osservare:</strong> <span class="leg-blue">Δx</span> e <span class="leg-coral">Δy</span> misurano la distanza tra l’AprilTag fisso e il robot; avvicinandosi al tag, la freccia gialla dello Jacobiano (sensibilità angolare <code>∝ 1/r²</code>) cresce rapidamente.',
          en: '<strong>What to watch:</strong> <span class="leg-blue">Δx</span> and <span class="leg-coral">Δy</span> measure the offset from robot to AprilTag; as the robot gets closer, the gold bearing sensitivity arrow (<code>∝ 1/r²</code> in <code>H_t</code>) grows rapidly.'
        },
        legend: {
          it: '<span class="leg-blue">■ Δx = x_tag - x</span><span class="leg-coral">■ Δy = y_tag - y, φ</span><span class="leg-gold">■ Raggio r &amp; Gradiente ∂φ/∂q (∝1/r)</span>',
          en: '<span class="leg-blue">■ Δx = x_tag - x</span><span class="leg-coral">■ Δy = y_tag - y, φ</span><span class="leg-gold">■ Range r &amp; Bearing Grad ∂φ/∂q (∝1/r)</span>'
        },
        presets: {
          it: [
            { label: 'Avvicinamento Medio', vals: { x: 0.25, y: 0.15, thetaDeg: 28 } },
            { label: 'Tag Vicinissimo (1/r² esplode!)', vals: { x: 0.76, y: 0.44, thetaDeg: 32 } },
            { label: 'Tag Frontale (φ = 0°)', vals: { x: -0.30, y: -0.20, thetaDeg: 32 } }
          ],
          en: [
            { label: 'Smooth Approach', vals: { x: 0.25, y: 0.15, thetaDeg: 28 } },
            { label: 'Very Close (1/r² Spike!)', vals: { x: 0.76, y: 0.44, thetaDeg: 32 } },
            { label: 'Dead Ahead (φ = 0°)', vals: { x: -0.30, y: -0.20, thetaDeg: 32 } }
          ]
        },
        sliders: [
          { key: 'x', min: -1.3, max: 0.85, step: 0.05, labelIt: 'Robot x', labelEn: 'Robot x', fmt: function (v) { return signedFixed(v, 2) + ' m'; } },
          { key: 'y', min: -1.0, max: 0.85, step: 0.05, labelIt: 'Robot y', labelEn: 'Robot y', fmt: function (v) { return signedFixed(v, 2) + ' m'; } },
          { key: 'thetaDeg', min: -180, max: 180, step: 1, labelIt: 'Orientamento θ', labelEn: 'Heading θ', fmt: function (v) { return signedFixed(v, 0) + '°'; } }
        ],
        renderEq: function (s, tFrac) {
          var m = computeMeas(effPose(s, tFrac));
          return (
            '\\begin{aligned}' +
            '\\Delta &= \\begin{bmatrix}{\\color{#60a5fa}' + signedFixed(m.dx, 2) + '} \\\\ {\\color{#e07a5f}' + signedFixed(m.dy, 2) + '}\\end{bmatrix},\\quad ' +
            'h = \\begin{bmatrix}{\\color{#ffd000}' + m.r.toFixed(2) + '\\text{m}} \\\\ {\\color{#e07a5f}' + signedFixed(radToDeg(m.phi), 0) + '^\\circ}\\end{bmatrix} \\\\[6pt]' +
            'H_t &= \\begin{bmatrix}' + signedFixed(m.h00, 2) + ' & ' + signedFixed(m.h01, 2) + ' & 0 \\\\ {\\color{#ffd000}' + signedFixed(m.h10, 2) + '} & {\\color{#ffd000}' + signedFixed(m.h11, 2) + '} & {\\color{#e07a5f}-1}\\end{bmatrix}' +
            '\\end{aligned}'
          );
        },
        draw: function (ctx, w, h, s, tFrac, isIt) {
          var pose = effPose(s, tFrac);
          var m = computeMeas(pose);

          var focusX = 0.05;
          var focusY = 0.05;
          var worldHalf = 1.72;
          var scale = (Math.min(w, h) - 62) / (worldHalf * 2);
          var ox = Math.round(w * 0.50 - focusX * scale);
          var oy = Math.round(h * 0.52 + focusY * scale);
          function toPx(wx, wy) { return { x: ox + wx * scale, y: oy - wy * scale }; }

          drawWorldGrid(ctx, w, h, ox, oy, scale, 0.5);

          var pRob = toPx(pose.x, pose.y);
          var pCorner = toPx(TAG_X, pose.y);
          var pTag = toPx(TAG_X, TAG_Y);

          ctx.save();
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 2.4;
          ctx.setLineDash([5, 3]);
          ctx.beginPath();
          ctx.moveTo(pRob.x, pRob.y);
          ctx.lineTo(pCorner.x, pCorner.y);
          ctx.stroke();

          ctx.strokeStyle = '#e07a5f';
          ctx.beginPath();
          ctx.moveTo(pCorner.x, pCorner.y);
          ctx.lineTo(pTag.x, pTag.y);
          ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.strokeStyle = '#ffd000';
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.moveTo(pRob.x, pRob.y);
          ctx.lineTo(pTag.x, pTag.y);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(224, 122, 95, 0.92)';
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.arc(pRob.x, pRob.y, 34, -m.th, -m.absAng, m.phi > 0);
          ctx.stroke();
          ctx.restore();

          var pGradR = toPx(pose.x + m.h00 * 0.55, pose.y + m.h01 * 0.55);
          var pGradPhi = toPx(pose.x + clamp(m.h10 * 0.45, -1.1, 1.1), pose.y + clamp(m.h11 * 0.45, -1.1, 1.1));
          drawArrow(ctx, pRob.x, pRob.y, pGradR.x, pGradR.y, '#60a5fa', 2.0);
          drawArrow(ctx, pRob.x, pRob.y, pGradPhi.x, pGradPhi.y, '#ffd000', 2.6);

          drawAprilTag(ctx, pTag.x, pTag.y, 'Tag (' + TAG_X.toFixed(1) + ',' + TAG_Y.toFixed(1) + ')');
          drawRobotMath(ctx, pRob.x, pRob.y, m.th, '#ffd000', false, 1.38);

          drawPill(ctx, 'Δx=' + signedFixed(m.dx, 2), (pRob.x + pCorner.x) * 0.5, pRob.y + 18, '#60a5fa');
          drawPill(ctx, 'Δy=' + signedFixed(m.dy, 2), pCorner.x + 42, (pCorner.y + pTag.y) * 0.5, '#e07a5f');
          drawPill(ctx, 'r=' + m.r.toFixed(2) + 'm  φ=' + signedFixed(radToDeg(m.phi), 0) + '°', (pRob.x + pTag.x) * 0.5 - 38, (pRob.y + pTag.y) * 0.5 - 26, '#ffd000');
          drawPill(ctx, (isIt ? 'Sensibilità bearing 1/r² = ' : 'Bearing sensitivity 1/r² = ') + (1 / m.r2).toFixed(2), 12, h - 16, '#ffd000', null, 'left');
        }
      });
    },

    // ------------------------------------------------------------------
    // ROW 5: (5. EKF Update)
    // ------------------------------------------------------------------
    'ekf-upd': function (container, lang) {
      var TAG_X = 1.45;
      var TAG_Y = 0.0;

      function solveUpdate(s) {
        var xBar = -0.35;
        var yBar = 0.0;
        var thBar = degToRad(14);
        var sigP = s.sigPrior;
        var pDiag = sigP * sigP;
        var Pbar = [
          [pDiag, 0, 0],
          [0, pDiag * 0.72, 0],
          [0, 0, Math.pow(0.32, 2)]
        ];

        var dx = TAG_X - xBar;
        var dy = TAG_Y - yBar;
        var rPred = Math.hypot(dx, dy);
        var phiPred = wrapRad(Math.atan2(dy, dx) - thBar);
        var H = [
          [-dx / rPred, -dy / rPred, 0],
          [dy / (rPred * rPred), -dx / (rPred * rPred), -1]
        ];

        var R = [
          [s.sigSens * s.sigSens, 0],
          [0, Math.pow(s.sigSens * 0.45, 2)]
        ];

        var PHt = [[0, 0], [0, 0], [0, 0]];
        for (var i = 0; i < 3; i++) {
          for (var j = 0; j < 2; j++) {
            PHt[i][j] = Pbar[i][0] * H[j][0] + Pbar[i][1] * H[j][1] + Pbar[i][2] * H[j][2];
          }
        }
        var S = [
          [H[0][0] * PHt[0][0] + H[0][1] * PHt[1][0] + H[0][2] * PHt[2][0] + R[0][0], H[0][0] * PHt[0][1] + H[0][1] * PHt[1][1] + H[0][2] * PHt[2][1]],
          [H[1][0] * PHt[0][0] + H[1][1] * PHt[1][0] + H[1][2] * PHt[2][0], H[1][0] * PHt[0][1] + H[1][1] * PHt[1][1] + H[1][2] * PHt[2][1] + R[1][1]]
        ];
        var det = S[0][0] * S[1][1] - S[0][1] * S[1][0];
        var inv = 1 / (Math.abs(det) < 1e-9 ? 1e-9 : det);
        var Sinv = [[S[1][1] * inv, -S[0][1] * inv], [-S[1][0] * inv, S[0][0] * inv]];

        var K = [
          [PHt[0][0] * Sinv[0][0] + PHt[0][1] * Sinv[1][0], PHt[0][0] * Sinv[0][1] + PHt[0][1] * Sinv[1][1]],
          [PHt[1][0] * Sinv[0][0] + PHt[1][1] * Sinv[1][0], PHt[1][0] * Sinv[0][1] + PHt[1][1] * Sinv[1][1]],
          [PHt[2][0] * Sinv[0][0] + PHt[2][1] * Sinv[1][0], PHt[2][0] * Sinv[0][1] + PHt[2][1] * Sinv[1][1]]
        ];

        var yR = s.dR;
        var yPhi = wrapRad(degToRad(s.dPhiDeg));
        var xPost = xBar + K[0][0] * yR + K[0][1] * yPhi;
        var yPost = yBar + K[1][0] * yR + K[1][1] * yPhi;
        var thPost = wrapRad(thBar + K[2][0] * yR + K[2][1] * yPhi);

        var rMeas = Math.max(0.35, rPred + yR);
        var absAngMeas = wrapRad(thBar + phiPred + yPhi);
        var xMeas = TAG_X - rMeas * Math.cos(absAngMeas);
        var yMeas = TAG_Y - rMeas * Math.sin(absAngMeas);

        var Ppost = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        for (var rIdx = 0; rIdx < 3; rIdx++) {
          for (var cIdx = 0; cIdx < 3; cIdx++) {
            var acc = 0;
            for (var kIdx = 0; kIdx < 3; kIdx++) {
              var iKh = (rIdx === kIdx ? 1 : 0) - (K[rIdx][0] * H[0][kIdx] + K[rIdx][1] * H[1][kIdx]);
              acc += iKh * Pbar[kIdx][cIdx];
            }
            Ppost[rIdx][cIdx] = acc;
          }
        }
        Ppost[0][1] = Ppost[1][0] = 0.5 * (Ppost[0][1] + Ppost[1][0]);

        return {
          xBar: xBar, yBar: yBar, thBar: thBar,
          xMeas: xMeas, yMeas: yMeas,
          xPost: xPost, yPost: yPost, thPost: thPost,
          Pbar: Pbar, R: R, Ppost: Ppost, K: K, kxEff: Math.abs(K[0][0]),
          trBar: Pbar[0][0] + Pbar[1][1] + Pbar[2][2],
          trPost: Ppost[0][0] + Ppost[1][1] + Ppost[2][2]
        };
      }

      return mountCanvasSim(container, lang, {
        defaults: { sigPrior: 0.55, sigSens: 0.25, dR: -0.45, dPhiDeg: 22 },
        defaultPresetIdx: 2,
        guide: {
          it: '<strong>Cosa osservare:</strong> il guadagno <code>K_x</code> decide quanto spostare il robot verso la misura <span class="leg-coral">z_tag</span>; l’ellisse finale <span class="leg-gold">P_t</span> diventa sempre più stretta sia del modello (<span class="leg-blue">P̄_t</span>) che del sensore (<span class="leg-coral">R</span>).',
          en: '<strong>What to watch:</strong> gain <code>K_x</code> arbitrates how far the estimate jumps toward <span class="leg-coral">z_tag</span>; the fused <span class="leg-gold">P_t</span> ellipse always shrinks smaller than both prior (<span class="leg-blue">P̄_t</span>) and sensor (<span class="leg-coral">R</span>).'
        },
        legend: {
          it: '<span class="leg-blue">■ Prior q̄ₜ, P̄ₜ</span><span class="leg-coral">■ Sensore zₜ, R</span><span class="leg-gold">■ Posteriore qₜ, Pₜ (Contratto)</span>',
          en: '<span class="leg-blue">■ Prior q̄ₜ, P̄ₜ</span><span class="leg-coral">■ Sensor zₜ, R</span><span class="leg-gold">■ Posterior qₜ, Pₜ (Contracted)</span>'
        },
        presets: {
          it: [
            { label: 'Fiducia al Sensore (K alto)', vals: { sigPrior: 0.72, sigSens: 0.12, dR: -0.50, dPhiDeg: 24 } },
            { label: 'Camera Rumorosa (K basso)', vals: { sigPrior: 0.22, sigSens: 0.68, dR: -0.50, dPhiDeg: 24 } },
            { label: 'Fusione Bilanciata', vals: { sigPrior: 0.55, sigSens: 0.25, dR: -0.45, dPhiDeg: 22 } }
          ],
          en: [
            { label: 'Trust Vision (High K)', vals: { sigPrior: 0.72, sigSens: 0.12, dR: -0.50, dPhiDeg: 24 } },
            { label: 'Noisy Camera (Low K)', vals: { sigPrior: 0.22, sigSens: 0.68, dR: -0.50, dPhiDeg: 24 } },
            { label: 'Balanced Fusion', vals: { sigPrior: 0.55, sigSens: 0.25, dR: -0.45, dPhiDeg: 22 } }
          ]
        },
        sliders: [
          { key: 'sigPrior', min: 0.15, max: 0.85, step: 0.05, labelIt: 'Incertezza modello σ_P̄', labelEn: 'Prior std σ_P̄', fmt: function (v) { return v.toFixed(2) + ' m'; } },
          { key: 'sigSens', min: 0.06, max: 0.75, step: 0.02, labelIt: 'Rumore AprilTag σ_R', labelEn: 'Tag noise σ_R', fmt: function (v) { return v.toFixed(2) + ' m'; } },
          { key: 'dR', min: -0.75, max: 0.75, step: 0.05, labelIt: 'Sorpresa distanza y_r', labelEn: 'Range innovation y_r', fmt: function (v) { return signedFixed(v, 2) + ' m'; } },
          { key: 'dPhiDeg', min: -55, max: 55, step: 1, labelIt: 'Sorpresa angolo y_φ', labelEn: 'Bearing innovation y_φ', fmt: function (v) { return signedFixed(v, 0) + '°'; } }
        ],
        renderEq: function (s, tFrac) {
          var u = solveUpdate(s);
          var curX = lerp(u.xBar, u.xPost, tFrac);
          var curY = lerp(u.yBar, u.yPost, tFrac);
          var curTh = wrapRad(u.thBar + wrapRad(u.thPost - u.thBar) * tFrac);
          var curTr = lerp(u.trBar, u.trPost, tFrac);
          return (
            '\\begin{aligned}' +
            '\\|K_x\\| &= {\\color{#ffd000}' + u.kxEff.toFixed(2) + '}, \\qquad \\operatorname{tr}: {\\color{#60a5fa}' + u.trBar.toFixed(2) + '} \\to {\\color{#ffd000}' + curTr.toFixed(2) + '} \\\\[6pt]' +
            'q(t) &= \\begin{bmatrix}' + signedFixed(curX, 2) + ' & ' + signedFixed(curY, 2) + ' & ' + signedFixed(radToDeg(curTh), 0) + '^\\circ\\end{bmatrix}^\\top' +
            '\\end{aligned}'
          );
        },
        draw: function (ctx, w, h, s, tFrac, isIt) {
          var focusX = 0.35;
          var focusY = 0.0;
          var worldHalf = 1.68;
          var scale = (Math.min(w, h) - 62) / (worldHalf * 2);
          var ox = Math.round(w * 0.48 - focusX * scale);
          var oy = Math.round(h * 0.54 + focusY * scale);
          function toPx(wx, wy) { return { x: ox + wx * scale, y: oy - wy * scale }; }

          drawWorldGrid(ctx, w, h, ox, oy, scale, 0.5);

          var u = solveUpdate(s);
          var pBar = toPx(u.xBar, u.yBar);
          var pMeas = toPx(u.xMeas, u.yMeas);
          var pTag = toPx(TAG_X, TAG_Y);

          var ellR = { rx: s.sigSens, ry: s.sigSens * 0.65, angle: 0 };
          drawEllipseMath(ctx, pMeas.x, pMeas.y, ellR, 2.0, scale, 'rgba(224, 122, 95, 0.8)', 'rgba(224, 122, 95, 0.12)', [4, 3]);

          var ellBar = covEllipse2x2(u.Pbar[0][0], 0, u.Pbar[1][1]);
          drawEllipseMath(ctx, pBar.x, pBar.y, ellBar, 2.0, scale, '#60a5fa', 'rgba(96, 165, 250, 0.12)', [5, 3]);

          var curX = lerp(u.xBar, u.xPost, tFrac);
          var curY = lerp(u.yBar, u.yPost, tFrac);
          var curTh = wrapRad(u.thBar + wrapRad(u.thPost - u.thBar) * tFrac);
          var curPx = toPx(curX, curY);
          var curEll = covEllipse2x2(
            lerp(u.Pbar[0][0], u.Ppost[0][0], tFrac),
            lerp(0, u.Ppost[0][1], tFrac),
            lerp(u.Pbar[1][1], u.Ppost[1][1], tFrac)
          );
          drawEllipseMath(ctx, curPx.x, curPx.y, curEll, 2.0, scale, '#ffd000', 'rgba(255, 208, 0, 0.16)', null);

          ctx.save();
          ctx.strokeStyle = 'rgba(224, 122, 95, 0.45)';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(curPx.x, curPx.y);
          ctx.lineTo(pTag.x, pTag.y);
          ctx.stroke();
          ctx.restore();

          drawArrow(ctx, pBar.x, pBar.y, curPx.x, curPx.y, '#ffd000', 2.4);

          drawAprilTag(ctx, pTag.x, pTag.y, 'Tag #37');
          drawRobotMath(ctx, pBar.x, pBar.y, u.thBar, '#60a5fa', true, 1.3);
          drawRobotMath(ctx, curPx.x, curPx.y, curTh, '#ffd000', false, 1.38);

          drawPill(ctx, 'z_tag', pMeas.x, pMeas.y - 18, '#e07a5f');
          drawPill(ctx, 'q̄', pBar.x, pBar.y + 20, '#60a5fa');
          drawPill(ctx, (isIt ? 'Guadagno Kₓ = ' : 'Gain Kₓ = ') + u.kxEff.toFixed(2) + '  |  σ_post < σ_prior, σ_R', 12, h - 16, '#ffd000', null, 'left');
        }
      });
    }
  };

  function gaussian(x, mu, sigma) {
    var s = Math.max(sigma, 1e-4);
    var z = (x - mu) / s;
    return Math.exp(-0.5 * z * z) / (s * Math.sqrt(2 * Math.PI));
  }

  window.FormulaSims = {
    has: function (key) {
      return !!(key && SIM_REGISTRY[key]);
    },
    register: function (map) {
      if (!map) return;
      Object.keys(map).forEach(function (k) {
        SIM_REGISTRY[k] = map[k];
      });
    },
    mount: function (key, container, lang) {
      if (activeController) {
        activeController();
        activeController = null;
      }
      if (!key || !SIM_REGISTRY[key] || !container) return;
      activeController = SIM_REGISTRY[key](container, lang || 'en');
    },
    unmount: function () {
      if (activeController) {
        activeController();
        activeController = null;
      }
    },
    helpers: {
      clamp: clamp,
      lerp: lerp,
      wrapRad: wrapRad,
      degToRad: degToRad,
      radToDeg: radToDeg,
      signedFixed: signedFixed,
      gaussian: gaussian,
      covEllipse2x2: covEllipse2x2,
      drawRobotMath: drawRobotMath,
      drawArrow: drawArrow,
      drawEllipseMath: drawEllipseMath,
      drawPill: drawPill,
      drawWorldGrid: drawWorldGrid,
      mountCanvasSim: mountCanvasSim
    }
  };
})();
