/* =========================================================================
   screens/bloodbath.js — phase interactive : la Corne d'abondance.
   Chaque joueur choisit son action et ses alliés (sans pouvoir relier
   deux clans ennemis).
   ========================================================================= */
(function (HG) {
  "use strict";
  var el = HG.ui.el;

  var actions = {};     // tributeId -> "rush" | "grab" | "flee"
  var allies = {};      // tributeId -> [otherId, ...]  (choix des joueurs)
  var resolved = null;

  HG.bloodbathModule = { reset: function () { actions = {}; allies = {}; resolved = null; } };

  // Re-rendu de l'écran SANS remonter la page (les boutons sont en bas).
  function rerender() {
    var y = window.scrollY || window.pageYOffset || 0;
    HG.ui.go("bloodbath");
    window.scrollTo(0, y);
  }

  var ACTION_LABELS = {
    rush: ["Foncer sur la Corne", "butin max · danger max"],
    grab: ["Attraper et fuir", "un sac · risque moyen"],
    flee: ["Filer vers les bois", "rien · le plus sûr"]
  };

  // ---- Résolution des « camps » (Carrières + composantes du graphe d'alliances) ----
  function playerAllianceComponent(id) {
    var seen = {}, stack = [id];
    while (stack.length) {
      var cur = stack.pop();
      if (seen[cur]) continue;
      seen[cur] = true;
      (allies[cur] || []).forEach(function (n) { if (!seen[n]) stack.push(n); });
      Object.keys(allies).forEach(function (k) {
        if (!seen[k] && (allies[k] || []).indexOf(cur) !== -1) stack.push(k);
      });
    }
    return Object.keys(seen);
  }
  // Un joueur incarnant un Carrière qui choisit autre chose que « Foncer »
  // fausse compagnie à la meute : il n'en fait plus partie.
  function inCareerPack(t) {
    if (!t || !t.career) return false;
    if (t.isPlayer && actions[t.id] && actions[t.id] !== "rush") return false;
    return true;
  }
  // identifiant stable du camp d'un tribut, ou null s'il est seul
  function campOf(id) {
    var t = HG.byId(id);
    if (inCareerPack(t)) return "careers";
    var comp = playerAllianceComponent(id);
    return comp.length > 1 ? "grp:" + comp.slice().sort().join(",") : null;
  }
  function careerNames() {
    return HG.living().filter(inCareerPack).map(function (t) { return t.name; });
  }

  HG.ui.register("bloodbath", function () {
    HG.ui.setPhase("bloodbath");
    if (resolved) return renderResolution();

    var players = HG.livingPlayers();
    var root = el("div", { class: "stack fade-in" });
    root.appendChild(el("p", { class: "kicker", text: "Jour 1 · la Corne d'abondance" }));
    root.appendChild(el("h1", { text: "Le bain de sang" }));
    root.appendChild(el("p", { class: "muted", html:
      "Tout se joue en quelques secondes. Chaque joueur choisit : se jeter sur les " +
      "armes et les vivres, en attraper juste un et détaler, ou fuir sans rien." }));

    // --- Alliances déjà en place ---
    var careers = careerNames();
    var alliancePanel = el("div", { class: "frame tight stack-s" }, [
      el("h3", { text: "Alliances déjà formées" }),
      el("div", { class: "row", style: { flexWrap: "wrap" } }, [
        el("span", { class: "count-pill", html: "🐺 Meute des Carrières &nbsp;·&nbsp; <b>" + careers.length + "</b>" })
      ].concat(careers.map(function (n) { return el("span", { class: "tiny muted", text: n }); })))
    ]);
    // alliances joueurs (composantes de taille > 1, hors carrières)
    var shownComp = {};
    players.forEach(function (t) {
      var comp = playerAllianceComponent(t.id).filter(function (id) { var x = HG.byId(id); return x && !x.career; });
      if (comp.length < 2) return;
      var key = comp.slice().sort().join(",");
      if (shownComp[key]) return; shownComp[key] = true;
      alliancePanel.appendChild(el("div", { class: "row", style: { flexWrap: "wrap" } }, [
        el("span", { class: "count-pill", text: "Alliance" })
      ].concat(comp.map(function (id) { return el("span", { class: "tiny", style: { color: "var(--accent-hi)" }, text: HG.byId(id).name }); }))));
    });
    root.appendChild(alliancePanel);

    if (!players.length) {
      root.appendChild(el("p", { class: "tiny muted", text: "Aucun joueur incarné : tous les tributs décident seuls." }));
    }
    players.forEach(function (t) {
      if (!actions[t.id]) actions[t.id] = t.career ? "rush" : "grab";
      root.appendChild(playerCard(t));
    });

    HG.ui.setActions({
      back: { label: "Prélude", onClick: function () { HG.ui.go("prelude", { step: 4 }); } },
      note: players.length ? "Les tributs du film décideront seuls." : "",
      next: { label: "▶ Lancer le compte à rebours", prominent: true, onClick: runGong }
    });
    return root;
  });

  function playerCard(t) {
    var actionRow = el("div", { class: "btn-group", style: { marginTop: "0.5rem" } });
    ["rush", "grab", "flee"].forEach(function (key) {
      actionRow.appendChild(el("button", {
        class: actions[t.id] === key ? "primary" : "",
        onclick: function () { actions[t.id] = key; HG.audio.click(); rerender(); }
      }, [
        el("span", {}, [ACTION_LABELS[key][0]]),
        el("span", { class: "tiny", style: { display: "block", opacity: 0.75, letterSpacing: 0 }, text: ACTION_LABELS[key][1] })
      ]));
    });

    var allyIds = playerAllianceComponent(t.id).filter(function (id) { return id !== t.id; });
    var allyChips = allyIds.map(function (id) {
      var a = HG.byId(id);
      return el("span", { class: "count-pill", text: (a ? a.name : id) + (a && a.career ? " 🐺" : "") });
    });

    var leftPack = t.career && actions[t.id] && actions[t.id] !== "rush";

    return el("div", { class: "frame tight stack-s d" + t.district }, [
      el("div", { class: "row between" }, [
        el("div", { class: "row" }, [
          avatarThumb(t),
          el("div", {}, [
            el("div", { style: { color: "var(--accent-hi)", fontFamily: "var(--serif-display)" }, text: t.name }),
            el("div", { class: "tiny muted", text: "District " + t.district + " · " + HG.DISTRICTS[t.district].industry +
              (t.career ? (leftPack ? " · ex-Carrière" : " · Carrière") : "") })
          ])
        ]),
        el("button", { class: "ghost tiny", onclick: function () { openAllyDialog(t); } }, ["S'allier avec…"])
      ]),
      actionRow,
      t.career ? el("p", { class: "tiny muted", text: leftPack
        ? t.name + " tourne le dos à la meute des Carrières."
        : "« Foncer » = rester avec la meute des Carrières. Tout autre choix, et " + t.name + " la quitte." }) : null,
      allyChips.length ? el("div", { class: "row" }, [el("span", { class: "tiny muted", text: "Alliés :" })].concat(allyChips)) : null
    ]);
  }

  function avatarThumb(t) {
    var style = { width: "44px", height: "56px", flex: "none", backgroundSize: "cover", backgroundPosition: "center", border: "1px solid var(--line)" };
    if (t.photo) style.backgroundImage = 'url("' + t.photo + '")';
    else style.backgroundImage = 'url("' + (t.portrait || HG.portraitPath(t.id)) + '")';
    return el("div", { style: style });
  }

  function openAllyDialog(t) {
    var picked = (allies[t.id] || []).slice();
    var msg = el("p", { class: "tiny", style: { color: "var(--red-hi)", minHeight: "1em", margin: 0 } });

    // Un tribut "o" est-il compatible avec la sélection courante ?
    // Règle : on ne peut pas relier deux clans (meute des Carrières + une
    // alliance de joueurs, ou deux alliances de joueurs distinctes) ni
    // s'allier à la fois avec la meute et avec quelqu'un hors meute.
    function conflictFor(o) {
      var oCareer = !!o.career;
      var oGroup = campOf(o.id);            // "careers" | "grp:…" | null
      // Le tribut lui-même compte s'il est déjà dans un clan.
      var sawCareer = false, sawNonCareer = false, groups = {};
      var selfGroup = campOf(t.id);
      if (t.career) { sawCareer = true; groups.careers = true; }
      else if (selfGroup) { sawNonCareer = true; groups[selfGroup] = true; }
      picked.forEach(function (id) {
        var x = HG.byId(id);
        if (x && x.career) { sawCareer = true; groups.careers = true; }
        else sawNonCareer = true;
        var g = campOf(id);
        if (g) groups[g] = true;
      });
      if (oCareer && sawNonCareer) return "la meute des Carrières et ceux qui la fuient ne font pas alliance";
      if (!oCareer && sawCareer) return "impossible d'être à la fois avec la meute et hors meute";
      if (oGroup && Object.keys(groups).length && !groups[oGroup]) return o.name + " est déjà dans un autre clan";
      return null;
    }

    var others = HG.living().filter(function (x) { return x.id !== t.id; });
    others.sort(function (a, b) { return (b.career ? 1 : 0) - (a.career ? 1 : 0); });

    var buttons = {};
    var list = el("div", { class: "grid", style: { gridTemplateColumns: "1fr 1fr", gap: "0.4rem", maxHeight: "46vh", overflowY: "auto" } });
    others.forEach(function (o) {
      var b = el("button", {
        class: picked.indexOf(o.id) !== -1 ? "primary" : "ghost",
        style: { justifyContent: "flex-start" },
        onclick: function () {
          var i = picked.indexOf(o.id);
          if (i !== -1) { picked.splice(i, 1); msg.textContent = ""; repaint(); return; }
          var c = conflictFor(o);
          if (c) { msg.textContent = "Impossible : " + c + "."; return; }
          picked.push(o.id); msg.textContent = ""; repaint();
        }
      }, [o.name + " · D" + o.district + (o.career ? " 🐺" : (o.isPlayer ? " (joueur)" : ""))]);
      buttons[o.id] = b;
      list.appendChild(b);
    });

    function repaint() {
      others.forEach(function (o) {
        var b = buttons[o.id];
        var on = picked.indexOf(o.id) !== -1;
        var blocked = !on && !!conflictFor(o);
        b.className = on ? "primary" : "ghost";
        b.disabled = blocked;
        b.style.opacity = blocked ? "0.35" : "1";
      });
    }
    repaint();

    HG.ui.openModal(el("div", { class: "stack" }, [
      el("h2", { html: "Alliés de <span style='text-transform:none'>" + t.name + "</span>" }),
      el("p", { class: "tiny muted", text:
        "Une alliance combat ensemble jusqu'à ce que quelqu'un la brise. Deux tributs d'un " +
        "même district ne se trahissent jamais. On ne peut pas s'allier avec la meute des " +
        "Carrières ET avec ses proies en même temps." }),
      msg,
      list,
      el("div", { class: "row" }, [
        el("button", { class: "primary", onclick: function () {
          allies[t.id] = picked; HG.ui.closeModal(); rerender();
        }}, ["Valider"]),
        el("button", { class: "ghost", onclick: HG.ui.closeModal }, ["Annuler"])
      ])
    ]));
  }

  function runGong() {
    HG.audio.unlock();
    Object.keys(allies).forEach(function (pid) {
      var group = [pid].concat(allies[pid] || []);
      if (group.length >= 2) HG.formAlliance(group);
    });
    resolved = HG.sim.bloodbath(Object.assign({}, actions));
    // Compte à rebours du film → corne de brume → on entre dans l'arène.
    HG.ui.setActions(null);
    window.scrollTo(0, 0);
    HG.ui.playCountdown(function () { HG.ui.go("bloodbath"); });
  }

  function renderResolution() {
    var root = el("div", { class: "stack fade-in" });
    var host = el("div", {});
    root.appendChild(host);
    HG.ui.stage(host, resolved.beats, {});
    HG.ui.setActions({
      next: { label: "Première nuit dans l'arène", prominent: true, onClick: function () { HG.flow.afterBloodbath(); } }
    });
    return root;
  }

})(window.HG = window.HG || {});
