import type {
  Action,
  AssertionStatus,
  EvaluationOutcome,
  Severity,
  TestExecutionResultStatus,
  TestRunResultListItemRes,
} from '../../services/testRunService';

export type OutcomeFilter = 'ALL' | EvaluationOutcome;

export type ResultFilters = {
  name: string;
  input: string;
  category: string;
  expectedAction: '' | 'ALLOW' | 'BLOCK';
  severity: '' | TestRunResultListItemRes['severity'];
  executionStatus: '' | TestRunResultListItemRes['executionStatus'];
  assertionStatus: '' | 'PASS' | 'FAIL';
  evaluationOutcome: OutcomeFilter;
  sort: '' | 'severity,desc' | 'severity,asc' | 'name,asc' | 'name,desc';
};

export const EMPTY_RESULT_FILTERS: ResultFilters = {
  name: '', input: '', category: '', expectedAction: '', severity: '', executionStatus: '',
  assertionStatus: '', evaluationOutcome: 'ALL', sort: '',
};

const parseOption = <Option extends string>(value: string, options: readonly Option[]): Option | null => (
  options.find((option) => option === value) ?? null
);

export const parseExpectedActionFilter = (value: string) => parseOption<Action | ''>(
  value,
  ['', 'ALLOW', 'BLOCK'],
);
export const parseSeverityFilter = (value: string) => parseOption<Severity | ''>(
  value,
  ['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
);
export const parseExecutionStatusFilter = (value: string) => parseOption<TestExecutionResultStatus | ''>(
  value,
  ['', 'SUCCEEDED', 'FAILED', 'TIMED_OUT', 'NOT_STARTED'],
);
export const parseAssertionStatusFilter = (value: string) => parseOption<AssertionStatus | ''>(
  value,
  ['', 'PASS', 'FAIL'],
);
export const parseEvaluationOutcomeFilter = (value: string) => parseOption<OutcomeFilter>(
  value,
  ['ALL', 'FALSE_NEGATIVE', 'FALSE_POSITIVE', 'TRUE_POSITIVE', 'TRUE_NEGATIVE'],
);
export const parseResultSortFilter = (value: string) => parseOption<ResultFilters['sort']>(
  value,
  ['', 'severity,desc', 'severity,asc', 'name,asc', 'name,desc'],
);

const RESULT_NARROWING_FILTER_KEYS = [
  'name',
  'input',
  'category',
  'expectedAction',
  'severity',
  'executionStatus',
  'assertionStatus',
  'evaluationOutcome',
] as const satisfies readonly (keyof ResultFilters)[];

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;
type Assert<Condition extends true> = Condition;

// 필드가 추가되면 결과 범위를 좁히는 필터인지, 정렬처럼 범위와 무관한 값인지 반드시 결정하게 한다.
export type ResultFilterKeyCoverage = Assert<Equal<
  Exclude<keyof ResultFilters, typeof RESULT_NARROWING_FILTER_KEYS[number]>,
  'sort'
>>;

export const hasActiveAdvancedResultFilter = (filters: ResultFilters) => (
  RESULT_NARROWING_FILTER_KEYS.some((key) => (
    key === 'evaluationOutcome' ? filters[key] !== 'ALL' : Boolean(filters[key])
  ))
);

export const hasActiveResultFilter = (
  filters: ResultFilters,
  attentionTypeCount: number,
) => hasActiveAdvancedResultFilter(filters) || attentionTypeCount > 0;

export const deriveResultListPresentation = ({
  filters,
  attentionTypeCount,
  pageTotalElements,
  facetAllResults,
  testCaseCount,
}: {
  filters: ResultFilters;
  attentionTypeCount: number;
  pageTotalElements: number | null;
  facetAllResults: number | null;
  testCaseCount: number | null;
}) => {
  const advancedFiltered = hasActiveAdvancedResultFilter(filters);
  const outcomeFiltered = filters.evaluationOutcome !== 'ALL';
  const attentionFiltered = attentionTypeCount > 0;
  const unfilteredResultCount = advancedFiltered
    ? null
    : facetAllResults ?? (attentionFiltered ? null : pageTotalElements);
  const countMismatch = testCaseCount !== null
    && unfilteredResultCount !== null
    && unfilteredResultCount !== testCaseCount
    ? { testCaseCount, resultCount: unfilteredResultCount }
    : null;

  let emptyMessage = '표시할 결과가 없습니다.';
  const nonOutcomeAdvancedFiltered = RESULT_NARROWING_FILTER_KEYS
    .some((key) => key !== 'evaluationOutcome' && Boolean(filters[key]));
  if (nonOutcomeAdvancedFiltered || (outcomeFiltered && attentionFiltered)) {
    emptyMessage = '현재 필터 조건에 해당하는 케이스가 없습니다.';
  } else if (outcomeFiltered) {
    emptyMessage = '이 판정 유형에 해당하는 결과가 없습니다.';
  } else if (attentionFiltered) {
    emptyMessage = '선택한 확인 필요 유형에 해당하는 결과가 없습니다.';
  } else if (countMismatch) {
    emptyMessage = '결과 수 불일치를 확인해 주세요.';
  }

  return {
    filtered: hasActiveResultFilter(filters, attentionTypeCount),
    countMismatch,
    emptyMessage,
  };
};
