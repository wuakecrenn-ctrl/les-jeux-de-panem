/* =========================================================================
   engine/tributes.js — construction des 24 tributs (stats cachées incluses).
   ========================================================================= */
(function (HG) {
  "use strict";

  // Bornes de tirage des stats selon le profil.
  function rollStat(rng, lo, hi) { return rng.int(lo, hi); }

  // Compétences suggérées par district (mode avancé, PNJ).
  var DISTRICT_SKILLS = {
    1: ["lame", "charisme"], 2: ["force", "lame"], 3: ["piege", "furtivite"],
    4: ["nage", "piege"], 5: ["furtivite", "botanique"], 6: ["endurance", "furtivite"],
    7: ["force", "escalade"], 8: ["endurance", "soin"], 9: ["endurance", "botanique"],
    10: ["force", "pistage"], 11: ["escalade", "botanique"], 12: ["archerie", "pistage"]
  };

  function autoSkills(c, stats, rng) {
    var pool = (DISTRICT_SKILLS[c.district] || []).slice();
    // ajoute une compétence liée à la stat dominante
    var dom = ["str", "agi", "cun", "sur", "cha"].sort(function (a, b) { return stats[b] - stats[a]; })[0];
    var byStat = { str: "force", agi: "furtivite", cun: "piege", sur: "endurance", cha: "charisme" };
    pool.push(byStat[dom]);
    // signatures du film
    if (c.id === "d12f") pool = ["archerie", "pistage"];
    if (c.id === "d12m") pool = ["force", "charisme"];
    if (c.id === "d11f") pool = ["escalade", "furtivite"];
    if (c.id === "d11m") pool = ["force", "endurance"];
    if (c.id === "d2f")  pool = ["lame", "furtivite"];
    if (c.id === "d5f")  pool = ["botanique", "furtivite"];
    var uniq = [];
    rng.shuffle(pool).forEach(function (k) { if (HG.SKILLS[k] && uniq.indexOf(k) === -1) uniq.push(k); });
    return uniq.slice(0, 2);
  }

  // Construit le tableau des 24 tributs à partir du roster canonique + des
  // revendications de joueurs.
  // claims : { slotId: { name, photo, emoji, skills } }
  // mode : "simple" | "advanced"
  HG.buildTributes = function (canonical, claims, rng, mode) {
    return canonical.map(function (c) {
      var d = HG.DISTRICTS[c.district];
      var isCareer = !!d.career;
      var claim = claims[c.id] || null;

      // Stats de base
      var stats = {
        str: rollStat(rng, 2, 7),
        agi: rollStat(rng, 2, 7),
        cun: rollStat(rng, 2, 7),
        cha: rollStat(rng, 2, 7),
        sur: rollStat(rng, 2, 7)
      };

      // Les Carrières sont entraînés : bonus offensif.
      if (isCareer) {
        stats.str += rng.int(1, 2);
        stats.agi += rng.int(1, 2);
        stats.cha += rng.int(0, 2);
      }
      // Les tributs incarnés par le salon ont le soutien du public.
      if (claim) {
        var keys = rng.shuffle(["str", "agi", "cun", "sur"]);
        stats[keys[0]] += rng.int(1, 2);
        stats[keys[1]] += 1;
      }
      // District 11 & 12 : rudes à la survie (agriculture, forêt, faim).
      if (c.district === 11 || c.district === 12) {
        stats.sur += rng.int(1, 3);
        stats.cun += rng.int(0, 2);
      }
      // District 3 : ruse (pièges, électronique).
      if (c.district === 3) stats.cun += rng.int(1, 3);
      // District 7 : force (bûcherons, haches).
      if (c.district === 7) stats.str += rng.int(1, 2);

      // Traits signature de quelques tributs du film.
      if (c.id === "d12f") { stats.agi += 3; stats.cun += 2; stats.sur += 2; }   // arc / instinct
      if (c.id === "d12m") { stats.str += 3; stats.cha += 3; }                    // force / camouflage social
      if (c.id === "d11f") { stats.agi += 3; stats.cun += 3; stats.sur += 1; }   // discrétion, cimes
      if (c.id === "d11m") { stats.str += 4; }                                    // colosse
      if (c.id === "d2m")  { stats.str += 3; stats.agi += 1; }                    // brute des Carrières
      if (c.id === "d2f")  { stats.agi += 2; stats.cun += 2; stats.str += 1; }   // lames de jet
      if (c.id === "d1f")  { stats.cha += 3; stats.agi += 1; }                    // charme, arc mal maîtrisé
      if (c.id === "d5f")  { stats.cun += 5; stats.sur += 2; stats.str -= 1; }   // la Renarde : survie par la ruse

      // Plafond / plancher
      for (var k in stats) stats[k] = Math.max(1, Math.min(12, stats[k]));

      var name = claim && claim.name ? claim.name.trim().slice(0, 22) : c.name;

      // Compétences (mode avancé uniquement)
      var skills = [];
      if (mode === "advanced") {
        if (claim && claim.skills && claim.skills.length) {
          skills = claim.skills.filter(function (s) { return HG.SKILLS[s]; }).slice(0, 2);
        }
        if (skills.length < 2) {
          autoSkills(c, stats, rng).forEach(function (s) { if (skills.indexOf(s) === -1) skills.push(s); });
          skills = skills.slice(0, 2);
        }
      }

      // Arme (dans les deux modes) : signature du film > compétence > district > stats.
      var weapon = HG.assignWeapon ? HG.assignWeapon(c, stats, skills, rng) : "sword";

      return {
        id: c.id,
        district: c.district,
        sex: c.sex,
        name: name || c.name,
        canonName: c.name,
        alias: c.alias || null,
        isPlayer: !!claim,
        portrait: HG.portraitPath(c.id),
        photo: (claim && claim.photo) || null,
        emoji: (claim && claim.emoji) || null,

        stats: stats,
        skills: skills,
        weapon: weapon,            // clé de HG.WEAPONS — gardée toute la partie
        weaponShown: false,        // passe à true au bain de sang
        career: isCareer,
        trainingScore: 0,          // rempli au prélude

        // Runtime
        alive: true,
        wound: 0,                  // 0 sain · 1 blessé · 2 grièvement blessé
        supplies: 0,               // 0..3 (butin de la Corne)
        kills: [],
        allies: [],
        sponsor: (isCareer ? 22 : 12) + (claim ? 8 : 0),   // jauge 0..100
        roomFavor: 0,              // votes du salon cumulés
        gift: null,                // cadeau actif : { bonus, heal, label, expires }
        inPack: false,             // membre de la meute des Carrières

        placement: null,
        dayOfDeath: null,
        timeOfDeath: null,
        causeOfDeath: null,
        killerId: null
      };
    });
  };

  // Puissance de combat effective d'un tribut selon le type de rencontre.
  // kind : "melee" | "ranged" | "ambush" | "hunt" | "flight" | "environment" | "duel"
  HG.combatPower = function (t, kind, eventMod) {
    var s = t.stats;
    var base;
    switch (kind) {
      case "ranged":      base = s.agi * 1.5 + s.cun * 1.1 + s.str * 0.5; break;
      case "ambush":      base = s.cun * 1.6 + s.agi * 1.1 + s.str * 0.6; break;
      case "hunt":        base = s.agi * 1.3 + s.cun * 1.2 + s.str * 0.9; break;
      case "flight":      base = s.agi * 1.7 + s.sur * 1.0 + s.cun * 0.6; break;
      case "environment": base = s.sur * 1.8 + s.agi * 0.9 + s.cun * 0.7; break;
      case "duel":        base = s.str * 1.3 + s.agi * 1.2 + s.cun * 0.8 + s.sur * 0.5; break;
      default:            base = s.str * 1.5 + s.agi * 1.0 + s.cun * 0.6; break; // melee
    }
    base += t.supplies * 3.2;
    base += (t.sponsor / 100) * 6;
    if (t.gift && t.gift.bonus) {
      for (var k in t.gift.bonus) base += (t.gift.bonus[k] || 0) * 1.7;
    }
    // Compétences (mode avancé)
    if (t.skills && t.skills.length) {
      t.skills.forEach(function (key) {
        var sk = HG.SKILLS[key];
        if (sk && sk.combat && sk.combat[kind]) base += sk.combat[kind];
      });
    }
    // Arme : une bonne arme pour la situation aide, une mauvaise gêne.
    if (HG.weaponKindBonus) base += HG.weaponKindBonus(t, kind);
    if (t.career) base += 2;
    if (t.isPlayer) base += 1.5;        // la foule pousse ses favoris
    base += Math.min(3, t.roomFavor * 0.45);
    if (t.wound === 1) base *= 0.78;
    if (t.wound === 2) base *= 0.5;
    if (eventMod && eventMod.powerMul) base *= eventMod.powerMul;
    return Math.max(1, base);
  };

  // Facteur de résistance à un incident (0.05 = quasi immunisé, 1 = normal).
  HG.skillResist = function (t, type) {
    if (!t.skills || !t.skills.length) return 1;
    var f = 1;
    t.skills.forEach(function (key) {
      var sk = HG.SKILLS[key];
      if (sk && sk.resist && sk.resist[type] != null) f *= (1 - sk.resist[type]);
    });
    return f;
  };

  HG.hasEdge = function (t, edge) {
    if (!t.skills || !t.skills.length) return false;
    return t.skills.some(function (key) {
      var sk = HG.SKILLS[key];
      return sk && sk.edge && sk.edge.indexOf(edge) !== -1;
    });
  };

  // Type de rencontre où le tribut est le plus fort : arme d'abord, puis
  // compétences, puis stats.
  HG.preferredKind = function (t) {
    var w = t.weapon && HG.WEAPONS && HG.WEAPONS[t.weapon];
    if (w && w.kinds) {
      var best = null, bv = 2;
      for (var kk in w.kinds) if (w.kinds[kk] > bv) { bv = w.kinds[kk]; best = kk; }
      if (best) return best;
    }
    if (t.skills) {
      if (t.skills.indexOf("archerie") !== -1) return "ranged";
      if (t.skills.indexOf("piege") !== -1 || t.skills.indexOf("furtivite") !== -1) return "ambush";
      if (t.skills.indexOf("pistage") !== -1) return "hunt";
      if (t.skills.indexOf("lame") !== -1 || t.skills.indexOf("force") !== -1) return "melee";
    }
    var s = t.stats;
    if (s.agi >= s.str + 2 && s.agi >= 8) return "ranged";
    if (s.cun >= s.str + 2) return "ambush";
    return "melee";
  };

})(window.HG = window.HG || {});
