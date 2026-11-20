(function () {
  'use strict';

  var LS = window.LocSims;
  if (!LS) return;
  var M = LS.math;
  var D = LS.draw;

  function initHF() {
    var root = document.getElementById('lab-hf');
    if (!root) return;

    var btnBlind = root.querySelector('[data-sim-hf-blind]');

    var N = 28;
    var D_MAX = 0.20; // meters
    var PHI_MAX = 0.48; // rad (~27.5 deg)
    var LANE_HALF_W = 0.12; // 0.24 m Duckietown lane half-width

    function binToD(r) {
      return D_MAX - ((r + 0.5) / N) * (2 * D_MAX);
    }

    function binToPhi(c) {
      return -PHI_MAX + ((c + 0.5) / N) * (2 * PHI_MAX);
    }

    function makeGrid(val) {
      var g = new Float32Array(N * N);
      if (val) g.fill(val);
      return g;
    }

    function normalizeGrid(g) {
      var s = 0;
      for (var i = 0; i < g.length; i++) s += g[i];
      if (s < 1e-12) {
        g.fill(1 / (N * N));
        return;
      }
      for (var j = 0; j < g.length; j++) g[j] /= s;
    }

    function maxCell(g) {
      var best = -1;
      var bestIdx = 0;
      for (var i = 0; i < g.length; i++) {
        if (g[i] > best) {
          best = g[i];
          bestIdx = i;
        }
      }
      var r = Math.floor(bestIdx / N);
      var c = bestIdx % N;
      return {
        val: best,
        r: r,
        c: c,
        d: binToD(r),
        phi: binToPhi(c)
      };
    }

    // Motion step + 3x3 Gaussian convolution blur on (d, phi) histogram
    function predictGrid(src, vStep, dOmega) {
      var tmp = makeGrid(0);
      var ddCell = (2 * D_MAX) / N;
      var dPhiCell = (2 * PHI_MAX) / N;

      for (var r = 0; r < N; r++) {
        var dVal = binToD(r);
        for (var c = 0; c < N; c++) {
          var p = src[r * N + c];
          if (p < 1e-7) continue;
          var phiVal = binToPhi(c);
          var nextD = dVal + vStep * Math.sin(phiVal);
          var nextPhi = phiVal + dOmega;

          var tr = (D_MAX - nextD) / ddCell - 0.5;
          var tc = (nextPhi + PHI_MAX) / dPhiCell - 0.5;

          var r0 = Math.floor(tr);
          var c0 = Math.floor(tc);
          var fr = tr - r0;
          var fc = tc - c0;

          var weights = [
            [r0, c0, (1 - fr) * (1 - fc)],
            [r0, c0 + 1, (1 - fr) * fc],
            [r0 + 1, c0, fr * (1 - fc)],
            [r0 + 1, c0 + 1, fr * fc]
          ];

          for (var k = 0; k < 4; k++) {
            var rr = M.clamp(weights[k][0], 0, N - 1);
            var cc = M.clamp(weights[k][1], 0, N - 1);
            tmp[rr * N + cc] += p * weights[k][2];
          }
        }
      }

      var out = makeGrid(0);
      var kern = [
        [0.06, 0.11, 0.06],
        [0.11, 0.32, 0.11],
        [0.06, 0.11, 0.06]
      ];
      for (var r2 = 0; r2 < N; r2++) {
        for (var c2 = 0; c2 < N; c2++) {
          var acc = 0;
          for (var dr = -1; dr <= 1; dr++) {
            for (var dc = -1; dc <= 1; dc++) {
              var nr = M.clamp(r2 + dr, 0, N - 1);
              var nc = M.clamp(c2 + dc, 0, N - 1);
              acc += tmp[nr * N + nc] * kern[dr + 1][dc + 1];
            }
          }
          out[r2 * N + c2] = acc;
        }
      }
      normalizeGrid(out);
      return out;
    }

    // True 3D ground-to-camera pinhole projection
    // World frame: +X = lane right, +Y = forward along lane, Z = 0 ground.
    // Robot at (-d, 0) with heading phi (positive = turned left).
    function projectGroundToCam(wx, wy, d, phi, camX, camY, camW, camH) {
      var dX = wx + d;
      var dY = wy;
      var xFwd = -dX * Math.sin(phi) + dY * Math.cos(phi);
      var yRight = dX * Math.cos(phi) + dY * Math.sin(phi);
      if (xFwd < 0.15) return null;

      var alpha = 0.26; // ~15 deg downward camera pitch
      var hc = 0.115;   // 11.5 cm camera height
      var zCam = xFwd * Math.cos(alpha) + hc * Math.sin(alpha);
      var yDown = -xFwd * Math.sin(alpha) + hc * Math.cos(alpha);
      var fx = 1.62;    // ~63 deg horizontal FOV

      var u = camX + camW * 0.5 + fx * (yRight / zCam) * (camW * 0.5);
      var v = camY + camH * 0.45 + fx * (yDown / zCam) * (camW * 0.5);
      return { u: u, v: v, xFwd: xFwd };
    }

    // Generate individual Hough segment votes from visible yellow & white lane segments
    function buildSegmentVotes(trueD, truePhi, scrollDist, blindMode) {
      var gYellow = makeGrid(0);
      var gWhite = makeGrid(0);
      var gLik = makeGrid(0);
      var yellowSegs = [];
      var whiteSegs = [];

      if (blindMode) {
        gYellow.fill(1 / (N * N));
        gWhite.fill(1 / (N * N));
        gLik.fill(1 / (N * N));
        return {
          yellow: gYellow,
          white: gWhite,
          lik: gLik,
          yellowSegs: yellowSegs,
          whiteSegs: whiteSegs
        };
      }

      // Extract visible yellow dashes along wx = -LANE_HALF_W
      var dashPeriod = 0.24;
      var dashLen = 0.13;
      var offset = scrollDist % dashPeriod;
      for (var wy = 0.22 - offset; wy < 1.12; wy += dashPeriod) {
        if (wy + dashLen < 0.20) continue;
        var y0 = Math.max(0.18, wy);
        var y1 = Math.min(1.12, wy + dashLen);
        if (y1 - y0 < 0.04) continue;
        // Simulated noisy measurement of (d, phi) inferred from this single yellow segment
        var measD = trueD + M.randn() * 0.011 + 0.006;
        var measPhi = truePhi + M.randn() * 0.028 - 0.025;
        yellowSegs.push({ wx: -LANE_HALF_W, y0: y0, y1: y1, dEst: measD, phiEst: measPhi });
      }

      // Extract visible white outer border segments along wx = +LANE_HALF_W
      for (var wy2 = 0.22; wy2 < 1.06; wy2 += 0.26) {
        var wMeasD = trueD + M.randn() * 0.013 - 0.006;
        var wMeasPhi = truePhi + M.randn() * 0.026 + 0.025;
        whiteSegs.push({ wx: LANE_HALF_W, y0: wy2, y1: wy2 + 0.18, dEst: wMeasD, phiEst: wMeasPhi });
      }

      // Accumulate Generate_Vote for each yellow segment
      for (var r = 0; r < N; r++) {
        var dv = binToD(r);
        for (var c = 0; c < N; c++) {
          var pv = binToPhi(c);
          var accY = 0.015;
          for (var i = 0; i < yellowSegs.length; i++) {
            var ys = yellowSegs[i];
            var dy = (dv - ys.dEst) / 0.036;
            var py = (pv - ys.phiEst) / 0.135;
            accY += Math.exp(-0.5 * (dy * dy + py * py));
          }
          // Subtle stray floor glare vote so noise looks authentic
          var glare = 0.14 * Math.exp(-0.5 * (Math.pow((dv + 0.11) / 0.045, 2) + Math.pow((pv - 0.16) / 0.14, 2)));
          gYellow[r * N + c] = accY + glare;

          var accW = 0.015;
          for (var j = 0; j < whiteSegs.length; j++) {
            var ws = whiteSegs[j];
            var dw = (dv - ws.dEst) / 0.038;
            var pw = (pv - ws.phiEst) / 0.130;
            accW += Math.exp(-0.5 * (dw * dw + pw * pw));
          }
          gWhite[r * N + c] = accW;

          // Intersect both clues: cells supported by BOTH yellow and white segments dominate
          gLik[r * N + c] = 0.008 + gYellow[r * N + c] * gWhite[r * N + c];
        }
      }

      normalizeGrid(gYellow);
      normalizeGrid(gWhite);
      normalizeGrid(gLik);

      return {
        yellow: gYellow,
        white: gWhite,
        lik: gLik,
        yellowSegs: yellowSegs,
        whiteSegs: whiteSegs
      };
    }

    function resetUser(u) {
      if (u.blindMode === undefined) u.blindMode = false;
      u.stepIdx = 0;
      u.scrollDist = 0;
      // Realistic gentle initial placement on the lane
      u.trueD = 0.055;
      u.prevTrueD = 0.055;
      u.truePhi = -0.11; // ~ -6.3 deg
      u.prevTruePhi = -0.11;
      u.vStep = 0.14;
      u.dOmega = 0.0;

      u.gridPrior = makeGrid(1 / (N * N));
      u.gridPred = new Float32Array(u.gridPrior);
      u.yellowVotes = makeGrid(1 / (N * N));
      u.whiteVotes = makeGrid(1 / (N * N));
      u.gridLik = makeGrid(1 / (N * N));
      u.gridPost = new Float32Array(u.gridPrior);
      u.yellowSegs = [];
      u.whiteSegs = [];
      u.est = maxCell(u.gridPrior);
    }

    function syncExtraBtn(lang, u) {
      if (!btnBlind) return;
      btnBlind.textContent =
        lang === 'it'
          ? u.blindMode
            ? 'Incrocio Cieco: ATTIVO'
            : 'Incrocio Cieco: OFF'
          : u.blindMode
            ? 'Blind Intersection: ON'
            : 'Blind Intersection: OFF';
      btnBlind.classList.toggle('active-toggle', !!u.blindMode);
    }

    // Minimalist top-down Duckiebot chassis drawing
    function drawDuckiebot(ctx, x, y, canvasHeading, scale) {
      var s = scale || 1;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(canvasHeading);

      // Left & Right wheels
      ctx.fillStyle = '#09090b';
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1;
      ctx.fillRect(-7 * s, -9.5 * s, 11 * s, 3.2 * s);
      ctx.strokeRect(-7 * s, -9.5 * s, 11 * s, 3.2 * s);
      ctx.fillRect(-7 * s, 6.3 * s, 11 * s, 3.2 * s);
      ctx.strokeRect(-7 * s, 6.3 * s, 11 * s, 3.2 * s);

      // Chassis body
      ctx.fillStyle = '#17171b';
      ctx.strokeStyle = '#f4f4f6';
      ctx.lineWidth = 1.4;
      ctx.fillRect(-8 * s, -6.5 * s, 17 * s, 13 * s);
      ctx.strokeRect(-8 * s, -6.5 * s, 17 * s, 13 * s);

      // Yellow top deck accent + front camera lens
      ctx.fillStyle = '#ffd000';
      ctx.fillRect(-2 * s, -3.5 * s, 6 * s, 7 * s);
      ctx.fillStyle = '#e07a5f';
      ctx.fillRect(6.5 * s, -2.5 * s, 2.5 * s, 5 * s);

      ctx.restore();
    }

    var lab = LS.createLab('lab-hf', {
      phaseDurations: [1.8, 2.6, 3.3, 2.8],
      phaseLabels: {
        en: ['01 Drop & Grid', '02 Shift+Blur', '03 Clue Votes', '04 Hadamard'],
        it: ['01 Posa & Griglia', '02 Shift+Blur', '03 Voti Indizi', '04 Hadamard']
      },
      phases: {
        en: [
          {
            title: function (u, st) {
              return st.cycle === 1
                ? 'Cycle 1 — Duckiebot Placed on Floor: Uniform \\((d, \\varphi)\\) Grid'
                : 'Cycle ' + st.cycle + ' — Discrete Lane Belief \\(\\operatorname{bel}(d, \\varphi)\\)';
            },
            desc: function (u, st) {
              return st.cycle === 1
                ? 'We place the Duckiebot onto the lane with zero prior knowledge: every cell in the \\(28\\times 28\\) grid holds equal probability \\(1/N^2\\).'
                : 'Previous posterior becomes the new discrete prior \\(\\operatorname{bel}(d, \\varphi)\\) over lateral offset \\(d\\) and heading \\(\\varphi\\).';
            },
            eq: '\\operatorname{bel}(d, \\varphi) \\in \\mathbb{R}^{N\\times N}, \\qquad \\sum_i \\sum_j p_{i,j} = 1',
            eqExplain: [
              { sym: '\\operatorname{bel}(d, \\varphi)', label: '2D Histogram Grid', desc: 'Discrete \\(28\\times 28\\) matrix storing probability across every \\((d, \\varphi)\\) bin.' },
              { sym: 'd', label: 'Lateral Offset', desc: 'Distance from the center of the right-hand lane (\\(+d\\) left, \\(-d\\) right).' },
              { sym: '\\varphi', label: 'Lane Heading Error', desc: 'Angle of the Duckiebot relative to the lane direction.' },
              { sym: '\\sum_{i,j} p_{i,j} = 1', label: 'Probability Conservation', desc: 'All cell weights always sum to 100%.' }
            ]
          },
          {
            title: 'Predict — Kinematic Shift + 2D Convolution Blur',
            desc:
              'Wheel odometry shifts probability mass via \\(\\Delta d \\approx v\\sin(\\varphi)\\Delta t\\) and \\(\\Delta\\varphi \\approx \\omega\\Delta t\\), then convolves with a Gaussian kernel that widens the peak.',
            eq: function (u) {
              return (
                '\\begin{aligned}d\' &= d + v\\sin(\\varphi)\\Delta t, \\quad \\varphi\' = \\varphi + (' +
                (u.dOmega >= 0 ? '+' : '') +
                u.dOmega.toFixed(2) +
                ')\\\\ \\overline{\\operatorname{bel}} &= \\operatorname{shift}(\\operatorname{bel}) * G_Q\\end{aligned}'
              );
            },
            eqExplain: [
              { sym: 'd\'', label: 'Predicted Offset', desc: 'Driving forward at angle \\(\\varphi\\) shifts lateral position by \\(v\\sin(\\varphi)\\Delta t\\).' },
              { sym: '\\varphi\'', label: 'Predicted Heading', desc: 'Steered angle shifted by angular command \\(\\omega\\Delta t\\).' },
              { sym: '* G_Q', label: '2D Gaussian Blur', desc: '3×3 kernel convolution spreads probability into neighboring cells to model wheel slip.' }
            ]
          },
          {
            title: 'Observe — Pinhole Camera Segments & Intersecting Votes',
            desc:
              'Each extracted yellow dash (\\(+w/2\\)) and white border segment (\\(-w/2\\)) casts discrete votes onto \\((d, \\varphi)\\). Intersecting both clues suppresses glare outliers and isolates \\(L(d, \\varphi)\\).',
            eq: function (u) {
              return u.blindMode
                ? 'L(d, \\varphi) = \\mathcal{U}\\quad (\\text{No lane markings visible})'
                : '\\begin{aligned}L_{\\text{lane}} &= V_{\\text{yellow}}(+w/2) \\cap V_{\\text{white}}(-w/2)\\\\ \\varphi_i &= \\frac{\\pi}{2} - \\operatorname{atan2}(|\\Delta x|, \\Delta y)\\end{aligned}';
            },
            eqExplain: [
              { sym: 'V_{\\text{yellow}}(+w/2)', label: 'Yellow Divider Votes', desc: 'Yellow center dashes project to ground and shift by \\(+w/2\\) toward lane center.' },
              { sym: 'V_{\\text{white}}(-w/2)', label: 'White Border Votes', desc: 'White outer edge segments project and shift by \\(-w/2\\); intersecting both removes glare.' },
              { sym: '\\varphi_i', label: 'Segment Orientation', desc: 'Heading angle inferred from each ground-projected segment vector \\((\\Delta x, \\Delta y)\\).' }
            ]
          },
          {
            title: 'Update — Element-Wise Hadamard Product & Argmax',
            desc:
              'Multiplying \\(\\overline{\\operatorname{bel}} \\odot L\\) cell-by-cell fuses motion prior with camera clues, collapsing mass onto the true \\((d^*, \\varphi^*)\\) without matrix inversions.',
            eq: function (u) {
              var e = maxCell(u.gridPost);
              return (
                '\\begin{aligned}\\operatorname{bel}_{i,j} &= \\eta \\cdot \\overline{\\operatorname{bel}}_{i,j} \\odot L_{i,j}\\\\ \\arg\\max &\\rightarrow (d^*=' +
                e.d.toFixed(2) +
                '\\text{ m},\\; \\varphi^*=' +
                Math.round((e.phi * 180) / Math.PI) +
                '^\\circ)\\end{aligned}'
              );
            },
            eqExplain: [
              { sym: '\\odot', label: 'Hadamard Product', desc: 'Cell-by-cell multiplication of prior \\(\\overline{\\operatorname{bel}}_{i,j}\\) and likelihood \\(L_{i,j}\\), with zero matrix inversions.' },
              { sym: '\\eta', label: 'Normalizer', desc: 'Divides by total grid sum so posterior probabilities add up to \\(1\\).' },
              { sym: '(d^*, \\varphi^*)', label: 'Argmax Pose Estimate', desc: 'Coordinates of the single brightest cell sent downstream to the lane controller.' }
            ]
          }
        ],
        it: [
          {
            title: function (u, st) {
              return st.cycle === 1
                ? 'Ciclo 1 — Posa del Duckiebot: Griglia Uniforme \\((d, \\varphi)\\)'
                : 'Ciclo ' + st.cycle + ' — Credenza Discreta \\(\\operatorname{bel}(d, \\varphi)\\)';
            },
            desc: function (u, st) {
              return st.cycle === 1
                ? 'Appoggiamo il Duckiebot sulla corsia senza sapere dove sia: tutte le celle della griglia \\(28\\times 28\\) partono con probabilità uniforme \\(1/N^2\\).'
                : 'Il posteriore precedente diventa il nuovo prior discreto \\(\\operatorname{bel}(d, \\varphi)\\) su scostamento laterale \\(d\\) e angolo \\(\\varphi\\).';
            },
            eq: '\\operatorname{bel}(d, \\varphi) \\in \\mathbb{R}^{N\\times N}, \\qquad \\sum_i \\sum_j p_{i,j} = 1',
            eqExplain: [
              { sym: '\\operatorname{bel}(d, \\varphi)', label: 'Griglia Istogramma 2D', desc: 'Matrice discreta \\(28\\times 28\\) che assegna una probabilità a ogni cella \\((d, \\varphi)\\).' },
              { sym: 'd', label: 'Scostamento Laterale', desc: 'Distanza dal centro della corsia destra (\\(+d\\) a sinistra, \\(-d\\) a destra).' },
              { sym: '\\varphi', label: 'Angolo in Corsia', desc: 'Inclinazione del Duckiebot rispetto alla direzione della corsia.' },
              { sym: '\\sum_{i,j} p_{i,j} = 1', label: 'Conservazione Massa', desc: 'La somma di tutte le celle della griglia vale sempre 100%.' }
            ]
          },
          {
            title: 'Predizione — Shift Cinematico + Sfocatura 2D',
            desc:
              'L’odometria trasla la massa con \\(\\Delta d \\approx v\\sin(\\varphi)\\Delta t\\) e \\(\\Delta\\varphi \\approx \\omega\\Delta t\\), poi una convoluzione gaussiana diffonde e allarga la distribuzione.',
            eq: function (u) {
              return (
                '\\begin{aligned}d\' &= d + v\\sin(\\varphi)\\Delta t, \\quad \\varphi\' = \\varphi + (' +
                (u.dOmega >= 0 ? '+' : '') +
                u.dOmega.toFixed(2) +
                ')\\\\ \\overline{\\operatorname{bel}} &= \\operatorname{shift}(\\operatorname{bel}) * G_Q\\end{aligned}'
              );
            },
            eqExplain: [
              { sym: 'd\'', label: 'Offset Predetto', desc: 'Avanzando con angolo \\(\\varphi\\), lo scostamento laterale cambia di \\(v\\sin(\\varphi)\\Delta t\\).' },
              { sym: '\\varphi\'', label: 'Angolo Predetto', desc: 'Orientamento aggiornato dal comando di sterzata \\(\\omega\\Delta t\\).' },
              { sym: '* G_Q', label: 'Sfocatura Gaussiana 2D', desc: 'Convoluzione 3×3 che sparge la probabilità nelle celle vicine simulando lo slittamento.' }
            ]
          },
          {
            title: 'Osservazione — Segmenti Camera & Incrocio Indizi',
            desc:
              'Ogni segmento giallo (\\(+w/2\\)) e bianco (\\(-w/2\\)) estratto dalla camera vota nella griglia: incrociare i due indizi elimina i riflessi spuri e concentra \\(L(d, \\varphi)\\).',
            eq: function (u) {
              return u.blindMode
                ? 'L(d, \\varphi) = \\mathcal{U}\\quad (\\text{Nessuna corsia visibile})'
                : '\\begin{aligned}L_{\\text{corsia}} &= V_{\\text{giallo}}(+w/2) \\cap V_{\\text{bianco}}(-w/2)\\\\ \\varphi_i &= \\frac{\\pi}{2} - \\operatorname{atan2}(|\\Delta x|, \\Delta y)\\end{aligned}';
            },
            eqExplain: [
              { sym: 'V_{\\text{giallo}}(+w/2)', label: 'Voti Linea Gialla', desc: 'I tratteggi gialli centrali proiettati a terra votano spostando la stima di \\(+w/2\\).' },
              { sym: 'V_{\\text{bianco}}(-w/2)', label: 'Voti Bordo Bianco', desc: 'Il bordo bianco destro vota spostando di \\(-w/2\\); l’incrocio elimina i riflessi spuri.' },
              { sym: '\\varphi_i', label: 'Orientamento Segmento', desc: 'Angolo stimato da ogni segmento proiettato sul pavimento tramite \\(\\operatorname{atan2}\\).' }
            ]
          },
          {
            title: 'Update — Prodotto Hadamard & Estrazione Argmax',
            desc:
              'La moltiplicazione punto-a-punto (\\(\\overline{\\operatorname{bel}} \\odot L\\)) incrocia moto e indizi visivi, concentrando la probabilità su \\((d^*, \\varphi^*)\\) senza invertire matrici.',
            eq: function (u) {
              var e = maxCell(u.gridPost);
              return (
                '\\begin{aligned}\\operatorname{bel}_{i,j} &= \\eta \\cdot \\overline{\\operatorname{bel}}_{i,j} \\odot L_{i,j}\\\\ \\arg\\max &\\rightarrow (d^*=' +
                e.d.toFixed(2) +
                '\\text{ m},\\; \\varphi^*=' +
                Math.round((e.phi * 180) / Math.PI) +
                '^\\circ)\\end{aligned}'
              );
            },
            eqExplain: [
              { sym: '\\odot', label: 'Prodotto di Hadamard', desc: 'Moltiplicazione cella-per-cella tra predizione e verosimiglianza: zero inversioni di matrici.' },
              { sym: '\\eta', label: 'Normalizzatore', desc: 'Divide per la somma totale così la griglia resta una distribuzione di probabilità valida.' },
              { sym: '(d^*, \\varphi^*)', label: 'Stima Ottima Argmax', desc: 'Coordinate della cella più probabile inviate al controllore di guida.' }
            ]
          }
        ]
      },
      onReset: function (u) {
        resetUser(u);
      },
      onLangChange: function (lang, u) {
        syncExtraBtn(lang, u);
      },
      onEnterPhase: function (phase, u) {
        if (phase === 0) {
          if (u.stepIdx > 0) {
            u.gridPrior = new Float32Array(u.gridPost);
          }
          u.gridPred = new Float32Array(u.gridPrior);
          u.est = maxCell(u.gridPrior);
        } else if (phase === 1) {
          u.stepIdx += 1;
          u.prevTrueD = u.trueD;
          u.prevTruePhi = u.truePhi;

          // Smooth PD lane-keeping controller (keeps |phi| <= 12 deg, |d| <= 0.075 m)
          var gentleWave = 0.04 * Math.sin(u.stepIdx * 0.65);
          var pdSteer = -0.55 * u.prevTrueD - 0.85 * u.prevTruePhi + gentleWave;
          u.dOmega = M.clamp(pdSteer, -0.10, 0.10);
          u.truePhi = M.clamp(u.prevTruePhi + u.dOmega + M.randn() * 0.012, -0.21, 0.21);
          u.trueD = M.clamp(u.prevTrueD + u.vStep * Math.sin(u.prevTruePhi) * 0.75 + M.randn() * 0.006, -0.08, 0.08);

          u.gridPred = predictGrid(u.gridPrior, u.vStep * 0.75, u.dOmega);
          u.est = maxCell(u.gridPred);
        } else if (phase === 2) {
          var clues = buildSegmentVotes(u.trueD, u.truePhi, u.scrollDist, u.blindMode);
          u.yellowVotes = clues.yellow;
          u.whiteVotes = clues.white;
          u.gridLik = clues.lik;
          u.yellowSegs = clues.yellowSegs;
          u.whiteSegs = clues.whiteSegs;
        } else if (phase === 3) {
          var post = makeGrid(0);
          for (var i = 0; i < N * N; i++) {
            post[i] = u.gridPred[i] * u.gridLik[i];
          }
          normalizeGrid(post);
          u.gridPost = post;
          u.est = maxCell(u.gridPost);
        }
      },
      getTelemetry: function (lang, u, st) {
        var curMax = maxCell(st.phase === 3 ? u.gridPost : st.phase === 1 || st.phase === 2 ? u.gridPred : u.gridPrior);
        var deg = Math.round((curMax.phi * 180) / Math.PI);
        return [
          {
            label: lang === 'it' ? 'Stato Vero (d, φ)' : 'True (d, φ)',
            value: u.trueD.toFixed(2) + 'm, ' + Math.round((u.truePhi * 180) / Math.PI) + '°'
          },
          {
            label: lang === 'it' ? 'Argmax (d*, φ*)' : 'Argmax (d*, φ*)',
            value: curMax.d.toFixed(2) + 'm, ' + deg + '°',
            gold: true
          },
          {
            label: lang === 'it' ? 'Picco Massima P' : 'Peak Confidence',
            value: (curMax.val * 100).toFixed(1) + '%',
            gold: !u.blindMode && curMax.val > 0.04
          }
        ];
      },
      onRender: function (ctx, w, h, phase, progress, dt, lang, u, st) {
        D.obsidianBg(ctx, w, h);

        var e = M.easeInOutCubic(progress);
        if (phase === 1 && (st.playing || st.stepping)) {
          u.scrollDist += dt * 0.34;
        } else if (st.playing && !(st.cycle === 1 && phase === 0)) {
          u.scrollDist += dt * 0.12;
        }

        // Responsive Layout:
        // Wide (>=480px): Left = Top-Down + Camera View, Right = 28x28 Histogram Grid
        // Phone (<480px): Top = Top-Down | Camera View side-by-side, Bottom = 28x28 Grid
        var pad = 16;
        var isWide = w >= 480;
        var roadX, roadY, leftW, laneH, camX, camY, camW, camH, gridSize, gridX, gridY;

        if (isWide) {
          var gap = 22;
          leftW = Math.min(265, Math.round((w - pad * 2 - gap) * 0.44));
          laneH = Math.round((h - pad * 2 - 28) * 0.56);
          camH = h - pad * 2 - 28 - laneH - 12;
          roadX = pad;
          roadY = pad + 14;
          camX = roadX;
          camW = leftW;
          camY = roadY + laneH + 12;

          var gridAvailW = w - pad * 2 - gap - leftW;
          gridSize = Math.min(gridAvailW - 16, h - pad * 2 - 42);
          gridSize = Math.max(168, Math.floor(gridSize / N) * N);
          gridX = roadX + leftW + gap + Math.round((gridAvailW - gridSize) * 0.55);
          gridY = pad + Math.round((h - pad * 2 - gridSize) * 0.44);
        } else {
          var topH = Math.round((h - pad * 2 - 28) * 0.39);
          var colGap = 10;
          leftW = Math.floor((w - pad * 2 - colGap) * 0.5);
          laneH = topH;
          roadX = pad;
          roadY = pad + 14;
          camX = roadX + leftW + colGap;
          camW = w - pad * 2 - colGap - leftW;
          camY = roadY;
          camH = topH;

          var botAvailH = h - (roadY + topH + 34) - 22;
          gridSize = Math.min(w - pad * 2 - 58, botAvailH);
          gridSize = Math.max(140, Math.floor(gridSize / N) * N);
          gridX = pad + Math.round((w - pad * 2 - gridSize) * 0.56);
          gridY = roadY + topH + 30;
        }

        var animD = phase === 1 ? M.lerp(u.prevTrueD, u.trueD, e) : u.trueD;
        var animPhi = phase === 1 ? M.lerp(u.prevTruePhi, u.truePhi, e) : u.truePhi;

        // ============================================================
        // 1. TOP-LEFT: TOP-DOWN DUCKIETOWN LANE + DUCKIEBOT CHASSIS
        // ============================================================
        ctx.save();
        ctx.fillStyle = '#0d0d10';
        ctx.fillRect(roadX, roadY, leftW, laneH);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(roadX, roadY, leftW, laneH);

        D.labelPill(
          ctx,
          lang === 'it' ? '1. CORSIA (VISTA DALL’ALTO)' : '1. TOP-DOWN LANE VIEW',
          roadX,
          roadY - 9,
          'left',
          '#71717a'
        );

        var laneCenterX = roadX + leftW * 0.5;
        var pxPerMeter = (leftW * 0.28) / LANE_HALF_W;
        var yellowX = laneCenterX - LANE_HALF_W * pxPerMeter;
        var whiteX = laneCenterX + LANE_HALF_W * pxPerMeter;

        ctx.save();
        ctx.beginPath();
        ctx.rect(roadX + 1, roadY + 1, leftW - 2, laneH - 2);
        ctx.clip();

        // Asphalt surface
        ctx.fillStyle = '#141418';
        ctx.fillRect(yellowX - 10, roadY + 1, (whiteX - yellowX) + 20, laneH - 2);

        // Centerline d = 0
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(laneCenterX, roadY + 4);
        ctx.lineTo(laneCenterX, roadY + laneH - 4);
        ctx.stroke();
        ctx.setLineDash([]);

        var botY = roadY + laneH * 0.78;
        var fovTopY = roadY + laneH * 0.14;
        var dashPeriodPx = 0.24 * pxPerMeter;
        var dashLenPx = 0.13 * pxPerMeter;
        var scrollPx = (u.scrollDist * pxPerMeter) % dashPeriodPx;

        // Yellow dashed center divider
        for (var sy = roadY - dashPeriodPx + scrollPx; sy < roadY + laneH; sy += dashPeriodPx) {
          if (u.blindMode && sy > roadY + laneH * 0.1 && sy < botY - 8) continue;
          var inFov = phase === 2 && sy >= fovTopY && sy <= botY - 10;
          ctx.strokeStyle = inFov ? '#ffd000' : 'rgba(255, 208, 0, 0.55)';
          ctx.lineWidth = inFov ? 4.0 : 2.8;
          ctx.beginPath();
          ctx.moveTo(yellowX, sy);
          ctx.lineTo(yellowX, sy + dashLenPx);
          ctx.stroke();
          if (inFov) {
            ctx.fillStyle = '#ffd000';
            ctx.beginPath();
            ctx.arc(yellowX, sy + dashLenPx * 0.5, 2.3, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // White continuous outer edge
        for (var wy = roadY; wy < roadY + laneH; wy += 16) {
          if (u.blindMode && wy > roadY + laneH * 0.1 && wy < botY - 8) continue;
          var wInFov = phase === 2 && wy >= fovTopY && wy <= botY - 10;
          ctx.strokeStyle = wInFov ? '#f4f4f6' : 'rgba(244, 244, 246, 0.45)';
          ctx.lineWidth = wInFov ? 3.8 : 2.6;
          ctx.beginPath();
          ctx.moveTo(whiteX, wy);
          ctx.lineTo(whiteX, wy + 12);
          ctx.stroke();
          if (wInFov && wy % 32 < 16) {
            ctx.fillStyle = '#e07a5f';
            ctx.beginPath();
            ctx.arc(whiteX, wy + 6, 2.3, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if (u.blindMode) {
          ctx.fillStyle = 'rgba(224, 122, 95, 0.08)';
          ctx.fillRect(roadX + 2, roadY + laneH * 0.12, leftW - 4, laneH * 0.58);
          ctx.strokeStyle = 'rgba(224, 122, 95, 0.7)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(yellowX, botY - 12);
          ctx.lineTo(whiteX, botY - 12);
          ctx.stroke();
          D.labelPill(
            ctx,
            lang === 'it' ? 'INCROCIO CIECO' : 'BLIND INTERSECTION',
            laneCenterX,
            roadY + laneH * 0.34,
            'center',
            'rgba(224, 122, 95, 0.85)'
          );
        }

        var robX = M.clamp(laneCenterX - animD * pxPerMeter, roadX + 20, roadX + leftW - 20);
        var robY = botY;
        var canvasHeading = -Math.PI / 2 - animPhi;

        // Camera FOV frustum cone
        ctx.save();
        ctx.translate(robX, robY);
        ctx.rotate(canvasHeading);
        var coneLen = laneH * 0.64;
        var spreadAngle = 0.52;
        var fovGrad = ctx.createLinearGradient(0, 0, coneLen, 0);
        fovGrad.addColorStop(
          0,
          phase === 2 && !u.blindMode ? 'rgba(224, 122, 95, 0.22)' : 'rgba(255, 208, 0, 0.08)'
        );
        fovGrad.addColorStop(1, 'rgba(224, 122, 95, 0.01)');
        ctx.fillStyle = fovGrad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(coneLen * Math.cos(-spreadAngle), coneLen * Math.sin(-spreadAngle));
        ctx.lineTo(coneLen * Math.cos(spreadAngle), coneLen * Math.sin(spreadAngle));
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Cycle 1 Phase 0: Drop-in placement animation
        var botScale = 1.0;
        if (st.cycle === 1 && phase === 0) {
          var dropP = M.easeOutCubic(progress);
          botScale = M.lerp(1.32, 1.0, dropP);
          var dropRing = M.lerp(28, 12, dropP);
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 208, 0, ' + (0.85 * (1 - progress * 0.45)).toFixed(2) + ')';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(robX, robY, dropRing, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Ghost estimated pose
        var estCell = maxCell(
          phase === 0 ? u.gridPrior : phase === 3 ? u.gridPost : u.gridPred
        );
        var estX = M.clamp(laneCenterX - estCell.d * pxPerMeter, roadX + 20, roadX + leftW - 20);
        if (st.cycle > 1 || phase === 3) {
          ctx.save();
          ctx.translate(estX, robY);
          ctx.rotate(-Math.PI / 2 - estCell.phi);
          ctx.strokeStyle = 'rgba(255, 208, 0, 0.68)';
          ctx.lineWidth = 1.4;
          ctx.setLineDash([2, 2]);
          ctx.strokeRect(-8, -6.5, 17, 13);
          ctx.restore();
        }

        drawDuckiebot(ctx, robX, robY, canvasHeading, botScale);
        ctx.restore(); // end top-down clip
        ctx.restore();

        // ============================================================
        // 2. ONBOARD CAMERA VIEW (TRUE 3D->2D PINHOLE PROJECTION)
        // ============================================================
        ctx.save();
        ctx.fillStyle = '#0d0d10';
        ctx.fillRect(camX, camY, camW, camH);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(camX, camY, camW, camH);

        ctx.save();
        ctx.beginPath();
        ctx.rect(camX + 1, camY + 1, camW - 2, camH - 2);
        ctx.clip();

        // Horizon line projected from xFwd -> infinity
        var farL = projectGroundToCam(-1.5, 12.0, animD, animPhi, camX, camY, camW, camH);
        var horizY = farL ? M.clamp(farL.v, camY + 20, camY + camH * 0.45) : camY + camH * 0.28;

        // Sky & asphalt floor
        ctx.fillStyle = '#08080a';
        ctx.fillRect(camX, camY, camW, horizY - camY);
        ctx.fillStyle = '#15151a';
        ctx.fillRect(camX, horizY, camW, camY + camH - horizY);
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.beginPath();
        ctx.moveTo(camX, horizY);
        ctx.lineTo(camX + camW, horizY);
        ctx.stroke();

        D.labelPill(
          ctx,
          isWide
            ? lang === 'it' ? '2. VISTA CAMERA DUCKIEBOT' : '2. ONBOARD CAMERA VIEW'
            : lang === 'it' ? '2. CAMERA' : '2. CAMERA',
          camX + 8,
          camY + 12,
          'left',
          phase === 2 ? '#e07a5f' : '#a1a1aa'
        );

        if (!u.blindMode) {
          // Project dashed yellow center divider
          var camPeriod = 0.24;
          var camDash = 0.13;
          var camOff = u.scrollDist % camPeriod;
          for (var wyCam = 0.18 - camOff; wyCam < 2.2; wyCam += camPeriod) {
            var cy0 = Math.max(0.16, wyCam);
            var cy1 = wyCam + camDash;
            if (cy1 <= cy0) continue;
            var p0 = projectGroundToCam(-LANE_HALF_W, cy0, animD, animPhi, camX, camY, camW, camH);
            var p1 = projectGroundToCam(-LANE_HALF_W, cy1, animD, animPhi, camX, camY, camW, camH);
            if (!p0 || !p1) continue;

            var isYHighlight = phase === 2 && cy0 < 1.12;
            ctx.strokeStyle = isYHighlight ? '#ffd000' : 'rgba(255, 208, 0, 0.72)';
            ctx.lineWidth = M.clamp(4.8 - p0.xFwd * 2.2, 1.4, 4.5);
            ctx.beginPath();
            ctx.moveTo(p0.u, p0.v);
            ctx.lineTo(p1.u, p1.v);
            ctx.stroke();

            if (isYHighlight) {
              ctx.fillStyle = '#ffd000';
              ctx.beginPath();
              ctx.arc((p0.u + p1.u) * 0.5, (p0.v + p1.v) * 0.5, 2.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Project solid white outer lane edge
          var wSegs = [
            [0.16, 0.42],
            [0.42, 0.74],
            [0.74, 1.15],
            [1.15, 2.2]
          ];
          for (var wsIdx = 0; wsIdx < wSegs.length; wsIdx++) {
            var wp0 = projectGroundToCam(LANE_HALF_W, wSegs[wsIdx][0], animD, animPhi, camX, camY, camW, camH);
            var wp1 = projectGroundToCam(LANE_HALF_W, wSegs[wsIdx][1], animD, animPhi, camX, camY, camW, camH);
            if (!wp0 || !wp1) continue;
            var isWHighlight = phase === 2 && wsIdx < 3;
            ctx.strokeStyle = isWHighlight ? '#f4f4f6' : 'rgba(244, 244, 246, 0.62)';
            ctx.lineWidth = M.clamp(4.2 - wp0.xFwd * 1.8, 1.3, 3.8);
            ctx.beginPath();
            ctx.moveTo(wp0.u, wp0.v);
            ctx.lineTo(wp1.u, wp1.v);
            ctx.stroke();

            if (isWHighlight) {
              ctx.fillStyle = '#e07a5f';
              ctx.beginPath();
              ctx.arc((wp0.u + wp1.u) * 0.5, (wp0.v + wp1.v) * 0.5, 2.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        } else {
          // Red stop line + empty intersection
          var sL = projectGroundToCam(-LANE_HALF_W, 0.35, animD, animPhi, camX, camY, camW, camH);
          var sR = projectGroundToCam(LANE_HALF_W, 0.35, animD, animPhi, camX, camY, camW, camH);
          if (sL && sR) {
            ctx.strokeStyle = 'rgba(224, 122, 95, 0.78)';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(sL.u, sL.v);
            ctx.lineTo(sR.u, sR.v);
            ctx.stroke();
          }
          D.labelPill(
            ctx,
            lang === 'it' ? 'NESSUN SEGMENTO' : 'NO SEGMENTS',
            camX + camW * 0.5,
            camY + camH * 0.62,
            'center',
            'rgba(224, 122, 95, 0.85)'
          );
        }

        ctx.restore(); // end camera clip
        ctx.restore();

        // ============================================================
        // 3. RIGHT: 28x28 HISTOGRAM MATRIX + SEGMENT VOTE INTERSECTION
        // ============================================================
        var activeGrid = makeGrid(0);
        var mode = 'belief';
        if (phase === 0) {
          activeGrid = u.gridPrior;
          mode = 'belief';
        } else if (phase === 1) {
          for (var i = 0; i < N * N; i++) {
            activeGrid[i] = M.lerp(u.gridPrior[i], u.gridPred[i], e);
          }
          mode = 'predict';
        } else if (phase === 2) {
          if (progress < 0.45) {
            var pY = M.easeInOutCubic(progress / 0.45);
            for (var yi = 0; yi < N * N; yi++) {
              activeGrid[yi] = M.lerp(1 / (N * N), u.yellowVotes[yi], pY);
            }
          } else if (progress < 0.85) {
            var pW = M.easeInOutCubic((progress - 0.45) / 0.40);
            for (var wi = 0; wi < N * N; wi++) {
              activeGrid[wi] = M.lerp(u.yellowVotes[wi], u.gridLik[wi], pW);
            }
          } else {
            activeGrid = u.gridLik;
          }
          mode = 'likelihood';
        } else if (phase === 3) {
          for (var j = 0; j < N * N; j++) {
            activeGrid[j] = M.lerp(u.gridPred[j], u.gridPost[j], e);
          }
          mode = 'belief';
        }

        var maxVal = 1e-6;
        for (var k = 0; k < activeGrid.length; k++) {
          if (activeGrid[k] > maxVal) maxVal = activeGrid[k];
        }

        var cellSize = gridSize / N;
        var gridTitle =
          phase === 2
            ? progress < 0.45
              ? lang === 'it'
                ? '3. VOTI SEGMENTI GIALLI V_g(d, φ)'
                : '3. YELLOW SEGMENT VOTES V_y(d, φ)'
              : lang === 'it'
                ? '3. INCROCIO GIALLO ∩ BIANCO = L(d, φ)'
                : '3. YELLOW ∩ WHITE CLUES = L(d, φ)'
            : lang === 'it'
              ? '3. ISTOGRAMMA bel(d, φ)'
              : '3. HISTOGRAM bel(d, φ)';

        D.labelPill(
          ctx,
          gridTitle,
          gridX,
          gridY - 12,
          'left',
          phase === 2 ? '#e07a5f' : '#ffd000'
        );

        for (var r = 0; r < N; r++) {
          for (var c = 0; c < N; c++) {
            var val = activeGrid[r * N + c];
            var norm = Math.pow(M.clamp(val / maxVal, 0, 1), 0.72);
            var cx = gridX + c * cellSize;
            var cy = gridY + r * cellSize;
            if (mode === 'likelihood') {
              ctx.fillStyle =
                progress < 0.45
                  ? 'rgba(255, 208, 0, ' + (0.04 + 0.82 * norm).toFixed(3) + ')'
                  : 'rgba(224, 122, 95, ' + (0.04 + 0.88 * norm).toFixed(3) + ')';
            } else if (mode === 'predict') {
              var rr = Math.round(M.lerp(18, 210, norm));
              var gg = Math.round(M.lerp(18, 178, norm));
              var bb = Math.round(M.lerp(22, 60, norm));
              ctx.fillStyle = 'rgb(' + rr + ',' + gg + ',' + bb + ')';
            } else {
              var r2 = Math.round(M.lerp(14, 255, norm));
              var g2 = Math.round(M.lerp(14, 208, norm));
              var b2 = Math.round(M.lerp(18, 18, norm));
              ctx.fillStyle = 'rgb(' + r2 + ',' + g2 + ',' + b2 + ')';
            }
            ctx.fillRect(cx, cy, cellSize - 0.5, cellSize - 0.5);
          }
        }

        // Hairline grid axes for d = 0 and phi = 0
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;
        ctx.strokeRect(gridX, gridY, gridSize, gridSize);
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(gridX + gridSize / 2, gridY);
        ctx.lineTo(gridX + gridSize / 2, gridY + gridSize);
        ctx.moveTo(gridX, gridY + gridSize / 2);
        ctx.lineTo(gridX + gridSize, gridY + gridSize / 2);
        ctx.stroke();
        ctx.restore();

        // Axis annotations
        D.labelPill(ctx, '+d (L)', gridX - 6, gridY + 8, 'right', '#71717a');
        D.labelPill(ctx, '-d (R)', gridX - 6, gridY + gridSize - 8, 'right', '#71717a');
        D.labelPill(ctx, '-28°', gridX, gridY + gridSize + 13, 'left', '#71717a');
        D.labelPill(ctx, 'φ (rad)', gridX + gridSize / 2, gridY + gridSize + 13, 'center', '#a1a1aa');
        D.labelPill(ctx, '+28°', gridX + gridSize, gridY + gridSize + 13, 'right', '#71717a');

        // Animated Projection Rays from Camera View -> Histogram Grid during Phase 2
        if (phase === 2 && !u.blindMode && progress < 0.88) {
          var peak = maxCell(u.gridLik);
          var targetPx = gridX + (peak.c + 0.5) * cellSize;
          var targetPy = gridY + (peak.r + 0.5) * cellSize;

          var isYellowStage = progress < 0.45;
          var raySrcX = isYellowStage ? camX + camW * 0.28 : camX + camW * 0.72;
          var raySrcY = camY + camH * 0.58;
          var localP = isYellowStage ? progress / 0.45 : (progress - 0.45) / 0.40;
          var curX = M.lerp(raySrcX, targetPx, M.easeOutCubic(M.clamp(localP * 1.2, 0, 1)));
          var curY = M.lerp(raySrcY, targetPy, M.easeOutCubic(M.clamp(localP * 1.2, 0, 1)));

          ctx.save();
          ctx.strokeStyle = isYellowStage ? 'rgba(255, 208, 0, 0.72)' : 'rgba(224, 122, 95, 0.78)';
          ctx.lineWidth = 1.4;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(raySrcX, raySrcY);
          ctx.quadraticCurveTo((raySrcX + targetPx) * 0.5, Math.min(raySrcY, targetPy) - 22, curX, curY);
          ctx.stroke();
          ctx.fillStyle = isYellowStage ? '#ffd000' : '#e07a5f';
          ctx.beginPath();
          ctx.arc(curX, curY, 3.0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // True (d, phi) diamond and Argmax crosshair on the heatmap
        var trueC = ((animPhi + PHI_MAX) / (2 * PHI_MAX)) * N;
        var trueR = ((D_MAX - animD) / (2 * D_MAX)) * N;
        var truePx = gridX + trueC * cellSize;
        var truePy = gridY + trueR * cellSize;

        var peakCell = maxCell(activeGrid);
        var argPx = gridX + (peakCell.c + 0.5) * cellSize;
        var argPy = gridY + (peakCell.r + 0.5) * cellSize;

        if (st.cycle > 1 || phase >= 2) {
          ctx.save();
          ctx.strokeStyle = '#ffd000';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(argPx, argPy, 7, 0, Math.PI * 2);
          ctx.moveTo(argPx - 11, argPy);
          ctx.lineTo(argPx + 11, argPy);
          ctx.moveTo(argPx, argPy - 11);
          ctx.lineTo(argPx, argPy + 11);
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.translate(truePx, truePy);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#f4f4f6';
        ctx.strokeStyle = '#0a0a0c';
        ctx.lineWidth = 1.4;
        ctx.fillRect(-3.8, -3.8, 7.6, 7.6);
        ctx.strokeRect(-3.8, -3.8, 7.6, 7.6);
        ctx.restore();
      }
    });

    if (btnBlind) {
      btnBlind.addEventListener('click', function () {
        lab.state.user.blindMode = !lab.state.user.blindMode;
        syncExtraBtn(lab.getLang(), lab.state.user);
        lab.refresh();
      });
    }

    syncExtraBtn(lab.getLang(), lab.state.user);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHF);
  } else {
    initHF();
  }
})();
