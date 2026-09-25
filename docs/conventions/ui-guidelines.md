# 프론트엔드 UI 및 접근성 가이드

> Status: APPROVED
> Owner: Frontend
> Last reviewed: 2026-09-25
> Canonical source: GitHub repository (`src/components/`, `src/hooks/`, `tests/browser/`)
> Scope: GitHub Issues #35, #62, #86
> Canonical API: [`../api/openapi.yaml`](../api/openapi.yaml) (`APPROVED`)
> Product flows: [`../product/screen-spec.md`](../product/screen-spec.md), [`../product/user-flows.md`](../product/user-flows.md)
> API consumption contract: [`../contracts/api-integration.md`](../contracts/api-integration.md)
> Architecture: [`../architecture/frontend-architecture.md`](../architecture/frontend-architecture.md)

이 문서는 현재 source와 browser tests에서 확인한 UI 및 접근성 기준을 정의한다. 미래 UI 개선 제안은 `DRAFT`로 표시하고 구현 규칙과 구분한다. API 의미는 Backend OpenAPI와 API 연동 계약을 따르고, 이 문서는 label, feedback, interaction과 접근성 표현만 소유한다.

## 1. 기본 원칙

- 실제 API data, 성공한 empty, 오류, stale과 demo/mock을 구분한다.
- 색상, icon 또는 위치 하나만으로 상태 의미를 전달하지 않는다.
- lifecycle, execution outcome, Evaluator verdict, assertion, Quality Gate와 Regression을 하나의 “성공/실패”로 합치지 않는다.
- 사용자가 입력하는 Application Target과 Backend의 내부 판정 설정을 구분한다.
- Application 자연어 응답은 조회·저장·표시하지 않는다.
- OpenAPI에 없는 값, metric, error 의미와 comparison classification을 UI에서 추정하지 않는다.
- keyboard와 screen reader 사용자가 pointer 사용자와 같은 정보·action에 접근할 수 있어야 한다.

## 2. 현재 공통 UI (`Current behavior`)

| 영역 | 현재 지원 | 주요 차이 |
| --- | --- | --- |
| loading | 주요 목록·Dashboard에서 최초 loading과 data 유지 중 갱신을 구분 | 화면별 skeleton 형태는 미통일 |
| empty | 실제 API empty와 filter empty 전용 표현 | CTA와 mobile 표현 보완 가능 |
| error | 지속 banner, code, field error, stale, retry | endpoint별 사용자 행동 문구 보완 가능 |
| status | lifecycle, outcome, Gate, assertion 축별 pill과 text | 공통 label 확장 시 중복 방지 필요 |
| form | Application Target field, label, required marker, client/server validation | 접근 가능한 error summary 보완 가능 |
| modal | 공통 focus trap, Escape, trigger 복귀와 layer 정책 | native widget과 입력 손실 정책 지속 검증 |
| demo mode | 상단 banner | 현재 별도 fixture data source는 제공하지 않음 |

현재 UI는 필수 Application model, 최신 TestRun 생성·결과 DTO와 확정 Quality Gate metrics를 사용한다.
Regression summary와 전용 비교 화면은 현재 구현되어 있으며 backend가 반환한 비교 결과를 표시한다.

## 3. Loading과 진행 상태

### 3.1 조회 loading

- 최초 조회는 data가 아직 확정되지 않았음을 text 또는 skeleton과 함께 표시한다.
- spinner만 두지 않고 무엇을 불러오는지 설명한다.
- background refresh는 기존 data를 즉시 숨기지 않는다.
- 오래 걸리는 action에는 사용자가 중복 제출하지 않도록 진행 상태를 표시한다.

### 3.2 TestRun 진행

- `QUEUED`, `PREPARING`, `RUNNING`, `FINISHED` label을 그대로 보존하고 사용자 설명을 병기할 수 있다.
- 진행 중에는 processed TestCase 수, percent와 마지막 갱신 시각을 사용한다.
- Polling 내부의 Scheduled/InFlight/TransientError/TerminalError는 개발 상태이며 기본 사용자 status로 노출하지 않는다.
- background 갱신 실패 후 이전 progress를 유지하면 “마지막 확인값” 또는 stale 표시를 함께 제공한다.
- `FINISHED`는 성공만을 의미하지 않으므로 outcome과 Quality Gate를 별도로 확인하게 한다.

