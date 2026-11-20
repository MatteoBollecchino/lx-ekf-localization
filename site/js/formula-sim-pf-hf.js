(function () {
  'use strict';

  var FS = window.FormulaSims;
  if (!FS || !FS.helpers) return;
  var H = FS.helpers;

  FS.register({
    // 10. PF: IMPORTANCE WEIGHTING
    'pf-weight': function (container, lang) {
      var M = 14;
      var XS = [0.8, 1.4, 2.1, 2.9, 3.6, 4.2, 4.7, 5.1, 5.6, 6.2, 6.9, 7.6, 8.4, 9.1];

      function computeWeights(s, tFrac) {
        var raw = [];
        var sum = 0;
        for (var i = 0; i < M; i++) {
          var d = XS[i] - s.z;
          var w = Math.exp(-(d * d) / (2 * s.sig * s.sig));
          raw.push(w);
          sum += w;
        }
        var norm = [];
        var sqSum = 0;
        for (var j = 0; j < M; j++) {
          var wn = sum > 1e-9 ? raw[j] / sum : 1 / M;
          var wi = H.lerp(1 / M, wn, tFrac);
          norm.push(wi);
          sqSum += wi * wi;
        }
        return { weights: norm, eta: sum > 1e-9 ? 1 / sum : 1, nEff: 1 / Math.max(1e-6, sqSum) };
      }

      return H.mountCanvasSim(container, lang, {
        defaults: { z: 4.9, sig: 0.90 },
        defaultPresetIdx: 0,
        guide: {
          it: '<strong>Cosa osservare:</strong> <code>z_t</code> è dove il sensore vede il robot; la campana <span class="leg-coral">σ</span> è la tolleranza del sensore. Le particelle dentro la campana ricevono barre gialle alte; se stringi <code>σ</code> sopravvivono pochissime particelle (<code>N_eff</code> scende).',
          en: '<strong>What to watch:</strong> <code>z_t</code> is where the sensor sees the robot; the coral bell <span class="leg-coral">σ</span> is sensor tolerance. Particles inside the bell get tall gold bars; narrowing <code>σ</code> leaves very few survivors (<code>N_eff</code> drops).'
        },
        legend: {
          it: '<span class="leg-coral">■ Misura z_t</span><span class="leg-gold">■ Pesi normalizzati w_t^{[i]}</span>',
          en: '<span class="leg-coral">■ Reading z_t</span><span class="leg-gold">■ Normalized weights w_t^{[i]}</span>'
        },
        presets: {
          it: [
            { label: 'Picco Centrale', vals: { z: 4.9, sig: 0.90 } },
            { label: 'Sensore Molto Stretto (N_eff↓)', vals: { z: 4.9, sig: 0.35 } }
          ],
          en: [
            { label: 'Centered Peak', vals: { z: 4.9, sig: 0.90 } },
            { label: 'Ultra-Sharp Sensor (Low N_eff)', vals: { z: 4.9, sig: 0.35 } }
          ]
        },
        sliders: [
          { key: 'z', min: 1.2, max: 8.8, step: 0.1, labelIt: 'Posizione letta dal sensore (z_t)', labelEn: 'Sensor reading position (z_t)', fmt: function (v) { return v.toFixed(1) + ' m'; } },
          { key: 'sig', min: 0.25, max: 2.0, step: 0.05, labelIt: 'Tolleranza sensore (larghezza campana σ)', labelEn: 'Sensor tolerance (bell width σ)', fmt: function (v) { return v.toFixed(2) + ' m'; } }
        ],
        renderEq: function (s, tFrac) {
          var r = computeWeights(s, tFrac);
          return (
            '\\begin{aligned}' +
            '\\eta &= ' + r.eta.toFixed(2) + ', \\qquad \\sum_{i=1}^{14} w_t^{[i]} = 1.00 \\\\[4pt]' +
            'N_{\\text{eff}} &= \\frac{1}{\\sum (w_t^{[i]})^2} = {\\color{#ffd000}' + r.nEff.toFixed(1) + '} / 14' +
            '\\end{aligned}'
          );
        },
        draw: function (ctx, w, h, s, tFrac, isIt) {
          ctx.fillStyle = '#09090c';
          ctx.fillRect(0, 0, w, h);

          var padL = 28;
          var padR = 28;
          var padB = 46;
          var padT = 36;
          var plotW = w - padL - padR;
          var baseY = h - padB;
          var maxH = h - padT - padB;
          function toX(x) { return padL + (x / 10) * plotW; }
          function gaussNorm(x) {
            var d = x - s.z;
            return Math.exp(-(d * d) / (2 * s.sig * s.sig));
          }

          ctx.strokeStyle = 'rgba(255,255,255,0.18)';
          ctx.beginPath();
          ctx.moveTo(padL, baseY + 0.5);
          ctx.lineTo(w - padR, baseY + 0.5);
          ctx.stroke();

          // Draw Gaussian likelihood bell curve p(z_t | x) behind particles so weights make immediate visual sense
          ctx.save();
          ctx.beginPath();
          for (var gx = 0; gx <= 100; gx++) {
            var xv = (gx / 100) * 10;
            var pxCurve = toX(xv);
            var pyCurve = baseY - gaussNorm(xv) * (maxH * 0.84);
            if (gx === 0) ctx.moveTo(pxCurve, pyCurve);
            else ctx.lineTo(pxCurve, pyCurve);
          }
          ctx.strokeStyle = '#e07a5f';
          ctx.lineWidth = 2.0;
          ctx.stroke();
          ctx.lineTo(toX(10), baseY);
          ctx.lineTo(toX(0), baseY);
          ctx.closePath();
          ctx.fillStyle = 'rgba(224, 122, 95, 0.12)';
          ctx.fill();
          ctx.restore();

          var r = computeWeights(s, tFrac);
          var maxW = Math.max.apply(null, r.weights);

          // Sensor measurement target line z_t
          var zx = toX(s.z);
          ctx.save();
          ctx.strokeStyle = '#e07a5f';
          ctx.setLineDash([4, 3]);
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(zx, padT);
          ctx.lineTo(zx, baseY);
          ctx.stroke();
          ctx.restore();
          H.drawPill(ctx, 'z_t = ' + s.z.toFixed(1) + 'm', zx, padT - 12, '#e07a5f');

          // Particles + normalized weight bars + % labels on top winners
          for (var i = 0; i < M; i++) {
            var px = toX(XS[i]);
            var barH = (r.weights[i] / Math.max(0.15, maxW)) * (maxH * 0.82);
            var isStrong = r.weights[i] > 0.08;
            ctx.fillStyle = isStrong ? 'rgba(255, 208, 0, 0.86)' : 'rgba(148, 163, 184, 0.32)';
            ctx.fillRect(px - 6, baseY - barH, 12, barH);
            ctx.beginPath();
            ctx.arc(px, baseY + 13, isStrong ? 4.2 : 3.2, 0, Math.PI * 2);
            ctx.fill();

            if (isStrong && r.weights[i] >= maxW * 0.65) {
              ctx.save();
              ctx.font = '600 9.5px "JetBrains Mono", monospace';
              ctx.fillStyle = '#ffd000';
              ctx.textAlign = 'center';
              ctx.fillText(Math.round(r.weights[i] * 100) + '%', px, baseY - barH - 6);
              ctx.restore();
            }
          }
          H.drawPill(ctx, (isIt ? 'Particelle Eff. Neff = ' : 'Eff. Sample Size Neff = ') + r.nEff.toFixed(1) + ' / ' + M, 14, h - 14, '#ffd000', null, 'left');
        }
      });
    },

    // 11. PF: LOW-VARIANCE COMB & ROULETTE
    'pf-comb': function (container, lang) {
      var M = 10;
      function buildSlices(skew) {
        var raw = [];
        var sum = 0;
        for (var i = 0; i < M; i++) {
          var v = i < 3 ? Math.pow(skew, 1.4) : 0.25;
          raw.push(v);
          sum += v;
        }
        return raw.map(function (v) { return v / sum; });
      }

      return H.mountCanvasSim(container, lang, {
        defaults: { rOff: 0.04, skew: 2.4 },
        defaultPresetIdx: 0,
        guide: {
          it: '<strong>Cosa osservare:</strong> un solo ago casuale <code>r</code> fa partire un pettine di 10 raggi equidistanti: le fette grandi (<code>#1, #2, #3</code>) vengono colpite e clonate più volte a destra, mentre le fette piccole spariscono (<code>×0</code>).',
          en: '<strong>What to watch:</strong> a single random offset <code>r</code> anchors 10 equidistant comb spokes: wide slices (<code>#1, #2, #3</code>) get hit and cloned multiple times on the right, while tiny slices vanish (<code>×0</code>).'
        },
        legend: {
          it: '<span class="leg-gold">■ Settori con peso alto (clonati!)</span><span class="leg-slate">■ Settori piccoli (scartati)</span>',
          en: '<span class="leg-gold">■ Heavy slices (cloned!)</span><span class="leg-slate">■ Tiny slices (dropped)</span>'
        },
        presets: {
          it: [
            { label: 'Pesi Sbilanciati', vals: { rOff: 0.04, skew: 2.4 } },
            { label: 'Dominanza Estrema', vals: { rOff: 0.02, skew: 5.0 } }
          ],
          en: [
            { label: 'Skewed Weights', vals: { rOff: 0.04, skew: 2.4 } },
            { label: 'Extreme Dominance', vals: { rOff: 0.02, skew: 5.0 } }
          ]
        },
        sliders: [
          { key: 'rOff', min: 0.0, max: 0.095, step: 0.005, labelIt: 'Offset iniziale r', labelEn: 'Random start r', fmt: function (v) { return v.toFixed(3); } },
          { key: 'skew', min: 1.0, max: 5.5, step: 0.2, labelIt: 'Concentrazione pesi', labelEn: 'Weight skew', fmt: function (v) { return v.toFixed(1) + '×'; } }
        ],
        renderEq: function (s, tFrac) {
          var slices = buildSlices(s.skew);
          var sq = 0;
          slices.forEach(function (w) { sq += w * w; });
          var curI = Math.max(1, Math.min(M, Math.round(tFrac * M)));
          var uVal = s.rOff + (curI - 1) / M;
          return (
            '\\begin{aligned}' +
            'U_{' + curI + '} &= ' + s.rOff.toFixed(3) + ' + \\frac{' + (curI - 1) + '}{' + M + '} = {\\color{#ffd000}' + uVal.toFixed(3) + '} \\\\[4pt]' +
            'N_{\\text{eff}} &= ' + (1 / sq).toFixed(1) + ' / ' + M +
            '\\end{aligned}'
          );
        },
        draw: function (ctx, w, h, s, tFrac, isIt) {
          ctx.fillStyle = '#09090c';
          ctx.fillRect(0, 0, w, h);

          // Left 58%: Labeled Roulette Wheel + Sweeping Comb | Right 42%: Live Clone Tally
          var splitX = Math.round(w * 0.58);
          var cx = splitX * 0.5;
          var cy = h * 0.52;
          var rOut = Math.min(splitX * 0.38, h * 0.37);
          var rIn = rOut * 0.42;
          var slices = buildSlices(s.skew);

          // Cumulative boundaries in [0, 1]
          var cdf = [];
          var acc = 0;
          for (var cIdx = 0; cIdx < M; cIdx++) {
            acc += slices[cIdx];
            cdf.push(acc);
          }
          cdf[M - 1] = 1.0;

          var curAng = -Math.PI / 2;
          for (var i = 0; i < M; i++) {
            var sw = slices[i] * Math.PI * 2;
            var midAng = curAng + sw * 0.5;
            ctx.beginPath();
            ctx.arc(cx, cy, rOut, curAng, curAng + sw);
            ctx.arc(cx, cy, rIn, curAng + sw, curAng, true);
            ctx.closePath();
            ctx.fillStyle = i < 3 ? (i % 2 === 0 ? 'rgba(255,208,0,0.85)' : 'rgba(224,122,95,0.78)') : 'rgba(148,163,184,0.22)';
            ctx.fill();
            ctx.strokeStyle = '#09090c';
            ctx.lineWidth = 1.6;
            ctx.stroke();

            if (sw > 0.22) {
              var lr = (rOut + rIn) * 0.5;
              ctx.save();
              ctx.font = '700 10.5px "JetBrains Mono", monospace';
              ctx.fillStyle = '#09090c';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('#' + (i + 1), cx + Math.cos(midAng) * lr, cy + Math.sin(midAng) * lr);
              ctx.restore();
            }
            curAng += sw;
          }

          // Count clones hit by sweeping comb spokes
          var clones = new Array(M).fill(0);
          var spokeCount = Math.max(1, Math.round(tFrac * M));
          for (var k = 0; k < spokeCount; k++) {
            var u = s.rOff + k / M;
            var hitIdx = 0;
            while (hitIdx < M - 1 && u > cdf[hitIdx]) hitIdx++;
            clones[hitIdx] += 1;

            var ang = -Math.PI / 2 + u * Math.PI * 2;
            var x1 = cx + Math.cos(ang) * (rOut + 15);
            var y1 = cy + Math.sin(ang) * (rOut + 15);
            var x2 = cx + Math.cos(ang) * (rOut - 6);
            var y2 = cy + Math.sin(ang) * (rOut - 6);
            ctx.strokeStyle = '#f4f4f6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.fillStyle = hitIdx < 3 ? '#ffd000' : '#94a3b8';
            ctx.beginPath();
            ctx.arc(x1, y1, 3.2, 0, Math.PI * 2);
            ctx.fill();
          }
          H.drawPill(ctx, 'r=' + s.rOff.toFixed(3), cx, cy, '#ffd000');

          // Right Panel: Live Clone Tally ("Figli / Clones")
          var tx = splitX + 10;
          var tw = w - tx - 14;
          var rowH = Math.min(26, (h - 54) / M);
          var startY = 34;

          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.beginPath();
          ctx.moveTo(splitX, 16);
          ctx.lineTo(splitX, h - 16);
          ctx.stroke();

          H.drawPill(ctx, isIt ? 'CLONI GENERATI' : 'CLONES SPAWNED', tx + tw * 0.5, 18, '#a1a1aa');

          for (var p = 0; p < M; p++) {
            var ry = startY + p * rowH;
            var cnt = clones[p];
            var barMax = tw - 66;
            var barW = (cnt / 5) * barMax;

            ctx.font = '600 10.5px "JetBrains Mono", monospace';
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';
            ctx.fillStyle = cnt > 0 ? '#f4f4f6' : '#52525b';
            ctx.fillText('#' + (p + 1), tx, ry + rowH * 0.45);

            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.fillRect(tx + 28, ry + 4, barMax, rowH - 9);
            if (cnt > 0) {
              ctx.fillStyle = p < 3 ? '#ffd000' : '#94a3b8';
              ctx.fillRect(tx + 28, ry + 4, Math.min(barMax, barW), rowH - 9);
            }

            ctx.textAlign = 'right';
            ctx.fillStyle = cnt > 0 ? '#ffd000' : '#52525b';
            ctx.fillText('×' + cnt, tx + tw, ry + rowH * 0.45);
          }
        }
      });
    },

    // 11b. HF: DIRAC DELTA BELIEF & histogram_prior
    'hf-dirac': function (container, lang) {
      return H.mountCanvasSim(container, lang, {
        defaults: { mu: 0.00, sig: 0.06, nBins: 9 },
        defaultPresetIdx: 0,
        guide: {
          it: '<strong>Cosa osservare:</strong> <code>histogram_prior</code> campiona una gaussiana continua sui centroidi discreti <code>x^i</code>: ogni freccia verticale è uno spillo di Dirac <code>w_t^i · δ(x − x^i)</code> e la somma di tutti i pesi vale sempre <code>1.00</code>.',
          en: '<strong>What to watch:</strong> <code>histogram_prior</code> samples a continuous Gaussian at discrete bin centroids <code>x^i</code>: each vertical spike is a Dirac delta <code>w_t^i · δ(x − x^i)</code> and all weights always sum to <code>1.00</code>.'
        },
        legend: {
          it: '<span class="leg-slate">■ Densità continua N(μ₀, Σ₀)</span><span class="leg-gold">■ Spilli di Dirac w_t^i · δ(x − x^i)</span>',
          en: '<span class="leg-slate">■ Continuous PDF N(μ₀, Σ₀)</span><span class="leg-gold">■ Dirac spikes w_t^i · δ(x − x^i)</span>'
        },
        presets: {
          it: [
            { label: 'Prior Centrato (N=9)', vals: { mu: 0.00, sig: 0.06, nBins: 9 } },
            { label: 'Griglia Fine (N=15)', vals: { mu: 0.03, sig: 0.05, nBins: 15 } }
          ],
          en: [
            { label: 'Centered Prior (N=9)', vals: { mu: 0.00, sig: 0.06, nBins: 9 } },
            { label: 'Fine Grid (N=15)', vals: { mu: 0.03, sig: 0.05, nBins: 15 } }
          ]
        },
        sliders: [
          { key: 'mu', min: -0.10, max: 0.10, step: 0.01, labelIt: 'Centro iniziale μ₀', labelEn: 'Initial center μ₀', fmt: function (v) { return H.signedFixed(v, 2) + ' m'; } },
          { key: 'sig', min: 0.03, max: 0.12, step: 0.01, labelIt: 'Larghezza prior σ₀', labelEn: 'Prior spread σ₀', fmt: function (v) { return v.toFixed(2) + ' m'; } },
          { key: 'nBins', min: 5, max: 17, step: 2, labelIt: 'Numero centroidi N', labelEn: 'Centroid count N', fmt: function (v) { return v.toFixed(0); } }
        ],
        renderEq: function (s, tFrac) {
          var N = Math.round(s.nBins);
          var raw = [];
          var sum = 0;
          for (var i = 0; i < N; i++) {
            var xi = -0.15 + (0.30 * i) / Math.max(1, N - 1);
            var w = H.gaussian(xi, s.mu * tFrac, s.sig);
            raw.push(w);
            sum += w;
          }
          var maxW = Math.max.apply(null, raw) / Math.max(1e-6, sum);
          return (
            '\\begin{aligned}' +
            '\\operatorname{bel}(x_t) &= \\sum_{i=1}^{' + N + '} w_t^i\\,\\delta(x_t - x^i), \\qquad \\sum_{i=1}^{' + N + '} w_t^i = 1.00 \\\\[4pt]' +
            'w_{\\max} &= {\\color{#ffd000}' + (maxW * 100).toFixed(1) + '\\%} \\quad (\\mu_0 = ' + H.signedFixed(s.mu * tFrac, 2) + '\\text{ m})' +
            '\\end{aligned}'
          );
        },
        draw: function (ctx, w, h, s, tFrac) {
          ctx.fillStyle = '#09090c';
          ctx.fillRect(0, 0, w, h);
          var pad = 42;
          var baseY = h - 38;
          var plotH = h - 86;
          var muNow = s.mu * tFrac;
          var xToPx = function (x) { return pad + ((x + 0.16) / 0.32) * (w - pad * 2); };

          // Continuous Gaussian envelope
          var peakG = H.gaussian(muNow, muNow, s.sig);
          ctx.save();
          ctx.beginPath();
          for (var x = -0.16; x <= 0.16; x += 0.004) {
            var px = xToPx(x);
            var py = baseY - (H.gaussian(x, muNow, s.sig) / peakG) * plotH * 0.85;
            if (x === -0.16) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);
          ctx.stroke();
          ctx.restore();

          // Discrete Dirac spikes at cell centroids
          var N = Math.round(s.nBins);
          var raw = [], sum = 0;
          for (var i = 0; i < N; i++) {
            var xi = -0.15 + (0.30 * i) / Math.max(1, N - 1);
            var wi = H.gaussian(xi, muNow, s.sig);
            raw.push({ x: xi, w: wi });
            sum += wi;
          }
          var maxW = 0.01;
          raw.forEach(function (it) { it.w /= Math.max(1e-6, sum); if (it.w > maxW) maxW = it.w; });

          ctx.strokeStyle = 'rgba(255,255,255,0.18)';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(pad, baseY); ctx.lineTo(w - pad, baseY); ctx.stroke();

          raw.forEach(function (it) {
            var px = xToPx(it.x);
            var hSpike = (it.w / maxW) * plotH * 0.85 * (0.25 + 0.75 * tFrac);
            H.drawArrow(ctx, px, baseY, px, baseY - Math.max(8, hSpike), '#ffd000', 2.6);
            if (it.w > maxW * 0.45) {
              H.drawPill(ctx, (it.w * 100).toFixed(0) + '%', px, baseY - hSpike - 14, '#ffd000');
            }
          });
        }
      });
    },

    // 12. HF: histogram_predict (Encoder Shift & Gaussian Filter)
    'hf-predict': function (container, lang) {
      var N = 9;
      function buildPredGrid(s, tFrac) {
        var shiftR = (s.dA * Math.sin(H.degToRad(s.phiDeg))) * tFrac * 8.0;
        var shiftC = s.w * tFrac * 3.0;
        var cr = 4 - shiftR;
        var cc = 4 + shiftC;
        var sig = H.lerp(0.55, s.blur, tFrac);
        var g = [];
        var sum = 0;
        for (var r = 0; r < N; r++) {
          for (var c = 0; c < N; c++) {
            var v = Math.exp(-0.5 * ((r - cr) * (r - cr) + (c - cc) * (c - cc)) / (sig * sig));
            g.push(v);
            sum += v;
          }
        }
        return g.map(function (v) { return v / sum; });
      }

      return H.mountCanvasSim(container, lang, {
        defaults: { dA: 0.35, phiDeg: 18, w: 0.25, blur: 1.15 },
        defaultPresetIdx: 0,
        guide: {
          it: '<strong>Cosa osservare:</strong> gli encoder danno avanzamento <code>d_A</code> e rotazione <code>w</code>. Ogni cella (riquadro grigio) trasla di <code>(d_A sin(φ_est), w)</code> e poi <code>gaussian_filter(..., cov_mask)</code> sfoca la massa sulle celle vicine.',
          en: '<strong>What to watch:</strong> wheel encoders yield forward arc <code>d_A</code> and turn <code>w</code>. Each cell (slate outline) shifts by <code>(d_A sin(φ_est), w)</code> and <code>gaussian_filter(..., cov_mask)</code> blurs mass into neighbors.'
        },
        legend: {
          it: '<span class="leg-slate">■ Cella iniziale</span><span class="leg-gold">■ Massa traslata + gaussian_filter(cov_mask)</span>',
          en: '<span class="leg-slate">■ Starting cell</span><span class="leg-gold">■ Shifted mass + gaussian_filter(cov_mask)</span>'
        },
        presets: {
          it: [
            { label: 'Traslazione + cov_mask', vals: { dA: 0.35, phiDeg: 18, w: 0.25, blur: 1.15 } },
            { label: 'cov_mask Forte', vals: { dA: 0.22, phiDeg: 10, w: -0.15, blur: 2.10 } }
          ],
          en: [
            { label: 'Shift + cov_mask', vals: { dA: 0.35, phiDeg: 18, w: 0.25, blur: 1.15 } },
            { label: 'Heavy cov_mask', vals: { dA: 0.22, phiDeg: 10, w: -0.15, blur: 2.10 } }
          ]
        },
        sliders: [
          { key: 'dA', min: 0.05, max: 0.55, step: 0.05, labelIt: 'Avanzamento d_A', labelEn: 'Encoder arc d_A', fmt: function (v) { return v.toFixed(2) + ' m'; } },
          { key: 'phiDeg', min: -30, max: 30, step: 2, labelIt: 'Angolo stimato φ_est', labelEn: 'Estimated φ_est', fmt: function (v) { return H.signedFixed(v, 0) + '°'; } },
          { key: 'w', min: -0.6, max: 0.6, step: 0.05, labelIt: 'Rotazione encoder w', labelEn: 'Encoder turn w', fmt: function (v) { return H.signedFixed(v, 2) + ' rad'; } },
          { key: 'blur', min: 0.6, max: 2.3, step: 0.1, labelIt: 'Sfocatura cov_mask', labelEn: 'Blur cov_mask', fmt: function (v) { return v.toFixed(1) + ' cells'; } }
        ],
        renderEq: function (s, tFrac) {
          var dd = s.dA * Math.sin(H.degToRad(s.phiDeg)) * tFrac;
          var dp = s.w * tFrac;
          return (
            '\\begin{aligned}' +
            '\\Delta d &= d_A\\sin(\\hat{\\varphi}) = ' + H.signedFixed(dd, 3) + '\\text{ m}, \\quad w = ' + H.signedFixed(H.radToDeg(dp), 1) + '^\\circ \\\\[4pt]' +
            '\\overline{\\operatorname{bel}} &= \\operatorname{shift}(\\operatorname{bel}) * G_{\\text{cov\\_mask}}(\\sigma=' + H.lerp(0.55, s.blur, tFrac).toFixed(2) + ')' +
            '\\end{aligned}'
          );
        },
        draw: function (ctx, w, h, s, tFrac) {
          ctx.fillStyle = '#09090c';
          ctx.fillRect(0, 0, w, h);
          var grid = buildPredGrid(s, tFrac);
          var maxV = Math.max.apply(null, grid);
          var size = Math.min(w, h) - 64;
          var gx = (w - size) * 0.5;
          var gy = (h - size) * 0.5;
          var cs = size / N;
          for (var r = 0; r < N; r++) {
            for (var c = 0; c < N; c++) {
              var n = grid[r * N + c] / maxV;
              ctx.fillStyle = 'rgba(255, 208, 0, ' + (0.05 + 0.88 * n).toFixed(3) + ')';
              ctx.fillRect(gx + c * cs + 1, gy + r * cs + 1, cs - 2, cs - 2);
            }
          }
          ctx.strokeStyle = 'rgba(148,163,184,0.6)';
          ctx.lineWidth = 1.6;
          ctx.strokeRect(gx + 4 * cs + 1, gy + 4 * cs + 1, cs - 2, cs - 2);
        }
      });
    },

    // 13. HF: generate_vote (Tangent/Normal + Tape Width + Half-Lane)
    'hf-vote': function (container, lang) {
      return H.mountCanvasSim(container, lang, {
        defaults: { ty: -0.10, dSeg: 0.15, lw: 0.04, isYellow: 0 },
        defaultPresetIdx: 0,
        guide: {
          it: '<strong>Cosa osservare:</strong> da <code>p₁ → p₂</code> calcoliamo il versore tangente <code>t_hat</code> e la normale <code>n_hat</code> per <code>d_seg</code>. Sottraendo lo spessore vernice <code>w_paint</code> e mezza corsia <code>w_lane/2 = 0.11 m</code> otteniamo lo scostamento <code>d_i</code> dal centro corsia.',
          en: '<strong>What to watch:</strong> from <code>p₁ → p₂</code> we compute unit tangent <code>t_hat</code> and normal <code>n_hat</code> for <code>d_seg</code>. Subtracting tape width <code>w_paint</code> and half lane <code>w_lane/2 = 0.11 m</code> yields lateral offset <code>d_i</code> from lane center.'
        },
        legend: {
          it: '<span class="leg-gold">■ Tangente t_hat (p₁→p₂)</span><span class="leg-blue">■ Normale n_hat (d_seg)</span><span class="leg-coral">■ −w_paint ∓ w_lane/2</span>',
          en: '<span class="leg-gold">■ Unit tangent t_hat (p₁→p₂)</span><span class="leg-blue">■ Normal n_hat (d_seg)</span><span class="leg-coral">■ −w_paint ∓ w_lane/2</span>'
        },
        presets: {
          it: [
            { label: 'Bordo Bianco (d_i = 0.00 m)', vals: { ty: -0.10, dSeg: 0.15, lw: 0.04, isYellow: 0 } },
            { label: 'Mezzeria Gialla (d_i = 0.00 m)', vals: { ty: 0.10, dSeg: 0.135, lw: 0.025, isYellow: 1 } }
          ],
          en: [
            { label: 'White Border (d_i = 0.00 m)', vals: { ty: -0.10, dSeg: 0.15, lw: 0.04, isYellow: 0 } },
            { label: 'Yellow Divider (d_i = 0.00 m)', vals: { ty: 0.10, dSeg: 0.135, lw: 0.025, isYellow: 1 } }
          ]
        },
        sliders: [
          { key: 'ty', min: -0.45, max: 0.45, step: 0.02, labelIt: 'Componente tangente t_y', labelEn: 'Tangent component t_y', fmt: function (v) { return H.signedFixed(v, 2); } },
          { key: 'dSeg', min: 0.08, max: 0.22, step: 0.005, labelIt: 'Distanza bordo |d_seg|', labelEn: 'Edge distance |d_seg|', fmt: function (v) { return v.toFixed(3) + ' m'; } },
          { key: 'lw', min: 0.00, max: 0.06, step: 0.005, labelIt: 'Spessore striscia w_paint', labelEn: 'Tape width w_paint', fmt: function (v) { return v.toFixed(3) + ' m'; } },
          { key: 'isYellow', min: 0, max: 1, step: 1, labelIt: 'Colore (0=Bianco, 1=Giallo)', labelEn: 'Color (0=White, 1=Yellow)', fmt: function (v) { return v >= 0.5 ? 'Yellow' : 'White'; } }
        ],
        renderEq: function (s, tFrac) {
          var tyEff = H.clamp(s.ty * tFrac, -0.95, 0.95);
          var isY = s.isYellow >= 0.5;
          var phi = (isY ? 1 : -1) * Math.asin(tyEff);
          var dInner = s.dSeg - s.lw * tFrac;
          var di = isY ? (0.11 - dInner) : (dInner - 0.11);
          return (
            '\\begin{aligned}' +
            '\\varphi_i &= ' + (isY ? '' : '-') + '\\arcsin(' + H.signedFixed(tyEff, 2) + ') = {\\color{#ffd000}' + H.signedFixed(phi, 2) + '\\text{ rad}} \\;(' + H.signedFixed(H.radToDeg(phi), 1) + '^\\circ) \\\\[4pt]' +
            'd_i &= ' + (isY
              ? '0.110 - (' + s.dSeg.toFixed(3) + ' - ' + (s.lw * tFrac).toFixed(3) + ')'
              : s.dSeg.toFixed(3) + ' - ' + (s.lw * tFrac).toFixed(3) + ' - 0.110') +
            ' = {\\color{#34d399}' + H.signedFixed(di, 3) + '\\text{ m}}' +
            '\\end{aligned}'
          );
        },
        draw: function (ctx, w, h, s, tFrac) {
          ctx.fillStyle = '#09090c';
          ctx.fillRect(0, 0, w, h);
          var ox = w * 0.5;
          var oy = h * 0.78;
          var scale = Math.min(w, h) * 0.65;
          var isY = s.isYellow >= 0.5;
          var segColor = isY ? '#ffd000' : '#f4f4f6';
          var tyEff = H.clamp(s.ty * tFrac, -0.95, 0.95);
          var txEff = Math.sqrt(Math.max(0.01, 1 - tyEff * tyEff));

          var xEnd = ox + tyEff * scale * 0.72;
          var yEnd = oy - txEff * scale * 0.72;
          H.drawArrow(ctx, ox, oy, xEnd, yEnd, segColor, 3.0);

          var nxEnd = ox - txEff * scale * 0.28;
          var nyEnd = oy - tyEff * scale * 0.28;
          H.drawArrow(ctx, ox, oy, nxEnd, nyEnd, '#60a5fa', 2.2);
          H.drawPill(ctx, 'n_hat', nxEnd - 14, nyEnd, '#60a5fa');

          var dInner = s.dSeg - s.lw * tFrac;
          var di = isY ? (0.11 - dInner) : (dInner - 0.11);
          var laneX = ox + (isY ? -1 : 1) * (s.dSeg - di) * tFrac * scale * 1.3;
          H.drawArrow(ctx, ox, oy - 36, laneX, oy - 36, '#e07a5f', 2.4, [4, 3]);
          H.drawPill(ctx, 'd_i = ' + H.signedFixed(di, 2) + ' m', (ox + laneX) * 0.5, oy - 54, '#e07a5f');
          H.drawPill(ctx, 't_hat → φ_i=' + H.signedFixed((isY ? 1 : -1) * Math.asin(tyEff), 2) + ' rad', xEnd, yEnd - 16, segColor);
        }
      });
    },

    // 14. HF: HADAMARD UPDATE
    'hf-update': function (container, lang) {
      var N = 7;
      function buildHadamard(s, tFrac) {
        var prior = [];
        var lik = [];
        var post = [];
        var sumP = 0;
        var sumL = 0;
        var sumPost = 0;
        var bestVal = -1;
        var bestR = 3;
        var bestC = 3;

        for (var r = 0; r < N; r++) {
          for (var c = 0; c < N; c++) {
            var vp = Math.exp(-0.5 * ((r - 3) * (r - 3) + (c - 2.5) * (c - 2.5)) / 1.8);
            var vl = Math.exp(-0.5 * ((r - (3 + s.offset)) * (r - (3 + s.offset)) + (c - 3.5) * (c - 3.5)) / (s.sharp * s.sharp));
            prior.push(vp);
            lik.push(vl);
            sumP += vp;
            sumL += vl;
          }
        }
        for (var i = 0; i < N * N; i++) {
          prior[i] /= sumP;
          lik[i] /= sumL;
          var h = prior[i] * lik[i];
          post.push(h);
          sumPost += h;
        }
        for (var j = 0; j < N * N; j++) {
          post[j] = H.lerp(prior[j], post[j] / sumPost, tFrac);
          if (post[j] > bestVal) {
            bestVal = post[j];
            bestR = Math.floor(j / N);
            bestC = j % N;
          }
        }
        return { prior: prior, lik: lik, post: post, bestR: bestR, bestC: bestC, bestVal: bestVal };
      }

      return H.mountCanvasSim(container, lang, {
        defaults: { offset: 0.0, sharp: 1.0 },
        defaultPresetIdx: 0,
        guide: {
          it: '<strong>Cosa osservare:</strong> in <code>histogram_update</code>, <code>np.multiply(belief, likelihood)</code> moltiplica ogni cella di <span class="leg-blue">bel_prior</span> per la corrispondente cella di <span class="leg-coral">L</span> (prodotto di Hadamard <code>⊙</code>): sopravvive solo l’intersezione <span class="leg-gold">bel_post</span>.',
          en: '<strong>What to watch:</strong> inside <code>histogram_update</code>, <code>np.multiply(belief, likelihood)</code> multiplies each cell of <span class="leg-blue">bel_prior</span> by <span class="leg-coral">L</span> (Hadamard product <code>⊙</code>): only their intersection <span class="leg-gold">bel_post</span> survives.'
        },
        legend: {
          it: '<span class="leg-blue">■ Prior bel_prior</span><span class="leg-coral">■ Verosimiglianza L</span><span class="leg-gold">■ Posteriore bel_prior ⊙ L</span>',
          en: '<span class="leg-blue">■ Prior bel_prior</span><span class="leg-coral">■ Likelihood L</span><span class="leg-gold">■ Posterior bel_prior ⊙ L</span>'
        },
        presets: {
          it: [
            { label: 'Accordo Allineato', vals: { offset: 0.0, sharp: 1.0 } },
            { label: 'Picco Molto Stretto', vals: { offset: 0.5, sharp: 0.65 } }
          ],
          en: [
            { label: 'Aligned Agreement', vals: { offset: 0.0, sharp: 1.0 } },
            { label: 'Sharp Peak', vals: { offset: 0.5, sharp: 0.65 } }
          ]
        },
        sliders: [
          { key: 'offset', min: -1.5, max: 1.5, step: 0.25, labelIt: 'Scostamento sensore', labelEn: 'Sensor offset', fmt: function (v) { return H.signedFixed(v, 2) + ' cells'; } },
          { key: 'sharp', min: 0.5, max: 2.0, step: 0.1, labelIt: 'Precisione L', labelEn: 'Likelihood width', fmt: function (v) { return v.toFixed(1); } }
        ],
        renderEq: function (s, tFrac) {
          var g = buildHadamard(s, tFrac);
          return (
            '\\begin{aligned}' +
            '\\operatorname{bel}_{i,j} &= \\eta \\cdot \\overline{\\operatorname{bel}}_{i,j} \\odot {\\color{#e07a5f}L_{i,j}} \\\\[4pt]' +
            '\\arg\\max &= (r^*=' + g.bestR + ',\\; c^*=' + g.bestC + '), \\quad P_{\\max} = {\\color{#ffd000}' + (g.bestVal * 100).toFixed(1) + '\\%}' +
            '\\end{aligned}'
          );
        },
        draw: function (ctx, w, h, s, tFrac) {
          ctx.fillStyle = '#09090c';
          ctx.fillRect(0, 0, w, h);
          var g = buildHadamard(s, tFrac);
          var gSize = Math.min((w - 64) / 3, h - 80);
          var gap = 16;
          var startX = (w - (gSize * 3 + gap * 2)) * 0.5;
          var gy = (h - gSize) * 0.5;
          var cs = gSize / N;

          function drawMini(arr, ox, rgb) {
            var mx = Math.max.apply(null, arr);
            for (var r = 0; r < N; r++) {
              for (var c = 0; c < N; c++) {
                var n = arr[r * N + c] / Math.max(1e-6, mx);
                ctx.fillStyle = 'rgba(' + rgb + ', ' + (0.06 + 0.86 * n).toFixed(2) + ')';
                ctx.fillRect(ox + c * cs + 0.5, gy + r * cs + 0.5, cs - 1, cs - 1);
              }
            }
          }

          drawMini(g.prior, startX, '96, 165, 250');
          drawMini(g.lik, startX + gSize + gap, '224, 122, 95');
          drawMini(g.post, startX + (gSize + gap) * 2, '255, 208, 0');

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.8;
          ctx.strokeRect(startX + (gSize + gap) * 2 + g.bestC * cs, gy + g.bestR * cs, cs, cs);

          H.drawPill(ctx, 'bel_prior', startX + gSize * 0.5, gy - 14, '#60a5fa');
          H.drawPill(ctx, '⊙', startX + gSize + gap * 0.5, gy + gSize * 0.5, '#a1a1aa');
          H.drawPill(ctx, 'L', startX + gSize * 1.5 + gap, gy - 14, '#e07a5f');
          H.drawPill(ctx, '=', startX + gSize * 2 + gap * 1.5, gy + gSize * 0.5, '#a1a1aa');
          H.drawPill(ctx, 'bel_post', startX + gSize * 2.5 + gap * 2, gy - 14, '#ffd000');
        }
      });
    }
  });
})();
