# 프론트엔드 테스트 가이드

> Status: APPROVED
> Owner: Frontend
> Last reviewed: 2026-09-26
> Canonical source: GitHub repository (`package.json`, test configuration and tests)
> Scope: GitHub Issues #111, #113

## 1. 선택한 구성

컴포넌트 테스트는 **Vitest Browser Mode + Playwright provider + `vitest-browser-react`**를 사용한다.
테스트는 Vite와 동일한 React·Tailwind 변환을 거쳐 실제 headless Chromium 안에서 실행한다.

검토한 대안과 선택 이유는 다음과 같다.

| 대안 | 장점 | 이 저장소에서의 한계 | 결정 |
| --- | --- | --- | --- |
| Vitest + jsdom + React Testing Library | 빠르고 익숙한 DOM 단위 테스트 | layout과 bounding box를 계산하지 않아 반응형·줄바꿈 회귀를 검증할 수 없음 | 단독 구성으로 채택하지 않음 |
| Playwright Component Testing | 실제 브라우저와 Playwright API 사용 | 별도 component mount 구성을 관리해야 하고 기존 Vite/Vitest 단위 테스트 흐름과 분리됨 | 별도 러너로 채택하지 않음 |
| Vitest Browser Mode + Playwright | Vitest mock·assertion과 실제 Chromium DOM/CSS를 한 실행 경로에서 사용 | Chromium binary 설치가 필요함 | 채택 |

## 2. 테스트 수준별 책임

- `npm test`: `scripts/*.test.mjs`의 순수 presentation, state, API 계약과 소스 수준 금지 규칙을 빠르게 검증한다.
- `npm run test:component`: browser test TypeScript를 먼저 검사한 뒤 `tests/browser/**/*.browser.test.tsx`를 실제 Chromium에 렌더링해 사용자 상호작용, portal, focus, 접근성 이름, loading/error 상태와 CSS layout을 검증한다.
- `npm run build`: application TypeScript와 production bundle을 검증한다.
- 실제 backend·배포 환경을 연결하는 end-to-end 검증은 component test에 포함하지 않는다.

같은 동작을 Node 소스 문자열 테스트와 browser component test에 중복해서 고정하지 않는다. DOM에서 관찰 가능한 요구사항은 browser test를 우선한다.

## 3. 실행 방법

최초 한 번 브라우저를 설치한다.

```bash
npm ci
npx playwright install chromium
```

CI와 같은 headless 실행은 다음과 같다.

```bash
npm run test:component
```

로컬에서 변경을 감시하려면 다음 명령을 사용한다.

```bash
npm run test:component:watch
```

GitHub Actions의 `Component Test (Chromium)` job은 검증 대상 변경이 있을 때 `npm ci`, Chromium 설치, component test 순서로 실행된다. `Workflow Tests`는 CI 변경 범위 분류 규칙을 빠르게 검증하고, `verify`는 branch required check용으로 workflow test와 해당 변경 범위에 필요한 Build·Component Test 결과를 집계한다. 문서-only 변경에서는 전체 애플리케이션 검증을 생략하고 workflow test와 `verify`만 완료한다. staging 배포는 `main` push에서 배포 대상 변경이 있고 `verify`가 성공한 경우에만 실행된다.

## 4. 작성 규칙

- 파일명은 `tests/browser/**/*.browser.test.tsx`를 사용한다.
- `vitest-browser-react`의 `render`로 컴포넌트를 렌더링한다.
- CSS가 필요한 테스트는 공통 setup에서 `src/index.css`를 불러온 실제 계산 스타일과 bounding box를 사용한다.
- 요소는 우선 role과 accessible name 또는 label로 찾는다. JSX 문자열이나 Tailwind 클래스 순서를 테스트하지 않는다.
- 사용자 입력은 locator의 `click`, `fill`, `selectOptions` 또는 `vitest/browser`의 `userEvent`로 수행한다.
- 비동기 렌더링은 고정 sleep 대신 retry 가능한 `expect.element`와 `expect.poll`로 기다린다.
- focus 요구사항은 `document.activeElement`로 확인한다.
- 좁은 화면은 `page.viewport(width, height)`로 명시하고 실제 `getBoundingClientRect()`나 computed style로 결과를 확인한다.

## 5. API stub

컴포넌트 테스트는 실제 backend를 호출하지 않는다. `tests/browser/support/apiStub.ts`의 `installApiStub`으로 browser `fetch`를 대체한다.

```tsx
const { requests } = installApiStub((request) => {
  if (request.method === 'GET' && request.url.pathname.endsWith('/test-cases')) {
    return apiSuccess({ items: [], page: emptyPage });
  }
  return apiFailure(500, 'TEST_ERROR', '테스트 오류');
});
```

stub handler는 예상하지 않은 요청을 명시적으로 실패시켜야 한다. mutation 검증은 `requests`에 기록된 method, URL과 body를 확인한다. pending Promise를 직접 제어하면 저장 중 중복 제출과 loading 상태를 sleep 없이 재현할 수 있다.

각 테스트가 끝나면 공통 `afterEach`에서 mock과 stubbed global을 복원해 다른 테스트로 상태가 새지 않게 한다.

## 6. 첫 대표 사례

`SuiteDetailModal.browser.test.tsx`는 다음을 검증한다.

- 수정 폼의 기존 다섯 값 prefill
- 필수값 오류와 오류 입력으로 focus 이동
- 정확한 다섯 필드 PATCH payload
- 저장 중 중복 제출 차단
- API 실패 후 편집 초안 유지와 재시도
- 취소 및 저장 성공 뒤 수정 trigger로 focus 복귀
- 360px viewport에서 이전·다음 가로쓰기와 페이지네이션 → 삭제 → 닫기 focus order

## 7. Quality Gate evidence 사례

`QualityGateEvidence.browser.test.tsx`는 status 표현과 서버 판정 근거가 실제 DOM에서 일관되게 연결되는지 검증한다.

- PASS, FAIL, NOT_EVALUATED와 결정 전 상태의 accessible card name
- 기대 일치율·실행 성공률의 현재값, 최소 기준과 `passed` 기반 충족 여부
- FAIL 상태에서 `aria-labelledby`로 이름이 연결된 실패 이유 영역
- `passed`를 value와 threshold로 다시 계산하지 않는 표시 계약
- metrics가 없는 상태에서 수치를 발명하지 않고 상태별 안내 문구 표시
