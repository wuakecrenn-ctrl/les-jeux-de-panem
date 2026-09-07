/* =========================================================================
   screens/victory.js — dénouement : duel final, choix des amants, sacre,
   récapitulatif complet, enregistrement au palmarès.
   ========================================================================= */
(function (HG) {
  "use strict";
  var el = HG.ui.el;

  // ---- Écran « duel final » (2 tributs, un seul vainqueur) --------
  HG.ui.register("duel", function () {
    HG.ui.setPhase("finale");
    var res = HG.sim.finalDuel();
    var root = el("div", { class: "stack fade-in" });
    root.appendChild(el("p", { class: "kicker", text: "Les Juges rabattent les derniers tributs" }));
    root.appendChild(el("h1", { text: "Le dernier affrontement" }));
    var host = el("div", {});
    root.appendChild(host);

    HG.ui.stage(host, res.beats, {});
    HG.ui.setActions({
      next: { label: "Le sacre", prominent: true, onClick: function () {
        HG.flow.toVictory(HG.living().map(function (t) { return t.id; }));
      }}
    });
    return root;
  });

  // ---- Écran « choix des amants » (règle exceptionnelle) --------
  HG.ui.register("finale", function () {
    HG.ui.setPhase("finale");
    var living = HG.living();
    var root = el("div", { class: "stack fade-in center" });
    root.appendChild(el("p", { class: "kicker", text: "Il ne reste que deux tributs — du même district" }));
    root.appendChild(el("h1", { text: "L'heure du choix" }));
    root.appendChild(el("p", { class: "muted", html: HG.commentary.claudius.loversRevoke }));
    root.appendChild(el("p", { class: "muted", style: { maxWidth: "56ch", margin: "0 auto" }, text:
      "Le Capitole veut un seul vainqueur. " + living[0].name + " et " + living[1].name +
      " tiennent chacun une poignée de baies de nightlock…" }));

    root.appendChild(el("div", { class: "row", style: { justifyContent: "center", margin: "1rem 0" } },
      living.map(function (t) { return HG.ui.tributeCard(t, { showKills: true }); })));

    function share() {
      var res = HG.sim.sharedVictory();
      HG.audio.mockingjay();
      showTransition(res.beats, function () { HG.flow.toVictory(res.victors); });
    }

    root.appendChild(el("div", { class: "btn-group", style: { justifyContent: "center" } }, [
      el("button", { class: "primary big", onclick: share }, ["🫐 Partager les baies — deux vainqueurs"]),
      el("button", { class: "danger big", onclick: function () { HG.ui.go("duel"); } }, ["Un dernier duel"])
    ]));
    return root;
  });

  function showTransition(beats, done) {
    var app = document.getElementById("app");
    HG.ui.clear(app);
    var host = el("div", { class: "stack fade-in" });
    app.appendChild(host);
    HG.ui.stage(host, beats, {});
    HG.ui.setActions({ next: { label: "Le sacre", prominent: true, onClick: done } });
  }

  // ---- Écran de victoire -----------------------------------------
  HG.ui.register("victory", function (data) {
    HG.ui.setPhase("victory");
    var st = HG.state.get();
    var victors = (data.victors || HG.living().map(function (t) { return t.id; })).map(HG.byId);
    var dual = victors.length > 1;

    // Sacre : placement 1, partie figée.
    victors.forEach(function (t) { t.placement = 1; t.alive = true; });
    if (!st.finishedAt) {
      st.finishedAt = Date.now();
      st.victors = victors.map(function (t) { return t.id; });
      // Uniquement le sifflet du geai moqueur pour annoncer le vainqueur.
      HG.audio.mockingjay();
      saveToHistory(st, victors, dual);
    }

    var root = el("div", { class: "stack fade-in center" });
    root.appendChild(el("p", { class: "kicker", text: "74ᵉ Hunger Games · retransmission finale" }));

    root.appendChild(el("div", { class: "victor-wrap" }, [
      el("div", { class: "row", style: { justifyContent: "center", gap: "1.5rem", flexWrap: "wrap" } },
        victors.map(function (t) {
          var src = t.photo || t.portrait || HG.portraitPath(t.id);
          return el("div", {}, [
            (t.emoji && !t.portrait && !t.photo)
              ? el("div", { style: { fontSize: "8rem" }, text: t.emoji })
              : el("img", { src: src, alt: "" }),
            el("h2", { style: { marginTop: "0.6rem" }, text: t.name }),
            el("p", { class: "muted tiny", text: "District " + t.district + " · " + HG.DISTRICTS[t.district].industry })
          ]);
        }))
    ]));

    root.appendChild(el("h1", { style: { marginTop: "1rem" },
      text: dual ? "Deux vainqueurs" : "Vainqueur des 74ᵉ Hunger Games" }));
    root.appendChild(el("p", { class: "muted", html: dual
      ? HG.commentary.claudius.dualVictor(victors[0].name, victors[1].name, victors[0].district)
      : HG.commentary.claudius.victor(victors[0].name) }));

    // --- Chiffres clés ---
    var topKiller = st.tributes.slice().sort(function (a, b) { return b.kills.length - a.kills.length; })[0];
    var topFavor = st.tributes.slice().sort(function (a, b) { return b.roomFavor - a.roomFavor; })[0];
    root.appendChild(el("div", { class: "row", style: { justifyContent: "center", marginTop: "1rem" } }, [
      pill("Jours de Jeux", st.day),
      pill("Tributs tombés", st.deaths.length),
      pill("Plus d'éliminations", topKiller && topKiller.kills.length ? topKiller.name + " (" + topKiller.kills.length + ")" : "—"),
      pill("Chouchou du salon", topFavor && topFavor.roomFavor ? topFavor.name : "—"),
      pill("Graine d'arène", st.seed)
    ]));

    // --- Chronologie ---
    root.appendChild(el("hr", { class: "rule" }));
    root.appendChild(el("h3", { text: "Chronologie de l'arène" }));
    var tl = el("div", { class: "recap-list", style: { textAlign: "left", maxWidth: "640px", margin: "0 auto" } });
    st.deaths.forEach(function (d) {
      var killer = d.killerId ? HG.byId(d.killerId) : null;
      tl.appendChild(el("div", { class: "r" }, [
        el("span", { class: "rd", text: (d.time === "night" ? "Nuit " : "Jour ") + d.day }),
        el("span", { html: "<b>" + HG.escapeHtml(d.name) + "</b> <span class='muted tiny'>D" + d.district + "</span> — " +
          HG.escapeHtml(d.cause) + (killer && killer.id !== d.id ? " <span class='muted tiny'>(" + HG.escapeHtml(killer.name) + ")</span>" : "") })
      ]));
    });
    victors.forEach(function (t) {
      tl.appendChild(el("div", { class: "r", style: { borderColor: "var(--gold)" } }, [
        el("span", { class: "rd", style: { color: "var(--gold-hi)" }, text: "Sacre" }),
        el("span", { html: "<b class='who'>" + HG.escapeHtml(t.name) + "</b> — vainqueur" })
      ]));
    });
    root.appendChild(tl);

    // --- Classement complet ---
    root.appendChild(el("h3", { style: { marginTop: "1.4rem" }, text: "Classement final" }));
    var rows = st.tributes.slice().sort(function (a, b) {
      return (a.placement || 99) - (b.placement || 99);
    });
    var table = el("table", { class: "board" }, [
      el("tr", {}, [ th("Rang"), th("Tribut"), th("District"), th("Élim."), th("Sortie") ])
    ].concat(rows.map(function (t) {
      return el("tr", { class: t.placement === 1 ? "" : "dead" }, [
        td(t.placement === 1 ? "①" : (t.placement || "—")),
        td(t.name + (t.isPlayer ? " ★" : "")),
        td("D" + t.district + " · " + HG.DISTRICTS[t.district].industry),
        td(t.kills.length || ""),
        td(t.placement === 1 ? "Vainqueur" : ((t.timeOfDeath === "night" ? "Nuit " : "Jour ") + (t.dayOfDeath || "1")))
      ]);
    })));
    root.appendChild(el("div", { style: { overflowX: "auto" } }, [table]));

    root.appendChild(el("hr", { class: "rule" }));
    root.appendChild(el("div", { class: "btn-group", style: { justifyContent: "center" } }, [
      el("button", { class: "primary big", onclick: function () { HG.flow.replaySameGroup(); } }, ["Rejouer avec le même groupe"]),
      el("button", { class: "", onclick: function () { HG.flow.newGame(); } }, ["Nouveau groupe"]),
      el("button", { class: "ghost", onclick: function () { HG.flow.home(); } }, ["Accueil"])
    ]));
    root.appendChild(el("p", { class: "tiny muted", style: { marginTop: "0.6rem" },
      text: "Graine d'arène « " + st.seed + " » — pour retrouver la même partie." }));

    HG.ui.setActions({
      back: { label: "Accueil", onClick: function () { HG.flow.home(); } },
      next: { label: "Rejouer (même groupe)", prominent: true, onClick: function () { HG.flow.replaySameGroup(); } }
    });
    return root;
  });

  function saveToHistory(st, victors, dual) {
    victors.forEach(function (t) {
      HG.storage.addVictory({
        name: t.name,
        canonName: t.canonName,
        district: t.district,
        arena: st.seed,
        days: st.day,
        kills: t.kills.length,
        dual: dual,
        coName: dual ? victors.filter(function (x) { return x !== t; }).map(function (x) { return x.name; })[0] : null,
        isPlayer: t.isPlayer,
        date: Date.now()
      });
    });
  }

  function pill(label, value) {
    return el("span", { class: "count-pill", html: label + " <b>" + HG.escapeHtml(String(value)) + "</b>" });
  }
  function th(t) { return el("th", { text: t }); }
  function td(t) { return el("td", { text: String(t) }); }

})(window.HG = window.HG || {});