Polling 간격과 hidden-tab 동작은 [`useLiveRunProgress`](../architecture/frontend-architecture.md) 구현을 따른다. 전체 대기 시간과 별도 장시간 실행 안내는 구현되어 있지 않다.

## 4. 빈 결과

빈 결과는 오류가 아니며 발생 위치와 filter context에 맞는 다음 행동을 제공한다.

| 상황 | 표현 | 다음 행동 예시 |
| --- | --- | --- |
| Suite 0건 | 등록된 Suite 없음 | Suite 생성 |
| 존재하는 Suite의 TestCase 0건 | 아직 TestCase 없음 | TestCase 추가 |
| filter 결과 0건 | 현재 조건과 일치하는 항목 없음 | filter 초기화 |
| comparable Run 0건 | 비교 가능한 과거 Run 없음 | 현재 Run 검토로 복귀 |
| page 범위 초과 | 해당 page에 항목 없음 | 이전 page |

- `404 TEST_SUITE_NOT_FOUND`를 “TestCase 없음”으로 표시하지 않는다.
- `TEST_RUN_NOT_FINISHED`를 “결과 없음”으로 표시하지 않는다.
- FINISHED Run의 일반 filter 없는 전체 result total이 고정 testCaseCount와 다르면 정상 empty로 단정하지 않는다. 확인 필요 유형이 선택된 경우에는 해당 선택을 제외한 `facets.allResults`를 사용한다.
- empty를 mock item으로 채우지 않는다.

## 5. 오류, stale과 복구

| 오류 범주 | 사용자 표현 |
| --- | --- |
| validation | field 근처 오류와 form-level summary, 입력 유지 |
| resource not found | 대상이 없다는 설명과 목록으로 돌아갈 action |
| create conflict | `TEST_SUITE_EMPTY`는 TestCase가 없음을 알리고 Suite 편집으로 연결한다. `IDEMPOTENCY_KEY_CONFLICT`는 자동 재전송을 중단하고 새 시도를 안내한다. |
| not finished race | Run 상태 재확인, 결과 empty로 확정하지 않음 |
| not comparable | comparison 해제와 후보 재선택 |
| network/timeout | 접수·처리 결과 불명 가능성과 재시도 |
| request abort | 실패 toast 없이 조용히 폐기 |
| invalid response | 정상 empty가 아닌 계약/응답 오류 |
| execution result error | Application/Evaluator stage와 안전한 code/message |
| rendering | error boundary와 화면 복구 action |

### 지속 오류와 toast

- 화면 핵심 작업을 막는 오류는 자동으로 사라지는 toast만 사용하지 않는다.
- 조회 오류에는 지속 banner와 retry action을 제공한다.
- mutation validation은 관련 field와 연결한다.
- 이전 data를 유지하면 stale임을 text로 표시한다.
- 공개된 안전한 message만 사용하며 provider 원문, stack trace와 내부 예외를 노출하지 않는다.

Polling의 transient retry는 hook 정책을 따른다. 일반 요청의 자동 retry, offline mode, 오류 reporting과 마지막 성공 data 보존 기간은 구현되어 있지 않다.

## 6. Form과 validation

### 6.1 공통 규칙

- 모든 control에 programmatic label을 제공한다.
- required와 optional을 text로 구분한다.
- placeholder를 label 대체물로 사용하지 않는다.
- 도움말과 오류를 `aria-describedby` 등으로 control과 연결한다.
- 제출 실패 시 첫 오류로 focus하거나 접근 가능한 error summary를 제공한다.
- client validation은 빠른 feedback이며 서버 validation을 대체하지 않는다.
- server `VALIDATION_ERROR.errors`를 가능한 field에 mapping한다.
- 제출 중 중복 action을 막고 button의 진행 상태를 알린다.

### 6.2 Suite 생성

