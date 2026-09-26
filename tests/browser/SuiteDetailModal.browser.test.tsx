import { afterEach, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { SuiteDetailModal } from '../../src/components/common/SuiteDetailModal';
import type { TestCase, TestSuite } from '../../src/types';
import {
  apiFailure,
  apiSuccess,
  deferred,
  installApiStub,
  type StubbedApiRequest,
} from './support/apiStub';

const originalCase: TestCase = {
  id: 'tc-41',
  name: '원본 케이스',
  input: '원본 입력',
  expectedAction: 'BLOCK',
  severity: 'HIGH',
  category: 'PII',
  createdAt: '2026-09-06T00:00:00Z',
};

const suite: TestSuite = {
  id: 'suite-7',
  name: '보안 회귀 스위트',
  description: '컴포넌트 테스트용 스위트',
  caseCount: 1,
  passRate: '100%',
  lastRun: '없음',
  status: '활성',
  icon: 'S',
  tintBg: '#eef1f4',
};

const listResponse = (testCase: TestCase = originalCase, totalPages = 1) => ({
  items: [{
    id: testCase.id.replace('tc-', ''),
    testSuiteId: 7,
    name: testCase.name,
    input: testCase.input,
    expectedAction: testCase.expectedAction,
    severity: testCase.severity,
    category: testCase.category,
    createdAt: testCase.createdAt ?? '',
    updatedAt: testCase.updatedAt ?? '',
  }],
  page: {
    number: 1,
    size: 20,
    totalElements: totalPages === 1 ? 1 : 100,
    totalPages,
    hasPrevious: false,
    hasNext: totalPages > 1,
  },
});

const renderSuite = () => render(
  <SuiteDetailModal
    suite={suite}
    onClose={vi.fn()}
    onDeleted={vi.fn()}
    onCaseCountChanged={vi.fn()}
    onNotify={vi.fn()}
  />,
);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('TestCase edit validates, preserves a failed draft, prevents duplicate saves and restores focus', async () => {
  let currentCase = originalCase;
  let patchAttempt = 0;
  let getAttempt = 0;
  const firstPatch = deferred<Response>();
  const reload = deferred<Response>();

  const { requests } = installApiStub(async (request) => {
    if (request.method === 'GET' && request.url.pathname.endsWith('/test-suites/7/test-cases')) {
      getAttempt += 1;
      if (getAttempt === 1) return apiSuccess(listResponse());
      return reload.promise;
    }
    if (request.method === 'PATCH' && request.url.pathname.endsWith('/test-cases/41')) {
      patchAttempt += 1;
      if (patchAttempt === 1) return firstPatch.promise;
      currentCase = { ...currentCase, ...(request.body as Partial<TestCase>) };
      return apiSuccess(currentCase);
    }
    throw new Error(`Unexpected API request: ${request.method} ${request.url.pathname}`);
  });

  const screen = await renderSuite();
  const editButton = screen.getByRole('button', { name: '원본 케이스 수정' });
  await expect.element(editButton).toBeVisible();
  await editButton.click();

  const name = screen.getByLabelText('케이스 이름 *');
  const category = screen.getByLabelText('카테고리 *');
  const input = screen.getByLabelText('입력 프롬프트 (Input) *');
  const action = screen.getByLabelText('기대 동작');
  const severity = screen.getByLabelText('Severity (심각도)');
  await expect.element(name).toHaveValue('원본 케이스');
  await expect.element(input).toHaveValue('원본 입력');
  await expect.element(action).toHaveValue('BLOCK');
  await expect.element(severity).toHaveValue('HIGH');

  await name.clear();
  await screen.getByRole('button', { name: '변경사항 저장' }).click();
  await expect.element(screen.getByRole('alert')).toHaveTextContent('테스트 케이스 이름을 입력해 주세요.');
  await expect.poll(() => document.activeElement).toBe(name.element());
  expect(requests.filter(({ method }) => method === 'PATCH')).toHaveLength(0);

  await name.fill('수정된 케이스');
  await category.fill('PROMPT_INJECTION');
  await input.fill('수정된 입력');
  await action.selectOptions('ALLOW');
  await severity.selectOptions('CRITICAL');
  await screen.getByRole('button', { name: '변경사항 저장' }).click();
  await expect.element(screen.getByRole('status')).toHaveTextContent('저장 중...');

  // aria-disabled communicates the state but does not suppress native clicks; the in-flight guard must do that.
  (screen.getByRole('button', { name: '저장 중...' }).element() as HTMLButtonElement).click();
  expect(requests.filter(({ method }) => method === 'PATCH')).toHaveLength(1);
  firstPatch.resolve(apiFailure(503, 'TEMPORARY_FAILURE', '잠시 후 다시 시도해 주세요.'));

  await expect.element(screen.getByRole('alert')).toHaveTextContent('잠시 후 다시 시도해 주세요.');
  await expect.element(name).toHaveValue('수정된 케이스');
  await expect.element(category).toHaveValue('PROMPT_INJECTION');
  await expect.element(input).toHaveValue('수정된 입력');

  await screen.getByRole('button', { name: '변경사항 저장' }).click();
  await expect.poll(() => requests.filter(({ method }) => method === 'PATCH').length).toBe(2);
  expect(requests.filter(({ method }) => method === 'PATCH')[1]).toMatchObject({
    body: {
      name: '수정된 케이스',
      input: '수정된 입력',
      expectedAction: 'ALLOW',
      severity: 'CRITICAL',
      category: 'PROMPT_INJECTION',
    },
  });
  await expect.element(screen.getByRole('status')).toHaveTextContent('현재 페이지를 갱신하는 중입니다.');
  reload.resolve(apiSuccess(listResponse(currentCase)));

  const updatedEditButton = screen.getByRole('button', { name: '수정된 케이스 수정' });
  await expect.element(updatedEditButton).toBeVisible();
  await expect.poll(() => document.activeElement).toBe(updatedEditButton.element());
});

test('dirty edit cancellation returns focus to its edit trigger', async () => {
  installApiStub((request) => {
    if (request.method === 'GET') return apiSuccess(listResponse());
    throw new Error(`Unexpected API request: ${request.method} ${request.url.pathname}`);
  });
  vi.spyOn(window, 'confirm').mockReturnValue(true);

  const screen = await renderSuite();
  const editButton = screen.getByRole('button', { name: '원본 케이스 수정' });
  await expect.element(editButton).toBeVisible();
  await editButton.click();
  await screen.getByLabelText('케이스 이름 *').fill('취소할 이름');
  await screen.getByRole('button', { name: '취소' }).click();

  await expect.element(screen.getByRole('form', { name: '원본 케이스 수정' })).not.toBeInTheDocument();
  await expect.poll(() => document.activeElement).toBe(editButton.element());
  expect(window.confirm).toHaveBeenCalledWith('저장하지 않은 수정사항을 취소할까요?');
});

test('mobile pagination stays horizontal and follows the visual focus order', async () => {
  await page.viewport(360, 800);
  installApiStub((request: StubbedApiRequest) => {
    if (request.method === 'GET') return apiSuccess(listResponse(originalCase, 5));
    throw new Error(`Unexpected API request: ${request.method} ${request.url.pathname}`);
  });

  const screen = await renderSuite();
  const previous = screen.getByRole('button', { name: '이전' });
  const next = screen.getByRole('button', { name: '다음' });
  const deleteButton = screen.getByRole('button', { name: '스위트 삭제' });
  const closeButton = screen.getByRole('button', { name: '닫기', exact: true });
  const headerCloseButton = screen.getByRole('button', { name: '테스트 스위트 상세 창 닫기' });
  await expect.element(next).toBeVisible();
  await expect.element(next).toBeEnabled();
  await expect.element(deleteButton).toBeEnabled();
  // Wait for the dialog's requestAnimationFrame-based initial focus before testing manual Tab order.
  await expect.poll(() => document.activeElement).toBe(headerCloseButton.element());

  for (const direction of [previous, next]) {
    const element = direction.element();
    const bounds = element.getBoundingClientRect();
    expect(getComputedStyle(element).whiteSpace).toBe('nowrap');
    expect(bounds.width).toBeGreaterThan(bounds.height);
  }

  next.element().focus();
  await expect.poll(() => document.activeElement).toBe(next.element());
  await userEvent.tab();
  await expect.poll(() => document.activeElement).toBe(deleteButton.element());
  await userEvent.tab();
  await expect.poll(() => document.activeElement).toBe(closeButton.element());
});

test('case list pagination recovers when deletion makes the requested last page invalid', async () => {
  const firstPageCase = { ...originalCase, name: '복구된 첫 페이지 케이스' };
  let firstPageRequests = 0;
  const { requests } = installApiStub((request) => {
    if (request.method !== 'GET' || !request.url.pathname.endsWith('/test-suites/7/test-cases')) {
      throw new Error(`Unexpected API request: ${request.method} ${request.url.pathname}`);
    }

    if (request.url.searchParams.get('page') === '2') {
      return apiSuccess({
        items: [],
        page: {
          number: 2,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasPrevious: true,
          hasNext: false,
        },
      });
    }

    firstPageRequests += 1;
    return apiSuccess(listResponse(firstPageCase, firstPageRequests === 1 ? 2 : 1));
  });

  const screen = await renderSuite();
  await expect.element(screen.getByText('복구된 첫 페이지 케이스')).toBeVisible();
  await screen.getByRole('button', { name: '2페이지' }).click();

  await expect.poll(() => requests.filter(({ url }) => url.searchParams.get('page') === '2').length).toBe(1);
  await expect.poll(() => requests.filter(({ url }) => url.searchParams.get('page') === '1').length).toBe(2);
  await expect.element(screen.getByRole('button', { name: '1페이지' })).toHaveAttribute('aria-current', 'page');
  await expect.element(screen.getByRole('button', { name: '2페이지' })).not.toBeInTheDocument();
  await expect.element(screen.getByText('복구된 첫 페이지 케이스')).toBeVisible();
});

test('bulk creation previews editable rows, deduplicates retries and reloads the list after success', async () => {
  let getAttempt = 0;
  let postAttempt = 0;
  const firstPost = deferred<Response>();
  const notify = vi.fn();
  const onCaseCountChanged = vi.fn();
  const validationFailure = new Response(JSON.stringify({
    httpStatus: 400,
    message: '입력값을 확인해 주세요.',
    data: {
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'items[1].name', message: '이름은 100자 이하여야 합니다.' }],
    },
  }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const { requests } = installApiStub((request) => {
    if (request.method === 'GET' && request.url.pathname.endsWith('/test-suites/7/test-cases')) {
      getAttempt += 1;
      if (getAttempt === 1) return apiSuccess(listResponse());
      return apiSuccess({
        ...listResponse(),
        page: { ...listResponse().page, totalElements: 3 },
      });
    }
    if (request.method === 'POST' && request.url.pathname.endsWith('/test-suites/7/test-cases/bulk')) {
      postAttempt += 1;
      if (postAttempt === 1) return firstPost.promise;
      if (postAttempt === 2) return validationFailure;
      return apiSuccess({ createdTestCaseIds: [42, 43], createdCount: 2, totalTestCaseCount: 3 }, 201);
    }
    throw new Error(`Unexpected API request: ${request.method} ${request.url.pathname}`);
  });

  const screen = await render(
    <SuiteDetailModal
      suite={suite}
      onClose={vi.fn()}
      onDeleted={vi.fn()}
      onCaseCountChanged={onCaseCountChanged}
      onNotify={notify}
    />,
  );
  await expect.element(screen.getByRole('button', { name: '일괄 등록' })).toBeEnabled();
  await screen.getByRole('button', { name: '일괄 등록' }).click();
  await screen.getByLabelText('TestCase JSON 배열').fill(JSON.stringify([
    { name: '첫 케이스', input: '첫 입력', expectedAction: 'BLOCK', severity: 'HIGH', category: 'PII' },
    { name: '', input: '둘째 입력', expectedAction: 'ALLOW', severity: 'LOW', category: 'SAFE' },
  ]));
  await screen.getByRole('button', { name: '검증 및 미리보기' }).click();
  await expect.element(screen.getByText('등록 미리보기 · 2개')).toBeVisible();
  await expect.element(screen.getByText('2번 항목: 이름을 입력해 주세요.')).toBeVisible();
  await screen.getByLabelText('2번 이름').fill('둘째 케이스');

  await screen.getByRole('button', { name: '2개 등록하기' }).click();
  await expect.element(screen.getByRole('status')).toHaveTextContent('일괄 등록 중...');
  (screen.getByRole('button', { name: '등록 중...' }).element() as HTMLButtonElement).click();
  expect(requests.filter(({ method }) => method === 'POST')).toHaveLength(1);
  firstPost.reject(new Error('connection interrupted'));
  await expect.element(screen.getByRole('alert')).toHaveTextContent('[NETWORK_ERROR] connection interrupted');

  await screen.getByRole('button', { name: '2개 등록하기' }).click();
  await expect.element(screen.getByText('2번 항목: 이름은 100자 이하여야 합니다.')).toBeVisible();
  const firstTwoPosts = requests.filter(({ method }) => method === 'POST');
  expect(firstTwoPosts[0].headers.get('Idempotency-Key')).toBeTruthy();
  expect(firstTwoPosts[1].headers.get('Idempotency-Key')).toBe(firstTwoPosts[0].headers.get('Idempotency-Key'));
  expect(firstTwoPosts[1].body).toEqual({ items: [
    { name: '첫 케이스', input: '첫 입력', expectedAction: 'BLOCK', severity: 'HIGH', category: 'PII' },
    { name: '둘째 케이스', input: '둘째 입력', expectedAction: 'ALLOW', severity: 'LOW', category: 'SAFE' },
  ] });

  await screen.getByLabelText('2번 이름').fill('수정한 둘째 케이스');
  await screen.getByRole('button', { name: '2개 등록하기' }).click();
  await expect.element(screen.getByText('소속 테스트 케이스 목록 (3개)')).toBeVisible();
  const posts = requests.filter(({ method }) => method === 'POST');
  expect(posts).toHaveLength(3);
  expect(posts[2].headers.get('Idempotency-Key')).not.toBe(posts[1].headers.get('Idempotency-Key'));
  expect(posts[2].body).toMatchObject({ items: [{ name: '첫 케이스' }, { name: '수정한 둘째 케이스' }] });
  expect(onCaseCountChanged).toHaveBeenCalledOnce();
  expect(onCaseCountChanged).toHaveBeenCalledWith({ kind: 'total', value: 3 });
  expect(notify).toHaveBeenCalledWith('테스트 케이스 2개가 등록되었습니다. (전체 3개)');
});
