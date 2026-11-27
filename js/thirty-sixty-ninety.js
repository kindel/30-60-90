(function (global) {
  "use strict";

  var VERSION = 1;
  var KIND = "kindel.30-60-90";
  var STORE_KEY = "kindel.30-60-90.draft.v2";
  var STORE_KEYS = ["kindel.30-60-90.draft.v2", "kindel.30-60-90.draft.v1"];
  var LENS_ORDER = ["customer", "business", "technical", "organization"];
  var LENS_LETTERS = { customer: "C", business: "B", technical: "T", organization: "O" };
  var HORIZON_OFFSETS = { d30: 30, d60: 60, d90: 90, d180: 180 };
  var LEVEL_TAGS = { junior: true, senior: true, executive: true, any: true };

  var TACTIC_VERBS = [
    "meet", "attend", "read", "talk", "interview", "email", "call", "schedule",
    "shadow", "visit", "review", "join", "learn", "ride", "onboard"
  ];
  var TACTIC_PHRASES = ["sit with", "set up"];
  var NARROW_MAX_PX = 700;

  var MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  var activeBundle = null;

  function iso(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function fromIso(s) {
    if (!s) return null;
    var p = String(s).split("-");
    if (p.length !== 3) return null;
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(d.getTime()) ? null : d;
  }

  function addDays(d, n) {
    var result = new Date(d.getTime());
    result.setDate(result.getDate() + n);
    return result;
  }

  function formatDate(d) {
    if (!d) return "";
    return MONTHS_SHORT[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }

  function formatDateShort(d) {
    if (!d) return "";
    return MONTHS_SHORT[d.getMonth()] + " " + d.getDate();
  }

  function formatDateLong(d) {
    if (!d) return "";
    return MONTHS_LONG[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }

  function slugify(s) {
    return String(s).toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function splitLines(s) {
    return String(s == null ? "" : s)
      .split(/\n/)
      .map(function (l) {
        return l
          .replace(/^\s*[✓✔▪•]+\s*/, "")
          .replace(/^\s*-\s+/, "")
          .trim();
      })
      .filter(function (l) { return l.length > 0; });
  }

  function itemList(value) {
    if (Array.isArray(value)) {
      return value.map(function (v) {
        return String(v == null ? "" : v).replace(/\u00a0/g, " ");
      });
    }
    return splitLines(value);
  }

  function compactItems(value) {
    var items = itemList(value).map(function (v) { return String(v).trim(); });
    while (items.length && !items[items.length - 1]) items.pop();
    return items;
  }

  function filledItems(value) {
    return compactItems(value).filter(function (l) { return l.length > 0; });
  }

  function setItem(cell, field, index, text) {
    if (!cell) return;
    var items = compactItems(cell[field]);
    var i = index == null ? 0 : index;
    while (items.length <= i) items.push("");
    items[i] = String(text == null ? "" : text).replace(/\u00a0/g, " ").trim();
    cell[field] = compactItems(items);
  }

  function removeItem(cell, field, index) {
    if (!cell) return false;
    var items = compactItems(cell[field]);
    var i = index == null ? 0 : index;
    if (i < 0 || i >= items.length) return false;
    items.splice(i, 1);
    cell[field] = compactItems(items);
    return true;
  }

  function cellItemText(cell, field, index) {
    if (!cell) return "";
    if (field === "objective" || field === "status") {
      return String(cell[field] || "").replace(/\u00a0/g, " ");
    }
    var items = compactItems(cell[field]);
    return items[index] || "";
  }

  function selFromEl(el) {
    if (!el) return null;
    return {
      lensId: el.getAttribute("data-lens"),
      facetId: el.getAttribute("data-facet"),
      horizonId: el.getAttribute("data-horizon"),
      field: el.getAttribute("data-field"),
      index: parseInt(el.getAttribute("data-index") || "0", 10) || 0
    };
  }

  function sameSel(a, b) {
    return !!(a && b &&
      a.lensId === b.lensId &&
      a.facetId === b.facetId &&
      a.horizonId === b.horizonId &&
      a.field === b.field &&
      (a.index || 0) === (b.index || 0));
  }

  function isTypingKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (e.key == null || e.key.length !== 1) return false;
    return true;
  }

  function hydrateCell(cell) {
    if (!cell || typeof cell !== "object") return cell;
    cell.objective = cell.objective == null ? "" : String(cell.objective);
    cell.status = cell.status == null ? "" : String(cell.status);
    cell.criteria = compactItems(cell.criteria);
    cell.tactics = compactItems(cell.tactics);
    hydrateCellDismissals(cell);
    pruneDismissals(cell);
    return cell;
  }

  function hydratePlan(plan) {
    if (!plan || !plan.lenses) return plan;
    plan.lenses.forEach(function (lens) {
      (lens.facets || []).forEach(function (facet) {
        Object.keys(facet.cells || {}).forEach(function (hid) {
          hydrateCell(facet.cells[hid]);
        });
      });
    });
    return plan;
  }

  function modalFocusables(root) {
    if (!root || typeof root.querySelectorAll !== "function") return [];
    var nodes = root.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])");
    var out = [];
    var i;
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.disabled) continue;
      if (el.getAttribute("aria-hidden") === "true") continue;
      out.push(el);
    }
    return out;
  }

  function nextTabTarget(items, current, shift) {
    if (!items || !items.length) return null;
    var idx = -1;
    var i;
    for (i = 0; i < items.length; i++) {
      if (items[i] === current) {
        idx = i;
        break;
      }
    }
    if (idx < 0) return shift ? items[items.length - 1] : items[0];
    if (shift) return items[(idx - 1 + items.length) % items.length];
    return items[(idx + 1) % items.length];
  }

  function getBundle() {
    if (activeBundle) return activeBundle;
    if (typeof KINDEL_TEMPLATES !== "undefined" && KINDEL_TEMPLATES) return KINDEL_TEMPLATES;
    if (typeof globalThis !== "undefined" && globalThis.KINDEL_TEMPLATES) return globalThis.KINDEL_TEMPLATES;
    return null;
  }

  function setBundle(bundle) {
    activeBundle = bundle || null;
    return activeBundle;
  }

  function getDefaultTemplate(bundle) {
    bundle = bundle || getBundle();
    if (!bundle || !bundle.manifest) return null;
    var id = bundle.manifest.default;
    return (bundle.templates && bundle.templates[id]) || null;
  }

  function familyFromTemplate(template) {
    var fn = template && template.function;
    if (fn === "product") return "pm";
    if (fn === "hardware") return "hardware";
    if (fn === "general") return "general";
    return "pm";
  }

  function findById(list, id) {
    if (!list) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  }

  function templateLens(template, lensId) {
    return template ? findById(template.lenses, lensId) : null;
  }

  function templateFacet(template, lensId, facetId, facetName) {
    var lens = templateLens(template, lensId);
    if (!lens || !lens.facets) return null;
    var match = findById(lens.facets, facetId);
    if (match) return match;
    if (facetName) {
      for (var i = 0; i < lens.facets.length; i++) {
        if (lens.facets[i].name === facetName) return lens.facets[i];
      }
    }
    return null;
  }

  function templateHorizon(template, horizonId) {
    return template ? findById(template.horizons, horizonId) : null;
  }

  function genericHints(template) {
    var h = (template && template.hints) || {};
    return {
      objective: h.objective || "",
      criteria: h.criteria || "",
      tactics: h.tactics || "",
      status: h.status || ""
    };
  }

  function cellHints(template, lensId, facetId, facetName, horizonId) {
    var hints = genericHints(template);
    var facet = templateFacet(template, lensId, facetId, facetName);
    var cell = facet && facet.cells && facet.cells[horizonId];
    if (cell && cell.hint) {
      if (cell.hint.objective) hints.objective = cell.hint.objective;
      if (cell.hint.criteria) hints.criteria = cell.hint.criteria;
      if (cell.hint.tactics) hints.tactics = cell.hint.tactics;
      if (cell.hint.status) hints.status = cell.hint.status;
    }
    return hints;
  }

  function cellExample(template, lensId, facetId, facetName, horizonId) {
    var facet = templateFacet(template, lensId, facetId, facetName);
    var cell = facet && facet.cells && facet.cells[horizonId];
    return (cell && cell.example) || null;
  }

  function columnLabel(template, key) {
    var cols = (template && template.columns) || {};
    return cols[key] || "";
  }

  function validateManifest(manifest) {
    if (!manifest || typeof manifest !== "object") return { valid: false, error: "Not an object" };
    if (manifest.kind !== "kindel.30-60-90.templates") return { valid: false, error: "Not a templates manifest" };
    if (!manifest.default) return { valid: false, error: "Missing default" };
    if (!Array.isArray(manifest.templates) || manifest.templates.length < 1) {
      return { valid: false, error: "Missing templates list" };
    }
    var ids = {};
    for (var i = 0; i < manifest.templates.length; i++) {
      var t = manifest.templates[i];
      if (!t || !t.id || !t.file || !t.label) {
        return { valid: false, error: "Template entry missing id, file, or label" };
      }
      if (!t.level || !LEVEL_TAGS[t.level]) {
        return { valid: false, error: "Template " + t.id + " missing level tag" };
      }
      if (!t["function"] || typeof t["function"] !== "string") {
        return { valid: false, error: "Template " + t.id + " missing function tag" };
      }
      ids[t.id] = true;
    }
    if (!ids[manifest.default]) return { valid: false, error: "Default template not in list" };
    return { valid: true };
  }

  function validateTemplate(template) {
    if (!template || typeof template !== "object") return { valid: false, error: "Not an object" };
    if (template.kind !== "kindel.30-60-90.template") return { valid: false, error: "Not a template file" };
    if (!template.id) return { valid: false, error: "Missing id" };
    if (!template.level || !LEVEL_TAGS[template.level]) return { valid: false, error: "Missing level tag" };
    if (!template["function"]) return { valid: false, error: "Missing function tag" };
    if (!Array.isArray(template.horizons) || template.horizons.length < 3) {
      return { valid: false, error: "Template needs at least 3 horizons" };
    }
    if (!Array.isArray(template.lenses) || template.lenses.length !== 4) {
      return { valid: false, error: "Template needs 4 lenses" };
    }
    var seen = {};
    for (var i = 0; i < template.lenses.length; i++) {
      var id = template.lenses[i] && template.lenses[i].id;
      if (LENS_ORDER.indexOf(id) < 0) return { valid: false, error: "Invalid lens id " + id };
      seen[id] = true;
    }
    for (var j = 0; j < LENS_ORDER.length; j++) {
      if (!seen[LENS_ORDER[j]]) return { valid: false, error: "Missing lens " + LENS_ORDER[j] };
    }
    return { valid: true };
  }

  function computeHorizons(startDate, include180, template) {
    var start = fromIso(startDate);
    if (!start) start = new Date();
    var defs;
    if (template && Array.isArray(template.horizons) && template.horizons.length) {
      defs = template.horizons.filter(function (h) {
        return h && (!h.optional || include180);
      });
    } else {
      defs = [
        { id: "d30", offsetDays: 30, name: "" },
        { id: "d60", offsetDays: 60, name: "" },
        { id: "d90", offsetDays: 90, name: "" }
      ];
      if (include180) defs.push({ id: "d180", offsetDays: 180, name: "" });
    }
    return defs.map(function (def) {
      var offset = def.offsetDays != null ? def.offsetDays : HORIZON_OFFSETS[def.id];
      return {
        id: def.id,
        offsetDays: offset,
        name: def.name || "",
        date: iso(addDays(start, offset))
      };
    });
  }

  function emptyCell() {
    return { objective: "", criteria: [], tactics: [], status: "" };
  }

  function emptyCells(horizons) {
    var cells = {};
    (horizons || []).forEach(function (h) {
      cells[h.id] = emptyCell();
    });
    return cells;
  }

  function cellFromExample(example) {
    var ex = example || {};
    return {
      objective: ex.objective || "",
      criteria: compactItems(ex.criteria),
      tactics: compactItems(ex.tactics),
      status: ex.status || ""
    };
  }

  function cellsFromTemplateFacet(facet, horizons, fillExamples) {
    var cells = {};
    (horizons || []).forEach(function (h) {
      var src = facet && facet.cells && facet.cells[h.id];
      cells[h.id] = fillExamples ? cellFromExample(src && src.example) : emptyCell();
    });
    return cells;
  }

  function buildLenses(template, horizons, opts) {
    var fillExamples = !!(opts && opts.fillExamples);
    var lensIndex = {};
    ((template && template.lenses) || []).forEach(function (l) {
      if (l && l.id) lensIndex[l.id] = l;
    });
    return LENS_ORDER.map(function (lensId) {
      var src = lensIndex[lensId] || {};
      var facets = (src.facets || []).map(function (f) {
        return {
          id: f.id || slugify(f.name) || ("facet-" + Date.now()),
          name: f.name || "",
          cells: cellsFromTemplateFacet(f, horizons, fillExamples)
        };
      });
      return {
        id: lensId,
        name: src.name || "",
        facets: facets
      };
    });
  }

  function planHasCellContent(plan) {
    var found = false;
    ((plan && plan.lenses) || []).forEach(function (lens) {
      (lens.facets || []).forEach(function (facet) {
        Object.keys(facet.cells || {}).forEach(function (hid) {
          if (cellHasContent(facet.cells[hid])) found = true;
        });
      });
    });
    return found;
  }

  function isUntouchedEmptyDraft(plan) {
    return !!(plan && !plan.startedBlank && !planHasCellContent(plan));
  }

  function storageGet(storage, key) {
    if (!storage || typeof storage.getItem !== "function") return null;
    try {
      return storage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function storageRemove(storage, key) {
    if (!storage || typeof storage.removeItem !== "function") return;
    try { storage.removeItem(key); } catch (e) {}
  }

  function readStoredDraft(storage) {
    var i;
    for (i = 0; i < STORE_KEYS.length; i++) {
      try {
        var raw = storageGet(storage, STORE_KEYS[i]);
        if (!raw) continue;
        var plan = JSON.parse(raw);
        var result = validatePlan(plan);
        if (!result.valid) continue;
        if (isUntouchedEmptyDraft(plan)) {
          storageRemove(storage, STORE_KEYS[i]);
          continue;
        }
        return hydratePlan(plan);
      } catch (e) {}
    }
    return null;
  }

  function createNewPlan(opts) {
    opts = opts || {};
    var template = opts.template || getDefaultTemplate(opts.bundle);
    if (!template) throw new Error("No template loaded");
    var include180 = opts.include180 != null ? !!opts.include180 : !!template.include180;
    var startDate = opts.startDate || iso(new Date());
    var horizons = computeHorizons(startDate, include180, template);
    var fillExamples = opts.fillExamples !== false;
    var seatTitle = opts.seatTitle != null ? opts.seatTitle : (template.seatTitle || "");
    return {
      version: VERSION,
      kind: KIND,
      seat: {
        title: seatTitle,
        family: opts.family || familyFromTemplate(template)
      },
      person: { name: opts.personName || "", role: "hire" },
      manager: { name: opts.managerName || "" },
      startDate: startDate,
      include180: include180,
      template: { id: template.id, version: template.version },
      horizons: horizons,
      lenses: buildLenses(template, horizons, { fillExamples: fillExamples })
    };
  }

  function validatePlan(plan) {
    if (!plan || typeof plan !== "object") return { valid: false, error: "Not an object" };
    if (plan.kind !== KIND) return { valid: false, error: "Not a kindel.30-60-90 file" };
    if (!plan.version || plan.version > VERSION) return { valid: false, error: "Unsupported version" };
    if (!plan.seat) return { valid: false, error: "Missing seat" };
    if (!plan.startDate) return { valid: false, error: "Missing start date" };
    if (!Array.isArray(plan.horizons) || plan.horizons.length < 3) return { valid: false, error: "Missing horizons" };
    if (!Array.isArray(plan.lenses) || plan.lenses.length !== 4) return { valid: false, error: "Missing or invalid lenses" };
    for (var i = 0; i < LENS_ORDER.length; i++) {
      if (!plan.lenses[i] || plan.lenses[i].id !== LENS_ORDER[i]) {
        return { valid: false, error: "Lenses must be customer, business, technical, organization" };
      }
    }
    return { valid: true };
  }

  function startsWithActivity(lower) {
    var s = String(lower || "").trim();
    var i;
    for (i = 0; i < TACTIC_PHRASES.length; i++) {
      var phrase = TACTIC_PHRASES[i];
      if (s === phrase || s.indexOf(phrase + " ") === 0) return true;
    }
    for (i = 0; i < TACTIC_VERBS.length; i++) {
      var v = TACTIC_VERBS[i];
      if (s === v || s.indexOf(v + " ") === 0 || s.indexOf(v + ",") === 0) return true;
    }
    return false;
  }

  function isAcceptedCriterion(lower) {
    var s = String(lower || "").trim();
    if (/^i can\b/.test(s)) return true;
    if (/^i know\b/.test(s)) return true;
    if (/^i have\b/.test(s) || /^i've\b/.test(s)) return true;
    if (/^my\b/.test(s)) return true;
    return false;
  }

  function lineLooksLikeTactic(line) {
    var lower = String(line || "").trim().toLowerCase();
    if (!lower) return false;
    if (isAcceptedCriterion(lower)) return false;
    if (/^i will\b/.test(lower) || /^i'll\b/.test(lower)) {
      var rest = lower.replace(/^i will\b\s*/, "").replace(/^i'll\b\s*/, "");
      return startsWithActivity(rest);
    }
    return startsWithActivity(lower);
  }

  function normLine(s) {
    return String(s || "").trim().toLowerCase();
  }

  function dismissedTextSet(cell) {
    var out = {};
    ((cell && cell.dismissedText) || []).forEach(function (t) {
      var n = normLine(t);
      if (n) out[n] = true;
    });
    return out;
  }

  function pruneDismissals(cell) {
    if (!cell) return;
    var texts = cell.dismissedText;
    if (!texts || !texts.length) return;
    var crits = compactItems(cell.criteria);
    var keptText = [];
    var keptIdx = [];
    texts.forEach(function (t) {
      var n = normLine(t);
      var idx = -1;
      crits.forEach(function (c, i) {
        if (idx < 0 && normLine(c) === n) idx = i;
      });
      if (idx >= 0) {
        keptText.push(t);
        keptIdx.push(idx);
      }
    });
    if (keptText.length) {
      cell.dismissedText = keptText;
      cell.dismissed = keptIdx;
    } else {
      delete cell.dismissedText;
      delete cell.dismissed;
    }
  }

  function hydrateCellDismissals(cell) {
    if (!cell || (cell.dismissedText && cell.dismissedText.length)) return;
    var crits = compactItems(cell.criteria);
    if (!cell.dismissed || !cell.dismissed.length) return;
    cell.dismissedText = [];
    cell.dismissed.forEach(function (idx) {
      if (crits[idx]) cell.dismissedText.push(crits[idx]);
    });
    if (!cell.dismissedText.length) delete cell.dismissedText;
  }

  function hydratePlanDismissals(plan) {
    if (!plan || !plan.lenses) return plan;
    plan.lenses.forEach(function (lens) {
      (lens.facets || []).forEach(function (facet) {
        Object.keys(facet.cells || {}).forEach(function (hid) {
          hydrateCellDismissals(facet.cells[hid]);
        });
      });
    });
    return plan;
  }

  function isDismissedLine(cell, text, lineIndex) {
    if (cell && cell.dismissedText && cell.dismissedText.length) {
      return !!dismissedTextSet(cell)[normLine(text)];
    }
    return !!((cell && cell.dismissed) || []).some(function (idx) { return idx === lineIndex; });
  }

  function pressureTestCell(cell) {
    var flags = [];
    if (!cell) return flags;
    var obj = (cell.objective || "").trim();
    var crits = compactItems(cell.criteria);

    if (obj && crits.length === 0) {
      flags.push({
        type: "empty-criteria",
        message: "Objective set but criteria is empty"
      });
    }

    crits.forEach(function (text, lineIndex) {
      if (isDismissedLine(cell, text, lineIndex)) return;
      if (lineLooksLikeTactic(text)) {
        flags.push({
          type: "tactic-like",
          lineIndex: lineIndex,
          text: text,
          message: "That's a tactic."
        });
      }
    });

    return flags;
  }

  function pressureTestPlan(plan) {
    var issues = [];
    (plan.lenses || []).forEach(function (lens) {
      (lens.facets || []).forEach(function (facet) {
        (plan.horizons || []).forEach(function (h) {
          var cell = (facet.cells || {})[h.id] || {};
          pressureTestCell(cell).forEach(function (flag) {
            issues.push({
              lens: lens.name,
              lensId: lens.id,
              facet: facet.name,
              facetId: facet.id,
              horizon: h.id,
              horizonName: h.name,
              offsetDays: h.offsetDays,
              type: flag.type,
              lineIndex: flag.lineIndex,
              text: flag.text,
              message: flag.message
            });
          });
        });
      });
    });
    return issues;
  }

  function generateFilename(plan) {
    var parts = [];
    if (plan.person && plan.person.name) {
      parts.push(slugify(plan.person.name));
    } else if (plan.seat && plan.seat.title) {
      parts.push(slugify(plan.seat.title));
    }
    parts.push("30-60-90");
    return parts.join("-") + ".json";
  }

  function formatIssueLine(issue) {
    var where = (issue.lens || "") + " / " + (issue.facet || "") + " / Day " + (issue.offsetDays || issue.horizon);
    if (issue.type === "tactic-like") {
      return where + ": \"" + (issue.text || "") + "\" reads like a tactic";
    }
    return where + ": objective with no criterion";
  }

  function exportMarkdown(plan, opts) {
    opts = opts || {};
    var includeStatus = !!opts.includeStatus;
    var lines = [];
    var title = (plan.seat && plan.seat.title) ? plan.seat.title : "";
    lines.push("# 30-60-90" + (title ? ": " + title : ""));
    lines.push("");

    if (plan.startDate) {
      lines.push("Starts " + formatDateLong(fromIso(plan.startDate)));
      lines.push("");
    }
    if (plan.person && plan.person.name) {
      lines.push("**" + (plan.person.role === "hire" ? "Hire" : "Person") + ":** " + plan.person.name);
    }
    if (plan.manager && plan.manager.name) {
      lines.push("**Manager:** " + plan.manager.name);
    }
    if ((plan.person && plan.person.name) || (plan.manager && plan.manager.name)) {
      lines.push("");
    }

    var issues = pressureTestPlan(plan);
    if (issues.length) {
      lines.push("## Plan check");
      lines.push("");
      lines.push("These still need work:");
      lines.push("");
      issues.forEach(function (issue) {
        lines.push("- " + formatIssueLine(issue));
      });
      lines.push("");
    }

    (plan.lenses || []).forEach(function (lens) {
      lines.push("## " + lens.name);
      lines.push("");

      (lens.facets || []).forEach(function (facet) {
        lines.push("### " + facet.name);
        lines.push("");

        (plan.horizons || []).forEach(function (h) {
          var cell = (facet.cells || {})[h.id] || {};
          var crits = filledItems(cell.criteria);
          var tacs = filledItems(cell.tactics);
          var hasContent = String(cell.objective || "").trim() || crits.length || tacs.length || (includeStatus && String(cell.status || "").trim());
          if (!hasContent) return;

          var dateLabel = formatDateShort(fromIso(h.date));
          lines.push("#### Day " + h.offsetDays + (dateLabel ? " · " + dateLabel : "") + (h.name ? " · " + h.name : ""));
          lines.push("");

          if (cell.objective) {
            lines.push("**" + cell.objective + "**");
            lines.push("");
          }
          crits.forEach(function (c) {
            lines.push("- ✓ " + c);
          });
          if (crits.length) lines.push("");

          tacs.forEach(function (t) {
            lines.push("- ▪ " + t);
          });
          if (tacs.length) lines.push("");

          if (includeStatus && cell.status) {
            lines.push("**Status:** " + cell.status);
            lines.push("");
          }
        });
      });
    });

    return lines.join("\n");
  }

  function exportXlsx(plan) {
    if (typeof XLSX === "undefined") {
      throw new Error("SheetJS (XLSX) library not loaded");
    }

    var horizons = plan.horizons || [];
    var wb = XLSX.utils.book_new();
    var rows = [];

    var header1 = ["", ""];
    var header2 = ["", ""];
    horizons.forEach(function (h) {
      var title = h.offsetDays + " Days - " + formatDate(fromIso(h.date)) + " - " + h.name;
      header1.push(title, "", "", "");
      header2.push("Key Objectives", "Evaluation Criteria", "Tactics/Deliverables", "Status");
    });
    rows.push(header1);
    rows.push(header2);

    (plan.lenses || []).forEach(function (lens) {
      (lens.facets || []).forEach(function (facet, fi) {
        var slotCount = 1;
        horizons.forEach(function (h) {
          var cell = (facet.cells || {})[h.id] || {};
          slotCount = Math.max(slotCount, compactItems(cell.criteria).length, compactItems(cell.tactics).length, 1);
        });
        var slot;
        for (slot = 0; slot < slotCount; slot++) {
          var row = [slot === 0 && fi === 0 ? lens.name : "", slot === 0 ? facet.name : ""];
          horizons.forEach(function (h) {
            var cell = (facet.cells || {})[h.id] || {};
            var crits = compactItems(cell.criteria);
            var tacs = compactItems(cell.tactics);
            row.push(
              slot === 0 ? (cell.objective || "") : "",
              crits[slot] || "",
              tacs[slot] || "",
              slot === 0 ? (cell.status || "") : ""
            );
          });
          rows.push(row);
        }
      });
    });

    var ws = XLSX.utils.aoa_to_sheet(rows);

    var colCount = 2 + horizons.length * 4;
    ws["!cols"] = [];
    ws["!cols"][0] = { wch: 12 };
    ws["!cols"][1] = { wch: 20 };
    for (var i = 2; i < colCount; i++) {
      ws["!cols"][i] = { wch: 25 };
    }

    var merges = [];
    var col = 2;
    horizons.forEach(function () {
      merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + 3 } });
      col += 4;
    });
    ws["!merges"] = merges;

    XLSX.utils.book_append_sheet(wb, ws, "30-60-90");
    return wb;
  }

  function downloadBlob(filename, mime, text) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadXlsx(plan) {
    var wb = exportXlsx(plan);
    var filename = generateFilename(plan).replace(".json", ".xlsx");
    XLSX.writeFile(wb, filename);
  }

  function downloadMarkdown(plan, opts) {
    var md = exportMarkdown(plan, opts);
    var filename = generateFilename(plan).replace(".json", ".md");
    downloadBlob(filename, "text/markdown;charset=utf-8", md);
  }

  function downloadJson(plan) {
    var json = JSON.stringify(plan, null, 2);
    downloadBlob(generateFilename(plan), "application/json;charset=utf-8", json);
  }

  function importXlsx(workbook, template) {
    template = template || getDefaultTemplate();
    var sheetName = null;
    workbook.SheetNames.forEach(function (name) {
      if (sheetName) return;
      var ws = workbook.Sheets[name];
      var data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (data.length < 2) return;
      var row1 = (data[0] || []).map(function (c) { return String(c || "").toLowerCase(); });
      var has30 = row1.some(function (c) { return c.indexOf("30 days") >= 0 || c.indexOf("30days") >= 0; });
      var has60 = row1.some(function (c) { return c.indexOf("60 days") >= 0 || c.indexOf("60days") >= 0; });
      var has90 = row1.some(function (c) { return c.indexOf("90 days") >= 0 || c.indexOf("90days") >= 0; });
      if (has30 && has60 && has90) {
        sheetName = name;
      }
    });

    if (!sheetName) {
      throw new Error("Could not find a 30-60-90 grid sheet");
    }

    var ws = workbook.Sheets[sheetName];
    var data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    var row1 = data[0] || [];
    var horizonCols = [];
    var include180 = false;

    for (var ci = 0; ci < row1.length; ci++) {
      var val = String(row1[ci] || "").toLowerCase();
      if (val.indexOf("30 days") >= 0 || val.indexOf("30days") >= 0) {
        horizonCols.push({ id: "d30", col: ci });
      } else if (val.indexOf("60 days") >= 0 || val.indexOf("60days") >= 0) {
        horizonCols.push({ id: "d60", col: ci });
      } else if (val.indexOf("90 days") >= 0 || val.indexOf("90days") >= 0) {
        horizonCols.push({ id: "d90", col: ci });
      } else if (val.indexOf("180 days") >= 0 || val.indexOf("180days") >= 0) {
        horizonCols.push({ id: "d180", col: ci });
        include180 = true;
      }
    }

    horizonCols.sort(function (a, b) {
      var order = { d30: 1, d60: 2, d90: 3, d180: 4 };
      return order[a.id] - order[b.id];
    });

    var colsPerHorizon = 4;
    if (horizonCols.length >= 2) {
      var gap = horizonCols[1].col - horizonCols[0].col;
      if (gap === 3) colsPerHorizon = 3;
    }

    var startDate = iso(new Date());
    var horizons = computeHorizons(startDate, include180, template);

    var lensMap = {
      customer: [], business: [], technical: [], organization: []
    };
    var lensNameMap = {
      "customer": "customer", "customer/product": "customer",
      "business": "business",
      "technical": "technical", "technical/execution": "technical",
      "organization": "organization", "organization/people": "organization"
    };

    function xlsxCellItems(value) {
      var s = String(value == null ? "" : value);
      if (s.indexOf("\n") >= 0) return splitLines(s);
      return [s.replace(/\u00a0/g, " ").trim()];
    }

    function appendHorizonItems(target, row, hc) {
      var baseCol = hc.col;
      var obj = String(row[baseCol] || "").trim();
      var status = colsPerHorizon >= 4 ? String(row[baseCol + 3] || "").trim() : "";
      if (!target.cells[hc.id]) target.cells[hc.id] = emptyCell();
      var cell = target.cells[hc.id];
      if (obj && !String(cell.objective || "").trim()) cell.objective = obj;
      cell.criteria = (Array.isArray(cell.criteria) ? cell.criteria : xlsxCellItems(cell.criteria)).concat(xlsxCellItems(row[baseCol + 1]));
      cell.tactics = (Array.isArray(cell.tactics) ? cell.tactics : xlsxCellItems(cell.tactics)).concat(xlsxCellItems(row[baseCol + 2]));
      if (status && !String(cell.status || "").trim()) cell.status = status;
    }

    var currentLens = null;
    for (var ri = 2; ri < data.length; ri++) {
      var row = data[ri] || [];
      var lensCell = String(row[0] || "").trim();
      var facetName = String(row[1] || "").trim();

      if (lensCell) {
        var lensKey = lensNameMap[lensCell.toLowerCase()];
        if (lensKey) currentLens = lensKey;
      }

      if (!currentLens) continue;

      if (!facetName) {
        var prev = lensMap[currentLens][lensMap[currentLens].length - 1];
        if (!prev) continue;
        horizonCols.forEach(function (hc) {
          appendHorizonItems(prev, row, hc);
        });
        continue;
      }

      var cells = {};
      horizonCols.forEach(function (hc) {
        var baseCol = hc.col;
        cells[hc.id] = {
          objective: String(row[baseCol] || "").trim(),
          criteria: xlsxCellItems(row[baseCol + 1]),
          tactics: xlsxCellItems(row[baseCol + 2]),
          status: colsPerHorizon >= 4 ? String(row[baseCol + 3] || "").trim() : ""
        };
      });

      lensMap[currentLens].push({
        id: slugify(facetName),
        name: facetName,
        cells: cells
      });
    }

    var fallback = buildLenses(template, horizons);
    var lenses = LENS_ORDER.map(function (lensId) {
      var fallbackLens = findById(fallback, lensId);
      return {
        id: lensId,
        name: (fallbackLens && fallbackLens.name) || "",
        facets: lensMap[lensId].length > 0 ? lensMap[lensId] : (fallbackLens ? fallbackLens.facets : [])
      };
    });

    return hydratePlan({
      version: VERSION,
      kind: KIND,
      seat: { title: "Imported Plan", family: familyFromTemplate(template) },
      person: { name: "", role: "hire" },
      manager: { name: "" },
      startDate: startDate,
      include180: include180,
      template: template ? { id: template.id, version: template.version } : undefined,
      horizons: horizons,
      lenses: lenses
    });
  }

  function recomputeHorizonDates(plan, startDate) {
    var start = fromIso(startDate || plan.startDate);
    if (!start) return plan;
    plan.startDate = iso(start);
    (plan.horizons || []).forEach(function (h) {
      if (h.dateManual) return;
      var offset = h.offsetDays != null ? h.offsetDays : HORIZON_OFFSETS[h.id];
      h.date = iso(addDays(start, offset));
    });
    return plan;
  }

  function cellHasContent(cell) {
    if (!cell) return false;
    return !!(String(cell.objective || "").trim() || filledItems(cell.criteria).length || filledItems(cell.tactics).length || String(cell.status || "").trim());
  }

  function facetHasContent(facet) {
    if (!facet) return false;
    if (String(facet.name || "").trim()) return true;
    return Object.keys(facet.cells || {}).some(function (k) { return cellHasContent(facet.cells[k]); });
  }

  function uniqueFacetId(lens, name) {
    var base = slugify(name) || "facet";
    var id = base;
    var n = 2;
    while ((lens.facets || []).some(function (f) { return f.id === id; })) {
      id = base + "-" + n;
      n += 1;
    }
    return id;
  }

  function ensureFacetCells(plan, facet) {
    (plan.horizons || []).forEach(function (h) {
      if (!facet.cells) facet.cells = {};
      if (!facet.cells[h.id]) facet.cells[h.id] = emptyCell();
    });
  }

  function getLens(plan, lensId) {
    return findById(plan.lenses, lensId);
  }

  function getFacet(lens, facetId) {
    return findById(lens && lens.facets, facetId);
  }

  function getHorizon(plan, horizonId) {
    return findById(plan.horizons, horizonId);
  }

  function getCell(plan, lensId, facetId, horizonId) {
    var lens = getLens(plan, lensId);
    var facet = getFacet(lens, facetId);
    if (!facet) return null;
    if (!facet.cells) facet.cells = {};
    if (!facet.cells[horizonId]) facet.cells[horizonId] = emptyCell();
    return facet.cells[horizonId];
  }

  function fetchJson(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("Failed to load " + url);
      return res.json();
    });
  }

  function isFileProtocol() {
    return typeof location !== "undefined" && location.protocol === "file:";
  }

  function isNarrow() {
    return typeof window !== "undefined" && window.matchMedia &&
      window.matchMedia("(max-width: " + NARROW_MAX_PX + "px)").matches;
  }

  function loadTemplates(done) {
    var bundled = getBundle();
    var finished = false;
    var timer = null;
    function finish(err, bundle) {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      if (bundle) setBundle(bundle);
      done(err || null, bundle || null);
    }
    if (bundled) {
      finish(null, bundled);
      return;
    }
    if (typeof fetch === "undefined" || isFileProtocol()) {
      return finish(new Error("No template bundle"));
    }
    timer = setTimeout(function () {
      finish(new Error("Template fetch timed out"));
    }, 4000);
    fetchJson("templates/index.json").then(function (manifest) {
      var entries = manifest.templates || [];
      var loads = entries.map(function (entry) {
        return fetchJson("templates/" + entry.file).then(function (json) {
          return { id: entry.id, json: json };
        });
      });
      var facetLoad = fetchJson("templates/facet-sets.json").catch(function () { return null; });
      return Promise.all([Promise.all(loads), facetLoad]).then(function (parts) {
        var templates = {};
        parts[0].forEach(function (item) { templates[item.id] = item.json; });
        finish(null, {
          kind: "kindel.30-60-90.templates-bundle",
          version: 1,
          manifest: manifest,
          templates: templates,
          facetSets: parts[1]
        });
      });
    }).catch(function () {
      finish(new Error("No template bundle"));
    });
  }

  function ThirtySixtyNinetyEditor(opts) {
    this.rootId = (opts && opts.root) || "tsn-app";
    this.root = document.getElementById(this.rootId);
    this.plan = null;
    this.dirty = false;
    this.template = null;
    this.bundle = null;
    this.showStatus = false;
    this.collapsedLenses = {};
    this.narrowHorizon = "d30";
    this.fresh = false;
    this.peopleOpen = false;
    this.openMenuOpen = false;
    this.panel = null;
    this.undo = null;
    this.suggestFor = null;
    this.bound = false;
    this.sel = null;
    this.editing = false;
    this.editOriginal = "";
    this._pendingDirty = false;
    this._pendingValue = null;
    this.extraFacet = null;
    this.init();
  }

  ThirtySixtyNinetyEditor.prototype.init = function () {
    if (!this.root) return;
    var self = this;
    loadTemplates(function (err, bundle) {
      self.bundle = bundle;
      self.template = getDefaultTemplate(bundle);
      if (err || !self.template) return;
      self.loadDraft();
      if (!self.plan) {
        self.plan = createNewPlan({ template: self.template });
        self.fresh = true;
      }
      self.bindRootEvents();
      self.render();
      if (self.fresh && !isNarrow() && !planHasCellContent(self.plan)) self.focusFirstCell();
    });
  };

  ThirtySixtyNinetyEditor.prototype.loadDraft = function () {
    try {
      this.plan = readStoredDraft(localStorage);
    } catch (e) {}
  };

  ThirtySixtyNinetyEditor.prototype.saveDraft = function () {
    try {
      if (this.plan) localStorage.setItem(STORE_KEY, JSON.stringify(this.plan));
    } catch (e) {}
  };

  ThirtySixtyNinetyEditor.prototype.setDirty = function (dirty) {
    this.dirty = dirty;
  };

  ThirtySixtyNinetyEditor.prototype.touch = function () {
    this.setDirty(true);
    this.saveDraft();
  };

  ThirtySixtyNinetyEditor.prototype.hintsFor = function (lensId, facet, horizonId) {
    return cellHints(this.template, lensId, facet.id, facet.name, horizonId);
  };

  ThirtySixtyNinetyEditor.prototype.exampleFor = function (lensId, facet, horizonId) {
    return cellExample(this.template, lensId, facet.id, facet.name, horizonId);
  };

  ThirtySixtyNinetyEditor.prototype.bindRootEvents = function () {
    if (this.bound) return;
    this.bound = true;
    var self = this;

    this.root.addEventListener("click", function (e) { self.onClick(e); });
    this.root.addEventListener("mousedown", function (e) {
      self._pointerOutsideCell = !e.target.closest(".tsn-cell") ||
        !!e.target.closest("[data-action]") ||
        !!e.target.closest(".tsn-flag-card");
    }, true);
    this.root.addEventListener("mousedown", function (e) { self.onCellMouseDown(e); });
    this.root.addEventListener("dblclick", function (e) { self.onCellDblClick(e); });
    this.root.addEventListener("input", function (e) { self.onInput(e); });
    this.root.addEventListener("change", function (e) { self.onChange(e); });
    this.root.addEventListener("keydown", function (e) { self.onKeydown(e); });
    this.root.addEventListener("focusin", function (e) { self.onFocusIn(e); });
    this.root.addEventListener("focusout", function (e) { self.onFocusOut(e); });
    this.root.addEventListener("paste", function (e) { self.onPaste(e); });
    this.root.addEventListener("dragstart", function (e) { self.onDragStart(e); });
    this.root.addEventListener("dragover", function (e) { self.onDragOver(e); });
    this.root.addEventListener("drop", function (e) { self.onDrop(e); });

    document.addEventListener("mousedown", function (e) {
      if (!self.root.contains(e.target)) self._pointerOutsideCell = true;
    }, true);
    document.addEventListener("click", function (e) {
      if (!self.root.contains(e.target)) {
        self.openMenuOpen = false;
        var menu = self.root.querySelector(".tsn-open-menu");
        if (menu) menu.hidden = true;
      }
    });

    window.addEventListener("beforeunload", function (e) {
      if (self.dirty || self._pendingDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    });

    window.addEventListener("beforeprint", function () { self.preparePrint(); });
    window.addEventListener("afterprint", function () { self.restoreAfterPrint(); });
    if (window.matchMedia) {
      var printMq = window.matchMedia("print");
      var onPrintMq = function (e) {
        if (e.matches) self.preparePrint();
        else self.restoreAfterPrint();
      };
      if (printMq.addEventListener) printMq.addEventListener("change", onPrintMq);
      else if (printMq.addListener) printMq.addListener(onPrintMq);
    }
  };

  ThirtySixtyNinetyEditor.prototype.onCellMouseDown = function (e) {
    var cell = e.target.closest(".tsn-cell");
    if (!cell || e.target.closest("[data-action]") || e.target.closest(".tsn-flag-card") || e.target.closest(".tsn-cell-input")) return;
    var field = cell.getAttribute("data-field");
    if (!field || field === "pad") return;
    e.preventDefault();
    var sel = selFromEl(cell);
    if (!isNarrow() && sameSel(this.sel, sel) && !this.editing) {
      this.startEdit(sel, { selectAll: true });
      return;
    }
    this.selectCell(sel, { edit: isNarrow() });
  };

  ThirtySixtyNinetyEditor.prototype.onCellDblClick = function (e) {
    if (isNarrow()) return;
    if (e.target.closest(".tsn-cell-input")) return;
    var cell = e.target.closest(".tsn-cell");
    if (!cell || e.target.closest("[data-action]") || e.target.closest(".tsn-flag-card")) return;
    var field = cell.getAttribute("data-field");
    if (!field || field === "pad") return;
    e.preventDefault();
    this.startEdit(selFromEl(cell), { selectAll: true });
  };

  ThirtySixtyNinetyEditor.prototype.onClick = function (e) {
    var actionEl = e.target.closest("[data-action]");
    if (actionEl && this.root.contains(actionEl)) {
      var action = actionEl.getAttribute("data-action");
      this.handleAction(action, e, actionEl);
      return;
    }
    if (e.target.closest(".tsn-open-menu") || e.target.closest(".tsn-open-wrap")) return;
    if (this.openMenuOpen) {
      this.openMenuOpen = false;
      var menu = this.root.querySelector(".tsn-open-menu");
      if (menu) menu.hidden = true;
    }
  };

  ThirtySixtyNinetyEditor.prototype.handleAction = function (action, e, el) {
    var self = this;
    if (action === "open-menu") {
      e.stopPropagation();
      this.openMenuOpen = !this.openMenuOpen;
      var menu = this.root.querySelector(".tsn-open-menu");
      if (menu) menu.hidden = !this.openMenuOpen;
      return;
    }
    if (action === "open-json") {
      this.requestOpenFile("#tsn-file-json");
      return;
    }
    if (action === "import-xlsx") {
      this.requestOpenFile("#tsn-file-xlsx");
      return;
    }
    if (action === "start-blank") {
      this.startBlank();
      return;
    }
    if (action === "save") {
      this.commitAllEdits();
      downloadJson(this.plan);
      this.setDirty(false);
      this.saveDraft();
      return;
    }
    if (action === "export-xlsx") {
      this.commitAllEdits();
      try { downloadXlsx(this.plan); }
      catch (err) { alert("Could not export XLSX: " + err.message); }
      return;
    }
    if (action === "export-md") {
      this.commitAllEdits();
      this.withPlanCheck(function () {
        downloadMarkdown(self.plan, { includeStatus: self.showStatus });
      });
      return;
    }
    if (action === "toggle-status") {
      this.showStatus = !this.showStatus;
      this.commitAllEdits();
      this.render({ keepFocus: true });
      return;
    }
    if (action === "toggle-people") {
      this.peopleOpen = !this.peopleOpen;
      var panel = this.root.querySelector(".tsn-people-panel");
      if (panel) panel.hidden = !this.peopleOpen;
      return;
    }
    if (action === "add-180") {
      this.addHorizon180();
      return;
    }
    if (action === "remove-180") {
      this.removeHorizon180();
      return;
    }
    if (action === "add-facet") {
      this.addFacet(el.getAttribute("data-lens"));
      return;
    }
    if (action === "remove-facet") {
      this.removeFacet(el.getAttribute("data-lens"), el.getAttribute("data-facet"));
      return;
    }
    if (action === "toggle-lens") {
      var lensId = el.getAttribute("data-lens");
      this.collapsedLenses[lensId] = !this.collapsedLenses[lensId];
      this.commitAllEdits();
      this.render({ keepFocus: true });
      return;
    }
    if (action === "reset-lens") {
      this.resetLensName(el.getAttribute("data-lens"));
      return;
    }
    if (action === "reset-horizon-name") {
      this.resetHorizonName(el.getAttribute("data-horizon"));
      return;
    }
    if (action === "reset-horizon-date") {
      this.resetHorizonDate(el.getAttribute("data-horizon"));
      return;
    }
    if (action === "expand") {
      e.preventDefault();
      e.stopPropagation();
      var cell = el.closest(".tsn-cell");
      this.openPanel(cell.getAttribute("data-lens"), cell.getAttribute("data-facet"), cell.getAttribute("data-horizon"));
      return;
    }
    if (action === "close-panel") {
      this.closePanel();
      return;
    }
    if (action === "use-example") {
      this.useExample();
      return;
    }
    if (action === "move-tactic") {
      this.redirectLine(el, "move");
      return;
    }
    if (action === "rewrite-ican") {
      this.redirectLine(el, "rewrite");
      return;
    }
    if (action === "keep-line") {
      this.redirectLine(el, "keep");
      return;
    }
    if (action === "suggest-facet") {
      this.applySuggestion(el.getAttribute("data-lens"), el.getAttribute("data-facet"), el.getAttribute("data-name"));
      return;
    }
    if (action === "narrow-horizon") {
      this.narrowHorizon = el.getAttribute("data-horizon");
      this.root.querySelectorAll(".tsn-narrow-tab").forEach(function (tab) {
        tab.classList.toggle("is-active", tab.getAttribute("data-horizon") === self.narrowHorizon);
      });
      this.root.setAttribute("data-narrow-horizon", this.narrowHorizon);
      var host = this.root.closest(".tsn-host");
      if (host) host.setAttribute("data-narrow-horizon", this.narrowHorizon);
      return;
    }
    if (action === "undo") {
      this.applyUndo();
      return;
    }
    if (action === "dismiss-undo") {
      this.undo = null;
      var toast = this.root.querySelector(".tsn-toast");
      if (toast) toast.remove();
      return;
    }
    if (action === "plan-check-fix") {
      this.fixFirstIssue();
      return;
    }
    if (action === "plan-check-anyway") {
      var resume = this._planCheckResume;
      this._planCheckResume = null;
      this.closeModal();
      if (resume) resume();
      return;
    }
    if (action === "plan-check-cancel") {
      this._planCheckResume = null;
      this.closeModal();
      return;
    }
    if (action === "confirm-ok") {
      var ok = this._confirmOk;
      this._confirmOk = null;
      this.closeModal();
      if (ok) ok();
      return;
    }
    if (action === "confirm-cancel") {
      this._confirmOk = null;
      this.closeModal();
      return;
    }
  };

  ThirtySixtyNinetyEditor.prototype.onInput = function (e) {
    var t = e.target;
    if (t.classList.contains("tsn-cell-input")) {
      this.notePendingEdit(t.value);
      return;
    }
    if (t.classList.contains("tsn-seat-title")) {
      this.plan.seat.title = t.textContent.replace(/\u00a0/g, " ").trim();
      this.touch();
      t.classList.toggle("is-empty", !this.plan.seat.title);
      return;
    }
    if (t.classList.contains("tsn-facet-name")) {
      var lens = getLens(this.plan, t.getAttribute("data-lens"));
      var facet = getFacet(lens, t.getAttribute("data-facet"));
      if (facet) {
        facet.name = t.textContent.replace(/\u00a0/g, " ").trim();
        this.touch();
      }
      return;
    }
    if (t.classList.contains("tsn-lens-name")) {
      var ln = getLens(this.plan, t.getAttribute("data-lens"));
      if (ln) {
        ln.name = t.textContent.replace(/\u00a0/g, " ").trim();
        this.touch();
        this.updateLensReset(ln.id);
      }
      return;
    }
    if (t.classList.contains("tsn-horizon-name")) {
      var h = getHorizon(this.plan, t.getAttribute("data-horizon"));
      if (h) {
        h.name = t.textContent.replace(/\u00a0/g, " ").trim();
        this.touch();
        this.updateHorizonNameReset(h.id);
      }
      return;
    }
    if (t.classList.contains("tsn-person-name")) {
      if (!this.plan.person) this.plan.person = { name: "", role: "hire" };
      this.plan.person.name = t.value;
      this.touch();
      return;
    }
    if (t.classList.contains("tsn-manager-name")) {
      if (!this.plan.manager) this.plan.manager = { name: "" };
      this.plan.manager.name = t.value;
      this.touch();
      return;
    }
    if (t.classList.contains("tsn-panel-field")) {
      this.syncPanelToCell();
      this.refreshPanelFlags();
      return;
    }
  };

  ThirtySixtyNinetyEditor.prototype.onChange = function (e) {
    var t = e.target;
    if (t.id === "tsn-file-json") {
      this.openJsonFile(t);
      return;
    }
    if (t.id === "tsn-file-xlsx") {
      this.openXlsxFile(t);
      return;
    }
    if (t.classList.contains("tsn-start-date-input")) {
      if (!t.value) return;
      recomputeHorizonDates(this.plan, t.value);
      this.touch();
      this.render();
      return;
    }
    if (t.classList.contains("tsn-horizon-date-input")) {
      var h = getHorizon(this.plan, t.getAttribute("data-horizon"));
      if (!h || !t.value) return;
      h.date = t.value;
      h.dateManual = true;
      this.touch();
      this.render({ keepFocus: true });
    }
  };

  ThirtySixtyNinetyEditor.prototype.onKeydown = function (e) {
    if (this.root.querySelector(".tsn-confirm")) return;
    if (e.target.closest && e.target.closest(".tsn-people-panel")) return;
    if (e.target.classList && (e.target.classList.contains("tsn-start-date-input") || e.target.classList.contains("tsn-horizon-date-input"))) return;
    if (e.target.classList && e.target.classList.contains("tsn-editable") && !e.target.closest(".tsn-cell")) return;
    if (e.target.classList && e.target.classList.contains("tsn-cell-input")) {
      this.onEditKeydown(e);
      return;
    }
    if (isNarrow()) return;
    if (e.target.closest && (e.target.closest("[data-action]") || e.target.closest(".tsn-flag-card"))) return;
    var gridCell = e.target.closest ? e.target.closest(".tsn-cell") : null;
    if (!gridCell || gridCell.getAttribute("data-field") === "pad") return;
    if (this.sel && !this.editing) this.onGridKeydown(e);
  };

  ThirtySixtyNinetyEditor.prototype.onFocusIn = function (e) {
    var cell = e.target.closest(".tsn-cell");
    if (!cell) return;
    if (e.target.classList.contains("tsn-cell-input")) {
      cell.classList.add("is-editing");
      return;
    }
    if (e.target !== cell) return;
    if (cell.getAttribute("data-field") === "pad") return;
    var sel = selFromEl(cell);
    if (!sel || sameSel(this.sel, sel) || this.editing) return;
    this.sel = sel;
    this.markSelected();
  };

  ThirtySixtyNinetyEditor.prototype.onFocusOut = function (e) {
    if (this._rendering) return;
    if (!this.editing) return;
    if (!e.target.classList || !e.target.classList.contains("tsn-cell-input")) return;
    var cell = e.target.closest(".tsn-cell");
    var next = e.relatedTarget;
    if (next && cell && cell.contains(next)) return;
    this.commitEdit();
    var leaveGrid = this._pointerOutsideCell || !!(next && this.root.contains(next) && !(cell && cell.contains(next)));
    var self = this;
    setTimeout(function () {
      self._pointerOutsideCell = false;
      if (!self.root || self.editing || self._rendering) return;
      if (self.root.querySelector(".tsn-confirm")) return;
      var active = document.activeElement;
      var keepOutside = leaveGrid || (active && self.root.contains(active) && !active.closest(".tsn-cell"));
      self.render({ keepFocus: !keepOutside });
      if (!keepOutside) self.focusSelected();
    }, 0);
  };

  ThirtySixtyNinetyEditor.prototype.onPaste = function (e) {
    var text = ((e.clipboardData || window.clipboardData).getData("text/plain") || "").replace(/\r\n/g, "\n");
    if (!text) return;
    if (e.target.classList && e.target.classList.contains("tsn-cell-input")) {
      if (text.indexOf("\n") < 0) return;
      e.preventDefault();
      this.commitEdit();
      this.pasteIntoSel(text);
      return;
    }
    if (this.sel && !this.editing && e.target.closest && e.target.closest(".tsn-cell")) {
      e.preventDefault();
      this.pasteIntoSel(text);
    }
  };

  ThirtySixtyNinetyEditor.prototype.onDragStart = function (e) {
    var handle = e.target.closest("[data-drag-facet]");
    if (!handle) return;
    e.dataTransfer.setData("text/plain", handle.getAttribute("data-lens") + ":" + handle.getAttribute("data-facet"));
    e.dataTransfer.effectAllowed = "move";
    this._drag = {
      lensId: handle.getAttribute("data-lens"),
      facetId: handle.getAttribute("data-facet")
    };
  };

  ThirtySixtyNinetyEditor.prototype.onDragOver = function (e) {
    var row = e.target.closest("tr[data-facet]");
    if (!row || !this._drag) return;
    if (row.getAttribute("data-lens") !== this._drag.lensId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  ThirtySixtyNinetyEditor.prototype.onDrop = function (e) {
    var row = e.target.closest("tr[data-facet]");
    if (!row || !this._drag) return;
    e.preventDefault();
    var lensId = this._drag.lensId;
    if (row.getAttribute("data-lens") !== lensId) return;
    var lens = getLens(this.plan, lensId);
    var fromId = this._drag.facetId;
    var toId = row.getAttribute("data-facet");
    this._drag = null;
    if (!lens || fromId === toId) return;
    var from = -1;
    var to = -1;
    lens.facets.forEach(function (f, i) {
      if (f.id === fromId) from = i;
      if (f.id === toId) to = i;
    });
    if (from < 0 || to < 0) return;
    var moved = lens.facets.splice(from, 1)[0];
    lens.facets.splice(to, 0, moved);
    this.touch();
    this.render();
  };

  ThirtySixtyNinetyEditor.prototype.facetSlotCount = function (lens, facet) {
    var n = 1;
    (this.plan.horizons || []).forEach(function (h) {
      var cell = (facet.cells && facet.cells[h.id]) || {};
      n = Math.max(n, compactItems(cell.criteria).length, compactItems(cell.tactics).length, 1);
    });
    if (this.extraFacet && lens && this.extraFacet.lensId === lens.id && this.extraFacet.facetId === facet.id) {
      n += 1;
    }
    return n;
  };

  ThirtySixtyNinetyEditor.prototype.gridCoords = function () {
    var coords = [];
    var self = this;
    (this.plan.lenses || []).forEach(function (lens) {
      if (self.collapsedLenses[lens.id]) return;
      (lens.facets || []).forEach(function (facet) {
        var slots = self.facetSlotCount(lens, facet);
        var s;
        for (s = 0; s < slots; s++) {
          (self.plan.horizons || []).forEach(function (h) {
            if (s === 0) coords.push({ lensId: lens.id, facetId: facet.id, horizonId: h.id, field: "objective", index: 0 });
            coords.push({ lensId: lens.id, facetId: facet.id, horizonId: h.id, field: "criteria", index: s });
            coords.push({ lensId: lens.id, facetId: facet.id, horizonId: h.id, field: "tactics", index: s });
            if (s === 0 && self.showStatus) {
              coords.push({ lensId: lens.id, facetId: facet.id, horizonId: h.id, field: "status", index: 0 });
            }
          });
        }
      });
    });
    return coords;
  };

  ThirtySixtyNinetyEditor.prototype.writeSel = function (sel, value, plan) {
    if (!sel) return;
    var cell = getCell(plan || this.plan, sel.lensId, sel.facetId, sel.horizonId);
    if (!cell) return;
    if (sel.field === "objective" || sel.field === "status") {
      cell[sel.field] = String(value == null ? "" : value).replace(/\u00a0/g, " ").trim();
    } else {
      setItem(cell, sel.field, sel.index, value);
    }
    pruneDismissals(cell);
  };

  ThirtySixtyNinetyEditor.prototype.commitEdit = function () {
    if (!this.editing || !this.sel) return;
    var input = this.root.querySelector(".tsn-cell-input");
    var value = input ? input.value : this.editOriginal;
    this.writeSel(this.sel, value);
    this.editing = false;
    this.editOriginal = "";
    this._pendingDirty = false;
    this._pendingValue = null;
    this.extraFacet = null;
    this.touch();
  };

  ThirtySixtyNinetyEditor.prototype.commitAllEdits = function () {
    this.commitEdit();
    this.syncPanelToCell();
  };

  ThirtySixtyNinetyEditor.prototype.cancelEdit = function () {
    this.editing = false;
    this.editOriginal = "";
    this._pendingDirty = false;
    this._pendingValue = null;
    this.saveDraft();
    this.render({ keepFocus: true });
    this.focusSelected();
  };

  ThirtySixtyNinetyEditor.prototype.notePendingEdit = function (value) {
    this._pendingValue = value;
    this._pendingDirty = String(value) !== String(this.editOriginal || "");
    if (!this._pendingDirty || !this.plan || !this.sel) {
      this.saveDraft();
      return;
    }
    try {
      var snapshot = JSON.parse(JSON.stringify(this.plan));
      this.writeSel(this.sel, value, snapshot);
      localStorage.setItem(STORE_KEY, JSON.stringify(snapshot));
    } catch (e) {}
  };

  ThirtySixtyNinetyEditor.prototype.selectCell = function (sel, opts) {
    opts = opts || {};
    var committed = false;
    if (this.editing) {
      this.commitEdit();
      committed = true;
    }
    this.sel = sel;
    this.editing = false;
    if (opts.edit) {
      this.startEdit(sel, opts);
      return;
    }
    if (committed) {
      this.render({ keepFocus: true });
      this.focusSelected();
      return;
    }
    this.markSelected();
  };

  ThirtySixtyNinetyEditor.prototype.markSelected = function () {
    if (!this.root || !this.sel) return;
    this.root.querySelectorAll(".tsn-cell.is-selected").forEach(function (el) {
      el.classList.remove("is-selected");
      el.tabIndex = -1;
    });
    var el = this.root.querySelector(this.cellSelector(this.sel.lensId, this.sel.facetId, this.sel.horizonId, this.sel.field, this.sel.index));
    if (el) {
      el.classList.add("is-selected");
      el.tabIndex = 0;
      if (el.focus) el.focus();
    }
  };

  ThirtySixtyNinetyEditor.prototype.startEdit = function (sel, opts) {
    opts = opts || {};
    if (this.editing && this.sel && !sameSel(this.sel, sel)) this.commitEdit();
    this.sel = sel;
    this.editing = true;
    var cell = getCell(this.plan, sel.lensId, sel.facetId, sel.horizonId);
    this.editOriginal = cellItemText(cell, sel.field, sel.index);
    this.render({ keepFocus: true });
    var input = this.root.querySelector(".tsn-cell-input");
    if (!input) return;
    input.focus();
    if (opts.replace != null) {
      input.value = opts.replace;
      input.setSelectionRange(input.value.length, input.value.length);
    } else if (opts.selectAll) {
      input.select();
    } else {
      input.setSelectionRange(input.value.length, input.value.length);
    }
  };

  ThirtySixtyNinetyEditor.prototype.focusSelected = function () {
    if (!this.sel || !this.root) return;
    if (this.editing) {
      var input = this.root.querySelector(".tsn-cell-input");
      if (input) input.focus();
      return;
    }
    var el = this.root.querySelector(this.cellSelector(this.sel.lensId, this.sel.facetId, this.sel.horizonId, this.sel.field, this.sel.index));
    if (el && el.focus) el.focus();
  };

  ThirtySixtyNinetyEditor.prototype.cellSelector = function (lensId, facetId, horizonId, field, index) {
    var sel = '.tsn-cell[data-lens="' + lensId + '"][data-facet="' + facetId + '"][data-horizon="' + horizonId + '"][data-field="' + field + '"]';
    if (index != null) sel += '[data-index="' + index + '"]';
    return sel;
  };

  ThirtySixtyNinetyEditor.prototype.focusCell = function (lensId, facetId, horizonId, field, lineIndex) {
    var mapped = field === "oc" ? "objective" : field;
    var index = 0;
    if (mapped === "criteria" || mapped === "tactics") index = lineIndex == null ? 0 : lineIndex;
    if (field === "oc" && lineIndex != null && lineIndex > 0) {
      mapped = "criteria";
      index = lineIndex - 1;
    }
    this.selectCell({ lensId: lensId, facetId: facetId, horizonId: horizonId, field: mapped, index: index });
  };

  ThirtySixtyNinetyEditor.prototype.focusFirstCell = function () {
    var lens = this.plan.lenses[0];
    var facet = lens && lens.facets[0];
    var h = this.plan.horizons[0];
    if (lens && facet && h) {
      this.selectCell({ lensId: lens.id, facetId: facet.id, horizonId: h.id, field: "objective", index: 0 });
    }
  };

  ThirtySixtyNinetyEditor.prototype.moveSel = function (dir) {
    if (!this.sel) return false;
    var coords = this.gridCoords();
    var current = this.sel;
    var idx = -1;
    coords.forEach(function (c, i) {
      if (sameSel(c, current)) idx = i;
    });
    if (idx < 0) {
      if (coords[0]) this.selectCell(coords[0]);
      return !!coords[0];
    }
    var next = idx;
    if (dir === "right") next = Math.min(coords.length - 1, idx + 1);
    if (dir === "left") next = Math.max(0, idx - 1);
    if (dir === "down" || dir === "up") {
      var col = coords.filter(function (c) {
        return c.horizonId === current.horizonId && c.field === current.field;
      });
      var colIdx = -1;
      col.forEach(function (c, i) {
        if (sameSel(c, current)) colIdx = i;
      });
      if (colIdx < 0) return false;
      var dest = dir === "down" ? colIdx + 1 : colIdx - 1;
      if (dest < 0 || dest >= col.length) return false;
      this.selectCell(col[dest]);
      return true;
    }
    if (next === idx) return false;
    this.selectCell(coords[next]);
    return true;
  };

  ThirtySixtyNinetyEditor.prototype.onGridKeydown = function (e) {
    if (!this.sel) return;
    if (e.key === "ArrowRight") { e.preventDefault(); this.moveSel("right"); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); this.moveSel("left"); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); this.moveSel("down"); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); this.moveSel("up"); return; }
    if (e.key === "Tab") {
      if (!this.moveSel(e.shiftKey ? "left" : "right")) return;
      e.preventDefault();
      return;
    }
    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      this.startEdit(this.sel);
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      this.clearOrRemoveSelected();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C")) {
      e.preventDefault();
      this.copySelected();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "v" || e.key === "V")) {
      return;
    }
    if (isTypingKey(e)) {
      e.preventDefault();
      this.startEdit(this.sel, { replace: e.key });
    }
  };

  ThirtySixtyNinetyEditor.prototype.onEditKeydown = function (e) {
    if (e.key === "Escape") {
      e.preventDefault();
      this.cancelEdit();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      this.finishEditAndMove(e.shiftKey ? "left" : "right");
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.finishEditAndMove("down");
      return;
    }
    if ((e.key === "Backspace" || e.key === "Delete") &&
        this.sel && (this.sel.field === "criteria" || this.sel.field === "tactics") &&
        !String(e.target.value || "").trim()) {
      e.preventDefault();
      this.editing = false;
      this.editOriginal = "";
      this.clearOrRemoveSelected();
    }
  };

  ThirtySixtyNinetyEditor.prototype.finishEditAndMove = function (dir) {
    var sel = this.sel;
    var input = this.root.querySelector(".tsn-cell-input");
    var value = input ? input.value : "";
    this.commitEdit();
    if (dir === "down" && sel && (sel.field === "criteria" || sel.field === "tactics") && String(value).trim()) {
      var lens = getLens(this.plan, sel.lensId);
      var facet = getFacet(lens, sel.facetId);
      var last = facet ? this.facetSlotCount(lens, facet) - 1 : sel.index;
      if (sel.index >= last) {
        this.extraFacet = { lensId: sel.lensId, facetId: sel.facetId };
        this.startEdit({
          lensId: sel.lensId,
          facetId: sel.facetId,
          horizonId: sel.horizonId,
          field: sel.field,
          index: sel.index + 1
        });
        return;
      }
    }
    this.clampSel();
    this.render({ keepFocus: true });
    if (!this.moveSel(dir) && (dir === "left" || dir === "right")) {
      var exit = dir === "left"
        ? this.root.querySelector(".tsn-people-link")
        : this.root.querySelector(".tsn-add-180") || this.root.querySelector(".tsn-people-link");
      if (exit && exit.focus) exit.focus();
    }
  };

  ThirtySixtyNinetyEditor.prototype.clearOrRemoveSelected = function () {
    var sel = this.sel;
    if (!sel) return;
    var cell = getCell(this.plan, sel.lensId, sel.facetId, sel.horizonId);
    var text = cellItemText(cell, sel.field, sel.index);
    if (String(text).trim()) {
      this.writeSel(sel, "");
      this.clampSel();
      this.touch();
      this.render({ keepFocus: true });
      this.focusSelected();
      return;
    }
    if (sel.field !== "criteria" && sel.field !== "tactics") return;
    var lens = getLens(this.plan, sel.lensId);
    var facet = getFacet(lens, sel.facetId);
    var last = facet ? this.facetSlotCount(lens, facet) - 1 : sel.index;
    if (this.extraFacet && this.extraFacet.lensId === sel.lensId && this.extraFacet.facetId === sel.facetId && sel.index >= last) {
      this.extraFacet = null;
    } else {
      removeItem(cell, sel.field, sel.index);
    }
    this.clampSel();
    this.touch();
    this.render({ keepFocus: true });
    this.focusSelected();
  };

  ThirtySixtyNinetyEditor.prototype.clampSel = function () {
    if (!this.sel || !this.plan) return;
    var coords = this.gridCoords();
    if (!coords.length) {
      this.sel = null;
      return;
    }
    var current = this.sel;
    var found = coords.some(function (c) { return sameSel(c, current); });
    if (found) return;
    var lens = getLens(this.plan, current.lensId);
    var facet = getFacet(lens, current.facetId);
    if (!facet) {
      this.sel = coords[0];
      return;
    }
    var last = Math.max(0, this.facetSlotCount(lens, facet) - 1);
    this.sel = {
      lensId: current.lensId,
      facetId: current.facetId,
      horizonId: current.horizonId,
      field: current.field,
      index: Math.min(current.index || 0, last)
    };
  };

  ThirtySixtyNinetyEditor.prototype.copySelected = function () {
    var sel = this.sel;
    if (!sel) return;
    var cell = getCell(this.plan, sel.lensId, sel.facetId, sel.horizonId);
    var text = cellItemText(cell, sel.field, sel.index);
    this._clip = text;
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {});
    }
  };

  ThirtySixtyNinetyEditor.prototype.pasteIntoSel = function (text) {
    var sel = this.sel;
    if (!sel) return;
    var cell = getCell(this.plan, sel.lensId, sel.facetId, sel.horizonId);
    if (!cell) return;
    var lines = String(text || "").replace(/\r\n/g, "\n").split("\n").map(function (l) { return l.trim(); }).filter(function (l) { return l; });
    if ((sel.field === "criteria" || sel.field === "tactics") && lines.length > 1) {
      var i;
      for (i = 0; i < lines.length; i++) setItem(cell, sel.field, sel.index + i, lines[i]);
      this.extraFacet = null;
      this.sel = {
        lensId: sel.lensId,
        facetId: sel.facetId,
        horizonId: sel.horizonId,
        field: sel.field,
        index: sel.index + lines.length - 1
      };
    } else if (sel.field === "objective" || sel.field === "status") {
      this.writeSel(sel, String(text || "").replace(/\r\n/g, "\n").replace(/^\n+|\n+$/g, ""));
    } else {
      this.writeSel(sel, lines[0] || String(text || "").replace(/\n/g, " ").trim());
    }
    this.editing = false;
    this.touch();
    this.render({ keepFocus: true });
    this.focusSelected();
  };

  function flagCardHtml(flag) {
    return '<div class="tsn-flag-card" data-line="' + flag.lineIndex + '">' +
      '<div class="tsn-flag-note">That\'s a tactic.</div>' +
      '<div class="tsn-flag-actions">' +
        '<button type="button" class="tsn-btn tsn-btn-primary" data-action="move-tactic">Move to Tactics</button>' +
        '<button type="button" class="tsn-btn" data-action="rewrite-ican">Rewrite as I can…</button>' +
        '<button type="button" class="tsn-btn" data-action="keep-line">Keep</button>' +
      "</div>" +
    "</div>";
  }

  ThirtySixtyNinetyEditor.prototype.refreshPanelFlags = function () {
    if (!this.panel) return;
    var host = this.root.querySelector(".tsn-panel-flags");
    if (!host) return;
    var cell = getCell(this.plan, this.panel.lensId, this.panel.facetId, this.panel.horizonId);
    var flags = pressureTestCell(cell);
    host.innerHTML = flags.filter(function (flag) { return flag.type === "tactic-like"; }).map(flagCardHtml).join("");
  };

  ThirtySixtyNinetyEditor.prototype.redirectLine = function (el, mode) {
    this.commitEdit();
    var cellEl = el.closest(".tsn-cell");
    var card = el.closest(".tsn-flag-card");
    if (!card) return;
    var lineIndex = parseInt(card.getAttribute("data-line"), 10);
    if (cellEl && (isNaN(lineIndex) || lineIndex < 0)) {
      lineIndex = parseInt(cellEl.getAttribute("data-index") || "0", 10) || 0;
    }
    var lensId;
    var facetId;
    var horizonId;
    if (cellEl) {
      lensId = cellEl.getAttribute("data-lens");
      facetId = cellEl.getAttribute("data-facet");
      horizonId = cellEl.getAttribute("data-horizon");
    } else if (this.panel) {
      lensId = this.panel.lensId;
      facetId = this.panel.facetId;
      horizonId = this.panel.horizonId;
    } else {
      return;
    }
    var cell = getCell(this.plan, lensId, facetId, horizonId);
    var crits = compactItems(cell.criteria);
    if (lineIndex < 0 || lineIndex >= crits.length) return;
    if (mode === "move") {
      var moved = crits.splice(lineIndex, 1)[0];
      cell.criteria = compactItems(crits);
      var tacs = compactItems(cell.tactics);
      tacs.push(moved);
      cell.tactics = compactItems(tacs);
      pruneDismissals(cell);
      this.touch();
      this.sel = {
        lensId: lensId,
        facetId: facetId,
        horizonId: horizonId,
        field: "tactics",
        index: Math.max(0, cell.tactics.length - 1)
      };
      this.editing = false;
      this.render({ keepFocus: true });
      this.focusSelected();
      return;
    }
    if (mode === "rewrite") {
      setItem(cell, "criteria", lineIndex, "I can ");
      pruneDismissals(cell);
      this.touch();
      this.startEdit({
        lensId: lensId,
        facetId: facetId,
        horizonId: horizonId,
        field: "criteria",
        index: lineIndex
      });
      return;
    }
    if (mode === "keep") {
      var kept = crits[lineIndex];
      if (!cell.dismissed) cell.dismissed = [];
      if (cell.dismissed.indexOf(lineIndex) < 0) cell.dismissed.push(lineIndex);
      if (!cell.dismissedText) cell.dismissedText = [];
      if (!dismissedTextSet(cell)[normLine(kept)]) cell.dismissedText.push(kept);
      this.touch();
      this.render({ keepFocus: true });
      this.focusSelected();
    }
  };

  ThirtySixtyNinetyEditor.prototype.addFacet = function (lensId) {
    var lens = getLens(this.plan, lensId);
    if (!lens) return;
    this.commitAllEdits();
    var facet = {
      id: uniqueFacetId(lens, "facet-" + Date.now()),
      name: "",
      cells: emptyCells(this.plan.horizons)
    };
    lens.facets.push(facet);
    this.suggestFor = { lensId: lensId, facetId: facet.id };
    this.touch();
    this.render();
    var nameEl = this.root.querySelector('.tsn-facet-name[data-lens="' + lensId + '"][data-facet="' + facet.id + '"]');
    if (nameEl) {
      nameEl.focus();
    }
  };

  ThirtySixtyNinetyEditor.prototype.applySuggestion = function (lensId, facetId, name) {
    var lens = getLens(this.plan, lensId);
    var facet = getFacet(lens, facetId);
    if (!facet) return;
    facet.name = name;
    facet.id = uniqueFacetId(lens, name);
    this.suggestFor = null;
    this.touch();
    this.render();
  };

  ThirtySixtyNinetyEditor.prototype.removeFacet = function (lensId, facetId) {
    var self = this;
    var lens = getLens(this.plan, lensId);
    if (!lens) return;
    var idx = -1;
    lens.facets.forEach(function (f, i) { if (f.id === facetId) idx = i; });
    if (idx < 0) return;
    var facet = lens.facets[idx];
    var go = function () {
      var removed = lens.facets.splice(idx, 1)[0];
      self.undo = { type: "facet", lensId: lensId, index: idx, facet: removed };
      self.touch();
      self.render();
      self.showUndo("Removed " + (removed.name || "facet") + ".");
    };
    if (!facetHasContent(facet)) {
      go();
      return;
    }
    this.askConfirm("Remove this row and its cell content?", "Remove", go);
  };

  ThirtySixtyNinetyEditor.prototype.showUndo = function (message) {
    var existing = this.root.querySelector(".tsn-toast");
    if (existing) existing.remove();
    this.root.insertAdjacentHTML("beforeend",
      '<div class="tsn-toast" role="status">' + esc(message) +
        ' <button type="button" class="tsn-btn" data-action="undo">Undo</button>' +
        ' <button type="button" class="tsn-toast-x" data-action="dismiss-undo" aria-label="Dismiss">×</button>' +
      "</div>");
    var self = this;
    clearTimeout(this._undoTimer);
    this._undoTimer = setTimeout(function () {
      self.undo = null;
      var toast = self.root.querySelector(".tsn-toast");
      if (toast) toast.remove();
    }, 8000);
  };

  ThirtySixtyNinetyEditor.prototype.applyUndo = function () {
    if (!this.undo || this.undo.type !== "facet") return;
    var lens = getLens(this.plan, this.undo.lensId);
    if (!lens) return;
    var idx = Math.min(this.undo.index, lens.facets.length);
    lens.facets.splice(idx, 0, this.undo.facet);
    this.undo = null;
    this.touch();
    this.render();
  };

  ThirtySixtyNinetyEditor.prototype.resetLensName = function (lensId) {
    var lens = getLens(this.plan, lensId);
    var src = templateLens(this.template, lensId);
    if (!lens || !src) return;
    lens.name = src.name;
    this.touch();
    this.render({ keepFocus: true });
  };

  ThirtySixtyNinetyEditor.prototype.resetHorizonName = function (horizonId) {
    var h = getHorizon(this.plan, horizonId);
    var src = templateHorizon(this.template, horizonId);
    if (!h || !src) return;
    h.name = src.name;
    this.touch();
    this.render({ keepFocus: true });
  };

  ThirtySixtyNinetyEditor.prototype.resetHorizonDate = function (horizonId) {
    var h = getHorizon(this.plan, horizonId);
    if (!h) return;
    h.dateManual = false;
    recomputeHorizonDates(this.plan, this.plan.startDate);
    this.touch();
    this.render({ keepFocus: true });
  };

  ThirtySixtyNinetyEditor.prototype.updateLensReset = function (lensId) {
    var btn = this.root.querySelector('.tsn-reset-lens[data-lens="' + lensId + '"]');
    var lens = getLens(this.plan, lensId);
    var src = templateLens(this.template, lensId);
    if (btn) btn.hidden = !(src && lens && lens.name !== src.name);
  };

  ThirtySixtyNinetyEditor.prototype.updateHorizonNameReset = function (horizonId) {
    var btn = this.root.querySelector('.tsn-reset-hname[data-horizon="' + horizonId + '"]');
    var h = getHorizon(this.plan, horizonId);
    var src = templateHorizon(this.template, horizonId);
    if (btn) btn.hidden = !(src && h && h.name !== src.name);
  };

  ThirtySixtyNinetyEditor.prototype.addHorizon180 = function () {
    if (this.plan.horizons.some(function (h) { return h.id === "d180"; })) return;
    var src = templateHorizon(this.template, "d180") || { id: "d180", offsetDays: 180, name: "" };
    var start = fromIso(this.plan.startDate) || new Date();
    this.plan.horizons.push({
      id: "d180",
      offsetDays: src.offsetDays || 180,
      name: src.name || "",
      date: iso(addDays(start, src.offsetDays || 180))
    });
    this.plan.include180 = true;
    this.plan.lenses.forEach(function (lens) {
      lens.facets.forEach(function (facet) {
        if (!facet.cells) facet.cells = {};
        facet.cells.d180 = emptyCell();
      });
    });
    this.touch();
    this.render();
  };

  ThirtySixtyNinetyEditor.prototype.removeHorizon180 = function () {
    var used = this.plan.lenses.some(function (lens) {
      return lens.facets.some(function (facet) {
        return cellHasContent((facet.cells || {}).d180);
      });
    });
    var self = this;
    var go = function () {
      self.plan.horizons = self.plan.horizons.filter(function (h) { return h.id !== "d180"; });
      self.plan.include180 = false;
      self.plan.lenses.forEach(function (lens) {
        lens.facets.forEach(function (facet) {
          if (facet.cells) delete facet.cells.d180;
        });
      });
      self.touch();
      self.render();
    };
    if (used) this.askConfirm("Remove the 180-day column and its content?", "Remove", go);
    else go();
  };

  ThirtySixtyNinetyEditor.prototype.startBlank = function () {
    var self = this;
    this.commitAllEdits();
    if (!planHasCellContent(this.plan)) return;
    this.askConfirm("Clear all objectives, criteria, and tactics? Facet names and dates stay.", "Start blank", function () {
      self.plan.lenses.forEach(function (lens) {
        (lens.facets || []).forEach(function (facet) {
          Object.keys(facet.cells || {}).forEach(function (hid) {
            facet.cells[hid] = emptyCell();
          });
        });
      });
      self.plan.startedBlank = true;
      self.fresh = true;
      self.panel = null;
      self.touch();
      self.render();
      if (!isNarrow()) self.focusFirstCell();
    });
  };

  ThirtySixtyNinetyEditor.prototype.requestOpenFile = function (inputId) {
    var self = this;
    this.openMenuOpen = false;
    var menu = this.root.querySelector(".tsn-open-menu");
    if (menu) menu.hidden = true;
    var go = function () {
      var input = self.root.querySelector(inputId);
      if (input) input.click();
    };
    if (!this.dirty) {
      go();
      return;
    }
    this.askConfirm("Replace the open plan with a file? Unsaved edits will be overwritten.", "Open", go);
  };

  ThirtySixtyNinetyEditor.prototype.preparePrint = function () {
    if (this._printing) return;
    this._printing = true;
    this.commitAllEdits();
    this._printCollapsed = {};
    Object.keys(this.collapsedLenses || {}).forEach(function (id) {
      this._printCollapsed[id] = this.collapsedLenses[id];
    }, this);
    this.collapsedLenses = {};
    if (this.root && this.root.classList) {
      this.root.classList.toggle("tsn-print-status", !!this.showStatus);
    }
    this.render();
  };

  ThirtySixtyNinetyEditor.prototype.restoreAfterPrint = function () {
    if (!this._printing) return;
    this._printing = false;
    this.collapsedLenses = this._printCollapsed || {};
    this._printCollapsed = null;
    this.render({ keepFocus: true });
  };

  ThirtySixtyNinetyEditor.prototype.openJsonFile = function (input) {
    var self = this;
    var file = input.files[0];
    input.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var plan = JSON.parse(e.target.result);
        var result = validatePlan(plan);
        if (!result.valid) {
          alert("Invalid file: " + result.error);
          return;
        }
        self.plan = hydratePlan(plan);
        if (!planHasCellContent(self.plan)) self.plan.startedBlank = true;
        self.fresh = false;
        self.setDirty(false);
        self.saveDraft();
        self.render();
      } catch (err) {
        alert("Could not parse JSON: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  ThirtySixtyNinetyEditor.prototype.openXlsxFile = function (input) {
    var self = this;
    var file = input.files[0];
    input.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        if (typeof XLSX === "undefined") {
          alert("SheetJS library not loaded. Cannot import XLSX.");
          return;
        }
        var data = new Uint8Array(e.target.result);
        var workbook = XLSX.read(data, { type: "array" });
        self.plan = importXlsx(workbook, self.template);
        if (!planHasCellContent(self.plan)) self.plan.startedBlank = true;
        self.fresh = false;
        self.setDirty(true);
        self.saveDraft();
        self.render();
      } catch (err) {
        alert("Could not import XLSX: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  ThirtySixtyNinetyEditor.prototype.withPlanCheck = function (proceed) {
    var issues = pressureTestPlan(this.plan);
    if (!issues.length) {
      proceed();
      return;
    }
    this._planCheckResume = proceed;
    var items = issues.map(function (issue) {
      return "<li>" + esc(formatIssueLine(issue)) + "</li>";
    }).join("");
    this.showModal(
      "<h2 id=\"tsn-modal-title\">Plan check</h2>" +
      "<p>These cells still need work. Redirect a tactic; do not leave a hire with a to-do list.</p>" +
      "<ul class=\"tsn-check-list\">" + items + "</ul>" +
      "<div class=\"tsn-confirm-actions\">" +
        "<button type=\"button\" class=\"tsn-btn\" data-action=\"plan-check-cancel\">Cancel</button>" +
        "<button type=\"button\" class=\"tsn-btn\" data-action=\"plan-check-fix\">Fix</button>" +
        "<button type=\"button\" class=\"tsn-btn tsn-btn-primary\" data-action=\"plan-check-anyway\">Export anyway</button>" +
      "</div>",
      { label: "Plan check", labelledBy: "tsn-modal-title" }
    );
  };

  ThirtySixtyNinetyEditor.prototype.fixFirstIssue = function () {
    var issues = pressureTestPlan(this.plan);
    this.closeModal();
    if (!issues.length) return;
    var issue = issues[0];
    this.focusCell(issue.lensId, issue.facetId, issue.horizon, issue.lineIndex != null ? "criteria" : "objective", issue.lineIndex);
  };

  ThirtySixtyNinetyEditor.prototype.askConfirm = function (message, okLabel, onOk) {
    this._confirmOk = onOk;
    this.showModal(
      "<p id=\"tsn-modal-title\">" + esc(message) + "</p>" +
      "<div class=\"tsn-confirm-actions\">" +
        "<button type=\"button\" class=\"tsn-btn\" data-action=\"confirm-cancel\">Cancel</button>" +
        "<button type=\"button\" class=\"tsn-btn tsn-btn-primary\" data-action=\"confirm-ok\">" + esc(okLabel || "OK") + "</button>" +
      "</div>",
      { label: message, labelledBy: "tsn-modal-title" }
    );
  };

  ThirtySixtyNinetyEditor.prototype.showModal = function (inner, opts) {
    opts = opts || {};
    if (!this._modalFocus && typeof document !== "undefined") this._modalFocus = document.activeElement;
    this.closeModal({ keepFocus: true });
    var label = opts.label || "Dialog";
    var labelledBy = opts.labelledBy || "tsn-modal-title";
    this.root.insertAdjacentHTML("beforeend",
      '<div class="tsn-confirm" role="dialog" aria-modal="true" aria-label="' + esc(label) + '" aria-labelledby="' + esc(labelledBy) + '">' +
        '<div class="tsn-confirm-box">' + inner + "</div>" +
      "</div>");
    var dialog = this.root.querySelector(".tsn-confirm");
    this.armModal(dialog);
    var items = modalFocusables(dialog);
    if (items[0] && items[0].focus) items[0].focus();
  };

  ThirtySixtyNinetyEditor.prototype.armModal = function (dialog) {
    this.disarmModal();
    if (!dialog || typeof document === "undefined") return;
    this._modalKey = function (e) {
      if (e.key !== "Tab") return;
      if (dialog.isConnected === false) return;
      var items = modalFocusables(dialog);
      if (!items.length) return;
      e.preventDefault();
      e.stopPropagation();
      var next = nextTabTarget(items, document.activeElement, e.shiftKey);
      if (next && next.focus) next.focus();
    };
    this._modalFocusIn = function (e) {
      if (dialog.isConnected === false) return;
      if (dialog.contains(e.target)) return;
      var items = modalFocusables(dialog);
      if (items[0] && items[0].focus) items[0].focus();
    };
    document.addEventListener("keydown", this._modalKey, true);
    document.addEventListener("focusin", this._modalFocusIn);
  };

  ThirtySixtyNinetyEditor.prototype.disarmModal = function () {
    if (typeof document === "undefined") {
      this._modalKey = null;
      this._modalFocusIn = null;
      return;
    }
    if (this._modalKey) document.removeEventListener("keydown", this._modalKey, true);
    if (this._modalFocusIn) document.removeEventListener("focusin", this._modalFocusIn);
    this._modalKey = null;
    this._modalFocusIn = null;
  };

  ThirtySixtyNinetyEditor.prototype.closeModal = function (opts) {
    opts = opts || {};
    this.disarmModal();
    var modal = this.root && this.root.querySelector(".tsn-confirm");
    if (modal) modal.remove();
    if (opts.keepFocus) return;
    var back = this._modalFocus;
    this._modalFocus = null;
    if (back && typeof back.focus === "function") {
      try { back.focus(); } catch (e) {}
    }
  };

  ThirtySixtyNinetyEditor.prototype.openPanel = function (lensId, facetId, horizonId) {
    this.syncPanelToCell();
    this.commitAllEdits();
    this.panel = { lensId: lensId, facetId: facetId, horizonId: horizonId };
    this.render();
    var first = this.root.querySelector(".tsn-panel-obj");
    if (first) first.focus();
  };

  ThirtySixtyNinetyEditor.prototype.closePanel = function () {
    this.syncPanelToCell();
    this.panel = null;
    this.render({ keepFocus: true });
  };

  ThirtySixtyNinetyEditor.prototype.syncPanelToCell = function () {
    if (!this.panel) return;
    var cell = getCell(this.plan, this.panel.lensId, this.panel.facetId, this.panel.horizonId);
    if (!cell) return;
    var obj = this.root.querySelector(".tsn-panel-obj");
    var crit = this.root.querySelector(".tsn-panel-crit");
    var tac = this.root.querySelector(".tsn-panel-tac");
    var st = this.root.querySelector(".tsn-panel-status");
    if (obj) cell.objective = obj.value;
    if (crit) cell.criteria = compactItems(crit.value);
    if (tac) cell.tactics = compactItems(tac.value);
    if (st) cell.status = st.value;
    pruneDismissals(cell);
    this.touch();
  };

  ThirtySixtyNinetyEditor.prototype.useExample = function () {
    if (!this.panel) return;
    var lens = getLens(this.plan, this.panel.lensId);
    var facet = getFacet(lens, this.panel.facetId);
    var example = this.exampleFor(this.panel.lensId, facet, this.panel.horizonId);
    if (!example) return;
    var cell = getCell(this.plan, this.panel.lensId, this.panel.facetId, this.panel.horizonId);
    var self = this;
    var apply = function () {
      cell.objective = example.objective || "";
      cell.criteria = compactItems(example.criteria);
      cell.tactics = compactItems(example.tactics);
      self.touch();
      self.render({ keepFocus: true });
    };
    if (cellHasContent(cell)) this.askConfirm("Replace this cell with the example?", "Use this", apply);
    else apply();
  };

  ThirtySixtyNinetyEditor.prototype.savedFocus = function () {
    return this.sel;
  };

  ThirtySixtyNinetyEditor.prototype.render = function (opts) {
    opts = opts || {};
    this._rendering = true;
    var focus = opts.keepFocus ? this.savedFocus() : null;
    var plan = this.plan;
    var template = this.template;
    var self = this;
    var start = fromIso(plan.startDate);
    var has180 = plan.horizons.some(function (h) { return h.id === "d180"; });
    var span = this.showStatus ? 4 : 3;
    var objLabel = columnLabel(template, "objective");
    var critLabel = columnLabel(template, "criteria") || "Criteria";
    var tacLabel = columnLabel(template, "tactics");
    var stLabel = columnLabel(template, "status");
    var seat = (plan.seat && plan.seat.title) || "";
    var issues = pressureTestPlan(plan);

    var tabs = plan.horizons.map(function (h) {
      return '<button type="button" class="tsn-narrow-tab' + (self.narrowHorizon === h.id ? " is-active" : "") +
        '" data-action="narrow-horizon" data-horizon="' + h.id + '">Day ' + h.offsetDays + "</button>";
    }).join("");

    var horizonHeads = plan.horizons.map(function (h) {
      var src = templateHorizon(template, h.id);
      var dateChanged = !!h.dateManual;
      var nameChanged = src && h.name !== src.name;
      return '<th class="tsn-h-group" colspan="' + span + '" data-horizon-col="' + h.id + '">' +
        '<div class="tsn-h-day">Day ' + h.offsetDays + " · " +
          '<label class="tsn-h-date">' +
            '<span class="tsn-h-date-label">' + esc(formatDateShort(fromIso(h.date))) + "</span>" +
            '<input type="date" class="tsn-horizon-date-input" data-horizon="' + h.id + '" value="' + esc(h.date) + '">' +
          "</label>" +
          (dateChanged ? '<button type="button" class="tsn-reset" data-action="reset-horizon-date" data-horizon="' + h.id + '" title="Reset date">reset</button>' : "") +
        "</div>" +
        '<div class="tsn-h-name-row">' +
          '<div class="tsn-horizon-name tsn-editable" contenteditable="true" data-horizon="' + h.id + '">' + esc(h.name) + "</div>" +
          (nameChanged ? '<button type="button" class="tsn-reset tsn-reset-hname" data-action="reset-horizon-name" data-horizon="' + h.id + '">reset</button>' : '<button type="button" class="tsn-reset tsn-reset-hname" data-action="reset-horizon-name" data-horizon="' + h.id + '" hidden>reset</button>') +
        "</div>" +
        (h.id === "d180" ? '<button type="button" class="tsn-h-remove" data-action="remove-180" title="Remove 180 days">×</button>' : "") +
      "</th>";
    }).join("");

    var subheads = plan.horizons.map(function (h) {
      return '<th class="tsn-sub" data-horizon-col="' + h.id + '">' + esc(objLabel) + "</th>" +
        '<th class="tsn-sub" data-horizon-col="' + h.id + '">' + esc(critLabel) + "</th>" +
        '<th class="tsn-sub" data-horizon-col="' + h.id + '">' + esc(tacLabel) + "</th>" +
        (self.showStatus ? '<th class="tsn-sub" data-horizon-col="' + h.id + '">' + esc(stLabel) + "</th>" : "");
    }).join("");

    var bodies = plan.lenses.map(function (lens) {
      return self.renderLensGroup(lens);
    }).join("");

    var html = [
      '<div class="tsn-toolbar">',
      '  <div class="tsn-open-wrap">',
      '    <button type="button" class="tsn-btn" data-action="open-menu">Open</button>',
      '    <div class="tsn-open-menu" hidden>',
      '      <button type="button" data-action="open-json">Open JSON</button>',
      '      <button type="button" data-action="import-xlsx">Import XLSX</button>',
      "    </div>",
      "  </div>",
      '  <button type="button" class="tsn-btn" data-action="start-blank">Start blank</button>',
      '  <button type="button" class="tsn-btn tsn-btn-save" data-action="save">Save</button>',
      '  <button type="button" class="tsn-btn" data-action="export-xlsx">Export XLSX</button>',
      '  <button type="button" class="tsn-btn" data-action="export-md">Export Markdown</button>',
      '  <input type="file" class="tsn-file-input" id="tsn-file-json" accept=".json,application/json">',
      '  <input type="file" class="tsn-file-input" id="tsn-file-xlsx" accept=".xlsx,.xls">',
      '  <label class="tsn-status-toggle">Status',
      '    <button type="button" class="tsn-switch' + (this.showStatus ? " is-on" : "") + '" data-action="toggle-status" role="switch" aria-checked="' + this.showStatus + '" aria-label="Show status"></button>',
      "  </label>",
      "</div>",
      '<div class="tsn-title-row">',
      '  <h1>30-60-90 <span class="tsn-beta">Beta</span>: <span class="tsn-seat-title tsn-editable' + (seat ? "" : " is-empty") + '" contenteditable="true" data-placeholder="Seat title">' + esc(seat) + "</span>",
      '    <span class="tsn-title-meta"> · starts ',
      '      <label class="tsn-start-wrap"><span class="tsn-start-label">' + esc(formatDateShort(start)) + "</span>",
      '        <input type="date" class="tsn-start-date-input" value="' + esc(plan.startDate) + '">',
      "      </label>",
      "    </span>",
      "  </h1>",
      '  <button type="button" class="tsn-people-link" data-action="toggle-people">People</button>',
      "</div>",
      '<div class="tsn-people-panel"' + (this.peopleOpen ? "" : " hidden") + ">",
      '  <label>Hire <input type="text" class="tsn-person-name" value="' + esc((plan.person && plan.person.name) || "") + '"></label>',
      '  <label>Manager <input type="text" class="tsn-manager-name" value="' + esc((plan.manager && plan.manager.name) || "") + '"></label>',
      "</div>",
      '<div class="tsn-narrow-tabs">' + tabs + "</div>",
      '<div class="tsn-table-wrap">',
      '<table class="tsn-grid' + (this.showStatus ? " has-status" : "") + '">',
      "  <colgroup>",
      '    <col class="tsn-col-lens">',
      '    <col class="tsn-col-facet">',
      plan.horizons.map(function () {
        var cols = "<col><col><col>";
        if (self.showStatus) cols += "<col>";
        return cols;
      }).join(""),
      "  </colgroup>",
      "  <thead>",
      '    <tr class="tsn-h1">',
      '      <th class="tsn-corner" rowspan="2" colspan="2">Lens · Facet</th>',
      horizonHeads,
      "    </tr>",
      '    <tr class="tsn-h2">' + subheads + "</tr>",
      "  </thead>",
      bodies,
      "</table>",
      "</div>",
      '<div class="tsn-grid-footer">',
      has180 ? "" : '  <button type="button" class="tsn-add-180" data-action="add-180">+ Add 180 days</button>',
      '  <p class="tsn-legend">Each objective, criterion, and tactic is its own cell. Type to replace. Enter or F2 or double-click to edit. Esc cancels. Arrows move. Tab moves across. Enter on the last criterion or tactic adds another. Status is hidden until toggled.</p>',
      "</div>",
      issues.length ? '<div class="tsn-print-check"><h2>Plan check</h2><ul>' + issues.map(function (issue) {
        return "<li>" + esc(formatIssueLine(issue)) + "</li>";
      }).join("") + "</ul></div>" : "",
      this.panel ? this.renderPanel() : ""
    ].join("\n");

    this.root.innerHTML = html;
    this.root.setAttribute("data-narrow-horizon", this.narrowHorizon);
    var host = this.root.closest(".tsn-host");
    if (host) host.setAttribute("data-narrow-horizon", this.narrowHorizon);
    this._rendering = false;
    if (focus) this.sel = focus;
    if (this.sel) {
      this.focusSelected();
    } else if (!isNarrow()) {
      var first = this.root.querySelector('.tsn-cell[data-field]:not([data-field="pad"])');
      if (first) first.tabIndex = 0;
    }
  };

  ThirtySixtyNinetyEditor.prototype.renderLensGroup = function (lens) {
    var self = this;
    var collapsed = !!this.collapsedLenses[lens.id];
    var src = templateLens(this.template, lens.id);
    var nameChanged = src && lens.name !== src.name;
    var letter = LENS_LETTERS[lens.id] || "";
    var rows = 1;
    if (!collapsed) {
      lens.facets.forEach(function (facet) {
        rows += self.facetSlotCount(lens, facet);
      });
    }
    var lensCell = '<th class="tsn-lens-cell" rowspan="' + rows + '">' +
      '<button type="button" class="tsn-lens-letter" data-action="toggle-lens" data-lens="' + lens.id + '" title="Collapse">' + letter + "</button>" +
      '<div class="tsn-lens-name tsn-editable" contenteditable="true" data-lens="' + lens.id + '">' + esc(lens.name) + "</div>" +
      (nameChanged ? '<button type="button" class="tsn-reset tsn-reset-lens" data-action="reset-lens" data-lens="' + lens.id + '">reset</button>' : '<button type="button" class="tsn-reset tsn-reset-lens" data-action="reset-lens" data-lens="' + lens.id + '" hidden>reset</button>') +
      "</th>";

    if (collapsed) {
      return '<tbody class="tsn-lens-group is-collapsed" data-lens="' + lens.id + '">' +
        '<tr class="tsn-facet-row">' + lensCell +
        '<th class="tsn-facet-cell" colspan="' + (1 + this.plan.horizons.length * (this.showStatus ? 4 : 3)) + '">' +
        esc(lens.name) + " · " + lens.facets.length + " facets</th></tr></tbody>";
    }

    var facetRows = lens.facets.map(function (facet, fi) {
      var slotCount = self.facetSlotCount(lens, facet);
      var slotHtml = [];
      var slot;
      for (slot = 0; slot < slotCount; slot++) {
        var facetCell = "";
        if (slot === 0) {
          facetCell = '<th class="tsn-facet-cell" rowspan="' + slotCount + '">' +
            '<span class="tsn-facet-kicker"><span class="tsn-facet-letter">' + letter + "</span> " + esc(lens.name) + "</span>" +
            '<span class="tsn-drag" draggable="true" data-drag-facet="1" data-lens="' + lens.id + '" data-facet="' + facet.id + '" title="Reorder">⋮⋮</span>' +
            '<div class="tsn-facet-name tsn-editable" contenteditable="true" data-lens="' + lens.id + '" data-facet="' + facet.id + '" data-placeholder="Facet">' + esc(facet.name) + "</div>" +
            '<button type="button" class="tsn-facet-x" data-action="remove-facet" data-lens="' + lens.id + '" data-facet="' + facet.id + '" title="Remove facet">×</button>' +
            self.renderSuggestions(lens, facet) +
            "</th>";
        }
        slotHtml.push(
          '<tr class="tsn-facet-row" data-lens="' + lens.id + '" data-facet="' + facet.id + '" data-slot="' + slot + '">' +
            (fi === 0 && slot === 0 ? lensCell : "") +
            facetCell +
            self.renderFacetSlotCells(lens, facet, slot, slotCount) +
          "</tr>"
        );
      }
      return slotHtml.join("");
    }).join("");

    var addRow = '<tr class="tsn-add-row" data-lens="' + lens.id + '">' +
      (lens.facets.length === 0 ? lensCell : "") +
      '<th class="tsn-facet-cell tsn-add-cell" colspan="1">' +
      '<button type="button" class="tsn-add-facet" data-action="add-facet" data-lens="' + lens.id + '">+ Add facet</button></th>' +
      this.renderEmptyFacetCells() +
      "</tr>";

    return '<tbody class="tsn-lens-group" data-lens="' + lens.id + '">' + facetRows + addRow + "</tbody>";
  };

  ThirtySixtyNinetyEditor.prototype.renderSuggestions = function (lens, facet) {
    if (!this.suggestFor || this.suggestFor.lensId !== lens.id || this.suggestFor.facetId !== facet.id) return "";
    var src = templateLens(this.template, lens.id);
    var names = (src && src.suggestedFacets) || [];
    var existing = {};
    lens.facets.forEach(function (f) { existing[f.name] = true; });
    var items = names.filter(function (n) { return n && !existing[n]; }).map(function (n) {
      return '<button type="button" data-action="suggest-facet" data-lens="' + lens.id + '" data-facet="' + facet.id + '" data-name="' + esc(n) + '">' + esc(n) + "</button>";
    }).join("");
    if (!items) return "";
    return '<div class="tsn-suggest">' + items + "</div>";
  };

  ThirtySixtyNinetyEditor.prototype.renderFacetSlotCells = function (lens, facet, slot, slotCount) {
    var self = this;
    return this.plan.horizons.map(function (h) {
      var html = "";
      if (slot === 0) html += self.renderGridCell(lens, facet, h.id, "objective", 0, slotCount);
      html += self.renderGridCell(lens, facet, h.id, "criteria", slot);
      html += self.renderGridCell(lens, facet, h.id, "tactics", slot);
      if (slot === 0 && self.showStatus) html += self.renderGridCell(lens, facet, h.id, "status", 0, slotCount);
      return html;
    }).join("");
  };

  ThirtySixtyNinetyEditor.prototype.renderEmptyFacetCells = function () {
    var span = this.showStatus ? 4 : 3;
    return this.plan.horizons.map(function (h) {
      return '<td class="tsn-cell tsn-cell-pad" colspan="' + span + '" data-horizon-col="' + h.id + '"></td>';
    }).join("");
  };

  ThirtySixtyNinetyEditor.prototype.renderGridCell = function (lens, facet, horizonId, field, index, rowspan) {
    var cell = (facet.cells && facet.cells[horizonId]) || emptyCell();
    var hints = this.hintsFor(lens.id, facet, horizonId);
    var sel = { lensId: lens.id, facetId: facet.id, horizonId: horizonId, field: field, index: index || 0 };
    var selected = sameSel(this.sel, sel);
    var editing = selected && this.editing;
    var text = cellItemText(cell, field, index);
    var filled = !!String(text).trim();
    var flags = [];
    if (field === "criteria") {
      flags = pressureTestCell(cell).filter(function (f) {
        return f.type === "tactic-like" && f.lineIndex === index;
      });
    }
    var emptyCrit = field === "objective" && pressureTestCell(cell).some(function (f) { return f.type === "empty-criteria"; });
    var kindClass = field === "objective" ? "tsn-cell-obj" : field === "criteria" ? "tsn-cell-crit" : field === "tactics" ? "tsn-cell-tac" : "tsn-cell-status";
    var classes = ["tsn-cell", kindClass];
    if (filled) classes.push("is-filled");
    if (field === "objective" && filled) classes.push("has-obj");
    if (field === "criteria" && filled) classes.push("has-crit");
    if (field === "tactics" && filled) classes.push("has-tac");
    if (selected) classes.push("is-selected");
    if (editing) classes.push("is-editing");
    if (emptyCrit) classes.push("has-empty-criteria");
    if (flags.length) classes.push("is-amber");
    if ((field === "criteria" || field === "tactics") && (index || 0) === 0) classes.push("tsn-cell-lead");
    var rs = rowspan && rowspan > 1 ? ' rowspan="' + rowspan + '"' : "";
    var hint = "";
    if (!filled && !editing) {
      if (field === "objective") hint = hints.objective;
      else if (field === "criteria") hint = hints.criteria;
      else if (field === "tactics") hint = hints.tactics;
      else hint = hints.status;
    }
    var body;
    if (editing) {
      body = '<textarea class="tsn-cell-input" rows="2" spellcheck="false">' + esc(text) + "</textarea>";
    } else {
      var bul = "";
      if (field === "criteria") bul = '<span class="tsn-bul" aria-hidden="true">✓</span>';
      if (field === "tactics") bul = '<span class="tsn-bul" aria-hidden="true">▪</span>';
      body = '<div class="tsn-cell-view">' + bul + '<span class="tsn-cell-text">' + esc(text) + "</span></div>";
      if (hint) {
        body += '<div class="tsn-cell-hints" aria-hidden="true"><div class="tsn-hint">' +
          (field === "criteria" ? '<span class="tsn-bul">✓</span> ' : field === "tactics" ? '<span class="tsn-bul">▪</span> ' : "") +
          esc(hint) + "</div></div>";
      }
    }
    if (flags.length) body += flags.map(flagCardHtml).join("");
    return '<td class="' + classes.join(" ") + '"' + rs +
      ' tabindex="' + (selected ? "0" : "-1") + '"' +
      ' data-lens="' + lens.id + '" data-facet="' + facet.id + '" data-horizon="' + horizonId +
      '" data-field="' + field + '" data-index="' + (index || 0) + '" data-horizon-col="' + horizonId + '">' +
      body + "</td>";
  };

  ThirtySixtyNinetyEditor.prototype.renderPanel = function () {
    var p = this.panel;
    var lens = getLens(this.plan, p.lensId);
    var facet = getFacet(lens, p.facetId);
    var h = getHorizon(this.plan, p.horizonId);
    var cell = getCell(this.plan, p.lensId, p.facetId, p.horizonId) || emptyCell();
    var example = this.exampleFor(p.lensId, facet, p.horizonId);
    var help = (this.template && this.template.help) || {};
    var lensHelp = (templateLens(this.template, p.lensId) || {}).help || "";
    var hHelp = (templateHorizon(this.template, p.horizonId) || {}).help || "";
    var flags = pressureTestCell(cell);
    var bad = help.badCriterion || "";
    return '<aside class="tsn-panel" role="dialog">' +
      '<div class="tsn-panel-head">' +
        "<strong>" + esc(lens && lens.name) + " · " + esc(facet && facet.name) + "</strong>" +
        '<div class="tsn-panel-sub">Day ' + (h && h.offsetDays) + (h && h.name ? " · " + esc(h.name) : "") + "</div>" +
        '<button type="button" class="tsn-panel-close" data-action="close-panel" aria-label="Close">×</button>' +
      "</div>" +
      (lensHelp ? '<p class="tsn-panel-help">' + esc(lensHelp) + "</p>" : "") +
      (hHelp ? '<p class="tsn-panel-help">' + esc(hHelp) + "</p>" : "") +
      '<label>Objective<textarea class="tsn-panel-field tsn-panel-obj" rows="2">' + esc(cell.objective) + "</textarea></label>" +
      "<label>Criteria<div class=\"tsn-panel-note\">" + esc(help.criteria || "") + "</div>" +
        '<textarea class="tsn-panel-field tsn-panel-crit" rows="4">' + esc(compactItems(cell.criteria).join("\n")) + "</textarea></label>" +
      "<label>Tactics<div class=\"tsn-panel-note\">" + esc(help.tactics || "") + "</div>" +
        '<textarea class="tsn-panel-field tsn-panel-tac" rows="4">' + esc(compactItems(cell.tactics).join("\n")) + "</textarea></label>" +
      (this.showStatus ? '<label>Status<textarea class="tsn-panel-field tsn-panel-status" rows="2">' + esc(cell.status) + "</textarea></label>" : "") +
      '<div class="tsn-panel-flags">' + flags.filter(function (f) { return f.type === "tactic-like"; }).map(flagCardHtml).join("") + "</div>" +
      '<div class="tsn-examples">' +
        (example ? '<div class="tsn-example is-good"><div class="tsn-example-label">Example</div>' +
          "<p><strong>" + esc(example.objective || "") + "</strong></p>" +
          compactItems(example.criteria).map(function (c) { return "<p>✓ " + esc(c) + "</p>"; }).join("") +
          compactItems(example.tactics).map(function (t) { return "<p>▪ " + esc(t) + "</p>"; }).join("") +
          '<button type="button" class="tsn-btn tsn-btn-primary" data-action="use-example">Use this</button></div>' : "") +
        (bad ? '<div class="tsn-example is-bad"><div class="tsn-example-label">Not a criterion</div><p>' + esc(bad) + "</p></div>" : "") +
      "</div>" +
    "</aside>";
  };

  global.ThirtySixtyNinetyEditor = ThirtySixtyNinetyEditor;

  global.kindel3090 = {
    createNewPlan: createNewPlan,
    validatePlan: validatePlan,
    validateTemplate: validateTemplate,
    validateManifest: validateManifest,
    pressureTestCell: pressureTestCell,
    pressureTestPlan: pressureTestPlan,
    lineLooksLikeTactic: lineLooksLikeTactic,
    exportMarkdown: exportMarkdown,
    exportXlsx: exportXlsx,
    importXlsx: importXlsx,
    computeHorizons: computeHorizons,
    buildLenses: buildLenses,
    recomputeHorizonDates: recomputeHorizonDates,
    getDefaultTemplate: getDefaultTemplate,
    getBundle: getBundle,
    setBundle: setBundle,
    loadTemplates: loadTemplates,
    splitLines: splitLines,
    itemList: itemList,
    compactItems: compactItems,
    filledItems: filledItems,
    hydratePlan: hydratePlan,
    nextTabTarget: nextTabTarget,
    pruneDismissals: pruneDismissals,
    hydratePlanDismissals: hydratePlanDismissals,
    planHasCellContent: planHasCellContent,
    isUntouchedEmptyDraft: isUntouchedEmptyDraft,
    readStoredDraft: readStoredDraft,
    STORE_KEYS: STORE_KEYS,
    NARROW_MAX_PX: NARROW_MAX_PX
  };

})(typeof window !== "undefined" ? window : global);
