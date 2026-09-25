# ADR 0002: API mode와 demo mode를 명시적으로 구분한다

> Status: APPROVED
> Owner: Frontend
> Last reviewed: 2026-09-25
> Canonical source: GitHub repository (`src/config/runtimeConfig.ts`, `src/App.tsx`)

## 배경

Demo fixture는 Backend 없이 화면을 보여주는 데 사용할 수 있다. 그러나 API 요청 실패를 조용히 성공한 demo data로 바꾸면 만들어낸 데이터를 실제 결과처럼 보이게 한다.

## 결정

`VITE_DATA_MODE`의 기본값은 `api`다. `demo`로 설정하면 현재 UI banner만 바뀐다. fixture adapter를 선택하지 않으며 API service는 계속 요청을 보낸다. API 오류를 성공한 demo/mock 응답으로 바꾸지 않는다. Fixture 기반 demo data source는 아직 구현되지 않았다.

## 영향

Browser test stub은 Backend 동작이나 API 계약의 근거가 아니다. 향후 fixture 기반 demo mode를 만들려면 별도 승인된 구현과 data source 경계가 필요하다.

## 근거

- `src/config/runtimeConfig.ts`
- `src/App.tsx`
- `README.md`
- `docs/architecture/frontend-architecture.md`
