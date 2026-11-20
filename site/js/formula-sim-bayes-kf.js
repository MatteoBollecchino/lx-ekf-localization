(function () {
  'use strict';

  var FS = window.FormulaSims;
  if (!FS || !FS.helpers) return;
  var H = FS.helpers;

  function draw1DAxes(ctx, w, h, xMin, xMax, yMax, padL, padR, padT, padB, unitLabel) {
    ctx.fillStyle = '#09090c';
    ctx.fillRect(0, 0, w, h);

    var plotW = w - padL - padR;
    var plotH = h - padT - padB;
    var baseY = h - padB;

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var gx = Math.ceil(xMin); gx <= Math.floor(xMax); gx++) {
      var px = padL + ((gx - xMin) / (xMax - xMin)) * plotW;
      ctx.moveTo(Math.round(px) + 0.5, padT);
      ctx.lineTo(Math.round(px) + 0.5, baseY);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.moveTo(padL, baseY + 0.5);
    ctx.lineTo(w - padR, baseY + 0.5);
    ctx.stroke();

    ctx.save();
    ctx.font = '600 10.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#71717a';
    ctx.textAlign = 'center';
    for (var tx = Math.ceil(xMin); tx <= Math.floor(xMax); tx += 2) {
      var tpx = padL + ((tx - xMin) / (xMax - xMin)) * plotW;
      ctx.fillText(tx + (unitLabel || 'm'), tpx, baseY + 15);
    }
    ctx.restore();

    return {
      plotW: plotW,
      plotH: plotH,
      baseY: baseY,
      toX: function (x) { return padL + ((x - xMin) / (xMax - xMin)) * plotW; },
      toY: function (y) { return baseY - (y / yMax) * plotH; }
    };
  }

  function draw1DCurve(ctx, ax, xMin, xMax, fn, stroke, fill, dash, width) {
    var steps = 140;
    ctx.save();
    ctx.beginPath();
    for (var i = 0; i <= steps; i++) {
      var x = xMin + (i / steps) * (xMax - xMin);
      var px = ax.toX(x);
      var py = ax.toY(fn(x));
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    if (fill) {
      ctx.lineTo(ax.toX(xMax), ax.baseY);
      ctx.lineTo(ax.toX(xMin), ax.baseY);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.beginPath();
      for (var j = 0; j <= steps; j++) {
        var x2 = xMin + (j / steps) * (xMax - xMin);
        var px2 = ax.toX(x2);
        var py2 = ax.toY(fn(x2));
        if (j === 0) ctx.moveTo(px2, py2);
        else ctx.lineTo(px2, py2);
      }
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width || 2.2;
    if (dash) ctx.setLineDash(dash);
    ctx.stroke();
    ctx.restore();
  }

  FS.register({
    // 1. BAYES PREDICT
    'bayes-predict': function (container, lang) {
      function priorPdf(x) {
        return 0.55 * H.gaussian(x, 2.4, 0.45) + 0.45 * H.gaussian(x, 5.2, 0.50);
      }
      function predPdf(x, u, sigU) {
        var s1 = Math.sqrt(0.45 * 0.45 + sigU * sigU);
        var s2 = Math.sqrt(0.50 * 0.50 + sigU * sigU);
        return 0.55 * H.gaussian(x, 2.4 + u, s1) + 0.45 * H.gaussian(x, 5.2 + u, s2);
      }

      return H.mountCanvasSim(container, lang, {
        defaults: { u: 2.2, sigU: 0.55 },
        defaultPresetIdx: 0,
        guide: {
          it: '<strong>Cosa osservare:</strong> l’integrale di predizione trasla la curva iniziale in avanti di <code>+u_t</code> e la <strong>allarga/abbassa</strong> in base al rumore di moto <code>σ_u</code>.',
          en: '<strong>What to watch:</strong> the prediction integral shifts the prior curve forward by <code>+u_t</code> and <strong>widens/flattens</strong> it according to motion noise <code>σ_u</code>.'
        },
        legend: {
          it: '<span class="leg-slate">■ Prior bel(x_{t-1})</span><span class="leg-gold">■ Predizione bel_prior(x_t)</span>',
          en: '<span class="leg-slate">■ Prior bel(x_{t-1})</span><span class="leg-gold">■ Predicted bel_prior(x_t)</span>'
        },
        presets: {
          it: [
            { label: 'Moto Fluido (+2.2 m)', vals: { u: 2.2, sigU: 0.55 } },
            { label: 'Ruote Scivolose (σ_u alta)', vals: { u: 2.4, sigU: 1.05 } },
            { label: 'Passo Preciso', vals: { u: 1.6, sigU: 0.22 } }
          ],
          en: [
            { label: 'Smooth Motion (+2.2 m)', vals: { u: 2.2, sigU: 0.55 } },
            { label: 'Slippery Floor (High σ_u)', vals: { u: 2.4, sigU: 1.05 } },
            { label: 'Tight Odometry', vals: { u: 1.6, sigU: 0.22 } }
          ]
        },
        sliders: [
          { key: 'u', min: 0.0, max: 3.5, step: 0.1, labelIt: 'Spostamento u_t', labelEn: 'Control shift u_t', fmt: function (v) { return '+' + v.toFixed(1) + ' m'; } },
          { key: 'sigU', min: 0.15, max: 1.2, step: 0.05, labelIt: 'Rumore moto σ_u', labelEn: 'Motion noise σ_u', fmt: function (v) { return v.toFixed(2) + ' m'; } }
        ],
        renderEq: function (s, tFrac) {
          var curU = s.u * tFrac;
          var curSig = H.lerp(0.08, s.sigU, tFrac);
          return (
            '\\begin{aligned}' +
            '\\overline{\\operatorname{bel}}(x_t) &= \\int {\\color{#ffd000}\\mathcal{N}(x_t;\\, x_{t-1} + ' + curU.toFixed(2) + ',\\; ' + (curSig * curSig).toFixed(2) + ')}\\,\\operatorname{bel}(x_{t-1})\\,dx_{t-1} \\\\[4pt]' +
            '\\text{shift} &= +' + curU.toFixed(2) + '\\text{ m}, \\qquad \\text{blur } \\sigma_u = ' + curSig.toFixed(2) + '\\text{ m}' +
            '\\end{aligned}'
          );
        },
        draw: function (ctx, w, h, s, tFrac) {
          var ax = draw1DAxes(ctx, w, h, 0, 10, 0.72, 24, 20, 26, 32);
          draw1DCurve(ctx, ax, 0, 10, priorPdf, '#94a3b8', 'rgba(148,163,184,0.12)', [4, 3], 1.8);
          var curU = s.u * tFrac;
          var curSig = H.lerp(0.05, s.sigU, tFrac);
          draw1DCurve(ctx, ax, 0, 10, function (x) { return predPdf(x, curU, curSig); }, '#ffd000', 'rgba(255,208,0,0.16)', null, 2.5);
          H.drawArrow(ctx, ax.toX(2.4), ax.toY(0.55), ax.toX(2.4 + curU), ax.toY(0.55), '#ffd000', 2.0);
          H.drawPill(ctx, '+u = ' + curU.toFixed(2) + 'm', ax.toX(2.4 + curU * 0.5), ax.toY(0.62), '#ffd000');
        }
      });
    },

    // 2. BAYES UPDATE
    'bayes-update': function (container, lang) {
      function priorPdf(x) {
        return 0.5 * H.gaussian(x, 3.0, 0.55) + 0.5 * H.gaussian(x, 7.0, 0.55);
      }
      function postUnnorm(x, z, sigZ) {
        return priorPdf(x) * H.gaussian(x, z, sigZ);
      }

      return H.mountCanvasSim(container, lang, {
        defaults: { z: 6.8, sigZ: 0.65 },
        defaultPresetIdx: 0,
        guide: {
          it: '<strong>Cosa osservare:</strong> il robot è incerto tra due porte (a <code>3 m</code> e <code>7 m</code>). Moltiplicando per la campana del sensore <span class="leg-coral">p(z|x)</span> la porta incompatibile sparisce e <span class="leg-gold">η</span> riporta l’area a 1.',
          en: '<strong>What to watch:</strong> the robot is unsure between two doors (at <code>3 m</code> and <code>7 m</code>). Multiplying by sensor likelihood <span class="leg-coral">p(z|x)</span> kills the wrong door and <span class="leg-gold">η</span> restores area to 1.'
        },
        legend: {
          it: '<span class="leg-slate">■ Prior bimodale bel_prior(x)</span><span class="leg-coral">■ Sensore p(z|x)</span><span class="leg-gold">■ Posteriore η·p·bel_prior</span>',
          en: '<span class="leg-slate">■ Bimodal bel_prior(x)</span><span class="leg-coral">■ Likelihood p(z|x)</span><span class="leg-gold">■ Posterior η·p·bel_prior</span>'
        },
        presets: {
          it: [
            { label: 'Porta Destra (z = 6.8 m)', vals: { z: 6.8, sigZ: 0.65 } },
            { label: 'Porta Sinistra (z = 3.1 m)', vals: { z: 3.1, sigZ: 0.60 } },
            { label: 'Sensore Vago (σ_z alto)', vals: { z: 6.8, sigZ: 1.50 } }
          ],
          en: [
            { label: 'Right Door (z = 6.8 m)', vals: { z: 6.8, sigZ: 0.65 } },
            { label: 'Left Door (z = 3.1 m)', vals: { z: 3.1, sigZ: 0.60 } },
            { label: 'Weak Sensor (High σ_z)', vals: { z: 6.8, sigZ: 1.50 } }
          ]
        },
        sliders: [
          { key: 'z', min: 1.5, max: 8.5, step: 0.1, labelIt: 'Lettura sensore z_t', labelEn: 'Sensor reading z_t', fmt: function (v) { return v.toFixed(1) + ' m'; } },
          { key: 'sigZ', min: 0.3, max: 1.8, step: 0.05, labelIt: 'Rumore sensore σ_z', labelEn: 'Sensor noise σ_z', fmt: function (v) { return v.toFixed(2) + ' m'; } }
        ],
        renderEq: function (s, tFrac) {
          var area = 0;
          var dx = 0.05;
          for (var x = 0; x <= 10; x += dx) area += postUnnorm(x, s.z, s.sigZ) * dx;
          var eta = area > 1e-6 ? 1 / area : 1;
          var curEta = H.lerp(1.0, eta, tFrac);
          return (
            '\\begin{aligned}' +
            '\\operatorname{bel}(x_t) &= {\\color{#ffd000}\\eta=' + curEta.toFixed(2) + '} \\cdot {\\color{#e07a5f}p(' + s.z.toFixed(1) + ' \\mid x_t)} \\cdot \\overline{\\operatorname{bel}}(x_t) \\\\[4pt]' +
            '\\int \\operatorname{bel}(x_t)\\,dx_t &= 1.00 \\quad (\\text{area conserved})' +
            '\\end{aligned}'
          );
        },
        draw: function (ctx, w, h, s, tFrac) {
          var ax = draw1DAxes(ctx, w, h, 0, 10, 0.95, 24, 20, 24, 32);
          var area = 0;
          var dx = 0.05;
          for (var x = 0; x <= 10; x += dx) area += postUnnorm(x, s.z, s.sigZ) * dx;
          var eta = area > 1e-6 ? 1 / area : 1;

          draw1DCurve(ctx, ax, 0, 10, priorPdf, '#94a3b8', 'rgba(148,163,184,0.10)', [4, 3], 1.7);
          draw1DCurve(ctx, ax, 0, 10, function (v) { return H.gaussian(v, s.z, s.sigZ); }, '#e07a5f', 'rgba(224,122,95,0.12)', null, 2.0);
          draw1DCurve(ctx, ax, 0, 10, function (v) {
            return H.lerp(priorPdf(v), Math.min(0.92, eta * postUnnorm(v, s.z, s.sigZ)), tFrac);
          }, '#ffd000', 'rgba(255,208,0,0.20)', null, 2.6);
          H.drawPill(ctx, 'z=' + s.z.toFixed(1) + 'm', ax.toX(s.z), ax.toY(0.86), '#e07a5f');
        }
      });
    },

    // 3. KF ASSUMPTION 1: LINEAR DYNAMICS
    'kf-dyn': function (container, lang) {
      var NOISE_SEEDS = [-1.4, 0.9, -0.3, 1.6, -0.8, 0.2, 1.1, -1.2, 0.5, -0.5, 0.8, -0.1];
      return H.mountCanvasSim(container, lang, {
        defaults: { A: 1.0, u: 1.8, sigQ: 0.45 },
        defaultPresetIdx: 0,
        guide: {
          it: '<strong>Cosa osservare:</strong> partendo da <code>x = 2.0 m</code>, la parte deterministica <code>Ax + Bu</code> sposta il centro della campana, mentre il rumore <code>w_t ~ N(0, Q)</code> disperde i campioni reali (pallini terracotta).',
          en: '<strong>What to watch:</strong> starting from <code>x = 2.0 m</code>, the deterministic term <code>Ax + Bu</code> shifts the bell center, while slip noise <code>w_t ~ N(0, Q)</code> scatters real outcomes (coral dots).'
        },
        legend: {
          it: '<span class="leg-slate">■ x_{t-1} = 2.0 m</span><span class="leg-gold">■ Media Ax + Bu</span><span class="leg-coral">■ Campioni x_t = Ax + Bu + w_t</span>',
          en: '<span class="leg-slate">■ x_{t-1} = 2.0 m</span><span class="leg-gold">■ Mean Ax + Bu</span><span class="leg-coral">■ Samples x_t = Ax + Bu + w_t</span>'
        },
        presets: {
          it: [
            { label: 'Moto Lineare (A=1)', vals: { A: 1.0, u: 1.8, sigQ: 0.45 } },
            { label: 'Attrito (A=0.8)', vals: { A: 0.8, u: 2.2, sigQ: 0.35 } },
            { label: 'Forte Rumore Q', vals: { A: 1.0, u: 1.8, sigQ: 0.95 } }
          ],
          en: [
            { label: 'Pure Shift (A=1)', vals: { A: 1.0, u: 1.8, sigQ: 0.45 } },
            { label: 'Damping (A=0.8)', vals: { A: 0.8, u: 2.2, sigQ: 0.35 } },
            { label: 'High Noise Q', vals: { A: 1.0, u: 1.8, sigQ: 0.95 } }
          ]
        },
        sliders: [
          { key: 'A', min: 0.5, max: 1.3, step: 0.05, labelIt: 'Guadagno stato (A)', labelEn: 'State gain (A)', fmt: function (v) { return v.toFixed(2); } },
          { key: 'u', min: 0.0, max: 3.5, step: 0.1, labelIt: 'Comando (u_t)', labelEn: 'Control (u_t)', fmt: function (v) { return '+' + v.toFixed(1) + ' m'; } },
          { key: 'sigQ', min: 0.05, max: 1.1, step: 0.05, labelIt: 'Rumore σ_Q', labelEn: 'Noise σ_Q', fmt: function (v) { return v.toFixed(2) + ' m'; } }
        ],
        renderEq: function (s, tFrac) {
          var mean = H.lerp(2.0, s.A * 2.0 + s.u, tFrac);
          return (
            '\\begin{aligned}' +
            'x_t &= ' + s.A.toFixed(2) + '(2.0) + ' + s.u.toFixed(1) + ' + w_t = {\\color{#ffd000}' + mean.toFixed(2) + '\\text{ m}} + w_t \\\\[4pt]' +
            'w_t &\\sim \\mathcal{N}(0,\\; Q = ' + (s.sigQ * s.sigQ).toFixed(2) + '\\text{ m}^2)' +
            '\\end{aligned}'
          );
        },
        draw: function (ctx, w, h, s, tFrac) {
          var ax = draw1DAxes(ctx, w, h, 0, 8, 1.1, 24, 20, 24, 32);
          var mean = H.lerp(2.0, s.A * 2.0 + s.u, tFrac);
          draw1DCurve(ctx, ax, 0, 8, function (x) { return H.gaussian(x, mean, s.sigQ); }, '#ffd000', 'rgba(255,208,0,0.14)', null, 2.4);

          ctx.fillStyle = '#e07a5f';
          for (var i = 0; i < NOISE_SEEDS.length; i++) {
            var sx = mean + NOISE_SEEDS[i] * s.sigQ * tFrac;
            ctx.beginPath();
            ctx.arc(ax.toX(sx), ax.baseY - 12 - (i % 3) * 10, 4.2, 0, Math.PI * 2);
            ctx.fill();
          }
          H.drawArrow(ctx, ax.toX(2.0), ax.toY(0.75), ax.toX(mean), ax.toY(0.75), '#ffd000', 2.2);
          H.drawPill(ctx, 'x_{t-1}=2.0', ax.toX(2.0), ax.toY(0.86), '#94a3b8');
          H.drawPill(ctx, 'E[x_t]=' + mean.toFixed(2), ax.toX(mean), ax.toY(0.86), '#ffd000');
        }
      });
    },

    // 4. KF ASSUMPTION 2: LINEAR OBSERVATION
    'kf-obs': function (container, lang) {
      var OBS_SEEDS = [-1.2, 0.7, -0.4, 1.3, -0.7, 0.3, 0.9, -0.9];
      return H.mountCanvasSim(container, lang, {
        defaults: { x: 3.5, Hval: 1.2, sigR: 0.45 },
        defaultPresetIdx: 0,
        guide: {
          it: '<strong>Cosa osservare:</strong> la matrice <code>H</code> è la pendenza della retta che converte lo stato <code>x_t</code> nella lettura attesa <code>H·x_t</code>; il rumore <code>n_t ~ N(0, R)</code> disperde verticalmente le misure reali.',
          en: '<strong>What to watch:</strong> matrix <code>H</code> is the slope converting state <code>x_t</code> into expected reading <code>H·x_t</code>; noise <code>n_t ~ N(0, R)</code> scatters actual readings vertically.'
        },
        legend: {
          it: '<span class="leg-blue">■ Retta z = H·x</span><span class="leg-gold">■ Stato x_t</span><span class="leg-coral">■ Letture rumorose z_t = Hx + n_t</span>',
          en: '<span class="leg-blue">■ Line z = H·x</span><span class="leg-gold">■ State x_t</span><span class="leg-coral">■ Noisy readings z_t = Hx + n_t</span>'
        },
        presets: {
          it: [
            { label: 'Scala H = 1.2', vals: { x: 3.5, Hval: 1.2, sigR: 0.45 } },
            { label: 'Sensore Diretto (H = 1)', vals: { x: 4.0, Hval: 1.0, sigR: 0.30 } },
            { label: 'Sensore Rumoroso', vals: { x: 3.5, Hval: 1.2, sigR: 1.00 } }
          ],
          en: [
            { label: 'Scaled H = 1.2', vals: { x: 3.5, Hval: 1.2, sigR: 0.45 } },
            { label: 'Direct Sensor (H = 1)', vals: { x: 4.0, Hval: 1.0, sigR: 0.30 } },
            { label: 'Noisy Sensor', vals: { x: 3.5, Hval: 1.2, sigR: 1.00 } }
          ]
        },
        sliders: [
          { key: 'x', min: 1.0, max: 6.0, step: 0.1, labelIt: 'Stato vero x_t', labelEn: 'True state x_t', fmt: function (v) { return v.toFixed(1) + ' m'; } },
          { key: 'Hval', min: 0.5, max: 1.8, step: 0.05, labelIt: 'Fattore scala (H)', labelEn: 'Sensor scale (H)', fmt: function (v) { return v.toFixed(2); } },
          { key: 'sigR', min: 0.1, max: 1.2, step: 0.05, labelIt: 'Rumore σ_R', labelEn: 'Noise σ_R', fmt: function (v) { return v.toFixed(2); } }
        ],
        renderEq: function (s, tFrac) {
          var curX = H.lerp(1.0, s.x, tFrac);
          var zMean = s.Hval * curX;
          return (
            '\\begin{aligned}' +
            'z_t &= {\\color{#60a5fa}' + s.Hval.toFixed(2) + '}({\\color{#ffd000}' + curX.toFixed(2) + '}) + n_t = {\\color{#e07a5f}' + zMean.toFixed(2) + '} + n_t \\\\[4pt]' +
            'n_t &\\sim \\mathcal{N}(0,\\; R = ' + (s.sigR * s.sigR).toFixed(2) + ')' +
            '\\end{aligned}'
          );
        },
        draw: function (ctx, w, h, s, tFrac) {
          var ax = draw1DAxes(ctx, w, h, 0, 7, 11, 32, 20, 24, 32);
          var curX = H.lerp(1.0, s.x, tFrac);
          var zMean = s.Hval * curX;

          // Linear map z = H*x
          ctx.save();
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(ax.toX(0), ax.toY(0));
          ctx.lineTo(ax.toX(7), ax.toY(7 * s.Hval));
          ctx.stroke();

          // +/- 2 sigma R band around line
          ctx.fillStyle = 'rgba(224,122,95,0.12)';
          ctx.beginPath();
          ctx.moveTo(ax.toX(0), ax.toY(2 * s.sigR));
          ctx.lineTo(ax.toX(7), ax.toY(7 * s.Hval + 2 * s.sigR));
          ctx.lineTo(ax.toX(7), ax.toY(Math.max(0, 7 * s.Hval - 2 * s.sigR)));
          ctx.lineTo(ax.toX(0), ax.toY(0));
          ctx.closePath();
          ctx.fill();

          // Crosshair at (curX, zMean)
          ctx.strokeStyle = '#ffd000';
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(ax.toX(curX), ax.baseY);
          ctx.lineTo(ax.toX(curX), ax.toY(zMean));
          ctx.lineTo(ax.toX(0), ax.toY(zMean));
          ctx.stroke();
          ctx.restore();

          // Noisy sample points
          ctx.fillStyle = '#e07a5f';
          for (var i = 0; i < OBS_SEEDS.length; i++) {
            var zy = zMean + OBS_SEEDS[i] * s.sigR;
            ctx.beginPath();
            ctx.arc(ax.toX(curX), ax.toY(zy), 4, 0, Math.PI * 2);
            ctx.fill();
          }
          H.drawPill(ctx, 'Hx=' + zMean.toFixed(2), ax.toX(curX), ax.toY(zMean) - 18, '#ffd000');
        }
      });
    },

    // 5. KF ASSUMPTION 3: GAUSSIAN PRIOR
    'kf-prior': function (container, lang) {
      return H.mountCanvasSim(container, lang, {
        defaults: { mu0: 4.0, sig0: 0.70 },
        defaultPresetIdx: 0,
        guide: {
          it: '<strong>Cosa osservare:</strong> <code>μ₀</code> fissa dove pensiamo si trovi il robot a <code>t=0</code>, mentre <code>σ₀</code> indica quanto siamo sicuri (campana stretta = posa nota; campana piatta = robot perso).',
          en: '<strong>What to watch:</strong> <code>μ₀</code> sets where we think the robot starts at <code>t=0</code>, while <code>σ₀</code> sets our confidence (narrow bell = known pose; flat bell = lost robot).'
        },
        legend: {
          it: '<span class="leg-gold">■ Prior N(μ₀, Σ₀)</span><span class="leg-blue">■ Banda ±1σ (68%)</span>',
          en: '<span class="leg-gold">■ Prior N(μ₀, Σ₀)</span><span class="leg-blue">■ ±1σ Band (68%)</span>'
        },
        presets: {
          it: [
            { label: 'Posa Nota (σ₀ = 0.4 m)', vals: { mu0: 4.0, sig0: 0.40 } },
            { label: 'Posa Incerta (σ₀ = 1.3 m)', vals: { mu0: 4.0, sig0: 1.30 } }
          ],
          en: [
            { label: 'Known Start (σ₀ = 0.4 m)', vals: { mu0: 4.0, sig0: 0.40 } },
            { label: 'Lost / Ignorant (σ₀ = 1.3 m)', vals: { mu0: 4.0, sig0: 1.30 } }
          ]
        },
        sliders: [
          { key: 'mu0', min: 2.0, max: 8.0, step: 0.1, labelIt: 'Media iniziale (μ₀)', labelEn: 'Initial mean (μ₀)', fmt: function (v) { return v.toFixed(1) + ' m'; } },
          { key: 'sig0', min: 0.25, max: 1.8, step: 0.05, labelIt: 'Deviazione std (σ₀)', labelEn: 'Std dev (σ₀)', fmt: function (v) { return v.toFixed(2) + ' m'; } }
        ],
        renderEq: function (s, tFrac) {
          var curSig = H.lerp(1.6, s.sig0, tFrac);
          return (
            '\\begin{aligned}' +
            '\\operatorname{bel}(x_0) &= \\mathcal{N}(\\mu_0 = {\\color{#ffd000}' + s.mu0.toFixed(1) + '\\text{ m}},\\; \\Sigma_0 = {\\color{#60a5fa}' + (curSig * curSig).toFixed(2) + '\\text{ m}^2}) \\\\[4pt]' +
            '\\pm 1\\sigma &= [' + (s.mu0 - curSig).toFixed(2) + ',\\; ' + (s.mu0 + curSig).toFixed(2) + ']\\text{ m}' +
            '\\end{aligned}'
          );
        },
        draw: function (ctx, w, h, s, tFrac) {
          var ax = draw1DAxes(ctx, w, h, 0, 10, 1.45, 24, 20, 24, 32);
          var curSig = H.lerp(1.6, s.sig0, tFrac);
          draw1DCurve(ctx, ax, 0, 10, function (x) { return H.gaussian(x, s.mu0, curSig); }, '#ffd000', 'rgba(255,208,0,0.16)', null, 2.5);
          ctx.save();
          ctx.strokeStyle = '#60a5fa';
          ctx.setLineDash([4, 3]);
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(ax.toX(s.mu0 - curSig), ax.baseY);
          ctx.lineTo(ax.toX(s.mu0 - curSig), ax.toY(H.gaussian(s.mu0 - curSig, s.mu0, curSig)));
          ctx.moveTo(ax.toX(s.mu0 + curSig), ax.baseY);
          ctx.lineTo(ax.toX(s.mu0 + curSig), ax.toY(H.gaussian(s.mu0 + curSig, s.mu0, curSig)));
          ctx.stroke();
          ctx.restore();
          H.drawPill(ctx, 'μ₀=' + s.mu0.toFixed(1) + 'm', ax.toX(s.mu0), ax.toY(1.32), '#ffd000');
        }
      });
    },

    // 6. KF PHASE 1: PREDICT
    'kf-p1': function (container, lang) {
      return H.mountCanvasSim(container, lang, {
        defaults: { mu: 2.2, u: 2.3, sig: 0.45, q: 0.45 },
        defaultPresetIdx: 0,
        guide: {
          it: '<strong>Cosa osservare:</strong> durante la predizione la campana trasla di <code>+u_t</code> ma la varianza <strong>aumenta sempre</strong> di <code>+Q</code>, rendendo la curva dorata più larga e più bassa della curva grigia iniziale.',
          en: '<strong>What to watch:</strong> during prediction the bell shifts by <code>+u_t</code> while variance <strong>always grows</strong> by <code>+Q</code>, making the gold curve wider and lower than the initial slate curve.'
        },
        legend: {
          it: '<span class="leg-slate">■ Prior N(μ, Σ)</span><span class="leg-gold">■ Predizione N(μ_prior, Σ_prior)</span>',
          en: '<span class="leg-slate">■ Prior N(μ, Σ)</span><span class="leg-gold">■ Predicted N(μ_prior, Σ_prior)</span>'
        },
        presets: {
          it: [
            { label: 'Passo Standard', vals: { mu: 2.2, u: 2.3, sig: 0.45, q: 0.45 } },
            { label: 'Alto Slittamento Q', vals: { mu: 2.2, u: 2.3, sig: 0.45, q: 1.25 } }
          ],
          en: [
            { label: 'Standard Step', vals: { mu: 2.2, u: 2.3, sig: 0.45, q: 0.45 } },
            { label: 'High Slip Q', vals: { mu: 2.2, u: 2.3, sig: 0.45, q: 1.25 } }
          ]
        },
        sliders: [
          { key: 'mu', min: 1.0, max: 4.5, step: 0.1, labelIt: 'Media iniziale μ', labelEn: 'Prior mean μ', fmt: function (v) { return v.toFixed(1) + ' m'; } },
          { key: 'u', min: 0.5, max: 3.5, step: 0.1, labelIt: 'Comando u_t', labelEn: 'Control u_t', fmt: function (v) { return '+' + v.toFixed(1) + ' m'; } },
          { key: 'sig', min: 0.25, max: 1.0, step: 0.05, labelIt: 'Incertezza σ', labelEn: 'Prior std σ', fmt: function (v) { return v.toFixed(2) + ' m'; } },
          { key: 'q', min: 0.05, max: 1.5, step: 0.05, labelIt: 'Rumore processo Q', labelEn: 'Process noise Q', fmt: function (v) { return v.toFixed(2) + ' m²'; } }
        ],
        renderEq: function (s, tFrac) {
          var curMu = s.mu + s.u * tFrac;
          var curVar = s.sig * s.sig + s.q * tFrac;
          return (
            '\\begin{aligned}' +
            '\\bar{\\mu}_t &= ' + s.mu.toFixed(1) + ' + ' + (s.u * tFrac).toFixed(2) + ' = {\\color{#ffd000}' + curMu.toFixed(2) + '\\text{ m}} \\\\[4pt]' +
            '\\bar{\\Sigma}_t &= ' + (s.sig * s.sig).toFixed(2) + ' + ' + (s.q * tFrac).toFixed(2) + ' = {\\color{#ffd000}' + curVar.toFixed(2) + '\\text{ m}^2}' +
            '\\end{aligned}'
          );
        },
        draw: function (ctx, w, h, s, tFrac) {
          var ax = draw1DAxes(ctx, w, h, 0, 10, 1.35, 24, 20, 24, 32);
          draw1DCurve(ctx, ax, 0, 10, function (x) { return H.gaussian(x, s.mu, s.sig); }, '#94a3b8', 'rgba(148,163,184,0.12)', [4, 3], 1.8);
          var curMu = s.mu + s.u * tFrac;
          var curSig = Math.sqrt(s.sig * s.sig + s.q * tFrac);
          draw1DCurve(ctx, ax, 0, 10, function (x) { return H.gaussian(x, curMu, curSig); }, '#ffd000', 'rgba(255,208,0,0.16)', null, 2.5);
          H.drawArrow(ctx, ax.toX(s.mu), ax.toY(1.12), ax.toX(curMu), ax.toY(1.12), '#ffd000', 2.0);
        }
      });
    },

    // 7. KF PHASE 2: INNOVATION
    'kf-p2': function (container, lang) {
      return H.mountCanvasSim(container, lang, {
        defaults: { muBar: 4.0, z: 5.4, sigBar: 0.65, sigR: 0.55 },
        defaultPresetIdx: 0,
        guide: {
          it: '<strong>Cosa osservare:</strong> la freccia gialla <code>y_t = z_t − H·μ_prior</code> è la <strong>sorpresa</strong> (distanza tra ciò che legge il sensore e ciò che avevamo predetto), mentre <code>S_t</code> somma le due incertezze.',
          en: '<strong>What to watch:</strong> the gold arrow <code>y_t = z_t − H·μ_prior</code> is the <strong>surprise</strong> (gap between sensor reading and prediction), while <code>S_t</code> sums both uncertainties.'
        },
        legend: {
          it: '<span class="leg-blue">■ Predizione μ_prior</span><span class="leg-coral">■ Sensore z_t</span><span class="leg-gold">■ Sorpresa y_t = z_t − H·μ_prior</span>',
          en: '<span class="leg-blue">■ Predicted μ_prior</span><span class="leg-coral">■ Sensor z_t</span><span class="leg-gold">■ Innovation y_t = z_t − H·μ_prior</span>'
        },
        presets: {
          it: [
            { label: 'Sorpresa Positiva', vals: { muBar: 4.0, z: 5.4, sigBar: 0.65, sigR: 0.55 } },
            { label: 'Accordo Perfetto (y=0)', vals: { muBar: 4.5, z: 4.5, sigBar: 0.60, sigR: 0.55 } }
          ],
          en: [
            { label: 'Positive Surprise', vals: { muBar: 4.0, z: 5.4, sigBar: 0.65, sigR: 0.55 } },
            { label: 'Exact Match (y=0)', vals: { muBar: 4.5, z: 4.5, sigBar: 0.60, sigR: 0.55 } }
          ]
        },
        sliders: [
          { key: 'muBar', min: 1.5, max: 6.5, step: 0.1, labelIt: 'Predizione μ_prior', labelEn: 'Predicted μ_prior', fmt: function (v) { return v.toFixed(1) + ' m'; } },
          { key: 'z', min: 1.5, max: 8.5, step: 0.1, labelIt: 'Misura z_t', labelEn: 'Sensor z_t', fmt: function (v) { return v.toFixed(1) + ' m'; } },
          { key: 'sigBar', min: 0.3, max: 1.2, step: 0.05, labelIt: 'Std predizione', labelEn: 'Pred std', fmt: function (v) { return v.toFixed(2) + ' m'; } },
          { key: 'sigR', min: 0.25, max: 1.2, step: 0.05, labelIt: 'Std sensore', labelEn: 'Sensor std', fmt: function (v) { return v.toFixed(2) + ' m'; } }
        ],
        renderEq: function (s, tFrac) {
          var y = (s.z - s.muBar) * tFrac;
          var S = s.sigBar * s.sigBar + s.sigR * s.sigR;
          return (
            '\\begin{aligned}' +
            'y_t &= ' + s.z.toFixed(1) + ' - ' + s.muBar.toFixed(1) + ' = {\\color{#ffd000}' + H.signedFixed(y, 2) + '\\text{ m}} \\\\[4pt]' +
            'S_t &= ' + (s.sigBar * s.sigBar).toFixed(2) + ' + ' + (s.sigR * s.sigR).toFixed(2) + ' = {\\color{#e07a5f}' + S.toFixed(2) + '\\text{ m}^2}' +
            '\\end{aligned}'
          );
        },
        draw: function (ctx, w, h, s, tFrac) {
          var ax = draw1DAxes(ctx, w, h, 0, 10, 1.35, 24, 20, 24, 32);
          draw1DCurve(ctx, ax, 0, 10, function (x) { return H.gaussian(x, s.muBar, s.sigBar); }, '#60a5fa', 'rgba(96,165,250,0.12)', null, 2.0);
          draw1DCurve(ctx, ax, 0, 10, function (x) { return H.gaussian(x, s.z, s.sigR); }, '#e07a5f', 'rgba(224,122,95,0.12)', null, 2.0);
          var tipX = H.lerp(s.muBar, s.z, tFrac);
          H.drawArrow(ctx, ax.toX(s.muBar), ax.toY(1.08), ax.toX(tipX), ax.toY(1.08), '#ffd000', 2.6);
          H.drawPill(ctx, 'y = ' + H.signedFixed((s.z - s.muBar) * tFrac, 2) + 'm', ax.toX((s.muBar + tipX) * 0.5), ax.toY(1.22), '#ffd000');
        }
      });
    },

    // 8. KF PHASE 3: KALMAN GAIN CURVE
    'kf-p3': function (container, lang) {
      return H.mountCanvasSim(container, lang, {
        defaults: { sigBar: 0.70, sigR: 0.50 },
        defaultPresetIdx: 0,
        guide: {
          it: '<strong>Cosa osservare:</strong> <code>K_t ∈ [0, 1]</code> è la percentuale di ragione data al sensore: se il sensore è preciso (<code>σ_R</code> piccolo) <code>K → 1</code>; se il sensore è rumoroso (<code>σ_R</code> grande) <code>K → 0</code>.',
          en: '<strong>What to watch:</strong> <code>K_t ∈ [0, 1]</code> is the percentage of trust given to the sensor: when sensor noise <code>σ_R</code> is small, <code>K → 1</code>; when <code>σ_R</code> is large, <code>K → 0</code>.'
        },
        legend: {
          it: '<span class="leg-gold">■ Curva K(R) = Σ_prior / (Σ_prior + R)</span><span class="leg-coral">■ Punto operativo attuale</span>',
          en: '<span class="leg-gold">■ Curve K(R) = Σ_prior / (Σ_prior + R)</span><span class="leg-coral">■ Current operating point</span>'
        },
        presets: {
          it: [
            { label: 'Bilanciato (K ≈ 0.66)', vals: { sigBar: 0.70, sigR: 0.50 } },
            { label: 'Fidati del Sensore (K → 1)', vals: { sigBar: 1.00, sigR: 0.20 } },
            { label: 'Sensore Rumoroso (K → 0)', vals: { sigBar: 0.35, sigR: 1.30 } }
          ],
          en: [
            { label: 'Balanced (K ≈ 0.66)', vals: { sigBar: 0.70, sigR: 0.50 } },
            { label: 'Trust Sensor (K → 1)', vals: { sigBar: 1.00, sigR: 0.20 } },
            { label: 'Noisy Sensor (K → 0)', vals: { sigBar: 0.35, sigR: 1.30 } }
          ]
        },
        sliders: [
          { key: 'sigBar', min: 0.2, max: 1.3, step: 0.05, labelIt: 'Std predizione (σ_prior)', labelEn: 'Pred std (σ_prior)', fmt: function (v) { return v.toFixed(2) + ' m'; } },
          { key: 'sigR', min: 0.15, max: 1.5, step: 0.05, labelIt: 'Std sensore (σ_R)', labelEn: 'Sensor std (σ_R)', fmt: function (v) { return v.toFixed(2) + ' m'; } }
        ],
        renderEq: function (s, tFrac) {
          var vBar = s.sigBar * s.sigBar;
          var vR = H.lerp(0.05, s.sigR * s.sigR, tFrac);
          var K = vBar / (vBar + vR);
          return (
            '\\begin{aligned}' +
            'K_t &= \\frac{\\bar{\\Sigma}}{\\bar{\\Sigma} + R} = \\frac{' + vBar.toFixed(2) + '}{' + vBar.toFixed(2) + ' + ' + vR.toFixed(2) + '} = {\\color{#ffd000}' + K.toFixed(3) + '} \\\\[4pt]' +
            '\\text{Trust} &: {\\color{#ffd000}' + Math.round(K * 100) + '\\%\\text{ Sensor}},\\; ' + Math.round((1 - K) * 100) + '\\%\\text{ Model}' +
            '\\end{aligned}'
          );
        },
        draw: function (ctx, w, h, s, tFrac) {
          var ax = draw1DAxes(ctx, w, h, 0, 2.5, 1.15, 34, 20, 24, 32, 'm²');
          var vBar = s.sigBar * s.sigBar;
          var vR = H.lerp(0.05, s.sigR * s.sigR, tFrac);
          var K = vBar / (vBar + vR);

          draw1DCurve(ctx, ax, 0, 2.5, function (r) { return vBar / (vBar + r); }, '#ffd000', 'rgba(255,208,0,0.12)', null, 2.5);

          var px = ax.toX(vR);
          var py = ax.toY(K);
          ctx.save();
          ctx.strokeStyle = 'rgba(224,122,95,0.6)';
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(px, ax.baseY);
          ctx.lineTo(px, py);
          ctx.lineTo(ax.toX(0), py);
          ctx.stroke();
          ctx.fillStyle = '#e07a5f';
          ctx.beginPath();
          ctx.arc(px, py, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          H.drawPill(ctx, 'K=' + K.toFixed(2), px + 30, py - 14, '#ffd000');
        }
      });
    },

    // 9. KF PHASE 4: POSTERIOR UPDATE
    'kf-p4': function (container, lang) {
      function solve1D(s) {
        var vBar = s.sigBar * s.sigBar;
        var vR = s.sigR * s.sigR;
        var K = vBar / (vBar + vR);
        var muPost = s.muBar + K * (s.z - s.muBar);
        var vPost = (1 - K) * vBar;
        return { K: K, muPost: muPost, sigPost: Math.sqrt(vPost), vBar: vBar, vPost: vPost };
      }

      return H.mountCanvasSim(container, lang, {
        defaults: { muBar: 3.4, z: 6.2, sigBar: 0.75, sigR: 0.55 },
        defaultPresetIdx: 0,
        guide: {
          it: '<strong>Cosa osservare:</strong> la campana finale fusa (<span class="leg-gold">oro</span>) si posiziona tra predizione (<span class="leg-blue">blu</span>) e sensore (<span class="leg-coral">terracotta</span>) ed è <strong>sempre più stretta e alta di entrambe</strong>!',
          en: '<strong>What to watch:</strong> the fused posterior bell (<span class="leg-gold">gold</span>) lands between prediction (<span class="leg-blue">blue</span>) and sensor (<span class="leg-coral">coral</span>) and is <strong>always narrower and taller than both</strong>!'
        },
        legend: {
          it: '<span class="leg-blue">■ Predizione</span><span class="leg-coral">■ Sensore</span><span class="leg-gold">■ Posteriore Fuso (più stretto!)</span>',
          en: '<span class="leg-blue">■ Predicted</span><span class="leg-coral">■ Sensor</span><span class="leg-gold">■ Fused Posterior (narrower!)</span>'
        },
        presets: {
          it: [
            { label: 'Fusione Standard', vals: { muBar: 3.4, z: 6.2, sigBar: 0.75, sigR: 0.55 } },
            { label: 'Tag Preciso (σ_R=0.25)', vals: { muBar: 3.4, z: 6.2, sigBar: 0.75, sigR: 0.25 } }
          ],
          en: [
            { label: 'Balanced Fusion', vals: { muBar: 3.4, z: 6.2, sigBar: 0.75, sigR: 0.55 } },
            { label: 'Sharp Tag (σ_R=0.25)', vals: { muBar: 3.4, z: 6.2, sigBar: 0.75, sigR: 0.25 } }
          ]
        },
        sliders: [
          { key: 'muBar', min: 1.5, max: 6.0, step: 0.1, labelIt: 'Predizione μ_prior', labelEn: 'Predicted μ_prior', fmt: function (v) { return v.toFixed(1) + ' m'; } },
          { key: 'z', min: 2.0, max: 8.5, step: 0.1, labelIt: 'Sensore z_t', labelEn: 'Sensor z_t', fmt: function (v) { return v.toFixed(1) + ' m'; } },
          { key: 'sigBar', min: 0.3, max: 1.3, step: 0.05, labelIt: 'Std modello', labelEn: 'Prior std', fmt: function (v) { return v.toFixed(2) + ' m'; } },
          { key: 'sigR', min: 0.2, max: 1.2, step: 0.05, labelIt: 'Std sensore', labelEn: 'Sensor std', fmt: function (v) { return v.toFixed(2) + ' m'; } }
        ],
        renderEq: function (s, tFrac) {
          var r = solve1D(s);
          var curMu = H.lerp(s.muBar, r.muPost, tFrac);
          var curSig = H.lerp(s.sigBar, r.sigPost, tFrac);
          return (
            '\\begin{aligned}' +
            '\\mu_t &= ' + s.muBar.toFixed(1) + ' + ' + r.K.toFixed(2) + '(' + (s.z - s.muBar).toFixed(1) + ') = {\\color{#ffd000}' + curMu.toFixed(2) + '\\text{ m}} \\\\[4pt]' +
            '\\Sigma_t &= (1 - ' + r.K.toFixed(2) + ')' + r.vBar.toFixed(2) + ' = {\\color{#ffd000}' + (curSig * curSig).toFixed(2) + '\\text{ m}^2}' +
            '\\end{aligned}'
          );
        },
        draw: function (ctx, w, h, s, tFrac) {
          var r = solve1D(s);
          var ax = draw1DAxes(ctx, w, h, 0, 10, 1.55, 24, 20, 24, 32);
          draw1DCurve(ctx, ax, 0, 10, function (x) { return H.gaussian(x, s.muBar, s.sigBar); }, '#60a5fa', 'rgba(96,165,250,0.10)', null, 1.8);
          draw1DCurve(ctx, ax, 0, 10, function (x) { return H.gaussian(x, s.z, s.sigR); }, '#e07a5f', 'rgba(224,122,95,0.10)', null, 1.8);
          var curMu = H.lerp(s.muBar, r.muPost, tFrac);
          var curSig = H.lerp(s.sigBar, r.sigPost, tFrac);
          draw1DCurve(ctx, ax, 0, 10, function (x) { return Math.min(1.5, H.gaussian(x, curMu, curSig)); }, '#ffd000', 'rgba(255,208,0,0.22)', null, 2.8);
          H.drawPill(ctx, 'μ=' + curMu.toFixed(2), ax.toX(curMu), ax.toY(1.4), '#ffd000');
        }
      });
    }
  });
})();
