import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../services/apiClient';
import {
  getComparableTestRuns,
  getTestRunComparison,
  getTestRunComparisonSummary,
  type ComparableTestRunListItemRes,
  type ComparableTestRunListRes,
  type TestRunComparisonRes,
  type TestRunComparisonSummaryRes,
} from '../services/regressionService';
import {
  acceptCandidatePage,
  acceptComparison,
  acceptSummary,
  changeCandidatePage,
  comparisonKey,
  failCandidatePage,
  failComparison,
  failSummary,
  initialRegressionStore,
  markCandidatesNotFinished,
  refreshCandidates as refreshCandidatesStore,
  refreshComparison as refreshComparisonStore,
  refreshSummary as refreshSummaryStore,
  selectComparison as selectComparisonStore,
  shouldLoadComparison,
  shouldLoadSummary,
  shouldRefreshRegressionCandidates,
  type RegressionStore,
} from './regressionComparisonState';

const AUTO_RETRY_LIMIT = 5;
const AUTO_RETRY_DELAY_MS = 2000;

export interface RegressionSummaryState {
  runId: string;
  selectedCandidate: ComparableTestRunListItemRes | undefined;
  selectedAutomatically: boolean;
  summary: TestRunComparisonSummaryRes | null;
  loading: boolean;
  error: unknown;
  notFinished: boolean;
  hasLoadedCandidates: boolean;
  hasComparableRun: boolean;
  retry: () => void;
}

export interface RegressionDetailState {
  runId: string;
  candidates: ComparableTestRunListItemRes[];
  candidatePageMeta: ComparableTestRunListRes['page'] | null;
  selectedComparisonId: string;
  selectedCandidate: ComparableTestRunListItemRes | undefined;
  selectedAutomatically: boolean;
  comparison: TestRunComparisonRes | null;
  candidatesLoading: boolean;
  comparisonLoading: boolean;
  candidatesError: unknown;
  comparisonError: unknown;
  notFinished: boolean;
  autoRetryExhausted: boolean;
  hasLoadedCandidates: boolean;
  setCandidatePage: (page: number | ((current: number) => number)) => void;
  selectComparison: (runId: string) => void;
  refreshCandidates: () => void;
  refreshComparison: () => void;
}

export interface RegressionComparisonState {
  summary: RegressionSummaryState;
  detail: RegressionDetailState;
}

