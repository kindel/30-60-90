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

var template = readJson("templates/product-senior.json");
var templateResult = api.validateTemplate(template);
assert(templateResult.valid, "product-senior should validate: " + templateResult.error);

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
assertEqual(plan.lenses[0].facets.length, 2, "customer has two starter facets");
assertEqual(plan.lenses[0].facets[0].name, "End users", "first customer facet");
assertEqual(plan.lenses[0].facets[1].name, "Partners", "second customer facet");
assertEqual(plan.lenses[1].facets[0].name, "Finance", "first business facet");
assertEqual(plan.lenses[1].facets[1].name, "Strategy", "second business facet");
assertEqual(plan.lenses[2].facets[0].name, "Architecture", "first technical facet");
assertEqual(plan.lenses[2].facets[1].name, "Quality", "second technical facet");
assertEqual(plan.lenses[3].facets[0].name, "People", "first organization facet");
assertEqual(plan.lenses[3].facets[1].name, "Mechanisms", "second organization facet");

var blank = api.createNewPlan({ startDate: "2024-06-01" });
assertEqual(blank.seat.title, "", "blank plan may have an empty seat title");
var blankValidation = api.validatePlan(blank);
assert(blankValidation.valid, "blank plan should validate");

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

assert(api.lineLooksLikeTactic("Meet with the PMs"), "Meet with the PMs is a tactic");
assert(!api.lineLooksLikeTactic("I can name our top 10 customers"), "I can name is not a tactic");
assert(api.lineLooksLikeTactic("I will meet the PMs"), "I will meet is a tactic");

console.log("Testing dateManual...");
var dated = api.createNewPlan({ seatTitle: "Role", startDate: "2024-06-01" });
dated.horizons[0].dateManual = true;
dated.horizons[0].date = "2024-12-25";
api.recomputeHorizonDates(dated, "2024-07-01");
assertEqual(dated.startDate, "2024-07-01", "start date updated");
assertEqual(dated.horizons[0].date, "2024-12-25", "manual date stays put");
assertEqual(dated.horizons[1].date, "2024-08-30", "auto date moves");

console.log("Testing exportMarkdown...");
plan.lenses[0].facets[0].cells.d30 = {
  objective: "Understand the customer",
  criteria: "I can name the top 5 customer segments",
  tactics: "Review customer data\nTalk to support team",
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
  criteria: "",
  tactics: "",
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
assertEqual(importedFacet.cells.d30.criteria, origFacet.cells.d30.criteria, "criteria preserved in round-trip");

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
assertEqual(endUsersFacet.cells.d30.criteria, "I can list users", "historical criteria imported");

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

var filled = api.pressureTestPlan(flaggedPlan);
assert(filled.length >= 1, "pressureTestPlan feeds Plan check");
assert(filled[0].lensId, "issues include ids for Fix");

console.log("");
console.log("All tests passed!");
