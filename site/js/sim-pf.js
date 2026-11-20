(function () {
  'use strict';

  var LS = window.LocSims;
  if (!LS) return;
  var M = LS.math;
  var D = LS.draw;

  function initPF() {
    var root = document.getElementById('lab-pf');
    if (!root) return;

    var btnKidnap = root.querySelector('[data-sim-pf-kidnap]');
    var btnAlpha = root.querySelector('[data-sim-pf-alpha]');

    var NUM_P = 80;
    var WORLD_W = 10.0;
    var WORLD_H = 6.0;
    var SENS_SIG = 0.65;

    function poseAt(s) {
      var cx = 5.0;
      var cy = 3.0;
      var rx = 3.1;
      var ry = 1.65;
      var x = cx + rx * Math.cos(s);
      var y = cy + ry * Math.sin(s);
      var dx = -rx * Math.sin(s);
      var dy = ry * Math.cos(s);
      var th = Math.atan2(dy, dx);
      return { x: x, y: y, th: th };
    }

    function createUniformParticles() {
      var arr = [];
      for (var i = 0; i < NUM_P; i++) {
        arr.push({
          x: 0.6 + Math.random() * (WORLD_W - 1.2),
          y: 0.6 + Math.random() * (WORLD_H - 1.2),
          prevX: 0,
          prevY: 0,
          targetX: 0,
          targetY: 0,
          w: 1 / NUM_P,
          prevW: 1 / NUM_P,
          targetW: 1 / NUM_P,
          bornAlpha: false,
          dying: false,
          parentX: 0,
          parentY: 0
        });
        arr[i].prevX = arr[i].x;
        arr[i].prevY = arr[i].y;
        arr[i].targetX = arr[i].x;
        arr[i].targetY = arr[i].y;
      }
      return arr;
    }

    function weightedMean(particles) {
      var sx = 0;
      var sy = 0;
      var sw = 0;
      for (var i = 0; i < particles.length; i++) {
        sx += particles[i].x * particles[i].w;
        sy += particles[i].y * particles[i].w;
        sw += particles[i].w;
      }
      if (sw < 1e-8) return { x: WORLD_W / 2, y: WORLD_H / 2 };
      return { x: sx / sw, y: sy / sw };
    }

    function resetUser(u) {
      if (u.alphaOn === undefined) u.alphaOn = true;
      u.s = -Math.PI * 0.75;
      u.prevS = u.s;
      var p0 = poseAt(u.s);
      u.trueX = p0.x;
      u.trueY = p0.y;
      u.trueTh = p0.th;
      u.zX = p0.x;
      u.zY = p0.y;
      u.particles = createUniformParticles();
      u.nextParticles = null;
      u.maxW = 1 / NUM_P;
      u.nEff = NUM_P;
      u.mean = weightedMean(u.particles);
      u.kidnapFlash = 0;
      u.landmarks = [
        { x: 1.1, y: 1.0 },
        { x: 8.9, y: 1.0 },
        { x: 1.1, y: 5.0 },
        { x: 8.9, y: 5.0 }
      ];
    }

    function syncExtraBtns(lang, u) {
      if (btnKidnap) {
        btnKidnap.textContent = lang === 'it' ? 'Kidnap Robot' : 'Kidnap Robot';
      }
      if (btnAlpha) {
        btnAlpha.textContent =
          lang === 'it'
            ? u.alphaOn
              ? 'α-Trick (5%): ON'
              : 'α-Trick (5%): OFF'
            : u.alphaOn
              ? 'α-Trick (5%): ON'
              : 'α-Trick (5%): OFF';
        btnAlpha.classList.toggle('active-toggle', !!u.alphaOn);
      }
    }

    var lab = LS.createLab('lab-pf', {
      phaseDurations: [1.5, 2.6, 2.7, 3.0],
      phaseLabels: {
        en: ['01 Init/Cloud', '02 Predict', '03 Weight', '04 Resample'],
        it: ['01 Nube', '02 Predizione', '03 Pesi', '04 Resample']
      },
      phases: {
        en: [
          {
            title: function (u, st) {
              return st.cycle === 1
                ? 'Cycle 1 — Uniform Monte Carlo Cloud'
                : 'Cycle ' + st.cycle + ' — Clustered Hypothesis Cloud';
            },
            desc:
              '\\(M=80\\) random samples cover possible poses with uniform weights \\(1/M\\). Non-Gaussian, skewed, or multi-modal distributions require zero closed-form equations.',
            eq: '\\operatorname{bel}(x_0) \\approx \\left\\{\\, x^{[i]} \\sim \\mathcal{U}(\\text{arena}),\\; w^{[i]} = \\tfrac{1}{M} \\,\\right\\}',
            eqExplain: [
              { sym: 'x^{[i]}', label: 'Particle Hypothesis', desc: 'A single candidate pose \\((x, y)\\) inside the arena.' },
              { sym: 'w^{[i]}', label: 'Importance Weight', desc: 'How plausible particle \\(i\\) is; initially every particle starts equal at \\(1/M\\).' },
              { sym: 'M', label: 'Particle Count', desc: 'Total number of discrete samples (here \\(M=80\\)).' }
            ]
          },
          {
            title: 'Predict — Independent Noisy Motion',
            desc:
              'Each particle independently draws noisy odometry (\\(u_t + \\varepsilon_i\\)). Because noise isn’t averaged into a matrix, the swarm bends along curved trajectories.',
            eq: 'x_t^{[i]} \\sim p\\!\\left(x_t \\mid u_t,\\, x_{t-1}^{[i]}\\right) \\quad [+\\,Q\\text{ sample noise}]',
            eqExplain: [
              { sym: 'x_t^{[i]}', label: 'Propagated Particle', desc: 'New candidate pose obtained by moving \\(x_{t-1}^{[i]}\\) forward.' },
              { sym: 'u_t', label: 'Motion Command', desc: 'Wheel odometry displacement applied to every particle.' },
              { sym: 'Q', label: 'Stochastic Spread', desc: 'Independent random jitter sampled per particle so the cloud naturally fans out.' }
            ]
          },
          {
            title: 'Weight — Observation Likelihood Spotlight',
            desc:
              'Landmarks yield noisy sensor estimate \\(z_t\\). Each particle’s weight scales by Gaussian likelihood \\(\\mathcal{N}(z_t; x^{[i]}, R)\\) and normalizes (\\(\\sum w = 1\\)).',
            eq: function (u) {
              return (
                '\\begin{aligned}w^{[i]} &\\propto \\exp\\!\\left(-\\frac{\\|z_t - x^{[i]}\\|^2}{2\\sigma^2}\\right)\\\\ N_{\\text{eff}} &= \\frac{1}{\\sum (w^{[i]})^2} = ' +
                u.nEff.toFixed(1) +
                ' / ' +
                NUM_P +
                '\\end{aligned}'
              );
            },
            eqExplain: [
              { sym: 'w^{[i]}', label: 'Likelihood Score', desc: 'Grows exponentially when particle \\(x^{[i]}\\) is close to sensor reading \\(z_t\\).' },
              { sym: '\\sigma^2', label: 'Sensor Tolerance', desc: 'Sensor variance controlling how tightly particles are penalized with distance.' },
              { sym: 'N_{\\text{eff}}', label: 'Effective Sample Size', desc: 'Measures how many particles still carry meaningful weight (triggers resampling when low).' }
            ]
          },
          {
            title: 'Resample — Low-Variance Roulette + \\(\\alpha\\)-Trick',
            desc:
              'Equidistant comb pointers sweep the cumulative weight tape \\([0,1]\\) in \\(\\mathcal{O}(M)\\) time: winners divide (mitosis), losers vanish, and \\(\\alpha=5\\%\\) sparks enable Kidnapped recovery.',
            eq: function (u) {
              return (
                '\\begin{aligned}U_i &= r + \\frac{i - 1}{M}, \\quad r \\sim \\mathcal{U}\\!\\left(0,\\tfrac{1}{M}\\right)\\\\ \\alpha_{\\text{rand}} &= ' +
                (u.alphaOn ? '0.05\\;(\\text{4 fresh sparks})' : '0.00\\;(\\text{disabled})') +
                '\\end{aligned}'
              );
            },
            eqExplain: [
              { sym: 'U_i', label: 'Comb Pointer', desc: 'Equally spaced spokes around the roulette wheel that clone wide gold slices.' },
              { sym: 'r', label: 'Single Random Start', desc: 'One random offset in \\([0, 1/M)\\) keeps sampling variance ultra-low in \\(\\mathcal{O}(M)\\).' },
              { sym: '\\alpha_{\\text{rand}}', label: 'Kidnapped Recovery', desc: 'Fraction of fresh random particles injected so the filter can recover if the robot is moved.' }
            ]
          }
        ],
        it: [
          {
            title: function (u, st) {
              return st.cycle === 1
                ? 'Ciclo 1 — Nube Monte Carlo Uniforme'
                : 'Ciclo ' + st.cycle + ' — Nube di Ipotesi Convergente';
            },
            desc:
              '\\(M=80\\) campioni casuali coprono le pose possibili con peso uniforme \\(1/M\\). Distribuzioni asimmetriche o multimodali senza assunzioni gaussiane.',
            eq: '\\operatorname{bel}(x_0) \\approx \\left\\{\\, x^{[i]} \\sim \\mathcal{U}(\\text{mappa}),\\; w^{[i]} = \\tfrac{1}{M} \\,\\right\\}',
            eqExplain: [
              { sym: 'x^{[i]}', label: 'Particella (Ipotesi)', desc: 'Una singola posa candidata \\((x, y)\\) sparsa nell’arena.' },
              { sym: 'w^{[i]}', label: 'Peso di Importanza', desc: 'Quanto è credibile la particella \\(i\\); all’inizio tutte valgono \\(1/M\\).' },
              { sym: 'M', label: 'Numero Particelle', desc: 'Totale dei campioni discreti simulati (qui \\(M=80\\)).' }
            ]
          },
          {
            title: 'Predizione — Moto Stocastico Indipendente',
            desc:
              'Ogni particella applica il comando \\(u_t\\) aggiungendo rumore indipendente \\(\\varepsilon_i\\). Campionando direttamente, la nube segue curve non lineari.',
            eq: 'x_t^{[i]} \\sim p\\!\\left(x_t \\mid u_t,\\, x_{t-1}^{[i]}\\right) \\quad [+\\,\\text{rumore } Q]',
            eqExplain: [
              { sym: 'x_t^{[i]}', label: 'Particella Propagata', desc: 'Nuova posizione ottenuta spostando \\(x_{t-1}^{[i]}\\) con il moto.' },
              { sym: 'u_t', label: 'Comando Odometrico', desc: 'Spostamento applicato in modo indipendente a ogni particella.' },
              { sym: 'Q', label: 'Dispersione Stocastica', desc: 'Rumore casuale diverso per ogni particella che apre la nuvola lungo la curva.' }
            ]
          },
          {
            title: 'Pesi — Verosimiglianza con i Landmark',
            desc:
              'I landmark producono la misura \\(z_t\\). Il peso di ogni particella cresce con \\(p(z_t \\mid x^{[i]})\\) e viene normalizzato (\\(\\sum w = 1\\), con guardia zero-sum).',
            eq: function (u) {
              return (
                '\\begin{aligned}w^{[i]} &\\propto \\exp\\!\\left(-\\frac{\\|z_t - x^{[i]}\\|^2}{2\\sigma^2}\\right)\\\\ N_{\\text{eff}} &= \\frac{1}{\\sum (w^{[i]})^2} = ' +
                u.nEff.toFixed(1) +
                ' / ' +
                NUM_P +
                '\\end{aligned}'
              );
            },
            eqExplain: [
              { sym: 'w^{[i]}', label: 'Punteggio Verosimiglianza', desc: 'Cresce esponenzialmente quando \\(x^{[i]}\\) è vicina alla misura \\(z_t\\).' },
              { sym: '\\sigma^2', label: 'Tolleranza Sensore', desc: 'Varianza del sensore che regola quanto severamente vengono penalizzate le particelle lontane.' },
              { sym: 'N_{\\text{eff}}', label: 'Campioni Efficaci', desc: 'Indica quante particelle hanno peso utile (se scende troppo, serve il resampling).' }
            ]
          },
          {
            title: 'Resampling — Ruota a Bassa Varianza + \\(\\alpha\\)-Trick',
            desc:
              'Un pettine di \\(M\\) puntatori equidistanti esplora il nastro cumulativo \\([0,1]\\) in \\(\\mathcal{O}(M)\\): i vincenti si duplicano (mitosi), e \\(\\alpha=5\\%\\) salva dal Kidnapping.',
            eq: function (u) {
              return (
                '\\begin{aligned}U_i &= r + \\frac{i - 1}{M}, \\quad r \\sim \\mathcal{U}\\!\\left(0,\\tfrac{1}{M}\\right)\\\\ \\alpha_{\\text{rand}} &= ' +
                (u.alphaOn ? '0.05\\;(\\text{4 scintille})' : '0.00\\;(\\text{spento})') +
                '\\end{aligned}'
              );
            },
            eqExplain: [
              { sym: 'U_i', label: 'Puntatore del Pettine', desc: 'Raggi equidistanti attorno alla roulette: colpiscono più volte le fette dorate più larghe.' },
              { sym: 'r', label: 'Singolo Offset Casuale', desc: 'Un solo numero casuale in \\([0, 1/M)\\) garantisce varianza minima in tempo \\(\\mathcal{O}(M)\\).' },
              { sym: '\\alpha_{\\text{rand}}', label: 'Recupero Kidnapping', desc: 'Quota di particelle casuali fresche iniettate per ritrovare il robot se viene spostato di peso.' }
            ]
          }
        ]
      },
      onReset: function (u) {
        resetUser(u);
      },
      onLangChange: function (lang, u) {
        syncExtraBtns(lang, u);
      },
      onEnterPhase: function (phase, u) {
        if (phase === 0) {
          if (u.nextParticles) {
            u.particles = u.nextParticles;
            u.nextParticles = null;
          }
          u.mean = weightedMean(u.particles);
          u.nEff = NUM_P;
        } else if (phase === 1) {
          u.prevS = u.s;
          var ds = 0.42;
          u.s += ds;
          var prevPose = poseAt(u.prevS);
          var newPose = poseAt(u.s);
          u.trueX = newPose.x;
          u.trueY = newPose.y;
          u.trueTh = newPose.th;
          var dxNominal = newPose.x - prevPose.x;
          var dyNominal = newPose.y - prevPose.y;

          for (var i = 0; i < u.particles.length; i++) {
            var p = u.particles[i];
            p.prevX = p.x;
            p.prevY = p.y;
            p.bornAlpha = false;
            p.dying = false;
            p.targetX = M.clamp(p.x + dxNominal + M.randn() * 0.16, 0.3, WORLD_W - 0.3);
            p.targetY = M.clamp(p.y + dyNominal + M.randn() * 0.16, 0.3, WORLD_H - 0.3);
            p.x = p.targetX;
            p.y = p.targetY;
          }
        } else if (phase === 2) {
          u.zX = M.clamp(u.trueX + M.randn() * 0.22, 0.35, WORLD_W - 0.35);
          u.zY = M.clamp(u.trueY + M.randn() * 0.22, 0.35, WORLD_H - 0.35);

          var sumW = 0;
          for (var i = 0; i < u.particles.length; i++) {
            var p2 = u.particles[i];
            p2.prevW = p2.w;
            var dx = p2.x - u.zX;
            var dy = p2.y - u.zY;
            var raw = Math.exp(-(dx * dx + dy * dy) / (2 * SENS_SIG * SENS_SIG));
            p2.targetW = raw;
            sumW += raw;
          }
          if (sumW < 1e-12) {
            for (var k = 0; k < u.particles.length; k++) {
              u.particles[k].targetW = 1 / NUM_P;
            }
          } else {
            for (var k2 = 0; k2 < u.particles.length; k2++) {
              u.particles[k2].targetW /= sumW;
            }
          }
          var sumSq = 0;
          var mx = 0;
          for (var k3 = 0; k3 < u.particles.length; k3++) {
            var tw = u.particles[k3].targetW;
            p2 = u.particles[k3];
            p2.w = tw;
            sumSq += tw * tw;
            if (tw > mx) mx = tw;
          }
          u.maxW = mx;
          u.nEff = sumSq > 1e-9 ? 1 / sumSq : NUM_P;
          u.mean = weightedMean(u.particles);
        } else if (phase === 3) {
          var nextArr = [];
          var alphaCount = u.alphaOn ? Math.max(2, Math.round(NUM_P * 0.05)) : 0;
          var resampledCount = NUM_P - alphaCount;

          // Build CDF on current particle weights
          var cdf = [];
          var acc = 0;
          for (var i = 0; i < u.particles.length; i++) {
            acc += u.particles[i].w;
            cdf.push(acc);
          }
          cdf[cdf.length - 1] = 1.0;

          var survivedIndices = {};
          var r0 = Math.random() * (1 / resampledCount);
          var c = cdf[0];
          var idx = 0;
          for (var m = 0; m < resampledCount; m++) {
            var U = r0 + m / resampledCount;
            while (U > c && idx < u.particles.length - 1) {
              idx++;
              c = cdf[idx];
            }
            survivedIndices[idx] = true;
            var par = u.particles[idx];
            nextArr.push({
              parentX: par.x,
              parentY: par.y,
              prevX: par.x,
              prevY: par.y,
              targetX: M.clamp(par.x + M.randn() * 0.075, 0.3, WORLD_W - 0.3),
              targetY: M.clamp(par.y + M.randn() * 0.075, 0.3, WORLD_H - 0.3),
              x: par.x,
              y: par.y,
              w: 1 / NUM_P,
              prevW: par.w,
              targetW: 1 / NUM_P,
              bornAlpha: false,
              dying: false
            });
          }

          for (var a = 0; a < alphaCount; a++) {
            var rx = 0.6 + Math.random() * (WORLD_W - 1.2);
            var ry = 0.6 + Math.random() * (WORLD_H - 1.2);
            nextArr.push({
              parentX: rx,
              parentY: ry,
              prevX: rx,
              prevY: ry,
              targetX: rx,
              targetY: ry,
              x: rx,
              y: ry,
              w: 1 / NUM_P,
              prevW: 1 / NUM_P,
              targetW: 1 / NUM_P,
              bornAlpha: true,
              dying: false
            });
          }

          for (var d = 0; d < u.particles.length; d++) {
            u.particles[d].dying = !survivedIndices[d];
          }
          u.nextParticles = nextArr;
        }
      },
      getTelemetry: function (lang, u, st) {
        var err = Math.hypot(u.mean.x - u.trueX, u.mean.y - u.trueY);
        return [
          {
            label: lang === 'it' ? 'Particelle Eff.' : 'Eff. Sample Size',
            value: u.nEff.toFixed(1) + ' / ' + NUM_P,
            gold: st.phase === 2
          },
          {
            label: lang === 'it' ? 'Errore Medio' : 'Mean Error',
            value: err.toFixed(2) + ' m',
            gold: true
          },
          {
            label: lang === 'it' ? 'Strategia' : 'Recovery',
            value: u.alphaOn ? 'α = 5%' : 'Pure O(M)'
          }
        ];
      },
      onRender: function (ctx, w, h, phase, progress, dt, lang, u) {
        D.obsidianBg(ctx, w, h);

        var padX = 18;
        var padTop = 18;
        var isWide = w >= 470;
        var arenaW = isWide ? Math.round((w - padX * 2) * 0.64) : w - padX * 2;
        var arenaH = isWide ? h - padTop - 18 : Math.round((h - padTop - 18) * 0.56);

        function toPx(wx, wy) {
          return {
            x: padX + (wx / WORLD_W) * arenaW,
            y: padTop + (wy / WORLD_H) * arenaH
          };
        }

        // Hairline grid inside arena
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(padX, padTop, arenaW, arenaH);
        D.hairlineGrid(ctx, padX, padTop, arenaW, arenaH, arenaW / 10, 0.035);
        ctx.restore();

        // Subtle reference oval track
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
        ctx.setLineDash([4, 6]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (var i = 0; i <= 80; i++) {
          var th = (i / 80) * Math.PI * 2;
          var pt = poseAt(th);
          var px = toPx(pt.x, pt.y);
          if (i === 0) ctx.moveTo(px.x, px.y);
          else ctx.lineTo(px.x, px.y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // Static landmarks (subtle slate beacons)
        for (var lm = 0; lm < u.landmarks.length; lm++) {
          var lp = toPx(u.landmarks[lm].x, u.landmarks[lm].y);
          ctx.save();
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(lp.x - 4.5, lp.y - 4.5, 9, 9);
          ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
          ctx.fillRect(lp.x - 1.5, lp.y - 1.5, 3, 3);
          ctx.restore();
        }

        var e = M.easeInOutCubic(progress);

        // Animated true robot pose
        var animS = phase === 1 ? M.lerp(u.prevS, u.s, e) : u.s;
        var robPose = poseAt(animS);
        var robPx = toPx(robPose.x, robPose.y);

        // Sensor Spotlight during Phase 2 & fading in Phase 3
        if (phase === 2 || phase === 3) {
          var zp = toPx(u.zX, u.zY);
          var spotR = (SENS_SIG * 1.8 / WORLD_W) * arenaW;
          var spotAlpha = phase === 2 ? M.easeOutCubic(progress) : 1 - e;
          ctx.save();
          var grad = ctx.createRadialGradient(zp.x, zp.y, 2, zp.x, zp.y, spotR);
          grad.addColorStop(0, 'rgba(224, 122, 95, ' + (0.28 * spotAlpha).toFixed(2) + ')');
          grad.addColorStop(0.6, 'rgba(224, 122, 95, ' + (0.09 * spotAlpha).toFixed(2) + ')');
          grad.addColorStop(1, 'rgba(224, 122, 95, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(zp.x, zp.y, spotR, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = 'rgba(224, 122, 95, ' + (0.65 * spotAlpha).toFixed(2) + ')';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(zp.x, zp.y, (SENS_SIG / WORLD_W) * arenaW, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = 'rgba(224, 122, 95, ' + spotAlpha.toFixed(2) + ')';
          ctx.beginPath();
          ctx.arc(zp.x, zp.y, 4, 0, Math.PI * 2);
          ctx.fill();
          D.labelPill(ctx, 'z_t', zp.x + 8, zp.y - 8, 'left', 'rgba(224, 122, 95, ' + spotAlpha.toFixed(2) + ')');
          ctx.restore();
        }

        // Particles rendering per phase
        if (phase === 3 && u.nextParticles) {
          // Fading losers
          for (var j = 0; j < u.particles.length; j++) {
            var oldP = u.particles[j];
            if (!oldP.dying) continue;
            var op = toPx(oldP.x, oldP.y);
            var fade = 1 - e;
            ctx.fillStyle = 'rgba(148, 163, 184, ' + (0.28 * fade).toFixed(2) + ')';
            ctx.beginPath();
            ctx.arc(op.x, op.y, 2.2 * fade, 0, Math.PI * 2);
            ctx.fill();
          }

          // Smooth mitosis clones + alpha sparks
          for (var k = 0; k < u.nextParticles.length; k++) {
            var np = u.nextParticles[k];
            var curX = M.lerp(np.parentX, np.targetX, e);
            var curY = M.lerp(np.parentY, np.targetY, e);
            var pPx = toPx(curX, curY);
            if (np.bornAlpha) {
              ctx.save();
              ctx.strokeStyle = 'rgba(255, 208, 0, ' + (0.9 * e).toFixed(2) + ')';
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              ctx.arc(pPx.x, pPx.y, 4.5, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            } else {
              var rLerp = M.lerp(4.4, 3.0, e);
              ctx.fillStyle = 'rgba(255, 208, 0, 0.78)';
              ctx.beginPath();
              ctx.arc(pPx.x, pPx.y, rLerp, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        } else {
          var maxW = Math.max(u.maxW, 1 / NUM_P);
          for (var i2 = 0; i2 < u.particles.length; i2++) {
            var p = u.particles[i2];
            var wx = phase === 1 ? M.lerp(p.prevX, p.targetX, e) : p.x;
            var wy = phase === 1 ? M.lerp(p.prevY, p.targetY, e) : p.y;
            var wCur = phase === 2 ? M.lerp(p.prevW, p.targetW, e) : p.w;
            var normW = wCur / maxW;

            var pos = toPx(wx, wy);

            if (phase === 1) {
              var prevPos = toPx(p.prevX, p.prevY);
              ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(prevPos.x, prevPos.y);
              ctx.lineTo(pos.x, pos.y);
              ctx.stroke();
            }

            var rad = phase === 2 ? M.lerp(2.2, 6.2, normW) : 2.8;
            var alpha = phase === 2 ? M.lerp(0.18, 0.95, normW) : 0.72;
            ctx.fillStyle =
              phase === 1
                ? 'rgba(148, 163, 184, 0.75)'
                : phase === 2 && normW < 0.25
                  ? 'rgba(148, 163, 184, ' + alpha.toFixed(2) + ')'
                  : 'rgba(255, 208, 0, ' + alpha.toFixed(2) + ')';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, rad, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Weighted mean crosshair
        var meanPx = toPx(u.mean.x, u.mean.y);
        ctx.save();
        ctx.strokeStyle = '#ffd000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(meanPx.x - 7, meanPx.y);
        ctx.lineTo(meanPx.x + 7, meanPx.y);
        ctx.moveTo(meanPx.x, meanPx.y - 7);
        ctx.lineTo(meanPx.x, meanPx.y + 7);
        ctx.stroke();
        ctx.restore();

        // Kidnap flash ring
        if (u.kidnapFlash > 0) {
          u.kidnapFlash = Math.max(0, u.kidnapFlash - dt * 1.6);
          ctx.save();
          ctx.strokeStyle = 'rgba(224, 122, 95, ' + u.kidnapFlash.toFixed(2) + ')';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(robPx.x, robPx.y, 12 + (1 - u.kidnapFlash) * 26, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // True robot pose marker
        D.poseArrow(ctx, robPx.x, robPx.y, robPose.th, 8.5, '#f4f4f6', '#121215');

        // Right / Bottom Panel: Circular Roulette Wheel & Low-Variance Resampling Comb
        var panelX = isWide ? padX + arenaW + 14 : padX;
        var panelY = isWide ? padTop : padTop + arenaH + 12;
        var panelW = isWide ? w - padX - panelX : arenaW;
        var panelH = isWide ? arenaH : h - panelY - 12;

        ctx.save();
        ctx.fillStyle = '#101014';
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        D.labelPill(
          ctx,
          lang === 'it' ? 'RUOTA ROULETTE O(M)' : 'ROULETTE WHEEL O(M)',
          panelX + panelW / 2,
          panelY + 14,
          'center',
          phase === 3 ? '#ffd000' : '#a1a1aa'
        );

        var cx = panelX + panelW / 2;
        var cy = panelY + panelH * 0.53;
        var rOut = Math.max(32, Math.min(panelW * 0.39, (panelH - 46) * 0.42));
        var rIn = rOut * 0.42;

        // Spin the wheel smoothly during Phase 3 (Resample)
        var spinAngle = phase === 3 ? M.easeOutCubic(progress) * Math.PI * 2.25 : 0;
        var curAng = -Math.PI / 2 + spinAngle;

        for (var b = 0; b < u.particles.length; b++) {
          var wb = Math.max(0, u.particles[b].w);
          var sweepAng = wb * Math.PI * 2;
          if (sweepAng <= 0.002) {
            curAng += sweepAng;
            continue;
          }
          var normWb = u.maxW > 0 ? M.clamp(wb / u.maxW, 0, 1) : 0;
          ctx.beginPath();
          ctx.arc(cx, cy, rOut, curAng, curAng + sweepAng);
          ctx.arc(cx, cy, rIn, curAng + sweepAng, curAng, true);
          ctx.closePath();

          if (normWb > 0.35) {
            ctx.fillStyle = b % 2 === 0 ? 'rgba(255, 208, 0, 0.85)' : 'rgba(255, 208, 0, 0.58)';
          } else if (normWb > 0.12) {
            ctx.fillStyle = b % 2 === 0 ? 'rgba(224, 122, 95, 0.72)' : 'rgba(224, 122, 95, 0.48)';
          } else {
            ctx.fillStyle = b % 2 === 0 ? 'rgba(148, 163, 184, 0.28)' : 'rgba(148, 163, 184, 0.15)';
          }
          ctx.fill();
          ctx.strokeStyle = '#0a0a0c';
          ctx.lineWidth = sweepAng > 0.08 ? 1.1 : 0.4;
          ctx.stroke();

          curAng += sweepAng;
        }

        // Inner hub
        ctx.beginPath();
        ctx.arc(cx, cy, rIn - 2, 0, Math.PI * 2);
        ctx.fillStyle = '#0d0d10';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 1;
        ctx.stroke();

        D.labelPill(
          ctx,
          phase === 3 ? 'r + i/M' : 'Neff ' + Math.round(u.nEff),
          cx,
          cy,
          'center',
          phase === 3 ? '#ffd000' : '#a1a1aa'
        );

        // Evenly-spaced Low-Variance Comb pointers around the rim
        var needles = 16;
        var combActive = phase === 3;
        var combOpacity = combActive ? 0.35 + 0.65 * Math.min(1, progress * 1.4) : 0.22;
        var combRot = -Math.PI / 2 + (combActive ? 0.18 : 0);
        for (var n = 0; n < needles; n++) {
          var a = combRot + (n / needles) * Math.PI * 2;
          var x1 = cx + Math.cos(a) * (rOut + 9);
          var y1 = cy + Math.sin(a) * (rOut + 9);
          var x2 = cx + Math.cos(a) * (rOut - 4);
          var y2 = cy + Math.sin(a) * (rOut - 4);
          ctx.strokeStyle = combActive
            ? 'rgba(244, 244, 246, ' + combOpacity.toFixed(2) + ')'
            : 'rgba(148, 163, 184, 0.25)';
          ctx.lineWidth = combActive ? 1.5 : 1;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          if (combActive) {
            ctx.fillStyle = '#ffd000';
            ctx.beginPath();
            ctx.arc(x1, y1, 2.0, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        D.labelPill(
          ctx,
          phase === 3
            ? lang === 'it' ? 'Rotazione + Pettine' : 'Spinning + Comb'
            : lang === 'it' ? 'Fette ∝ w_i' : 'Slices ∝ w_i',
          cx,
          panelY + panelH - 12,
          'center',
          '#71717a'
        );
        ctx.restore();
      }
    });

    if (btnKidnap) {
      btnKidnap.addEventListener('click', function () {
        var u = lab.state.user;
        u.s += Math.PI * 0.85;
        u.prevS = u.s;
        var p = poseAt(u.s);
        u.trueX = p.x;
        u.trueY = p.y;
        u.trueTh = p.th;
        u.zX = p.x;
        u.zY = p.y;
        u.kidnapFlash = 1.0;
        lab.refresh();
      });
    }

    if (btnAlpha) {
      btnAlpha.addEventListener('click', function () {
        lab.state.user.alphaOn = !lab.state.user.alphaOn;
        syncExtraBtns(lab.getLang(), lab.state.user);
        lab.refresh();
      });
    }

    syncExtraBtns(lab.getLang(), lab.state.user);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPF);
  } else {
    initPF();
  }
})();