export function useRegressionComparison(runId: string, loadDetails: boolean): RegressionComparisonState {
  const [store, setStore] = useState<RegressionStore>(() => initialRegressionStore(runId));
  const retryRunIdRef = useRef(runId);
  const autoRetryCountRef = useRef(0);

  // 새 Run을 commit하기 전에 저장소를 교체해 이전 Run의 요약이 한 프레임 노출되지 않게 한다.
  if (store.runId !== runId) {
    setStore(initialRegressionStore(runId));
  }

  const current = store.runId === runId ? store : initialRegressionStore(runId);
  const selectedKey = comparisonKey(runId, current.selectedComparisonId);

  useEffect(() => {
    if (!runId) return;
    if (retryRunIdRef.current !== runId) {
      retryRunIdRef.current = runId;
      autoRetryCountRef.current = 0;
    }
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const requestPage = current.candidatePage;
    const requestReloadToken = current.candidateReloadToken;

    getComparableTestRuns(runId, { page: requestPage, size: 20 })
      .then((response) => {
        if (!active) return;
        autoRetryCountRef.current = 0;
        setStore((previous) => acceptCandidatePage(previous, runId, requestPage, requestReloadToken, response));
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.code === 'TEST_RUN_NOT_FINISHED') {
          const nextRetryCount = autoRetryCountRef.current + 1;
          autoRetryCountRef.current = nextRetryCount;
          setStore((previous) => markCandidatesNotFinished(
            previous, runId, requestPage, requestReloadToken, nextRetryCount,
          ));
          if (nextRetryCount < AUTO_RETRY_LIMIT) {
            retryTimer = setTimeout(() => {
              if (!active) return;
              setStore((latest) => latest.runId === runId ? {
                ...latest,
                candidatesLoading: true,
                candidateReloadToken: latest.candidateReloadToken + 1,
              } : latest);
            }, AUTO_RETRY_DELAY_MS);
          }
          return;
        }
        setStore((previous) => failCandidatePage(previous, runId, requestPage, requestReloadToken, error));
      });

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [runId, current.candidatePage, current.candidateReloadToken]);

  const summaryNeedsLoad = shouldLoadSummary(
    loadDetails,
    selectedKey,
    current.summaryLoadedKey,
    current.summaryErrorKey,
    current.comparisonLoadedKey,
  );
  useEffect(() => {
    if (!summaryNeedsLoad) return;
    let active = true;
    const requestKey = selectedKey;
    const requestReloadToken = current.summaryReloadToken;
    getTestRunComparisonSummary(runId, current.selectedComparisonId)
      .then((summary) => {
        if (!active) return;
        setStore((previous) => acceptSummary(previous, runId, requestKey, requestReloadToken, summary));
      })
      .catch((error) => {
        if (!active) return;
        setStore((previous) => failSummary(previous, runId, requestKey, requestReloadToken, error));
      });
    return () => { active = false; };
  }, [loadDetails, runId, current.selectedComparisonId, current.summaryReloadToken, selectedKey, summaryNeedsLoad]);

  const comparisonNeedsLoad = loadDetails
    && shouldLoadComparison(selectedKey, current.comparisonLoadedKey, current.comparisonErrorKey);
  useEffect(() => {
    if (!comparisonNeedsLoad) return;
    let active = true;
    const requestKey = selectedKey;
    const requestReloadToken = current.comparisonReloadToken;
    getTestRunComparison(runId, current.selectedComparisonId)
      .then((comparison) => {
        if (!active) return;
        setStore((previous) => acceptComparison(previous, runId, requestKey, requestReloadToken, comparison));
      })
      .catch((error) => {
        if (!active) return;
        setStore((previous) => failComparison(previous, runId, requestKey, requestReloadToken, error));
      });
    return () => { active = false; };
  }, [loadDetails, runId, current.selectedComparisonId, current.comparisonReloadToken, selectedKey, comparisonNeedsLoad]);

  const selectedCandidate = useMemo(
    () => current.candidates.find((candidate) => String(candidate.id) === current.selectedComparisonId),
    [current.candidates, current.selectedComparisonId],
  );
  const refreshCandidates = () => {
    autoRetryCountRef.current = 0;
    setStore((previous) => refreshCandidatesStore(previous, runId));
  };
  const refreshSummary = () => setStore((previous) => refreshSummaryStore(previous, runId));
  const refreshComparison = () => setStore((previous) => refreshComparisonStore(previous, runId));

  const candidatesLoading = current.candidatesLoading;
  const summaryError = current.candidatesError
    ?? (current.summaryErrorKey === selectedKey ? current.summaryError : null);
  const visibleSummary = current.comparisonLoadedKey === selectedKey
    ? current.comparison
    : current.summaryLoadedKey === selectedKey ? current.summary : null;
  return {
    summary: {
      runId: current.runId,
      selectedCandidate,
      selectedAutomatically: current.selectedAutomatically,
      summary: visibleSummary,
      loading: candidatesLoading || summaryNeedsLoad,
      error: summaryError,
      notFinished: current.notFinished,
      hasLoadedCandidates: current.hasLoadedCandidates,
      hasComparableRun: current.candidates.length > 0,
      retry: shouldRefreshRegressionCandidates(
        current.candidates.length,
        current.candidatesError !== null,
        current.notFinished,
      ) ? refreshCandidates : refreshSummary,
    },
    detail: {
      runId: current.runId,
      candidates: current.candidates,
      candidatePageMeta: current.candidatePageMeta,
      selectedComparisonId: current.selectedComparisonId,
      selectedCandidate,
      selectedAutomatically: current.selectedAutomatically,
      comparison: current.comparisonLoadedKey === selectedKey ? current.comparison : null,
      candidatesLoading,
      comparisonLoading: candidatesLoading || (loadDetails && comparisonNeedsLoad),
      candidatesError: current.candidatesError,
      comparisonError: current.comparisonErrorKey === selectedKey ? current.comparisonError : null,
      notFinished: current.notFinished,
      autoRetryExhausted: current.notFinished && current.autoRetryCount >= AUTO_RETRY_LIMIT,
      hasLoadedCandidates: current.hasLoadedCandidates,
      setCandidatePage: (page) => setStore((previous) => changeCandidatePage(previous, runId, page)),
      selectComparison: (nextRunId) => setStore((previous) => selectComparisonStore(previous, runId, nextRunId)),
      refreshCandidates,
      refreshComparison,
    },
  };
}
