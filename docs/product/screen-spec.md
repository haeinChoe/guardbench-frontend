# 프론트엔드 화면 및 기능 명세

> Status: APPROVED
> Owner: Frontend
> Last reviewed: 2026-09-25
> Canonical source: GitHub repository (`src/routing/`, `src/components/views/`)
> Scope: GitHub Issues #33, #62, #72, #86
> Canonical API: [`../api/openapi.yaml`](../api/openapi.yaml) (`APPROVED`)
> API consumption contract: [`../contracts/api-integration.md`](../contracts/api-integration.md)

이 문서는 현재 구현에서 확인한 화면 동작을 승인 기준으로 기록한다. 미구현 화면이나 정책 제안은 `DRAFT`로 표시하며 구현 계약으로 사용하지 않는다. API schema를 다시 정의하지 않으며 endpoint와 schema의 의미는 Backend OpenAPI 및 API 연동 계약을 따른다.

## 1. 읽는 방법

| 표기 | 의미 |
| --- | --- |
| `Current behavior` | 현재 source에서 확인한 구현 동작 |
| `DRAFT` | 아직 구현되거나 승인되지 않은 화면·정책 제안 |
| `Decision needed` | 별도 Issue 또는 ADR에서 결정해야 하는 정책 |
| `데모` | 실제 API나 영속 상태가 아닌 정적 표현 |

현재 구현과 Backend OpenAPI가 다르면 차이를 기록하고 Backend 계약을 Frontend에서 재정의하지 않는다. 실제 API 성공, 빈 결과, 오류와 demo/mock을 서로 구분한다.

## 2. 공통 셸과 navigation

### 화면 목록

| 화면 | View | 현재 진입 방식 | 화면 역할 |
| --- | --- | --- | --- |
| 대시보드 | `DashboardView` | Sidebar / logo | TestSuite·TestRun 목록 응답을 이용한 현재 요약 |
| 테스트 스위트 | `SuitesView` | Sidebar | Suite와 TestCase 관리 |
| 새 테스트 실행 | `NewRunView` | Sidebar / 다시 실행 | TestSuite + Application Target 제출 |
| 실행 이력 | `RunsView` | Sidebar | Run lifecycle/outcome/Gate 조회와 상세 진입 |
| 결과 상세 | `ResultDetailView` + `RegressionSummaryEntry` | Run 행 / 생성 완료 | 현재 Run 결과를 이해하고 Regression 상세로 진입 |
| Regression 상세 | `RegressionDetailView` | Result Detail의 `회귀 상세 보기` | comparable Run 선택과 Regression 변화 상세 분석 |

현재 `App`은 browser History API와 pathname 기반 route로 화면 및 선택 Run을 관리한다. 알려지지 않은 경로는 Dashboard로 해석한다. 유효하지 않은 Run ID는 전용 오류 화면으로 표시한다. (`Current behavior`)

Regression Detail은 `/runs/{runId}/regression` 경로를 사용하며 별도 routing library는 도입하지 않는다. filter/page 상태는 URL에 보존하지 않는다. 실제 Run ID를 사용하고 Run 변경·화면 이탈 시 이전 요청과 Polling을 정리한다. (`Current behavior`)

## 3. 공통 화면 상태

API를 소비하는 화면은 다음 상태를 구분한다.

| 상태 | 표현 원칙 |
| --- | --- |
| initial/loading | 아직 실제 data가 확정되지 않았음을 표시한다. |
| success with data | 서버가 반환한 data와 page metadata를 표시한다. |
| success with empty | 실제 빈 결과로 표시하며 mock으로 대체하지 않는다. |
| error without data | 지속되는 오류 설명과 가능한 재시도 action을 제공한다. |
| refresh error with prior data | 이전 data를 유지할 경우 stale/갱신 실패를 함께 표시한다. |
| demo/mock | 실제 API 결과가 아니라는 출처를 명시한다. |

Toast는 일시적 action 결과에 사용할 수 있지만 조회 실패, validation detail과 복구가 필요한 오류를 toast만으로 숨기지 않는다.

## 4. 대시보드

### 목적

GuardBench의 핵심 개념과 최근 활동 형태를 시각적으로 소개한다.

### 현재 동작 (`Current behavior`)

