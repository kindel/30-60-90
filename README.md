# 30-60-90

A coming-soon interactive app that writes a 30-60-90 plan document. The product is the document. It is not a tracker.

## The Model

The schema is **Charlie's Take**, locked from three real plans: Tig's SVP rewrite, Avi's hardware plan, and Abhishek's PM plan. Martin's activity list is the anti-pattern.

Horizons are dated and named, not generic "30 days."

| Horizon | Default name |
| --- | --- |
| Day 30 | Land |
| Day 60 | Understand Direction |
| Day 90 | Grasp Current Condition / Set Next Challenge |
| Day 180 (optional) | Ship has Turned |

Rows are CBTO, then a facet of that lens. Each horizon cell has four fields:

1. **Key objective**: one outcome for that facet in that window.
2. **Evaluation criteria**: first-person and inspectable. "I can enumerate the 15 programs" counts. "Meet with the PMs" does not. That is a tactic.
3. **Tactics / deliverables**: the work that might produce the criterion.
4. **Status**: empty when you write the plan. Filled later if someone prints it again.

Mechanisms are a first-class facet, including taking ownership of Goalie when the company has one.

## What the app does

1. Ask for the seat and a start date. Compute the three (or four) horizon dates.
2. Offer a facet list for that seat family (PM, hardware, general manager). Let them add or drop rows. Do not invent a new grid.
3. Walk the cells. Refuse an objective with no evaluation criterion. Refuse a criterion that is only an activity.
4. Export two artifacts: a spreadsheet that matches Charlie's Take, and a readable plan document a hiring manager and a new hire can share on day one.

## What it does not do

It does not become a weekly status tool. It does not replace Goalie. It does not accept a pile of orientation checkboxes.

## Status

Coming soon. The teaching page will live at https://kindel.com/30-60-90/. This repo will be the app when it exists.

## Teaching

- [Hiring First. Everything Else Second.](https://blog.kindel.com/2026/08/12/hiring-first-everything-else-second/)

## Related

- [Goalie](https://kindel.com/goalie/)
- [Loop](https://kindel.com/loop/)
- [Office Hours](https://kindel.com/officehours/)

## License

MIT. Copyright (c) 2026 Kindel, LLC. Keep the copyright notice and permission notice in all copies.

Derivatives must include a visible link to https://kindel.com.
