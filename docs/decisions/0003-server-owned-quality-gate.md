# ADR 0003: Backend owns Quality Gate decisions

> Status: APPROVED
> Owner: Frontend
> Last reviewed: 2026-09-25
> Canonical source: Backend OpenAPI for response contract; GitHub repository for presentation

## Context

Recomputing a Quality Gate in the browser could make the displayed decision disagree with the persisted Backend result.

## Decision

Backend owns the Quality Gate status and each metric's `value`, `threshold`, and `passed`. Frontend formats and presents those fields but does not recompute Gate status or `passed` from numeric values.

## Consequences

When metrics are null or absent, Frontend does not invent values. API consumption and accessible presentation are documented separately from the OpenAPI schema.

## Evidence

- `docs/api/openapi.yaml`
- `docs/contracts/api-integration.md`
- `src/components/views/QualityGateEvidence.tsx`
- `src/components/views/qualityGatePresentation.ts`
- `tests/browser/QualityGateEvidence.browser.test.tsx`
