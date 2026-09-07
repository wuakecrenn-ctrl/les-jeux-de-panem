/* =========================================================================
   engine/commentary.js — voix du Capitole.
   Caesar Flickerman (bonimenteur) · Claudius Templesmith (l'annonceur).

   ▶ POUR AJOUTER DES RÉPLIQUES (c'est fait pour) :
     • CAESAR_INTRO ......... phrases d'accroche avant un nom, plateau de Caesar
     • CAESAR_BY_PROFILE .... réplique de Caesar selon le profil du tribut
                              (career / strong / cunning / charming / small /
                               survivor / plain)
     • CHARIOT_HOT / MID / COLD  réactions de la foule au défilé des chars
     • claudius.presentation ... ouverture de la présentation des tributs
     • claudius.open / feast / night / loversRule / convergence / victor …

   Règles d'écriture : une chaîne = une réplique, entre guillemets, virgule à
   la fin. {name} = nom du tribut, {d} = numéro de district. <span class='who'>…
   </span> met un nom en surbrillance (déjà géré pour les listes ci-dessous).
   Garde le ton du film (PG-13). Recharge la page après modif (voir index.html).
   ========================================================================= */
(function (HG) {
  "use strict";

  function n(t) { return t.name; }
  // pas de répétition sur toute la partie (voir HG.narrPick)
  function pick(rng, a) { return HG.narrPick ? HG.narrPick(rng, a) : a[Math.floor(rng.f() * a.length)]; }

  // ---- Profils de tribut pour varier les répliques ----------------
  function profileOf(t) {
    var s = t.stats;
    if (t.career) return "career";
    if (s.cha >= 9) return "charming";
    if (s.cun >= 9) return "cunning";
    if (s.str >= 9) return "strong";
    if (s.sur >= 9) return "survivor";
    if (s.str <= 3 && s.agi >= 6) return "small";
    return "plain";
  }

  var CAESAR_INTRO = [
    "Mesdames et messieurs, accueillez comme il se doit",
    "Tout droit du District {d} :",
    "Le public retient son souffle pour",
    "On l'attendait, le voici :",
    "Quel sourire, quelle prestance —",
    "Applaudissez très fort",
    "Voici quelqu'un dont on va reparler :",
    "Le Capitole a hâte de connaître",
    "Vous allez adorer celui-ci —",
    "Silence dans les gradins pour",
    "Et sous les projecteurs, à présent :",
    "Que la Grande Avenue se lève pour",
    "Personne ne veut manquer celui-ci —",
    "Droit dans les cœurs du Capitole :",
    "On garde un œil sur celui-là. Voici",
    "Les caméras ne le lâchent plus :"
  ];

  var CAESAR_BY_PROFILE = {
    career: [
      "{name} n'est pas venu ici se faire des amis. Les paris s'affolent.",
      "{name} a dix ans d'entraînement dans les jambes. Redoutable.",
      "Regardez cette assurance ! {name} veut la couronne et le fait savoir.",
      "{name} sourit à peine. C'est peut-être ça, le plus inquiétant.",
      "{name} a été élevé pour ces Jeux. On le voit à chaque geste.",
      "Les autres Carrières regardent {name} du coin de l'œil. Ça en dit long.",
      "{name} promet du spectacle. Le Capitole ne demande que ça."
    ],
    strong: [
      "{name} pourrait soulever un char à mains nues. Le Capitole adore.",
      "Ne cherchez pas la finesse chez {name} — cherchez la puissance.",
      "{name} a serré la main de Caesar… et Caesar a eu peur pour ses doigts.",
      "Une poignée de main de {name} et l'on comprend pourquoi les cotes montent.",
      "{name} n'a pas dit trois mots, mais on a compté les muscles."
    ],
    cunning: [
      "{name} a ce regard qui calcule tout. Méfiez-vous de l'eau qui dort.",
      "Pas un mot de trop. {name} garde ses cartes contre sa poitrine.",
      "{name} n'a rien promis, rien juré. C'est peut-être une tactique.",
      "{name} répond à côté de chaque question, avec le sourire. Brillant.",
      "On ne sait rien de plus sur {name} qu'avant l'interview. C'est sans doute voulu."
    ],
    charming: [
      "{name} a fait pleurer trois stylistes et rire toute la salle. Un phénomène.",
      "Le Capitole est déjà amoureux de {name}. Les parachutes vont pleuvoir.",
      "{name} raconte une histoire et l'avenue entière se penche pour écouter.",
      "{name} repart sous une ovation. Les sponsors font déjà la queue.",
      "Trois minutes avec {name} et on oublie que c'est une arène qui attend."
    ],
    small: [
      "{name} est menu, oui — mais on ne gagne pas les Jeux au poids.",
      "Ne sous-estimez jamais {name}. Les discrets savent se faire oublier.",
      "{name} tient dans un creux de rocher. Bonne chance pour l'y trouver.",
      "{name} sourit poliment. Dans l'arène, ce sourire aura disparu — et {name} aussi, des radars.",
      "Petit gabarit, grand cerveau : {name} n'a pas dit son dernier mot."
    ],
    survivor: [
      "{name} connaît la faim, le froid, les bois. L'arène, c'est presque chez lui.",
      "{name} tiendra quand les autres flancheront. Notez-le.",
      "{name} a déjà passé des nuits dehors sans feu. Ça compte, dans une arène.",
      "Pendant que d'autres cherchent une arme, {name} cherchera de l'eau. Et il la trouvera.",
      "{name} parle de plantes comestibles comme d'autres parlent d'épées. Malin."
    ],
    plain: [
      "{name} avance masqué. On n'a rien pu lui tirer — surprise garantie.",
      "Discret, {name}. Le genre à créer la sensation au douzième jour.",
      "{name} observe, jauge, attend. Un outsider comme le Capitole les aime.",
      "{name} n'a pas fait de vagues ce soir. Les vagues, ce sera pour l'arène.",
      "On n'a pas de case pour {name}. C'est peut-être son meilleur atout."
    ]
  };

  var CHARIOT_HOT = [
    "La foule scande le nom de <span class='who'>{name}</span> ! Le char du District {d} enflamme l'avenue.",
    "Une pluie de roses pour <span class='who'>{name}</span> — le District {d} a marqué les esprits ce soir.",
    "<span class='who'>{name}</span> lève le poing et la Cité des Jeux entière se met debout.",
    "Le costume du District {d} embrase les projecteurs ; <span class='who'>{name}</span> devient l'attraction de la soirée.",
    "<span class='who'>{name}</span> envoie un baiser à la foule et les gradins explosent.",
    "Les paris se rouvrent en direct : après ce défilé, la cote de <span class='who'>{name}</span> grimpe en flèche.",
    "<span class='who'>{name}</span> tient la pose une seconde de trop, juste ce qu'il faut. La foule adore.",
    "On n'avait pas vu un char faire cet effet depuis des années. <span class='who'>{name}</span> restera dans les mémoires."
  ];
  var CHARIOT_MID = [
    "<span class='who'>{name}</span> salue la foule ; des applaudissements nourris montent des gradins.",
    "Le char du District {d} passe dignement ; <span class='who'>{name}</span> garde la tête haute.",
    "<span class='who'>{name}</span> arrache un sourire au Capitole. C'est déjà ça de pris.",
    "Costume sobre, port assuré : <span class='who'>{name}</span> ne fait pas de vagues, mais on l'a remarqué.",
    "Quelques sifflets admiratifs pour <span class='who'>{name}</span> au passage du char.",
    "<span class='who'>{name}</span> fixe les caméras droit dans l'objectif. Le message est passé.",
    "Pas d'éclat, pas de faute : <span class='who'>{name}</span> passe l'épreuve du défilé sans trembler.",
    "<span class='who'>{name}</span> cherche un visage dans la foule, ne le trouve pas, et se redresse quand même."
  ];
  var CHARIOT_COLD = [
    "Le char du District {d} passe presque inaperçu. <span class='who'>{name}</span> devra se faire remarquer autrement.",
    "<span class='who'>{name}</span> fixe l'horizon, sans un geste. La foule attendait plus de spectacle.",
    "Peu de bruit pour <span class='who'>{name}</span>. Les sponsors regardent déjà le char suivant.",
    "Le costume du District {d} n'a pas pris ; <span class='who'>{name}</span> serre les dents sous les projecteurs.",
    "<span class='who'>{name}</span> trébuche légèrement sur la plateforme. Le Capitole retient un rire.",
    "Silence poli au passage de <span class='who'>{name}</span>. Il faudra convaincre à l'entraînement.",
    "<span class='who'>{name}</span> oublie de saluer, se reprend trop tard. Le char est déjà loin.",
    "Le District {d} n'a pas eu de budget costume, et ça se voit. <span class='who'>{name}</span> fait ce qu'il peut."
  ];

  HG.commentary = {
    profileOf: profileOf,

    interview: function (t, rng) {
      var intro = pick(rng, CAESAR_INTRO).replace("{d}", t.district);
      var line = pick(rng, CAESAR_BY_PROFILE[profileOf(t)]).replace(/\{name\}/g, n(t));
      return { intro: intro, line: line };
    },

    chariot: function (t, rng) {
      var roll = rng.f() + (t.stats.cha - 5) * 0.05;
      var pool, gain;
      if (roll > 0.72) { pool = CHARIOT_HOT; gain = rng.int(10, 18); }
      else if (roll > 0.4) { pool = CHARIOT_MID; gain = rng.int(4, 9); }
      else { pool = CHARIOT_COLD; gain = rng.int(1, 4); }
      var text = pick(rng, pool).replace(/\{name\}/g, n(t)).replace(/\{d\}/g, t.district);
      return { gain: gain, text: text };
    },

    // ---- Annonces de Claudius Templesmith / l'annonceur ----
    claudius: {
      presentation: [
        "Mesdames et messieurs — bienvenue. Bienvenue aux soixante-quatorzièmes Hunger Games.",
        "Vingt-quatre tributs. Douze districts. Une arène dont un seul ressortira vivant.",
        "Cette année encore, les Juges ont préparé quelque chose de… mémorable.",
        "Vous les avez vus au tirage, vous allez apprendre à les connaître : voici les tributs.",
        "Chaque district envoie un garçon et une fille. Certains sont nés pour ça. D'autres l'apprennent ce soir.",
        "Comme chaque année, le Capitole vous offre le spectacle. Et que le sort — vous le savez — vous soit éternellement favorable."
      ],
      rosterCall: [
        "Voici, district par district, les vingt-quatre visages de ces Jeux.",
        "Regardez-les bien. Dans quelques jours, il n'en restera qu'un.",
        "Le Capitole vous présente vos tributs."
      ],
      open: "Que les soixante-quatorzièmes Hunger Games commencent. Et que le sort vous soit — <em class='q'>éternellement</em> — favorable.",
      feast: "Votre attention. Un festin sera servi à la Corne d'abondance. Chacun y trouvera ce dont il a désespérément besoin. Refuser l'invitation serait… imprudent.",
      night: function (day) {
        return "Fin du " + (day === 1 ? "premier jour" : day + "e jour") + ". Que les tributs lèvent les yeux : le ciel va se souvenir des disparus.";
      },
      loversRule: "Règle exceptionnelle des Juges : deux tributs d'un même district pourront être sacrés vainqueurs — s'ils sont les deux derniers en vie.",
      loversRevoke: "La dernière règle est révoquée. Il n'y aura, comme toujours, qu'un seul vainqueur.",
      convergence: "Les Juges vous invitent à la Corne d'abondance. Ce n'est pas une suggestion.",
      victor: function (name) {
        return "Mesdames et messieurs — le vainqueur des soixante-quatorzièmes Hunger Games : <span class='who'>" + name + "</span> !";
      },
      dualVictor: function (a, b, district) {
        return "Mesdames et messieurs — les vainqueurs des soixante-quatorzièmes Hunger Games : <span class='who'>" + a + "</span> et <span class='who'>" + b + "</span>, du District " + district + " !";
      }
    }
  };

})(window.HG = window.HG || {});
