#!/usr/bin/env node
"use strict";

var fs = require("fs");
var path = require("path");
var XLSX = require("xlsx");
var builder = require("./build-templates");

var root = path.join(__dirname, "..");
var srcPath = path.join(root, "js", "thirty-sixty-ninety.js");
var templatesJsPath = path.join(root, "js", "templates.js");
var src = fs.readFileSync(srcPath, "utf8");
var templatesSrc = fs.readFileSync(templatesJsPath, "utf8");

var window = globalThis;
eval(templatesSrc);
eval(src);

var api = globalThis.kindel3090;

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

function assertEqual(a, b, msg) {
  if (a !== b) {
    console.error("FAIL:", msg);
    console.error("  Expected:", b);
    console.error("  Got:", a);
    process.exit(1);
  }
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

console.log("Testing template bundle...");
assert(!builder.isBundleStale(), "js/templates.js is stale; run node scripts/build-templates.js");

var manifest = readJson("templates/index.json");
var manifestResult = api.validateManifest(manifest);
assert(manifestResult.valid, "manifest should validate: " + manifestResult.error);
assertEqual(manifest.default, "product-senior", "default template id");
var defaultEntry = manifest.templates.find(function (t) { return t.id === manifest.default; });
assert(defaultEntry, "default entry exists");
assertEqual(defaultEntry.level, "senior", "default level tag");
assertEqual(defaultEntry["function"], "product", "default function tag");

var template;
manifest.templates.forEach(function (entry) {
  var t = readJson("templates/" + entry.file);
  var result = api.validateTemplate(t);
  assert(result.valid, entry.id + " should validate: " + result.error);
  assertEqual(t.id, entry.id, entry.id + " id matches manifest");
  assertEqual(t.level, entry.level, entry.id + " level matches manifest");
  assertEqual(t["function"], entry["function"], entry.id + " function matches manifest");
  if (entry.id === manifest.default) template = t;
});
assert(template, "default template file loaded");
assert(template.seatTitle, "default template has a seat title");
assertEqual(template.version, 2, "product-senior version is 2 so older empty drafts refresh");
function hasItems(value) {
  if (Array.isArray(value)) return value.some(function (v) { return String(v || "").trim(); });
  return String(value || "").trim().length > 0;
}

["d30", "d60", "d90"].forEach(function (hid) {
  template.lenses.forEach(function (lens) {
    (lens.facets || []).forEach(function (facet) {
      var ex = facet.cells && facet.cells[hid] && facet.cells[hid].example;
      assert(ex && String(ex.objective || "").trim(), lens.id + "/" + facet.id + "/" + hid + " needs an example objective");
      assert(ex && Array.isArray(ex.criteria) && hasItems(ex.criteria), lens.id + "/" + facet.id + "/" + hid + " needs example criteria as an array");
      assert(ex && Array.isArray(ex.tactics) && hasItems(ex.tactics), lens.id + "/" + facet.id + "/" + hid + " needs example tactics as an array");
    });
  });
});

var bundle = api.getBundle();
assert(bundle, "bundle should load");
assertEqual(api.getDefaultTemplate().id, "product-senior", "runtime default is product-senior");

var extraBundle = JSON.parse(JSON.stringify(bundle));
extraBundle.manifest.templates.push({
  id: "extra",
  file: "extra.json",
  label: "Extra",
  level: "junior",
  "function": "technical"
});
extraBundle.templates.extra = {
  kind: "kindel.30-60-90.template",
  version: 1,
  id: "extra",
  level: "junior",
  "function": "technical",
  horizons: template.horizons,
  lenses: template.lenses
};
api.setBundle(extraBundle);
assertEqual(api.getDefaultTemplate().id, "product-senior", "a second manifest entry does not change the default");
api.setBundle(bundle);

console.log("Testing template text stays out of app JS...");
["Land", "End users", "Start Formulating Plan", "Objective & criteria", "Ship has Turned"].forEach(function (needle) {
  assert(src.indexOf(needle) < 0, "app JS must not contain " + JSON.stringify(needle));
});

console.log("Testing narrow layout breakpoint...");
var css = fs.readFileSync(path.join(root, "css", "thirty-sixty-ninety.css"), "utf8");
assertEqual(api.NARROW_MAX_PX, 700, "JS narrow max is 700");
assert(css.indexOf("@media (max-width: 700px)") >= 0, "CSS stacks to tabs at 700px");
assert(css.indexOf("@media (max-width: 900px)") < 0, "tabs must not kick in at 900px");
assert(src.indexOf("900px") < 0, "JS must not use 900px as the narrow breakpoint");
assert(css.indexOf(".tsn-cell-crit:not(.tsn-cell-lead)") >= 0, "phone hides extra empty criteria only");
assert(css.indexOf(".tsn-cell-tac:not(.tsn-cell-lead)") >= 0, "phone hides extra empty tactics only");
assert(src.indexOf("tsn-cell-lead") >= 0, "first criterion and tactic slots are marked lead");
assert(src.indexOf("ThirtySixtyNinetyEditor.prototype.clampSel") >= 0, "selection clamps after a list shrinks");
assert(src.indexOf("ThirtySixtyNinetyEditor.prototype.notePendingEdit") >= 0, "pending cell edits persist and warn before unload");
assert(src.indexOf("self._blurRefreshWaiting = true") >= 0, "blur refresh waits while a confirm dialog is open");
assert(src.indexOf("this._blurRefreshWaiting && !opts.keepFocus") >= 0, "closing the dialog runs the postponed blur refresh");
assert(src.indexOf("this.commitEdit();\n    var cellEl = el.closest(\".tsn-cell\");") >= 0, "redirect actions commit the active edit first");
assert(src.indexOf("this.notePendingEdit(input.value)") >= 0, "type-to-replace records the pending edit");
assert(src.indexOf("this._pendingDirty = false;\n      this._pendingValue = null;\n      this.clearOrRemoveSelected()") >= 0, "empty Backspace clears pending edit before save");
assert(src.indexOf('e.target.closest(".tsn-cell-input")') >= 0, "double-click on the editor textarea is ignored");
assert(src.indexOf("if (!this.moveSel(e.shiftKey ? \"left\" : \"right\")) return;") >= 0, "Tab at the grid edge leaves the grid");
assert(src.indexOf("opts.keepFocus && this.sel") >= 0, "render focuses the grid only when keepFocus is set");
assert(src.indexOf("first.tabIndex = 0") >= 0, "an unselected grid still has a tab stop");
assert(src.indexOf("focusPointerRestore") >= 0, "blur restore puts focus back on the clicked control");
assert(src.indexOf('e.target.closest(".tsn-cell")') >= 0, "paste outside the grid does not overwrite the selected cell");
assert(src.indexOf("if (e.target.closest && (e.target.closest(\"[data-action]\")") >= 0, "grid shortcuts ignore toolbar and flag buttons");
assert(src.indexOf("sel.field === \"objective\" || sel.field === \"status\"") >= 0, "objective and status paste keep the full text");
assert(src.indexOf('data-action="use-template"') >= 0, "toolbar can apply a template");
assert(src.indexOf("Replace your plan's writing with the ") >= 0, "apply confirms before replacing writing");
assert(src.indexOf("shouldAutoApplyTemplate") >= 0, "empty stale drafts auto-load the template");

var facetSets = readJson("templates/facet-sets.json");
assert(facetSets.sets.hardware, "facet-sets has hardware");
assert(facetSets.sets.general, "facet-sets has general");
assert(facetSets.sets.hardware.lenses.technical.indexOf("Operations/supply") >= 0, "hardware set kept");
assert(facetSets.sets.general.lenses.customer.indexOf("People we serve") >= 0, "general set kept");

console.log("Testing createNewPlan...");
var plan = api.createNewPlan({
  seatTitle: "VP Product",
  family: "pm",
  startDate: "2024-06-01",
  personName: "Jane Doe",
  managerName: "John Smith",
  include180: false
});

assert(plan.version === 1, "version should be 1");
assert(plan.kind === "kindel.30-60-90", "kind should be kindel.30-60-90");
assertEqual(plan.seat.title, "VP Product", "seat title");
assertEqual(plan.seat.family, "pm", "seat family");
assertEqual(plan.startDate, "2024-06-01", "start date");
assertEqual(plan.person.name, "Jane Doe", "person name");
assertEqual(plan.manager.name, "John Smith", "manager name");
assertEqual(plan.include180, false, "include180");
assertEqual(plan.horizons.length, 3, "should have 3 horizons");
assertEqual(plan.lenses.length, 4, "should have 4 lenses");
assert(plan.template && plan.template.id === "product-senior", "plan records template id");
assertEqual(plan.template.version, template.version, "plan records template version");

assertEqual(plan.horizons[0].id, "d30", "first horizon id");
assertEqual(plan.horizons[0].offsetDays, 30, "first horizon offset");
assertEqual(plan.horizons[0].date, "2024-07-01", "first horizon date");
assertEqual(plan.horizons[1].date, "2024-07-31", "second horizon date");
assertEqual(plan.horizons[2].date, "2024-08-30", "third horizon date");
assertEqual(plan.horizons[0].name, template.horizons[0].name, "d30 name from template");
assertEqual(plan.horizons[1].name, template.horizons[1].name, "d60 name from template");
assertEqual(plan.horizons[2].name, template.horizons[2].name, "d90 name from template");

assertEqual(plan.lenses[0].id, "customer", "first lens is customer");
assertEqual(plan.lenses[1].id, "business", "second lens is business");
assertEqual(plan.lenses[2].id, "technical", "third lens is technical");
assertEqual(plan.lenses[3].id, "organization", "fourth lens is organization");
assertEqual(plan.lenses[0].facets.length, 3, "customer has three starter facets");
assertEqual(plan.lenses[0].facets[0].name, "End users", "first customer facet");
assertEqual(plan.lenses[0].facets[1].name, "Partners", "second customer facet");
assertEqual(plan.lenses[0].facets[2].name, "Mechanisms", "customer starts with Mechanisms");
assertEqual(plan.lenses[1].facets[0].name, "Finance", "first business facet");
assertEqual(plan.lenses[1].facets[1].name, "Strategy", "second business facet");
assertEqual(plan.lenses[1].facets[2].name, "Mechanisms", "business starts with Mechanisms");
assertEqual(plan.lenses[2].facets[0].name, "Architecture", "first technical facet");
assertEqual(plan.lenses[2].facets[1].name, "Quality", "second technical facet");
assertEqual(plan.lenses[2].facets[2].name, "Mechanisms", "technical starts with Mechanisms");
assertEqual(plan.lenses[3].facets[0].name, "People", "first organization facet");
assertEqual(plan.lenses[3].facets[1].name, "Mechanisms", "organization starts with Mechanisms");
plan.lenses.forEach(function (lens) {
  assert(lens.facets.some(function (f) { return f.name === "Mechanisms"; }), lens.id + " has a Mechanisms facet");
});
var customerMech = plan.lenses[0].facets[2].cells.d30;
assertEqual(customerMech.objective, "Learn the signal", "customer Mechanisms d30 objective");
assert(customerMech.tactics.some(function (t) { return t.indexOf("customer-signal") >= 0; }), "customer Mechanisms cites a weekly signal review");
var businessMech = plan.lenses[1].facets[2].cells.d30;
assert(businessMech.tactics.some(function (t) { return t.indexOf("MBR") >= 0; }), "business Mechanisms cites the monthly business review");
var techMech = plan.lenses[2].facets[2].cells.d30;
assert(techMech.tactics.some(function (t) { return t.indexOf("architecture review") >= 0; }), "technical Mechanisms cites an architecture review");
var orgMech = plan.lenses[3].facets[1].cells;
assertEqual(orgMech.d30.objective, "Learn how we hire", "org Mechanisms d30 is hiring");
assert(orgMech.d30.criteria[0].indexOf("req process") >= 0, "org Mechanisms d30 covers the req process");
assertEqual(orgMech.d60.objective, "Define the hiring plan", "org Mechanisms d60 is the hiring plan");
assert(orgMech.d60.criteria[0].indexOf("backwards from the plan") >= 0, "org Mechanisms d60 works backwards from the plan");
assertEqual(orgMech.d90.objective, "Post the roles", "org Mechanisms d90 is posting roles");
assert(orgMech.d90.criteria[0].indexOf("Three Sr. Manager PM roles are posted") >= 0, "org Mechanisms d90 posts three Sr Mgr PM roles");
assert(orgMech.d90.tactics.indexOf("Post Sr Mgr PM roles") >= 0, "org Mechanisms d90 posts the roles");
assert(orgMech.d90.tactics.indexOf("Train the interview loop") >= 0, "org Mechanisms d90 trains the loop");

var endUsersD30 = plan.lenses[0].facets[0].cells.d30;
assertEqual(endUsersD30.objective, template.lenses[0].facets[0].cells.d30.example.objective, "new plan copies example objective");
assertEqual(JSON.stringify(endUsersD30.criteria), JSON.stringify(template.lenses[0].facets[0].cells.d30.example.criteria), "new plan copies example criteria");
assertEqual(JSON.stringify(endUsersD30.tactics), JSON.stringify(template.lenses[0].facets[0].cells.d30.example.tactics), "new plan copies example tactics");
assert(Array.isArray(endUsersD30.criteria), "new plan stores criteria as an array");
assert(Array.isArray(endUsersD30.tactics), "new plan stores tactics as an array");
assert(endUsersD30.tactics.length >= 2, "template tactics split into individual items");
assert(api.planHasCellContent(plan), "filled new plan has cell content");

["d30", "d60", "d90"].forEach(function (hid) {
  plan.lenses.forEach(function (lens) {
    lens.facets.forEach(function (facet) {
      var cell = facet.cells[hid];
      assert(cell && cell.objective && api.filledItems(cell.criteria).length && api.filledItems(cell.tactics).length,
        lens.id + "/" + facet.id + "/" + hid + " is filled from the template");
    });
  });
});

var defaulted = api.createNewPlan({ startDate: "2024-06-01" });
assertEqual(defaulted.seat.title, template.seatTitle, "new plan uses the template seat title");
var defaultedValidation = api.validatePlan(defaulted);
assert(defaultedValidation.valid, "filled new plan should validate");

var emptied = api.createNewPlan({ startDate: "2024-06-01", fillExamples: false, seatTitle: "" });
assertEqual(emptied.seat.title, "", "Start blank may have an empty seat title");
assert(!api.planHasCellContent(emptied), "fillExamples false leaves cells empty");
assert(emptied.template && emptied.template.id === "product-senior", "blank plan still records the template");
var emptiedValidation = api.validatePlan(emptied);
assert(emptiedValidation.valid, "empty plan should validate");

console.log("Testing empty localStorage drafts...");
assert(api.isUntouchedEmptyDraft(emptied), "empty draft without startedBlank is untouched");
assert(!api.isUntouchedEmptyDraft(defaulted), "filled plan is not an empty draft");
var startedBlank = JSON.parse(JSON.stringify(emptied));
startedBlank.startedBlank = true;
assert(!api.isUntouchedEmptyDraft(startedBlank), "Start blank is not treated as an old empty draft");
assert(api.validatePlan(startedBlank).valid, "startedBlank remains a valid plan");

function memoryStore(map) {
  return {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null; },
    removeItem: function (key) { delete map[key]; }
  };
}

