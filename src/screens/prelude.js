/* =========================================================================
   screens/prelude.js — 4 étapes bien distinctes :
     1. Présentation des tributs (district par district)
     2. Défilé des chars
     3. Séances privées (notes des Juges)
     4. Plateau de Caesar Flickerman (interviews + musique)
   ========================================================================= */
(function (HG) {
  "use strict";
  var el = HG.ui.el;

  var computed = null;

  function districtOrder() {
    var st = HG.state.get();
    var playerDs = {};
    st.tributes.forEach(function (t) { if (t.isPlayer) playerDs[t.district] = true; });
    var first = [], rest = [];
    for (var d = 1; d <= 12; d++) (playerDs[d] ? first : rest).push(d);
    return first.concat(rest);
  }
  function tributesOfDistrict(d) {
    return HG.state.get().tributes.filter(function (t) { return t.district === d; });
  }
  function stripWho(s) { return String(s).replace(/<\/?span[^>]*>/g, ""); }

  function compute() {
    var st = HG.state.get();
    var rng = st.rng;
    var order = districtOrder();

    // Notes des Juges
    st.tributes.forEach(function (t) {
      var s = t.stats;
      var base = (s.str + s.agi + s.cun + s.sur) / 4 + s.cha * 0.15;
      base += (t.career ? 1.5 : 0) + rng.f() * 2.4 - 0.8;
      if (t.skills) base += t.skills.length * 0.6;
      t.trainingScore = HG._clamp(Math.round(base), 1, 12);
    });

    // --- 1. Présentation des tributs ---
    // Les 3 premières phrases sont dites à voix haute ; le tour des districts
    // est un montage visuel rapide (sans voix) pour ne pas traîner.
    var intro = HG.commentary.claudius.presentation.slice(0, 3);
    var presentBeats = intro.map(function (line, i) {
      return { text: line, cls: i === 0 ? "announce" : "event", voice: { who: "announcer" }, hold: i === 0 ? 1.2 : 1 };
    });
    order.forEach(function (d) {
      var trio = tributesOfDistrict(d);
      var careers = HG.DISTRICTS[d].career;
      var hasPlayer = trio.some(function (t) { return t.isPlayer; });
      presentBeats.push({
        kicker: HG.DISTRICTS[d].name + " · " + HG.DISTRICTS[d].industry,
        portraits: trio.map(function (t) { return { id: t.id, cap: t.isPlayer ? "joueur" : null }; }),
        text: "<b>District " + d + "</b>" + (careers ? " — Carrières" : "") + " · " +
          trio.map(function (t) { return "<span class='who'>" + t.name + "</span>"; }).join(" & "),
        cls: "", hold: 0.85,
        voice: hasPlayer ? { who: "announcer" } : null
      });
    });

    // --- 2. Défilé des chars ---
    var chariotBeats = [
      { text: "Et maintenant — l'ouverture des Jeux : le défilé des chars le long de la Grande Avenue !", cls: "announce", voice: { who: "announcer" }, hold: 1.15 }
    ];
    order.forEach(function (d) {
      var trio = tributesOfDistrict(d);
      var best = null, hasPlayer = false;
      trio.forEach(function (t) {
        var c = HG.commentary.chariot(t, rng);
        t.sponsor = HG._clamp(t.sponsor + c.gain, 0, 100);
        if (!best || c.gain > best.gain) best = c;
        if (t.isPlayer) hasPlayer = true;
      });
      chariotBeats.push({
        kicker: "Char du " + HG.DISTRICTS[d].name,
        portraits: trio.map(function (t) { return { id: t.id }; }),
        text: best.text, cls: "", hold: 0.9,
        voice: hasPlayer ? { who: "announcer" } : null
      });
    });

    // --- 4. Interviews de Caesar ---
    var ivBeats = [
      { text: "Trois minutes chacun sur mon plateau pour séduire Panem. Commençons !", cls: "announce", voice: { who: "caesar" }, music: "caesar", hold: 1.1 }
    ];
    order.forEach(function (d) {
      tributesOfDistrict(d).forEach(function (t) {
        var iv = HG.commentary.interview(t, rng);
        var txt = t.isPlayer
          ? "<span class='muted'>" + iv.intro + "</span> <span class='who'>" + t.name + "</span> !<br><em class='q'>« " + stripWho(iv.line) + " »</em>"
          : "<span class='who'>" + t.name + "</span> — <em class='q'>« " + stripWho(iv.line) + " »</em>";
        ivBeats.push({
          kicker: HG.DISTRICTS[d].name + " · plateau de Caesar",
          portraits: [{ id: t.id }],
          text: txt, cls: "", hold: t.isPlayer ? 1 : 0.8,
          // Caesar parle pour les joueurs ; les autres passent en montage.
          voice: t.isPlayer ? { who: "caesar" } : null
        });
      });
    });
    ivBeats[ivBeats.length - 1].stopMusic = true;

    computed = { presentBeats: presentBeats, chariotBeats: chariotBeats, ivBeats: ivBeats };
  }

  HG.preludeModule = { reset: function () { computed = null; } };

  var STEPS = [
    { phase: "presentation", title: "Présentation des tributs", key: "presentBeats", next: "Défilé des chars" },
    { phase: "chariots",     title: "Défilé des chars",         key: "chariotBeats", next: "Séances privées" },
    { phase: "training",     title: "Séances privées",          grid: true,          next: "Plateau de Caesar" },
    { phase: "plateau",      title: "Plateau de Caesar",        key: "ivBeats",      next: "Entrer dans l'arène" }
  ];

  HG.ui.register("prelude", function (data) {
    if (!computed) compute();
    var step = Math.max(0, Math.min(STEPS.length - 1, (data.step || 1) - 1));
    var S = STEPS[step];
    HG.ui.setPhase(S.phase);

    var root = el("div", { class: "stack fade-in" });
    root.appendChild(el("p", { class: "kicker", text: "Avant l'arène · le grand spectacle du Capitole" }));
    root.appendChild(el("h1", { text: S.title }));

    function goStep(n) {
      if (n < 0) { HG.flow.backToRoster(); return; }
      if (n >= STEPS.length) { HG.audio.stopMusic(500); HG.flow.startBloodbath(); return; }
      HG.ui.go("prelude", { step: n + 1 });
    }

    if (S.grid) {
      root.appendChild(el("p", { class: "muted", text: "Les Juges notent chaque tribut de 1 à 12. Le Capitole entier retient son souffle." }));
      var grid = el("div", { class: "grid tributes" });
      HG.state.get().tributes.forEach(function (t) {
        var card = HG.ui.tributeCard(t, { showSkills: HG.state.get().mode === "advanced", showWeapon: true });
        card.appendChild(el("div", { class: "body", style: { paddingTop: 0 } }, [
          el("div", { class: "row between" }, [
            el("span", { class: "tiny muted", text: "Note des Juges" }),
            el("span", { style: { color: "var(--accent-hi)", fontFamily: "var(--serif-display)", fontSize: "1.35rem" }, text: t.trainingScore })
          ])
        ]));
        grid.appendChild(card);
      });
      root.appendChild(grid);
      HG.ui.setActions({
        back: { label: "Défilé", onClick: function () { goStep(step - 1); } },
        extra: [el("button", { class: "ghost", onclick: function () { HG.flow.startBloodbath(); } }, ["Tout passer → l'arène"])],
        next: { label: S.next, prominent: true, onClick: function () { goStep(step + 1); } }
      });
      return root;
    }

    var host = el("div", {});
    root.appendChild(host);
    HG.ui.stage(host, computed[S.key], { pace: 0.8 });
    HG.ui.setActions({
      back: step === 0 ? { label: "Moisson", onClick: function () { goStep(-1); } }
                       : { label: STEPS[step - 1].title, onClick: function () { goStep(step - 1); } },
      extra: [el("button", { class: "ghost", onclick: function () { HG.audio.stopMusic(400); HG.flow.startBloodbath(); } }, ["Tout passer → l'arène"])],
      next: { label: S.next, prominent: true, onClick: function () { goStep(step + 1); } }
    });
    return root;
  });

})(window.HG = window.HG || {});