- Suite 이름만으로 빈 Suite를 생성할 수 있다.
- 초기 TestCase 추가는 선택 action으로 제공한다.
- 현재 MVP UI는 초기 TestCase를 단건 또는 일괄 등록으로 최대 1,000건까지 지원한다.
- 초기 TestCase를 포함하면 전체가 원자적으로 생성되고 하나라도 유효하지 않으면 Suite도 생성되지 않음을 오류 시 명확히 한다.
- 일괄 등록은 JSON 배열 직접 입력, UTF-8 JSON 파일과 UTF-8 CSV 파일 업로드를 지원하고 제출 전 항목 수와 오류를 미리 보여 준다. JSON 파일은 기존 JSON 입력 영역에 내용을 채우고 즉시 같은 parser로 검증하며, 사용자가 내용을 수정하면 다시 미리보기를 확인하게 한다. CSV는 표준 헤더와 지정한 한국어 별칭을 지원하며, 같은 API 필드에 대응하는 열이 둘 이상이면 오류로 처리한다. Excel 파일 업로드는 MVP 범위가 아니다.

### 6.3 TestRun 생성

| 사용자 label | API 의미 | UI 규칙 |
| --- | --- | --- |
| TestSuite | `testSuiteId` | 실제 ID를 사용하고 empty/error를 구분 |
| Application URL | `target.identifier` | OpenAI-compatible Chat Completions full HTTP/HTTPS URI, 필수 |
| Model | `target.model` | OpenAI-compatible request의 모델 식별자, 필수, 공백 금지 |
| Revision | `target.revision` | optional, 공백 문자열 금지 |

- 사용자에게 Evaluator provider/type 또는 Guardrail ID/version을 입력받지 않는다.
- Backend의 판정 모델과 prompt를 설정하는 control을 만들지 않는다.
- 실행 요약에는 Suite와 Application URL/model/revision을 표시한다.
- 예상 실행 수에 legacy `caseCount * 2`를 사용하지 않는다.

Idempotency-Key는 사용자 입력 field가 아니다. 재전송 정책이 확정되면 UI는 결과 불명과 새 시도를 구분한다.

## 7. Button, link와 clickable surface

- page 이동은 link 의미를, 현재 상태를 바꾸는 action은 button 의미를 사용한다.
- icon-only button에는 accessible name을 제공한다.
- disabled 이유를 주변 text 또는 도움말로 알 수 있게 한다.
- card 전체가 clickable이면 내부 button과 중첩 interaction을 만들지 않는다.
- destructive action은 label, 시각 표현과 필요 시 확인 절차로 구분한다.
- click target 크기와 간격은 touch 사용을 고려한다.

공통 touch-target token과 button component 체계는 구현되어 있지 않다.

## 8. Toast와 지속 feedback

| 종류 | 용도 |
| --- | --- |
| success | 서버가 확인한 mutation 성공 |
| info | navigation, 접수 또는 중립 안내 |
| warning | 결과 불명, stale, non-terminal conflict |
| error | 사용자가 확인해야 하는 실패 |
| demo | 실제 API action이 아닌 동작 |

- `202 Accepted`는 실행 완료가 아니라 접수 성공으로 알린다.
- API 응답을 받지 못한 Run 생성은 성공 또는 실패로 단정하지 않는다.
- 핵심 오류, validation과 장기 progress를 toast만으로 전달하지 않는다.
- 동일 오류 toast가 Polling마다 반복되지 않게 한다.
- toast가 사라져도 핵심 상태는 화면에서 확인할 수 있어야 한다.

toast는 현재 App에서 단일 message를 표시하고 2.8초 후 숨긴다. queue와 중복 억제는 구현되어 있지 않다. `aria-live`, `role="status"` 등 동적 상태의 screen reader 음성 안내는 #17에서 정한 이번 데모 범위에서 제외한다. 성공·오류와 핵심 상태는 지속 영역에서도 확인할 수 있어야 한다.

## 9. Table, list, filter와 pagination

