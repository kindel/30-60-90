(function (global) {
  "use strict";

  var VERSION = 1;
  var KIND = "kindel.30-60-90";
  var STORE_KEY = "kindel.30-60-90.draft.v1";

  var HORIZON_DEFAULTS = {
    d30: { offsetDays: 30, name: "Land" },
    d60: { offsetDays: 60, name: "Understand Direction" },
    d90: { offsetDays: 90, name: "Grasp Current Condition / Set Next Challenge" },
    d180: { offsetDays: 180, name: "Ship has Turned" }
  };

  var FAMILIES = {
    pm: {
      customer: ["End-customer", "Dealers/users of the product", "3rd parties", "People", "Programs", "Mechanisms"],
      business: ["Finance", "Marketing", "Biz Dev", "M&A", "Goals", "Strategy", "People", "Mechanisms"],
      technical: ["Architecture", "Cloud/software", "Device/firmware", "Hardware", "Development", "Operations", "People", "Mechanisms"],
      organization: ["People", "Culture", "Org design", "Career growth", "Hiring", "Mechanisms"]
    },
    hardware: {
      customer: ["End-customer", "Dealers", "3rd parties/vendors", "People", "Programs", "Mechanisms"],
      business: ["Finance", "M&A", "Goals", "Strategy", "People", "Mechanisms"],
      technical: ["Architecture", "Hardware", "Operations/supply", "People", "Mechanisms"],
      organization: ["People", "Org design", "Career growth", "Hiring", "Mechanisms"]
    },
    general: {
      customer: ["People we serve", "Channel", "3rd parties", "People", "Mechanisms"],
      business: ["Finance", "Goals", "Strategy", "People", "Mechanisms"],
      technical: ["Architecture", "Development", "Operations", "People", "Mechanisms"],
      organization: ["People", "Org design", "Hiring", "Mechanisms"]
    }
  };

  var LENS_ORDER = ["customer", "business", "technical", "organization"];
  var LENS_NAMES = { customer: "Customer", business: "Business", technical: "Technical", organization: "Organization" };

  var TACTIC_VERBS = ["meet", "attend", "read", "talk", "interview", "email", "call", "schedule"];
  var FIRST_PERSON_STARTS = ["i ", "i've ", "i can ", "i have "];

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
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }

  function formatDateLong(d) {
    if (!d) return "";
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
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

  function computeHorizons(startDate, include180) {
    var start = fromIso(startDate);
    if (!start) start = new Date();
    var ids = include180 ? ["d30", "d60", "d90", "d180"] : ["d30", "d60", "d90"];
    return ids.map(function (id) {
      var def = HORIZON_DEFAULTS[id];
      var date = addDays(start, def.offsetDays);
      return {
        id: id,
        offsetDays: def.offsetDays,
        name: def.name,
        date: iso(date)
      };
    });
  }

  function buildLenses(family, horizons) {
    var facetDefs = FAMILIES[family] || FAMILIES.pm;
    return LENS_ORDER.map(function (lensId) {
      var facetNames = facetDefs[lensId] || [];
      return {
        id: lensId,
        name: LENS_NAMES[lensId],
        facets: facetNames.map(function (name) {
          var cells = {};
          horizons.forEach(function (h) {
            cells[h.id] = { objective: "", criteria: "", tactics: "", status: "" };
          });
          return {
            id: slugify(name),
            name: name,
            cells: cells
          };
        })
      };
    });
  }

  function createNewPlan(opts) {
    var startDate = opts.startDate || iso(new Date());
    var horizons = computeHorizons(startDate, opts.include180);
    return {
      version: VERSION,
      kind: KIND,
      seat: { title: opts.seatTitle || "", family: opts.family || "pm" },
      person: { name: opts.personName || "", role: "hire" },
      manager: { name: opts.managerName || "" },
      startDate: startDate,
      include180: opts.include180 || false,
      horizons: horizons,
      lenses: buildLenses(opts.family || "pm", horizons)
    };
  }

  function validatePlan(plan) {
    if (!plan || typeof plan !== "object") return { valid: false, error: "Not an object" };
    if (plan.kind !== KIND) return { valid: false, error: "Not a kindel.30-60-90 file" };
    if (!plan.version || plan.version > VERSION) return { valid: false, error: "Unsupported version" };
    if (!plan.seat || !plan.seat.title) return { valid: false, error: "Missing seat title" };
    if (!plan.startDate) return { valid: false, error: "Missing start date" };
    if (!Array.isArray(plan.horizons) || plan.horizons.length < 3) return { valid: false, error: "Missing horizons" };
    if (!Array.isArray(plan.lenses) || plan.lenses.length !== 4) return { valid: false, error: "Missing or invalid lenses" };
    return { valid: true };
  }

  function pressureTestCell(cell) {
    var flags = [];
    var obj = (cell.objective || "").trim();
    var crit = (cell.criteria || "").trim();

    if (obj && !crit) {
      flags.push("Objective set but criteria is empty");
    }

    if (crit) {
      var lower = crit.toLowerCase();
      var startsWithTactic = TACTIC_VERBS.some(function (v) {
        return lower.startsWith(v + " ") || lower.startsWith(v + ",") || lower === v;
      });
      if (startsWithTactic) {
        var hasFirstPerson = FIRST_PERSON_STARTS.some(function (fp) {
          return lower.startsWith(fp);
        }) || / i [a-z]/.test(lower);
        if (!hasFirstPerson) {
          flags.push("Looks like a tactic, not criteria. Criteria should be first-person and inspectable.");
        }
      }
    }

    return flags;
  }

  function pressureTestPlan(plan) {
    var issues = [];
    (plan.lenses || []).forEach(function (lens) {
      (lens.facets || []).forEach(function (facet) {
        Object.keys(facet.cells || {}).forEach(function (horizonId) {
          var flags = pressureTestCell(facet.cells[horizonId]);
          flags.forEach(function (flag) {
            issues.push({
              lens: lens.name,
              facet: facet.name,
              horizon: horizonId,
              message: flag
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

  function exportMarkdown(plan) {
    var lines = [];
    lines.push("# 30-60-90 Plan");
    lines.push("");

    if (plan.seat && plan.seat.title) {
      lines.push("**Seat:** " + plan.seat.title);
    }
    if (plan.person && plan.person.name) {
      lines.push("**" + (plan.person.role === "hire" ? "Hire" : "Person") + ":** " + plan.person.name);
    }
    if (plan.manager && plan.manager.name) {
      lines.push("**Manager:** " + plan.manager.name);
    }
    if (plan.startDate) {
      lines.push("**Start date:** " + formatDateLong(fromIso(plan.startDate)));
    }
    lines.push("");

    var horizonMap = {};
    (plan.horizons || []).forEach(function (h) {
      horizonMap[h.id] = h;
    });

    (plan.lenses || []).forEach(function (lens) {
      lines.push("## " + lens.name);
      lines.push("");

      (lens.facets || []).forEach(function (facet) {
        lines.push("### " + facet.name);
        lines.push("");

        (plan.horizons || []).forEach(function (h) {
          var cell = (facet.cells || {})[h.id] || {};
          var hasContent = cell.objective || cell.criteria || cell.tactics;
          if (!hasContent) return;

          lines.push("#### " + h.offsetDays + " Days: " + h.name + " (" + formatDate(fromIso(h.date)) + ")");
          lines.push("");

          if (cell.objective) {
            lines.push("**Objective:** " + cell.objective);
            lines.push("");
          }
          if (cell.criteria) {
            lines.push("**Evaluation criteria:** " + cell.criteria);
            lines.push("");
          }
          if (cell.tactics) {
            var tacticsLines = cell.tactics.split("\n").filter(function (l) { return l.trim(); });
            if (tacticsLines.length === 1) {
              lines.push("**Tactics:** " + tacticsLines[0]);
            } else {
              lines.push("**Tactics:**");
              lines.push("");
              tacticsLines.forEach(function (t) {
                lines.push("- " + t.trim());
              });
            }
            lines.push("");
          }
          if (cell.status) {
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

    (plan.lenses || []).forEach(function (lens, li) {
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

  function downloadXlsx(plan) {
    var wb = exportXlsx(plan);
    var filename = generateFilename(plan).replace(".json", ".xlsx");
    XLSX.writeFile(wb, filename);
  }

  function downloadMarkdown(plan) {
    var md = exportMarkdown(plan);
    var filename = generateFilename(plan).replace(".json", ".md");
    var blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadJson(plan) {
    var json = JSON.stringify(plan, null, 2);
    var filename = generateFilename(plan);
    var blob = new Blob([json], { type: "application/json;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importXlsx(workbook) {
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

    var row2 = (data[1] || []).map(function (c) { return String(c || "").toLowerCase(); });
    var colsPerHorizon = 4;
    if (horizonCols.length >= 2) {
      var gap = horizonCols[1].col - horizonCols[0].col;
      if (gap === 3) colsPerHorizon = 3;
    }

    var startDate = iso(new Date());
    var horizons = computeHorizons(startDate, include180);

    var lensMap = {
      "customer": [], "business": [], "technical": [], "organization": []
    };
    var lensNameMap = {
      "customer": "Customer", "customer/product": "Customer",
      "business": "Business",
      "technical": "Technical", "technical/execution": "Technical",
      "organization": "Organization", "organization/people": "Organization"
    };

    var currentLens = null;
    for (var ri = 2; ri < data.length; ri++) {
      var row = data[ri] || [];
      var lensCell = String(row[0] || "").trim();
      var facetName = String(row[1] || "").trim();

      if (lensCell) {
        var lensKey = lensNameMap[lensCell.toLowerCase()];
        if (lensKey) {
          currentLens = lensKey.toLowerCase();
        }
      }

      if (!facetName || !currentLens) continue;

      var cells = {};
      horizonCols.forEach(function (hc, hi) {
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

    var lenses = LENS_ORDER.map(function (lensId) {
      return {
        id: lensId,
        name: LENS_NAMES[lensId],
        facets: lensMap[lensId].length > 0 ? lensMap[lensId] : buildLenses("pm", horizons).find(function (l) { return l.id === lensId; }).facets
      };
    });

    return {
      version: VERSION,
      kind: KIND,
      seat: { title: "", family: "pm" },
      person: { name: "", role: "hire" },
      manager: { name: "" },
      startDate: startDate,
      include180: include180,
      horizons: horizons,
      lenses: lenses
    };
  }

  function ThirtySixtyNinetyEditor(opts) {
    this.rootId = opts.root || "tsn-app";
    this.root = document.getElementById(this.rootId);
    this.plan = null;
    this.dirty = false;
    this.mode = "setup";
    this.collapsedLenses = {};

    this.init();
  }

  ThirtySixtyNinetyEditor.prototype.init = function () {
    if (!this.root) return;
    this.loadDraft();
    this.render();
    this.bindGlobalEvents();
  };

  ThirtySixtyNinetyEditor.prototype.loadDraft = function () {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var plan = JSON.parse(raw);
        var result = validatePlan(plan);
        if (result.valid) {
          this.plan = plan;
          this.mode = "edit";
        }
      }
    } catch (e) {}
  };

  ThirtySixtyNinetyEditor.prototype.saveDraft = function () {
    try {
      if (this.plan) {
        localStorage.setItem(STORE_KEY, JSON.stringify(this.plan));
      }
    } catch (e) {}
  };

  ThirtySixtyNinetyEditor.prototype.clearDraft = function () {
    try {
      localStorage.removeItem(STORE_KEY);
    } catch (e) {}
  };

  ThirtySixtyNinetyEditor.prototype.setDirty = function (dirty) {
    this.dirty = dirty;
    var indicator = this.root.querySelector(".tsn-dirty-indicator");
    if (indicator) {
      indicator.classList.toggle("is-dirty", dirty);
    }
  };

  ThirtySixtyNinetyEditor.prototype.render = function () {
    if (this.mode === "setup") {
      this.renderSetup();
    } else {
      this.renderEditor();
    }
  };

  ThirtySixtyNinetyEditor.prototype.renderSetup = function () {
    var html = [
      '<div class="tsn-toolbar">',
      '  <button type="button" class="tsn-btn" id="tsn-open-json">Open JSON</button>',
      '  <button type="button" class="tsn-btn" id="tsn-import-xlsx">Import XLSX</button>',
      '  <input type="file" class="tsn-file-input" id="tsn-file-json" accept=".json,application/json">',
      '  <input type="file" class="tsn-file-input" id="tsn-file-xlsx" accept=".xlsx,.xls">',
      '</div>',
      '<div class="tsn-setup">',
      '  <h2>New plan</h2>',
      '  <div class="tsn-setup-grid">',
      '    <div class="tsn-field">',
      '      <label for="tsn-seat-title">Seat title</label>',
      '      <input type="text" id="tsn-seat-title" placeholder="VP Product">',
      '    </div>',
      '    <div class="tsn-field">',
      '      <label for="tsn-family">Family</label>',
      '      <select id="tsn-family">',
      '        <option value="pm">Product Management</option>',
      '        <option value="hardware">Hardware</option>',
      '        <option value="general">General Manager / SVP</option>',
      '      </select>',
      '    </div>',
      '    <div class="tsn-field">',
      '      <label for="tsn-start-date">Start date</label>',
      '      <input type="date" id="tsn-start-date" value="' + iso(new Date()) + '">',
      '    </div>',
      '    <div class="tsn-field">',
      '      <label for="tsn-person-name">Hire name (optional)</label>',
      '      <input type="text" id="tsn-person-name" placeholder="Jane Doe">',
      '    </div>',
      '    <div class="tsn-field">',
      '      <label for="tsn-manager-name">Manager name (optional)</label>',
      '      <input type="text" id="tsn-manager-name" placeholder="John Smith">',
      '    </div>',
      '    <div class="tsn-field tsn-checkbox-field">',
      '      <input type="checkbox" id="tsn-include-180">',
      '      <label for="tsn-include-180">Include 180 days (Ship has Turned)</label>',
      '    </div>',
      '  </div>',
      '  <div class="tsn-setup-actions">',
      '    <button type="button" class="tsn-btn tsn-btn-primary" id="tsn-create">Create plan</button>',
      '  </div>',
      '</div>'
    ].join("\n");

    this.root.innerHTML = html;
    this.bindSetupEvents();
  };

  ThirtySixtyNinetyEditor.prototype.renderEditor = function () {
    var plan = this.plan;
    var self = this;

    var metaHtml = [
      '<div class="tsn-meta">',
      '  <div class="tsn-meta-grid">',
      '    <div class="tsn-meta-item"><span class="tsn-meta-label">Seat:</span> <strong>' + esc(plan.seat.title) + '</strong></div>',
      plan.person && plan.person.name ? '    <div class="tsn-meta-item"><span class="tsn-meta-label">Hire:</span> ' + esc(plan.person.name) + '</div>' : '',
      plan.manager && plan.manager.name ? '    <div class="tsn-meta-item"><span class="tsn-meta-label">Manager:</span> ' + esc(plan.manager.name) + '</div>' : '',
      '    <div class="tsn-meta-item"><span class="tsn-meta-label">Start:</span> ' + formatDate(fromIso(plan.startDate)) + '</div>',
      '  </div>',
      '  <div class="tsn-horizons-meta">',
      plan.horizons.map(function (h) {
        return '<span class="tsn-horizon-chip">' + h.offsetDays + ' Days: ' + esc(h.name) + ' <span class="tsn-horizon-chip-date">' + formatDate(fromIso(h.date)) + '</span></span>';
      }).join(""),
      '  </div>',
      '</div>'
    ].join("\n");

    var gridHtml = plan.lenses.map(function (lens) {
      var collapsed = self.collapsedLenses[lens.id];
      return [
        '<div class="tsn-lens' + (collapsed ? ' is-collapsed' : '') + '" data-lens="' + lens.id + '">',
        '  <div class="tsn-lens-header">',
        '    <h3>' + esc(lens.name) + '</h3>',
        '    <button type="button" class="tsn-lens-toggle">' + (collapsed ? 'Expand' : 'Collapse') + '</button>',
        '  </div>',
        '  <div class="tsn-lens-body">',
        lens.facets.map(function (facet, fi) {
          return self.renderFacet(lens, facet, fi);
        }).join(""),
        '    <div class="tsn-add-facet">',
        '      <button type="button" class="tsn-btn" data-add-facet="' + lens.id + '">Add facet</button>',
        '    </div>',
        '  </div>',
        '</div>'
      ].join("\n");
    }).join("\n");

    var html = [
      '<div class="tsn-toolbar">',
      '  <button type="button" class="tsn-btn" id="tsn-new">New</button>',
      '  <button type="button" class="tsn-btn" id="tsn-open-json">Open</button>',
      '  <button type="button" class="tsn-btn tsn-btn-primary" id="tsn-save">Save</button>',
      '  <span class="tsn-toolbar-sep"></span>',
      '  <button type="button" class="tsn-btn" id="tsn-export-xlsx">Export XLSX</button>',
      '  <button type="button" class="tsn-btn" id="tsn-export-md">Export Markdown</button>',
      '  <input type="file" class="tsn-file-input" id="tsn-file-json" accept=".json,application/json">',
      '  <span class="tsn-dirty-indicator' + (this.dirty ? ' is-dirty' : '') + '">Unsaved changes</span>',
      '</div>',
      metaHtml,
      '<div class="tsn-grid-container">',
      gridHtml,
      '</div>'
    ].join("\n");

    this.root.innerHTML = html;
    this.bindEditorEvents();
  };

  ThirtySixtyNinetyEditor.prototype.renderFacet = function (lens, facet, fi) {
    var plan = this.plan;
    var horizonCount = plan.horizons.length;

    var cellsHtml = plan.horizons.map(function (h) {
      var cell = facet.cells[h.id] || {};
      var flags = pressureTestCell(cell);
      var flagged = flags.length > 0;

      return [
        '<div class="tsn-cell' + (flagged ? ' is-flagged' : '') + '" data-lens="' + lens.id + '" data-facet="' + facet.id + '" data-horizon="' + h.id + '">',
        '  <div class="tsn-cell-horizon">' + h.offsetDays + ' Days</div>',
        '  <div class="tsn-cell-field">',
        '    <label>Objective</label>',
        '    <textarea data-field="objective">' + esc(cell.objective || '') + '</textarea>',
        '  </div>',
        '  <div class="tsn-cell-field">',
        '    <label>Evaluation criteria</label>',
        '    <textarea data-field="criteria">' + esc(cell.criteria || '') + '</textarea>',
        '  </div>',
        '  <div class="tsn-cell-field">',
        '    <label>Tactics</label>',
        '    <textarea data-field="tactics">' + esc(cell.tactics || '') + '</textarea>',
        '  </div>',
        '  <div class="tsn-cell-field">',
        '    <label>Status</label>',
        '    <textarea data-field="status">' + esc(cell.status || '') + '</textarea>',
        '  </div>',
        flagged ? '<div class="tsn-cell-flag">' + esc(flags[0]) + '</div>' : '',
        '</div>'
      ].join("\n");
    }).join("");

    return [
      '<div class="tsn-facet" data-lens="' + lens.id + '" data-facet-idx="' + fi + '">',
      '  <div class="tsn-facet-header">',
      '    <input type="text" class="tsn-facet-name-input" value="' + esc(facet.name) + '" data-facet-name="' + lens.id + ':' + fi + '">',
      '    <button type="button" class="tsn-facet-remove" data-remove-facet="' + lens.id + ':' + fi + '" title="Remove facet">&times;</button>',
      '  </div>',
      '  <div class="tsn-horizons has-' + horizonCount + '">',
      cellsHtml,
      '  </div>',
      '</div>'
    ].join("\n");
  };

  ThirtySixtyNinetyEditor.prototype.bindGlobalEvents = function () {
    var self = this;
    window.addEventListener("beforeunload", function (e) {
      if (self.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  };

  ThirtySixtyNinetyEditor.prototype.bindSetupEvents = function () {
    var self = this;

    var createBtn = document.getElementById("tsn-create");
    if (createBtn) {
      createBtn.addEventListener("click", function () {
        var seatTitle = document.getElementById("tsn-seat-title").value.trim();
        if (!seatTitle) {
          alert("Please enter a seat title");
          return;
        }
        self.plan = createNewPlan({
          seatTitle: seatTitle,
          family: document.getElementById("tsn-family").value,
          startDate: document.getElementById("tsn-start-date").value,
          personName: document.getElementById("tsn-person-name").value.trim(),
          managerName: document.getElementById("tsn-manager-name").value.trim(),
          include180: document.getElementById("tsn-include-180").checked
        });
        self.mode = "edit";
        self.setDirty(true);
        self.saveDraft();
        self.render();
      });
    }

    this.bindFileEvents();
  };

  ThirtySixtyNinetyEditor.prototype.bindEditorEvents = function () {
    var self = this;

    var newBtn = document.getElementById("tsn-new");
    if (newBtn) {
      newBtn.addEventListener("click", function () {
        if (self.dirty) {
          if (!confirm("You have unsaved changes. Start a new plan anyway?")) {
            return;
          }
        }
        self.plan = null;
        self.mode = "setup";
        self.setDirty(false);
        self.clearDraft();
        self.render();
      });
    }

    var saveBtn = document.getElementById("tsn-save");
    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        downloadJson(self.plan);
        self.setDirty(false);
        self.saveDraft();
      });
    }

    var exportXlsxBtn = document.getElementById("tsn-export-xlsx");
    if (exportXlsxBtn) {
      exportXlsxBtn.addEventListener("click", function () {
        try {
          downloadXlsx(self.plan);
        } catch (e) {
          alert("Could not export XLSX: " + e.message);
        }
      });
    }

    var exportMdBtn = document.getElementById("tsn-export-md");
    if (exportMdBtn) {
      exportMdBtn.addEventListener("click", function () {
        downloadMarkdown(self.plan);
      });
    }

    this.root.querySelectorAll(".tsn-lens-header").forEach(function (header) {
      header.addEventListener("click", function () {
        var lensEl = header.closest(".tsn-lens");
        var lensId = lensEl.getAttribute("data-lens");
        self.collapsedLenses[lensId] = !self.collapsedLenses[lensId];
        lensEl.classList.toggle("is-collapsed");
        var toggleBtn = header.querySelector(".tsn-lens-toggle");
        if (toggleBtn) {
          toggleBtn.textContent = self.collapsedLenses[lensId] ? "Expand" : "Collapse";
        }
      });
    });

    this.root.querySelectorAll(".tsn-cell textarea").forEach(function (textarea) {
      textarea.addEventListener("input", function () {
        var cell = textarea.closest(".tsn-cell");
        var lensId = cell.getAttribute("data-lens");
        var facetId = cell.getAttribute("data-facet");
        var horizonId = cell.getAttribute("data-horizon");
        var field = textarea.getAttribute("data-field");

        var lens = self.plan.lenses.find(function (l) { return l.id === lensId; });
        if (!lens) return;
        var facet = lens.facets.find(function (f) { return f.id === facetId; });
        if (!facet) return;
        if (!facet.cells[horizonId]) {
          facet.cells[horizonId] = { objective: "", criteria: "", tactics: "", status: "" };
        }
        facet.cells[horizonId][field] = textarea.value;
        self.setDirty(true);
        self.saveDraft();

        var flags = pressureTestCell(facet.cells[horizonId]);
        cell.classList.toggle("is-flagged", flags.length > 0);
        var flagEl = cell.querySelector(".tsn-cell-flag");
        if (flags.length > 0) {
          if (!flagEl) {
            flagEl = document.createElement("div");
            flagEl.className = "tsn-cell-flag";
            cell.appendChild(flagEl);
          }
          flagEl.textContent = flags[0];
        } else if (flagEl) {
          flagEl.remove();
        }
      });
    });

    this.root.querySelectorAll(".tsn-facet-name-input").forEach(function (input) {
      input.addEventListener("input", function () {
        var parts = input.getAttribute("data-facet-name").split(":");
        var lensId = parts[0];
        var facetIdx = parseInt(parts[1], 10);
        var lens = self.plan.lenses.find(function (l) { return l.id === lensId; });
        if (lens && lens.facets[facetIdx]) {
          lens.facets[facetIdx].name = input.value;
          lens.facets[facetIdx].id = slugify(input.value) || ("facet-" + facetIdx);
          self.setDirty(true);
          self.saveDraft();
        }
      });
    });

    this.root.querySelectorAll("[data-add-facet]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var lensId = btn.getAttribute("data-add-facet");
        var lens = self.plan.lenses.find(function (l) { return l.id === lensId; });
        if (!lens) return;
        var newFacet = {
          id: "new-facet-" + Date.now(),
          name: "New facet",
          cells: {}
        };
        self.plan.horizons.forEach(function (h) {
          newFacet.cells[h.id] = { objective: "", criteria: "", tactics: "", status: "" };
        });
        lens.facets.push(newFacet);
        self.setDirty(true);
        self.saveDraft();
        self.render();
      });
    });

    this.root.querySelectorAll("[data-remove-facet]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var parts = btn.getAttribute("data-remove-facet").split(":");
        var lensId = parts[0];
        var facetIdx = parseInt(parts[1], 10);
        var lens = self.plan.lenses.find(function (l) { return l.id === lensId; });
        if (!lens || lens.facets.length <= 1) {
          alert("Cannot remove the last facet in a lens");
          return;
        }
        if (!confirm("Remove this facet?")) return;
        lens.facets.splice(facetIdx, 1);
        self.setDirty(true);
        self.saveDraft();
        self.render();
      });
    });

    this.bindFileEvents();
  };

  ThirtySixtyNinetyEditor.prototype.bindFileEvents = function () {
    var self = this;

    var openJsonBtn = document.getElementById("tsn-open-json");
    var fileJsonInput = document.getElementById("tsn-file-json");
    if (openJsonBtn && fileJsonInput) {
      openJsonBtn.addEventListener("click", function () {
        if (self.dirty) {
          if (!confirm("You have unsaved changes. Open a different file anyway?")) {
            return;
          }
        }
        fileJsonInput.click();
      });
      fileJsonInput.addEventListener("change", function () {
        var file = fileJsonInput.files[0];
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
            self.plan = plan;
            self.mode = "edit";
            self.setDirty(false);
            self.saveDraft();
            self.render();
          } catch (err) {
            alert("Could not parse JSON: " + err.message);
          }
        };
        reader.readAsText(file);
        fileJsonInput.value = "";
      });
    }

    var importXlsxBtn = document.getElementById("tsn-import-xlsx");
    var fileXlsxInput = document.getElementById("tsn-file-xlsx");
    if (importXlsxBtn && fileXlsxInput) {
      importXlsxBtn.addEventListener("click", function () {
        fileXlsxInput.click();
      });
      fileXlsxInput.addEventListener("change", function () {
        var file = fileXlsxInput.files[0];
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
            var plan = importXlsx(workbook);
            self.plan = plan;
            self.mode = "edit";
            self.setDirty(true);
            self.saveDraft();
            self.render();
          } catch (err) {
            alert("Could not import XLSX: " + err.message);
          }
        };
        reader.readAsArrayBuffer(file);
        fileXlsxInput.value = "";
      });
    }
  };

  global.ThirtySixtyNinetyEditor = ThirtySixtyNinetyEditor;

  global.kindel3090 = {
    createNewPlan: createNewPlan,
    validatePlan: validatePlan,
    pressureTestCell: pressureTestCell,
    pressureTestPlan: pressureTestPlan,
    exportMarkdown: exportMarkdown,
    exportXlsx: exportXlsx,
    importXlsx: importXlsx,
    computeHorizons: computeHorizons,
    buildLenses: buildLenses
  };

})(typeof window !== "undefined" ? window : global);
