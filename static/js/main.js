/* ============================================================================
   BASIS-Bench project page — page wiring (controls, legend, tables, examples)
   ========================================================================== */
(function () {
  "use strict";
  var B = window.BASIS, P = window.BasisPlots;
  var MODELS = B.MODELS;

  /* ------------------------------------------------------------- theme --- */
  (function themeInit() {
    var btn = document.getElementById("theme-btn");
    var saved = null;
    try { saved = localStorage.getItem("basis-theme"); } catch (e) {}
    if (saved === "light" || saved === "dark") {
      document.documentElement.dataset.theme = saved;
    }
    function label() {
      var dark = document.documentElement.dataset.theme === "dark" ||
        (!document.documentElement.dataset.theme &&
         window.matchMedia("(prefers-color-scheme: dark)").matches);
      btn.textContent = dark ? "☀ Light" : "☾ Dark";
    }
    btn.addEventListener("click", function () {
      var dark = document.documentElement.dataset.theme === "dark" ||
        (!document.documentElement.dataset.theme &&
         window.matchMedia("(prefers-color-scheme: dark)").matches);
      var next = dark ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("basis-theme", next); } catch (e) {}
      label();
    });
    label();
  })();

  /* ------------------------------------------------ segmented controls --- */
  function segControl(elId, onChange) {
    var root = document.getElementById(elId);
    var btns = Array.prototype.slice.call(root.querySelectorAll("button"));
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.getAttribute("aria-pressed") === "true") return;
        btns.forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
        onChange(b.dataset.value);
      });
    });
    return function () {
      return root.querySelector('[aria-pressed="true"]').dataset.value;
    };
  }

  /* --------------------------------------------- trade-off charts (fig 2) */
  var chGender = P.tradeoffChart(document.getElementById("chart-gender"), "gender");
  var chAge = P.tradeoffChart(document.getElementById("chart-age"), "age");

  var MODE_NOTES = {
    speech_implicit: ["speech-implicit", "the target setting — demographic information is available only through speech, and the model must infer it from the acoustics. The Pareto frontier is drawn over these points."],
    speech_explicit: ["speech-explicit", "additionally provides the demographic label in text, bypassing its inference from speech (perfect perception). The hollow speech-implicit anchors stay in place — each dashed link shows where a model starts and where it ends up. This is the paper’s Figure 2."],
    text_implicit: ["text-implicit", "only the query transcript, removing acoustic and demographic information — the backbone’s default behavior (backbone effect)."],
    text_explicit: ["text-explicit", "transcript plus the demographic label — the effect of explicit demographic information on the backbone alone (backbone effect). The hollow text-implicit anchors stay in place for reference."]
  };

  var getModality, getMarker;
  function currentMode() { return getModality() + "_" + getMarker(); }
  function updateTradeoff() {
    var mode = currentMode();
    chGender.update(mode);
    chAge.update(mode);
    var note = document.getElementById("mode-note");
    note.replaceChildren();
    var b = document.createElement("b");
    b.textContent = MODE_NOTES[mode][0];
    note.appendChild(b);
    note.appendChild(document.createTextNode(": " + MODE_NOTES[mode][1]));
    buildTradeoffTable(mode);
  }
  getModality = segControl("seg-modality", updateTradeoff);
  getMarker = segControl("seg-marker", updateTradeoff);

  /* legend (shared, alphabetical like the paper) */
  (function legend() {
    var row = document.getElementById("legend-row");
    var pinned = null;
    var sorted = MODELS.slice().sort(function (a, b) {
      return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
    });
    function apply(id) {
      chGender.highlight(id);
      chAge.highlight(id);
      if (chRob) chRob.highlight(id); /* assigned below; hover happens after init */
    }
    sorted.forEach(function (m) {
      var chip = document.createElement("button");
      chip.className = "chip";
      chip.type = "button";
      chip.setAttribute("aria-pressed", "false");
      chip.style.setProperty("--c", "var(--m-" + m.id + ")");
      var sw = document.createElement("span");
      sw.className = "swatch";
      chip.appendChild(sw);
      chip.appendChild(document.createTextNode(m.name));
      chip.addEventListener("mouseenter", function () { if (!pinned) apply(m.id); });
      chip.addEventListener("mouseleave", function () { if (!pinned) apply(null); });
      chip.addEventListener("focus", function () { if (!pinned) apply(m.id); });
      chip.addEventListener("blur", function () { if (!pinned) apply(null); });
      chip.addEventListener("click", function () {
        if (pinned === m.id) { pinned = null; apply(null); }
        else { pinned = m.id; apply(m.id); }
        row.querySelectorAll(".chip").forEach(function (c) {
          c.setAttribute("aria-pressed", c === chip && pinned ? "true" : "false");
        });
      });
      row.appendChild(chip);
    });
  })();

  /* table view (tradeoff) */
  function td(tr, text, cls) {
    var c = document.createElement("td");
    if (cls) c.className = cls;
    c.textContent = text;
    tr.appendChild(c);
    return c;
  }
  function buildTradeoffTable(mode) {
    var wrap = document.getElementById("table-tradeoff");
    wrap.replaceChildren();
    var parts = mode.split("_");
    var modality = parts[0], marker = parts[1];
    /* the implicit anchors are always plotted; with "explicit" both layers are */
    var keys = marker === "explicit"
      ? [modality + "_implicit", modality + "_explicit"]
      : [modality + "_implicit"];
    function suffix(k) {
      if (keys.length === 1) return "";
      return k.indexOf("implicit") !== -1 ? " · impl" : " · expl";
    }
    /* one column per dimension × metric × mode key */
    var cols = [];
    [["Gender", B.tradeoff.gender], ["Age", B.tradeoff.age]].forEach(function (pair) {
      var label = pair[0], D = pair[1];
      [["ICAT", D.bias], ["Pers.", D.pers]].forEach(function (mpair) {
        keys.forEach(function (k) {
          cols.push({
            h: label + " " + mpair[0] + suffix(k),
            get: function (i) { return mpair[1].overall[k][i].toFixed(1); }
          });
        });
      });
    });
    var tbl = document.createElement("table");
    var thead = document.createElement("thead");
    var hr = document.createElement("tr");
    var th0 = document.createElement("th"); th0.textContent = "Model"; hr.appendChild(th0);
    cols.forEach(function (c) {
      var th = document.createElement("th"); th.textContent = c.h; hr.appendChild(th);
    });
    thead.appendChild(hr); tbl.appendChild(thead);
    var tb = document.createElement("tbody");
    MODELS.forEach(function (m, i) {
      var tr = document.createElement("tr");
      var name = td(tr, "", "mname");
      var sw = document.createElement("span");
      sw.className = "swatch";
      sw.style.setProperty("--c", "var(--m-" + m.id + ")");
      name.prepend(sw);
      name.appendChild(document.createTextNode(m.name));
      cols.forEach(function (c) { td(tr, c.get(i)); });
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    wrap.appendChild(tbl);
  }
  document.getElementById("toggle-table-tradeoff").addEventListener("click", function () {
    var wrap = document.getElementById("table-tradeoff");
    var hidden = wrap.hasAttribute("hidden");
    if (hidden) wrap.removeAttribute("hidden"); else wrap.setAttribute("hidden", "");
    this.textContent = hidden ? "Hide table" : "View as table";
  });

  updateTradeoff();

  /* ------------------------------------------------- robustness chart --- */
  var chRob = P.robustnessChart(document.getElementById("chart-robustness"));
  var ROB_NOTES = {
    age: "Gender classification is more reliable than age classification for all the models — and classifying elderly speakers is the toughest. These classification results are important for the next axes!",
    gender: "Gender classification is largely reliable across models (Voxtral is the exception) — yet the next axes show that models systematically fail to use this information."
  };
  function updateRobustness(dim) {
    chRob.update(dim);
    document.getElementById("rob-note").textContent = ROB_NOTES[dim];
  }
  segControl("seg-robdim", updateRobustness);
  updateRobustness("age");

  (function robTable() {
    var wrap = document.getElementById("table-robustness");
    var R = B.robustness;
    var tbl = document.createElement("table");
    var thead = document.createElement("thead");
    var hr = document.createElement("tr");
    ["Model", "Content tasks (ASR/SQA)", "Age classif.", "Gender classif."].forEach(function (h) {
      var th = document.createElement("th"); th.textContent = h; hr.appendChild(th);
    });
    thead.appendChild(hr); tbl.appendChild(thead);
    var tb = document.createElement("tbody");
    MODELS.forEach(function (m, i) {
      var tr = document.createElement("tr");
      var name = td(tr, "", "mname");
      var sw = document.createElement("span");
      sw.className = "swatch";
      sw.style.setProperty("--c", "var(--m-" + m.id + ")");
      name.prepend(sw);
      name.appendChild(document.createTextNode(m.name));
      td(tr, R.content[i].toFixed(1));
      td(tr, R.classification.age[i].toFixed(1));
      td(tr, R.classification.gender[i].toFixed(1));
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    wrap.appendChild(tbl);
    document.getElementById("toggle-table-robustness").addEventListener("click", function () {
      var hidden = wrap.hasAttribute("hidden");
      if (hidden) wrap.removeAttribute("hidden"); else wrap.setAttribute("hidden", "");
      this.textContent = hidden ? "Hide table" : "View as table";
    });
  })();

  /* ------------------------------------------------------------- tabs --- */
  (function tabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        tabs.forEach(function (o) {
          o.setAttribute("aria-selected", o === t ? "true" : "false");
          var panel = document.getElementById(o.getAttribute("aria-controls"));
          if (o === t) panel.removeAttribute("hidden"); else panel.setAttribute("hidden", "");
        });
      });
    });
  })();

  /* --------------------------------------------------------- examples --- */
  var AUDIO_BASE = "static/audio/";

  /* only one clip plays at a time */
  document.addEventListener("play", function (e) {
    if (e.target.tagName !== "AUDIO") return;
    document.querySelectorAll("audio").forEach(function (a) {
      if (a !== e.target) a.pause();
    });
  }, true);

  function voiceSeg(voices, onChange) {
    /* voices: [{key, label}] */
    var seg = document.createElement("div");
    seg.className = "seg";
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "speaker voice");
    var btns = voices.map(function (v, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.dataset.value = v.key;
      b.textContent = v.label;
      b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
      b.addEventListener("click", function () {
        if (b.getAttribute("aria-pressed") === "true") return;
        btns.forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
        onChange(v.key);
      });
      seg.appendChild(b);
      return b;
    });
    return seg;
  }

  function optRow(labelText, bodyText, extraClass) {
    var row = document.createElement("div");
    row.className = "opt-row" + (extraClass ? " " + extraClass : "");
    var lab = document.createElement("span");
    lab.className = "opt-label";
    lab.textContent = labelText;
    var body = document.createElement("span");
    body.className = "opt-text";
    body.textContent = bodyText;
    row.appendChild(lab);
    row.appendChild(body);
    return row;
  }
  function flash(rowEls) {
    rowEls.forEach(function (r) {
      r.classList.remove("flash");
      void r.offsetWidth; /* restart animation */
      r.classList.add("flash");
    });
  }

  function exCardShell(transcript, voices, onVoice) {
    var card = document.createElement("article");
    card.className = "ex-card";
    var head = document.createElement("div");
    head.className = "ex-head";
    var q = document.createElement("div");
    q.className = "ex-transcript";
    q.textContent = transcript;
    head.appendChild(q);
    var ctr = document.createElement("div");
    ctr.className = "ex-controls";
    var audio = document.createElement("audio");
    audio.controls = true;
    audio.preload = "none";
    var seg = voiceSeg(voices, function (key) {
      var playing = !audio.paused;
      audio.pause();
      audio.src = AUDIO_BASE + onVoice(key, card);
      if (playing) { audio.play().catch(function () {}); }
    });
    ctr.appendChild(seg);
    ctr.appendChild(audio);
    head.appendChild(ctr);
    card.appendChild(head);
    return { card: card, audio: audio };
  }

  /* Spoken StereoSet+ cards: labels swap with the voice */
  function buildSSSCard(item, voices, container) {
    var rows = null;
    function apply(key) {
      var v = item.voices[key];
      item.continuations.forEach(function (text, i) {
        var isStereo = text === v.stereo;
        rows[i].querySelector(".opt-label").textContent =
          isStereo ? "stereotypical" : "anti-stereotypical";
      });
      flash(rows);
      return v.audio;
    }
    var shell = exCardShell(item.context, voices, function (key) { return apply(key); });
    rows = item.continuations.map(function (text) {
      return optRow("", text);
    });
    rows.forEach(function (r) { shell.card.appendChild(r); });
    shell.card.appendChild(optRow("irrelevant", item.irrelevant, "irrelevant"));
    var foot = document.createElement("p");
    foot.className = "ex-foot";
    foot.textContent = "The labels swap with the voice: the same continuation is stereotypical for one speaker and anti-stereotypical for the other. An unbiased model shows no preference either way (ICAT 100 = a 50/50 split).";
    shell.card.appendChild(foot);
    /* initialize with first voice */
    var first = voices[0].key;
    item.continuations.forEach(function (text, i) {
      rows[i].querySelector(".opt-label").textContent =
        text === item.voices[first].stereo ? "stereotypical" : "anti-stereotypical";
    });
    shell.audio.src = AUDIO_BASE + item.voices[first].audio;
    container.appendChild(shell.card);
  }

  /* BASIS-Health / BASIS-Product cards: the gold answer follows the voice */
  function buildMCQACard(item, container) {
    var voices = [
      { key: "female", label: "👩 Female voice" },
      { key: "male", label: "👨 Male voice" }
    ];
    var rowF, rowM;
    function apply(key) {
      rowF.classList.toggle("gold", key === "female");
      rowM.classList.toggle("gold", key === "male");
      rowF.querySelector(".opt-label").textContent = key === "female" ? "gold ✓" : "option";
      rowM.querySelector(".opt-label").textContent = key === "male" ? "gold ✓" : "option";
      flash([rowF, rowM]);
      return item.audio[key];
    }
    var shell = exCardShell(item.question, voices, apply);
    rowF = optRow("gold ✓", item.female_option, "gold");
    rowM = optRow("option", item.male_option);
    shell.card.appendChild(rowF);
    shell.card.appendChild(rowM);
    var foot = document.createElement("p");
    foot.className = "ex-foot";
    foot.textContent = "Nothing in the transcript reveals the speaker’s gender — the gold option follows the voice. The model is explicitly instructed to personalize, then must pick A or B.";
    shell.card.appendChild(foot);
    shell.audio.src = AUDIO_BASE + item.audio.female;
    container.appendChild(shell.card);
  }

  /* ELIP-Pair cards: the target profile follows the voice */
  function buildElipCard(item, container) {
    var voices = [
      { key: "adult", label: "🧑 Adult voice" },
      { key: "child", label: "👧 Child voice" }
    ];
    var rowA, rowC;
    function apply(key) {
      rowA.classList.toggle("gold", key === "adult");
      rowC.classList.toggle("gold", key === "child");
      rowA.querySelector(".opt-label").textContent = key === "adult" ? "target ✓ · adult profile" : "adult profile";
      rowC.querySelector(".opt-label").textContent = key === "child" ? "target ✓ · child profile" : "child profile";
      flash([rowA, rowC]);
      return item.audio[key];
    }
    var shell = exCardShell(item.question, voices, apply);
    rowA = optRow("target ✓ · adult profile", item.adult_response, "gold");
    rowC = optRow("child profile", item.child_response);
    shell.card.appendChild(rowA);
    shell.card.appendChild(rowC);
    var foot = document.createElement("p");
    foot.className = "ex-foot";
    foot.textContent = "Open-ended generation: the model answers the spoken question, and an LLM judge decides whether the response matches the child or the adult profile. The target follows the voice.";
    shell.card.appendChild(foot);
    shell.audio.src = AUDIO_BASE + item.audio.adult;
    container.appendChild(shell.card);
  }

  /* render all example panels */
  (function renderExamples() {
    var EX = B.EXAMPLES;
    var sssG = document.getElementById("ex-sss-gender");
    EX.sss_gender.forEach(function (it) {
      buildSSSCard(it, [
        { key: "female", label: "👩 Female voice" },
        { key: "male", label: "👨 Male voice" }
      ], sssG);
    });
    var sssA = document.getElementById("ex-sss-age");
    EX.sss_age.forEach(function (it) {
      buildSSSCard(it, [
        { key: "elderly", label: "👴 Elderly voice" },
        { key: "adult", label: "🧑 Adult voice" }
      ], sssA);
    });
    var h = document.getElementById("ex-health");
    EX.health.forEach(function (it) { buildMCQACard(it, h); });
    var p = document.getElementById("ex-product");
    EX.product.forEach(function (it) { buildMCQACard(it, p); });
    var e = document.getElementById("ex-elip");
    EX.elip.forEach(function (it) { buildElipCard(it, e); });
  })();

  /* ------------------------------------------------------------ bibtex --- */
  var copyBtn = document.getElementById("copy-bib");
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var text = document.getElementById("bibtex-pre").textContent;
      function done() {
        copyBtn.textContent = "Copied ✓";
        setTimeout(function () { copyBtn.textContent = "Copy"; }, 1600);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {});
      } else {
        var r = document.createRange();
        r.selectNodeContents(document.getElementById("bibtex-pre"));
        var sel = window.getSelection();
        sel.removeAllRanges(); sel.addRange(r);
        try { document.execCommand("copy"); done(); } catch (e) {}
        sel.removeAllRanges();
      }
    });
  }
})();
