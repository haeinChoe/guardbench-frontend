# 프론트엔드 설계 결정

> Status: APPROVED
> Owner: Frontend
> Last reviewed: 2026-09-25
> Canonical source: GitHub repository (`docs/decisions/`)

이 디렉터리는 이후 작업에서도 유지해야 하는 Frontend 설계 결정을 근거와 함께 기록한다. API 사용 절차나 UI 구현 상세는 각각 API 연동 계약과 다른 canonical 문서에 둔다.

## 상태와 작성 규칙

- `APPROVED`: 현재 적용 중인 결정이다.
- `DRAFT`: 검토 중인 선택지이며 승인 전에는 구현 계약으로 사용하지 않는다.
- `SUPERSEDED`: 후속 결정이 대체했다. 대체 ADR을 함께 표시한다.
- `DEPRECATED`: 결정이 더는 신규 작업의 기준이 아니며 대체 자료가 없을 수 있다.

새 결정은 [`template.md`](template.md)를 복사한다. ADR에는 `Status`, `Owner`, `Last reviewed`, `Canonical source`를 기록한다. 현재 source와 문서로 입증되는 범위만 남기고, 과거 결정 시점·회의·저자를 추측하지 않는다.

## 결정 목록

| ADR | 상태 | 결정 |
| --- | --- | --- |
| [0001](0001-backend-openapi-source-of-truth.md) | `APPROVED` | Backend OpenAPI가 API schema의 기준이며 Frontend 사본은 동기화·검증한다. |
| [0002](0002-explicit-api-and-demo-modes.md) | `APPROVED` | API와 demo mode를 명시적으로 구분하며 API 실패를 demo 성공으로 fallback하지 않는다. |
| [0003](0003-server-owned-quality-gate.md) | `APPROVED` | Quality Gate 판정은 Backend가 소유하고 Frontend는 반환된 근거를 표시한다. |
| [0004](0004-browser-component-testing.md) | `APPROVED` | UI component test는 Vitest Browser Mode와 Playwright Chromium을 사용한다. |
