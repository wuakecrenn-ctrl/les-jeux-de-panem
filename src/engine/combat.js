/* =========================================================================
   engine/combat.js — résolution d'un affrontement entre deux camps.
   Fonctions pures : renvoient des « issues » que simulation.js applique.
   ========================================================================= */
(function (HG) {
  "use strict";

  function groupPower(group, kind, eventMod) {
    var p = 0;
    group.forEach(function (t) { p += HG.combatPower(t, kind, eventMod); });
    // synergie d'alliance : +12 % par membre supplémentaire, plafonné
    if (group.length > 1) {
      p *= 1 + Math.min(0.5, (group.length - 1) * 0.12);
    }
    return p;
  }

  function roll(rng, power) {
    return power * (0.62 + rng.f() * 0.76);
  }

  // groupA / groupB : tableaux de tributs vivants (déjà filtrés).
  // Renvoie { narrativeKind, winners, losers, outcomes:[{tribute,result,killerId,cause}] }
  //   result ∈ "death" | "wound" | "flee" | "unscathed"
  HG.resolveEncounter = function (groupA, groupB, kind, rng, eventMod) {
    kind = kind || "melee";
    eventMod = eventMod || {};

    var powA = groupPower(groupA, kind, eventMod);
    var powB = groupPower(groupB, kind, eventMod);
    var rA = roll(rng, powA);
    var rB = roll(rng, powB);

    var winners = rA >= rB ? groupA : groupB;
    var losers  = rA >= rB ? groupB : groupA;
    var winRoll = Math.max(rA, rB);
    var loseRoll = Math.min(rA, rB);
    var margin = (winRoll - loseRoll) / Math.max(1, loseRoll); // 0..~2

    var outcomes = [];

    // Un tueur potentiel côté vainqueurs.
    function pickKiller() {
      return rng.pick(winners).id;
    }

    // --- Côté perdants ---
    // Combien tombent : au moins 1, jamais tout un grand groupe d'un coup.
    var maxFall = losers.length === 1 ? 1 : (margin > 0.9 ? Math.min(losers.length, 2) : 1);
    var fell = 0;
    var shuffledLosers = rng.shuffle(losers.slice());

    shuffledLosers.forEach(function (t) {
      var survivalMit = (t.stats.sur + t.stats.agi) * 0.012; // jusqu'à ~0.3
      var pDeath = 0.5 + margin * 0.22 - survivalMit;
      if (t.career) pDeath -= 0.05;
      if (t.wound) pDeath += 0.15 * t.wound;
      // Un allié du même district couvre ses arrières.
      var covered = losers.some(function (o) {
        return o !== t && o.alive && o.district === t.district &&
               t.allies.indexOf(o.id) !== -1;
      });
      if (covered) pDeath -= 0.16;
      if (kind === "flight") pDeath -= 0.12;         // rencontre = surtout une course
      if (kind === "environment") pDeath += 0.1;

      if (fell < maxFall && rng.chance(clamp(pDeath, 0.12, 0.9))) {
        fell++;
        outcomes.push({
          tribute: t, result: "death",
          killerId: eventMod.noKiller ? null : pickKiller(),
          cause: null, kind: kind
        });
      } else if (rng.chance(0.45)) {
        outcomes.push({ tribute: t, result: "wound" });
      } else {
        outcomes.push({ tribute: t, result: "flee" });
      }
    });

    // --- Côté vainqueurs : la victoire a un prix quand c'est serré ---
    winners.forEach(function (t) {
      if (margin < 0.25 && rng.chance(0.28)) {
        outcomes.push({ tribute: t, result: "wound" });
      } else if (margin < 0.12 && rng.chance(0.06)) {
        // échange fatal : un vainqueur tombe aussi
        outcomes.push({
          tribute: t, result: "death",
          killerId: rng.pick(losers).id, cause: null, kind: kind
        });
      } else {
        outcomes.push({ tribute: t, result: "unscathed" });
      }
    });

    return {
      kind: kind,
      winners: winners.map(function (t) { return t.id; }),
      losers: losers.map(function (t) { return t.id; }),
      margin: margin,
      outcomes: outcomes
    };
  };

  // Trahison au sein d'une alliance : le traître frappe pendant le sommeil.
  HG.resolveBetrayal = function (traitor, victim, rng) {
    // Le sommeil annule presque tout avantage défensif.
    var pSuccess = 0.72 + (traitor.stats.cun - victim.stats.sur) * 0.03;
    var success = rng.chance(clamp(pSuccess, 0.4, 0.95));
    return {
      success: success,
      outcomes: success
        ? [{ tribute: victim, result: "death", killerId: traitor.id, kind: "betrayal" }]
        : [{ tribute: traitor, result: "wound" },
           { tribute: victim, result: "wound" }]
    };
  };

  // Attaque solitaire (un traqueur isolé fond sur une proie isolée).
  HG.resolveStalk = function (hunter, prey, rng, eventMod) {
    return HG.resolveEncounter([hunter], [prey], "hunt", rng, eventMod || {});
  };

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  HG._clamp = clamp;

})(window.HG = window.HG || {});
