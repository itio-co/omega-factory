# Buildings and Quests Implementation Plan

> Execute inline with the executing-plans skill, followed by independent review.

**Goal:** Four new buildings and a persistent main/side quest system.
**Architecture:** Catalog-driven recipes in the existing deterministic engine;
pure quest definitions/progress/claim functions shared by UI and persistence.
**Tech Stack:** Existing TypeScript, Svelte, Three.js/Threlte, Electron.
**Spec:** ../specs/2026-10-07-buildings-quests.md

## Constraints and review focus

Preserve original contract counters/rewards and v1 save compatibility. No online
services. Check input/output conservation, reserved capacity, once-only rewards,
unlock bypasses, partial old saves, and completed quests after building salvage.

### 1. Core production and quests

Files: game/{types,catalog,engine,persistence,quests}.ts and behavioral tests.

- [x] Reproduce missing new buildings and quest lifecycle with failing tests.
- [x] Add recipes/resources/building unlocks and generic processing.
- [x] Implement questStatus, questObjectives, claimQuest, trackQuest, trackedQuest.
- [x] Add save defaults/validation and verify old contracts remain playable.

### 2. Playable interface

Files: App, FactorySidebar, NodeCard, NodeIcon, MachineModel, QuestBoard,
QuestTracker, QuestObjectives, app.css, browser tests.

- [x] Add models, recipe descriptions, palette browsing and locked-building reasons.
- [x] Add quest board filters/details/claims and persistent sidebar tracking.
- [x] Verify progression, reload, input behavior and tablet layout.

### 3. Delivery

- [x] Run type, unit, browser, formatting, production and desktop checks.
- [x] Request independent review; fix important findings with regression tests.
- [x] Update README/backlog and refresh desktop artifact.

## Scope additions and review ledger

Added factory world/interior tabs, attached wall slots, live/draft reconciliation,
level-based downtime, automatic production, and save migration following user
steering. Covered by factory core tests and browser interaction tests.

Independent review found selection incorrectly dirtied drafts and cleared redo.
A browser regression reproduced the failure; history now starts only after an
actual drag changes position. Full browser suite passes, including that regression.
A tablet connection hint obscured ports; moved it above the graph and made its
background ignore pointer events. All 18 browser scenarios now pass.

Final verification: 49 unit tests and 18 browser tests pass; type checking reports
zero errors/warnings; formatting and whitespace checks pass. Production and Linux
AppImage builds complete. Native desktop smoke verifies world/interior navigation,
apply outage, automatic restart, deliveries, and the quest board without page
errors. Desktop/tablet screens were inspected. Corrected a blank world scene by
calling camera.lookAt on creation; the rebuilt native screenshot confirms rendering.
