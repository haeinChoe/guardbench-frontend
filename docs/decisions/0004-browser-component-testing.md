# ADR 0004: Browser 기반 component test를 사용한다

> Status: APPROVED
> Owner: Frontend
> Last reviewed: 2026-09-25
> Canonical source: GitHub repository (`docs/testing.md`, `vitest.config.ts`)

## 배경

DOM만 제공하는 test 환경에서는 이 UI에서 중요한 계산된 layout, bounding box 및 browser focus 동작을 검증할 수 없다.

## 결정

Component test는 Vitest Browser Mode, Playwright provider 및 Chromium을 사용한다. 순수 presentation, state, API contract 및 source-level 검사는 Node tests에 둔다.

## 영향

Browser tests는 accessible role과 label, 결정적인 API stub 및 browser에서 관찰할 수 있는 동작을 기준으로 작성한다. 로컬 또는 CI 환경에서 Chromium을 사용할 수 있어야 한다.

## 근거

- `docs/testing.md`
- `vitest.config.ts`
- `.github/workflows/deploy.yml`
- `tests/browser/`
