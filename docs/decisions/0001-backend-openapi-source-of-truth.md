# ADR 0001: Backend OpenAPI owns API schema

> Status: APPROVED
> Owner: Frontend
> Last reviewed: 2026-09-25
> Canonical source: Backend OpenAPI; this record is maintained in the Frontend GitHub repository

## Context

Frontend needs a local contract for DTO mapping and review. Maintaining a separately authored API schema would allow endpoint and field definitions to drift from Backend.

## Decision

`GuardBench/guardbench-backend/docs/api/openapi.yaml` owns endpoint, method, request/response schema, enum, nullable, validation, and public error shape. `docs/api/openapi.yaml` in this repository is a synchronized copy. Its source commit and SHA-256 are recorded in `docs/api/openapi.source.json` and checked by `npm run openapi:verify` and the OpenAPI workflow. Frontend does not edit the copy to make an unapproved API change.

## Consequences

Backend API changes are approved at the Backend source before Frontend synchronizes the copy and reviews affected DTOs, UI, tests, and consumption docs. Frontend-owned mapping and presentation rules remain in `docs/contracts/api-integration.md`.

## Evidence

- `docs/api/README.md`
- `scripts/sync-openapi.mjs`
- `.github/workflows/openapi-contract.yml`
- `AGENTS.md`
