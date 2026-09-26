import React, { useRef, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import type { TestSuite } from '../../types';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { deleteTestSuite } from '../../services/testSuiteService';
import { presentApiError } from '../../services/apiClient';
import { RequestErrorBanner } from './RequestErrorBanner';

interface SuiteDeleteConfirmationDialogProps {
  suite: TestSuite;
  onClose: () => void;
  onDeleted: () => void;
  onNotify: (message: string) => void;
}

export const SuiteDeleteConfirmationDialog: React.FC<SuiteDeleteConfirmationDialogProps> = ({
  suite,
  onClose,
  onDeleted,
  onNotify,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<unknown>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const deleteInFlightRef = useRef(false);
  const dialogRef = useDialogFocus({
    isOpen: true,
    onClose: () => {
      if (!isDeleting) onClose();
    },
    initialFocusRef: cancelButtonRef,
  });

  const handleDelete = async () => {
    if (deleteInFlightRef.current) return;

    deleteInFlightRef.current = true;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const cleanSuiteId = suite.id.replace('suite-', '');
      await deleteTestSuite(cleanSuiteId);
      deleteInFlightRef.current = false;
      setIsDeleting(false);
      onNotify(`테스트 스위트 '${suite.name}'가 삭제되었습니다.`);
      onDeleted();
    } catch (error) {
      deleteInFlightRef.current = false;
      setIsDeleting(false);
      setDeleteError(error);
      const presented = presentApiError(error, `'${suite.name}' 삭제에 실패했습니다.`);
      onNotify(`[스위트 삭제 실패 · ${presented.code}] ${presented.message}`);
    }
  };

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
      <section
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-suite-title"
        aria-describedby="delete-suite-description"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-[#f1c4bf] bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fff0ef] text-[#bd3b35]">
            <Trash2 size={19} />
          </div>
          <div>
            <h2 id="delete-suite-title" className="text-base font-extrabold text-[#17202a]">테스트 스위트를 삭제할까요?</h2>
            <p id="delete-suite-description" className="mt-2 text-xs leading-relaxed text-[#586473]">
              <b className="text-[#17202a]">{suite.name}</b>과 현재 소속된 TestCase가 영구 삭제됩니다. 기존 Run과 Snapshot, 실행·평가 결과는 유지됩니다.
            </p>
          </div>
        </div>
        {deleteError !== null && (
          <div className="mt-4">
            <RequestErrorBanner
              error={deleteError}
              fallbackMessage="테스트 스위트를 삭제하지 못했습니다."
              onRetry={handleDelete}
            />
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-lg border border-[#dce1e6] px-4 py-2 text-xs font-bold text-[#4e5a68] hover:bg-[#f5f7f8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#bd3b35] px-4 py-2 text-xs font-bold text-white hover:bg-[#9f2f2a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting && <Loader2 size={14} className="animate-spin" />} {isDeleting ? '삭제 중...' : '삭제하기'}
          </button>
        </div>
      </section>
    </div>
  );
};