var v1Store = {};
v1Store[api.STORE_KEYS[1]] = JSON.stringify(emptied);
assert(api.readStoredDraft(memoryStore(v1Store)) == null, "old empty v1 draft is ignored");
assert(v1Store[api.STORE_KEYS[1]] == null, "ignored empty v1 draft is removed");

var v2Empty = {};
v2Empty[api.STORE_KEYS[0]] = JSON.stringify(emptied);
assert(api.readStoredDraft(memoryStore(v2Empty)) == null, "empty v2 draft without startedBlank is ignored");

var v2Started = {};
v2Started[api.STORE_KEYS[0]] = JSON.stringify(startedBlank);
var keptBlank = api.readStoredDraft(memoryStore(v2Started));
assert(keptBlank && keptBlank.startedBlank, "Start blank draft is kept");
assert(!api.planHasCellContent(keptBlank), "Start blank draft stays empty");

var v2Filled = {};
v2Filled[api.STORE_KEYS[0]] = JSON.stringify(defaulted);
var keptFilled = api.readStoredDraft(memoryStore(v2Filled));
assert(keptFilled && api.planHasCellContent(keptFilled), "filled draft is kept");
assertEqual(keptFilled.seat.title, template.seatTitle, "filled draft keeps the template seat title");

console.log("Testing apply template...");
assertEqual(api.templateApplyConfirmMessage(template),
  "Replace your plan's writing with the " + template.seatTitle + " example?",
  "confirm names the VP of Product example");