- TestSuite와 TestRun 목록 API의 page metadata와 items로 통계, 최근 활동과 Quality Gate 분포를 표시한다.
- 대시보드 전용 집계 endpoint는 호출하지 않으며, 조회 범위 기반 수치를 전체 집계처럼 표현하지 않는다.
- 최초 loading, 최초 오류, 성공 후 실제 empty와 이전 data를 유지한 갱신 오류를 구분한다.
- 일부 card와 action은 다른 local view로 이동한다.

### 목표 경계 (`DRAFT`)

- OpenAPI에는 대시보드 전용 집계 endpoint가 없다.
- 목록 API의 조회 범위를 실제 전체 집계나 Regression 결과처럼 표현하지 않는다.
- demo 화면으로 유지하면 명시적인 demo 표식을 제공한다.

전용 Dashboard aggregate endpoint나 전체 기간 통계는 현재 구현되어 있지 않다. 추가 집계가 필요하면 Backend 계약을 먼저 승인한다.

## 5. 테스트 스위트와 TestCase 관리

### 목적

TestSuite 목록을 확인하고 Run에서 사용할 TestCase를 관리한다.

### 현재 동작 (`Current behavior`)

- Suite 목록은 `GET /api/v1/test-suites`를 사용한다.
- API 성공의 실제 빈 결과와 오류를 구분하며 silent mock fallback을 사용하지 않는다.
- Suite 생성 modal은 `POST /api/v1/test-suites`를 사용하고 서버가 반환한 ID를 반영한다.
- Suite 선택 시 TestCase 관리 modal에서 `GET /api/v1/test-suites/{suiteId}/test-cases`를 사용한다.
- TestCase 단건 생성은 POST, 수정은 PATCH, 삭제는 DELETE를 사용한다. mutation 실패를 성공으로 확정하지 않는다.
- 기존 Suite의 일괄 등록은 `POST /api/v1/test-suites/{suiteId}/test-cases/bulk`를 사용하며 JSON·CSV 입력, 제출 전 미리보기와 행별 수정을 제공한다.
- TestCase 단건 생성·삭제와 일괄 등록이 성공하면 Suite 카드 개수를 즉시 반영하고 Suite 목록을 재조회해 서버 수치로 재검증한다. 재조회 실패 시 반영된 데이터를 유지하며 오류와 재시도를 제공한다.
- server pagination은 화면 control에 연결되어 있으며 filter 연결은 아직 제공하지 않는다.
- TestCase 페이지네이션은 좁은 화면에서 첫 줄 전체 폭을 사용하며 `이전`과 `다음`을 가로쓰기로 유지한다. 페이지가 많아 가용 폭을 넘으면 페이지네이션 영역 안에서 가로로 탐색할 수 있다.

### 목표 동작 (`DRAFT`)

| 사용자 action | Endpoint | 화면 책임 |
| --- | --- | --- |
| Suite 목록 | `GET /api/v1/test-suites` | data/empty/error/page를 구분한다. |
| Suite 생성 | `POST /api/v1/test-suites` | validation detail을 관련 field에 표시한다. |
| Suite 상세·수정 | `GET/PATCH /api/v1/test-suites/{suiteId}` | API에 없는 상태·pass rate를 만들지 않는다. |
| TestCase 목록·생성 | `GET/POST /api/v1/test-suites/{suiteId}/test-cases` | `404 TEST_SUITE_NOT_FOUND`와, 존재하는 Suite가 `200`으로 반환한 빈 `items`를 구분한다. |
| 기존 Suite TestCase 일괄 등록 | `POST /api/v1/test-suites/{suiteId}/test-cases/bulk` | 최대 1,000개를 미리 검증·수정하고 필수 `Idempotency-Key`로 원자적 요청을 재시도한다. 성공 후 목록과 전체 개수를 다시 조회한다. |
| TestCase 상세·수정·삭제 | `GET/PATCH/DELETE /api/v1/test-cases/{testCaseId}` | `204` 성공 후 삭제를 확정하고 과거 Snapshot은 영향받지 않음을 안내한다. |

Suite 생성은 두 형태를 모두 허용한다.

- `testCases`를 생략하거나 `null`, 빈 배열로 보내 빈 Suite를 먼저 생성한다.
- 최대 1,000개의 초기 TestCase를 함께 보내 Suite와 하나의 트랜잭션에서 원자적으로 생성한다. 초기 TestCase 하나라도 유효하지 않으면 Suite를 포함한 전체 요청이 실패한다.

