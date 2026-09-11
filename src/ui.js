/* =========================================================================
   ui.js — utilitaires DOM, routeur d'écrans, effets, scène de présentation.
   ========================================================================= */
(function (HG) {
  "use strict";

  var app = null;

  // ---- Fabrique d'éléments -----------------------------------------
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!attrs.hasOwnProperty(k)) continue;
        var v = attrs[k];
        if (k === "class") n.className = v;
        else if (k === "html") n.innerHTML = v;
        else if (k === "text") n.textContent = v;
        else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
        else if (k.slice(0, 2) === "on" && typeof v === "function") n.addEventListener(k.slice(2), v);
        else if (v === true) n.setAttribute(k, "");
        else if (v !== false && v != null) n.setAttribute(k, v);
      }
    }
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  HG.escapeHtml = escapeHtml;

  // ---- Réglages de lecture (persistés) -----------------------------
  // Le déroulé est toujours automatique ; on met en pause ou on clique
  // l'écran pour avancer. Le curseur règle le temps d'affichage de
  // chaque « beat » (7 crans, du plus lent au plus rapide).
  var SPEED_DWELL = [10500, 8600, 6900, 5400, 4200, 3100, 2200];
  var SPEED_LABEL = ["Très lent", "Lent", "Posé", "Tranquille", "Normal", "Vif", "Rapide"];
  var SPEED_MAX = SPEED_DWELL.length - 1;
  var speedIdx = 2;

  try {
    var _s = HG.storage.getSettings();
    if (typeof _s.speed === "number") speedIdx = Math.max(0, Math.min(SPEED_MAX, _s.speed));
  } catch (e) {}

  function speed() { return speedIdx; }
  function setSpeed(i) {
    speedIdx = Math.max(0, Math.min(SPEED_MAX, i | 0));
    try { HG.storage.saveSettings({ speed: speedIdx }); } catch (e) {}
    paintPlaybar();
  }
  function dwellMs() { return SPEED_DWELL[speedIdx]; }
  function speedFactor() { return 3 / (speedIdx + 1.8); }
  // Il n'y a plus d'enchaînement automatique ENTRE les écrans : chaque
  // passage se fait au clic. (Les « beats » d'un même écran défilent seuls.)
  function isAuto() { return false; }

  // ---- Identité visuelle de la phase ------------------------------
  var PHASES = {
    home:         { label: "" },
    reaping:      { label: "La Moisson" },
    presentation: { label: "Présentation des tributs" },
    chariots:     { label: "Défilé des chars" },
    plateau:      { label: "Plateau de Caesar Flickerman" },
    training:     { label: "Séances privées" },
    bloodbath:    { label: "Bain de sang" },
    "arena-day":  { label: "L'arène — plein jour" },
    "arena-night":{ label: "L'arène — nuit" },
    ceremony:     { label: "Ceux qui sont tombés" },
    finale:       { label: "Le dénouement" },
    victory:      { label: "Le sacre" }
  };
  var currentPhase = "home";
  function setPhase(name, opts) {
    opts = opts || {};
    if (!PHASES[name]) name = "home";
    var changed = currentPhase !== name;
    currentPhase = name;
    document.body.dataset.phase = name;
    // la musique de Caesar ne joue que sur le plateau
    if (name !== "plateau" && HG.audio && HG.audio.stopMusic) HG.audio.stopMusic(600);
    if (changed && opts.wipe !== false && !prefersReducedMotion()) playPhaseWipe(PHASES[name].label);
  }
  var wipeTimer = null;
  function playPhaseWipe(label) {
    var w = document.getElementById("phase-wipe");
    if (!w) { w = el("div", { id: "phase-wipe" }); document.body.appendChild(w); }
    clear(w);
    w.appendChild(el("span", { text: label || "" }));
    // Le rideau COUVRE l'écran dès la première image : setPhase() est appelé
    // pendant le rendu du nouvel écran (déjà dans le DOM à ce stade), donc si
    // le voile n'était pas opaque immédiatement, on verrait la page suivante
    // « en avance » le temps d'un fondu. On couvre franc, puis on dévoile.
    w.classList.remove("run");
    w.style.opacity = "1";
    void w.offsetWidth;
    w.classList.add("run");
    // filet de sécurité : on nettoie même si l'animation CSS est throttlée
    if (wipeTimer) clearTimeout(wipeTimer);
    wipeTimer = setTimeout(function () { w.classList.remove("run"); w.style.opacity = "0"; }, 2600);
  }

  // ---- Compte à rebours de la Corne d'abondance (vidéo + corne de brume) ----
  // Rejoue le décompte du film avant le bain de sang. À la fin : War Horn,
  // puis on enchaîne (done). Repli sur un décompte animé si la vidéo échoue.
  function playCountdown(done) {
    var finished = false;
    var reduce = prefersReducedMotion();

    var numEl = el("div", { class: "cd-num", hidden: true });
    var skip = el("button", { class: "cd-skip ghost", type: "button" }, ["Passer ▶"]);
    var veil = el("div", { id: "countdown-veil" }, [
      numEl,
      el("div", { class: "cd-label", text: "Que le sort vous soit favorable…" }),
      skip
    ]);

    function cleanup() {
      document.removeEventListener("keydown", onKey);
      if (watchdog) clearTimeout(watchdog);
      if (fbTimer) clearTimeout(fbTimer);
      if (startGuard) clearTimeout(startGuard);
    }
    function finish() {
      if (finished) return;
      finished = true;
      cleanup();
      try { if (HG.audio && HG.audio.warHorn) HG.audio.warHorn(); } catch (e) {}
      veil.classList.add("out");
      setTimeout(function () { if (veil.parentNode) veil.parentNode.removeChild(veil); }, 460);
      if (done) done();
    }
    function onKey(e) {
      if (e.key === "Escape" || e.key === " " || e.key === "Enter") { e.preventDefault(); finish(); }
    }
    skip.addEventListener("click", finish);
    document.addEventListener("keydown", onKey);

    // --- repli : décompte animé ---
    var fbTimer = null;
    function startFallback() {
      if (finished || fbTimer) return;
      if (video) { try { video.pause(); } catch (e) {} video.hidden = true; }
      numEl.hidden = false;
      var n = reduce ? 3 : 10;
      (function tick() {
        if (finished) return;
        numEl.textContent = String(n);
        numEl.classList.remove("pop"); void numEl.offsetWidth; numEl.classList.add("pop");
        try { if (HG.audio && HG.audio.tick) HG.audio.tick(n <= 3); } catch (e) {}
        if (n <= 0) { finish(); return; }
        n--;
        fbTimer = setTimeout(tick, reduce ? 550 : 1000);
      })();
    }

    // --- vidéo ---
    var video = null, started = false, startGuard = null, watchdog = null;
    if (!reduce) {
      video = el("video", { id: "cd-video", preload: "auto", playsinline: "" });
      video.muted = !(HG.audio && HG.audio.isEnabled());
      video.setAttribute("playsinline", "");
      video.appendChild(el("source", { src: "assets/video/countdown.mp4", type: "video/mp4" }));
      video.addEventListener("playing", function () { started = true; });
      video.addEventListener("ended", finish);
      video.addEventListener("error", startFallback);
      veil.insertBefore(video, numEl);
    }

    document.body.appendChild(veil);

    if (video) {
      var p = video.play();
      if (p && p.catch) p.catch(function () { startFallback(); });
      startGuard = setTimeout(function () { if (!started && !finished) startFallback(); }, 2200);
      watchdog = setTimeout(function () { if (!finished) finish(); }, 16000);
    } else {
      startFallback();
    }
  }

  // ---- Sceau de Panem -------------------------------------------
  function sealSVG(extraClass) {
    var ns = "http://www.w3.org/2000/svg";
    var s = document.createElementNS(ns, "svg");
    s.setAttribute("viewBox", "0 0 120 120");
    s.setAttribute("class", "seal " + (extraClass || ""));
    s.innerHTML =
      '<circle class="ring" cx="60" cy="60" r="54"/>' +
      '<circle class="ring ring-2" cx="60" cy="60" r="46"/>' +
      '<path class="laurel" d="M60 16 C40 26 30 44 32 66 C40 60 50 58 58 60"/>' +
      '<path class="laurel" d="M60 16 C80 26 90 44 88 66 C80 60 70 58 62 60"/>' +
      '<path class="bird" d="M60 40 L52 58 L58 56 L54 74 L60 66 L66 74 L62 56 L68 58 Z"/>' +
      '<path class="bird" d="M60 52 L40 50 L54 60 Z M60 52 L80 50 L66 60 Z"/>' +
      '<text class="word" x="60" y="104" text-anchor="middle">PANEM</text>';
    return s;
  }

  // ---- Carte tribut -------------------------------------------
  function portraitBg(t) {
    if (t.photo) return t.photo;
    if (t.emoji && !t.portrait) return null;
    return t.portrait || HG.portraitPath(t.id);
  }
  // Sous-titre : district + spécialité (jamais « dans le rôle de »).
  function tributeSubtitle(t) {
    return "District " + t.district + " · " + HG.DISTRICTS[t.district].industry;
  }

  function tributeCard(t, opts) {
    opts = opts || {};
    var bg = portraitBg(t);
    var portrait = el("div", {
      class: "portrait", style: bg ? { backgroundImage: 'url("' + bg + '")' } : {}
    }, [
      bg ? null : el("div", { class: "emoji", text: t.emoji || "?" }),
      el("span", { class: "dtag", text: "D" + t.district }),
      t.isPlayer ? el("span", { class: "player-pin", text: "JOUEUR" }) : null,
      (!t.alive) ? el("div", { class: "skull", text: "☠" }) : null
    ]);

    var sub = tributeSubtitle(t);
    if (opts.showKills && t.kills.length) sub += " · " + t.kills.length + " élim.";

    var body = el("div", { class: "body" }, [
      el("div", { class: "tname", text: t.name }),
      el("div", { class: "tsub", text: sub })
    ]);
    if (opts.showWeapon && t.weapon && HG.WEAPONS && HG.WEAPONS[t.weapon]) {
      var w = HG.WEAPONS[t.weapon];
      body.appendChild(el("div", { class: "weapon-tag", title: w.tag,
        text: (t.weapon === "none" ? "⚔ sans arme" : "⚔ " + w.name.replace(/^(un |une |des |le |la )/, "")) }));
    }
    if (opts.showSkills && t.skills && t.skills.length) {
      body.appendChild(el("div", { class: "skill-tags" }, t.skills.map(function (k) {
        var s = HG.SKILLS[k];
        return el("span", { class: "skill-tag", title: s ? s.blurb : "", text: s ? s.label : k });
      })));
    }
    if (opts.showGauges) {
      body.appendChild(el("div", { class: "gauge spons", title: "Sponsors" }, [ el("i", { style: { width: clampPct(t.sponsor) } }) ]));
      body.appendChild(el("div", { class: "gauge favor", title: "Faveur du salon" }, [ el("i", { style: { width: clampPct(t.roomFavor * 8) } }) ]));
    }

    var card = el("div", {
      class: "tcard d" + t.district + (t.alive ? "" : " dead") +
             (opts.selectable ? " selectable" : "") + (opts.chosen ? " chosen" : "")
    }, [portrait, body]);
    if (opts.onClick) card.addEventListener("click", function () { opts.onClick(t, card); });
    return card;
  }
  function clampPct(n) { n = Math.max(0, Math.min(100, Math.round(n || 0))); return n + "%"; }

  // ---- Routeur d'écrans --------------------------------------
  var screens = {};
  var current = null;
  var activeStage = null;

  function register(name, renderFn) { screens[name] = renderFn; }

  function go(name, data) {
    if (!screens[name]) { console.error("écran inconnu :", name); return; }
    if (activeStage) { activeStage.destroy(); activeStage = null; }
    hidePlaybar();
    setActions(null);
    current = name;
    // Hors de l'accueil, la partie n'est sauvegardée nulle part : le bouton
    // « précédent » (souris ou navigateur) quitterait tout sans prévenir.
    // On ne laisse partir qu'après confirmation (voir guardLeave, plus bas).
    guardLeave(name !== "home");
    clear(app);
    var node = screens[name](data || {});
    if (node) app.appendChild(node);
    window.scrollTo(0, 0);
  }

  // ---- Confirmation avant de quitter (retour souris/navigateur, fermeture,
  //      rechargement…) tant qu'une partie est en cours. Les navigateurs
  //      modernes n'affichent plus de message personnalisé : la boîte de
  //      dialogue générique du navigateur suffit à demander confirmation.
  var leaveGuarded = false;
  function guardLeave(on) { leaveGuarded = on; }
  window.addEventListener("beforeunload", function (e) {
    if (!leaveGuarded) return;
    e.preventDefault();
    e.returnValue = "";
    return "";
  });

  // ---- Modale --------------------------------------------------
  function openModal(contentNode) {
    var root = document.getElementById("modal-root");
    clear(root);
    var wrap = el("div", { class: "modal rise-in" }, [contentNode]);
    root.appendChild(wrap);
    root.hidden = false;
    root.onclick = function (e) { if (e.target === root) closeModal(); };
    document.addEventListener("keydown", escClose);
    return wrap;
  }
  function escClose(e) { if (e.key === "Escape") closeModal(); }
  function closeModal() {
    var root = document.getElementById("modal-root");
    root.hidden = true; clear(root);
    document.removeEventListener("keydown", escClose);
  }

  // ---- Coup de canon ----------------------------------------
  function cannonFX(withSound) {
    if (withSound) HG.audio.cannon();
    var f = document.getElementById("cannon-flash");
    if (f) { f.classList.remove("fire"); void f.offsetWidth; f.classList.add("fire"); }
    // pas de secousse pendant la cérémonie (solennité)
    if (!prefersReducedMotion() && currentPhase !== "ceremony") {
      document.body.classList.remove("shake");
      void document.body.offsetWidth;
      document.body.classList.add("shake");
      setTimeout(function () { document.body.classList.remove("shake"); }, 600);
    }
  }

  // ---- Braises ---------------------------------------------
  function startEmbers() {
    var canvas = document.getElementById("ember-field");
    if (!canvas || prefersReducedMotion()) return;
    var ctx = canvas.getContext("2d");
    var W, H, parts = [];
    // Densité constante plutôt que nombre fixe : sur une grande TV, l'écran
    // couvre bien plus de pixels qu'un portable — sans ça, les mêmes 55
    // braises s'y retrouvent noyées et l'arrière-plan paraît vide.
    function targetCount() {
      return Math.max(55, Math.min(300, Math.round((W * H) / 14000)));
    }
    function spawn() {
      return { x: Math.random() * W, y: H + Math.random() * 40, r: 0.6 + Math.random() * 1.8,
        vy: -(0.15 + Math.random() * 0.55), vx: (Math.random() - 0.5) * 0.25,
        life: 0, max: 300 + Math.random() * 500, hue: 28 + Math.random() * 18 };
    }
    function resize() {
      W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight;
      var target = targetCount();
      while (parts.length < target) { var p = spawn(); p.y = Math.random() * H; parts.push(p); }
      if (parts.length > target) parts.length = target;
    }
    resize();
    window.addEventListener("resize", resize);
    (function frame() {
      ctx.clearRect(0, 0, W, H);
      // teinte des braises selon la phase
      var hueBase = /night|ceremony/.test(currentPhase) ? 205 :
                    currentPhase === "plateau" ? 320 :
                    currentPhase === "victory" ? 44 : 30;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.x += p.vx; p.y += p.vy; p.life++;
        p.vx += (Math.random() - 0.5) * 0.02;
        var a = Math.sin((p.life / p.max) * Math.PI) * 0.5;
        if (p.life > p.max || p.y < -10) { parts[i] = spawn(); continue; }
        ctx.beginPath();
        ctx.fillStyle = "hsla(" + (hueBase + (p.hue - 30)) + ", 85%, 62%, " + a.toFixed(3) + ")";
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(frame);
    })();
  }

  // ---- Barre d'outils (son / voix / plein écran) --------------
  function initToolbar() {
    var bar = document.getElementById("toolbar");
    var sb = document.getElementById("btn-sound");
    var fb = document.getElementById("btn-fullscreen");
    var vb = el("button", { id: "btn-voice", type: "button", title: "Voix des présentateurs" }, ["🗣"]);
    bar.insertBefore(vb, fb);

    function paintSound() {
      var on = HG.audio.isEnabled();
      sb.textContent = on ? "♪" : "✕";
      sb.classList.toggle("off", !on);
      sb.title = on ? "Couper le son" : "Activer le son";
    }
    function paintVoice() {
      var on = HG.voice && HG.voice.isEnabled();
      vb.textContent = on ? "🗣" : "🔇";
      vb.classList.toggle("off", !on);
      vb.title = on ? "Couper la voix" : "Activer la voix";
    }
    sb.addEventListener("click", function () {
      HG.audio.unlock(); HG.audio.toggle(); paintSound();
      if (HG.audio.isEnabled()) HG.audio.click();
    });
    vb.addEventListener("click", function () {
      if (HG.voice) { HG.voice.resume(); var on = HG.voice.toggle(); if (on) HG.voice.speak("Bonjour à tous.", "caesar"); }
      paintVoice();
    });
    // Icônes SVG (les glyphes 🗖/🗗 ne s'affichent pas sur beaucoup de systèmes) :
    // crochets vers les coins = agrandir, crochets repliés vers le centre = réduire.
    var ICON_EXPAND = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" ' +
      'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>';
    var ICON_COLLAPSE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" ' +
      'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true"><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/></svg>';
    function isFull() {
      return !!(document.fullscreenElement || document.webkitFullscreenElement ||
                document.mozFullScreenElement || document.msFullscreenElement);
    }
    function paintFull() {
      var on = isFull();
      fb.innerHTML = on ? ICON_COLLAPSE : ICON_EXPAND;
      fb.classList.toggle("on", on);
      fb.title = on ? "Quitter le plein écran" : "Plein écran";
      fb.setAttribute("aria-label", fb.title);
    }
    ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"]
      .forEach(function (ev) { document.addEventListener(ev, paintFull); });
    fb.addEventListener("click", function () {
      var d = document, e = d.documentElement;
      var fn = isFull()
        ? (d.exitFullscreen || d.webkitExitFullscreen || d.msExitFullscreen || function () {}).bind(d)
        : (e.requestFullscreen || e.webkitRequestFullscreen || e.msRequestFullscreen || function () {}).bind(e);
      var r;
      try { r = fn(); } catch (err) { r = null; }
      if (r && r.catch) r.catch(function () {});
      // Filet : certains navigateurs (et les fenêtres embarquées qui refusent
      // le plein écran) n'émettent pas l'événement — on repeint quand même.
      setTimeout(paintFull, 160);
    });
    paintSound(); paintVoice(); paintFull();
  }

  // ---- Barre d'actions d'écran (#actions) --------------------
  var actionsEl = null;
  function ensureActions() {
    if (!actionsEl) { actionsEl = document.getElementById("actions") || el("div", { id: "actions", hidden: true }); if (!actionsEl.parentNode) document.body.appendChild(actionsEl); }
    return actionsEl;
  }
  // setActions({ back:{label,onClick}, next:{label,onClick,prominent}, extra:[nodes], note:string })
  function setActions(cfg) {
    var a = ensureActions();
    clear(a);
    if (!cfg) { a.hidden = true; document.body.classList.remove("has-actions"); return; }
    a.hidden = false;
    document.body.classList.add("has-actions");
    a.className = cfg.discreet ? "discreet" : "";

    var left = el("div", { class: "act-left" });
    if (cfg.back) {
      left.appendChild(el("button", { class: "ghost act-back", onclick: cfg.back.onClick },
        ["← " + (cfg.back.label || "Retour")]));
    }
    (cfg.extra || []).forEach(function (n) { left.appendChild(n); });

    var right = el("div", { class: "act-right" });
    if (cfg.note) right.appendChild(el("span", { class: "act-note", html: cfg.note }));
    if (cfg.next) {
      right.appendChild(el("button", {
        class: (cfg.next.prominent ? "primary big" : "primary") + " act-next",
        onclick: cfg.next.onClick
      }, [(cfg.next.label || "Continuer") + " →"]));
    }
    a.appendChild(left);
    a.appendChild(right);
  }

  // ---- Barre de lecture (#playbar) -------------------------
  var playbarEl = null;
  function ensurePlaybar() {
    if (!playbarEl) { playbarEl = document.getElementById("playbar") || el("div", { id: "playbar", hidden: true }); if (!playbarEl.parentNode) document.body.appendChild(playbarEl); }
    return playbarEl;
  }
  function hidePlaybar() {
    ensurePlaybar().hidden = true;
    document.body.classList.remove("has-playbar");
  }
  function paintPlaybar() {
    var pb = ensurePlaybar();
    if (pb.hidden) return;
    var slider = pb.querySelector("input[type=range]");
    var lab = pb.querySelector(".speed .lab");
    var pauseBtn = pb.querySelector(".pb-pause");
    if (slider) slider.value = String(speedIdx);
    if (lab) lab.textContent = SPEED_LABEL[speedIdx];
    if (pauseBtn && activeStage) {
      var p = activeStage.isPaused();
      pauseBtn.innerHTML = p ? "▶ Reprendre" : "⏸ Pause";
      pauseBtn.classList.toggle("on", p);
    }
  }
  // Fil d'Ariane compact : une fine barre de progression fixée sur la barre de
  // lecture. Elle ne se décale jamais quand le texte grandit.
  function setStageProgress(frac) {
    var bar = ensurePlaybar().querySelector(".pb-prog i");
    if (bar) bar.style.width = Math.max(0, Math.min(1, frac || 0)) * 100 + "%";
  }
  function setStageHint(txt) {
    var h = ensurePlaybar().querySelector(".pb-hint");
    if (h) h.textContent = txt || "";
  }
  function showPlaybar() {
    var pb = ensurePlaybar();
    clear(pb);
    pb.hidden = false;
    document.body.classList.add("has-playbar");

    pb.appendChild(el("div", { class: "pb-prog" }, [el("i")]));

    var prevBtn = el("button", { class: "pb-prev", title: "Revoir le passage précédent",
      onclick: function () { if (activeStage) activeStage.prev(); } }, ["⏮"]);
    var pauseBtn = el("button", { class: "pb-pause", onclick: function () {
      if (!activeStage) return;
      if (activeStage.isPaused()) activeStage.resume(); else activeStage.pause();
      paintPlaybar();
    }}, ["⏸ Pause"]);
    var nextBtn = el("button", { class: "pb-next", title: "Passer au suivant",
      onclick: function () { if (activeStage) activeStage.next(); } }, ["⏭"]);

    var slider = el("input", { type: "range", min: "0", max: String(SPEED_MAX), step: "1",
      value: String(speedIdx), oninput: function () { setSpeed(parseInt(slider.value, 10)); } });
    var speedBox = el("div", { class: "speed" }, [
      el("span", { class: "cap" }, ["Vitesse"]), slider, el("span", { class: "lab" }, [SPEED_LABEL[speedIdx]])
    ]);

    pb.appendChild(el("div", { class: "grp" }, [prevBtn, pauseBtn, nextBtn]));
    pb.appendChild(el("span", { class: "pb-hint" }));
    pb.appendChild(speedBox);
    paintPlaybar();
  }

  // =========================================================
  //  SCÈNE DE PRÉSENTATION — un « beat » à la fois
  // =========================================================
  // beat : { kicker, portraits:[{id,dead,cap,big,camp,campLabel,more}], camps,
  //          text | lines:[...], cls, cause, killer, betray,
  //          stamp:{text,kind}, cannon, voice:{who}, hold, music, stopMusic }
  //   camps + portraits[].camp : chaque camp est encadré à l'écran — on voit
  //   qui se bat AVEC qui (alliances) et qui trahit qui.
  //   stamp : gros bandeau d'un mot (« Trahison ») posé au-dessus du texte.
  //   lines[] : plusieurs phrases sur le même « plan » (mêmes portraits) qui
  //   s'accumulent une à une dans la même fenêtre. Un dénouement (mort /
  //   blessure) reste un beat distinct poussé APRÈS.
  //   cannon : un tribut vient de tomber EN JEU (bain de sang, manches,
  //   duel) → flash + VRAI coup de canon. La cérémonie des disparus, elle,
  //   n'utilise plus le canon : voir fallen.js (musique dédiée).
  //   voice : narrateur qui lit le beat. Si absent, la narration lit quand
  //   même le texte (voix « announcer » par défaut) dès qu'elle est activée
  //   — c'est le comportement voulu pour que tout ce qui concerne le jeu
  //   soit lu. Mettre explicitement `voice: null` (ou `false`) pour un beat
  //   qu'on NE VEUT PAS lire (ex. présentation/défilé/interviews des
  //   tributs non incarnés par un joueur — sinon lire les 24 tributs prend
  //   un temps fou).
  // Libellés de camp affichés au-dessus des cadres groupés.
  var CAMP_LABEL = { traitor: "Traître", victim: "Trahi(e)" };

  function stage(host, beats, opts) {
    opts = opts || {};
    beats = beats.filter(Boolean);
    var pace = opts.pace || 1;

    var stageEl = el("div", { class: "stage" });
    var kicker = el("div", { class: "beat-kicker" });
    var portraits = el("div", { class: "portraits" });
    var stampEl = el("div", { class: "beat-stamp", hidden: true });
    var killTag = el("div", { class: "kill-tag", hidden: true });
    var textEl = el("div", { class: "beat-text" });
    var causeEl = el("div", { class: "beat-cause", hidden: true });
    stageEl.appendChild(kicker);
    stageEl.appendChild(portraits);
    stageEl.appendChild(stampEl);
    stageEl.appendChild(killTag);
    stageEl.appendChild(textEl);
    stageEl.appendChild(causeEl);
    host.appendChild(stageEl);

    showPlaybar();

    var i = -1, lineShown = 0, timer = null, paused = false, destroyed = false,
        voiceWait = false, doneCbFired = false;

    function linesOf(b) { return (b && b.lines && b.lines.length) ? b.lines : [(b && b.text) || ""]; }
    function moreLines() { var b = beats[i]; return !!b && lineShown < linesOf(b).length; }
    // Narrateur du beat : la narration doit lire TOUT ce qui concerne le
    // jeu, donc par défaut on lit avec la voix de l'annonceur — même si le
    // beat n'a jamais explicitement demandé de voix. Seul un `voice` posé
    // à `null`/`false` (présentation/défilé/interviews des tributs non
    // incarnés, pour ne pas lire les 24 à la suite) coupe la lecture.
    function voiceWho(b) {
      if (b.voice) return b.voice.who;
      return ("voice" in b) ? null : "announcer";
    }

    function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }
    function paintProgress() { setStageProgress(beats.length ? (i + 1) / beats.length : 1); }

    // Défilement automatique : on lit sans toucher à la molette. Quand un beat
    // grandit (phrases qui s'accumulent, texte long), on fait glisser la page
    // juste ce qu'il faut pour garder le contenu visible au-dessus des barres.
    // (Animation maison : le `behavior:"smooth"` natif ne marche pas partout.)
    var scrollRAF = null, scrollSnap = null;
    function stopScrollAnim() {
      if (scrollRAF) { cancelAnimationFrame(scrollRAF); scrollRAF = null; }
      if (scrollSnap) { clearTimeout(scrollSnap); scrollSnap = null; }
    }
    function smoothScrollBy(dy) {
      stopScrollAnim();
      var startY = window.scrollY || window.pageYOffset || 0;
      var targetY = startY + dy;
      if (prefersReducedMotion()) { window.scrollTo(0, targetY); return; }
      var t0 = null, dur = Math.min(440, 130 + Math.abs(dy) * 1.5);
      function step(ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        window.scrollTo(0, Math.round(startY + dy * e));
        scrollRAF = p < 1 ? requestAnimationFrame(step) : null;
      }
      scrollRAF = requestAnimationFrame(step);
      // filet : si requestAnimationFrame est gelé (onglet non focalisé), on force la cible
      scrollSnap = setTimeout(function () { stopScrollAnim(); window.scrollTo(0, targetY); }, 550);
    }
    function bottomBarsHeight() {
      var h = 0;
      var pb = document.getElementById("playbar"); if (pb && !pb.hidden) h += pb.offsetHeight || 0;
      var ac = document.getElementById("actions"); if (ac && !ac.hidden) h += ac.offsetHeight || 0;
      return h;
    }
    function edges() {
      var vh = window.innerHeight || 0;
      return { vh: vh, top: 20, bot: vh - bottomBarsHeight() - 20 };
    }
    // Suit une phrase qui vient d'apparaître : la garder visible au-dessus des barres.
    function keepInView(node) {
      if (!node) return;
      var e = edges(); if (e.vh < 240) return;
      var r = node.getBoundingClientRect();
      var dy = 0;
      if (r.bottom > e.bot) dy = r.bottom - e.bot;
      else if (r.top < e.top) dy = r.top - e.top;
      if (Math.abs(dy) > 6) smoothScrollBy(dy);
    }
    // Nouveau beat : montrer le haut ; si le beat est trop grand pour l'écran,
    // descendre juste assez pour garder le bas (issue / cause) en vue.
    function scrollBeatIntoView(kill) {
      var e = edges(); if (e.vh < 240) return;
      var sr = stageEl.getBoundingClientRect();
      var payoff = ((kill && !causeEl.hidden) ? causeEl : textEl).getBoundingClientRect();
      var dy = 0;
      if (payoff.bottom > e.bot) dy = payoff.bottom - e.bot;   // trop grand → priorité au bas
      else if (sr.top < e.top || sr.top > e.bot - 60) dy = sr.top - e.top;
      if (Math.abs(dy) > 6) smoothScrollBy(dy);
    }
    function paintHint() {
      if (paused) { setStageHint("En pause — ▶ pour reprendre"); return; }
      if (i >= beats.length - 1 && !moreLines()) { setStageHint(""); return; }
      setStageHint(moreLines() ? "Cliquez pour la suite" : "Cliquez l'écran pour avancer");
    }

    function paintLines(b, revealAll) {
      var arr = linesOf(b);
      clear(textEl);
      arr.forEach(function (ln, idx) {
        var p = el("p", { class: "beat-line", html: ln });
        if (!revealAll && idx > 0) p.hidden = true;
        textEl.appendChild(p);
      });
      lineShown = revealAll ? arr.length : 1;
    }

    function render(revealAll) {
      var b = beats[i];
      var kill = b.cls === "kill";
      stageEl.classList.toggle("is-kill-beat", kill);

      kicker.textContent = b.kicker || "";
      kicker.style.visibility = b.kicker ? "visible" : "hidden";

      clear(portraits);
      var pics = b.portraits || [];
      // Camps : on encadre chaque groupe pour visualiser les alliances.
      var useCamps = !!b.camps && pics.some(function (pp) { return !!pp.camp; });
      var groups = [];
      pics.forEach(function (pp) {
        var key = useCamps ? (pp.camp || "solo") : "_";
        var g = groups.length && groups[groups.length - 1].key === key ? groups[groups.length - 1] : null;
        if (!g) { g = { key: key, items: [], label: null }; groups.push(g); }
        g.items.push(pp);
        if (pp.campLabel) g.label = pp.campLabel;
      });
      groups.forEach(function (g) {
        var box = portraits;
        if (useCamps) {
          var n = g.items.reduce(function (acc, pp) { return acc + (pp.more || 1); }, 0);
          box = el("div", { class: "camp camp-" + g.key + (n > 1 ? " multi" : "") });
          var lab = g.label || CAMP_LABEL[g.key] || (n > 1 ? "Alliance" : "");
          if (lab) box.appendChild(el("span", { class: "camp-tag", text: lab }));
          portraits.appendChild(box);
        }
        var row = useCamps ? el("div", { class: "camp-row" }) : box;
        if (useCamps) box.appendChild(row);
        g.items.forEach(function (pp) {
          if (pp.more) { row.appendChild(el("div", { class: "camp-more", text: "+" + pp.more })); return; }
          var t = pp.tribute || (pp.id ? HG.byId(pp.id) : null) || pp;
          if (!t || !t.district) return;
          var bg = portraitBg(t);
          var cls = "p" + (pp.dead ? " dead" : "") + ((kill || pp.big) ? " big" : "");
          var pic = bg
            ? el("div", { class: cls, style: { backgroundImage: 'url("' + bg + '")', backgroundSize: "cover", backgroundPosition: "center" } })
            : el("div", { class: cls, style: { display: "grid", placeItems: "center", fontSize: "3rem" }, text: t.emoji || "?" });
          row.appendChild(el("figure", {}, [
            pic,
            el("figcaption", { class: "pcap", html:
              "<b>" + escapeHtml(t.name) + "</b> · D" + t.district +
              (pp.cap ? " · " + escapeHtml(pp.cap) : "") })
          ]));
        });
      });
      portraits.className = "portraits" + (useCamps ? " has-camps" : "");
      portraits.style.display = pics.length ? "flex" : "none";

      // Bandeau d'un mot (trahison, défection…) : visible sans rien lire.
      var betrayBeat = !!b.betray || !!(b.stamp && b.stamp.kind === "betray");
      stageEl.classList.toggle("is-betray-beat", betrayBeat);
      stampEl.hidden = !b.stamp;
      if (b.stamp) {
        stampEl.className = "beat-stamp " + (b.stamp.kind || "");
        stampEl.textContent = b.stamp.text;
        stampEl.classList.remove("stamp-in");
        void stampEl.offsetWidth;          // relance l'animation à chaque beat
        stampEl.classList.add("stamp-in");
      }

      killTag.hidden = !kill;
      if (kill) {
        killTag.classList.toggle("betray", !!b.betray);
        killTag.innerHTML = (b.betray ? "◆ TRAHI" : "◆ ÉLIMINÉ") +
          (b.killer ? " &nbsp;·&nbsp; par <b>" + escapeHtml(b.killer) + "</b>" : "");
      }
      causeEl.hidden = !(kill && b.cause);
      if (kill && b.cause) causeEl.textContent = b.cause;

      textEl.className = "beat-text rise-in" +
        (b.cls === "event" ? " is-event" : kill ? " is-kill" :
         b.cls === "gift" ? " is-gift" : b.cls === "announce" ? " is-announce" : "");
      void textEl.offsetWidth;
      paintLines(b, revealAll);

      if (b.music) HG.audio.music(b.music, { volume: 0.3, loop: true, fadeIn: 900 });
      if (b.stopMusic) HG.audio.stopMusic(700);
      if (b.cannon) cannonFX(true);   // mort EN JEU : flash + vrai coup de canon

      paintProgress();
      paintHint();
      scrollBeatIntoView(kill);

      voiceWait = false;
      var vWho0 = voiceWho(b);
      if (vWho0 && HG.voice && HG.voice.isEnabled()) {
        voiceWait = true;
        var spoken = revealAll ? linesOf(b).join(" ") : linesOf(b)[0];
        HG.voice.speak(spoken, vWho0, { onDone: function () {
          voiceWait = false;
          if (!paused && !destroyed) scheduleNext(450);
        }});
      }
      scheduleNext(dwellMs() * (b.hold || 1) * pace * (moreLines() ? 0.62 : 1));
    }

    function revealNextLine() {
      var b = beats[i];
      var nodes = textEl.querySelectorAll(".beat-line");
      var ln = nodes[lineShown];
      if (ln) { ln.hidden = false; ln.classList.remove("rise-in"); void ln.offsetWidth; ln.classList.add("rise-in"); }
      lineShown++;
      paintHint();
      keepInView(ln || textEl);   // suit la phrase qui vient d'apparaître
      voiceWait = false;
      var vWho1 = voiceWho(b);
      if (vWho1 && HG.voice && HG.voice.isEnabled() && ln) {
        voiceWait = true;
        HG.voice.speak(linesOf(b)[lineShown - 1], vWho1, { onDone: function () {
          voiceWait = false; if (!paused && !destroyed) scheduleNext(450);
        }});
      }
      scheduleNext(dwellMs() * (b.hold || 1) * pace * (moreLines() ? 0.62 : 1));
    }

    function scheduleNext(ms) {
      clearTimer();
      if (paused || destroyed) return;
      timer = setTimeout(function () {
        if (voiceWait) { scheduleNext(400); return; }
        advance();
      }, ms);
    }
    function advance() {
      clearTimer();
      if (destroyed) return;
      if (moreLines()) { revealNextLine(); return; }
      if (i >= beats.length - 1) {
        if (!doneCbFired) { doneCbFired = true; if (opts.onDone) opts.onDone(); }
        return;
      }
      i++; render(false);
    }

    // Clic n'importe où sur l'écran (sauf les barres du bas / boutons) = avancer.
    function onDocClick(e) {
      if (destroyed) return;
      var t = e.target;
      if (t.closest && t.closest("#playbar, #actions, #toolbar, #modal-root, a, button, input, select, label")) return;
      // les clics rapides ne doivent pas laisser de texte sélectionné
      var sel = window.getSelection && window.getSelection();
      if (sel && sel.removeAllRanges) sel.removeAllRanges();
      ctrl.next();
    }
    document.addEventListener("click", onDocClick);
    // clavier
    function onKey(e) {
      if (destroyed) return;
      if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); ctrl.next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); ctrl.prev(); }
      else if (e.key.toLowerCase && e.key.toLowerCase() === "p") { e.preventDefault();
        if (ctrl.isPaused()) ctrl.resume(); else ctrl.pause(); paintPlaybar(); }
    }
    document.addEventListener("keydown", onKey);

    var ctrl = {
      next: function () { if (HG.voice) HG.voice.cancel(); voiceWait = false; advance(); },
      prev: function () {
        if (i <= 0 && lineShown <= 1) return;
        if (HG.voice) HG.voice.cancel();
        voiceWait = false; clearTimer();
        i = Math.max(0, i - 1);
        render(true);   // beat précédent, toutes ses lignes visibles
      },
      pause: function () { paused = true; clearTimer(); if (HG.voice) HG.voice.cancel(); paintHint(); paintPlaybar(); },
      resume: function () { paused = false; paintHint(); scheduleNext(300); paintPlaybar(); },
      isPaused: function () { return paused; },
      isDone: function () { return i >= beats.length - 1 && !moreLines(); },
      skipToEnd: function () {
        if (destroyed || doneCbFired) return;
        if (HG.voice) HG.voice.cancel();
        voiceWait = false; clearTimer();
        i = beats.length - 1;
        if (i < 0) { doneCbFired = true; if (opts.onDone) opts.onDone(); return; }
        render(true);
        clearTimer();
        doneCbFired = true;
        if (opts.onDone) opts.onDone();
      },
      destroy: function () {
        destroyed = true; clearTimer(); stopScrollAnim();
        document.removeEventListener("keydown", onKey);
        document.removeEventListener("click", onDocClick);
        if (HG.voice) HG.voice.cancel();
      }
    };
    activeStage = ctrl;
    advance();
    return ctrl;
  }

  // ---- Révélation simple (compat) ----------------------------
  function revealFeed(container, entries, opts) {
    opts = opts || {};
    var delay = opts.delay != null ? opts.delay : 900;
    var onEach = opts.onEach || function () {};
    var i = 0;
    return new Promise(function (resolve) {
      function step() {
        if (i >= entries.length) { resolve(); return; }
        var e = entries[i];
        var line = el("div", { class: "line " + (e.cls || ""), html: e.text });
        container.appendChild(line);
        line.scrollIntoView({ behavior: "smooth", block: "nearest" });
        onEach(e, line, i);
        i++;
        setTimeout(step, e.pause || delay);
      }
      step();
    });
  }

  HG.ui = {
    el: el, clear: clear, sleep: sleep, escapeHtml: escapeHtml,
    prefersReducedMotion: prefersReducedMotion,
    sealSVG: sealSVG, tributeCard: tributeCard, tributeSubtitle: tributeSubtitle,
    register: register, go: go, currentScreen: function () { return current; },
    openModal: openModal, closeModal: closeModal,
    cannon: function () { cannonFX(true); },
    cannonFX: cannonFX,
    revealFeed: revealFeed,
    stage: stage,
    setActions: setActions,
    setPhase: setPhase, currentPhase: function () { return currentPhase; },
    speed: speed, setSpeed: setSpeed, dwellMs: dwellMs, speedFactor: speedFactor,
    isAuto: isAuto,
    playCountdown: playCountdown,
    pauseStage: function () { if (activeStage && !activeStage.isPaused()) activeStage.pause(); },
    activeStage: function () { return activeStage; },

    boot: function () {
      app = document.getElementById("app");
      startEmbers();
      initToolbar();
      ensurePlaybar();
      ensureActions();
    }
  };

})(window.HG = window.HG || {});
