(function () {
  'use strict';

  var LS = window.LocSims;
  if (!LS) return;
  var M = LS.math;
  var D = LS.draw;

  function initEKF() {
    var root = document.getElementById('lab-ekf');
    if (!root) return;

    var btnBlind = root.querySelector('[data-sim-ekf-blind]');
    var btnClear = root.querySelector('[data-sim-ekf-clear]');

    var WORLD_W = 10.0;
    var WORLD_H = 6.0;
    var FOV_HALF = 1.05; // ~60 deg half-angle camera FOV
    var FOV_RANGE = 4.6;
    var SUBSTEPS = 10;

    var APRILTAGS = [
      { id: 11, x: 1.8, y: 1.2 },
      { id: 24, x: 8.2, y: 1.2 },
      { id: 37, x: 5.0, y: 3.0 },
      { id: 42, x: 1.8, y: 4.8 },
      { id: 58, x: 8.2, y: 4.8 }
    ];

    function figure8VelocityCmd(s) {
      // Parametric figure-8 derivative gives exact smooth forward v and turn rate omega
      var dtSample = 0.005;
      function pos(p) {
        return {
          x: 5.0 + 3.45 * Math.sin(p),
          y: 3.0 + 1.85 * Math.sin(2 * p)
        };
      }
      var p0 = pos(s - dtSample);
      var p1 = pos(s);
      var p2 = pos(s + dtSample);
      var vx1 = (p1.x - p0.x) / dtSample;
      var vy1 = (p1.y - p0.y) / dtSample;
      var vx2 = (p2.x - p1.x) / dtSample;
      var vy2 = (p2.y - p1.y) / dtSample;
      var th1 = Math.atan2(vy1, vx1);
      var th2 = Math.atan2(vy2, vx2);
      var v = Math.hypot((vx1 + vx2) * 0.5, (vy1 + vy2) * 0.5);
      var w = M.wrapAngle(th2 - th1) / dtSample;
      return { v: v, w: w };
    }

    function propagateEKFStep(q, P, v, w, dt) {
      var th = q[2];
      var nextQ = [
        q[0] + v * Math.cos(th) * dt,
        q[1] + v * Math.sin(th) * dt,
        M.wrapAngle(q[2] + w * dt)
      ];
      var F = [
        [1, 0, -v * Math.sin(th) * dt],
        [0, 1, v * Math.cos(th) * dt],
        [0, 0, 1]
      ];
      var qv = 0.16 * 0.16;
      var qw = 0.22 * 0.22;
      var ct = Math.cos(th) * dt;
      var st = Math.sin(th) * dt;
      var Qproj = [
        [ct * ct * qv + 0.004 * dt, ct * st * qv, 0],
        [st * ct * qv, st * st * qv + 0.004 * dt, 0],
        [0, 0, dt * dt * qw]
      ];
      var nextP = M.mat3Add(M.mat3Mul(M.mat3Mul(F, P), M.mat3T(F)), Qproj);
      nextP[0][1] = nextP[1][0] = 0.5 * (nextP[0][1] + nextP[1][0]);
      nextP[0][2] = nextP[2][0] = 0.5 * (nextP[0][2] + nextP[2][0]);
      nextP[1][2] = nextP[2][1] = 0.5 * (nextP[1][2] + nextP[2][1]);
      return { q: nextQ, P: nextP };
    }

    function findBestTag(trueQ) {
      var best = null;
      var bestDist = Infinity;
      for (var i = 0; i < APRILTAGS.length; i++) {
        var t = APRILTAGS[i];
        var dx = t.x - trueQ[0];
        var dy = t.y - trueQ[1];
        var r = Math.hypot(dx, dy);
        if (r > FOV_RANGE || r < 0.25) continue;
        var phi = M.wrapAngle(Math.atan2(dy, dx) - trueQ[2]);
        if (Math.abs(phi) <= FOV_HALF && r < bestDist) {
          bestDist = r;
          best = { tag: t, trueR: r, truePhi: phi };
        }
      }
      return best;
    }

    function resetUser(u) {
      if (u.cameraBlind === undefined) u.cameraBlind = false;
      u.s = 0.12;
      var startX = 5.0 + 3.45 * Math.sin(u.s);
      var startY = 3.0 + 1.85 * Math.sin(2 * u.s);
      var cmd0 = figure8VelocityCmd(u.s);
      var startTh = Math.atan2(3.7 * Math.cos(2 * u.s), 3.45 * Math.cos(u.s));

      u.qTrue = [startX, startY, startTh];
      u.qDr = [startX, startY, startTh];
      u.qEst = [startX, startY, startTh];
      u.P = [
        [0.035, 0, 0],
        [0, 0.035, 0],
        [0, 0, 0.03]
      ];
      u.qPred = u.qEst.slice();
      u.Ppred = M.mat3Add(u.P, [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
      ]);
      u.qPost = u.qEst.slice();
      u.Ppost = u.Ppred;

      u.subframes = [];
      u.trueTrail = [[startX, startY]];
      u.ekfTrail = [[startX, startY]];
      u.drTrail = [[startX, startY]];
      u.obs = null;
      u.innov = [0, 0];
      u.lastCmd = cmd0;
      u.driftBias = 0.045;
      u.hasUpdatedThisCycle = false;
    }

    function syncExtraBtns(lang, u) {
      if (btnBlind) {
        btnBlind.textContent =
          lang === 'it'
            ? u.cameraBlind
              ? 'Camera AprilTag: CIECO'
              : 'Camera AprilTag: ATTIVA'
            : u.cameraBlind
              ? 'AprilTag Camera: BLIND'
              : 'AprilTag Camera: ACTIVE';
        btnBlind.classList.toggle('active-toggle', !!u.cameraBlind);
      }
      if (btnClear) {
        btnClear.textContent = lang === 'it' ? 'Pulisci Scie' : 'Clear Trails';
      }
    }

    var lab = LS.createLab('lab-ekf', {
      phaseDurations: [1.3, 2.7, 2.4, 2.8],
      phaseLabels: {
        en: ['01 State q,P', '02 Non-Lin Predict', '03 Tag Polar h(q)', '04 EKF Update'],
        it: ['01 Stato q,P', '02 Predizione NL', '03 Tag Polare h(q)', '04 Update EKF']
      },
      phases: {
        en: [
          {
            title: function (u, st) {
              return 'Cycle ' + st.cycle + ' — \\(\\mathrm{SE}(2)\\) Unicycle State \\(q=[x,y,\\theta]^\\top\\)';
            },
            desc:
              'State tracks 3 DOF \\([x, y, \\theta]\\) with a \\(3\\times 3\\) covariance \\(P\\). Note how the \\(3\\sigma\\) ellipse captures rotated uncertainty correlated across position and heading.',
            eq: function (u) {
              return (
                '\\begin{aligned}q &= \\begin{bmatrix}' +
                u.qEst[0].toFixed(2) +
                ' & ' +
                u.qEst[1].toFixed(2) +
                ' & ' +
                Math.round((u.qEst[2] * 180) / Math.PI) +
                '^\\circ\\end{bmatrix}^\\top\\\\ \\operatorname{tr}(P) &= ' +
                (u.P[0][0] + u.P[1][1] + u.P[2][2]).toFixed(3) +
                '\\end{aligned}'
              );
            },
            eqExplain: [
              { sym: 'q = [x, y, \\theta]^\\top', label: 'SE(2) Pose Vector', desc: 'Robot 2D coordinates \\((x, y)\\) and heading angle \\(\\theta\\).' },
              { sym: '\\operatorname{tr}(P)', label: 'Covariance Trace', desc: 'Sum of diagonal variances in the \\(3\\times 3\\) matrix \\(P\\), measuring total uncertainty.' }
            ]
          },
          {
            title: 'Predict — Non-Linear Arc & \\(F_k, W_k\\) Propagation',
            desc:
              'Mean follows exact trig kinematics \\(f(q, u)\\) along the figure-8 curve. First-order Jacobians \\(F\\) and \\(W\\) stretch and rotate the ellipse along the velocity tangent.',
            eq: function (u) {
              return (
                '\\begin{aligned}\\bar{q} &= f\\!\\left(q,\\, [v=' +
                u.lastCmd.v.toFixed(1) +
                ',\\; \\omega=' +
                u.lastCmd.w.toFixed(1) +
                ']^\\top\\right)\\\\ \\bar{P} &= F P F^\\top + W Q W^\\top\\end{aligned}'
              );
            },
            eqExplain: [
              { sym: 'f(q, u)', label: 'Non-Linear Unicycle Model', desc: 'Integrates forward speed \\(v\\) along \\((\\cos\\theta, \\sin\\theta)\\) and turn rate \\(\\omega\\).' },
              { sym: 'F', label: 'State Jacobian (\\(\\partial f / \\partial q\\))', desc: 'Linear tangent map that rotates and stretches the \\(3\\sigma\\) ellipse along the curve.' },
              { sym: 'W Q W^\\top', label: 'Projected Control Noise', desc: 'Maps wheel-speed uncertainty \\(Q\\) into \\((x, y, \\theta)\\) covariance.' }
            ]
          },
          {
            title: 'Observe — Polar AprilTag Ray \\((r, \\phi)\\) & Wrap Seam',
            desc:
              'Camera detects a known AprilTag inside its FOV cone, measuring range \\(r\\) and bearing \\(\\phi = \\operatorname{atan2}(\\Delta y,\\Delta x) - \\theta\\). Angle wrapping prevents \\(\\pm 180^\\circ\\) spikes.',
            eq: function (u) {
              if (!u.obs) {
                return u.cameraBlind
                  ? '\\text{Camera Disabled — Open-Loop Drift Active}'
                  : '\\text{No AprilTag in FOV — Holding } \\bar{P}';
              }
              return (
                '\\begin{aligned}\\text{Tag \\#' +
                u.obs.tag.id +
                '}:\\; z &= \\begin{bmatrix}' +
                u.obs.measR.toFixed(2) +
                '\\text{ m} & ' +
                Math.round((u.obs.measPhi * 180) / Math.PI) +
                '^\\circ\\end{bmatrix}^\\top\\\\ y &= \\operatorname{wrap}(z - h(\\bar{q})) = \\begin{bmatrix}' +
                u.innov[0].toFixed(2) +
                ' & ' +
                Math.round((u.innov[1] * 180) / Math.PI) +
                '^\\circ\\end{bmatrix}^\\top\\end{aligned}'
              );
            },
            eqExplain: [
              { sym: 'z = [r, \\phi]^\\top', label: 'Polar AprilTag Reading', desc: 'Measured distance \\(r\\) and relative angle \\(\\phi\\) from the camera to the detected tag.' },
              { sym: 'h(\\bar{q})', label: 'Expected Observation', desc: 'Polar range and bearing predicted from current state estimate \\(\\bar{q}\\).' },
              { sym: '\\operatorname{wrap}(\\cdot)', label: 'Shortest-Arc Angle Wrap', desc: 'Keeps angular innovation inside \\([-\\pi, \\pi]\\) so crossing \\(\\pm 180^\\circ\\) never explodes.' }
            ]
          },
          {
            title: 'Update — Breathing Ellipse Contraction & Drift Lock',
            desc:
              'The Measurement Jacobian \\(H\\in\\mathbb{R}^{2\\times 3}\\) maps innovation back to \\([x,y,\\theta]\\). Pure open-loop odometry (dashed slate) diverges while EKF snaps \\(P\\) inward.',
            eq: function (u) {
              return u.hasUpdatedThisCycle
                ? '\\begin{aligned}K &= \\bar{P} H^\\top (H\\bar{P}H^\\top + R)^{-1}\\\\ P &= \\tfrac{1}{2}(P + P^\\top), \\quad \\operatorname{tr}(P) = ' +
                    (u.Ppost[0][0] + u.Ppost[1][1] + u.Ppost[2][2]).toFixed(3) +
                    '\\end{aligned}'
                : '\\text{Update Skipped — Open-Loop } P \\text{ Expands}';
            },
            eqExplain: [
              { sym: 'H', label: 'Measurement Jacobian', desc: 'Linearizes polar \\((r, \\phi)\\) sensor geometry around \\(\\bar{q}\\) to project corrections back to \\((x,y,\\theta)\\).' },
              { sym: 'K', label: 'EKF Kalman Gain', desc: 'Balances predicted covariance \\(\\bar{P}\\) against tag sensor noise \\(R\\).' },
              { sym: '\\tfrac{1}{2}(P + P^\\top)', label: 'Symmetry Enforcement', desc: 'Guards against floating-point rounding drift so \\(P\\) stays positive-definite.' }
            ]
          }
        ],
        it: [
          {
            title: function (u, st) {
              return 'Ciclo ' + st.cycle + ' — Stato \\(\\mathrm{SE}(2)\\) \\(q=[x,y,\\theta]^\\top\\)';
            },
            desc:
              'Lo stato traccia 3 GDL \\([x, y, \\theta]\\) con covarianza \\(3\\times 3\\) \\(P\\). L’ellisse \\(3\\sigma\\) cattura l’incertezza ruotata e correlata fra posizione e orientamento.',
            eq: function (u) {
              return (
                '\\begin{aligned}q &= \\begin{bmatrix}' +
                u.qEst[0].toFixed(2) +
                ' & ' +
                u.qEst[1].toFixed(2) +
                ' & ' +
                Math.round((u.qEst[2] * 180) / Math.PI) +
                '^\\circ\\end{bmatrix}^\\top\\\\ \\operatorname{tr}(P) &= ' +
                (u.P[0][0] + u.P[1][1] + u.P[2][2]).toFixed(3) +
                '\\end{aligned}'
              );
            },
            eqExplain: [
              { sym: 'q = [x, y, \\theta]^\\top', label: 'Vettore di Posa SE(2)', desc: 'Coordinate 2D \\((x, y)\\) e angolo di orientamento \\(\\theta\\) del robot.' },
              { sym: '\\operatorname{tr}(P)', label: 'Traccia di Covarianza', desc: 'Somma delle varianze sulla diagonale di \\(P\\) (misura l’incertezza complessiva).' }
            ]
          },
          {
            title: 'Predizione — Arco Non Lineare & Jacobiani \\(F_k, W_k\\)',
            desc:
              'La media integra la cinematica trigonometrica esatta \\(f(q,u)\\). Gli Jacobiani \\(F\\) e \\(W\\) ruotano ed espandono l’ellisse lungo la tangente al moto.',
            eq: function (u) {
              return (
                '\\begin{aligned}\\bar{q} &= f\\!\\left(q,\\, [v=' +
                u.lastCmd.v.toFixed(1) +
                ',\\; \\omega=' +
                u.lastCmd.w.toFixed(1) +
                ']^\\top\\right)\\\\ \\bar{P} &= F P F^\\top + W Q W^\\top\\end{aligned}'
              );
            },
            eqExplain: [
              { sym: 'f(q, u)', label: 'Modello Uniciclo Non Lineare', desc: 'Integra la velocità \\(v\\) lungo \\((\\cos\\theta, \\sin\\theta)\\) e la rotazione \\(\\omega\\).' },
              { sym: 'F', label: 'Jacobiano di Stato (\\(\\partial f / \\partial q\\))', desc: 'Mappa tangente che ruota e dilata l’ellisse \\(3\\sigma\\) lungo la curva.' },
              { sym: 'W Q W^\\top', label: 'Rumore di Controllo Proiettato', desc: 'Trasforma l’incertezza delle ruote \\(Q\\) in covarianza su \\((x, y, \\theta)\\).' }
            ]
          },
          {
            title: 'Osservazione — Raggio Polare AprilTag \\((r, \\phi)\\) & Wrap',
            desc:
              'La camera rileva un AprilTag nel cono visivo misurando distanza \\(r\\) e bearing \\(\\phi = \\operatorname{atan2}(\\Delta y,\\Delta x) - \\theta\\). Il wrapping evita salti a \\(\\pm 180^\\circ\\).',
            eq: function (u) {
              if (!u.obs) {
                return u.cameraBlind
                  ? '\\text{Camera Disattivata — Deriva Open-Loop}'
                  : '\\text{Nessun AprilTag nel Cono — Mantengo } \\bar{P}';
              }
              return (
                '\\begin{aligned}\\text{Tag \\#' +
                u.obs.tag.id +
                '}:\\; z &= \\begin{bmatrix}' +
                u.obs.measR.toFixed(2) +
                '\\text{ m} & ' +
                Math.round((u.obs.measPhi * 180) / Math.PI) +
                '^\\circ\\end{bmatrix}^\\top\\\\ y &= \\operatorname{wrap}(z - h(\\bar{q})) = \\begin{bmatrix}' +
                u.innov[0].toFixed(2) +
                ' & ' +
                Math.round((u.innov[1] * 180) / Math.PI) +
                '^\\circ\\end{bmatrix}^\\top\\end{aligned}'
              );
            },
            eqExplain: [
              { sym: 'z = [r, \\phi]^\\top', label: 'Misura Polare AprilTag', desc: 'Distanza \\(r\\) e angolo relativo \\(\\phi\\) misurati dalla camera rispetto al tag.' },
              { sym: 'h(\\bar{q})', label: 'Osservazione Attesa', desc: 'Distanza e angolo previsti a partire dalla stima corrente \\(\\bar{q}\\).' },
              { sym: '\\operatorname{wrap}(\\cdot)', label: 'Normalizzazione Angolare', desc: 'Mantiene l’innovazione in \\([-\\pi, \\pi]\\) evitando salti violenti attorno a \\(\\pm 180^\\circ\\).' }
            ]
          },
          {
            title: 'Update — Contrazione Ellisse & Riallineamento',
            desc:
              'Lo Jacobiano \\(H\\in\\mathbb{R}^{2\\times 3}\\) proietta l’innovazione su \\([x,y,\\theta]\\). L’odometria pura (tratteggio grigio) deriva, mentre l’EKF contrae \\(P\\) a ogni Tag.',
            eq: function (u) {
              return u.hasUpdatedThisCycle
                ? '\\begin{aligned}K &= \\bar{P} H^\\top (H\\bar{P}H^\\top + R)^{-1}\\\\ P &= \\tfrac{1}{2}(P + P^\\top), \\quad \\operatorname{tr}(P) = ' +
                    (u.Ppost[0][0] + u.Ppost[1][1] + u.Ppost[2][2]).toFixed(3) +
                    '\\end{aligned}'
                : '\\text{Update Saltato — Incertezza } P \\text{ in Espansione}';
            },
            eqExplain: [
              { sym: 'H', label: 'Jacobiano di Misura', desc: 'Linearizza la geometria polare \\((r, \\phi)\\) intorno a \\(\\bar{q}\\) per aggiornare \\((x,y,\\theta)\\).' },
              { sym: 'K', label: 'Guadagno EKF', desc: 'Bilancia la covarianza predetta \\(\\bar{P}\\) e il rumore visivo \\(R\\) del tag.' },
              { sym: '\\tfrac{1}{2}(P + P^\\top)', label: 'Simmetrizzazione', desc: 'Elimina gli errori di arrotondamento mantenendo \\(P\\) simmetrica e definita positiva.' }
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
          if (u.subframes.length > 0) {
            u.qEst = u.qPost.slice();
            u.P = u.Ppost;
            u.ekfTrail.push([u.qEst[0], u.qEst[1]]);
            u.trueTrail.push([u.qTrue[0], u.qTrue[1]]);
            u.drTrail.push([u.qDr[0], u.qDr[1]]);
            if (u.ekfTrail.length > 140) u.ekfTrail.shift();
            if (u.trueTrail.length > 140) u.trueTrail.shift();
            if (u.drTrail.length > 140) u.drTrail.shift();
          }
          u.qPred = u.qEst.slice();
          u.Ppred = u.P;
          u.qPost = u.qEst.slice();
          u.Ppost = u.P;
        } else if (phase === 1) {
          u.subframes = [];
          var dsTotal = 0.42;
          var dtStep = dsTotal / SUBSTEPS;
          var qT = u.qTrue.slice();
          var qD = u.qDr.slice();
          var qE = u.qEst.slice();
          var curP = u.P;

          u.subframes.push({
            qTrue: qT.slice(),
            qDr: qD.slice(),
            qEst: qE.slice(),
            P: curP
          });

          for (var i = 0; i < SUBSTEPS; i++) {
            var subS = u.s + (dsTotal * (i + 0.5)) / SUBSTEPS;
            var nextS = u.s + (dsTotal * (i + 1)) / SUBSTEPS;
            var cmd = figure8VelocityCmd(subS);
            u.lastCmd = cmd;

            // True robot kinematics smoothly tracking the figure-8 loop with minor disturbance
            var refX = 5.0 + 3.45 * Math.sin(nextS);
            var refY = 3.0 + 1.85 * Math.sin(2 * nextS);
            var trueW = cmd.w + M.randn() * 0.02;
            var trueV = cmd.v * (1 + M.randn() * 0.015);
            qT = [
              M.lerp(qT[0] + trueV * Math.cos(qT[2]) * dtStep, refX, 0.06),
              M.lerp(qT[1] + trueV * Math.sin(qT[2]) * dtStep, refY, 0.06),
              M.wrapAngle(qT[2] + trueW * dtStep)
            ];

            // Pure open-loop dead reckoning with uncompensated wheel-slip bias
            var drV = cmd.v * 1.055;
            var drW = cmd.w - 0.085;
            qD = [
              qD[0] + drV * Math.cos(qD[2]) * dtStep,
              qD[1] + drV * Math.sin(qD[2]) * dtStep,
              M.wrapAngle(qD[2] + drW * dtStep)
            ];

            // Nominal EKF prediction (slightly biased odometry corrected by AprilTags)
            var stepOut = propagateEKFStep(qE, curP, cmd.v * 1.025, cmd.w - 0.035, dtStep);
            qE = stepOut.q;
            curP = stepOut.P;

            u.subframes.push({
              qTrue: qT.slice(),
              qDr: qD.slice(),
              qEst: qE.slice(),
              P: curP
            });
          }

          u.s += dsTotal;
          u.qTrue = qT;
          u.qDr = qD;
          u.qPred = qE;
          u.Ppred = curP;
        } else if (phase === 2) {
          u.obs = null;
          u.hasUpdatedThisCycle = false;
          if (!u.cameraBlind) {
            var hit = findBestTag(u.qTrue);
            if (hit) {
              var sigR = 0.085;
              var sigPhi = 0.048;
              var measR = Math.max(0.2, hit.trueR + M.randn() * sigR);
              var measPhi = M.wrapAngle(hit.truePhi + M.randn() * sigPhi);
              u.obs = {
                tag: hit.tag,
                measR: measR,
                measPhi: measPhi,
                sigR: sigR,
                sigPhi: sigPhi
              };

              var dx = hit.tag.x - u.qPred[0];
              var dy = hit.tag.y - u.qPred[1];
              var predR = Math.max(0.15, Math.hypot(dx, dy));
              var predPhi = M.wrapAngle(Math.atan2(dy, dx) - u.qPred[2]);
              u.innov = [measR - predR, M.wrapAngle(measPhi - predPhi)];
            }
          }
        } else if (phase === 3) {
          if (!u.obs) {
            u.qPost = u.qPred.slice();
            u.Ppost = u.Ppred;
            u.hasUpdatedThisCycle = false;
            return;
          }
          u.hasUpdatedThisCycle = true;
          var dx = u.obs.tag.x - u.qPred[0];
          var dy = u.obs.tag.y - u.qPred[1];
          var r = Math.max(0.2, Math.hypot(dx, dy));
          var r2 = r * r;

          var H = [
            [-dx / r, -dy / r, 0],
            [dy / r2, -dx / r2, -1]
          ];
          var P = u.Ppred;

          // PHt (3x2)
          var PHt = [
            [
              P[0][0] * H[0][0] + P[0][1] * H[0][1] + P[0][2] * H[0][2],
              P[0][0] * H[1][0] + P[0][1] * H[1][1] + P[0][2] * H[1][2]
            ],
            [
              P[1][0] * H[0][0] + P[1][1] * H[0][1] + P[1][2] * H[0][2],
              P[1][0] * H[1][0] + P[1][1] * H[1][1] + P[1][2] * H[1][2]
            ],
            [
              P[2][0] * H[0][0] + P[2][1] * H[0][1] + P[2][2] * H[0][2],
              P[2][0] * H[1][0] + P[2][1] * H[1][1] + P[2][2] * H[1][2]
            ]
          ];

          var R = [
            [u.obs.sigR * u.obs.sigR, 0],
            [0, u.obs.sigPhi * u.obs.sigPhi]
          ];

          var S = [
            [
              H[0][0] * PHt[0][0] + H[0][1] * PHt[1][0] + H[0][2] * PHt[2][0] + R[0][0],
              H[0][0] * PHt[0][1] + H[0][1] * PHt[1][1] + H[0][2] * PHt[2][1]
            ],
            [
              H[1][0] * PHt[0][0] + H[1][1] * PHt[1][0] + H[1][2] * PHt[2][0],
              H[1][0] * PHt[0][1] + H[1][1] * PHt[1][1] + H[1][2] * PHt[2][1] + R[1][1]
            ]
          ];

          var Sinv = M.mat2Inv(S);
          var K = [
            [PHt[0][0] * Sinv[0][0] + PHt[0][1] * Sinv[1][0], PHt[0][0] * Sinv[0][1] + PHt[0][1] * Sinv[1][1]],
            [PHt[1][0] * Sinv[0][0] + PHt[1][1] * Sinv[1][0], PHt[1][0] * Sinv[0][1] + PHt[1][1] * Sinv[1][1]],
            [PHt[2][0] * Sinv[0][0] + PHt[2][1] * Sinv[1][0], PHt[2][0] * Sinv[0][1] + PHt[2][1] * Sinv[1][1]]
          ];

          u.qPost = [
            M.clamp(u.qPred[0] + K[0][0] * u.innov[0] + K[0][1] * u.innov[1], 0.3, WORLD_W - 0.3),
            M.clamp(u.qPred[1] + K[1][0] * u.innov[0] + K[1][1] * u.innov[1], 0.3, WORLD_H - 0.3),
            M.wrapAngle(u.qPred[2] + K[2][0] * u.innov[0] + K[2][1] * u.innov[1])
          ];

          var I_KH = [
            [1 - (K[0][0] * H[0][0] + K[0][1] * H[1][0]), -(K[0][0] * H[0][1] + K[0][1] * H[1][1]), -(K[0][0] * H[0][2] + K[0][1] * H[1][2])],
            [-(K[1][0] * H[0][0] + K[1][1] * H[1][0]), 1 - (K[1][0] * H[0][1] + K[1][1] * H[1][1]), -(K[1][0] * H[0][2] + K[1][1] * H[1][2])],
            [-(K[2][0] * H[0][0] + K[2][1] * H[1][0]), -(K[2][0] * H[0][1] + K[2][1] * H[1][1]), 1 - (K[2][0] * H[0][2] + K[2][1] * H[1][2])]
          ];

          var Pnew = M.mat3Mul(I_KH, P);
          // Symmetrize & enforce positive floor
          for (var a = 0; a < 3; a++) {
            for (var b = a; b < 3; b++) {
              var sym = 0.5 * (Pnew[a][b] + Pnew[b][a]);
              if (a === b) sym = Math.max(sym, 0.008);
              Pnew[a][b] = sym;
              Pnew[b][a] = sym;
            }
          }
          u.Ppost = Pnew;
        }
      },
      getTelemetry: function (lang, u, st) {
        var curEst = st.phase === 3 ? u.qPost : st.phase === 0 ? u.qEst : u.qPred;
        var curP = st.phase === 3 ? u.Ppost : st.phase === 0 ? u.P : u.Ppred;
        var errPos = Math.hypot(curEst[0] - u.qTrue[0], curEst[1] - u.qTrue[1]);
        var errDr = Math.hypot(u.qDr[0] - u.qTrue[0], u.qDr[1] - u.qTrue[1]);
        return [
          {
            label: lang === 'it' ? 'Errore EKF' : 'EKF Error',
            value: errPos.toFixed(2) + ' m',
            gold: true
          },
          {
            label: lang === 'it' ? 'Deriva Odometria' : 'Odo Drift',
            value: errDr.toFixed(2) + ' m'
          },
          {
            label: lang === 'it' ? 'Tag Attivo / σ_xy' : 'Active Tag / σ_xy',
            value: (u.obs ? '#' + u.obs.tag.id : '—') + ' / ' + Math.sqrt(curP[0][0] + curP[1][1]).toFixed(2) + 'm',
            gold: !!u.obs
          }
        ];
      },
      onRender: function (ctx, w, h, phase, progress, dt, lang, u) {
        D.obsidianBg(ctx, w, h);

        var pad = 20;
        var arenaW = w - pad * 2;
        var arenaH = h - pad * 2;

        function toPx(wx, wy) {
          return {
            x: pad + (wx / WORLD_W) * arenaW,
            y: pad + (wy / WORLD_H) * arenaH
          };
        }
        var scaleX = arenaW / WORLD_W;
        var scaleY = arenaH / WORLD_H;

        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.strokeRect(pad, pad, arenaW, arenaH);
        D.hairlineGrid(ctx, pad, pad, arenaW, arenaH, arenaW / 10, 0.035);
        ctx.restore();

        // Ideal dashed reference figure-8 curve
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        for (var i = 0; i <= 120; i++) {
          var sLoop = (i / 120) * Math.PI * 2;
          var pt = toPx(5.0 + 3.45 * Math.sin(sLoop), 3.0 + 1.85 * Math.sin(2 * sLoop));
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // Interpolate live robot state smoothly
        var e = M.easeInOutCubic(progress);
        var curTrue = u.qTrue;
        var curDr = u.qDr;
        var curEst = u.qEst;
        var curP = u.P;

        if (phase === 1 && u.subframes.length > 1) {
          var fIdx = e * (u.subframes.length - 1);
          var i0 = Math.floor(fIdx);
          var i1 = Math.min(i0 + 1, u.subframes.length - 1);
          var fr = fIdx - i0;
          var a = u.subframes[i0];
          var b = u.subframes[i1];
          curTrue = [
            M.lerp(a.qTrue[0], b.qTrue[0], fr),
            M.lerp(a.qTrue[1], b.qTrue[1], fr),
            a.qTrue[2] + M.wrapAngle(b.qTrue[2] - a.qTrue[2]) * fr
          ];
          curDr = [
            M.lerp(a.qDr[0], b.qDr[0], fr),
            M.lerp(a.qDr[1], b.qDr[1], fr),
            a.qDr[2] + M.wrapAngle(b.qDr[2] - a.qDr[2]) * fr
          ];
          curEst = [
            M.lerp(a.qEst[0], b.qEst[0], fr),
            M.lerp(a.qEst[1], b.qEst[1], fr),
            a.qEst[2] + M.wrapAngle(b.qEst[2] - a.qEst[2]) * fr
          ];
          curP = [
            [M.lerp(a.P[0][0], b.P[0][0], fr), M.lerp(a.P[0][1], b.P[0][1], fr), M.lerp(a.P[0][2], b.P[0][2], fr)],
            [M.lerp(a.P[1][0], b.P[1][0], fr), M.lerp(a.P[1][1], b.P[1][1], fr), M.lerp(a.P[1][2], b.P[1][2], fr)],
            [M.lerp(a.P[2][0], b.P[2][0], fr), M.lerp(a.P[2][1], b.P[2][1], fr), M.lerp(a.P[2][2], b.P[2][2], fr)]
          ];
        } else if (phase === 2) {
          curEst = u.qPred;
          curP = u.Ppred;
        } else if (phase === 3) {
          curEst = [
            M.lerp(u.qPred[0], u.qPost[0], e),
            M.lerp(u.qPred[1], u.qPost[1], e),
            u.qPred[2] + M.wrapAngle(u.qPost[2] - u.qPred[2]) * e
          ];
          curP = [
            [M.lerp(u.Ppred[0][0], u.Ppost[0][0], e), M.lerp(u.Ppred[0][1], u.Ppost[0][1], e), M.lerp(u.Ppred[0][2], u.Ppost[0][2], e)],
            [M.lerp(u.Ppred[1][0], u.Ppost[1][0], e), M.lerp(u.Ppred[1][1], u.Ppost[1][1], e), M.lerp(u.Ppred[1][2], u.Ppost[1][2], e)],
            [M.lerp(u.Ppred[2][0], u.Ppost[2][0], e), M.lerp(u.Ppred[2][1], u.Ppost[2][1], e), M.lerp(u.Ppred[2][2], u.Ppost[2][2], e)]
          ];
        }

        // Pure Odometry Trail & EKF Trail
        function drawTrail(pts, tailPt, color, dash) {
          if (pts.length < 1) return;
          ctx.save();
          ctx.strokeStyle = color;
          ctx.lineWidth = dash ? 1.3 : 1.7;
          if (dash) ctx.setLineDash([4, 4]);
          ctx.beginPath();
          var p0 = toPx(pts[0][0], pts[0][1]);
          ctx.moveTo(p0.x, p0.y);
          for (var i = 1; i < pts.length; i++) {
            var pi = toPx(pts[i][0], pts[i][1]);
            ctx.lineTo(pi.x, pi.y);
          }
          var ptTail = toPx(tailPt[0], tailPt[1]);
          ctx.lineTo(ptTail.x, ptTail.y);
          ctx.stroke();
          ctx.restore();
        }

        drawTrail(u.drTrail, curDr, 'rgba(148, 163, 184, 0.35)', true);
        drawTrail(u.trueTrail, curTrue, 'rgba(244, 244, 246, 0.25)', false);
        drawTrail(u.ekfTrail, curEst, 'rgba(255, 208, 0, 0.55)', false);

        // AprilTags Fiducial Landmarks
        for (var t = 0; t < APRILTAGS.length; t++) {
          var tag = APRILTAGS[t];
          var tp = toPx(tag.x, tag.y);
          var isLocked = u.obs && u.obs.tag.id === tag.id && phase >= 2;
          ctx.save();
          ctx.fillStyle = '#0d0d10';
          ctx.strokeStyle = isLocked ? '#e07a5f' : 'rgba(255,255,255,0.28)';
          ctx.lineWidth = isLocked ? 1.8 : 1;
          ctx.fillRect(tp.x - 8, tp.y - 8, 16, 16);
          ctx.strokeRect(tp.x - 8, tp.y - 8, 16, 16);
          // Fiduciary mini 2x2 inner bit check
          ctx.fillStyle = isLocked ? '#e07a5f' : 'rgba(255,255,255,0.45)';
          ctx.fillRect(tp.x - 4, tp.y - 4, 3.5, 3.5);
          ctx.fillRect(tp.x + 0.5, tp.y + 0.5, 3.5, 3.5);
          D.labelPill(ctx, '#' + tag.id, tp.x, tp.y + 16, 'center', isLocked ? '#e07a5f' : '#71717a');
          ctx.restore();
        }

        var estPx = toPx(curEst[0], curEst[1]);
        var truePx = toPx(curTrue[0], curTrue[1]);
        var drPx = toPx(curDr[0], curDr[1]);

        // Camera FOV Cone attached to robot
        ctx.save();
        ctx.translate(estPx.x, estPx.y);
        ctx.rotate(curEst[2]);
        var fovRpx = FOV_RANGE * ((scaleX + scaleY) * 0.5);
        var grad = ctx.createRadialGradient(0, 0, 8, 0, 0, fovRpx);
        grad.addColorStop(
          0,
          phase >= 2 && u.obs ? 'rgba(224, 122, 95, 0.22)' : 'rgba(255, 208, 0, 0.08)'
        );
        grad.addColorStop(1, 'rgba(255, 208, 0, 0.0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, fovRpx, -FOV_HALF, FOV_HALF);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Breathing 3-Sigma Covariance Ellipse P
        // Show previous predicted ellipse as ghost outline during Update (Phase 3)
        if (phase === 3 && u.hasUpdatedThisCycle) {
          var eigPred = M.covEllipse2x2(u.Ppred[0][0], u.Ppred[0][1], u.Ppred[1][1]);
          ctx.save();
          ctx.translate(toPx(u.qPred[0], u.qPred[1]).x, toPx(u.qPred[0], u.qPred[1]).y);
          ctx.rotate(eigPred.angle);
          ctx.strokeStyle = 'rgba(148, 163, 184, ' + (0.45 * (1 - e * 0.5)).toFixed(2) + ')';
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(0, 0, Math.max(8, eigPred.rx * 3 * scaleX), Math.max(8, eigPred.ry * 3 * scaleY), 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        var eig = M.covEllipse2x2(curP[0][0], curP[0][1], curP[1][1]);
        var ellColor = phase === 1 ? '#94a3b8' : '#ffd000';
        var ellFill = phase === 1 ? 'rgba(148, 163, 184, 0.12)' : 'rgba(255, 208, 0, 0.13)';
        ctx.save();
        ctx.translate(estPx.x, estPx.y);
        ctx.rotate(eig.angle);
        ctx.fillStyle = ellFill;
        ctx.strokeStyle = ellColor;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(0, 0, Math.max(8, eig.rx * 3 * scaleX), Math.max(8, eig.ry * 3 * scaleY), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Heading uncertainty wedge around estimated orientation
        var sigTheta = Math.sqrt(Math.max(0.001, curP[2][2]));
        ctx.save();
        ctx.translate(estPx.x, estPx.y);
        ctx.fillStyle = 'rgba(255, 208, 0, 0.14)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 32, curEst[2] - 2 * sigTheta, curEst[2] + 2 * sigTheta);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Polar (r, phi) Observation Vector Ray during Phase 2 & 3
        if (phase >= 2 && u.obs) {
          var tagPx = toPx(u.obs.tag.x, u.obs.tag.y);
          var op = phase === 2 ? M.easeOutCubic(progress) : 1 - e * 0.7;
          ctx.save();
          ctx.strokeStyle = 'rgba(224, 122, 95, ' + (0.85 * op).toFixed(2) + ')';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(estPx.x, estPx.y);
          ctx.lineTo(M.lerp(estPx.x, tagPx.x, phase === 2 ? op : 1), M.lerp(estPx.y, tagPx.y, phase === 2 ? op : 1));
          ctx.stroke();

          // Bearing arc between heading and tag ray
          var rayAngle = Math.atan2(tagPx.y - estPx.y, tagPx.x - estPx.x);
          ctx.strokeStyle = 'rgba(224, 122, 95, ' + (0.65 * op).toFixed(2) + ')';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          var dAng = M.wrapAngle(rayAngle - curEst[2]);
          ctx.arc(estPx.x, estPx.y, 26, curEst[2], curEst[2] + dAng, dAng < 0);
          ctx.stroke();
          D.labelPill(
            ctx,
            'r=' + u.obs.measR.toFixed(1) + 'm',
            (estPx.x + tagPx.x) / 2,
            (estPx.y + tagPx.y) / 2 - 10,
            'center',
            'rgba(224, 122, 95, ' + op.toFixed(2) + ')',
            '#0a0a0c'
          );
          ctx.restore();
        }

        // Open-loop DR ghost
        ctx.save();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(drPx.x, drPx.y, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Estimated Pose & True Pose Markers
        D.poseArrow(ctx, estPx.x, estPx.y, curEst[2], 7.5, '#ffd000', '#121215');
        D.poseArrow(ctx, truePx.x, truePx.y, curTrue[2], 7.5, '#f4f4f6', '#0a0a0c');

        // Minimalist Micro-Widget: wrap_angle Unit Circle Gauge (top-right corner)
        var gx = w - pad - 44;
        var gy = pad + 44;
        var gr = 24;
        ctx.save();
        ctx.fillStyle = 'rgba(18, 18, 21, 0.85)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(gx, gy, gr + 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // +/- 180 deg branch cut seam on left side (-pi)
        ctx.strokeStyle = 'rgba(224, 122, 95, 0.55)';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(gx - gr - 4, gy);
        ctx.lineTo(gx, gy);
        ctx.stroke();
        ctx.setLineDash([]);

        // Heading vector needle
        ctx.strokeStyle = '#ffd000';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + Math.cos(curEst[2]) * gr, gy + Math.sin(curEst[2]) * gr);
        ctx.stroke();
        D.labelPill(ctx, 'wrap(θ)', gx, gy + gr + 14, 'center', '#71717a');
        ctx.restore();

        // Bottom left subtle legend
        D.labelPill(
          ctx,
          lang === 'it' ? 'Bianco: Vero  |  Giallo: EKF  |  Grigio: Odo' : 'White: True  |  Gold: EKF  |  Slate: Odo',
          pad + 10,
          h - pad - 12,
          'left',
          '#71717a'
        );
      }
    });

    if (btnBlind) {
      btnBlind.addEventListener('click', function () {
        lab.state.user.cameraBlind = !lab.state.user.cameraBlind;
        syncExtraBtns(lab.getLang(), lab.state.user);
        lab.refresh();
      });
    }

    if (btnClear) {
      btnClear.addEventListener('click', function () {
        var u = lab.state.user;
        u.trueTrail = [[u.qTrue[0], u.qTrue[1]]];
        u.ekfTrail = [[u.qEst[0], u.qEst[1]]];
        u.drTrail = [[u.qDr[0], u.qDr[1]]];
        u.qDr = u.qTrue.slice();
        lab.refresh();
      });
    }

    syncExtraBtns(lab.getLang(), lab.state.user);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEKF);
  } else {
    initEKF();
  }
})();