현재 MVP 화면은 이름만 입력하면 빈 Suite를 생성하고, 사용자가 초기 TestCase 추가를 선택하면 단건 입력 또는 JSON 배열 직접 입력·UTF-8 JSON 파일·UTF-8 CSV 파일 업로드로 최대 1,000건을 같은 생성 요청에 포함한다. JSON 파일은 선택 즉시 기존 JSON 입력과 같은 검증·미리보기를 적용한다. 어떤 입력 방식을 사용해도 생성 후에는 동일한 TestCase 관리 화면을 사용한다.

기존 Suite의 일괄 등록도 JSON 배열 직접 입력·UTF-8 JSON 파일·UTF-8 CSV 파일을 지원한다. 가져온 정상 항목은 미리보기에서 각 필드를 수정할 수 있고, client 및 server validation 오류를 항목별로 표시한다. 전체 요청은 부분 성공 없이 원자적으로 처리하며, 결과를 알 수 없는 동일 payload 재시도에는 같은 `Idempotency-Key`를 유지하고 항목이 바뀌면 새 key를 사용한다.

TestCase 목록은 server pagination을 사용하고 UI filter는 제공하지 않는다. Mutation 성공 후 목록 갱신 정책은 현재 Suite/TestCase view 구현을 따른다. 다른 확인 흐름 변경은 별도 Issue에서 승인한다.

## 6. 새 테스트 실행

### 목적

사용자가 TestSuite와 테스트할 AI Application을 선택해 비동기 TestRun을 접수한다.

```text
TestSuite
+ OpenAI-compatible HTTP endpoint / required model / optional revision
+ optional Quality Gate thresholds
→ POST /api/v1/test-runs
→ 202 Accepted
→ Run 상세 조회
```

### 현재 동작 (`Current behavior`)

- Suite 목록은 실제 API에서 조회한다.
- OpenAI-compatible full endpoint, 필수 model과 선택 revision을 입력받는다.
- 기대 일치율과 실행 성공률의 최소 기준을 퍼센트로 입력받는다. 두 값을 모두 비우면 정책을 생략해 서버 기본 기준을 사용한다.
- `testRunService`는 `testSuiteId`, 단일 `target`과 선택적인 `qualityGatePolicy`를 전송한다.
- 동일 payload의 결과 불명 재시도에는 같은 Idempotency-Key를 유지한다.

### 현재 form 계약 (`Current behavior`)

| 영역 | 입력 | 상태와 validation |
| --- | --- | --- |
| TestSuite | 실제 Suite ID | loading, empty, 조회 오류와 선택 상태 |
| Application | HTTP/HTTPS URL | 필수, URL parsing과 HTTP/HTTPS protocol 검사 |
| Application model | Chat Completions request의 모델 식별자 | 필수, 공백 문자열 금지 |
| Application revision | 배포·모델·commit 식별 문자열 | 선택, 공백 문자열 금지 |
| 기대 일치율 최소 기준 | 이 Run에서 기대 동작과 일치해야 하는 최소 비율 | 선택, 설정 시 0~100% 숫자 |
| 실행 성공률 최소 기준 | 이 Run에서 정상 실행돼야 하는 최소 비율 | 선택, 설정 시 0~100% 숫자 |

- 사용자에게 Evaluator provider/type 또는 Guardrail ID/version을 입력받지 않는다.
- Backend의 판정 모델과 prompt를 설정하는 입력을 만들지 않는다.
- 예상 실행 수는 활성 TestCaseSnapshot당 단일 Application 처리 기준이며 기존 `caseCount * 2`를 사용하지 않는다.
- Quality Gate 기준은 둘 다 입력하거나 둘 다 생략한다. 입력한 퍼센트는 API의 0~1 비율로 변환한다.
- 화면 요약에는 Suite, Application URL/model/revision과 Quality Gate 기준 또는 서버 기본 기준 사용 여부를 표시한다.
- Quality Gate 기준을 작성하는 중에는 중립적인 “기준 입력 중”으로 표시하고, 제출 후 validation이 확정된 경우에만 “입력 확인 필요”로 표시한다. 유효한 값은 숫자를 정규화해 요약한다.
- 한 논리적 제출 payload에는 같은 `Idempotency-Key`를 사용하고 payload가 바뀌면 새 key를 사용한다.

### 생성 결과와 오류 (`Current behavior`)

