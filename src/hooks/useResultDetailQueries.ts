import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../services/apiClient';
import {
  getTestRunEvaluatorMetrics,
  getTestRunResults,
  type EvaluatorMetricsRes,
  type PageMetaRes,
  type TestRunResultAttentionType,
  type TestRunResultFacetsRes,
  type TestRunResultListItemRes,
} from '../services/testRunService';
import type { ResultFilters } from '../components/views/resultFilterPresentation';

const RESULT_PAGE_SIZE = 20;

export const useResultDetailQueries = ({
  runId,
  isFinished,
  page,
  filters,
  attentionTypes,
  allAttentionTypes,
  setPage,
  setAttentionTypes,
  refreshRun,
}: {
  runId?: string;
  isFinished: boolean;
  page: number;
  filters: ResultFilters;
  attentionTypes: TestRunResultAttentionType[];
  allAttentionTypes: TestRunResultAttentionType[];
  setPage: (page: number) => void;
  setAttentionTypes: (types: TestRunResultAttentionType[]) => void;
  refreshRun: () => void;
}) => {
  const [results, setResults] = useState<TestRunResultListItemRes[]>([]);
  const [attentionFacets, setAttentionFacets] = useState<TestRunResultFacetsRes | null>(null);
  const [pageMeta, setPageMeta] = useState<PageMetaRes | null>(null);
  const [evaluatorMetrics, setEvaluatorMetrics] = useState<EvaluatorMetricsRes | null>(null);
  const [loadedMetricsRunId, setLoadedMetricsRunId] = useState<string | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [loadedResultsScopeKey, setLoadedResultsScopeKey] = useState<string | null>(null);
  const [resultsError, setResultsError] = useState<unknown>(null);
  const [metricsError, setMetricsError] = useState<unknown>(null);
  const [notFinishedRaceRunId, setNotFinishedRaceRunId] = useState<string | null>(null);
  const [raceRecoveryExhaustedRunId, setRaceRecoveryExhaustedRunId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const loadedFacetFilterKeyRef = useRef<string | null>(null);
  const attentionInitializedRunIdRef = useRef<string | null>(null);
  const raceRetryCountRef = useRef(0);
  const raceRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filterKey = JSON.stringify({ filters, attentionTypes });
  const scopeKey = `${runId ?? ''}:${filterKey}`;
  const notFinishedRace = notFinishedRaceRunId === runId;
  const raceRecoveryExhausted = raceRecoveryExhaustedRunId === runId;

  const recoverNotFinishedRace = useCallback(() => {
    if (!runId) return;
    setNotFinishedRaceRunId(runId);
    if (raceRetryTimerRef.current) return;
    if (raceRetryCountRef.current >= 3) {
      setRaceRecoveryExhaustedRunId(runId);
      return;
    }
    raceRetryCountRef.current += 1;
    raceRetryTimerRef.current = setTimeout(() => {
      raceRetryTimerRef.current = null;
      setNotFinishedRaceRunId(null);
      setRaceRecoveryExhaustedRunId(null);
      refreshRun();
      setReloadToken((value) => value + 1);
    }, 1000);
  }, [refreshRun, runId]);

  const refreshQueries = useCallback(() => {
    raceRetryCountRef.current = 0;
    if (raceRetryTimerRef.current) clearTimeout(raceRetryTimerRef.current);
    raceRetryTimerRef.current = null;
    loadedFacetFilterKeyRef.current = null;
    setNotFinishedRaceRunId(null);
    setRaceRecoveryExhaustedRunId(null);
    refreshRun();
    setReloadToken((value) => value + 1);
  }, [refreshRun]);

  useEffect(() => {
    raceRetryCountRef.current = 0;
    if (raceRetryTimerRef.current) clearTimeout(raceRetryTimerRef.current);
    raceRetryTimerRef.current = null;
    return () => {
      if (raceRetryTimerRef.current) clearTimeout(raceRetryTimerRef.current);
      raceRetryTimerRef.current = null;
    };
  }, [runId]);

  useEffect(() => {
    if (!runId || !isFinished) return;
    let active = true;
    const loadResults = async () => {
      setResultsLoading(true);
      setResultsError(null);
      const includeFacets = loadedFacetFilterKeyRef.current !== filterKey ? 'attention' : undefined;
      try {
        const nextResults = await getTestRunResults(runId, {
          page,
          size: RESULT_PAGE_SIZE,
          ...(filters.name ? { name: filters.name } : {}),
          ...(filters.input ? { input: filters.input } : {}),
          ...(filters.category ? { category: filters.category } : {}),
          ...(filters.expectedAction ? { expectedAction: filters.expectedAction } : {}),
          ...(filters.severity ? { severity: filters.severity } : {}),
          ...(filters.executionStatus ? { executionStatus: filters.executionStatus } : {}),
          ...(filters.assertionStatus ? { assertionStatus: filters.assertionStatus } : {}),
          ...(filters.evaluationOutcome === 'ALL' ? {} : { evaluationOutcome: filters.evaluationOutcome }),
          ...(filters.sort ? { sort: [filters.sort] } : {}),
          ...(attentionTypes.length ? { attentionType: attentionTypes } : {}),
          ...(includeFacets ? { includeFacets } : {}),
        });
        if (!active) return;
        if (nextResults.items.length === 0
          && nextResults.page.totalElements > 0
          && nextResults.page.totalPages > 0
          && nextResults.page.number > nextResults.page.totalPages) {
          setPage(nextResults.page.totalPages);
          return;
        }
        setResults(nextResults.items);
        setPageMeta(nextResults.page);
        setLoadedResultsScopeKey(scopeKey);
        if (nextResults.facets) {
          setAttentionFacets(nextResults.facets);
          loadedFacetFilterKeyRef.current = filterKey;
          if (attentionInitializedRunIdRef.current !== runId) {
            attentionInitializedRunIdRef.current = runId;
            if (nextResults.facets.attentionTotal > 0) {
              setAttentionTypes(allAttentionTypes);
              setPage(1);
            }
          }
        }
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.code === 'TEST_RUN_NOT_FINISHED') {
          recoverNotFinishedRace();
          setResults([]);
          setPageMeta(null);
          setLoadedResultsScopeKey(null);
        } else {
          setResultsError(error);
        }
      } finally {
        if (active) setResultsLoading(false);
      }
    };
    loadResults();
    return () => { active = false; };
  }, [
    runId, isFinished, reloadToken, page, filters, attentionTypes, filterKey,
    allAttentionTypes, recoverNotFinishedRace, scopeKey, setAttentionTypes, setPage,
  ]);

  useEffect(() => {
    if (!runId || !isFinished) return;
    let active = true;
    const loadMetrics = async () => {
      setMetricsLoading(true);
      setMetricsError(null);
      try {
        const nextMetrics = await getTestRunEvaluatorMetrics(runId);
        if (active) {
          setEvaluatorMetrics(nextMetrics);
          setLoadedMetricsRunId(runId);
        }
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.code === 'TEST_RUN_NOT_FINISHED') {
          recoverNotFinishedRace();
        } else {
          setMetricsError(error);
        }
      } finally {
        if (active) setMetricsLoading(false);
      }
    };
    loadMetrics();
    return () => { active = false; };
  }, [runId, isFinished, reloadToken, recoverNotFinishedRace]);

  return {
    results,
    attentionFacets,
    pageMeta,
    evaluatorMetrics,
    loadedMetricsRunId,
    resultsLoading,
    metricsLoading,
    loadedResultsScopeKey,
    resultsError,
    metricsError,
    notFinishedRace,
    raceRecoveryExhausted,
    refreshQueries,
  };
};
