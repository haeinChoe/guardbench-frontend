# ADR 0004: Browser-based component tests

> Status: APPROVED
> Owner: Frontend
> Last reviewed: 2026-09-25
> Canonical source: GitHub repository (`docs/testing.md`, `vitest.config.ts`)

## Context

DOM-only test environments cannot validate computed layout, bounding boxes, and browser focus behavior that matter to this UI.

## Decision

Component tests use Vitest Browser Mode with the Playwright provider and Chromium. Node tests remain for pure presentation, state, API contract, and source-level checks.

## Consequences

Browser tests use accessible roles and labels, deterministic API stubs, and browser-observable behavior. Chromium must be available locally or installed by CI.

## Evidence

- `docs/testing.md`
- `vitest.config.ts`
- `.github/workflows/deploy.yml`
- `tests/browser/`
