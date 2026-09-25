# GuardBench Frontend 문서 라우터

> Status: APPROVED
> Owner: Frontend
> Last reviewed: 2026-09-25
> Canonical source: GitHub repository (`docs/`)

이 문서는 Frontend 문서 Inventory와 작업별 읽기 경로를 제공한다. 각 문서의 효력은 문서 자체의 상태와 소유권을 따른다. 에이전트 작업의 시작 순서와 계약 판단 우선순위는 repository root의 [`AGENTS.md`](../AGENTS.md)를 따른다.

## 문서 상태

문서 상태는 다음 네 가지다.

| 상태 | 의미 |
| --- | --- |
| `DRAFT` | 제안 또는 검토 중인 내용이다. 승인되기 전에는 구현 계약으로 사용하지 않는다. |
| `APPROVED` | 승인된 현재 계약 또는 운영 절차다. 구현과 리뷰의 기준으로 사용할 수 있다. |
| `DEPRECATED` | 신규 구현의 기준으로 사용하지 않는다. 대체 자료를 함께 가리킨다. |
| `SUPERSEDED` | 후속 결정이나 문서가 내용을 대체했다. 현재 판단에는 대체 자료를 사용한다. |

문서의 `Status`가 없으면 `APPROVED`로 간주하지 않는다. 문서 안의 `Current behavior`는 source에서 관찰한 현재 동작을 뜻하며 목표 요구사항이라는 의미는 아니다. `DRAFT` 표제가 있는 절은 제안이다. 해결되지 않은 결정은 문서 상태로 만들지 않고 관련 Issue 또는 ADR에 기록한다.

## 계약 소유권

| 영역 | Owner | Canonical source |
| --- | --- | --- |
| API endpoint, method, request/response schema, enum, nullable, validation, public error | Backend | Backend의 승인된 `docs/api/openapi.yaml`; 이 저장소의 OpenAPI는 출처 metadata가 붙은 동기화 사본이다. |
| Frontend API 호출, DTO mapping, 서버 상태를 화면 상태로 표현하는 규칙 | Frontend | [`contracts/api-integration.md`](contracts/api-integration.md)와 실제 API service/source |
| 사용자 목표, 화면, route 및 흐름 | Frontend | [`product/`](product/) 문서와 현재 route/view 구현 |
| 계층, 의존 방향, 상태 소유권 | Frontend | [`architecture/frontend-architecture.md`](architecture/frontend-architecture.md)와 현재 `src/` |
| interaction, feedback, 접근성 표현 | Frontend | [`conventions/ui-guidelines.md`](conventions/ui-guidelines.md)와 browser-visible behavior |
| 테스트 전략과 작성 규칙 | Frontend | [`testing.md`](testing.md) 및 테스트 설정/source |
| Frontend build/deploy workflow 동작 | Frontend | [`operations/frontend-deployment.md`](operations/frontend-deployment.md)와 `.github/workflows/` |
| AWS resource definition | Infrastructure | IaC 저장소. Frontend workflow의 resource ID는 설정값이지 resource 정의의 source가 아니다. |

Frontend 문서는 Backend OpenAPI의 API schema를 복제해 독립 계약으로 만들지 않는다. OpenAPI 사본의 source commit과 SHA-256은 [`api/openapi.source.json`](api/openapi.source.json)에 기록한다. 사본 동기화·검증 절차는 [`api/README.md`](api/README.md)를 따른다.

## 문서 Inventory

현재 문서 책임과 2026-09-25 source 대조 결과다. 미래 제안은 `DRAFT`로 분리하고 현재 동작으로 설명하지 않는다.

