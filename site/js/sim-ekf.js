/* LAB 04: Extended Kalman Filter — 6-Scene SE(2) Unicycle, Jacobians & AprilTag Walkthrough */
(function () {
  'use strict';

  function init() {
    var C = window.CinemaLabs;
    var M = window.LocSims && window.LocSims.math;
    if (!C || !M) return;

    // Exact EKF scenario parameters (aligned with ekf_localization-EXP_ITA.ipynb)
    var q0 = [0.40, 0.60, 0.50]; // [x, y, theta]
    var P0 = [
      [0.040, 0.000, 0.000],
      [0.000, 0.040, 0.000],
      [0.000, 0.000, 0.025]
    ];
    var dX = 0.28, dT = 0.20;
    var Q = [[0.030, 0.000], [0.000, 0.015]];
    var TAG = { id: 23, x: 1.45, y: 1.25 };
    var R = [[0.015, 0.000], [0.000, 0.008]];

    // Step 1: Non-linear motion prediction f(q0, u)
    var qBar = [
      q0[0] + dX * Math.cos(q0[2]),
      q0[1] + dX * Math.sin(q0[2]),
      M.wrapAngle(q0[2] + dT)
    ];

    // Step 2: Motion Jacobians F (3x3) and W (3x2)
    var F = [
      [1, 0, -dX * Math.sin(q0[2])],
      [0, 1,  dX * Math.cos(q0[2])],
      [0, 0,  1]
    ];
    var W = [
      [Math.cos(q0[2]), 0],
      [Math.sin(q0[2]), 0],
      [0, 1]
    ];
    // Compute W Q W^T (3x3)
    var WQ = [
      [W[0][0] * Q[0][0], W[0][1] * Q[1][1]],
      [W[1][0] * Q[0][0], W[1][1] * Q[1][1]],
      [W[2][0] * Q[0][0], W[2][1] * Q[1][1]]
    ];
    var WQWt = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (var i = 0; i < 3; i++) {
      for (var j = 0; j < 3; j++) {
        WQWt[i][j] = WQ[i][0] * W[j][0] + WQ[i][1] * W[j][1];
      }
    }
    var PBar = M.mat3Add(M.mat3Mul(M.mat3Mul(F, P0), M.mat3T(F)), WQWt);

    // Step 3: Polar AprilTag h(qBar) & Measurement Jacobian H (2x3)
    var dx = TAG.x - qBar[0];
    var dy = TAG.y - qBar[1];
    var rHat = Math.sqrt(dx * dx + dy * dy);
    var phiHat = M.wrapAngle(Math.atan2(dy, dx) - qBar[2]);
    var H = [
      [-dx / rHat, -dy / rHat, 0],
      [ dy / (rHat * rHat), -dx / (rHat * rHat), -1]
    ];

    // Step 4: Innovation & EKF Gain K (3x2)
    var zMeas = [rHat - 0.11, M.wrapAngle(phiHat + 0.08)];
    var innov = [zMeas[0] - rHat, M.wrapAngle(zMeas[1] - phiHat)];

    // Compute S = H PBar H^T + R (2x2)
    var HP = [[0, 0, 0], [0, 0, 0]];
    for (var r = 0; r < 2; r++) {
      for (var c = 0; c < 3; c++) {
        HP[r][c] = H[r][0] * PBar[0][c] + H[r][1] * PBar[1][c] + H[r][2] * PBar[2][c];
      }
    }
    var S = [
      [HP[0][0] * H[0][0] + HP[0][1] * H[0][1] + HP[0][2] * H[0][2] + R[0][0],
       HP[0][0] * H[1][0] + HP[0][1] * H[1][1] + HP[0][2] * H[1][2] + R[0][1]],
      [HP[1][0] * H[0][0] + HP[1][1] * H[0][1] + HP[1][2] * H[0][2] + R[1][0],
       HP[1][0] * H[1][0] + HP[1][1] * H[1][1] + HP[1][2] * H[1][2] + R[1][1]]
    ];
    var SInv = M.mat2Inv(S);

    // PBar H^T (3x2)
    var PHt = [[0, 0], [0, 0], [0, 0]];
    for (var a = 0; a < 3; a++) {
      for (var b = 0; b < 2; b++) {
        PHt[a][b] = PBar[a][0] * H[b][0] + PBar[a][1] * H[b][1] + PBar[a][2] * H[b][2];
      }
    }
    var K = [[0, 0], [0, 0], [0, 0]];
    for (var ka = 0; ka < 3; ka++) {
      for (var kb = 0; kb < 2; kb++) {
        K[ka][kb] = PHt[ka][0] * SInv[0][kb] + PHt[ka][1] * SInv[1][kb];
      }
    }

    // Step 5: Posterior State & Symmetrized Covariance
    var qPost = [
      qBar[0] + K[0][0] * innov[0] + K[0][1] * innov[1],
      qBar[1] + K[1][0] * innov[0] + K[1][1] * innov[1],
      M.wrapAngle(qBar[2] + K[2][0] * innov[0] + K[2][1] * innov[1])
    ];
    var KH = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (var u = 0; u < 3; u++) {
      for (var v = 0; v < 3; v++) {
        KH[u][v] = K[u][0] * H[0][v] + K[u][1] * H[1][v];
      }
    }
    var I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    var PNew = M.mat3Mul(M.mat3Sub(I3, KH), PBar);
    var PPost = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (var pi = 0; pi < 3; pi++) {
      for (var pj = 0; pj < 3; pj++) {
        PPost[pi][pj] = 0.5 * (PNew[pi][pj] + PNew[pj][pi]);
      }
    }

    // Deterministic banana-arc sample points for Scene 1 visual contrast
    var BANANA_PTS = [];
    for (var bi = -7; bi <= 7; bi++) {
      var dTh = bi * 0.045;
      var dL = dX + (bi % 2 === 0 ? 0.02 : -0.02);
      BANANA_PTS.push([q0[0] + dL * Math.cos(q0[2] + dTh), q0[1] + dL * Math.sin(q0[2] + dTh)]);
    }

    var SCENES = [
      { id: 0, start: 0.0,  end: 9.0,  tag: 'init SE(2) (q0, P0)',   shortEn: '0. Pose q0',    shortIt: '0. Posa q0' },
      { id: 1, start: 9.0,  end: 18.0, tag: 'f(q, u) non-linear',    shortEn: '1. Arc f(q)',   shortIt: '1. Arco f(q)' },
      { id: 2, start: 18.0, end: 29.0, tag: 'Jacobians F, W → P_prior', shortEn: '2. F & P',   shortIt: '2. F & P' },
      { id: 3, start: 29.0, end: 40.0, tag: 'AprilTag h(q) & H',     shortEn: '3. Tag & H',    shortIt: '3. Tag & H' },
      { id: 4, start: 40.0, end: 50.0, tag: 'wrap & Gain K (3×2)',   shortEn: '4. Gain K',     shortIt: '4. Gain K' },
      { id: 5, start: 50.0, end: 60.0, tag: 'update & sym(P)',       shortEn: '5. Collapse',   shortIt: '5. Update' }
    ];

    function interpMat3(A, B, f) {
      var out = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) out[r][c] = C.lerp(A[r][c], B[r][c], f);
      return out;
    }

    function ellipseRadius(P) {
      var e = M.covEllipse2x2(P[0][0], P[0][1], P[1][1]);
      return Math.max(e.rx, e.ry) * 3.0;
    }

    function makeWorldFrame(w, h) {
      // World bounds: x in [-0.1..1.85], y in [0.0..1.75]
      var scale = Math.min((w - 56) / 1.95, (h - 56) / 1.75);
      var ox = (w - 1.95 * scale) * 0.5 + 0.1 * scale;
      var oy = h - (h - 1.75 * scale) * 0.5;
      return {
        scale: scale,
        toPx: function (x, y) { return { px: ox + x * scale, py: oy - y * scale }; }
      };
    }

    function drawEllipse2D(ctx, wf, cx, cy, P, color, fillAlpha, dashed) {
      var e = M.covEllipse2x2(P[0][0], P[0][1], P[1][1]);
      var center = wf.toPx(cx, cy);
      var rx = Math.max(4, e.rx * 2.2 * wf.scale);
      var ry = Math.max(4, e.ry * 2.2 * wf.scale);
      ctx.save();
      ctx.translate(center.px, center.py);
      ctx.rotate(-e.angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      if (fillAlpha > 0) {
        ctx.fillStyle = color; ctx.globalAlpha = fillAlpha; ctx.fill(); ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      if (dashed && ctx.setLineDash) ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.restore();
    }

    function drawRobot2D(ctx, wf, q, color, showFov) {
      var p = wf.toPx(q[0], q[1]);
      ctx.save();
      ctx.translate(p.px, p.py);
      ctx.rotate(-q[2]);
      if (showFov) {
        var rFov = 1.15 * wf.scale;
        ctx.fillStyle = 'rgba(96, 165, 250, 0.10)';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, rFov, -0.52, 0.52); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#14141c';
      ctx.strokeStyle = color || '#ffd000';
      ctx.lineWidth = 2;
      C.roundRect(ctx, -14, -10, 28, 20, 5);
      ctx.fill(); ctx.stroke();
      C.drawArrow(ctx, 0, 0, 28, 0, color || '#ffd000', 2, false);
      ctx.restore();
    }

    function drawTag(ctx, wf, active) {
      var p = wf.toPx(TAG.x, TAG.y);
      ctx.save();
      ctx.fillStyle = active ? 'rgba(224, 122, 95, 0.25)' : '#14141c';
      ctx.strokeStyle = '#e07a5f';
      ctx.lineWidth = active ? 2.2 : 1.5;
      C.roundRect(ctx, p.px - 10, p.py - 10, 20, 20, 3);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e07a5f';
      ctx.fillRect(p.px - 5, p.py - 5, 4, 4);
      ctx.fillRect(p.px + 1, p.py + 1, 4, 4);
      ctx.font = '700 10.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Tag #' + TAG.id + ' (1.45, 1.25)', p.px, p.py - 15);
      ctx.restore();
    }

    C.mount({
      id: 'lab-ekf',
      duration: 60.0,
      scenes: SCENES,
      mathTitleEn: 'SE(2) Matrices & Linearization',
      mathTitleIt: 'Matrici SE(2) & Linearizzazione',

      getMetric: function (t, lang) {
        var lbl = lang === 'it' ? 'Raggio 3σ' : '3σ Radius';
        var curP = P0;
        if (t >= 18.0 && t < 29.0) curP = interpMat3(P0, PBar, C.easeInOutCubic(C.invLerp(19.0, 27.0, t)));
        else if (t >= 29.0 && t < 50.0) curP = PBar;
        else if (t >= 50.0) curP = interpMat3(PBar, PPost, C.easeOutCubic(C.invLerp(50.5, 57.5, t)));
        var r3 = ellipseRadius(curP);
        var col = t >= 51.0 ? '#34d399' : t >= 19.0 ? '#e07a5f' : '#ffd000';
        return { label: lbl, pct: C.clamp((r3 / 1.1) * 100, 12, 100), text: r3.toFixed(2) + ' m', color: col };
      },

      getSubtitle: function (t, lang) {
        var it = lang === 'it';
        if (t < 9.0) {
          return { color: '#ffd000', text: it ? 'Stato iniziale \\(\\mathrm{SE}(2)\\): \\(q_0 = [0.40,\\; 0.60,\\; 0.50]^\\top\\) con covarianza \\(P_0\\) e mappa nota dell’AprilTag #23 a \\((1.45, 1.25)\\).' : 'Initial \\(\\mathrm{SE}(2)\\) pose: \\(q_0 = [0.40,\\; 0.60,\\; 0.50]^\\top\\) with covariance \\(P_0\\) and known AprilTag #23 at \\((1.45, 1.25)\\).' };
        }
        if (t < 18.0) {
          return { color: '#60a5fa', text: it ? 'Cinematica non lineare \\(f(q_0, u)\\) con \\(dX = 0.28\\text{ m}, dT = +0.20\\text{ rad}\\): la media avanza con \\(\\cos\\theta, \\sin\\theta\\) esatti, mentre l’incertezza vera si curva ad arco.' : 'Non-linear kinematics \\(f(q_0, u)\\) with \\(dX = 0.28\\text{ m}, dT = +0.20\\text{ rad}\\): mean advances with exact \\(\\cos\\theta, \\sin\\theta\\), while true uncertainty bends into an arc.' };
        }
        if (t < 29.0) {
          return { color: '#ffd000', text: it ? 'Linearizzazione: lo Jacobiano \\(F_t\\) ha \\(-dX\\sin\\theta\\) e \\(+dX\\cos\\theta\\) in colonna 3, quindi \\(\\bar{P}_t = F_t P_0 F_t^\\top + W_t Q W_t^\\top\\) allarga e inclina l’ellisse lateralmente.' : 'Linearization: Jacobian \\(F_t\\) carries \\(-dX\\sin\\theta\\) and \\(+dX\\cos\\theta\\) in column 3, so \\(\\bar{P}_t = F_t P_0 F_t^\\top + W_t Q W_t^\\top\\) stretches and tilts the ellipse sideways.' };
        }
        if (t < 40.0) {
          return { color: '#e07a5f', text: it ? 'AprilTag #23 nel FOV: calcoliamo \\(\\Delta x, \\Delta y\\), la misura polare attesa \\(h(\\bar{q}) = [\\hat{r}, \\hat{\\phi}]^\\top\\) e lo Jacobiano \\(H_t\\) (\\(2\\times 3\\), con \\(-1\\) su \\(\\theta\\)).' : 'AprilTag #23 enters FOV: compute \\(\\Delta x, \\Delta y\\), expected polar reading \\(h(\\bar{q}) = [\\hat{r}, \\hat{\\phi}]^\\top\\), and Jacobian \\(H_t\\) (\\(2\\times 3\\), with \\(-1\\) on \\(\\theta\\)).' };
        }
        if (t < 50.0) {
          return { color: '#ffd000', text: it ? 'Arriva la lettura reale \\(z_t\\): l’innovazione normalizzata \\(\\operatorname{wrap}(z_t - h(\\bar{q}))\\) entra nel guadagno \\(K_t\\) (\\(3\\times 2\\)), convertendo l’errore polare in correzione \\((\\delta x, \\delta y, \\delta\\theta)\\).' : 'Real reading \\(z_t\\) arrives: wrapped innovation \\(\\operatorname{wrap}(z_t - h(\\bar{q}))\\) multiplies gain \\(K_t\\) (\\(3\\times 2\\)), mapping polar residuals into \\((\\delta x, \\delta y, \\delta\\theta)\\).' };
        }
        return { color: '#34d399', text: it ? 'Update & simmetrizzazione \\(P_t = \\tfrac{1}{2}(P_{\\text{new}} + P_{\\text{new}}^\\top)\\): la posa si riallinea e l’ellisse \\(3\\sigma\\) si contrae nettamente sul Duckiebot.' : 'Update & symmetrization \\(P_t = \\tfrac{1}{2}(P_{\\text{new}} + P_{\\text{new}}^\\top)\\): pose locks back and the \\(3\\sigma\\) ellipse collapses tightly around the Duckiebot.' };
      },

      drawCanvas: function (ctx, w, h, t, lang, api) {
        var it = lang === 'it';
        var wf = makeWorldFrame(w, h);
        // World axes
        var o = wf.toPx(0, 0), ax = wf.toPx(1.75, 0), ay = wf.toPx(0, 1.65);
        C.drawArrow(ctx, o.px, o.py, ax.px, ax.py, 'rgba(255,255,255,0.28)', 1.4, false);
        C.drawArrow(ctx, o.px, o.py, ay.px, ay.py, 'rgba(255,255,255,0.28)', 1.4, false);
        ctx.font = '600 10px "JetBrains Mono", monospace'; ctx.fillStyle = '#7c7c94';
        ctx.textAlign = 'left'; ctx.fillText('+X (m)', ax.px - 28, ax.py + 15);
        ctx.fillText('+Y (m)', ay.px + 6, ay.py + 8);

        drawTag(ctx, wf, t >= 29.0);
        var pTag = wf.toPx(TAG.x, TAG.y);

        if (t < 9.0) {
          api.setMode('SE(2) PRIOR', 'gold');
          api.setCoords('q0 = [0.40, 0.60, 0.50]');
          drawEllipse2D(ctx, wf, q0[0], q0[1], P0, '#ffd000', 0.16, false);
          drawRobot2D(ctx, wf, q0, '#ffd000', true);
          return;
        }

        if (t < 18.0) {
          api.setMode(it ? 'ARCO NON LINEARE f(q, u)' : 'NON-LINEAR ARC f(q, u)', '');
          var p1 = C.easeInOutCubic(C.invLerp(9.5, 16.5, t));
          var qNow = [C.lerp(q0[0], qBar[0], p1), C.lerp(q0[1], qBar[1], p1), C.lerp(q0[2], qBar[2], p1)];
          api.setCoords('q_pred = [' + qNow[0].toFixed(2) + ', ' + qNow[1].toFixed(2) + ', ' + qNow[2].toFixed(2) + ']');
          drawEllipse2D(ctx, wf, q0[0], q0[1], P0, 'rgba(148,163,184,0.45)', 0.05, true);
          // Banana samples
          if (p1 > 0.3) {
            ctx.fillStyle = 'rgba(224, 122, 95, 0.72)';
            BANANA_PTS.forEach(function (pt) {
              var pp = wf.toPx(C.lerp(q0[0], pt[0], p1), C.lerp(q0[1], pt[1], p1));
              ctx.beginPath(); ctx.arc(pp.px, pp.py, 2.6, 0, Math.PI * 2); ctx.fill();
            });
          }
          var p0Px = wf.toPx(q0[0], q0[1]), pCurPx = wf.toPx(qNow[0], qNow[1]);
          C.drawArrow(ctx, p0Px.px, p0Px.py, pCurPx.px, pCurPx.py, '#60a5fa', 2.2, true);
          drawRobot2D(ctx, wf, qNow, '#60a5fa', true);
          api.setAnchor('ekf-bot', pCurPx.px, pCurPx.py);
          return;
        }

        if (t < 29.0) {
          api.setMode(it ? 'PROPAGAZIONE JACOBIANI F, W' : 'JACOBIAN PROPAGATION F, W', 'gold');
          var p2 = C.easeInOutCubic(C.invLerp(19.0, 27.0, t));
          var PNow = interpMat3(P0, PBar, p2);
          api.setCoords('P_prior = F P0 Fᵀ + W Q Wᵀ');
          drawEllipse2D(ctx, wf, qBar[0], qBar[1], P0, 'rgba(148,163,184,0.4)', 0.04, true);
          drawEllipse2D(ctx, wf, qBar[0], qBar[1], PNow, '#ffd000', 0.18, false);
          drawRobot2D(ctx, wf, qBar, '#ffd000', true);
          var pB = wf.toPx(qBar[0], qBar[1]);
          api.setAnchor('ekf-ellipse', pB.px, pB.py - 28);
          return;
        }

        if (t < 40.0) {
          api.setMode(it ? 'MODELLO POLARE APRILTAG' : 'POLAR APRILTAG MODEL', 'coral');
          api.setCoords('r_pred = ' + rHat.toFixed(2) + ' m · φ_pred = ' + (phiHat * 180 / Math.PI).toFixed(1) + '°');
          drawEllipse2D(ctx, wf, qBar[0], qBar[1], PBar, 'rgba(255,208,0,0.55)', 0.10, true);
          var pB3 = wf.toPx(qBar[0], qBar[1]);
          var pCorner = wf.toPx(TAG.x, qBar[1]);
          // Δx, Δy legs
          ctx.save();
          if (ctx.setLineDash) ctx.setLineDash([4, 4]);
          ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(pB3.px, pB3.py); ctx.lineTo(pCorner.px, pCorner.py); ctx.stroke();
          ctx.strokeStyle = '#e07a5f';
          ctx.beginPath(); ctx.moveTo(pCorner.px, pCorner.py); ctx.lineTo(pTag.px, pTag.py); ctx.stroke();
          if (ctx.setLineDash) ctx.setLineDash([]);
          ctx.restore();
          ctx.font = '700 10.5px "JetBrains Mono", monospace';
          ctx.fillStyle = '#60a5fa'; ctx.textAlign = 'center'; ctx.fillText('Δx = +' + dx.toFixed(2), (pB3.px + pCorner.px) * 0.5, pCorner.py + 14);
          ctx.fillStyle = '#e07a5f'; ctx.textAlign = 'left'; ctx.fillText('Δy = +' + dy.toFixed(2), pCorner.px + 6, (pCorner.py + pTag.py) * 0.5);

          C.drawArrow(ctx, pB3.px, pB3.py, pTag.px, pTag.py, '#ffd000', 2.2, false);
          drawRobot2D(ctx, wf, qBar, '#ffd000', true);
          api.setAnchor('ekf-tag', pTag.px, pTag.py);
          return;
        }

        if (t < 50.0) {
          api.setMode(it ? 'INNOVAZIONE & GUADAGNO K' : 'INNOVATION & GAIN K', 'gold');
          var p4 = C.easeInOutCubic(C.invLerp(42.0, 48.5, t));
          var qPull = [C.lerp(qBar[0], qPost[0], p4), C.lerp(qBar[1], qPost[1], p4), C.lerp(qBar[2], qPost[2], p4)];
          api.setCoords('Δr = ' + C.signed(innov[0], 2) + ' · Δφ = ' + C.signed(innov[1], 2));
          drawEllipse2D(ctx, wf, qBar[0], qBar[1], PBar, 'rgba(255,208,0,0.55)', 0.10, true);
          var pB4 = wf.toPx(qBar[0], qBar[1]), pP4 = wf.toPx(qPull[0], qPull[1]);
          C.drawArrow(ctx, pB4.px, pB4.py, pTag.px, pTag.py, 'rgba(224,122,95,0.65)', 1.8, true);
          C.drawArrow(ctx, pB4.px, pB4.py, pP4.px, pP4.py, '#34d399', 2.8, false);
          drawRobot2D(ctx, wf, qPull, '#34d399', true);
          api.setAnchor('ekf-tag', pTag.px, pTag.py);
          return;
        }

        // Scene 5: Breathing ellipse collapse
        api.setMode(it ? 'CONTRAZIONE ELLISSE P_t' : 'BREATHING ELLIPSE COLLAPSE', 'emerald');
        var p5 = C.easeOutCubic(C.invLerp(50.5, 57.5, t));
        var PFin = interpMat3(PBar, PPost, p5);
        api.setCoords('q_t = [' + qPost[0].toFixed(2) + ', ' + qPost[1].toFixed(2) + ', ' + qPost[2].toFixed(2) + ']');
        drawEllipse2D(ctx, wf, qBar[0], qBar[1], PBar, 'rgba(255,208,0,0.42)', 0.05, true);
        drawEllipse2D(ctx, wf, qPost[0], qPost[1], PFin, '#34d399', 0.24, false);
        drawRobot2D(ctx, wf, qPost, '#34d399', true);
      },

      renderPanel: function (t, lang, api) {
        var it = lang === 'it';
        var AX3 = ['x', 'y', 'θ'];
        if (t < 9.0) {
          api.renderFormula(it ? 'Stato Iniziale SE(2)' : 'Initial SE(2) State', [
            { tex: 'q_0 = \\begin{bmatrix} 0.40 \\\\ 0.60 \\\\ 0.50 \\end{bmatrix}, \\qquad \\text{Tag } \\#23 = \\begin{bmatrix} 1.45 \\\\ 1.25 \\end{bmatrix}' }
          ]);
          api.setDataHTML(C.renderMatrixHTML({
            id: 'P0', title: it ? 'Covarianza iniziale P0 (3×3)' : 'Initial Covariance P0 (3×3)', plainTitle: 'P0',
            corner: 'P0', rowLabels: AX3, colLabels: AX3, matrix: P0, decimals: 3, tint: 'gold', absScale: true
          }));
          return;
        }

        if (t < 18.0) {
          api.renderFormula(it ? 'Modello Uniciclo Non Lineare' : 'Non-Linear Unicycle Model', [
            { tex: '\\bar{q}_t = f(q_0, u) = \\begin{bmatrix} 0.40 + 0.28\\cos(0.50) \\\\ 0.60 + 0.28\\sin(0.50) \\\\ 0.50 + 0.20 \\end{bmatrix} = {\\color{#60a5fa}\\begin{bmatrix} ' + qBar[0].toFixed(2) + ' \\\\ ' + qBar[1].toFixed(2) + ' \\\\ ' + qBar[2].toFixed(2) + ' \\end{bmatrix}}', anchor: 'ekf-eq-f' }
          ], null, 'cyan');
          api.setDataHTML(C.renderMatrixHTML({
            id: 'P0s1', title: it ? 'Matrice di processo Q (dX, dT)' : 'Process Noise Q (dX, dT)', plainTitle: 'Q',
            corner: 'Q', rowLabels: ['dX', 'dT'], colLabels: ['dX', 'dT'], matrix: Q, decimals: 3, tint: 'cyan', absScale: true
          }));
          return;
        }

        if (t < 29.0) {
          var p2 = C.easeInOutCubic(C.invLerp(19.0, 27.0, t));
          api.renderFormula(it ? 'Jacobiano del Moto & Covarianza' : 'Motion Jacobian & Covariance', [
            { tex: '\\bar{P}_t = F_t P_0 F_t^\\top + W_t Q W_t^\\top', anchor: 'ekf-eq-pbar' },
            { tex: 'F_{1,3} = -dX\\sin(0.50) = {\\color{#ffd000}' + F[0][2].toFixed(3) + '}, \\quad F_{2,3} = +dX\\cos(0.50) = {\\color{#ffd000}+' + F[1][2].toFixed(3) + '}' }
          ]);
          api.setDataHTML(C.renderMatrixHTML({
            id: 'Ft', title: p2 < 0.45 ? 'Jacobian F_t = ∂f/∂q (3×3)' : (it ? 'Covarianza predetta P_prior (3×3)' : 'Predicted Covariance P_prior (3×3)'),
            plainTitle: p2 < 0.45 ? 'F_t' : 'P_prior',
            corner: p2 < 0.45 ? 'F' : 'P', rowLabels: AX3, colLabels: AX3,
            matrix: p2 < 0.45 ? F : interpMat3(P0, PBar, p2),
            decimals: 3, tint: 'gold', hiCol: p2 < 0.45 ? 2 : -1, signedVals: true, absScale: true
          }));
          return;
        }

        if (t < 40.0) {
          api.renderFormula(it ? 'Misura Polare h(q_pred) & Jacobiano H_t' : 'Polar Model h(q_pred) & Jacobian H_t', [
            { tex: 'h(\\bar{q}) = \\begin{bmatrix} \\hat{r} \\\\ \\hat{\\phi} \\end{bmatrix} = \\begin{bmatrix} ' + rHat.toFixed(2) + '\\text{ m} \\\\ ' + C.signed(phiHat, 2) + '\\text{ rad} \\end{bmatrix}', anchor: 'ekf-eq-h' }
          ], null, 'coral');
          api.setDataHTML(C.renderMatrixHTML({
            id: 'Ht', title: 'Measurement Jacobian H_t = ∂h/∂q (2×3)', plainTitle: 'H_t',
            corner: 'H', rowLabels: ['r', 'φ'], colLabels: AX3,
            matrix: H, decimals: 2, tint: 'coral', activeCell: { r: 1, c: 2 }, signedVals: true, absScale: true
          }));
          return;
        }

        if (t < 50.0) {
          api.renderFormula(it ? 'Innovazione Wrapped & Guadagno K_t' : 'Wrapped Innovation & Gain K_t', [
            { tex: 'y_t = \\operatorname{wrap}(z_t - h(\\bar{q})) = \\begin{bmatrix} ' + C.signed(innov[0], 2) + '\\text{ m} \\\\ ' + C.signed(innov[1], 2) + '\\text{ rad} \\end{bmatrix}', anchor: 'ekf-eq-k' },
            { tex: 'K_t = \\bar{P}_t H_t^\\top (H_t \\bar{P}_t H_t^\\top + R)^{-1} \\in \\mathbb{R}^{3\\times 2}' }
          ]);
          api.setDataHTML(C.renderMatrixHTML({
            id: 'Kt', title: 'Kalman Gain K_t (3×2)', plainTitle: 'K_t',
            subtitle: 'polar (Δr, Δφ) → pose (δx, δy, δθ)',
            corner: 'K', rowLabels: ['δx', 'δy', 'δθ'], colLabels: ['Δr', 'Δφ'],
            matrix: K, decimals: 3, tint: 'gold', signedVals: true, absScale: true
          }));
          return;
        }

        var p5 = C.easeOutCubic(C.invLerp(50.5, 57.5, t));
        var PFin = interpMat3(PBar, PPost, p5);
        api.renderFormula(it ? 'Update Posa & Simmetrizzazione' : 'Pose Update & Symmetrization', [
          { tex: 'q_t = \\bar{q}_t + K_t y_t = {\\color{#34d399}\\begin{bmatrix} ' + qPost[0].toFixed(2) + ' \\\\ ' + qPost[1].toFixed(2) + ' \\\\ ' + qPost[2].toFixed(2) + ' \\end{bmatrix}}' },
          { tex: 'P_t = \\tfrac{1}{2}(P_{\\text{new}} + P_{\\text{new}}^\\top)' }
        ], null, 'emerald');
        api.setDataHTML(C.renderMatrixHTML({
          id: 'Ppost', title: it ? 'Covarianza posteriore P_t (3×3)' : 'Posterior Covariance P_t (3×3)', plainTitle: 'P_t',
          subtitle: 'symmetrized', corner: 'P', rowLabels: AX3, colLabels: AX3,
          matrix: PFin, decimals: 3, tint: 'emerald', signedVals: true, absScale: true
        }));
      },

      renderBeams: function (t, lang, api) {
        var out = '';
        if (t >= 11.0 && t <= 14.5) {
          out += C.buildFlightSVG(api.getAnchor('ekf-bot'), api.getAnchor('ekf-eq-f'), C.invLerp(11.0, 13.8, t), 'dX=0.28', '#60a5fa', -34);
        }
        if (t >= 21.0 && t <= 25.0) {
          out += C.buildLaserBeamSVG(api.getAnchor('ekf-eq-pbar'), api.getAnchor('ekf-ellipse'), C.invLerp(21.0, 23.8, t), '#ffd000', -20);
        }
        if (t >= 31.0 && t <= 35.0) {
          out += C.buildFlightSVG(api.getAnchor('ekf-tag'), api.getAnchor('ekf-eq-h'), C.invLerp(31.0, 34.0, t), 'r, φ', '#e07a5f', -34);
        }
        if (t >= 41.0 && t <= 45.0) {
          out += C.buildFlightSVG(api.getAnchor('ekf-tag'), api.getAnchor('ekf-eq-k'), C.invLerp(41.0, 44.0, t), 'z_t', '#ffd000', -28);
        }
        return out;
      },

      formatTooltip: function (info) {
        return '<div style="font-size:10px;color:#94a3b8;">' + info.id + ' [' + (info.r + 1) + ',' + (info.c + 1) + ']</div>' +
          '<div style="font-weight:700;color:#ffd000;">' + info.val + '</div>';
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
