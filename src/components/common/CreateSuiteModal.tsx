import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, X } from 'lucide-react';
import { ApiError } from '../../services/apiClient';
import { createTestSuite } from '../../services/testSuiteService';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { LAYER_CLASS } from '../../config/layers';
import { InitialTestCasesEditor, type InitialTestCasesEditorHandle } from './InitialTestCasesEditor';

interface CreateSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

type SuiteValidation = { field: 'name' | 'request'; message: string };

export const CreateSuiteModal: React.FC<CreateSuiteModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [validation, setValidation] = useState<SuiteValidation | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<InitialTestCasesEditorHandle>(null);

  const close = useCallback(() => {
    setName('');
    setDescription('');
    setValidation(null);
    onClose();
  }, [onClose]);

  const dialogRef = useDialogFocus({ isOpen, onClose: close, initialFocusRef: nameInputRef });

  if (!isOpen) return null;

  const failValidation = (field: SuiteValidation['field'], message: string) => {
    setValidation({ field, message });
    if (field === 'name') requestAnimationFrame(() => nameInputRef.current?.focus());
  };

  const submit = async () => {
    if (!name.trim()) {
      failValidation('name', '테스트 스위트 이름을 입력해 주세요.');
      return;
    }

    const testCases = editorRef.current?.getValidatedCases();
    if (!testCases) return;

    setIsSubmitting(true);
    setValidation(null);
    editorRef.current?.clearServerErrors();
    try {
      await createTestSuite({
        name: name.trim(),
        description: description.trim() || null,
        testCases: testCases.length > 0 ? testCases : undefined,
      });
      onCreated();
      close();
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors?.length) {
        const suiteNameError = error.fieldErrors.find(({ field }) => field === 'name');
        if (suiteNameError) {
          failValidation('name', `[${error.code}] ${suiteNameError.message}`);
        } else if (!editorRef.current?.handleFieldErrors(error.fieldErrors, error.code)) {
          failValidation('request', `[${error.code}] ${error.fieldErrors.map(({ message }) => message).join(' ')}`);
        }
      } else if (error instanceof ApiError) {
        failValidation('request', `[${error.code}] ${error.message}`);
      } else {
        failValidation('request', error instanceof Error ? error.message : '테스트 스위트를 생성하지 못했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className={`fixed inset-0 ${LAYER_CLASS.dialog} flex items-start justify-center overflow-y-auto px-4 py-[5vh]`}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" aria-hidden="true" />
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="create-suite-title" tabIndex={-1} className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#e5e9ee] bg-white shadow-2xl animate-rise">
        <header className="flex items-start justify-between border-b border-[#e5e9ee] bg-[#fafbfb] p-6">
          <div>
            <p className="mb-1 text-xs font-black uppercase tracking-widest text-[#1a7f5a]">Test catalog</p>
            <h2 id="create-suite-title" className="text-xl font-extrabold text-[#17202a]">새 테스트 스위트 만들기</h2>
            <p className="mt-1 text-xs text-[#697586]">검증 목적을 등록하고, 필요하면 초기 테스트 케이스를 함께 추가합니다.</p>
          </div>
          <button type="button" onClick={close} aria-label="새 테스트 스위트 생성 창 닫기" className="rounded-xl p-2 text-[#697586] transition-colors hover:bg-gray-200"><X size={20} /></button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
          <div className="shrink-0 space-y-4">
            <div>
              <label htmlFor="suite-name" className="mb-1 block text-xs font-bold text-[#4e5a68]">스위트 이름 <span className="text-[#bd3b35]">*</span></label>
              <input ref={nameInputRef} id="suite-name" type="text" value={name} onChange={(event) => { setName(event.target.value); setValidation((current) => current?.field === 'name' ? null : current); }} aria-invalid={validation?.field === 'name'} aria-describedby={validation?.field === 'name' ? 'create-suite-validation-summary' : undefined} placeholder="예: Customer Support Safety" className="w-full rounded-lg border border-[#dce1e6] bg-white p-2.5 text-sm outline-none focus:border-[#1a7f5a]" />
            </div>
            <div>
              <label htmlFor="suite-description" className="mb-1 block text-xs font-bold text-[#4e5a68]">설명 <span className="font-normal text-[#697586]">(선택)</span></label>
              <textarea id="suite-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="이 스위트에서 검증할 정책과 목적을 설명해 주세요." className="w-full resize-y rounded-lg border border-[#dce1e6] bg-white p-2.5 text-sm outline-none focus:border-[#1a7f5a]" />
            </div>
          </div>

          <InitialTestCasesEditor ref={editorRef} />

          {validation && <div id="create-suite-validation-summary" className="shrink-0 rounded-xl border border-[#f0ddb0] bg-[#fff5e8] px-4 py-3 text-xs text-[#805100"><p className="mb-1 font-bold">입력 또는 요청을 확인해 주세요.</p><div className="flex items-center gap-2"><AlertCircle size={16} className="shrink-0" />{validation.message}</div></div>}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[#e5e9ee] bg-[#fafbfb] p-4">
          <span className="text-[11px] text-[#697586]">등록 후 현재 목록을 다시 불러옵니다.</span>
          <div className="flex gap-2">
            <button type="button" onClick={close} disabled={isSubmitting} className="rounded-xl px-4 py-2 text-xs font-bold text-[#4e5a68] hover:bg-[#eef1f4] disabled:opacity-50">취소</button>
            <button type="button" onClick={submit} disabled={isSubmitting} className="rounded-xl bg-[#17202a] px-4 py-2 text-xs font-bold text-white hover:bg-[#253545] disabled:opacity-50">{isSubmitting ? '등록 중...' : '스위트 만들기'}</button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
};