assertEqual(api.listTemplates().length, 1, "one shipped template is a button, not a menu");
api.setBundle(extraBundle);
assertEqual(api.listTemplates().length, 2, "a second manifest entry lists both templates");
api.setBundle(bundle);

var staleEmpty = JSON.parse(JSON.stringify(startedBlank));
staleEmpty.template = { id: "product-senior", version: 1 };
staleEmpty.person = { name: "Ada", role: "hire" };
staleEmpty.manager = { name: "Grace" };
staleEmpty.horizons[0].name = "Keep this name";
staleEmpty.horizons[0].dateManual = true;
assert(api.shouldAutoApplyTemplate(staleEmpty, template), "empty older draft auto-applies");
assert(!api.shouldOfferTemplateUpdate(staleEmpty, template), "empty older draft does not only offer");

var currentEmpty = JSON.parse(JSON.stringify(staleEmpty));
currentEmpty.template = { id: "product-senior", version: template.version };
assert(!api.shouldAutoApplyTemplate(currentEmpty, template), "empty current-version Start blank stays blank");
assert(!api.shouldOfferTemplateUpdate(currentEmpty, template), "empty current-version draft is not offered");

var noContentNoStamp = JSON.parse(JSON.stringify(startedBlank));
delete noContentNoStamp.template;
assert(api.shouldAutoApplyTemplate(noContentNoStamp, template), "empty draft with no template stamp auto-applies");

var staleFilled = JSON.parse(JSON.stringify(defaulted));
staleFilled.template = { id: "product-senior", version: 1 };
staleFilled.person.name = "Ada";
assert(!api.shouldAutoApplyTemplate(staleFilled, template), "filled older draft is not auto-applied");
assert(api.shouldOfferTemplateUpdate(staleFilled, template), "filled older draft is offered the newer example");

var applied = api.applyTemplateToPlan(JSON.parse(JSON.stringify(staleEmpty)), template);
assert(api.planHasCellContent(applied), "apply fills cells from the template");
assertEqual(applied.person.name, "Ada", "apply keeps the hire name");
assertEqual(applied.manager.name, "Grace", "apply keeps the manager name");
assertEqual(applied.startDate, "2024-06-01", "apply keeps the start date");
assertEqual(applied.horizons[0].date, staleEmpty.horizons[0].date, "apply keeps horizon dates");
assertEqual(applied.horizons[0].name, "Keep this name", "apply keeps horizon names");
assertEqual(applied.template.id, "product-senior", "apply records the template id");
assertEqual(applied.template.version, template.version, "apply records the template version");
assert(!applied.startedBlank, "apply clears startedBlank");
assertEqual(applied.seat.title, template.seatTitle, "apply uses the template seat title");
assertEqual(applied.lenses[0].facets[0].cells.d30.objective, template.lenses[0].facets[0].cells.d30.example.objective, "apply copies example objectives");

console.log("Testing createNewPlan with 180 days...");
var plan180 = api.createNewPlan({
  seatTitle: "SVP Engineering",
  startDate: "2024-01-15",
  include180: true
});

assertEqual(plan180.horizons.length, 4, "should have 4 horizons with include180");
assertEqual(plan180.horizons[3].id, "d180", "fourth horizon is d180");
assertEqual(plan180.horizons[3].name, "Ship has Turned", "180 day name from template");

console.log("Testing validatePlan...");
var result = api.validatePlan(plan);
assert(result.valid, "valid plan should validate");

var badPlan = { kind: "wrong-kind" };
result = api.validatePlan(badPlan);
assert(!result.valid, "wrong kind should not validate");
assert(result.error.indexOf("kindel.30-60-90") >= 0, "error should mention kind");

console.log("Testing v1 file loading...");
var v1 = readJson("fixtures/v1-plan.json");
var v1Result = api.validatePlan(v1);
assert(v1Result.valid, "v1 fixture should validate: " + v1Result.error);
assertEqual(v1.version, 1, "v1 version");
assert(!v1.template, "v1 fixture has no template field");
var v1Customer = v1.lenses.find(function (l) { return l.id === "customer"; });
assert(v1Customer.facets.some(function (f) { return f.name === "End-customer"; }), "v1 facets preserved");

console.log("Testing pressureTestCell...");
function flagTypes(flags) {
  return flags.map(function (f) { return f.type; }).join(",");
}

var flags = api.pressureTestCell({ objective: "Do something", criteria: "", tactics: "", status: "" });
assertEqual(flags.length, 1, "should flag empty criteria with objective");
assertEqual(flags[0].type, "empty-criteria", "empty-criteria type");
assert(flags[0].message.indexOf("criteria is empty") >= 0, "flag message about empty criteria");

flags = api.pressureTestCell({ objective: "", criteria: "Meet with the PMs", tactics: "", status: "" });
assertEqual(flags.length, 1, "should flag tactic-like criteria");
assertEqual(flags[0].type, "tactic-like", "tactic-like type");
assert(flags[0].message.indexOf("tactic") >= 0, "flag message about tactics");

flags = api.pressureTestCell({ objective: "", criteria: "Attend the all-hands", tactics: "", status: "" });
assertEqual(flags.length, 1, "should flag Attend");

flags = api.pressureTestCell({ objective: "", criteria: "Read the documentation", tactics: "", status: "" });
assertEqual(flags.length, 1, "should flag Read");

flags = api.pressureTestCell({ objective: "", criteria: "Shadow a support call", tactics: "", status: "" });
assertEqual(flags.length, 1, "should flag Shadow");

flags = api.pressureTestCell({ objective: "", criteria: "Visit 3 customers", tactics: "", status: "" });
assertEqual(flags.length, 1, "should flag Visit");

flags = api.pressureTestCell({ objective: "", criteria: "Sit with FP&A", tactics: "", status: "" });
assertEqual(flags.length, 1, "should flag Sit with");

flags = api.pressureTestCell({ objective: "", criteria: "Set up the dashboard", tactics: "", status: "" });
assertEqual(flags.length, 1, "should flag Set up");

flags = api.pressureTestCell({ objective: "", criteria: "I will meet the PMs", tactics: "", status: "" });
assertEqual(flags.length, 1, "should flag I will + activity");

flags = api.pressureTestCell({ objective: "", criteria: "I'll review the tickets", tactics: "", status: "" });
assertEqual(flags.length, 1, "should flag I'll + activity");

flags = api.pressureTestCell({ objective: "", criteria: "Meet the PMs so I learn", tactics: "", status: "" });
assertEqual(flags.length, 1, "old / i [a-z]/ leak should be gone");

flags = api.pressureTestCell({ objective: "", criteria: "I can name our top 10 customers", tactics: "", status: "" });
assertEqual(flags.length, 0, "should not flag I can");

flags = api.pressureTestCell({ objective: "", criteria: "I can enumerate the 15 programs", tactics: "", status: "" });
assertEqual(flags.length, 0, "should not flag first-person criteria");

flags = api.pressureTestCell({ objective: "", criteria: "I've completed the onboarding", tactics: "", status: "" });
assertEqual(flags.length, 0, "should not flag I've");