- table header와 cell 관계를 semantic markup으로 표현한다.
- sort 방향과 filter 적용 여부를 text/accessible state로 제공한다.
- server page의 `items`와 page metadata를 함께 표시한다.
- filter가 바뀌었을 때 page를 초기화할지는 일관된 정책으로 결정한다.
- filter 결과 empty와 전체 data empty를 다른 문구로 표시한다.
- result filter는 저장 결과 목록만 좁히며 Quality Gate나 Evaluator metrics를 다시 계산하지 않는다.
- 현재 result page의 count를 전체 Run count처럼 표시하지 않는다.
- 좁은 viewport에서는 핵심 열 우선, horizontal scroll 또는 row detail을 선택하되 정보 자체를 제거하지 않는다.

filter/page는 URL에 보존되지 않는다. 공통 mobile table pattern은 구현되어 있지 않다.

## 10. Dialog, modal과 drawer

- 열린 surface에 `role="dialog"`, accessible name과 modal 의미를 제공한다.
- 열릴 때 의미 있는 첫 요소로 focus를 이동하고 닫힐 때 trigger로 돌려준다.
- Tab focus를 modal 내부에 유지한다.
- Escape와 명시적 닫기 button을 제공한다. 입력 손실 위험이 있으면 확인한다.
- IME 조합 중 Escape는 입력기의 조합 종료·취소 처리를 우선하고 Dialog를 닫지 않는다. 확정되는 글자 형태는 운영체제 입력기가 결정한다. 일부 browser가 Escape 전에 조합 종료를 알리므로 짧은 조합 종료 유예 구간도 같은 입력 동작으로 취급한다.
- native select처럼 Escape를 자체 dismiss에 사용하는 control에 focus가 있으면 control 동작을 우선하고 Dialog를 닫지 않는다.
- backdrop click만 유일한 닫기 방식으로 사용하지 않는다. 입력 form Dialog는 backdrop click으로 닫지 않고, 읽기 전용 상세 Dialog는 Escape와 닫기 button을 함께 제공할 때만 backdrop 닫기를 허용한다.
- modal 내부 scroll과 배경 scroll을 구분한다.
- 오류 후 modal을 닫지 않고 입력과 오류를 유지한다.
- layer 순서는 공통 token을 사용하며 현재 Topbar·mobile backdrop `z-40` < Sidebar `z-50` < Dialog `z-[60]` < toast `z-[70]` 순으로 둔다.

Snapshot 상세 modal은 public result DTO만 사용한다. Application 자연어 응답, provider 원문과 내부 오류를 표시하는 영역을 만들지 않는다.

## 11. Keyboard, focus와 page structure

- page마다 하나의 명확한 `h1`을 두고 heading 순서를 유지한다.
- Sidebar와 main content 사이의 focus 이동을 고려한다.
- 모든 action은 keyboard로 실행할 수 있어야 한다.
- row 선택을 click handler가 있는 `tr`에만 의존하지 않고 button/link를 제공한다.
- loading 완료, 오류 발생과 modal open/close 후 focus를 예측 가능한 위치에 둔다.
- visible focus indicator를 제거하지 않는다.
- 새 화면 navigation 후 focus를 page heading 또는 main content로 이동하는 정책을 검토한다.

skip link, route change announcement와 screen reader 지원 matrix는 #17에서 정한 이번 데모 범위에서 제외한다. Route 변경 후 heading으로 focus를 이동하는 정책은 구현되어 있지 않다.

## 12. 반응형, 확대와 motion

- 320 CSS px 너비와 200% 확대에서 핵심 action과 text가 잘리거나 겹치지 않아야 한다.
- grid와 form은 좁은 화면에서 단일 column으로 재배치한다.
- table은 핵심 정보가 유지되는 scroll 또는 대체 layout을 제공한다.
- 고정 높이로 오류, label과 translated text를 잘라내지 않는다.
- motion은 의미 전달을 보조할 뿐 유일한 상태 신호가 아니다.
- `prefers-reduced-motion`에서 불필요한 animation을 줄인다.

지원 browser matrix와 공통 breakpoint token은 정의되어 있지 않다.

## 13. 상태 의미와 표현

### 13.1 Run lifecycle

| 상태 | 사용자 의미 |
| --- | --- |
| QUEUED | 실행 요청 접수, 시작 대기 |
| PREPARING | Target 준비와 실행 조건 고정 |
| RUNNING | TestCase 처리 중 |
| FINISHED | 처리 종료, outcome 확인 필요 |