- `202 Accepted`는 실행 완료가 아니라 접수 성공이다.
- 응답의 Run ID, status, testCaseCount, target과 createdAt을 보존한다.
- 접수 후 즉시 Run 상세 화면 또는 진행 확인 흐름으로 이동한다.
- `TEST_SUITE_EMPTY`, `IDEMPOTENCY_KEY_CONFLICT`, validation과 network 결과 불명을 구분한다.

생성 후 Result Detail로 이동한다. network 결과 불명에서는 동일 payload/key를 유지한다. 화면 이탈 후 key 복원과 장기 보존은 구현되어 있지 않다.

## 7. 실행 이력

### 목적

TestRun의 진행 단계, 처리 결과와 Quality Gate를 독립적으로 확인하고 상세로 이동한다.

### 현재 동작 (`Current behavior`)

- `GET /api/v1/test-runs`를 호출하고 API data, 빈 결과와 오류를 구분한다.
- lifecycle status, execution outcome, Quality Gate status와 progress를 표시한다.
- 화면 filter는 제한적이며 OpenAPI의 전체 filter/sort/page와 연결되지 않았다.
- 자동 갱신이나 진행 Run Polling은 목록에 연결되지 않았다.

### 목록 데이터 원칙 (`Current behavior`)

각 행은 다음 축을 혼합하지 않고 표시한다.

- lifecycle: `QUEUED`, `PREPARING`, `RUNNING`, `FINISHED`
- outcome: `COMPLETED`, `ERROR`, `INCOMPLETE` 또는 계약상 nullable `null`
- Quality Gate: `PASS`, `FAIL`, `NOT_EVALUATED` 또는 계약상 nullable `null`
- progress: processed TestCase 수와 percent
- TestSuite ID와 실행 시각

서버가 목록 응답에 제공하지 않는 Suite 이름, target revision 또는 상세 metrics를 목록 값처럼 만들지 않는다. 현재 `RunsView`는 ID/Suite ID 검색과 lifecycle filter를 제공하며 목록 자체를 자동 polling하지 않는다. 추가 server filter, URL query 보존은 구현되어 있지 않다.

## 8. Run 결과 상세

### 목적

현재 Run 자체의 Application 실행 상태, 관측된 동작, 기대 일치 여부와 Quality Gate를 이해한다. Regression은 이 화면의 기본 판정에 섞지 않고 **요약/진입점만 제공**하며, 상세 비교는 별도 Regression Detail에서 수행한다.

### 현재 동작 (`Current behavior`)

- `ResultDetailView`가 Run 상세와 결과 endpoint를 호출한다.
- 단일 Application 실행, 관측된 동작, 기대 일치 여부와 판정 유형을 표시한다.
- 결과 page metadata와 server filter를 사용하고 판정 집계는 evaluator-metrics에서 별도로 조회한다.
- Quality Gate 상태와 확인 필요 건수를 첫 요약에서 의미 중심으로 표시하고, 확정된 두 metrics를 서버 값 그대로 유지한다.
- 결과 목록은 판정 의미를 먼저 표시하고 기대 동작, 관측된 동작, 기대 일치 여부, 판정 유형은 상세 dialog에서 각각 제공한다.
- TP/TN/FP/FN 집계는 기대 동작과 관측된 동작을 축으로 하는 2×2 매트릭스로 표시한다.
- `RegressionSummaryEntry`가 선택된 historical Run과의 악화/개선/변화 없음/비교 불가 집계를 상단에 표시하고 `회귀 상세 보기` action을 제공한다.
- Result Detail에서는 전체 Regression case table을 렌더링하지 않는다.
- 다른 1차 화면으로 이동한 뒤 Sidebar의 결과 상세를 다시 선택하면 현재 세션에서 마지막으로 확인한 Run으로 복귀한다.
- Application 자연어 응답과 legacy 한 Run 내부 Baseline/Candidate diff를 표시하지 않는다.

### 8.1 Run 요약 (`Current behavior`)

- TestSuite ID
- 단일 Application Target type, identifier, required model과 optional revision
- lifecycle, progress, execution outcome
- Quality Gate status
- created/started/completed/updated 시각

`qualityGate: null`은 아직 결정 전이고 `NOT_EVALUATED + metrics: null`은 종료됐지만 기대 일치 여부를 판정할 수 있는 결과가 없는 상태다. PASS/FAIL에서는 `assertion`을 **기대 일치율**로, `execution`을 **실행 성공률**로 표시한다. 각 항목은 backend가 보존한 현재 비율(`value`), 판정 당시 최소 기준(`threshold`), 기준 충족 여부(`passed`)를 함께 보여준다. FAIL이면 기준 미달 항목마다 사용자가 이해할 수 있는 실패 이유를 표시하며, 프론트에서 Gate status나 `passed`를 다시 계산하지 않는다.

