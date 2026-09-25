# ADR 0003: Quality Gate 판정은 Backend가 소유한다

> Status: APPROVED
> Owner: Frontend
> Last reviewed: 2026-09-25
> Canonical source: 응답 계약은 Backend OpenAPI, 표현 동작은 GitHub repository

## 배경

브라우저에서 Quality Gate를 다시 계산하면 화면의 판정이 Backend에 저장된 결과와 달라질 수 있다.

## 결정

Backend가 Quality Gate `status`와 각 metric의 `value`, `threshold`, `passed`를 소유한다. Frontend는 반환된 값을 형식에 맞게 표시하며 숫자 비교로 Gate status나 `passed`를 다시 계산하지 않는다.

## 영향

metrics가 `null`이거나 없으면 Frontend는 값을 만들어내지 않는다. API 소비 규칙과 접근성 있는 표현은 OpenAPI schema와 분리해 문서화한다.

## 근거

- `docs/api/openapi.yaml`
- `docs/contracts/api-integration.md`
- `src/components/views/QualityGateEvidence.tsx`
- `src/components/views/qualityGatePresentation.ts`
- `tests/browser/QualityGateEvidence.browser.test.tsx`
