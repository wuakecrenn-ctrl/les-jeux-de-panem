/* =========================================================================
   engine/deaths.js — narration des éliminations, fidèle à l'esprit du film
   (PG-13, pas de gore explicite).

   ▶ POUR AJOUTER DES FAÇONS DE MOURIR :
     • BY_WEAPON ..... par arme (blade, knife, spear, axe, arrow, mace,
                       trident, sickle, sling, trap, hands) — { line, cause }
     • ENCOUNTER ..... par type de rencontre (melee, ranged, ambush, hunt,
                       betrayal, pack_turn, duel) — { line, cause }
     • INCIDENTS ..... morts solo sans tueur (fall, berries, drown, snake,
                       infection, exhaustion, dehydration, quicksand)
     • ENVIRON ....... morts dues à un grand événement des Juges (clé = id
                       de l'événement dans events.js)
   {k} = tueur, {v} = victime (mis en surbrillance automatiquement).
   « cause » est la mention affichée sous le portrait (« transpercé(e) par une
   lance »). Une phrase n'est JAMAIS réutilisée deux fois dans la même partie
   (voir HG.narrPick) — d'où l'intérêt d'en avoir beaucoup. Recharge la page
   après modif (incrémente V dans index.html).
   ========================================================================= */
(function (HG) {
  "use strict";

  function who(t) { return "<span class='who'>" + (t ? t.name : "?") + "</span>"; }
  function fill(s, k, v) { return s.replace(/\{k\}/g, who(k)).replace(/\{v\}/g, who(v)); }
  function pick(rng, arr) { return (HG.narrPick || function (r, a) { return a[Math.floor(r.f() * a.length)]; })(rng, arr); }

  // --- Catégorie d'arme d'un tueur : l'arme portée (weapons.js) d'abord ---
  function weaponCat(t) {
    if (t && t.weapon && HG.WEAPONS && HG.WEAPONS[t.weapon]) return HG.WEAPONS[t.weapon].cat;
    if (t && t.skills) {
      if (t.skills.indexOf("archerie") !== -1) return "arrow";
      if (t.skills.indexOf("lame") !== -1) return "blade";
      if (t.skills.indexOf("piege") !== -1) return "trap";
      if (t.skills.indexOf("force") !== -1) return "mace";
    }
    if (t) {
      if (t.district === 7) return "axe";
      if (t.district === 4) return "trident";
      if (t.district === 11) return "sickle";
      if (t.district === 2) return "spear";
      var s = t.stats;
      if (s.agi >= s.str + 2 && s.agi >= 8) return "knife";
      if (s.str >= 9) return "mace";
      if (s.cun >= 9) return "trap";
    }
    return "blade";
  }
  // Nom de l'arme réellement portée (cohérent toute la partie), sinon repli.
  function weaponOf(t) {
    if (!t) return "l'arène";
    if (t.weapon && HG.WEAPONS && HG.WEAPONS[t.weapon] && t.weapon !== "none") return HG.WEAPONS[t.weapon].name;
    return ({ arrow: "un arc", blade: "une lame courte", knife: "des couteaux", spear: "une lance",
              axe: "une hache", mace: "une masse", trident: "un trident", sickle: "une faucille",
              sling: "une fronde", trap: "des collets", hands: "ses mains" })[weaponCat(t)] || "une arme de fortune";
  }
  function weaponThe(t) {
    if (t && t.weapon && HG.WEAPONS && HG.WEAPONS[t.weapon]) return HG.WEAPONS[t.weapon].the;
    return "son arme";
  }

  // --- Descriptions d'élimination par arme (PG-13, style « spectacle ») ---
  var BY_WEAPON = {
    blade: [
      { line: "{k} pare, pivote, et remonte la lame sous la garde de {v}. C'est fini.", cause: "d'un coup d'épée" },
      { line: "Une entaille au bras, une au flanc — {v} lâche son arme et {k} termine.", cause: "à l'arme blanche" },
      { line: "{k} bloque le poignet de {v} et plante la lame d'un geste sec.", cause: "poignardé(e) au corps-à-corps" },
      { line: "Trois passes, une feinte, une ouverture. {k} ne la laisse pas se refermer.", cause: "vaincu(e) à l'épée" },
      { line: "{v} recule d'un pas de trop ; le talon accroche une racine, la lame de {k} fait le reste.", cause: "abattu(e) à l'arme blanche" },
      { line: "{k} laisse {v} s'épuiser à frapper le vide, puis conclut d'un seul coup droit.", cause: "épuisé(e) puis achevé(e) à l'épée" },
      { line: "{k} détourne la lame de {v} d'un revers sec et ouvre la garde en grand.", cause: "désarmé(e) puis achevé(e) à l'épée" },
      { line: "Un seul mouvement, précis, presque silencieux. {k} rengaine avant que {v} ne touche le sol.", cause: "abattu(e) net à l'épée" }
    ],
    knife: [
      { line: "Le couteau de {k} traverse la clairière et se fiche entre les omoplates de {v}.", cause: "atteint(e) d'un couteau de lancer" },
      { line: "{v} se retourne trop tard : la lame de {k} l'a déjà trouvé(e).", cause: "touché(e) d'une lame de jet" },
      { line: "{k} lance deux couteaux coup sur coup. Le second ne rate pas {v}.", cause: "abattu(e) au couteau" },
      { line: "{k} n'a même pas visé longtemps. {v} n'a pas vu partir la lame.", cause: "cueilli(e) d'un couteau" },
      { line: "Une main dans le dos, un couteau dans l'autre : {k} règle la rencontre en un mouvement.", cause: "égorgé(e) au couteau" },
      { line: "{v} plonge derrière un tronc. Le couteau de {k} l'attend de l'autre côté.", cause: "surpris(e) d'un couteau de lancer" },
      { line: "{k} n'a qu'une lame, mais {v} n'a besoin que d'une.", cause: "poignardé(e) au couteau" },
      { line: "Le poignet de {k} se détend à peine. {v} s'arrête net, comme surpris(e) par lui-même(elle-même)." , cause: "atteint(e) d'un couteau de lancer" }
    ],
    spear: [
      { line: "{k} arme le bras et transperce {v} d'un seul jet de lance.", cause: "transpercé(e) par une lance" },
      { line: "La lance de {k} cloue {v} contre un tronc. Le canon suit aussitôt.", cause: "empalé(e) sur une lance" },
      { line: "{v} charge ; {k} baisse la pointe et laisse l'élan faire le reste.", cause: "embroché(e) sur une lance" },
      { line: "{k} garde {v} à bout de fer, encore et encore, jusqu'à la faute.", cause: "vaincu(e) à la lance" },
      { line: "Un pas en avant, un coup de reins : la lance de {k} part comme un trait.", cause: "transpercé(e) d'un jet de lance" },
      { line: "{k} garde ses distances, comme au district : la portée fait toute la différence face à {v}.", cause: "tenu(e) à distance puis transpercé(e)" }
    ],
    axe: [
      { line: "La hache de {k} décrit un arc large. {v} n'a pas le temps de plonger.", cause: "abattu(e) à la hache" },
      { line: "{k} fend le bouclier de fortune de {v}, puis ce qu'il y a derrière.", cause: "frappé(e) à la hache" },
      { line: "Un seul revers de hache. {v} s'écroule dans les copeaux.", cause: "fauché(e) à la hache" },
      { line: "{k} bûcheronne comme au district : le rythme ne faiblit pas, {v} si.", cause: "vaincu(e) à la hache" },
      { line: "{v} pare le premier coup. Pas le deuxième.", cause: "abattu(e) d'un coup de hache" },
      { line: "{k} plante la hache dans le tronc le plus proche de {v}. Le tronc, ce n'était qu'un prétexte.", cause: "abattu(e) à la hache" }
    ],
    arrow: [
      { line: "{k} bloque sa respiration, décoche. La flèche cueille {v} en pleine course.", cause: "touché(e) d'une flèche en pleine course" },
      { line: "Depuis les hauteurs, {k} plante une flèche là où il faut. {v} s'affaisse sans un mot.", cause: "atteint(e) d'une flèche" },
      { line: "Trois flèches en cinq secondes. {v} tombe avant la troisième.", cause: "criblé(e) de flèches" },
      { line: "{v} sprinte vers le couvert. {k} mène la cible d'une longueur et lâche.", cause: "abattu(e) d'une flèche" },
      { line: "Une seule flèche, encochée sans hâte pendant que {v} cherchait encore d'où venait le danger.", cause: "abattu(e) à l'arc" },
      { line: "{k} tire à travers les broussailles, au son. La plainte confirme la touche.", cause: "touché(e) d'une flèche à l'aveugle" },
      { line: "{v} pense être hors de portée. {k} vise plus loin que ça depuis des années.", cause: "abattu(e) à longue distance" }
    ],
    mace: [
      { line: "{k} encaisse la charge et écrase sa masse sur {v}. Un seul coup suffit.", cause: "assommé(e) d'un coup de masse" },
      { line: "{k} soulève une pierre à deux mains et l'abat sur {v}.", cause: "écrasé(e) par une pierre" },
      { line: "Le gourdin de {k} brise la garde de {v}, puis {v}.", cause: "roué(e) de coups" },
      { line: "{v} tient bon deux échanges. Au troisième, la masse de {k} passe.", cause: "vaincu(e) à la masse" },
      { line: "Pas de finesse, juste du poids et de la portée. {k} n'a besoin de rien d'autre contre {v}.", cause: "abattu(e) au gourdin" },
      { line: "{v} lève un bras pour se protéger. Ça ne suffit jamais, face à {k}.", cause: "écrasé(e) d'un coup de masse" }
    ],
    trident: [
      { line: "{k} lance le trident comme au large. Les trois pointes trouvent {v}.", cause: "harponné(e) au trident" },
      { line: "{k} accroche {v} du trident et l'entraîne dans le courant.", cause: "traîné(e) sous l'eau au trident" },
      { line: "{v} tente de saisir le manche ; {k} tourne le poignet et la rencontre s'achève.", cause: "vaincu(e) au trident" },
      { line: "Le trident de {k} tient {v} à distance jusqu'à l'ouverture, puis la referme.", cause: "transpercé(e) au trident" },
      { line: "{k} manie le trident comme en mer, sans un geste de trop. {v} n'a pas ce réflexe-là.", cause: "harponné(e) au trident" }
    ],
    sickle: [
      { line: "{k} surgit des blés, la faucille basse. {v} ne l'entend qu'au dernier moment.", cause: "fauché(e) à la serpe" },
      { line: "Un geste circulaire, appris aux champs. {k} n'a besoin que d'un.", cause: "tranché(e) d'un coup de faucille" },
      { line: "{k} laisse {v} passer, puis referme la faux dans son dos.", cause: "cueilli(e) à la faucille" },
      { line: "La faucille de {k} accroche la cheville de {v}. Le reste est rapide.", cause: "fauché(e) puis achevé(e)" },
      { line: "{k} coupe court, littéralement. {v} n'a pas vu venir la lame recourbée.", cause: "tranché(e) à la faucille" }
    ],
    sling: [
      { line: "La fronde de {k} claque. La bille frappe {v} à la tempe.", cause: "assommé(e) d'un tir de fronde" },
      { line: "{k} fait tournoyer la fronde deux fois et lâche. {v} s'écroule net.", cause: "abattu(e) d'une bille de plomb" },
      { line: "Une pierre bien ronde, un bras exercé : {k} n'a pas besoin de s'approcher de {v}.", cause: "touché(e) d'un tir de fronde" },
      { line: "{v} n'entend qu'un sifflement avant que tout devienne noir.", cause: "assommé(e) puis achevé(e) à la fronde" }
    ],
    trap: [
      { line: "Le fil tendu par {k} cueille {v} à hauteur de gorge en pleine course.", cause: "pris(e) dans un fil tendu" },
      { line: "{v} pose le pied — le collet de {k} se referme et le tronc lesté bascule.", cause: "écrasé(e) par un piège à contrepoids" },
      { line: "La fosse de {k}, tapissée de pieux, attendait {v} sous les feuilles.", cause: "tombé(e) dans une fosse piégée" },
      { line: "{k} n'a rien fait d'autre qu'attendre : le piège posé la veille a travaillé pour lui.", cause: "pris(e) au piège" },
      { line: "Un nœud coulant dans l'ombre du sentier. {v} l'a déclenché en marchant.", cause: "pris(e) au collet" },
      { line: "{k} a passé la nuit à tendre des fils entre les arbres. {v} n'en a vu aucun.", cause: "pris(e) dans un piège" }
    ],
    hands: [
      { line: "{k} passe dans le dos de {v} et serre. {v} cesse de se débattre.", cause: "étranglé(e)" },
      { line: "Le corps-à-corps roule dans la boue ; {k} se relève seul(e).", cause: "au corps-à-corps" },
      { line: "Sans arme ni l'un ni l'autre, ça se joue au poids et au souffle. {k} en a plus que {v}.", cause: "vaincu(e) à mains nues" },
      { line: "{k} arrache une pierre du sol au dernier moment. {v} n'en trouve pas.", cause: "au corps-à-corps" },
      { line: "Ni arme ni recul possible. {k} finit ce que {v} a commencé.", cause: "vaincu(e) à mains nues" }
    ]
  };

  // --- Rencontres : { line, cause } (repli quand pas de tueur « à l'arme ») --
  var ENCOUNTER = {
    melee: [
      { line: "{k} prend l'ascendant au corps-à-corps et met {v} à terre pour de bon.", cause: "au corps-à-corps" },
      { line: "Trois passes ; à la quatrième, {k} trouve la faille et {v} s'effondre.", cause: "à l'arme blanche" },
      { line: "{k} encaisse, plie le genou, se redresse — et {v} ne se relève pas.", cause: "vaincu(e) au combat" },
      { line: "Dos au rocher, {v} n'a plus un pouce de terrain. {k} referme la distance.", cause: "acculé(e) puis achevé(e)" },
      { line: "{k} feinte bas, frappe haut. {v} tombe dans les fougères sans un cri.", cause: "surpris(e) au combat" },
      { line: "Le duel dure jusqu'à ce que {v}, les bras lourds, laisse passer le coup de {k}.", cause: "épuisé(e) puis vaincu(e)" },
      { line: "{k} arrache un pieu de la palissade ; {v} n'a pas été assez rapide.", cause: "frappé(e) au combat" },
      { line: "Ça se décide en trois secondes de lutte au sol. {k} gagne les trois secondes.", cause: "vaincu(e) au corps-à-corps" },
      { line: "{v} recule pas à pas jusqu'à ne plus avoir de terrain. {k} referme la distance sans se presser.", cause: "acculé(e) au combat" }
    ],
    ranged: [
      { line: "{k} se cale, bloque sa respiration, lâche. {v} fait deux pas et s'écroule dans les hautes herbes.", cause: "touché(e) à distance" },
      { line: "Le projectile de {k} traverse la clairière avant même que {v} ne comprenne.", cause: "abattu(e) à distance" },
      { line: "{k} tire depuis les hauteurs ; {v} a cherché l'abri une seconde de trop.", cause: "abattu(e) depuis les hauteurs" },
      { line: "{k} corrige d'un cheveu après le premier tir manqué. Le deuxième trouve {v}.", cause: "touché(e) au second tir" },
      { line: "{v} sort du couvert pour boire. {k} n'attendait que ça.", cause: "abattu(e) à découvert" },
      { line: "{k} n'a besoin que d'une ligne droite et d'un peu de patience. {v} lui offre les deux.", cause: "touché(e) à distance" }
    ],
    ambush: [
      { line: "{k} attendait, immobile, depuis une heure. {v} passe à portée — c'est réglé en un souffle.", cause: "pris(e) en embuscade" },
      { line: "Le piège de {k} se referme au bord du sentier. {v} appelle une fois, puis se tait.", cause: "pris(e) au piège" },
      { line: "{v} se penche vers l'eau ; {k} surgit des roseaux, dans son dos.", cause: "surpris(e) à découvert" },
      { line: "{k} a suivi la fumée du feu de {v} jusqu'au campement endormi.", cause: "surpris(e) à son campement" },
      { line: "Une fosse tapissée de feuilles, creusée par {k} deux jours plus tôt. {v} ne l'a pas vue.", cause: "tombé(e) dans une fosse" },
      { line: "{k} ne bouge pas d'un cil pendant que {v} inspecte la clairière, puis frappe quand {v} tourne le dos.", cause: "surpris(e) de dos" },
      { line: "{v} croit le sentier désert. {k} y attend depuis le lever du jour.", cause: "pris(e) en embuscade" }
    ],
    hunt: [
      { line: "{v} court vite, mais {k} court plus longtemps. La poursuite s'achève au bord de l'eau.", cause: "rattrapé(e) dans sa fuite" },
      { line: "Les torches se resserrent autour de {v}. {k} sort du cercle le premier.", cause: "cerné(e) puis achevé(e)" },
      { line: "{k} pistait {v} depuis l'aube, lisant chaque brindille cassée. Au crépuscule, la traque prend fin.", cause: "pisté(e) tout le jour" },
      { line: "{v} croyait avoir semé tout le monde. {k} l'attendait à la sortie du ravin.", cause: "rattrapé(e) à la sortie du ravin" },
      { line: "{k} laisse {v} s'épuiser à fuir en terrain découvert, puis comble l'écart sans forcer.", cause: "épuisé(e) dans sa fuite" },
      { line: "{v} change trois fois de direction. {k} anticipe la quatrième.", cause: "rattrapé(e) dans sa fuite" }
    ],
    betrayal: [
      { line: "{k} attend que {v} s'endorme. Au matin, il ne reste qu'un feu froid et un canon.", cause: "trahi(e) par un allié" },
      { line: "« Désolé. » {k} le pense vraiment. Ça ne change rien pour {v}.", cause: "trahi(e) par un allié" },
      { line: "L'alliance tenait depuis des jours. {k} y met fin d'un geste ; {v} ne comprend qu'après.", cause: "trahi(e) par un allié" },
      { line: "{k} partage l'eau, monte la garde… puis attend le tour de {v}.", cause: "trahi(e) pendant la garde" },
      { line: "Ils avaient juré d'aller « jusqu'au bout ensemble ». Pour {k}, le bout était là.", cause: "trahi(e) par un allié" },
      { line: "{k} rend service une dernière fois : il laisse {v} s'endormir rassuré(e).", cause: "trahi(e) dans son sommeil" },
      { line: "{v} avait confié son dos à {k}. C'était la seule erreur qui comptait.", cause: "trahi(e) par un allié" }
    ],
    pack_turn: [
      { line: "La meute se retourne contre l'un des siens : {k} donne le signal, {v} est lâché aux autres.", cause: "éliminé(e) par sa propre meute" },
      { line: "Les vivres manquent. La meute n'a plus de place pour {v} ; {k} tranche la question.", cause: "chassé(e) de la meute" },
      { line: "Une dispute sur le partage du butin. {k} règle le désaccord définitivement.", cause: "éliminé(e) par sa meute" },
      { line: "{v} a ralenti la chasse une fois de trop. {k} et les autres ne pardonnent pas.", cause: "abandonné(e) par la meute" },
      { line: "Il ne reste plus assez de vivres pour tout le monde. {k} fait le calcul à voix haute, devant {v}.", cause: "éliminé(e) par sa propre meute" }
    ],
    duel: [
      { line: "Deux silhouettes à bout de forces au pied de la Corne. {k} reste debout ; {v} non.", cause: "au duel final" },
      { line: "Le dernier échange décide de tout. {k} l'emporte sur {v}.", cause: "au duel final" },
      { line: "Ils tombent ensemble dans la poussière. {k} se relève. Pas {v}.", cause: "au duel final" },
      { line: "Plus de tactique, plus de réserves : {k} veut juste un peu plus que {v}.", cause: "au duel final" },
      { line: "Tout ce qui reste de l'arène tient dans ce dernier échange. {k} le sait mieux que {v}.", cause: "au duel final" }
    ]
  };

  // --- Incidents solo (pas de tueur) : { line, cause, type } --------
  var INCIDENTS = [
    { type: "fall", cause: "chute d'une falaise",
      lines: ["Une corniche cède sous le poids de {v}. La chute est longue, puis le canon.",
              "{v} tente le raccourci par la paroi. Une prise humide, un cri, le vide.",
              "En reculant devant un danger, {v} ne voit pas le bord. Le ravin fait le reste.",
              "{v} saute d'un rocher à l'autre au-dessus du torrent. Le deuxième était trop loin.",
              "La branche sur laquelle {v} s'était hissé(e) pour voir venir craque d'un coup.",
              "{v} force le passage sur une corniche trop étroite. Le vide ne pardonne pas l'hésitation."] },
    { type: "berries", cause: "baies empoisonnées",
      lines: ["Assoiffé(e), {v} avale une poignée de baies sombres et gorgées d'eau. Une seule aurait suffi.",
              "{v} confond deux buissons presque identiques. L'erreur ne pardonne pas.",
              "Les baies étaient belles, luisantes de rosée. {v} n'a pas tenu jusqu'au matin.",
              "{v} teste une baie sur la langue, attend, en mange trois. C'était trois de trop.",
              "Un champignon pâle au pied d'un arbre. {v} n'a pas pris le temps de se méfier.",
              "{v} a vu un oiseau picorer les mêmes baies la veille. Ça ne voulait rien dire, en fait."] },
    { type: "drown", cause: "noyade",
      lines: ["Le courant du gué est plus fort qu'il n'en a l'air. {v} est emporté(e) sous les yeux des caméras.",
              "{v} traverse le lac à la nage pour semer un poursuivant. Le milieu est loin, très loin.",
              "Un sac trop lourd, une berge trop raide : {v} bascule et ne remonte pas.",
              "{v} glisse sur les galets moussus et sa tête heurte la pierre avant l'eau.",
              "La crue attrape {v} au moment où il croyait la rive à portée.",
              "{v} plonge pour récupérer un sac tombé à l'eau. Le courant décide qu'il le garde."] },
    { type: "snake", cause: "morsure venimeuse",
      lines: ["{v} déplace une pierre pour s'abriter. Ce qui vivait dessous n'apprécie pas.",
              "Un serpent lové dans les racines. {v} le remarque une fraction de seconde trop tard.",
              "La morsure paraît bénigne. À l'aube, {v} ne bouge plus.",
              "{v} enjambe le tronc couché sans regarder de l'autre côté.",
              "Une piqûre au mollet dans les hautes herbes. {v} n'a même pas vu la bête.",
              "{v} ramasse du bois pour la nuit sans regarder sous les branches basses."] },
    { type: "infection", cause: "blessure infectée",
      lines: ["La plaie de {v} a viré au noir. Sans médicament, la nuit a raison de la fièvre.",
              "{v} traîne une entaille depuis trois jours. Elle finit par l'emporter.",
              "La fièvre monte, les gestes de {v} deviennent flous. Le canon retentit à l'aube.",
              "{v} n'a pas nettoyé la coupure. L'eau croupie de l'arène s'en est chargée.",
              "Une égratignure de rien du tout, au début. {v} n'y pense même plus quand la fièvre arrive."] },
    { type: "exhaustion", cause: "épuisement",
      lines: ["{v} n'a pas dormi depuis deux nuits. Le corps décide seul de s'arrêter.",
              "À force de fuir sans boire, {v} s'effondre au milieu d'une clairière et ne se relève pas.",
              "Le cœur de {v} lâche dans la montée. L'arène ne laisse pas de répit.",
              "{v} s'assoit « juste une minute » contre un arbre. La minute ne finit pas.",
              "{v} marche encore un kilomètre de trop, sur des jambes qui ne répondent déjà plus."] },
    { type: "dehydration", cause: "déshydratation",
      lines: ["{v} n'a plus rien bu depuis deux jours. La gorge d'abord, la tête ensuite, puis plus rien.",
              "Le dernier point d'eau de {v} était à sec. Le suivant était trop loin.",
              "{v} boit l'eau croupie d'une flaque faute de mieux. Le corps refuse les deux.",
              "La soif rend {v} imprudent(e) ; l'imprudence, immobile.",
              "{v} a partagé sa dernière gourde deux jours plus tôt. Le compte est venu.",
              "{v} marche vers un ruisseau qui n'existe que dans sa tête, et ne va pas plus loin.",
              "Les lèvres fendues, {v} s'assoit à l'ombre pour attendre la fraîcheur. Elle vient trop tard.",
              "{v} n'avait plus la force de descendre jusqu'à la rivière. Elle coulait à trois cents mètres.",
              "{v} économise sa dernière gorgée pour plus tard. Le « plus tard » n'arrive pas."] },
    { type: "quicksand", cause: "enlisement",
      lines: ["Le sol devient mou sous les bottes de {v}. Plus on se débat, plus on s'enfonce.",
              "{v} s'engage dans la tourbière pour couper au plus court. Mauvais calcul.",
              "La boue tiède monte à la taille de {v} avant qu'un cri ne serve à quelque chose.",
              "{v} tente de s'accrocher à une racine pour se hisser. La racine cède la première."] }
  ];
  var INCIDENT_BY_TYPE = {};
  INCIDENTS.forEach(function (x) { INCIDENT_BY_TYPE[x.type] = x; });
  // On ne meurt pas de faim dans l'arène — seulement de soif. Tout ancien
  // identifiant « starvation » retombe donc sur la déshydratation.
  INCIDENT_BY_TYPE.starvation = INCIDENT_BY_TYPE.dehydration;

  // --- Environnement (grands événements des Juges) -----------------
  var ENVIRON = {
    forest_fire: [
      "{v} est cerné(e) par le mur de flammes des Juges. Le canon retentit dans la fumée.",
      "Une boule de feu tombe droit sur l'abri de {v}. Il n'y avait pas de deuxième sortie.",
      "{v} court devant les flammes jusqu'à ce qu'il n'y ait plus où courir.",
      "La fumée trouve {v} avant même que le feu n'arrive."],
    tracker_jackers: [
      "Les guêpes tueuses rattrapent {v}. Le venin fait le reste avant l'aube.",
      "{v} plonge dans le ruisseau pour échapper à l'essaim. L'essaim attend sur la berge.",
      "Une seule piqûre de trop : {v} délire, se perd, et ne revient pas.",
      "{v} tente de courir mais l'essaim est plus rapide et bien plus nombreux."],
    acid_fog: [
      "{v} n'a pas couru assez vite ; le brouillard corrosif l'enveloppe.",
      "{v} porte un allié blessé et perd la course contre la nappe jaune.",
      "Le brouillard rattrape {v} à trois pas de la crête.",
      "{v} respire une bouffée de trop en cherchant la sortie du nuage jaune."],
    nightlock: [
      "Assoiffé(e), {v} goûte les baies noires des Juges. Une bouchée suffit.",
      "Les Juges ont semé le nightlock sur le sentier de {v}. La soif a fait le reste.",
      "{v} ne prend pas le temps de vérifier. Une bouchée, et c'est déjà trop tard."],
    quake: [
      "Un ravin s'ouvre sous les pas de {v}. Le sol se referme.",
      "L'arbre-refuge de {v} bascule quand la faille traverse ses racines.",
      "{v} court sur un sol qui n'arrête pas de se fendre sous ses pas."],
    drought: [
      "Sans eau depuis deux jours, {v} s'effondre en vue de la Corne.",
      "{v} atteint enfin le point d'eau. Il est à sec, et {v} avec.",
      "La soif use {v} plus vite que n'importe quel adversaire n'aurait pu le faire."],
    cold_night: [
      "{v} s'endort près d'un feu mourant et ne se réveille pas.",
      "Le givre gagne pendant que {v} économise ses dernières brindilles.",
      "Sans couverture, {v} ne passe pas la nuit la plus froide de l'arène.",
      "{v} tremble, s'immobilise, et ne bouge plus quand le jour se lève."],
    monkey_mutts: [
      "Les singes mutants tombent sur {v} depuis la canopée.",
      "{v} en repousse trois. Le quatrième arrive par-derrière.",
      "Les singes des Juges submergent {v} en quelques secondes, trop nombreux pour se défendre."],
    mutts: [
      "Une mutation au visage familier accule {v} contre un arbre. {v} ne recule pas.",
      "La meute des Juges appelle {v} par son nom. {v} se retourne. C'était l'erreur.",
      "{v} se bat jusqu'au bout contre les mutations, mais elles sont trop nombreuses."],
    flood: [
      "Le courant emporte {v} avant qu'un allié ne puisse tendre la main.",
      "{v} grimpe, mais l'eau monte plus vite que la pente.",
      "{v} s'accroche à une branche, mais le courant est plus fort que ses bras."],
    wolf_pack: [
      "Les loups des Juges rabattent {v} loin de tout abri.",
      "{v} tient les crocs à distance jusqu'à ce que le cercle se referme.",
      "{v} recule, recule encore. Il n'y a plus de recul possible face à la meute."],
    gamemaker_whim: [
      "Le mur invisible de l'arène cisaille le refuge de {v}. Il n'y avait pas d'issue.",
      "Les Juges resserrent le décor : {v} se retrouve à découvert, sans une seconde pour réagir.",
      "Le terrain change sous les pieds de {v}, et ne lui laisse nulle part où aller."],
    lightning: [
      "La foudre des Juges frappe l'arbre sous lequel {v} s'était abrité(e).",
      "{v} lève les yeux au mauvais moment, sur la mauvaise crête.",
      "L'éclair choisit {v}, en une fraction de seconde, sans prévenir."],
    avalanche: [
      "La coulée de pierres surprend {v} à flanc de pente.",
      "{v} entend le grondement une seconde avant que la montagne ne parte.",
      "{v} court vers le bas de la pente. La roche va plus vite."],
    thorn_maze: [
      "Le labyrinthe d'épines se referme ; {v} ne retrouve pas la sortie à temps.",
      "Chaque couloir ramène {v} au même cul-de-sac, et le mur avance.",
      "{v} cherche la sortie du labyrinthe d'épines jusqu'à ce qu'il n'y ait plus de temps pour chercher."],
    heat_wave: [
      "La chaleur blanche a raison de {v} au milieu de la plaine.",
      "{v} rationne l'ombre comme l'eau. Il n'en restait pas assez.",
      "{v} s'effondre à quelques mètres du dernier coin d'ombre de l'arène."],
    default: [
      "L'arène a raison de {v}. Un canon, puis le silence.",
      "Les Juges avaient prévu ce moment pour {v}. Ils sont patients.",
      "Le sort n'a pas été favorable à {v}, cette fois."]
  };
  var ENVIRON_CAUSE = {
    forest_fire: "piégé(e) par l'incendie", tracker_jackers: "venin de guêpes tueuses",
    acid_fog: "brouillard corrosif", nightlock: "baies de nightlock",
    quake: "englouti(e) par le séisme", drought: "déshydratation",
    cold_night: "froid mortel", monkey_mutts: "singes mutants", mutts: "mutations des Juges",
    flood: "emporté(e) par la crue", wolf_pack: "loups des Juges", gamemaker_whim: "caprice des Juges",
    lightning: "foudre des Juges", avalanche: "coulée de pierres",
    thorn_maze: "perdu(e) dans le labyrinthe d'épines", heat_wave: "coup de chaleur",
    default: "l'arène"
  };

  HG.deaths = {
    weaponOf: weaponOf,
    weaponThe: weaponThe,
    weaponCat: weaponCat,
    INCIDENTS: INCIDENTS,

    encounter: function (killer, victim, kind, rng) {
      if (kind === "betrayal" || kind === "pack_turn" || kind === "duel") {
        var pd = pick(rng, ENCOUNTER[kind]);
        return { text: fill(pd.line, killer, victim), cause: pd.cause };
      }
      // Combat avec un tueur identifié : description à l'arme le plus souvent.
      if (killer && rng.f() < 0.82) {
        var cat = weaponCat(killer);
        var wp = BY_WEAPON[cat] || BY_WEAPON.blade;
        var w = pick(rng, wp);
        return { text: fill(w.line, killer, victim), cause: w.cause };
      }
      var pool = ENCOUNTER[kind] || ENCOUNTER.melee;
      var p = pick(rng, pool);
      return { text: fill(p.line, killer, victim), cause: p.cause };
    },

    incident: function (victim, type, rng) {
      var inc = INCIDENT_BY_TYPE[type] || pick(rng, INCIDENTS);
      return { text: fill(pick(rng, inc.lines), null, victim), cause: inc.cause, type: inc.type };
    },

    environmental: function (victim, eventId, rng) {
      var lines = (ENVIRON[eventId] && ENVIRON[eventId].length) ? ENVIRON[eventId] : ENVIRON.default;
      return { text: fill(pick(rng, lines), null, victim),
               cause: ENVIRON_CAUSE[eventId] || ENVIRON_CAUSE.default };
    }
  };

})(window.HG = window.HG || {});
