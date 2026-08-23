# Schema

The 30-60-90 plan is stored as a single JSON file. This is the canonical store. Excel is an export format, not a reload format.

## File format

The file extension is `.json`. The `kind` field identifies it as a 30-60-90 plan.

```json
{
  "version": 1,
  "kind": "kindel.30-60-90",
  "seat": { "title": "VP Product", "family": "pm" },
  "person": { "name": "", "role": "hire" },
  "manager": { "name": "" },
  "startDate": "2019-06-01",
  "include180": false,
  "horizons": [
    { "id": "d30", "offsetDays": 30, "name": "Land", "date": "2019-07-01" },
    { "id": "d60", "offsetDays": 60, "name": "Understand Direction", "date": "2019-08-01" },
    { "id": "d90", "offsetDays": 90, "name": "Grasp Current Condition / Set Next Challenge", "date": "2019-08-30" }
  ],
  "lenses": [
    {
      "id": "customer",
      "name": "Customer",
      "facets": [
        {
          "id": "end-customer",
          "name": "End-customer",
          "cells": {
            "d30": { "objective": "", "criteria": "", "tactics": "", "status": "" },
            "d60": { "objective": "", "criteria": "", "tactics": "", "status": "" },
            "d90": { "objective": "", "criteria": "", "tactics": "", "status": "" }
          }
        }
      ]
    }
  ]
}
```

## Provenance

The old spreadsheet tab used the name "Charlie's Take" because Tig went by Charlie at the time. This schema is the 30-60-90 grid, not "Charlie's Take."

## Fields

### Top-level

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | number | yes | Schema version. Currently `1`. |
| `kind` | string | yes | Always `"kindel.30-60-90"`. Used to identify the file type. |
| `seat` | object | yes | The role being filled. |
| `person` | object | no | The person filling the seat (hire or existing employee). |
| `manager` | object | no | The hiring manager. |
| `startDate` | string | yes | ISO 8601 date (YYYY-MM-DD). The first day of the plan. |
| `include180` | boolean | no | If true, add a fourth horizon at 180 days. Default false. |
| `horizons` | array | yes | The time horizons (30, 60, 90, optionally 180 days). |
| `lenses` | array | yes | The four CBTO lenses with their facets. |

### seat

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | yes | The job title, e.g. "VP Product". |
| `family` | string | yes | One of `"pm"`, `"hardware"`, or `"general"`. Determines default facets. |

### person

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | no | The hire or employee's name. |
| `role` | string | no | One of `"hire"` or `"existing"`. Default `"hire"`. |

### manager

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | no | The hiring manager's name. |

### horizon

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique identifier: `"d30"`, `"d60"`, `"d90"`, or `"d180"`. |
| `offsetDays` | number | yes | Days from start date: 30, 60, 90, or 180. |
| `name` | string | yes | The horizon name. See defaults below. |
| `date` | string | yes | Computed ISO 8601 date for this horizon. |

### lens

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | One of `"customer"`, `"business"`, `"technical"`, `"organization"`. |
| `name` | string | yes | Display name: Customer, Business, Technical, Organization. |
| `facets` | array | yes | The facets for this lens. |

### facet

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique identifier within the lens (kebab-case). |
| `name` | string | yes | Display name for this facet. |
| `cells` | object | yes | Map from horizon id to cell content. |

### cell

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `objective` | string | no | Key objective for this facet in this horizon. |
| `criteria` | string | no | Evaluation criteria. Should be first-person and inspectable. |
| `tactics` | string | no | Tactics and deliverables. |
| `status` | string | no | Status. Empty on a new plan. |

## Horizon defaults

| Offset | Default name |
|--------|--------------|
| 30 days | Land |
| 60 days | Understand Direction |
| 90 days | Grasp Current Condition / Set Next Challenge |
| 180 days | Ship has Turned |

## Family defaults

### pm (Product Management)

**Customer:** End-customer, Dealers/users of the product, 3rd parties, People, Programs, Mechanisms

**Business:** Finance, Marketing, Biz Dev, M&A, Goals, Strategy, People, Mechanisms

**Technical:** Architecture, Cloud/software, Device/firmware, Hardware, Development, Operations, People, Mechanisms

**Organization:** People, Culture, Org design, Career growth, Hiring, Mechanisms

### hardware

**Customer:** End-customer, Dealers, 3rd parties/vendors, People, Programs, Mechanisms

**Business:** Finance, M&A, Goals, Strategy, People, Mechanisms

**Technical:** Architecture, Hardware, Operations/supply, People, Mechanisms

**Organization:** People, Org design, Career growth, Hiring, Mechanisms

### general (General Manager / SVP)

**Customer:** People we serve, Channel, 3rd parties, People, Mechanisms

**Business:** Finance, Goals, Strategy, People, Mechanisms

**Technical:** Architecture, Development, Operations, People, Mechanisms

**Organization:** People, Org design, Hiring, Mechanisms

## Pressure-test rules

The editor applies these inline checks. They flag but do not block save.

1. **Empty criteria with non-empty objective:** If an objective is set but criteria is empty, flag the cell.

2. **Criteria that looks like a tactic:** If criteria starts with one of these words (case-insensitive) and does not contain a first-person inspectable claim, flag it:
   - Meet, Attend, Read, Talk, Interview, Email, Call, Schedule

   First-person indicators (the desired shape):
   - Starts with "I ", "I've ", "I can ", "I have "
   - Contains " I " followed by a verb

   Example flagged: "Meet with the PMs"
   Example valid: "I can enumerate the 15 programs and their owners"

## Exports

### XLSX

One sheet named "30-60-90" with:
- Header row: blank | blank | then for each horizon: "{offset} Days - {date} - {name}" spanning 4 columns
- Subheader row: blank | blank | then for each horizon: Key Objectives | Evaluation Criteria | Tactics/Deliverables | Status
- Body rows: lens name in col A (repeated or only on first facet of lens), facet name in col B, then the four fields per horizon

### Markdown

A readable plan document with:
- Title and metadata (seat, person, manager, start date)
- Each lens as a section
- Each facet as a subsection
- Each horizon with objective, criteria (as the inspect line), and tactics (as bullets if multiline)

## Historical XLSX import

The importer handles older workbooks with this layout:
- First sheet may be non-grid ("Martin's First Stab"). Skip sheets that are not the grid.
- Grid sheet detection: row 1 contains "30 Days" / "60 Days" / "90 Days" (optional "180 Days")
- Row 2 contains repeating: Key Objectives, Evaluation Criteria, Tactics/Deliverables, Status
- Column A = lens name (Customer/Product, Business, Technical/Execution, Organization/People). Blank A means continue previous lens.
- Column B = facet name
- Then groups of 3 or 4 columns per horizon (some older files omit Status)

Lens name mapping:
- Customer/Product → Customer
- Business → Business
- Technical/Execution → Technical
- Organization/People → Organization
