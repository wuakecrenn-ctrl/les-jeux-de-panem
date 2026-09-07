/* =========================================================================
   main.js — amorçage + machine à états (HG.flow).
   ========================================================================= */
(function (HG) {
  "use strict";

  var lastSetup = null;   // { claims, rosterName } — pour « rejouer »

  function resetRunModules() {
    if (HG.preludeModule) HG.preludeModule.reset();
    if (HG.bloodbathModule) HG.bloodbathModule.reset();
    if (HG.roundModule) HG.roundModule.reset();
  }

  function claimsArrayToMap(arr) {
    var map = {};
    (arr || []).forEach(function (c) {
      map[c.slotId] = {
        name: c.name,
        photo: c.photo || null,
        emoji: c.emoji || null,
        skills: c.skills || []
      };
    });
    return map;
  }

  function currentMode() {
    try { return HG.storage.getSettings().mode === "advanced" ? "advanced" : "simple"; }
    catch (e) { return "simple"; }
  }

  // Fin de partie ? Renvoie une route ou null.
  function endRoute() {
    var living = HG.living();

    if (living.length === 0) {
      // cas extrême (élimination mutuelle) : le dernier tombé « rampe hors de l'arène »
      var last = HG.state.get().deaths[HG.state.get().deaths.length - 1];
      if (last) {
        var t = HG.byId(last.id);
        t.alive = true;
        t.causeOfDeath = null; t.dayOfDeath = null; t.placement = 1;
        // retire des morts / de la file du ciel
        var st = HG.state.get();
        st.deaths = st.deaths.filter(function (d) { return d.id !== t.id; });
        st.fallenQueue = st.fallenQueue.filter(function (id) { return id !== t.id; });
        return { screen: "victory", data: { victors: [t.id] } };
      }
    }

    if (living.length <= 1) {
      return { screen: "victory", data: { victors: living.map(function (t) { return t.id; }) } };
    }

    if (living.length === 2) {
      var a = living[0], b = living[1];
      var allied = a.allies.indexOf(b.id) !== -1;
      if (allied && HG.isDesignatedLovers && HG.isDesignatedLovers(a, b)) {
        return { screen: "finale" };
      }
      return { screen: "duel" };
    }

    return null;
  }

  function routeEndOr(fallbackScreen, fallbackData) {
    var end = endRoute();
    if (end) { HG.ui.go(end.screen, end.data || {}); return true; }
    HG.ui.go(fallbackScreen, fallbackData || {});
    return false;
  }

  HG.flow = {

    home: function () {
      HG.ui.go("home");
    },

    newGame: function () {
      HG.state.reset();
      resetRunModules();
      HG.rosterModule.load(null, "");
      HG.ui.go("roster");
    },

    // Démarre immédiatement avec les 24 tributs du film (aucune modification).
    quickGame: function () {
      lastSetup = { claims: [], rosterName: null, mode: currentMode() };
      HG.state.reset();
      resetRunModules();
      HG.state.init({ claims: {}, rosterName: null, mode: currentMode() });
      HG.ui.go("prelude", { step: 1 });
    },

    loadRoster: function (name) {
      var r = HG.storage.getRoster(name);
      HG.state.reset();
      resetRunModules();
      HG.rosterModule.load(r, name);
      HG.ui.go("roster");
    },

    // Retour vers la Moisson en conservant le brouillon (depuis le prélude).
    backToRoster: function () {
      HG.state.reset();
      resetRunModules();
      HG.ui.go("roster");
    },

    // claimsArr : [{slotId,name,photo,emoji,skills}]
    confirmRoster: function (claimsArr, rosterName) {
      lastSetup = { claims: claimsArr, rosterName: rosterName || null, mode: currentMode() };
      HG.state.init({
        claims: claimsArrayToMap(claimsArr),
        rosterName: rosterName || null,
        mode: currentMode()
      });
      resetRunModules();
      HG.ui.go("prelude", { step: 1 });
    },

    startBloodbath: function () {
      HG.ui.go("bloodbath");
    },

    afterBloodbath: function () {
      if (HG.roundModule) HG.roundModule.reset();
      routeEndOr("round");
    },

    afterRound: function (result) {
      if (HG.roundModule) HG.roundModule.reset();
      var end = endRoute();
      if (end) { HG.ui.go(end.screen, end.data || {}); return; }
      if (result && result.phase === "night") HG.ui.go("fallen");
      else HG.ui.go("round");
    },

    afterFallen: function () {
      if (HG.roundModule) HG.roundModule.reset();
      routeEndOr("round");
    },

    toVictory: function (ids) {
      HG.ui.go("victory", { victors: ids });
    },

    replaySameGroup: function () {
      if (!lastSetup) { HG.ui.go("home"); return; }
      HG.state.reset();
      resetRunModules();
      HG.state.init({
        claims: claimsArrayToMap(lastSetup.claims),
        rosterName: lastSetup.rosterName,
        mode: lastSetup.mode || currentMode()
        // pas de seed → nouvelle arène
      });
      HG.ui.go("prelude", { step: 1 });
    }
  };

  // ---- Amorçage ----
  function boot() {
    HG.ui.boot();
    var s = HG.storage.getSettings();
    HG.audio.setEnabled(s.sound !== false);
    if (HG.voice) HG.voice.setEnabled(s.voice !== false);
    if (!HG.storage.available) {
      console.warn("localStorage indisponible : sauvegardes désactivées pour cette session.");
    }
    HG.ui.go("home");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})(window.HG = window.HG || {});
