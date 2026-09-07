/* =========================================================================
   engine/events.js — deck d'événements d'arène (« logique des Juges »).

   ▶ POUR AJOUTER UN ÉVÉNEMENT : copie un bloc de HG.EVENTS et adapte-le.
     id ........... identifiant unique (sans espace)
     title ........ titre affiché ("Jour N · <title>")
     phase ........ "day" | "night" | "any"
     weight ....... fréquence relative (plus grand = plus fréquent)
     announce ..... 1 phrase OU un tableau de phrases (tirées au hasard) —
                    c'est le texte dit par l'annonceur. AJOUTE-EN LIBREMENT.
     quiet ........ true = manche calme (peu ou pas de morts)
     minAlive ..... n'apparaît qu'au-dessus de ce nombre de survivants
   Effets optionnels : exposure / envDeath / envWound (danger d'ambiance),
     encounterMul (densité des affrontements), kind ("melee"/"ambush"/…),
     incidentRate + incidentTypes (chutes, baies, noyade…), giftDrop,
     forcesGather, packHunts, hitsPack, mockingjay, bonding.
   Recharge la page après modif (incrémente V dans index.html).
   ========================================================================= */
(function (HG) {
  "use strict";

  HG.EVENTS = [
    // ---- Journées / nuits calmes ----
    {
      id: "calm_day", title: "Journée sans histoire", phase: "day", weight: 9, quiet: true,
      announce: [
        "Rien à signaler dans l'arène. Le Capitole s'ennuie ferme — profitez-en, tributs, cela ne durera pas.",
        "Une matinée sans un cri. Les caméras cherchent l'action et ne trouvent que des feuilles qui bougent.",
        "Le soleil monte sur une arène immobile. Quelque part, un Juge tapote son pupitre."
      ]
    },
    {
      id: "calm_night", title: "Nuit silencieuse", phase: "night", weight: 7, quiet: true,
      announce: [
        "La nuit tombe sans un cri. Les feux de camp s'éteignent un à un ; chacun serre son arme un peu plus fort.",
        "Une nuit claire et froide. On entend les tributs respirer d'un bout à l'autre de l'arène.",
        "Pas un canon cette nuit. Seulement le vent dans les cimes et des yeux qui ne se ferment pas."
      ]
    },
    {
      id: "quiet_alliance", title: "Trêve tacite", phase: "night", weight: 5, quiet: true, bonding: true,
      announce: [
        "Nul mouvement cette nuit. Autour des feux, on partage un peu d'eau, on monte la garde à tour de rôle.",
        "Les alliances se resserrent dans le noir : on se raconte le district, la maison, ce qu'on fera après."
      ]
    },
    {
      id: "sponsor_rain", title: "Pluie de parachutes", phase: "any", weight: 4,
      giftDrop: true, giftCount: 2, quiet: true,
      announce: [
        "Le Capitole se montre généreux ce soir. Plusieurs parachutes argentés descendent en silence vers leurs favoris.",
        "Les sponsors ouvrent leur bourse : des présents tombent du ciel pour les tributs les plus suivis."
      ]
    },
    {
      id: "mockingjay", title: "Chant des geais moqueurs", phase: "night", weight: 5, quiet: true,
      kind: "ambush", mockingjay: true,
      announce: [
        "Les geais moqueurs reprennent un air entendu quelque part dans l'arène. Un signal, ou un piège.",
        "Quatre notes voyagent d'arbre en arbre. Certains tributs y voient un message ; d'autres, un appât."
      ]
    },

    // ---- Feu / chaleur ----
    {
      id: "forest_fire", title: "Mur de flammes", phase: "day", weight: 8,
      exposure: 0.55, envDeath: 0.14, envWound: 0.4, encounterMul: 1.1, kind: "flight",
      announce: [
        "Les Juges allument la forêt. Un mur de feu pousse les tributs vers le centre — et les uns vers les autres.",
        "Des boules de feu tombent des arbres. L'arène rétrécit dans la fumée."
      ]
    },
    {
      id: "heat_wave", title: "Vague de chaleur", phase: "day", weight: 6,
      exposure: 0.55, envDeath: 0.09, envWound: 0.45, kind: "melee",
      announce: [
        "Le soleil de l'arène double d'intensité. L'ombre devient un territoire qu'on se dispute.",
        "La plaine tremble de chaleur. Les gourdes se vident, les nerfs lâchent."
      ]
    },
    {
      id: "drought", title: "Les sources se tarissent", phase: "day", weight: 6,
      exposure: 0.6, envDeath: 0.08, envWound: 0.4, kind: "melee",
      announce: [
        "Les Juges assèchent l'arène. La seule eau restante coule près de la Corne — sous les yeux de la meute.",
        "Les ruisseaux ne sont plus que des lits de galets. Tout le monde converge vers le même point d'eau."
      ]
    },
    {
      id: "lightning", title: "Orage sec", phase: "any", weight: 5,
      exposure: 0.4, envDeath: 0.12, envWound: 0.35, kind: "flight",
      announce: [
        "Un orage sans pluie roule sur l'arène. La foudre choisit les arbres les plus hauts — et ce qui s'abrite dessous.",
        "Le ciel de l'arène vire au violet. Chaque éclair éclaire des silhouettes qui courent."
      ]
    },

    // ---- Créatures ----
    {
      id: "tracker_jackers", title: "Nid de guêpes tueuses", phase: "day", weight: 7,
      exposure: 0.3, envDeath: 0.16, envWound: 0.45, kind: "ambush",
      announce: [
        "Un nid de guêpes tueuses éclate au-dessus d'un campement. Le venin fait délirer ; certains ne se réveilleront pas.",
        "Un bourdonnement grave monte des broussailles. Puis les cris."
      ]
    },
    {
      id: "mutts", title: "Meute de mutations", phase: "night", weight: 5, minAlive: 3,
      encounterMul: 1.4, kind: "flight", mutts: true, exposure: 0.4, envDeath: 0.12,
      announce: [
        "Les Juges lâchent les mutations. Elles ont les yeux — et parfois le visage — des tributs déjà tombés.",
        "Des formes basses et rapides sortent du bois. Elles ne grognent pas ; elles appellent par leur nom."
      ]
    },
    {
      id: "monkey_mutts", title: "Singes mutants", phase: "day", weight: 5, minAlive: 4,
      encounterMul: 1.3, kind: "ambush", exposure: 0.3, envWound: 0.4,
      announce: [
        "Une nuée de singes aux crocs d'ivoire dévale la canopée. Ils ne cherchent pas à manger — seulement à tuer.",
        "La cime des arbres s'agite d'un coup. Trop tard pour comprendre pourquoi."
      ]
    },
    {
      id: "wolf_pack", title: "Loups des Juges", phase: "night", weight: 5, minAlive: 3,
      exposure: 0.35, envDeath: 0.12, envWound: 0.4, kind: "flight",
      announce: [
        "Des hurlements encerclent l'arène. Les Juges ont faim de spectacle et lâchent la meute.",
        "Six paires d'yeux jaunes avancent en ligne dans les fougères."
      ]
    },

    // ---- Terrain ----
    {
      id: "quake", title: "Séisme", phase: "any", weight: 5,
      exposure: 0.45, envDeath: 0.11, envWound: 0.35, encounterMul: 1.1,
      announce: [
        "Le sol de l'arène se fend. Des ravins s'ouvrent, des arbres centenaires s'effondrent.",
        "Une secousse profonde. L'abri d'hier devient le piège d'aujourd'hui."
      ]
    },
    {
      id: "flood", title: "Crue subite", phase: "any", weight: 5,
      exposure: 0.5, envDeath: 0.12, envWound: 0.4, kind: "flight",
      announce: [
        "Une vague brune dévale le versant est. En quelques minutes, la moitié basse de l'arène disparaît sous l'eau.",
        "Le barrage des Juges cède « accidentellement ». Les tributs des bas-fonds courent vers les crêtes."
      ]
    },
    {
      id: "avalanche", title: "Éboulement", phase: "day", weight: 4,
      exposure: 0.4, envDeath: 0.12, envWound: 0.4, kind: "flight",
      announce: [
        "Tout un pan de la montagne artificielle lâche. Un grondement, puis la poussière.",
        "Les Juges déclenchent la pente : des tonnes de roche cherchent le point bas."
      ]
    },
    {
      id: "acid_fog", title: "Brouillard corrosif", phase: "night", weight: 6,
      exposure: 0.5, envDeath: 0.13, envWound: 0.5, kind: "flight",
      announce: [
        "Un brouillard épais et jaune roule entre les arbres. Au contact, la peau brûle. Courez.",
        "Le brouillard des Juges descend des crêtes. Il ne fait pas de bruit et il ne s'arrête pas."
      ]
    },
    {
      id: "thorn_maze", title: "Mur d'épines", phase: "day", weight: 4, minAlive: 4,
      exposure: 0.35, envDeath: 0.1, envWound: 0.4, encounterMul: 1.2, kind: "ambush",
      announce: [
        "Des haies d'épines jaillissent du sol et redessinent l'arène en labyrinthe. Les couloirs mènent tous au même endroit.",
        "L'arène devient un dédale. Au bout de chaque impasse, quelqu'un attend."
      ]
    },
    {
      id: "cold_night", title: "Nuit glaciale", phase: "night", weight: 6,
      exposure: 0.5, envDeath: 0.1, envWound: 0.35,
      announce: [
        "La température chute d'un coup. Sans couverture ni feu, la nuit elle-même devient une arme.",
        "Le givre monte sur les fougères. Ceux qui n'ont pas de feu ne dormiront pas."
      ]
    },
    {
      id: "nightlock", title: "Baies de nightlock", phase: "day", weight: 5,
      exposure: 0.25, envDeath: 0.1, envWound: 0.15, kind: "ambush",
      announce: [
        "Des buissons couverts de baies noires apparaissent près des points d'eau. Sucrées, luisantes… et mortelles en une bouchée.",
        "Les Juges sèment le nightlock sur les sentiers les plus fréquentés."
      ]
    },

    // ---- Grands rendez-vous ----
    {
      id: "feast", title: "Le Festin de la Corne", phase: "day", weight: 6, minAlive: 4,
      encounterMul: 2.1, kind: "melee", forcesGather: true, giftDrop: true,
      announce: [
        "Votre attention. Un festin sera servi à la Corne d'abondance. Chacun y trouvera ce dont il a désespérément besoin. Refuser l'invitation serait… imprudent.",
        "Un sac par district, marqué à votre nom, vous attend sur la table de la Corne. Venez le chercher."
      ]
    },
    {
      id: "career_hunt", title: "La meute chasse", phase: "night", weight: 8,
      encounterMul: 1.6, kind: "hunt", packHunts: true,
      announce: [
        "Torches à la main, la meute des Carrières ratisse les fourrés. On entend rire dans le noir.",
        "Les Carrières partent en chasse, en file, méthodiques. Cette nuit, ils veulent un canon."
      ]
    },
    {
      id: "supply_blast", title: "Les réserves des Carrières explosent", phase: "day", weight: 4,
      hitsPack: true, kind: "hunt", encounterMul: 1.1,
      announce: [
        "Une déflagration secoue le camp de la Corne : la pyramide de vivres des Carrières part en fumée.",
        "Quelqu'un a déclenché les mines autour du butin. La meute est furieuse — et affamée."
      ]
    },
    {
      id: "gamemaker_whim", title: "Caprice des Juges", phase: "any", weight: 4,
      encounterMul: 1.4, kind: "melee",
      announce: [
        "Sans explication, les murs de l'arène se resserrent. Le territoire jouable vient de fondre de moitié.",
        "Les Juges déplacent le décor. Deux tributs qui se croyaient loin l'un de l'autre se retrouvent nez à nez."
      ]
    },

    // ---- Aléas « naturels » (incidents solo plus fréquents) ----
    {
      id: "ravine_country", title: "Terrain accidenté", phase: "day", weight: 6,
      incidentRate: 0.5, incidentTypes: ["fall", "snake", "quicksand"], kind: "flight",
      announce: [
        "L'arène du jour est un chaos de gorges et d'éboulis. Un pas de travers ne pardonne pas.",
        "Les Juges ont choisi le décor : falaises, corniches, ponts de pierre. Regardez où vous marchez."
      ]
    },
    {
      id: "sickly_woods", title: "Bois malsains", phase: "night", weight: 6,
      incidentRate: 0.45, incidentTypes: ["infection", "snake", "berries"], envWound: 0.35, exposure: 0.3,
      announce: [
        "Une odeur de pourriture monte des sous-bois. Les blessures s'infectent vite, ici.",
        "Moustiques, ronces, eau croupie : la nuit, la forêt travaille contre les tributs."
      ]
    },
    {
      id: "bad_water", title: "Eau saumâtre", phase: "day", weight: 5,
      incidentRate: 0.4, incidentTypes: ["drown", "berries", "starvation"], exposure: 0.4, envWound: 0.3,
      announce: [
        "Les seuls points d'eau sont troubles et amers. Boire est un pari.",
        "Les Juges ont empoisonné la moitié des sources. Reste à deviner lesquelles."
      ]
    },
    {
      id: "long_march", title: "Journée d'usure", phase: "day", weight: 6,
      incidentRate: 0.4, incidentTypes: ["exhaustion", "starvation", "infection"], quiet: true,
      announce: [
        "Rien ne bouge dans l'arène — sauf la faim, la soif et la fatigue qui gagnent du terrain.",
        "Une longue journée sans affrontement. Les corps, eux, continuent de lâcher."
      ]
    }
  ];

  function announceOf(ev, rng) {
    if (!Array.isArray(ev.announce)) return ev.announce;
    return HG.narrPick ? HG.narrPick(rng, ev.announce) : rng.pick(ev.announce);
  }
  HG.eventAnnounce = announceOf;

  // Tire un événement compatible avec la phase et le nombre de tributs.
  HG.drawEvent = function (rng, phase, aliveCount, opts) {
    opts = opts || {};
    var pool = HG.EVENTS.filter(function (e) {
      if (e.phase !== "any" && e.phase !== phase) return false;
      if (e.minAlive && aliveCount < e.minAlive) return false;
      if (opts.exclude && opts.exclude.indexOf(e.id) !== -1) return false;
      return true;
    });
    var endgame = aliveCount <= 5;
    var weighted = pool.map(function (e) {
      var w = e.weight;
      if (endgame && e.quiet) w *= 0.3;
      if (endgame && e.encounterMul) w *= 1.7;
      if (opts.forceLoud && e.quiet) w *= 0.08;
      return { e: e, w: w };
    });
    return rng.weighted(weighted, "w").e;
  };

})(window.HG = window.HG || {});
