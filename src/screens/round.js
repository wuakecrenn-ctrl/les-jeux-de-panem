/* =========================================================================
   screens/round.js — une manche d'arène : événement, incidents, rencontres
   (scène « beat par beat »), puis vote de sponsor du salon et cotes.
   ========================================================================= */
(function (HG) {
  "use strict";
  var el = HG.ui.el;

  var current = null;
  var giftGiven = false;

  HG.roundModule = { reset: function () { current = null; giftGiven = false; } };

  HG.ui.register("round", function () {
    if (!current) { current = { result: HG.sim.runRound() }; giftGiven = false; }
    var r = current.result;
    HG.ui.setPhase(r.phase === "day" ? "arena-day" : "arena-night");
    var phaseWord = (r.phase === "day" ? "Jour " : "Nuit ") + r.day;

    var root = el("div", { class: "stack" });
    root.appendChild(el("div", { class: "row between", style: { alignItems: "center" } }, [
      el("p", { class: "kicker", style: { margin: 0 }, text: phaseWord + " · " + r.event.title }),
      el("span", { class: "count-pill", html: "En vie <b>" + HG.living().length + "</b> / 24" })
    ]));

    var host = el("div", {});
    root.appendChild(host);
    var recap = el("div", { class: "stack", hidden: true });
    root.appendChild(recap);

    function proceed() { HG.flow.afterRound(r); }
    var atRecap = false;
    function showRecap() {
      if (atRecap) return;
      atRecap = true;
      buildRecap(recap, r, proceed);
      recap.hidden = false;
      if (HG.living().length > 2) recap.scrollIntoView({ behavior: "smooth", block: "nearest" });
      HG.ui.setActions({
        next: { label: r.phase === "night" ? "Cérémonie des disparus" : "Manche suivante", prominent: true, onClick: proceed }
      });
    }

    // Pendant la manche : bouton discret « Passer » → va au récap (et donc au
    // vote), il ne saute pas la manche.
    HG.ui.setActions({
      discreet: true,
      next: { label: "Passer au vote", onClick: function () {
        var s = HG.ui.activeStage();
        if (s && s.skipToEnd) s.skipToEnd(); else showRecap();
      }}
    });

    HG.ui.stage(host, r.beats, { onDone: showRecap });

    return root;
  });

  var STAT_LABEL = { str: "Force", agi: "Agilité", cun: "Ruse", sur: "Survie", cha: "Charisme" };
  function giftAdvantage(g) {
    var parts = [];
    if (g.heal) parts.push("soigne " + g.heal + " blessure" + (g.heal > 1 ? "s" : ""));
    Object.keys(g.bonus || {}).forEach(function (k) {
      parts.push("+" + g.bonus[k] + " " + (STAT_LABEL[k] || k));
    });
    return parts;
  }

  function buildRecap(recap, r, proceed) {
    HG.ui.clear(recap);
    if (HG.living().length <= 2) return;
    recap.appendChild(el("hr", { class: "rule" }));

    // -- Vote de sponsor — message mis en avant --
    var voteWrap = el("div", { class: "frame vote-frame", style: { borderColor: "var(--accent)", textAlign: "center" } });
    voteWrap.appendChild(el("h2", { style: { color: "var(--accent-hi)" }, text: "🪂 À vous de voter !" }));
    voteWrap.appendChild(el("p", { style: { fontSize: "1.05rem" }, html:
      "Tout le salon lève la main pour son <b>tribut préféré</b> — même ceux dont le personnage est déjà tombé. " +
      "L'animateur clique sur le gagnant du vote : un <b>parachute</b> lui est envoyé." }));

    var grid = el("div", { class: "grid tributes vote-grid", style: { marginTop: "0.8rem" } });

    function castVote(t, card) {
      if (giftGiven) return;
      giftGiven = true;
      var g = HG.sim.giveRoomGift(t.id);
      HG.audio.parachute();

      // petite animation : parachute qui descend sur la carte gagnante
      card.classList.add("vote-won");
      card.appendChild(el("div", { class: "vote-chute", text: "🪂" }));
      grid.querySelectorAll(".tcard").forEach(function (c) {
        c.classList.remove("selectable");
        if (c !== card) c.classList.add("vote-dim");
      });
      if (skipBtn) skipBtn.hidden = true;

      // bandeau : l'avantage mis en évidence
      var adv = giftAdvantage(g);
      voteWrap.appendChild(el("div", { class: "gift-banner rise-in" }, [
        el("div", { class: "gb-head", html:
          "🪂 <b>" + HG.escapeHtml(g.label) + "</b> pour <span class='who'>" + HG.escapeHtml(t.name) + "</span>" }),
        el("div", { class: "gb-blurb", text: g.blurb }),
        adv.length ? el("div", { class: "gb-adv" }, adv.map(function (a) {
          return el("span", { class: "adv-chip", text: a });
        })) : null
      ]));
    }

    HG.living().forEach(function (t) {
      grid.appendChild(HG.ui.tributeCard(t, {
        showGauges: true, showKills: true, showWeapon: true, showSkills: HG.state.get().mode === "advanced",
        selectable: !giftGiven,
        onClick: castVote
      }));
    });
    voteWrap.appendChild(grid);

    var skipBtn = el("button", { class: "ghost tiny", style: { marginTop: "0.8rem" }, onclick: function () {
      if (giftGiven) return;
      giftGiven = true;
      grid.querySelectorAll(".tcard").forEach(function (c) { c.classList.remove("selectable"); c.classList.add("vote-dim"); });
      skipBtn.hidden = true;
      voteWrap.appendChild(el("p", { class: "muted", style: { marginTop: "0.8rem" }, text:
        "Vote passé — pas de parachute cette manche." }));
    }}, ["Passer le vote"]);
    voteWrap.appendChild(skipBtn);
    recap.appendChild(voteWrap);

    // -- Cotes : tous les tributs vivants --
    var odds = HG.computeOdds();
    recap.appendChild(el("div", { class: "frame tight" }, [
      el("h3", { text: "Cotes des parieurs — « que le sort vous soit favorable »" }),
      el("div", { style: { maxHeight: "38vh", overflowY: "auto" } }, odds.map(function (o) {
        return el("div", { class: "odds-line" }, [
          el("span", { html: (o.isPlayer ? "★ " : "") + HG.ui.escapeHtml(o.name) + " <span class='muted tiny'>D" + o.district + "</span>" }),
          el("span", { class: "o", text: o.odds })
        ]);
      }))
    ]));
  }

})(window.HG = window.HG || {});
