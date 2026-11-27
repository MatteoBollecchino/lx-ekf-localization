(function () {
  'use strict';

  var STORAGE_KEY = 'dt_loc_lang';

  function applyLanguage(lang) {
    var safeLang = lang === 'it' ? 'it' : 'en';
    document.body.setAttribute('data-lang', safeLang);
    document.documentElement.setAttribute('lang', safeLang);

    var buttons = document.querySelectorAll('.lang-switch button[data-set-lang]');
    buttons.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-set-lang') === safeLang);
    });

    try {
      localStorage.setItem(STORAGE_KEY, safeLang);
    } catch (e) {
      // ignore private mode storage restrictions
    }

    if (window.LocSims && typeof window.LocSims.setLang === 'function') {
      window.LocSims.setLang(safeLang);
    }
    updateMathDisplayHints(safeLang);
  }

  function updateMathDisplayHints(lang) {
    if (typeof document.querySelectorAll !== 'function') return;
    var hints = document.querySelectorAll('.math-display-hint-text');
    var txt =
      lang === 'it'
        ? 'Clicca o tocca una riga della formula per il significato di ogni elemento'
        : 'Click or tap any equation row to inspect every component';
    hints.forEach(function (el) {
      el.textContent = txt;
    });
    var simTxts = document.querySelectorAll('.eq-sim-btn-txt');
    var simLabel = lang === 'it' ? 'Simula la formula' : 'Simulate formula';
    simTxts.forEach(function (el) {
      el.textContent = simLabel;
    });
    var helpTxts = document.querySelectorAll('.math-hint-help-txt');
    var helpLabel = lang === 'it' ? 'Non ti è ancora chiaro? Guarda l\'animazione' : 'Still not clear? Watch edge animation';
    helpTxts.forEach(function (el) {
      el.textContent = helpLabel;
    });
  }

  function initLanguageSwitch() {
    var initial = 'en';
    try {
      var params = new URLSearchParams(window.location.search);
      var qLang = params.get('lang');
      if (qLang === 'it' || qLang === 'en') {
        initial = qLang;
      } else {
        var saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'it' || saved === 'en') initial = saved;
      }
    } catch (e) {
      initial = 'en';
    }

    applyLanguage(initial);

    var buttons = document.querySelectorAll('.lang-switch button[data-set-lang]');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyLanguage(btn.getAttribute('data-set-lang'));
      });
    });
  }

  function initScrollSpy() {
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc-list a'));
    var topLinks = Array.prototype.slice.call(document.querySelectorAll('.topbar-links a'));
    var targets = Array.prototype.slice.call(
      document.querySelectorAll('section.chapter[id], h3.subsec[id]')
    );
    var chapters = Array.prototype.slice.call(document.querySelectorAll('section.chapter[id]'));

    if (!targets.length) return;

    function setActiveId(activeTargetId, activeChapterId) {
      tocLinks.forEach(function (a) {
        var href = a.getAttribute('href') || '';
        a.classList.toggle('active', href === '#' + activeTargetId);
      });
      topLinks.forEach(function (a) {
        var href = a.getAttribute('href') || '';
        a.classList.toggle('active', href === '#' + activeChapterId);
      });
    }

    function computeCurrentSection() {
      var scrollMid = window.scrollY + 140;
      var currentTarget = targets[0].id;
      for (var i = 0; i < targets.length; i++) {
        if (targets[i].offsetTop <= scrollMid) {
          currentTarget = targets[i].id;
        }
      }
      var currentChap = chapters.length ? chapters[0].id : currentTarget;
      for (var c = 0; c < chapters.length; c++) {
        if (chapters[c].offsetTop <= scrollMid) {
          currentChap = chapters[c].id;
        }
      }
      setActiveId(currentTarget, currentChap);
    }

    var ticking = false;
    window.addEventListener(
      'scroll',
      function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          computeCurrentSection();
          ticking = false;
        });
      },
      { passive: true }
    );

    computeCurrentSection();
  }

  var katexRendered = false;

  function runKaTeX() {
    if (katexRendered) return;
    if (typeof window.renderMathInElement === 'function' && window.katex) {
      katexRendered = true;
      window.renderMathInElement(document.body, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false }
        ],
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
        throwOnError: false
      });
      if (window.LocSims && typeof window.LocSims.rerenderEquations === 'function') {
        window.LocSims.rerenderEquations();
      }
    }
  }

  window.initPageKaTeX = runKaTeX;

  var EQ_EXPLAINS = {
    'bayes-predict': {
      kicker: 'BAYES FILTER · PREDICT STEP',
      tex: '\\overline{\\operatorname{bel}}(x_t) = \\int p(x_t \\mid u_t, x_{t-1})\\,\\operatorname{bel}(x_{t-1})\\,dx_{t-1}',
      en: {
        title: 'Motion Prediction Integral',
        terms: [
          { sym: '\\overline{\\operatorname{bel}}(x_t)', label: 'Predicted Belief', desc: 'Probability distribution over state \\(x_t\\) after moving, before reading sensors.' },
          { sym: 'p(x_t \\mid u_t, x_{t-1})', label: 'Motion Transition Model', desc: 'Probability of landing at \\(x_t\\) when executing control \\(u_t\\) from \\(x_{t-1}\\).' },
          { sym: '\\operatorname{bel}(x_{t-1})', label: 'Prior Belief', desc: 'Estimated state distribution at the previous time step \\(t-1\\).' },
          { sym: '\\int \\cdots\\,dx_{t-1}', label: 'Total Probability Integral', desc: 'Sums contributions from every possible previous pose \\(x_{t-1}\\).' }
        ]
      },
      it: {
        title: 'Integrale di Predizione del Moto',
        terms: [
          { sym: '\\overline{\\operatorname{bel}}(x_t)', label: 'Credenza Predetta', desc: 'Distribuzione sullo stato \\(x_t\\) dopo il movimento ma prima della misura.' },
          { sym: 'p(x_t \\mid u_t, x_{t-1})', label: 'Modello di Transizione', desc: 'Probabilità di arrivare in \\(x_t\\) partendo da \\(x_{t-1}\\) con comando \\(u_t\\).' },
          { sym: '\\operatorname{bel}(x_{t-1})', label: 'Credenza Precedente', desc: 'Stima dello stato al passo precedente \\(t-1\\).' },
          { sym: '\\int \\cdots\\,dx_{t-1}', label: 'Integrale Totale', desc: 'Somma i contributi di tutte le possibili pose di partenza \\(x_{t-1}\\).' }
        ]
      }
    },
    'bayes-update': {
      kicker: 'BAYES FILTER · UPDATE STEP',
      tex: '\\operatorname{bel}(x_t) = \\eta\\,p(z_t \\mid x_t)\\,\\overline{\\operatorname{bel}}(x_t)',
      en: {
        title: 'Measurement Correction Rule',
        terms: [
          { sym: '\\operatorname{bel}(x_t)', label: 'Posterior Belief', desc: 'Final fused state probability after combining motion and sensor reading.' },
          { sym: '\\eta', label: 'Normalization Constant', desc: 'Scales the product so total probability across all states equals \\(1\\).' },
          { sym: 'p(z_t \\mid x_t)', label: 'Sensor Likelihood', desc: 'How likely measurement \\(z_t\\) would be if the robot were truly at \\(x_t\\).' },
          { sym: '\\overline{\\operatorname{bel}}(x_t)', label: 'Motion Prior', desc: 'Predicted belief carried forward from the Predict step.' }
        ]
      },
      it: {
        title: 'Regola di Correzione Bayesiana',
        terms: [
          { sym: '\\operatorname{bel}(x_t)', label: 'Credenza a Posteriori', desc: 'Distribuzione finale dopo aver fuso moto e osservazione.' },
          { sym: '\\eta', label: 'Costante di Normalizzazione', desc: 'Riscala il prodotto affinché la probabilità totale valga \\(1\\).' },
          { sym: 'p(z_t \\mid x_t)', label: 'Verosimiglianza Sensore', desc: 'Probabilità di osservare \\(z_t\\) se il robot fosse davvero in \\(x_t\\).' },
          { sym: '\\overline{\\operatorname{bel}}(x_t)', label: 'Prior Predetto', desc: 'Credenza prodotta dalla fase di predizione.' }
        ]
      }
    },
    'kf-dyn': {
      kicker: 'KALMAN FILTER · ASSUMPTION 1',
      tex: 'x_t = A x_{t-1} + B u_t + w_t, \\qquad w_t \\sim \\mathcal{N}(0, Q)',
      en: {
        title: 'Linear State Transition Model',
        terms: [
          { sym: 'x_t', label: 'Current State Vector', desc: 'True hidden state at time \\(t\\) (e.g. position and velocity).' },
          { sym: 'A', label: 'State Transition Matrix', desc: 'Linearly evolves the previous state \\(x_{t-1}\\) forward one step.' },
          { sym: 'B u_t', label: 'Control Input Term', desc: 'Maps actuator/odometry command \\(u_t\\) into state space via matrix \\(B\\).' },
          { sym: 'w_t \\sim \\mathcal{N}(0, Q)', label: 'Process Noise', desc: 'Zero-mean Gaussian disturbance with covariance \\(Q\\) (wheel slip, bumps).' }
        ]
      },
      it: {
        title: 'Dinamica Lineare dello Stato',
        terms: [
          { sym: 'x_t', label: 'Vettore di Stato Attuale', desc: 'Stato reale nascosto al tempo \\(t\\) (es. posizione e velocità).' },
          { sym: 'A', label: 'Matrice di Transizione', desc: 'Evolve linearmente lo stato precedente \\(x_{t-1}\\) al passo successivo.' },
          { sym: 'B u_t', label: 'Contributo di Controllo', desc: 'Proietta il comando \\(u_t\\) nello spazio di stato tramite \\(B\\).' },
          { sym: 'w_t \\sim \\mathcal{N}(0, Q)', label: 'Rumore di Processo', desc: 'Disturbo gaussiano a media nulla e covarianza \\(Q\\) (slittamenti, attriti).' }
        ]
      }
    },
    'kf-obs': {
      kicker: 'KALMAN FILTER · ASSUMPTION 2',
      tex: 'z_t = H x_t + n_t, \\qquad n_t \\sim \\mathcal{N}(0, R)',
      en: {
        title: 'Linear Observation Model',
        terms: [
          { sym: 'z_t', label: 'Sensor Measurement', desc: 'Vector of raw readings arriving from sensors at step \\(t\\).' },
          { sym: 'H', label: 'Observation Matrix', desc: 'Extracts or projects internal state \\(x_t\\) into sensor units.' },
          { sym: 'n_t \\sim \\mathcal{N}(0, R)', label: 'Measurement Noise', desc: 'Zero-mean Gaussian sensor error with covariance \\(R\\).' }
        ]
      },
      it: {
        title: 'Modello Lineare di Osservazione',
        terms: [
          { sym: 'z_t', label: 'Misura del Sensore', desc: 'Vettore delle letture raccolte dai sensori al passo \\(t\\).' },
          { sym: 'H', label: 'Matrice di Osservazione', desc: 'Proietta lo stato interno \\(x_t\\) nello spazio delle misure.' },
          { sym: 'n_t \\sim \\mathcal{N}(0, R)', label: 'Rumore di Misura', desc: 'Errore gaussiano del sensore a media nulla e covarianza \\(R\\).' }
        ]
      }
    },
    'kf-prior': {
      kicker: 'KALMAN FILTER · ASSUMPTION 3',
      tex: '\\operatorname{bel}(x_0) = \\mathcal{N}(\\mu_0, \\Sigma_0)',
      en: {
        title: 'Gaussian Initial Belief',
        terms: [
          { sym: '\\mu_0', label: 'Initial Mean', desc: 'Starting best guess of the robot state at \\(t=0\\).' },
          { sym: '\\Sigma_0', label: 'Initial Covariance', desc: 'Starting uncertainty: tiny if pose is known, huge if unknown.' }
        ]
      },
      it: {
        title: 'Credenza Iniziale Gaussiana',
        terms: [
          { sym: '\\mu_0', label: 'Media Iniziale', desc: 'Stima iniziale della posizione del robot a \\(t=0\\).' },
          { sym: '\\Sigma_0', label: 'Covarianza Iniziale', desc: 'Incertezza iniziale: piccola se nota, grande se la posa è ignota.' }
        ]
      }
    },
    'kf-p1': {
      kicker: 'KALMAN FILTER · PHASE 1',
      tex: '\\bar{\\mu}_t = A\\mu_{t-1} + B u_t, \\qquad \\bar{\\Sigma}_t = A \\Sigma_{t-1} A^{\\top} + Q',
      en: {
        title: 'Gaussian Prediction Equations',
        terms: [
          { sym: '\\bar{\\mu}_t', label: 'Predicted Mean', desc: 'Shifts previous estimate \\(\\mu_{t-1}\\) using dynamics \\(A\\) and control \\(Bu_t\\).' },
          { sym: 'A\\Sigma_{t-1}A^\\top', label: 'Propagated Uncertainty', desc: 'Transforms previous covariance through linear motion \\(A\\).' },
          { sym: 'Q', label: 'Added Process Noise', desc: 'Inflates covariance because moving without sensing always loses certainty.' }
        ]
      },
      it: {
        title: 'Equazioni di Predizione Gaussiana',
        terms: [
          { sym: '\\bar{\\mu}_t', label: 'Media Predetta', desc: 'Sposta la stima \\(\\mu_{t-1}\\) tramite la dinamica \\(A\\) e il comando \\(Bu_t\\).' },
          { sym: 'A\\Sigma_{t-1}A^\\top', label: 'Covarianza Propagata', desc: 'Proietta l’incertezza precedente attraverso la matrice di moto \\(A\\).' },
          { sym: 'Q', label: 'Rumore Aggiunto', desc: 'Allarga la varianza perché muoversi al buio riduce sempre la precisione.' }
        ]
      }
    },
    'kf-p2': {
      kicker: 'KALMAN FILTER · PHASE 2',
      tex: 'y_t = z_t - H\\bar{\\mu}_t, \\qquad S_t = H \\bar{\\Sigma}_t H^{\\top} + R',
      en: {
        title: 'Innovation & Innovation Covariance',
        terms: [
          { sym: 'y_t', label: 'Innovation (Residual)', desc: 'Discrepancy between actual sensor reading \\(z_t\\) and predicted reading \\(H\\bar{\\mu}_t\\).' },
          { sym: 'H\\bar{\\mu}_t', label: 'Expected Measurement', desc: 'What the sensor should see if the robot were exactly at \\(\\bar{\\mu}_t\\).' },
          { sym: 'S_t', label: 'Innovation Covariance', desc: 'Total uncertainty combining projected motion error (\\(H\\bar{\\Sigma}_t H^\\top\\)) and sensor noise (\\(R\\)).' }
        ]
      },
      it: {
        title: 'Innovazione e Covarianza Totale',
        terms: [
          { sym: 'y_t', label: 'Innovazione (Sorpresa)', desc: 'Differenza tra misura reale \\(z_t\\) e misura attesa \\(H\\bar{\\mu}_t\\).' },
          { sym: 'H\\bar{\\mu}_t', label: 'Misura Attesa', desc: 'Ciò che il sensore dovrebbe leggere se il robot fosse davvero in \\(\\bar{\\mu}_t\\).' },
          { sym: 'S_t', label: 'Covarianza dell’Innovazione', desc: 'Somma l’incertezza di moto proiettata (\\(H\\bar{\\Sigma}_t H^\\top\\)) e il rumore sensore (\\(R\\)).' }
        ]
      }
    },
    'kf-p3': {
      kicker: 'KALMAN FILTER · PHASE 3',
      tex: 'K_t = \\bar{\\Sigma}_t H^{\\top} S_t^{-1}',
      en: {
        title: 'Optimal Kalman Gain',
        terms: [
          { sym: 'K_t', label: 'Kalman Gain Matrix', desc: 'Optimal weight minimizing posterior MSE: decides how much to trust the sensor.' },
          { sym: '\\bar{\\Sigma}_t H^\\top', label: 'Cross-Covariance', desc: 'Links state uncertainty to measurement space.' },
          { sym: 'S_t^{-1}', label: 'Precision Scaling', desc: 'Divides by total innovation uncertainty; larger sensor noise \\(R\\) lowers \\(K_t\\).' }
        ]
      },
      it: {
        title: 'Guadagno Ottimo di Kalman',
        terms: [
          { sym: 'K_t', label: 'Matrice Guadagno', desc: 'Peso ottimo che minimizza l’errore quadratico: arbitra la fiducia verso il sensore.' },
          { sym: '\\bar{\\Sigma}_t H^\\top', label: 'Covarianza Incrociata', desc: 'Collega l’incertezza dello stato allo spazio delle misure.' },
          { sym: 'S_t^{-1}', label: 'Normalizzazione Precisione', desc: 'Inverso della varianza totale: più \\(R\\) è alto, più \\(K_t\\) si abbassa.' }
        ]
      }
    },
    'kf-p4': {
      kicker: 'KALMAN FILTER · PHASE 4',
      tex: '\\mu_t = \\bar{\\mu}_t + K_t y_t, \\qquad \\Sigma_t = (I - K_t H)\\bar{\\Sigma}_t',
      en: {
        title: 'Posterior State & Covariance Update',
        terms: [
          { sym: '\\mu_t', label: 'Updated Mean', desc: 'Shifts predicted mean \\(\\bar{\\mu}_t\\) along the surprise \\(y_t\\) weighted by \\(K_t\\).' },
          { sym: '\\Sigma_t', label: 'Contracted Covariance', desc: 'Shrinks uncertainty below both \\(\\bar{\\Sigma}_t\\) and \\(R\\) after fusing both sources.' },
          { sym: 'I - K_t H', label: 'Contraction Factor', desc: 'Fraction of prior uncertainty retained after absorbing the measurement.' }
        ]
      },
      it: {
        title: 'Aggiornamento Media e Covarianza',
        terms: [
          { sym: '\\mu_t', label: 'Media Aggiornata', desc: 'Corregge la predizione \\(\\bar{\\mu}_t\\) aggiungendo \\(K_t y_t\\).' },
          { sym: '\\Sigma_t', label: 'Covarianza Contratta', desc: 'Riduce l’incertezza sotto entrambe le fonti (modello e sensore).' },
          { sym: 'I - K_t H', label: 'Fattore di Contrazione', desc: 'Quota di incertezza residua dopo aver assimilato l’osservazione.' }
        ]
      }
    },
    'pf-weight': {
      kicker: 'PARTICLE FILTER · IMPORTANCE WEIGHTING',
      tex: 'w_t^{[i]} = \\eta\\,p(z_t \\mid x_t^{[i]}), \\qquad \\sum_{i=1}^M w_t^{[i]} = 1',
      en: {
        title: 'Particle Importance Weighting',
        terms: [
          { sym: 'w_t^{[i]}', label: 'Normalized Weight', desc: 'Probability mass assigned to particle \\(i\\) after observing \\(z_t\\).' },
          { sym: 'p(z_t \\mid x_t^{[i]})', label: 'Observation Likelihood', desc: 'Evaluates how well particle pose \\(x_t^{[i]}\\) matches sensor reading \\(z_t\\).' },
          { sym: '\\eta', label: 'Normalizer', desc: 'Divides by the sum of all weights so \\(\\sum w_t^{[i]} = 1\\).' }
        ]
      },
      it: {
        title: 'Pesatura delle Particelle',
        terms: [
          { sym: 'w_t^{[i]}', label: 'Peso Normalizzato', desc: 'Massa di probabilità associata alla particella \\(i\\) dopo la lettura \\(z_t\\).' },
          { sym: 'p(z_t \\mid x_t^{[i]})', label: 'Verosimiglianza', desc: 'Misura quanto la posa ipotetica \\(x_t^{[i]}\\) è compatibile con il sensore.' },
          { sym: '\\eta', label: 'Normalizzatore', desc: 'Divide per la somma di tutti i pesi garantendo \\(\\sum w_t^{[i]} = 1\\).' }
        ]
      }
    },
    'pf-comb': {
      kicker: 'PARTICLE FILTER · LOW-VARIANCE RESAMPLING',
      tex: 'U_i = r + \\frac{i - 1}{M}, \\quad r \\sim \\mathcal{U}\\!\\left(0, \\frac{1}{M}\\right), \\qquad N_{\\text{eff}} = \\frac{1}{\\sum_i (w_t^{[i]})^2}',
      en: {
        title: 'Low-Variance Comb & Effective Sample Size',
        terms: [
          { sym: 'U_i', label: 'Comb Pointer', desc: 'Equidistant steps around \\([0, 1]\\) selecting surviving particles in \\(\\mathcal{O}(M)\\) time.' },
          { sym: 'r', label: 'Single Random Offset', desc: 'One uniform draw in \\([0, 1/M)\\) preserves diversity and avoids duplicate bias.' },
          { sym: 'N_{\\text{eff}}', label: 'Effective Sample Size', desc: 'Drops near \\(1\\) when one particle dominates; signals when resampling is needed.' }
        ]
      },
      it: {
        title: 'Pettine a Bassa Varianza & Campioni Efficaci',
        terms: [
          { sym: 'U_i', label: 'Puntatore del Pettine', desc: 'Passi equidistanti su \\([0, 1]\\) che selezionano i sopravvissuti in tempo \\(\\mathcal{O}(M)\\).' },
          { sym: 'r', label: 'Offset Casuale Unico', desc: 'Un solo numero casuale in \\([0, 1/M)\\) riduce al minimo la varianza di campionamento.' },
          { sym: 'N_{\\text{eff}}', label: 'Campioni Efficaci', desc: 'Crolla verso \\(1\\) se una sola particella domina; indica quando fare resampling.' }
        ]
      }
    },
    'hf-dirac': {
      kicker: 'HISTOGRAM FILTER · DIRAC BELIEF',
      tex: '\\operatorname{bel}(x_t) = \\sum_{i=1}^N w_t^i\\,\\delta(x_t - x^i), \\qquad \\delta(x) = \\begin{cases} +\\infty & x = 0 \\\\ 0 & x \\neq 0 \\end{cases}, \\quad \\int_{-\\infty}^{+\\infty} \\delta(x)\\,dx = 1',
      en: {
        title: 'Dirac Delta Histogram Representation',
        terms: [
          { sym: 'w_t^i', label: 'Cell Weight', desc: 'Probability mass stored in grid cell \\(i\\) at time \\(t\\), initialized by <code>histogram_prior</code> (\\(\\sum w_t^i = 1\\)).' },
          { sym: '\\delta(x_t - x^i)', label: 'Dirac Delta Definition', desc: 'Equals \\(+\\infty\\) at \\(x_t = x^i\\) and \\(0\\) elsewhere, with \\(\\int \\delta(x)\\,dx = 1\\): turns discrete weights into a continuous PDF.' },
          { sym: 'x^i = (d^i, \\varphi^i)', label: 'Cell Centroid', desc: 'Center coordinates (lateral offset \\(d^i\\) and lane heading \\(\\varphi^i\\)) of bin \\(i\\).' }
        ]
      },
      it: {
        title: 'Rappresentazione a Delta di Dirac',
        terms: [
          { sym: 'w_t^i', label: 'Peso della Cella', desc: 'Massa di probabilità nella cella \\(i\\) al tempo \\(t\\), inizializzata con <code>histogram_prior</code> (\\(\\sum w_t^i = 1\\)).' },
          { sym: '\\delta(x_t - x^i)', label: 'Definizione Delta di Dirac', desc: 'Vale \\(+\\infty\\) in \\(x_t = x^i\\) e \\(0\\) altrove, con \\(\\int \\delta(x)\\,dx = 1\\): trasforma pesi discreti in una densità continua.' },
          { sym: 'x^i = (d^i, \\varphi^i)', label: 'Centroide della Cella', desc: 'Coordinate centrali (scostamento \\(d^i\\) e angolo \\(\\varphi^i\\)) del bin \\(i\\).' }
        ]
      }
    },
    'hf-predict': {
      kicker: 'HISTOGRAM FILTER · histogram_predict',
      tex: 'd_A = \\frac{d_L + d_R}{2},\\; w = \\frac{d_R - d_L}{L}, \\qquad d_t = d + d_A\\sin(\\hat{\\varphi}),\\; \\varphi_t = \\varphi + w, \\qquad \\overline{\\operatorname{bel}} = \\operatorname{shift}(\\operatorname{bel}) * G_{\\text{cov\\_mask}}',
      en: {
        title: 'Encoder Kinematic Shift & Gaussian Filter',
        terms: [
          { sym: 'd_A, w', label: 'Encoder Arc & Rotation', desc: 'Average wheel displacement \\((d_L+d_R)/2\\) and differential turn \\((d_R-d_L)/L\\).' },
          { sym: '\\hat{\\varphi}', label: 'Previous Peak Heading', desc: 'Read directly from the column header where the peak sat in the previous step (e.g. \\(\\hat{\\varphi}=0.00\\text{ rad}\\)).' },
          { sym: 'd_t, \\varphi_t', label: 'Shifted Cell Coordinates', desc: 'Each grid centroid moves laterally by \\(d_A\\sin(\\hat{\\varphi})\\) and rotates by \\(w\\).' },
          { sym: '* G_{\\text{cov\\_mask}}', label: '2D Gaussian Filter Blur', desc: 'Calls <code>gaussian_filter(p_belief, cov_mask)</code> to model wheel slip uncertainty.' }
        ]
      },
      it: {
        title: 'Traslazione da Encoder & Gaussian Filter',
        terms: [
          { sym: 'd_A, w', label: 'Avanzamento & Rotazione', desc: 'Media degli encoder \\((d_L+d_R)/2\\) e sterzata differenziale \\((d_R-d_L)/L\\).' },
          { sym: '\\hat{\\varphi}', label: 'Angolo Stima Precedente', desc: 'Si legge direttamente dall’intestazione della colonna dove si trovava il picco al passo precedente (es. \\(0.00\\text{ rad}\\)).' },
          { sym: 'd_t, \\varphi_t', label: 'Nuove Coordinate Celle', desc: 'Ogni centroide trasla lateralmente di \\(d_A\\sin(\\hat{\\varphi})\\) e ruota di \\(w\\).' },
          { sym: '* G_{\\text{cov\\_mask}}', label: 'Sfocatura Gaussian Filter', desc: 'Esegue <code>gaussian_filter(p_belief, cov_mask)</code> per modellare lo slittamento.' }
        ]
      }
    },
    'hf-vote': {
      kicker: 'HISTOGRAM FILTER · generate_vote',
      tex: '\\hat{t} = \\frac{p_2 - p_1}{\\|p_2 - p_1\\|},\\; \\hat{n} = \\begin{bmatrix} -t_y \\\\ t_x \\end{bmatrix}, \\quad \\varphi_i = \\arcsin(t_y), \\quad d_{\\text{seg}} = \\frac{\\hat{n}\\cdot p_1 + \\hat{n}\\cdot p_2}{2}, \\quad d_i^{\\text{w/y}} = \\pm d_{\\text{seg}} - w_{\\text{paint}} \\mp \\frac{w_{\\text{lane}}}{2}',
      en: {
        title: 'Tangent/Normal Segment Voting (generate_vote)',
        terms: [
          { sym: '\\hat{t}, \\hat{n}', label: 'Unit Tangent & Normal', desc: 'Direction along ground segment \\(p_1 \\to p_2\\) and orthogonal normal vector \\([-t_y, t_x]^\\top\\).' },
          { sym: '\\varphi_i = \\arcsin(t_y)', label: 'Segment Heading (Column Vote)', desc: 'Lane angle extracted directly from \\(t_y\\); selects the closest column \\(\\varphi\\) in the grid.' },
          { sym: 'd_{\\text{seg}} = \\frac{\\hat{n}\\cdot p_1 + \\hat{n}\\cdot p_2}{2}', label: 'Dot Product (90° Tape Distance)', desc: 'Projects endpoints \\(p_1, p_2\\) onto normal \\(\\hat{n}\\) to measure perpendicular distance to the tape, compensating robot tilt.' },
          { sym: 'w_{\\text{paint}}, \\frac{w_{\\text{lane}}}{2}', label: 'Tape Width & Half-Lane (Row Vote)', desc: 'Subtracts real line thickness (<code>linewidth_white/yellow</code>) and half-lane to select the closest row \\(d\\).' }
        ]
      },
      it: {
        title: 'Voto con Versori Tangente/Normale (generate_vote)',
        terms: [
          { sym: '\\hat{t}, \\hat{n}', label: 'Versori Tangente & Normale', desc: 'Direzione unitaria del segmento \\(p_1 \\to p_2\\) e normale ortogonale \\([-t_y, t_x]^\\top\\).' },
          { sym: '\\varphi_i = \\arcsin(t_y)', label: 'Angolo Segmento (Sceglie la COLONNA)', desc: 'Inclinazione in corsia estratta da \\(t_y\\); confrontata con le colonne sceglie la colonna \\(\\varphi\\) più vicina.' },
          { sym: 'd_{\\text{seg}} = \\frac{\\hat{n}\\cdot p_1 + \\hat{n}\\cdot p_2}{2}', label: 'Prodotto Scalare (Distanza a 90°)', desc: 'Proietta \\(p_1\\) e \\(p_2\\) sulla normale \\(\\hat{n}\\) per misurare la distanza perpendicolare alla striscia compensando l’inclinazione.' },
          { sym: 'w_{\\text{paint}}, \\frac{w_{\\text{lane}}}{2}', label: 'Vernice & Mezza Corsia (Sceglie la RIGA)', desc: 'Sottrae lo spessore reale della striscia (<code>linewidth</code>) e mezza corsia per scegliere la riga \\(d\\) più vicina.' }
        ]
      }
    },
    'hf-update': {
      kicker: 'HISTOGRAM FILTER · histogram_update',
      tex: '\\operatorname{bel}_{i,j} = \\frac{\\overline{\\operatorname{bel}}_{i,j} \\odot L_{i,j}}{\\sum_{u,v} \\overline{\\operatorname{bel}}_{u,v} \\odot L_{u,v}}, \\qquad (d^*, \\varphi^*) = \\arg\\max_{i,j} \\operatorname{bel}_{i,j}',
      en: {
        title: 'np.multiply (Hadamard Fusion) & Argmax',
        terms: [
          { sym: '\\odot', label: 'Hadamard (np.multiply)', desc: 'Multiplies each cell \\((i,j)\\) by its camera likelihood \\(L_{i,j}\\) without matrix inversions.' },
          { sym: '\\sum_{u,v} (\\cdot)', label: 'np.sum Normalizer', desc: 'Ensures total probability across all \\(N \\times N\\) bins remains \\(1\\).' },
          { sym: '\\arg\\max_{i,j}', label: 'Best Hypothesis Extraction', desc: 'Selects the single cell \\((d^*, \\varphi^*)\\) with highest posterior probability.' }
        ]
      },
      it: {
        title: 'np.multiply (Prodotto Hadamard) & Argmax',
        terms: [
          { sym: '\\odot', label: 'Hadamard (np.multiply)', desc: 'Moltiplica cella per cella predizione e verosimiglianza \\(L_{i,j}\\) senza invertire matrici.' },
          { sym: '\\sum_{u,v} (\\cdot)', label: 'Normalizzatore (np.sum)', desc: 'Riporta a \\(1\\) la somma di tutte le \\(N \\times N\\) celle.' },
          { sym: '\\arg\\max_{i,j}', label: 'Estrazione Posa Ottima', desc: 'Restituisce le coordinate \\((d^*, \\varphi^*)\\) della cella con picco massimo.' }
        ]
      }
    },
    'ekf-motion': {
      kicker: 'EXTENDED KALMAN FILTER · 1. NON-LINEAR MOTION',
      tex: '\\bar{q}_t = f(q_{t-1}, u_t) = \\begin{bmatrix} x + v\\cos(\\theta)\\Delta t \\\\ y + v\\sin(\\theta)\\Delta t \\\\ \\operatorname{wrap}(\\theta + \\omega\\Delta t) \\end{bmatrix}',
      en: {
        title: 'Non-Linear Unicycle Kinematics',
        terms: [
          { sym: '\\bar{q}_t', label: 'Predicted SE(2) Pose', desc: 'Prior state estimate \\([\\bar{x}_t, \\bar{y}_t, \\bar{\\theta}_t]^\\top\\) before AprilTag correction.' },
          { sym: 'x + v\\cos(\\theta)\\Delta t', label: 'Forward X Displacement', desc: 'Projects linear speed \\(v\\) onto the world X axis using current heading \\(\\theta\\).' },
          { sym: 'y + v\\sin(\\theta)\\Delta t', label: 'Forward Y Displacement', desc: 'Projects linear speed \\(v\\) onto the world Y axis.' },
          { sym: '\\operatorname{wrap}(\\theta + \\omega\\Delta t)', label: 'Wrapped Heading Update', desc: 'Integrates turn rate \\(\\omega\\) and wraps the angle safely into \\([-\\pi, \\pi]\\).' }
        ]
      },
      it: {
        title: 'Cinematica Non Lineare dell’Uniciclo',
        terms: [
          { sym: '\\bar{q}_t', label: 'Posa Predetta SE(2)', desc: 'Stima a priori \\([\\bar{x}_t, \\bar{y}_t, \\bar{\\theta}_t]^\\top\\) prima della lettura AprilTag.' },
          { sym: 'x + v\\cos(\\theta)\\Delta t', label: 'Avanzamento su X', desc: 'Proietta la velocità lineare \\(v\\) lungo l’asse X tramite \\(\\cos(\\theta)\\).' },
          { sym: 'y + v\\sin(\\theta)\\Delta t', label: 'Avanzamento su Y', desc: 'Proietta la velocità lineare \\(v\\) lungo l’asse Y tramite \\(\\sin(\\theta)\\).' },
          { sym: '\\operatorname{wrap}(\\theta + \\omega\\Delta t)', label: 'Rotazione Normalizzata', desc: 'Integra la velocità angolare \\(\\omega\\) mantenendo l’angolo in \\([-\\pi, \\pi]\\).' }
        ]
      }
    },
    'ekf-jac': {
      kicker: 'EXTENDED KALMAN FILTER · 2. MOTION JACOBIANS',
      tex: 'F_t = \\frac{\\partial f}{\\partial q} = \\begin{bmatrix} 1 & 0 & -v\\sin(\\theta)\\Delta t \\\\ 0 & 1 & v\\cos(\\theta)\\Delta t \\\\ 0 & 0 & 1 \\end{bmatrix}, \\qquad W_t = \\frac{\\partial f}{\\partial u} = \\begin{bmatrix} \\cos(\\theta)\\Delta t & 0 \\\\ \\sin(\\theta)\\Delta t & 0 \\\\ 0 & \\Delta t \\end{bmatrix}',
      en: {
        title: 'First-Order Tangent Linearization Matrices',
        terms: [
          { sym: 'F_t = \\partial f / \\partial q', label: 'State Jacobian (3×3)', desc: 'Measures how small errors in \\((x, y, \\theta)\\) propagate forward over \\(\\Delta t\\).' },
          { sym: '-v\\sin(\\theta)\\Delta t,\\; v\\cos(\\theta)\\Delta t', label: 'Heading-to-Position Coupling', desc: 'Crucial off-diagonal terms: an angle error curves the robot sideways as it drives.' },
          { sym: 'W_t = \\partial f / \\partial u', label: 'Control Jacobian (3×2)', desc: 'Maps wheel speed & turn-rate noise \\([\\delta v, \\delta\\omega]^\\top\\) into \\((x, y, \\theta)\\) errors.' }
        ]
      },
      it: {
        title: 'Matrici Jacobiane del Moto (Linearizzazione)',
        terms: [
          { sym: 'F_t = \\partial f / \\partial q', label: 'Jacobiano di Stato (3×3)', desc: 'Descrive come piccoli errori su \\((x, y, \\theta)\\) si propagano al passo successivo.' },
          { sym: '-v\\sin(\\theta)\\Delta t,\\; v\\cos(\\theta)\\Delta t', label: 'Accoppiamento Angolo→Posizione', desc: 'Termini fuori diagonale: un errore di orientamento fa deviare lateralmente la traiettoria.' },
          { sym: 'W_t = \\partial f / \\partial u', label: 'Jacobiano di Controllo (3×2)', desc: 'Proietta i disturbi di velocità e sterzo \\([\\delta v, \\delta\\omega]^\\top\\) nello spazio \\((x, y, \\theta)\\).' }
        ]
      }
    },
    'ekf-cov': {
      kicker: 'EXTENDED KALMAN FILTER · 3. PRIOR COVARIANCE',
      tex: '\\bar{P}_t = F_t P_{t-1} F_t^{\\top} + W_t Q_t W_t^{\\top}',
      en: {
        title: 'EKF Covariance Propagation',
        terms: [
          { sym: '\\bar{P}_t', label: 'Predicted 3×3 Covariance', desc: 'Expanded & rotated uncertainty ellipse before seeing an AprilTag.' },
          { sym: 'F_t P_{t-1} F_t^\\top', label: 'Tangent Ellipse Transform', desc: 'Rotates and stretches prior covariance \\(P_{t-1}\\) along the motion tangent.' },
          { sym: 'W_t Q_t W_t^\\top', label: 'Injected Actuator Noise', desc: 'Transforms wheel odometry covariance \\(Q_t\\) into pose uncertainty.' }
        ]
      },
      it: {
        title: 'Propagazione della Covarianza EKF',
        terms: [
          { sym: '\\bar{P}_t', label: 'Covarianza Predetta 3×3', desc: 'Ellisse di incertezza espansa e ruotata prima di vedere un AprilTag.' },
          { sym: 'F_t P_{t-1} F_t^\\top', label: 'Trasformazione Tangente', desc: 'Ruota e deforma la covarianza precedente \\(P_{t-1}\\) lungo la curva.' },
          { sym: 'W_t Q_t W_t^\\top', label: 'Rumore Odometrico Proiettato', desc: 'Aggiunge l’incertezza dei comandi \\(Q_t\\) nello spazio di posa.' }
        ]
      }
    },
    'ekf-meas': {
      kicker: 'EXTENDED KALMAN FILTER · 4. MEASUREMENT & JACOBIAN',
      tex: 'h(q) = \\begin{bmatrix} r \\\\ \\phi \\end{bmatrix} = \\begin{bmatrix} \\sqrt{\\Delta x^2 + \\Delta y^2} \\\\ \\operatorname{atan2}(\\Delta y, \\Delta x) - \\theta \\end{bmatrix}, \\qquad H_t = \\begin{bmatrix} -\\dfrac{\\Delta x}{r} & -\\dfrac{\\Delta y}{r} & 0 \\\\[6pt] \\dfrac{\\Delta y}{r^2} & -\\dfrac{\\Delta x}{r^2} & -1 \\end{bmatrix}',
      en: {
        title: 'Polar AprilTag Model & Measurement Jacobian',
        terms: [
          { sym: '\\Delta x,\\; \\Delta y', label: 'AprilTag Offset (Map − Robot)', desc: 'Defined as \\(\\Delta x = x_{\\text{tag}} - x\\) and \\(\\Delta y = y_{\\text{tag}} - y\\): difference between the known AprilTag map position \\((x_{\\text{tag}}, y_{\\text{tag}})\\) and the robot’s estimated pose \\((x, y)\\).' },
          { sym: 'r = \\sqrt{\\Delta x^2 + \\Delta y^2}', label: 'Euclidean Range', desc: 'Predicted straight-line distance from robot \\((x,y)\\) to the AprilTag \\((x_{\\text{tag}}, y_{\\text{tag}})\\).' },
          { sym: '\\phi = \\operatorname{atan2}(\\Delta y, \\Delta x) - \\theta', label: 'Relative Bearing', desc: 'Angle of the AprilTag relative to the robot’s front heading \\(\\theta\\).' },
          { sym: 'H_t = \\partial h / \\partial q', label: 'Measurement Jacobian (2×3)', desc: 'Linearizes polar range/bearing so innovations correct \\((x, y, \\theta)\\) directly; notice \\(-1\\) on \\(\\theta\\).' }
        ]
      },
      it: {
        title: 'Modello Polare AprilTag & Jacobiano di Misura',
        terms: [
          { sym: '\\Delta x,\\; \\Delta y', label: 'Differenza verso l’AprilTag', desc: 'Definite come \\(\\Delta x = x_{\\text{tag}} - x\\) e \\(\\Delta y = y_{\\text{tag}} - y\\): distanza lungo gli assi tra la posizione fissa nota dell’AprilTag sulla mappa \\((x_{\\text{tag}}, y_{\\text{tag}})\\) e la stima del robot \\((x, y)\\).' },
          { sym: 'r = \\sqrt{\\Delta x^2 + \\Delta y^2}', label: 'Distanza Euclidea', desc: 'Distanza attesa in linea d’aria tra robot \\((x,y)\\) e AprilTag \\((x_{\\text{tag}}, y_{\\text{tag}})\\).' },
          { sym: '\\phi = \\operatorname{atan2}(\\Delta y, \\Delta x) - \\theta', label: 'Bearing Relativo', desc: 'Angolo del tag rispetto alla direzione frontale \\(\\theta\\) del robot (angolo assoluto \\(\\operatorname{atan2}(\\Delta y, \\Delta x)\\) meno l’orientamento \\(\\theta\\)).' },
          { sym: 'H_t = \\partial h / \\partial q', label: 'Jacobiano di Misura (2×3)', desc: 'Linearizza le coordinate polari per proiettare la correzione su \\((x, y, \\theta)\\); il \\(-1\\) lega \\(\\phi\\) a \\(\\theta\\).' }
        ]
      }
    },
    'ekf-upd': {
      kicker: 'EXTENDED KALMAN FILTER · 5. EKF UPDATE',
      tex: 'K_t = \\bar{P}_t H_t^{\\top} (H_t \\bar{P}_t H_t^{\\top} + R)^{-1}, \\quad q_t = \\bar{q}_t + K_t \\operatorname{wrap}(z_t - h(\\bar{q}_t)), \\quad P_{\\text{new}} = (I - K_t H_t)\\bar{P}_t, \\quad P_t = \\tfrac{1}{2}(P_{\\text{new}} + P_{\\text{new}}^{\\top})',
      en: {
        title: 'EKF Gain, Wrapped Update & Symmetrization',
        terms: [
          { sym: 'K_t', label: 'EKF Kalman Gain (3×2)', desc: 'Maps 2D polar surprise \\([\\Delta r, \\Delta\\phi]^\\top\\) into a 3D pose correction \\([\\delta x, \\delta y, \\delta\\theta]^\\top\\).' },
          { sym: '\\operatorname{wrap}(z_t - h(\\bar{q}_t))', label: 'Wrapped Bearing Innovation', desc: 'Guarantees shortest-arc angular difference in \\([-\\pi, \\pi]\\), preventing \\(\\pm 180^\\circ\\) jumps.' },
          { sym: '\\tfrac{1}{2}(P_{\\text{new}} + P_{\\text{new}}^\\top)', label: 'Symmetry Safeguard', desc: 'Eliminates floating-point asymmetry so \\(P_t\\) stays positive-definite forever.' }
        ]
      },
      it: {
        title: 'Guadagno EKF, Update Normalizzato & Simmetria',
        terms: [
          { sym: 'K_t', label: 'Guadagno EKF (3×2)', desc: 'Converte la sorpresa polare 2D \\([\\Delta r, \\Delta\\phi]^\\top\\) in correzione su \\([x, y, \\theta]^\\top\\).' },
          { sym: '\\operatorname{wrap}(z_t - h(\\bar{q}_t))', label: 'Innovazione Angolare Sicura', desc: 'Garantisce la differenza minima in \\([-\\pi, \\pi]\\) evitando esplosioni al taglio \\(\\pm 180^\\circ\\).' },
          { sym: '\\tfrac{1}{2}(P_{\\text{new}} + P_{\\text{new}}^\\top)', label: 'Guardia di Simmetria', desc: 'Azzera gli errori numerici mantenendo \\(P_t\\) simmetrica e definita positiva.' }
        ]
      }
    }
  };

  function initStaticEquationInspectors() {
    if (typeof document.querySelectorAll !== 'function') return;
    var displays = document.querySelectorAll('.math-display');
    displays.forEach(function (box) {
      if (!box.querySelector('[data-eq-explain]')) return;
      if (!box.querySelector('.math-display-hint') && typeof document.createElement === 'function') {
        var hint = document.createElement('div');
        hint.className = 'math-display-hint';
        hint.innerHTML = '<span class="narrator-eq-hint-icon">i</span><span class="math-display-hint-text"></span>';
        if (box.getAttribute('data-hf-edge-help') === 'true') {
          var helpBtn = document.createElement('button');
          helpBtn.type = 'button';
          helpBtn.className = 'math-hint-help-btn';
          helpBtn.setAttribute('data-open-hf-edge-help', 'true');
          helpBtn.innerHTML = '<span class="math-hint-help-q">?</span><span class="math-hint-help-txt"></span>';
          hint.appendChild(helpBtn);
        }
        box.appendChild(hint);
      }
    });

    var rows = document.querySelectorAll('.math-eq-row[data-eq-explain]');
    rows.forEach(function (row) {
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      var openRow = function (initialMode) {
        var key = row.getAttribute('data-eq-explain');
        var spec = EQ_EXPLAINS[key];
        if (!spec || !window.LocSims || typeof window.LocSims.openFormulaInspector !== 'function') return;
        var lang = document.body.getAttribute('data-lang') === 'it' ? 'it' : 'en';
        var copy = spec[lang] || spec.en;
        window.LocSims.openFormulaInspector({
          kicker: spec.kicker,
          title: copy.title,
          tex: spec.tex,
          explain: copy.terms,
          simKey: key,
          initialMode: initialMode || 'terms'
        });
      };

      var key = row.getAttribute('data-eq-explain');
      if (window.FormulaSims && window.FormulaSims.has(key) && typeof document.createElement === 'function') {
        row.classList.add('has-sim');
        var simBtn = document.createElement('button');
        simBtn.type = 'button';
        simBtn.className = 'eq-sim-btn';
        simBtn.innerHTML = '<span class="eq-sim-btn-icon">&#9654;</span><span class="eq-sim-btn-txt"></span>';
        simBtn.addEventListener('click', function (ev) {
          ev.stopPropagation();
          openRow('sim');
        });
        var tagEl = row.querySelector('.math-eq-tag');
        if (tagEl && tagEl.parentNode === row) {
          row.insertBefore(simBtn, tagEl);
        } else {
          row.appendChild(simBtn);
        }
      }

      row.addEventListener('click', function () {
        openRow('terms');
      });
      row.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openRow('terms');
        }
      });
    });

    var curLang = document.body.getAttribute('data-lang') === 'it' ? 'it' : 'en';
    updateMathDisplayHints(curLang);
  }

  function initLabKitDialog() {
    var dialog = document.getElementById('labkit-dialog');
    if (!dialog) return;

    var triggers = document.querySelectorAll('[data-open-labkit]');
    var closeBtn = document.getElementById('labkit-close-btn');
    var form = document.getElementById('labkit-solutions-form');
    var input = document.getElementById('labkit-code-input');
    var msgEl = document.getElementById('labkit-code-msg');

    var EXPECTED_SHA256 = 'b2588dbb10006a9e82dddfca980b524dd17bf324b795f4dc61cf2fdf148767ce';
    var EXPECTED_FNV = '4f626c79';

    function getLang() {
      return document.body.getAttribute('data-lang') === 'it' ? 'it' : 'en';
    }

    function updatePlaceholder() {
      if (!input) return;
      input.placeholder = getLang() === 'it' ? 'Inserisci codice...' : 'Enter access code...';
    }

    function setMsg(text, kind) {
      if (!msgEl) return;
      msgEl.textContent = text || '';
      msgEl.className = 'labkit-code-msg' + (kind ? ' ' + kind : '');
    }

    function openDialog() {
      updatePlaceholder();
      setMsg('', '');
      if (input) input.value = '';
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    }

    function closeDialog() {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }

    triggers.forEach(function (btn) {
      btn.addEventListener('click', openDialog);
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', closeDialog);
    }

    dialog.addEventListener('click', function (ev) {
      if (ev.target === dialog) {
        closeDialog();
      }
    });

    function verifyCode(code) {
      if (window.crypto && window.crypto.subtle && typeof TextEncoder === 'function') {
        var bytes = new TextEncoder().encode(code);
        return window.crypto.subtle.digest('SHA-256', bytes).then(function (buf) {
          var arr = Array.prototype.slice.call(new Uint8Array(buf));
          var hex = arr
            .map(function (b) {
              return b.toString(16).padStart(2, '0');
            })
            .join('');
          return hex === EXPECTED_SHA256;
        });
      }
      var h = 0x811c9dc5;
      for (var i = 0; i < code.length; i++) {
        h ^= code.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      return Promise.resolve((h >>> 0).toString(16) === EXPECTED_FNV);
    }

    if (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var code = input ? input.value.trim() : '';
        var lang = getLang();
        if (!code) {
          setMsg(lang === 'it' ? 'Inserisci il codice di accesso.' : 'Please enter the access code.', 'error');
          if (input) input.focus();
          return;
        }
        verifyCode(code).then(function (ok) {
          if (!ok) {
            setMsg(lang === 'it' ? 'Codice non valido.' : 'Invalid access code.', 'error');
            if (input) {
              input.select();
              input.focus();
            }
            return;
          }
          setMsg(
            lang === 'it' ? 'Codice corretto! Avvio del download...' : 'Code accepted! Starting download...',
            'success'
          );
          var filename = 'lx-localization-labkit-solutions-' + code + '.zip';
          var a = document.createElement('a');
          a.href = 'downloads/' + filename;
          a.download = 'lx-localization-labkit-solutions.zip';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          if (input) input.value = '';
        });
      });
    }
  }

  function initHfEdgeDialog() {
    var dlg = document.getElementById('hf-edge-dialog');
    if (!dlg || typeof dlg.showModal !== 'function') return;

    var SCALE = 640;
    var Y_CENTER = 152;
    var W_LANE = 0.22;
    var W_WHITE = 0.04;
    var W_YELLOW = 0.025;
    var currentCase = 'w_out';
    var dRobot = 0.0;
    var pulseTimer = null;
    var pulsePhase = 0;

    var CASES = {
      w_out: {
        color: 'WHITE',
        p1x: 390,
        p2x: 290,
        yEdgeWorld: -(W_LANE / 2 + W_WHITE),
        enTitle: 'White Outer Edge',
        itTitle: 'Bordo Esterno Bianco',
        enRule: 'p1.x > p2.x: segment points backward along the outer paint edge, so it subtracts w_white (0.04 m) and w_lane/2 (0.11 m).',
        itRule: 'p1.x > p2.x: il segmento punta indietro lungo il bordo esterno, quindi sottrae w_white (0.04 m) e w_lane/2 (0.11 m).'
      },
      w_in: {
        color: 'WHITE',
        p1x: 290,
        p2x: 390,
        yEdgeWorld: -(W_LANE / 2),
        enTitle: 'White Inner Edge',
        itTitle: 'Bordo Interno Bianco',
        enRule: 'p2.x > p1.x: segment points forward, so n_hat flips upward. Code flips sign (-d_seg) and subtracts only w_lane/2.',
        itRule: 'p2.x > p1.x: il segmento punta avanti e n_hat guarda in su. Il codice inverte il segno (-d_seg) e sottrae solo w_lane/2.'
      },
      y_out: {
        color: 'YELLOW',
        p1x: 290,
        p2x: 390,
        yEdgeWorld: +(W_LANE / 2 + W_YELLOW),
        enTitle: 'Yellow Outer Edge',
        itTitle: 'Bordo Esterno Giallo',
        enRule: 'p2.x > p1.x: outer yellow edge. Subtracts w_yellow (0.025 m) to reach the inner edge, then computes w_lane/2 - d_i.',
        itRule: 'p2.x > p1.x: bordo esterno giallo. Sottrae w_yellow (0.025 m) per tornare al bordo interno, poi calcola w_lane/2 - d_i.'
      },
      y_in: {
        color: 'YELLOW',
        p1x: 390,
        p2x: 290,
        yEdgeWorld: +(W_LANE / 2),
        enTitle: 'Yellow Inner Edge',
        itTitle: 'Bordo Interno Giallo',
        enRule: 'p1.x > p2.x: inner yellow edge. Flips sign (-d_seg) without subtracting w_yellow, then computes w_lane/2 - d_i.',
        itRule: 'p1.x > p2.x: bordo interno giallo. Inverte il segno (-d_seg) senza togliere w_yellow, poi calcola w_lane/2 - d_i.'
      }
    };

    function renderEdgeState() {
      var lang = document.body.getAttribute('data-lang') === 'it' ? 'it' : 'en';
      var c = CASES[currentCase];
      var yBotSvg = Y_CENTER - dRobot * SCALE;
      var yEdgeSvg = Y_CENTER - c.yEdgeWorld * SCALE;
      var forward = c.p2x > c.p1x;
      var yRel = c.yEdgeWorld - dRobot;
      var dSeg = forward ? yRel : -yRel;

      var botGrp = document.getElementById('hf-bot-grp');
      if (botGrp) botGrp.setAttribute('transform', 'translate(150, ' + yBotSvg.toFixed(1) + ')');
      var dValEl = document.getElementById('hf-edge-dval');
      if (dValEl) dValEl.textContent = (dRobot >= 0 ? '+' : '') + dRobot.toFixed(2) + ' m';

      var segLine = document.getElementById('hf-seg-line');
      if (segLine) {
        segLine.setAttribute('x1', c.p1x);
        segLine.setAttribute('y1', yEdgeSvg);
        segLine.setAttribute('x2', c.p2x);
        segLine.setAttribute('y2', yEdgeSvg);
      }
      var p1Dot = document.getElementById('hf-p1-dot');
      if (p1Dot) {
        p1Dot.setAttribute('cx', c.p1x);
        p1Dot.setAttribute('cy', yEdgeSvg);
      }
      var lblY = c.color === 'WHITE' ? yEdgeSvg + 14 : yEdgeSvg - 7;
      var p1Txt = document.getElementById('hf-p1-txt');
      var p2Txt = document.getElementById('hf-p2-txt');
      if (p1Txt) {
        p1Txt.setAttribute('x', c.p1x + (c.p1x > c.p2x ? 4 : -16));
        p1Txt.setAttribute('y', lblY);
      }
      if (p2Txt) {
        p2Txt.setAttribute('x', c.p2x + (c.p2x > c.p1x ? 6 : -18));
        p2Txt.setAttribute('y', lblY);
      }

      var nSvgDir = forward ? -1 : 1;
      var midX = (c.p1x + c.p2x) / 2;
      var normLine = document.getElementById('hf-norm-line');
      var normTxt = document.getElementById('hf-norm-txt');
      if (normLine) {
        normLine.setAttribute('x1', midX);
        normLine.setAttribute('y1', yEdgeSvg);
        normLine.setAttribute('x2', midX);
        normLine.setAttribute('y2', yEdgeSvg + nSvgDir * 42);
      }
      if (normTxt) {
        normTxt.setAttribute('x', midX + 6);
        normTxt.setAttribute('y', yEdgeSvg + nSvgDir * 28);
      }

      var dg = document.getElementById('hf-dist-guide');
      var dl = document.getElementById('hf-dist-lbl');
      if (dg) {
        dg.setAttribute('y1', yBotSvg);
        dg.setAttribute('y2', yEdgeSvg);
      }
      if (dl) {
        dl.setAttribute('y', ((yBotSvg + yEdgeSvg) / 2 + 4).toFixed(1));
        dl.textContent = Math.abs(yRel).toFixed(3) + ' m';
      }

      var dVote = dSeg;
      var lines = '';
      if (c.color === 'WHITE') {
        if (!forward) {
          dVote = dSeg - W_WHITE - W_LANE / 2;
          lines = 'd_seg = ' + dSeg.toFixed(3) + ' m<br/>d_i = ' + dSeg.toFixed(3) + ' - 0.04 - 0.11 = ' + (dVote >= 0 ? '+' : '') + dVote.toFixed(3) + ' m';
        } else {
          var dFlip = -dSeg;
          dVote = dFlip - W_LANE / 2;
          lines = 'd_seg = ' + dSeg.toFixed(3) + ' m -> flip: ' + dFlip.toFixed(3) + ' m<br/>d_i = ' + dFlip.toFixed(3) + ' - 0.11 = ' + (dVote >= 0 ? '+' : '') + dVote.toFixed(3) + ' m';
        }
      } else {
        if (forward) {
          var dSub = dSeg - W_YELLOW;
          dVote = W_LANE / 2 - dSub;
          lines = 'd_seg = ' + dSeg.toFixed(3) + ' m -> -0.025 = ' + dSub.toFixed(3) + ' m<br/>d_i = 0.11 - ' + dSub.toFixed(3) + ' = ' + (dVote >= 0 ? '+' : '') + dVote.toFixed(3) + ' m';
        } else {
          var dFlipY = -dSeg;
          dVote = W_LANE / 2 - dFlipY;
          lines = 'd_seg = ' + dSeg.toFixed(3) + ' m -> flip: ' + dFlipY.toFixed(3) + ' m<br/>d_i = 0.11 - ' + dFlipY.toFixed(3) + ' = ' + (dVote >= 0 ? '+' : '') + dVote.toFixed(3) + ' m';
        }
      }

      var dirBadge = document.getElementById('hf-dir-badge');
      if (dirBadge) {
        dirBadge.textContent = (lang === 'it' ? c.itTitle : c.enTitle) + ' | ' + (forward ? 'p2.x > p1.x' : 'p1.x > p2.x');
      }
      var ruleEl = document.getElementById('hf-edge-rule');
      if (ruleEl) ruleEl.textContent = lang === 'it' ? c.itRule : c.enRule;

      var calcEl = document.getElementById('hf-edge-calc');
      if (calcEl) {
        var finalTxt = lang === 'it' ? 'Risultato: d_i = ' : 'Result: d_i = ';
        calcEl.innerHTML = lines + '<br/><span style="color:#22c55e;font-weight:700;">' + finalTxt + (dVote >= 0 ? '+' : '') + dVote.toFixed(2) + ' m</span>';
      }

      dlg.querySelectorAll('.hf-edge-btn').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-hf-case') === currentCase);
      });
    }

    document.querySelectorAll('[data-open-hf-edge-help]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        renderEdgeState();
        dlg.showModal();
        var allowMotion = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        if (allowMotion && !pulseTimer) {
          pulseTimer = setInterval(function () {
            pulsePhase = (pulsePhase + 1) % 2;
            var seg = document.getElementById('hf-seg-line');
            if (seg) seg.setAttribute('opacity', pulsePhase === 0 ? '1' : '0.68');
          }, 600);
        }
      });
    });

    dlg.addEventListener('close', function () {
      if (pulseTimer) {
        clearInterval(pulseTimer);
        pulseTimer = null;
      }
      dlg.returnValue = '';
    });

    if (!('closedBy' in HTMLDialogElement.prototype)) {
      var outside = function (e) {
        var r = dlg.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      var pressedOut = false;
      dlg.addEventListener('pointerdown', function (e) { pressedOut = outside(e); });
      dlg.addEventListener('pointerup', function (e) { if (pressedOut && outside(e)) dlg.close(); });
    }

    dlg.querySelectorAll('.hf-edge-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentCase = btn.getAttribute('data-hf-case');
        renderEdgeState();
      });
    });

    var slider = document.getElementById('hf-edge-slider');
    if (slider) {
      slider.addEventListener('input', function () {
        dRobot = parseFloat(slider.value) || 0;
        renderEdgeState();
      });
    }
  }

  function init() {
    initLanguageSwitch();
    initScrollSpy();
    initStaticEquationInspectors();
    initHfEdgeDialog();
    initLabKitDialog();
    runKaTeX();
    window.addEventListener('load', runKaTeX);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
