# ADR 0001: Backend OpenAPI가 API schema를 소유한다

> Status: APPROVED
> Owner: Frontend
> Last reviewed: 2026-09-25
> Canonical source: Backend OpenAPI; 이 기록은 Frontend GitHub repository에서 관리한다

## 배경

Frontend는 DTO mapping과 검토에 사용할 계약 자료가 필요하다. API schema를 별도로 작성하면 Backend와 endpoint 및 field 정의가 달라질 수 있다.

## 결정

`GuardBench/guardbench-backend/docs/api/openapi.yaml`이 endpoint, method, request/response schema, enum, nullable, validation 및 public error shape를 소유한다. 이 저장소의 `docs/api/openapi.yaml`은 동기화 사본이다. 사본의 source commit과 SHA-256은 `docs/api/openapi.source.json`에 기록하고 `npm run openapi:verify` 및 OpenAPI workflow에서 확인한다. 승인되지 않은 API 변경을 반영하려고 Frontend 사본을 직접 수정하지 않는다.

## 영향

Backend API 변경은 Backend source에서 먼저 승인한다. 그 후 Frontend는 사본을 동기화하고 영향받는 DTO, UI, tests 및 소비 문서를 함께 검토한다. Frontend 소유의 mapping 및 표현 규칙은 `docs/contracts/api-integration.md`에 둔다.

## 근거

- `docs/api/README.md`
- `scripts/sync-openapi.mjs`
- `.github/workflows/openapi-contract.yml`
- `AGENTS.md`
