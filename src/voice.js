/* =========================================================================
   voice.js — synthèse vocale (Web Speech API, intégrée au navigateur).
   Deux personnages : "caesar" (bonimenteur, aigu, vif) et "announcer"
   (l'annonceur des Jeux, grave et posé). Aucune voix distante.
   ========================================================================= */
(function (HG) {
  "use strict";

  var synth = window.speechSynthesis || null;
  var enabled = true;
  var voices = [];
  var picked = { fr: null };
  var queue = [];
  var speaking = false;

  function loadVoices() {
    if (!synth) return;
    voices = synth.getVoices() || [];
    var fr = voices.filter(function (v) { return /^fr(-|_|$)/i.test(v.lang); });
    // Caesar : une voix française, de préférence pas « Paul » (réservé à l'annonceur).
    var maleRe = /paul|thomas|nicolas|claude|henri|male|homme/i;
    picked.fr = fr.filter(function (v) { return !maleRe.test(v.name); })[0] || fr[0] || voices[0] || null;
    // Annonceur : une voix masculine distincte si possible.
    picked.fr2 = fr.filter(function (v) { return maleRe.test(v.name); })[0]
               || fr.filter(function (v) { return v !== picked.fr; })[0]
               || picked.fr;
  }

  if (synth) {
    loadVoices();
    if (typeof synth.onvoiceschanged !== "undefined") {
      synth.onvoiceschanged = loadVoices;
    }
  }

  // Profils : pitch / rate de base (le rate est ensuite modulé par la vitesse).
  var PROFILES = {
    caesar:    { pitch: 1.35, rate: 1.06, voiceKey: "fr" },
    announcer: { pitch: 0.7,  rate: 0.92, voiceKey: "fr2" },
    claudius:  { pitch: 0.8,  rate: 0.95, voiceKey: "fr2" }
  };

  function stripTags(html) {
    var d = document.createElement("div");
    d.innerHTML = String(html)
      .replace(/<sup>e<\/sup>/g, "e")
      .replace(/<br\s*\/?>/g, ". ");
    return (d.textContent || "").replace(/\s+/g, " ").trim();
  }

  function speedFactor() {
    // rythme de lecture calé sur le curseur de vitesse (lent → débit plus posé)
    if (HG.ui && HG.ui.speedFactor) {
      return HG._clamp ? HG._clamp(1.35 - HG.ui.speedFactor() * 0.45, 0.72, 1.15)
                       : Math.max(0.72, Math.min(1.15, 1.35 - HG.ui.speedFactor() * 0.45));
    }
    return 0.95;
  }

  function flush() {
    if (!synth || speaking) return;
    var item = queue.shift();
    if (!item) return;
    speaking = true;
    try {
      var u = new SpeechSynthesisUtterance(item.text);
      var prof = PROFILES[item.who] || PROFILES.caesar;
      var v = picked[prof.voiceKey] || picked.fr;
      if (v) u.voice = v;
      u.lang = (v && v.lang) || "fr-FR";
      u.pitch = prof.pitch;
      u.rate = Math.max(0.5, Math.min(1.6, prof.rate * speedFactor()));
      u.volume = 1;
      u.onend = u.onerror = function () {
        speaking = false;
        if (item.done) { try { item.done(); } catch (e) {} }
        flush();
      };
      synth.speak(u);
    } catch (e) {
      speaking = false;
      if (item.done) { try { item.done(); } catch (e2) {} }
      flush();
    }
  }

  var API = {
    isAvailable: function () { return !!synth && voices.length >= 0; },
    isEnabled: function () { return enabled && !!synth; },

    setEnabled: function (v) {
      enabled = !!v;
      if (!enabled && synth) synth.cancel();
      try { HG.storage.saveSettings({ voice: enabled }); } catch (e) {}
    },
    toggle: function () { API.setEnabled(!enabled); return API.isEnabled(); },

    listVoices: function () {
      return voices.map(function (v) { return { name: v.name, lang: v.lang }; });
    },

    // Choisit explicitement la voix principale par nom.
    useVoice: function (name) {
      var v = voices.filter(function (x) { return x.name === name; })[0];
      if (v) { picked.fr = v; try { HG.storage.saveSettings({ voiceName: name }); } catch (e) {} }
    },

    // speak(text, who, { onDone }) — met en file d'attente.
    speak: function (text, who, opts) {
      opts = opts || {};
      if (!enabled || !synth) { if (opts.onDone) setTimeout(opts.onDone, 0); return; }
      var clean = stripTags(text);
      if (!clean) { if (opts.onDone) setTimeout(opts.onDone, 0); return; }
      queue.push({ text: clean, who: who || "caesar", done: opts.onDone });
      flush();
    },

    cancel: function () {
      queue.length = 0;
      speaking = false;
      if (synth) synth.cancel();
    },

    // Certains navigateurs suspendent la synthèse ; à rappeler sur geste.
    resume: function () { if (synth && synth.paused) synth.resume(); }
  };

  // Restaure le réglage éventuel.
  try {
    var st = HG.storage.getSettings();
    if (st.voice === false) enabled = false;
    if (st.voiceName) setTimeout(function () { API.useVoice(st.voiceName); }, 300);
  } catch (e) {}

  HG.voice = API;

})(window.HG = window.HG || {});