flags = api.pressureTestCell({ objective: "", criteria: "I have documented the architecture", tactics: "", status: "" });
assertEqual(flags.length, 0, "should not flag I have");

flags = api.pressureTestCell({ objective: "", criteria: "I know our defect trends", tactics: "", status: "" });
assertEqual(flags.length, 0, "should not flag I know");

flags = api.pressureTestCell({ objective: "", criteria: "My plan cites customer input", tactics: "", status: "" });
assertEqual(flags.length, 0, "should not flag My …");

flags = api.pressureTestCell({ objective: "", criteria: "The CEO has reviewed my priorities", tactics: "", status: "" });
assertEqual(flags.length, 0, "should not flag Someone has …");

flags = api.pressureTestCell({
  objective: "Ship the feature",
  criteria: "I can demo the feature to stakeholders",
  tactics: "Write code",
  status: ""
});
assertEqual(flags.length, 0, "valid cell should have no flags");

flags = api.pressureTestCell({
  objective: "Assess talent",
  criteria: "I can name strengths\nMeet every skip-level",
  tactics: "",
  status: ""
});
assertEqual(flags.length, 1, "flags per line");
assertEqual(flags[0].lineIndex, 1, "second criterion is the tactic");

flags = api.pressureTestCell({
  objective: "Assess talent",
  criteria: "Meet every skip-level",
  tactics: "",
  dismissed: [0],
  status: ""
});
assertEqual(flags.length, 0, "dismissed tactic line is kept");

flags = api.pressureTestCell({
  objective: "",
  criteria: "Meet whoever has the data",
  tactics: "",
  status: ""
});
assertEqual(flags.length, 1, "has in the middle of a tactic still flags");

flags = api.pressureTestCell({
  objective: "",
  criteria: "Read what has changed",
  tactics: "",
  status: ""
});
assertEqual(flags.length, 1, "Read what has changed still flags");

flags = api.pressureTestCell({
  objective: "",
  criteria: "Finance has accepted my plan's budget",
  tactics: "",
  status: ""
});
assertEqual(flags.length, 0, "Someone has … is not a tactic");

flags = api.pressureTestCell({
  objective: "",
  criteria: "Meet every skip-level",
  tactics: "",
  dismissed: [0],
  dismissedText: ["Meet every skip-level"],
  status: ""
});
assertEqual(flags.length, 0, "kept text stays dismissed");

flags = api.pressureTestCell({
  objective: "",
  criteria: "Read confidential files",
  tactics: "",
  dismissed: [0],
  dismissedText: ["Meet every skip-level"],
  status: ""
});
assertEqual(flags.length, 1, "replacing a kept line re-flags it");

var keptCell = {
  objective: "",
  criteria: "Meet every skip-level",
  tactics: "",
  dismissed: [0],
  dismissedText: ["Meet every skip-level"],
  status: ""
};
keptCell.criteria = "Read confidential files";
api.pruneDismissals(keptCell);
assert(!keptCell.dismissed, "prune drops Keep when the text is gone");
assertEqual(api.pressureTestCell(keptCell).length, 1, "pruned Keep re-flags");

var shifted = {
  objective: "",
  criteria: "I can name them\nMeet every skip-level",
  tactics: "",
  dismissed: [1],
  dismissedText: ["Meet every skip-level"],
  status: ""
};
shifted.criteria = "New criterion\nI can name them\nMeet every skip-level";
api.pruneDismissals(shifted);
assertEqual(shifted.dismissed.join(","), "2", "Keep remaps to the same criterion after insert");
assertEqual(api.pressureTestCell(shifted).length, 0, "remapped Keep still dismissed");

assert(api.lineLooksLikeTactic("Meet with the PMs"), "Meet with the PMs is a tactic");
assert(!api.lineLooksLikeTactic("I can name our top 10 customers"), "I can name is not a tactic");
assert(api.lineLooksLikeTactic("I will meet the PMs"), "I will meet is a tactic");
assert(api.lineLooksLikeTactic("Meet whoever has the data"), "Meet whoever has the data is a tactic");
assert(!api.lineLooksLikeTactic("The CEO has reviewed my priorities"), "Someone has … is not a tactic");

console.log("Testing splitLines...");
assertEqual(api.splitLines("-5% churn").join("|"), "-5% churn", "leading minus is not a bullet");
assertEqual(api.splitLines("- cut churn").join("|"), "cut churn", "dash plus space is a bullet");
assertEqual(api.splitLines("✓ I can name them").join("|"), "I can name them", "check bullet strips");
assertEqual(api.splitLines("▪ Ride support calls").join("|"), "Ride support calls", "square bullet strips");

console.log("Testing nextTabTarget...");
var tabA = { id: "a" };
var tabB = { id: "b" };
var tabC = { id: "c" };
assertEqual(api.nextTabTarget([tabA, tabB, tabC], tabA, false), tabB, "Tab moves forward");
assertEqual(api.nextTabTarget([tabA, tabB, tabC], tabC, false), tabA, "Tab wraps to first");
assertEqual(api.nextTabTarget([tabA, tabB, tabC], tabA, true), tabC, "Shift+Tab wraps to last");
assertEqual(api.nextTabTarget([tabA, tabB, tabC], null, false), tabA, "Tab from outside goes to first");

console.log("Testing requestOpenFile...");
var Editor = globalThis.ThirtySixtyNinetyEditor;
assert(Editor, "editor constructor is exported");
var openClicks = 0;
var openConfirms = 0;
var fakeOpen = {
  dirty: true,
  openMenuOpen: true,
  templateMenuOpen: false,
  closeMenus: Editor.prototype.closeMenus,
  root: {
    querySelector: function (sel) {
      if (sel === ".tsn-open-menu") return { hidden: false };
      return { click: function () { openClicks += 1; } };
    }
  },
  askConfirm: function (msg, label, fn) {
    openConfirms += 1;
    fakeOpen._confirmMsg = msg;
    fakeOpen._confirmFn = fn;
  }
};
Editor.prototype.requestOpenFile.call(fakeOpen, "#tsn-file-json");
assertEqual(openClicks, 0, "dirty open does not click the picker yet");
assertEqual(openConfirms, 1, "dirty open asks first");
assertEqual(fakeOpen.openMenuOpen, false, "open menu closes before the confirm");
fakeOpen._confirmFn();
assertEqual(openClicks, 1, "confirm proceeds to the picker");
openClicks = 0;
openConfirms = 0;
fakeOpen.dirty = false;
Editor.prototype.requestOpenFile.call(fakeOpen, "#tsn-file-xlsx");
assertEqual(openClicks, 1, "clean open clicks the picker");
assertEqual(openConfirms, 0, "clean open does not ask");

console.log("Testing preparePrint...");
var printRenders = [];
var fakePrint = {
  _printing: false,
  showStatus: true,
  collapsedLenses: { customer: true, business: true },
  commitAllEdits: function () { fakePrint.committed = true; },
  render: function (opts) {
    printRenders.push({
      collapsed: Object.keys(this.collapsedLenses).filter(function (id) { return this.collapsedLenses[id]; }, this).join(","),
      keepFocus: !!(opts && opts.keepFocus),
      printStatus: this.root.classList._printStatus
    });
  },
  root: {
    classList: {
      _printStatus: false,
      toggle: function (name, on) {
        if (name === "tsn-print-status") fakePrint.root.classList._printStatus = !!on;
      }
    }
  }
};
Editor.prototype.preparePrint.call(fakePrint);
assert(fakePrint.committed, "print commits edits first");
assertEqual(printRenders.length, 1, "print renders once");
assertEqual(printRenders[0].collapsed, "", "print expands every lens");
assert(fakePrint.root.classList._printStatus, "print shows Status when toggled on");
Editor.prototype.preparePrint.call(fakePrint);
assertEqual(printRenders.length, 1, "print prepare is idempotent");
Editor.prototype.restoreAfterPrint.call(fakePrint);
assertEqual(printRenders.length, 2, "print restore re-renders");
assertEqual(printRenders[1].collapsed, "customer,business", "print restore puts collapse back");
assert(printRenders[1].keepFocus, "print restore keeps focus");
Editor.prototype.restoreAfterPrint.call(fakePrint);
assertEqual(printRenders.length, 2, "print restore is idempotent");

