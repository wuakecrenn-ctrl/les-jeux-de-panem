/* =========================================================================
   engine/simulation.js — orchestration : bain de sang + manches.
   Produit des "beats" pour la scène de présentation ; applique l'état
   au fil de l'eau.
   ========================================================================= */
(function (HG) {
  "use strict";

  function S() { return HG.state.get(); }
  function who(t) { return "<span class='who'>" + t.name + "</span>"; }
  function pick(rng, a) { return a[Math.floor(rng.f() * a.length)]; }
  // line() : comme pick() mais SANS répétition sur toute la partie (pour les
  // phrases de narration). Ne pas l'utiliser pour tirer des tributs / objets.
  function line(rng, a) { return HG.narrPick ? HG.narrPick(rng, a) : pick(rng, a); }

  // Budget de morts pour la manche en cours : évite qu'une seule manche
  // ne vide l'arène. -1 = illimité (bain de sang, dénouement).
  var deathBudget = -1;
  function budgetAllows() { return deathBudget < 0 || deathBudget > 0; }
  function spendBudget() { if (deathBudget > 0) deathBudget--; }
  function port(t, extra) {
    var o = { id: t.id };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  // Portraits d'un CAMP : la clé `camp` fait dessiner un cadre autour du
  // groupe à l'écran (voir ui.js) — on voit d'un coup d'œil qui se bat avec
  // qui. Au-delà de 3 portraits, une pastille « +N » complète le camp.
  function campPorts(list, key, extra) {
    var out = list.slice(0, 3).map(function (t) {
      var o = port(t, extra);
      if (key) o.camp = key;
      return o;
    });
    if (list.length > 3 && key) out.push({ more: list.length - 3, camp: key });
    return out;
  }

  // ---- Application d'une issue de combat --------------------------
  // Renvoie un beat "kill", un beat "blessure", ou null.
  function applyOutcome(o, ctx) {
    var t = o.tribute;
    if (!t.alive) return null;

    if (o.result === "wound") {
      // Le "toughness" (Force herculéenne) transforme parfois une mort en blessure ;
      // ici on n'annonce la blessure que si elle est notable.
      t.wound = Math.min(2, t.wound + 1);
      if (o.announce) {
        return { portraits: [port(t)], cls: "",
          text: line(S().rng, [
            who(t) + " s'en tire, mais laisse du sang sur les fougères.",
            who(t) + " serre une entaille au bras et bat en retraite.",
            who(t) + " recule en boitant — une blessure de plus à traîner.",
            who(t) + " encaisse, jure, et disparaît dans le couvert avant le coup suivant.",
            who(t) + " s'en sort de justesse, la manche rouge et le souffle court."
          ]) };
      }
      return null;
    }
    if (o.result === "flee") return null;

    if (o.result === "death") {
      // Budget de morts épuisé → la mort devient une blessure grave.
      if (!budgetAllows() && !o.ignoreBudget) {
        t.wound = 2;
        return { portraits: [port(t)], cls: "", text: line(S().rng, [
          who(t) + " frôle la mort et s'échappe en rampant, grièvement touché(e).",
          who(t) + " est laissé pour mort dans les fourrés — mais respire encore.",
          who(t) + " s'effondre, se relève, et disparaît en titubant.",
          who(t) + " paie cher la rencontre : une blessure qui va peser sur tout le reste.",
          who(t) + " s'en sort de justesse en se laissant rouler dans le ravin. Vivant(e), à peine.",
          who(t) + " reçoit le coup qui devait finir la rencontre — et tient debout, on ne sait comment.",
          "Un canon ? Non. " + who(t) + " a réussi à se traîner hors de portée avant.",
          who(t) + " disparaît dans la fumée, une main pressée sur le flanc. Ce n'est pas fini pour lui."
        ]) };
      }
      var killer = o.killerId ? HG.byId(o.killerId) : null;
      var phrase;
      if (o.kind === "incident") {
        phrase = HG.deaths.incident(t, o.incidentType, S().rng);
      } else if (o.kind === "betrayal" || o.kind === "pack_turn" || o.kind === "duel") {
        phrase = HG.deaths.encounter(killer, t, o.kind, S().rng);
      } else if (ctx && ctx.environmental) {
        phrase = HG.deaths.environmental(t, ctx.eventId, S().rng);
      } else {
        phrase = HG.deaths.encounter(killer, t, o.kind || "melee", S().rng);
      }
      var hasKiller = killer && killer.alive &&
        !(ctx && ctx.environmental) && o.kind !== "incident";
      HG.recordDeath(t, { cause: phrase.cause, killerId: hasKiller ? o.killerId : null });
      spendBudget();
      if (hasKiller) killer.sponsor = Math.min(100, killer.sponsor + 8);

      var portraits = [port(t, { dead: true, big: true })];
      if (hasKiller) portraits.unshift(port(killer));
      return {
        portraits: portraits,
        text: phrase.text,
        cause: phrase.cause,
        killer: hasKiller ? killer.name : null,
        // trahison : l'étiquette de mort le dit en un mot (voir ui.js)
        betray: o.kind === "betrayal" || o.kind === "pack_turn",
        cls: "kill", cannon: true
      };
    }
    return null;
  }

  // ---- Unités de combat (tribut + alliés vivants) ----------------
  function buildUnits(pool) {
    var seen = {}, units = [];
    var lp = S().loversPair;
    pool.forEach(function (t) {
      if (seen[t.id] || !t.alive) return;
      var group = [t].concat(HG.alliesOf(t));
      // une paire d'amants désignée reste toujours ensemble
      if (lp && lp.indexOf(t.id) !== -1) {
        lp.forEach(function (id) { var x = HG.byId(id); if (x && x.alive && group.indexOf(x) === -1) group.push(x); });
      }
      group = group.filter(function (g, i, arr) {
        return arr.indexOf(g) === i && pool.indexOf(g) !== -1;
      });
      group.forEach(function (g) { seen[g.id] = true; });
      units.push(group);
    });
    return units;
  }

  function pickKind(ev, rng, aUnit) {
    // Mode avancé : le camp qui engage impose souvent son style.
    if (aUnit && aUnit[0] && aUnit[0].skills && aUnit[0].skills.length && rng.chance(0.7)) {
      return HG.preferredKind(aUnit[0]);
    }
    if (ev && ev.kind && rng.chance(0.6)) return ev.kind;
    return rng.weighted([
      { k: "melee", weight: 5 }, { k: "ranged", weight: 2 }, { k: "ambush", weight: 3 },
      { k: "hunt", weight: 2 }, { k: "flight", weight: 2 }
    ], "weight").k;
  }

  // ---- Incidents solo (chutes, poison, noyade, infection…) --------
  var DEFAULT_INCIDENTS = ["fall", "berries", "snake", "infection", "exhaustion", "dehydration"];
  function runIncidents(ev, beats) {
    var st = S();
    var rng = st.rng;
    var living = HG.living();
    if (living.length <= 2) return;

    // Chaque manche a une petite chance d'incidents ; certains événements l'augmentent.
    var baseRate = 0.11 + (ev.incidentRate || 0) * 0.8;
    if (st.day >= 6) baseRate += 0.05;
    var types = ev.incidentTypes || DEFAULT_INCIDENTS;

    var pool = rng.shuffle(living.slice());
    var maxHits = Math.max(1, Math.round(living.length * 0.14));
    var hits = 0;

    pool.forEach(function (t) {
      if (hits >= maxHits || !t.alive) return;
      // Une paire d'amants (joueurs / D12) veille l'un sur l'autre : incidents rares.
      if (loversPairAlive() && loversHas(t)) return;
      var type = pick(rng, types);
      var p = baseRate;
      // survie / stats atténuent
      p *= HG._clamp(1 - (t.stats.sur - 5) * 0.06, 0.55, 1.5);
      if (type === "fall") p *= HG._clamp(1 - (t.stats.agi - 5) * 0.05, 0.5, 1.4);
      if (t.wound) p *= 1 + 0.3 * t.wound;
      if (t.career) p *= 0.8;
      // compétences (mode avancé)
      p *= HG.skillResist(t, type);
      if (t.allies.length && (type === "infection" || type === "dehydration" || type === "exhaustion")) p *= 0.7;

      if (rng.chance(HG._clamp(p, 0, 0.55))) {
        hits++;
        var kb = applyOutcome({ tribute: t, result: "death", killerId: null, kind: "incident", incidentType: type }, null);
        if (kb) beats.push(kb);
      } else if (rng.chance(0.22)) {
        // près de l'accident : blessure
        t.wound = Math.min(2, t.wound + 1);
        beats.push({ portraits: [port(t)], cls: "", text: line(rng, [
          who(t) + " glisse, se rattrape de justesse, et repart en boitant.",
          who(t) + " évite le pire mais y laisse quelques forces.",
          who(t) + " s'en sort avec une frayeur et une entaille.",
          who(t) + " frôle l'accident, blêmit, et reprend sa route plus prudemment.",
          who(t) + " paie l'inattention d'une mauvaise chute — rien de cassé, mais ça compte."
        ]) });
      }
    });
  }

  // ---- Effets de compétences hors combat (mode avancé) ----------
  function runSkillPhase(ev, beats) {
    if (S().mode !== "advanced") return;
    var rng = S().rng;
    var healed = [];
    HG.living().forEach(function (t) {
      if (HG.hasEdge(t, "selfHeal") && t.wound > 0 && rng.chance(0.7)) { t.wound -= 1; healed.push(t); }
      if (HG.hasEdge(t, "healAllies")) {
        HG.alliesOf(t).forEach(function (a) { if (a.wound > 0 && rng.chance(0.6)) { a.wound -= 1; healed.push(a); } });
      }
      if (HG.hasEdge(t, "sponsorMagnet")) t.sponsor = Math.min(100, t.sponsor + 4);
    });
    if (healed.length) {
      var uniq = healed.filter(function (t, i, a) { return a.indexOf(t) === i; });
      var plural = uniq.length > 1;
      beats.push({ portraits: campPorts(uniq, "a", { campLabel: "Alliance" }), camps: true, cls: "",
        text: line(rng, [
          "Un guérisseur s'active : " + names(uniq.slice(0, 3)) + " repart" + (plural ? "ent" : "") + " en meilleure forme.",
          names(uniq.slice(0, 3)) + " met" + (plural ? "tent" : "") + " à profit la nuit pour nettoyer et recoudre les plaies.",
          "Cataplasme d'écorce, fil et aiguille : " + names(uniq.slice(0, 3)) + " soigne" + (plural ? "nt" : "") + " ce qui peut l'être.",
          "L'alliance a son guérisseur. " + names(uniq.slice(0, 3)) + " repart" + (plural ? "ent" : "") + " la fièvre tombée."
        ]) });
    }
  }

  // ========================================================================
  //  NARRATION D'UN AFFRONTEMENT
  //  Une rencontre = 2 lignes (parfois 3 quand c'est très serré), PUIS l'issue
  //  (mort / blessure / repli) comme beat SÉPARÉ.
  //  On privilégie la COHÉRENCE : la 2e ligne est choisie selon le RÉSULTAT,
  //  jamais au hasard — elle ne contredit donc jamais l'issue.
  //
  //  AJOUTER DES PHRASES : respecter le « contrat » de chaque pool (ci-dessous).
  //  Toute phrase qui respecte le contrat est interchangeable — mettez-en autant
  //  que vous voulez. Voir TEXTES.md.
  // ========================================================================

  // APPROACH[kind] — COMMENT la rencontre commence.
  //   Codes : {A} {B} = les deux camps (nom déjà formaté, 1+ tributs).
  //   Interdits : nom d'arme, mention d'une issue, verbe qui suppose le nombre.
  //   Terrain/météo générique OK. Présent.
  var APPROACH = {
    melee: [
      "{A} et {B} débouchent sur la même clairière au même instant. Plus personne ne recule.",
      "Un sentier étroit, deux directions opposées : {A} d'un côté, {B} de l'autre.",
      "La pluie a effacé les bruits de pas — {A} et {B} se retrouvent nez à nez au détour d'un rocher.",
      "Aucun des deux ne cherchait la bagarre. Le terrain n'a laissé le choix ni à {A} ni à {B}.",
      "{A} contourne un fourré et tombe pile sur {B}, à trois pas, trop tard pour reculer.",
      "{A} et {B} arrivent chacun de leur côté au même point d'eau. La gourde attendra.",
      "Un craquement de branche, deux têtes qui se lèvent : {A} et {B} se sont trouvés.",
      "{A} pose le pied dans un campement encore chaud. {B} n'est pas parti loin.",
      "Le brouillard se lève d'un coup et découvre {A} face à {B}, à portée de bras.",
      "{A} suit une piste ; au bout, ce n'est pas du gibier, c'est {B}.",
      "{A} et {B} se disputent le même abri sous l'averse. La discussion tourne court.",
      "Deux ombres se figent de part et d'autre d'un feu mourant. {A}. {B}.",
      "{A} entend {B} approcher sans le voir, et se plaque contre un tronc. Trop tard, {B} l'a vu aussi.",
      "Une clairière, deux entrées, deux tributs qui arrivent en même temps. {A} et {B}.",
      "{A} cherchait de l'eau. {B} cherchait de l'eau. Il n'y en a que pour un.",
      "{A} et {B} tournent le même rocher, l'un vers la droite, l'autre vers la gauche."
    ],
    ranged: [
      "{A} repère {B} à découvert dans la plaine et prend ses distances.",
      "Perché plus haut, {A} laisse {B} avancer sans se savoir vu.",
      "{A} attend que {B} sorte du couvert, déjà en position.",
      "{B} traverse la trouée en courant. {A}, immobile depuis un moment, ajuste.",
      "{A} laisse {B} s'installer près de l'eau, puis prend tout son temps.",
      "Deux cents mètres de plaine séparent {A} de {B}. {A} n'a pas besoin de plus près.",
      "{B} allume un feu à découvert. {A}, à distance, sourit.",
      "{A} grimpe pendant que {B} cherche encore d'où vient le danger.",
      "{B} croit la crête déserte. {A} y est allongé depuis l'aube.",
      "{A} n'a plus qu'à rester immobile et laisser {B} entrer dans la ligne de mire.",
      "{B} s'arrête pour reprendre son souffle en terrain découvert. Mauvaise idée : {A} le tient.",
      "{A} suit {B} du regard depuis un promontoire, sans se presser d'agir.",
      "{B} traverse le pont de pierre. {A} attend l'autre rive, calé sur un genou.",
      "{A} a repéré {B} bien avant que {B} ne soupçonne quoi que ce soit."
    ],
    ambush: [
      "{A} a repéré la fumée du feu de {B} et s'en approche sans un bruit.",
      "Tapi dans les ronces depuis une heure, {A} laisse {B} arriver à portée.",
      "{B} se penche vers la source. {A} sort de l'ombre dans son dos.",
      "{A} n'a rien fait d'autre que rester immobile pendant que {B} fouillait la clairière.",
      "Le sentier de {B} passe juste sous la branche où {A} attend, sans un frisson.",
      "{A} laisse {B} passer devant, compte jusqu'à trois, et bondit.",
      "{B} suit une piste tracée exprès. Au bout, {A} l'attend, calme.",
      "{A} a préparé cet endroit la veille. {B} arrive pile dedans.",
      "{B} croit être seul à la source. {A} est là depuis avant lui.",
      "Un mouvement dans les hautes herbes, et {A} est déjà sur {B}.",
      "{B} s'assoit pour souffler, dos à un buisson. {A} est dans le buisson.",
      "{A} a suivi les corbeaux jusqu'au campement de {B}, et attendu la nuit.",
      "{B} pousse une branche pour passer. {A} tenait l'autre bout depuis un moment.",
      "{A} laisse tomber une pierre plus loin ; {B} tourne la tête ; {A} bouge."
    ],
    hunt: [
      "{A} pistait {B} depuis l'aube, lisant chaque brindille. La traque touche à sa fin.",
      "Les torches de {A} se referment lentement autour de {B}.",
      "{B} croyait avoir semé tout le monde. {A} l'attendait à la sortie du ravin.",
      "{A} suit la piste de {B} sans se presser : la fatigue travaille pour lui.",
      "{B} court depuis une heure. {A} marche depuis une heure. Ça se voit maintenant.",
      "{A} rabat {B} vers la falaise, méthodiquement, comme au district.",
      "{A} pousse {B} exactement là où il le veut : dos à l'eau, sans issue.",
      "{B} laisse des traces de fuite trop nettes. {A} les lit comme un livre.",
      "La poursuite dure depuis la veille. {A} n'a jamais accéléré, jamais ralenti.",
      "{A} connaît ce coin de l'arène mieux que {B}. Ça finit toujours pareil.",
      "{B} croise trois fois la même souche : il tourne en rond, et {A} le sait.",
      "{A} coupe par la crête pendant que {B} contourne la colline. {A} arrive premier.",
      "{B} a semé son poursuivant, croit-il. {A} n'a jamais été derrière — il était devant."
    ],
    flight: [
      "{A} et {B} manquent de se percuter en pleine fuite dans le brouillard.",
      "Coincés entre le danger et la falaise, {A} et {B} se retrouvent au même goulet.",
      "La crue rabat {A} droit sur {B}.",
      "En fuyant le même incendie, {A} et {B} arrivent essoufflés au même pont de pierre.",
      "L'arène rétrécit : {A} et {B} sont poussés l'un vers l'autre, sans autre issue.",
      "{A} et {B} courent devant la même nappe de brouillard et débouchent sur le même surplomb.",
      "Le mur invisible de l'arène coupe la fuite de {A} et {B} au même endroit.",
      "Fuyant les loups des Juges, {A} et {B} se jettent dans le même abri. Il n'y a de place que pour un."
    ]
  };
  // APPROACH_GROUP — au moins un camp est une alliance. narrateClash oriente
  //   {A} = le camp le PLUS nombreux (toujours pluriel-safe). {B} = l'autre
  //   (parlez-en sans verbe qui suppose son nombre). {DEUX} = les deux camps.
  var APPROACH_GROUP = [
    "{DEUX} se jaugent dans la clairière — d'un côté un groupe, de l'autre moins de monde.",
    "{A} avancent groupés, se couvrant mutuellement. En face, on cherche déjà par où se dégager.",
    "{A} bloquent le sentier à plusieurs. Pas de passage en force possible pour {B}.",
    "{DEUX} se font face au bord de l'eau. Les nombres ne sont pas les mêmes des deux côtés.",
    "{A} se déploient sans un mot — chacun sait déjà quoi faire.",
    "L'un des alliés de {A} siffle ; les autres se figent, puis avancent ensemble.",
    "{B} tombe{tB} sur {A} au détour d'un rocher et compte{tB} trop de silhouettes d'un coup.",
    "{A} encerclent lentement la clairière. Au centre, {B} tarde{tB} à comprendre ce qui se referme.",
    "Face au groupe de {A}, {B} calcule{tB} ses chances.",
    "{A} laissent l'un des leurs se montrer comme appât ; les autres sont déjà en position.",
    "{A} arrivent en marchant, presque tranquilles. À plusieurs, on ne se presse pas.",
    "{DEUX} s'arrêtent à vingt pas. On compte les silhouettes des deux côtés."
  ];

  // NUMBERS_WIN — le camp majoritaire {BIG} l'emporte sur {SMALL}.
  //   Codes : {BIG} {SMALL} = noms · {nbig} {nsmall} = effectifs.
  //   Ne se joue QUE si le nombre a réellement décidé (voir narrateClash).
  var NUMBERS_WIN = [
    "{BIG} se répartissent les angles : pendant que l'un fixe {SMALL}, l'autre passe derrière.",
    "{SMALL} doit parer sur deux fronts à la fois, et n'y arrive pas.",
    "{BIG} avancent en tenaille. Chaque pas de recul rapproche {SMALL} d'un autre adversaire.",
    "À {nbig} contre {nsmall}, {BIG} n'ont qu'à garder la pression et laisser {SMALL} s'épuiser.",
    "{BIG} n'ont même pas besoin de bien se battre : il suffit d'être là, tous, en même temps.",
    "Un des alliés de {BIG} occupe {SMALL} de face ; le reste se décide dans le dos.",
    "{BIG} se relaient — l'un frappe, se retire, un autre prend le relais. {SMALL} ne souffle jamais.",
    "{SMALL} ne peut affronter qu'un adversaire à la fois. {BIG} en profitent, chacun leur tour.",
    "Le nombre transforme la moindre erreur de {SMALL} en faute décisive.",
    "{BIG} forment un demi-cercle. {SMALL} recule jusqu'à l'arbre, et l'arbre l'arrête.",
    "{SMALL} en met un à terre — il en reste toujours autant debout en face.",
    "{SMALL} se bat pour deux, vise juste, tient bon. À {nbig} contre {nsmall}, ça ne suffit pas.",
    "{SMALL} fonce sur un seul adversaire pour briser le groupe. Le groupe ne se brise pas.",
    "Le courage de {SMALL} ne rattrape pas l'arithmétique."
  ];

  // NUMBERS_WIN_MANY — même idée, mais les DEUX camps sont des groupes :
  //   aucune phrase ne pose de verbe sur {SMALL} (son nombre varie).
  var NUMBERS_WIN_MANY = [
    "Le compte est simple : {nbig} contre {nsmall}. À chaque échange, il reste un adversaire de trop en face.",
    "{BIG} avancent en tenaille ; il n'y a pas assez de bras en face pour tenir les deux côtés.",
    "{BIG} se relaient — l'un frappe, se retire, un autre prend le relais. En face, personne ne souffle.",
    "Chaque erreur coûte double quand on est moins nombreux, et il en vient une du côté de {SMALL}.",
    "{BIG} gardent la formation. En face, la ligne se troue, puis cède d'un coup.",
    "À {nbig} contre {nsmall}, {BIG} n'ont qu'à garder la pression et laisser le temps faire le reste.",
    "Le surnombre de {BIG} finit par ouvrir une brèche que rien, en face, ne vient refermer."
  ];

  // WEAPON_WIN / WEAPON_LOSE — une arme a fait la différence.
  //   Codes : {who} = le tribut · {w} = son arme AU SINGULIER ("l'arc", "la
  //   lance", "le couteau") · {foe} = l'adversaire.
  //   WEAPON_WIN : {who} l'emporte grâce à {w}. WEAPON_LOSE : {who} perd parce
  //   que {w} était le mauvais choix pour la situation.
  //   IMPORTANT : aucun adjectif/participe accordé sur {w} (il change de genre).
  var WEAPON_WIN = [
    "{who} garde {foe} exactement là où {w} porte le mieux. {foe} n'entre jamais dans le sien.",
    "Avec {w} en main, {who} contrôle ce genre de rencontre du début à la fin.",
    "{who} a l'arme qu'il faut pour ça. {foe}, non — et toute la suite en découle.",
    "{foe} ne trouve pas l'ouverture : {w} de {who} l'en empêche à chaque tentative.",
    "{who} laisse {w} travailler et se contente de tenir la distance. {foe} s'épuise à la combler.",
    "Dans cette configuration, {w} de {who} vaut un tribut de plus. {foe} l'apprend vite.",
    "{who} a attendu le bon moment pour que {w} donne son plein effet. {foe} n'a rien à répondre.",
    "Le terrain va à {w} de {who} comme un gant. {foe} l'a compris une seconde trop tard.",
    "{who} n'a même pas besoin de bien viser : à cette portée, {w} suffit.",
    "{foe} sait dès le premier échange que c'est mal engagé face à {w}."
  ];
  var WEAPON_LOSE = [
    "{w} n'est pas l'arme de cette rencontre, et {who} le paie cher.",
    "{who} perd un temps à chaque geste, à composer avec {w} dans un espace qui ne s'y prête pas.",
    "{who} aurait échangé {w} contre n'importe quoi d'autre, là, tout de suite.",
    "{who} se bat contre le terrain autant que contre {foe} : {w} le gêne plus qu'autre chose.",
    "{who} tient {w}, et c'est précisément le problème face à {foe} ici.",
    "{w} aurait fait des merveilles à la rencontre d'hier. Pas à celle-ci — {who} le comprend trop tard.",
    "{who} n'arrive jamais à mettre {w} à distance utile. {foe} reste toujours du mauvais côté.",
    "Chaque fois que {who} arme un coup avec {w}, {foe} a déjà bougé.",
    "{who} lâche {w} en cours de combat pour se battre autrement. Trop tard.",
    "Mauvaise arme, mauvais endroit : {who} ne peut rien tirer de {w} contre {foe}."
  ];

  // EXCHANGE — échange de coups générique. Codes : {A} {B} uniquement.
  //   Pas d'arme, pas d'issue tranchée (juste « ça penche »). 2e ligne neutre.
  var EXCHANGE = [
    "{A} presse, {B} recule, un pied glisse sur la mousse.",
    "{B} touche le premier — une entaille, rien de décisif. {A} répond deux fois.",
    "Coup, parade, coup. Ni {A} ni {B} ne cède un pouce de terrain.",
    "{A} force le rythme jusqu'à ce que le bras de {B} tremble.",
    "{B} tente une feinte ; {A} l'avait vue venir.",
    "Ils roulent au sol, se reprennent, se relèvent. {A} une seconde avant {B}.",
    "{A} recule vers un arbre pour souffler ; {B} charge dans la foulée.",
    "{A} bloque, dévie, cherche l'ouverture. {B} la lui donne en voulant en finir trop vite.",
    "{B} prend l'avantage trois secondes — puis {A} change d'angle et tout bascule.",
    "{A} encaisse un coup qui aurait dû tout finir, et reste debout.",
    "Le combat se déporte vers la pente. Celui qui garde l'équilibre gardera la vie.",
    "{A} vise les jambes, {B} protège le haut. L'un des deux se trompe de priorité.",
    "{B} met un genou à terre, se redresse d'un bond, repart. {A} attendait ça.",
    "{A} feinte à droite, frappe à gauche. {B} avait misé sur la droite.",
    "{A} garde la main haute, économise ses coups. {B} se dépense trop vite.",
    "{B} glisse dans la boue, se rattrape à une branche — qui casse.",
    "Chaque seconde use {B} un peu plus. {A} l'a compris et ralentit exprès.",
    "{B} tente une dernière charge. {A} s'écarte et laisse l'élan faire.",
    "{A} prend un coup à l'épaule pour en placer deux au corps. Le calcul est bon.",
    "{A} laisse {B} croire à l'ouverture, la referme au dernier instant.",
    "Deux coups pour rien, un troisième qui porte. {B} sent que le rythme lui échappe.",
    "{A} recule en cercle, oblige {B} à tourner face au soleil.",
    "Le sol en pente donne l'avantage à qui est en haut. {A} y est monté le premier.",
    "{A} feint l'épuisement ; {B} se précipite ; {A} n'était pas épuisé.",
    "{B} vise trop bien, trop tôt. {A} laisse passer et referme.",
    "{A} recule de trois pas, puis de trois autres. {B} suit — droit dans le piège du terrain.",
    "{B} touche deux fois, sans profondeur. {A} attend la troisième, qui n'arrivera pas.",
    "Les gardes se cherchent, se trouvent, se rompent. {A} garde un temps d'avance à chaque échange.",
    "{A} encaisse le premier assaut sans broncher. {B} comprend que ça va être long.",
    "{B} multiplie les coups pour finir vite. {A} en laisse passer un sur deux et ne bouge pas.",
    "Ça se joue au souffle : {A} respire encore, {B} beaucoup moins.",
    "{A} recule vers l'eau, {B} le pousse — et se retrouve à découvert sur les galets.",
    "{B} fait tomber {A}, se jette dessus. {A} avait gardé une main libre pour ça.",
    "Un échange trop rapide pour l'œil. Quand ça ralentit, {A} est encore debout."
  ];

  // GROUP_MID — 2e ligne neutre quand au moins un camp est un GROUPE et que
  //   rien n'a tranché. {A} = camp le plus nombreux (pluriel). {B} = l'autre.
  var GROUP_MID = [
    "{A} avancent en ligne, méthodiques. {B} recule{tB} sans trouver d'ouverture.",
    "{A} se passent {B} de l'un à l'autre : chacun frappe puis se retire.",
    "{A} gardent la formation ; impossible pour {B} de prendre qui que ce soit à revers.",
    "{A} ne se pressent pas. Le temps joue contre {B}, pas contre eux.",
    "{B} touche{tB} un des alliés de {A}. Deux autres comblent le trou aussitôt.",
    "{A} resserrent le cercle d'un pas. En face, on le sent se refermer.",
    "{B} cherche{tB} la faille dans le groupe de {A}. Il n'y en a pas encore."
  ];
  // GROUP_STANDOFF — fin sans mort, camp = groupe. {A} = plus nombreux.
  var GROUP_STANDOFF = [
    "{A} laissent filer {B} : la poursuite coûterait un blessé de trop.",
    "Un canon ailleurs dans l'arène disperse tout le monde avant l'assaut de {A}.",
    "{B} se glisse{tB} entre deux alliés de {A} et file{tB} dans le couvert.",
    "{A} rompent d'eux-mêmes : pas la peine de risquer un des leurs pour si peu.",
    "Le brouillard des Juges avale la clairière. {A} et {B} décrochent."
  ];

  // TIGHT — combat vraiment serré, ajouté en 3e ligne quand res.margin est minuscule.
  //   Codes : {A} {B} {DEUX}. NE PAS joindre {A} et {B} avec « et » (voir {DEUX}).
  var TIGHT = [
    "Deux corps à bout de forces qui s'accrochent l'un à l'autre. Ça ne tient plus qu'à la volonté.",
    "{DEUX} devraient déjà être à terre. {DEUX} sont pourtant encore debout.",
    "Chacun a saigné, chacun a manqué le coup décisif. Ça se joue au prochain.",
    "Le combat dure trop longtemps pour ce que ça vaut. Il faudra bien que l'un des deux lâche.",
    "{DEUX} se regardent, essoufflés, et repartent quand même.",
    "Une rencontre qui aurait dû finir en dix secondes en dure cent.",
    "Le premier à faiblir est mort, et {DEUX} le savent. L'un des deux va faiblir.",
    "Coup pour coup, chute pour chute. Il faut un rien pour que ça bascule."
  ];

  // STANDOFF — fin SANS mort. Codes : {A} {B} {DEUX}.
  //   NE PAS écrire « {A} et {B} » (casse si un camp est un groupe) → « {DEUX} ».
  var STANDOFF = [
    "{DEUX} rompent le combat, à bout de souffle, et s'éclipsent chacun de son côté.",
    "Un cri au loin fait décrocher les deux camps avant le coup décisif.",
    "Reculade de {B} ; {A} ne poursuit pas. Personne n'a l'énergie d'en finir.",
    "Match nul : {DEUX} se séparent en se surveillant du coin de l'œil.",
    "Les coups s'espacent, puis s'arrêtent d'un commun accord — pour cette fois.",
    "{B} bat en retraite dans les fourrés ; {A} ramasse ce qui traîne et disparaît.",
    "Un canon retentit ailleurs dans l'arène. {DEUX} en profitent pour rompre.",
    "Trop de sang perdu des deux côtés pour un dernier échange. Chacun décroche.",
    "Le brouillard des Juges recouvre la clairière et met fin à la rencontre.",
    "{DEUX} entendent la meute approcher. L'ennemi commun passe d'abord.",
    "Blessés et méfiants, {DEUX} reculent sans se quitter des yeux.",
    "Un grondement de séisme ouvre une crevasse au milieu du combat. La suite attendra.",
    "{A} lève une main : trêve. {B} accepte, sans baisser sa garde.",
    "Ni {A} ni {B} ne veut mourir pour un combat que personne ne regarde vraiment."
  ];

  function names(list) { return list.map(who).join(" & "); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  // Nom d'un camp : un tribut → son nom ; deux → « X et Y » ; trois et plus →
  // « X et les siens » (pour que le texte ne traite pas le groupe comme UNE personne).
  function unitName(list) {
    if (!list.length) return "?";
    if (list.length === 1) return who(list[0]);
    if (list.length === 2) return who(list[0]) + " et " + who(list[1]);
    return who(list[0]) + " et les siens";
  }
  // Remplace {A}/{B}/{na}/{nb}/{DEUX} par les noms de camps, en gérant le cas
  //   « au moins un camp est un groupe » : « {A} et {B} » comme sujet commun
  //   deviendrait « X et les siens et Y » (illisible) → on le remplace par
  //   « les deux camps ». {DEUX} = pareil, à utiliser directement.
  // À utiliser PARTOUT où une phrase parle des camps.
  function subCamps(s, a, b) {
    var grouped = a.length > 1 || b.length > 1;
    var deux = grouped ? "les deux camps" : "les deux";
    if (grouped) {
      s = s.replace(/entre \{A\} et \{B\}/g, "entre " + deux)
           .replace(/[Nn]i \{A\} ni \{B\}/g, "ni un camp ni l'autre")
           .replace(/\{A\} et \{B\}/g, deux);
    }
    // {tB} : terminaison du verbe qui porte sur {B} (rien au singulier, "nt"
    // au pluriel). N'employer QUE des verbes du 1er groupe sur {B}.
    var out = s.replace(/\{tB\}/g, b.length > 1 ? "nt" : "")
               .replace(/\{A\}/g, unitName(a)).replace(/\{B\}/g, unitName(b))
               .replace(/\{DEUX\}/g, deux)
               .replace(/\{na\}/g, String(a.length)).replace(/\{nb\}/g, String(b.length))
               .replace(/ et les siens et /g, " et les siens, face à ");
    return out.charAt(0).toUpperCase() + out.slice(1);   // début de phrase
  }
  // Remplit un modèle NUMBERS_WIN. prep() évite « de les Carrières ».
  function fillNumbers(tpl, big, small, nbig, nsmall) {
    return cap(tpl
      .replace(/ de \{BIG\}/g, " " + prep("de", big)).replace(/ à \{BIG\}/g, " " + prep("à", big))
      .replace(/ de \{SMALL\}/g, " " + prep("de", small)).replace(/ à \{SMALL\}/g, " " + prep("à", small))
      .replace(/\{BIG\}/g, big).replace(/\{SMALL\}/g, small)
      .replace(/\{nbig\}/g, String(nbig)).replace(/\{nsmall\}/g, String(nsmall)));
  }
  function wkVal(t, kind) { return HG.weaponKindBonus ? HG.weaponKindBonus(t, kind) : 0; }
  // Tribut « vedette » d'un camp pour parler de son arme : un joueur d'abord.
  function focusOf(list) {
    for (var i = 0; i < list.length; i++) if (list[i].isPlayer) return list[i];
    return list[0];
  }
  // « à/de » + article : au/aux/du/des (« face à le couteau » → « face au couteau »).
  function prep(p, w) {
    if (p === "à") {
      if (w.indexOf("le ") === 0) return "au " + w.slice(3);
      if (w.indexOf("les ") === 0) return "aux " + w.slice(4);
    } else if (p === "de") {
      if (w.indexOf("le ") === 0) return "du " + w.slice(3);
      if (w.indexOf("les ") === 0) return "des " + w.slice(4);
    }
    return p + " " + w;
  }
  function weaponSay(pool, holder, foe, rng) {
    var w = HG.deaths.weaponThe(holder);   // "l'arc" | "la lance" | "le couteau" | "le trident"
    // \b ne marche pas devant « à » (hors [A-Za-z]) : on capture l'espace.
    return cap(line(rng, pool)
      .replace(/ à \{w\}/g, " " + prep("à", w))
      .replace(/ de \{w\}/g, " " + prep("de", w))
      .replace(/\{w\}/g, w)
      .replace(/\{who\}/g, who(holder))
      .replace(/\{foe\}/g, who(foe)));
  }

  // Un affrontement = UNE fenêtre où les phrases s'accumulent. L'issue (mort /
  // blessure / repli) est poussée APRÈS, comme beat distinct.
  function narrateClash(a, b, kind, res, rng) {
    var winIds = res.winners || [];
    function won(t) { return winIds.indexOf(t.id) !== -1; }

    // COHÉRENCE — {A} désigne TOUJOURS le camp qui prend l'ascendant.
    // Les pools d'approche (traque, embuscade, tir) racontent {A} en train de
    // mener la rencontre : si {A} était le perdant, la scène disait l'inverse
    // de son dénouement (« {A} tient {B} en joue » puis {A} meurt).
    if (!a.some(won) && b.some(won)) { var swap = a; a = b; b = swap; }

    var na = a.length, nb = b.length;
    // « décisif » = quelqu'un meurt dans cette rencontre. Sinon (repli, simple
    // blessure), on reste sur du neutre : le nombre / l'arme n'ont rien tranché.
    var decisive = (res.outcomes || []).some(function (o) { return o.result === "death"; });
    var grouped = na > 1 || nb > 1;

    // Pour APPROACH_GROUP / GROUP_MID, {A} doit être le camp le plus NOMBREUX
    // (contrainte de grammaire : ces phrases mettent {A} au pluriel).
    var ga = a, gb = b;
    if (grouped && nb > na) { ga = b; gb = a; }

    // Portraits : quand une alliance est en jeu, chaque camp est encadré.
    var ppl = grouped
      ? campPorts(a, "a").concat(campPorts(b, "b"))
      : [port(a[0]), port(b[0])];

    var lines = [ grouped
      ? subCamps(line(rng, APPROACH_GROUP), ga, gb)
      : subCamps(line(rng, APPROACH[kind] || APPROACH.melee), a, b) ];

    // --- UNE seule ligne de « développement », cohérente avec l'issue ---
    var mid = null;

    // 1) Le nombre a tranché ? Le camp vainqueur est une alliance ET il est le
    //    plus nombreux : c'est l'avantage de l'alliance, on le montre.
    var numbers = decisive && na >= 2 && na > nb ? function () {
      // NUMBERS_WIN parle de {SMALL} au singulier ; à plusieurs contre
      // plusieurs, on bascule sur le pool qui ne l'accorde jamais.
      return fillNumbers(line(rng, nb > 1 ? NUMBERS_WIN_MANY : NUMBERS_WIN),
        unitName(a), unitName(b), na, nb);
    } : null;

    // 2) L'arme a tranché ? (avantage/désavantage net pour la situation)
    var weapon = null;
    if (decisive) {
      var fa = focusOf(a), fb = focusOf(b);
      var va = wkVal(fa, kind), vb = wkVal(fb, kind);
      var realA = fa.weapon && fa.weapon !== "none" && HG.WEAPONS[fa.weapon];
      var realB = fb.weapon && fb.weapon !== "none" && HG.WEAPONS[fb.weapon];
      if (realA && va - vb >= 3) weapon = function () { return weaponSay(WEAPON_WIN, fa, fb, rng); };
      else if (realB && vb - va <= -3) weapon = function () { return weaponSay(WEAPON_LOSE, fb, fa, rng); };
    }

    if (numbers && weapon) mid = rng.chance(0.5) ? numbers() : weapon();
    else if (numbers) mid = numbers();
    else if (weapon) mid = weapon();

    // 3) Sinon : un échange neutre (repli ou victoire sans explication).
    if (!mid) mid = subCamps(line(rng, grouped ? GROUP_MID : EXCHANGE), grouped ? ga : a, grouped ? gb : b);
    lines.push(mid);

    // Combat serré ET tranché : une ligne de tension en plus (rare).
    if (decisive && res.margin < 0.18) {
      lines.push(subCamps(line(rng, TIGHT), grouped ? ga : a, grouped ? gb : b));
    }

    return [{ portraits: ppl, cls: "", lines: lines, camps: grouped }];
  }

  // ---- Environnement d'une manche -------------------------------
  function runEnvironment(ev, beats, eventMod) {
    var rng = S().rng;

    if (ev.mockingjay) {
      beats.push({ cls: "", music: null, text: line(rng, [
        "Quatre notes courent d'arbre en arbre. Un tribut siffle en retour.",
        "Les geais moqueurs reprennent un air. Quelque part, quelqu'un répond, et se trahit.",
        "Un chant passe de branche en branche à travers toute l'arène. Signal d'alliance, ou appât ?"
      ]) });
      HG.living().forEach(function (t) { if (t.district === 11 || t.isPlayer) t.roomFavor += 1; });
    }
    if (ev.bonding) {
      HG.living().forEach(function (t) { if (t.allies.length && t.wound > 0) t.wound -= 1; });
      beats.push({ cls: "", text: line(rng, [
        "Autour des feux, les alliés pansent leurs plaies et se partagent les dernières rations.",
        "Nuit calme : les alliances se resserrent, on monte la garde à tour de rôle, on récupère.",
        "Ceux qui ont un allié dorment un peu cette nuit. Les autres, non."
      ]) });
    }
    if (ev.hitsPack) {
      HG.living().forEach(function (t) {
        if (t.inPack) { t.supplies = Math.max(0, t.supplies - 2); if (rng.chance(0.3)) t.wound = Math.min(2, t.wound + 1); }
      });
    }

    if (!ev.exposure) return;
    var envMul = (eventMod && eventMod.envMul) || 1;
    var living = HG.living();
    var nExposed = Math.round(living.length * ev.exposure);
    if (nExposed < 1) return;
    var exposed = rng.shuffle(living.slice()).slice(0, nExposed);

    exposed.forEach(function (t) {
      if (!t.alive) return;
      // Les amants maudits désignés se tirent mutuellement des mauvais pas.
      if (loversPairAlive() && loversHas(t)) return;
      var surMit = HG._clamp(1 - (t.stats.sur - 5) * 0.06, 0.5, 1.4);
      var pDeath = (ev.envDeath || 0) * envMul * surMit * (t.career ? 0.85 : 1);
      if (t.gift && t.gift.bonus && (t.gift.bonus.sur || 0) >= 2) pDeath *= 0.6;
      if (t.wound) pDeath *= 1 + 0.25 * t.wound;

      if (rng.chance(HG._clamp(pDeath, 0, 0.85))) {
        var r = applyOutcome({ tribute: t, result: "death", killerId: null, kind: "environment" },
          { environmental: true, eventId: ev.id });
        if (r) beats.push(r);
      } else if (rng.chance(ev.envWound || 0)) {
        t.wound = Math.min(2, t.wound + 1);
        beats.push({ portraits: [port(t)],
          text: line(rng, [
            who(t) + " en réchappe de justesse, mais diminué(e).",
            who(t) + " s'en sort — une blessure de plus à traîner.",
            who(t) + " survit à l'épreuve, le souffle court.",
            who(t) + " traverse le pire de justesse, la peau marquée par les Juges.",
            who(t) + " en sort vivant(e), les mains tremblantes et une entaille de plus."
          ]), cls: "" });
      }
    });
  }

  // ---- Rencontres d'une manche ---------------------------------
  function runEncounters(ev, beats, eventMod) {
    var rng = S().rng;
    var living = HG.living();
    if (living.length <= 1) return;
    eventMod = eventMod || {};
    var pressure = eventMod.powerMul && eventMod.powerMul > 1;

    var pack = living.filter(function (t) { return t.inPack; });
    var usedIds = {}, encounters = [];

    var packHuntChance = ev.packHunts ? 0.95 : (living.length > 12 ? 0.22 : 0.4);
    if (packHuntChance > rng.f() && pack.length >= 2) {
      var prey = rng.shuffle(living.filter(function (t) { return !t.inPack; }));
      if (living.length > 12) prey.sort(function (a, b) { return HG.alliesOf(a).length - HG.alliesOf(b).length; });
      if (prey.length) {
        var target = [prey[0]].concat(HG.alliesOf(prey[0]).filter(function (a) { return !a.inPack; }));
        var lp = S().loversPair;
        if (lp && lp.indexOf(prey[0].id) !== -1) {
          lp.forEach(function (id) { var x = HG.byId(id); if (x && x.alive && target.indexOf(x) === -1) target.push(x); });
        }
        target = target.filter(function (t, i, a) { return a.indexOf(t) === i; });
        encounters.push({ a: pack.slice(), b: target, kind: "hunt", pack: true });
        pack.forEach(function (t) { usedIds[t.id] = true; });
        target.forEach(function (t) { usedIds[t.id] = true; });
      }
    }

    var rest = living.filter(function (t) { return !usedIds[t.id]; });
    var units = rng.shuffle(buildUnits(rest));
    var base = HG._clamp(Math.round(rest.length / 4.2), 1, 5);
    var count = Math.round(base * (ev.encounterMul || 1));
    if (ev.quiet && !pressure) count = rng.chance(0.4) ? 1 : 0;
    if (pressure) count = Math.max(count, Math.ceil(units.length / 2.5));
    count = Math.min(count, Math.floor(units.length / 2));

    for (var i = 0; i + 1 < units.length && encounters.length < count + (encounters.length ? 1 : 0); i += 2) {
      encounters.push({ a: units[i], b: units[i + 1], kind: pickKind(ev, rng, units[i]) });
    }

    encounters.forEach(function (enc) {
      var a = enc.a.filter(function (t) { return t.alive; });
      var b = enc.b.filter(function (t) { return t.alive; });
      if (!a.length || !b.length) return;

      // Compétence Furtivité : la proie de la meute peut disparaître.
      if (enc.pack && b.length === 1 && HG.hasEdge(b[0], "evadePack") && rng.chance(0.6)) {
        beats.push({ portraits: [port(b[0])], cls: "",
          text: line(rng, [
            who(b[0]) + " se fond dans les broussailles ; la meute passe à trois mètres sans rien voir.",
            who(b[0]) + " se glisse sous un tronc pourri et retient son souffle. La meute continue sans ralentir.",
            "La meute suit une fausse piste. " + who(b[0]) + " est déjà loin, dans l'autre sens.",
            who(b[0]) + " grimpe sans un bruit ; les torches passent en dessous et s'éloignent."
          ]) });
        return;
      }
      // Compétence Pisteur / anti-embuscade : retourne l'embuscade.
      if (!enc.pack && enc.kind === "ambush" && HG.hasEdge(b[0], "antiAmbush") && rng.chance(0.6)) {
        beats.push({ portraits: a.slice(0, 1).map(function (t) { return port(t); }).concat([port(b[0])]), cls: "",
          text: line(rng, [
            who(b[0]) + " a lu les traces : l'embuscade de " + unitName(a) + " est éventée. Les rôles s'inversent.",
            who(b[0]) + " repère le fil tendu à temps, l'enjambe, et prend " + unitName(a) + " à revers.",
            "Une branche cassée, une empreinte de trop : " + who(b[0]) + " sent le piège de " + unitName(a) + " avant d'y tomber.",
            who(b[0]) + " s'arrête net à dix pas du guet-apens de " + unitName(a) + ". Maintenant c'est " + unitName(a) + " qui est repéré."
          ]) });
        enc.a = b; enc.b = a; a = enc.a.filter(function (t) { return t.alive; }); b = enc.b.filter(function (t) { return t.alive; });
        enc.kind = "hunt";
      }
      // Compétence Archerie : un tir d'ouverture avant le corps-à-corps.
      if (!enc.pack && HG.hasEdge(a[0], "firstStrike") && a[0].alive && rng.chance(0.55)) {
        var pre = HG.resolveStalk(a[0], b[0], rng, { powerMul: 0.9 });
        var preDeath = false;
        pre.outcomes.forEach(function (o) {
          if (o.result === "death" && o.tribute === b[0]) {
            var kb0 = applyOutcome({ tribute: b[0], result: "death", killerId: a[0].id, kind: "ranged" }, null);
            if (kb0) { beats.push({ portraits: [port(a[0]), port(b[0], { dead: true })], cls: "",
              text: line(rng, [
                who(a[0]) + " décoche avant même que la distance soit franchie.",
                who(a[0]) + " n'a pas eu à attendre le corps-à-corps : une flèche a suffi.",
                who(b[0]) + " charge tête baissée, droit dans la ligne de tir de " + who(a[0]) + ".",
                "Le premier tir de " + who(a[0]) + " est aussi le dernier acte de la rencontre."
              ]) }); beats.push(kb0); preDeath = true; }
          }
        });
        if (preDeath) return;
        beats.push({ portraits: [port(a[0])], cls: "",
          text: line(rng, [
            who(a[0]) + " lâche une flèche d'ouverture ; " + who(b[0]) + " l'esquive de peu et charge.",
            who(a[0]) + " tire trop vite : " + who(b[0]) + " a déjà comblé la moitié de la distance.",
            "La flèche de " + who(a[0]) + " frôle " + who(b[0]) + " sans l'arrêter. Il faudra faire ça de près."
          ]) });
      }

      var res = HG.resolveEncounter(a, b, enc.kind, rng, eventMod);

      var clashBeat = null;
      if (enc.pack) {
        var packLead = names(a.slice(0, 3));
        var preyN = unitName(b);
        var preyS = b.length > 1 ? "s" : "";           // accord de la proie
        var packWon = a.some(function (t) { return (res.winners || []).indexOf(t.id) !== -1; });
        var pk = [
          cap(line(rng, [
            "La meute des Carrières a rattrapé " + preyN + ".",
            preyN + " se retrouve" + (preyS ? "nt" : "") + " encerclé" + preyS + " — " + packLead + " en tête de meute.",
            "Les torches de la meute se referment sur " + preyN + ".",
            "À " + a.length + " chasseurs contre " + b.length + ", la meute ne se presse même pas.",
            packLead + " et le reste de la meute prennent " + preyN + " en étau.",
            "La meute chasse en ligne, sans un mot : " + preyN + " n'a plus que la falaise devant " +
              (preyS ? "eux" : "lui") + ".",
            "Ce que l'alliance des Carrières fait le mieux, elle le fait maintenant, sur " + preyN + "."
          ]))
        ];
        // avantage du nombre — seulement si la meute l'emporte
        pk.push(packWon
          ? fillNumbers(line(rng, b.length > 1 ? NUMBERS_WIN_MANY : NUMBERS_WIN),
              "les Carrières", preyN, a.length, b.length)
          : cap(line(rng, [
              preyN + " s'arrache" + (preyS ? "nt" : "") + " de l'étau et disparaî" + (preyS ? "ssent" : "t") +
                " dans le noir. La meute a perdu du temps.",
              preyN + " renverse" + (preyS ? "nt" : "") + " un des Carrières et file" + (preyS ? "nt" : "") +
                " par la brèche avant qu'elle ne se referme.",
              "La meute était trop sûre d'elle : elle a laissé une brèche, et " + preyN + " l'a prise."
            ])));
        clashBeat = {
          portraits: campPorts(a, "a").concat(campPorts(b, "b")),
          cls: "", lines: pk, camps: true
        };
        beats.push(clashBeat);
      } else {
        var cbs = narrateClash(a, b, enc.kind, res, rng);
        cbs.forEach(function (nb) { beats.push(nb); });
        clashBeat = cbs[cbs.length - 1];
      }

      var anyDeath = false;
      res.outcomes.forEach(function (o) {
        var kb = applyOutcome(o, null);
        if (kb) { beats.push(kb); anyDeath = true; }
      });
      if (!anyDeath && !enc.pack) {
        // pas de mort : le repli rejoint la même fenêtre — 3 lignes max.
        var grpEnc = a.length > 1 || b.length > 1;
        // {A} = celui qui a pris l'ascendant (STANDOFF), ou le plus nombreux
        // quand un camp est un groupe (GROUP_STANDOFF met {A} au pluriel).
        var upper = a.some(function (t) { return (res.winners || []).indexOf(t.id) !== -1; }) ? a : b;
        var lower = upper === a ? b : a;
        var big = grpEnc && b.length > a.length ? b : a;
        var small = big === a ? b : a;
        var so = grpEnc ? subCamps(line(rng, GROUP_STANDOFF), big, small)
                        : subCamps(line(rng, STANDOFF), upper, lower);
        if (clashBeat && clashBeat.lines && clashBeat.lines.length < 3) clashBeat.lines.push(so);
        else beats.push({ portraits: clashBeat ? clashBeat.portraits : undefined, text: so, cls: "" });
      } else if (!anyDeath && enc.pack) {
        var preyN2 = unitName(b);
        if (clashBeat && clashBeat.lines && clashBeat.lines.length < 3) {
          var pl2 = b.length > 1;
          clashBeat.lines.push(cap(line(rng, [
            "Le canon ne vient pas : " + preyN2 + " a réussi à rompre le cercle.",
            preyN2 + " s'échappe" + (pl2 ? "nt" : "") + ", blessé" + (pl2 ? "s" : "") + " mais vivant" +
              (pl2 ? "s" : "") + ". La meute rentre bredouille.",
            "La meute se disperse sans avoir eu " + preyN2 + ". Pour cette fois."
          ])));
        }
      }
    });
  }

  // ---- La meute des Carrières se fracture ----------------------
  function runPackFracture(beats) {
    var rng = S().rng;
    var pack = HG.living().filter(function (t) { return t.inPack; });
    if (pack.length < 2) return;
    var living = HG.living().length;
    var p = 0.03;
    if (pack.length <= 3) p += 0.16;
    if (pack.length <= 2) p += 0.18;
    if (living <= pack.length + 1) p += 0.4;
    if (!rng.chance(Math.min(0.9, p))) return;

    var sorted = pack.slice().sort(function (a, b) {
      return HG.combatPower(a, "melee") - HG.combatPower(b, "melee");
    });
    var lp = S().loversPair;
    if (lp) sorted = sorted.filter(function (t) {
      return !(lp.indexOf(t.id) !== -1 && lp.every(function (id) { var x = HG.byId(id); return x && x.alive; }));
    });
    if (sorted.length < 2) return;
    var victim = sorted[0], killer = sorted[sorted.length - 1];
    pack.forEach(function (t) { HG.breakAlliance(t, victim); });
    victim.inPack = false;

    beats.push({
      stamp: { text: "Trahison", kind: "betray" },
      portraits: [port(killer, { camp: "traitor" }), port(victim, { camp: "victim" })],
      camps: true,
      lines: [line(rng, [
        "La meute des Carrières se déchire : " + who(killer) + " se retourne contre " + who(victim) + ".",
        "Les vivres manquent. " + who(killer) + " décide qu'il y a une bouche de trop : " + who(victim) + ".",
        who(killer) + " et " + who(victim) + " se disputent le butin. Ça tourne mal.",
        "L'alliance des Carrières n'était bonne que tant qu'il restait des proies dehors. Il n'en reste plus assez : " + who(killer) + " le comprend le premier.",
        who(killer) + " n'attend pas d'être le suivant sur la liste. " + who(victim) + " est plus lent(e) à s'en rendre compte."
      ])], cls: "event"
    });
    var l = applyOutcome({ tribute: victim, result: "death", killerId: killer.id, kind: "pack_turn" }, null);
    if (l) beats.push(l);

    if (pack.length <= 3) {
      HG.living().filter(function (t) { return t.inPack; }).forEach(function (t) { t.inPack = false; });
      beats.push({ text: line(rng, [
        "Ce qui restait de la meute vole en éclats. Désormais, chacun pour soi.",
        "Plus de meute, plus d'alliance : les derniers Carrières partent chacun de leur côté, sur leurs gardes.",
        "L'alliance qui faisait peur à toute l'arène n'existe plus. Reste des tributs seuls, armés et méfiants."
      ]), cls: "" });
    }
  }

  // ---- Trahisons ---------------------------------------------
  function runBetrayals(beats) {
    var rng = S().rng;
    var living = HG.living();
    if (living.length > 6) return;
    var units = buildUnits(living).filter(function (u) { return u.length >= 2; });
    units.forEach(function (u) {
      if (u.length === 2 && HG.isDesignatedLovers(u[0], u[1])) return;
      var p = 0.1 + (6 - living.length) * 0.07 + (u.length >= 3 ? 0.18 : 0);
      if (!rng.chance(p)) return;

      var sorted = u.slice().sort(function (x, y) { return y.stats.cun - x.stats.cun; });
      var traitor = sorted[0], victim = pick(rng, sorted.slice(1));
      HG.breakAlliance(traitor, victim);
      var setup = {
        stamp: { text: "Trahison", kind: "betray" },
        portraits: [port(traitor, { camp: "traitor" }), port(victim, { camp: "victim" })],
        camps: true,
        lines: [line(rng, [
          "L'alliance de " + who(traitor) + " et " + who(victim) + " se fissure dans la nuit.",
          who(traitor) + " attend que le feu baisse et que " + who(victim) + " ferme les yeux.",
          "Il ne reste plus assez de place pour deux. " + who(traitor) + " le sait avant " + who(victim) + ".",
          who(traitor) + " a compté les vivres, compté les tributs restants, et pris sa décision.",
          "Un allié de moins, c'est un adversaire de moins plus tard. " + who(traitor) + " y pense fort en regardant " + who(victim) + " dormir."
        ])], cls: "event"
      };
      beats.push(setup);
      var res = HG.resolveBetrayal(traitor, victim, rng);
      var died = false;
      res.outcomes.forEach(function (o) { var kb = applyOutcome(o, null); if (kb) { beats.push(kb); died = true; } });
      if (!died) setup.lines.push(line(rng, [
        who(victim) + " a senti le coup venir. Les deux se séparent, à vif.",
        who(victim) + " se réveille une seconde trop tôt. L'alliance est finie, mais pas " + who(victim) + ".",
        "La lame de " + who(traitor) + " ne trouve que le sac de couchage. " + who(victim) + " est déjà debout, arme au poing."
      ]));
    });
  }

  // ---- Parachutes automatiques ------------------------------
  function runGiftDrops(ev, beats) {
    if (!ev.giftDrop) return;
    var rng = S().rng;
    var n = ev.giftCount || 1;
    for (var i = 0; i < n; i++) {
      var living = HG.living();
      if (!living.length) return;
      var weighted = living.map(function (t) { return { t: t, w: 1 + t.sponsor * 0.05 + t.roomFavor * 0.5 }; });
      var winner = rng.weighted(weighted, "w").t;
      var g = applyGift(winner, rng);
      var gl = [line(rng, [
        "Un parachute argenté descend en silence vers " + who(winner) + " : <b>" + g.label + "</b> — " + g.blurb + ".",
        "Les sponsors de " + who(winner) + " se manifestent : <b>" + g.label + "</b>, " + g.blurb + ".",
        who(winner) + " lève les yeux : un parachute, et au bout <b>" + g.label + "</b> — " + g.blurb + ".",
        "Cadeau du Capitole pour " + who(winner) + " : <b>" + g.label + "</b>. De quoi " + g.blurb + "."
      ])];
      if (g._newWeapon) gl.push(who(winner) + " abandonne " + g._oldWeapon + " pour " + HG.WEAPONS[g._newWeapon].name + " : " + HG.WEAPONS[g._newWeapon].tag + ".");
      beats.push({ portraits: [port(winner)], lines: gl, cls: "gift" });
    }
  }

  function applyGift(t, rng) {
    var base = pick(rng, HG.GIFTS);
    var g = { key: base.key, label: base.label, blurb: base.blurb, heal: base.heal, bonus: base.bonus,
              _newWeapon: null, _oldWeapon: null };
    if (g.heal) t.wound = Math.max(0, t.wound - g.heal);
    t.gift = { bonus: g.bonus, label: g.label, from: S().roundIndex };
    t.sponsor = Math.min(100, t.sponsor + 18);
    // Certains cadeaux changent l'arme portée pour le reste de la partie.
    var nw = HG.GIFT_WEAPON && HG.GIFT_WEAPON[g.key];
    if (nw && t.weapon !== nw) {
      g._oldWeapon = (HG.WEAPONS[t.weapon] && t.weapon !== "none") ? HG.WEAPONS[t.weapon].name : "les mains vides";
      g._newWeapon = nw;
      t.weapon = nw;
      t.weaponShown = true;
    }
    return g;
  }

  function driftSponsors() {
    var fav = HG.currentFavourite();
    HG.living().forEach(function (t) {
      t.sponsor = HG._clamp(t.sponsor - 3 + (t.kills.length ? 2 : 0), 0, 100);
      if (fav && t.id === fav.id) t.sponsor = Math.min(100, t.sponsor + 6);
      if (t.gift && t.gift.from < S().roundIndex - 2) t.gift = null;
    });
  }

  // =========================================================
  //  API PUBLIQUE
  // =========================================================
  HG.sim = {

    // --- Bain de sang de la Corne d'abondance ---
    bloodbath: function (actions) {
      var st = S();
      var rng = st.rng;
      st.day = 1; st.timeOfDay = "day";
      var beats = [];

      beats.push({ kicker: "Jour 1 · la Corne d'abondance", text: HG.commentary.claudius.open,
        cls: "announce", voice: { who: "claudius" }, hold: 1.3 });

      var careers = st.tributes.filter(function (t) { return t.career && t.alive; });
      HG.formAlliance(careers.map(function (t) { return t.id; }));
      careers.forEach(function (t) { t.inPack = true; });

      // Un joueur incarnant un Carrière peut fausser compagnie à la meute
      // (tout choix autre que « Foncer »). Les PNJ Carrières, eux, foncent d'office.
      var defectors = careers.filter(function (t) {
        return t.isPlayer && actions[t.id] && actions[t.id] !== "rush";
      });
      defectors.forEach(function (t) {
        t.inPack = false;
        careers.forEach(function (c) { if (c.id !== t.id) HG.breakAlliance(t, c); });
      });
      var packNow = careers.filter(function (t) { return t.inPack; });

      beats.push({
        portraits: campPorts(packNow, "a", { campLabel: "Meute des Carrières" }),
        camps: true,
        text: "Les Carrières se regroupent à la Corne et prennent le contrôle des vivres.", cls: "event"
      });
      if (defectors.length) {
        beats.push({
          stamp: { text: "Défection", kind: "betray" },
          portraits: defectors.map(function (t) { return port(t, { camp: "traitor" }); }),
          camps: true,
          text: names(defectors) + " refuse" + (defectors.length > 1 ? "nt" : "") +
            " la meute et file" + (defectors.length > 1 ? "nt" : "") + " droit vers les bois. Les Carrières n'oublient jamais ça.",
          cls: "event"
        });
      }

      st.tributes.forEach(function (t) {
        if (!t.alive || actions[t.id]) return;
        if (t.inPack) { actions[t.id] = "rush"; return; }
        var r = rng.f();
        actions[t.id] = r < 0.28 ? "rush" : (r < 0.68 ? "grab" : "flee");
      });

      var rushers = HG.living().filter(function (t) { return actions[t.id] === "rush"; });
      var grabbers = HG.living().filter(function (t) { return actions[t.id] === "grab"; });
      var fleers = HG.living().filter(function (t) { return actions[t.id] === "flee"; });

      if (rushers.length >= 2) {
        beats.push({ text: "La ruée sur la Corne d'abondance tourne au carnage.", cls: "event" });
        var shuffled = rng.shuffle(rushers.slice());
        for (var i = 0; i + 1 < shuffled.length; i += 2) {
          var a = shuffled[i], b = shuffled[i + 1];
          if (!a.alive || !b.alive) continue;
          var res = HG.resolveEncounter([a], [b], "melee", rng, { powerMul: 1.35 });
          res.outcomes.forEach(function (o) { var kb = applyOutcome(o, null); if (kb) beats.push(kb); });
        }
        var pack = HG.living().filter(function (t) { return t.inPack; });
        if (pack.length) {
          var stragglers = rng.shuffle(HG.living().filter(function (t) {
            return !t.inPack && (actions[t.id] === "rush" || actions[t.id] === "grab");
          }));
          var toPick = Math.min(stragglers.length, rng.int(0, 2));
          for (var s = 0; s < toPick; s++) {
            var v = stragglers[s];
            if (!v || !v.alive) continue;
            if (rng.chance(0.5 - v.stats.agi * 0.03)) {
              var kb2 = applyOutcome({ tribute: v, result: "death", killerId: pick(rng, pack).id, kind: "melee" }, null);
              if (kb2) beats.push(kb2);
            }
          }
        }
        HG.living().forEach(function (t) {
          if (actions[t.id] === "rush" && t.alive) t.supplies = Math.min(3, t.supplies + (t.inPack ? 3 : rng.int(1, 2)));
        });
      } else if (rushers.length === 1 && rushers[0].alive) {
        rushers[0].supplies = Math.min(3, rushers[0].supplies + 2);
        beats.push({ portraits: [port(rushers[0])], text: who(rushers[0]) + " rafle un sac au bord de la Corne et détale.", cls: "" });
      }

      var packSize = HG.living().filter(function (x) { return x.inPack; }).length;
      grabbers.forEach(function (t) {
        if (!t.alive) return;
        if (rng.chance(packSize >= 3 ? 0.22 : 0.14)) {
          var killer = pick(rng, HG.living().filter(function (x) { return x.inPack && x.alive; }) || []);
          var kb = applyOutcome({ tribute: t, result: "death", killerId: killer ? killer.id : null, kind: "hunt" }, null);
          if (kb) beats.push(kb);
        } else { t.supplies = Math.min(3, t.supplies + 1); }
      });

      fleers.forEach(function (t) {
        if (t.alive && rng.chance(0.05)) {
          var kb = applyOutcome({ tribute: t, result: "death", killerId: null, kind: "environment" },
            { environmental: true, eventId: "quake" });
          if (kb) beats.push(kb);
        }
      });
      if (fleers.length) {
        beats.push({ text: fleers.slice(0, 4).map(function (t) { return t.name; }).join(", ") +
          (fleers.length > 4 ? "…" : "") + " disparaissent dans les bois sans demander leur reste.", cls: "" });
      }

      // --- Qui repart avec quoi : joueurs d'abord, puis Carrières, puis 2 autres.
      var armedShow = HG.living().filter(function (t) { return t.weapon && t.weapon !== "none"; });
      armedShow.sort(function (x, y) {
        return (y.isPlayer ? 1 : 0) - (x.isPlayer ? 1 : 0) ||
               (y.career ? 1 : 0) - (x.career ? 1 : 0) ||
               (y.supplies - x.supplies);
      });
      var players = armedShow.filter(function (t) { return t.isPlayer; });
      var others = armedShow.filter(function (t) { return !t.isPlayer; }).slice(0, players.length ? 3 : 5);
      var toShow = players.concat(others);
      if (toShow.length) {
        var wl = ["À la Corne, chacun s'arme comme il peut — et devra faire avec pour la suite."];
        toShow.forEach(function (t) {
          t.weaponShown = true;
          wl.push(who(t) + " repart avec " + HG.WEAPONS[t.weapon].name + " (" + HG.WEAPONS[t.weapon].tag + ").");
        });
        var barehanded = HG.living().filter(function (t) { return (!t.weapon || t.weapon === "none"); });
        if (barehanded.length) {
          wl.push(names(barehanded.slice(0, 3)) + (barehanded.length > 3 ? " et d'autres" : "") +
            " filent les mains vides : il leur faudra trouver une arme, ou s'en passer.");
        }
        beats.push({ portraits: toShow.slice(0, 5).map(function (t) { return port(t); }), cls: "event", lines: wl });
      }

      var toll = st.deaths.length;
      beats.push({
        kicker: "Fin du bain de sang",
        text: "Quand le silence retombe, <b>" + toll + "</b> tribut" + (toll > 1 ? "s sont" : " est") +
          " déjà tombé" + (toll > 1 ? "s" : "") + ". Il en reste <b>" + HG.living().length + "</b>.",
        cls: "announce", voice: { who: "claudius" }
      });

      // Désigne d'emblée une paire « amants maudits » si une alliance
      // éligible (joueurs / District 12, même district) existe.
      designateLoversIfAny();

      st.bloodbathDone = true;
      st.roundIndex = 0;
      st.lastEvent = { id: "bloodbath", title: "Bain de sang" };
      return { beats: beats };
    },

    // --- Une manche complète ---
    runRound: function () {
      var st = S();
      var rng = st.rng;

      if (st.timeOfDay === "day") st.timeOfDay = "night";
      else { st.day += 1; st.timeOfDay = "day"; }
      st.roundIndex += 1;

      var phase = st.timeOfDay;
      var aliveBefore = HG.living().length;
      var deathsBefore = st.deaths.length;

      // Cap de durée (7 jours) : la pression monte à l'approche, blocus total le dernier jour.
      var maxDays = st.maxDays || 7;
      var daysLeft = maxDays - st.day;
      var lastDay = st.day >= maxDays;
      var stale = st.roundsSinceDeath;
      var pressure = (aliveBefore <= 6 && stale >= 2) || (aliveBefore <= 4 && st.roundIndex > 1) ||
                     (daysLeft <= 2);
      var forceConverge = (stale >= 4 && aliveBefore >= 3 && aliveBefore <= 9) ||
                          (daysLeft <= 1 && aliveBefore >= 3) || lastDay;

      var ev;
      if (forceConverge) {
        ev = HG.EVENTS.filter(function (e) { return e.id === "feast"; })[0] ||
             HG.EVENTS.filter(function (e) { return e.id === "gamemaker_whim"; })[0];
      } else {
        ev = HG.drawEvent(rng, phase, aliveBefore, {
          exclude: st.lastEvent ? [st.lastEvent.id] : [], forceLoud: pressure
        });
      }
      st.lastEvent = { id: ev.id, title: ev.title };
      var lethalMul = lastDay ? 1.9 : daysLeft <= 1 ? 1.5 : daysLeft <= 2 ? 1.25 : (pressure ? 1.15 : 1);
      var eventMod = { powerMul: lethalMul, envMul: pressure ? 1.4 : 1 };

      // Budget de morts de la manche (garde un rythme d'arène crédible).
      if (forceConverge || lastDay || aliveBefore <= 4) deathBudget = -1;
      else if (aliveBefore >= 14) deathBudget = rng.chance(0.35) ? 2 : 1;
      else if (aliveBefore >= 9) deathBudget = rng.int(1, 3);
      else deathBudget = rng.int(2, 3);

      var kicker = (phase === "day" ? "Jour " : "Nuit ") + st.day;
      var beats = [];
      beats.push({
        kicker: kicker,
        text: "<b>" + ev.title + ".</b> " + HG.eventAnnounce(ev, rng),
        cls: "announce", voice: { who: "claudius" }, hold: 1.25
      });
      if (lastDay) {
        beats.push({ text: line(rng, [
          "Dernier jour. Les Juges l'ont annoncé : ces Jeux se terminent aujourd'hui, d'une manière ou d'une autre.",
          "Les Juges ont fixé la fin à aujourd'hui. Il y aura un vainqueur avant la nuit.",
          "Plus de lendemain dans l'arène. Ce qui doit se régler se règle maintenant."
        ]), cls: "event", voice: { who: "claudius" } });
      } else if (daysLeft <= 2 && aliveBefore > 3 && !st._closingSaid) {
        st._closingSaid = true;
        beats.push({ text: line(rng, [
          "L'arène se referme jour après jour. Il ne reste que peu de temps avant le dénouement.",
          "Les murs de l'arène avancent. Le territoire jouable fond à vue d'œil.",
          "Les Juges resserrent les Jeux. Bientôt, il n'y aura plus où se cacher."
        ]), cls: "event" });
      }
      if (forceConverge && !lastDay) {
        beats.push({ text: HG.commentary.claudius.convergence, cls: "event", voice: { who: "claudius" } });
      }
      maybeAnnounceLoversRule(beats);

      runSkillPhase(ev, beats);
      runEnvironment(ev, beats, eventMod);
      runIncidents(ev, beats);
      if (HG.living().length > 1) runEncounters(ev, beats, eventMod);
      if (phase === "night" || pressure || aliveBefore <= 8) runPackFracture(beats);
      if (phase === "night" || pressure) runBetrayals(beats);
      runGiftDrops(ev, beats);

      var deathsSoFar = st.deaths.length - deathsBefore;
      var needForce = forceConverge || (stale >= 2 && aliveBefore <= 6);
      if (deathsSoFar === 0 && needForce && HG.living().length >= 3) {
        forcedConfrontation(beats);
        deathsSoFar = st.deaths.length - deathsBefore;
      }
      // Dernier jour : on rabat jusqu'à 2 survivants max.
      if (lastDay) {
        deathBudget = -1;
        var guard = 0;
        while (HG.living().length > 2 && guard < 12) { forcedConfrontation(beats); guard++; }
        deathsSoFar = st.deaths.length - deathsBefore;
      }
      deathBudget = -1; // remet à zéro hors manche

      driftSponsors();

      if (deathsSoFar === 0) {
        dryRoundFlavor(beats);
        st.roundsSinceDeath += 1;
      } else {
        st.roundsSinceDeath = 0;
      }

      // Tag kicker sur le premier beat de contenu pour le repère à l'écran
      for (var b = 1; b < beats.length; b++) { if (!beats[b].kicker) beats[b].kicker = kicker; }

      return {
        event: ev, phase: phase, day: st.day, beats: beats,
        deaths: st.deaths.slice(deathsBefore), aliveAfter: HG.living().length
      };
    },

    giveRoomGift: function (tributeId) {
      var t = HG.byId(tributeId);
      if (!t || !t.alive) return null;
      var g = applyGift(t, S().rng);
      t.roomFavor += 2;
      t.sponsor = Math.min(100, t.sponsor + 10);
      S().sponsorLog.push({ round: S().roundIndex, tributeId: tributeId, gift: g.label });
      return g;
    },

    finalDuel: function () {
      var living = HG.living();
      if (living.length !== 2) return { beats: [] };
      deathBudget = -1;
      var rng = S().rng;
      var beats = [{ kicker: "Le dénouement",
        text: "Les Juges rabattent les deux derniers tributs à la Corne d'abondance. Il n'y aura qu'un vainqueur.",
        cls: "announce", voice: { who: "claudius" } }];

      var p0 = HG.combatPower(living[0], "melee") * (0.7 + rng.f() * 0.6);
      var p1 = HG.combatPower(living[1], "melee") * (0.7 + rng.f() * 0.6);
      var winner = p0 >= p1 ? living[0] : living[1];
      var loser = p0 >= p1 ? living[1] : living[0];

      beats.push({
        portraits: [port(winner), port(loser)],
        cls: "",
        lines: [
          who(winner) + " et " + who(loser) + " s'affrontent une dernière fois, à bout de forces — " +
            HG.deaths.weaponThe(winner) + " contre " + HG.deaths.weaponThe(loser) + ".",
          line(rng, [
            "Chaque coup pèse une tonne. " + who(loser) + " en manque un.",
            "Ils tombent tous les deux dans la poussière ; " + who(winner) + " se relève.",
            who(winner) + " trouve l'ouverture au moment où " + who(loser) + " n'en peut plus.",
            "Plus de plan, plus de ruse : celui qui veut le plus fort gagne. C'est " + who(winner) + "."
          ])
        ]
      });
      var kb = applyOutcome({ tribute: loser, result: "death", killerId: winner.id, kind: "duel" }, null);
      if (kb) beats.push(kb);
      return { beats: beats };
    },

    sharedVictory: function () {
      var living = HG.living();
      return {
        beats: [{
          kicker: "L'heure du choix",
          portraits: living.map(function (t) { return port(t); }),
          text: "Face aux baies de nightlock, les deux derniers tributs tendent la main… Les Juges cèdent : <em class='q'>il y aura deux vainqueurs</em>.",
          cls: "announce", voice: { who: "claudius" }
        }],
        victors: living.map(function (t) { return t.id; })
      };
    }
  };

  // ---- Confrontation imposée --------------------------------
  function forcedConfrontation(beats) {
    var rng = S().rng;
    deathBudget = -1;   // une confrontation imposée aboutit toujours
    var living = HG.living();
    if (living.length < 3) return;
    var units = rng.shuffle(buildUnits(living));

    if (units.length < 2) {
      var grp = rng.shuffle(units[0].filter(function (t) { return t.alive; }));
      if (grp.length < 2) return;
      var lp = S().loversPair;
      var nonLovers = lp ? grp.filter(function (t) { return lp.indexOf(t.id) === -1; }) : grp;
      var victim = (nonLovers.length ? nonLovers : grp)[0];
      var killer = grp.filter(function (t) { return t.id !== victim.id; })[0];
      grp.forEach(function (t) { HG.breakAlliance(t, victim); });
      beats.push({ stamp: { text: "Trahison", kind: "betray" }, camps: true,
        portraits: [port(killer, { camp: "traitor" }), port(victim, { camp: "victim" })],
        text: line(rng, [
          "Acculés au même rocher, les alliés se regardent enfin en face. " + who(killer) + " frappe le premier.",
          "L'alliance a tenu jusqu'ici parce qu'elle servait tout le monde. Elle ne sert plus personne. " + who(killer) + " tranche.",
          "Les Juges resserrent l'arène sur les derniers alliés. À la fin, il n'y a de place que pour un : " + who(killer) + " s'en assure."
        ]),
        cls: "event" });
      var lx = applyOutcome({ tribute: victim, result: "death", killerId: killer.id, kind: "betrayal" }, null);
      if (lx) beats.push(lx);
      return;
    }
    // Si la paire d'amants est encore là et qu'un intrus reste, l'intrus tombe.
    if (loversPairAlive() && living.length === 3) {
      var odd = living.filter(function (t) { return !loversHas(t); })[0];
      var pairMate = living.filter(function (t) { return loversHas(t); });
      if (odd && pairMate.length) {
        beats.push({ camps: true,
          portraits: campPorts(pairMate, "a", { campLabel: "Alliance" }).concat(campPorts([odd], "b")),
          text: "Les Juges rabattent les trois derniers. " + names(pairMate) + " font front ensemble contre " + who(odd) + ".",
          cls: "event" });
        var lk = applyOutcome({ tribute: odd, result: "death", killerId: pick(rng, pairMate).id, kind: "melee" }, null);
        if (lk) beats.push(lk);
        return;
      }
    }
    var a = units[0].filter(function (t) { return t.alive; });
    var b = units[1].filter(function (t) { return t.alive; });
    if (!a.length || !b.length) return;
    beats.push({
      portraits: (a.length > 1 || b.length > 1)
        ? campPorts(a, "a").concat(campPorts(b, "b"))
        : [port(a[0]), port(b[0])],
      camps: a.length > 1 || b.length > 1,
      text: subCamps(line(rng, [
        "Les Juges resserrent l'arène : {A} et {B} n'ont plus nulle part où se cacher.",
        "Le territoire jouable vient de fondre de moitié. {A} et {B} se retrouvent forcément.",
        "Plus de forêt, plus de crêtes : les Juges rabattent {DEUX} sur la même trouée."
      ]), a, b),
      cls: "event"
    });
    var res = HG.resolveEncounter(a, b, "melee", rng, { powerMul: 1.4 });
    var died = false;
    res.outcomes.forEach(function (o) { var kb = applyOutcome(o, null); if (kb) { beats.push(kb); died = true; } });
    if (!died) {
      var v = pick(rng, res.losers.map(HG.byId).filter(Boolean));
      var k = res.winners[0] ? HG.byId(res.winners[0]) : null;
      if (v) { var l = applyOutcome({ tribute: v, result: "death", killerId: k ? k.id : null, kind: "melee" }, null); if (l) beats.push(l); }
    }
  }

  var DRY_LINES = [
    "La soif tenaille les survivants ; on gratte la rosée sur les feuilles, on suit le moindre filet d'eau.",
    "Une averse froide tombe sur l'arène. Chacun cherche un abri, seul.",
    "Deux tributs se croisent à distance, se jaugent… et repartent chacun de son côté.",
    "Un piège se referme dans le vide. La proie visée est déjà loin.",
    "Un tribut grave un nom sur l'écorce d'un arbre, longuement.",
    "Les geais moqueurs se taisent d'un coup. Personne n'ose bouger.",
    "Le Capitole diffuse des images des familles restées au district. Les caméras s'attardent.",
    "Une flèche perdue se fiche dans un tronc. On retient son souffle, puis le calme revient.",
    "Un feu de camp brille au loin, puis s'éteint. Piège, ou simple prudence ?",
    "Les Carrières comptent leurs vivres. Il en reste moins qu'hier.",
    "Un tribut blessé nettoie sa plaie dans l'eau froide, les dents serrées.",
    "Le vent tourne et porte une odeur de fumée. Tout le monde change de direction.",
    "Un tribut aiguise son arme contre une pierre plate, pendant des heures, sans lever les yeux.",
    "Deux alliés se partagent la dernière ration en silence, dos à dos, chacun surveillant sa moitié d'horizon.",
    "Une silhouette suit une piste dans la boue, s'arrête, revient sur ses pas : ce n'était pas la bonne.",
    "Quelqu'un teste la profondeur d'un cours d'eau avec un bâton avant de se risquer à traverser.",
    "Un tribut refait ses lacets, vérifie son sac, recompte ses flèches. Rien d'autre à faire qu'attendre.",
    "Les Juges laissent filer la journée. Pas un événement, pas un canon — juste le temps qui pèse.",
    "Un piège soigneusement tendu la veille n'a rien pris. Son auteur le démonte et recommence ailleurs.",
    "Une alliance monte la garde à tour de rôle. Celui qui dort ne dort que d'un œil.",
    "Un tribut escalade un arbre pour repérer les fumées des autres, mémorise, redescend sans un bruit.",
    "L'eau d'une gourde est comptée en gorgées. Chaque gorgée est une décision.",
    "Deux tributs se suivent à distance depuis le matin. Aucun des deux ne veut engager le premier."
  ];
  function dryRoundFlavor(beats) {
    var rng = S().rng;
    var n = rng.int(1, 2);
    var picked = [];
    for (var i = 0; i < n; i++) picked.push(line(rng, DRY_LINES));
    beats.push({ cls: "", lines: picked.concat([line(rng, [
      "La manche s'achève sans un canon. Les parieurs du Capitole s'agacent.",
      "Aucune mort aujourd'hui. Quelque part, un Juge note qu'il faudra corriger ça.",
      "Le ciel reste vide ce soir. Le Capitole n'aime pas les soirées vides."
    ])]) });
  }

  function isLoversCandidate(u) {
    if (u.length !== 2 || !HG.sameDistrict(u[0], u[1])) return false;
    return u[0].isPlayer || u[1].isPlayer || u[0].district === 12;
  }

  // Repère et mémorise une paire d'amants (sans encore annoncer la règle).
  function designateLoversIfAny() {
    var st = S();
    if (st.loversPair) return;
    var pair = buildUnits(HG.living()).find(isLoversCandidate);
    if (pair) {
      st.loversPair = [pair[0].id, pair[1].id];
      st.loversDistrict = pair[0].district;
      pair.forEach(function (t) { t.roomFavor += 2; });
    }
  }

  function maybeAnnounceLoversRule(beats) {
    var st = S();
    designateLoversIfAny();
    if (st.loversRuleActive || !st.loversPair) return;
    if (!loversPairAlive()) return;
    var living = HG.living();
    if (living.length > 8 || living.length < 3) return;
    var pair = st.loversPair.map(HG.byId);
    st.loversRuleActive = true;
    beats.push({
      portraits: pair.map(function (t) { return port(t); }),
      text: HG.commentary.claudius.loversRule, cls: "event", voice: { who: "claudius" }
    });
    pair.forEach(function (t) { t.roomFavor += 3; t.sponsor = Math.min(100, t.sponsor + 15); });
  }

  function isDesignatedLovers(a, b) {
    var lp = S().loversPair;
    if (!lp) return false;
    return (lp[0] === a.id && lp[1] === b.id) || (lp[0] === b.id && lp[1] === a.id);
  }
  HG.isDesignatedLovers = isDesignatedLovers;

  function loversHas(t) {
    var lp = S().loversPair;
    return lp && lp.indexOf(t.id) !== -1;
  }
  function loversPairAlive() {
    var lp = S().loversPair;
    if (!lp) return false;
    return lp.every(function (id) { var x = HG.byId(id); return x && x.alive; });
  }

})(window.HG = window.HG || {});
