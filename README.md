# 30-60-90

An interactive app that writes a 30-60-90 plan document. The product is the document. It is not a tracker.

## What it does

1. **New plan:** Enter the seat title, pick a family (PM, hardware, general), set a start date, and optionally add the hire and manager names. Check the 180-day box if you want a fourth horizon.
2. **Edit:** Fill in the CBTO grid. Each cell has four fields: key objective, evaluation criteria, tactics, and status. The editor flags cells where criteria looks like a tactic instead of an inspectable outcome.
3. **Open:** Load an existing `.json` plan file. The app rejects files that are not `kindel.30-60-90`.
4. **Save:** Download the plan as JSON. This is the canonical format. The filename uses the hire name or seat title.
5. **Export XLSX:** Download a spreadsheet that matches the historical grid layout. One sheet named "30-60-90" with horizons as column groups.
6. **Export Markdown:** Download a readable plan document with headings per lens and facet.

## What it does not do

It does not become a weekly status tool. It does not replace Goalie. It does not accept a pile of orientation checkboxes.

## The Model

The schema is the **30-60-90 grid**: CBTO rows, dated named horizons, inspectable criteria. Locked from three real plans Tig wrote or edited (an SVP rewrite, Avi's hardware plan, and Abhishek's PM plan).

Horizons are dated and named, not generic "30 days."

| Horizon | Default name |
| --- | --- |
| Day 30 | Land |
| Day 60 | Understand Direction |
| Day 90 | Grasp Current Condition / Set Next Challenge |
| Day 180 (optional) | Ship has Turned |

Rows are CBTO (Customer, Business, Technical, Organization), then a facet of that lens. Each horizon cell has four fields:

1. **Key objective:** one outcome for that facet in that window.
2. **Evaluation criteria:** first-person and inspectable. "I can enumerate the 15 programs" counts. "Meet with the PMs" does not. That is a tactic.
3. **Tactics / deliverables:** the work that might produce the criterion.
4. **Status:** empty when you write the plan. Filled later if someone prints it again.

## Storage

The canonical store is JSON. See [SCHEMA.md](SCHEMA.md) for the full specification.

Excel is an export format, not a reload format. The XLSX export matches the historical grid layout so a human recognizes it, but you should save and reload using the JSON file.

## Family defaults

Each family has a different set of default facets:

- **pm:** Product Management focus with facets like End-customer, Dealers/users, Marketing, Cloud/software, Device/firmware.
- **hardware:** Hardware focus with facets like Dealers, 3rd parties/vendors, Operations/supply.
- **general:** General Manager/SVP focus with a shorter set of facets.

Users can add, remove, and rename facets. The four CBTO lenses are fixed.

## Pressure-test

The editor applies inline checks. They flag but do not block save:

- If an objective is set but criteria is empty, the cell is flagged.
- If criteria starts with Meet, Attend, Read, Talk, Interview, Email, Call, or Schedule and does not contain a first-person inspectable claim, the cell is flagged as using a tactic instead of criteria.

## Import

The app can import historical XLSX files with the old layout:

- Sheets with "30 Days" / "60 Days" / "90 Days" in the first row are detected as grids.
- Lens names like "Customer/Product" and "Technical/Execution" are mapped to the CBTO standard.
- Files with 3 columns per horizon (no Status) are supported.
- Non-grid sheets (like "Martin's First Stab") are skipped.

After import, the store is JSON. XLSX is not a reload format.

## Running locally

Open `index.html` or `preview.html` in a browser. No build step required.

The app loads SheetJS from a CDN for XLSX support. If you are offline, XLSX export and import will not work, but JSON save/load and Markdown export will.

## Tests

```sh
npm install xlsx
node scripts/generate-fixtures.js
node scripts/check.js
```

The check script validates:
- Schema compliance
- Pressure-test logic
- XLSX round-trip (export then import preserves cells)
- Historical XLSX import

## License

MIT. Copyright (c) 2026 Kindel, LLC. Keep the copyright notice and permission notice in all copies.

Derivatives must include a visible link to [kindel.com](https://kindel.com).

## Related

- [Goalie](https://kindel.com/goalie/)
- [Loop](https://kindel.com/loop/)
- [Office Hours](https://kindel.com/officehours/)
