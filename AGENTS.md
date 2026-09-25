# GuardBench Frontend Agent Guide

이 파일은 GuardBench Frontend 저장소에서 에이전트가 Issue를 조사하고 코드·문서를 변경할 때 적용하는 repository-level 지침이다. 문서 체계 전체 개정은 별도 Issue 범위로 수행한다.

## 1. 목적과 적용 범위

- 현재 Issue에서 요구하는 최소 범위만 변경한다. 시작 전에 현재 Issue, 관련 승인 문서, 실제 source와 test를 확인한다.
- 문서의 제안·현재 관찰·승인 계약을 구분한다. 과거 문서, 발표자료, 대화만으로 현재 구현이나 계약을 단정하지 않는다.
- 기존 사용자 변경사항을 보존한다. 출처가 불분명한 변경이나 다른 작업 디렉터리를 되돌리지 않는다.

## 2. 작업 시작 전 필수 확인

모든 작업은 다음 순서로 조사한다.

1. 이 `AGENTS.md`
2. 현재 GitHub Issue의 목적, 범위, Non-Goals, 완료 기준과 승인된 요구사항
3. 작업별 읽기 순서에 해당하는 `APPROVED` 문서
4. 관련 `src/`, `scripts/`, `tests/`, 설정과 workflow의 현재 구현

저장소 상태, branch, `origin`이 개인 fork인지 확인한다. Issue 범위를 벗어난 문제는 현재 변경에 섞지 않고 별도 Issue 후보로 보고한다.

## 3. 계약 및 판단 우선순위

일반적인 구현·문서 판단은 다음 순서를 따른다.

1. 사용자의 현재 명시적 지시
2. 현재 GitHub Issue의 승인된 요구사항
3. Backend의 `APPROVED` OpenAPI
4. Frontend의 `APPROVED` 문서
5. 테스트와 현재 공개 코드
6. `DRAFT`, `AS-IS`, 과거 `TO-BE` 등 미승인 문서
7. demo/mock 자료

API 계약은 Backend가 소유한다. Endpoint, HTTP method, request/response schema, enum, nullable, validation, 공개 error shape를 Frontend에서 재정의하거나 추측하지 않는다. API 계약 변경 제안은 Backend의 승인·변경 흐름에서 먼저 확정하고 Frontend는 승인된 계약을 동기화해 소비한다.

Frontend는 API 호출 방식, DTO mapping, 화면 상태 변환, loading/error/empty 표현, 사용자 interaction과 접근성 표현을 소유한다. 계약 출처가 충돌하거나 필요한 결정이 미승인 상태라면 임의로 선택하지 말고 근거와 영향 범위를 Issue/PR에 남긴다.

## 4. 문서 상태

공식 문서 상태는 다음 네 가지다.

| 상태 | 의미 |
| --- | --- |
| `DRAFT` | 검토·결정 중인 제안이다. 단독으로 구현 계약에 사용하지 않는다. |
| `APPROVED` | 승인된 현재 계약이며 구현과 리뷰의 기준으로 사용할 수 있다. |
| `DEPRECATED` | 신규 구현의 기준으로 사용하지 않는다. 대체 자료가 있으면 함께 가리킨다. |
| `SUPERSEDED` | 후속 결정이나 문서가 대체했다. 현재 판단에는 대체 자료를 사용한다. |

상태가 없는 문서는 승인 계약으로 간주하지 않는다. `AS-IS`, `TO-BE`, `미결정`은 문서 상태가 아니다.

- `AS-IS`는 `APPROVED` 문서 안의 Current Behavior 또는 코드에서 관찰한 현재 동작을 설명하는 내용으로 취급한다. 현재 동작이 승인된 목표라는 뜻은 아니다.
- `TO-BE`는 `DRAFT` 제안, Issue 또는 ADR 후보로 취급한다.
- `미결정`은 해결되지 않은 결정으로 취급하고 Issue 또는 ADR 후보에 기록한다.

기존 문서에 이 표현들이 남아 있어도 해당 문서들을 일괄 수정·승격하지 않는다. 문서 정규화는 별도 Issue에서 수행한다.