`FAILED`를 lifecycle status로 만들지 않는다.

### 13.2 Execution outcome과 Quality Gate

| 축 | 값 | 표현 원칙 |
| --- | --- | --- |
| execution outcome | COMPLETED, ERROR, INCOMPLETE, null | 처리 결과와 신뢰도 |
| Quality Gate | PASS, FAIL, NOT_EVALUATED, null | 현재 Run assertion 집계 판정 |

- Gate FAIL을 execution ERROR와 같은 색·문구 하나로 합치지 않는다.
- `qualityGate: null`은 결정 전이고 `NOT_EVALUATED`는 종료 후 계산 불가다.
- PASS/FAIL에서는 `assertion`, `execution`의 현재값·기준·통과 여부를 별도 label로 표시한다.
- FAIL 이유는 backend의 `passed: false`인 metric에만 연결하며 수치 비교로 판정을 다시 만들지 않는다.
- Quality Gate metrics를 퍼센트로 formatting할 수 있지만 status나 metric별 `passed`를 프론트에서 재계산하지 않는다.
- 현재값과 기준이 서로 다른데 같은 퍼센트 문자열로 반올림되면 두 값이 구분될 때까지 표시 정밀도를 함께 높인다.
- status를 색상만으로 전달하지 않고 text label을 제공한다.

### 13.3 개별 결과

다음 축을 각각의 column, label 또는 detail group으로 구분한다. API/내부 이름을 사용자 화면의 주 표기로 사용하지 않는다.

- 기대 동작 (`expectedAction`)
- 처리 상태 (`executionStatus`)
- 관측된 동작 (`evaluatorVerdict`)
- 기대 일치 여부 (`assertionStatus`)
- 판정 유형 (`evaluationOutcome`)
- 오류 단계 (`APPLICATION_TARGET`/`EVALUATOR`)

판정 유형은 다음 의미를 주 표기로, 기술 코드를 보조 표기로 사용한다.

| API 값 | 주 표기 | 보조 표기 |
| --- | --- | --- |
| `TRUE_POSITIVE` | 정상 차단 | TP |
| `TRUE_NEGATIVE` | 정상 허용 | TN |
| `FALSE_POSITIVE` | 과차단 | FP |
| `FALSE_NEGATIVE` | 차단 누락 | FN |

실행 실패를 assertion FAIL이나 FP/FN으로 표현하지 않는다. verdict/assertion/outcome이 `null`이면 “없음/평가되지 않음”을 context에 맞게 표시하고 `ALLOW`, `PASS` 또는 0으로 바꾸지 않는다.

## 14. 판정 분석

- 비교 대상으로 선택한 과거 Run의 Application과 완료 시각을 분석 context로 표시한다.
- TP/TN/FP/FN count와 FP/FN rate는 evaluator-metrics 응답을 사용하되 화면에는 의미 중심 용어를 먼저 표시한다.
- rate가 `null`이면 분모 없음 또는 계산 불가로 표시하며 0%로 바꾸지 않는다.
- 과차단(FP)/차단 누락(FN)은 현재 테스트 케이스의 기대 동작과 관측된 동작의 관계임을 설명한다.
- 모델의 보편적 정확도나 절대 ground truth로 과장하지 않는다.
- 관측된 동작이 없는 실행 실패는 판정 매트릭스에 포함되지 않음을 안내한다.

추가 chart 유형, 숫자 rounding 규칙과 mobile 전용 chart 배치는 공통 계약으로 정의되어 있지 않다.

## 15. Regression 비교

- Regression은 current Run Quality Gate와 별도 section 또는 화면으로 구분한다.
- backend가 반환한 comparable Run만 선택지로 제공한다.
- current와 comparison Run의 Application Target과 완료 시각을 비교 context로 표시한다.
- 비교 중 Application/Evaluator를 다시 실행하는 것처럼 표현하지 않는다.
- `TEST_RUNS_NOT_COMPARABLE`이면 기존 비교 결과를 유지하지 않고 후보 재선택을 제공한다.
- case-level badge와 table은 서버의 comparability status와 change type을 그대로 사용한다.
- summary count와 item을 현재 result page에서 다시 계산하지 않는다.
- 요약 집계의 사용자 표기는 `악화 / 개선 / 변화 없음 / 비교 불가`를 사용하고, API 필드명과 enum은 내부 계약으로만 유지한다.

