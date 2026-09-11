/* =========================================================================
   screens/fallen.js — « Ceux qui sont tombés » : projection dans le ciel
   nocturne, portraits en noir et blanc qui s'enchaînent sur « The Fallen »
   (assets/sounds/fallen.mp3) — plus de coup de canon ici : le canon, c'est
   pour l'instant de la mort EN JEU (voir ui.js). Après le dernier portrait :
   tous les disparus du jour à l'écran.
   ========================================================================= */
(function (HG) {
  "use strict";
  var el = HG.ui.el;

  HG.ui.register("fallen", function () {
    HG.ui.setPhase("ceremony");
    var st = HG.state.get();
    var queue = st.fallenQueue.slice();
    st.fallenQueue = [];

    var root = el("div", { class: "stack fade-in" });
    root.appendChild(el("p", { class: "kicker center", text: "Fin du jour " + st.day + " · le ciel se souvient" }));
    root.appendChild(el("h1", { class: "center", text: "Ceux qui sont tombés" }));

    var sky = el("div", { class: "sky" });
    for (var i = 0; i < 55; i++) {
      sky.appendChild(el("span", { class: "star", style: {
        left: (Math.random() * 100) + "%", top: (Math.random() * 100) + "%",
        animationDelay: (Math.random() * 4) + "s"
      }}));
    }
    var stageBox = el("div", { style: { position: "relative", zIndex: 2, minHeight: "46vh", display: "grid", placeItems: "center" } });
    sky.appendChild(stageBox);
    root.appendChild(sky);

    var idx = 0, stopped = false, showedAll = false;
    var reduce = HG.ui.prefersReducedMotion();
    // Portraits plus rapprochés que le reste du jeu, mais pas stroboscopiques.
    var per = reduce ? 900 : HG._clamp(Math.round(HG.ui.dwellMs() * 0.5), 2400, 3600);
    var timer = null;

    function finish() {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("click", onDocClick);
      HG.flow.afterFallen();
    }
    function skipAll() {
      if (showedAll) return;
      if (timer) clearTimeout(timer);
      idx = queue.length;
      showAll();
    }
    function paintActions() {
      HG.ui.setActions({
        extra: (queue.length && !showedAll)
          ? [el("button", { class: "ghost", onclick: skipAll }, ["⏭ Tout afficher"])]
          : [],
        next: { label: "Poursuivre les Jeux", prominent: true, onClick: finish }
      });
    }
    paintActions();

    if (!queue.length) {
      stageBox.appendChild(el("p", { class: "muted center", text: "Aucun canon aujourd'hui. Le ciel reste vide — pour cette fois." }));
      return root;
    }

    // « The Fallen » accompagne toute la cérémonie (en boucle : le nombre de
    // portraits varie selon le jour). Elle s'arrête d'elle-même en quittant
    // la phase (voir setPhase dans ui.js).
    HG.audio.music("fallen", { volume: 0.4, loop: true, fadeIn: 1100 });

    // Clic n'importe où (hors barre du bas) = portrait suivant.
    function onDocClick(e) {
      var t = e.target;
      if (t.closest && t.closest("#playbar, #actions, #toolbar, #modal-root, a, button")) return;
      if (stopped || showedAll) return;
      if (timer) clearTimeout(timer);
      step();
    }
    document.addEventListener("click", onDocClick);

    timer = setTimeout(step, reduce ? 200 : 800);

    function step() {
      if (stopped) return;
      if (idx >= queue.length) { showAll(); return; }
      var t = HG.byId(queue[idx]); idx++;
      HG.ui.clear(stageBox);
      HG.ui.cannonFX(false);          // cérémonie : juste l'éclair, plus de bruit — « The Fallen » joue déjà
      var src = t.photo || t.portrait || HG.portraitPath(t.id);
      stageBox.appendChild(el("div", { class: "fallen-portrait " + (reduce ? "fade-in" : "fallen-rise") }, [
        (t.emoji && !t.portrait && !t.photo)
          ? el("div", { style: { fontSize: "6rem" }, text: t.emoji })
          : el("img", { src: src, alt: "" }),
        el("div", { class: "fname", text: t.name }),
        el("div", { class: "fdist", text: "District " + t.district + " · " + HG.DISTRICTS[t.district].industry }),
        el("div", { class: "beat-cause", style: { marginTop: "0.6rem", display: "inline-block" }, text: t.causeOfDeath || "" })
      ]));
      timer = setTimeout(step, per);
    }

    // Tous les disparus du jour, après le dernier coup de canon.
    function showAll() {
      showedAll = true;
      document.removeEventListener("click", onDocClick);
      paintActions();
      HG.ui.clear(stageBox);
      stageBox.appendChild(el("div", { class: "stack-s center" }, [
        el("p", { class: "kicker", text: queue.length + " tribut" + (queue.length > 1 ? "s tombés" : " tombé") + " aujourd'hui" }),
        el("div", { class: "row", style: { flexWrap: "wrap", justifyContent: "center", gap: "1rem", marginTop: "0.6rem" } },
          queue.map(function (id) {
            var t = HG.byId(id);
            var src = t.photo || t.portrait || HG.portraitPath(t.id);
            return el("div", { class: "fallen-portrait" }, [
              el("img", { src: src, alt: "", style: { width: "clamp(90px, 12vw, 130px)" } }),
              el("div", { class: "fname", style: { fontSize: "0.9rem" }, text: t.name }),
              el("div", { class: "tiny muted", text: "D" + t.district })
            ]);
          }))
      ]));
    }

    return root;
  });

})(window.HG = window.HG || {});
