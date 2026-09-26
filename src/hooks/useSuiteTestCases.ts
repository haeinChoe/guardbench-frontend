import { useCallback, useEffect, useState } from 'react';
import { getTestCases, type TestCaseListApiResponse } from '../services/testCaseService';
import type { TestCase } from '../types';

const TEST_CASE_PAGE_SIZE = 20;

export type SuiteTestCaseCountChange = { kind: 'delta' | 'total'; value: number };

export const useSuiteTestCases = (suiteId: string | undefined) => {
  const [cases, setCases] = useState<TestCase[]>([]);
  const [casesOwnerSuiteId, setCasesOwnerSuiteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageMeta, setPageMeta] = useState<TestCaseListApiResponse['page'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const updateCase = (caseId: string, changes: Partial<TestCase>) => {
    setCases((current) => current.map((testCase) => testCase.id === caseId
      ? { ...testCase, ...changes }
      : testCase));
  };

  const updateReportedCount = (change: SuiteTestCaseCountChange) => {
    setPageMeta((current) => {
      if (!current) return current;
      const totalElements = Math.max(0, change.kind === 'total'
        ? change.value
        : current.totalElements + change.value);
      const totalPages = totalElements === 0 ? 0 : Math.ceil(totalElements / current.size);
      return {
        ...current,
        totalElements,
        totalPages,
        hasPrevious: current.number > 1,
        hasNext: current.number < totalPages,
      };
    });
  };

  useEffect(() => {
    if (!suiteId) return undefined;

    let isMounted = true;
    const fetchCases = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const cleanSuiteId = suiteId.replace('suite-', '');
        const response = await getTestCases(cleanSuiteId, { page, size: TEST_CASE_PAGE_SIZE });
        if (isMounted) {
          // A deletion can make the requested last page invalid between requests.
          if (
            response.items.length === 0
            && response.page.totalElements > 0
            && response.page.totalPages > 0
            && response.page.number > response.page.totalPages
          ) {
            setPage(response.page.totalPages);
            return;
          }

          const mappedCases: TestCase[] = response.items.map((item) => ({
            id: `tc-${item.id}`,
            name: item.name,
            input: item.input,
            expectedAction: item.expectedAction,
            severity: item.severity,
            category: item.category,
            createdAt: item.createdAt || '방금 전',
          }));
          setCases(mappedCases);
          setCasesOwnerSuiteId(suiteId);
          setPageMeta(response.page);
        }
      } catch (error) {
        if (isMounted) setLoadError(error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void fetchCases();
    return () => {
      isMounted = false;
    };
  }, [suiteId, page, reloadToken]);

  const isCurrentSuiteLoaded = suiteId !== undefined && casesOwnerSuiteId === suiteId;

  return {
    cases: isCurrentSuiteLoaded ? cases : [],
    page,
    setPage,
    pageMeta: isCurrentSuiteLoaded ? pageMeta : null,
    isCurrentSuiteLoaded,
    isLoading,
    loadError,
    reload,
    updateCase,
    updateReportedCount,
  };
};
