/* Shared Deterministic 6-Scene Cinema Engine for Labs 01-04 (KaTeX + Canvas2D + SVG Beams) */
(function () {
  'use strict';

  function clamp(v, lo, hi) {
    if (lo === undefined) lo = 0;
    if (hi === undefined) hi = 1;
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * clamp(t, 0, 1);
  }

  function invLerp(a, b, v) {
    if (b === a) return 0;
    return clamp((v - a) / (b - a), 0, 1);
  }

  function easeOutCubic(t) {
    var x = clamp(t, 0, 1);
    return 1 - Math.pow(1 - x, 3);
  }

  function easeInOutCubic(t) {
    var x = clamp(t, 0, 1);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function fmtTime(sec, total) {
    var s = Math.max(0, Math.min(total || 60, Math.floor(sec)));
    var mm = String(Math.floor(s / 60));
    var ss = String(s % 60);
    return (mm.length < 2 ? '0' + mm : mm) + ':' + (ss.length < 2 ? '0' + ss : ss);
  }

  function signed(v, dec) {
    var d = dec !== undefined ? dec : 2;
    return (v >= 0 ? '+' : '') + v.toFixed(d);
  }

  function renderKatex(el, tex, displayMode) {
    if (!el) return;
    if (typeof window !== 'undefined' && window.katex && typeof window.katex.render === 'function') {
      try {
        window.katex.render(tex, el, {
          displayMode: !!displayMode,
          throwOnError: false,
          strict: 'ignore'
        });
        return;
      } catch (e) {
        // fallback below
      }
    }
    el.textContent = tex;
  }

  function renderInlineMath(el, html) {
    if (!el) return;
    el.innerHTML = html;
    if (typeof window !== 'undefined' && typeof window.renderMathInElement === 'function') {
      try {
        window.renderMathInElement(el, {
          delimiters: [
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          throwOnError: false
        });
      } catch (e) {
        // keep clean HTML
      }
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawArrowHead(ctx, x, y, angleRad, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angleRad);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, -size * 0.55);
    ctx.lineTo(-size, size * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawArrow(ctx, x1, y1, x2, y2, color, width, dashed) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 2.4;
    ctx.lineCap = 'round';
    if (dashed && ctx.setLineDash) ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([]);
    drawArrowHead(ctx, x2, y2, Math.atan2(y2 - y1, x2 - x1), 8, color);
    ctx.restore();
  }

  // Draws a mathematically centered vector hat above `ch` (avoids broken Unicode combining circumflex)
  function drawHatLabel(ctx, ch, rest, x, y, color, align) {
    ctx.save();
    ctx.font = '700 11.5px "JetBrains Mono", monospace';
    ctx.fillStyle = color || '#f4f4f6';
    var chW = ctx.measureText ? ctx.measureText(ch).width : 7;
    var restW = rest && ctx.measureText ? ctx.measureText(rest).width : 0;
    var totalW = chW + restW;
    var startX = x;
    if (align === 'right') startX = x - totalW;
    else if (align === 'center') startX = x - totalW * 0.5;

    ctx.textAlign = 'left';
    ctx.fillText(ch, startX, y);
    if (rest) ctx.fillText(rest, startX + chW, y);

    // Draw crisp centered circumflex hat over `ch`
    var hx = startX + chW * 0.5;
    var hy = y - 11.5;
    ctx.strokeStyle = color || '#f4f4f6';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(hx - 3.2, hy + 2.4);
    ctx.lineTo(hx, hy - 0.8);
    ctx.lineTo(hx + 3.2, hy + 2.4);
    ctx.stroke();
    ctx.restore();
  }

  // Draws clean base + subscript + trailing text on Canvas 2D
  function drawSubLabel(ctx, base, sub, rest, x, y, color, align) {
    ctx.save();
    ctx.fillStyle = color || '#f4f4f6';
    ctx.font = '700 11.5px "JetBrains Mono", monospace';
    var baseW = ctx.measureText ? ctx.measureText(base).width : base.length * 7;
    ctx.font = '700 8.5px "JetBrains Mono", monospace';
    var subW = ctx.measureText ? ctx.measureText(sub).width : sub.length * 5.2;
    ctx.font = '700 11.5px "JetBrains Mono", monospace';
    var restW = rest && ctx.measureText ? ctx.measureText(rest).width : (rest ? rest.length * 7 : 0);
    var totalW = baseW + subW + restW;
    var startX = x;
    if (align === 'right') startX = x - totalW;
    else if (align === 'center') startX = x - totalW * 0.5;

    ctx.textAlign = 'left';
    ctx.font = '700 11.5px "JetBrains Mono", monospace';
    ctx.fillText(base, startX, y);
    ctx.font = '700 8.5px "JetBrains Mono", monospace';
    ctx.fillText(sub, startX + baseW + 0.5, y + 3);
    if (rest) {
      ctx.font = '700 11.5px "JetBrains Mono", monospace';
      ctx.fillText(rest, startX + baseW + subW + 1, y);
    }
    ctx.restore();
  }

  function drawGridBg(ctx, w, h, step) {
    var st = step || 36;
    ctx.fillStyle = '#08080a';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    for (var x = 0; x < w; x += st) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (var y = 0; y < h; y += st) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.restore();
  }

  function quadBezierPoint(p0, pc, p1, t) {
    var u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * pc.x + t * t * p1.x,
      y: u * u * p0.y + 2 * u * t * pc.y + t * t * p1.y
    };
  }

  function buildFlightSVG(fromPt, toPt, progress, label, color, curveBias) {
    if (!fromPt || !toPt || progress <= 0 || progress >= 1) return '';
    var p = easeInOutCubic(progress);
    var ctrl = { x: (fromPt.x + toPt.x) * 0.5, y: (fromPt.y + toPt.y) * 0.5 + (curveBias || -38) };
    var cur = quadBezierPoint(fromPt, ctrl, toPt, p);
    var alpha = Math.min(1, progress * 5) * Math.min(1, (1 - progress) * 5);
    var pillW = Math.max(42, label.length * 7.4 + 14);
    return (
      '<g opacity="' + alpha.toFixed(2) + '">' +
      '<path d="M ' + fromPt.x.toFixed(1) + ' ' + fromPt.y.toFixed(1) + ' Q ' + ctrl.x.toFixed(1) + ' ' + ctrl.y.toFixed(1) + ' ' + toPt.x.toFixed(1) + ' ' + toPt.y.toFixed(1) + '" fill="none" stroke="' + color + '" stroke-width="1.6" stroke-dasharray="5 5" opacity="0.5" />' +
      '<rect x="' + (cur.x - pillW * 0.5).toFixed(1) + '" y="' + (cur.y - 10).toFixed(1) + '" width="' + pillW + '" height="20" rx="10" fill="#0c0c10" stroke="' + color + '" stroke-width="1.6" />' +
      '<text x="' + cur.x.toFixed(1) + '" y="' + (cur.y + 3.6).toFixed(1) + '" text-anchor="middle" fill="' + color + '" font-family="JetBrains Mono, monospace" font-size="10.5" font-weight="700">' + label + '</text>' +
      '</g>'
    );
  }

  function buildLaserBeamSVG(fromPt, toPt, progress, color, curveBias) {
    if (!fromPt || !toPt || progress <= 0) return '';
    var p = easeOutCubic(progress);
    var ctrl = { x: (fromPt.x + toPt.x) * 0.5, y: (fromPt.y + toPt.y) * 0.5 + (curveBias || -18) };
    var tip = quadBezierPoint(fromPt, ctrl, toPt, p);
    return (
      '<g>' +
      '<path d="M ' + fromPt.x.toFixed(1) + ' ' + fromPt.y.toFixed(1) + ' Q ' + ctrl.x.toFixed(1) + ' ' + ctrl.y.toFixed(1) + ' ' + tip.x.toFixed(1) + ' ' + tip.y.toFixed(1) + '" fill="none" stroke="' + color + '" stroke-width="2.4" stroke-linecap="round" opacity="0.8" />' +
      '<circle cx="' + tip.x.toFixed(1) + '" cy="' + tip.y.toFixed(1) + '" r="4.5" fill="' + color + '" />' +
      '</g>'
    );
  }

  function renderMatrixHTML(cfg) {
    var matrix = cfg.matrix;
    var rows = matrix.length;
    var cols = matrix[0].length;
    var decimals = cfg.decimals !== undefined ? cfg.decimals : 2;
    var tint = cfg.tint || 'gold';
    var absScale = !!cfg.absScale;
    var maxV = 0.001;
    var r, c;
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) {
        var av = absScale ? Math.abs(matrix[r][c]) : matrix[r][c];
        if (av > maxV) maxV = av;
      }
    }

    function bg(val, isWin) {
      var av = absScale ? Math.abs(val) : val;
      if (av <= 0.0001) return 'rgba(255,255,255,0.02)';
      var ratio = clamp(av / maxV, 0, 1);
      var a = (0.07 + ratio * 0.42).toFixed(2);
      if (isWin || tint === 'emerald') return 'rgba(52, 211, 153, ' + a + ')';
      if (tint === 'cyan') return 'rgba(96, 165, 250, ' + a + ')';
      if (tint === 'coral') return 'rgba(224, 122, 95, ' + a + ')';
      return 'rgba(255, 208, 0, ' + a + ')';
    }

    var html = '<div class="cn-mat-block">';
    if (cfg.title) {
      html += '<div class="cn-mat-head"><span class="cn-mat-title">' + cfg.title + '</span>' +
        (cfg.subtitle ? '<span class="cn-mat-sub">' + cfg.subtitle + '</span>' : '') + '</div>';
    }
    html += '<div class="cn-mat-wrap">';
    if (cfg.blurWave !== undefined && cfg.blurWave >= 0 && cfg.blurWave <= 1) {
      html += '<div class="cn-blur-wave" style="left:' + (cfg.blurWave * 112 - 12).toFixed(1) + '%;"></div>';
    }
    html += '<table class="cn-mat-table"><thead><tr><th>' + (cfg.corner || '') + '</th>';
    for (c = 0; c < cols; c++) {
      var colLbl = cfg.colLabels ? cfg.colLabels[c] : String(c);
      html += '<th class="' + (cfg.hiCol === c ? 'hi' : '') + '">' + colLbl + '</th>';
    }
    html += '</tr></thead><tbody>';
    for (r = 0; r < rows; r++) {
      var rowLbl = cfg.rowLabels ? cfg.rowLabels[r] : String(r);
      html += '<tr><td class="row-hdr ' + (cfg.hiRow === r ? 'hi' : '') + '">' + rowLbl + '</td>';
      for (c = 0; c < cols; c++) {
        var val = matrix[r][c];
        var lin = r * cols + c;
        var vis = cfg.reveal === undefined || lin < cfg.reveal;
        var isWin = cfg.winCell && cfg.winCell.r === r && cfg.winCell.c === c;
        var isAct = cfg.activeCell && cfg.activeCell.r === r && cfg.activeCell.c === c;
        var isCross = cfg.crossed && cfg.crossed.indexOf(r + '-' + c) !== -1;
        var isRet = cfg.reticle && cfg.reticle.r === r && cfg.reticle.c === c;
        var cls = 'cn-m-cell' + (cfg.compact ? ' compact' : '');
        if (isAct || (cfg.hiCol === c && cfg.hiRow === r)) cls += ' active';
        else if (isWin) cls += ' win';
        else if (cfg.hiCol === c) cls += ' hi-col';
        else if (cfg.hiRow === r) cls += ' hi-row';
        if (isCross) cls += ' crossed';
        var shiftStyle = cfg.shiftPx ? 'transform:translateX(' + cfg.shiftPx.toFixed(1) + 'px);' : '';
        var sub = cfg.subFn ? cfg.subFn(r, c, val) : '';
        var txt = cfg.signedVals ? signed(val, decimals) : val.toFixed(decimals);
        var valCls = 'cn-m-val' + (Math.abs(val) <= 0.0001 ? ' zero' : isWin ? ' win' : '');
        html += '<td class="' + cls + '" data-anchor="cell-' + cfg.id + '-' + r + '-' + c + '" data-tip-r="' + r + '" data-tip-c="' + c + '" data-tip-val="' + txt + '" data-tip-id="' + (cfg.plainTitle || cfg.id) + '" style="background:' + (vis ? bg(val, isWin) : 'rgba(255,255,255,0.015)') + ';' + shiftStyle + '">';
        if (isRet) html += '<div class="cn-reticle"></div>';
        html += '<div class="' + valCls + '" style="' + (vis ? '' : 'opacity:0;') + '">' + (vis ? txt : '0.00') + '</div>';
        if (sub) html += '<div class="cn-m-sub">' + sub + '</div>';
        html += '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table></div></div>';
    return html;
  }

  function mount(config) {
    var root = document.getElementById(config.id);
    if (!root) return null;

    var totalDuration = config.duration || 60.0;
    var scenes = config.scenes || [];
    var mountEl = root.querySelector('[data-cn-mount]');
    var headRight = root.querySelector('[data-cn-head-right]');

    if (headRight && typeof headRight.innerHTML === 'string') {
      headRight.innerHTML =
        '<span class="cn-scene-badge" data-cn-scene-badge>SCENE 0</span>' +
        '<div class="cn-metric-box">' +
        '<span class="cn-metric-lbl" data-cn-metric-lbl></span>' +
        '<div class="cn-metric-track"><div class="cn-metric-bar" data-cn-metric-bar style="width:40%;"></div></div>' +
        '<span class="cn-metric-val" data-cn-metric-val></span>' +
        '</div>';
    }

    if (mountEl && typeof mountEl.innerHTML === 'string') {
      mountEl.innerHTML =
        '<div class="cn-stage" data-cn-stage>' +
        '  <svg class="cn-beam-overlay" data-cn-beams></svg>' +
        '  <div class="cn-canvas-pane">' +
        '    <div class="cn-pane-bar">' +
        '      <span class="cn-mode-pill" data-cn-mode-pill></span>' +
        '      <span class="cn-coords-pill" data-cn-coords-pill></span>' +
        '    </div>' +
        '    <div class="cn-canvas-wrap" data-cn-canvas-wrap>' +
        '      <canvas data-cn-canvas></canvas>' +
        '      <div class="cn-pause-hint" data-cn-pause-hint></div>' +
        '    </div>' +
        '  </div>' +
        '  <div class="cn-math-pane">' +
        '    <div class="cn-pane-bar">' +
        '      <span class="cn-math-title" data-cn-math-title></span>' +
        '      <span class="cn-phase-tag" data-cn-phase-tag></span>' +
        '    </div>' +
        '    <div class="cn-formula-stage" data-cn-formula></div>' +
        '    <div class="cn-data-stage" data-cn-data></div>' +
        '  </div>' +
        '</div>' +
        '<div class="cn-subtitle-bar">' +
        '  <span class="cn-sub-dot" data-cn-sub-dot></span>' +
        '  <p class="cn-sub-text" data-cn-subtitle></p>' +
        '</div>' +
        '<div class="cn-player-bar">' +
        '  <div class="cn-chapters" data-cn-chapters></div>' +
        '  <div class="cn-scrubber" data-cn-scrubber>' +
        '    <div class="cn-scrubber-markers" data-cn-markers></div>' +
        '    <div class="cn-scrubber-fill" data-cn-fill style="width:0%;"></div>' +
        '    <div class="cn-scrubber-thumb" data-cn-thumb style="left:0%;"></div>' +
        '    <div class="cn-scrubber-tip hidden" data-cn-scrub-tip>00:00</div>' +
        '  </div>' +
        '  <div class="cn-controls-row">' +
        '    <div class="cn-ctrl-left">' +
        '      <button type="button" class="sim-btn primary" data-cn-play>&#9654; Play</button>' +
        '      <button type="button" class="sim-btn" data-cn-restart title="Restart">&#8634;</button>' +
        '      <button type="button" class="sim-btn" data-cn-prev title="Previous scene">&#8592;</button>' +
        '      <button type="button" class="sim-btn" data-cn-next title="Next scene">&#8594;</button>' +
        '      <span class="cn-time"><strong data-cn-time>00:00</strong> / ' + fmtTime(totalDuration, totalDuration) + '</span>' +
        '    </div>' +
        '    <div class="cn-ctrl-right">' +
        '      <label class="cn-autopause">' +
        '        <input type="checkbox" data-cn-autopause />' +
        '        <span data-cn-autopause-lbl>Auto-pause</span>' +
        '      </label>' +
        '      <div class="cn-speed-group" data-cn-speeds>' +
        '        <button type="button" class="cn-spd-btn" data-cn-spd="0.5">0.5x</button>' +
        '        <button type="button" class="cn-spd-btn active" data-cn-spd="1">1x</button>' +
        '        <button type="button" class="cn-spd-btn" data-cn-spd="1.5">1.5x</button>' +
        '        <button type="button" class="cn-spd-btn" data-cn-spd="2">2x</button>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        '</div>' +
        '<div class="cn-cell-tooltip hidden" data-cn-tooltip></div>';
    }

    var q = function (sel) { return root.querySelector(sel); };
    var el = {
      stage: q('[data-cn-stage]'),
      beams: q('[data-cn-beams]'),
      canvasWrap: q('[data-cn-canvas-wrap]'),
      canvas: q('[data-cn-canvas]'),
      pauseHint: q('[data-cn-pause-hint]'),
      sceneBadge: q('[data-cn-scene-badge]'),
      metricLbl: q('[data-cn-metric-lbl]'),
      metricBar: q('[data-cn-metric-bar]'),
      metricVal: q('[data-cn-metric-val]'),
      modePill: q('[data-cn-mode-pill]'),
      coordsPill: q('[data-cn-coords-pill]'),
      mathTitle: q('[data-cn-math-title]'),
      phaseTag: q('[data-cn-phase-tag]'),
      formulaStage: q('[data-cn-formula]'),
      dataStage: q('[data-cn-data]'),
      subDot: q('[data-cn-sub-dot]'),
      subtitle: q('[data-cn-subtitle]'),
      chapters: q('[data-cn-chapters]'),
      scrubber: q('[data-cn-scrubber]'),
      markers: q('[data-cn-markers]'),
      fill: q('[data-cn-fill]'),
      thumb: q('[data-cn-thumb]'),
      scrubTip: q('[data-cn-scrub-tip]'),
      playBtn: q('[data-cn-play]'),
      restartBtn: q('[data-cn-restart]'),
      prevBtn: q('[data-cn-prev]'),
      nextBtn: q('[data-cn-next]'),
      timeCur: q('[data-cn-time]'),
      autoPause: q('[data-cn-autopause]'),
      autoPauseLbl: q('[data-cn-autopause-lbl]'),
      speeds: q('[data-cn-speeds]'),
      tooltip: q('[data-cn-tooltip]')
    };

    var st = {
      masterTime: 0.0,
      playing: false,
      speed: 1.0,
      autoPause: false,
      lastTs: null,
      dragging: false,
      lastMathKey: '',
      lastSubKey: '',
      anchors: {},
      lang: (window.LocSims && window.LocSims.getLang && window.LocSims.getLang()) || 'en'
    };

    function getSceneAt(t) {
      for (var i = scenes.length - 1; i >= 0; i--) {
        if (t >= scenes[i].start) return scenes[i];
      }
      return scenes[0];
    }

    function getRect(node) {
      if (!node || typeof node.getBoundingClientRect !== 'function') {
        return { left: 0, top: 0, width: 520, height: 360 };
      }
      var r = node.getBoundingClientRect();
      return { left: r.left || 0, top: r.top || 0, width: r.width || 520, height: r.height || 360 };
    }

    function setAnchor(name, localX, localY) {
      var wrapR = getRect(el.canvasWrap);
      var stageR = getRect(el.stage);
      st.anchors[name] = {
        x: (wrapR.left - stageR.left) + localX,
        y: (wrapR.top - stageR.top) + localY
      };
    }

    function getAnchor(name) {
      if (st.anchors[name]) return st.anchors[name];
      if (!el.stage || typeof el.stage.querySelector !== 'function') return null;
      var node = el.stage.querySelector('[data-anchor="' + name + '"]');
      if (!node) return null;
      var nr = getRect(node);
      var sr = getRect(el.stage);
      return { x: (nr.left - sr.left) + nr.width * 0.5, y: (nr.top - sr.top) + nr.height * 0.5 };
    }

    var api = {
      el: el,
      setAnchor: setAnchor,
      getAnchor: getAnchor,
      setMode: function (text, tone) {
        if (!el.modePill) return;
        el.modePill.textContent = text;
        el.modePill.className = 'cn-mode-pill' + (tone ? ' ' + tone : '');
      },
      setCoords: function (text) {
        if (el.coordsPill) el.coordsPill.textContent = text;
      },
      renderFormula: function (kicker, texLines, footerHtml, kickerTone) {
        if (!el.formulaStage) return;
        var html = '<div class="cn-eq-kicker' + (kickerTone ? ' ' + kickerTone : '') + '">' + kicker + '</div>';
        for (var i = 0; i < texLines.length; i++) {
          var item = texLines[i];
          var op = item.opacity !== undefined ? item.opacity : 1;
          var anc = item.anchor ? ' data-anchor="' + item.anchor + '"' : '';
          html += '<div class="cn-katex-row" data-katex-slot="' + i + '"' + anc + ' style="opacity:' + op + ';"></div>';
        }
        if (footerHtml) {
          html += '<div class="cn-eq-footer" data-eq-footer>' + footerHtml + '</div>';
        }
        el.formulaStage.innerHTML = html;
        if (typeof el.formulaStage.querySelectorAll === 'function') {
          var slots = el.formulaStage.querySelectorAll('[data-katex-slot]');
          slots.forEach(function (slot, idx) {
            renderKatex(slot, texLines[idx].tex, false);
          });
          var foot = el.formulaStage.querySelector('[data-eq-footer]');
          if (foot) renderInlineMath(foot, footerHtml);
        }
      },
      setDataHTML: function (html) {
        if (!el.dataStage) return;
        el.dataStage.innerHTML = html;
      }
    };

    function syncStaticCopy() {
      var it = st.lang === 'it';
      if (el.mathTitle) {
        el.mathTitle.textContent = it ? (config.mathTitleIt || 'Equazioni & Stato') : (config.mathTitleEn || 'Equations & State');
      }
      if (el.autoPauseLbl) el.autoPauseLbl.textContent = it ? 'Pausa a fine scena' : 'Auto-pause';
      if (el.chapters && typeof el.chapters.querySelectorAll === 'function') {
        var btns = el.chapters.querySelectorAll('.cn-chap-btn');
        btns.forEach(function (b, idx) {
          b.textContent = it ? scenes[idx].shortIt : scenes[idx].shortEn;
        });
      }
      updatePlayUI();
    }

    function updatePlayUI() {
      var it = st.lang === 'it';
      if (el.playBtn) {
        if (st.playing) {
          el.playBtn.innerHTML = '&#9646;&#9646; ' + (it ? 'Pausa' : 'Pause');
        } else {
          var replay = st.masterTime >= totalDuration - 0.05;
          el.playBtn.innerHTML = '&#9654; ' + (replay ? (it ? 'Rivedi' : 'Replay') : (it ? 'Avvia' : 'Play'));
        }
      }
      if (el.pauseHint) {
        if (st.playing) {
          el.pauseHint.classList.add('hidden');
        } else {
          el.pauseHint.classList.remove('hidden');
          el.pauseHint.textContent = st.masterTime < 0.05
            ? (it ? 'Clicca Play o sul canvas per avviare' : 'Press Play or click canvas to start')
            : (it ? 'In pausa · passa il mouse sui valori a destra' : 'Paused · hover right-hand cells to inspect');
        }
      }
    }

    function updateChrome(t) {
      var sc = getSceneAt(t);
      var it = st.lang === 'it';
      if (el.sceneBadge) el.sceneBadge.textContent = (it ? 'SCENA ' : 'SCENE ') + sc.id;
      if (el.phaseTag) el.phaseTag.textContent = sc.tag;

      if (typeof config.getMetric === 'function') {
        var m = config.getMetric(t, st.lang);
        if (el.metricLbl) el.metricLbl.textContent = m.label || '';
        if (el.metricBar) {
          el.metricBar.style.width = clamp(m.pct, 0, 100).toFixed(1) + '%';
          el.metricBar.style.backgroundColor = m.color || '#ffd000';
        }
        if (el.metricVal) {
          el.metricVal.textContent = m.text || '';
          el.metricVal.style.color = m.color || '#ffd000';
        }
      }

      if (typeof config.getSubtitle === 'function') {
        var sub = config.getSubtitle(t, st.lang);
        var subKey = st.lang + '|' + sub.text;
        if (el.subtitle && subKey !== st.lastSubKey) {
          st.lastSubKey = subKey;
          renderInlineMath(el.subtitle, sub.text);
        }
        if (el.subDot) el.subDot.style.backgroundColor = sub.color || '#ffd000';
      }

      var pct = (t / totalDuration) * 100;
      if (el.fill) el.fill.style.width = pct.toFixed(2) + '%';
      if (el.thumb) el.thumb.style.left = pct.toFixed(2) + '%';
      if (el.timeCur) el.timeCur.textContent = fmtTime(t, totalDuration);

      if (el.chapters && typeof el.chapters.querySelectorAll === 'function') {
        var btns = el.chapters.querySelectorAll('.cn-chap-btn');
        btns.forEach(function (b, idx) {
          b.classList.toggle('active', idx === sc.id);
          b.classList.toggle('done', idx < sc.id);
        });
      }
    }

    function renderFrame(forceDom) {
      var t = st.masterTime;
      updateChrome(t);

      // Draw Canvas 2D
      if (el.canvas) {
        var rect = getRect(el.canvasWrap);
        var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
        var w = Math.max(260, Math.floor(rect.width));
        var h = Math.max(260, Math.floor(rect.height));
        if (el.canvas.width !== Math.floor(w * dpr) || el.canvas.height !== Math.floor(h * dpr)) {
          el.canvas.width = Math.floor(w * dpr);
          el.canvas.height = Math.floor(h * dpr);
        }
        var ctx = el.canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          drawGridBg(ctx, w, h);
          st.anchors = {};
          config.drawCanvas(ctx, w, h, t, st.lang, api);
        }
      }

      var rate = config.mathHz || 12;
      var mKey = st.lang + ':' + Math.floor(t * rate);
      if (forceDom || mKey !== st.lastMathKey) {
        st.lastMathKey = mKey;
        config.renderPanel(t, st.lang, api);
      }

      if (el.beams && typeof config.renderBeams === 'function') {
        el.beams.innerHTML = config.renderBeams(t, st.lang, api) || '';
      }
    }

    function setPlaying(flag) {
      st.playing = !!flag;
      if (st.playing && st.masterTime >= totalDuration - 0.05) {
        st.masterTime = 0.0;
      }
      st.lastTs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      updatePlayUI();
    }

    function jumpToScene(id) {
      var sc = scenes[clamp(id, 0, scenes.length - 1)];
      st.masterTime = sc.start + 0.02;
      renderFrame(true);
      updatePlayUI();
    }

    // Chapters & scrubber markers
    if (el.chapters && el.markers && typeof document.createElement === 'function') {
      el.chapters.innerHTML = '';
      el.markers.innerHTML = '';
      scenes.forEach(function (sc, idx) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cn-chap-btn';
        btn.style.width = (((sc.end - sc.start) / totalDuration) * 100).toFixed(2) + '%';
        btn.addEventListener('click', function () { jumpToScene(idx); });
        el.chapters.appendChild(btn);

        if (idx > 0) {
          var m = document.createElement('div');
          m.className = 'cn-scrub-mark';
          m.style.left = ((sc.start / totalDuration) * 100).toFixed(2) + '%';
          el.markers.appendChild(m);
        }
      });
    }

    if (el.playBtn) el.playBtn.addEventListener('click', function () { setPlaying(!st.playing); });
    if (el.canvas) el.canvas.addEventListener('click', function () { setPlaying(!st.playing); });
    if (el.restartBtn) el.restartBtn.addEventListener('click', function () { st.masterTime = 0.0; setPlaying(true); renderFrame(true); });
    if (el.prevBtn) {
      el.prevBtn.addEventListener('click', function () {
        var cur = getSceneAt(st.masterTime);
        jumpToScene(st.masterTime - cur.start > 1.2 ? cur.id : Math.max(0, cur.id - 1));
      });
    }
    if (el.nextBtn) {
      el.nextBtn.addEventListener('click', function () {
        var cur = getSceneAt(st.masterTime);
        jumpToScene(Math.min(scenes.length - 1, cur.id + 1));
      });
    }
    if (el.autoPause) {
      el.autoPause.addEventListener('change', function () { st.autoPause = !!el.autoPause.checked; });
    }
    if (el.speeds && typeof el.speeds.querySelectorAll === 'function') {
      var spdBtns = el.speeds.querySelectorAll('[data-cn-spd]');
      spdBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          st.speed = parseFloat(btn.getAttribute('data-cn-spd')) || 1.0;
          spdBtns.forEach(function (b) { b.classList.toggle('active', b === btn); });
        });
      });
    }

    function scrubFromX(clientX) {
      var r = getRect(el.scrubber);
      var ratio = clamp((clientX - r.left) / Math.max(1, r.width), 0, 1);
      st.masterTime = ratio * totalDuration;
      renderFrame(true);
      updatePlayUI();
    }
    if (el.scrubber) {
      el.scrubber.addEventListener('mousedown', function (e) { st.dragging = true; scrubFromX(e.clientX); });
      el.scrubber.addEventListener('mousemove', function (e) {
        var r = getRect(el.scrubber);
        var ratio = clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1);
        var th = ratio * totalDuration;
        var sc = getSceneAt(th);
        if (el.scrubTip) {
          el.scrubTip.textContent = fmtTime(th, totalDuration) + ' · ' + (st.lang === 'it' ? sc.shortIt : sc.shortEn);
          el.scrubTip.style.left = (ratio * 100).toFixed(1) + '%';
          el.scrubTip.classList.remove('hidden');
        }
      });
      el.scrubber.addEventListener('mouseleave', function () {
        if (el.scrubTip) el.scrubTip.classList.add('hidden');
      });
    }
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('mousemove', function (e) { if (st.dragging) scrubFromX(e.clientX); });
      window.addEventListener('mouseup', function () { st.dragging = false; });
      window.addEventListener('resize', function () { renderFrame(true); });
    }

    // Delegated hover tooltip on data stage (cells or particle rows)
    if (el.dataStage && el.tooltip && typeof config.formatTooltip === 'function') {
      el.dataStage.addEventListener('mousemove', function (e) {
        var cell = e.target && e.target.closest ? e.target.closest('[data-tip-id]') : null;
        if (!cell) {
          el.tooltip.classList.add('hidden');
          return;
        }
        var html = config.formatTooltip({
          id: cell.getAttribute('data-tip-id'),
          r: parseInt(cell.getAttribute('data-tip-r') || '0', 10),
          c: parseInt(cell.getAttribute('data-tip-c') || '0', 10),
          val: cell.getAttribute('data-tip-val') || ''
        }, st.lang);
        if (!html) {
          el.tooltip.classList.add('hidden');
          return;
        }
        el.tooltip.innerHTML = html;
        el.tooltip.classList.remove('hidden');
        var maxX = (typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1200) - 255;
        el.tooltip.style.left = Math.min(maxX, e.clientX + 14) + 'px';
        el.tooltip.style.top = Math.max(12, e.clientY - 82) + 'px';
      });
      el.dataStage.addEventListener('mouseleave', function () {
        el.tooltip.classList.add('hidden');
      });
    }

    function tick(now) {
      if (st.playing && !st.dragging) {
        if (st.lastTs === null) st.lastTs = now;
        var dt = Math.min(0.1, (now - st.lastTs) / 1000);
        st.lastTs = now;
        var prevSc = getSceneAt(st.masterTime);
        st.masterTime = Math.min(totalDuration, st.masterTime + dt * st.speed);
        var nextSc = getSceneAt(st.masterTime);
        if (st.autoPause && nextSc.id > prevSc.id) {
          st.masterTime = prevSc.end - 0.02;
          setPlaying(false);
        }
        if (st.masterTime >= totalDuration) {
          st.masterTime = totalDuration;
          setPlaying(false);
        }
        renderFrame(false);
      } else {
        st.lastTs = now;
      }
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(tick);
      }
    }

    var controller = {
      _syncLang: function () {
        st.lang = (window.LocSims && window.LocSims.getLang && window.LocSims.getLang()) || 'en';
        st.lastSubKey = '';
        st.lastMathKey = '';
        syncStaticCopy();
        renderFrame(true);
      },
      _rerenderMath: function () {
        st.lastSubKey = '';
        st.lastMathKey = '';
        renderFrame(true);
      },
      jumpTo: function (sec) {
        st.masterTime = clamp(sec, 0, totalDuration);
        renderFrame(true);
      },
      setPlaying: setPlaying
    };

    if (window.LocSims && typeof window.LocSims.registerCustomLab === 'function') {
      window.LocSims.registerCustomLab(controller);
    }

    syncStaticCopy();
    renderFrame(true);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(tick);
    }
    return controller;
  }

  window.CinemaLabs = {
    mount: mount,
    clamp: clamp,
    lerp: lerp,
    invLerp: invLerp,
    easeOutCubic: easeOutCubic,
    easeInOutCubic: easeInOutCubic,
    signed: signed,
    roundRect: roundRect,
    drawArrowHead: drawArrowHead,
    drawArrow: drawArrow,
    drawHatLabel: drawHatLabel,
    drawSubLabel: drawSubLabel,
    drawGridBg: drawGridBg,
    buildFlightSVG: buildFlightSVG,
    buildLaserBeamSVG: buildLaserBeamSVG,
    renderMatrixHTML: renderMatrixHTML
  };
})();
