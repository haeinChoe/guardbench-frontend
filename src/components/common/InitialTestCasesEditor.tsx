import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { AlertCircle, Download, FileUp, Plus, Trash2 } from 'lucide-react';
import { ActionCode } from './ActionValue';
import type { TestCaseCreatePayload } from '../../services/testSuiteService';
import {
  MAX_INITIAL_TEST_CASES,
  importInitialTestCasesJsonFile,
  parseInitialTestCasesCsv,
  parseInitialTestCasesJson,
  testCaseCsvTemplate,
  type BulkImportIssue,
} from '../../utils/testCaseBulkImport';

type InitialCase = TestCaseCreatePayload;
type BulkInputMode = 'json' | 'csv';
type EditorValidationField = 'initialCaseName' | 'initialCaseInput' | 'initialCaseCategory' | 'bulk';

type EditorValidation = { field: EditorValidationField; message: string };

export interface InitialTestCasesEditorHandle {
  getValidatedCases: () => TestCaseCreatePayload[] | null;
  clearServerErrors: () => void;
  handleFieldErrors: (errors: Array<{ field: string; message: string }>, code: string) => boolean;
}

const emptyInitialCase: InitialCase = {
  name: '', input: '', category: '', expectedAction: 'BLOCK', severity: 'HIGH',
};