console.log("Testing dateManual...");
var dated = api.createNewPlan({ seatTitle: "Role", startDate: "2024-06-01" });
dated.horizons[0].dateManual = true;
dated.horizons[0].date = "2024-12-25";
api.recomputeHorizonDates(dated, "2024-07-01");
assertEqual(dated.startDate, "2024-07-01", "start date updated");
assertEqual(dated.horizons[0].date, "2024-12-25", "manual date stays put");
assertEqual(dated.horizons[1].date, "2024-08-30", "auto date moves");

console.log("Testing hydratePlan of string cells...");
var oldShape = api.createNewPlan({ seatTitle: "Role", startDate: "2024-06-01" });
oldShape.lenses[0].facets[0].cells.d30 = {
  objective: "Know users",
  criteria: "I can name them\nI can list segments",
  tactics: "Ride calls\nRead reviews",
  status: ""
};
api.hydratePlan(oldShape);
assertEqual(JSON.stringify(oldShape.lenses[0].facets[0].cells.d30.criteria), JSON.stringify(["I can name them", "I can list segments"]), "hydrate splits string criteria");
assertEqual(JSON.stringify(oldShape.lenses[0].facets[0].cells.d30.tactics), JSON.stringify(["Ride calls", "Read reviews"]), "hydrate splits string tactics");

var oldDraftStore = {};
var oldDraft = api.createNewPlan({ seatTitle: "Role", startDate: "2024-06-01" });
oldDraft.lenses[0].facets[0].cells.d30.criteria = "I can name our top 10 customers.";
oldDraft.lenses[0].facets[0].cells.d30.tactics = "Ride 5 support calls\nRead top reviews";
oldDraftStore[api.STORE_KEYS[0]] = JSON.stringify(oldDraft);
var loadedOld = api.readStoredDraft(memoryStore(oldDraftStore));
assert(loadedOld && Array.isArray(loadedOld.lenses[0].facets[0].cells.d30.criteria), "localStorage string criteria hydrate to an array");
assertEqual(loadedOld.lenses[0].facets[0].cells.d30.tactics.length, 2, "localStorage string tactics split");

console.log("Testing exportMarkdown...");
plan.lenses[0].facets[0].cells.d30 = {
  objective: "Understand the customer",
  criteria: ["I can name the top 5 customer segments"],
  tactics: ["Review customer data", "Talk to support team"],
  status: ""
};

var md = api.exportMarkdown(plan);
assert(md.indexOf("# 30-60-90: VP Product") >= 0, "markdown has title");
assert(md.indexOf("**Hire:** Jane Doe") >= 0, "markdown has person");
assert(md.indexOf("## Customer") >= 0, "markdown has Customer lens");
assert(md.indexOf("### End users") >= 0, "markdown has End users facet");
assert(md.indexOf("Understand the customer") >= 0, "markdown has objective");
assert(md.indexOf("✓ I can name the top 5 customer segments") >= 0, "markdown has ✓ criteria");
assert(md.indexOf("▪ Review customer data") >= 0, "markdown has ▪ tactics");
assert(md.indexOf("**Status:**") < 0, "markdown omits Status by default");

console.log("Testing exportMarkdown with status-only cell...");
var statusOnlyPlan = api.createNewPlan({
  seatTitle: "Test Role",
  startDate: "2024-06-01"
});
statusOnlyPlan.lenses[0].facets[0].cells.d30 = {
  objective: "",
  criteria: [],
  tactics: [],
  status: "Completed"
};
var statusMd = api.exportMarkdown(statusOnlyPlan);
assert(statusMd.indexOf("Completed") < 0, "status-only cell omitted when Status is hidden");
statusMd = api.exportMarkdown(statusOnlyPlan, { includeStatus: true });
assert(statusMd.indexOf("Completed") >= 0, "markdown includes status when toggled on");

console.log("Testing markdown Plan check...");
var flaggedPlan = api.createNewPlan({ seatTitle: "Role", startDate: "2024-06-01" });
flaggedPlan.lenses[3].facets[0].cells.d60 = {
  objective: "Assess talent",
  criteria: "Meet with the PMs",
  tactics: "",
  status: ""
};
var flaggedMd = api.exportMarkdown(flaggedPlan);
assert(flaggedMd.indexOf("## Plan check") >= 0, "hire-facing markdown includes Plan check");
assert(flaggedMd.indexOf("Meet with the PMs") >= 0, "Plan check names the line");

console.log("Testing exportXlsx...");
var wb = api.exportXlsx(plan);
assert(wb.SheetNames.length === 1, "workbook has one sheet");
assertEqual(wb.SheetNames[0], "30-60-90", "sheet is named 30-60-90");

var ws = wb.Sheets["30-60-90"];
var data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
assert(data.length > 2, "has header rows and data");
var header1 = data[0];
assert(header1[2].indexOf("30 Days") >= 0, "header has 30 Days");

console.log("Testing XLSX round-trip...");
var imported = api.importXlsx(wb);
assert(imported.kind === "kindel.30-60-90", "imported kind");
assertEqual(imported.lenses.length, 4, "imported has 4 lenses");
assertEqual(imported.horizons.length, 3, "imported has 3 horizons");

var origFacet = plan.lenses[0].facets[0];
var importedLens = imported.lenses.find(function (l) { return l.id === "customer"; });
var importedFacet = importedLens.facets.find(function (f) { return f.name === origFacet.name; });
assert(importedFacet, "imported has matching facet");
assertEqual(importedFacet.cells.d30.objective, origFacet.cells.d30.objective, "objective preserved in round-trip");
assertEqual(JSON.stringify(importedFacet.cells.d30.criteria), JSON.stringify(origFacet.cells.d30.criteria), "criteria preserved in round-trip");
assertEqual(JSON.stringify(importedFacet.cells.d30.tactics), JSON.stringify(origFacet.cells.d30.tactics), "tactics preserved in round-trip");
assertEqual(data[2][1], origFacet.name, "first slot row names the facet");
assertEqual(data[3][1], "", "extra tactic rows leave the facet name blank");
assert(String(data[3][4] || "").length > 0, "second tactic sits in its own spreadsheet cell");

console.log("Testing historical XLSX import...");
var historicalWb = XLSX.utils.book_new();
var historicalData = [
  ["", "", "30 Days - Land", "", "", "", "60 Days - Direction", "", "", "", "90 Days - Challenge", "", "", ""],
  ["", "", "Key Objectives", "Evaluation Criteria", "Tactics/Deliverables", "Status", "Key Objectives", "Evaluation Criteria", "Tactics/Deliverables", "Status", "Key Objectives", "Evaluation Criteria", "Tactics/Deliverables", "Status"],
  ["Customer/Product", "End users", "Know users", "I can list users", "Interview users", "", "Understand needs", "I can explain needs", "Document needs", "", "Solve problems", "I can demo solutions", "Build prototypes", ""],
  ["", "Partners", "Meet partners", "I know partner names", "Schedule meetings", "", "", "", "", "", "", "", "", ""],
  ["Business", "Finance", "Learn budget", "I understand P&L", "Review financials", "", "", "", "", "", "", "", "", ""],
  ["Technical/Execution", "Architecture", "Learn systems", "I can draw architecture", "Read docs", "", "", "", "", "", "", "", "", ""],
  ["Organization/People", "Team", "Meet team", "I know everyone", "1:1s", "", "", "", "", "", "", "", "", ""]
];
var historicalWs = XLSX.utils.aoa_to_sheet(historicalData);
XLSX.utils.book_append_sheet(historicalWb, historicalWs, "Charlie's Take");

