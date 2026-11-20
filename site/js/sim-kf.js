/* LAB 01: Linear Kalman Filter — 6-Scene 1D Deterministic Gaussian Walkthrough */
(function () {
  'use strict';

  function init() {
    var C = window.CinemaLabs;
    if (!C) return;

    var SCENES = [
      { id: 0, start: 0.0,  end: 9.0,  tag: 'prior N(μ0, Σ0)',       shortEn: '0. Prior',      shortIt: '0. Prior' },
      { id: 1, start: 9.0,  end: 19.0, tag: 'predict (+u, +Q)',      shortEn: '1. Predict',    shortIt: '1. Predizione' },
      { id: 2, start: 19.0, end: 29.0, tag: 'innovation (y, S)',     shortEn: '2. Observe',    shortIt: '2. Osserva' },
      { id: 3, start: 29.0, end: 39.0, tag: 'kalman_gain (K)',       shortEn: '3. Gain K',     shortIt: '3. Guadagno K' },
      { id: 4, start: 39.0, end: 50.0, tag: 'update (μ, Σ)',         shortEn: '4. Fusion',     shortIt: '4. Fusione' },
      { id: 5, start: 50.0, end: 60.0, tag: 'high-R regime (K=0.25)', shortEn: '5. High R',    shortIt: '5. R Alto' }
    ];

    function gauss(x, mu, sigma) {
      var z = (x - mu) / Math.max(0.05, sigma);
      return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
    }

    function drawGaussianCurve(ctx, xToPx, baseY, peakScale, mu, sigma, color, fillAlpha, dashed) {
      ctx.save();
      ctx.beginPath();
      var started = false;
      for (var xm = 0; xm <= 10; xm += 0.05) {
        var px = xToPx(xm);
        var py = baseY - gauss(xm, mu, sigma) * peakScale;
        if (!started) { ctx.moveTo(px, py); started = true; }
        else ctx.lineTo(px, py);
      }
      if (fillAlpha > 0) {
        ctx.lineTo(xToPx(10), baseY);
        ctx.lineTo(xToPx(0), baseY);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.globalAlpha = fillAlpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      started = false;
      for (var xm2 = 0; xm2 <= 10; xm2 += 0.05) {
        var px2 = xToPx(xm2);
        var py2 = baseY - gauss(xm2, mu, sigma) * peakScale;
        if (!started) { ctx.moveTo(px2, py2); started = true; }
        else ctx.lineTo(px2, py2);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.4;
      if (dashed && ctx.setLineDash) ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.restore();
    }

    function drawTrackAndCart(ctx, w, h, xToPx, trackY, cartX, color, label) {
      var padL = xToPx(0), padR = xToPx(10);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(padL, trackY); ctx.lineTo(padR, trackY); ctx.stroke();

      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#7c7c94';
      ctx.textAlign = 'center';
      for (var m = 0; m <= 10; m += 2) {
        var tx = xToPx(m);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(tx, trackY - 4); ctx.lineTo(tx, trackY + 4); ctx.stroke();
        ctx.fillText(m + ' m', tx, trackY + 17);
      }

      var cx = xToPx(cartX);
      ctx.fillStyle = '#14141c';
      ctx.strokeStyle = color || '#ffd000';
      ctx.lineWidth = 2;
      C.roundRect(ctx, cx - 18, trackY - 22, 36, 18, 5);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = color || '#ffd000';
      ctx.beginPath(); ctx.arc(cx - 10, trackY - 3, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 10, trackY - 3, 4, 0, Math.PI * 2); ctx.fill();

      if (label) {
        ctx.font = '700 10.5px "JetBrains Mono", monospace';
        ctx.fillStyle = color || '#ffd000';
        ctx.textAlign = 'center';
        ctx.fillText(label, cx, trackY - 28);
      }
      ctx.restore();
    }

    C.mount({
      id: 'lab-kf',
      duration: 60.0,
      scenes: SCENES,
      mathTitleEn: '1D Kalman Equations & State',
      mathTitleIt: 'Equazioni Kalman 1D & Stato',

      getMetric: function (t, lang) {
        var lbl = lang === 'it' ? 'Incertezza σ' : 'Spread σ';
        if (t < 9.0) return { label: lbl, pct: 45, text: '0.50 m', color: '#ffd000' };
        if (t < 19.0) {
          var s = C.lerp(0.50, 0.90, C.easeInOutCubic(C.invLerp(10.0, 17.5, t)));
          return { label: lbl, pct: s * 95, text: s.toFixed(2) + ' m', color: '#e07a5f' };
        }
        if (t < 41.0) return { label: lbl, pct: 86, text: '0.90 m', color: '#e07a5f' };
        if (t < 48.0) {
          var s2 = C.lerp(0.90, 0.37, C.easeOutCubic(C.invLerp(41.0, 47.5, t)));
          return { label: lbl, pct: s2 * 95, text: s2.toFixed(2) + ' m', color: '#34d399' };
        }
        if (t < 52.0) return { label: lbl, pct: 35, text: '0.37 m', color: '#34d399' };
        var s3 = C.lerp(0.83, 0.72, C.easeInOutCubic(C.invLerp(53.0, 58.0, t)));
        return { label: lbl, pct: s3 * 95, text: s3.toFixed(2) + ' m', color: '#60a5fa' };
      },

      getSubtitle: function (t, lang) {
        var it = lang === 'it';
        if (t < 9.0) {
          return { color: '#ffd000', text: it ? 'Stato iniziale su binario 1D (\\(A=B=H=1\\)): \\(\\mu_0 = 2.00\\text{ m}\\), varianza \\(\\Sigma_0 = 0.25\\text{ m}^2\\) (\\(\\sigma_0 = 0.50\\text{ m}\\)).' : 'Initial 1D rail belief (\\(A=B=H=1\\)): \\(\\mu_0 = 2.00\\text{ m}\\), variance \\(\\Sigma_0 = 0.25\\text{ m}^2\\) (\\(\\sigma_0 = 0.50\\text{ m}\\)).' };
        }
        if (t < 19.0) {
          return { color: '#60a5fa', text: it ? 'Predizione al buio con \\(u_1 = +3.00\\text{ m}\\) e slittamento \\(Q = 0.56\\text{ m}^2\\): \\(\\bar{\\mu}_1 = 5.00\\text{ m}\\), \\(\\bar{\\Sigma}_1 = 0.81\\text{ m}^2\\) (la campana si appiattisce).' : 'Blind prediction with \\(u_1 = +3.00\\text{ m}\\) and slip \\(Q = 0.56\\text{ m}^2\\): \\(\\bar{\\mu}_1 = 5.00\\text{ m}\\), \\(\\bar{\\Sigma}_1 = 0.81\\text{ m}^2\\) (the bell widens).' };
        }
        if (t < 29.0) {
          return { color: '#e07a5f', text: it ? 'Il sensore LiDAR legge \\(z_1 = 5.60\\text{ m}\\) con rumore \\(R = 0.16\\text{ m}^2\\): innovazione \\(y_1 = +0.60\\text{ m}\\), varianza totale \\(S_1 = 0.97\\text{ m}^2\\).' : 'LiDAR reports \\(z_1 = 5.60\\text{ m}\\) with noise \\(R = 0.16\\text{ m}^2\\): innovation \\(y_1 = +0.60\\text{ m}\\), total spread \\(S_1 = 0.97\\text{ m}^2\\).' };
        }
        if (t < 39.0) {
          return { color: '#ffd000', text: it ? 'Guadagno di Kalman: \\(K_1 = \\bar{\\Sigma}_1 / (\\bar{\\Sigma}_1 + R) = 0.81 / 0.97 = 0.835\\). Il filtro dà l’83.5% di fiducia al sensore preciso.' : 'Kalman Gain: \\(K_1 = \\bar{\\Sigma}_1 / (\\bar{\\Sigma}_1 + R) = 0.81 / 0.97 = 0.835\\). The filter places 83.5% weight on the sharp sensor.' };
        }
        if (t < 50.0) {
          return { color: '#34d399', text: it ? 'Fusione gaussiana: \\(\\mu_1 = 5.50\\text{ m}\\) e \\(\\Sigma_1 = (1-K_1)\\bar{\\Sigma}_1 = 0.134\\text{ m}^2\\) (\\(\\sigma_1 = 0.37\\text{ m}\\), più stretta di entrambe le curve).' : 'Gaussian fusion: \\(\\mu_1 = 5.50\\text{ m}\\) and \\(\\Sigma_1 = (1-K_1)\\bar{\\Sigma}_1 = 0.134\\text{ m}^2\\) (\\(\\sigma_1 = 0.37\\text{ m}\\), narrower than both curves).' };
        }
        return { color: '#60a5fa', text: it ? 'Confronto con sensore rumoroso (\\(R = 2.08\\text{ m}^2\\)): \\(K_2\\) scende a \\(0.250\\) e il filtro ignora gran parte del picco rumoroso \\(z_2 = 8.70\\text{ m}\\).' : 'Noisy sensor regime (\\(R = 2.08\\text{ m}^2\\)): \\(K_2\\) drops to \\(0.250\\), letting the filter damp out the noisy spike \\(z_2 = 8.70\\text{ m}\\).' };
      },

      drawCanvas: function (ctx, w, h, t, lang, api) {
        var it = lang === 'it';
        var pad = 34;
        var xToPx = function (xm) { return pad + (xm / 10) * (w - pad * 2); };
        var baseY = h * 0.66;
        var trackY = h * 0.84;
        var peakScale = h * 0.44;

        // Baseline axis for PDF
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(xToPx(0), baseY); ctx.lineTo(xToPx(10), baseY); ctx.stroke();

        // Scene 0: Prior
        if (t < 9.0) {
          api.setMode(it ? 'PRIOR GAUSSIANO' : 'GAUSSIAN PRIOR', 'gold');
          api.setCoords('μ0 = 2.00 m · σ0 = 0.50 m');
          drawGaussianCurve(ctx, xToPx, baseY, peakScale, 2.0, 0.50, '#ffd000', 0.22, false);
          drawTrackAndCart(ctx, w, h, xToPx, trackY, 2.0, '#ffd000', 'x = 2.00 m');
          return;
        }

        // Scene 1: Predict
        if (t < 19.0) {
          api.setMode(it ? 'PREDIZIONE (+u, +Q)' : 'PREDICT (+u, +Q)', '');
          var p = C.easeInOutCubic(C.invLerp(10.0, 17.5, t));
          var curMu = C.lerp(2.0, 5.0, p);
          var curSig = Math.sqrt(C.lerp(0.25, 0.81, p));
          api.setCoords('μ_prior = ' + curMu.toFixed(2) + ' m · σ_prior = ' + curSig.toFixed(2) + ' m');

          drawGaussianCurve(ctx, xToPx, baseY, peakScale, 2.0, 0.50, 'rgba(148,163,184,0.55)', 0.06, true);
          drawGaussianCurve(ctx, xToPx, baseY, peakScale, curMu, curSig, '#60a5fa', 0.22, false);
          if (p > 0.05) {
            C.drawArrow(ctx, xToPx(2.0), baseY - 26, xToPx(curMu), baseY - 26, '#ffd000', 2.2, false);
            C.drawSubLabel(ctx, 'u', '1', ' = +' + (3.0 * p).toFixed(2) + ' m', xToPx((2.0 + curMu) * 0.5), baseY - 34, '#ffd000', 'center');
          }
          drawTrackAndCart(ctx, w, h, xToPx, trackY, curMu, '#60a5fa', 'x_pred = ' + curMu.toFixed(2) + ' m');
          api.setAnchor('kf-cart', xToPx(curMu), trackY - 14);
          return;
        }

        // Scene 2: Observe & Innovation
        if (t < 29.0) {
          api.setMode(it ? 'OSSERVAZIONE & INNOVAZIONE' : 'OBSERVE & INNOVATION', 'coral');
          api.setCoords('z1 = 5.60 m · y1 = +0.60 m');
          var pO = C.easeOutCubic(C.invLerp(19.5, 22.5, t));
          drawGaussianCurve(ctx, xToPx, baseY, peakScale, 5.0, 0.90, '#60a5fa', 0.16, false);
          if (pO > 0.02) {
            ctx.save(); ctx.globalAlpha = pO;
            drawGaussianCurve(ctx, xToPx, baseY, peakScale, 5.6, 0.40, '#e07a5f', 0.22, false);
            ctx.strokeStyle = '#e07a5f'; ctx.lineWidth = 1.6;
            if (ctx.setLineDash) ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(xToPx(5.6), baseY - peakScale * 1.05); ctx.lineTo(xToPx(5.6), trackY); ctx.stroke();
            if (ctx.setLineDash) ctx.setLineDash([]);
            C.drawSubLabel(ctx, 'z', '1', ' = 5.60 m', xToPx(5.6), baseY - peakScale * 1.05 - 8, '#e07a5f', 'center');
            ctx.restore();
          }
          if (t >= 23.0) {
            var pY = C.easeOutCubic(C.invLerp(23.0, 25.0, t));
            C.drawArrow(ctx, xToPx(5.0), baseY - 36, xToPx(C.lerp(5.0, 5.6, pY)), baseY - 36, '#ffd000', 2.4, false);
            C.drawSubLabel(ctx, 'y', '1', ' = +0.60 m', xToPx(5.3), baseY - 46, '#ffd000', 'center');
          }
          drawTrackAndCart(ctx, w, h, xToPx, trackY, 5.0, '#60a5fa', 'μ_prior = 5.00 m');
          api.setAnchor('kf-obs', xToPx(5.6), baseY - peakScale * 0.55);
          return;
        }

        // Scene 3: Kalman Gain
        if (t < 39.0) {
          api.setMode(it ? 'GUADAGNO DI KALMAN' : 'KALMAN GAIN', 'gold');
          api.setCoords('K1 = 0.81 / 0.97 = 0.835');
          drawGaussianCurve(ctx, xToPx, baseY, peakScale, 5.0, 0.90, '#60a5fa', 0.14, false);
          drawGaussianCurve(ctx, xToPx, baseY, peakScale, 5.6, 0.40, '#e07a5f', 0.20, false);
          var pK = C.easeInOutCubic(C.invLerp(30.0, 35.5, t));
          var xPull = C.lerp(5.0, 5.501, pK);
          C.drawArrow(ctx, xToPx(5.0), baseY - 42, xToPx(xPull), baseY - 42, '#ffd000', 2.8, false);
          C.drawSubLabel(ctx, 'K', '1', '·y = +' + (0.501 * pK).toFixed(2) + ' m', xToPx((5.0 + xPull) * 0.5), baseY - 54, '#ffd000', 'center');
          drawTrackAndCart(ctx, w, h, xToPx, trackY, xPull, '#ffd000', '83.5% sensor');
          api.setAnchor('kf-prior-peak', xToPx(5.0), baseY - gauss(5.0, 5.0, 0.9) * peakScale);
          api.setAnchor('kf-meas-peak', xToPx(5.6), baseY - gauss(5.6, 5.6, 0.4) * peakScale);
          return;
        }

        // Scene 4: Posterior Update
        if (t < 50.0) {
          api.setMode(it ? 'FUSIONE POSTERIORE' : 'POSTERIOR FUSION', 'emerald');
          var pU = C.easeOutCubic(C.invLerp(40.0, 46.5, t));
          var mNow = C.lerp(5.0, 5.501, pU);
          var sNow = Math.sqrt(C.lerp(0.81, 0.1336, pU));
          api.setCoords('μ1 = ' + mNow.toFixed(2) + ' m · σ1 = ' + sNow.toFixed(2) + ' m');
          drawGaussianCurve(ctx, xToPx, baseY, peakScale, 5.0, 0.90, 'rgba(96,165,250,0.45)', 0.06, true);
          drawGaussianCurve(ctx, xToPx, baseY, peakScale, 5.6, 0.40, 'rgba(224,122,95,0.45)', 0.06, true);
          drawGaussianCurve(ctx, xToPx, baseY, peakScale, mNow, sNow, '#34d399', 0.25, false);
          drawTrackAndCart(ctx, w, h, xToPx, trackY, mNow, '#34d399', 'μ1 = ' + mNow.toFixed(2) + ' m');
          return;
        }

        // Scene 5: High-R Comparison (Cycle 2)
        api.setMode(it ? 'REGIME R ALTO (SENSORE RUMOROSO)' : 'HIGH-R REGIME (NOISY SENSOR)', '');
        var pH = C.easeInOutCubic(C.invLerp(51.5, 58.0, t));
        var m2 = C.lerp(7.50, 7.80, pH);
        var s2 = Math.sqrt(C.lerp(0.694, 0.521, pH));
        api.setCoords('R = 2.08 · K2 = 0.250 · μ2 = ' + m2.toFixed(2) + ' m');
        drawGaussianCurve(ctx, xToPx, baseY, peakScale, 7.50, Math.sqrt(0.694), 'rgba(96,165,250,0.65)', 0.10, true);
        drawGaussianCurve(ctx, xToPx, baseY, peakScale, 8.70, Math.sqrt(2.08), '#e07a5f', 0.12, true);
        drawGaussianCurve(ctx, xToPx, baseY, peakScale, m2, s2, '#34d399', 0.22, false);
        C.drawSubLabel(ctx, 'z', '2', ' = 8.70 m (noisy)', xToPx(8.70), baseY - gauss(8.7, 8.7, Math.sqrt(2.08)) * peakScale - 12, '#e07a5f', 'center');
        drawTrackAndCart(ctx, w, h, xToPx, trackY, m2, '#34d399', 'μ2 = ' + m2.toFixed(2) + ' m');
      },

      renderPanel: function (t, lang, api) {
        var it = lang === 'it';
        function cards(list) {
          return '<div class="cn-stat-grid">' + list.map(function (c) {
            return '<div class="cn-stat-card ' + c.tone + '" data-anchor="' + (c.anchor || '') + '" data-tip-id="' + c.tipId + '" data-tip-val="' + c.val + '">' +
              '<div class="cn-stat-k">' + c.k + '</div><div class="cn-stat-v">' + c.val + '</div>' +
              (c.sub ? '<div class="cn-stat-sub">' + c.sub + '</div>' : '') + '</div>';
          }).join('') + '</div>';
        }

        if (t < 9.0) {
          api.renderFormula(it ? 'Stato Iniziale' : 'Initial State', [
            { tex: '\\operatorname{bel}(x_0) = \\mathcal{N}(\\mu_0 = 2.00,\\; \\Sigma_0 = 0.25)' },
            { tex: 'A = 1, \\quad B = 1, \\quad H = 1, \\quad \\sigma_0 = \\sqrt{0.25} = 0.50\\text{ m}' }
          ]);
          api.setDataHTML(cards([
            { k: 'μ0', val: '2.00 m', sub: it ? 'Media iniziale' : 'Initial mean', tone: 'gold', tipId: 'mu0' },
            { k: 'Σ0', val: '0.25 m²', sub: 'σ0 = 0.50 m', tone: 'gold', tipId: 'sig0' },
            { k: 'Q', val: '0.56 m²', sub: it ? 'Rumore moto' : 'Motion noise', tone: 'cyan', tipId: 'Q' },
            { k: 'R', val: '0.16 m²', sub: it ? 'Rumore LiDAR' : 'LiDAR noise', tone: 'coral', tipId: 'R' }
          ]));
          return;
        }

        if (t < 19.0) {
          var p = C.easeInOutCubic(C.invLerp(10.0, 17.5, t));
          var mu = C.lerp(2.0, 5.0, p), sg = C.lerp(0.25, 0.81, p);
          api.renderFormula(it ? 'Predizione Lineare' : 'Linear Predict', [
            { tex: '\\bar{\\mu}_1 = \\mu_0 + u_1 = 2.00 + 3.00 = {\\color{#60a5fa}' + mu.toFixed(2) + '\\text{ m}}', anchor: 'kf-eq-mu' },
            { tex: '\\bar{\\Sigma}_1 = \\Sigma_0 + Q = 0.25 + 0.56 = {\\color{#60a5fa}' + sg.toFixed(2) + '\\text{ m}^2}', anchor: 'kf-eq-sig' }
          ], null, 'cyan');
          api.setDataHTML(cards([
            { k: 'μ1 (prior)', val: mu.toFixed(2) + ' m', sub: '2.00 + 3.00', tone: 'cyan', tipId: 'mubar' },
            { k: 'Σ1 (prior)', val: sg.toFixed(2) + ' m²', sub: 'σ1 = ' + Math.sqrt(sg).toFixed(2) + ' m', tone: 'cyan', tipId: 'sigbar' },
            { k: 'u1', val: '+3.00 m', sub: it ? 'Comando motori' : 'Motor command', tone: 'gold', tipId: 'u1' },
            { k: 'Q', val: '+0.56 m²', sub: it ? 'Slittamento' : 'Wheel slip', tone: 'coral', tipId: 'Q' }
          ]));
          return;
        }

        if (t < 29.0) {
          api.renderFormula(it ? 'Innovazione & Varianza S1' : 'Innovation & Spread S1', [
            { tex: 'y_1 = z_1 - H\\bar{\\mu}_1 = 5.60 - 5.00 = {\\color{#ffd000}+0.60\\text{ m}}', anchor: 'kf-eq-y' },
            { tex: 'S_1 = H\\bar{\\Sigma}_1 H^\\top + R = 0.81 + 0.16 = {\\color{#e07a5f}0.97\\text{ m}^2}' }
          ], null, 'coral');
          api.setDataHTML(cards([
            { k: 'z1', val: '5.60 m', sub: 'σR = 0.40 m', tone: 'coral', tipId: 'z1' },
            { k: 'y1', val: '+0.60 m', sub: it ? 'Sorpresa' : 'Innovation', tone: 'gold', tipId: 'y1' },
            { k: 'Σ1 (prior)', val: '0.81 m²', sub: it ? 'Dal moto' : 'From motion', tone: 'cyan', tipId: 'sigbar' },
            { k: 'S1', val: '0.97 m²', sub: '0.81 + 0.16', tone: 'coral', tipId: 'S1' }
          ]));
          return;
        }

        if (t < 39.0) {
          var pK = C.easeOutCubic(C.invLerp(29.8, 34.0, t));
          var kNow = 0.835 * pK;
          api.renderFormula(it ? 'Guadagno di Kalman' : 'Kalman Gain', [
            { tex: 'K_1 = \\frac{\\bar{\\Sigma}_1}{\\bar{\\Sigma}_1 + R} = \\frac{0.81}{0.81 + 0.16} = {\\color{#ffd000}' + kNow.toFixed(3) + '}', anchor: 'kf-eq-k' }
          ], '<span>' + (it ? 'Fiducia modello:' : 'Model trust:') + ' ' + ((1 - kNow) * 100).toFixed(1) + '%</span><span>' + (it ? 'Fiducia sensore:' : 'Sensor trust:') + ' ' + (kNow * 100).toFixed(1) + '%</span>');
          api.setDataHTML(
            cards([
              { k: 'Σ1 (prior)', val: '0.81 m²', sub: it ? 'Incertezza modello' : 'Model spread', tone: 'cyan', tipId: 'sigbar' },
              { k: 'R', val: '0.16 m²', sub: it ? 'Sensore preciso' : 'Sharp sensor', tone: 'coral', tipId: 'R' }
            ]) +
            '<div class="cn-gain-meter"><div class="cn-gain-labels"><span>K = 0 (' + (it ? 'Modello' : 'Model') + ')</span><span>K1 = ' + kNow.toFixed(3) + '</span><span>K = 1 (' + (it ? 'Sensore' : 'Sensor') + ')</span></div>' +
            '<div class="cn-gain-track"><div class="cn-gain-fill" style="width:' + (kNow * 100).toFixed(1) + '%;"></div></div></div>'
          );
          return;
        }

        if (t < 50.0) {
          var pU = C.easeOutCubic(C.invLerp(40.0, 46.5, t));
          var m1 = C.lerp(5.0, 5.501, pU), sg1 = C.lerp(0.81, 0.134, pU);
          api.renderFormula(it ? 'Aggiornamento Posteriore' : 'Posterior Update', [
            { tex: '\\mu_1 = 5.00 + 0.835(0.60) = {\\color{#34d399}' + m1.toFixed(2) + '\\text{ m}}' },
            { tex: '\\Sigma_1 = (1 - 0.835)\\cdot 0.81 = {\\color{#34d399}' + sg1.toFixed(3) + '\\text{ m}^2} \\;(\\sigma_1 = ' + Math.sqrt(sg1).toFixed(2) + '\\text{ m})' }
          ], '<span>\\(\\Sigma_1^{-1} = \\bar{\\Sigma}_1^{-1} + R^{-1} = 1.23 + 6.25 = 7.48\\)</span>', 'emerald');
          api.setDataHTML(cards([
            { k: 'μ1', val: m1.toFixed(2) + ' m', sub: it ? 'Media fusa' : 'Fused mean', tone: 'emerald', tipId: 'mu1' },
            { k: 'Σ1', val: sg1.toFixed(3) + ' m²', sub: 'σ1 = ' + Math.sqrt(sg1).toFixed(2) + ' m', tone: 'emerald', tipId: 'sig1' },
            { k: 'σ_prior → σ1', val: '0.90 → 0.37 m', sub: '-59% spread', tone: 'cyan', tipId: 'sigbar' },
            { k: 'σR vs σ1', val: '0.40 → 0.37 m', sub: it ? 'Meglio del sensore' : 'Tighter than sensor', tone: 'coral', tipId: 'R' }
          ]));
          return;
        }

        api.renderFormula(it ? 'Confronto: Sensore Rumoroso (R = 2.08)' : 'Comparison: Noisy Sensor (R = 2.08)', [
          { tex: 'K_2 = \\frac{0.694}{0.694 + 2.08} = {\\color{#60a5fa}0.250} \\quad (25\\%\\text{ sensor})' },
          { tex: '\\mu_2 = 7.50 + 0.25(8.70 - 7.50) = {\\color{#34d399}7.80\\text{ m}}' }
        ], null, 'cyan');
        api.setDataHTML(
          cards([
            { k: 'R alto', val: '2.08 m²', sub: 'σR = 1.44 m', tone: 'coral', tipId: 'R' },
            { k: 'K2', val: '0.250', sub: it ? '75% fiducia modello' : '75% model trust', tone: 'cyan', tipId: 'K2' }
          ]) +
          '<div class="cn-gain-meter"><div class="cn-gain-labels"><span>K = 0</span><span>K2 = 0.250</span><span>K = 1</span></div>' +
          '<div class="cn-gain-track"><div class="cn-gain-fill" style="width:25%;"></div></div></div>'
        );
      },

      renderBeams: function (t, lang, api) {
        var out = '';
        if (t >= 10.5 && t <= 13.5) {
          out += C.buildFlightSVG(api.getAnchor('kf-cart'), api.getAnchor('kf-eq-mu'), C.invLerp(10.5, 12.6, t), '+3.00', '#ffd000', -36);
          out += C.buildFlightSVG(api.getAnchor('kf-cart'), api.getAnchor('kf-eq-sig'), C.invLerp(11.0, 13.2, t), '+0.56', '#60a5fa', 28);
        }
        if (t >= 21.0 && t <= 24.0) {
          out += C.buildFlightSVG(api.getAnchor('kf-obs'), api.getAnchor('kf-eq-y'), C.invLerp(21.0, 23.4, t), '5.60 m', '#e07a5f', -40);
        }
        if (t >= 30.0 && t <= 33.5) {
          out += C.buildFlightSVG(api.getAnchor('kf-prior-peak'), api.getAnchor('kf-eq-k'), C.invLerp(30.0, 32.5, t), '0.81', '#60a5fa', -34);
          out += C.buildFlightSVG(api.getAnchor('kf-meas-peak'), api.getAnchor('kf-eq-k'), C.invLerp(30.5, 33.0, t), '0.16', '#e07a5f', -16);
        }
        return out;
      },

      formatTooltip: function (info, lang) {
        var it = lang === 'it';
        var map = {
          mu0: it ? 'Posizione media iniziale del carrello' : 'Initial cart mean position',
          sig0: it ? 'Varianza iniziale (quadrato di σ0)' : 'Initial variance (square of σ0)',
          mubar: it ? 'Media predetta dopo lo spostamento +u1' : 'Predicted mean after shift +u1',
          sigbar: it ? 'Varianza predetta: somma di Σ0 e Q' : 'Predicted variance: sum of Σ0 and Q',
          u1: it ? 'Comando motore lineare applicato' : 'Applied linear motor command',
          Q: it ? 'Varianza del rumore di processo (slittamento)' : 'Process noise variance (wheel slip)',
          R: it ? 'Varianza del rumore di misura LiDAR' : 'LiDAR measurement noise variance',
          z1: it ? 'Lettura grezza del sensore LiDAR' : 'Raw LiDAR sensor reading',
          y1: it ? 'Differenza z1 − H μ_prior tra misura e attesa' : 'Residual z1 − H μ_prior between sensor and prediction',
          S1: it ? 'Incertezza totale del confronto (Σ_prior + R)' : 'Total comparison variance (Σ_prior + R)',
          mu1: it ? 'Media posteriore dopo la fusione' : 'Posterior mean after fusion',
          sig1: it ? 'Varianza posteriore, sempre minore di Σ_prior e R' : 'Posterior variance, strictly smaller than both Σ_prior and R',
          K2: it ? 'Guadagno basso quando R ≫ Σ_prior' : 'Low gain when R ≫ Σ_prior'
        };
        return '<div style="font-weight:700;color:#ffd000;">' + info.val + '</div><div style="color:#d4d4d8;margin-top:2px;">' + (map[info.id] || '') + '</div>';
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