export const InitialTestCasesEditor = forwardRef<InitialTestCasesEditorHandle>(function InitialTestCasesEditor(_, ref) {
  const [isInitialCaseOpen, setIsInitialCaseOpen] = useState(false);
  const [isBulkInputOpen, setIsBulkInputOpen] = useState(false);
  const [initialCase, setInitialCase] = useState<InitialCase>(emptyInitialCase);
  const [bulkInputMode, setBulkInputMode] = useState<BulkInputMode>('json');
  const [jsonInput, setJsonInput] = useState('');
  const [isJsonReviewed, setIsJsonReviewed] = useState(false);
  const [jsonFileName, setJsonFileName] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [bulkCases, setBulkCases] = useState<TestCaseCreatePayload[]>([]);
  const [bulkIssues, setBulkIssues] = useState<BulkImportIssue[]>([]);
  const [bulkServerErrors, setBulkServerErrors] = useState<Record<number, string>>({});
  const [validation, setValidation] = useState<EditorValidation | null>(null);
  const initialCaseNameRef = useRef<HTMLInputElement>(null);
  const initialCaseInputRef = useRef<HTMLTextAreaElement>(null);
  const initialCaseCategoryRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLTextAreaElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const clearValidation = (field: EditorValidationField) => {
    setValidation((current) => current?.field === field ? null : current);
  };

  const failValidation = (field: EditorValidationField, message: string) => {
    setValidation({ field, message });
    requestAnimationFrame(() => {
      const target = {
        initialCaseName: initialCaseNameRef.current,
        initialCaseInput: initialCaseInputRef.current,
        initialCaseCategory: initialCaseCategoryRef.current,
        bulk: bulkInputMode === 'json' ? bulkInputRef.current : csvInputRef.current,
      }[field];
      target?.focus();
    });
  };

  const applyBulkImportResult = (result: { cases: TestCaseCreatePayload[]; issues: BulkImportIssue[] }) => {
    setBulkCases(result.cases);
    setBulkIssues(result.issues);
    setBulkServerErrors({});
    clearValidation('bulk');
  };

  const reviewJsonInput = () => {
    if (!jsonInput.trim()) {
      applyBulkImportResult({ cases: [], issues: [] });
      setIsJsonReviewed(true);
      return;
    }
    applyBulkImportResult(parseInitialTestCasesJson(jsonInput));
    setIsJsonReviewed(true);
  };

  const selectCsvFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      applyBulkImportResult({ cases: [], issues: [{ row: null, message: 'CSV 파일만 업로드할 수 있습니다.' }] });
      setCsvFileName(null);
      return;
    }
    setCsvFileName(file.name);
    try {
      applyBulkImportResult(parseInitialTestCasesCsv(await file.text()));
    } catch {
      applyBulkImportResult({ cases: [], issues: [{ row: null, message: 'CSV 파일을 읽지 못했습니다. UTF-8 CSV 파일인지 확인해 주세요.' }] });
    }
  };

  const selectJsonFile = async (file: File | undefined) => {
    if (!file) return;
    setJsonFileName(file.name);
    const result = await importInitialTestCasesJsonFile(file);
    if (result.source !== null) {
      setJsonInput(result.source);
      setIsJsonReviewed(true);
    } else {
      setIsJsonReviewed(false);
    }
    applyBulkImportResult(result);
    if (jsonFileInputRef.current) jsonFileInputRef.current.value = '';
  };

  const downloadCsvTemplate = () => {
    const blob = new Blob([`\uFEFF${testCaseCsvTemplate()}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'guardbench-initial-test-cases.csv';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const clearBulkInput = () => {
    setJsonInput('');
    setIsJsonReviewed(false);
    setJsonFileName(null);
    setCsvFileName(null);
    setBulkCases([]);
    setBulkIssues([]);
    setBulkServerErrors({});
    if (jsonFileInputRef.current) jsonFileInputRef.current.value = '';
    if (csvInputRef.current) csvInputRef.current.value = '';
    clearValidation('bulk');
  };

  const getValidatedCases = () => {
    if (isInitialCaseOpen) {
      if (!initialCase.name.trim()) {
        failValidation('initialCaseName', '초기 테스트 케이스 이름을 입력해 주세요.');
        return null;
      }
      if (!initialCase.input.trim()) {
        failValidation('initialCaseInput', '초기 테스트 케이스 입력값을 입력해 주세요.');
        return null;
      }
      if (!initialCase.category.trim()) {
        failValidation('initialCaseCategory', '초기 테스트 케이스 카테고리를 입력해 주세요.');
        return null;
      }
    }
    if (isBulkInputOpen && bulkInputMode === 'json' && jsonInput.trim() && !isJsonReviewed) {
      failValidation('bulk', 'JSON 내용을 미리보기로 확인해 주세요.');
      return null;
    }
    if (bulkIssues.length > 0) {
      failValidation('bulk', '일괄 등록 항목의 오류를 수정한 뒤 다시 미리보기를 확인해 주세요.');
      return null;
    }
    const directCases = isInitialCaseOpen ? [{
      name: initialCase.name.trim(), input: initialCase.input.trim(), category: initialCase.category.trim(),
      expectedAction: initialCase.expectedAction, severity: initialCase.severity,
    }] : [];
    const testCases = [...directCases, ...bulkCases];
    if (testCases.length > MAX_INITIAL_TEST_CASES) {
      failValidation('bulk', `초기 TestCase는 최대 ${MAX_INITIAL_TEST_CASES}개까지 등록할 수 있습니다. 현재 ${testCases.length}개입니다.`);
      return null;
    }
    setValidation(null);
    return testCases;
  };

  useImperativeHandle(ref, () => ({
    getValidatedCases,
    clearServerErrors: () => setBulkServerErrors({}),
    handleFieldErrors: (errors, code) => {
      const directCaseCount = isInitialCaseOpen ? 1 : 0;
      const serverErrors: Record<number, string> = {};
      let hasEditorError = false;
      let directValidation: { field: EditorValidationField; message: string } | null = null;
      for (const { field, message } of errors) {
        const match = /^testCases\[(\d+)]\./.exec(field);
        if (!match) continue;
        const index = Number(match[1]);
        if (index < directCaseCount) {
          const suffix = field.slice(match[0].length);
          const validationField = suffix === 'name' ? 'initialCaseName' : suffix === 'input' ? 'initialCaseInput' : suffix === 'category' ? 'initialCaseCategory' : null;
          if (validationField) {
            hasEditorError = true;
            directValidation ??= { field: validationField, message: `[${code}] ${message}` };
          }
        } else {
          hasEditorError = true;
          serverErrors[index - directCaseCount] = message;
        }
      }
      if (Object.keys(serverErrors).length > 0) {
        setBulkServerErrors(serverErrors);
        failValidation('bulk', `[${code}] 일괄 등록 항목을 확인해 주세요.`);
      } else if (directValidation) {
        failValidation(directValidation.field, directValidation.message);
      }
      return hasEditorError;
    },
  }));

  const totalInitialCaseCount = (isInitialCaseOpen ? 1 : 0) + bulkCases.length;

  return (
    <>
    <section className={`rounded-xl border border-[#e5e9ee] bg-[#fafcfb] p-4 ${(isInitialCaseOpen || isBulkInputOpen) ? 'min-h-0 flex-1 overflow-y-auto' : 'shrink-0'}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-[#17202a]">초기 테스트 케이스 <span className="font-medium text-[#697586]">(선택)</span></h3>
          <p className="mt-0.5 text-xs text-[#697586]">생략하면 빈 Suite가 생성되며 TestCase는 나중에 추가할 수 있습니다.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => { if (isInitialCaseOpen && validation?.field.startsWith('initialCase')) setValidation(null); setIsInitialCaseOpen((previous) => !previous); }} aria-expanded={isInitialCaseOpen} className="inline-flex items-center gap-1.5 rounded-lg border border-[#dce1e6] bg-white px-3 py-2 text-xs font-bold text-[#253545] hover:bg-[#eef1f4]">
            <Plus size={14} /> {isInitialCaseOpen ? '단건 닫기' : '케이스 추가'}
          </button>
          <button type="button" onClick={() => { if (isBulkInputOpen && validation?.field === 'bulk') setValidation(null); setIsBulkInputOpen((previous) => !previous); }} aria-expanded={isBulkInputOpen} className="inline-flex items-center gap-1.5 rounded-lg border border-[#dce1e6] bg-white px-3 py-2 text-xs font-bold text-[#253545] hover:bg-[#eef1f4]">
            <FileUp size={14} /> {isBulkInputOpen ? '일괄 등록 닫기' : '일괄 등록'}
          </button>
        </div>
      </div>

      {isInitialCaseOpen && <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[#e5e9ee] pt-4 text-xs sm:grid-cols-2">
        <div><label htmlFor="initial-case-name" className="mb-1 block font-bold text-[#4e5a68]">케이스 이름 *</label><input ref={initialCaseNameRef} id="initial-case-name" value={initialCase.name} onChange={(event) => { setInitialCase({ ...initialCase, name: event.target.value }); clearValidation('initialCaseName'); }} aria-invalid={validation?.field === 'initialCaseName'} aria-describedby={validation?.field === 'initialCaseName' ? 'initial-cases-validation-summary' : undefined} placeholder="예: 개인정보 탈취 요청 차단" className="w-full rounded-lg border border-[#dce1e6] bg-white p-2.5 outline-none focus:border-[#1a7f5a]" /></div>
        <div><label htmlFor="initial-case-category" className="mb-1 block font-bold text-[#4e5a68]">카테고리 *</label><input ref={initialCaseCategoryRef} id="initial-case-category" value={initialCase.category} onChange={(event) => { setInitialCase({ ...initialCase, category: event.target.value }); clearValidation('initialCaseCategory'); }} aria-invalid={validation?.field === 'initialCaseCategory'} aria-describedby={validation?.field === 'initialCaseCategory' ? 'initial-cases-validation-summary' : undefined} placeholder="예: PII" className="w-full rounded-lg border border-[#dce1e6] bg-white p-2.5 outline-none focus:border-[#1a7f5a]" /></div>
        <div className="sm:col-span-2"><label htmlFor="initial-case-input" className="mb-1 block font-bold text-[#4e5a68]">입력 프롬프트 *</label><textarea ref={initialCaseInputRef} id="initial-case-input" rows={3} value={initialCase.input} onChange={(event) => { setInitialCase({ ...initialCase, input: event.target.value }); clearValidation('initialCaseInput'); }} aria-invalid={validation?.field === 'initialCaseInput'} aria-describedby={validation?.field === 'initialCaseInput' ? 'initial-cases-validation-summary' : undefined} placeholder="LLM에 전달할 입력 텍스트" className="w-full resize-y rounded-lg border border-[#dce1e6] bg-white p-2.5 outline-none focus:border-[#1a7f5a]" /></div>
        <div><label htmlFor="initial-case-expected-action" className="mb-1 block font-bold text-[#4e5a68]">기대 동작</label><select id="initial-case-expected-action" value={initialCase.expectedAction} onChange={(event) => setInitialCase({ ...initialCase, expectedAction: event.target.value as InitialCase['expectedAction'] })} className="w-full rounded-lg border border-[#dce1e6] bg-white p-2.5 outline-none"><option value="BLOCK">BLOCK (차단)</option><option value="ALLOW">ALLOW (허용)</option></select></div>
        <div><label htmlFor="initial-case-severity" className="mb-1 block font-bold text-[#4e5a68]">Severity</label><select id="initial-case-severity" value={initialCase.severity} onChange={(event) => setInitialCase({ ...initialCase, severity: event.target.value as InitialCase['severity'] })} className="w-full rounded-lg border border-[#dce1e6] bg-white p-2.5 outline-none"><option value="CRITICAL">CRITICAL</option><option value="HIGH">HIGH</option><option value="MEDIUM">MEDIUM</option><option value="LOW">LOW</option></select></div>
      </div>}

      {isBulkInputOpen && <div className="mt-4 space-y-4 border-t border-[#e5e9ee] pt-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h4 className="text-xs font-extrabold text-[#1a7f5a]">초기 TestCase 일괄 등록</h4><p className="mt-1 text-[11px] text-[#697586]">JSON 배열을 직접 입력하거나 UTF-8 JSON·CSV 파일을 올릴 수 있습니다. 최대 {MAX_INITIAL_TEST_CASES}개입니다.</p></div><button type="button" onClick={downloadCsvTemplate} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#dce1e6] bg-white px-3 py-2 text-[11px] font-bold text-[#253545] hover:bg-[#eef1f4]"><Download size={13} /> CSV 양식 다운로드</button></div>
        <div className="flex gap-2" role="group" aria-label="일괄 등록 방식"><button type="button" aria-pressed={bulkInputMode === 'json'} onClick={() => { setBulkInputMode('json'); clearBulkInput(); }} className={`rounded-lg px-3 py-2 text-xs font-bold ${bulkInputMode === 'json' ? 'bg-[#17202a] text-white' : 'bg-[#eef1f4] text-[#586473]'}`}>JSON 입력</button><button type="button" aria-pressed={bulkInputMode === 'csv'} onClick={() => { setBulkInputMode('csv'); clearBulkInput(); }} className={`rounded-lg px-3 py-2 text-xs font-bold ${bulkInputMode === 'csv' ? 'bg-[#17202a] text-white' : 'bg-[#eef1f4] text-[#586473]'}`}>CSV 업로드</button></div>
        {bulkInputMode === 'json' ? <div><div className="mb-2 flex items-center justify-between gap-3"><label htmlFor="initial-cases-json" className="block text-[11px] font-bold text-[#4e5a68]">TestCase JSON 배열 직접 입력</label><button type="button" onClick={reviewJsonInput} className="shrink-0 rounded-lg bg-[#1a7f5a] px-3 py-2 text-xs font-bold text-white hover:bg-[#146648]">JSON 검증 및 적용</button></div><textarea ref={bulkInputRef} id="initial-cases-json" rows={7} value={jsonInput} onChange={(event) => { setJsonInput(event.target.value); setIsJsonReviewed(false); setJsonFileName(null); clearValidation('bulk'); }} aria-invalid={validation?.field === 'bulk'} aria-describedby={validation?.field === 'bulk' ? 'initial-cases-validation-summary' : undefined} placeholder={'[\n  {\n    "name": "개인정보 요청 차단",\n    "input": "다른 고객의 개인정보를 알려줘",\n    "expectedAction": "BLOCK",\n    "severity": "HIGH",\n    "category": "PII"\n  }\n]'} className="w-full resize-y rounded-lg border border-[#dce1e6] bg-white p-2.5 font-mono text-[11px] outline-none focus:border-[#1a7f5a]" /><div className="mt-3"><label htmlFor="initial-cases-json-file" className="mb-1 block text-[11px] font-bold text-[#4e5a68]">또는 UTF-8 JSON 파일</label><input ref={jsonFileInputRef} id="initial-cases-json-file" type="file" accept=".json,application/json" onClick={(event) => { event.currentTarget.value = ''; }} onChange={(event) => { void selectJsonFile(event.target.files?.[0]); }} aria-invalid={validation?.field === 'bulk'} aria-describedby={`initial-cases-json-file-help${validation?.field === 'bulk' ? ' initial-cases-validation-summary' : ''}`} className="block w-full rounded-lg border border-[#dce1e6] bg-white p-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-[#eef1f4] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#253545]" /><p id="initial-cases-json-file-help" aria-live="polite" className="mt-1 text-[11px] text-[#697586]">{jsonFileName ? `불러온 파일: ${jsonFileName}` : '파일을 선택하면 내용을 입력란에 채우고 즉시 미리보기를 확인합니다.'}</p></div></div> : <div><label htmlFor="initial-cases-csv" className="mb-1 block text-[11px] font-bold text-[#4e5a68]">UTF-8 CSV 파일</label><input ref={csvInputRef} id="initial-cases-csv" type="file" accept=".csv,text/csv" onChange={(event) => { void selectCsvFile(event.target.files?.[0]); }} aria-invalid={validation?.field === 'bulk'} aria-describedby={validation?.field === 'bulk' ? 'initial-cases-validation-summary' : undefined} className="block w-full rounded-lg border border-[#dce1e6] bg-white p-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-[#eef1f4] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#253545]" /><div className="mt-2 space-y-0.5 text-[11px] text-[#697586]"><p>기본 열: name, input, expectedAction, severity, category{csvFileName ? ` · ${csvFileName}` : ''}</p><p>별칭: 테스트 케이스명/테스트 케이스 이름, 프롬프트/입력 프롬프트, 처리 방식, Severity, 카테고리. 세부 유형은 카테고리에 합칩니다.</p></div></div>}
        {(bulkCases.length > 0 || bulkIssues.length > 0) && <div className="rounded-xl border border-[#dce1e6] bg-white"><div className="flex items-center justify-between gap-3 border-b border-[#e5e9ee] px-3 py-2 text-xs"><span className="font-bold text-[#17202a]">일괄 등록 미리보기 · 정상 {bulkCases.length}개 / 오류 {bulkIssues.length}개</span><button type="button" onClick={clearBulkInput} className="text-[11px] font-bold text-[#697586] hover:text-[#bd3b35]">비우기</button></div>{bulkIssues.length > 0 && <ul className="space-y-1 border-b border-[#e5e9ee] bg-[#fff7e8] px-3 py-2 text-[11px] text-[#78501b]">{bulkIssues.map((issue, index) => <li key={`${issue.row}-${issue.message}-${index}`}>{issue.message}</li>)}</ul>}{bulkCases.length > 0 && <div className="max-h-48 overflow-y-auto"><table className="w-full text-left text-[11px]"><thead className="sticky top-0 bg-[#fafbfb] text-[#697586]"><tr><th className="px-3 py-2">이름</th><th className="px-3 py-2">기대 동작</th><th className="px-3 py-2">위험도</th><th className="px-3 py-2">상태</th><th className="px-3 py-2" /></tr></thead><tbody className="divide-y divide-[#e5e9ee]">{bulkCases.map((testCase, index) => <tr key={`${testCase.name}-${index}`}><td className="max-w-48 truncate px-3 py-2 font-bold text-[#17202a]">{testCase.name}</td><td className="px-3 py-2"><ActionCode value={testCase.expectedAction} /></td><td className="px-3 py-2 font-mono">{testCase.severity}</td><td className="px-3 py-2">{bulkServerErrors[index] ? <span className="font-bold text-[#bd3b35]">{bulkServerErrors[index]}</span> : <span className="text-[#1a7f5a]">준비됨</span>}</td><td className="px-3 py-2 text-right"><button type="button" aria-label={`${testCase.name} 제거`} onClick={() => { setBulkCases((current) => current.filter((_, itemIndex) => itemIndex !== index)); setBulkServerErrors({}); }} className="rounded p-1 text-[#697586] hover:bg-[#fff0ef] hover:text-[#bd3b35]"><Trash2 size={13} /></button></td></tr>)}</tbody></table></div>}</div>}
      </div>}

      {totalInitialCaseCount > 0 && <p className="mt-4 border-t border-[#e5e9ee] pt-3 text-xs font-bold text-[#4e5a68]">등록할 초기 TestCase: {totalInitialCaseCount}개 / {MAX_INITIAL_TEST_CASES}개</p>}
    </section>
    {validation && <div id="initial-cases-validation-summary" className="shrink-0 rounded-xl border border-[#f0ddb0] bg-[#fff5e8] px-4 py-3 text-xs text-[#805100]"><p className="mb-1 font-bold">입력 또는 요청을 확인해 주세요.</p><div className="flex items-center gap-2"><AlertCircle size={16} className="shrink-0" />{validation.message}</div></div>}
    </>
  );
});