## 5. 작업별 읽기 순서

| 작업 유형 | 우선 읽기 자료 |
| --- | --- |
| 모든 Frontend 작업 | `README.md` → `docs/README.md` → 현재 Issue → 관련 승인 문서 → 관련 source/test |
| 일반 구현 | `docs/product/screen-spec.md` → `docs/product/user-flows.md` → `docs/conventions/ui-guidelines.md` → 관련 view/component와 test |
| API 연동 | `docs/api/README.md` → `docs/api/openapi.yaml` → `docs/contracts/api-integration.md` → 관련 `src/services/`, `src/types/`, DTO mapping과 test |
| 화면·사용자 흐름 | `docs/product/screen-spec.md` → `docs/product/user-flows.md` → `docs/conventions/ui-guidelines.md` → `src/routing/`, 관련 view/component와 test |
| 아키텍처 | `docs/architecture/frontend-architecture.md` → `src/` 구조와 실제 의존·상태 흐름 → 관련 test → 관련 ADR(있을 때) |
| UI·접근성 | `docs/conventions/ui-guidelines.md` → `docs/testing.md` → 관련 component와 `tests/browser/` |
| 테스트 | `docs/testing.md` → `package.json` → `vitest.config.ts`, `tsconfig.browser.json`, `scripts/`, `tests/` 중 해당 층 |
| 배포 workflow | `docs/operations/frontend-deployment.md` → `.github/workflows/` → `package.json` 및 관련 설정. IaC 책임 경계도 확인한다. |
| 문서 | `docs/README.md` → 수정할 canonical 문서 → 현재 Issue → 문서가 설명하는 source/workflow |

실제 repository 구조를 기준으로 경로를 확인한다. 화면은 `src/components/views/`, 공통 UI는 `src/components/common/`, layout은 `src/components/layout/`, API 서비스는 `src/services/`, hook은 `src/hooks/`, contract type은 `src/types/` 및 `src/contracts/`에 있다. 구조가 바뀌면 이 안내도 함께 검토한다.

## 6. Frontend 핵심 구현 원칙

- **Backend 판정 재계산 금지:** Quality Gate의 `status`와 metric의 `value`, `threshold`, `passed`는 서버 판정을 그대로 표시한다. `passed`나 Gate status를 value/threshold 비교로 다시 계산하지 않는다. 화면 표현은 `docs/contracts/api-integration.md`와 `docs/testing.md`를 따른다.
- **API 실패를 성공 데이터로 바꾸지 않기:** `VITE_DATA_MODE=api`가 기본이며 API 오류를 demo/mock 성공 응답으로 fallback하지 않는다. 오류와 empty 상태를 구분하고 공개된 error 정보만 화면에 표현한다.
- **demo/mock 구분:** `VITE_DATA_MODE=demo`는 명시적인 데모 모드다. demo fixture를 실제 API 응답, 계약 근거 또는 production 동작으로 취급하지 않는다. 화면은 demo 상태를 식별할 수 있어야 한다.
- **상태 의미 보존:** execution status, Quality Gate, assertion/evaluation outcome, Regression은 서로 다른 의미다. 한 상태로 합치거나 의미를 추측하지 않는다. 실제 상태 소유권과 polling 정책은 관련 문서와 `src/hooks/` 구현에서 확인한다.
- **접근성:** 공통 control의 label, 오류 연결, focus와 keyboard 동작은 UI 가이드와 browser test 기준을 따른다.

### OpenAPI 사본

`docs/api/openapi.yaml`은 Backend canonical source `GuardBench/guardbench-backend`의 동기화 사본이며 독립 계약이 아니다. `docs/api/openapi.source.json`은 source commit과 SHA-256 metadata를 기록한다. OpenAPI 파일을 직접 고쳐 drift를 감추지 않는다.

API 계약 또는 동기화 사본을 다루기 전에 `package.json`의 실제 script를 확인하고 `npm run openapi:verify`를 실행한다. 이 검증은 기록된 Backend commit을 읽을 수 있는 clone이 필요하며 기본 경로는 sibling `../guardbench-backend`다. Backend 계약과 drift가 있으면 추측해 수정하지 말고 승인된 Backend source와 동기화 절차를 확인한다. 최신 `dev` drift 검사는 필요한 Backend clone/ref가 있을 때 `npm run openapi:check-latest -- --backend-path <경로> --ref <ref>`를 사용한다.

