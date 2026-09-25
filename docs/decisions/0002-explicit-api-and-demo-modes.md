# ADR 0002: API and demo modes stay explicit

> Status: APPROVED
> Owner: Frontend
> Last reviewed: 2026-09-25
> Canonical source: GitHub repository (`src/config/runtimeConfig.ts`, `src/App.tsx`)

## Context

Demo fixtures can make screens useful without a running Backend, while silently replacing a failed API request would present invented data as a successful result.

## Decision

`VITE_DATA_MODE` defaults to `api`. Setting it to `demo` currently changes the UI banner only; it does not select a fixture adapter, and the API services continue to make requests. API errors are not converted into successful demo/mock responses. A real fixture-backed demo data source has not been implemented.

## Consequences

Browser test stubs are not evidence of Backend behavior or API contract. A future fixture-backed demo mode requires a separately approved implementation and source boundary.

## Evidence

- `src/config/runtimeConfig.ts`
- `src/App.tsx`
- `README.md`
- `docs/architecture/frontend-architecture.md`
