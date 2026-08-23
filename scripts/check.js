#!/usr/bin/env node
"use strict";

var fs = require("fs");
var path = require("path");
var XLSX = require("xlsx");

var srcPath = path.join(__dirname, "..", "js", "thirty-sixty-ninety.js");
var src = fs.readFileSync(srcPath, "utf8");

var window = {};
var global = window;
eval(src);

var api = window.kindel3090;

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

assertEqual(plan.horizons[0].id, "d30", "first horizon id");
assertEqual(plan.horizons[0].offsetDays, 30, "first horizon offset");
assertEqual(plan.horizons[0].date, "2024-07-01", "first horizon date");
assertEqual(plan.horizons[1].date, "2024-07-31", "second horizon date");
assertEqual(plan.horizons[2].date, "2024-08-30", "third horizon date");

assertEqual(plan.lenses[0].id, "customer", "first lens is customer");
assertEqual(plan.lenses[1].id, "business", "second lens is business");
assertEqual(plan.lenses[2].id, "technical", "third lens is technical");
assertEqual(plan.lenses[3].id, "organization", "fourth lens is organization");

console.log("Testing createNewPlan with 180 days...");
var plan180 = api.createNewPlan({
  seatTitle: "SVP Engineering",
  family: "general",
  startDate: "2024-01-15",
  include180: true
});

assertEqual(plan180.horizons.length, 4, "should have 4 horizons with include180");
assertEqual(plan180.horizons[3].id, "d180", "fourth horizon is d180");
assertEqual(plan180.horizons[3].name, "Ship has Turned", "180 day name");

console.log("Testing validatePlan...");
var result = api.validatePlan(plan);
assert(result.valid, "valid plan should validate");

var badPlan = { kind: "wrong-kind" };
result = api.validatePlan(badPlan);
assert(!result.valid, "wrong kind should not validate");
assert(result.error.indexOf("kindel.30-60-90") >= 0, "error should mention kind");

console.log("Testing pressureTestCell...");
var flags = api.pressureTestCell({ objective: "Do something", criteria: "", tactics: "", status: "" });
assertEqual(flags.length, 1, "should flag empty criteria with objective");
assert(flags[0].indexOf("criteria is empty") >= 0, "flag message about empty criteria");

flags = api.pressureTestCell({ objective: "", criteria: "Meet with the PMs", tactics: "", status: "" });
assertEqual(flags.length, 1, "should flag tactic-like criteria");
assert(flags[0].indexOf("tactic") >= 0, "flag message about tactics");

flags = api.pressureTestCell({ objective: "", criteria: "Attend the all-hands", tactics: "", status: "" });
assertEqual(flags.length, 1, "should flag Attend");

flags = api.pressureTestCell({ objective: "", criteria: "Read the documentation", tactics: "", status: "" });
assertEqual(flags.length, 1, "should flag Read");

flags = api.pressureTestCell({ objective: "", criteria: "I can enumerate the 15 programs", tactics: "", status: "" });
assertEqual(flags.length, 0, "should not flag first-person criteria");

flags = api.pressureTestCell({ objective: "", criteria: "I've completed the onboarding", tactics: "", status: "" });
assertEqual(flags.length, 0, "should not flag I've");

flags = api.pressureTestCell({ objective: "", criteria: "I have documented the architecture", tactics: "", status: "" });
assertEqual(flags.length, 0, "should not flag I have");

flags = api.pressureTestCell({ objective: "Ship the feature", criteria: "I can demo the feature to stakeholders", tactics: "Write code", status: "" });
assertEqual(flags.length, 0, "valid cell should have no flags");

console.log("Testing exportMarkdown...");
plan.lenses[0].facets[0].cells.d30 = {
  objective: "Understand the customer",
  criteria: "I can name the top 5 customer segments",
  tactics: "Review customer data\nTalk to support team",
  status: ""
};

var md = api.exportMarkdown(plan);
assert(md.indexOf("# 30-60-90 Plan") >= 0, "markdown has title");
assert(md.indexOf("**Seat:** VP Product") >= 0, "markdown has seat");
assert(md.indexOf("**Hire:** Jane Doe") >= 0, "markdown has person");
assert(md.indexOf("## Customer") >= 0, "markdown has Customer lens");
assert(md.indexOf("### End-customer") >= 0, "markdown has End-customer facet");
assert(md.indexOf("Understand the customer") >= 0, "markdown has objective");
assert(md.indexOf("I can name the top 5 customer segments") >= 0, "markdown has criteria");
assert(md.indexOf("- Review customer data") >= 0, "markdown has tactics as bullets");

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
var horizons = api.computeHorizons("2024-03-01", false);
assertEqual(horizons.length, 3, "3 horizons without 180");
assertEqual(horizons[0].date, "2024-03-31", "30 days from March 1");
assertEqual(horizons[1].date, "2024-04-30", "60 days from March 1");
assertEqual(horizons[2].date, "2024-05-30", "90 days from March 1");

horizons = api.computeHorizons("2024-03-01", true);
assertEqual(horizons.length, 4, "4 horizons with 180");
assertEqual(horizons[3].date, "2024-08-28", "180 days from March 1");

console.log("Testing buildLenses...");
var pmLenses = api.buildLenses("pm", horizons);
assertEqual(pmLenses.length, 4, "pm has 4 lenses");
assert(pmLenses[0].facets.some(function (f) { return f.name === "End-customer"; }), "pm has End-customer");

var hwLenses = api.buildLenses("hardware", horizons);
assert(hwLenses[2].facets.some(function (f) { return f.name === "Operations/supply"; }), "hardware has Operations/supply");

var genLenses = api.buildLenses("general", horizons);
assert(genLenses[0].facets.some(function (f) { return f.name === "People we serve"; }), "general has People we serve");

console.log("");
console.log("All tests passed!");
