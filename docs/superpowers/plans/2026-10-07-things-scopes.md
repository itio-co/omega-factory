# Things and Scopes Implementation Plan

> Execute inline with executing-plans; request independent review at completion.

**Goal:** One editor, category-filtered Things, scope-owned ports, multiple category definitions and instances.
**Architecture:** Keep the validated simulation Game per Factory Thing. Add a versioned collection of World Things, Factory Things, and enclosure categories. Reuse the same palette, edit/history/apply controls and canvas navigation controls. Preserve legacy saves as the first World/Factory.
**Tech Stack:** Existing Svelte, TypeScript, Three.js, Vitest, Playwright, Electron.
**Spec:** User steering in this chat and docs/SCOPES.md, updated by this plan.

## Decisions

- World and Factory are categories, not singular object identities. Things have stable IDs.
- Two editable planes: World and Interior. No Wall plane. Inlets/outlets are enclosure scope properties.
- Each factory retains its independent simulation, economy, quests, draft and history. Factories continue ticking while another is focused.
- Additional category definitions choose World or Factory behavior; custom simulation behaviors are outside this change.
- A new World starts a separate First Light sandbox. New Factory costs 500 CR plus a 1,000 CR transferred starting budget, and begins empty. Existing factory budgets do not merge.
- World map focuses the selected factory's routes; other factories remain selectable Things on the map. Cross-factory transport is future work; do not imply it is implemented.
- Collection limits: 8 worlds, 16 factories per world, 24 categories. Protect invalid imports and active drafts during navigation.

## Tasks

- [x] Share palette and draft controls across World/Interior, filter purchases by plane.
- [x] Edit/move World Things, connect matching boundary ports, hide external Things inside enclosure.
- [x] Extract shared select/pan/zoom/fit controls and define category registry.
- [x] Add validated multi-Thing collection persistence, legacy migration and isolation tests.
- [x] Add category/World/Factory creation and navigation; retain drafts and tick inactive factories.
- [x] Run regression and new browser tests, inspect desktop/tablet, independent review.
- [x] Update docs and rebuild/smoke-test native desktop.

## Verification ledger

- 61 unit tests pass; 22 browser tests pass on the final stable sources.
- Type checking: zero errors/warnings; formatting and whitespace checks pass.
- Shared World/Interior controls and category/instance navigation visually inspected.
- Linux AppImage rebuilt; native smoke verifies navigation, update outage, automatic restart, delivery and quest board with no page errors.
- Independent review found inaccessible legacy World positions; a failing regression reproduced it, normalization now keeps external Things inside reachable map bounds.
- Kido bootstrap completed separately. Wish and Kubernetes ingress stories are pending. Wish submission creates its story immediately; later development uses `/kido code`, then validated `/kido deploy dev`. No Wish server, remote development dispatch, or cluster rollout was performed.
