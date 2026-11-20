/* LAB 03: Histogram Lane Filter — 6-Scene 3x3 Step-by-Step Pedagogical Walkthrough */
(function () {
  'use strict';

  function init() {
    var C = window.CinemaLabs;
    if (!C) return;

    // Row 0: d = +0.05 m (5 cm a sinistra)
    // Row 1: d =  0.00 m (al centro)
    // Row 2: d = -0.05 m (5 cm a destra)
    var D_BINS = [0.05, 0.0, -0.05];
    var PHI_BINS = [-0.1, 0.0, 0.1];
    var D_LABELS = ['+0.05 (sx)', '0.00 (ctr)', '-0.05 (dx)'];
    var D_SHORT = ['+0.05', '0.00', '-0.05'];
    var PHI_LABELS = ['-0.10', '0.00', '+0.10'];

    var L_WHEEL = 0.10;
    var W_LANE = 0.22;
    var W_WHITE = 0.04;

    // Passo 1: histogram_prior (60% al centro, 10% nei 4 vicini, 0% negli angoli)
    var MAT_PRIOR = [
      [0.00, 0.10, 0.00],
      [0.10, 0.60, 0.10],
      [0.00, 0.10, 0.00]
    ];

    // Passo 2A: dopo shift di +1 colonna a destra (0.60 + 0.10 sul bordo destro = 0.70)
    var MAT_SHIFT = [
      [0.00, 0.00, 0.10],
      [0.00, 0.10, 0.70],
      [0.00, 0.00, 0.10]
    ];

    // Passo 2B: dopo sfocatura G_cov_mask (60% resta + 10% ai 4 vicini: 0.49 + 0.01 + 0.01 + 0.01 = 0.52)
    var MAT_BEL_BAR = [
      [0.00, 0.02, 0.15],
      [0.01, 0.13, 0.52],
      [0.00, 0.02, 0.15]
    ];

    // Passo 4: Tabella L dopo 20 voti dei segmenti (11/20 = 0.55 in (0.00, +0.10))
    var MAT_L = [
      [0.00, 0.05, 0.10],
      [0.00, 0.15, 0.55],
      [0.00, 0.05, 0.10]
    ];

    // Passo 5A: Prodotto di Hadamard bel_bar ⊙ L (somma = 0.3375)
    var MAT_PROD = [
      [0.000, 0.001, 0.015],
      [0.000, 0.020, 0.286],
      [0.000, 0.001, 0.015]
    ];
    var PROD_SUM = 0.338;

    // Passo 5B: Posteriore normalizzato bel = (bel_bar ⊙ L) / 0.3375 (picco = 0.286 / 0.3375 = 0.85 -> 85%)
    var MAT_BEL_NEW = [
      [0.00, 0.00, 0.04],
      [0.00, 0.06, 0.85],
      [0.00, 0.00, 0.05]
    ];

    // 20 segmenti che votano nel Passo 4:
    // (1,2): 11 voti (0.55) | (1,1): 3 voti (0.15) | (0,2): 2 voti (0.10) | (2,2): 2 voti (0.10) | (0,1): 1 voto (0.05) | (2,1): 1 voto (0.05)
    var VOTE_BURST_SEQ = [
      { r: 1, c: 2, src: 'white',  sx: 0.55, sy: -0.206 },
      { r: 1, c: 2, src: 'white',  sx: 0.42, sy: -0.193 },
      { r: 1, c: 1, src: 'yellow', sx: 0.48, sy:  0.062 },
      { r: 1, c: 2, src: 'white',  sx: 0.64, sy: -0.215 },
      { r: 0, c: 2, src: 'white',  sx: 0.36, sy: -0.187 },
      { r: 1, c: 2, src: 'yellow', sx: 0.52, sy:  0.058 },
      { r: 2, c: 2, src: 'white',  sx: 0.68, sy: -0.219 },
      { r: 1, c: 2, src: 'white',  sx: 0.46, sy: -0.197 },
      { r: 0, c: 1, src: 'yellow', sx: 0.38, sy:  0.072 },
      { r: 1, c: 2, src: 'white',  sx: 0.58, sy: -0.209 },
      { r: 1, c: 1, src: 'white',  sx: 0.32, sy: -0.183 },
      { r: 1, c: 2, src: 'yellow', sx: 0.60, sy:  0.050 },
      { r: 2, c: 1, src: 'yellow', sx: 0.44, sy:  0.066 },
      { r: 1, c: 2, src: 'white',  sx: 0.50, sy: -0.201 },
      { r: 0, c: 2, src: 'white',  sx: 0.62, sy: -0.213 },
      { r: 1, c: 2, src: 'yellow', sx: 0.56, sy:  0.054 },
      { r: 1, c: 1, src: 'white',  sx: 0.34, sy: -0.185 },
      { r: 1, c: 2, src: 'white',  sx: 0.48, sy: -0.199 },
      { r: 2, c: 2, src: 'yellow', sx: 0.66, sy:  0.044 },
      { r: 1, c: 2, src: 'white',  sx: 0.54, sy: -0.205 }
    ];

    var SCENES = [
      { id: 0, start: 0.0,  end: 9.0,  tag: 'Passo 1 · histogram_prior',   shortEn: '1. Prior (60%)',   shortIt: '1. Prior (60%)' },
      { id: 1, start: 9.0,  end: 18.0, tag: 'Passo 2A · Shift Ruote',      shortEn: '2A. Shift (70%)',  shortIt: '2A. Shift (70%)' },
      { id: 2, start: 18.0, end: 27.0, tag: 'Passo 2B · Sfocatura * G',    shortEn: '2B. Blur (52%)',   shortIt: '2B. Sfoca (52%)' },
      { id: 3, start: 27.0, end: 40.5, tag: 'Passo 3 · 1 Segmento → 1 Voto', shortEn: '3. One Vote',    shortIt: '3. 1 Seg → 1 Voto' },
      { id: 4, start: 40.5, end: 49.5, tag: 'Passo 4 · 20 Voti → Tabella L', shortEn: '4. Table L (55%)', shortIt: '4. Tabella L (55%)' },
      { id: 5, start: 49.5, end: 60.0, tag: 'Passo 5 · Hadamard & 85%',    shortEn: '5. Update (85%)',  shortIt: '5. Update (85%)' }
    ];

    function drawRoadTopDown(ctx, w, h, laneCX, scale, showDims, dimAlpha, lang) {
      var halfLane = (W_LANE * 0.5) * scale;
      var whiteW = W_WHITE * scale;
      var yellowW = 0.025 * scale;
      var roadLeft = laneCX - halfLane - yellowW - W_LANE * scale * 0.9;
      var roadRight = laneCX + halfLane + whiteW + 0.03 * scale;

      ctx.fillStyle = '#0e0e14';
      ctx.fillRect(roadLeft, 0, roadRight - roadLeft, h);
      ctx.fillStyle = 'rgba(255,255,255,0.024)';
      ctx.fillRect(laneCX - halfLane, 0, W_LANE * scale, h);

      ctx.save();
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.42)';
      ctx.lineWidth = 1.5;
      if (ctx.setLineDash) ctx.setLineDash([7, 7]);
      ctx.beginPath(); ctx.moveTo(laneCX, 0); ctx.lineTo(laneCX, h); ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#f4f4f6';
      ctx.fillRect(laneCX + halfLane, 0, whiteW, h);
      ctx.fillStyle = '#ffd000';
      var dashLen = 0.055 * scale;
      var gapLen = 0.042 * scale;
      for (var y = 12; y < h; y += dashLen + gapLen) {
        ctx.fillRect(laneCX - halfLane - yellowW, y, yellowW, dashLen);
      }

      if (showDims && dimAlpha > 0.02) {
        ctx.save();
        ctx.globalAlpha = dimAlpha;
        var dimY = h * 0.25;
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(laneCX - halfLane, dimY); ctx.lineTo(laneCX + halfLane, dimY);
        ctx.moveTo(laneCX - halfLane, dimY - 5); ctx.lineTo(laneCX - halfLane, dimY + 5);
        ctx.moveTo(laneCX + halfLane, dimY - 5); ctx.lineTo(laneCX + halfLane, dimY + 5);
        ctx.stroke();
        C.drawSubLabel(ctx, 'w', 'lane', ' = 0.22 m (mezza = 0.11 m)', laneCX, dimY - 8, '#60a5fa', 'center');

        var wDimY = h * 0.34;
        ctx.strokeStyle = '#f4f4f6';
        ctx.beginPath(); ctx.moveTo(laneCX + halfLane, wDimY); ctx.lineTo(laneCX + halfLane + whiteW, wDimY); ctx.stroke();
        C.drawSubLabel(ctx, 'w', 'white', ' = 0.04 m', laneCX + halfLane + whiteW + 8, wDimY + 4, '#f4f4f6', 'left');
        ctx.restore();
      }
    }

    function drawDuckiebot(ctx, cx, cy, scale, phiRad, opts) {
      opts = opts || {};
      var alpha = opts.alpha !== undefined ? opts.alpha : 1;
      var ghost = !!opts.ghost;
      var borderColor = opts.borderColor || '#ffd000';
      var fovAlpha = opts.fovAlpha !== undefined ? opts.fovAlpha : 0.20;
      var fovLenM = opts.fovLenM || 0.42;
      var bw = 0.105 * scale;
      var bl = 0.155 * scale;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-phiRad);
      ctx.globalAlpha = alpha;

      if (fovAlpha > 0.01) {
        var coneLen = fovLenM * scale;
        var grad = ctx.createLinearGradient(0, -bl * 0.45, 0, -bl * 0.45 - coneLen);
        grad.addColorStop(0, 'rgba(96, 165, 250, ' + fovAlpha + ')');
        grad.addColorStop(1, 'rgba(96, 165, 250, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, -bl * 0.46);
        ctx.lineTo(-coneLen * 0.52, -bl * 0.46 - coneLen);
        ctx.lineTo(coneLen * 0.52, -bl * 0.46 - coneLen);
        ctx.closePath();
        ctx.fill();
      }

      var ww = Math.max(6, 0.022 * scale);
      var wh = Math.max(14, 0.062 * scale);
      var wy = bl * 0.08 - wh * 0.5;
      ctx.fillStyle = opts.wheelLeftGlow ? '#60a5fa' : ghost ? 'rgba(255,255,255,0.18)' : '#252532';
      ctx.strokeStyle = opts.wheelLeftGlow ? '#ffffff' : '#525268';
      ctx.lineWidth = 1.4;
      C.roundRect(ctx, -bw * 0.5 - ww + 2, wy, ww, wh, 3);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = opts.wheelRightGlow ? '#e07a5f' : ghost ? 'rgba(255,255,255,0.18)' : '#252532';
      ctx.strokeStyle = opts.wheelRightGlow ? '#ffffff' : '#525268';
      C.roundRect(ctx, bw * 0.5 - 2, wy, ww, wh, 3);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = ghost ? 'rgba(255, 208, 0, 0.10)' : '#14141c';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = ghost ? 1.5 : 2.1;
      if (ghost && ctx.setLineDash) ctx.setLineDash([4, 3]);
      C.roundRect(ctx, -bw * 0.5, -bl * 0.5, bw, bl, 8);
      ctx.fill(); ctx.stroke();
      if (ctx.setLineDash) ctx.setLineDash([]);

      if (!ghost) {
        ctx.fillStyle = '#ffd000';
        ctx.beginPath(); ctx.arc(0, bl * 0.05, Math.max(5.5, bw * 0.23), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e07a5f';
        ctx.beginPath(); ctx.moveTo(-3.5, -bl * 0.09); ctx.lineTo(3.5, -bl * 0.09); ctx.lineTo(0, -bl * 0.21); ctx.closePath(); ctx.fill();
      }

      ctx.fillStyle = '#60a5fa';
      ctx.beginPath(); ctx.arc(0, -bl * 0.5 + 5, 3.5, 0, Math.PI * 2); ctx.fill();

      if (opts.showHeadingArrow !== false) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -bl * 0.5); ctx.lineTo(0, -bl * 0.5 - 24); ctx.stroke();
        C.drawArrowHead(ctx, 0, -bl * 0.5 - 24, -Math.PI * 0.5, 7, borderColor);
      }
      ctx.restore();
    }

    function makeLocalFrame(w, h) {
      var originX = w * 0.42;
      var originY = h * 0.84;
      var scale = Math.min(w * 0.96, h * 0.96);
      return {
        originX: originX, originY: originY, scale: scale,
        toPx: function (x, y) { return { px: originX - y * scale, py: originY - x * scale }; }
      };
    }

    function drawLocalAxes(ctx, tf, lang) {
      var xTip = tf.toPx(0.70, 0);
      C.drawArrow(ctx, tf.originX, tf.originY, xTip.px, xTip.py, '#60a5fa', 1.9);
      ctx.font = '700 10.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#60a5fa';
      ctx.textAlign = 'left';
      ctx.fillText(lang === 'it' ? '+X (avanti)' : '+X (ahead)', xTip.px + 8, xTip.py + 12);

      var yPos = tf.toPx(0, 0.28);
      var yNeg = tf.toPx(0, -0.34);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      if (ctx.setLineDash) ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(tf.originX, tf.originY); ctx.lineTo(yNeg.px, yNeg.py); ctx.stroke();
      ctx.restore();
      C.drawArrow(ctx, tf.originX, tf.originY, yPos.px, yPos.py, 'rgba(244,244,246,0.72)', 1.7);

      ctx.fillStyle = '#f4f4f6';
      ctx.textAlign = 'right';
      ctx.fillText(lang === 'it' ? '+Y (sx)' : '+Y (left)', yPos.px + 14, yPos.py - 10);
      ctx.fillStyle = '#7c7c94';
      ctx.textAlign = 'left';
      ctx.fillText(lang === 'it' ? '-Y (dx)' : '-Y (right)', yNeg.px - 44, yNeg.py - 8);

      drawDuckiebot(ctx, tf.originX, tf.originY, tf.scale * 0.52, 0, {
        fovAlpha: 0.14, fovLenM: 1.25, borderColor: '#94a3b8', showHeadingArrow: false
      });
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(tf.originX, tf.originY, 3.6, 0, Math.PI * 2); ctx.fill();
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('Robot (0, 0)', tf.originX, tf.originY + 35);
    }

    function drawStepCard(ctx, w, badge, title, line1, line2, color) {
      var padX = 10, by = 38, bw = Math.min(w - 20, 460), bh = line2 ? 56 : 42;
      ctx.save();
      ctx.fillStyle = 'rgba(10, 10, 15, 0.94)';
      ctx.strokeStyle = color || '#ffd000';
      ctx.lineWidth = 1.3;
      C.roundRect(ctx, padX, by, bw, bh, 7);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = color || '#ffd000';
      C.roundRect(ctx, padX + 8, by + 7, 74, 15, 4);
      ctx.fill();
      ctx.font = '800 9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#09090d';
      ctx.textAlign = 'center';
      ctx.fillText(badge, padX + 45, by + 18);

      ctx.font = '700 10.2px "JetBrains Mono", monospace';
      ctx.fillStyle = '#f4f4f6';
      ctx.textAlign = 'left';
      ctx.fillText(title, padX + 90, by + 18);

      ctx.font = '600 9.8px "JetBrains Mono", monospace';
      ctx.fillStyle = color || '#ffd000';
      ctx.fillText(line1, padX + 10, by + 35);

      if (line2) {
        ctx.font = '500 9.2px "JetBrains Mono", monospace';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(line2, padX + 10, by + 49);
      }
      ctx.restore();
    }

    function drawCandidateGridOnRoad(ctx, cx, by, scale, mat, mode) {
      // D_BINS: row 0 = +0.05 (left), row 1 = 0.00 (center), row 2 = -0.05 (right)
      var dOffsets = [0.05, 0.00, -0.05];
      var phiAngles = [-0.10, 0.00, 0.10];
      ctx.save();
      for (var r = 0; r < 3; r++) {
        var px = cx - dOffsets[r] * scale * 1.15;
        var py = by;
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI * 2); ctx.stroke();

        // Label rail d
        ctx.font = '600 8.5px "JetBrains Mono", monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        ctx.fillText('d=' + D_SHORT[r], px, py + 25);

        for (var c = 0; c < 3; c++) {
          var wVal = mat[r][c];
          var ang = phiAngles[c] * 3.4;
          var len = 26;
          var tipX = px - Math.sin(ang) * len;
          var tipY = py - Math.cos(ang) * len;
          var isPeak = (mode === 'prior' && r === 1 && c === 1) || (mode !== 'prior' && r === 1 && c === 2);
          var isZero = wVal <= 0.001;
          var col = isZero ? 'rgba(224,122,95,0.25)' : isPeak ? (mode === 'post' ? '#34d399' : '#ffd000') : '#60a5fa';
          ctx.globalAlpha = isZero ? 0.30 : Math.max(0.32, Math.min(1, wVal * 1.8 + 0.25));
          C.drawArrow(ctx, px, py, tipX, tipY, col, isPeak ? 2.8 : 1.7, false);
          if (isPeak || (!isZero && wVal >= 0.08)) {
            ctx.font = (isPeak ? '800 9.5px' : '600 8.5px') + ' "JetBrains Mono", monospace';
            ctx.fillStyle = col;
            ctx.textAlign = 'center';
            ctx.fillText(wVal.toFixed(2), tipX + (c - 1) * 14, tipY - 6);
          }
        }
      }
      ctx.restore();
    }

    C.mount({
      id: 'lab-hf',
      duration: 60.0,
      scenes: SCENES,
      mathTitleEn: 'Step-by-Step Math & 3×3 Grid',
      mathTitleIt: 'Matematica Passo-Passo & Griglia 3×3',

      getMetric: function (t, lang) {
        var lbl = lang === 'it' ? 'Certezza' : 'Peak';
        if (t < 14.0) return { label: lbl, pct: 60, text: '60%', color: '#ffd000' };
        if (t < 18.0) return { label: lbl, pct: 70, text: '70%', color: '#60a5fa' };
        if (t < 27.0) {
          var pBlur = Math.round(C.lerp(70, 52, C.easeInOutCubic(C.invLerp(19.0, 25.0, t))));
          return { label: lbl, pct: pBlur, text: pBlur + '%', color: '#e07a5f' };
        }
        if (t < 54.0) return { label: lbl, pct: 52, text: '52%', color: '#e07a5f' };
        if (t < 56.5) {
          var pUpd = Math.round(C.lerp(52, 85, C.easeOutCubic(C.invLerp(54.0, 56.5, t))));
          return { label: lbl, pct: pUpd, text: pUpd + '%', color: '#34d399' };
        }
        return { label: lbl, pct: 85, text: '85%', color: '#34d399' };
      },

      getSubtitle: function (t, lang) {
        var it = lang === 'it';
        if (t < 4.5) {
          return { color: '#ffd000', text: it ? '<strong>Passo 1 (Prior):</strong> il robot è fermo a occhi chiusi. Costruisce una tabella \\(3\\times 3\\) di "battaglia navale": righe \\(d \\in \\{+0.05\\text{ sx},\\; 0.00\\text{ centro},\\; -0.05\\text{ dx}\\}\\), colonne \\(\\varphi \\in \\{-0.10\\text{ dx},\\; 0.00\\text{ dritto},\\; +0.10\\text{ sx}\\}\\).' : '<strong>Step 1 (Prior):</strong> robot sits still with eyes closed. It builds a \\(3\\times 3\\) battleship grid: rows \\(d \\in \\{+0.05\\text{ left},\\; 0.00\\text{ center},\\; -0.05\\text{ right}\\}\\), columns \\(\\varphi \\in \\{-0.10\\text{ right},\\; 0.00\\text{ straight},\\; +0.10\\text{ left}\\}\\).' };
        }
        if (t < 9.0) {
          return { color: '#ffd000', text: it ? '<strong>Passo 1 (Esempio):</strong> casella centrale \\((0.00, 0.00) = 0.60\\) (60% dritto al centro), i 4 vicini hanno \\(0.10\\) (10%) e gli angoli \\(0.00\\). Somma \\(0.60 + 4(0.10) = 1.00\\).' : '<strong>Step 1 (Example):</strong> center cell \\((0.00, 0.00) = 0.60\\) (60% straight & centered), 4 neighbors hold \\(0.10\\) (10%), corners \\(0.00\\). Sum \\(= 1.00\\).' };
        }
        if (t < 13.5) {
          return { color: '#60a5fa', text: it ? '<strong>Passo 2A (Moto a occhi chiusi):</strong> gli encoder leggono \\(d_L = 0.095\\text{ m}\\), \\(d_R = 0.105\\text{ m}\\) (\\(L = 0.10\\text{ m}\\)) \\(\\implies\\) avanzamento \\(d_A = 0.10\\text{ m}\\), rotazione \\(w = +0.10\\text{ rad}\\) (gira a sinistra).' : '<strong>Step 2A (Blind motion):</strong> encoders read \\(d_L = 0.095\\text{ m}\\), \\(d_R = 0.105\\text{ m}\\) (\\(L = 0.10\\text{ m}\\)) \\(\\implies\\) forward \\(d_A = 0.10\\text{ m}\\), turn \\(w = +0.10\\text{ rad}\\) (steers left).' };
        }
        if (t < 18.0) {
          return { color: '#60a5fa', text: it ? '<strong>Passo 2A (Shift della tabella):</strong> \\(\\Delta d = 0.10\\sin(0) = 0\\) (0 righe) e \\(\\Delta\\varphi = +0.10\\text{ rad}\\) (<strong>+1 colonna a destra</strong>). Il vecchio \\(0.10\\) sul bordo destro si somma allo \\(0.60\\) che arriva da sinistra \\(\\implies \\mathbf{0.70}\\).' : '<strong>Step 2A (Table Shift):</strong> \\(\\Delta d = 0\\) rows and \\(\\Delta\\varphi = +0.10\\text{ rad}\\) (<strong>+1 col right</strong>). The old \\(0.10\\) on the right border adds to the incoming \\(0.60 \\implies \\mathbf{0.70}\\).' };
        }
        if (t < 27.0) {
          return { color: '#ffd000', text: it ? '<strong>Passo 2B (Sfocatura \\(* G_{\\text{cov\\_mask}}\\)):</strong> ogni casella tiene il 60% e cede il 10% ai 4 vicini. Il picco \\(0.70\\) tiene \\(70\\%\\) (\\(0.49\\)) e riceve \\(+0.01\\) da sopra, sotto e sinistra \\(\\implies \\mathbf{0.52}\\) (\\(\\overline{\\operatorname{bel}}\\)).' : '<strong>Step 2B (Gaussian Blur \\(* G_{\\text{cov\\_mask}}\\)):</strong> each cell keeps 60% and gives 10% to 4 neighbors. Peak \\(0.70\\) keeps \\(70\\%\\) (\\(0.49\\)) plus \\(+0.01\\times 3 = \\mathbf{0.52}\\) (\\(\\overline{\\operatorname{bel}}\\)).' };
        }
        if (t < 31.5) {
          return { color: '#60a5fa', text: it ? '<strong>Passo 3 · Parte A (Troviamo \\(\\varphi_1\\) per scegliere la COLONNA):</strong> da \\(\\hat{t}=[0.995,-0.100]^\\top\\) otteniamo \\(\\varphi_1 = +0.10\\text{ rad}\\). Confrontandolo con le 3 colonne \\(\\{-0.10,\\; 0.00,\\; +0.10\\}\\), il filtro <strong>sceglie la colonna più vicina: Colonna Destra (\\(+0.10\\text{ rad}\\))</strong>!' : '<strong>Step 3 · Part A (Find \\(\\varphi_1\\) to pick the COLUMN):</strong> from \\(\\hat{t}=[0.995,-0.100]^\\top\\) we get \\(\\varphi_1 = +0.10\\text{ rad}\\). Comparing against columns \\(\\{-0.10,\\; 0.00,\\; +0.10\\}\\), it <strong>selects the Right Column (\\(+0.10\\text{ rad}\\))</strong>!' };
        }
        if (t < 36.5) {
          return { color: '#e07a5f', text: it ? '<strong>Passo 3 · Parte B (Troviamo \\(d_1\\) per scegliere la RIGA):</strong> \\(d_{\\text{seg}}=0.150\\text{ m} \\implies d_1 = 0.150 - 0.040 - 0.110 = 0.00\\text{ m}\\). Confrontandolo con le 3 righe \\(\\{+0.05,\\; 0.00,\\; -0.05\\}\\), il filtro <strong>sceglie la Riga Centrale (\\(0.00\\text{ m}\\))</strong>!' : '<strong>Step 3 · Part B (Find \\(d_1\\) to pick the ROW):</strong> \\(d_{\\text{seg}}=0.150\\text{ m} \\implies d_1 = 0.150 - 0.040 - 0.110 = 0.00\\text{ m}\\). Comparing against rows \\(\\{+0.05,\\; 0.00,\\; -0.05\\}\\), it <strong>selects the Center Row (\\(0.00\\text{ m}\\))</strong>!' };
        }
        if (t < 40.5) {
          return { color: '#34d399', text: it ? '<strong>Passo 3 · Incrocio Riga \\(\\cap\\) Colonna:</strong> incrociando <strong>Riga Centrale (\\(0.00\\text{ m}\\))</strong> e <strong>Colonna Destra (\\(+0.10\\text{ rad}\\))</strong>, il Segmento #1 sceglie un’unica casella della battaglia navale e ci piazza dentro <strong>\\(+1\\) voto</strong>!' : '<strong>Step 3 · Row \\(\\cap\\) Column Intersection:</strong> intersecting <strong>Center Row (\\(0.00\\text{ m}\\))</strong> and <strong>Right Column (\\(+0.10\\text{ rad}\\))</strong>, Segment #1 picks a single cell and places <strong>\\(+1\\) vote</strong> inside!' };
        }
        if (t < 49.5) {
          return { color: '#ffd000', text: it ? '<strong>Passo 4 (Costruzione tabella \\(L\\)):</strong> ora tutti i 20 segmenti del fotogramma votano. 11 su 20 votano \\((0.00, +0.10) \\implies L = 11/20 = \\mathbf{0.55}\\). Ecco nata la tabella della telecamera \\(L\\)!' : '<strong>Step 4 (Building table \\(L\\)):</strong> all 20 frame segments cast their votes. 11 of 20 vote \\((0.00, +0.10) \\implies L = 11/20 = \\mathbf{0.55}\\), forming camera table \\(L\\)!' };
        }
        if (t < 54.0) {
          return { color: '#ffd000', text: it ? '<strong>Passo 5A (Hadamard \\(\\overline{\\operatorname{bel}} \\odot L\\)):</strong> moltiplichiamo ruote e camera cella per cella: in \\((0.00, +0.10)\\) otteniamo \\(0.52 \\times 0.55 = \\mathbf{0.286}\\). La somma totale è \\(S = 0.3375\\).' : '<strong>Step 5A (Hadamard \\(\\overline{\\operatorname{bel}} \\odot L\\)):</strong> multiply wheels and camera bin-by-bin: at \\((0.00, +0.10)\\) we get \\(0.52 \\times 0.55 = \\mathbf{0.286}\\). Total sum \\(S = 0.3375\\).' };
        }
        return { color: '#34d399', text: it ? '<strong>Passo 5B (Normalizzazione & Sterzata):</strong> dividendo per \\(0.3375\\), la cella \\((0.00, +0.10)\\) sale a \\(0.286 / 0.3375 = \\mathbf{0.85}\\) (<strong>85% di certezza!</strong>). Il robot sterza a destra di \\(-5.7^\\circ\\).' : '<strong>Step 5B (Normalization & Steering):</strong> dividing by \\(0.3375\\), cell \\((0.00, +0.10)\\) reaches \\(0.286 / 0.3375 = \\mathbf{0.85}\\) (<strong>85% confidence!</strong>). Robot steers right by \\(-5.7^\\circ\\).' };
      },

      drawCanvas: function (ctx, w, h, t, lang, api) {
        var it = lang === 'it';

        // SCENA 0: PASSO 1 (PRIOR - BATTAGLIA NAVALE 3x3 A OCCHI CHIUSI)
        if (t < 9.0) {
          api.setMode(it ? 'PASSO 1 · PRIOR (OCCHI CHIUSI)' : 'STEP 1 · PRIOR (EYES CLOSED)', 'gold');
          api.setCoords('d = 0.00 m · φ = 0.00 rad · Picco = 60%');
          var s0 = Math.min(w, h) * 1.42, cx0 = w * 0.44, by0 = h * 0.70;
          drawRoadTopDown(ctx, w, h, cx0, s0, true, C.easeOutCubic(C.invLerp(0.2, 1.5, t)), lang);
          drawDuckiebot(ctx, cx0, by0, s0, 0, { borderColor: '#ffd000', fovAlpha: 0.16 });
          drawCandidateGridOnRoad(ctx, cx0, by0 - 85, s0, MAT_PRIOR, 'prior');

          if (t < 4.5) {
            drawStepCard(ctx, w, 'PASSO 1.1',
              it ? 'La "Battaglia Navale" 3×3 nella testa del Robot' : 'The 3×3 "Battleship Grid" in the Robot’s Head',
              'd: +0.05 (5cm sx), 0.00 (centro), −0.05 (5cm dx) | φ: −0.10 (dx), 0.00, +0.10 (sx)',
              it ? 'Ogni casella è un’ipotesi fisica (d, φ); δ(x − xⁱ) concentra il peso wⁱ nella casella i' : 'Each bin is a physical pose hypothesis (d, φ) with weight wⁱ concentrated at centroid xⁱ',
              '#ffd000');
          } else {
            drawStepCard(ctx, w, 'PASSO 1.2',
              it ? 'Esempio Numerico Iniziale (histogram_prior)' : 'Initial Numerical Example (histogram_prior)',
              'Centro (0.00, 0.00) = 0.60 (60%) · 4 vicini = 0.10 (10%) · 4 angoli = 0.00 (0%)',
              it ? 'Controllo somma: 0.10 + 0.10 + 0.60 + 0.10 + 0.10 = 1.00 (100% di probabilità)' : 'Sum check: 0.10 + 0.10 + 0.60 + 0.10 + 0.10 = 1.00 (100% total probability)',
              '#ffd000');
          }
          return;
        }

        // SCENA 1: PASSO 2A (PREDIZIONE A OCCHI CHIUSI: ENCODER + SHIFT)
        if (t < 18.0) {
          api.setMode(it ? 'PASSO 2A · MOTO & SHIFT TABELLA' : 'STEP 2A · MOTION & TABLE SHIFT', 'gold');
          var s1 = Math.min(w, h) * 1.42, cx1 = w * 0.50, sy1 = h * 0.78;
          drawRoadTopDown(ctx, w, h, cx1, s1, false, 0, lang);
          var moveP = C.easeInOutCubic(C.invLerp(9.3, 13.0, t));
          var dA = 0.10 * moveP, curPhi = 0.10 * moveP;
          var ex1 = cx1 - dA * Math.sin(curPhi * 0.5) * s1;
          var ey1 = sy1 - dA * Math.cos(curPhi * 0.5) * s1;
          api.setCoords('d_A = ' + dA.toFixed(2) + ' m · w = +' + curPhi.toFixed(2) + ' rad');
          var halfL = (L_WHEEL * 0.5) * s1;
          if (moveP > 0.01) {
            ctx.save();
            ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 3.6;
            ctx.beginPath(); ctx.moveTo(cx1 - halfL, sy1); ctx.quadraticCurveTo(cx1 - halfL, sy1 - dA * 0.5 * s1, ex1 - halfL * Math.cos(curPhi), ey1 + halfL * Math.sin(curPhi)); ctx.stroke();
            ctx.strokeStyle = '#e07a5f'; ctx.lineWidth = 4.0;
            ctx.beginPath(); ctx.moveTo(cx1 + halfL, sy1); ctx.quadraticCurveTo(cx1 + halfL, sy1 - dA * 0.5 * s1, ex1 + halfL * Math.cos(curPhi), ey1 - halfL * Math.sin(curPhi)); ctx.stroke();
            ctx.restore();
            var midY = (sy1 + ey1) * 0.5;
            C.drawSubLabel(ctx, 'd', 'L', ' = ' + (0.095 * moveP).toFixed(3) + ' m', cx1 - halfL - 12, midY + 4, '#60a5fa', 'right');
            C.drawSubLabel(ctx, 'd', 'R', ' = ' + (0.105 * moveP).toFixed(3) + ' m', cx1 + halfL + 12, midY + 4, '#e07a5f', 'left');
            ctx.strokeStyle = '#ffd000'; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(cx1 - halfL, sy1 + 24); ctx.lineTo(cx1 + halfL, sy1 + 24); ctx.stroke();
            ctx.font = '700 11px "JetBrains Mono", monospace'; ctx.fillStyle = '#ffd000'; ctx.textAlign = 'center';
            ctx.fillText('L = 0.10 m', cx1, sy1 + 38);
            api.setAnchor('wheel-L', cx1 - halfL - 44, midY);
            api.setAnchor('wheel-R', cx1 + halfL + 44, midY);
            api.setAnchor('wheel-base', cx1, sy1 + 30);
          }
          drawDuckiebot(ctx, cx1, sy1, s1, 0, { ghost: true, alpha: 0.35, fovAlpha: 0, borderColor: '#94a3b8', showHeadingArrow: false });
          drawDuckiebot(ctx, ex1, ey1, s1, curPhi, { borderColor: '#60a5fa', wheelLeftGlow: t < 13.5, wheelRightGlow: t < 13.5, fovAlpha: 0.15 });
          drawCandidateGridOnRoad(ctx, ex1, ey1 - 78, s1, t < 13.8 ? MAT_PRIOR : MAT_SHIFT, t < 13.8 ? 'prior' : 'pred');

          if (t < 13.5) {
            drawStepCard(ctx, w, 'PASSO 2A.1',
              it ? 'Calcolo Movimento dagli Encoder (a occhi chiusi)' : 'Motion Calculation from Encoders (blind)',
              'd_A = (0.095 + 0.105)/2 = 0.10 m   |   w = (0.105 − 0.095)/0.10 = +0.10 rad',
              it ? 'La ruota destra fa 1 cm in più della sinistra → il muso ruota a sinistra di +0.10 rad' : 'Right wheel travels 1 cm farther than left → robot turns left by +0.10 rad',
              '#60a5fa');
          } else {
            drawStepCard(ctx, w, 'PASSO 2A.2',
              it ? 'Spostamento della Tabella (shift: 0 righe, +1 col. a dx)' : 'Shifting the Table (shift: 0 rows, +1 col right)',
              'd_t = d + 0.10·sin(0.00) = d (0 righe)   |   φ_t = φ + 0.10 (+1 colonna a destra)',
              it ? 'Il vecchio 0.10 sul bordo destro non esce e si somma allo 0.60 che arriva → 0.70!' : 'The old 0.10 at the right edge adds to the incoming 0.60 → 0.70!',
              '#ffd000');
          }
          return;
        }

        // SCENA 2: PASSO 2B (SFOCATURA GAUSSIANA * G_cov_mask: 0.70 -> 0.52)
        if (t < 27.0) {
          api.setMode(it ? 'PASSO 2B · SPUGNA SFOCANTE (* G)' : 'STEP 2B · GAUSSIAN BLUR (* G)', 'gold');
          var s2 = Math.min(w, h) * 1.42, cx2 = w * 0.50, ey2 = h * 0.62;
          drawRoadTopDown(ctx, w, h, cx2, s2, false, 0, lang);
          var blurP = C.easeInOutCubic(C.invLerp(19.0, 24.5, t));
          api.setCoords('Picco: 0.70 → ' + C.lerp(0.70, 0.52, blurP).toFixed(2) + ' (Σ = 1.00)');

          var rB = (0.08 + blurP * 0.12) * s2;
          var gb = ctx.createRadialGradient(cx2, ey2, 6, cx2, ey2, rB);
          gb.addColorStop(0, 'rgba(255, 208, 0, ' + (0.32 * blurP) + ')');
          gb.addColorStop(1, 'rgba(224, 122, 95, 0)');
          ctx.fillStyle = gb;
          ctx.beginPath(); ctx.arc(cx2, ey2, rB, 0, Math.PI * 2); ctx.fill();

          drawDuckiebot(ctx, cx2, ey2, s2, 0.10, { borderColor: '#ffd000', fovAlpha: 0.20 });
          drawCandidateGridOnRoad(ctx, cx2, ey2 - 80, s2, MAT_BEL_BAR, 'pred');

          drawStepCard(ctx, w, 'PASSO 2B',
            it ? 'Sfocatura (* G_cov_mask): regola 60% resta + 10% ai 4 vicini' : 'Blur (* G_cov_mask): 60% stays + 10% to each of 4 neighbors',
            'Picco 0.70: tiene 60%+10%(bordo dx) = 0.49  +  0.01(su) + 0.01(giù) + 0.01(sx) = 0.52',
            it ? 'Muoversi al buio aumenta l’incertezza: il picco scende da 0.70 a 0.52 (certezza 52%)' : 'Moving blind increases uncertainty: peak drops from 0.70 to 0.52 (52% confidence)',
            '#ffd000');
          return;
        }

        // SCENA 3: PASSO 3 (DA UN PEZZETTO DI STRISCIA A UN SINGOLO VOTO - generate_vote)
        if (t < 40.5) {
          api.setMode(it ? 'PASSO 3 · DA 1 SEGMENTO A 1 VOTO' : 'STEP 3 · FROM 1 SEGMENT TO 1 VOTE', 'coral');
          api.setCoords('p1 = (0.500, -0.201) · p2 = (0.600, -0.211)');
          var tf = makeLocalFrame(w, h);
          drawLocalAxes(ctx, tf, lang);

          var p1 = { x: 0.500, y: -0.201 }, p2 = { x: 0.600, y: -0.211 };
          var tx = 0.995, ty = -0.100, nx = 0.100, ny = 0.995;
          var px1 = tf.toPx(p1.x, p1.y), px2 = tf.toPx(p2.x, p2.y);
          var lA = tf.toPx(p1.x - 0.56 * tx, p1.y - 0.56 * ty);
          var lB = tf.toPx(p2.x + 0.14 * tx, p2.y + 0.14 * ty);

          ctx.save();
          ctx.strokeStyle = 'rgba(244,244,246,0.16)'; ctx.lineWidth = 13;
          ctx.beginPath(); ctx.moveTo(lA.px, lA.py); ctx.lineTo(lB.px, lB.py); ctx.stroke();
          ctx.strokeStyle = 'rgba(244,244,246,0.42)'; ctx.lineWidth = 1.3;
          if (ctx.setLineDash) ctx.setLineDash([5, 4]);
          ctx.beginPath(); ctx.moveTo(lA.px, lA.py); ctx.lineTo(lB.px, lB.py); ctx.stroke();
          if (ctx.setLineDash) ctx.setLineDash([]);

          var yA = tf.toPx(0.05, 0.105), yB = tf.toPx(0.72, 0.038);
          ctx.strokeStyle = 'rgba(255,208,0,0.22)'; ctx.lineWidth = 6;
          if (ctx.setLineDash) ctx.setLineDash([14, 10]);
          ctx.beginPath(); ctx.moveTo(yA.px, yA.py); ctx.lineTo(yB.px, yB.py); ctx.stroke();
          if (ctx.setLineDash) ctx.setLineDash([]);

          // Right triangle legs Δx = +0.100 m, Δy = -0.010 m
          var pCorner = tf.toPx(p2.x, p1.y);
          ctx.strokeStyle = 'rgba(96, 165, 250, 0.55)';
          ctx.lineWidth = 1.4;
          if (ctx.setLineDash) ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(px1.px, px1.py);
          ctx.lineTo(pCorner.px, pCorner.py);
          ctx.lineTo(px2.px, px2.py);
          ctx.stroke();
          if (ctx.setLineDash) ctx.setLineDash([]);

          // Segment vector p1 -> p2 & unit tangent t
          C.drawArrow(ctx, px1.px, px1.py, px2.px, px2.py, '#e07a5f', 2.6);
          var tUnitP = C.easeOutCubic(C.invLerp(27.5, 29.5, t));
          if (tUnitP > 0.01) {
            var tTip = tf.toPx(p1.x + 0.22 * tUnitP * tx, p1.y + 0.22 * tUnitP * ty);
            C.drawArrow(ctx, px1.px, px1.py, tTip.px, tTip.py, '#60a5fa', 2.8);
            C.drawHatLabel(ctx, 't', ' = [0.995, -0.100]', tTip.px + 8, tTip.py + 3, '#60a5fa', 'left');
            api.setAnchor('t-tip', tTip.px, tTip.py);

            if (t >= 29.5) {
              var refX = tf.toPx(p1.x + 0.22, p1.y);
              ctx.strokeStyle = 'rgba(255,255,255,0.36)';
              if (ctx.setLineDash) ctx.setLineDash([4, 4]);
              ctx.lineWidth = 1.2;
              ctx.beginPath(); ctx.moveTo(px1.px, px1.py); ctx.lineTo(refX.px, refX.py); ctx.stroke();
              if (ctx.setLineDash) ctx.setLineDash([]);
              ctx.strokeStyle = '#ffd000'; ctx.lineWidth = 2.2;
              ctx.beginPath(); ctx.arc(px1.px, px1.py, 48, -Math.PI * 0.5, -Math.PI * 0.5 + 0.10); ctx.stroke();
              C.drawSubLabel(ctx, 'φ', 'i', ' = +0.10 rad', px1.px - 8, px1.py - 52, '#ffd000', 'right');
            }
          }

          // Unit normal n (rotated 90 deg) + right angle square
          if (t >= 31.5) {
            var rotP = C.easeInOutCubic(C.invLerp(31.5, 33.0, t));
            var curAng = rotP * (Math.PI * 0.5);
            var rx = tx * Math.cos(curAng) - ty * Math.sin(curAng);
            var ry = tx * Math.sin(curAng) + ty * Math.cos(curAng);
            var nTip = tf.toPx(p1.x + 0.19 * rx, p1.y + 0.19 * ry);
            C.drawArrow(ctx, px1.px, px1.py, nTip.px, nTip.py, '#e07a5f', 3.0);
            if (rotP > 0.7) {
              C.drawHatLabel(ctx, 'n', ' = [+0.100, +0.995]', nTip.px - 6, nTip.py - 8, '#e07a5f', 'right');
              var sq1 = tf.toPx(p1.x + 0.03 * tx, p1.y + 0.03 * ty);
              var sq2 = tf.toPx(p1.x + 0.03 * tx + 0.03 * nx, p1.y + 0.03 * ty + 0.03 * ny);
              var sq3 = tf.toPx(p1.x + 0.03 * nx, p1.y + 0.03 * ny);
              ctx.strokeStyle = '#ffd000'; ctx.lineWidth = 1.3;
              ctx.beginPath(); ctx.moveTo(sq1.px, sq1.py); ctx.lineTo(sq2.px, sq2.py); ctx.lineTo(sq3.px, sq3.py); ctx.stroke();
            }
          }

          // Dual dot product projection n . p1 = n . p2 = -0.150 m (|d_seg| = 0.150 m)
          if (t >= 33.5) {
            var projP = C.easeOutCubic(C.invLerp(33.5, 35.0, t));
            var pq = tf.toPx(-0.150 * nx, -0.150 * ny);
            ctx.strokeStyle = '#ffd000'; ctx.lineWidth = 2.6;
            if (ctx.setLineDash) ctx.setLineDash([6, 4]);
            ctx.beginPath(); ctx.moveTo(tf.originX, tf.originY); ctx.lineTo(C.lerp(tf.originX, pq.px, projP), C.lerp(tf.originY, pq.py, projP)); ctx.stroke();
            if (ctx.setLineDash) ctx.setLineDash([]);
            if (projP > 0.85) {
              ctx.fillStyle = '#ffd000';
              ctx.beginPath(); ctx.arc(pq.px, pq.py, 4.2, 0, Math.PI * 2); ctx.fill();
              C.drawSubLabel(ctx, 'd', 'seg', ' = 0.150 m (a 90°)', (tf.originX + pq.px) * 0.5 + 22, (tf.originY + pq.py) * 0.5 + 18, '#ffd000', 'center');
            }
          }

          // Subtraction ruler: 0.150 - 0.040 (white) - 0.110 (lane/2) = 0.00 m
          if (t >= 36.5) {
            var rIn = C.easeOutCubic(C.invLerp(36.5, 37.6, t));
            ctx.save();
            ctx.globalAlpha = rIn;
            var rY = tf.originY + 18;
            var pCenter = tf.originX;
            var pInnerWhite = tf.toPx(0, -0.110).px;
            var pOuterWhite = tf.toPx(0, -0.150).px;

            ctx.fillStyle = 'rgba(96, 165, 250, 0.22)';
            ctx.strokeStyle = '#60a5fa';
            ctx.lineWidth = 1.5;
            C.roundRect(ctx, pCenter, rY, pInnerWhite - pCenter, 16, 3);
            ctx.fill(); ctx.stroke();
            ctx.font = '700 8.5px "JetBrains Mono", monospace';
            ctx.fillStyle = '#60a5fa';
            ctx.textAlign = 'center';
            ctx.fillText('0.110 (lane/2)', (pCenter + pInnerWhite) * 0.5, rY + 11);

            ctx.fillStyle = 'rgba(244, 244, 246, 0.25)';
            ctx.strokeStyle = '#f4f4f6';
            C.roundRect(ctx, pInnerWhite, rY, pOuterWhite - pInnerWhite, 16, 3);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.fillText('0.04', (pInnerWhite + pOuterWhite) * 0.5, rY + 11);

            ctx.fillStyle = '#34d399';
            ctx.font = '800 9.5px "JetBrains Mono", monospace';
            ctx.textAlign = 'right';
            ctx.fillText('dᵢ = 0.150 − 0.040 − 0.110 = 0.00 m →', pCenter - 8, rY + 12);
            ctx.restore();
          }

          [{ pt: px1, b: 'p', s: '1', r: ' (0.500, -0.201)', dy: 16 }, { pt: px2, b: 'p', s: '2', r: ' (0.600, -0.211)', dy: -10 }].forEach(function (itP) {
            ctx.fillStyle = '#e07a5f';
            ctx.beginPath(); ctx.arc(itP.pt.px, itP.pt.py, 4.6, 0, Math.PI * 2); ctx.fill();
            C.drawSubLabel(ctx, itP.b, itP.s, itP.r, itP.pt.px + 8, itP.pt.py + itP.dy, '#f4f4f6', 'left');
          });
          ctx.restore();

          if (t < 31.5) {
            drawStepCard(ctx, w, 'PARTE A · COL',
              it ? 'Troviamo φ₁ = +0.10 rad → Come sceglie la COLONNA?' : 'Find φ₁ = +0.10 rad → How does it pick the COLUMN?',
              'Colonne griglia: [−0.10, 0.00, +0.10]  →  +0.10 coincide con la 3ª colonna!',
              it ? 'Distanza da −0.10: 0.20 (no) · da 0.00: 0.10 (no) · da +0.10: 0.00 → SCEGLIE COLONNA DESTRA!' : 'Distance to −0.10: 0.20 · to 0.00: 0.10 · to +0.10: 0.00 → SELECTS RIGHT COLUMN!',
              '#60a5fa');
          } else if (t < 36.5) {
            drawStepCard(ctx, w, 'PARTE B · RIGA',
              it ? 'Troviamo d₁ = 0.00 m → Come sceglie la RIGA?' : 'Find d₁ = 0.00 m → How does it pick the ROW?',
              'd_seg = 0.150 m  →  d₁ = 0.150 − 0.040 − 0.110 = 0.00 m  |  Righe: [+0.05, 0.00, −0.05]',
              it ? 'Distanza da +0.05: 0.05 (no) · da 0.00: 0.00 (sì!) · da −0.05: 0.05 → SCEGLIE RIGA CENTRALE!' : 'Distance to +0.05: 0.05 · to 0.00: 0.00 (match!) · to −0.05: 0.05 → SELECTS CENTER ROW!',
              '#e07a5f');
          } else {
            api.setAnchor('seg1-vote-src', (px1.px + px2.px) * 0.5, (px1.py + px2.py) * 0.5);
            drawStepCard(ctx, w, 'INCROCIO → +1',
              it ? 'Incrocio Riga Centrale (0.00) ∩ Colonna Destra (+0.10)' : 'Intersection: Center Row (0.00) ∩ Right Column (+0.10)',
              'Riga 2 (d = 0.00 m)  ×  Colonna 3 (φ = +0.10 rad)  →  Casella (2, 3) riceve +1 VOTO!',
              it ? 'Tutto questo calcolo geometrico serviva solo a piazzare +1 nella casella giusta!' : 'This entire geometric calculation was solely to place +1 in the matching grid cell!',
              '#34d399');
          }
          return;
        }

        // SCENA 4: PASSO 4 (DAI 20 SEGMENTI ALLA TABELLA DELLA TELECAMERA L)
        if (t < 49.5) {
          api.setMode(it ? 'PASSO 4 · 20 VOTI → TABELLA L' : 'STEP 4 · 20 VOTES → TABLE L', 'gold');
          var tf4 = makeLocalFrame(w, h);
          drawLocalAxes(ctx, tf4, lang);

          var p14 = { x: 0.500, y: -0.201 }, p24 = { x: 0.600, y: -0.211 };
          var tx4 = 0.995, ty4 = -0.100;
          var lA4 = tf4.toPx(p14.x - 0.56 * tx4, p14.y - 0.56 * ty4);
          var lB4 = tf4.toPx(p24.x + 0.14 * tx4, p24.y + 0.14 * ty4);
          ctx.save();
          ctx.strokeStyle = 'rgba(244,244,246,0.16)'; ctx.lineWidth = 13;
          ctx.beginPath(); ctx.moveTo(lA4.px, lA4.py); ctx.lineTo(lB4.px, lB4.py); ctx.stroke();
          var yA4 = tf4.toPx(0.05, 0.105), yB4 = tf4.toPx(0.72, 0.038);
          ctx.strokeStyle = 'rgba(255,208,0,0.22)'; ctx.lineWidth = 6;
          if (ctx.setLineDash) ctx.setLineDash([14, 10]);
          ctx.beginPath(); ctx.moveTo(yA4.px, yA4.py); ctx.lineTo(yB4.px, yB4.py); ctx.stroke();
          if (ctx.setLineDash) ctx.setLineDash([]);

          var bRatio = C.invLerp(41.0, 48.2, t);
          var cnt = Math.min(20, Math.floor(bRatio * 20) + 1);
          api.setCoords(cnt + ' / 20 segmenti scrutinati → L');
          for (var k = 0; k < cnt; k++) {
            var v = VOTE_BURST_SEQ[k];
            var sA = tf4.toPx(v.sx - 0.032, v.sy + 0.003), sB = tf4.toPx(v.sx + 0.032, v.sy - 0.003);
            var isRec = (bRatio * 20 - k) < 1.3;
            ctx.strokeStyle = v.src === 'white' ? (isRec ? '#e07a5f' : 'rgba(96,165,250,0.65)') : (isRec ? '#ffd000' : 'rgba(255,208,0,0.45)');
            ctx.lineWidth = isRec ? 4.6 : 2.6;
            ctx.beginPath(); ctx.moveTo(sA.px, sA.py); ctx.lineTo(sB.px, sB.py); ctx.stroke();
            api.setAnchor('vote-seg-' + k, (sA.px + sB.px) * 0.5, (sA.py + sB.py) * 0.5);
          }
          ctx.restore();

          drawStepCard(ctx, w, 'PASSO 4',
            it ? 'Scrutinio dei 20 Segmenti → Nasce la Tabella L (' + cnt + '/20)' : 'Tallying All 20 Segments → Building Table L (' + cnt + '/20)',
            '11 segmenti su 20 votano (0.00, +0.10) → L = 11/20 = 0.55 (55% dei voti)',
            it ? 'I pochi voti sbagliati (rumore camera) sono segmenti che "pensano" il robot sia altrove (≤ 0.15)' : 'Noisy outlier segments cast isolated votes in neighboring bins (≤ 0.15)',
            '#ffd000');
          return;
        }

        // SCENA 5: PASSO 5 (HADAMARD bel_bar ⊙ L, NORMALIZZAZIONE 85% & STERZATA)
        api.setMode(t < 54.0 ? (it ? 'PASSO 5A · HADAMARD bel_bar ⊙ L' : 'STEP 5A · HADAMARD bel_bar ⊙ L') : (it ? 'PASSO 5B · 85% & STERZATA -5.7°' : 'STEP 5B · 85% & STEER -5.7°'), 'emerald');
        var s5 = Math.min(w, h) * 1.42, cx5 = w * 0.50;
        drawRoadTopDown(ctx, w, h, cx5, s5, false, 0, lang);
        var steerP = C.easeInOutCubic(C.invLerp(56.5, 59.5, t));
        var curP5 = 0.10 * (1 - steerP);
        var by5 = h * 0.74 - steerP * 0.16 * s5;
        var bx5 = cx5 - Math.sin(steerP * Math.PI) * 0.006 * s5;
        api.setCoords(t < 54.0 ? '0.52 × 0.55 = 0.286 (Σ = 0.3375)' : '0.286 / 0.3375 = 0.85 (85%) · Sterza -5.7°');
        var gOk = ctx.createRadialGradient(bx5, by5, 6, bx5, by5, 0.11 * s5);
        gOk.addColorStop(0, 'rgba(52,211,153,0.34)'); gOk.addColorStop(1, 'rgba(52,211,153,0)');
        ctx.fillStyle = gOk; ctx.beginPath(); ctx.arc(bx5, by5, 0.11 * s5, 0, Math.PI * 2); ctx.fill();
        if (t >= 55.5 && steerP < 0.94) {
          ctx.save();
          ctx.strokeStyle = '#34d399'; ctx.lineWidth = 2.8;
          ctx.beginPath(); ctx.arc(bx5 + 44, by5 - 44, 44, Math.PI * 1.05, Math.PI * 1.50); ctx.stroke();
          var endA = Math.PI * 1.50;
          C.drawArrowHead(ctx, bx5 + 44 + Math.cos(endA) * 44, by5 - 44 + Math.sin(endA) * 44, endA + Math.PI * 0.5, 8.5, '#34d399');
          ctx.font = '700 11px "JetBrains Mono", monospace'; ctx.fillStyle = '#34d399'; ctx.textAlign = 'left';
          ctx.fillText(it ? 'Correzione -5.7° (-0.10 rad)' : 'Steer -5.7° (-0.10 rad)', bx5 + 50, by5 - 80);
          ctx.restore();
        }
        drawDuckiebot(ctx, bx5, by5, s5, curP5, { borderColor: '#34d399', fovAlpha: 0.24 });
        drawCandidateGridOnRoad(ctx, bx5, by5 - 82, s5, t < 54.0 ? MAT_PROD : MAT_BEL_NEW, 'post');

        if (t < 54.0) {
          drawStepCard(ctx, w, 'PASSO 5A',
            it ? 'Fusione Ruote × Telecamera: Prodotto di Hadamard (⊙)' : 'Wheels × Camera Fusion: Hadamard Product (⊙)',
            'Cella (0.00, +0.10): 0.52 (ruote) × 0.55 (camera) = 0.286   |   Somma S = 0.3375',
            it ? 'Moltiplicando cella per cella, i voti rumorosi vengono schiacciati (0.13 × 0.15 = 0.020)' : 'Multiplying element-wise crushes noisy votes (0.13 × 0.15 = 0.020)',
            '#ffd000');
        } else {
          drawStepCard(ctx, w, 'PASSO 5B',
            it ? 'Normalizzazione (÷ 0.3375) → Certezza 85% & Sterzata' : 'Normalization (÷ 0.3375) → 85% Confidence & Steering',
            'bel(0.00, +0.10) = 0.286 / 0.3375 = 0.85 (85%)   →   argmax = (0.00 m, +0.10 rad)',
            it ? 'Certezza: 60% (inizio) → 52% (al buio) → 85% (con camera)! Sterza a dx di −5.7°' : 'Confidence: 60% (prior) → 52% (blind) → 85% (fused)! Steers right by −5.7°',
            '#34d399');
        }
      },

      renderPanel: function (t, lang, api) {
        var it = lang === 'it';

        // PASSO 1: PRIOR (0.0s - 9.0s)
        if (t < 9.0) {
          var rev = t < 2.0 ? 1 : Math.min(9, Math.floor(C.invLerp(2.0, 6.5, t) * 9) + 1);
          api.renderFormula(
            it ? 'Passo 1 · Cosa c’è nella testa del robot (histogram_prior)' : 'Step 1 · Inside the Robot’s Head (histogram_prior)',
            [
              { tex: '1)\\; \\operatorname{bel}(x_t) = \\sum_{i=1}^{N} w_t^i\\,\\delta(x_t - x^i), \\quad x^i = (d^i, \\varphi^i), \\quad N = 9' },
              { tex: '2)\\; \\delta(x_t - x^i):\\; \\text{probabilità } w_t^i \\text{ concentrata nella casella } i, \\quad \\sum_{i=1}^9 w_t^i = 1.00', opacity: t >= 2.0 ? 1 : 0.45 },
              { tex: '3)\\; \\text{Centro } (0.00, 0.00) = {\\color{#ffd000}0.60\\;(60\\%)}, \\quad 4\\text{ vicini} = 0.10, \\quad \\text{angoli} = 0.00', opacity: t >= 4.0 ? 1 : 0.35 }
            ]
          );
          api.setDataHTML(C.renderMatrixHTML({
            id: 'prior', title: it ? 'Tabella del Passo 1: bel (Battaglia Navale 3×3)' : 'Step 1 Table: bel (3×3 Battleship Grid)', plainTitle: 'bel',
            subtitle: (it ? '0.10 + 0.10 + 0.60 + 0.10 + 0.10 = 1.00' : 'Sum = 1.00 · Peak = 0.60 (60%)'),
            corner: 'd \\ φ', rowLabels: D_LABELS, colLabels: PHI_LABELS,
            matrix: MAT_PRIOR, decimals: 2, tint: 'gold', activeCell: rev >= 5 ? { r: 1, c: 1 } : null, reveal: rev
          }));
          return;
        }

        // PASSO 2A: SHIFT RUOTE (9.0s - 18.0s)
        if (t < 18.0) {
          var shP = C.easeInOutCubic(C.invLerp(13.5, 16.0, t));
          api.renderFormula(
            it ? 'Passo 2A · Movimento a Occhi Chiusi & Shift della Tabella' : 'Step 2A · Blind Motion & Table Shift',
            [
              { tex: '1)\\; d_A = \\frac{d_L + d_R}{2} = \\frac{0.095 + 0.105}{2} = \\mathbf{0.10\\text{ m}}, \\quad w = \\frac{0.105 - 0.095}{0.10} = {\\color{#ffd000}\\mathbf{+0.10\\text{ rad}}}', anchor: 'eq-enc' },
              { tex: '2)\\; \\text{Righe: } d_t = d + 0.10\\sin(0) = d\\;(\\mathbf{0\\text{ righe}}), \\quad \\text{Colonne: } \\varphi_t = \\varphi + 0.10\\;(\\mathbf{+1\\text{ col. a dx}})', opacity: t >= 12.0 ? 1 : 0.4 },
              { tex: '3)\\; \\text{Bordo destro: il vecchio } 0.10 \\text{ si somma allo } 0.60 \\text{ che arriva da sx} \\implies {\\color{#60a5fa}\\mathbf{0.70}}', opacity: t >= 14.0 ? 1 : 0.3 }
            ],
            null, 'cyan'
          );
          var curM = shP < 0.5 ? MAT_PRIOR : MAT_SHIFT;
          var shPx = shP < 0.5 ? shP * 36 : (1 - shP) * -14;
          api.setDataHTML(C.renderMatrixHTML({
            id: 'shift',
            title: shP < 0.5 ? (it ? 'Prima dello shift (bel del Passo 1)' : 'Before shift (Step 1 bel)') : (it ? 'Dopo lo shift (+1 colonna a destra)' : 'After shift (+1 column right)'),
            plainTitle: 'shift(bel)',
            subtitle: shP < 0.5 ? 'Picco 0.60 @ (0.00, 0.00)' : '0.60 + 0.10 = 0.70 @ (0.00, +0.10)',
            corner: 'd \\ φ', rowLabels: D_LABELS, colLabels: PHI_LABELS,
            matrix: curM, decimals: 2, tint: 'cyan',
            activeCell: shP < 0.5 ? { r: 1, c: 1 } : { r: 1, c: 2 },
            shiftPx: shPx
          }));
          return;
        }

        // PASSO 2B: SFOCATURA GAUSSIANA * G_cov_mask (18.0s - 27.0s)
        if (t < 27.0) {
          var blP = C.easeInOutCubic(C.invLerp(19.0, 24.5, t));
          var curB = MAT_SHIFT.map(function (row, r) { return row.map(function (v, c) { return C.lerp(v, MAT_BEL_BAR[r][c], blP); }); });
          api.renderFormula(
            it ? 'Passo 2B · La "Spugna Sfocante" (* G_cov_mask → bel_bar)' : 'Step 2B · Gaussian Blur (* G_cov_mask → bel_bar)',
            [
              { tex: '1)\\; \\text{Regola sfocatura: ogni cella tiene il } \\mathbf{60\\%} \\text{ e cede il } \\mathbf{10\\%} \\text{ a ciascuno dei 4 vicini}' },
              { tex: '2)\\; \\text{Cella } (0.00, +0.10):\\; \\text{tiene } 60\\% + 10\\%_{(\\text{bordo dx})} = 70\\% \\text{ di } 0.70 = \\mathbf{0.49}', opacity: t >= 19.5 ? 1 : 0.4 },
              { tex: '3)\\; \\text{Riceve } +0.01_{(\\text{su})} + 0.01_{(\\text{giù})} + 0.01_{(\\text{sx})} \\implies 0.49 + 0.03 = {\\color{#ffd000}\\mathbf{0.52}}', opacity: t >= 21.5 ? 1 : 0.35 }
            ],
            null, 'gold'
          );
          api.setDataHTML(C.renderMatrixHTML({
            id: 'pred',
            title: it ? 'Tabella Predetta bel_bar (dopo sfocatura * G)' : 'Predicted Table bel_bar (after blur * G)',
            plainTitle: 'bel_bar',
            subtitle: '0.70 → ' + C.lerp(0.70, 0.52, blP).toFixed(2) + ' · Somma = 1.00',
            corner: 'd \\ φ', rowLabels: D_LABELS, colLabels: PHI_LABELS,
            matrix: curB, decimals: 2, tint: 'gold', activeCell: { r: 1, c: 2 }, blurWave: blP
          }));
          return;
        }

        // PASSO 3: DA 1 PEZZETTO DI STRISCIA A 1 SINGOLO VOTO (27.0s - 40.5s)
        if (t < 40.5) {
          var isPartA = t < 31.5;
          var isPartB = t >= 31.5 && t < 36.5;
          var isPartC = t >= 36.5;

          if (isPartA) {
            api.renderFormula(
              it ? 'Passo 3 · Parte A: Calcolo di φ₁ → Come sceglie la COLONNA?' : 'Step 3 · Part A: Compute φ₁ → How does it pick the COLUMN?',
              [
                { tex: '1)\\; p_2 - p_1 = \\begin{bmatrix} 0.100 \\\\ -0.010 \\end{bmatrix}, \\; \\|\\Delta p\\| = 0.1005 \\implies \\hat{t} = \\frac{p_2 - p_1}{0.1005} = \\begin{bmatrix} 0.995 \\\\ -0.100 \\end{bmatrix}' },
                { tex: '2)\\; \\varphi_1 = -\\arcsin(t_y) = -\\arcsin(-0.100) = {\\color{#ffd000}\\mathbf{+0.10\\text{ rad}}}', anchor: 'eq-phi-out' },
                { tex: '3)\\; \\textbf{Scelta COLONNA } \\{-0.10,\\, 0.00,\\, +0.10\\}:\\; \\text{più vicino a } {\\color{#60a5fa}\\mathbf{+0.10\\text{ rad (Colonna Destra)}}}' }
              ],
              null, 'cyan'
            );
          } else if (isPartB) {
            api.renderFormula(
              it ? 'Passo 3 · Parte B: Calcolo di d₁ → Come sceglie la RIGA?' : 'Step 3 · Part B: Compute d₁ → How does it pick the ROW?',
              [
                { tex: '4)\\; \\hat{n} = \\begin{bmatrix} -t_y \\\\ t_x \\end{bmatrix} = \\begin{bmatrix} +0.100 \\\\ +0.995 \\end{bmatrix} \\implies |\\hat{n}\\cdot p_1| = 0.150\\text{ m},\\; |\\hat{n}\\cdot p_2| = 0.150\\text{ m} \\implies d_{\\text{seg}} = 0.150\\text{ m}' },
                { tex: '5)\\; d_1 = d_{\\text{seg}} - w_{\\text{white}} - \\tfrac{w_{\\text{lane}}}{2} = 0.150 - 0.040 - 0.110 = {\\color{#34d399}\\mathbf{0.00\\text{ m}}}', anchor: 'eq-di-out' },
                { tex: '6)\\; \\textbf{Scelta RIGA } \\{+0.05,\\, 0.00,\\, -0.05\\}:\\; \\text{coincide con } {\\color{#34d399}\\mathbf{0.00\\text{ m (Riga Centrale)}}}' }
              ],
              null, 'coral'
            );
          } else {
            api.renderFormula(
              it ? 'Passo 3 · Incrocio Riga ∩ Colonna → +1 Voto del Segmento #1' : 'Step 3 · Row ∩ Column Intersection → +1 Vote from Segment #1',
              [
                { tex: '\\text{Parte A (angolo } \\varphi_1 = +0.10\\text{ rad)} \\;\\longrightarrow\\; {\\color{#60a5fa}\\textbf{SCEGLIE COLONNA DESTRA } (+0.10)}' },
                { tex: '\\text{Parte B (distanza } d_1 = 0.00\\text{ m)} \\;\\longrightarrow\\; {\\color{#34d399}\\textbf{SCEGLIE RIGA CENTRALE } (0.00)}' },
                { tex: '\\textbf{Incrocio } (d=0.00\\text{ m},\\; \\varphi=+0.10\\text{ rad}) \\;\\longrightarrow\\; \\text{piazza } {\\color{#ffd000}\\mathbf{+1\\text{ VOTO}}} \\text{ nella casella } (2,3)!' }
              ],
              null, 'emerald'
            );
          }

          var voteMat = isPartC ? [[0, 0, 0], [0, 0, 1], [0, 0, 0]] : [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
          var subTitle3 = isPartA
            ? (it ? 'φ₁ = +0.10 rad → illumina la COLONNA DESTRA (+0.10)' : 'φ₁ = +0.10 rad → highlights RIGHT COLUMN (+0.10)')
            : isPartB
              ? (it ? 'd₁ = 0.00 m → illumina la RIGA CENTRALE (0.00)' : 'd₁ = 0.00 m → highlights CENTER ROW (0.00)')
              : (it ? 'Incrocio (0.00 m, +0.10 rad) → riceve +1 VOTO!' : 'Intersection (0.00 m, +0.10 rad) → receives +1 VOTE!');

          api.setDataHTML(C.renderMatrixHTML({
            id: 'V1',
            title: it ? 'Griglia 3×3: Scelta Casella del Segmento #1' : '3×3 Grid: Cell Selection for Segment #1',
            plainTitle: 'Voto #1',
            subtitle: subTitle3,
            corner: 'd \\ φ',
            rowLabels: D_LABELS,
            colLabels: PHI_LABELS,
            matrix: voteMat,
            decimals: 0,
            tint: isPartC ? 'emerald' : isPartB ? 'coral' : 'cyan',
            hiCol: 2,
            hiRow: isPartB || isPartC ? 1 : -1,
            activeCell: isPartC ? { r: 1, c: 2 } : null,
            winCell: isPartC ? { r: 1, c: 2 } : null,
            subFn: function (r, c) {
              if (isPartC && r === 1 && c === 2) return it ? '+1 voto!' : '+1 vote!';
              if (isPartA && c === 2) return it ? 'col ✓' : 'col ✓';
              if (isPartB && r === 1 && c === 2) return it ? 'riga ∩ col' : 'row ∩ col';
              if (isPartB && r === 1) return it ? 'riga ✓' : 'row ✓';
              return '';
            }
          }));
          return;
        }

        // PASSO 4: DAI 20 VOTI ALLA TABELLA DELLA TELECAMERA L (40.5s - 49.5s)
        if (t < 49.5) {
          var br = C.invLerp(41.0, 48.2, t), cnt = Math.min(20, Math.floor(br * 20) + 1);
          var counts = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
          for (var k = 0; k < cnt; k++) counts[VOTE_BURST_SEQ[k].r][VOTE_BURST_SEQ[k].c] += 1;
          var curL = counts.map(function (row) { return row.map(function (v) { return v / cnt; }); });
          var actL = { r: VOTE_BURST_SEQ[cnt - 1].r, c: VOTE_BURST_SEQ[cnt - 1].c };
          var subFn = function (r, c) { return counts[r][c] > 0 ? String(counts[r][c]) + (it ? ' voti' : 'v') : ''; };

          api.renderFormula(
            it ? 'Passo 4 · Costruzione della Tabella Telecamera L (20 Segmenti)' : 'Step 4 · Building Camera Likelihood Table L (20 Segments)',
            [
              { tex: '1)\\; \\text{Tutti i 20 segmenti del frame eseguono il Passo 3 e depositano } \\mathbf{+1\\text{ voto}}' },
              { tex: '2)\\; \\text{Cella } (0.00, +0.10):\\; \\mathbf{' + counts[1][2] + '\\text{ voti su }' + cnt + '} \\implies L_{(0.00,+0.10)} = \\frac{' + counts[1][2] + '}{' + cnt + '} = {\\color{#ffd000}\\mathbf{' + (counts[1][2] / cnt).toFixed(2) + '}}' },
              { tex: '3)\\; \\text{A fine scrutinio (20/20): } \\frac{11}{20} = \\mathbf{0.55}, \\quad \\text{voti rumorosi vicini } \\le 0.15, \\quad \\sum L = 1.00' }
            ],
            null, 'cyan'
          );
          api.setDataHTML(C.renderMatrixHTML({
            id: 'L',
            title: it ? 'Tabella del Passo 4: Verosimiglianza Camera L' : 'Step 4 Table: Camera Likelihood L',
            plainTitle: 'L',
            subtitle: cnt + ' / 20 segmenti · Σ = 1.00',
            corner: 'd \\ φ', rowLabels: D_LABELS, colLabels: PHI_LABELS,
            matrix: curL, decimals: 2, tint: 'cyan',
            activeCell: actL, winCell: cnt === 20 ? { r: 1, c: 2 } : null, subFn: subFn
          }));
          return;
        }

        // PASSO 5: HADAMARD bel_bar ⊙ L, NORMALIZZAZIONE (85%) & STERZATA (49.5s - 60.0s)
        var isNormPhase = t >= 54.0;
        var normP = C.easeInOutCubic(C.invLerp(54.0, 56.5, t));
        var lockA = t >= 56.5;

        if (!isNormPhase) {
          api.renderFormula(
            it ? 'Passo 5A · Fusione Ruote × Camera (Prodotto di Hadamard ⊙)' : 'Step 5A · Wheels × Camera Fusion (Hadamard Product ⊙)',
            [
              { tex: '1)\\; \\widetilde{\\operatorname{bel}}_{r,c} = \\overline{\\operatorname{bel}}_{r,c} \\times L_{r,c} \\quad (\\text{moltiplicazione casella per casella})' },
              { tex: '2)\\; \\text{Casella } (0.00, +0.10):\\; {\\color{#ffd000}0.52}_{(\\text{ruote})} \\times {\\color{#60a5fa}0.55}_{(\\text{camera})} = {\\color{#34d399}\\mathbf{0.286}}', anchor: 'hadamard-res' },
              { tex: '3)\\; \\text{Somma totale dei prodotti: } S = 0.001 + 0.015 + 0.020 + 0.286 + 0.001 + 0.015 = \\mathbf{0.3375}' }
            ]
          );
          api.setDataHTML(
            '<div class="cn-hadamard-grid">' +
            '<div class="cn-hadamard-box">' + C.renderMatrixHTML({ id: 'hBel', title: it ? 'Ruote (bel_bar)' : 'Wheels (bel_bar)', plainTitle: 'bel_bar', corner: '', rowLabels: D_SHORT, colLabels: PHI_LABELS, matrix: MAT_BEL_BAR, decimals: 2, tint: 'gold', activeCell: { r: 1, c: 2 }, compact: true }) + '</div>' +
            '<div class="cn-hadamard-box">' + C.renderMatrixHTML({ id: 'hL', title: it ? 'Camera (L)' : 'Camera (L)', plainTitle: 'L', corner: '', rowLabels: D_SHORT, colLabels: PHI_LABELS, matrix: MAT_L, decimals: 2, tint: 'cyan', activeCell: { r: 1, c: 2 }, compact: true }) + '</div>' +
            '<div class="cn-hadamard-box win">' + C.renderMatrixHTML({ id: 'hProd', title: 'bel_bar ⊙ L (Σ = 0.3375)', plainTitle: 'bel_bar ⊙ L', corner: '', rowLabels: D_SHORT, colLabels: PHI_LABELS, matrix: MAT_PROD, decimals: 3, tint: 'emerald', activeCell: { r: 1, c: 2 }, crossed: ['0-0', '1-0', '2-0'], winCell: { r: 1, c: 2 }, compact: true }) + '</div>' +
            '</div>'
          );
          return;
        }

        var curF = MAT_PROD.map(function (row, r) { return row.map(function (v, c) { return C.lerp(v, MAT_BEL_NEW[r][c], normP); }); });
        api.renderFormula(
          it ? 'Passo 5B · Normalizzazione (÷ 0.3375) → Certezza 85% & Sterzata' : 'Step 5B · Normalization (÷ 0.3375) → 85% Confidence & Steering',
          [
            { tex: '1)\\; \\operatorname{bel}_{(0.00,\\,+0.10)} = \\frac{0.286}{0.3375} = {\\color{#34d399}\\mathbf{' + C.lerp(0.286, 0.85, normP).toFixed(2) + '\\;(85\\%)}}, \\quad \\operatorname{bel}_{(0.00,\\,0.00)} = \\frac{0.020}{0.3375} = 0.06', anchor: 'sum-target' },
            { tex: '2)\\; (d^*, \\varphi^*) = \\arg\\max \\operatorname{bel} = {\\color{#34d399}\\mathbf{(0.00\\text{ m},\\; +0.10\\text{ rad})}} \\quad (\\text{certezza: } 60\\% \\to 52\\% \\to \\mathbf{85\\%})' },
            { tex: '3)\\; \\text{Il muso è a sinistra di } +0.10\\text{ rad } (+5.7^\\circ) \\implies \\text{sterzata di correzione } {\\color{#34d399}\\mathbf{-5.7^\\circ\\text{ a destra}}}' }
          ],
          null, 'emerald'
        );
        api.setDataHTML(C.renderMatrixHTML({
          id: 'final',
          title: it ? 'Tabella Finale Posteriore bel (Σ = 1.00)' : 'Final Posterior Table bel (Σ = 1.00)',
          plainTitle: 'bel_new',
          subtitle: '85% @ (d = 0.00 m, φ = +0.10 rad)',
          corner: 'd \\ φ', rowLabels: D_LABELS, colLabels: PHI_LABELS,
          matrix: curF, decimals: 2, tint: 'emerald', winCell: { r: 1, c: 2 },
          reticle: lockA ? { r: 1, c: 2 } : null,
          subFn: function (r, c) { return lockA && r === 1 && c === 2 ? '85% argmax' : ''; }
        }));
      },

      renderBeams: function (t, lang, api) {
        var out = '';
        if (t >= 11.2 && t <= 13.4) {
          out += C.buildFlightSVG(api.getAnchor('wheel-L'), api.getAnchor('eq-enc'), C.invLerp(11.2, 12.5, t), '0.095', '#60a5fa', -34);
          out += C.buildFlightSVG(api.getAnchor('wheel-R'), api.getAnchor('eq-enc'), C.invLerp(11.5, 12.8, t), '0.105', '#e07a5f', -54);
          out += C.buildFlightSVG(api.getAnchor('wheel-base'), api.getAnchor('eq-enc'), C.invLerp(11.8, 13.1, t), '0.10', '#ffd000', 34);
        }
        if (t >= 29.6 && t <= 31.4) {
          var pCol = C.invLerp(29.6, 30.8, t);
          out += C.buildLaserBeamSVG(api.getAnchor('eq-phi-out'), api.getAnchor('cell-V1-0-2'), pCol, '#60a5fa', -12);
          out += C.buildLaserBeamSVG(api.getAnchor('eq-phi-out'), api.getAnchor('cell-V1-1-2'), pCol, '#60a5fa', 4);
          out += C.buildLaserBeamSVG(api.getAnchor('eq-phi-out'), api.getAnchor('cell-V1-2-2'), pCol, '#60a5fa', 16);
        }
        if (t >= 34.5 && t <= 36.4) {
          var pRow = C.invLerp(34.5, 35.8, t);
          out += C.buildLaserBeamSVG(api.getAnchor('eq-di-out'), api.getAnchor('cell-V1-1-0'), pRow, '#34d399', -8);
          out += C.buildLaserBeamSVG(api.getAnchor('eq-di-out'), api.getAnchor('cell-V1-1-1'), pRow, '#34d399', 0);
          out += C.buildLaserBeamSVG(api.getAnchor('eq-di-out'), api.getAnchor('cell-V1-1-2'), pRow, '#34d399', 12);
        }
        if (t >= 36.6 && t <= 39.2) {
          out += C.buildFlightSVG(api.getAnchor('seg1-vote-src'), api.getAnchor('cell-V1-1-2'), C.invLerp(36.6, 38.2, t), '+1 VOTO', '#34d399', -32);
        }
        if (t >= 41.0 && t <= 48.4) {
          var br = C.invLerp(41.0, 48.2, t), fIdx = br * 20;
          for (var k = Math.max(0, Math.floor(fIdx) - 2); k <= Math.min(19, Math.floor(fIdx)); k++) {
            var v = VOTE_BURST_SEQ[k];
            out += C.buildFlightSVG(api.getAnchor('vote-seg-' + k), api.getAnchor('cell-L-' + v.r + '-' + v.c), C.clamp(fIdx - k, 0, 1), '+1', v.r === 1 && v.c === 2 ? '#ffd000' : '#60a5fa', -28 - (k % 3) * 10);
          }
        }
        if (t >= 50.2 && t <= 53.2) {
          var pw = C.invLerp(50.2, 51.8, t);
          out += C.buildFlightSVG(api.getAnchor('cell-hBel-1-2'), api.getAnchor('hadamard-res'), pw, '0.52', '#ffd000', -28);
          out += C.buildFlightSVG(api.getAnchor('cell-hL-1-2'), api.getAnchor('hadamard-res'), pw, '0.55', '#60a5fa', -28);
          if (t >= 51.8) out += C.buildLaserBeamSVG(api.getAnchor('hadamard-res'), api.getAnchor('cell-hProd-1-2'), C.invLerp(51.8, 52.8, t), '#34d399', -14);
        }
        return out;
      },

      formatTooltip: function (info, lang) {
        var it = lang === 'it';
        if (info.r === undefined || info.c === undefined) {
          return '<div style="font-weight:700;color:#ffd000;">' + (info.val || '') + '</div>';
        }
        var dVal = D_BINS[info.r], pVal = PHI_BINS[info.c];
        if (dVal === undefined || pVal === undefined) return '';
        var deg = (pVal * 180 / Math.PI).toFixed(1);
        return '<div style="font-size:10px;color:#94a3b8;">' + info.id + '</div>' +
          '<div style="font-weight:700;color:#fff;">d = ' + D_SHORT[info.r] + ' m · φ = ' + PHI_LABELS[info.c] + ' rad (' + deg + '°)</div>' +
          '<div style="font-weight:700;color:#ffd000;margin-top:2px;">' + (it ? 'Probabilità: ' : 'Probability: ') + info.val + '</div>';
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
