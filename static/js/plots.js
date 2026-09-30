/* ============================================================================
   BASIS-Bench project page — scatter chart engine (no dependencies)
   - dots animate between evaluation modes via CSS transforms
   - hollow dot = implicit, filled dot = explicit (as in the paper)
   - the implicit points are the always-on anchor layer; selecting "explicit"
     adds the filled dots with dashed per-model links to their anchors,
     reproducing the paper's Figure 2 view
   - Pareto frontier drawn over the speech-implicit points (the target setting)
   - tooltip on hover AND keyboard focus; every value is also in the table view
   ========================================================================== */
window.BasisPlots = (function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var MODELS = window.BASIS.MODELS;

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function fmt(v) { return (Math.round(v * 10) / 10).toFixed(1); }

  /* Pareto front: higher x AND higher y are better. Returns points sorted by
     ascending x with x-ties collapsed — same algorithm as the paper's script. */
  function paretoFront(pts) {
    var order = pts.map(function (p, i) { return i; })
      .sort(function (a, b) { return pts[b].x - pts[a].x; });
    var front = [], bestY = -Infinity;
    order.forEach(function (i) {
      if (pts[i].y > bestY) { front.push(pts[i]); bestY = pts[i].y; }
    });
    front.reverse();
    var dedup = [];
    front.forEach(function (p) {
      if (dedup.length && p.x <= dedup[dedup.length - 1].x) return;
      dedup.push(p);
    });
    return dedup;
  }

  /* Centripetal Catmull-Rom spline through points -> SVG path string.
     Smooth, no overshoot; visually equivalent to the paper's PCHIP curve. */
  function smoothPath(pts) {
    if (pts.length < 2) return "";
    if (pts.length === 2) {
      return "M" + pts[0].x + "," + pts[0].y + " L" + pts[1].x + "," + pts[1].y;
    }
    var d = "M" + pts[0].x + "," + pts[0].y;
    var alpha = 0.5;
    function dist(a, b) { return Math.pow(Math.hypot(b.x - a.x, b.y - a.y), alpha); }
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i],
          p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      var d1 = dist(p0, p1) || 1e-4, d2 = dist(p1, p2) || 1e-4, d3 = dist(p2, p3) || 1e-4;
      var b1x = (d1 * d1 * p2.x - d2 * d2 * p0.x + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * p1.x) / (3 * d1 * (d1 + d2));
      var b1y = (d1 * d1 * p2.y - d2 * d2 * p0.y + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * p1.y) / (3 * d1 * (d1 + d2));
      var b2x = (d3 * d3 * p1.x - d2 * d2 * p3.x + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * p2.x) / (3 * d3 * (d3 + d2));
      var b2y = (d3 * d3 * p1.y - d2 * d2 * p3.y + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * p2.y) / (3 * d3 * (d3 + d2));
      d += " C" + b1x.toFixed(2) + "," + b1y.toFixed(2) +
           " " + b2x.toFixed(2) + "," + b2y.toFixed(2) +
           " " + p2.x.toFixed(2) + "," + p2.y.toFixed(2);
    }
    return d;
  }

  /* ------------------------------------------------------------------------
     makeScatter(card, cfg) -> { update(state), highlight(id) }
     cfg: {
       xDomain, yDomain, xTicks, yTicks, xLabel, yLabel, ariaLabel,
       point(state, i)   -> {x, y}   primary-dot data coords for model i
       tip(state, i)     -> {rows:[{v,k}], sub, tag}
       filled(state)     -> bool     primary dots filled vs hollow
       twinPoint(state,i)-> {x, y}   second dot per model (optional)
       twinTip(state, i) -> tooltip for the twin
       twinWhen(state)   -> bool     when the twin layer (+ links) is visible
       pareto            -> [{x,y}] | null   frontier points (data coords)
       paretoWhen(state) -> bool     when the frontier applies
     }
     ---------------------------------------------------------------------- */
  function makeScatter(card, cfg) {
    var W = 520, H = 430, M = { t: 12, r: 14, b: 50, l: 54 };
    var iw = W - M.l - M.r, ih = H - M.t - M.b;
    var REDUCED = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var MOVE_MS = REDUCED ? 60 : 700; /* keep in step with the CSS transition */

    function sx(v) { return M.l + (v - cfg.xDomain[0]) / (cfg.xDomain[1] - cfg.xDomain[0]) * iw; }
    function sy(v) { return M.t + ih - (v - cfg.yDomain[0]) / (cfg.yDomain[1] - cfg.yDomain[0]) * ih; }
    function trf(p) { return "translate(" + p.x + "px," + p.y + "px)"; }

    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "group" }, card);
    svg.setAttribute("aria-label", cfg.ariaLabel || "scatter plot");

    /* grid + axes */
    var gGrid = el("g", null, svg);
    cfg.yTicks.forEach(function (t) {
      el("line", { x1: M.l, x2: M.l + iw, y1: sy(t), y2: sy(t), "class": "gridline" }, gGrid);
      el("text", { x: M.l - 8, y: sy(t) + 4, "text-anchor": "end", "class": "ticktext" }, gGrid)
        .textContent = t;
    });
    cfg.xTicks.forEach(function (t) {
      el("line", { y1: M.t, y2: M.t + ih, x1: sx(t), x2: sx(t), "class": "gridline" }, gGrid);
      el("text", { x: sx(t), y: M.t + ih + 17, "text-anchor": "middle", "class": "ticktext" }, gGrid)
        .textContent = t;
    });
    el("line", { x1: M.l, x2: M.l + iw, y1: M.t + ih, y2: M.t + ih, "class": "axisline" }, svg);
    el("line", { x1: M.l, x2: M.l, y1: M.t, y2: M.t + ih, "class": "axisline" }, svg);
    el("text", { x: M.l + iw / 2, y: H - 10, "text-anchor": "middle", "class": "axtitle" }, svg)
      .textContent = cfg.xLabel;
    var yT = el("text", {
      x: 0, y: 0, "text-anchor": "middle", "class": "axtitle",
      transform: "translate(15," + (M.t + ih / 2) + ") rotate(-90)"
    }, svg);
    yT.textContent = cfg.yLabel;

    /* pareto frontier (fixed geometry — computed for the target setting) */
    var gPareto = null;
    if (cfg.pareto && cfg.pareto.length) {
      gPareto = el("g", { "class": "pareto-wrap" }, svg);
      var pp = cfg.pareto.map(function (p) { return { x: sx(p.x), y: sy(p.y) }; });
      var d = smoothPath(pp);
      el("path", { d: d, "class": "pareto-glow" }, gPareto);
      el("path", { d: d, "class": "pareto-core" }, gPareto);
    }

    var gConnect = el("g", { "class": "connect-layer settling" }, svg);
    var gTrails = el("g", null, svg);
    var gDots = el("g", null, svg);

    /* tooltip */
    var tip = document.createElement("div");
    tip.className = "viz-tip";
    card.appendChild(tip);

    var state0 = null;
    var last = null, lastTwin = null, twinPrevOn = false, connTimer = null;

    function makeDotGroup(m, i, tipFn, isTwin) {
      var g = el("g", {
        "class": "dot-g dot-move" + (isTwin ? " twin filled off" : ""),
        tabindex: isTwin ? "-1" : "0",
        role: "img"
      }, gDots);
      g.style.setProperty("--c", "var(--m-" + m.id + ")");
      g.dataset.model = m.id;
      el("circle", { r: 9.6, "class": "ringc" }, g);
      el("circle", { r: 7.4, "class": "dot" }, g);
      el("circle", { r: 17, "class": "hit" }, g);

      function showTip() {
        g.classList.add("hovered");
        var t = tipFn(state0, i);
        tip.replaceChildren();
        var name = document.createElement("div");
        name.className = "tip-name";
        var key = document.createElement("span");
        key.className = "keyline";
        key.style.setProperty("--c", "var(--m-" + m.id + ")");
        name.appendChild(key);
        name.appendChild(document.createTextNode(m.name));
        if (t.tag) {
          var tag = document.createElement("span");
          tag.className = "tip-tag";
          tag.textContent = t.tag;
          name.appendChild(tag);
        }
        tip.appendChild(name);
        t.rows.forEach(function (r) {
          var row = document.createElement("div");
          row.className = "tip-row";
          var v = document.createElement("span"); v.className = "v"; v.textContent = r.v;
          var k = document.createElement("span"); k.className = "k"; k.textContent = r.k;
          row.appendChild(v); row.appendChild(k);
          tip.appendChild(row);
        });
        if (t.sub) {
          var s = document.createElement("div");
          s.className = "tip-sub"; s.textContent = t.sub;
          tip.appendChild(s);
        }
        var cr = card.getBoundingClientRect(), gr = g.getBoundingClientRect();
        var cx = gr.left + gr.width / 2 - cr.left, cy = gr.top - cr.top;
        tip.classList.add("show");
        var tw = tip.offsetWidth, th = tip.offsetHeight;
        var lx = Math.max(6, Math.min(cr.width - tw - 6, cx - tw / 2));
        var ly = cy - th - 14;
        if (ly < 4) ly = cy + 26;
        tip.style.left = lx + "px";
        tip.style.top = ly + "px";
      }
      function hideTip() { g.classList.remove("hovered"); tip.classList.remove("show"); }
      g.addEventListener("pointerenter", showTip);
      g.addEventListener("pointerleave", hideTip);
      g.addEventListener("focus", showTip);
      g.addEventListener("blur", hideTip);
      return g;
    }

    var groups = MODELS.map(function (m, i) { return makeDotGroup(m, i, cfg.tip, false); });
    var twins = [], connectors = [];
    if (cfg.twinPoint) {
      /* connectors first (under the dots), then the twin dots on top */
      connectors = MODELS.map(function (m) {
        var ln = el("line", { "class": "connector" }, gConnect);
        ln.style.setProperty("--c", "var(--m-" + m.id + ")");
        ln.dataset.model = m.id;
        return ln;
      });
      twins = MODELS.map(function (m, i) { return makeDotGroup(m, i, cfg.twinTip, true); });
    }

    function addTrail(from, to, i) {
      if (Math.abs(from.x - to.x) + Math.abs(from.y - to.y) <= 1) return;
      var tr = el("line", {
        x1: from.x, y1: from.y, x2: to.x, y2: to.y, "class": "trail animate"
      }, gTrails);
      tr.style.setProperty("--c", "var(--m-" + MODELS[i].id + ")");
      tr.addEventListener("animationend", function () { tr.remove(); });
      setTimeout(function () { if (tr.parentNode) tr.remove(); }, 1600);
    }
    function ariaFor(i, t) {
      return MODELS[i].name + (t.tag ? " (" + t.tag + ")" : "") + ": " +
        t.rows.map(function (r) { return r.k + " " + r.v; }).join(", ");
    }

    function update(state) {
      state0 = state;
      var firstRender = (last === null);
      var filled = cfg.filled ? cfg.filled(state) : false;
      var pts = MODELS.map(function (_, i) {
        var p = cfg.point(state, i);
        return { x: sx(p.x), y: sy(p.y) };
      });
      var twinOn = !!(cfg.twinWhen && cfg.twinWhen(state));
      var tpts = (twinOn && cfg.twinPoint) ? MODELS.map(function (_, i) {
        var p = cfg.twinPoint(state, i);
        return { x: sx(p.x), y: sy(p.y) };
      }) : null;

      if (firstRender) {
        groups.concat(twins).forEach(function (g) { g.style.transition = "none"; });
      }

      groups.forEach(function (g, i) {
        var p = pts[i];
        if (last) addTrail(last[i], p, i);
        g.style.transform = trf(p);
        g.classList.toggle("filled", filled);
        g.setAttribute("aria-label", ariaFor(i, cfg.tip(state, i)));
      });

      twins.forEach(function (g, i) {
        if (twinOn) {
          if (!twinPrevOn && !firstRender) {
            /* split off from the primary dot's previous position */
            g.style.transition = "none";
            g.style.transform = trf(last ? last[i] : pts[i]);
            void g.getBoundingClientRect();
            g.style.transition = "";
          } else if (twinPrevOn && lastTwin) {
            addTrail(lastTwin[i], tpts[i], i);
          }
          g.style.transform = trf(tpts[i]);
          g.classList.remove("off");
          g.setAttribute("tabindex", "0");
          g.setAttribute("aria-label", ariaFor(i, cfg.twinTip(state, i)));
        } else {
          g.classList.add("off");
          g.setAttribute("tabindex", "-1");
        }
      });

      /* dashed implicit↔explicit links: update endpoints while hidden, then
         fade the layer back in once the dots have settled */
      if (cfg.twinPoint) {
        if (twinOn) {
          connectors.forEach(function (ln, i) {
            ln.setAttribute("x1", pts[i].x); ln.setAttribute("y1", pts[i].y);
            ln.setAttribute("x2", tpts[i].x); ln.setAttribute("y2", tpts[i].y);
          });
        }
        gConnect.classList.add("settling");
        if (connTimer) clearTimeout(connTimer);
        if (twinOn) {
          connTimer = setTimeout(function () {
            gConnect.classList.remove("settling");
          }, firstRender ? 30 : MOVE_MS);
        }
      }

      last = pts;
      if (tpts) lastTwin = tpts;
      twinPrevOn = twinOn;

      if (firstRender) {
        /* flush styles so the initial placement doesn't animate in from 0,0 */
        void svg.getBoundingClientRect();
        groups.concat(twins).forEach(function (g) { g.style.transition = ""; });
      }
      if (gPareto) gPareto.classList.toggle("off", !cfg.paretoWhen(state));
      tip.classList.remove("show");
    }

    function highlight(id) {
      svg.classList.toggle("has-dim", !!id);
      groups.concat(twins).forEach(function (g) {
        g.classList.toggle("hl", g.dataset.model === id);
      });
      connectors.forEach(function (ln) {
        ln.classList.toggle("hl", ln.dataset.model === id);
      });
    }

    return { update: update, highlight: highlight };
  }

  /* ------------------------------------------------------------------------
     Concrete charts
     ---------------------------------------------------------------------- */

  /* mode strings: "<modality>_<marker>", marker in {implicit, explicit} */
  function parseMode(mode) {
    var i = mode.indexOf("_");
    return { modality: mode.slice(0, i), marker: mode.slice(i + 1) };
  }

  /* bias-vs-personalization chart for one dimension ("gender" | "age") */
  function tradeoffChart(card, dim) {
    var D = window.BASIS.tradeoff[dim];
    var paretoPts = paretoFront(MODELS.map(function (_, i) {
      return { x: D.pers.overall.speech_implicit[i], y: D.bias.overall.speech_implicit[i] };
    }));
    /* the implicit points are the anchor layer: always plotted, always hollow.
       Selecting "explicit" adds the filled twin layer on top of them. */
    function primaryKey(mode) { return parseMode(mode).modality + "_implicit"; }
    function explicitKey(mode) { return parseMode(mode).modality + "_explicit"; }
    function tipFor(k, i, tag) {
      return {
        tag: tag,
        rows: [
          { v: fmt(D.bias.overall[k][i]), k: "ICAT (1−bias)" },
          { v: fmt(D.pers.overall[k][i]), k: "Personalization" }
        ],
        sub: "ICAT " + D.groupsBias[0] + " " + fmt(D.bias.sub1[k][i]) +
             " · " + D.groupsBias[1] + " " + fmt(D.bias.sub2[k][i]) +
             "  |  Pers. " + D.groupsPers[0] + " " + fmt(D.pers.sub1[k][i]) +
             " · " + D.groupsPers[1] + " " + fmt(D.pers.sub2[k][i])
      };
    }
    return makeScatter(card, {
      xDomain: D.xDomain, yDomain: D.yDomain, xTicks: D.xTicks, yTicks: D.yTicks,
      xLabel: "Accuracy (personalization)",
      yLabel: "ICAT (1 − stereotypical bias)",
      ariaLabel: "Stereotypical bias versus personalization, " + dim,
      point: function (mode, i) {
        var k = primaryKey(mode);
        return { x: D.pers.overall[k][i], y: D.bias.overall[k][i] };
      },
      tip: function (mode, i) {
        return tipFor(primaryKey(mode), i, parseMode(mode).modality + "-implicit");
      },
      twinPoint: function (mode, i) {
        var k = explicitKey(mode);
        return { x: D.pers.overall[k][i], y: D.bias.overall[k][i] };
      },
      twinTip: function (mode, i) {
        return tipFor(explicitKey(mode), i, parseMode(mode).modality + "-explicit");
      },
      twinWhen: function (mode) { return parseMode(mode).marker === "explicit"; },
      filled: function () { return false; },
      pareto: paretoPts,
      paretoWhen: function (mode) { return parseMode(mode).modality === "speech"; }
    });
  }

  /* robustness chart: content-task accuracy vs classification accuracy */
  function robustnessChart(card) {
    var R = window.BASIS.robustness;
    return makeScatter(card, {
      xDomain: R.xDomain, yDomain: R.yDomain, xTicks: R.xTicks, yTicks: R.yTicks,
      xLabel: "Accuracy (content-based tasks: ASR + SQA)",
      yLabel: "Accuracy (demographic classification)",
      ariaLabel: "Demographic robustness: content-task accuracy versus demographic classification accuracy",
      point: function (dim, i) {
        return { x: R.content[i], y: R.classification[dim][i] };
      },
      tip: function (dim, i) {
        return {
          rows: [
            { v: fmt(R.classification[dim][i]), k: (dim === "age" ? "Age" : "Gender") + " classification" },
            { v: fmt(R.content[i]), k: "Content tasks (ASR/SQA)" }
          ],
          sub: null
        };
      },
      filled: function () { return false; },
      pareto: null,
      paretoWhen: function () { return false; }
    });
  }

  return { tradeoffChart: tradeoffChart, robustnessChart: robustnessChart };
})();
