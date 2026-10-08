# Wish Pipeline Implementation Plan

> Execute inline using test-driven-development and executing-plans. Keep the Kido brain as the durable progress ledger.

**Goal:** Trace player Wishes through durable submission, one pending Kido story, and optional sequential dev delivery.
**Architecture:** Node HTTP + YAML store, Kido subprocess boundary, Svelte modal, opt-in worker. Existing game remains the foundation.
**Tech Stack:** Node stdlib, installed js-yaml promoted to runtime dependency, Svelte, Vitest, Playwright.
**Spec:** ../specs/2026-10-07-wish-pipeline.md

## Global constraints

One writer process per local volume. No shell interpolation. Preserve Unicode text.
No live agent dispatch/deployment while testing. The worker is disabled by default.
Default API 127.0.0.1:8787; text 1–4000 characters; body 32 KiB; UUID identities.

## Review focus

- Lost response after story creation: reconcile deterministic slug without another story.
- Partial brain or failed push: retain retryable status and original Wish.
- Crash after external side effect: reconcile receipt or require operator action.
- Browser reload after uncertain submission: reuse the request identity and text.
- Invalid storage/second server: refuse startup without replacing data.

## Task 1: Durable submission API and Kido boundary

Files: server/store.mjs, server/kido.mjs, server/http.mjs, server/main.mjs, server/*.test.mjs.
Interfaces: store.mutate(callback), store.read(); createStory(wish) -> {id, slug, path}.

- [x] Write failing HTTP/storage tests for Unicode, concurrent identities, conflicts, invalid bodies, restart and failure retry.
- [x] Implement versioned YAML, process lock, atomic serialized mutations and API validation.
- [x] Test subprocess creation/reconciliation with a fixture writer and temporary Git remote.
- [x] Implement deterministic Kido story discovery, scoped commit/push and failure reconciliation.
- [x] Verify API tests and existing unit tests, review diff, commit.

## Task 2: Game Wish modal

Files: src/lib/components/WishForm.svelte, src/lib/wishes.ts, src/App.svelte, tests/wishes.spec.ts, vite.config.ts.
Interface: POST {requestId, text} -> {id, status, story, message?}.

- [x] Write failing browser tests for successful submission, retry, reload, keyboard focus and false-success rejection.
- [x] Add modal, persistent draft/identity, endpoint configuration and Vite proxy.
- [x] Run browser tests plus check/build; review diff, commit.

## Task 3: Optional worker and operational guide

Files: server/worker.mjs, server/claude.mjs, server/worker.test.mjs, docs/WISHES.md, README.md.
Interfaces: worker advances one persisted Wish at a time; external stage execution yields durable receipts bound to operation/story/commit.

- [x] Write failing tests for ordering, receipts, crash recovery, failed validation/deploy and single worker ownership.
- [x] Implement claims, exact-story dispatch, validation, dev-only deployment and recovery without duplicate side effects.
- [x] Document configuration, persistent storage, eligibility, host requirements and operator recovery.
- [x] Run all project checks, request a whole-change review, fix findings and checkpoint Kido.
