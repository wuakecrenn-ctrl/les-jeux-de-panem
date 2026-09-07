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
  var DEFAULT_INCIDENTS = ["fall", "berries", "snake", "infection", "exhaustion"];
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
      if (t.allies.length && (type === "infection" || type === "starvation" || type === "exhaustion")) p *= 0.7;

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
      beats.push({ portraits: uniq.slice(0, 3).map(function (t) { return port(t); }), cls: "",
        text: line(rng, [
          "Un guérisseur s'active : " + names(uniq.slice(0, 3)) + " repart" + (plural ? "ent" : "") + " en meilleure forme.",
          names(uniq.slice(0, 3)) + " met" + (plural ? "tent" : "") + " à profit la nuit pour nettoyer et recoudre les plaies.",
          "Cataplasme d'écorce, fil et aiguille : " + names(uniq.slice(0, 3)) + " soigne" + (plural ? "nt" : "") + " ce qui peut l'être.",
          "L'alliance a son guérisseur. " + names(uniq.slice(0, 3)) + " repart" + (plural ? "ent" : "") + " la fièvre tombée."
        ]) });
    }
  }

  // ---- Narration d'un affrontement -----------------------------------
  // {A}/{B} = camps · {wa}/{wb} = arme portée · {na}/{nb} = effectifs.
  // Aucune phrase n'est rejouée dans la même partie (voir line()/HG.narrPick).
  var APPROACH = {
    melee: [
      "{A} et {B} débouchent sur la même clairière au même instant. Plus personne ne recule.",
      "Un sentier étroit, deux directions opposées : {A} d'un côté, {B} de l'autre.",
      "{A} laisse tomber son sac et empoigne {wa}. En face, {B} sort {wb}.",
      "La pluie a effacé les bruits de pas — {A} et {B} se retrouvent nez à nez au détour d'un rocher.",
      "Aucun des deux ne cherchait la bagarre. Le sentier n'a laissé le choix ni à {A} ni à {B}.",
      "{A} contourne un fourré et tombe pile sur {B}, à trois pas, trop tard pour reculer.",
      "Le vent tourne : {B} sent la fumée de {A} et se retourne, {wb} déjà en main.",
      "{A} et {B} arrivent chacun de leur côté au même point d'eau. La gourde attendra.",
      "Un craquement de branche, deux têtes qui se lèvent : {A} et {B} se sont trouvés.",
      "{A} pose le pied dans le campement encore chaud de {B}. {B} n'est pas parti loin.",
      "Le brouillard se lève d'un coup et découvre {A} face à {B}, à portée de bras.",
      "{A} traque une piste ; au bout, ce n'est pas du gibier, c'est {B}, arme au poing."
    ],
    ranged: [
      "{A} repère {B} à découvert dans la plaine et se met à distance de tir.",
      "Perché plus haut, {A} tient {wa} prêt ; {B} avance sans se savoir vu.",
      "{A} attend que {B} sorte du couvert, l'arme déjà en joue.",
      "{B} traverse la trouée en courant. {A}, immobile depuis un moment, ajuste.",
      "{A} laisse {B} s'installer près de l'eau, puis prend tout son temps pour viser.",
      "Deux cents mètres de plaine séparent {A} de {B}. {A} n'a pas besoin de plus près.",
      "{A} suit {B} dans la lunette d'un œil, sans un bruit, en attendant l'angle net.",
      "{B} allume un feu à découvert. {A}, à distance, sourit et encoche.",
      "{A} grimpe pendant que {B} cherche encore d'où vient le danger. La hauteur décide.",
      "{B} croit la crête déserte. {A} y est allongé depuis l'aube."
    ],
    ambush: [
      "{A} a repéré la fumée du feu de {B} et s'en approche sans un bruit.",
      "Tapi dans les ronces depuis une heure, {A} laisse {B} arriver à portée.",
      "Le piège de {A} s'est refermé au passage de {B} — le reste va vite.",
      "{B} se penche vers la source. {A} sort de l'ombre dans son dos.",
      "{A} n'a rien fait d'autre que rester immobile pendant que {B} fouillait la clairière.",
      "Le sentier de {B} passe juste sous la branche où {A} attend, sans un frisson.",
      "{A} a recouvert la fosse de feuilles la veille. {B} marche droit dessus.",
      "{B} suit une piste tracée exprès. Au bout, {A} l'attend, calme.",
      "{A} laisse {B} passer devant, compte jusqu'à trois, et bondit.",
      "Un fil tendu entre deux troncs, à hauteur de cheville. {B} ne le voit pas ; {A} si."
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
      "{A} connaît ce coin de l'arène mieux que {B}. Ça finit toujours pareil."
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
  // Approche quand au moins un camp est une ALLIANCE (phrasé au pluriel).
  var APPROACH_GROUP = [
    "{A} et {B} se jaugent dans la clairière — d'un côté un groupe soudé, de l'autre ce qu'il reste.",
    "Les alliés de {A} arrivent en éventail ; {B} n'a pas assez d'yeux pour tout surveiller.",
    "{A} avancent groupés, se couvrant mutuellement. {B} cherche déjà par où se dégager.",
    "La rencontre tourne vite au déséquilibre : {A} sont plus nombreux, et le savent.",
    "{A} bloquent le sentier à plusieurs. {B} comprend qu'il n'y aura pas de passage en force.",
    "Deux camps se font face au bord de l'eau. Les nombres ne sont pas les mêmes des deux côtés.",
    "{A} resserrent les rangs ; {B} recule d'un pas, puis d'un autre.",
    "{A} se déploient sans un mot — chacun sait déjà quoi faire. {B} improvise.",
    "L'un des alliés de {A} siffle ; les autres se figent, puis avancent ensemble sur {B}.",
    "{A} arrivent en marchant, presque tranquilles. À plusieurs, on n'a pas à se presser.",
    "{B} tombe sur {A} au détour d'un rocher et compte trop de silhouettes d'un coup.",
    "{A} encerclent la clairière avant même que {B} ne comprenne qu'il est au centre.",
    "Face au groupe de {A}, {B} calcule ses chances et n'aime pas le résultat.",
    "{A} laissent l'un des leurs se montrer pour attirer {B} ; les autres sont déjà en position."
  ];
  // Camp supérieur en nombre ({BIG}) vs camp inférieur ({SMALL}).
  var OUTNUMBER = [
    "{BIG} se répartissent les angles : pendant que l'un fixe {SMALL}, l'autre passe derrière.",
    "L'alliance paie — {SMALL} doit parer sur deux fronts, et n'y arrive pas.",
    "{BIG} avancent en tenaille. Chaque pas de recul rapproche {SMALL} d'un autre adversaire.",
    "À {nbig} contre {nsmall}, {BIG} n'ont qu'à garder la pression et laisser {SMALL} s'épuiser.",
    "{BIG} n'ont même pas besoin de bien se battre : il suffit d'être là, tous, en même temps.",
    "Un des alliés de {BIG} occupe {SMALL} de face ; le combat se décide dans le dos.",
    "{BIG} se relaient pour harceler {SMALL} : l'un frappe, se retire, un autre prend le relais.",
    "{SMALL} ne peut viser qu'un adversaire à la fois. {BIG} en profitent, chacun leur tour.",
    "Le nombre transforme chaque erreur de {SMALL} en faute décisive. {BIG} attendent la première.",
    "{BIG} forment un demi-cercle. {SMALL} recule jusqu'à l'arbre, et l'arbre l'arrête.",
    "Deux des alliés de {BIG} bloquent la fuite pendant que les autres avancent sur {SMALL}.",
    "{SMALL} en met un à terre — et il en reste toujours autant debout en face."
  ];
  var OUTNUMBERED = [
    "Seul(e) contre un groupe, {SMALL} n'a personne pour couvrir ses arrières.",
    "{SMALL} tient tête un moment — puis comprend qu'on ne gagne pas à un contre {nbig}.",
    "{SMALL} vise juste, encaisse bien, mais il en reste toujours un de plus en face.",
    "{SMALL} recule vers un tronc pour n'être pris que d'un côté. Ça ne suffit pas longtemps.",
    "Le courage de {SMALL} ne compense pas l'arithmétique.",
    "{SMALL} se bat comme pour deux. Il en aurait fallu trois.",
    "Chaque parade de {SMALL} ouvre une faille ailleurs. Les alliés de {BIG} la trouvent.",
    "{SMALL} choisit un adversaire et fonce dessus, en espérant briser le groupe. Le groupe ne se brise pas.",
    "Dos au rocher, {SMALL} ne peut plus reculer — et {BIG} le savent depuis le début.",
    "{SMALL} garde son sang-froid plus longtemps qu'on ne l'attendait. Pas assez, quand même."
  ];
  var POSTURE = [
    "{A} a l'avantage de l'allonge : {wa} contre {wb}, et {B} le sent.",
    "{A} avance couvert, {wa} en main ; {B} recule, cherchant l'angle mort.",
    "Chacun jauge l'autre. {A} tient {wa}, {B} tient {wb}.",
    "{B} tente le premier pas de côté ; {A} verrouille le passage avec {wa}.",
    "Les deux tournent l'un autour de l'autre. Personne ne veut donner le premier coup.",
    "{A} garde le soleil dans le dos ; {B} plisse les yeux et attend.",
    "{B} feint la fatigue pour attirer {A}. {A} ne mord pas.",
    "Pied contre pied, arme contre arme. La rencontre va se jouer sur une seule faute.",
    "{A} teste la garde de {B} d'une fausse attaque. {B} ne bronche pas.",
    "{B} cherche du regard une pierre, une racine, n'importe quoi. {A} l'a remarqué.",
    "Ils s'arrêtent à deux pas l'un de l'autre. Le premier qui bouge donne l'initiative.",
    "{A} respire lentement, {wa} basse. {B} tremble un peu, et ça se voit.",
    "{B} recule vers un terrain qui lui convient mieux. {A} le suit sans se laisser entraîner.",
    "Le silence dure. Puis {A} avance d'un pas, et tout s'enchaîne.",
    "{A} et {B} se connaissent du centre d'entraînement. Chacun sait ce que vaut l'autre.",
    "{B} parle — pour gagner du temps, ou pour de vrai. {A} ne répond pas.",
    "Ni {A} ni {B} n'a envie de ce combat. Aucun ne peut se permettre de le fuir."
  ];
  var CLASH = [
    "Premier assaut de {A} — {wa} contre la garde de {B}.",
    "{B} encaisse, riposte, mais le terrain joue pour {A}.",
    "Échange sec : {wa} d'un côté, esquive de l'autre, contre.",
    "{A} presse, {B} recule, un pied glisse sur la mousse.",
    "{B} tente une feinte ; {A} l'avait vue venir depuis le début.",
    "Corps-à-corps dans la boue, les deux armes coincées entre eux.",
    "Coup, parade, coup. Ni {A} ni {B} ne cède un pouce de terrain.",
    "{A} force le rythme jusqu'à ce que le bras de {B} tremble.",
    "{B} touche le premier — une entaille, rien de décisif. {A} répond deux fois.",
    "Ils roulent au sol, lâchent les armes, se reprennent. {A} se relève une seconde avant {B}.",
    "{A} recule vers un arbre pour souffler ; {B} charge dans la foulée.",
    "Un choc d'armes, une gerbe d'étincelles, et {B} perd {wb} dans les fougères.",
    "{A} bloque, dévie, cherche l'ouverture. {B} la lui donne en voulant en finir trop vite.",
    "{B} prend l'avantage trois secondes — puis {A} change d'angle et tout bascule.",
    "{A} encaisse un coup qui aurait dû finir la rencontre, et reste debout.",
    "Le combat se déporte vers la pente. Celui qui garde l'équilibre gardera la vie.",
    "{A} vise les jambes, {B} protège le haut. L'un des deux se trompe de priorité.",
    "{B} met un genou à terre, se redresse d'un bond, repart à l'assaut. {A} attendait ça.",
    "Deux corps épuisés qui s'accrochent l'un à l'autre. Ça ne tient plus qu'à la volonté.",
    "{A} sent l'ouverture avant de la voir. La main part toute seule.",
    "{B} lâche {wb} pour saisir le poignet de {A}. Mauvais échange.",
    "Un rocher roule sous le pied de {B} au pire moment. {A} ne laisse pas passer.",
    "{A} recule en cercle, oblige {B} à tourner face au soleil. {B} cligne des yeux une fois de trop.",
    "Ils se séparent, soufflent, se jaugent — et {A} repart le premier.",
    "{A} feinte à droite, frappe à gauche. {B} avait misé sur la droite.",
    "Les deux tombent dans le ruisseau. Celui qui se relève en premier prend l'avantage : c'est {A}.",
    "{B} tient bon un échange de plus que prévu. Deux de moins qu'il n'en faudrait.",
    "{A} garde la main haute, économise ses coups. {B} se dépense trop vite.",
    "Un coup de {wa} fait reculer {B} contre la paroi. Plus de retraite possible.",
    "{A} encaisse pour se rapprocher, ferme la distance de force. {wb} ne sert plus à rien de si près.",
    "{B} glisse dans la boue, se rattrape à une branche — qui casse. {A} était déjà lancé.",
    "Chaque seconde qui passe use {B} un peu plus. {A} l'a compris et ralentit exprès.",
    "{A} vise le poignet, désarme {B} d'un coup net. {wb} tombe hors de portée.",
    "{B} tente le tout pour le tout, une dernière charge. {A} s'écarte et laisse l'élan faire.",
    "Ils s'immobilisent, front contre front, armes croisées. C'est la force qui tranche, et {A} en a plus.",
    "{A} prend un coup à l'épaule pour en placer deux au corps. Le calcul est bon.",
    "{B} recule vers un arbre, croyant se protéger le dos. {A} l'y attendait.",
    "L'échange se fige : chacun tient l'arme de l'autre. {A} a les jambes plus solides.",
    "{A} laisse {B} croire à l'ouverture, la referme au dernier instant.",
    "Deux coups pour rien, un troisième qui porte. {B} sent que le rythme n'est plus pour lui.",
    "{B} appelle à l'aide sans y croire. Personne ne vient. {A} avance.",
    "{A} combat en reculant vers un terrain qu'il connaît. {B} le suit sans réfléchir.",
    "Un nuage passe, la lumière change, {B} perd {A} une demi-seconde. C'est assez.",
    "{A} bloque {wb} du pied, se penche, et n'a plus qu'à finir le geste.",
    "{B} tient encore debout par habitude plus que par force. {A} le voit dans ses yeux.",
    "Le sol en pente donne l'avantage à qui est en haut. {A} y est monté le premier.",
    "{A} feint l'épuisement, {B} se précipite, {A} n'était pas épuisé."
  ];
  var STANDOFF = [
    "{A} et {B} rompent le combat, à bout de souffle, et s'éclipsent chacun de son côté.",
    "Un cri au loin fait décrocher les deux camps avant le coup décisif.",
    "Reculade de {A} ; {B} ne poursuit pas. Personne n'a l'énergie d'en finir.",
    "Match nul : {A} et {B} se séparent en se surveillant du coin de l'œil.",
    "Les armes se baissent d'un commun accord — pour cette fois.",
    "{B} bat en retraite dans les fourrés ; {A} récupère ce qui traîne et disparaît.",
    "Un canon retentit ailleurs dans l'arène. {A} et {B} en profitent pour rompre.",
    "Trop de sang perdu des deux côtés pour un dernier échange. Ils se lâchent.",
    "Le brouillard des Juges roule entre {A} et {B} et met fin à la rencontre pour eux.",
    "{A} et {B} entendent la meute approcher. L'ennemi commun a la priorité.",
    "Chacun blessé, chacun méfiant : {A} et {B} reculent en gardant l'autre en joue.",
    "Un grondement de séisme sépare {A} et {B} d'une crevasse. Le combat est reporté.",
    "{A} propose un répit d'un geste de la main. {B} accepte, sans lâcher {wb}.",
    "Ni l'un ni l'autre ne veut mourir pour un combat que personne ne regarde vraiment."
  ];
  // Une arme nettement adaptée à la situation ({who} tient {w}, contre {foe}).
  var WEAPON_FAVOURS = [
    "À cette distance, {w} de {who} fait la loi : {foe} ne peut pas seulement approcher.",
    "Le terrain va comme un gant à {w} de {who}. {foe} l'a compris une seconde trop tard.",
    "{who} n'a qu'à garder {foe} à portée de {w}. Tout le reste en découle.",
    "{w} de {who} est exactement l'arme qu'il fallait ici. {foe} n'a pas ce luxe.",
    "{who} laisse {w} travailler ; {foe} passe la rencontre à essayer de combler l'écart.",
    "{foe} sait déjà que c'est mal engagé : {w} de {who} le tient à distance de tout ce qu'il pourrait tenter.",
    "Dans ce genre de rencontre, {w} de {who} vaut deux tributs. {foe} l'apprend vite.",
    "{who} a choisi son moment pour que {w} donne son plein effet. {foe} n'avait rien à répondre."
  ];
  // Une arme mal adaptée à la situation ({who} tient {w}).
  var WEAPON_HAMPERS = [
    "{w} de {who} ne vaut rien ici — trop lente à ramener, trop encombrante.",
    "Mauvais outil pour {who} : {w} le gêne plus qu'elle ne l'aide dans cet espace.",
    "{who} se bat avec {w} comme on se bat avec un handicap. L'arène ne pardonne pas ça.",
    "{who} aurait tout donné pour autre chose que {w} à cet instant précis.",
    "{w} entre les mains de {who} est parfaite — pour la rencontre d'hier, pas celle-ci.",
    "{who} perd une seconde à chaque geste, le temps de composer avec {w}. Une seconde de trop."
  ];

  function names(list) { return list.map(who).join(" & "); }
  // Nom d'un camp : un tribut → son nom ; deux → « X et Y » ; trois et plus →
  // « X et les siens » (pour éviter que le texte traite le groupe comme UNE personne).
  function unitName(list) {
    if (!list.length) return "?";
    if (list.length === 1) return who(list[0]);
    if (list.length === 2) return who(list[0]) + " et " + who(list[1]);
    return who(list[0]) + " et les siens";
  }
  function wkVal(t, kind) { return HG.weaponKindBonus ? HG.weaponKindBonus(t, kind) : 0; }
  // Tribut « vedette » d'un camp pour parler de son arme : un joueur d'abord.
  function focusOf(list) {
    for (var i = 0; i < list.length; i++) if (list[i].isPlayer) return list[i];
    return list[0];
  }
  function weaponEdgeLine(a, b, kind, rng) {
    var fa = focusOf(a), fb = focusOf(b);
    var va = wkVal(fa, kind), vb = wkVal(fb, kind);
    function say(pool, holder, foe) {
      return line(rng, pool)
        .replace(/\{who\}/g, who(holder))
        .replace(/\{w\}/g, HG.deaths.weaponThe(holder))
        .replace(/\{foe\}/g, who(foe));
    }
    var okA = fa.weapon && fa.weapon !== "none" && HG.WEAPONS[fa.weapon];
    var okB = fb.weapon && fb.weapon !== "none" && HG.WEAPONS[fb.weapon];
    if (okA && va - vb >= 3) return say(WEAPON_FAVOURS, fa, fb);
    if (okB && vb - va >= 3) return say(WEAPON_FAVOURS, fb, fa);
    if (okA && va <= -2) return say(WEAPON_HAMPERS, fa, fb);
    if (okB && vb <= -2) return say(WEAPON_HAMPERS, fb, fa);
    return null;
  }

  // Un affrontement = UNE seule fenêtre (mêmes portraits) où les phrases
  // s'accumulent une à une. Le dénouement (mort / blessure / repli) est
  // poussé APRÈS, comme beat distinct.
  function narrateClash(a, b, kind, res, rng) {
    var A = unitName(a), B = unitName(b);
    var wa = HG.deaths.weaponOf(focusOf(a));
    var wb = HG.deaths.weaponOf(focusOf(b));
    var na = a.length, nb = b.length;
    var ppl = a.slice(0, 2).map(function (t) { return port(t); })
             .concat(b.slice(0, 2).map(function (t) { return port(t); }));
    function f(s) {
      return s.replace(/\{A\}/g, A).replace(/\{B\}/g, B)
              .replace(/\{wa\}/g, wa).replace(/\{wb\}/g, wb)
              .replace(/\{na\}/g, String(na)).replace(/\{nb\}/g, String(nb))
              // « X et les siens et Y » → « X et les siens, face à Y »
              .replace(/ et les siens et /g, " et les siens, face à ");
    }
    var grouped = na > 1 || nb > 1;
    var out = [];

    out.push(f(line(rng, grouped ? APPROACH_GROUP : (APPROACH[kind] || APPROACH.melee))));

    // Avantage d'alliance / infériorité numérique (l'alliance compte).
    if (na !== nb) {
      var bigName = na > nb ? A : B, smallName = na > nb ? B : A;
      var nbig = Math.max(na, nb), nsmall = Math.min(na, nb);
      var chosen = line(rng, rng.chance(0.5) ? OUTNUMBER : OUTNUMBERED);
      out.push(chosen
        .replace(/\{BIG\}/g, bigName).replace(/\{SMALL\}/g, smallName)
        .replace(/\{nbig\}/g, String(nbig)).replace(/\{nsmall\}/g, String(nsmall)));
    }

    // Avantage d'arme selon la situation.
    var we = weaponEdgeLine(a, b, kind, rng);
    if (we) out.push(f(we));

    // Posture : seulement quand le combat est serré et qu'on n'a pas déjà
    // accumulé des lignes (on ménage les pools et le rythme).
    if (out.length < 2 && (res.margin < 0.4 || rng.chance(0.18))) {
      out.push(f(line(rng, POSTURE)));
    }

    // 1 échange en général, 2 seulement quand c'est très disputé.
    var exchanges = res.margin < 0.3 ? 2 : 1;
    for (var e = 0; e < exchanges; e++) out.push(f(line(rng, CLASH)));

    return [{ portraits: ppl, cls: "", lines: out }];
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
        var pk = [
          line(rng, [
            "La meute des Carrières a rattrapé " + preyN + ".",
            preyN + " se retrouve encerclé — " + packLead + " en tête de meute.",
            "Les torches de la meute se referment sur " + preyN + ".",
            "À " + a.length + " chasseurs contre " + b.length + ", la meute ne se presse même pas.",
            packLead + " et le reste de la meute prennent " + preyN + " en étau."
          ])
        ];
        // avantage du nombre : c'est tout l'intérêt de la meute
        pk.push(line(rng, OUTNUMBER)
          .replace(/\{BIG\}/g, "les Carrières").replace(/\{SMALL\}/g, preyN)
          .replace(/\{nbig\}/g, String(a.length)).replace(/\{nsmall\}/g, String(b.length)));
        clashBeat = {
          portraits: a.slice(0, 3).map(function (t) { return port(t); }).concat(b.slice(0, 2).map(function (t) { return port(t); })),
          cls: "", lines: pk
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
      if (!anyDeath) {
        // pas de mort : le repli rejoint la même fenêtre que l'affrontement
        var so = line(rng, STANDOFF).replace(/\{A\}/g, unitName(a)).replace(/\{B\}/g, unitName(b));
        if (clashBeat && clashBeat.lines) clashBeat.lines.push(so);
        else beats.push({ text: so, cls: "" });
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
      portraits: [port(killer), port(victim)],
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
        portraits: [port(traitor), port(victim)],
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
        portraits: packNow.slice(0, 6).map(function (t) { return port(t); }),
        text: "Les Carrières se regroupent à la Corne et prennent le contrôle des vivres.", cls: "event"
      });
      if (defectors.length) {
        beats.push({
          portraits: defectors.map(function (t) { return port(t); }),
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

      // Cap à 10 jours : la pression monte à l'approche, blocus total le dernier jour.
      var maxDays = st.maxDays || 10;
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
        beats.push({ text: "Dixième jour. Les Juges l'ont annoncé : ces Jeux se terminent aujourd'hui, d'une manière ou d'une autre.",
          cls: "event", voice: { who: "claudius" } });
      } else if (daysLeft <= 2 && aliveBefore > 3) {
        beats.push({ text: "L'arène se referme jour après jour. Il ne reste que peu de temps avant le dénouement.", cls: "event" });
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
      beats.push({ portraits: [port(killer), port(victim)],
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
        beats.push({ portraits: pairMate.slice(0, 2).map(function (t) { return port(t); }).concat([port(odd)]),
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
      portraits: a.slice(0, 2).map(function (t) { return port(t); }).concat(b.slice(0, 2).map(function (t) { return port(t); })),
      text: line(rng, [
        "Les Juges resserrent l'arène : " + unitName(a) + " et " + unitName(b) + " n'ont plus nulle part où se cacher.",
        "Le territoire jouable vient de fondre de moitié. " + unitName(a) + " et " + unitName(b) + " se retrouvent forcément.",
        "Plus de forêt, plus de crêtes : les Juges rabattent " + unitName(a) + " et " + unitName(b) + " sur la même trouée."
      ]),
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
    "La faim tenaille les survivants ; on fouille les buissons, on mâche des racines.",
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