var historicalPlan = api.importXlsx(historicalWb);
assertEqual(historicalPlan.lenses.length, 4, "historical import has 4 lenses");
assert(historicalPlan.seat.title.length > 0, "imported plan has non-empty seat title");
var importValidation = api.validatePlan(historicalPlan);
assert(importValidation.valid, "imported plan should validate");

var customerLens = historicalPlan.lenses.find(function (l) { return l.id === "customer"; });
assert(customerLens.facets.length >= 2, "customer lens has facets");
var endUsersFacet = customerLens.facets.find(function (f) { return f.name === "End users"; });
assert(endUsersFacet, "has End users facet");
assertEqual(endUsersFacet.cells.d30.objective, "Know users", "historical objective imported");
assertEqual(JSON.stringify(endUsersFacet.cells.d30.criteria), JSON.stringify(["I can list users"]), "historical criteria imported as an array");

console.log("Testing historical import with 3-column format (no status)...");
var historical3Col = [
  ["", "", "30 Days", "", "", "60 Days", "", "", "90 Days", "", ""],
  ["", "", "Key Objectives", "Evaluation Criteria", "Tactics/Deliverables", "Key Objectives", "Evaluation Criteria", "Tactics/Deliverables", "Key Objectives", "Evaluation Criteria", "Tactics/Deliverables"],
  ["Customer", "Users", "Know them", "I list them", "Talk to them", "Help them", "I solve issues", "Support calls", "", "", ""]
];
var ws3 = XLSX.utils.aoa_to_sheet(historical3Col);
var wb3 = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb3, ws3, "Grid");

var plan3Col = api.importXlsx(wb3);
assert(plan3Col.lenses.length === 4, "3-col import has 4 lenses");
var cust3 = plan3Col.lenses.find(function (l) { return l.id === "customer"; });
var users3 = cust3.facets.find(function (f) { return f.name === "Users"; });
assertEqual(users3.cells.d30.objective, "Know them", "3-col objective");
assertEqual(users3.cells.d30.status, "", "3-col status is empty (no column)");

console.log("Testing XLSX blank criterion slot round-trip...");
assertEqual(JSON.stringify(api.compactItems(["c1", "", "c3"])), JSON.stringify(["c1", "", "c3"]), "compactItems keeps a middle blank");
var gapped = api.createNewPlan({ seatTitle: "Role", startDate: "2024-06-01" });
gapped.lenses[0].facets[0].cells.d30.criteria = ["c1", "", "c3"];
gapped.lenses[0].facets[0].cells.d30.tactics = ["t1", "t2", "t3"];
var gappedIn = api.importXlsx(api.exportXlsx(gapped));
var gappedFacet = gappedIn.lenses[0].facets.find(function (f) { return f.name === gapped.lenses[0].facets[0].name; });
assert(gappedFacet, "gapped import has the facet");
assertEqual(JSON.stringify(gappedFacet.cells.d30.criteria), JSON.stringify(["c1", "", "c3"]), "xlsx round-trip keeps a blank criterion slot");
assertEqual(JSON.stringify(gappedFacet.cells.d30.tactics), JSON.stringify(["t1", "t2", "t3"]), "xlsx round-trip keeps aligned tactics");

console.log("Testing editor focus, paste, and selection...");
var editorPlan = api.createNewPlan({ seatTitle: "Role", startDate: "2024-06-01" });
function makeEditor(srcPlan) {
  var focused = [];
  var firstCell = {
    tabIndex: -1,
    focus: function () { focused.push("cell"); }
  };
  var nodes = {};
  function node(name) {
    if (!nodes[name]) nodes[name] = { focus: function () { focused.push(name); } };
    return nodes[name];
  }
  var editor = Object.create(global.ThirtySixtyNinetyEditor.prototype);
  editor.focused = focused;
  editor.firstCell = firstCell;
  editor.root = {
    innerHTML: "",
    setAttribute: function () {},
    closest: function () { return null; },
    contains: function () { return true; },
    insertAdjacentHTML: function (where, html) { editor.root.innerHTML += html; },
    querySelector: function (sel) {
      if (sel === '.tsn-cell[data-field]:not([data-field="pad"])') return firstCell;
      if (sel.indexOf(".tsn-cell[data-lens=") === 0) return firstCell;
      var action = sel.match(/^\[data-action="([^"]+)"\]$/);
      if (action) return node(action[1]);
      if (sel.charAt(0) === ".") return node(sel.slice(1));
      return null;
    },
    querySelectorAll: function () {
      return { forEach: function () {} };
    }
  };
  editor.bundle = api.getBundle();
  editor.plan = JSON.parse(JSON.stringify(srcPlan));
  editor.template = template;
  editor.narrowHorizon = "d30";
  editor.showStatus = false;
  editor.peopleOpen = false;
  editor.panel = null;
  editor.collapsedLenses = {};
  editor.sel = null;
  editor.editing = false;
  editor.extraFacet = null;
  editor.suggestFor = null;
  editor.dirty = false;
  editor._pendingDirty = false;
  editor._pendingValue = null;
  editor._blurRefreshWaiting = false;
  editor._renderGen = 0;
  editor.touch = function () { editor.dirty = true; };
  return editor;
}

function firstCoord(srcPlan, field, index) {
  var lens = srcPlan.lenses[0];
  var facet = lens.facets[0];
  return { lensId: lens.id, facetId: facet.id, horizonId: "d30", field: field, index: index || 0 };
}

var loaded = makeEditor(editorPlan);
loaded.render();
assertEqual(loaded.focused.join(","), "", "a loaded plan does not steal focus on render");
assertEqual(loaded.firstCell.tabIndex, 0, "the first cell is a tab stop when nothing is selected");
assert(loaded.root.innerHTML.indexOf("tsn-cell-lead") >= 0, "first criterion and tactic slots are marked lead in the grid");

var blankPlan = api.createNewPlan({ seatTitle: "Role", startDate: "2024-06-01" });
blankPlan.lenses.forEach(function (lens) {
  (lens.facets || []).forEach(function (facet) {
    Object.keys(facet.cells || {}).forEach(function (hid) {
      facet.cells[hid].objective = "";
      facet.cells[hid].criteria = [];
      facet.cells[hid].tactics = [];
      facet.cells[hid].status = "";
    });
  });
});
var blankEd = makeEditor(blankPlan);
blankEd.render();
assert(blankEd.root.innerHTML.indexOf("tsn-cell tsn-cell-crit tsn-cell-lead") >= 0, "empty first criterion keeps the lead class");
assert(blankEd.root.innerHTML.indexOf("tsn-cell tsn-cell-tac tsn-cell-lead") >= 0, "empty first tactic keeps the lead class");
blankPlan.lenses.forEach(function (lens) {
  assert(lens.facets.some(function (f) { return f.name === "Mechanisms"; }), "blank " + lens.id + " keeps Mechanisms");
});

var unfilled = api.createNewPlan({ startDate: "2024-06-01", fillExamples: false });
unfilled.lenses.forEach(function (lens) {
  assert(lens.facets.some(function (f) { return f.name === "Mechanisms"; }), "unfilled " + lens.id + " still has Mechanisms");
});

var missingMech = JSON.parse(JSON.stringify(plan));
missingMech.lenses[0].facets = missingMech.lenses[0].facets.filter(function (f) { return f.name !== "Mechanisms"; });
var startEd = makeEditor(missingMech);
startEd.commitAllEdits = function () {};
startEd.render = function () {};
startEd.focusFirstCell = function () {};
startEd.askConfirm = function (msg, label, fn) { fn(); };
startEd.startBlank();
assert(startEd.plan.startedBlank, "Start blank marks the plan startedBlank");
startEd.plan.lenses.forEach(function (lens) {
  assert(lens.facets.some(function (f) { return f.name === "Mechanisms"; }), "Start blank puts Mechanisms on " + lens.id);
  lens.facets.forEach(function (facet) {
    Object.keys(facet.cells || {}).forEach(function (hid) {
      var cell = facet.cells[hid];
      assert(!cell.objective && !(cell.criteria && cell.criteria.some(Boolean)) && !(cell.tactics && cell.tactics.some(Boolean)),
        "Start blank clears " + lens.id + "/" + facet.id + "/" + hid);
    });
  });
});
assert(startEd.plan.lenses[0].facets.some(function (f) { return f.name === "End users"; }), "Start blank keeps End users");
assertEqual(startEd.plan.template.version, template.version, "Start blank stamps the current template version");