진행 중인 Run은 `QUEUED → PREPARING → RUNNING → FINISHED` 단계형 Stepper와 서버 progress를
표시한다. FINISHED Run은 Quality Gate 요약을 먼저 표시한 뒤 compact 완료 상태로 축소한다. 실행
lifecycle 완료는 Quality Gate PASS와 별개의 상태다.

상단 요약은 서버 판정 지표와 전체 Snapshot 수를 사용해 서로 배타적인 네 수치를 표시한다.

- 정상 판정: `TP + TN`
- 차단 누락: `FN`
- 과차단: `FP`
- 판정 미완료: `testCaseCount - (TP + TN + FP + FN)`

`판정 불일치`는 `FN + FP`, `확인 필요`는 `판정 불일치 + 판정 미완료`다. TP/TN/FP/FN 합계는
오판정도 포함하므로 “평가 성공”이 아니라 “평가 완료”라고 표현한다. Quality Gate PASS는 Attention
결과가 0건이라는 의미로 사용하지 않는다.

### 8.2 개별 결과 (`Current behavior`)

`GET /api/v1/test-runs/{testRunId}/results`의 paginated item을 다음 의미 중심 열로 표시한다.

| 열 | 의미 |
| --- | --- |
| TestCase | Snapshot name, category, ID |
| 테스트 위험도 | CRITICAL, HIGH, MEDIUM, LOW |
| 결과 | 정상 허용, 정상 차단, 과차단, 차단 누락 또는 판정 미완료와 판정 흐름 |
| 처리 상태 | `SUCCEEDED`, `FAILED`, `TIMED_OUT`, `NOT_STARTED`의 사용자용 표현 |
| 상세 | 입력, 기대 동작, 관측된 동작, 기대 일치 여부, 판정 유형과 안전한 오류 정보 dialog |

- 실행 실패를 assertion FAIL로 바꾸지 않는다.
- verdict가 없는 항목을 TP/TN/FP/FN으로 추정하지 않는다.
- API가 공개하지 않는 Application 자연어 응답은 조회·저장·표시하지 않는다.
- provider 원문, stack trace나 내부 오류를 표시하지 않는다.
- FINISHED 전 `TEST_RUN_NOT_FINISHED`는 빈 결과가 아니라 진행 상태 재확인으로 처리한다.

결과 filter는 저장된 전체 결과를 다시 계산하거나 Run 상태를 바꾸지 않고, 목록에서 조건에 맞는 item만 서버가 골라 반환하게 하는 query다.

| Filter | 의미 |
| --- | --- |
| name, input | 대소문자를 구분하지 않는 부분 일치 검색 |
| category | category 문자열 정확히 일치 |
| expectedAction | 기대 `ALLOW` 또는 `BLOCK` |
| severity | CRITICAL, HIGH, MEDIUM, LOW |
| executionStatus | SUCCEEDED, FAILED, TIMED_OUT, NOT_STARTED |
| assertionStatus | PASS 또는 FAIL |
| evaluationOutcome | TRUE_POSITIVE, TRUE_NEGATIVE, FALSE_POSITIVE, FALSE_NEGATIVE |

- 여러 filter를 함께 보낼 때의 결합 규칙은 결과 endpoint 설명에 명시적으로 확정되지 않았으므로 프론트에서 추측하지 않는다.
- filter 결과의 빈 `items`는 Run 전체 결과 없음이 아니라 현재 조건과 일치하는 항목 없음으로 표현한다.
- filter를 적용해도 Evaluator metrics와 Quality Gate를 현재 page에서 다시 계산하지 않는다. aggregate는 각각의 서버 응답을 source of truth로 사용한다.
- 확인 필요 유형이 선택된 조회에서는 해당 선택의 영향을 받지 않는 `facets.allResults`로 전체 결과 수를 확인한다. 일반 filter가 없을 때 이 수치와 고정 `testCaseCount`가 다르면 결과 데이터 불일치로 안내한다.
- page, size와 sort도 결과 endpoint에 함께 전달할 수 있다.

### 8.3 기대·관측 동작 매트릭스 (`Current behavior`)