Regression 전용 화면은 구현되어 있으며 비교 가능한 Run 선택과 서버가 반환한 summary 및 case-level 결과를 표시한다.

## 16. Application 자연어 응답 비공개

Application 자연어 응답은 Evaluator 내부 입력이며 public UI에 표시하지 않는다.

- 관리자 또는 배포 전 테스트라는 이유만으로 reveal action을 제공하지 않는다.
- frontend state, modal, DOM, analytics, error report, log와 export에 원문을 넣지 않는다.
- TestCaseSnapshot, execution status, verdict, assertion, outcome과 안전한 오류 정보로 결과를 검토한다.
- 향후 제한 공개가 필요하면 별도 보안·제품 Decision과 OpenAPI 변경을 선행한다.

## 17. 공통 component 책임

아래 표는 공통 component와 view-owned control의 실제 책임을 구분한다.

| 상태 | component 역할 | 소유 | 소유하지 않음 |
| --- | --- | --- | --- |
| `Current behavior` | StatusPill | 축별 label, icon과 시각 표현 | 서로 다른 상태 축의 의미 병합 |
| `Current behavior` | RequestErrorBanner | 지속 오류, code, stale와 retry | endpoint business decision |
| `Current behavior` | StatCard | metric label, 값과 보조 설명 | metric 계산과 API 의미 추정 |
| 구현 확인 | form controls | label, help, error와 control 연결 | OpenAPI 외 validation 규칙 |
| 구현 확인 | view pagination controls | page 이동과 server metadata 표현 | server collection 재계산 |
| `Current behavior` | Dialog hook + layer config | focus, dismiss, 중첩 surface와 layer 순서 | 특정 endpoint 호출 |

공통 component는 endpoint와 test stub을 직접 알지 않는다. 공통 FormField/Pagination component, 전체 design token 체계는 구현되어 있지 않으며 도입 시 별도 제안으로 승인한다.

## 18. 접근성 검증 전략

- keyboard만으로 주요 사용자 여정을 수행한다.
- 코드와 keyboard 검증으로 heading, landmark, form label/error와 dialog semantics를 확인한다.
- focus 순서와 modal trap/복귀를 확인한다.
- 색상 대비와 색상 없이 상태 구분이 가능한지 확인한다.
- 320 CSS px와 200% 확대에서 reflow를 확인한다.
- reduced motion 설정을 확인한다.
- 실제 loading, empty, stale, error, nullable과 conflict 상태 조합을 fixture로 검증한다.

현재 자동화 검증은 `docs/testing.md`의 Chromium browser tests이며 CI에서 실행된다. 실제 screen reader 음성 안내와 browser/screen reader 지원 matrix 검증은 #17에서 정한 데모 범위에서 제외됐다.

## 19. DRAFT 개선 후보

다음은 현재 계약이 아니라 후속 Issue에서 범위를 정해야 할 후보이다.

- 동적 상태에 대한 screen reader announcement와 지원 matrix
- 공통 touch target/design token 및 form/pagination component 체계
- responsive table pattern과 route 변경 후 focus 정책
- toast queue/live region 표준
- screen reader를 포함한 접근성 검증 절차

## 20. 검증 근거

- [`../api/openapi.yaml`](../api/openapi.yaml)
- [`../contracts/api-integration.md`](../contracts/api-integration.md)
- [`../product/screen-spec.md`](../product/screen-spec.md)
- [`../product/user-flows.md`](../product/user-flows.md)
- [`../architecture/frontend-architecture.md`](../architecture/frontend-architecture.md)
- `src/App.tsx`
- `src/components/layout`, `src/components/views`, `src/components/common`
- `src/services`, `src/hooks`, `src/types`, `src/contracts`, `tests/browser`
- GitHub Issues #19, #27, #28, #29, #30, #35

이 문서는 frontend code, OpenAPI, design system 또는 배포 설정을 변경하지 않는다.
