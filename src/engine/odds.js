/* =========================================================================
   engine/odds.js — cotes des parieurs du Capitole (« Que le sort… »).
   ========================================================================= */
(function (HG) {
  "use strict";

  // Score brut de « chances de victoire » d'un tribut vivant.
  function winScore(t, aliveCount) {
    var s = t.stats;
    var v = s.str * 1.2 + s.agi * 1.3 + s.cun * 1.2 + s.sur * 1.1 + s.cha * 0.4;
    v += t.kills.length * 3.5;
    v += t.supplies * 2;
    v += (t.sponsor / 100) * 5;
    v += t.roomFavor * 0.6;
    if (t.career) v += 4;
    if (t.wound === 1) v *= 0.8;
    if (t.wound === 2) v *= 0.55;
    if (t.allies.length) v *= 1.08;
    return Math.max(0.5, v);
  }

  // Renvoie [{ id, name, district, odds:"x.x:1", pct, dead:false }] trié.
  HG.computeOdds = function () {
    var living = HG.living();
    var scores = living.map(function (t) {
      return { t: t, score: winScore(t, living.length) };
    });
    var total = scores.reduce(function (a, b) { return a + b.score; }, 0) || 1;

    return scores
      .map(function (o) {
        var pct = o.score / total;
        var dec = Math.max(1.2, 1 / Math.max(0.02, pct));
        return {
          id: o.t.id,
          name: o.t.name,
          district: o.t.district,
          isPlayer: o.t.isPlayer,
          pct: Math.round(pct * 100),
          odds: dec.toFixed(1) + " : 1"
        };
      })
      .sort(function (a, b) { return b.pct - a.pct; });
  };

  // Favori du moment (pour le commentaire).
  HG.currentFavourite = function () {
    var o = HG.computeOdds();
    return o.length ? o[0] : null;
  };

})(window.HG = window.HG || {});