`GET /api/v1/test-runs/{testRunId}/evaluator-metrics`를 사용해 서버가 집계한 TP/TN/FP/FN count와 FP/FN rate를 표시한다.

| 기대 동작 | 관측된 동작: 허용 | 관측된 동작: 차단 |
| --- | --- | --- |
| 허용해야 함 | 정상 허용 (TN) | 과차단 (FP) |
| 차단해야 함 | 차단 누락 (FN) | 정상 차단 (TP) |

한국어 의미를 주 표기로, TP/TN/FP/FN을 보조 표기로 사용한다. 매트릭스는 행·열 header와 caption을
가진 semantic table로 제공하고 색상 외 텍스트로도 결과를 구분한다.

- verdict 없는 실행 실패는 분류 집계에 포함하지 않는다.
- 테스트 케이스의 기대 동작과 응답에서 관측된 동작의 관계임을 설명한다.
- 일부 result page를 가지고 전체 metrics를 재계산하지 않는다.
- 일반적인 모델 성능이나 절대 ground truth로 과장하지 않는다.

Evaluator metrics API 값은 현재 Result Detail에서 Quality Gate와 구분된 기대·관측 동작 매트릭스로 표시한다. API/내부 계약의 TP/TN/FP/FN enum은 유지하되 화면에서는 각각 `정상 차단 / 정상 허용 / 과차단 / 차단 누락`을 주 표기로 사용한다.

### 8.4 Regression 요약/진입점 (`Current behavior`)

`RegressionSummaryEntry`는 Result Detail 상단의 보조 요약 컴포넌트다.

- Result Detail과 Regression Detail이 `useRegressionComparison`의 후보와 선택 baseline을 공유한다.
- Result Detail은 case-level `items`가 없는 summary endpoint만 선조회하고 전체 comparison은 Regression Detail 진입 시 조회한다.
- 선택된 baseline Run ID와 `regressedCount`, `improvedCount`, `unchangedCount`, `notComparableCount`를 backend 응답 그대로 사용하되, 화면에는 `악화 / 개선 / 변화 없음 / 비교 불가`로 표시한다.
- 첫 후보 자동 선택은 UI에 명시하며 Regression Detail에서 baseline을 바꿀 수 있다.
- 현재 Run이 아직 종료되지 않았으면 Result Detail 요약은 내부 재시도 횟수를 오류처럼 노출하지 않고 중립적인 준비 상태로 대기하며, Result Detail이 `FINISHED` 전환을 확인하는 즉시 다시 조회한다.
- Regression Detail에 직접 진입한 경우에는 자동 재확인 5회 후 상단 `비교 새로고침`으로 다시 시도할 수 있다.
- Result Detail의 새로고침은 Run 상세, 결과 목록과 집계, Evaluator 지표, Regression 요약을 함께 갱신하며 진행 중임을 버튼에 표시한다.
- 비교 가능한 Run이 없으면 상세 진입 action을 비활성화한다.
- 비교 가능한 Run이 있으면 `회귀 상세 보기`로 `RegressionDetailView`에 진입한다.
- 후보 없음, loading과 오류를 Regression 0건과 구분한다.
- 이미 불러온 전체 comparison은 Result Detail ↔ Regression Detail 왕복에서 재호출하지 않는다.
- Regression Detail에서는 전체 comparison의 카운트를 요약으로 재사용하고 별도 summary 요청을 보내지 않는다.
- 이 컴포넌트에서 case-level comparison table을 렌더링하지 않는다.

## 9. Regression 상세

### 목적 (`Current behavior`)

현재 Run과 backend가 comparable로 반환한 과거 FINISHED Run의 저장 결과를 전용 화면에서 비교한다. Quality Gate와 Regression은 독립된 기능이다.

### 화면 흐름

```text
Result Detail
→ RegressionSummaryEntry
→ 회귀 상세 보기
→ Regression Detail
→ comparable historical Run 선택
→ comparison summary 확인
→ 변화 case 탐색
→ case-level Previous / Current 비교
```

Regression Detail은 기존 `RegressionComparisonSection`과 `regressionService`를 재사용한다.

