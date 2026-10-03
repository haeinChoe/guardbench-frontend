import { afterEach, expect, test, vi } from 'vitest';
import { useState } from 'react';
import { render } from 'vitest-browser-react';
import { RegressionDetailView } from '../../src/components/views/RegressionDetailView';
import { RegressionSummaryEntry } from '../../src/components/views/RegressionSummaryEntry';
import { useRegressionComparison } from '../../src/hooks/useRegressionComparison';
import { apiSuccess, deferred, installApiStub } from './support/apiStub';

const candidate = (id: number) => ({
  id,
  testSuiteId: 4,
  target: { type: 'HTTP_ENDPOINT' as const, identifier: `https://service.test/${id}`, revision: null, model: `model-${id}` },
  completedAt: '2026-09-10T00:00:00Z',
});

const candidatePage = (runId: string) => ({
  items: [candidate(runId === '901' ? 800 : 900), candidate(runId === '901' ? 802 : 902)],
  page: { number: 1, size: 20, totalElements: 2, totalPages: 1, hasPrevious: false, hasNext: false },
});

const comparison = (currentRunId: number, comparisonRunId: number) => ({
  currentRunId,
  comparisonRunId,
  totalCases: 1,
  changedCount: 1,
  unchangedCount: 0,
  improvedCount: 0,
  regressedCount: 1,
  notComparableCount: 0,
  items: [{
    snapshotId: comparisonRunId,
    testCaseId: 10,
    name: `comparison-${comparisonRunId}`,
    input: 'input',
    expectedAction: 'BLOCK',
    comparisonVerdict: 'ALLOW',
    currentVerdict: 'BLOCK',
    comparabilityStatus: 'COMPARABLE',
    changeType: 'SECURITY_REGRESSION',
  }],
});

function RegressionHarness() {
  const [runId, setRunId] = useState('901');
  const [showDetail, setShowDetail] = useState(false);
  const regression = useRegressionComparison(runId, showDetail);
  return (
    <>
      <button type="button" onClick={() => setRunId((current) => current === '901' ? '902' : '901')}>Switch current Run</button>
      {showDetail ? (
        <RegressionDetailView regression={regression.detail} onBack={() => setShowDetail(false)} />
      ) : (
        <RegressionSummaryEntry regression={regression.summary} onOpenDetail={() => setShowDetail(true)} />
      )}
    </>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('Regression query lifecycle keeps the selected detail across a round trip and ignores stale candidate responses', async () => {
  const oldComparison = deferred<Response>();
  const { requests } = installApiStub((request) => {
    const { pathname } = request.url;
    const currentRunId = pathname.match(/test-runs\/(\d+)/)?.[1] ?? '';
    if (pathname.endsWith(`/test-runs/${currentRunId}/comparable-runs`)) {
      return apiSuccess(candidatePage(currentRunId));
    }
    if (pathname.endsWith('/comparisons/800/summary') || pathname.endsWith('/comparisons/900/summary')) {
      const comparisonRunId = Number(pathname.match(/comparisons\/(\d+)\/summary$/)?.[1]);
      return apiSuccess({ ...comparison(Number(currentRunId), comparisonRunId), items: undefined });
    }
    if (pathname.endsWith('/comparisons/800')) return oldComparison.promise;
    if (pathname.endsWith('/comparisons/802')) return apiSuccess(comparison(Number(currentRunId), 802));
    if (pathname.endsWith('/comparisons/900')) return apiSuccess(comparison(Number(currentRunId), 900));
    if (pathname.endsWith('/comparisons/902')) return apiSuccess(comparison(Number(currentRunId), 902));
    throw new Error(`Unexpected API request: ${request.method} ${pathname}`);
  });

  const screen = await render(<RegressionHarness />);
  await expect.element(screen.getByRole('button', { name: '회귀 상세 보기' })).toBeEnabled();
  await screen.getByRole('button', { name: '회귀 상세 보기' }).click();
  await expect.element(screen.getByRole('heading', { name: 'Regression 상세' })).toBeVisible();
  await expect.poll(() => requests.filter(({ url }) => url.pathname.endsWith('/comparisons/800')).length).toBe(1);

  await screen.getByLabelText('비교할 과거 Run').selectOptions('802');
  await expect.poll(() => requests.filter(({ url }) => url.pathname.endsWith('/comparisons/802')).length).toBe(1);
  await expect.element(screen.getByText('comparison-802')).toBeVisible();
  oldComparison.resolve(apiSuccess(comparison(901, 800)));
  await expect.element(screen.getByText('comparison-802')).toBeVisible();
  await expect.element(screen.getByText('comparison-800')).not.toBeInTheDocument();

  await screen.getByRole('button', { name: '결과 상세로 돌아가기' }).click();
  await screen.getByRole('button', { name: '회귀 상세 보기' }).click();
  await expect.element(screen.getByText('comparison-802')).toBeVisible();
  expect(requests.filter(({ url }) => url.pathname.endsWith('/comparisons/802'))).toHaveLength(1);

  await screen.getByRole('button', { name: 'Switch current Run' }).click();
  await expect.poll(() => requests.filter(({ url }) => url.pathname.endsWith('/test-runs/902/comparable-runs')).length).toBe(1);
  await expect.element(screen.getByText('comparison-802')).not.toBeInTheDocument();
  await expect.element(screen.getByLabelText('비교할 과거 Run')).toHaveValue('900');
});
