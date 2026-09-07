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

  HG.ui.register("home", function () {
    HG.ui.setPhase("home", { wipe: false });
    var rosters = HG.storage.listRosters();
    var history = HG.storage.listHistory();
    var mode = currentMode();

    // --- Sélecteur de mode ---
    var modeBox = el("div", { class: "frame tight stack-s", style: { maxWidth: "560px", margin: "0 auto" } });
    modeBox.appendChild(el("p", { class: "kicker", style: { margin: 0 }, text: "Mode de jeu" }));
    var modeRow = el("div", { class: "btn-group", style: { justifyContent: "center" } });
    ["simple", "advanced"].forEach(function (m) {
      var info = HG.GAME_MODES[m];
      var b = el("button", { class: mode === m ? "primary" : "", onclick: function () {
        setMode(m); HG.ui.go("home");
      }}, [info.label]);
      modeRow.appendChild(b);
    });
    modeBox.appendChild(modeRow);
    modeBox.appendChild(el("p", { class: "tiny muted", style: { margin: 0 }, text: HG.GAME_MODES[mode].blurb }));

    var importInput = el("input", { type: "file", accept: ".json,application/json", style: { display: "none" } });
    importInput.addEventListener("change", function () {
      var f = importInput.files && importInput.files[0];
      if (!f) return;
      HG.storage.importRosterFile(f, function (ok, msg) {
        if (ok) HG.flow.loadRoster(msg); else alert(msg);
      });
    });

    var loadBtn = el("button", { class: "big", disabled: rosters.length === 0,
      onclick: function () { openLoadDialog(rosters); } },
      [rosters.length ? "Charger un groupe (" + rosters.length + ")" : "Aucun groupe enregistré"]);
    var histBtn = el("button", { class: "ghost", disabled: history.length === 0,
      onclick: function () { openHistoryDialog(history); } },
      ["Palmarès des vainqueurs" + (history.length ? " (" + history.length + ")" : "")]);

    return el("div", { class: "stack center fade-in" }, [
      el("div", { class: "capitol-seal", role: "img", "aria-label": "Sceau du Capitole" }),
      el("p", { class: "kicker", text: "Retransmission officielle du Capitole" }),
      el("h1", { text: "Les Jeux de Panem" }),
      el("p", { class: "muted", style: { maxWidth: "60ch", margin: "0 auto" }, text:
        "Un jeu de soirée pour le salon, en hommage au film. Créez vos tributs, lancez la " +
        "Moisson, et suivez les 74ᵉ Hunger Games manche après manche : présentation, défilé, " +
        "plateau de Caesar, puis l'arène — événements des Juges, cérémonie des disparus, un vainqueur." }),

      modeBox,

      el("div", { class: "btn-group", style: { justifyContent: "center", marginTop: "1.4rem" } }, [
        el("button", { class: "primary big", onclick: function () {
          HG.audio.unlock(); if (HG.voice) HG.voice.resume(); HG.audio.confirm();
          HG.flow.newGame();
        }}, ["Créer les tributs"]),
        el("button", { class: "big", onclick: function () {
          HG.audio.unlock(); if (HG.voice) HG.voice.resume(); HG.audio.confirm();
          HG.flow.quickGame();
        }}, ["Jouer avec les tributs du film"]),
        loadBtn,
        el("button", { class: "ghost", onclick: function () { importInput.click(); } }, ["Importer un fichier de groupe"]),
        histBtn,
        importInput
      ]),

      el("p", { class: "tiny muted", style: { maxWidth: "62ch", margin: "1.2rem auto 0" }, text:
        "Pendant la partie, les messages défilent tout seuls : cliquez n'importe où sur " +
        "l'écran pour avancer, ⏸ pour mettre en pause (touche P). La barre du bas règle " +
        "la vitesse de lecture. Son / voix / plein écran : en bas à droite." }),

      el("hr", { class: "rule" }),
      el("p", { class: "tiny muted", style: { maxWidth: "58ch", margin: "0 auto" }, html:
        "<b>Vie privée —</b> tout se passe sur cet ordinateur. Les tributs, photos et " +
        "résultats sont enregistrés dans le navigateur (stockage local) et ne sont jamais " +
        "envoyés sur Internet." }),
      el("button", { class: "ghost tiny", style: { marginTop: "0.6rem" }, onclick: openWipeDialog },
        ["Effacer mes données locales"])
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
            " — " + HG.ui.escapeHtml(h.arena || "") + " · " + (h.days || "?") + " j · " + (h.kills || 0) + " élim." })
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
