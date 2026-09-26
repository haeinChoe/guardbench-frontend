import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Severity, TestCase, TestSuite } from '../../types';
import { X, Plus, Trash2, Edit2, AlertCircle, Loader2, FileUp } from 'lucide-react';
import {
  createTestCase,
  updateTestCase,
  deleteTestCase,
} from '../../services/testCaseService';
import { ApiError, presentApiError } from '../../services/apiClient';
import { ActionCode } from './ActionValue';
import { RequestErrorBanner } from './RequestErrorBanner';
import { SuiteDeleteConfirmationDialog } from './SuiteDeleteConfirmationDialog';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { useSuiteTestCases } from '../../hooks/useSuiteTestCases';
import { LAYER_CLASS } from '../../config/layers';
import { BulkTestCaseCreatePanel } from './BulkTestCaseCreatePanel';
import {
  EMPTY_TEST_CASE_EDIT,
  beginTestCaseEdit,
  canStartTestCaseEditSave,
  testCaseValidationFieldFromApiField,
  changeTestCaseEdit,
  failTestCaseEditSave,
  isTestCaseEditDirty,
  startTestCaseEditSave,
  testCaseApiId,
  validateTestCaseEdit,
  type CaseValidation,
  type CaseValidationField,
} from './testCaseEditState';
import { suiteDetailPageItems } from './suiteDetailPagination';

interface SuiteDetailModalProps {
  suite: TestSuite | null;
  onClose: () => void;
  onDeleted: () => void;
  onCaseCountChanged: (change: { kind: 'delta' | 'total'; value: number }) => void;
  onNotify: (msg: string) => void;
}