| 문서 | 상태 / Owner | 역할 및 canonical source | source 대조 결과 |
| --- | --- | --- | --- |
| [`product/screen-spec.md`](product/screen-spec.md) | `APPROVED` / Frontend | 현재 화면, route, 사용자에게 보이는 상태 | `src/routing/`, `ResultDetailView.tsx`, `ApplicationResponseEvidence.tsx`를 포함한 `src/components/views/`와 대조했다. 계획은 별도 `DRAFT` 절로 구분한다. |
| [`product/user-flows.md`](product/user-flows.md) | `APPROVED` / Frontend | Suite 준비, Run 생성·진행·결과·Regression 흐름 | view, service, hook과 route를 대조했으며 결과 목록과 Snapshot detail API의 Application Response 흐름도 확인했다. 미구현 선택지는 승인 흐름에서 분리한다. |
| [`api/openapi.yaml`](api/openapi.yaml) | `APPROVED` / Backend | Backend API 계약의 동기화 사본 | Backend `GuardBench/guardbench-backend`가 canonical source. 기록된 commit `1aa4941`의 원본과 사본 SHA-256이 일치함을 확인했다. `openapi:verify` script 자체는 Backend clone이 없어 실행하지 않았다. |
| [`api/openapi.source.json`](api/openapi.source.json) | 생성 metadata / Backend source 참조 | 사본의 source repository, commit, path, SHA-256 | [`scripts/sync-openapi.mjs`](../scripts/sync-openapi.mjs)와 `openapi-contract.yml`이 기록·검증한다. |
| [`api/README.md`](api/README.md) | `APPROVED` / Frontend | OpenAPI 사본 sync, verify, drift 확인 절차 | npm scripts, sync script, `.github/workflows/openapi-contract.yml`과 대조했다. |
| [`contracts/api-integration.md`](contracts/api-integration.md) | `APPROVED` / Frontend | Backend 계약을 호출·mapping·표현하는 소비 계약 | `testRunService.ts`, `ApplicationResponseEvidence.tsx`, `ResultDetailView.tsx`를 포함한 service/view와 OpenAPI의 list/detail response를 대조했다. endpoint/schema의 owner가 아니다. |
| [`architecture/frontend-architecture.md`](architecture/frontend-architecture.md) | `APPROVED` / Frontend | 현재 module 경계, 상태 소유권, polling·오류·테스트 경계 | `src/App.tsx`, `src/config/`, `src/routing/`, `src/services/`, `useLiveRunProgress.ts`, `ApplicationResponseEvidence.tsx`와 대조했다. 제안은 `DRAFT`로 분리한다. |
| [`conventions/ui-guidelines.md`](conventions/ui-guidelines.md) | `APPROVED` / Frontend | 현재 UI 상태, form, dialog, feedback, 접근성 기준 | common/view components, `ApplicationResponseEvidence.tsx`, `useDialogFocus`, layer config와 browser-visible behavior를 다시 대조했다. 지원 여부를 정하지 않은 제안은 `DRAFT`로 구분한다. |
| [`testing.md`](testing.md) | `APPROVED` / Frontend | Node contract/presentation 및 Chromium component test 규칙 | `package.json`, `vitest.config.ts`, `tsconfig.browser.json`, `scripts/`, `tests/browser/`, workflow와 대조했다. |
| [`operations/frontend-deployment.md`](operations/frontend-deployment.md) | `APPROVED` / Frontend | Frontend build, artifact, deploy 및 release workflow 동작 | `.github/workflows/`와 대조했다. AWS resource 정의는 IaC 소유이며 실제 IaC output과의 대조는 이 환경에서 수행하지 않았다. |
| [`decisions/README.md`](decisions/README.md) | `APPROVED` / Frontend | 근거가 확인된 설계 결정과 ADR 탐색 | source/docs/Issue에서 확인 가능한 결정을 기록한다. 기록되지 않은 과거 결정을 추정하지 않는다. |

### 문서 구조 선택

- 별도 `contracts/README.md`는 추가하지 않는다. 계약 책임과 작업별 라우팅은 이 문서가 담당하고 OpenAPI 동기화 운영은 `api/README.md`가 담당한다.
- 별도 `conventions/project-structure.md`는 추가하지 않는다. 실제 module과 계층 책임은 architecture 문서가 관리하며 구조가 바뀌면 그 문서를 갱신한다.
- `docs/ai-development/`는 추가하지 않는다. 작업 절차는 root `AGENTS.md`가 소유하고 테스트 작성 방법은 `testing.md`가 소유한다.
- 중요한 Frontend 설계 결정은 [`decisions/`](decisions/)의 ADR에 남긴다. 기존 사실을 근거 없이 소급 작성하지 않는다.

## 작업별 문서 라우팅

먼저 현재 Issue와 [`AGENTS.md`](../AGENTS.md)를 확인한 뒤, 아래 자료와 실제 source/test를 읽는다.

| 작업 | 읽기 순서 |
| --- | --- |
| 화면 구현 | [`product/screen-spec.md`](product/screen-spec.md) → [`product/user-flows.md`](product/user-flows.md) → [`conventions/ui-guidelines.md`](conventions/ui-guidelines.md) → 관련 views/components 및 tests |
| API 연동 | [`api/README.md`](api/README.md) → [`api/openapi.yaml`](api/openapi.yaml) → [`contracts/api-integration.md`](contracts/api-integration.md) → 관련 services/types와 tests |
| 사용자 흐름 변경 | [`product/user-flows.md`](product/user-flows.md) → [`product/screen-spec.md`](product/screen-spec.md) → route/view 구현과 tests |
| Architecture 변경 | [`architecture/frontend-architecture.md`](architecture/frontend-architecture.md) → 관련 source 의존·상태 흐름 → 관련 tests → [`decisions/`](decisions/) |
| UI/접근성 변경 | [`conventions/ui-guidelines.md`](conventions/ui-guidelines.md) → [`testing.md`](testing.md) → 관련 components와 browser tests |
| 테스트 변경 | [`testing.md`](testing.md) → `package.json`과 test config → 대상 Node/browser tests |
| 배포 변경 | [`operations/frontend-deployment.md`](operations/frontend-deployment.md) → `.github/workflows/` → 관련 설정 및 IaC 책임 경계 |
| 문서 또는 설계 결정 | 관련 canonical 문서 → 현재 구현 근거 → [`decisions/README.md`](decisions/README.md)와 Issue 기록 |

## 문서 갱신

Route, 화면, endpoint 소비, DTO mapping, polling, 상태 소유권, loading/empty/error 표현, 접근성, 테스트 설정 또는 workflow가 바뀌면 위 Inventory에서 책임 문서를 확인해 함께 갱신한다. Backend OpenAPI 변경은 Backend에서 먼저 승인한 뒤 사본을 동기화한다. 실제 source와 문서가 다르면 현재 동작을 승인 목표로 승격하지 말고 차이와 후속 Issue를 명시한다.
