# 30-60-90

An interactive app that writes a 30-60-90 plan document. The product is the document. It is not a tracker.

The app opens on the plan itself: the default template filled in as editable text. There is no setup form.

## What it does

1. **Filled grid:** A fresh load shows four lenses (Customer, Business, Technical, Organization), starter facets including Mechanisms on every lens, and Day 30 / 60 / 90, with the template's example objectives, criteria, and tactics already in the cells. Edit or delete from there. **Start blank** clears the writing after a confirm and keeps a Mechanisms row on every lens. **Use template** is a dropdown of every template in `templates/index.json`, named by seat title (VP of Product for the shipped file). Picking one replaces the current plan's writing after a confirm; names, the start date, and horizon dates stay, and Undo restores the previous writing. Opening a saved JSON file loads that file. An empty saved draft, or one whose template version is older than the file it came from, loads the newer example. A draft with real writing is left alone and offered the newer example instead.
2. **Edit in place:** The grid is a spreadsheet. The objective is one cell. Each criterion and each tactic is its own cell. Type to replace. Enter, F2, or double-click to edit. Esc cancels. Arrows move. Tab moves across. Enter on the last criterion or tactic of a facet adds another. Status stays hidden until you toggle it on. On a portrait phone the horizons stay tabbed and you tap a cell to edit it.
3. **Redirect tasks:** A criterion that reads like a tactic turns amber. Tab from that cell reaches Move to Tactics, Rewrite, and Keep. Escape returns to the cell. Markdown export (and print) opens a Plan check first. JSON Save never blocks.
4. **Open:** Load an existing `.json` plan file, or import a historical XLSX from under Open. The app rejects files that are not `kindel.30-60-90`. v1 files still open.
5. **Save:** Download the plan as JSON. This is the canonical format. The filename uses the hire name or seat title. Saves write schema version 2 so an older editor rejects the file instead of joining array criteria.
6. **Export XLSX:** Download a spreadsheet with one Excel cell per plan element. One sheet named "30-60-90" with horizons as column groups. Extra criteria and tactics write extra rows. Status is always included here, because that is the historical layout.
7. **Export Markdown:** Download a readable plan with ✓ criteria and ▪ tactics. Status is omitted unless the toggle is on.

## What it does not do

It does not become a weekly status tool. It does not replace Goalie. It does not accept a pile of orientation checkboxes. It does not open with a wizard.

## The Model

The schema is the **30-60-90 grid**: CBTO rows, dated named horizons, inspectable criteria. Locked from three real plans Tig wrote or edited (an SVP rewrite, Avi's hardware plan, and Abhishek's PM plan).

Horizons are dated and named, not generic "30 days." Default names, starter facets, column labels, hints, examples, and help text live in `templates/product-senior.json` (senior product leader). They are not hard-coded in the app. See that file, not this README, for the current wording.

Rows are CBTO (Customer, Business, Technical, Organization), then a facet of that lens. Each horizon cell has four fields:

1. **Key objective:** one outcome for that facet in that window.
2. **Evaluation criteria:** first-person and inspectable. "I can enumerate the 15 programs" counts. "Meet with the PMs" does not. That is a tactic.
3. **Tactics / deliverables:** the work that might produce the criterion.
4. **Status:** empty when you write the plan. Hidden in the editor until toggled. Filled later if someone prints it again.

## Storage

The canonical store is JSON. See [SCHEMA.md](SCHEMA.md) for the full specification.

Excel is an export format, not a reload format. The XLSX export matches the historical grid layout so a human recognizes it, but you should save and reload using the JSON file.

## Templates

Starter names, the default seat title, hints, examples, and help text live under `templates/`. `templates/index.json` lists them and names the default. 2.0 ships one file, `templates/product-senior.json`. A new plan copies those examples into the cells. **Use template** is always a dropdown of those files, even when there is only one.

Over http the app fetches those JSON files. `index.html` still opens from disk: under `file://`, fetch is blocked, so the app falls back to `js/templates.js`, which `scripts/build-templates.js` generates. `scripts/check.js` fails when that bundle is stale.

Hardware and GM/SVP facet lists from v1 live in `templates/facet-sets.json` until they become their own templates.

## Pressure-test

The editor applies inline checks. They flag but do not block save:

- If an objective is set but criteria is empty, the cell gets a quiet amber corner.
- If a criterion line starts with an activity (Meet, Attend, Read, Visit, and the rest) and is not an accepted first-person form, the line turns amber and offers Move to Tactics, Rewrite as "I can…", or Keep.

Accepted forms: "I can", "I know", "I have", "My…", and "[Someone] has…". "I will meet the PMs" is still a tactic.

## Import

The app can import historical XLSX files with the old layout:

- Sheets with "30 Days" / "60 Days" / "90 Days" in the first row are detected as grids.
- Lens names like "Customer/Product" and "Technical/Execution" are mapped to the CBTO standard.
- Files with 3 columns per horizon (no Status) are supported.
- Non-grid sheets (like "Martin's First Stab") are skipped.

After import, the store is JSON. XLSX is not a reload format.

## Running locally

Open `index.html` or `preview.html` in a browser. No build step is required to *run*. Rebuild the file:// bundle after you edit a template:

```sh
node scripts/build-templates.js
```

The app loads SheetJS from a CDN for XLSX support. If you are offline, XLSX export and import will not work, but JSON save/load and Markdown export will.

## Tests

```sh
npm install xlsx
node scripts/build-templates.js
node scripts/generate-fixtures.js
node scripts/check.js
```

The check script validates:

- Schema compliance, including v1 fixture files.
- Template manifest, template files, and a stale `js/templates.js` bundle.
- Pressure-test logic, including the tactic redirect cases.
- XLSX round-trip (export then import preserves cells).
- Historical XLSX import.

## License

MIT. Copyright (c) 2026 Kindel, LLC. Keep the copyright notice and permission notice in all copies.

Derivatives must include a visible link to [kindel.com](https://kindel.com).

## Related

- [Goalie](https://kindel.com/goalie/)
- [Loop](https://kindel.com/loop/)
- [Office Hours](https://kindel.com/officehours/)
