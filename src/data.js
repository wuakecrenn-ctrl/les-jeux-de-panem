/* =========================================================================
   data.js — districts, roster canonique des 74e Jeux, réserve de prénoms
   Hommage de fan au film. Aucun but commercial.
   ========================================================================= */
(function (HG) {
  "use strict";

  // --- Les douze districts de Panem -------------------------------------
  HG.DISTRICTS = {
    1:  { name: "District 1",  industry: "Produits de luxe",  career: true },
    2:  { name: "District 2",  industry: "Maçonnerie & armes", career: true },
    3:  { name: "District 3",  industry: "Électronique",       career: false },
    4:  { name: "District 4",  industry: "Pêche",              career: true },
    5:  { name: "District 5",  industry: "Énergie",            career: false },
    6:  { name: "District 6",  industry: "Transports",         career: false },
    7:  { name: "District 7",  industry: "Bûcheronnage",       career: false },
    8:  { name: "District 8",  industry: "Textile",            career: false },
    9:  { name: "District 9",  industry: "Céréales",           career: false },
    10: { name: "District 10", industry: "Élevage",            career: false },
    11: { name: "District 11", industry: "Agriculture",        career: false },
    12: { name: "District 12", industry: "Charbon",            career: false }
  };

  // --- Roster canonique : 24 tributs des 74e Hunger Games ---------------
  // portrait = fichier dans assets/tributes/. Les noms des figurants de
  // districts non nommés à l'écran sont des inventions cohérentes.
  HG.CANONICAL = [
    { id: "d1m",  district: 1,  sex: "m", name: "Marvel",   canon: true  },
    { id: "d1f",  district: 1,  sex: "f", name: "Glimmer",  canon: true  },
    { id: "d2m",  district: 2,  sex: "m", name: "Cato",     canon: true  },
    { id: "d2f",  district: 2,  sex: "f", name: "Clove",    canon: true  },
    { id: "d3m",  district: 3,  sex: "m", name: "Teslin",   canon: false },
    { id: "d3f",  district: 3,  sex: "f", name: "Circa",    canon: false },
    { id: "d4m",  district: 4,  sex: "m", name: "Marin",    canon: false },
    { id: "d4f",  district: 4,  sex: "f", name: "Coralie",  canon: false },
    { id: "d5m",  district: 5,  sex: "m", name: "Dyno",     canon: false },
    { id: "d5f",  district: 5,  sex: "f", name: "Finch",    canon: true, alias: "la Renarde" },
    { id: "d6m",  district: 6,  sex: "m", name: "Rieb",     canon: false },
    { id: "d6f",  district: 6,  sex: "f", name: "Sable",    canon: false },
    { id: "d7m",  district: 7,  sex: "m", name: "Cèdre",    canon: false },
    { id: "d7f",  district: 7,  sex: "f", name: "Genièvre", canon: false },
    { id: "d8m",  district: 8,  sex: "m", name: "Tavin",    canon: false },
    { id: "d8f",  district: 8,  sex: "f", name: "Paisley",  canon: false },
    { id: "d9m",  district: 9,  sex: "m", name: "Seigle",   canon: false },
    { id: "d9f",  district: 9,  sex: "f", name: "Tilla",    canon: false },
    { id: "d10m", district: 10, sex: "m", name: "Brann",    canon: false },
    { id: "d10f", district: 10, sex: "f", name: "Della",    canon: false },
    { id: "d11m", district: 11, sex: "m", name: "Thresh",   canon: true  },
    { id: "d11f", district: 11, sex: "f", name: "Rue",      canon: true  },
    { id: "d12m", district: 12, sex: "m", name: "Peeta",    canon: true  },
    { id: "d12f", district: 12, sex: "f", name: "Katniss",  canon: true  }
  ];

  HG.portraitPath = function (id) {
    return "assets/tributes/" + id + ".png";
  };

  // --- Modes de jeu -------------------------------------------------
  HG.GAME_MODES = {
    simple:  { label: "Simple", blurb: "Chaque tribut a des statistiques cachées. Idéal pour découvrir." },
    advanced:{ label: "Avancé", blurb: "En plus des stats, chaque tribut a 2 compétences qui changent les combats et la survie dans l'arène." }
  };

  // --- Compétences (mode avancé) ----------------------------------
  // combat : bonus de puissance selon le type de rencontre
  // resist : réduit la probabilité d'un incident d'un type donné
  // edge   : effets spéciaux lus par le moteur
  HG.SKILLS = {
    archerie:   { label: "Archerie", blurb: "Redoutable à distance ; touche avant le corps-à-corps.",
                  combat: { ranged: 5, hunt: 2 }, edge: ["firstStrike"] },
    lame:       { label: "Maître d'armes", blurb: "Épée, lance, couteau : la mêlée lui appartient.",
                  combat: { melee: 5, duel: 3 } },
    force:      { label: "Force herculéenne", blurb: "Encaisse et renverse. Difficile à mettre à terre.",
                  combat: { melee: 3 }, edge: ["toughness"] },
    furtivite:  { label: "Furtivité", blurb: "Se fait oublier ; échappe souvent à la meute.",
                  combat: { ambush: 4, flight: 2 }, edge: ["evadePack"] },
    piege:      { label: "Piégeur", blurb: "Collets, fosses, fils tendus : frappe sans se montrer.",
                  combat: { ambush: 6 }, edge: ["ambushInit"] },
    escalade:   { label: "Grimpeur", blurb: "Vit dans les arbres ; increvable en terrain accidenté.",
                  combat: { flight: 3 }, resist: { fall: 0.85, quake: 0.4, avalanche: 0.5, mutts: 0.3 } },
    nage:       { label: "Nageur", blurb: "L'eau est un allié, pas un piège.",
                  combat: { flight: 2 }, resist: { flood: 0.9, drown: 0.9 } },
    botanique:  { label: "Botaniste", blurb: "Connaît chaque plante — se nourrit, ne s'empoisonne pas.",
                  combat: { }, resist: { berries: 0.95, drought: 0.5, dehydration: 0.7 } },
    soin:       { label: "Guérisseur", blurb: "Soigne ses plaies et celles de ses alliés ; résiste au venin.",
                  combat: { }, resist: { infection: 0.8, tracker_jackers: 0.5 }, edge: ["selfHeal", "healAllies"] },
    endurance:  { label: "Endurance", blurb: "Tient quand les autres flanchent : la soif, le froid, la fatigue.",
                  combat: { environment: 3 }, resist: { cold_night: 0.6, drought: 0.6, heat_wave: 0.6, dehydration: 0.7, exhaustion: 0.7 } },
    pistage:    { label: "Pisteur", blurb: "Lit les traces ; trouve ses proies, évite les embuscades.",
                  combat: { hunt: 5 }, edge: ["antiAmbush"] },
    charisme:   { label: "Chouchou du Capitole", blurb: "Les sponsors l'adorent ; les parachutes pleuvent.",
                  combat: { }, edge: ["sponsorMagnet"] }
  };
  HG.SKILL_KEYS = Object.keys(HG.SKILLS);

  // --- Réserve de prénoms « Panem » (secours / inspiration) ------------
  HG.NAME_POOL = [
    "Aurel", "Basalt", "Cendre", "Dune", "Écho", "Ferro", "Gale", "Houx",
    "Indus", "Jasp", "Kova", "Lin", "Mica", "Nyx", "Orme", "Pyrite",
    "Quill", "Ronce", "Silex", "Tarn", "Ulve", "Vesce", "Wren", "Yara",
    "Brume", "Charbon", "Épi", "Fauve", "Givre", "Hale", "Ivoire", "Lie"
  ];

  // --- Emojis proposés pour personnaliser un tribut -------------------
  HG.EMOJI_CHOICES = [
    "🔥", "🏹", "🗡️", "🛡️", "🌿", "🐿️", "🦅", "🐝", "⚡", "💀",
    "🍞", "🐺", "🌙", "⭐", "🎯", "🥷", "👑", "🃏", "🩸", "🧨"
  ];

  // --- Types de cadeaux de sponsor -----------------------------------
  HG.GIFTS = [
    { key: "medoc",   label: "Fiole de médicament", blurb: "referme les blessures", heal: 2, bonus: { sur: 2 } },
    { key: "pain",    label: "Pain chaud du district", blurb: "rend des forces", heal: 1, bonus: { str: 1, sur: 1 } },
    { key: "lame",    label: "Couteau de lancer",   blurb: "de quoi frapper de loin", heal: 0, bonus: { str: 2, agi: 1 } },
    { key: "eau",     label: "Gourde d'eau pure",   blurb: "éloigne la déshydratation", heal: 1, bonus: { sur: 2, agi: 1 } },
    { key: "arc",     label: "Arc et carquois",     blurb: "l'arme des vainqueurs", heal: 0, bonus: { str: 2, agi: 2, cun: 1 } },
    { key: "filet",   label: "Filet lesté",         blurb: "spécialité du District 4", heal: 0, bonus: { agi: 2, cun: 2 } },
    { key: "couvert", label: "Couverture thermique", blurb: "survivre à la nuit", heal: 1, bonus: { sur: 3 } }
  ];

})(window.HG = window.HG || {});