export const SuiteDetailModal: React.FC<SuiteDetailModalProps> = ({
  suite,
  onClose,
  onDeleted,
  onCaseCountChanged,
  onNotify,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [isBulkDirty, setIsBulkDirty] = useState(false);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [addValidation, setAddValidation] = useState<CaseValidation | null>(null);
  const [editState, setEditState] = useState(EMPTY_TEST_CASE_EDIT);
  const [newCase, setNewCase] = useState<Partial<TestCase>>({
    name: '',
    input: '',
    expectedAction: 'BLOCK',
    severity: 'HIGH',
    category: 'PII',
  });
  const caseNameRef = useRef<HTMLInputElement>(null);
  const caseInputRef = useRef<HTMLTextAreaElement>(null);
  const caseCategoryRef = useRef<HTMLInputElement>(null);
  const editCaseNameRef = useRef<HTMLInputElement>(null);
  const editCaseInputRef = useRef<HTMLTextAreaElement>(null);
  const editCaseCategoryRef = useRef<HTMLInputElement>(null);
  const editErrorRef = useRef<HTMLDivElement>(null);
  const editButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingEditButtonFocusRef = useRef<string | null>(null);
  const pendingFocusSawLoadingRef = useRef(false);
  const editInFlightRef = useRef(false);
  const suiteId = suite?.id;
  const {
    cases: visibleCases,
    page,
    setPage,
    pageMeta: visiblePageMeta,
    isCurrentSuiteLoaded,
    isLoading,
    loadError,
    reload: reloadCases,
    updateCase,
    updateReportedCount,
  } = useSuiteTestCases(suiteId);

  const closeSuiteDetail = () => {
    if (editInFlightRef.current || isBulkSaving) return;
    if (isTestCaseEditDirty(editState) && !window.confirm('저장하지 않은 수정사항이 있습니다. 상세창을 닫을까요?')) return;
    if (isBulkDirty && !window.confirm('등록하지 않은 일괄 등록 항목이 있습니다. 상세창을 닫을까요?')) return;
    setEditState(EMPTY_TEST_CASE_EDIT);
    setIsAdding(false);
    setIsBulkAdding(false);
    setIsBulkDirty(false);
    setAddValidation(null);
    onClose();
  };
  const dialogRef = useDialogFocus({ isOpen: suite !== null, onClose: closeSuiteDetail });
  useEffect(() => {
    if (!pendingEditButtonFocusRef.current) return;
    if (isLoading) {
      pendingFocusSawLoadingRef.current = true;
      return;
    }
    if (!pendingFocusSawLoadingRef.current) return;

    const caseId = pendingEditButtonFocusRef.current;
    pendingEditButtonFocusRef.current = null;
    pendingFocusSawLoadingRef.current = false;
    requestAnimationFrame(() => editButtonRefs.current.get(caseId)?.focus());
  }, [isLoading]);

  if (!suite) return null;

  const totalCaseCount = visiblePageMeta?.totalElements;

  const publishCaseCountChange = (change: { kind: 'delta' | 'total'; value: number }) => {
    updateReportedCount(change);
    onCaseCountChanged(change);
  };

  const failAddValidation = (field: CaseValidationField, message: string) => {
    setAddValidation({ field, message });
    requestAnimationFrame(() => {
      const target = {
        name: caseNameRef.current,
        input: caseInputRef.current,
        category: caseCategoryRef.current,
        request: null,
      }[field];
      target?.focus();
    });
  };

  const clearAddValidation = (field: CaseValidationField) => {
    setAddValidation((current) => current?.field === field ? null : current);
  };

  const handleAddCase = async () => {
    const name = newCase.name?.trim() ?? '';
    const input = newCase.input?.trim() ?? '';
    const category = newCase.category?.trim() ?? '';
    if (!name) {
      failAddValidation('name', '테스트 케이스 이름을 입력해 주세요.');
      return;
    }
    if (!input) {
      failAddValidation('input', '테스트 케이스 입력값을 입력해 주세요.');
      return;
    }
    if (!category) {
      failAddValidation('category', '테스트 케이스 카테고리를 입력해 주세요.');
      return;
    }

    setAddValidation(null);
    try {
      const cleanSuiteId = suite.id.replace('suite-', '');
      const response = await createTestCase(cleanSuiteId, {
        name,
        input,
        expectedAction: newCase.expectedAction || 'BLOCK',
        severity: newCase.severity || 'HIGH',
        category,
      });

      const created: TestCase = {
        id: `tc-${response.id}`,
        name: response.name,
        input: response.input,
        expectedAction: response.expectedAction,
        severity: response.severity,
        category: response.category,
        createdAt: response.createdAt || '방금 전',
      };

      publishCaseCountChange({ kind: 'delta', value: 1 });
      reloadCases();
      setIsAdding(false);
      setAddValidation(null);
      setNewCase({ name: '', input: '', expectedAction: 'BLOCK', severity: 'HIGH', category: 'PII' });
      onNotify(`새 테스트 케이스 '${created.name}'가 추가되었습니다 (POST /test-suites/${cleanSuiteId}/test-cases).`);
    } catch (error) {
      const presented = presentApiError(error, '테스트 케이스를 추가하지 못했습니다.');
      if (error instanceof ApiError && error.fieldErrors?.length) {
        failAddValidation(testCaseValidationFieldFromApiField(error.fieldErrors[0].field), presented.message);
      } else {
        failAddValidation('request', presented.message);
      }
      onNotify(`[추가 실패 · ${presented.code}] ${presented.message}`);
    }
  };

  const openEditCase = (testCase: TestCase) => {
    setIsAdding(false);
    setIsBulkAdding(false);
    setIsBulkDirty(false);
    setAddValidation(null);
    setEditState(beginTestCaseEdit(testCase));
    requestAnimationFrame(() => editCaseNameRef.current?.focus());
  };

  const closeBulkCreate = () => {
    if (isBulkSaving) return;
    if (isBulkDirty && !window.confirm('등록하지 않은 일괄 등록 항목을 취소할까요?')) return;
    setIsBulkAdding(false);
    setIsBulkDirty(false);
  };

  const cancelEditCase = () => {
    if (editInFlightRef.current) return;
    if (isTestCaseEditDirty(editState) && !window.confirm('저장하지 않은 수정사항을 취소할까요?')) return;
    const caseId = editState.caseId;
    setEditState(EMPTY_TEST_CASE_EDIT);
    if (caseId) requestAnimationFrame(() => editButtonRefs.current.get(caseId)?.focus());
  };

  const failEditValidation = (field: CaseValidationField, message: string) => {
    setEditState((current) => failTestCaseEditSave(current, { field, message }));
    requestAnimationFrame(() => {
      const target = {
        name: editCaseNameRef.current,
        input: editCaseInputRef.current,
        category: editCaseCategoryRef.current,
        request: editErrorRef.current,
      }[field];
      target?.focus();
    });
  };

  const handleEditCase = async () => {
    if (!canStartTestCaseEditSave(editState) || editInFlightRef.current) return;

    const result = validateTestCaseEdit(editState.draft);
    if (result.validation) {
      failEditValidation(result.validation.field, result.validation.message);
      return;
    }

    const payload = result.payload;
    const editingCaseId = editState.caseId;
    const cleanCaseId = testCaseApiId(editingCaseId);

    editInFlightRef.current = true;
    setEditState((current) => startTestCaseEditSave(current));
    try {
      await updateTestCase(cleanCaseId, payload);
      editInFlightRef.current = false;
      updateCase(editingCaseId, payload);
      setEditState(EMPTY_TEST_CASE_EDIT);
      pendingEditButtonFocusRef.current = editingCaseId;
      pendingFocusSawLoadingRef.current = false;
      reloadCases();
      onNotify(`테스트 케이스 '${payload.name}'가 수정되었습니다.`);
    } catch (error) {
      editInFlightRef.current = false;
      const presented = presentApiError(error, `'${payload.name}' 수정에 실패했습니다.`);
      if (error instanceof ApiError && error.fieldErrors?.length) {
        failEditValidation(testCaseValidationFieldFromApiField(error.fieldErrors[0].field), presented.message);
      } else {
        failEditValidation('request', presented.message);
      }
      onNotify(`[수정 실패 · ${presented.code}] ${presented.message}`);
    }
  };

  const handleDeleteCase = async (id: string, name: string) => {
    try {
      const cleanCaseId = testCaseApiId(id);
      await deleteTestCase(cleanCaseId);
      publishCaseCountChange({ kind: 'delta', value: -1 });
      // 삭제 뒤 서버 메타데이터를 다시 읽어, 비어 버린 마지막 페이지는 자동으로 이전 페이지로 이동한다.
      reloadCases();
      onNotify(`테스트 케이스 '${name}'가 삭제되었습니다.`);
    } catch (error) {
      const presented = presentApiError(error, `'${name}' 삭제에 실패했습니다.`);
      onNotify(`[삭제 실패 · ${presented.code}] ${presented.message}`);
    }
  };

  const openDeleteConfirmation = () => {
    setIsDeleteConfirmOpen(true);
  };

  return createPortal(
    <div className={`fixed inset-0 ${LAYER_CLASS.dialog} flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-rise`}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-hidden={isDeleteConfirmOpen} aria-labelledby="suite-detail-title" tabIndex={-1} className="relative z-10 w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#e5e9ee] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-[#e5e9ee] flex justify-between items-start bg-[#fafbfb]">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl grid place-items-center text-xl font-bold"
              style={{ backgroundColor: suite.tintBg }}
            >
              {suite.icon}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 id="suite-detail-title" className="text-xl font-extrabold text-[#17202a]">{suite.name}</h2>
                {isLoading && <Loader2 size={14} className="animate-spin text-[#1a7f5a]" />}
              </div>
              <p className="text-xs text-[#697586]">{suite.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeSuiteDetail}
            disabled={editState.isSaving || isBulkSaving}
            aria-label="테스트 스위트 상세 창 닫기"
            className="p-2 rounded-xl text-[#697586] hover:bg-gray-200 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </div>

        {/* Notice Banner */}
        <div className="px-6 py-3 bg-[#edf6fc] border-b border-[#cfe6dd] text-[#245a80] text-xs flex items-center gap-2">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>
            <b>Snapshot 규칙</b>: 테스트 케이스를 수정/삭제해도 <b>기존 생성된 Run의 Snapshot은 유지</b>되며, 이후 생성되는 새 Run 대상에서만 반영됩니다.
          </span>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loadError !== null && (
            <RequestErrorBanner
              error={loadError}
              fallbackMessage="테스트 케이스 목록을 불러오지 못했습니다."
              stale={isCurrentSuiteLoaded}
              onRetry={reloadCases}
            />
          )}
          {/* Header & Add Button */}
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-[#17202a]">
                소속 테스트 케이스 목록 ({totalCaseCount ?? '—'}개)
              </h3>
              {isCurrentSuiteLoaded && isLoading && (
                <p role="status" className="mt-1 text-[11px] text-[#697586]">현재 페이지를 갱신하는 중입니다.</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(!isAdding);
                  setIsBulkAdding(false);
                  setIsBulkDirty(false);
                  setAddValidation(null);
                }}
                disabled={!isCurrentSuiteLoaded || isLoading || isBulkAdding || editState.caseId !== null || editState.isSaving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#17202a] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#253545] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={14} /> {isAdding ? '취소' : '케이스 추가'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isBulkAdding) {
                    closeBulkCreate();
                    return;
                  }
                  setIsAdding(false);
                  setAddValidation(null);
                  setIsBulkAdding(true);
                }}
                aria-expanded={isBulkAdding}
                disabled={!isCurrentSuiteLoaded || isLoading || isAdding || editState.caseId !== null || editState.isSaving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#17202a] bg-white px-3 py-1.5 text-xs font-bold text-[#17202a] hover:bg-[#eef1f4] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileUp size={14} /> {isBulkAdding ? '일괄 등록 닫기' : '일괄 등록'}
              </button>
            </div>
          </div>

          {/* Add Form (If active) */}
          {isAdding && (
            <div className="p-4 rounded-xl border border-[#1a7f5a]/30 bg-[#f1faf6] space-y-4">
              <h4 className="text-xs font-extrabold text-[#1a7f5a]">새 TestCase 추가</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label htmlFor="new-case-name" className="block text-[11px] font-bold text-[#4e5a68] mb-1">케이스 이름 *</label>
                  <input
                    ref={caseNameRef}
                    id="new-case-name"
                    type="text"
                    placeholder="예: 카드번호 유출 시도"
                    value={newCase.name || ''}
                    onChange={(e) => { setNewCase({ ...newCase, name: e.target.value }); clearAddValidation('name'); }}
                    aria-invalid={addValidation?.field === 'name'}
                    aria-describedby={addValidation?.field === 'name' ? 'add-case-validation-summary' : undefined}
                    className="w-full p-2.5 rounded-lg border border-[#dce1e6] bg-white outline-none focus:border-[#1a7f5a]"
                  />
                </div>
                <div>
                  <label htmlFor="new-case-category" className="block text-[11px] font-bold text-[#4e5a68] mb-1">카테고리 *</label>
                  <input
                    ref={caseCategoryRef}
                    id="new-case-category"
                    type="text"
                    placeholder="예: PII, PROMPT INJECTION"
                    value={newCase.category || ''}
                    onChange={(e) => { setNewCase({ ...newCase, category: e.target.value }); clearAddValidation('category'); }}
                    aria-invalid={addValidation?.field === 'category'}
                    aria-describedby={addValidation?.field === 'category' ? 'add-case-validation-summary' : undefined}
                    className="w-full p-2.5 rounded-lg border border-[#dce1e6] bg-white outline-none focus:border-[#1a7f5a]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="new-case-input" className="block text-[11px] font-bold text-[#4e5a68] mb-1">입력 프롬프트 (Input) *</label>
                  <textarea
                    ref={caseInputRef}
                    id="new-case-input"
                    rows={2}
                    placeholder="LLM에 전달할 입력 텍스트"
                    value={newCase.input || ''}
                    onChange={(e) => { setNewCase({ ...newCase, input: e.target.value }); clearAddValidation('input'); }}
                    aria-invalid={addValidation?.field === 'input'}
                    aria-describedby={addValidation?.field === 'input' ? 'add-case-validation-summary' : undefined}
                    className="w-full p-2.5 rounded-lg border border-[#dce1e6] bg-white outline-none focus:border-[#1a7f5a]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#4e5a68] mb-1">기대 동작</label>
                  <select
                    value={newCase.expectedAction}
                    onChange={(e) => setNewCase({ ...newCase, expectedAction: e.target.value as 'ALLOW' | 'BLOCK' })}
                    className="w-full p-2.5 rounded-lg border border-[#dce1e6] bg-white outline-none"
                  >
                    <option value="BLOCK">BLOCK (차단)</option>
                    <option value="ALLOW">ALLOW (허용)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#4e5a68] mb-1">Severity (심각도)</label>
                  <select
                    value={newCase.severity}
                    onChange={(e) => setNewCase({ ...newCase, severity: e.target.value as Severity })}
                    className="w-full p-2.5 rounded-lg border border-[#dce1e6] bg-white outline-none"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>
              {addValidation && (
                <div id="add-case-validation-summary" className="rounded-lg border border-[#e7c47f] bg-[#fff7e8] px-3 py-2 text-xs font-semibold text-[#78501b]">
                  {addValidation.message}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={handleAddCase}
                  className="px-4 py-2 rounded-lg bg-[#1a7f5a] text-white text-xs font-bold hover:bg-[#146648]"
                >
                  저장하기
                </button>
              </div>
            </div>
          )}

          {isBulkAdding && (
            <BulkTestCaseCreatePanel
              suiteId={suite.id.replace('suite-', '')}
              onCancel={closeBulkCreate}
              onDirtyChange={setIsBulkDirty}
              onSavingChange={setIsBulkSaving}
              onCreated={(response) => {
                setIsBulkAdding(false);
                setIsBulkDirty(false);
                publishCaseCountChange({ kind: 'total', value: response.totalTestCaseCount });
                setPage(1);
                reloadCases();
                onNotify(`테스트 케이스 ${response.createdCount}개가 등록되었습니다. (전체 ${response.totalTestCaseCount}개)`);
              }}
            />
          )}

          {/* TestCase Table */}
          <div className="border border-[#e5e9ee] rounded-xl overflow-hidden">
            <div className="max-h-[38vh] overflow-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-[#fafbfb] border-b border-[#e5e9ee] text-[#7a8592] font-bold uppercase text-[10px]">
                  <th className="p-3">케이스명 / 카테고리</th>
                  <th className="p-3">입력 프롬프트</th>
                  <th className="p-3">기대 동작</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e9ee]">
                {visibleCases.map((c) => (
                  <React.Fragment key={c.id}>
                    <tr className="hover:bg-[#fafcfb]">
                      <td className="p-3">
                        <b className="block text-[#17202a]">{c.name}</b>
                        <small className="text-[#697586]">{c.category}</small>
                      </td>
                      <td className="p-3 text-[#697586] max-w-xs truncate">{c.input}</td>
                      <td className="p-3 font-bold">
                        <span className={c.expectedAction === 'BLOCK' ? 'text-[#1a7f5a]' : 'text-[#246fa8]'}>
                          <ActionCode value={c.expectedAction} />
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[9px] font-black bg-[#eef1f4] text-[#566271]">
                          {c.severity}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1">
                        <button
                          ref={(node) => {
                            if (node) editButtonRefs.current.set(c.id, node);
                            else editButtonRefs.current.delete(c.id);
                          }}
                          type="button"
                          onClick={() => openEditCase(c)}
                          disabled={isLoading || isBulkAdding || editState.caseId !== null || editState.isSaving}
                          className="p-1.5 rounded text-[#697586] hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                          title="수정"
                          aria-label={`${c.name} 수정`}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCase(c.id, c.name)}
                          disabled={isBulkAdding || editState.caseId !== null || editState.isSaving}
                          className="p-1.5 rounded text-[#bd3b35] hover:bg-[#fff0ef] disabled:cursor-not-allowed disabled:opacity-40"
                          title="삭제"
                          aria-label={`${c.name} 삭제`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                    {editState.caseId === c.id && editState.draft && (
                      <tr className="bg-[#f1faf6]">
                        <td colSpan={5} className="p-4">
                          <form
                            aria-label={`${c.name} 수정`}
                            className="space-y-4"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void handleEditCase();
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <h4 className="text-xs font-extrabold text-[#1a7f5a]">TestCase 수정</h4>
                              {editState.isSaving && (
                                <span role="status" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#4e5a68]">
                                  <Loader2 size={13} className="animate-spin" /> 저장 중...
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                              <div>
                                <label htmlFor={`edit-case-name-${c.id}`} className="mb-1 block text-[11px] font-bold text-[#4e5a68]">케이스 이름 *</label>
                                <input
                                  ref={editCaseNameRef}
                                  id={`edit-case-name-${c.id}`}
                                  type="text"
                                  value={editState.draft.name}
                                  disabled={editState.isSaving}
                                  onChange={(event) => {
                                    setEditState((current) => changeTestCaseEdit(current, { name: event.target.value }, 'name'));
                                  }}
                                  aria-invalid={editState.validation?.field === 'name'}
                                  aria-describedby={editState.validation?.field === 'name' ? `edit-case-validation-${c.id}` : undefined}
                                  className="w-full rounded-lg border border-[#dce1e6] bg-white p-2.5 outline-none focus:border-[#1a7f5a] disabled:opacity-60"
                                />
                              </div>
                              <div>
                                <label htmlFor={`edit-case-category-${c.id}`} className="mb-1 block text-[11px] font-bold text-[#4e5a68]">카테고리 *</label>
                                <input
                                  ref={editCaseCategoryRef}
                                  id={`edit-case-category-${c.id}`}
                                  type="text"
                                  value={editState.draft.category}
                                  disabled={editState.isSaving}
                                  onChange={(event) => {
                                    setEditState((current) => changeTestCaseEdit(current, { category: event.target.value }, 'category'));
                                  }}
                                  aria-invalid={editState.validation?.field === 'category'}
                                  aria-describedby={editState.validation?.field === 'category' ? `edit-case-validation-${c.id}` : undefined}
                                  className="w-full rounded-lg border border-[#dce1e6] bg-white p-2.5 outline-none focus:border-[#1a7f5a] disabled:opacity-60"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label htmlFor={`edit-case-input-${c.id}`} className="mb-1 block text-[11px] font-bold text-[#4e5a68]">입력 프롬프트 (Input) *</label>
                                <textarea
                                  ref={editCaseInputRef}
                                  id={`edit-case-input-${c.id}`}
                                  rows={3}
                                  value={editState.draft.input}
                                  disabled={editState.isSaving}
                                  onChange={(event) => {
                                    setEditState((current) => changeTestCaseEdit(current, { input: event.target.value }, 'input'));
                                  }}
                                  aria-invalid={editState.validation?.field === 'input'}
                                  aria-describedby={editState.validation?.field === 'input' ? `edit-case-validation-${c.id}` : undefined}
                                  className="w-full rounded-lg border border-[#dce1e6] bg-white p-2.5 outline-none focus:border-[#1a7f5a] disabled:opacity-60"
                                />
                              </div>
                              <div>
                                <label htmlFor={`edit-case-action-${c.id}`} className="mb-1 block text-[11px] font-bold text-[#4e5a68]">기대 동작</label>
                                <select
                                  id={`edit-case-action-${c.id}`}
                                  value={editState.draft.expectedAction}
                                  disabled={editState.isSaving}
                                  onChange={(event) => setEditState((current) => changeTestCaseEdit(current, { expectedAction: event.target.value as 'ALLOW' | 'BLOCK' }))}
                                  className="w-full rounded-lg border border-[#dce1e6] bg-white p-2.5 outline-none disabled:opacity-60"
                                >
                                  <option value="BLOCK">BLOCK (차단)</option>
                                  <option value="ALLOW">ALLOW (허용)</option>
                                </select>
                              </div>
                              <div>
                                <label htmlFor={`edit-case-severity-${c.id}`} className="mb-1 block text-[11px] font-bold text-[#4e5a68]">Severity (심각도)</label>
                                <select
                                  id={`edit-case-severity-${c.id}`}
                                  value={editState.draft.severity}
                                  disabled={editState.isSaving}
                                  onChange={(event) => setEditState((current) => changeTestCaseEdit(current, { severity: event.target.value as Severity }))}
                                  className="w-full rounded-lg border border-[#dce1e6] bg-white p-2.5 outline-none disabled:opacity-60"
                                >
                                  <option value="CRITICAL">CRITICAL</option>
                                  <option value="HIGH">HIGH</option>
                                  <option value="MEDIUM">MEDIUM</option>
                                  <option value="LOW">LOW</option>
                                </select>
                              </div>
                            </div>
                            {editState.validation && (
                              <div
                                ref={editErrorRef}
                                id={`edit-case-validation-${c.id}`}
                                role="alert"
                                tabIndex={-1}
                                className="rounded-lg border border-[#e7c47f] bg-[#fff7e8] px-3 py-2 text-xs font-semibold text-[#78501b]"
                              >
                                {editState.validation.message}
                              </div>
                            )}
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={cancelEditCase}
                                disabled={editState.isSaving}
                                className="rounded-lg border border-[#dce1e6] px-4 py-2 text-xs font-bold text-[#4e5a68] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                취소
                              </button>
                              <button
                                type="submit"
                                aria-disabled={editState.isSaving}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a7f5a] px-4 py-2 text-xs font-bold text-white hover:bg-[#146648] aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                              >
                                {editState.isSaving && <Loader2 size={13} className="animate-spin" />}
                                {editState.isSaving ? '저장 중...' : '변경사항 저장'}
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {!isCurrentSuiteLoaded && isLoading && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-[#697586]">
                      테스트 케이스 목록을 불러오는 중입니다.
                    </td>
                  </tr>
                )}
                {isCurrentSuiteLoaded && visibleCases.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-[#697586]">
                      등록된 테스트 케이스가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="grid grid-cols-2 items-center gap-3 border-t border-[#e5e9ee] bg-[#fafbfb] p-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          {/* DOM order follows the mobile visual order; symmetric desktop tracks keep pagination centered. */}
          <nav aria-label="테스트 케이스 페이지네이션" className="col-span-2 col-start-1 row-start-1 flex min-w-0 max-w-full items-center justify-start gap-1 justify-self-stretch overflow-x-auto pb-1 sm:col-span-1 sm:col-start-2 sm:justify-center sm:justify-self-center sm:pb-0">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, (visiblePageMeta?.number ?? page) - 1))}
              disabled={!visiblePageMeta?.hasPrevious || isLoading || isBulkSaving || editState.caseId !== null}
              className="shrink-0 whitespace-nowrap rounded-lg border border-[#dce1e6] px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
            >
              이전
            </button>
            {visiblePageMeta && suiteDetailPageItems(visiblePageMeta.number, visiblePageMeta.totalPages).map((item, index) => item === 'ellipsis' ? (
              <span key={`ellipsis-${index}`} aria-hidden="true" className="px-1 text-xs text-[#697586]">…</span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => setPage(item)}
                disabled={isLoading || isBulkSaving || editState.caseId !== null}
                aria-current={item === visiblePageMeta.number ? 'page' : undefined}
                aria-label={`${item}페이지`}
                className={`min-w-8 rounded-lg px-2 py-2 text-xs font-bold disabled:cursor-not-allowed ${item === visiblePageMeta.number ? 'bg-[#17202a] text-white' : 'text-[#4e5a68] hover:bg-[#eef1f4]'}`}
              >
                {item}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((visiblePageMeta?.number ?? page) + 1)}
              disabled={!visiblePageMeta?.hasNext || isLoading || isBulkSaving || editState.caseId !== null}
              className="shrink-0 whitespace-nowrap rounded-lg border border-[#dce1e6] px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
            >
              다음
            </button>
          </nav>
          <button
            type="button"
            onClick={openDeleteConfirmation}
            disabled={isBulkAdding || isBulkSaving || editState.caseId !== null || editState.isSaving}
            className="col-start-1 row-start-2 inline-flex items-center gap-1.5 justify-self-start rounded-xl border border-[#e7aaa5] bg-[#fff0ef] px-4 py-2 text-xs font-bold text-[#a82f2a] hover:bg-[#ffe0de] disabled:cursor-not-allowed disabled:opacity-50 sm:row-start-1"
          >
            <Trash2 size={14} /> 스위트 삭제
          </button>
          <button
            type="button"
            onClick={closeSuiteDetail}
            disabled={editState.isSaving || isBulkSaving}
            className="col-start-2 row-start-2 justify-self-end rounded-xl bg-[#17202a] px-4 py-2 text-xs font-bold text-white hover:bg-[#253545] disabled:cursor-not-allowed disabled:opacity-50 sm:col-start-3 sm:row-start-1"
          >
            닫기
          </button>
        </div>
      </section>
      {isDeleteConfirmOpen && (
        <SuiteDeleteConfirmationDialog
          suite={suite}
          onClose={() => setIsDeleteConfirmOpen(false)}
          onDeleted={onDeleted}
          onNotify={onNotify}
        />
      )}
    </div>,
    document.body,
  );
};
