import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Eye, Loader2, RefreshCw, X } from 'lucide-react';
import { ApiError } from '../../services/apiClient';
import {
  getTestRunEvaluatorMetrics,
  getTestRunResults,
  type EvaluationOutcome,
  type EvaluatorMetricsRes,
  type TestRunResultAttentionType,
  type TestRunResultFacetsRes,
  type TestRunResultListItemRes,
  type PageMetaRes,
} from '../../services/testRunService';
import { useLiveRunProgress } from '../../hooks/useLiveRunProgress';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { LAYER_CLASS } from '../../config/layers';
import { RequestErrorBanner } from '../common/RequestErrorBanner';
import { RunProgressStepper } from '../common/RunProgressStepper';
import { StatusPill } from '../common/StatusPill';
import { ActionCode, OptionalActionValue } from '../common/ActionValue';
import { ApplicationResponseEvidence } from './ApplicationResponseEvidence';
import { EVALUATION_OUTCOME_PRESENTATION, evaluationOutcomeLabel } from './evaluationOutcomePresentation';
import { QualityGateEvidence } from './QualityGateEvidence';
import {
  deriveResultListPresentation,
  EMPTY_RESULT_FILTERS,
  parseAssertionStatusFilter,
  parseEvaluationOutcomeFilter,
  parseExecutionStatusFilter,
  parseExpectedActionFilter,
  parseResultSortFilter,
  parseSeverityFilter,
  type OutcomeFilter,
  type ResultFilters,
} from './resultFilterPresentation';
import { resultPageItems } from './resultPaginationPresentation';
import { resultInspectionGuide } from './resultInspectionPresentation';

interface ResultDetailViewProps {
  selectedRunId?: string;
  onGoNewRun: () => void;
  onRunFinished?: (runId: string) => boolean;
  onRefreshRegression?: () => void;
  regressionRefreshing?: boolean;
  regressionSummary?: React.ReactNode;
}

const RESULT_PAGE_SIZE = 20;

const executionLabel = (status: TestRunResultListItemRes['executionStatus']) => ({
  SUCCEEDED: '정상 처리', FAILED: '처리 실패', TIMED_OUT: '시간 초과', NOT_STARTED: '미실행',
}[status]);

const severityPresentation: Record<TestRunResultListItemRes['severity'], { label: string; className: string }> = {
  CRITICAL: { label: 'CRITICAL', className: 'bg-[#a8322d] text-white' },
  HIGH: { label: 'HIGH', className: 'bg-[#fff0ef] text-[#a8322d]' },
  MEDIUM: { label: 'MEDIUM', className: 'bg-[#fff7e8] text-[#8a570f]' },
  LOW: { label: 'LOW', className: 'bg-[#eef1f4] text-[#586473]' },
};

const errorStageLabel = (stage: NonNullable<TestRunResultListItemRes['error']>['stage']) => (
  stage === 'APPLICATION_TARGET' ? '대상 애플리케이션 실행' : '판정 처리'
);

const ATTENTION_TYPES: Array<{ type: TestRunResultAttentionType; label: string; tone: string }> = [
  { type: 'FALSE_NEGATIVE', label: EVALUATION_OUTCOME_PRESENTATION.FALSE_NEGATIVE.label, tone: 'border-[#f4c7c3] bg-[#fff0ef] text-[#a8322d]' },
  { type: 'FALSE_POSITIVE', label: EVALUATION_OUTCOME_PRESENTATION.FALSE_POSITIVE.label, tone: 'border-[#f0ddb0] bg-[#fff7e8] text-[#9a5c0a]' },
  { type: 'EXECUTION_FAILED', label: '처리 실패', tone: 'border-[#dfe5e9] bg-[#f6f8f9] text-[#43515d]' },
  { type: 'TIMED_OUT', label: '시간 초과', tone: 'border-[#dfe5e9] bg-[#f6f8f9] text-[#43515d]' },
  { type: 'NOT_STARTED', label: '미실행', tone: 'border-[#dfe5e9] bg-[#f6f8f9] text-[#43515d]' },
];

const OUTCOME_FILTERS: Array<{ value: OutcomeFilter; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'FALSE_NEGATIVE', label: evaluationOutcomeLabel('FALSE_NEGATIVE') },
  { value: 'FALSE_POSITIVE', label: evaluationOutcomeLabel('FALSE_POSITIVE') },
  { value: 'TRUE_POSITIVE', label: evaluationOutcomeLabel('TRUE_POSITIVE') },
  { value: 'TRUE_NEGATIVE', label: evaluationOutcomeLabel('TRUE_NEGATIVE') },
];

const percentageLabel = (rate: number) => `${(Math.floor(rate * 10_000) / 100).toFixed(2)}%`;

const rateLabel = (rate: number | null) => rate === null ? '분모 없음' : percentageLabel(rate);

const metricCount = (metrics: EvaluatorMetricsRes | null, outcome: EvaluationOutcome) => {
  if (!metrics) return null;
  return {
    TRUE_POSITIVE: metrics.truePositive,
    TRUE_NEGATIVE: metrics.trueNegative,
    FALSE_POSITIVE: metrics.falsePositive,
    FALSE_NEGATIVE: metrics.falseNegative,
  }[outcome];
};

