/* LAB 02: Particle Filter (MCL) — 6-Scene 12-Particle Bimodal, Roulette & Kidnapping Walkthrough */
(function () {
  'use strict';

  function init() {
    var C = window.CinemaLabs;
    if (!C) return;

    var M = 12;
    var X0 = [0.40, 1.20, 2.00, 2.80, 3.60, 4.40, 5.20, 6.00, 6.80, 7.60, 8.40, 9.20];
    var EPS = [-0.14, 0.18, -0.06, 0.11, -0.19, 0.08, -0.12, 0.16, -0.08, 0.15, -0.11, 0.05];
    var X1 = X0.map(function (x, i) { return C.clamp(x + 0.60 + EPS[i], 0.2, 9.8); });
    var X2 = X1.map(function (x, i) { return C.clamp(x + 0.40 + EPS[(i + 3) % M] * 0.5, 0.2, 9.8); });

    function gaussUnnorm(x, mu, sig) {
      var z = (x - mu) / sig;
      return Math.exp(-0.5 * z * z);
    }
    function normalize(arr) {
      var s = 0;
      for (var i = 0; i < arr.length; i++) s += arr[i];
      return arr.map(function (v) { return s > 0 ? v / s : 1 / arr.length; });
    }
    function calcNeff(w) {
      var sq = 0;
      for (var i = 0; i < w.length; i++) sq += w[i] * w[i];
      return sq > 0 ? 1 / sq : 0;
    }

    var W_UNIF = X0.map(function () { return 1 / M; });
    var W_BIMODAL = normalize(X1.map(function (x) {
      return gaussUnnorm(x, 2.0, 0.52) + gaussUnnorm(x, 8.0, 0.52) + 0.015;
    }));
    var W_UNIMODAL = normalize(X2.map(function (x, i) {
      return W_BIMODAL[i] * (gaussUnnorm(x, 8.6, 0.45) + 0.004);
    }));

    // Low-variance deterministic resampling from W_UNIMODAL with r = 0.03
    var R_OFFSET = 0.03;
    var RESAMPLED_SRC = [];
    var cum = 0, ptr = 0;
    for (var sIdx = 0; sIdx < M; sIdx++) {
      var u = R_OFFSET + sIdx / M;
      while (ptr < M - 1 && cum + W_UNIMODAL[ptr] < u) {
        cum += W_UNIMODAL[ptr];
        ptr++;
      }
      RESAMPLED_SRC.push(ptr);
    }
    var X_RESAMPLED = RESAMPLED_SRC.map(function (src, i) {
      return C.clamp(X2[src] + EPS[i] * 0.6, 0.2, 9.8);
    });

    // Scene 5 Kidnap at x = 2.0: 10 particles near 8.6 + 2 alpha-injected explorers near 1.9 & 2.2
    var X_KIDNAP = [8.42, 8.55, 8.61, 8.68, 8.74, 8.50, 8.63, 8.71, 8.58, 8.66, 1.92, 2.18];
    var W_KIDNAP_RECOV = normalize(X_KIDNAP.map(function (x) {
      return gaussUnnorm(x, 2.0, 0.45) + 0.008;
    }));

    var SCENES = [
      { id: 0, start: 0.0,  end: 9.0,  tag: 'init (M = 12)',          shortEn: '0. Uniform',    shortIt: '0. Uniforme' },
      { id: 1, start: 9.0,  end: 18.0, tag: 'predict (+u + Q)',       shortEn: '1. Predict',    shortIt: '1. Moto' },
      { id: 2, start: 18.0, end: 29.0, tag: 'weight (bimodal)',       shortEn: '2. 2 Doors',    shortIt: '2. 2 Porte' },
      { id: 3, start: 29.0, end: 39.0, tag: 'degeneracy (N_eff)',     shortEn: '3. Lock & Deg', shortIt: '3. Degenera' },
      { id: 4, start: 39.0, end: 50.0, tag: 'low-variance O(M)',      shortEn: '4. Roulette',   shortIt: '4. Ruota' },
      { id: 5, start: 50.0, end: 60.0, tag: 'kidnap + α-trick',       shortEn: '5. α-Trick',    shortIt: '5. α-Trick' }
    ];

    function drawCorridor(ctx, w, h, xToPx, trackY, showBeacon, robotX, lang) {
      var xL = xToPx(0), xR = xToPx(10);
      ctx.save();
      // Corridor floor
      ctx.fillStyle = '#101016';
      ctx.fillRect(xL, trackY - 34, xR - xL, 68);
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(xL, trackY - 34, xR - xL, 68);

      // Two identical doors at x=2.0 m and x=8.0 m
      [2.0, 8.0].forEach(function (dx, idx) {
        var px = xToPx(dx);
        ctx.fillStyle = 'rgba(224, 122, 95, 0.22)';
        ctx.strokeStyle = '#e07a5f';
        ctx.lineWidth = 1.6;
        ctx.fillRect(px - 14, trackY - 34, 28, 12);
        ctx.strokeRect(px - 14, trackY - 34, 28, 12);
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#e07a5f';
        ctx.textAlign = 'center';
        ctx.fillText((lang === 'it' ? 'Porta ' : 'Door ') + (idx + 1) + ' (' + dx.toFixed(0) + 'm)', px, trackY - 40);
      });

      // Asymmetric landmark at x=8.6 m
      if (showBeacon) {
        var bx = xToPx(8.6);
        ctx.fillStyle = 'rgba(52, 211, 153, 0.25)';
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(bx, trackY - 26, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        ctx.fillStyle = '#34d399';
        ctx.textAlign = 'center';
        ctx.fillText('Tag (8.6m)', bx, trackY - 54);
      }

      // Ruler ticks
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#7c7c94';
      ctx.textAlign = 'center';
      for (var m = 0; m <= 10; m += 2) {
        var tx = xToPx(m);
        ctx.fillText(m + ' m', tx, trackY + 48);
      }

      // True robot marker
      if (robotX !== null) {
        var rx = xToPx(robotX);
        ctx.fillStyle = '#14141c';
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2;
        C.roundRect(ctx, rx - 14, trackY - 12, 28, 24, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#34d399';
        ctx.beginPath(); ctx.arc(rx + 6, trackY, 3, 0, Math.PI * 2); ctx.fill();
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(lang === 'it' ? 'Robot reale' : 'True robot', rx, trackY + 26);
      }
      ctx.restore();
    }

    function drawLikelihoodCurve(ctx, xToPx, baseY, height, evalFn, color) {
      ctx.save();
      ctx.beginPath();
      for (var xm = 0; xm <= 10; xm += 0.05) {
        var px = xToPx(xm);
        var py = baseY - evalFn(xm) * height;
        if (xm === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.lineTo(xToPx(10), baseY); ctx.lineTo(xToPx(0), baseY); ctx.closePath();
      ctx.fillStyle = color; ctx.globalAlpha = 0.16; ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath();
      for (var xm2 = 0; xm2 <= 10; xm2 += 0.05) {
        var px2 = xToPx(xm2), py2 = baseY - evalFn(xm2) * height;
        if (xm2 === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
      }
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }

    function drawParticles(ctx, xToPx, baseY, xs, ws, maxBarH, api, prefix, highlightAlphaIdx) {
      var maxW = 0.05;
      for (var k = 0; k < ws.length; k++) if (ws[k] > maxW) maxW = ws[k];
      for (var i = 0; i < xs.length; i++) {
        var px = xToPx(xs[i]);
        var hBar = (ws[i] / maxW) * maxBarH;
        var isAlpha = highlightAlphaIdx && i >= highlightAlphaIdx;
        var col = isAlpha ? '#34d399' : (ws[i] > 0.10 ? '#ffd000' : '#60a5fa');
        ctx.save();
        ctx.strokeStyle = col;
        ctx.lineWidth = ws[i] > 0.10 ? 4.5 : 2.5;
        ctx.beginPath(); ctx.moveTo(px, baseY); ctx.lineTo(px, baseY - Math.max(4, hBar)); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(px, baseY - Math.max(4, hBar), ws[i] > 0.10 ? 5.2 : 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        if (api && prefix) api.setAnchor(prefix + i, px, baseY - Math.max(4, hBar));
      }
    }

    function renderParticleList(xs, ws, lang, alphaFrom) {
      var html = '<div class="cn-pt-grid">';
      for (var i = 0; i < M; i++) {
        var pct = Math.round(ws[i] * 100);
        var cls = 'cn-pt-row' + (ws[i] > 0.12 ? ' hot' : ws[i] < 0.02 ? ' dead' : '');
        var col = (alphaFrom !== undefined && i >= alphaFrom) ? '#34d399' : (ws[i] > 0.12 ? '#ffd000' : '#60a5fa');
        html += '<div class="' + cls + '" data-anchor="pt-row-' + i + '" data-tip-id="pt" data-tip-r="' + i + '" data-tip-val="x=' + xs[i].toFixed(2) + ' m · w=' + ws[i].toFixed(3) + '">' +
          '<span style="color:#7c7c94;">#' + (i + 1) + '</span>' +
          '<span style="color:#f4f4f6;">' + xs[i].toFixed(2) + 'm</span>' +
          '<div class="cn-pt-bar-track"><div class="cn-pt-bar-fill" style="width:' + Math.min(100, pct * 2.2) + '%;background:' + col + ';"></div></div>' +
          '<span style="text-align:right;color:' + col + ';">' + pct + '%</span>' +
          '</div>';
      }
      html += '</div>';
      return html;
    }

    function getCurrentParticles(t) {
      if (t < 9.0) return { xs: X0, ws: W_UNIF };
      if (t < 18.0) {
        var p1 = C.easeInOutCubic(C.invLerp(9.5, 16.5, t));
        return { xs: X0.map(function (x, i) { return C.lerp(x, X1[i], p1); }), ws: W_UNIF };
      }
      if (t < 29.0) {
        var p2 = C.easeOutCubic(C.invLerp(19.5, 25.5, t));
        return { xs: X1, ws: W_UNIF.map(function (w, i) { return C.lerp(w, W_BIMODAL[i], p2); }) };
      }
      if (t < 39.0) {
        var p3 = C.easeInOutCubic(C.invLerp(30.0, 36.5, t));
        return {
          xs: X1.map(function (x, i) { return C.lerp(x, X2[i], Math.min(1, p3 * 1.4)); }),
          ws: W_BIMODAL.map(function (w, i) { return C.lerp(w, W_UNIMODAL[i], p3); })
        };
      }
      if (t < 50.0) {
        var p4 = C.easeInOutCubic(C.invLerp(45.0, 49.0, t));
        return {
          xs: X2.map(function (x, i) { return C.lerp(x, X_RESAMPLED[i], p4); }),
          ws: W_UNIMODAL.map(function (w, i) { return C.lerp(w, W_UNIF[i], p4); })
        };
      }
      var p5 = C.easeOutCubic(C.invLerp(53.0, 58.5, t));
      return { xs: X_KIDNAP, ws: W_UNIF.map(function (w, i) { return C.lerp(w, W_KIDNAP_RECOV[i], p5); }) };
    }

    C.mount({
      id: 'lab-pf',
      duration: 60.0,
      scenes: SCENES,
      mathTitleEn: 'Particle Set (M = 12)',
      mathTitleIt: 'Set di Particelle (M = 12)',

      getMetric: function (t) {
        var cur = getCurrentParticles(t);
        var neff = calcNeff(cur.ws);
        var col = neff < 3.5 ? '#e07a5f' : neff < 7 ? '#ffd000' : '#34d399';
        return { label: 'N_eff', pct: (neff / M) * 100, text: neff.toFixed(1) + ' / 12', color: col };
      },

      getSubtitle: function (t, lang) {
        var it = lang === 'it';
        if (t < 9.0) {
          return { color: '#60a5fa', text: it ? 'Localizzazione globale: 12 cloni vengono sparsi uniformemente nel corridoio con peso uguale \\(w_0^{[i]} = 1/12 = 0.083\\) (\\(N_{\\text{eff}} = 12.0\\)).' : 'Global localization: 12 clones are spread uniformly along the corridor with equal weight \\(w_0^{[i]} = 1/12 = 0.083\\) (\\(N_{\\text{eff}} = 12.0\\)).' };
        }
        if (t < 18.0) {
          return { color: '#ffd000', text: it ? 'Predizione stocastica: ogni clone avanza di \\(u = +0.60\\text{ m}\\) più un rumore indipendente \\(\\epsilon^{[i]} \\sim \\mathcal{N}(0, Q)\\).' : 'Stochastic predict: each clone advances by \\(u = +0.60\\text{ m}\\) plus an independent sample \\(\\epsilon^{[i]} \\sim \\mathcal{N}(0, Q)\\).' };
        }
        if (t < 29.0) {
          return { color: '#e07a5f', text: it ? 'Il sensore rileva una porta ma ci sono due porte identiche (\\(2\\text{ m}\\) e \\(8\\text{ m}\\)): la verosimiglianza \\(p(z_t\\mid x)\\) forma una distribuzione bimodale impossibile per un KF.' : 'The sensor detects a door, matching both identical doors (\\(2\\text{ m}\\) and \\(8\\text{ m}\\)): likelihood \\(p(z_t\\mid x)\\) creates a bimodal belief impossible for a KF.' };
        }
        if (t < 39.0) {
          return { color: '#e07a5f', text: it ? 'Il landmark asimmetrico a \\(8.6\\text{ m}\\) rompe la simmetria: il cluster sinistro si azzera e \\(N_{\\text{eff}}\\) crolla verso \\(2\\) (degenerazione dei pesi).' : 'The asymmetric landmark at \\(8.6\\text{ m}\\) breaks symmetry: the left cluster dies out and \\(N_{\\text{eff}}\\) drops near \\(2\\) (weight degeneracy).' };
        }
        if (t < 50.0) {
          return { color: '#ffd000', text: it ? 'Ruota a bassa varianza \\(\\mathcal{O}(M)\\): un solo offset \\(r\\) genera 12 raggi equidistanti \\(U_i = r + (i-1)/12\\) che duplicano i cloni vincenti e azzerano quelli morti.' : 'Low-variance roulette \\(\\mathcal{O}(M)\\): one offset \\(r\\) places 12 equidistant spokes \\(U_i = r + (i-1)/12\\), duplicating top clones and pruning dead ones.' };
        }
        return { color: '#34d399', text: it ? 'Kidnapping a \\(x = 2.0\\text{ m}\\): i cloni esploratori iniettati con \\(\\alpha\\text{-trick}\\) (#11, #12) intercettano la Porta 1 e recuperano la posizione.' : 'Kidnapping to \\(x = 2.0\\text{ m}\\): random \\(\\alpha\\text{-trick}\\) explorers (#11, #12) catch Door 1 and recover global localization.' };
      },

      drawCanvas: function (ctx, w, h, t, lang, api) {
        var it = lang === 'it';
        var pad = 34;
        var xToPx = function (xm) { return pad + (xm / 10) * (w - pad * 2); };
        var cur = getCurrentParticles(t);

        // Scene 4 shows the circular Low-Variance Roulette wheel on top + corridor below
        if (t >= 39.0 && t < 50.0) {
          api.setMode(it ? 'RUOTA A BASSA VARIANZA O(M)' : 'LOW-VARIANCE ROULETTE O(M)', 'gold');
          api.setCoords('U_i = 0.03 + (i - 1) / 12');

          var wheelCX = w * 0.5, wheelCY = h * 0.36, R = Math.min(w, h) * 0.27;
          var startAng = -Math.PI * 0.5;
          var acc = 0;
          for (var i = 0; i < M; i++) {
            var a0 = startAng + acc * Math.PI * 2;
            var a1 = startAng + (acc + W_UNIMODAL[i]) * Math.PI * 2;
            acc += W_UNIMODAL[i];
            if (W_UNIMODAL[i] > 0.01) {
              ctx.save();
              ctx.beginPath(); ctx.moveTo(wheelCX, wheelCY); ctx.arc(wheelCX, wheelCY, R, a0, a1); ctx.closePath();
              ctx.fillStyle = i === 9 ? 'rgba(255,208,0,0.42)' : i === 10 ? 'rgba(96,165,250,0.38)' : 'rgba(224,122,95,0.34)';
              ctx.fill();
              ctx.strokeStyle = '#08080a'; ctx.lineWidth = 1.5; ctx.stroke();
              var midA = (a0 + a1) * 0.5;
              if (W_UNIMODAL[i] > 0.08) {
                ctx.font = '700 10.5px "JetBrains Mono", monospace'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
                ctx.fillText('#' + (i + 1) + ' (' + Math.round(W_UNIMODAL[i] * 100) + '%)', wheelCX + Math.cos(midA) * R * 0.62, wheelCY + Math.sin(midA) * R * 0.62 + 4);
              }
              ctx.restore();
            }
          }
          // Draw rotating comb with 12 equidistant spokes
          var combP = C.easeOutCubic(C.invLerp(39.5, 44.5, t));
          var nSpokes = Math.min(M, Math.floor(combP * M) + 1);
          for (var s = 0; s < nSpokes; s++) {
            var ang = startAng + (R_OFFSET + s / M) * Math.PI * 2;
            ctx.strokeStyle = '#34d399'; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.moveTo(wheelCX, wheelCY); ctx.lineTo(wheelCX + Math.cos(ang) * (R + 10), wheelCY + Math.sin(ang) * (R + 10)); ctx.stroke();
            ctx.fillStyle = '#34d399';
            ctx.beginPath(); ctx.arc(wheelCX + Math.cos(ang) * (R + 10), wheelCY + Math.sin(ang) * (R + 10), 3, 0, Math.PI * 2); ctx.fill();
          }
          ctx.fillStyle = '#08080a'; ctx.beginPath(); ctx.arc(wheelCX, wheelCY, 14, 0, Math.PI * 2); ctx.fill();
          api.setAnchor('pf-wheel', wheelCX + R, wheelCY);

          drawCorridor(ctx, w, h, xToPx, h * 0.84, true, 8.6, lang);
          drawParticles(ctx, xToPx, h * 0.84, cur.xs, cur.ws, 42, api, 'pf-p-');
          return;
        }

        var baseY = h * 0.56, trackY = h * 0.78, barH = h * 0.34;
        var robotX = t < 9 ? 7.6 : t < 18 ? C.lerp(7.6, 8.2, C.easeInOutCubic(C.invLerp(9.5, 16.5, t))) : t < 29 ? 8.2 : t < 50 ? 8.6 : 2.0;

        if (t < 9.0) {
          api.setMode(it ? 'NUBE UNIFORME' : 'UNIFORM CLOUD', '');
          api.setCoords('M = 12 · w = 0.083');
        } else if (t < 18.0) {
          api.setMode(it ? 'PREDIZIONE STOCASTICA' : 'STOCHASTIC PREDICT', 'gold');
          api.setCoords('u = +0.60 m · noise Q');
        } else if (t < 29.0) {
          api.setMode(it ? 'VEROSIMIGLIANZA BIMODALE' : 'BIMODAL LIKELIHOOD', 'coral');
          api.setCoords(it ? '2 porte compatibili' : '2 matching doors');
          drawLikelihoodCurve(ctx, xToPx, baseY, barH, function (x) { return Math.min(1, gaussUnnorm(x, 2.0, 0.52) + gaussUnnorm(x, 8.0, 0.52)); }, '#e07a5f');
        } else if (t < 39.0) {
          api.setMode(it ? 'ROTTURA SIMMETRIA' : 'SYMMETRY BREAKING', 'coral');
          api.setCoords('Landmark @ 8.6 m');
          drawLikelihoodCurve(ctx, xToPx, baseY, barH, function (x) { return gaussUnnorm(x, 8.6, 0.45); }, '#34d399');
        } else {
          api.setMode(it ? 'KIDNAPPING & α-TRICK' : 'KIDNAPPING & α-TRICK', 'emerald');
          api.setCoords('Robot → 2.0 m · α = 15%');
          drawLikelihoodCurve(ctx, xToPx, baseY, barH, function (x) { return gaussUnnorm(x, 2.0, 0.45); }, '#34d399');
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(xToPx(0), baseY); ctx.lineTo(xToPx(10), baseY); ctx.stroke();

        drawCorridor(ctx, w, h, xToPx, trackY, t >= 29.0 && t < 50.0, robotX, lang);
        drawParticles(ctx, xToPx, baseY, cur.xs, cur.ws, barH, api, 'pf-p-', t >= 50.0 ? 10 : undefined);
      },

      renderPanel: function (t, lang, api) {
        var it = lang === 'it';
        var cur = getCurrentParticles(t);
        var neff = calcNeff(cur.ws);
        if (t < 9.0) {
          api.renderFormula(it ? 'Inizializzazione Monte Carlo' : 'Monte Carlo Initialization', [
            { tex: '\\chi_0 = \\{(x_0^{[i]}, w_0^{[i]})\\}_{i=1}^{12}, \\qquad w_0^{[i]} = \\frac{1}{12} = 0.083' },
            { tex: 'N_{\\text{eff}} = \\frac{1}{\\sum (w_0^{[i]})^2} = {\\color{#34d399}12.0}' }
          ], null, 'cyan');
        } else if (t < 18.0) {
          api.renderFormula(it ? 'Campionamento del Moto' : 'Stochastic Motion Sampling', [
            { tex: 'x_t^{[i]} \\sim p(x_t \\mid u_t, x_{t-1}^{[i]}) = x_{t-1}^{[i]} + 0.60 + \\epsilon^{[i]}' },
            { tex: '\\epsilon^{[i]} \\sim \\mathcal{N}(0, Q), \\qquad w_t^{[i]} = 0.083' }
          ]);
        } else if (t < 29.0) {
          api.renderFormula(it ? 'Pesatura Bimodale' : 'Bimodal Importance Weighting', [
            { tex: 'w_t^{[i]} = \\eta\\,p(z_t \\mid x_t^{[i]}), \\qquad N_{\\text{eff}} = {\\color{#ffd000}' + neff.toFixed(1) + '}' }
          ], '<span>' + (it ? 'Due picchi: 2.0 m e 8.0 m' : 'Two peaks: 2.0 m and 8.0 m') + '</span>', 'coral');
        } else if (t < 39.0) {
          api.renderFormula(it ? 'Degenerazione dei Pesi' : 'Weight Degeneracy', [
            { tex: 'w_t^{[i]} \\propto w_{t-1}^{[i]}\\,p(z_{\\text{tag}} \\mid x_t^{[i]}), \\qquad N_{\\text{eff}} = {\\color{#e07a5f}' + neff.toFixed(1) + '} < \\frac{M}{2}' }
          ], '<span>' + (it ? 'Richiesto ricampionamento' : 'Resampling triggered') + '</span>', 'coral');
        } else if (t < 50.0) {
          api.renderFormula(it ? 'Pettine a Bassa Varianza' : 'Low-Variance Comb', [
            { tex: 'U_i = r + \\frac{i-1}{12}, \\quad r = 0.03 \\quad \\Longrightarrow \\quad \\mathcal{O}(M)', anchor: 'pf-eq-comb' },
            { tex: 'w_{\\text{new}}^{[i]} = \\frac{1}{12} = 0.083, \\qquad N_{\\text{eff}} = {\\color{#34d399}' + neff.toFixed(1) + '}' }
          ]);
        } else {
          api.renderFormula(it ? 'Recupero da Kidnapping (α-Trick)' : 'Kidnapping Recovery (α-Trick)', [
            { tex: 'M_{\\text{rand}} = \\alpha M = 2\\text{ explorers } (\\#11, \\#12) \\sim \\mathcal{U}(0, 10)' },
            { tex: 'w_{\\#11} + w_{\\#12} \\longrightarrow {\\color{#34d399}' + ((cur.ws[10] + cur.ws[11]) * 100).toFixed(0) + '\\%}' }
          ], null, 'emerald');
        }
        api.setDataHTML(renderParticleList(cur.xs, cur.ws, lang, t >= 50.0 ? 10 : undefined));
      },

      renderBeams: function (t, lang, api) {
        var out = '';
        if (t >= 20.0 && t <= 24.5) {
          out += C.buildFlightSVG(api.getAnchor('pf-p-1'), api.getAnchor('pt-row-1'), C.invLerp(20.0, 22.8, t), 'w↑', '#ffd000', -30);
          out += C.buildFlightSVG(api.getAnchor('pf-p-9'), api.getAnchor('pt-row-9'), C.invLerp(20.6, 23.4, t), 'w↑', '#ffd000', 24);
        }
        if (t >= 41.0 && t <= 45.0) {
          out += C.buildLaserBeamSVG(api.getAnchor('pf-wheel'), api.getAnchor('pf-eq-comb'), C.invLerp(41.0, 43.0, t), '#34d399', -18);
        }
        if (t >= 53.5 && t <= 57.5) {
          out += C.buildFlightSVG(api.getAnchor('pf-p-10'), api.getAnchor('pt-row-10'), C.invLerp(53.5, 56.2, t), 'α', '#34d399', -28);
          out += C.buildFlightSVG(api.getAnchor('pf-p-11'), api.getAnchor('pt-row-11'), C.invLerp(54.2, 56.8, t), 'α', '#34d399', 22);
        }
        return out;
      },

      formatTooltip: function (info, lang) {
        var it = lang === 'it';
        return '<div style="font-size:10px;color:#94a3b8;">' + (it ? 'Particella #' : 'Particle #') + (info.r + 1) + '</div>' +
          '<div style="font-weight:700;color:#ffd000;">' + info.val + '</div>';
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
