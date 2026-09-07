/* =========================================================================
   state.js — état central de la partie + accès pratiques.
   ========================================================================= */
(function (HG) {
  "use strict";

  var S = null;

  HG.state = {
    get: function () { return S; },

    // Crée une partie neuve. claims : map slotId -> { name, photo, emoji, skills }
    init: function (opts) {
      opts = opts || {};
      var seed = opts.seed || HG.randomSeed();
      var rng = HG.makeRng(seed);
      var mode = opts.mode === "advanced" ? "advanced" : "simple";

      var tributes = HG.buildTributes(HG.CANONICAL, opts.claims || {}, rng, mode);

      S = {
        seed: seed,
        rng: rng,
        mode: mode,                          // "simple" | "advanced"
        rosterName: opts.rosterName || null,
        phase: "prelude",
        day: 0,
        timeOfDay: "day",
        maxDays: 10,                          // une partie ne dépasse pas 10 jours
        roundIndex: 0,                        // nombre de manches jouées
        roundsSinceDeath: 0,
        loversRuleActive: false,
        loversDistrict: null,
        loversPair: null,          // [id, id] désigné par les Juges (joueurs / D12)
        bloodbathDone: false,
        tributes: tributes,
        feed: [],                            // toutes les lignes narratives
        deaths: [],                          // ordre chronologique des morts
        fallenQueue: [],                     // morts pas encore montrés au ciel
        lastEvent: null,
        sponsorLog: [],                      // { round, tributeId, gift }
        finishedAt: null,
        victors: null
      };
      return S;
    },

    // Recharge une partie déjà construite (utilisé pour « rejouer même groupe »).
    reset: function () { S = null; }
  };

  // ---- Anti-répétition de narration --------------------------------------
  // Tire un élément d'un tableau SANS le réutiliser tant qu'il en reste des
  // frais dans ce tableau — sur toute la partie. Quand un pool est entièrement
  // consommé (partie très longue), on le « recycle » : toutes ses phrases
  // redeviennent disponibles, donc jamais deux fois de suite, et les reprises
  // sont réparties au maximum.
  // arr : tableau de chaînes OU d'objets { line } / { text }.
  function _lineKey(x) {
    return typeof x === "string" ? x : (x && (x.line || x.text)) || JSON.stringify(x);
  }
  HG.narrPick = function (rng, arr) {
    if (!arr || !arr.length) return "";
    var r = rng && rng.f ? rng.f() : Math.random();
    if (!S) return arr[Math.floor(r * arr.length)];
    if (!S._usedLines) S._usedLines = Object.create(null);
    var used = S._usedLines;
    var fresh = arr.filter(function (x) { return !used[_lineKey(x)]; });
    if (!fresh.length) {
      // pool épuisé → on le recycle (sauf la toute dernière servie, pour ne
      // jamais enchaîner deux fois la même phrase)
      var last = arr.length > 1 ? S._lastLine : null;
      arr.forEach(function (x) { delete used[_lineKey(x)]; });
      fresh = arr.filter(function (x) { return _lineKey(x) !== last; });
      if (!fresh.length) fresh = arr;
    }
    var choice = fresh[Math.floor(r * fresh.length)];
    used[_lineKey(choice)] = true;
    S._lastLine = _lineKey(choice);
    return choice;
  };

  // ---- Helpers de lecture -------------------------------------------------

  HG.living = function () {
    return S.tributes.filter(function (t) { return t.alive; });
  };

  HG.dead = function () {
    return S.tributes.filter(function (t) { return !t.alive; });
  };

  HG.byId = function (id) {
    for (var i = 0; i < S.tributes.length; i++) {
      if (S.tributes[i].id === id) return S.tributes[i];
    }
    return null;
  };

  HG.players = function () {
    return S.tributes.filter(function (t) { return t.isPlayer; });
  };

  HG.livingPlayers = function () {
    return S.tributes.filter(function (t) { return t.isPlayer && t.alive; });
  };

  // Nom d'affichage (avec District pour lever l'ambiguïté quand demandé).
  HG.displayName = function (t, withDistrict) {
    if (!t) return "?";
    return withDistrict ? (t.name + " (D" + t.district + ")") : t.name;
  };

  // Alliés vivants d'un tribut.
  HG.alliesOf = function (t) {
    return t.allies
      .map(HG.byId)
      .filter(function (a) { return a && a.alive; });
  };

  // Deux tributs sont-ils du même district (règle des amants) ?
  HG.sameDistrict = function (a, b) {
    return a && b && a.district === b.district;
  };

  // ---- Mutations d'état ------------------------------------------------

  HG.recordDeath = function (victim, opts) {
    opts = opts || {};
    if (!victim.alive) return;
    victim.alive = false;
    victim.placement = HG.living().length + 1; // rang (1 = vainqueur)
    victim.dayOfDeath = S.day;
    victim.timeOfDeath = S.timeOfDay;
    victim.causeOfDeath = opts.cause || "tombé dans l'arène";
    victim.killerId = opts.killerId || null;

    if (opts.killerId) {
      var k = HG.byId(opts.killerId);
      if (k && k.alive) k.kills.push(victim.id);
    }
    // rompt les alliances
    victim.allies.forEach(function (aid) {
      var a = HG.byId(aid);
      if (a) a.allies = a.allies.filter(function (x) { return x !== victim.id; });
    });
    victim.allies = [];

    S.deaths.push({
      id: victim.id, name: victim.name, district: victim.district,
      day: S.day, time: S.timeOfDay, cause: victim.causeOfDeath,
      killerId: victim.killerId
    });
    S.fallenQueue.push(victim.id);
  };

  HG.formAlliance = function (ids) {
    ids.forEach(function (id) {
      var t = HG.byId(id);
      if (!t) return;
      ids.forEach(function (other) {
        if (other !== id && t.allies.indexOf(other) === -1) t.allies.push(other);
      });
    });
  };

  HG.breakAlliance = function (a, b) {
    a.allies = a.allies.filter(function (x) { return x !== b.id; });
    b.allies = b.allies.filter(function (x) { return x !== a.id; });
  };

})(window.HG = window.HG || {});
