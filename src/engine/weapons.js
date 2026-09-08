/* =========================================================================
   engine/weapons.js — armes des tributs.

   Chaque tribut reçoit UNE arme à la construction (déterministe, racinée) et
   la garde toute la partie (sauf cadeau de sponsor qui la remplace). L'arme :
     • est montrée au bain de sang (joueurs d'abord),
     • sert de fil rouge dans la narration des combats ({wa} / {wb}),
     • donne un bonus / malus de puissance SELON le type de rencontre
       (un arc écrase à distance et ne vaut rien au corps-à-corps, etc.).

   kinds : bonus de HG.combatPower par type ("melee","ranged","ambush","hunt",
           "flight","duel"). Valeurs ~ -4..+6 (les stats vont de 2 à 12).
   ========================================================================= */
(function (HG) {
  "use strict";

  HG.WEAPONS = {
    bow: {
      name: "un arc", the: "l'arc", cat: "arrow",
      kinds: { ranged: 5, ambush: 2, hunt: 1, melee: -3, duel: -2 },
      tag: "mortel à distance, presque inutile au contact"
    },
    knives: {
      name: "des couteaux de lancer", the: "le couteau", cat: "knife",
      kinds: { ranged: 3, ambush: 4, melee: 1, hunt: 1 },
      tag: "vif de près comme de loin"
    },
    sword: {
      name: "une épée courte", the: "l'épée", cat: "blade",
      kinds: { melee: 4, duel: 4, hunt: 1, ambush: -1 },
      tag: "faite pour le corps-à-corps"
    },
    spear: {
      name: "une lance", the: "la lance", cat: "spear",
      kinds: { melee: 3, hunt: 4, ranged: 2, ambush: -2 },
      tag: "tient l'adversaire à distance de bras"
    },
    axe: {
      name: "une hache", the: "la hache", cat: "axe",
      kinds: { melee: 4, hunt: 2, flight: -2, ranged: -2 },
      tag: "brise les gardes, lente à ramener"
    },
    mace: {
      name: "une masse d'armes", the: "la masse", cat: "mace",
      kinds: { melee: 4, duel: 3, flight: -3, ambush: -2, ranged: -3 },
      tag: "un seul coup suffit — s'il touche"
    },
    club: {
      name: "un lourd gourdin", the: "le gourdin", cat: "mace",
      kinds: { melee: 3, duel: 2, flight: -2, ranged: -3 },
      tag: "rustique et dévastateur"
    },
    trident: {
      name: "un trident", the: "le trident", cat: "trident",
      kinds: { melee: 3, hunt: 3, ranged: 2, flight: 1 },
      tag: "allonge et portée — spécialité du District 4"
    },
    sickle: {
      name: "une faucille", the: "la faucille", cat: "sickle",
      kinds: { melee: 2, ambush: 4, hunt: 1 },
      tag: "silencieuse, faite pour surgir des hautes herbes"
    },
    sling: {
      name: "une fronde", the: "la fronde", cat: "sling",
      kinds: { ranged: 3, ambush: 2, melee: -2 },
      tag: "de loin seulement, mais discrète"
    },
    snares: {
      name: "des collets et des fils tendus", the: "le piège", cat: "trap",
      kinds: { ambush: 6, hunt: 2, melee: -3, flight: -1 },
      tag: "dévastateurs tendus d'avance, rien dans un face-à-face"
    },
    none: {
      name: "aucune arme", the: "les mains nues", cat: "hands",
      kinds: { ambush: 1, flight: 2, melee: -2, duel: -3, ranged: -4 },
      tag: "sans arme — il faudra en trouver une, ou ruser"
    }
  };

  // Signatures « film » (les autres sont déduits du district / des compétences / des stats).
  var SIGNATURE = {
    d1m: "spear",   d1f: "bow",
    d2m: "sword",   d2f: "knives",
    d4m: "trident", d4f: "trident",
    d11m: "club",   d11f: "sling",
    d12m: "none",   d12f: "bow",
    d5f: "none"
  };
  var BY_DISTRICT = { 1: "sword", 2: "spear", 3: "snares", 4: "trident", 7: "axe", 10: "sling", 11: "sickle" };

  HG.assignWeapon = function (c, stats, skills, rng) {
    if (SIGNATURE[c.id]) return SIGNATURE[c.id];

    if (skills && skills.length) {
      if (skills.indexOf("archerie") !== -1) return "bow";
      if (skills.indexOf("lame") !== -1) return "sword";
      if (skills.indexOf("piege") !== -1) return "snares";
      if (skills.indexOf("force") !== -1) return rng.chance(0.5) ? "mace" : "axe";
    }
    if (BY_DISTRICT[c.district] && rng.chance(0.7)) return BY_DISTRICT[c.district];

    if (stats.cun >= stats.str + 2 && stats.cun >= 7) return "snares";
    if (stats.agi >= stats.str + 2 && stats.agi >= 7) return "knives";
    if (stats.str >= 9) return rng.chance(0.5) ? "mace" : "axe";

    // figurants sans arme signature : beaucoup partent les mains vides
    if (!c.canon && rng.chance(0.45)) return "none";
    return rng.chance(0.5) ? "sword" : "spear";
  };

  // Bonus de l'arme pour un type de rencontre donné.
  HG.weaponKindBonus = function (t, kind) {
    var w = t && t.weapon && HG.WEAPONS[t.weapon];
    if (!w || !w.kinds || w.kinds[kind] == null) return 0;
    return w.kinds[kind];
  };
  HG.weaponName = function (t) {
    var w = t && t.weapon && HG.WEAPONS[t.weapon];
    return w ? w.name : "une arme de fortune";
  };
  HG.weaponThe = function (t) {
    var w = t && t.weapon && HG.WEAPONS[t.weapon];
    return w ? w.the : "son arme";
  };

  // Cadeaux de sponsor qui changent l'arme portée.
  HG.GIFT_WEAPON = { lame: "knives", arc: "bow", filet: "trident" };

})(window.HG = window.HG || {});
