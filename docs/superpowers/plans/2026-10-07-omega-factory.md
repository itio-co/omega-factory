# Omega Factory Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a playable, offline-capable Itioverse factory demo in this repository.

**Architecture:** A deterministic TypeScript graph engine independent of Svelte and rendering. Svelte controls HTML cards and SVG links; Threlte provides an orthographic presentation. An Electron shell packages the static build.

**Tech Stack:** Svelte 5, TypeScript, Vite, Three.js, Threlte, Vitest, Playwright, Electron.

**Spec:** `docs/superpowers/specs/2026-10-07-omega-factory-design.md`

## Global Constraints

- Production advances only on explicit simulation ticks.
- Definitions, runtime state, and editor layout remain separate.
- No network or external assets required to play.
- Invalid imported saves never replace the current factory.
- Desktop and tablet pointer input; no Steam publishing in this task.

## Review Focus

- Cyclic/fan-out graphs conserve resources and cannot bypass per-tick transfer limits.
- Full outputs retain recipe inputs/results without losing inventory.
- Malformed saves and localStorage failures preserve the current game.
- Touch dragging and viewport transforms do not create accidental connections.
- Structural edits, upgrades, undo, and contract claiming cannot duplicate money.

### Task 1: Simulation and persistence

**Files:** `src/lib/game/{types,catalog,engine,persistence}.ts`, `src/lib/game/engine.test.ts`.
**Interfaces:** `createGame(): Game`, `tick(game: Game): Game`, graph editing functions returning Game; `serialize(game): string`, `deserialize(text): Game`.

- [x] Write and run failing behavioral tests for the core loop, conservation, validation, backpressure, economy, and save round trips.
- [x] Implement catalog, definition/runtime/layout types, deterministic tick and validated edits.
- [x] Implement bounded strict versioned persistence; run the full core suite.

### Task 2: Playable interface

**Files:** `src/App.svelte`, `src/lib/components/*.svelte`, `src/app.css`, browser tests.
**Interfaces:** UI calls the Task 1 engine; graph editor changes only layout for drags.

- [x] Write failing browser tests for connect/run/contract flow and save/load.
- [x] Implement onboarding, graph controls, inspector, build palette, contracts, undo/redo, and status.
- [x] Add the Threlte visual layer with a functional WebGL fallback and reduced-motion support.
- [x] Validate desktop and tablet flows, type check, and inspect screenshots.

### Task 3: Desktop delivery and review

**Files:** `desktop/main.cjs`, `README.md`, desktop packaging settings, CI workflow.
**Interfaces:** Electron loads the Vite build through file URLs with isolated renderer.

- [x] Package and smoke-check the desktop build; document controls and release boundaries.
- [x] Run unit/browser suites, type check, and production build.
- [x] Request an independent code review, address important findings, and verify fixes.

## Execution record

Work takes place on `codex/omega-factory-demo` in the requested folder.
The later user-supplied discussions expanded the scope to include a safe boolean
rule lab, equivalent-behavior rediscovery, journal persistence, and learning tiers.
All have been incorporated into the playable slice. The reviewer independently
validated all-contract progression, save round trips, and cyclic graph conservation.
Two UI findings received reproducing browser tests: route pointer capture and
resource selection on occupied nodes.

The user asked to implement the existing discussion here; no additional approval
round is introduced. Itioverse details unavailable from the linked project remain
an explicit limitation rather than invented requirements.

## Final validation

- 36 unit tests and 15 browser tests pass after the dragging, flow-rate, and learning-progression follow-ups.
- Svelte/TypeScript checking reports zero errors and zero warnings.
- Formatting, production build, and Linux AppImage packaging pass.
- The packaged Electron application launches, advances production, and does not expose Node.js to its renderer.
- A further regression exposed tick-correlated fan-out starvation. Output distribution now advances a saved per-source cursor after each successful transfer; all three contracts complete with both sale and assembly branches connected.
- Source remains in the requested workspace on `codex/omega-factory-demo`; no remote publication or Steam upload was performed.

## Phase 2: Learning progression

- [x] Extend the existing rule engine with implication, three-input majority, and a NAND-only selector.
- [x] Enforce sequential prerequisites, all four/eight input cases, allowed operators, and one-time rewards.
- [x] Make all five game tiers reachable with visible requirements and next-challenge guidance.
- [x] Preserve earlier saves and reject missing, reordered, or backdated prerequisite evidence.
- [x] Verify full progression and reload through the browser, including rejection of a behaviorally correct selector using forbidden gates.

Independent review identified the backdated-prerequisite case. A reproducing test
failed before the fix; validation now checks previously verified journal entries
and permits equal simulation ticks for discoveries made while paused.
