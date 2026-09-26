import type {
  ComparableTestRunListItemRes,
  ComparableTestRunListRes,
  TestRunComparisonRes,
  TestRunComparisonSummaryRes,
} from '../services/regressionService';

export interface RegressionStore {
  runId: string;
  candidates: ComparableTestRunListItemRes[];
  candidatePage: number;
  candidatePageMeta: ComparableTestRunListRes['page'] | null;
  selectedComparisonId: string;
  selectedAutomatically: boolean;
  candidatesLoading: boolean;
  candidatesError: unknown;
  notFinished: boolean;
  autoRetryCount: number;
  hasLoadedCandidates: boolean;
  candidateReloadToken: number;
  summary: TestRunComparisonSummaryRes | null;
  summaryLoadedKey: string;
  summaryError: unknown;
  summaryErrorKey: string;
  summaryReloadToken: number;
  comparison: TestRunComparisonRes | null;
  comparisonLoadedKey: string;
  comparisonError: unknown;
  comparisonErrorKey: string;
  comparisonReloadToken: number;
}

export const initialRegressionStore = (runId: string): RegressionStore => ({
  runId,
  candidates: [],
  candidatePage: 1,
  candidatePageMeta: null,
  selectedComparisonId: '',
  selectedAutomatically: false,
  candidatesLoading: Boolean(runId),
  candidatesError: null,
  notFinished: false,
  autoRetryCount: 0,
  hasLoadedCandidates: false,
  candidateReloadToken: 0,
  summary: null,
  summaryLoadedKey: '',
  summaryError: null,
  summaryErrorKey: '',
  summaryReloadToken: 0,
  comparison: null,
  comparisonLoadedKey: '',
  comparisonError: null,
  comparisonErrorKey: '',
  comparisonReloadToken: 0,
});

export function comparisonKey(currentRunId: string, comparisonRunId: string) {
  return currentRunId && comparisonRunId ? `${currentRunId}:${comparisonRunId}` : '';
}

export function shouldLoadComparison(requestedKey: string, loadedKey: string, failedKey: string) {
  return Boolean(requestedKey) && requestedKey !== loadedKey && requestedKey !== failedKey;
}

export function shouldLoadSummary(
  loadDetails: boolean,
  requestedKey: string,
  summaryLoadedKey: string,
  summaryFailedKey: string,
  comparisonLoadedKey: string,
) {
  return !loadDetails
    && comparisonLoadedKey !== requestedKey
    && shouldLoadComparison(requestedKey, summaryLoadedKey, summaryFailedKey);
}

export function preserveSelectedCandidate(selectedId: string, candidateIds: string[]) {
  return candidateIds.includes(selectedId) ? selectedId : (candidateIds[0] ?? '');
}

export function shouldRefreshRegressionCandidates(
  candidateCount: number,
  candidatesFailed: boolean,
  notFinished: boolean,
) {
  return candidateCount === 0 || candidatesFailed || notFinished;
}

export function shouldRefreshRegressionAfterRunFinished(
  currentRunId: string,
  finishedRunId: string,
  notFinished: boolean,
) {
  return Boolean(currentRunId) && currentRunId === finishedRunId && notFinished;
}

export function acceptCandidatePage(
  previous: RegressionStore,
  runId: string,
  page: number,
  reloadToken: number,
  response: ComparableTestRunListRes,
): RegressionStore {
  if (previous.runId !== runId || previous.candidatePage !== page || previous.candidateReloadToken !== reloadToken) {
    return previous;
  }
  const candidateIds = response.items.map((candidate) => String(candidate.id));
  const nextSelection = preserveSelectedCandidate(previous.selectedComparisonId, candidateIds);
  const selectionChanged = nextSelection !== previous.selectedComparisonId;
  return {
    ...previous,
    candidates: response.items,
    candidatePageMeta: response.page,
    selectedComparisonId: nextSelection,
    selectedAutomatically: selectionChanged ? Boolean(nextSelection) : previous.selectedAutomatically,
    candidatesLoading: false,
    candidatesError: null,
    notFinished: false,
    autoRetryCount: 0,
    hasLoadedCandidates: true,
    ...(selectionChanged ? clearComparisonQueries() : {}),
  };
}

export function markCandidatesNotFinished(
  previous: RegressionStore,
  runId: string,
  page: number,
  reloadToken: number,
  retryCount: number,
): RegressionStore {
  if (previous.runId !== runId || previous.candidatePage !== page || previous.candidateReloadToken !== reloadToken) {
    return previous;
  }
  return {
    ...previous,
    candidatesLoading: false,
    candidatesError: null,
    notFinished: true,
    autoRetryCount: retryCount,
    hasLoadedCandidates: true,
  };
}

