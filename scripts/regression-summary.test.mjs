import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const compile = (path) => {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
};

const {
  regressionChangeTypeLabel,
  regressionDetailSummaryGroups,
  regressionDistribution,
  regressionSummaryItems,
} = await import(compile('../src/components/views/regressionSummary.ts'));

const comparison = {
  totalCases: 78,
  changedCount: 3,
  regressedCount: 2,
  improvedCount: 1,
  unchangedCount: 74,
  notComparableCount: 1,
};

test('Regression Detail separates overview counts from change details', () => {
  assert.deepEqual(regressionDetailSummaryGroups(comparison), [
    {
      id: 'overview',
      title: '비교 결과 요약',
      items: [
        { label: '전체', value: 78, tone: 'neutral' },
        { label: '변경', value: 3, tone: 'changed' },
        { label: '변화 없음', value: 74, tone: 'unchanged' },
      ],
    },
    {
      id: 'changes',
      title: '변경 상세',
      description: '악화와 개선은 변경 건수의 구성이며, 비교 불가는 판정 결과가 없어 변화를 판단할 수 없는 별도 항목입니다.',
      items: [
        { label: '악화', value: 2, tone: 'regressed' },
        { label: '개선', value: 1, tone: 'improved' },
        { label: '비교 불가', value: 1, tone: 'notComparable' },
      ],
    },
  ]);
});

test('distribution segments preserve the four mutually exclusive backend counts', () => {
  const distribution = regressionDistribution(comparison);
  assert.deepEqual(
    distribution.segments.map(({ label, value, widthPercent }) => ({ label, value, widthPercent })),
    [
      { label: '악화', value: 2, widthPercent: 2 / 78 * 100 },
      { label: '개선', value: 1, widthPercent: 1 / 78 * 100 },
      { label: '변화 없음', value: 74, widthPercent: 74 / 78 * 100 },
      { label: '비교 불가', value: 1, widthPercent: 1 / 78 * 100 },
      { label: '기타', value: 0, widthPercent: 0 },
    ],
  );
  assert.equal(distribution.categorizedCases, comparison.totalCases);
  assert.equal(distribution.unaccountedCases, 0);
  assert.equal(distribution.matchesTotal, true);
});

test('distribution exposes an uncategorized remainder instead of silently renormalizing it', () => {
  const distribution = regressionDistribution({ ...comparison, totalCases: 80 });

  assert.deepEqual(distribution.segments.at(-1), {
    label: '기타',
    value: 2,
    tone: 'other',
    widthPercent: 2.5,
  });
  assert.equal(distribution.categorizedCases, 78);
  assert.equal(distribution.unaccountedCases, 2);
  assert.equal(distribution.matchesTotal, false);
});

test('regression summary preserves backend counts including non-comparable cases', () => {
  assert.deepEqual(regressionSummaryItems(comparison), [
    { label: '악화', value: 2 },
    { label: '개선', value: 1 },
    { label: '변화 없음', value: 74 },
    { label: '비교 불가', value: 1 },
  ]);
});

test('regression summary displays a zero non-comparable count from the backend', () => {
  assert.deepEqual(regressionSummaryItems({ ...comparison, notComparableCount: 0 }), [
    { label: '악화', value: 2 },
    { label: '개선', value: 1 },
    { label: '변화 없음', value: 74 },
    { label: '비교 불가', value: 0 },
  ]);
});

test('regression case types use user-facing worsening labels', () => {
  assert.equal(regressionChangeTypeLabel('SECURITY_REGRESSION'), '보안 악화');
  assert.equal(regressionChangeTypeLabel('USABILITY_REGRESSION'), '사용성 악화');
  assert.equal(regressionChangeTypeLabel('IMPROVEMENT'), '개선');
  assert.equal(regressionChangeTypeLabel('NO_CHANGE'), '변화 없음');
  assert.equal(regressionChangeTypeLabel(null), '비교 불가');
});

test('summary and detail components only use type imports from regression services', () => {
  for (const path of [
    '../src/components/views/RegressionSummaryEntry.tsx',
    '../src/components/views/RegressionComparisonSection.tsx',
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.ES2023, true, ts.ScriptKind.TSX);
    const valueImports = sourceFile.statements
      .filter((statement) => ts.isImportDeclaration(statement))
      .filter((statement) => statement.moduleSpecifier.text.includes('regressionService'))
      .filter((statement) => {
        const clause = statement.importClause;
        if (!clause || clause.isTypeOnly) return false;
        if (!clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) return true;
        return clause.namedBindings.elements.some((element) => !element.isTypeOnly);
      });
    assert.equal(valueImports.length, 0, `${path} must not own regression API calls`);
  }
});

test('Result Detail keeps an unfinished Regression summary neutral after internal retries', () => {
  const summarySource = readFileSync(new URL('../src/components/views/RegressionSummaryEntry.tsx', import.meta.url), 'utf8');
  const detailSource = readFileSync(new URL('../src/components/views/RegressionComparisonSection.tsx', import.meta.url), 'utf8');

  assert.match(summarySource, /현재 Run이 종료되면 비교 가능한 과거 Run을 자동으로 확인합니다\./);
  assert.doesNotMatch(summarySource, /자동 확인을 5회 마쳤습니다/);
  assert.doesNotMatch(summarySource, /autoRetryExhausted/);
  assert.match(detailSource, /자동 확인을 5회 마쳤습니다/);
  assert.match(detailSource, /비교 새로고침/);
});

