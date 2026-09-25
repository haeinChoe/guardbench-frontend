import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const sourceUrl = new URL('../src/components/views/resultFilterPresentation.ts', import.meta.url);
const { outputText } = ts.transpileModule(readFileSync(sourceUrl, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
});
const presentation = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const emptyFilters = () => ({ ...presentation.EMPTY_RESULT_FILTERS });
const derive = (overrides = {}) => presentation.deriveResultListPresentation({
  filters: emptyFilters(),
  attentionTypeCount: 0,
  pageTotalElements: 1,
  facetAllResults: null,
  testCaseCount: 1,
  ...overrides,
});

test('결과 select 값은 허용 목록에 있는 값만 UI filter type으로 변환한다', () => {
  assert.equal(presentation.parseExpectedActionFilter('BLOCK'), 'BLOCK');
  assert.equal(presentation.parseSeverityFilter('CRITICAL'), 'CRITICAL');
  assert.equal(presentation.parseExecutionStatusFilter('NOT_STARTED'), 'NOT_STARTED');
  assert.equal(presentation.parseAssertionStatusFilter('FAIL'), 'FAIL');
  assert.equal(presentation.parseEvaluationOutcomeFilter('ALL'), 'ALL');
  assert.equal(presentation.parseResultSortFilter('name,desc'), 'name,desc');

  assert.equal(presentation.parseExpectedActionFilter('DELETE'), null);
  assert.equal(presentation.parseSeverityFilter('UNKNOWN'), null);
  assert.equal(presentation.parseExecutionStatusFilter('QUEUED'), null);
  assert.equal(presentation.parseAssertionStatusFilter('NOT_EVALUATED'), null);
  assert.equal(presentation.parseEvaluationOutcomeFilter('PASS'), null);
  assert.equal(presentation.parseResultSortFilter('createdAt,desc'), null);
});

test('결과 범위를 좁히는 각 필터와 정렬을 구분한다', () => {
  assert.equal(presentation.hasActiveResultFilter(emptyFilters(), 0), false);
  assert.equal(presentation.hasActiveResultFilter({ ...emptyFilters(), sort: 'name,asc' }, 0), false);
  assert.equal(presentation.hasActiveResultFilter(emptyFilters(), 1), true);

  for (const [key, value] of [
    ['name', 'case'],
    ['input', 'prompt'],
    ['category', 'security'],
    ['expectedAction', 'BLOCK'],
    ['severity', 'HIGH'],
    ['executionStatus', 'SUCCEEDED'],
    ['assertionStatus', 'PASS'],
    ['evaluationOutcome', 'TRUE_POSITIVE'],
  ]) {
    assert.equal(presentation.hasActiveResultFilter({ ...emptyFilters(), [key]: value }, 0), true, key);
  }
});

test('필터 없는 전체 조회에서만 Snapshot 수 불일치를 파생한다', () => {
  assert.deepEqual(derive({ pageTotalElements: 0 }).countMismatch, { testCaseCount: 1, resultCount: 0 });
  assert.equal(derive({ filters: { ...emptyFilters(), name: '없는 케이스' }, pageTotalElements: 0 }).countMismatch, null);
  assert.equal(derive({ filters: { ...emptyFilters(), evaluationOutcome: 'FALSE_NEGATIVE' }, pageTotalElements: 0 }).countMismatch, null);
  assert.equal(derive({ pageTotalElements: 1 }).countMismatch, null);
  assert.deepEqual(derive({ filters: { ...emptyFilters(), sort: 'name,asc' }, pageTotalElements: 0 }).countMismatch, {
    testCaseCount: 1,
    resultCount: 0,
  });
});

test('확인 필요 필터가 자동 선택돼도 facets의 전체 결과 수로 불일치를 확인한다', () => {
  assert.equal(derive({ attentionTypeCount: 5, pageTotalElements: 0, facetAllResults: 1 }).countMismatch, null);
  assert.deepEqual(derive({ attentionTypeCount: 5, pageTotalElements: 0, facetAllResults: 0 }).countMismatch, {
    testCaseCount: 1,
    resultCount: 0,
  });
  assert.equal(derive({ attentionTypeCount: 5, pageTotalElements: 0, facetAllResults: null }).countMismatch, null);
});

test('필터 종류와 불일치 상태를 함께 반영한 빈 결과 안내를 제공한다', () => {
  assert.equal(derive({ filters: { ...emptyFilters(), name: '없는 케이스' }, pageTotalElements: 0 }).emptyMessage, '현재 필터 조건에 해당하는 케이스가 없습니다.');
  assert.equal(derive({ filters: { ...emptyFilters(), evaluationOutcome: 'FALSE_NEGATIVE' }, pageTotalElements: 0 }).emptyMessage, '이 판정 유형에 해당하는 결과가 없습니다.');
  assert.equal(derive({ attentionTypeCount: 1, pageTotalElements: 0, facetAllResults: 1 }).emptyMessage, '선택한 확인 필요 유형에 해당하는 결과가 없습니다.');
  assert.equal(derive({ filters: { ...emptyFilters(), severity: 'HIGH' }, attentionTypeCount: 1, pageTotalElements: 0 }).emptyMessage, '현재 필터 조건에 해당하는 케이스가 없습니다.');
  assert.equal(derive({ pageTotalElements: 0 }).emptyMessage, '결과 수 불일치를 확인해 주세요.');
  assert.equal(derive().emptyMessage, '표시할 결과가 없습니다.');
});
