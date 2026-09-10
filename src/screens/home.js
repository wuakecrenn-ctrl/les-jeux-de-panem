/* =========================================================================
   screens/home.js — écran d'accueil (choix du mode, lancement, groupes).
   ========================================================================= */
(function (HG) {
  "use strict";
  var el = HG.ui.el;

  function currentMode() {
    try { return HG.storage.getSettings().mode === "advanced" ? "advanced" : "simple"; }
    catch (e) { return "simple"; }
  }
  function setMode(m) { try { HG.storage.saveSettings({ mode: m }); } catch (e) {} }

  // Couche d'ambiance — UNIQUEMENT sur l'accueil : projecteurs du Capitole,
  // grain de retransmission, poussière d'or. Tout est décoratif (aria-hidden)
  // et se coupe si le système demande moins d'animations.
  function atmosphere() {
    var motes = el("div", { class: "fx-motes" });
    for (var i = 0; i < 14; i++) {
      motes.appendChild(el("i", { style: {
        left: (3 + i * 7 + (i % 3) * 2) + "%",
        animationDelay: (-i * 1.7).toFixed(1) + "s",
        animationDuration: (13 + (i % 5) * 3.5).toFixed(1) + "s"
      }}));
    }
    return el("div", { class: "home-fx", "aria-hidden": "true" }, [
      el("div", { class: "fx-beams" }),
      el("div", { class: "fx-vignette" }),
      el("div", { class: "fx-scan" }),
      motes
    ]);
  }

  function btnCard(cls, label, sub, onClick) {
    return el("button", { class: "btn-card " + cls, onclick: onClick }, [
      el("span", { class: "bc-label", text: label }),
      el("span", { class: "bc-sub", text: sub })
    ]);
  }

  HG.ui.register("home", function () {
    HG.ui.setPhase("home", { wipe: false });
    var rosters = HG.storage.listRosters();
    var history = HG.storage.listHistory();
    var mode = currentMode();

    // --- Sélecteur de mode : segmenté, compact ---
    var modeRow = el("div", { class: "seg", role: "group", "aria-label": "Mode de jeu" });
    ["simple", "advanced"].forEach(function (m) {
      var info = HG.GAME_MODES[m];
      modeRow.appendChild(el("button", { class: mode === m ? "on" : "", onclick: function () {
        setMode(m); HG.ui.go("home");
      }}, [info.label]));
    });
    var modeBox = el("div", { class: "mode-box" }, [
      el("p", { class: "kicker", style: { margin: 0 }, text: "Mode de jeu" }),
      modeRow,
      el("p", { class: "tiny muted", style: { margin: 0 }, text: HG.GAME_MODES[mode].blurb })
    ]);

    var importInput = el("input", { type: "file", accept: ".json,application/json", style: { display: "none" } });
    importInput.addEventListener("change", function () {
      var f = importInput.files && importInput.files[0];
      if (!f) return;
      HG.storage.importRosterFile(f, function (ok, msg) {
        if (ok) HG.flow.loadRoster(msg); else alert(msg);
      });
    });

    function start(fn) {
      HG.audio.unlock(); if (HG.voice) HG.voice.resume(); HG.audio.confirm(); fn();
    }

    // --- Deux façons de lancer : mises en avant à égalité ---
    var startRow = el("div", { class: "start-row" }, [
      btnCard("primary", "Créer les tributs", "Le salon entre dans l'arène : un nom, une photo, un district.",
        function () { start(HG.flow.newGame); }),
      btnCard("", "Jouer avec les tributs du film", "Les 24 tributs d'origine, directement à la Moisson.",
        function () { start(HG.flow.quickGame); })
    ]);

    // --- Charger un groupe déjà enregistré : bouton large et bien visible ---
    var loadRow = rosters.length
      ? el("button", { class: "load-btn big", onclick: function () { openLoadDialog(rosters); } },
          ["Charger un groupe enregistré (" + rosters.length + ")"])
      : null;

    // --- Autres archives : discret, sur une ligne ---
    var libRow = el("div", { class: "lib-row" }, [
      rosters.length ? null
        : el("button", { class: "ghost", disabled: true }, ["Aucun groupe enregistré"]),
      el("button", { class: "ghost", onclick: function () { importInput.click(); } }, ["Importer un fichier…"]),
      el("button", { class: "ghost", disabled: history.length === 0,
        onclick: function () { openHistoryDialog(history); } },
        ["Palmarès" + (history.length ? " (" + history.length + ")" : "")]),
      importInput
    ]);

    return el("div", { class: "home" }, [
      atmosphere(),

      el("div", { class: "home-hero fade-in" }, [
        el("div", { class: "capitol-seal", role: "img", "aria-label": "Sceau du Capitole" }),
        el("p", { class: "kicker live", text: "Retransmission officielle du Capitole" }),
        el("h1", { class: "home-title", text: "Hunger Games" }),
        el("p", { class: "home-sub", text:
          "Un jeu de soirée pour le salon, en hommage au film. Créez vos tributs, " +
          "lancez la Moisson, et suivez les 74ᵉ Hunger Games manche après manche." }),
        el("p", { class: "home-steps", html:
          "<span>Présentation</span><span>Défilé</span><span>Plateau de Caesar</span>" +
          "<span>L'arène</span><span>Les disparus</span><span>Un vainqueur</span>" })
      ]),

      el("div", { class: "home-panel fade-in" }, [ modeBox, startRow, loadRow, libRow ]),

      el("div", { class: "home-foot" }, [
        el("div", { class: "hf-col" }, [
          el("p", { class: "hf-title", text: "Pendant la partie" }),
          el("p", { class: "tiny muted", text:
            "Les messages défilent tout seuls : cliquez n'importe où pour avancer, " +
            "⏸ ou la touche P pour mettre en pause. La barre du bas règle la vitesse ; " +
            "son, voix et plein écran sont en bas à droite." })
        ]),
        el("div", { class: "hf-col" }, [
          el("p", { class: "hf-title", text: "Vie privée" }),
          el("p", { class: "tiny muted", text:
            "Tout se passe sur cet ordinateur. Les tributs, photos et résultats sont " +
            "enregistrés dans le navigateur (stockage local) et ne sont jamais envoyés " +
            "sur Internet." }),
          el("button", { class: "ghost tiny", onclick: openWipeDialog }, ["Effacer mes données locales"])
        ])
      ])
    ]);
  });

  function openLoadDialog(rosters) {
    var list = el("div", { class: "stack-s" }, rosters.map(function (r) {
      return el("div", { class: "row between", style: { borderBottom: "1px solid var(--line)", paddingBottom: "0.5rem" } }, [
        el("div", {}, [
          el("div", { text: r.name, style: { color: "var(--accent-hi)" } }),
          el("div", { class: "tiny muted", text: r.tributes.length + " tribut(s) · " + new Date(r.savedAt).toLocaleDateString() })
        ]),
        el("div", { class: "row" }, [
          el("button", { class: "primary", onclick: function () { HG.ui.closeModal(); HG.flow.loadRoster(r.name); } }, ["Jouer"]),
          el("button", { class: "ghost tiny", onclick: function () { HG.storage.exportRoster(r.name); } }, ["Exporter"]),
          el("button", { class: "danger tiny", onclick: function () { HG.storage.deleteRoster(r.name); HG.ui.closeModal(); HG.ui.go("home"); } }, ["Suppr."])
        ])
      ]);
    }));
    HG.ui.openModal(el("div", { class: "stack" }, [
      el("h2", { text: "Charger un groupe" }),
      list,
      el("p", { class: "tiny muted", text: "« Exporter » télécharge un fichier .json que vous pouvez déposer sur le Bureau et recharger via « Importer un fichier de groupe »." }),
      el("button", { class: "ghost", onclick: HG.ui.closeModal }, ["Fermer"])
    ]));
  }

  function openHistoryDialog(history) {
    HG.ui.openModal(el("div", { class: "stack" }, [
      el("h2", { text: "Palmarès des vainqueurs" }),
      el("div", { class: "recap-list" }, history.map(function (h) {
        return el("div", { class: "r" }, [
          el("span", { class: "rd", text: "D" + h.district }),
          el("span", { html: "<b>" + HG.ui.escapeHtml(h.name) + "</b>" +
            (h.dual ? " &amp; " + HG.ui.escapeHtml(h.coName || "?") : "") +
            " — " + (h.days || "?") + " j · " + (h.kills || 0) + " élim." })
        ]);
      })),
      el("button", { class: "ghost", onclick: HG.ui.closeModal }, ["Fermer"])
    ]));
  }

  function openWipeDialog() {
    HG.ui.openModal(el("div", { class: "stack" }, [
      el("h2", { text: "Effacer les données locales" }),
      el("p", { class: "muted", text: "Cela supprime définitivement les groupes enregistrés, le palmarès et les réglages, sur cet ordinateur uniquement. Continuer ?" }),
      el("div", { class: "row" }, [
        el("button", { class: "danger", onclick: function () { HG.storage.wipe(); HG.ui.closeModal(); HG.ui.go("home"); } }, ["Tout effacer"]),
        el("button", { class: "ghost", onclick: HG.ui.closeModal }, ["Annuler"])
      ])
    ]));
  }

})(window.HG = window.HG || {});