## 7. 문서 동반 변경 기준

다음 변화가 있으면 관련 문서를 함께 검토하고 필요한 문서를 변경한다.

- endpoint, DTO, enum, nullable 또는 error mapping 변화
- 화면 추가·삭제, route 또는 사용자 흐름 변화
- polling 간격·종료 조건·오류 처리 변화
- loading, empty, stale, error의 의미나 표현 변화
- Quality Gate 및 서버 판정 근거 표현 변화
- API mode/demo mode 정책 변화
- state ownership, API 계층, 공통 component 책임 변화
- 접근성 규칙 변화
- build/test/deploy workflow 또는 배포 경계 변화

동반 문서 변경이 필요 없으면 PR에서 이유를 설명한다. Issue 범위 밖의 문서 정리는 별도 Issue로 남긴다.

## 8. 테스트 및 검증

실행 가능한 명령은 현재 `package.json`과 workflow에서 확인한다. 이 저장소의 관련 script는 `npm run lint`, `npm test`, `npm run test:component`, `npm run build`, `npm run openapi:verify`다.

| 변경 유형 | 최소 검증 |
| --- | --- |
| 문서 전용 | 링크·참조 경로와 문서 간 일관성 확인, `git diff --check`. OpenAPI 문서/사본을 다루면 `npm run openapi:verify`도 실행한다. |
| TypeScript, API client/DTO mapping | `npm run lint`, `npm test`, `npm run build`. 관련 API 또는 mapping 검증도 실행한다. |
| UI/component 및 접근성 | `npm run lint`, `npm test`, `npm run test:component`, `npm run build`. |
| Node 계약/presentation test | `npm run lint`, `npm test`, `npm run build`. |
| browser test | `npm run lint`, `npm run test:component`, `npm run build`; 관련 Node 계약 변경이 있으면 `npm test`도 실행한다. |
| deploy/workflow | workflow와 문서의 조건·경계 확인. 빌드 동작을 바꿨으면 lint, test, build를 실행한다. |

`npm test`는 `scripts/*.test.mjs`, `npm run test:component`는 Chromium browser tests를 실행한다. 문서-only 변경에 전체 Browser test를 무조건 요구하지 않는다. 실행하지 않은 검증은 이유와 함께 PR에 `NOT RUN`으로 기록한다.

## 9. Git / Issue / PR 작업 규칙

- Issue 단위로 `agent/{issue-number}-{slug}` branch를 사용하고 `main`에 직접 push하지 않는다.
- 기존 사용자 변경사항을 보존하고 현재 Issue와 관계없는 파일을 stage하지 않는다.
- commit 전 `git diff --check`, `git status`, staged diff를 확인한다. 커밋은 관련 변경만 포함한다.
- push 전 `git log --oneline origin/main..HEAD`, `git diff --stat origin/main...HEAD`, 전체 diff와 파일 범위를 확인한다.
- PR은 현재 Issue를 연결하고 변경 내용, 검증 결과, 미실행 항목을 기록한다. 문서-only 변경으로 CI가 실행되지 않는 workflow 조건은 실패로 간주하지 않되 required check 상태는 확인한다.
- force push, 기존 tag 변경/삭제, release 생성은 하지 않는다.

## 10. 금지 사항

Issue에서 요구하지 않은 UI redesign, Backend/IaC 수정, OpenAPI 직접 편집, 새 dependency 추가, 대규모 refactor를 임의로 수행하지 않는다. 필요성은 별도 Issue 후보로 보고한다.

다음 사실은 현재 코드·계약·설정에서 직접 확인한다: route, endpoint, DTO field, enum, nullable, component 이름, state ownership, polling 정책, CI job, 배포 대상과 AWS resource. demo/mock, DRAFT, 과거 TO-BE, 발표자료나 대화는 이를 입증하는 근거가 아니다.
