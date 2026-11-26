(function (global) {
  "use strict";

  var VERSION = 1;
  var KIND = "kindel.30-60-90";
  var STORE_KEY = "kindel.30-60-90.draft.v1";
  var LENS_ORDER = ["customer", "business", "technical", "organization"];
  var LENS_LETTERS = { customer: "C", business: "B", technical: "T", organization: "O" };
  var HORIZON_OFFSETS = { d30: 30, d60: 60, d90: 90, d180: 180 };
  var LEVEL_TAGS = { junior: true, senior: true, executive: true, any: true };

  var TACTIC_VERBS = [
    "meet", "attend", "read", "talk", "interview", "email", "call", "schedule",
    "shadow", "visit", "review", "join", "learn", "ride", "onboard"
  ];
  var TACTIC_PHRASES = ["sit with", "set up"];

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
    return { objective: "", criteria: "", tactics: "", status: "" };
  }

  function emptyCells(horizons) {
    var cells = {};
    (horizons || []).forEach(function (h) {
      cells[h.id] = emptyCell();
    });
    return cells;
  }

  function buildLenses(template, horizons) {
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
          cells: emptyCells(horizons)
        };
      });
      return {
        id: lensId,
        name: src.name || "",
        facets: facets
      };
    });
  }

  function createNewPlan(opts) {
    opts = opts || {};
    var template = opts.template || getDefaultTemplate(opts.bundle);
    if (!template) throw new Error("No template loaded");
    var include180 = opts.include180 != null ? !!opts.include180 : !!template.include180;
    var startDate = opts.startDate || iso(new Date());
    var horizons = computeHorizons(startDate, include180, template);
    return {
      version: VERSION,
      kind: KIND,
      seat: {
        title: opts.seatTitle || "",
        family: opts.family || familyFromTemplate(template)
      },
      person: { name: opts.personName || "", role: "hire" },
      manager: { name: opts.managerName || "" },
      startDate: startDate,
      include180: include180,
      template: { id: template.id, version: template.version },
      horizons: horizons,
      lenses: buildLenses(template, horizons)
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
    var crits = splitLines(cell.criteria);
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
    var crits = splitLines(cell.criteria);
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
    var crits = splitLines(cell.criteria);

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
          var hasContent = cell.objective || cell.criteria || cell.tactics || (includeStatus && cell.status);
          if (!hasContent) return;

          var dateLabel = formatDateShort(fromIso(h.date));
          lines.push("#### Day " + h.offsetDays + (dateLabel ? " · " + dateLabel : "") + (h.name ? " · " + h.name : ""));
          lines.push("");

          if (cell.objective) {
            lines.push("**" + cell.objective + "**");
            lines.push("");
          }
          splitLines(cell.criteria).forEach(function (c) {
            lines.push("- ✓ " + c);
          });
          if (splitLines(cell.criteria).length) lines.push("");

          splitLines(cell.tactics).forEach(function (t) {
            lines.push("- ▪ " + t);
          });
          if (splitLines(cell.tactics).length) lines.push("");

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
        var row = [fi === 0 ? lens.name : "", facet.name];
        horizons.forEach(function (h) {
          var cell = (facet.cells || {})[h.id] || {};
          row.push(cell.objective || "", cell.criteria || "", cell.tactics || "", cell.status || "");
        });
        rows.push(row);
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

    var currentLens = null;
    for (var ri = 2; ri < data.length; ri++) {
      var row = data[ri] || [];
      var lensCell = String(row[0] || "").trim();
      var facetName = String(row[1] || "").trim();

      if (lensCell) {
        var lensKey = lensNameMap[lensCell.toLowerCase()];
        if (lensKey) currentLens = lensKey;
      }

      if (!facetName || !currentLens) continue;

      var cells = {};
      horizonCols.forEach(function (hc) {
        var baseCol = hc.col;
        cells[hc.id] = {
          objective: String(row[baseCol] || "").trim(),
          criteria: String(row[baseCol + 1] || "").trim(),
          tactics: String(row[baseCol + 2] || "").trim(),
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

    return {
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
    };
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
    return !!(String(cell.objective || "").trim() || String(cell.criteria || "").trim() || String(cell.tactics || "").trim() || String(cell.status || "").trim());
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

  function loadTemplates(done) {
    var bundled = getBundle();
    function finish(bundle) {
      setBundle(bundle);
      done(null, bundle);
    }
    if (typeof fetch === "undefined" || isFileProtocol()) {
      if (!bundled) return done(new Error("No template bundle"));
      return finish(bundled);
    }
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
        finish({
          kind: "kindel.30-60-90.templates-bundle",
          version: 1,
          manifest: manifest,
          templates: templates,
          facetSets: parts[1]
        });
      });
    }).catch(function () {
      if (!bundled) return done(new Error("No template bundle"));
      finish(bundled);
    });
  }

  function lineMarkup(kind, text, extraClass) {
    var bul = "";
    if (kind === "crit") bul = '<span class="tsn-bul" contenteditable="false" aria-hidden="true">✓</span>';
    if (kind === "tac") bul = '<span class="tsn-bul" contenteditable="false" aria-hidden="true">▪</span>';
    return '<div class="tsn-line tsn-line-' + kind + (extraClass ? " " + extraClass : "") + '">' +
      bul +
      '<span class="tsn-line-text" contenteditable="true" spellcheck="false">' + esc(text || "") + "</span>" +
      "</div>";
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
    this.init();
  }

  ThirtySixtyNinetyEditor.prototype.init = function () {
    if (!this.root) return;
    var self = this;
    loadTemplates(function (err, bundle) {
      self.bundle = bundle;
      self.template = getDefaultTemplate(bundle);
      self.loadDraft();
      if (!self.plan) {
        self.plan = createNewPlan({ template: self.template });
        self.fresh = true;
      }
      self.bindRootEvents();
      self.render();
      if (self.fresh) self.focusFirstCell();
    });
  };

  ThirtySixtyNinetyEditor.prototype.loadDraft = function () {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var plan = JSON.parse(raw);
      var result = validatePlan(plan);
      if (result.valid) this.plan = hydratePlanDismissals(plan);
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
    this.root.addEventListener("mousedown", function (e) { self.onCellMouseDown(e); });
    this.root.addEventListener("input", function (e) { self.onInput(e); });
    this.root.addEventListener("change", function (e) { self.onChange(e); });
    this.root.addEventListener("keydown", function (e) { self.onKeydown(e); });
    this.root.addEventListener("focusin", function (e) { self.onFocusIn(e); });
    this.root.addEventListener("focusout", function (e) { self.onFocusOut(e); });
    this.root.addEventListener("paste", function (e) { self.onPaste(e); });
    this.root.addEventListener("dragstart", function (e) { self.onDragStart(e); });
    this.root.addEventListener("dragover", function (e) { self.onDragOver(e); });
    this.root.addEventListener("drop", function (e) { self.onDrop(e); });

    document.addEventListener("click", function (e) {
      if (!self.root.contains(e.target)) {
        self.openMenuOpen = false;
        var menu = self.root.querySelector(".tsn-open-menu");
        if (menu) menu.hidden = true;
      }
    });

    window.addEventListener("beforeunload", function (e) {
      if (self.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    });

    window.addEventListener("beforeprint", function () {
      self.root.classList.toggle("tsn-print-status", self.showStatus);
    });
  };

  ThirtySixtyNinetyEditor.prototype.onCellMouseDown = function (e) {
    var cell = e.target.closest(".tsn-cell");
    if (!cell || e.target.closest(".tsn-line-text") || e.target.closest("[data-action]")) return;
    var field = cell.getAttribute("data-field");
    if (!field || field === "pad") return;
    var texts = cell.querySelectorAll(".tsn-line-text");
    if (!texts.length) return;
    e.preventDefault();
    this.placeCaret(texts[0]);
    cell.classList.add("is-editing");
  };

  ThirtySixtyNinetyEditor.prototype.onClick = function (e) {
    if (window.matchMedia && window.matchMedia("(max-width: 900px)").matches) {
      var mobileCell = e.target.closest(".tsn-cell");
      if (mobileCell && !e.target.closest("[data-action]") && mobileCell.getAttribute("data-field") && mobileCell.getAttribute("data-field") !== "pad") {
        e.preventDefault();
        this.openPanel(mobileCell.getAttribute("data-lens"), mobileCell.getAttribute("data-facet"), mobileCell.getAttribute("data-horizon"));
        return;
      }
    }
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
      this.openMenuOpen = false;
      this.root.querySelector("#tsn-file-json").click();
      return;
    }
    if (action === "import-xlsx") {
      this.openMenuOpen = false;
      this.root.querySelector("#tsn-file-xlsx").click();
      return;
    }
    if (action === "save") {
      downloadJson(this.plan);
      this.setDirty(false);
      this.saveDraft();
      return;
    }
    if (action === "export-xlsx") {
      try { downloadXlsx(this.plan); }
      catch (err) { alert("Could not export XLSX: " + err.message); }
      return;
    }
    if (action === "export-md") {
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
      return;
    }
    var cellEl = t.closest(".tsn-cell");
    if (cellEl && t.closest(".tsn-line-text")) {
      this.syncCellFromDom(cellEl, false);
      this.updateCellFillState(cellEl);
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
    var lineText = e.target.closest(".tsn-line-text");
    if (!lineText) {
      if (e.key === "Enter" && e.target.classList && e.target.classList.contains("tsn-cell")) {
        var expand = e.target.querySelector("[data-action='expand']");
        if (expand) this.handleAction("expand", e, expand);
      }
      return;
    }
    var edit = lineText.closest(".tsn-cell-edit");
    var cell = lineText.closest(".tsn-cell");
    if (!cell || !edit) return;
    var field = cell.getAttribute("data-field");

    if (e.key === "Tab") {
      e.preventDefault();
      this.commitCell(cell);
      this.moveCell(cell, e.shiftKey ? "left" : "right");
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (field === "oc") this.insertLine(edit, "crit");
      else if (field === "tactics") this.insertLine(edit, "tac");
      else if (field === "status") this.insertLine(edit, "status");
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "ArrowDown") {
      if (this.caretAtEdge(e.key)) {
        e.preventDefault();
        this.commitCell(cell);
        var dir = e.key === "ArrowRight" ? "right" : e.key === "ArrowLeft" ? "left" : e.key === "ArrowUp" ? "up" : "down";
        this.moveCell(cell, dir);
      }
    }
  };

  ThirtySixtyNinetyEditor.prototype.onFocusIn = function (e) {
    var cell = e.target.closest(".tsn-cell");
    if (cell) cell.classList.add("is-editing");
  };

  ThirtySixtyNinetyEditor.prototype.onFocusOut = function (e) {
    if (this._rendering) return;
    var cell = e.target.closest(".tsn-cell");
    if (!cell || !this.root.contains(cell)) return;
    var next = e.relatedTarget;
    if (next && cell.contains(next)) return;
    cell.classList.remove("is-editing");
    this.commitCell(cell);
    this.refreshCellFlags(cell);
  };

  ThirtySixtyNinetyEditor.prototype.onPaste = function (e) {
    if (!e.target.closest(".tsn-line-text")) return;
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData("text/plain") || "";
    document.execCommand("insertText", false, text.replace(/\n/g, " "));
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

  ThirtySixtyNinetyEditor.prototype.cellElHasText = function (cellEl) {
    var edit = cellEl.querySelector(".tsn-cell-edit");
    if (!edit) return false;
    return this.readLines(edit).some(function (l) { return l.trim(); });
  };

  ThirtySixtyNinetyEditor.prototype.updateCellFillState = function (cellEl) {
    var lines = this.readLines(cellEl.querySelector(".tsn-cell-edit") || cellEl);
    var field = cellEl.getAttribute("data-field");
    var hasAny = lines.some(function (l) { return String(l).trim(); });
    cellEl.classList.toggle("is-filled", hasAny);
    if (field === "oc") {
      cellEl.classList.toggle("has-obj", !!(lines[0] && String(lines[0]).trim()));
      cellEl.classList.toggle("has-crit", lines.slice(1).some(function (l) { return String(l).trim(); }));
    }
    if (field === "tactics") cellEl.classList.toggle("has-tac", hasAny);
  };

  ThirtySixtyNinetyEditor.prototype.readLines = function (editEl) {
    var lines = [];
    if (!editEl) return lines;
    var nodes = editEl.querySelectorAll(".tsn-line");
    if (nodes.length) {
      nodes.forEach(function (node) {
        var textEl = node.querySelector(".tsn-line-text");
        var t = ((textEl ? textEl.textContent : node.textContent) || "").replace(/\u00a0/g, " ").replace(/\u200b/g, "").trim();
        lines.push(t);
      });
    } else {
      lines = splitLines(editEl.textContent);
    }
    return lines;
  };

  ThirtySixtyNinetyEditor.prototype.syncCellFromDom = function (cellEl, trimEmpty) {
    var lensId = cellEl.getAttribute("data-lens");
    var facetId = cellEl.getAttribute("data-facet");
    var horizonId = cellEl.getAttribute("data-horizon");
    var field = cellEl.getAttribute("data-field");
    var cell = getCell(this.plan, lensId, facetId, horizonId);
    if (!cell) return;
    if (!this.root.contains(cellEl)) return;
    var edit = cellEl.querySelector(".tsn-cell-edit");
    if (!edit) return;
    var lines = this.readLines(edit);
    if (trimEmpty) {
      while (lines.length > 1 && !String(lines[lines.length - 1]).trim()) lines.pop();
    }
    if (field === "oc") {
      cell.objective = lines[0] || "";
      cell.criteria = lines.slice(1).filter(function (l) { return String(l).trim(); }).join("\n");
      pruneDismissals(cell);
    } else if (field === "tactics") {
      cell.tactics = lines.filter(function (l) { return String(l).trim(); }).join("\n");
    } else if (field === "status") {
      cell.status = lines.filter(function (l) { return String(l).trim(); }).join("\n");
    }
    this.touch();
  };

  ThirtySixtyNinetyEditor.prototype.commitCell = function (cellEl) {
    this.syncCellFromDom(cellEl, true);
    this.updateCellFillState(cellEl);
  };

  ThirtySixtyNinetyEditor.prototype.commitAllEdits = function () {
    var self = this;
    this.root.querySelectorAll(".tsn-cell.is-editing, .tsn-cell .tsn-cell-edit").forEach(function (el) {
      var cell = el.classList.contains("tsn-cell") ? el : el.closest(".tsn-cell");
      if (cell) self.syncCellFromDom(cell, true);
    });
  };

  ThirtySixtyNinetyEditor.prototype.insertLine = function (edit, kind) {
    var line = document.createElement("div");
    line.className = "tsn-line tsn-line-" + kind;
    if (kind === "crit" || kind === "tac") {
      var bul = document.createElement("span");
      bul.className = "tsn-bul";
      bul.contentEditable = "false";
      bul.setAttribute("aria-hidden", "true");
      bul.textContent = kind === "crit" ? "✓" : "▪";
      line.appendChild(bul);
    }
    var text = document.createElement("span");
    text.className = "tsn-line-text";
    text.contentEditable = "true";
    text.spellcheck = false;
    line.appendChild(text);
    var current = this.currentLine();
    if (current && current.parentNode === edit) {
      if (current.nextSibling) edit.insertBefore(line, current.nextSibling);
      else edit.appendChild(line);
    } else {
      edit.appendChild(line);
    }
    this.placeCaret(text);
    var cell = edit.closest(".tsn-cell");
    if (cell) {
      cell.classList.add("is-filled");
      this.syncCellFromDom(cell, false);
    }
  };

  ThirtySixtyNinetyEditor.prototype.currentLine = function () {
    var sel = window.getSelection();
    if (!sel || !sel.anchorNode) return null;
    var node = sel.anchorNode;
    if (node.nodeType === 3) node = node.parentNode;
    return node.closest ? node.closest(".tsn-line") : null;
  };

  ThirtySixtyNinetyEditor.prototype.placeCaret = function (el) {
    if (!el) return;
    el.focus();
    var range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  ThirtySixtyNinetyEditor.prototype.caretAtEdge = function (key) {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
    var edit = sel.anchorNode && sel.anchorNode.parentElement && sel.anchorNode.parentElement.closest
      ? (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement.closest(".tsn-cell-edit") : sel.anchorNode.closest(".tsn-cell-edit"))
      : null;
    if (!edit) return false;
    var text = (edit.textContent || "").replace(/\u00a0/g, " ");
    if (!text.trim()) return true;
    var range = sel.getRangeAt(0);
    if (key === "ArrowLeft" || key === "ArrowUp") {
      var pre = document.createRange();
      pre.selectNodeContents(edit);
      pre.setEnd(range.startContainer, range.startOffset);
      return pre.toString().length === 0;
    }
    var post = document.createRange();
    post.selectNodeContents(edit);
    post.setStart(range.endContainer, range.endOffset);
    return post.toString().length === 0;
  };

  ThirtySixtyNinetyEditor.prototype.cellSelector = function (lensId, facetId, horizonId, field) {
    return '.tsn-cell[data-lens="' + lensId + '"][data-facet="' + facetId + '"][data-horizon="' + horizonId + '"][data-field="' + field + '"]';
  };

  ThirtySixtyNinetyEditor.prototype.focusCell = function (lensId, facetId, horizonId, field, lineIndex) {
    var cell = this.root.querySelector(this.cellSelector(lensId, facetId, horizonId, field || "oc"));
    if (!cell) return;
    var lines = cell.querySelectorAll(".tsn-line-text");
    var target = null;
    if (lineIndex != null && lines[lineIndex]) target = lines[lineIndex];
    else target = lines[0];
    if (target) this.placeCaret(target);
  };

  ThirtySixtyNinetyEditor.prototype.focusFirstCell = function () {
    var lens = this.plan.lenses[0];
    var facet = lens && lens.facets[0];
    var h = this.plan.horizons[0];
    if (lens && facet && h) {
      var cell = this.root.querySelector(this.cellSelector(lens.id, facet.id, h.id, "oc"));
      if (cell) cell.classList.add("is-editing");
      this.focusCell(lens.id, facet.id, h.id, "oc");
    }
  };

  ThirtySixtyNinetyEditor.prototype.moveCell = function (cell, dir) {
    var lensId = cell.getAttribute("data-lens");
    var facetId = cell.getAttribute("data-facet");
    var horizonId = cell.getAttribute("data-horizon");
    var field = cell.getAttribute("data-field");
    var coords = [];
    var self = this;
    this.plan.lenses.forEach(function (lens) {
      if (self.collapsedLenses[lens.id]) return;
      lens.facets.forEach(function (facet) {
        self.plan.horizons.forEach(function (h) {
          coords.push({ lensId: lens.id, facetId: facet.id, horizonId: h.id, field: "oc" });
          coords.push({ lensId: lens.id, facetId: facet.id, horizonId: h.id, field: "tactics" });
          if (self.showStatus) coords.push({ lensId: lens.id, facetId: facet.id, horizonId: h.id, field: "status" });
        });
      });
    });
    var idx = -1;
    coords.forEach(function (c, i) {
      if (c.lensId === lensId && c.facetId === facetId && c.horizonId === horizonId && c.field === field) idx = i;
    });
    if (idx < 0) return;
    var next = idx;
    if (dir === "right") next = Math.min(coords.length - 1, idx + 1);
    if (dir === "left") next = Math.max(0, idx - 1);
    if (dir === "down" || dir === "up") {
      var fieldsPerHorizon = this.showStatus ? 3 : 2;
      var fieldsPerFacet = this.plan.horizons.length * fieldsPerHorizon;
      next = dir === "down" ? idx + fieldsPerFacet : idx - fieldsPerFacet;
      if (next < 0 || next >= coords.length) return;
    }
    var c = coords[next];
    this.focusCell(c.lensId, c.facetId, c.horizonId, c.field);
  };

  ThirtySixtyNinetyEditor.prototype.refreshCellFlags = function (cellEl) {
    var lensId = cellEl.getAttribute("data-lens");
    var facetId = cellEl.getAttribute("data-facet");
    var horizonId = cellEl.getAttribute("data-horizon");
    var field = cellEl.getAttribute("data-field");
    if (field !== "oc") return;
    var cell = getCell(this.plan, lensId, facetId, horizonId);
    var flags = pressureTestCell(cell);
    cellEl.classList.toggle("has-empty-criteria", flags.some(function (f) { return f.type === "empty-criteria"; }));
    cellEl.querySelectorAll(".tsn-line-crit").forEach(function (line) {
      line.classList.remove("is-amber");
    });
    var host = cellEl.querySelector(".tsn-cell-flags");
    if (host) host.innerHTML = "";
    var critLines = cellEl.querySelectorAll(".tsn-line-crit");
    flags.forEach(function (flag) {
      if (flag.type !== "tactic-like") return;
      var line = critLines[flag.lineIndex];
      if (line) line.classList.add("is-amber");
      if (host) {
        host.insertAdjacentHTML("beforeend",
          '<div class="tsn-flag-card" data-line="' + flag.lineIndex + '">' +
            '<div class="tsn-flag-note">That\'s a tactic.</div>' +
            '<div class="tsn-flag-actions">' +
              '<button type="button" class="tsn-btn tsn-btn-primary" data-action="move-tactic">Move to Tactics</button>' +
              '<button type="button" class="tsn-btn" data-action="rewrite-ican">Rewrite as I can…</button>' +
              '<button type="button" class="tsn-btn" data-action="keep-line">Keep</button>' +
            "</div>" +
          "</div>");
      }
    });
  };

  ThirtySixtyNinetyEditor.prototype.redirectLine = function (el, mode) {
    var cellEl = el.closest(".tsn-cell");
    var card = el.closest(".tsn-flag-card");
    if (!cellEl || !card) return;
    var lineIndex = parseInt(card.getAttribute("data-line"), 10);
    var lensId = cellEl.getAttribute("data-lens");
    var facetId = cellEl.getAttribute("data-facet");
    var horizonId = cellEl.getAttribute("data-horizon");
    var cell = getCell(this.plan, lensId, facetId, horizonId);
    var crits = splitLines(cell.criteria);
    if (lineIndex < 0 || lineIndex >= crits.length) return;
    if (mode === "move") {
      var moved = crits.splice(lineIndex, 1)[0];
      cell.criteria = crits.join("\n");
      cell.tactics = (cell.tactics ? splitLines(cell.tactics).concat([moved]) : [moved]).join("\n");
      pruneDismissals(cell);
      if (cell.dismissed && (!cell.dismissedText || !cell.dismissedText.length)) {
        cell.dismissed = cell.dismissed.filter(function (i) { return i !== lineIndex; }).map(function (i) {
          return i > lineIndex ? i - 1 : i;
        });
        if (!cell.dismissed.length) delete cell.dismissed;
      }
      this.touch();
      this.render();
      this.focusCell(lensId, facetId, horizonId, "tactics");
      return;
    }
    if (mode === "rewrite") {
      crits[lineIndex] = "I can ";
      cell.criteria = crits.join("\n");
      pruneDismissals(cell);
      this.touch();
      this.renderCellPair(lensId, facetId, horizonId);
      this.focusCell(lensId, facetId, horizonId, "oc", lineIndex + 1);
      return;
    }
    if (mode === "keep") {
      var kept = crits[lineIndex];
      if (!cell.dismissed) cell.dismissed = [];
      if (cell.dismissed.indexOf(lineIndex) < 0) cell.dismissed.push(lineIndex);
      if (!cell.dismissedText) cell.dismissedText = [];
      if (!dismissedTextSet(cell)[normLine(kept)]) cell.dismissedText.push(kept);
      this.touch();
      this.refreshCellFlags(cellEl);
    }
  };

  ThirtySixtyNinetyEditor.prototype.renderCellPair = function (lensId, facetId, horizonId) {
    var lens = getLens(this.plan, lensId);
    var facet = getFacet(lens, facetId);
    if (!facet) return;
    var oc = this.root.querySelector(this.cellSelector(lensId, facetId, horizonId, "oc"));
    var tac = this.root.querySelector(this.cellSelector(lensId, facetId, horizonId, "tactics"));
    if (oc) {
      oc.outerHTML = this.renderOcCell(lens, facet, horizonId);
      var newOc = this.root.querySelector(this.cellSelector(lensId, facetId, horizonId, "oc"));
      if (newOc) this.refreshCellFlags(newOc);
    }
    if (tac) tac.outerHTML = this.renderTacticsCell(lens, facet, horizonId);
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
        self.plan = hydratePlanDismissals(plan);
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
      "<h2>Plan check</h2>" +
      "<p>These cells still need work. Redirect a tactic; do not leave a hire with a to-do list.</p>" +
      "<ul class=\"tsn-check-list\">" + items + "</ul>" +
      "<div class=\"tsn-confirm-actions\">" +
        "<button type=\"button\" class=\"tsn-btn\" data-action=\"plan-check-cancel\">Cancel</button>" +
        "<button type=\"button\" class=\"tsn-btn\" data-action=\"plan-check-fix\">Fix</button>" +
        "<button type=\"button\" class=\"tsn-btn tsn-btn-primary\" data-action=\"plan-check-anyway\">Export anyway</button>" +
      "</div>"
    );
  };

  ThirtySixtyNinetyEditor.prototype.fixFirstIssue = function () {
    var issues = pressureTestPlan(this.plan);
    this.closeModal();
    if (!issues.length) return;
    var issue = issues[0];
    this.focusCell(issue.lensId, issue.facetId, issue.horizon, "oc", issue.lineIndex != null ? issue.lineIndex + 1 : 0);
  };

  ThirtySixtyNinetyEditor.prototype.askConfirm = function (message, okLabel, onOk) {
    this._confirmOk = onOk;
    this.showModal(
      "<p>" + esc(message) + "</p>" +
      "<div class=\"tsn-confirm-actions\">" +
        "<button type=\"button\" class=\"tsn-btn\" data-action=\"confirm-cancel\">Cancel</button>" +
        "<button type=\"button\" class=\"tsn-btn tsn-btn-primary\" data-action=\"confirm-ok\">" + esc(okLabel || "OK") + "</button>" +
      "</div>"
    );
  };

  ThirtySixtyNinetyEditor.prototype.showModal = function (inner) {
    this.closeModal();
    this.root.insertAdjacentHTML("beforeend",
      '<div class="tsn-confirm" role="dialog">' +
        '<div class="tsn-confirm-box">' + inner + "</div>" +
      "</div>");
  };

  ThirtySixtyNinetyEditor.prototype.closeModal = function () {
    var modal = this.root.querySelector(".tsn-confirm");
    if (modal) modal.remove();
  };

  ThirtySixtyNinetyEditor.prototype.openPanel = function (lensId, facetId, horizonId) {
    this.commitAllEdits();
    this.panel = { lensId: lensId, facetId: facetId, horizonId: horizonId };
    this.render({ keepFocus: true });
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
    if (crit) cell.criteria = crit.value;
    if (tac) cell.tactics = tac.value;
    if (st) cell.status = st.value;
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
      cell.criteria = example.criteria || "";
      cell.tactics = example.tactics || "";
      self.touch();
      self.render({ keepFocus: true });
    };
    if (cellHasContent(cell)) this.askConfirm("Replace this cell with the example?", "Use this", apply);
    else apply();
  };

  ThirtySixtyNinetyEditor.prototype.savedFocus = function () {
    var active = document.activeElement;
    if (!active || !this.root.contains(active)) return null;
    var cell = active.closest(".tsn-cell");
    if (!cell) return null;
    return {
      lensId: cell.getAttribute("data-lens"),
      facetId: cell.getAttribute("data-facet"),
      horizonId: cell.getAttribute("data-horizon"),
      field: cell.getAttribute("data-field")
    };
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
    var span = this.showStatus ? 3 : 2;
    var ocLabel = columnLabel(template, "objective");
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
      return '<th class="tsn-sub" data-horizon-col="' + h.id + '">' + esc(ocLabel) + "</th>" +
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
      '  <h1>30-60-90: <span class="tsn-seat-title tsn-editable' + (seat ? "" : " is-empty") + '" contenteditable="true" data-placeholder="Seat title">' + esc(seat) + "</span>",
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
        var cols = "<col><col>";
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
      '  <p class="tsn-legend">Dashed underline = editable · Bold = Key Objective · ✓ = Evaluation Criterion · ▪ = Tactic · Gray italic = hint until you type · Status is hidden until toggled.</p>',
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
    this.root.querySelectorAll(".tsn-cell-oc").forEach(function (cell) {
      self.refreshCellFlags(cell);
    });
    this._rendering = false;
    if (focus) this.focusCell(focus.lensId, focus.facetId, focus.horizonId, focus.field);
  };

  ThirtySixtyNinetyEditor.prototype.renderLensGroup = function (lens) {
    var self = this;
    var collapsed = !!this.collapsedLenses[lens.id];
    var src = templateLens(this.template, lens.id);
    var nameChanged = src && lens.name !== src.name;
    var letter = LENS_LETTERS[lens.id] || "";
    var rows = collapsed ? 1 : lens.facets.length + 1;
    var lensCell = '<th class="tsn-lens-cell" rowspan="' + rows + '">' +
      '<button type="button" class="tsn-lens-letter" data-action="toggle-lens" data-lens="' + lens.id + '" title="Collapse">' + letter + "</button>" +
      '<div class="tsn-lens-name tsn-editable" contenteditable="true" data-lens="' + lens.id + '">' + esc(lens.name) + "</div>" +
      (nameChanged ? '<button type="button" class="tsn-reset tsn-reset-lens" data-action="reset-lens" data-lens="' + lens.id + '">reset</button>' : '<button type="button" class="tsn-reset tsn-reset-lens" data-action="reset-lens" data-lens="' + lens.id + '" hidden>reset</button>') +
      "</th>";

    if (collapsed) {
      return '<tbody class="tsn-lens-group is-collapsed" data-lens="' + lens.id + '">' +
        '<tr class="tsn-facet-row">' + lensCell +
        '<th class="tsn-facet-cell" colspan="' + (1 + this.plan.horizons.length * (this.showStatus ? 3 : 2)) + '">' +
        esc(lens.name) + " · " + lens.facets.length + " facets</th></tr></tbody>";
    }

    var facetRows = lens.facets.map(function (facet, fi) {
      var facetCell = '<th class="tsn-facet-cell">' +
        '<span class="tsn-drag" draggable="true" data-drag-facet="1" data-lens="' + lens.id + '" data-facet="' + facet.id + '" title="Reorder">⋮⋮</span>' +
        '<div class="tsn-facet-name tsn-editable" contenteditable="true" data-lens="' + lens.id + '" data-facet="' + facet.id + '" data-placeholder="Facet">' + esc(facet.name) + "</div>" +
        '<button type="button" class="tsn-facet-x" data-action="remove-facet" data-lens="' + lens.id + '" data-facet="' + facet.id + '" title="Remove facet">×</button>' +
        self.renderSuggestions(lens, facet) +
        "</th>";
      return '<tr class="tsn-facet-row" data-lens="' + lens.id + '" data-facet="' + facet.id + '">' +
        (fi === 0 ? lensCell : "") +
        facetCell +
        self.renderFacetCells(lens, facet) +
        "</tr>";
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

  ThirtySixtyNinetyEditor.prototype.renderFacetCells = function (lens, facet) {
    var self = this;
    return this.plan.horizons.map(function (h) {
      return self.renderOcCell(lens, facet, h.id) +
        self.renderTacticsCell(lens, facet, h.id) +
        (self.showStatus ? self.renderStatusCell(lens, facet, h.id) : "");
    }).join("");
  };

  ThirtySixtyNinetyEditor.prototype.renderEmptyFacetCells = function () {
    var self = this;
    var span = this.showStatus ? 3 : 2;
    return this.plan.horizons.map(function (h) {
      return '<td class="tsn-cell tsn-cell-pad" colspan="' + span + '" data-horizon-col="' + h.id + '"></td>';
    }).join("");
  };

  ThirtySixtyNinetyEditor.prototype.renderOcCell = function (lens, facet, horizonId) {
    var cell = (facet.cells && facet.cells[horizonId]) || emptyCell();
    var hints = this.hintsFor(lens.id, facet, horizonId);
    var filled = !!(cell.objective || cell.criteria);
    var lines = "";
    lines += lineMarkup("obj", cell.objective || "");
    splitLines(cell.criteria).forEach(function (c) {
      lines += lineMarkup("crit", c);
    });
    if (!cell.objective && !splitLines(cell.criteria).length) {
      lines = lineMarkup("obj", "");
    }
    var ocClass = "tsn-cell tsn-cell-oc" + (filled ? " is-filled" : "") + (cell.objective ? " has-obj" : "") + (splitLines(cell.criteria).length ? " has-crit" : "");
    return '<td class="' + ocClass + '" data-lens="' + lens.id +
      '" data-facet="' + facet.id + '" data-horizon="' + horizonId + '" data-field="oc" data-horizon-col="' + horizonId + '">' +
      '<button type="button" class="tsn-expand" data-action="expand" title="Open editor">⤢</button>' +
      '<div class="tsn-cell-edit" role="textbox">' + lines + "</div>" +
      '<div class="tsn-cell-hints" aria-hidden="true">' +
        '<div class="tsn-hint tsn-hint-obj">' + esc(hints.objective) + "</div>" +
        '<div class="tsn-hint tsn-hint-crit"><span class="tsn-bul">✓</span> ' + esc(hints.criteria) + "</div>" +
      "</div>" +
      '<div class="tsn-cell-flags"></div>' +
      "</td>";
  };

  ThirtySixtyNinetyEditor.prototype.renderTacticsCell = function (lens, facet, horizonId) {
    var cell = (facet.cells && facet.cells[horizonId]) || emptyCell();
    var hints = this.hintsFor(lens.id, facet, horizonId);
    var tacs = splitLines(cell.tactics);
    var filled = tacs.length > 0;
    var lines = tacs.length ? tacs.map(function (t) { return lineMarkup("tac", t); }).join("") : lineMarkup("tac", "");
    return '<td class="tsn-cell tsn-cell-tac' + (filled ? " is-filled has-tac" : "") + '" data-lens="' + lens.id +
      '" data-facet="' + facet.id + '" data-horizon="' + horizonId + '" data-field="tactics" data-horizon-col="' + horizonId + '">' +
      '<button type="button" class="tsn-expand" data-action="expand" title="Open editor">⤢</button>' +
      '<div class="tsn-cell-edit" role="textbox">' + lines + "</div>" +
      '<div class="tsn-cell-hints" aria-hidden="true"><div class="tsn-hint tsn-hint-tac"><span class="tsn-bul">▪</span> ' + esc(hints.tactics) + "</div></div>" +
      "</td>";
  };

  ThirtySixtyNinetyEditor.prototype.renderStatusCell = function (lens, facet, horizonId) {
    var cell = (facet.cells && facet.cells[horizonId]) || emptyCell();
    var hints = this.hintsFor(lens.id, facet, horizonId);
    var filled = !!(cell.status && String(cell.status).trim());
    return '<td class="tsn-cell tsn-cell-status' + (filled ? " is-filled" : "") + '" data-lens="' + lens.id +
      '" data-facet="' + facet.id + '" data-horizon="' + horizonId + '" data-field="status" data-horizon-col="' + horizonId + '">' +
      '<div class="tsn-cell-edit" role="textbox">' + lineMarkup("status", cell.status || "") + "</div>" +
      '<div class="tsn-cell-hints" aria-hidden="true"><div class="tsn-hint">' + esc(hints.status) + "</div></div>" +
      "</td>";
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
        '<textarea class="tsn-panel-field tsn-panel-crit" rows="4">' + esc(cell.criteria) + "</textarea></label>" +
      "<label>Tactics<div class=\"tsn-panel-note\">" + esc(help.tactics || "") + "</div>" +
        '<textarea class="tsn-panel-field tsn-panel-tac" rows="4">' + esc(cell.tactics) + "</textarea></label>" +
      (this.showStatus ? '<label>Status<textarea class="tsn-panel-field tsn-panel-status" rows="2">' + esc(cell.status) + "</textarea></label>" : "") +
      (flags.length ? '<div class="tsn-panel-flags">' + flags.map(function (f) {
        return '<div class="tsn-flag-note">' + esc(f.message) + (f.text ? " " + esc(f.text) : "") + "</div>";
      }).join("") + "</div>" : "") +
      '<div class="tsn-examples">' +
        (example ? '<div class="tsn-example is-good"><div class="tsn-example-label">Example</div>' +
          "<p><strong>" + esc(example.objective || "") + "</strong></p>" +
          splitLines(example.criteria).map(function (c) { return "<p>✓ " + esc(c) + "</p>"; }).join("") +
          splitLines(example.tactics).map(function (t) { return "<p>▪ " + esc(t) + "</p>"; }).join("") +
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
    pruneDismissals: pruneDismissals,
    hydratePlanDismissals: hydratePlanDismissals
  };

})(typeof window !== "undefined" ? window : global);
