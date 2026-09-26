import { afterEach, expect, test, vi } from 'vitest';
import { useState } from 'react';
import { render } from 'vitest-browser-react';
import { ResultDetailView } from '../../src/components/views/ResultDetailView';
import type { TestRunResultListItemRes } from '../../src/services/testRunService';
import { apiFailure, apiSuccess, deferred, installApiStub } from './support/apiStub';

const resultItem = (id: number): TestRunResultListItemRes => ({
  testCaseSnapshotId: id,
  name: `테스트 케이스 ${id}`,
  input: `입력 ${id}`,
  expectedAction: 'BLOCK',
  severity: 'HIGH',
  category: 'PROMPT_INJECTION',
  executionStatus: 'SUCCEEDED',
  evaluatorVerdict: 'BLOCK',
  assertionStatus: 'PASS',
  evaluationOutcome: 'TRUE_POSITIVE',
  attentionType: null,
  error: null,
});

const pageResponse = (number: number, totalPages: number, items = [resultItem(number)]) => ({
  items,
  page: {
    number,
    size: 20,
    totalElements: totalPages * 20,
    totalPages,
    hasPrevious: number > 1,
    hasNext: number < totalPages,
  },
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('result pagination uses 20-item pages, supports page buttons and recovers an out-of-range page', async () => {
  const fourthPage = deferred<Response>();
  const { requests } = installApiStub((request) => {
    if (request.url.pathname.endsWith('/test-runs/901')) {
      return apiSuccess({
        id: 901,
        testSuiteId: 7,
        status: 'FINISHED',
        testCaseCount: 200,
        progress: { processedTestCaseCount: 200, percent: 100 },
        target: {
          type: 'HTTP_ENDPOINT',
          identifier: 'https://example.com/v1/chat/completions',
          revision: null,
          model: 'test-model',
        },
        executionOutcome: 'COMPLETED',
        qualityGate: {
          status: 'PASS',
          metrics: {
            assertionPassRate: 1,
            executionSuccessRate: 1,
            assertion: { value: 1, threshold: 0.95, passed: true },
            execution: { value: 1, threshold: 0.95, passed: true },
          },
        },
        createdAt: '2026-09-06T00:00:00Z',
        startedAt: '2026-09-06T00:00:01Z',
        completedAt: '2026-09-06T00:01:00Z',
        updatedAt: '2026-09-06T00:01:00Z',
      });
    }
    if (request.url.pathname.endsWith('/test-runs/901/evaluator-metrics')) {
      return apiSuccess({
        truePositive: 200,
        trueNegative: 0,
        falsePositive: 0,
        falseNegative: 0,
        falsePositiveRate: 0,
        falseNegativeRate: 0,
      });
    }
    if (request.url.pathname.endsWith('/test-runs/901/results')) {
      const requestedPage = Number(request.url.searchParams.get('page'));
      if (requestedPage === 4) return fourthPage.promise;
      const response = pageResponse(requestedPage, requestedPage === 3 ? 3 : 10);
      return apiSuccess(requestedPage === 1 ? {
        ...response,
        facets: {
          allResults: 200,
          attentionTotal: 0,
          attentionTypes: {
            FALSE_NEGATIVE: 0,
            FALSE_POSITIVE: 0,
            EXECUTION_FAILED: 0,
            TIMED_OUT: 0,
            NOT_STARTED: 0,
          },
        },
      } : response);
    }
    throw new Error(`Unexpected API request: ${request.method} ${request.url.pathname}`);
  });

  const screen = await render(
    <ResultDetailView selectedRunId="901" onGoNewRun={vi.fn()} />,
  );

  const matrixHeading = screen.getByRole('heading', { name: '기대·관측 동작 매트릭스' });
  const resultListHeading = screen.getByRole('heading', { name: '결과 목록' });
  await expect.element(matrixHeading).toBeVisible();
  expect(
    matrixHeading.element().compareDocumentPosition(resultListHeading.element())
      & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

  const pageFour = screen.getByRole('button', { name: '4페이지' });
  const pagination = screen.getByRole('navigation', { name: '테스트 결과 페이지네이션' });
  await expect.element(pageFour).toBeVisible();
  await expect.element(screen.getByRole('button', { name: '이전' })).toBeDisabled();
  await expect.element(screen.getByRole('button', { name: '다음' })).toBeEnabled();
  await expect.element(screen.getByRole('button', { name: '1페이지' })).toHaveAttribute('aria-current', 'page');
  expect(pagination.element().textContent).toContain('…');
  await pageFour.click();

  await expect.poll(() => requests.filter(({ url }) => (
    url.pathname.endsWith('/test-runs/901/results') && url.searchParams.get('page') === '4'
  )).length).toBe(1);
  await expect.element(pagination).toBeVisible();
  await expect.element(screen.getByRole('button', { name: '1페이지' })).toHaveAttribute('aria-current', 'page');
  await expect.element(pageFour).toBeDisabled();
  await expect.element(screen.getByRole('status')).toHaveTextContent('· 불러오는 중');
  await expect.element(screen.getByText('테스트 케이스 1', { exact: true }).first()).toBeInTheDocument();
  fourthPage.resolve(apiSuccess(pageResponse(4, 3, [])));

  await expect.poll(() => requests.filter(({ url }) => (
    url.pathname.endsWith('/test-runs/901/results') && url.searchParams.get('page') === '3'
  )).length).toBe(1);
  await expect.element(screen.getByRole('button', { name: '3페이지' })).toHaveAttribute('aria-current', 'page');
  await expect.element(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  await expect.element(screen.getByText('테스트 케이스 3', { exact: true }).first()).toBeInTheDocument();
  await expect.element(screen.getByText('테스트 케이스 1', { exact: true }).first()).not.toBeInTheDocument();
  await expect.element(screen.getByRole('status')).not.toBeInTheDocument();

  const resultRequests = requests.filter(({ url }) => url.pathname.endsWith('/test-runs/901/results'));
  expect(resultRequests.map(({ url }) => [url.searchParams.get('page'), url.searchParams.get('size')])).toEqual([
    ['1', '20'],
    ['4', '20'],
    ['3', '20'],
  ]);
});

test('late result responses from a previously selected Run do not replace the current Run', async () => {
  const previousResults = deferred<Response>();
  const { requests } = installApiStub((request) => {
    const runId = request.url.pathname.match(/test-runs\/(\d+)/)?.[1];
    if (!runId) throw new Error(`Unexpected API request: ${request.method} ${request.url.pathname}`);
    if (request.url.pathname.endsWith(`/test-runs/${runId}`)) {
      return apiSuccess({
        id: Number(runId),
        testSuiteId: 7,
        status: 'FINISHED',
        testCaseCount: 1,
        progress: { processedTestCaseCount: 1, percent: 100 },
        target: { type: 'HTTP_ENDPOINT', identifier: 'https://example.com', revision: null, model: 'test-model' },
        executionOutcome: 'COMPLETED',
        qualityGate: null,
        createdAt: '2026-09-06T00:00:00Z',
        startedAt: '2026-09-06T00:00:01Z',
        completedAt: '2026-09-06T00:01:00Z',
        updatedAt: '2026-09-06T00:01:00Z',
      });
    }
    if (request.url.pathname.endsWith(`/test-runs/${runId}/evaluator-metrics`)) {
      return apiSuccess({
        truePositive: 0,
        trueNegative: 0,
        falsePositive: 0,
        falseNegative: 0,
        falsePositiveRate: null,
        falseNegativeRate: null,
      });
    }
    if (request.url.pathname.endsWith(`/test-runs/${runId}/results`)) {
      if (runId === '901') return previousResults.promise;
      return apiSuccess({ ...pageResponse(1, 1, [resultItem(902)]), facets: {
        allResults: 1,
        attentionTotal: 0,
        attentionTypes: { FALSE_NEGATIVE: 0, FALSE_POSITIVE: 0, EXECUTION_FAILED: 0, TIMED_OUT: 0, NOT_STARTED: 0 },
      } });
    }
    throw new Error(`Unexpected API request: ${request.method} ${request.url.pathname}`);
  });

  const Harness = () => {
    const [runId, setRunId] = useState('901');
    return <>
      <button type="button" onClick={() => setRunId('902')}>다른 Run 선택</button>
      <ResultDetailView selectedRunId={runId} onGoNewRun={vi.fn()} />
    </>;
  };

  const screen = await render(<Harness />);
  await expect.poll(() => requests.filter(({ url }) => url.pathname.endsWith('/test-runs/901/results')).length).toBe(1);
  await screen.getByRole('button', { name: '다른 Run 선택' }).click();
  await expect.element(screen.getByText('테스트 케이스 902', { exact: true }).first()).toBeInTheDocument();

  previousResults.resolve(apiSuccess({ ...pageResponse(1, 1, [resultItem(901)]), facets: {
    allResults: 1,
    attentionTotal: 0,
    attentionTypes: { FALSE_NEGATIVE: 0, FALSE_POSITIVE: 0, EXECUTION_FAILED: 0, TIMED_OUT: 0, NOT_STARTED: 0 },
  } }));

  await expect.element(screen.getByText('테스트 케이스 902', { exact: true }).first()).toBeInTheDocument();
  await expect.element(screen.getByText('테스트 케이스 901', { exact: true }).first()).not.toBeInTheDocument();
});

test('TEST_RUN_NOT_FINISHED schedules a detail refresh and retries result queries', async () => {
  let resultCalls = 0;
  const { requests } = installApiStub((request) => {
    if (request.url.pathname === '/api/v1/test-runs/903') {
      return apiSuccess({
        id: 903,
        testSuiteId: 7,
        status: 'FINISHED',
        testCaseCount: 1,
        progress: { processedTestCaseCount: 1, percent: 100 },
        target: { type: 'HTTP_ENDPOINT', identifier: 'https://example.com', revision: null, model: 'test-model' },
        executionOutcome: 'COMPLETED',
        qualityGate: null,
        createdAt: '2026-09-06T00:00:00Z',
        startedAt: '2026-09-06T00:00:01Z',
        completedAt: '2026-09-06T00:01:00Z',
        updatedAt: '2026-09-06T00:01:00Z',
      });
    }
    if (request.url.pathname === '/api/v1/test-runs/903/evaluator-metrics') {
      return apiSuccess({
        truePositive: 0,
        trueNegative: 0,
        falsePositive: 0,
        falseNegative: 0,
        falsePositiveRate: null,
        falseNegativeRate: null,
      });
    }
    if (request.url.pathname === '/api/v1/test-runs/903/results') {
      resultCalls += 1;
      if (resultCalls === 1) return apiFailure(409, 'TEST_RUN_NOT_FINISHED', 'Results are not ready');
      return apiSuccess({ ...pageResponse(1, 1, [resultItem(903)]), facets: {
        allResults: 1,
        attentionTotal: 0,
        attentionTypes: { FALSE_NEGATIVE: 0, FALSE_POSITIVE: 0, EXECUTION_FAILED: 0, TIMED_OUT: 0, NOT_STARTED: 0 },
      } });
    }
    throw new Error(`Unexpected API request: ${request.method} ${request.url.pathname}`);
  });

  const screen = await render(<ResultDetailView selectedRunId="903" onGoNewRun={vi.fn()} />);
  await expect.element(screen.getByText(/실행은 종료됐지만 결과가 아직 준비되지 않았습니다/)).toBeVisible();
  await expect.poll(
    () => requests.filter(({ url }) => url.pathname === '/api/v1/test-runs/903/results').length,
    { timeout: 5000 },
  ).toBe(2);
  await expect.poll(
    () => requests.filter(({ url }) => url.pathname === '/api/v1/test-runs/903').length,
    { timeout: 5000 },
  ).toBe(2);
  await expect.element(screen.getByText('테스트 케이스 903', { exact: true }).first()).toBeInTheDocument();
});

test('unmounting during result race recovery clears its retry timer', async () => {
  const { requests } = installApiStub((request) => {
    if (request.url.pathname === '/api/v1/test-runs/904') {
      return apiSuccess({
        id: 904,
        testSuiteId: 7,
        status: 'FINISHED',
        testCaseCount: 1,
        progress: { processedTestCaseCount: 1, percent: 100 },
        target: { type: 'HTTP_ENDPOINT', identifier: 'https://example.com', revision: null, model: 'test-model' },
        executionOutcome: 'COMPLETED',
        qualityGate: null,
        createdAt: '2026-09-06T00:00:00Z',
        startedAt: '2026-09-06T00:00:01Z',
        completedAt: '2026-09-06T00:01:00Z',
        updatedAt: '2026-09-06T00:01:00Z',
      });
    }
    if (request.url.pathname === '/api/v1/test-runs/904/evaluator-metrics') {
      return apiSuccess({
        truePositive: 0,
        trueNegative: 0,
        falsePositive: 0,
        falseNegative: 0,
        falsePositiveRate: null,
        falseNegativeRate: null,
      });
    }
    if (request.url.pathname === '/api/v1/test-runs/904/results') {
      return apiFailure(409, 'TEST_RUN_NOT_FINISHED', 'Results are not ready');
    }
    throw new Error(`Unexpected API request: ${request.method} ${request.url.pathname}`);
  });

  const Harness = () => {
    const [mounted, setMounted] = useState(true);
    return <>
      <button type="button" onClick={() => setMounted(false)}>상세 닫기</button>
      {mounted && <ResultDetailView selectedRunId="904" onGoNewRun={vi.fn()} />}
    </>;
  };

  const screen = await render(<Harness />);
  await expect.element(screen.getByText(/실행은 종료됐지만 결과가 아직 준비되지 않았습니다/)).toBeVisible();
  await screen.getByRole('button', { name: '상세 닫기' }).click();
  await new Promise((resolve) => setTimeout(resolve, 1100));

  expect(requests.filter(({ url }) => url.pathname === '/api/v1/test-runs/904/results')).toHaveLength(1);
  expect(requests.filter(({ url }) => url.pathname === '/api/v1/test-runs/904')).toHaveLength(1);
});
