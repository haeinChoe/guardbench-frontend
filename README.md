# GuardBench Frontend

> **Portfolio fork**  
> 이 저장소는 팀 프로젝트 `GuardBench/guardbench-frontend`를 개인 포트폴리오용으로 fork한 저장소입니다.  
> 서비스의 설계·구현은 팀의 공동 결과물이며, 이 README는 현재 `main`의 실제 구현을 기준으로 사용자 흐름, API 계약, 테스트 전략을 빠르게 파악할 수 있도록 재구성했습니다.

GuardBench Frontend는 **AI Application 테스트 자산을 관리하고, TestRun 실행 결과·Quality Gate·Regression을 시각적으로 확인하는 SPA**입니다.

---

## 사용자 흐름

```text
Dashboard
   │
   ├─ Test Suite / Test Case 관리
   │
   ├─ TestRun 생성
   │
   ├─ Run History 확인
   │
   └─ Result Detail
        ├─ execution status
        ├─ Quality Gate
        ├─ metric evidence
        └─ regression result
```

사용자는 테스트 자산을 정의하고 실행한 뒤, 실행 성공 여부와 정책 기대값 충족 여부를 분리해서 확인할 수 있습니다.

## 주요 화면

### Dashboard

- Test Suite 현황
- 최근 Quality Gate 판정 추이
- 최근 활동 요약

### Test Suite / Test Case

- 정책 테스트 자산 조회
- 테스트 케이스 생성·수정·삭제
- 실행에 사용할 테스트 정의 관리

### New Run

- 실행 대상과 테스트 스위트를 선택해 TestRun 생성
- API 응답을 기준으로 실제 실행 상태를 표시

### Run History

- 과거 TestRun 목록 조회
- execution status와 Quality Gate status를 구분해서 표시

### Result Detail

- TestRun의 Quality Gate 결과
- 실행 성공률과 기대 일치율
- Snapshot별 평가 결과
- 저장된 실행 결과를 기준으로 한 Regression 정보

---

## API 데이터와 Demo 데이터를 분리

Frontend는 실제 API 요청과 demo mode 표시를 구분합니다. 현재 `demo` 설정은 UI에 DEMO banner를 표시하지만 fixture 기반 data adapter는 구현되어 있지 않아 화면 데이터 요청은 여전히 API service를 사용합니다.

기본값:

```env
VITE_DATA_MODE=api
```

API 모드에서는 Backend 오류를 임의의 성공 데이터로 대체하지 않습니다.

demo mode 표시를 켜려면:

```env
VITE_DATA_MODE=demo
```

를 명시합니다. 이 설정은 별도 demo data를 공급하지 않습니다.

API 오류를 demo/mock 성공 응답으로 대체하지 않습니다. 사용 가능한 fixture 기반 demo experience가 필요하면 별도 adapter 구현과 Issue 승인이 필요합니다.

---

## Frontend에서 중요하게 본 문제

### 1. Backend 계약을 UI 상태로 그대로 투영

Quality Gate의 `PASS | FAIL | NOT_EVALUATED`와 execution 상태를 하나의 성공/실패 값으로 합치지 않습니다.

예를 들어 실행 자체의 실패와 정책 평가 실패는 UI에서 다른 의미로 표현합니다.

```text
Execution Status
→ 시스템이 테스트를 정상적으로 수행했는가

Quality Gate
→ 수행된 결과가 정책 기준을 만족했는가
```

### 2. 서버 판정 근거를 다시 계산하지 않음

Quality Gate 화면은 Backend가 제공한 value, threshold, `passed`를 사용합니다.

Frontend가 동일한 규칙을 별도로 구현해 결과를 다시 판정하지 않습니다.

이를 통해 Backend의 domain decision과 UI 표시가 서로 달라지는 것을 방지합니다.

### 3. 실제 브라우저에서 동작과 layout 검증

DOM 문자열 수준 테스트만으로는 다음 문제를 확인하기 어렵습니다.

- focus 이동
- modal/portal
- accessible name
- responsive layout
- 실제 CSS 적용 결과

그래서 컴포넌트 테스트는 **Vitest Browser Mode + Playwright provider + Chromium**으로 실행합니다.

대표적으로 다음을 검증합니다.

- form prefill과 validation
- 저장 중 중복 제출 차단
- API 실패 뒤 편집 상태 유지
- focus 복귀
- 좁은 viewport의 layout
- Quality Gate 근거와 accessible label 연결

→ [Frontend 테스트 가이드](docs/testing.md)

---

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Language | TypeScript |
| UI | React 19 |
| Build | Vite |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| Architecture | SPA |
| Test | Node test runner, Vitest Browser Mode, Playwright |
| Lint | Oxlint |
| Deployment | Amazon S3, CloudFront |
| CI/CD | GitHub Actions |
| AWS Auth | GitHub Actions OIDC |

---

## 로컬 개발

### 요구사항

Node 버전은 저장소의 `.node-version`을 기준으로 사용합니다.

```bash
npm ci
```

환경 파일:

```bash
cp .env.example .env
```

개발 서버:

```bash
npm run dev
```

프로덕션 빌드:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

---

## 테스트

빠른 논리·계약 테스트:

```bash
npm test
```

Chromium 설치:

```bash
npx playwright install chromium
```

브라우저 컴포넌트 테스트:

```bash
npm run test:component
```

Watch mode:

```bash
npm run test:component:watch
```

OpenAPI 동기화 검증:

```bash
npm run openapi:verify
```

상세 기준은 [docs/testing.md](docs/testing.md)를 참고합니다.

---

## CI/CD

`.github/workflows/deploy.yml`은 source 변경에 대해 다음을 검증합니다.

```text
npm ci
  ↓
lint
  ↓
node tests
  ↓
production build
  ↓
component test (Chromium)
```

`main` push에서는 검증 성공 후:

```text
dist/
  ↓
S3 sync
  ↓
CloudFront cache invalidation
```

순서로 Dev Frontend를 갱신합니다.

Markdown 및 일반 `docs/**` 변경은 source build 대상에서 제외되어 있습니다.

---

## Repository 관계

- **Portfolio fork:** `haeinChoe/guardbench-frontend`
- **Original team repository:** `GuardBench/guardbench-frontend`

이 저장소의 `main`은 GuardBench MVP 포트폴리오 기준선으로 사용합니다.
