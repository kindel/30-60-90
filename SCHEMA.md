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
  "template": { "id": "product-senior", "version": 1 },
  "horizons": [
    { "id": "d30", "offsetDays": 30, "name": "Land", "date": "2019-07-01" },
    { "id": "d60", "offsetDays": 60, "name": "Understand Direction; Sense Big Problems", "date": "2019-08-01" },
    { "id": "d90", "offsetDays": 90, "name": "Start Formulating Plan", "date": "2019-08-30" }
  ],
  "lenses": [
    {
      "id": "customer",
      "name": "Customer",
      "facets": [
        {
          "id": "end-users",
          "name": "End users",
          "cells": {
            "d30": { "objective": "", "criteria": [], "tactics": [], "status": "" },
            "d60": { "objective": "", "criteria": [], "tactics": [], "status": "" },
            "d90": { "objective": "", "criteria": [], "tactics": [], "status": "" }
          }
        }
      ]
    }
  ]
}
```

v1 files omit `template`, `horizon.dateManual`, `cell.dismissed`, and `cell.dismissedText`. They still load. Older files store `criteria` and `tactics` as newline-joined strings. The editor hydrates those into arrays.

## Provenance

The old spreadsheet tab used the name "Charlie's Take" because Tig went by Charlie at the time. This schema is the 30-60-90 grid, not "Charlie's Take."

## Fields

### Top-level

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | number | yes | Schema version. Currently `1`. |
| `kind` | string | yes | Always `"kindel.30-60-90"`. Used to identify the file type. |
| `seat` | object | yes | The role being filled. `title` may be empty on a blank plan. |
| `person` | object | no | The person filling the seat (hire or existing employee). |
| `manager` | object | no | The hiring manager. |
| `startDate` | string | yes | ISO 8601 date (YYYY-MM-DD). The first day of the plan. |
| `include180` | boolean | no | If true, add a fourth horizon at 180 days. Default false. |
| `template` | object | no | `{ id, version }` of the template the blank plan started from. New plans record this. v1 files do not have it. |
| `startedBlank` | boolean | no | True after Start blank. An empty localStorage draft without this flag is ignored so an old empty grid does not hide the filled template. |
| `horizons` | array | yes | The time horizons (30, 60, 90, optionally 180 days). |
| `lenses` | array | yes | The four CBTO lenses with their facets. |

### seat

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | no | The job title, e.g. "VP Product". Empty on a fresh blank plan. |
| `family` | string | no | v1 used `"pm"`, `"hardware"`, or `"general"` to pick default facets. New plans still write a family for compatibility. Facets now come from the template. |

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
| `name` | string | yes | The horizon name. Defaults come from the template. |
| `date` | string | yes | Computed ISO 8601 date for this horizon. |
| `dateManual` | boolean | no | If true, changing the start date leaves this date alone until it is reset. |

### lens

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | One of `"customer"`, `"business"`, `"technical"`, `"organization"`. |
| `name` | string | yes | Display name. Editable. Reset returns the template default. |
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
| `objective` | string | no | Key objective for this facet in this horizon. One cell. |
| `criteria` | string[] | no | Evaluation criteria. One string per criterion, each its own cell. Older files may store a newline-joined string. |
| `tactics` | string[] | no | Tactics and deliverables. One string per tactic, each its own cell. Older files may store a newline-joined string. |
| `status` | string | no | Status. Empty on a new plan. |
| `dismissed` | number[] | no | Current indexes of criteria the author kept after the tactic redirect. |
| `dismissedText` | string[] | no | The kept criterion text. Keep writes both this and `dismissed`. Edits drop a Keep when the text is gone. |

## Horizon defaults

Default names, offsets, and the optional 180-day column live in `templates/product-senior.json`. The offsets stay 30 / 60 / 90 / 180. Do not copy the names into app JS.

## Templates

Blank-plan content is not part of the plan schema. It lives in:

- `templates/index.json`, tagged by `level` and `function`
- `templates/product-senior.json` (`kind: "kindel.30-60-90.template"`)
- `templates/facet-sets.json`, the v1 Hardware and GM/SVP facet lists

A template uses the same grid shape as a plan (`horizons` and `lenses → facets → cells`) but cells hold `hint` and `example` instead of the user's text. Dates are not stored. The app computes them from the start date.

A new plan copies each cell's example into the grid as editable text. Every CBTO lens starts with a Mechanisms facet. **Start blank** clears that writing, keeps the template id, and keeps (or adds) a Mechanisms row on every lens. Opening a JSON file loads that file. Hints are never saved into the plan. **Use this** in the focused editor still copies one cell's example.

## Family defaults (v1)

v1 files may still carry `seat.family`. Those lists no longer seed a blank plan. Hardware and general lists are in `templates/facet-sets.json`. The PM list folded into `templates/product-senior.json` as starter facets plus `suggestedFacets`.

## Pressure-test rules

The editor applies these inline checks. They flag but do not block save. Markdown and print open a Plan check when flags remain.

1. **Empty criteria with non-empty objective:** If an objective is set but criteria is empty, flag the cell with a quiet amber corner.

2. **Criteria that looks like a tactic:** If a criterion line reads as an activity and is not an accepted first-person form, flag that line.

Activity verbs include Meet, Attend, Read, Talk, Interview, Email, Call, Schedule, Shadow, Visit, Review, Join, Learn, Ride, Sit with, Set up, and Onboard.

"I will" / "I'll" plus an activity verb is also a tactic.

Accepted forms:

- Starts with "I can", "I know", "I have", or "I've"
- Starts with "My"
- Contains "has" in the "[Someone] has …" shape

Example flagged: "Meet with the PMs"
Example flagged: "I will meet the PMs"
Example valid: "I can enumerate the 15 programs and their owners"
Example valid: "My plan cites customer input"
Example valid: "The CEO has reviewed my priorities"

Keep dismisses the flag for that line. It stores the line index on `cell.dismissed` and the criterion text on `cell.dismissedText`. Replacing the line re-flags it. Index-only `dismissed` from earlier files still loads.

## Exports

### XLSX

One sheet named "30-60-90" with:

- Header row: blank | blank | then for each horizon: "{offset} Days - {date} - {name}" spanning 4 columns
- Subheader row: blank | blank | then for each horizon: Key Objectives | Evaluation Criteria | Tactics/Deliverables | Status
- Body rows: lens name in col A (on the first facet row of a lens), facet name in col B on the first slot row of that facet. Extra slot rows leave A and B blank. Each criterion and each tactic is its own spreadsheet cell. A facet with two tactics writes two body rows.

### Markdown

A readable plan document with:

- Title and start date
- A Plan check section when unresolved flags remain
- Each lens as a section
- Each facet as a subsection
- Each horizon with the objective in bold, criteria as ✓ bullets, and tactics as ▪ bullets
- Status omitted unless the editor's Status toggle is on

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