const SummaryMetric = ({ label, value, tone = 'neutral', onClick }: {
  label: string;
  value: number | null;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
}) => {
  const toneClass = {
    neutral: 'text-[#17202a]',
    success: 'text-[#146c4c]',
    warning: 'text-[#9a5c0a]',
    danger: 'text-[#a8322d]',
  }[tone];
  const cardClassName = 'flex min-h-[78px] h-full w-full flex-col justify-center rounded-xl border border-[#e5e9ee] bg-white/90 p-3 text-left';
  const content = <>
    <span className="text-[11px] font-bold text-[#697586]">{label}</span>
    <strong className={`mt-1 text-2xl font-black ${toneClass}`}>{value ?? '—'}{value !== null && <span className="ml-0.5 text-xs font-bold">건</span>}</strong>
  </>;
  return onClick
    ? <button type="button" onClick={onClick} className={`${cardClassName} appearance-none transition hover:border-[#b8c2ca] focus:outline-none focus:ring-2 focus:ring-[#17202a]`}>{content}</button>
    : <div className={cardClassName}>{content}</div>;
};

const MatrixCell = ({ outcome, count, rate }: {
  outcome: EvaluationOutcome;
  count: number | null;
  rate?: number | null;
}) => {
  const presentation = EVALUATION_OUTCOME_PRESENTATION[outcome];
  return <div className={`min-w-[150px] rounded-xl border p-4 ${presentation.cellClassName}`}>
    <div className="flex items-start justify-between gap-2">
      <span className={`text-sm font-black ${presentation.labelClassName}`}>{presentation.label}</span>
      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-black text-[#697586]">{presentation.shortCode}</span>
    </div>
    <strong className={`mt-2 block text-2xl ${presentation.labelClassName}`}>{count ?? '—'}{count !== null && <span className="ml-0.5 text-xs">건</span>}</strong>
    <span className="mt-1 block text-[11px] text-[#586473]">{presentation.transition}</span>
    {rate !== undefined && <span className="mt-1 block text-[10px] text-[#697586]">비율 {rateLabel(rate)}</span>}
  </div>;
};

const ResultMeaning = ({ item }: { item: TestRunResultListItemRes }) => {
  const presentation = item.evaluationOutcome ? EVALUATION_OUTCOME_PRESENTATION[item.evaluationOutcome] : null;
  const attention = item.attentionType
    ? ATTENTION_TYPES.find(({ type }) => type === item.attentionType) : null;
  return presentation
    ? <><b className={`block text-sm ${presentation.labelClassName}`}>{presentation.label} <span className="text-[10px] text-[#697586]">{presentation.shortCode}</span></b><span className="mt-1 block text-[#586473]">{presentation.transition}</span></>
    : <><b className="block text-sm text-[#586473]">{attention?.label ?? '판정 미완료'}</b><span className="mt-1 block text-[#697586]">{executionLabel(item.executionStatus)}로 판정을 확인할 수 없습니다.</span></>;
};
export const ResultDetailView: React.FC<ResultDetailViewProps> = ({
  selectedRunId,
  onGoNewRun,
  onRunFinished,
  onRefreshRegression,
  regressionRefreshing = false,
  regressionSummary,
}) => {
  const [results, setResults] = useState<TestRunResultListItemRes[]>([]);
  const [resultPage, setResultPage] = useState(1);
  const [filters, setFilters] = useState<ResultFilters>(EMPTY_RESULT_FILTERS);
  const [attentionTypes, setAttentionTypes] = useState<TestRunResultAttentionType[]>([]);
  const [attentionFacets, setAttentionFacets] = useState<TestRunResultFacetsRes | null>(null);
  const loadedFacetFilterKeyRef = useRef<string | null>(null);
  const attentionInitializedRunIdRef = useRef<string | null>(null);
  const [pageMeta, setPageMeta] = useState<PageMetaRes | null>(null);
  const [evaluatorMetrics, setEvaluatorMetrics] = useState<EvaluatorMetricsRes | null>(null);
  const [loadedMetricsRunId, setLoadedMetricsRunId] = useState<string | null>(null);
  const [selected, setSelected] = useState<TestRunResultListItemRes | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [loadedResultsScopeKey, setLoadedResultsScopeKey] = useState<string | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [notFinishedRaceRunId, setNotFinishedRaceRunId] = useState<string | null>(null);
  const [raceRecoveryExhaustedRunId, setRaceRecoveryExhaustedRunId] = useState<string | null>(null);
  const [resultsError, setResultsError] = useState<unknown>(null);
  const [metricsError, setMetricsError] = useState<unknown>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const raceRetryCountRef = useRef(0);
  const raceRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 같은 Run의 FINISHED 관측으로 Regression 조회를 한 번만 재개한다. 이후 callback identity가
  // 바뀌어 effect가 다시 실행돼도 재시도 예산을 반복해서 초기화하지 않는다.
  const notifiedFinishedRunIdRef = useRef<string | null>(null);
  const {
    detail,
    error: detailError,
    stale: detailStale,
    autoRefreshStopped,
    isLoading: detailLoading,
    isRefreshing: detailRefreshing,
    refresh: refreshDetail,
  } = useLiveRunProgress({ runId: selectedRunId ?? null });

  useEffect(() => {
    if (!selectedRunId || detail?.status !== 'FINISHED' || String(detail.id) !== selectedRunId) return;
    if (notifiedFinishedRunIdRef.current === selectedRunId) return;
    const regressionRefreshed = onRunFinished?.(selectedRunId) ?? false;
    if (regressionRefreshed) notifiedFinishedRunIdRef.current = selectedRunId;
  }, [detail?.id, detail?.status, onRunFinished, selectedRunId]);

  const closeResultDialog = useCallback(() => setSelected(null), []);
  const resultDialogRef = useDialogFocus({ isOpen: selected !== null, onClose: closeResultDialog });
  const notFinishedRace = notFinishedRaceRunId === selectedRunId;
  const raceRecoveryExhausted = raceRecoveryExhaustedRunId === selectedRunId;
  const resultFilterKey = JSON.stringify({ filters, attentionTypes });
  const resultScopeKey = `${selectedRunId ?? ''}:${resultFilterKey}`;
  // 같은 Run과 필터 안의 페이지 이동에서는 이전 페이지를 유지해 목록 높이와 스크롤을 안정화한다.
  const hasLoadedResults = loadedResultsScopeKey === resultScopeKey;
  const visibleResults = hasLoadedResults ? results : [];
  const visiblePageMeta = hasLoadedResults ? pageMeta : null;
  const resultListPresentation = deriveResultListPresentation({
    filters,
    attentionTypeCount: attentionTypes.length,
    pageTotalElements: visiblePageMeta?.totalElements ?? null,
    facetAllResults: visiblePageMeta ? attentionFacets?.allResults ?? null : null,
    testCaseCount: detail?.testCaseCount ?? null,
  });

  const selectAttentionTypes = useCallback((nextTypes: TestRunResultAttentionType[]) => {
    setAttentionTypes(nextTypes);
    setResultPage(1);
  }, []);

  const toggleAttentionType = useCallback((type: TestRunResultAttentionType) => {
    setAttentionTypes((current) => current.includes(type)
      ? current.filter((currentType) => currentType !== type)
      : [...current, type]);
    setResultPage(1);
  }, []);

  const recoverNotFinishedRace = useCallback(() => {
    if (!selectedRunId) return;
    setNotFinishedRaceRunId(selectedRunId);
    if (raceRetryTimerRef.current) return;
    if (raceRetryCountRef.current >= 3) {
      setRaceRecoveryExhaustedRunId(selectedRunId);
      return;
    }
    raceRetryCountRef.current += 1;
    raceRetryTimerRef.current = setTimeout(() => {
      raceRetryTimerRef.current = null;
      setNotFinishedRaceRunId(null);
      setRaceRecoveryExhaustedRunId(null);
      refreshDetail();
      setReloadToken((value) => value + 1);
    }, 1000);
  }, [refreshDetail, selectedRunId]);

  useEffect(() => {
    raceRetryCountRef.current = 0;
    if (raceRetryTimerRef.current) clearTimeout(raceRetryTimerRef.current);
    raceRetryTimerRef.current = null;
    return () => {
      if (raceRetryTimerRef.current) clearTimeout(raceRetryTimerRef.current);
      raceRetryTimerRef.current = null;
    };
  }, [selectedRunId]);

  const refreshAll = () => {
    raceRetryCountRef.current = 0;
    if (raceRetryTimerRef.current) clearTimeout(raceRetryTimerRef.current);
    raceRetryTimerRef.current = null;
    loadedFacetFilterKeyRef.current = null;
    setNotFinishedRaceRunId(null);
    setRaceRecoveryExhaustedRunId(null);
    refreshDetail();
    setReloadToken((value) => value + 1);
    onRefreshRegression?.();
  };

  useEffect(() => {
    if (!selectedRunId || detail?.status !== 'FINISHED') return;
    let active = true;
    const loadResults = async () => {
      setResultsLoading(true);
      setResultsError(null);
      const includeFacets = loadedFacetFilterKeyRef.current !== resultFilterKey ? 'attention' : undefined;
      try {
        const nextResults = await getTestRunResults(selectedRunId, {
          page: resultPage,
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
        if (active) {
          // 필터 결과가 줄어 현재 페이지가 범위를 벗어나면 마지막 유효 페이지를 다시 조회한다.
          if (nextResults.items.length === 0
            && nextResults.page.totalElements > 0
            && nextResults.page.totalPages > 0
            && nextResults.page.number > nextResults.page.totalPages) {
            setResultPage(nextResults.page.totalPages);
            return;
          }
          setResults(nextResults.items);
          setPageMeta(nextResults.page);
          setLoadedResultsScopeKey(resultScopeKey);
          if (nextResults.facets) {
            setAttentionFacets(nextResults.facets);
            loadedFacetFilterKeyRef.current = resultFilterKey;
            if (attentionInitializedRunIdRef.current !== selectedRunId) {
              attentionInitializedRunIdRef.current = selectedRunId;
              if (nextResults.facets.attentionTotal > 0) {
                setAttentionTypes(ATTENTION_TYPES.map(({ type }) => type));
                setResultPage(1);
              }
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
    selectedRunId, reloadToken, detail?.status, resultPage, filters, attentionTypes,
    resultFilterKey,
    recoverNotFinishedRace, resultScopeKey,
  ]);

  useEffect(() => {
    if (!selectedRunId || detail?.status !== 'FINISHED') return;
    let active = true;
    const loadMetrics = async () => {
      setMetricsLoading(true);
      setMetricsError(null);
      try {
        const nextMetrics = await getTestRunEvaluatorMetrics(selectedRunId);
        if (active) {
          setEvaluatorMetrics(nextMetrics);
          setLoadedMetricsRunId(selectedRunId);
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
  }, [selectedRunId, reloadToken, detail?.status, recoverNotFinishedRace]);

  const notFinished = detail?.status !== 'FINISHED' || notFinishedRace;
  const refreshInProgress = detailLoading
    || detailRefreshing
    || resultsLoading
    || metricsLoading
    || regressionRefreshing;

  if (!detailLoading && detailError && !detail) {
    return <section className="space-y-6 animate-rise">
      <h1 className="text-3xl font-extrabold text-[#17202a]">테스트 결과 상세</h1>
      {autoRefreshStopped && <div className="rounded-xl border border-[#f0ddb0] bg-[#fff7e8] px-4 py-3 text-xs font-bold text-[#78501b]">자동 갱신이 중단됐습니다. 다시 시도를 눌러주세요.</div>}
      <RequestErrorBanner error={detailError} fallbackMessage="테스트 실행 상세를 불러오지 못했습니다." onRetry={refreshAll} />
    </section>;
  }

  const gateStatus = detail?.qualityGate?.status ?? 'NOT_EVALUATED_BEFORE_FINISH';
  const metrics = detail?.qualityGate?.metrics ?? null;
  const visibleEvaluatorMetrics = loadedMetricsRunId === selectedRunId ? evaluatorMetrics : null;
  const evaluatedCount = visibleEvaluatorMetrics
    ? visibleEvaluatorMetrics.truePositive + visibleEvaluatorMetrics.trueNegative + visibleEvaluatorMetrics.falsePositive + visibleEvaluatorMetrics.falseNegative
    : null;
  const normalCount = visibleEvaluatorMetrics
    ? visibleEvaluatorMetrics.truePositive + visibleEvaluatorMetrics.trueNegative
    : null;
  const mismatchCount = attentionFacets
    ? attentionFacets.attentionTypes.FALSE_NEGATIVE + attentionFacets.attentionTypes.FALSE_POSITIVE
    : visibleEvaluatorMetrics
      ? visibleEvaluatorMetrics.falsePositive + visibleEvaluatorMetrics.falseNegative : null;
  const incompleteCount = attentionFacets
    ? attentionFacets.attentionTypes.EXECUTION_FAILED
      + attentionFacets.attentionTypes.TIMED_OUT
      + attentionFacets.attentionTypes.NOT_STARTED
    : detail && evaluatedCount !== null
      ? Math.max(0, detail.testCaseCount - evaluatedCount) : null;
  const attentionCount = attentionFacets?.attentionTotal
    ?? (mismatchCount !== null && incompleteCount !== null ? mismatchCount + incompleteCount : null);
  const summaryDescription = notFinished
    ? '실행이 끝나면 판정 결과와 확인이 필요한 케이스를 집계합니다.'
    : gateStatus === 'NOT_EVALUATED'
      ? `${detail?.testCaseCount ?? 0}건 중 기대 일치 여부를 판정할 수 있는 결과가 없어 판정을 완료하지 못했습니다.`
      : attentionCount === null
        ? '결과 집계를 불러오는 중입니다.'
        : attentionCount === 0
          ? `${detail?.testCaseCount ?? 0}건 모두 기대한 동작과 일치했습니다.`
          : `${detail?.testCaseCount ?? 0}건 중 ${attentionCount}건을 확인해야 합니다.`;
  const attentionDescription = !notFinished && attentionCount !== null && attentionCount > 0
    ? `판정 불일치 ${mismatchCount}건 · 판정 미완료 ${incompleteCount}건`
    : null;
  const missingGateMetricsDescription = !detail ? 'Quality Gate 정보를 불러오는 중입니다.' : undefined;
  const selectedInspectionGuide = selected ? resultInspectionGuide(selected) : null;

  return <section className="space-y-6 animate-rise">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <div className="mb-1.5 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#1a7f5a]">
          <span>Run #{detail?.id ?? selectedRunId ?? '—'}</span><StatusPill kind="progress" status={detail?.status ?? 'QUEUED'} />
          {detailLoading && <Loader2 size={13} className="animate-spin" />}
        </div>
        <h1 className="text-2xl font-extrabold text-[#17202a] sm:text-3xl">테스트 결과 상세</h1>
        <p className="mt-1.5 text-sm text-[#697586]">Suite #{detail?.testSuiteId ?? '—'} · {detail?.testCaseCount ?? 0} snapshots</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={refreshAll} disabled={refreshInProgress} aria-busy={refreshInProgress} className="inline-flex items-center gap-2 rounded-xl border border-[#e5e9ee] bg-white px-4 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw size={14} className={refreshInProgress ? 'animate-spin' : undefined} />{refreshInProgress ? '새로고침 중' : '새로고침'}</button>
        <button type="button" onClick={onGoNewRun} className="rounded-xl bg-[#17202a] px-4 py-2 text-xs font-bold text-white">다시 실행</button>
      </div>
    </header>

    {regressionSummary}

    {notFinishedRace && !detailLoading
      ? <div className="flex items-center gap-2 rounded-xl border border-[#f0ddb0] bg-[#fff7e8] px-4 py-3 text-xs text-[#78501b]"><AlertCircle size={14} />{raceRecoveryExhausted ? '결과 준비 상태를 확인하지 못했습니다. 다시 시도해 주세요.' : '실행은 종료됐지만 결과가 아직 준비되지 않았습니다. 자동으로 다시 확인하고 있습니다.'}</div>
      : detail && !detailLoading && detail.status !== 'FINISHED' && <RunProgressStepper status={detail.status} processedCount={detail.progress.processedTestCaseCount} totalCount={detail.testCaseCount} percent={detail.progress.percent} updatedAt={detail.updatedAt} />}
    {autoRefreshStopped && detail && !detailLoading && <div className="rounded-xl border border-[#f0ddb0] bg-[#fff7e8] px-4 py-3 text-xs font-bold text-[#78501b]">자동 갱신이 중단됐습니다. 다시 시도를 눌러주세요.</div>}
    {detailError !== null && detail && !detailLoading && <RequestErrorBanner error={detailError} fallbackMessage="최신 실행 상세를 불러오지 못했습니다." stale={detailStale} onRetry={refreshAll} />}
    {resultsError !== null && !resultsLoading && <RequestErrorBanner error={resultsError} fallbackMessage="Snapshot 결과를 불러오지 못했습니다." stale={hasLoadedResults} onRetry={refreshAll} />}
    {metricsError !== null && !metricsLoading && <RequestErrorBanner error={metricsError} fallbackMessage="판정 지표를 불러오지 못했습니다." stale={loadedMetricsRunId === selectedRunId && evaluatorMetrics !== null} onRetry={refreshAll} />}

    <QualityGateEvidence
      status={detail?.qualityGate?.status ?? null}
      metrics={metrics}
      summaryDescription={summaryDescription}
      attentionDescription={attentionDescription}
      missingMetricsDescription={missingGateMetricsDescription}
    >
        <div aria-label="판정 요약" className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric label="정상 판정" value={normalCount} tone="success" />
          <SummaryMetric label={EVALUATION_OUTCOME_PRESENTATION.FALSE_NEGATIVE.label} value={attentionFacets?.attentionTypes.FALSE_NEGATIVE ?? visibleEvaluatorMetrics?.falseNegative ?? null} tone="danger" onClick={() => selectAttentionTypes(['FALSE_NEGATIVE'])} />
          <SummaryMetric label={EVALUATION_OUTCOME_PRESENTATION.FALSE_POSITIVE.label} value={attentionFacets?.attentionTypes.FALSE_POSITIVE ?? visibleEvaluatorMetrics?.falsePositive ?? null} tone="warning" onClick={() => selectAttentionTypes(['FALSE_POSITIVE'])} />
          <SummaryMetric label="판정 미완료" value={incompleteCount} onClick={() => selectAttentionTypes(['EXECUTION_FAILED', 'TIMED_OUT', 'NOT_STARTED'])} />
        </div>
    </QualityGateEvidence>

    {detail?.status === 'FINISHED' && !notFinishedRace && !detailLoading && <RunProgressStepper status={detail.status} processedCount={detail.progress.processedTestCaseCount} totalCount={detail.testCaseCount} percent={detail.progress.percent} updatedAt={detail.updatedAt} compact />}

    <article className="rounded-2xl border border-[#e5e9ee] bg-white p-5">
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div><h2 className="text-sm font-bold">기대·관측 동작 매트릭스</h2><p className="mt-1 text-xs text-[#697586]">기대 동작과 관측된 동작의 관계를 의미 중심으로 보여줍니다.</p></div>
        <span className="text-xs font-bold text-[#43515d]">평가 완료 {evaluatedCount ?? '—'}건</span>
      </div>
      {notFinished
        ? <p className="rounded-xl bg-[#f6f8f9] p-4 text-xs text-[#697586]">실행 완료 후 판정 매트릭스가 표시됩니다.</p>
        : <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-2 text-left">
            <caption className="sr-only">행은 기대 동작, 열은 관측된 동작인 2×2 평가 매트릭스</caption>
            <thead><tr><th scope="col" className="w-[150px] px-3 py-2 text-[11px] font-bold text-[#697586]">기대 동작 ↓</th><th scope="col" className="px-3 py-2 text-xs font-black text-[#43515d]">관측된 동작: 허용</th><th scope="col" className="px-3 py-2 text-xs font-black text-[#43515d]">관측된 동작: 차단</th></tr></thead>
            <tbody>
              <tr><th scope="row" className="rounded-xl bg-[#f8f9fa] px-3 py-4 text-xs font-black text-[#43515d]">허용해야 함<br /><span className="text-[10px] font-medium text-[#697586]">ALLOW</span></th><td><MatrixCell outcome="TRUE_NEGATIVE" count={metricCount(visibleEvaluatorMetrics, 'TRUE_NEGATIVE')} /></td><td><MatrixCell outcome="FALSE_POSITIVE" count={metricCount(visibleEvaluatorMetrics, 'FALSE_POSITIVE')} rate={visibleEvaluatorMetrics?.falsePositiveRate} /></td></tr>
              <tr><th scope="row" className="rounded-xl bg-[#f8f9fa] px-3 py-4 text-xs font-black text-[#43515d]">차단해야 함<br /><span className="text-[10px] font-medium text-[#697586]">BLOCK</span></th><td><MatrixCell outcome="FALSE_NEGATIVE" count={metricCount(visibleEvaluatorMetrics, 'FALSE_NEGATIVE')} rate={visibleEvaluatorMetrics?.falseNegativeRate} /></td><td><MatrixCell outcome="TRUE_POSITIVE" count={metricCount(visibleEvaluatorMetrics, 'TRUE_POSITIVE')} /></td></tr>
            </tbody>
          </table>
        </div>}
      <p className="mt-3 text-[11px] text-[#697586]">실행 실패나 관측된 동작이 없는 결과는 매트릭스에 포함되지 않습니다. 현재 테스트 케이스의 기대 동작을 기준으로 한 분류입니다.</p>
    </article>

    <article aria-busy={resultsLoading} className="overflow-hidden rounded-2xl border border-[#e5e9ee] bg-white">
      <div className="border-b border-[#e5e9ee] p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-sm font-bold">결과 목록</h2><p className="mt-1 text-xs text-[#697586]">판정의 의미를 먼저 보여주며 원본 기술 값은 상세에서 확인할 수 있습니다.</p></div><span className="text-xs font-bold">현재 {visibleResults.length} / 필터 결과 {visiblePageMeta?.totalElements ?? 0}건 {resultsLoading && <span role="status" className="ml-1 text-[#697586]">· 불러오는 중</span>}</span></div>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="결과 보기 전환">
          <button type="button" aria-pressed={attentionTypes.length > 0} onClick={() => selectAttentionTypes(ATTENTION_TYPES.map(({ type }) => type))} className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${attentionTypes.length > 0 ? 'bg-[#17202a] text-white' : 'bg-[#eef1f4] text-[#586473]'}`}>문제만 보기 {attentionFacets ? `(${attentionFacets.attentionTotal})` : ''}</button>
          <button type="button" aria-pressed={attentionTypes.length === 0} onClick={() => selectAttentionTypes([])} className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${attentionTypes.length === 0 ? 'bg-[#17202a] text-white' : 'bg-[#eef1f4] text-[#586473]'}`}>전체 보기 {attentionFacets ? `(${attentionFacets.allResults})` : ''}</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="확인 필요 유형 필터">
          {ATTENTION_TYPES.map(({ type, label, tone }) => {
            const selectedType = attentionTypes.includes(type);
            const count = attentionFacets?.attentionTypes[type] ?? 0;
            return <button key={type} type="button" aria-pressed={selectedType} onClick={() => toggleAttentionType(type)} className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${selectedType ? tone : 'border-[#dfe5e9] bg-white text-[#586473]'}`}>{label} {count}</button>;
          })}
        </div>
        <details className="mt-4 rounded-xl bg-[#f8f9fa] p-3 text-xs">
          <summary className="cursor-pointer font-bold text-[#43515d]">고급 필터</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label>이름<input value={filters.name} onChange={(event) => { setFilters((current) => ({ ...current, name: event.target.value })); setResultPage(1); }} className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5" /></label>
            <label>입력<input value={filters.input} onChange={(event) => { setFilters((current) => ({ ...current, input: event.target.value })); setResultPage(1); }} className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5" /></label>
            <label>카테고리<input value={filters.category} onChange={(event) => { setFilters((current) => ({ ...current, category: event.target.value })); setResultPage(1); }} className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5" /></label>
            <label>기대 동작<select value={filters.expectedAction} onChange={(event) => { const value = parseExpectedActionFilter(event.currentTarget.value); if (value === null) return; setFilters((current) => ({ ...current, expectedAction: value })); setResultPage(1); }} className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5"><option value="">전체</option><option value="ALLOW">ALLOW</option><option value="BLOCK">BLOCK</option></select></label>
            <label>위험도<select value={filters.severity} onChange={(event) => { const value = parseSeverityFilter(event.currentTarget.value); if (value === null) return; setFilters((current) => ({ ...current, severity: value })); setResultPage(1); }} className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5"><option value="">전체</option>{Object.keys(severityPresentation).map((severity) => <option key={severity} value={severity}>{severity}</option>)}</select></label>
            <label>처리 상태<select value={filters.executionStatus} onChange={(event) => { const value = parseExecutionStatusFilter(event.currentTarget.value); if (value === null) return; setFilters((current) => ({ ...current, executionStatus: value })); setResultPage(1); }} className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5"><option value="">전체</option><option value="SUCCEEDED">정상 처리</option><option value="FAILED">처리 실패</option><option value="TIMED_OUT">시간 초과</option><option value="NOT_STARTED">미실행</option></select></label>
            <label>기대 일치 여부<select value={filters.assertionStatus} onChange={(event) => { const value = parseAssertionStatusFilter(event.currentTarget.value); if (value === null) return; setFilters((current) => ({ ...current, assertionStatus: value })); setResultPage(1); }} className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5"><option value="">전체</option><option value="PASS">일치 (PASS)</option><option value="FAIL">불일치 (FAIL)</option></select></label>
            <label>판정 유형<select value={filters.evaluationOutcome} onChange={(event) => { const value = parseEvaluationOutcomeFilter(event.currentTarget.value); if (value === null) return; setFilters((current) => ({ ...current, evaluationOutcome: value })); setResultPage(1); }} className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5">{OUTCOME_FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}</select></label>
            <label>정렬<select value={filters.sort} onChange={(event) => { const value = parseResultSortFilter(event.currentTarget.value); if (value === null) return; setFilters((current) => ({ ...current, sort: value })); setResultPage(1); }} className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5"><option value="">기본 정렬</option><option value="severity,desc">위험도 높은 순</option><option value="severity,asc">위험도 낮은 순</option><option value="name,asc">이름순</option><option value="name,desc">이름 역순</option></select></label>
          </div>
          <button type="button" onClick={() => { setFilters(EMPTY_RESULT_FILTERS); setResultPage(1); }} className="mt-3 font-bold text-[#43515d] underline">고급 필터 초기화</button>
        </details>
      </div>
      {resultListPresentation.countMismatch && <div className="border-b border-[#f0ddb0] bg-[#fff7e8] px-5 py-3 text-xs text-[#78501b]">고정 Snapshot {resultListPresentation.countMismatch.testCaseCount}건과 조회된 전체 결과 {resultListPresentation.countMismatch.resultCount}건의 수가 일치하지 않습니다. 결과 데이터를 다시 확인해 주세요.</div>}
      {notFinished
        ? <div className="p-8 text-center text-sm text-[#697586]">실행 완료 후 결과가 표시됩니다.</div>
        : !hasLoadedResults
          ? (resultsLoading ? <div className="p-8 text-center text-sm text-[#697586]">결과를 불러오는 중입니다.</div> : null)
          : visibleResults.length === 0
            ? <div className="p-8 text-center text-sm text-[#697586]">{resultListPresentation.emptyMessage}</div>
            : <>
              <div className="divide-y divide-[#e5e9ee] sm:hidden">{visibleResults.map((item) => <div key={item.testCaseSnapshotId} className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-black text-[#17202a]">{item.name}</h3><p className="mt-1 text-[11px] text-[#697586]">{item.category} · Snapshot #{item.testCaseSnapshotId}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${severityPresentation[item.severity].className}`}>{severityPresentation[item.severity].label}</span></div>
                <div className="rounded-xl bg-[#f8f9fa] p-3 text-xs"><ResultMeaning item={item} /></div>
                <div className="flex items-end justify-between gap-3"><div><span className="text-[10px] font-bold text-[#697586]">처리 상태</span><b className="mt-0.5 block text-xs text-[#17202a]">{executionLabel(item.executionStatus)}</b>{item.error && <span className="mt-1 block text-[10px] text-[#a8322d]">{errorStageLabel(item.error.stage)} 오류</span>}</div><button type="button" aria-label={`${item.name} 상세 보기`} onClick={() => setSelected(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe5e9] bg-white px-3 py-2 text-xs font-bold text-[#43515d]"><Eye size={14} />보기</button></div>
              </div>)}</div>
              <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-[#f8f9fa] text-[#697586]"><tr><th scope="col" className="px-5 py-3">TestCase</th><th scope="col" className="px-5 py-3">테스트 위험도</th><th scope="col" className="px-5 py-3">결과</th><th scope="col" className="px-5 py-3">처리 상태</th><th scope="col" className="px-5 py-3 text-center">상세</th></tr></thead>
                <tbody className="divide-y divide-[#e5e9ee]">{visibleResults.map((item) => <tr key={item.testCaseSnapshotId} className="hover:bg-[#f1faf6]">
                    <td className="px-5 py-4"><b className="block text-sm text-[#17202a]">{item.name}</b><span className="mt-1 block text-[#697586]">{item.category} · Snapshot #{item.testCaseSnapshotId}</span></td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${severityPresentation[item.severity].className}`}>{severityPresentation[item.severity].label}</span></td>
                    <td className="px-5 py-4"><ResultMeaning item={item} /></td>
                    <td className="px-5 py-4"><b className="block text-[#17202a]">{executionLabel(item.executionStatus)}</b>{item.error && <span className="mt-1 block text-[10px] text-[#a8322d]">{errorStageLabel(item.error.stage)} 오류</span>}</td>
                    <td className="px-5 py-4 text-center"><button type="button" aria-label={`${item.name} 상세 보기`} onClick={() => setSelected(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe5e9] bg-white px-3 py-2 font-bold text-[#43515d] hover:border-[#b8c2ca] hover:bg-[#f8f9fa]"><Eye size={14} />보기</button></td>
                  </tr>)}</tbody>
              </table></div>
            </>}
      {visiblePageMeta && visiblePageMeta.totalPages > 1 && (
        <nav
          aria-label="테스트 결과 페이지네이션"
          className="flex max-w-full items-center justify-center gap-1 overflow-x-auto border-t border-[#e5e9ee] p-4 text-xs"
        >
          <button
            type="button"
            disabled={!visiblePageMeta.hasPrevious || resultsLoading}
            onClick={() => setResultPage(Math.max(1, visiblePageMeta.number - 1))}
            className="shrink-0 whitespace-nowrap rounded-lg border border-[#dce1e6] px-3 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-40"
          >
            이전
          </button>
          {resultPageItems(visiblePageMeta.number, visiblePageMeta.totalPages).map((item, index) => item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} aria-hidden="true" className="px-1 text-[#697586]">…</span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => setResultPage(item)}
              disabled={resultsLoading}
              aria-current={item === visiblePageMeta.number ? 'page' : undefined}
              aria-label={`${item}페이지`}
              className={`min-w-8 rounded-lg px-2 py-2 font-bold disabled:cursor-not-allowed ${item === visiblePageMeta.number ? 'bg-[#17202a] text-white' : 'text-[#4e5a68] hover:bg-[#eef1f4]'}`}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            disabled={!visiblePageMeta.hasNext || resultsLoading}
            onClick={() => setResultPage(visiblePageMeta.number + 1)}
            className="shrink-0 whitespace-nowrap rounded-lg border border-[#dce1e6] px-3 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-40"
          >
            다음
          </button>
        </nav>
      )}
    </article>

    <article className="rounded-2xl border border-[#e5e9ee] bg-white p-6">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-bold">실행·평가 정보</h2><div className="flex gap-2">{detail?.executionOutcome ? <StatusPill kind="execution" status={detail.executionOutcome} /> : <span className="rounded-full bg-[#eef1f4] px-2.5 py-1 text-[10px] font-extrabold text-[#8fa0ad]">결정 전</span>}<StatusPill kind="gate" status={gateStatus} /></div></div>
      <dl className="grid gap-4 text-xs sm:grid-cols-2">
        <div><dt className="text-[#697586]">Application</dt><dd className="mt-1 break-all font-bold">{detail?.target.identifier ?? '—'}</dd><dd className="mt-1 text-[#697586]">Model: {detail?.target.model ?? '—'}</dd><dd className="mt-1 text-[#697586]">Revision: {detail?.target.revision ?? '없음'}</dd></div>
      </dl>
    </article>

    {selected && createPortal(<div className={`fixed inset-0 ${LAYER_CLASS.dialog} flex items-center justify-center bg-black/40 p-4`}><button type="button" className="absolute inset-0 cursor-default" tabIndex={-1} aria-hidden="true" onClick={closeResultDialog} /><section ref={resultDialogRef} role="dialog" aria-modal="true" aria-labelledby="result-dialog-title" tabIndex={-1} className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><div className="flex justify-between gap-4"><div><h2 id="result-dialog-title" className="text-lg font-bold">{selected.name}</h2><p className="text-xs text-[#697586]">Snapshot #{selected.testCaseSnapshotId}</p></div><button type="button" aria-label="Snapshot 결과 상세 창 닫기" onClick={closeResultDialog}><X size={20} /></button></div>
      <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2"><div className="sm:col-span-2"><dt className="text-xs font-bold text-[#697586]">입력</dt><dd className="mt-1 rounded-xl bg-[#f6f8f9] p-3 whitespace-pre-wrap">{selected.input}</dd></div><div><dt className="text-xs font-bold text-[#697586]">대상 애플리케이션 실행</dt><dd className="mt-1">{executionLabel(selected.executionStatus)}</dd></div><div><dt className="text-xs font-bold text-[#697586]">기대 동작</dt><dd className="mt-1"><ActionCode value={selected.expectedAction} /></dd></div><div><dt className="text-xs font-bold text-[#697586]">관측된 동작</dt><dd className="mt-1"><OptionalActionValue value={selected.evaluatorVerdict} /></dd></div><div><dt className="text-xs font-bold text-[#697586]">기대 일치 여부</dt><dd className="mt-1">{selected.assertionStatus === 'PASS' ? '일치 (PASS)' : selected.assertionStatus === 'FAIL' ? '불일치 (FAIL)' : '평가되지 않음'}</dd></div><div><dt className="text-xs font-bold text-[#697586]">판정 유형</dt><dd className="mt-1">{evaluationOutcomeLabel(selected.evaluationOutcome)}</dd></div>{selected.error && <div className="sm:col-span-2 rounded-xl border border-[#f4c7c3] bg-[#fff0ef] p-3"><dt className="text-xs font-bold">{errorStageLabel(selected.error.stage)} 오류 · {selected.error.code}</dt><dd className="mt-1 text-xs">{selected.error.message}</dd></div>}</dl>
      {selectedRunId && <ApplicationResponseEvidence testRunId={selectedRunId} testCaseSnapshotId={selected.testCaseSnapshotId} />}
      {selectedInspectionGuide && <section className="mt-5 rounded-xl border border-[#dfe5e9] bg-[#f8f9fa] p-4 text-sm" aria-labelledby="result-inspection-title"><h3 id="result-inspection-title" className="font-bold text-[#17202a]">확인할 부분</h3><p className="mt-2 text-[#43515d]">{selectedInspectionGuide.summary}</p><p className="mt-2 font-semibold text-[#17202a]">{selectedInspectionGuide.action}</p></section>}
    </section></div>, document.body)}
  </section>;
};