const stateHelpers = await import(compile('../src/hooks/regressionComparisonState.ts'));

const regressionStore = (runId = '901') => stateHelpers.initialRegressionStore(runId);
const candidateResponse = (ids) => ({
  items: ids.map((id) => ({ id, testSuiteId: 1, target: { type: 'HTTP_ENDPOINT', identifier: `https://example.test/${id}`, revision: null, model: `model-${id}` }, completedAt: '2026-09-10T00:00:00Z' })),
  page: { number: 1, size: 20, totalElements: ids.length, totalPages: 1, hasPrevious: false, hasNext: false },
});

test('a loaded detail comparison is reused after a Result Detail round trip', () => {
  const key = stateHelpers.comparisonKey('901', '800');
  assert.equal(stateHelpers.shouldLoadComparison(key, '', ''), true);
  assert.equal(stateHelpers.shouldLoadComparison(key, key, ''), false);
});

test('Regression Detail uses the full comparison without requesting a duplicate summary', () => {
  const key = stateHelpers.comparisonKey('901', '800');
  assert.equal(stateHelpers.shouldLoadSummary(true, key, '', '', ''), false);
  assert.equal(stateHelpers.shouldLoadSummary(false, key, '', '', key), false);
  assert.equal(stateHelpers.shouldLoadSummary(false, key, '', '', ''), true);
});

test('candidate refresh preserves a selected baseline while it is still available', () => {
  assert.equal(stateHelpers.preserveSelectedCandidate('800', ['850', '800']), '800');
  assert.equal(stateHelpers.preserveSelectedCandidate('700', ['850', '800']), '850');
});

test('page refresh reloads candidates when no comparable Run has been found', () => {
  assert.equal(stateHelpers.shouldRefreshRegressionCandidates(0, false, false), true);
  assert.equal(stateHelpers.shouldRefreshRegressionCandidates(1, true, false), true);
  assert.equal(stateHelpers.shouldRefreshRegressionCandidates(1, false, true), true);
  assert.equal(stateHelpers.shouldRefreshRegressionCandidates(1, false, false), false);
});

test('a finished Run refreshes only its waiting Regression candidate lookup', () => {
  assert.equal(stateHelpers.shouldRefreshRegressionAfterRunFinished('901', '901', true), true);
  assert.equal(stateHelpers.shouldRefreshRegressionAfterRunFinished('901', '901', false), false);
  assert.equal(stateHelpers.shouldRefreshRegressionAfterRunFinished('901', '902', true), false);
});

test('candidate page lifecycle rejects a late page response and preserves an available selection', () => {
  const loaded = stateHelpers.acceptCandidatePage(
    regressionStore(), '901', 1, 0, candidateResponse([800, 802]),
  );
  const selected = stateHelpers.selectComparison(loaded, '901', '802');
  const refreshed = stateHelpers.refreshCandidates(selected, '901');

  assert.equal(refreshed.selectedComparisonId, '802');
  assert.equal(stateHelpers.acceptCandidatePage(refreshed, '901', 1, 0, candidateResponse([700])), refreshed);

  const pageChanged = stateHelpers.changeCandidatePage(refreshed, '901', 2);
  assert.equal(pageChanged.candidatePage, 2);
  assert.equal(pageChanged.candidateReloadToken, 2);
  assert.equal(stateHelpers.acceptCandidatePage(pageChanged, '901', 1, 1, candidateResponse([700])), pageChanged);
});

test('candidate selection and Run identity invalidate stale comparison responses', () => {
  const loaded = stateHelpers.acceptCandidatePage(regressionStore(), '901', 1, 0, candidateResponse([800, 802]));
  const selected = stateHelpers.selectComparison(loaded, '901', '800');
  const key800 = stateHelpers.comparisonKey('901', '800');
  const changed = stateHelpers.selectComparison(selected, '901', '802');
  const comparison = { currentRunId: 901, comparisonRunId: 800, totalCases: 0, changedCount: 0, unchangedCount: 0, improvedCount: 0, regressedCount: 0, notComparableCount: 0, items: [] };

  assert.equal(stateHelpers.acceptComparison(changed, '901', key800, 0, comparison), changed);
  assert.equal(stateHelpers.failComparison(changed, '901', key800, 0, new Error('TEST_RUNS_NOT_COMPARABLE')), changed);

  const otherRun = regressionStore('902');
  assert.equal(stateHelpers.acceptComparison(otherRun, '901', key800, 0, comparison), otherRun);
});

test('TEST_RUNS_NOT_COMPARABLE remains scoped to the selected pair and clears only its result', () => {
  const loaded = stateHelpers.acceptCandidatePage(regressionStore(), '901', 1, 0, candidateResponse([800]));
  const selected = stateHelpers.selectComparison(loaded, '901', '800');
  const failed = stateHelpers.failComparison(
    selected,
    '901',
    stateHelpers.comparisonKey('901', '800'),
    0,
    { code: 'TEST_RUNS_NOT_COMPARABLE' },
  );

  assert.equal(failed.comparison, null);
  assert.equal(failed.comparisonErrorKey, '901:800');
  assert.equal(failed.selectedComparisonId, '800');
  assert.deepEqual(failed.candidates.map(({ id }) => id), [800]);
});
