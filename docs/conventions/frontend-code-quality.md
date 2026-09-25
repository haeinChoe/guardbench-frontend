# 프론트엔드 코드 품질과 구현 규칙

> Status: APPROVED
> Owner: Frontend
> Last reviewed: 2026-09-26
> Scope: GitHub Issue #8
> Inventory baseline: `70cd58c` (Issue #7 merge candidate)

이 문서는 현재 source를 검토해 정한 Frontend의 책임 경계, 의존 규칙, naming 기준과 후속 리팩터링 대상을 기록한다. API 계약은 Backend OpenAPI가 소유한다. 이 규칙은 화면 동작이나 API 계약을 변경하지 않으며, 대형 파일을 기계적으로 나누라는 요구도 아니다.

## 1. 계층별 책임

| 코드 단위 | 책임 | 두지 않는 책임 |
| --- | --- | --- |
| `App` / View | 화면 조합, 화면 단위 interaction, 필요한 query·mutation 시작, 로딩·오류·빈 상태 표현 | 공통 HTTP envelope 처리, 서버 판정 재계산 |
| Common component | 입력·표시·접근성 interaction과 명시적인 props 계약 | endpoint 호출, 화면별 API DTO 생성, 숨겨진 mock fallback |
| Hook | 재사용되는 state/effect 흐름, request identity와 cleanup | JSX의 화면 구성, HTTP envelope 해석 |
| Service / API client | endpoint 요청, API DTO와 transport 오류 경계 | React import, UI 상태와 표시 문구 |
| API DTO type | OpenAPI를 소비하는 request/response 구조 | 폼 draft나 화면 편의를 위한 파생 값 |
| Presentation helper | React 없이 수행할 수 있는 mapping, formatting, filter·pagination 계산 | 네트워크·DOM 접근, mutable UI state |
| Form state | 입력 draft, validation 결과와 제출 상태 | API response type을 편집 상태로 재사용 |

View는 Hook, Service, Common component와 presentation helper를 사용할 수 있다. Hook은 Service와 pure helper를 사용한다. Service와 API client는 React component에 의존하지 않는다. Common component는 View와 endpoint-specific Service를 import하지 않는다. 순환 import를 추가하지 않는다.

기존의 책임 혼합은 이슈 인벤토리에 기록하고 기능 변경과 함께 단계적으로 분리한다. 책임이 분리되고 독립 검증이나 변경 이유가 분명해질 때 helper, hook 또는 component를 추출한다.

## 2. 타입과 데이터 경계

- API request/response 타입은 해당 endpoint service의 `*Req`, `*Res`, `*Payload` 이름을 사용하고 Backend OpenAPI를 따라간다.
- UI model은 화면에서 필요한 파생 상태일 때 별도 이름으로 선언하고 서버 DTO를 수정하거나 재사용해 폼 draft로 삼지 않는다.
- 사용자가 편집 중인 값은 `Draft`, `Form`, `EditState`처럼 local state임이 드러나는 이름을 사용한다.
- API DTO를 받는 경계에서는 API 오류를 기존 공개 오류 모델로 보존한다. 화면은 그 모델에서 허용된 메시지만 표현한다.
- DOM의 `string` 값은 union type으로 단언하지 않는다. 허용 값 목록으로 검사하고, 알려지지 않은 값은 해당 상태 갱신을 건너뛴다.
- `as`는 검증된 외부 invariant를 TypeScript가 표현할 수 없는 좁은 경계에서만 사용한다. API payload의 shape나 사용자 입력을 assertion으로 검증했다고 간주하지 않는다.
- nullable과 optional의 구분, Quality Gate·execution·assertion·evaluation 상태 의미를 보존한다. 서버 판정을 클라이언트에서 다시 계산하지 않는다.

## 3. State, effect와 비동기 요청

- 각 state는 하나의 화면·hook·form 등 명확한 소유 단위에 둔다. 서버 값, 파생 표시 값, local interaction draft를 섞지 않는다.
- 현재 state에서 직접 계산할 수 있는 값은 별도 state로 복제하지 않는다. 단, request identity, stale 표시, 사용자가 바꾼 draft처럼 독립된 수명이나 의미가 있으면 따로 둔다.
- effect는 의존하는 identity와 reload signal을 빠짐없이 선언하고, 종료 시 timer·subscription·요청 결과의 반영 권한을 정리한다.
- 비동기 결과는 요청 시점의 resource identity가 여전히 현재 state와 맞을 때만 반영한다. polling 간격, 종료 조건, 오류 재시도 정책은 관련 승인 계약을 따른다.
- loading, refreshing, stale, empty, terminal error와 retryable error는 실제 의미가 다를 때 별도 상태로 유지한다.
- callback memoization은 자식 렌더 안정화나 effect identity를 위해 필요할 때 사용한다.

## 4. Naming과 파일 배치

| 항목 | 기준 |
| --- | --- |
| View / 시각 component | 역할 이름의 PascalCase `.tsx`, 예: `ResultDetailView.tsx`, `QualityGateEvidence.tsx` |
| Modal / Dialog | 화면에서 사용자 목적을 드러내는 PascalCase, `Modal` 또는 `Dialog` 접미사 |
| Hook | `use`로 시작하는 camelCase, 재사용 state/effect 흐름을 나타냄 |
| Service | 도메인 명사 + `Service.ts`, endpoint 함수와 API DTO를 함께 소유 |
| API type | `*Req`, `*Res`, payload 의미가 분명한 `*Payload` |
| Pure helper | 역할을 나타내는 camelCase `.ts`, 예: `resultFilterPresentation.ts` |
| state | 현재 값의 의미를 나타내는 camelCase 명사 또는 상태 표현 |
| event handler | 사용자 동작을 나타내는 `handle*`; 재사용 가능한 값 변경 동작은 동사로 명명 |

현재 구조에서 `components/views`, `components/common`, `components/layout`, `hooks`, `services`, `types`, `contracts`, `utils`, `config`, `routing`의 역할을 유지한다. 파일이 크다는 이유만으로 feature 폴더를 만들거나 여러 기존 파일을 일괄 이동하지 않는다.

## 5. 현재 source 인벤토리

다음 표는 Inventory baseline의 모든 `src/` 파일을 역할별로 확인한 결과다. 경로 목록이 해당 파일의 현재 주 책임을 나타내며, `*`는 이름에 해당 접두/접미 범위의 전체 파일을 뜻한다.

| 영역 | 파일과 현재 주 책임 |
| --- | --- |
| App과 스타일 | `src/main.tsx` React 진입점; `src/App.tsx` route·shell·toast 조합; `src/App.css`, `src/index.css` 전역 스타일 |
| Assets | `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg` 정적 파일 |
| Common UI (`src/components/common/`) | `ActionValue.tsx` action 값 표시; `BulkTestCaseCreatePanel.tsx` 일괄 입력 UI; `CreateSuiteModal.tsx` suite 생성 입력·검증·제출; `RequestErrorBanner.tsx` 요청 오류 표현; `RunProgressStepper.tsx` 진행 표현; `StatCard.tsx` 통계 표시; `StatusPill.tsx` 상태 표시; `SuiteDetailModal.tsx` suite 상세·case CRUD 및 bulk·pagination 흐름 |
| Common helper (`src/components/common/`) | `actionPresentation.ts` action label/tone; `statusLabels.ts` 진행 status label; `testCaseEditState.ts` case edit draft·validation·transition |
| Layout (`src/components/layout/`) | `Sidebar.tsx` navigation 및 mobile menu interaction; `Topbar.tsx` 상단 셸 표시 |
| Views (`src/components/views/`) | `DashboardView.tsx` 요약 조회·집계·표현; `NewRunView.tsx` suite 선택, target/policy form과 Run 접수; `RunsView.tsx` Run collection 조회·filter; `SuitesView.tsx` suite collection 조회 및 modal 연결 |
| Result / evaluation views (`src/components/views/`) | `ResultDetailView.tsx` Run progress, 결과·metrics 조회, filter·pagination 및 상세 표시; `QualityGateEvidence.tsx` Gate 근거 표현; `QualityGateMetricsChart.tsx` metric chart; `ApplicationResponseEvidence.tsx` 선택 결과 근거 조회 및 접기 |
| Regression views (`src/components/views/`) | `RegressionComparisonSection.tsx` summary·분포·filter·비교 table 표시; `RegressionDetailView.tsx` 상세 비교 화면; `RegressionSummaryEntry.tsx` 요약 진입점 |
| View pure helpers (`src/components/views/`) | `applicationResponsePresentation.ts` response 출처 표시; `evaluationOutcomePresentation.ts` outcome label/tone; `newRunForm.ts` form parse·request mapping; `qualityGatePresentation.ts` server metric presentation; `regressionSummary.ts` summary·distribution mapping; `resultFilterPresentation.ts` filter state·empty/count presentation; `resultInspectionPresentation.ts` 결과별 확인 안내; `resultPaginationPresentation.ts` 결과 pagination item 계산 |
| Config와 contract | `config/layers.ts` portal layer class; `config/runtimeConfig.ts` runtime mode/base URL; `contracts/openapiNullability.contract.ts` compile-time nullable contract |
| Hooks와 state helpers (`src/hooks/`) | `useDialogFocus.ts` dialog focus lifecycle; `useLiveRunProgress.ts` Run progress polling; `useRegressionComparison.ts` candidate·summary·comparison 조회와 retry; `regressionComparisonState.ts` 비교 query key·전이 규칙 |
| Routing | `routing/routes.ts` route parse·serialize 및 Run identity |
| Services (`src/services/`) | `apiClient.ts` fetch·envelope·공개 오류 경계; `testSuiteService.ts`, `testCaseService.ts`, `testRunService.ts`, `regressionService.ts` endpoint DTO와 요청 함수 |
| Types와 Utils | `types/index.ts` 공유 frontend type; `utils/testCaseBulkImport.ts` JSON/CSV 순수 import parser와 payload 변환 |

### 우선 검토 결과

- `SuiteDetailModal.tsx`(923줄)는 목록 조회·pagination, 상세 편집, case 추가·삭제, bulk add와 dialog lifecycle을 한 컴포넌트에 결합한다. 변경 이유와 focus/error lifecycle을 기준으로 별도 리팩터링 후보를 선정한다.
- `CreateSuiteModal.tsx`(571줄)는 기본 case 입력과 JSON/CSV bulk 입력, 검증, 제출 흐름을 한 modal에 둔다. bulk parser는 이미 `utils/testCaseBulkImport.ts`에 pure logic으로 분리돼 있다.
- `ResultDetailView.tsx`(591줄)는 progress polling 연결, 결과·Evaluator 조회, filter·pagination, race recovery와 상세 dialog를 소유한다. 의미별 state와 request identity를 확인하며 단계적으로 분리한다.
- `useRegressionComparison.ts`(350줄)는 candidate, summary, detail query와 자동 재시도 lifecycle을 관리한다. state identity와 retry 계약이 얽혀 있어 무관한 단순화는 하지 않는다.
- 서비스별 API DTO와 pure presentation helper가 이미 존재한다. API DTO 구조가 UI에 우연히 맞는다는 이유만으로 layer를 합치지 않는다.
- 코드베이스에 Node pure logic/contract test와 Chromium component test가 있다. 분리한 계산은 Node test로, 실제 DOM interaction·focus·접근성은 browser test로 검증한다.
- 고위험 영역의 state 개수나 파일 길이는 단독 품질 지표가 아니다. 해당 값만 줄이려는 refactor는 하지 않는다.

Issue #8의 첫 단계에서는 결과 filter의 DOM 문자열을 허용된 union 값으로 검증하고, 결과 pagination item 계산을 화면에서 분리해 순수 helper로 만들었다. 기존 옵션, 요청 mapping, 페이지 표시와 화면 문구는 유지한다. 추출한 filter 및 pagination helper는 Node test에서 허용·거부 입력과 페이지 경계를 검증한다.

## 6. 검증 및 변경 기준

- Pure helper 변경은 입력 경계와 의미 있는 분기를 Node test로 확인한다.
- component 추출 시 observable interaction·accessibility는 Browser test로 확인한다. 내부 함수 호출 순서에만 의존하는 테스트를 새로 만들지 않는다.
- API mapping 변경은 승인 OpenAPI, API integration 문서와 계약 테스트를 함께 확인한다.
- state/effect refactor는 stale response, cleanup, resource 변경과 오류 상태를 검토한다.
- 이 문서에 적힌 원칙을 적용해도 UI behavior, API 계약, polling과 상태 표현은 기존 승인 기준을 보존한다.

## 7. 후속 리팩터링 후보

Issue #8은 단일 PR로 전체 source를 재작성하지 않는다. Inventory 후 사용자-visible behavior를 쉽게 보존할 수 있는 pure logic 개선과 effect cleanup부터 진행하고, modal·결과·comparison의 큰 책임 분리는 독립 검증 가능한 후속 변경으로 나눈다. 각 후속 변경은 실제 책임 중복과 의존 관계를 확인하고 필요한 문서·테스트 범위를 정한다.