var useEd = makeEditor(JSON.parse(JSON.stringify(emptied)));
useEd.plan.startedBlank = true;
useEd.plan.person.name = "Ada";
useEd.commitAllEdits = function () {};
useEd.showUndo = function (msg) { useEd._undoMsg = msg; };
useEd.askConfirm = function (msg, label, fn) {
  useEd._confirmMsg = msg;
  useEd._confirmLabel = label;
  useEd._confirmFn = fn;
};
useEd.requestUseTemplate();
assertEqual(useEd._confirmMsg, "Replace your plan's writing with the " + template.seatTitle + " example?", "Use template confirms first");
assertEqual(useEd._confirmLabel, "Use template", "confirm button is Use template");
assert(!api.planHasCellContent(useEd.plan), "cancel leaves the plan");
useEd._confirmFn();
assert(api.planHasCellContent(useEd.plan), "confirm applies the template");
assertEqual(useEd.plan.person.name, "Ada", "applied plan keeps the hire");
assertEqual(useEd.undo.type, "plan", "apply stores a plan undo");
assert(useEd._undoMsg.indexOf("example") >= 0, "apply shows undo");
useEd.applyUndo();
assert(!api.planHasCellContent(useEd.plan), "undo restores the previous writing");
assertEqual(useEd.plan.template.version, template.version, "undo of an empty plan stamps the current template version");
assert(useEd.plan.startedBlank, "undo of an empty apply stays a Start blank");

var toolEd = makeEditor(editorPlan);
toolEd.bundle = bundle;
toolEd.render();
assert(toolEd.root.innerHTML.indexOf("Use template") >= 0, "toolbar has Use template");
assert(toolEd.root.innerHTML.indexOf("use-template-menu") < 0, "one template is a button, not a menu");
assert(toolEd.root.innerHTML.indexOf("tsn-template-offer") < 0, "current filled plan has no offer banner");

api.setBundle(extraBundle);
var menuEd = makeEditor(editorPlan);
menuEd.bundle = extraBundle;
menuEd.render();
assert(menuEd.root.innerHTML.indexOf("use-template-menu") >= 0, "two templates open a menu");
assert(menuEd.root.innerHTML.indexOf('data-template="product-senior"') >= 0, "menu lists product-senior");
assert(menuEd.root.innerHTML.indexOf('data-template="extra"') >= 0, "menu lists the extra template");
api.setBundle(bundle);

var offerEd = makeEditor(staleFilled);
offerEd.templateOffer = true;
offerEd.render();
assert(offerEd.root.innerHTML.indexOf("tsn-template-offer") >= 0, "older filled draft shows an offer");

var keep = makeEditor(editorPlan);
keep.sel = firstCoord(keep.plan, "objective", 0);
keep.render({ keepFocus: false });
assertEqual(keep.focused.join(","), "", "keepFocus false does not yank focus back to the grid");
keep.render({ keepFocus: true });
assertEqual(keep.focused.join(","), "cell", "keepFocus true restores grid focus");

var restore = makeEditor(editorPlan);
restore.focusPointerRestore({ action: "save" });
assertEqual(restore.focused.join(","), "save", "blur restore focuses the Save control");
restore.focusPointerRestore({ className: "tsn-person-name" });
assertEqual(restore.focused.join(","), "save,tsn-person-name", "blur restore focuses the People hire field");

var pasteEd = makeEditor(editorPlan);
pasteEd.render = function () {};
pasteEd.focusSelected = function () {};
pasteEd.sel = firstCoord(pasteEd.plan, "objective", 0);
pasteEd.pasteIntoSel("para one\n\npara two");
assertEqual(pasteEd.plan.lenses[0].facets[0].cells.d30.objective, "para one\n\npara two", "objective paste keeps both paragraphs");
pasteEd.sel = firstCoord(pasteEd.plan, "status", 0);
pasteEd.showStatus = true;
pasteEd.pasteIntoSel("status a\nstatus b");
assertEqual(pasteEd.plan.lenses[0].facets[0].cells.d30.status, "status a\nstatus b", "status paste keeps both paragraphs");
pasteEd.plan.lenses[0].facets[0].cells.d30.criteria = [];
pasteEd.sel = firstCoord(pasteEd.plan, "criteria", 0);
pasteEd.pasteIntoSel("c1\nc2");
assertEqual(JSON.stringify(pasteEd.plan.lenses[0].facets[0].cells.d30.criteria), JSON.stringify(["c1", "c2"]), "criteria paste still splits into cells");

var clampEd = makeEditor(editorPlan);
var clampFacet = clampEd.plan.lenses[0].facets[0];
Object.keys(clampFacet.cells).forEach(function (hid) {
  clampFacet.cells[hid].criteria = hid === "d30" ? ["only"] : [];
  clampFacet.cells[hid].tactics = hid === "d30" ? ["t"] : [];
});
clampEd.sel = firstCoord(clampEd.plan, "criteria", 2);
clampEd.clampSel();
assertEqual(clampEd.sel.index, 0, "clampSel moves onto a cell that still exists");

var moveEd = makeEditor(editorPlan);
var movedCell = moveEd.plan.lenses[0].facets[0].cells.d30;
movedCell.criteria = ["Meet the team"];
movedCell.tactics = [];
var renderedMove = false;
moveEd.render = function () { renderedMove = true; };
moveEd.focusSelected = function () {};
var flagCard = { getAttribute: function () { return "0"; } };
var cellEl = {
  closest: function (sel) { return sel === ".tsn-cell" ? cellEl : null; },
  getAttribute: function (name) {
    var map = {
      "data-lens": moveEd.plan.lenses[0].id,
      "data-facet": moveEd.plan.lenses[0].facets[0].id,
      "data-horizon": "d30",
      "data-index": "0"
    };
    return map[name];
  }
};
var moveBtn = {
  closest: function (sel) {
    if (sel === ".tsn-flag-card") return flagCard;
    if (sel === ".tsn-cell") return cellEl;
    return null;
  }
};
moveEd.redirectLine(moveBtn, "move");
assert(renderedMove, "Move to Tactics renders when the cell is not being edited");
assertEqual(JSON.stringify(movedCell.criteria), JSON.stringify([]), "Move to Tactics clears the criterion");
assertEqual(JSON.stringify(movedCell.tactics), JSON.stringify(["Meet the team"]), "Move to Tactics appends the tactic");

console.log("Testing pending edits, dialog blur, and redirect commit...");
var draftStore = {};
var prevStorage = global.localStorage;
global.localStorage = {
  setItem: function (k, v) { draftStore[k] = v; },
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(draftStore, k) ? draftStore[k] : null; },
  removeItem: function (k) { delete draftStore[k]; }
};
var pendingEd = makeEditor(editorPlan);
var originalObj = pendingEd.plan.lenses[0].facets[0].cells.d30.objective;
pendingEd.sel = firstCoord(pendingEd.plan, "objective", 0);
pendingEd.editing = true;
pendingEd.editOriginal = originalObj;
pendingEd.render = function () {};
pendingEd.focusSelected = function () {};
pendingEd.notePendingEdit("typed but not committed");
assert(pendingEd._pendingDirty, "typing a cell marks pending dirty for beforeunload");
assert(draftStore[api.STORE_KEYS[0]], "pending edit writes a draft snapshot");
var pendingSnap = JSON.parse(draftStore[api.STORE_KEYS[0]]);
assertEqual(pendingSnap.lenses[0].facets[0].cells.d30.objective, "typed but not committed", "draft snapshot has the typed text");
assertEqual(pendingEd.plan.lenses[0].facets[0].cells.d30.objective, originalObj, "live plan stays unchanged until commit");
pendingEd.cancelEdit();
assertEqual(pendingEd._pendingDirty, false, "Esc clears pending dirty");
assertEqual(pendingEd.editing, false, "Esc ends the edit");
assertEqual(pendingEd.plan.lenses[0].facets[0].cells.d30.objective, originalObj, "Esc does not commit typed text");
global.localStorage = prevStorage;

