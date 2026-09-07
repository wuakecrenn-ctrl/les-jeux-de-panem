/* =========================================================================
   screens/roster.js — « La Moisson » : incarner un tribut (nom, photo,
   emblème, et en mode Avancé : 2 compétences). Sauvegarde locale du groupe.
   ========================================================================= */
(function (HG) {
  "use strict";
  var el = HG.ui.el;

  var claims = {};        // slotId -> { name, photo, emoji, skills }
  var rosterName = "";

  HG.rosterModule = {
    load: function (preset, name) {
      claims = {};
      if (preset) {
        (preset.tributes || preset).forEach(function (c) {
          claims[c.slotId || c.id] = {
            name: c.name, photo: c.photo || null,
            emoji: c.emoji || null, skills: c.skills || []
          };
        });
      }
      rosterName = name || "";
    }
  };

  function isAdvanced() { return (HG.storage.getSettings().mode === "advanced"); }

  HG.ui.register("roster", function () {
    HG.ui.setPhase("reaping");
    var root = el("div", { class: "stack fade-in" });

    root.appendChild(el("p", { class: "kicker", text: "Cérémonie de la Moisson · 74ᵉ Hunger Games" }));
    root.appendChild(el("h1", { text: "La Moisson" }));

    root.appendChild(el("div", { class: "privacy-note", html:
      "<b>Vos personnages restent chez vous.</b> Les noms et les photos importées sont " +
      "enregistrés uniquement dans ce navigateur, sur cet ordinateur. Aucun envoi vers Internet." }));

    root.appendChild(el("p", { class: "muted", html:
      "Cliquez sur une place de tribut pour l'<b>incarner</b> : donnez-lui le nom d'un membre du salon" +
      (isAdvanced() ? " et choisissez ses 2 compétences" : "") +
      ". Les places libres seront tenues par les tributs du film." }));

    root.appendChild(el("div", { class: "row" }, [
      el("span", { class: "count-pill", html: "Tributs incarnés <b>" + countClaims() + "</b> / 24" }),
      el("span", { class: "count-pill", html: "Mode <b>" + (isAdvanced() ? "Avancé" : "Simple") + "</b>" })
    ]));

    var grid = el("div", { class: "grid reaping" });
    for (var d = 1; d <= 12; d++) grid.appendChild(districtRow(d, refresh));
    root.appendChild(grid);

    // --- Sauvegarde du groupe ---
    var nameInput = el("input", { type: "text", value: rosterName, placeholder: "ex. Soirée du samedi", maxlength: "40" });
    nameInput.addEventListener("input", function () { rosterName = nameInput.value; });
    var saveMsg = el("div", { class: "tiny muted", style: { display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" } });

    function renderSaveMsg(text, savedName) {
      HG.ui.clear(saveMsg);
      saveMsg.appendChild(el("span", { text: text }));
      if (savedName) {
        saveMsg.appendChild(el("button", { class: "ghost tiny", onclick: function () { HG.storage.exportRoster(savedName); } }, ["Exporter le fichier"]));
        saveMsg.appendChild(el("span", { class: "tiny", text: "→ à déposer sur le Bureau" }));
      }
    }

    root.appendChild(el("div", { class: "frame tight stack-s", style: { marginTop: "1rem" } }, [
      el("div", { class: "row between" }, [
        el("label", { class: "field grow", style: { maxWidth: "320px" } }, [
          el("span", { text: "Nom de ce groupe (pour le retrouver plus tard)" }), nameInput
        ]),
        el("button", { class: "ghost", onclick: function () {
          if (!rosterName.trim()) { renderSaveMsg("Donnez d'abord un nom au groupe."); return; }
          if (countClaims() === 0) { renderSaveMsg("Incarnez au moins un tribut avant d'enregistrer."); return; }
          var ok = HG.storage.saveRoster(rosterName.trim(), serializeClaims());
          renderSaveMsg(ok ? "Groupe « " + rosterName.trim() + " » enregistré sur cet ordinateur (stockage du navigateur)."
                           : "Échec de l'enregistrement (stockage plein ou indisponible).",
            ok ? rosterName.trim() : null);
        }}, ["Sauvegarder ce groupe"])
      ]),
      saveMsg,
      el("p", { class: "tiny muted", text: countClaims() === 0
        ? "Aucun tribut incarné : la partie se jouera avec les 24 tributs du film."
        : countClaims() + " joueur(s) dans l'arène. Les " + (24 - countClaims()) + " autres places sont tenues par les tributs du film." })
    ]));

    HG.ui.setActions({
      back: { label: "Accueil", onClick: function () { HG.flow.home(); } },
      next: { label: "Lancer la Moisson", prominent: true, onClick: function () {
        HG.audio.unlock(); if (HG.voice) HG.voice.resume(); HG.audio.gong();
        HG.flow.confirmRoster(serializeClaims(), rosterName.trim());
      }}
    });

    return root;
    function refresh() { HG.ui.go("roster"); }
  });

  function districtRow(d, refresh) {
    var info = HG.DISTRICTS[d];
    var slots = HG.CANONICAL.filter(function (c) { return c.district === d; });
    return el("div", { class: "district-row d" + d }, [
      el("h3", { text: info.name + (info.career ? " · Carrière" : "") }),
      el("div", { class: "industry", text: info.industry }),
      el("div", { class: "slot-pair" }, slots.map(function (c) { return slotButton(c, refresh); }))
    ]);
  }

  function slotButton(c, refresh) {
    var claim = claims[c.id];
    var mini;
    if (claim && claim.photo) {
      mini = el("div", { class: "mini", style: { backgroundImage: 'url("' + claim.photo + '")', backgroundSize: "cover", backgroundPosition: "center" } });
    } else if (claim && claim.emoji) {
      mini = el("div", { class: "mini emoji", text: claim.emoji });
    } else {
      mini = el("img", { class: "mini", src: HG.portraitPath(c.id), alt: "" });
    }
    var role = (c.sex === "m" ? "Garçon" : "Fille");
    if (claim) {
      role += " · " + c.name;
      if (isAdvanced() && claim.skills && claim.skills.length) {
        role = (claim.skills.map(function (k) { return HG.SKILLS[k] ? HG.SKILLS[k].label : k; }).join(" · "));
      }
    } else if (c.canon) role += " · tribut du film";

    return el("button", { class: "slot" + (claim ? " claimed" : ""), onclick: function () { openClaimDialog(c, refresh); } }, [
      mini,
      el("div", {}, [
        el("div", { class: "slot-name", text: claim ? claim.name : c.name }),
        el("div", { class: "slot-role", text: role })
      ])
    ]);
  }

  // ---- Fenêtre de revendication ---------------------------------
  function openClaimDialog(c, refresh) {
    var existing = claims[c.id] || {};
    var draft = {
      name: existing.name || "",
      photo: existing.photo || null,
      emoji: existing.emoji || null,
      skills: (existing.skills || []).slice()
    };

    var nameInput = el("input", { type: "text", value: draft.name, maxlength: "22", placeholder: "Nom du joueur (ex. Léa)" });

    // photo
    var photoPreview = el("div", { class: "opt", hidden: !draft.photo,
      style: draft.photo ? { backgroundImage: 'url("' + draft.photo + '")', backgroundSize: "cover", backgroundPosition: "center" } : {} });
    var portraitDefault = el("img", { class: "opt" + (draft.photo ? "" : " sel"), src: HG.portraitPath(c.id), alt: "" });
    portraitDefault.addEventListener("click", function () {
      draft.photo = null; photoPreview.hidden = true; photoPreview.style.backgroundImage = "";
      portraitDefault.classList.add("sel");
    });
    var picker = el("div", { class: "avatar-picker" }, [portraitDefault, photoPreview]);

    var fileInput = el("input", { type: "file", accept: "image/*" });
    fileInput.addEventListener("change", function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        HG.storage.compressImage(reader.result, 320, function (small) {
          draft.photo = small;
          photoPreview.hidden = false;
          photoPreview.style.backgroundImage = 'url("' + small + '")';
          photoPreview.style.backgroundSize = "cover";
          photoPreview.style.backgroundPosition = "center";
          photoPreview.classList.add("sel");
          portraitDefault.classList.remove("sel");
        });
      };
      reader.readAsDataURL(f);
    });

    // emoji
    var emojiRow = el("div", { class: "emoji-row" });
    HG.EMOJI_CHOICES.forEach(function (e) {
      var b = el("button", { class: draft.emoji === e ? "sel" : "", text: e, type: "button" });
      b.addEventListener("click", function () {
        draft.emoji = draft.emoji === e ? null : e;
        emojiRow.querySelectorAll("button").forEach(function (x) { x.classList.remove("sel"); });
        if (draft.emoji) b.classList.add("sel");
      });
      emojiRow.appendChild(b);
    });

    // compétences (mode avancé)
    var skillField = null;
    if (isAdvanced()) {
      var skillPick = el("div", { class: "skill-pick" });
      var skillNote = el("p", { class: "tiny muted", style: { margin: 0 } });
      function paintSkillNote() {
        skillNote.textContent = draft.skills.length + " / 2 compétence(s). " +
          (draft.skills.length < 2 ? "Sans choix, 2 seront attribuées automatiquement." : "");
      }
      HG.SKILL_KEYS.forEach(function (k) {
        var s = HG.SKILLS[k];
        var b = el("button", { type: "button", class: draft.skills.indexOf(k) !== -1 ? "sel" : "" }, [
          el("span", { class: "sk-lab", text: s.label }),
          el("span", { class: "sk-blurb", text: s.blurb })
        ]);
        b.addEventListener("click", function () {
          var i = draft.skills.indexOf(k);
          if (i !== -1) draft.skills.splice(i, 1);
          else if (draft.skills.length < 2) draft.skills.push(k);
          skillPick.querySelectorAll("button").forEach(function (x) {
            x.classList.toggle("sel", draft.skills.indexOf(x.__k) !== -1);
          });
          paintSkillNote();
        });
        b.__k = k;
        skillPick.appendChild(b);
      });
      paintSkillNote();
      skillField = el("label", { class: "field" }, [ el("span", { text: "Compétences (2)" }), skillNote, skillPick ]);
    }

    var body = el("div", { class: "stack" }, [
      el("p", { class: "kicker", text: HG.DISTRICTS[c.district].name + " · " + HG.DISTRICTS[c.district].industry +
        " · " + (c.sex === "m" ? "tribut masculin" : "tribut féminin") }),
      el("h2", { html: "Incarner <span style='text-transform:none'>" + c.name + "</span>" }),
      el("p", { class: "tiny muted", text: "Le portrait du film est conservé — c'est ce qui est drôle avec le prénom d'un ami dessus." }),

      el("label", { class: "field" }, [ el("span", { text: "Nom du joueur" }), nameInput ]),
      el("label", { class: "field" }, [ el("span", { text: "Photo (facultative — reste sur cet ordinateur)" }), picker, fileInput ]),
      el("label", { class: "field" }, [ el("span", { text: "Emblème (facultatif)" }), emojiRow ]),
      skillField,

      el("div", { class: "row between", style: { marginTop: "0.6rem" } }, [
        el("div", { class: "row" }, [
          el("button", { class: "primary", onclick: function () {
            var nm = nameInput.value.trim();
            if (!nm) { nameInput.focus(); nameInput.style.borderColor = "var(--red)"; return; }
            claims[c.id] = { name: nm, photo: draft.photo || null, emoji: draft.emoji || null, skills: draft.skills.slice() };
            HG.audio.click(); HG.ui.closeModal(); refresh();
          }}, ["Incarner ce tribut"]),
          existing.name ? el("button", { class: "danger", onclick: function () {
            delete claims[c.id]; HG.ui.closeModal(); refresh();
          }}, ["Libérer la place"]) : null
        ]),
        el("button", { class: "ghost", onclick: HG.ui.closeModal }, ["Annuler"])
      ])
    ]);

    HG.ui.openModal(body);
    setTimeout(function () { nameInput.focus(); }, 50);
  }

  function countClaims() { return Object.keys(claims).length; }
  function serializeClaims() {
    return Object.keys(claims).map(function (id) {
      return { slotId: id, name: claims[id].name, photo: claims[id].photo || null,
               emoji: claims[id].emoji || null, skills: claims[id].skills || [] };
    });
  }
  HG.rosterClaimsMap = function () { return claims; };

})(window.HG = window.HG || {});
