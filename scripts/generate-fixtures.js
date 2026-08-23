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

var fixturesDir = path.join(__dirname, "..", "fixtures");
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

var plan = api.createNewPlan({
  seatTitle: "VP Product",
  family: "pm",
  startDate: "2024-06-01",
  personName: "Jane Doe",
  managerName: "John Smith",
  include180: false
});

plan.lenses[0].facets[0].cells.d30 = {
  objective: "Understand who the end-customer is",
  criteria: "I can name the top 5 customer segments and their needs",
  tactics: "Review customer research\nTalk to support team\nShadow customer calls",
  status: ""
};
plan.lenses[0].facets[0].cells.d60 = {
  objective: "Know customer pain points",
  criteria: "I can prioritize the top 3 pain points with data",
  tactics: "Analyze support tickets\nConduct customer interviews",
  status: ""
};
plan.lenses[0].facets[0].cells.d90 = {
  objective: "Have a customer-focused roadmap",
  criteria: "I have a prioritized list of features mapped to customer needs",
  tactics: "Create roadmap document\nGet stakeholder buy-in",
  status: ""
};

plan.lenses[1].facets[0].cells.d30 = {
  objective: "Understand the P&L",
  criteria: "I can explain the revenue and cost structure",
  tactics: "Meet with finance team\nReview quarterly reports",
  status: ""
};

plan.lenses[2].facets[0].cells.d30 = {
  objective: "Learn the system architecture",
  criteria: "I can draw the high-level architecture diagram",
  tactics: "Read architecture docs\nMeet with tech leads",
  status: ""
};

plan.lenses[3].facets[0].cells.d30 = {
  objective: "Meet the team",
  criteria: "I have had 1:1s with everyone on the team",
  tactics: "Schedule 1:1s\nAttend team meetings",
  status: ""
};

fs.writeFileSync(
  path.join(fixturesDir, "sample-plan.json"),
  JSON.stringify(plan, null, 2)
);
console.log("Created fixtures/sample-plan.json");

var wb = api.exportXlsx(plan);
XLSX.writeFile(wb, path.join(fixturesDir, "sample-plan.xlsx"));
console.log("Created fixtures/sample-plan.xlsx");

var historicalData = [
  ["", "", "30 Days - Jul 1, 2024 - Land", "", "", "", "60 Days - Jul 31, 2024 - Understand Direction", "", "", "", "90 Days - Aug 30, 2024 - Set Challenge", "", "", ""],
  ["", "", "Key Objectives", "Evaluation Criteria", "Tactics/Deliverables", "Status", "Key Objectives", "Evaluation Criteria", "Tactics/Deliverables", "Status", "Key Objectives", "Evaluation Criteria", "Tactics/Deliverables", "Status"],
  ["Customer/Product", "End-customer", "Know the customer", "I can describe our user personas", "Customer interviews", "", "Customer needs map", "I can prioritize top 5 needs", "Create needs doc", "", "Customer strategy", "I have a customer-first roadmap", "Roadmap presentation", ""],
  ["", "Dealers/users", "Meet dealer network", "I can name top 10 dealers", "Dealer visits", "", "Dealer relationships", "I have regular touchpoints", "Monthly calls", "", "Dealer program", "I've launched dealer feedback program", "Program document", ""],
  ["", "3rd parties", "Identify partners", "I can list key partners", "Partner meetings", "", "", "", "", "", "", "", "", ""],
  ["Business", "Finance", "Learn P&L", "I understand revenue streams", "Finance review", "", "Budget ownership", "I can manage my budget", "Budget tracking", "", "Cost optimization", "I've identified savings", "Savings report", ""],
  ["", "Marketing", "Marketing alignment", "I know the marketing plan", "Marketing sync", "", "", "", "", "", "", "", "", ""],
  ["Technical/Execution", "Architecture", "System overview", "I can draw architecture", "Tech deep-dives", "", "Technical debt", "I've cataloged tech debt", "Tech debt backlog", "", "Architecture vision", "I have modernization plan", "Architecture doc", ""],
  ["", "Development", "Dev process", "I know the SDLC", "Shadow sprints", "", "Process improvements", "I've proposed improvements", "Process doc", "", "", "", "", ""],
  ["Organization/People", "Team", "Meet everyone", "I've had all 1:1s", "1:1 schedule", "", "Team health", "I can assess team dynamics", "Team survey", "", "Team plan", "I have hiring/growth plan", "Org plan", ""],
  ["", "Culture", "Understand culture", "I can describe our values", "Culture sessions", "", "", "", "", "", "", "", "", ""]
];

var historicalWs = XLSX.utils.aoa_to_sheet(historicalData);
var historicalWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(historicalWb, historicalWs, "30-60-90");
XLSX.writeFile(historicalWb, path.join(fixturesDir, "historical-format.xlsx"));
console.log("Created fixtures/historical-format.xlsx");

var oldFormatData = [
  ["Martin's First Stab"],
  ["Just some notes here..."],
  ["Nothing useful"]
];
var oldFormatWs1 = XLSX.utils.aoa_to_sheet(oldFormatData);

var oldGridData = [
  ["", "", "30 Days - Land", "", "", "", "60 Days - Direction", "", "", "", "90 Days - Challenge", "", "", "", "180 Days - Ship has Turned", "", "", ""],
  ["", "", "Key Objectives", "Evaluation Criteria", "Tactics/Deliverables", "Status", "Key Objectives", "Evaluation Criteria", "Tactics/Deliverables", "Status", "Key Objectives", "Evaluation Criteria", "Tactics/Deliverables", "Status", "Key Objectives", "Evaluation Criteria", "Tactics/Deliverables", "Status"],
  ["Customer", "People we serve", "Know customers", "I can describe segments", "Customer research", "", "Customer strategy", "I have customer plan", "Strategy doc", "", "Customer execution", "I've launched initiatives", "Initiative tracker", "", "Customer excellence", "I've achieved targets", "Results report", ""],
  ["Business", "Finance", "Understand finances", "I can read P&L", "Finance meetings", "", "Financial planning", "I own my budget", "Budget doc", "", "Cost management", "I've optimized costs", "Savings report", "", "Financial growth", "I've grown revenue", "Growth report", ""],
  ["Technical", "Architecture", "Learn systems", "I can diagram architecture", "Tech reviews", "", "Tech strategy", "I have tech roadmap", "Roadmap doc", "", "Tech delivery", "I've shipped features", "Release notes", "", "Tech transformation", "I've modernized stack", "Migration report", ""],
  ["Organization", "People", "Know the team", "I've met everyone", "1:1 meetings", "", "Team development", "I've grown the team", "Growth plans", "", "Org health", "I've improved engagement", "Survey results", "", "Org excellence", "I've built a great team", "Team metrics", ""]
];
var oldGridWs = XLSX.utils.aoa_to_sheet(oldGridData);

var oldFormatWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(oldFormatWb, oldFormatWs1, "Martin's First Stab");
XLSX.utils.book_append_sheet(oldFormatWb, oldGridWs, "Charlie's Take");
XLSX.writeFile(oldFormatWb, path.join(fixturesDir, "old-format-with-180.xlsx"));
console.log("Created fixtures/old-format-with-180.xlsx");

console.log("\nAll fixtures generated!");