var queued = [];
var origTimeout = global.setTimeout;
global.setTimeout = function (fn) { queued.push(fn); return 0; };
global.document = global.document || { activeElement: null };
var dlgEd = makeEditor(editorPlan);
var confirmOpen = true;
var origDlgQs = dlgEd.root.querySelector.bind(dlgEd.root);
dlgEd.root.querySelector = function (sel) {
  if (sel === ".tsn-confirm") return confirmOpen ? { remove: function () { confirmOpen = false; } } : null;
  if (sel === ".tsn-cell-input") return { value: "typed in cell" };
  return origDlgQs(sel);
};
var dlgRendered = 0;
dlgEd.render = function () { dlgRendered += 1; };
dlgEd.focusSelected = function () {};
dlgEd.sel = firstCoord(dlgEd.plan, "objective", 0);
dlgEd.editing = true;
dlgEd.editOriginal = dlgEd.plan.lenses[0].facets[0].cells.d30.objective;
dlgEd.onFocusOut({
  target: {
    classList: { contains: function (c) { return c === "tsn-cell-input"; } },
    closest: function () { return { contains: function () { return false; } }; }
  },
  relatedTarget: null
});
assertEqual(dlgEd.editing, false, "blur commits before the deferred render");
assertEqual(dlgEd.plan.lenses[0].facets[0].cells.d30.objective, "typed in cell", "blur writes the typed value");
queued.forEach(function (fn) { fn(); });
assertEqual(dlgRendered, 0, "blur does not render while a confirm dialog is open");
assert(dlgEd._blurRefreshWaiting, "refresh waits until the dialog closes");
dlgEd.closeModal();
assertEqual(confirmOpen, false, "closeModal removes the dialog");
assertEqual(dlgRendered, 1, "closing the dialog runs the postponed refresh");
global.setTimeout = origTimeout;

var editMove = makeEditor(editorPlan);
var editCell = editMove.plan.lenses[0].facets[0].cells.d30;
editCell.criteria = ["Meet the team"];
editCell.tactics = [];
editMove.sel = firstCoord(editMove.plan, "criteria", 0);
editMove.editing = true;
editMove.editOriginal = "Meet the team";
var origEditQs = editMove.root.querySelector.bind(editMove.root);
editMove.root.querySelector = function (sel) {
  if (sel === ".tsn-cell-input") return { value: "Meet the whole team" };
  return origEditQs(sel);
};
editMove.render = function () {};
editMove.focusSelected = function () {};
var editCard = { getAttribute: function () { return "0"; } };
var editCellEl = {
  closest: function (sel) { return sel === ".tsn-cell" ? editCellEl : null; },
  getAttribute: function (name) {
    var map = {
      "data-lens": editMove.plan.lenses[0].id,
      "data-facet": editMove.plan.lenses[0].facets[0].id,
      "data-horizon": "d30",
      "data-index": "0"
    };
    return map[name];
  }
};
var editBtn = {
  closest: function (sel) {
    if (sel === ".tsn-flag-card") return editCard;
    if (sel === ".tsn-cell") return editCellEl;
    return null;
  }
};
editMove.redirectLine(editBtn, "move");
assertEqual(JSON.stringify(editCell.criteria), JSON.stringify([]), "editing Move to Tactics commits then clears the criterion");
assertEqual(JSON.stringify(editCell.tactics), JSON.stringify(["Meet the whole team"]), "Move to Tactics uses the typed criterion, not the stale cell");

console.log("Testing type-to-replace pending edit and empty Backspace save...");
var replaceStore = {};
global.localStorage = {
  setItem: function (k, v) { replaceStore[k] = v; },
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(replaceStore, k) ? replaceStore[k] : null; },
  removeItem: function (k) { delete replaceStore[k]; }
};
var replaceEd = makeEditor(editorPlan);
replaceEd.sel = firstCoord(replaceEd.plan, "objective", 0);
replaceEd.render = function () {};
replaceEd.focusSelected = function () {};
var replaceInput = {
  value: replaceEd.plan.lenses[0].facets[0].cells.d30.objective,
  focus: function () {},
  setSelectionRange: function () {}
};
var origReplaceQs = replaceEd.root.querySelector.bind(replaceEd.root);
replaceEd.root.querySelector = function (sel) {
  if (sel === ".tsn-cell-input") return replaceInput;
  return origReplaceQs(sel);
};
replaceEd.startEdit(replaceEd.sel, { replace: "x" });
assertEqual(replaceInput.value, "x", "type-to-replace puts the typed character in the textarea");
assert(replaceEd._pendingDirty, "type-to-replace marks pending dirty without an input event");
assertEqual(replaceEd._pendingValue, "x", "type-to-replace stores the replacement as the pending value");
var replaceSnap = JSON.parse(replaceStore[api.STORE_KEYS[0]]);
assertEqual(replaceSnap.lenses[0].facets[0].cells.d30.objective, "x", "type-to-replace writes the character to the draft");
assertEqual(replaceEd.plan.lenses[0].facets[0].cells.d30.objective, editorPlan.lenses[0].facets[0].cells.d30.objective, "type-to-replace does not commit until blur or save");

var bsEd = makeEditor(editorPlan);
var bsCell = bsEd.plan.lenses[0].facets[0].cells.d30;
bsCell.criteria = ["Meet the team"];
bsEd.sel = firstCoord(bsEd.plan, "criteria", 0);
bsEd.editing = true;
bsEd.editOriginal = "Meet the team";
bsEd._pendingDirty = true;
bsEd._pendingValue = "";
bsEd.render = function () {};
bsEd.focusSelected = function () {};
var bsPrevented = false;
bsEd.onEditKeydown({
  key: "Backspace",
  preventDefault: function () { bsPrevented = true; },
  target: { value: "" }
});
assert(bsPrevented, "Backspace on an empty criterion textarea is handled");
assertEqual(bsEd.editing, false, "empty Backspace ends the edit");
assertEqual(bsEd._pendingDirty, false, "empty Backspace clears pending dirty");
assertEqual(bsEd._pendingValue, null, "empty Backspace clears pending value");
bsEd.commitAllEdits();
bsEd.setDirty(false);
assertEqual(bsEd._pendingDirty, false, "save after empty Backspace does not leave the unload warning armed");
global.localStorage = prevStorage;

console.log("Testing computeHorizons...");
var horizons = api.computeHorizons("2024-03-01", false, template);
assertEqual(horizons.length, 3, "3 horizons without 180");
assertEqual(horizons[0].date, "2024-03-31", "30 days from March 1");
assertEqual(horizons[1].date, "2024-04-30", "60 days from March 1");
assertEqual(horizons[2].date, "2024-05-30", "90 days from March 1");

horizons = api.computeHorizons("2024-03-01", true, template);
assertEqual(horizons.length, 4, "4 horizons with 180");
assertEqual(horizons[3].date, "2024-08-28", "180 days from March 1");

console.log("Testing buildLenses...");
var productLenses = api.buildLenses(template, horizons);
assertEqual(productLenses.length, 4, "template has 4 lenses");
assert(productLenses[0].facets.some(function (f) { return f.name === "End users"; }), "template has End users");
assert(!productLenses[0].facets.some(function (f) { return f.name === "End-customer"; }), "blank plan does not load the v1 family list");
productLenses.forEach(function (lens) {
  assert(lens.facets.some(function (f) { return f.name === "Mechanisms"; }), "buildLenses puts Mechanisms on " + lens.id);
});

var filled = api.pressureTestPlan(flaggedPlan);
assert(filled.length >= 1, "pressureTestPlan feeds Plan check");
assert(filled[0].lensId, "issues include ids for Fix");

console.log("");
console.log("All tests passed!");