1. `GET /api/v1/test-runs/{testRunId}/comparable-runs`를 조회한다.
2. backend가 반환한 후보만 page 단위로 표시한다.
3. 과거 Run의 target과 completedAt을 비교 맥락으로 표시한다.
4. 후보를 선택해 `GET /api/v1/test-runs/{currentRunId}/comparisons/{comparisonRunId}`를 조회한다.
5. summary의 `totalCases`, `changedCount`, `unchangedCount`, `regressedCount`, `improvedCount`, `notComparableCount`를 서버 값 그대로 표시한다. Regression Detail은 `비교 결과 요약(전체·변경·변화 없음)`과 `변경 상세(악화·개선·비교 불가)`를 두 단계로 분리하고, 악화·개선·변화 없음·비교 불가의 전체 분포를 `totalCases`를 분모로 한 누적 막대로 표시한다. 분류 합계가 `totalCases`보다 작으면 잔차를 `기타`로 표시하고, 어떤 방향이든 합계가 다르면 불일치 안내를 표시한다. `changedCount = regressedCount + improvedCount`이며 `notComparableCount`는 변경에 포함되지 않는다.
6. case-level에서 Expected, Previous/Current verdict, `comparabilityStatus`, `changeType`을 동일 컨텍스트에서 확인하며, Regression 유형은 사용자에게 `보안 악화 / 사용성 악화`로 표시한다.
7. changed-only filter 등으로 변화 case를 우선 탐색할 수 있게 한다.
8. Application이나 Evaluator를 다시 실행하지 않는다.

`TestRunComparisonRes`의 summary와 item은 backend classification을 source of truth로 사용한다. 프론트는 comparable 여부나 `changeType`을 재계산하지 않는다.

### UX 원칙

- Result Detail은 현재 Run 자체를 이해하는 화면이고 Regression Detail은 변화 분석을 위한 drill-down 화면이다.
- Regression Detail은 악화/개선/변화 case를 우선 탐색할 수 있게 한다.
- 한 case를 볼 때 Expected, Previous verdict, Current verdict, comparability와 change type을 같은 맥락에서 비교한다.
- 현재 데이터만으로 표현할 수 있다면 `ALLOW → BLOCK`, `BLOCK → ALLOW`, `ALLOW → ALLOW`, `BLOCK → BLOCK` 같은 action transition을 보조 표현으로 사용할 수 있다. 이를 위해 신규 backend 집계 API를 요구하지 않는다.
- Quality Gate와 Regression을 하나의 PASS/FAIL로 합치지 않는다.
- Regression Detail은 Result Detail의 drill-down이므로 Sidebar에 별도 1차 메뉴를 추가하지 않아도 된다.

## 10. Polling

현재 `ResultDetailView`는 `useLiveRunProgress`로 Run 상세를 즉시 조회하고 기본 3초 간격으로 반복한다. 숨겨진 탭에서는 최소 10초 간격을 사용하고, `FINISHED` 또는 terminal error에서 자동 갱신을 멈춘다. transient failure는 최대 5회까지 재시도하며 Run 변경·화면 이탈 시 timer와 request를 정리한다. (`Current behavior`)

현재 동작과 retry 경계는 위에 기록했다. 최대 전체 대기 시간과 추가 사용자 안내는 구현되어 있지 않다. 변경 제안은 별도 Issue에서 승인한다.

## 11. 화면별 구현 이슈 추적

| 범위 | 이슈 | 문서 기준 |
| --- | --- | --- |
| 새 TestRun 생성 | #27 / #60 완료 | §6 |
| Run 결과 상세 | #28 / #61 완료 | §8.1~8.3 |
| Regression 진입/상세 화면 분리 | #72 / PR #88 | §8.4, §9 |
| Regression comparison API 소비 | #30 / PR #71 완료 | §9 |
| Evaluator 분석 | #29 완료 | §8.3 |
| API 빈 결과·오류·mock | #19 | §3 및 API 연동 계약 |

## 12. 검증 근거

- [`../api/openapi.yaml`](../api/openapi.yaml)
- [`../contracts/api-integration.md`](../contracts/api-integration.md)
- `src/App.tsx`
- `src/components/views/ResultDetailView.tsx`
- `src/components/views/RegressionSummaryEntry.tsx`
- `src/components/views/RegressionDetailView.tsx`
- `src/components/views/RegressionComparisonSection.tsx`
- `src/components/common/`
- `src/services/regressionService.ts`
- `src/services/`
- `src/hooks/useLiveRunProgress.ts`
- `src/types/index.ts`
- GitHub Issues #19, #27, #28, #29, #30, #33, #72
- GitHub PR #71, #88

이 문서는 OpenAPI 계약을 변경하지 않는다.