export function failCandidatePage(
  previous: RegressionStore,
  runId: string,
  page: number,
  reloadToken: number,
  error: unknown,
): RegressionStore {
  if (previous.runId !== runId || previous.candidatePage !== page || previous.candidateReloadToken !== reloadToken) {
    return previous;
  }
  return { ...previous, candidatesLoading: false, candidatesError: error };
}

export function acceptSummary(
  previous: RegressionStore,
  runId: string,
  requestKey: string,
  reloadToken: number,
  summary: TestRunComparisonSummaryRes,
): RegressionStore {
  if (!matchesComparisonRequest(previous, runId, requestKey, 'summary', reloadToken)) return previous;
  return { ...previous, summary, summaryLoadedKey: requestKey, summaryError: null, summaryErrorKey: '' };
}

export function failSummary(
  previous: RegressionStore,
  runId: string,
  requestKey: string,
  reloadToken: number,
  error: unknown,
): RegressionStore {
  if (!matchesComparisonRequest(previous, runId, requestKey, 'summary', reloadToken)) return previous;
  return { ...previous, summary: null, summaryLoadedKey: '', summaryError: error, summaryErrorKey: requestKey };
}

export function acceptComparison(
  previous: RegressionStore,
  runId: string,
  requestKey: string,
  reloadToken: number,
  comparison: TestRunComparisonRes,
): RegressionStore {
  if (!matchesComparisonRequest(previous, runId, requestKey, 'comparison', reloadToken)) return previous;
  return { ...previous, comparison, comparisonLoadedKey: requestKey, comparisonError: null, comparisonErrorKey: '' };
}

export function failComparison(
  previous: RegressionStore,
  runId: string,
  requestKey: string,
  reloadToken: number,
  error: unknown,
): RegressionStore {
  if (!matchesComparisonRequest(previous, runId, requestKey, 'comparison', reloadToken)) return previous;
  return { ...previous, comparison: null, comparisonLoadedKey: '', comparisonError: error, comparisonErrorKey: requestKey };
}

export function selectComparison(previous: RegressionStore, runId: string, comparisonRunId: string): RegressionStore {
  if (previous.runId !== runId) return previous;
  return {
    ...previous,
    selectedComparisonId: comparisonRunId,
    selectedAutomatically: false,
    ...clearComparisonQueries(),
  };
}

export function changeCandidatePage(
  previous: RegressionStore,
  runId: string,
  page: number | ((current: number) => number),
): RegressionStore {
  if (previous.runId !== runId) return previous;
  const nextPage = typeof page === 'function' ? page(previous.candidatePage) : page;
  return {
    ...previous,
    candidatePage: nextPage,
    candidatesLoading: true,
    candidatesError: null,
    candidateReloadToken: previous.candidateReloadToken + 1,
  };
}

export function refreshCandidates(previous: RegressionStore, runId: string): RegressionStore {
  if (previous.runId !== runId) return previous;
  return {
    ...previous,
    candidatesLoading: Boolean(runId),
    candidatesError: null,
    notFinished: false,
    autoRetryCount: 0,
    candidateReloadToken: previous.candidateReloadToken + 1,
  };
}

export function refreshSummary(previous: RegressionStore, runId: string): RegressionStore {
  if (previous.runId !== runId) return previous;
  return { ...previous, summary: null, summaryLoadedKey: '', summaryError: null, summaryErrorKey: '', summaryReloadToken: previous.summaryReloadToken + 1 };
}

export function refreshComparison(previous: RegressionStore, runId: string): RegressionStore {
  if (previous.runId !== runId) return previous;
  return { ...previous, comparison: null, comparisonLoadedKey: '', comparisonError: null, comparisonErrorKey: '', comparisonReloadToken: previous.comparisonReloadToken + 1 };
}

function clearComparisonQueries() {
  return {
    summary: null,
    summaryLoadedKey: '',
    summaryError: null,
    summaryErrorKey: '',
    comparison: null,
    comparisonLoadedKey: '',
    comparisonError: null,
    comparisonErrorKey: '',
  };
}

function matchesComparisonRequest(
  previous: RegressionStore,
  runId: string,
  requestKey: string,
  query: 'summary' | 'comparison',
  reloadToken: number,
) {
  const selectedKey = comparisonKey(previous.runId, previous.selectedComparisonId);
  const currentReloadToken = query === 'summary' ? previous.summaryReloadToken : previous.comparisonReloadToken;
  return previous.runId === runId && selectedKey === requestKey && currentReloadToken === reloadToken;
}
