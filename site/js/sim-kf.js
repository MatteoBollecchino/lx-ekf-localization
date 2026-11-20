(function () {
  'use strict';

  var LS = window.LocSims;
  if (!LS) return;
  var M = LS.math;
  var D = LS.draw;

  function initKF() {
    var root = document.getElementById('lab-kf');
    if (!root) return;

    var btnNoise = root.querySelector('[data-sim-kf-noise]');
    var btnInit = root.querySelector('[data-sim-kf-init]');

    var STEP_U = 1.65;
    var Q_VAR = 0.28;
    var R_LOW = 0.36;
    var R_HIGH = 1.65;

    function resetUser(u) {
      var highInit = !!u.highInit;
      var highNoise = !!u.highNoise;
      u.trueX = 1.2;
      u.prevTrueX = 1.2;
      u.odoX = 1.2;
      u.prevOdoX = 1.2;

      u.mu = 1.2;
      u.sigma2 = highInit ? 2.4 : 0.14;
      u.prevMu = u.mu;
      u.prevSigma2 = u.sigma2;

      u.muBar = u.mu;
      u.sigma2Bar = u.sigma2;
      u.z = u.trueX;
      u.K = 0;
      u.displayK = 0.5;
      u.prevDisplayK = 0.5;
      u.postMu = u.mu;
      u.postSigma2 = u.sigma2;
      u.R = highNoise ? R_HIGH : R_LOW;
      u.cycleInLap = 0;
    }

    function computeLapWrapIfNeeded(u) {
      if (u.trueX > 9.4) {
        u.trueX = 1.2;
        u.prevTrueX = 1.2;
        u.odoX = 1.2;
        u.prevOdoX = 1.2;
        u.mu = 1.2 + (M.randn() * Math.sqrt(u.sigma2) * 0.35);
        u.prevMu = u.mu;
        u.cycleInLap = 0;
      }
    }

    function syncExtraBtnText(lang, u) {
      if (btnNoise) {
        btnNoise.textContent =
          lang === 'it'
            ? u.highNoise
              ? 'Rumore Sensore R: Alto'
              : 'Rumore Sensore R: Basso'
            : u.highNoise
              ? 'Sensor Noise R: High'
              : 'Sensor Noise R: Low';
        btnNoise.classList.toggle('active-toggle', !!u.highNoise);
      }
      if (btnInit) {
        btnInit.textContent =
          lang === 'it'
            ? u.highInit
              ? 'Iniziale Σ₀: Ignaro'
              : 'Iniziale Σ₀: Nota'
            : u.highInit
              ? 'Prior Σ₀: Ignorant'
              : 'Prior Σ₀: Known';
        btnInit.classList.toggle('active-toggle', !!u.highInit);
      }
    }

    var lab = LS.createLab('lab-kf', {
      phaseDurations: [1.6, 2.7, 2.6, 2.9],
      phaseLabels: {
        en: ['01 Prior', '02 Predict', '03 Measure', '04 Update'],
        it: ['01 Priori', '02 Predizione', '03 Misura', '04 Update']
      },
      phases: {
        en: [
          {
            title: function (u, st) {
              return 'Cycle ' + st.cycle + ' — Current Belief \\(\\operatorname{bel}(x)\\)';
            },
            desc:
              'All history collapses into two numbers: mean \\(\\mu\\) and variance \\(\\Sigma\\). Memory stays \\(\\mathcal{O}(1)\\) instead of storing past trajectories.',
            eq: function (u) {
              return (
                '\\operatorname{bel}(x) = \\mathcal{N}(\\mu = ' +
                u.mu.toFixed(2) +
                '\\text{ m},\\; \\Sigma = ' +
                u.sigma2.toFixed(2) +
                '\\text{ m}^2)'
              );
            },
            eqExplain: [
              { sym: '\\operatorname{bel}(x)', label: 'Gaussian Belief', desc: 'Probability distribution over the robot’s 1D position \\(x\\) summarized by a single bell curve.' },
              { sym: '\\mu', label: 'Mean Position', desc: 'Most likely position estimate (center of the gold bell curve).' },
              { sym: '\\Sigma', label: 'Variance (Uncertainty)', desc: 'Spread of the bell curve: smaller \\(\\Sigma\\) means higher confidence.' }
            ]
          },
          {
            title: 'Predict — Blindfolded Motion (\\(+u_t, +Q\\))',
            desc:
              'Wheel odometry shifts the mean forward (\\(+Bu_t\\)), while unmodeled slip inflates covariance by \\(Q\\). Certainty decreases.',
            eq: function (u) {
              return (
                '\\begin{aligned}\\bar{\\mu} &= \\mu + u = ' +
                u.muBar.toFixed(2) +
                '\\text{ m}\\\\ \\bar{\\Sigma} &= \\Sigma + Q = ' +
                u.sigma2Bar.toFixed(2) +
                '\\text{ m}^2\\end{aligned}'
              );
            },
            eqExplain: [
              { sym: '\\bar{\\mu}', label: 'Predicted Mean', desc: 'New expected position after applying wheel odometry command \\(u\\).' },
              { sym: 'u', label: 'Control / Odometry Step', desc: 'Measured displacement from wheel encoders between step \\(t-1\\) and \\(t\\).' },
              { sym: '\\bar{\\Sigma}', label: 'Predicted Variance', desc: 'Expanded uncertainty before seeing any landmark.' },
              { sym: 'Q', label: 'Process Noise', desc: 'Extra uncertainty injected by wheel slip, floor bumps, and actuator drift.' }
            ]
          },
          {
            title: 'Observe — Sensor Likelihood \\(\\mathcal{N}(z_t, R)\\)',
            desc:
              'A noisy landmark reading \\(z_t\\) yields an independent Gaussian. The innovation \\(y = z_t - H\\bar{\\mu}\\) measures surprise against prediction.',
            eq: function (u) {
              var innov = u.z - u.muBar;
              return (
                '\\begin{aligned}z_t &= ' +
                u.z.toFixed(2) +
                '\\text{ m} \\quad (R = ' +
                u.R.toFixed(2) +
                ')\\\\ y &= z_t - \\bar{\\mu} = ' +
                (innov >= 0 ? '+' : '') +
                innov.toFixed(2) +
                '\\text{ m}\\end{aligned}'
              );
            },
            eqExplain: [
              { sym: 'z_t', label: 'Sensor Measurement', desc: 'Raw position reading from the landmark sensor (terracotta bell curve).' },
              { sym: 'R', label: 'Sensor Noise Variance', desc: 'How noisy the sensor is: larger \\(R\\) flattens the sensor curve.' },
              { sym: 'y', label: 'Innovation (Surprise)', desc: 'Difference between what the sensor saw (\\(z_t\\)) and what motion predicted (\\(\\bar{\\mu}\\)).' }
            ]
          },
          {
            title: 'Update — Kalman Gain Fusion (\\(K\\))',
            desc:
              '\\(K\\) arbitrates trust between prior and sensor. Multiplying two Gaussians pulls the estimate toward ground truth and shrinks \\(\\Sigma\\) below either source.',
            eq: function (u) {
              return (
                '\\begin{aligned}K &= \\frac{\\bar{\\Sigma}}{\\bar{\\Sigma}+R} = ' +
                u.K.toFixed(3) +
                '\\\\ \\mu &= ' +
                u.postMu.toFixed(2) +
                '\\text{ m}, \\quad \\Sigma = ' +
                u.postSigma2.toFixed(2) +
                '\\text{ m}^2\\end{aligned}'
              );
            },
            eqExplain: [
              { sym: 'K', label: 'Kalman Gain', desc: 'Trust weight in \\([0, 1]\\): near \\(1\\) trusts the sensor; near \\(0\\) trusts motion.' },
              { sym: '\\mu', label: 'Fused Posterior Mean', desc: 'Corrected position pulled toward the sensor reading by fraction \\(K\\) of the surprise.' },
              { sym: '\\Sigma', label: 'Fused Posterior Variance', desc: 'Always strictly smaller than both \\(\\bar{\\Sigma}\\) and \\(R\\) alone.' }
            ]
          }
        ],
        it: [
          {
            title: function (u, st) {
              return 'Ciclo ' + st.cycle + ' — Credenza Attuale \\(\\operatorname{bel}(x)\\)';
            },
            desc:
              'Tutta la storia collassa in due soli numeri: media \\(\\mu\\) e varianza \\(\\Sigma\\). La memoria rimane \\(\\mathcal{O}(1)\\) senza salvare le traiettorie passate.',
            eq: function (u) {
              return (
                '\\operatorname{bel}(x) = \\mathcal{N}(\\mu = ' +
                u.mu.toFixed(2) +
                '\\text{ m},\\; \\Sigma = ' +
                u.sigma2.toFixed(2) +
                '\\text{ m}^2)'
              );
            },
            eqExplain: [
              { sym: '\\operatorname{bel}(x)', label: 'Credenza Gaussiana', desc: 'Distribuzione di probabilità sulla posizione 1D \\(x\\) riassunta da una sola campana.' },
              { sym: '\\mu', label: 'Media Stimata', desc: 'Posizione più probabile del robot (centro della campana dorata).' },
              { sym: '\\Sigma', label: 'Varianza (Incertezza)', desc: 'Ampiezza della campana: più \\(\\Sigma\\) è piccola, più la stima è sicura.' }
            ]
          },
          {
            title: 'Predizione — Moto al Buio (\\(+u_t, +Q\\))',
            desc:
              'L’odometria sposta in avanti la media (\\(+Bu_t\\)), mentre lo slittamento non modellato dilata la varianza (\\(+Q\\)). La certezza cala.',
            eq: function (u) {
              return (
                '\\begin{aligned}\\bar{\\mu} &= \\mu + u = ' +
                u.muBar.toFixed(2) +
                '\\text{ m}\\\\ \\bar{\\Sigma} &= \\Sigma + Q = ' +
                u.sigma2Bar.toFixed(2) +
                '\\text{ m}^2\\end{aligned}'
              );
            },
            eqExplain: [
              { sym: '\\bar{\\mu}', label: 'Media Predetta', desc: 'Nuova posizione attesa dopo aver applicato il comando odometrico \\(u\\).' },
              { sym: 'u', label: 'Spostamento (Controllo)', desc: 'Avanzamento stimato dagli encoder delle ruote tra \\(t-1\\) e \\(t\\).' },
              { sym: '\\bar{\\Sigma}', label: 'Varianza Predetta', desc: 'Incertezza dilatata dal movimento al buio prima di leggere il sensore.' },
              { sym: 'Q', label: 'Rumore di Processo', desc: 'Incertezza aggiunta da slittamento ruote, attrito e disturbi fisici.' }
            ]
          },
          {
            title: 'Osservazione — Verosimiglianza \\(\\mathcal{N}(z_t, R)\\)',
            desc:
              'Una lettura rumorosa \\(z_t\\) genera una gaussiana indipendente. L’innovazione \\(y = z_t - H\\bar{\\mu}\\) quantifica la sorpresa rispetto alla predizione.',
            eq: function (u) {
              var innov = u.z - u.muBar;
              return (
                '\\begin{aligned}z_t &= ' +
                u.z.toFixed(2) +
                '\\text{ m} \\quad (R = ' +
                u.R.toFixed(2) +
                ')\\\\ y &= z_t - \\bar{\\mu} = ' +
                (innov >= 0 ? '+' : '') +
                innov.toFixed(2) +
                '\\text{ m}\\end{aligned}'
              );
            },
            eqExplain: [
              { sym: 'z_t', label: 'Misura del Sensore', desc: 'Lettura diretta del sensore rispetto al landmark (campana terracotta).' },
              { sym: 'R', label: 'Varianza del Sensore', desc: 'Quanto è rumoroso il sensore: più \\(R\\) è grande, più la campana è larga.' },
              { sym: 'y', label: 'Innovazione (Sorpresa)', desc: 'Differenza tra la lettura reale (\\(z_t\\)) e ciò che il modello si aspettava (\\(\\bar{\\mu}\\)).' }
            ]
          },
          {
            title: 'Update — Fusione col Guadagno \\(K\\)',
            desc:
              '\\(K\\) arbitra la fiducia fra modello e sensore. Il prodotto tra le due gaussiane centra la stima sul robot e riduce \\(\\Sigma\\) sotto entrambe le fonti.',
            eq: function (u) {
              return (
                '\\begin{aligned}K &= \\frac{\\bar{\\Sigma}}{\\bar{\\Sigma}+R} = ' +
                u.K.toFixed(3) +
                '\\\\ \\mu &= ' +
                u.postMu.toFixed(2) +
                '\\text{ m}, \\quad \\Sigma = ' +
                u.postSigma2.toFixed(2) +
                '\\text{ m}^2\\end{aligned}'
              );
            },
            eqExplain: [
              { sym: 'K', label: 'Guadagno di Kalman', desc: 'Peso di fiducia in \\([0, 1]\\): vicino a \\(1\\) si fida del sensore, vicino a \\(0\\) del modello.' },
              { sym: '\\mu', label: 'Media Fusa (Posteriore)', desc: 'Stima corretta avvicinata al sensore in proporzione a \\(K \\cdot y\\).' },
              { sym: '\\Sigma', label: 'Varianza Fusa', desc: 'Risulta sempre più stretta sia di \\(\\bar{\\Sigma}\\) che di \\(R\\) presi singolarmente.' }
            ]
          }
        ]
      },
      onReset: function (u) {
        resetUser(u);
      },
      onLangChange: function (lang, u) {
        syncExtraBtnText(lang, u);
      },
      onEnterPhase: function (phase, u) {
        u.R = u.highNoise ? R_HIGH : R_LOW;
        if (phase === 0) {
          if (u.cycleInLap > 0) {
            u.mu = u.postMu;
            u.sigma2 = u.postSigma2;
            u.prevMu = u.mu;
            u.prevSigma2 = u.sigma2;
          }
          computeLapWrapIfNeeded(u);
          u.muBar = u.mu;
          u.sigma2Bar = u.sigma2;
          u.postMu = u.mu;
          u.postSigma2 = u.sigma2;
          u.prevDisplayK = u.displayK;
        } else if (phase === 1) {
          u.cycleInLap += 1;
          u.prevTrueX = u.trueX;
          u.prevOdoX = u.odoX;
          u.prevMu = u.mu;
          u.prevSigma2 = u.sigma2;

          var trueMove = STEP_U + M.randn() * 0.24;
          u.trueX = M.clamp(u.prevTrueX + trueMove, 0.8, 10.6);
          u.odoX = M.clamp(u.prevOdoX + STEP_U, 0.8, 10.6);
          u.muBar = u.prevMu + STEP_U;
          u.sigma2Bar = u.prevSigma2 + Q_VAR;
          u.K = u.sigma2Bar / (u.sigma2Bar + u.R);
        } else if (phase === 2) {
          u.z = M.clamp(u.trueX + M.randn() * Math.sqrt(u.R) * 0.65, 0.5, 11.2);
          u.K = u.sigma2Bar / (u.sigma2Bar + u.R);
        } else if (phase === 3) {
          u.K = u.sigma2Bar / (u.sigma2Bar + u.R);
          u.postMu = u.muBar + u.K * (u.z - u.muBar);
          u.postSigma2 = (1 - u.K) * u.sigma2Bar;
          u.prevDisplayK = u.displayK;
          u.displayK = u.K;
        }
      },
      getTelemetry: function (lang, u, st) {
        var muShow = st.phase === 0 ? u.mu : st.phase === 3 ? u.postMu : u.muBar;
        var sigShow = st.phase === 0 ? u.sigma2 : st.phase === 3 ? u.postSigma2 : u.sigma2Bar;
        return [
          {
            label: lang === 'it' ? 'Posizione Vera' : 'True Pose',
            value: u.trueX.toFixed(2) + ' m'
          },
          {
            label: lang === 'it' ? 'Stima μ ± σ' : 'Belief μ ± σ',
            value: muShow.toFixed(2) + ' ± ' + Math.sqrt(sigShow).toFixed(2) + ' m',
            gold: true
          },
          {
            label: lang === 'it' ? 'Guadagno K' : 'Kalman Gain K',
            value: (st.phase >= 2 || u.cycleInLap > 0 ? u.K : u.sigma2 / (u.sigma2 + u.R)).toFixed(3),
            gold: st.phase === 3
          }
        ];
      },
      onRender: function (ctx, w, h, phase, progress, dt, lang, u) {
        D.obsidianBg(ctx, w, h);

        var padL = 34;
        var padR = 26;
        var plotW = w - padL - padR;
        var worldMin = 0;
        var worldMax = 11.5;

        function toX(m) {
          return padL + ((m - worldMin) / (worldMax - worldMin)) * plotW;
        }

        var trackY = Math.round(h * 0.22);
        var baseLineY = Math.round(h * 0.74);
        var curveMaxH = Math.round(h * 0.36);
        var barY = Math.round(h * 0.87);

        D.hairlineGrid(ctx, padL, 18, plotW, baseLineY - 18, Math.max(36, Math.round(plotW / 11)), 0.035);

        // Corridor centerline & distance ticks
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, trackY);
        ctx.lineTo(w - padR, trackY);
        ctx.moveTo(padL, baseLineY);
        ctx.lineTo(w - padR, baseLineY);
        ctx.stroke();

        ctx.fillStyle = '#71717a';
        ctx.font = '500 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        for (var m = 0; m <= 11; m += 1) {
          var tx = toX(m);
          ctx.beginPath();
          ctx.moveTo(tx, baseLineY);
          ctx.lineTo(tx, baseLineY + 4);
          ctx.strokeStyle = 'rgba(255,255,255,0.16)';
          ctx.stroke();
          if (m % 2 === 0) ctx.fillText(m + 'm', tx, baseLineY + 14);
        }

        var e = M.easeInOutCubic(progress);
        var curTrue = phase === 1 ? M.lerp(u.prevTrueX, u.trueX, e) : u.trueX;
        var curOdo = phase === 1 ? M.lerp(u.prevOdoX, u.odoX, e) : u.odoX;

        // Animated active parameters per phase
        var priorMu = u.mu;
        var priorSig2 = u.sigma2;
        if (phase === 1) {
          priorMu = M.lerp(u.prevMu, u.muBar, e);
          priorSig2 = M.lerp(u.prevSigma2, u.sigma2Bar, e);
        } else if (phase >= 2) {
          priorMu = u.muBar;
          priorSig2 = u.sigma2Bar;
        }

        var postMu = u.postMu;
        var postSig2 = u.postSigma2;
        var postBlend = 0;
        if (phase === 0) {
          postMu = u.mu;
          postSig2 = u.sigma2;
          postBlend = 1;
        } else if (phase === 3) {
          postMu = M.lerp(u.muBar, u.postMu, e);
          postSig2 = M.lerp(u.sigma2Bar, u.postSigma2, e);
          postBlend = e;
        }

        // Peak normalization across visible curves
        var maxPeak = Math.max(
          M.gaussian(0, 0, Math.sqrt(priorSig2)),
          phase >= 2 ? M.gaussian(0, 0, Math.sqrt(u.R)) : 0.1,
          phase === 3 ? M.gaussian(0, 0, Math.sqrt(u.postSigma2)) : 0.1,
          0.35
        );
        var densityScale = curveMaxH / maxPeak;

        function drawGaussianCurve(muVal, sig2Val, ampFactor, strokeCol, fillCol, lineW, dashed) {
          var sig = Math.sqrt(Math.max(sig2Val, 0.01));
          ctx.save();
          if (dashed) ctx.setLineDash([4, 4]);
          ctx.beginPath();
          var steps = 160;
          for (var i = 0; i <= steps; i++) {
            var xm = worldMin + (i / steps) * (worldMax - worldMin);
            var px = toX(xm);
            var py = baseLineY - M.gaussian(xm, muVal, sig) * densityScale * ampFactor;
            if (i === 0) ctx.moveTo(px, baseLineY);
            ctx.lineTo(px, py);
          }
          ctx.lineTo(toX(worldMax), baseLineY);
          ctx.closePath();
          if (fillCol) {
            ctx.fillStyle = fillCol;
            ctx.fill();
          }
          ctx.beginPath();
          for (var j = 0; j <= steps; j++) {
            var x2 = worldMin + (j / steps) * (worldMax - worldMin);
            var px2 = toX(x2);
            var py2 = baseLineY - M.gaussian(x2, muVal, sig) * densityScale * ampFactor;
            if (j === 0) ctx.moveTo(px2, py2);
            else ctx.lineTo(px2, py2);
          }
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = lineW;
          ctx.stroke();
          ctx.restore();
        }

        // Phase 0: single settled gold belief
        if (phase === 0) {
          drawGaussianCurve(u.mu, u.sigma2, 1.0, '#ffd000', 'rgba(255, 208, 0, 0.16)', 2.4, false);
        } else {
          // Draw ghost of previous belief during predict
          if (phase === 1) {
            drawGaussianCurve(u.prevMu, u.prevSigma2, 1.0, 'rgba(255, 208, 0, 0.25)', null, 1.2, true);
          }
          // Prior / Predicted curve (Slate)
          var priorAlpha = phase === 3 ? 0.9 - 0.35 * e : 1.0;
          drawGaussianCurve(
            priorMu,
            priorSig2,
            1.0,
            'rgba(148, 163, 184, ' + priorAlpha.toFixed(2) + ')',
            'rgba(148, 163, 184, ' + (0.12 * priorAlpha).toFixed(2) + ')',
            2.0,
            false
          );
        }

        // Sensor likelihood curve (Phase 2 & 3)
        if (phase >= 2) {
          var sensAmp = phase === 2 ? M.easeOutCubic(progress) : 1.0;
          var sensFade = phase === 3 ? 1.0 - 0.35 * e : 1.0;
          drawGaussianCurve(
            u.z,
            u.R,
            sensAmp,
            'rgba(224, 122, 95, ' + sensFade.toFixed(2) + ')',
            'rgba(224, 122, 95, ' + (0.14 * sensFade).toFixed(2) + ')',
            2.0,
            false
          );

          // Innovation brace y = z - mu_bar
          var pxBar = toX(u.muBar);
          var pxZ = toX(u.z);
          var braceY = trackY + 26;
          var braceOp = phase === 2 ? M.easeOutCubic(progress) : 1 - 0.55 * e;
          ctx.save();
          ctx.strokeStyle = 'rgba(244, 244, 246, ' + (0.55 * braceOp).toFixed(2) + ')';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(pxBar, braceY);
          ctx.lineTo(pxZ, braceY);
          ctx.moveTo(pxBar, braceY - 4);
          ctx.lineTo(pxBar, braceY + 4);
          ctx.moveTo(pxZ, braceY - 4);
          ctx.lineTo(pxZ, braceY + 4);
          ctx.stroke();
          if (Math.abs(pxZ - pxBar) > 18) {
            D.labelPill(
              ctx,
              'y=' + (u.z - u.muBar >= 0 ? '+' : '') + (u.z - u.muBar).toFixed(2),
              (pxBar + pxZ) / 2,
              braceY - 11,
              'center',
              'rgba(244, 244, 246, ' + braceOp.toFixed(2) + ')'
            );
          }
          ctx.restore();
        }

        // Emerging posterior (Phase 3)
        if (phase === 3) {
          drawGaussianCurve(
            postMu,
            postSig2,
            0.35 + 0.65 * e,
            '#ffd000',
            'rgba(255, 208, 0, ' + (0.22 * e).toFixed(2) + ')',
            2.6,
            false
          );
        }

        // Spatial Track Elements (Top corridor)
        var xTruePx = toX(curTrue);
        var xOdoPx = toX(curOdo);
        var estMu = phase === 0 ? u.mu : phase === 3 ? postMu : priorMu;
        var estSig = Math.sqrt(phase === 0 ? u.sigma2 : phase === 3 ? postSig2 : priorSig2);
        var xEstPx = toX(estMu);
        var span2SigPx = (2 * estSig / (worldMax - worldMin)) * plotW;

        // 2-sigma uncertainty bracket on track
        ctx.save();
        ctx.fillStyle = phase === 1 ? 'rgba(148, 163, 184, 0.16)' : 'rgba(255, 208, 0, 0.14)';
        ctx.fillRect(xEstPx - span2SigPx, trackY - 7, span2SigPx * 2, 14);
        ctx.strokeStyle = phase === 1 ? '#94a3b8' : '#ffd000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(xEstPx, trackY);
        ctx.lineTo(xEstPx, baseLineY);
        ctx.strokeStyle = phase === 1 ? 'rgba(148, 163, 184, 0.35)' : 'rgba(255, 208, 0, 0.45)';
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.restore();

        // Pure open-loop odo marker (shows drift cleanly)
        ctx.save();
        ctx.beginPath();
        ctx.arc(xOdoPx, trackY, 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();

        // Sensor measurement beacon
        if (phase >= 2) {
          var xzPx = toX(u.z);
          ctx.save();
          ctx.strokeStyle = 'rgba(224, 122, 95, 0.45)';
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(xzPx, trackY);
          ctx.lineTo(xzPx, baseLineY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#e07a5f';
          ctx.beginPath();
          ctx.arc(xzPx, trackY, 4.5, 0, Math.PI * 2);
          ctx.fill();
          D.labelPill(ctx, 'z', xzPx, trackY - 14, 'center', '#e07a5f');
          ctx.restore();
        }

        // True robot marker (crisp Duckiebot top silhouette glyph)
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(xTruePx, trackY);
        ctx.lineTo(xTruePx, baseLineY);
        ctx.stroke();
        ctx.restore();
        D.poseArrow(ctx, xTruePx, trackY, 0, 8.5, '#f4f4f6', '#121215');
        D.labelPill(
          ctx,
          lang === 'it' ? 'VERO' : 'TRUE',
          xTruePx,
          trackY - 18,
          'center',
          '#f4f4f6'
        );

        // Estimated mean marker on track
        ctx.save();
        ctx.fillStyle = phase === 1 || phase === 2 ? '#94a3b8' : '#ffd000';
        ctx.beginPath();
        ctx.moveTo(xEstPx, trackY + 12);
        ctx.lineTo(xEstPx - 4.5, trackY + 19);
        ctx.lineTo(xEstPx + 4.5, trackY + 19);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Bottom Kalman Gain Trust Slider (0 = Prior, 1 = Sensor)
        var kVal = phase === 3 ? M.lerp(u.prevDisplayK, u.K, e) : u.cycleInLap > 0 || phase >= 2 ? u.K : u.sigma2 / (u.sigma2 + u.R);
        kVal = M.clamp(kVal, 0.02, 0.98);
        var meterW = Math.min(plotW, 380);
        var meterX = padL + (plotW - meterW) / 2;

        ctx.save();
        D.labelPill(
          ctx,
          lang === 'it' ? '0 · SOLO MODELLO' : '0 · TRUST PRIOR',
          meterX,
          barY - 12,
          'left',
          '#94a3b8'
        );
        D.labelPill(
          ctx,
          'K = ' + kVal.toFixed(2),
          meterX + meterW / 2,
          barY - 12,
          'center',
          '#ffd000'
        );
        D.labelPill(
          ctx,
          lang === 'it' ? '1 · SOLO SENSORE' : '1 · TRUST SENSOR',
          meterX + meterW,
          barY - 12,
          'right',
          '#e07a5f'
        );

        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(meterX, barY, meterW, 4);
        // Subtle gradient glow showing sensor weight from 0..K
        var grad = ctx.createLinearGradient(meterX, 0, meterX + meterW, 0);
        grad.addColorStop(0, 'rgba(148, 163, 184, 0.55)');
        grad.addColorStop(0.5, 'rgba(255, 208, 0, 0.55)');
        grad.addColorStop(1, 'rgba(224, 122, 95, 0.75)');
        ctx.fillStyle = grad;
        ctx.fillRect(meterX, barY, meterW * kVal, 4);

        var nx = meterX + meterW * kVal;
        ctx.fillStyle = '#ffd000';
        ctx.fillRect(nx - 2, barY - 4, 4, 12);
        ctx.restore();
      }
    });

    if (btnNoise) {
      btnNoise.addEventListener('click', function () {
        lab.state.user.highNoise = !lab.state.user.highNoise;
        lab.state.user.R = lab.state.user.highNoise ? R_HIGH : R_LOW;
        lab.state.user.K = lab.state.user.sigma2Bar / (lab.state.user.sigma2Bar + lab.state.user.R);
        syncExtraBtnText(lab.getLang(), lab.state.user);
        lab.refresh();
      });
    }

    if (btnInit) {
      btnInit.addEventListener('click', function () {
        lab.state.user.highInit = !lab.state.user.highInit;
        lab.reset();
        syncExtraBtnText(lab.getLang(), lab.state.user);
        lab.refresh();
      });
    }

    syncExtraBtnText(lab.getLang(), lab.state.user);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKF);
  } else {
    initKF();
  }
})();
