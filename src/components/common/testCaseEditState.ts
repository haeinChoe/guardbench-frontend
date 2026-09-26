import type { CreateTestCasePayload } from '../../services/testCaseService';
import type { TestCase } from '../../types';

export type CaseValidationField = 'name' | 'input' | 'category' | 'request';

export type CaseValidation = {
  field: CaseValidationField;
  message: string;
};

export const testCaseValidationFieldFromApiField = (field: string): CaseValidationField => {
  if (field.endsWith('name')) return 'name';
  if (field.endsWith('input')) return 'input';
  if (field.endsWith('category')) return 'category';
  return 'request';
};

export type EditableTestCase = CreateTestCasePayload;

export type TestCaseEditState = {
  caseId: string | null;
  original: EditableTestCase | null;
  draft: EditableTestCase | null;
  validation: CaseValidation | null;
  isSaving: boolean;
};

export const EMPTY_TEST_CASE_EDIT: TestCaseEditState = {
  caseId: null,
  original: null,
  draft: null,
  validation: null,
  isSaving: false,
};

const editableFields = (testCase: Pick<TestCase, keyof EditableTestCase>): EditableTestCase => ({
  name: testCase.name,
  input: testCase.input,
  expectedAction: testCase.expectedAction,
  severity: testCase.severity,
  category: testCase.category,
});

export const beginTestCaseEdit = (testCase: TestCase): TestCaseEditState => {
  const draft = editableFields(testCase);
  return {
    caseId: testCase.id,
    original: { ...draft },
    draft,
    validation: null,
    isSaving: false,
  };
};

export const changeTestCaseEdit = (
  state: TestCaseEditState,
  changes: Partial<EditableTestCase>,
  changedField?: CaseValidationField,
): TestCaseEditState => ({
  ...state,
  draft: state.draft ? { ...state.draft, ...changes } : null,
  validation: state.validation?.field === changedField || state.validation?.field === 'request'
    ? null
    : state.validation,
});

export const validateTestCaseEdit = (
  draft: EditableTestCase,
): { payload: EditableTestCase; validation: null } | { payload: null; validation: CaseValidation } => {
  const payload = {
    ...draft,
    name: draft.name.trim(),
    input: draft.input.trim(),
    category: draft.category.trim(),
  };
  if (!payload.name) {
    return { payload: null, validation: { field: 'name', message: '테스트 케이스 이름을 입력해 주세요.' } };
  }
  if (!payload.input) {
    return { payload: null, validation: { field: 'input', message: '테스트 케이스 입력값을 입력해 주세요.' } };
  }
  if (!payload.category) {
    return { payload: null, validation: { field: 'category', message: '테스트 케이스 카테고리를 입력해 주세요.' } };
  }
  return { payload, validation: null };
};

export const startTestCaseEditSave = (state: TestCaseEditState): TestCaseEditState => ({
  ...state,
  validation: null,
  isSaving: true,
});

export const canStartTestCaseEditSave = (
  state: TestCaseEditState,
): state is TestCaseEditState & { caseId: string; draft: EditableTestCase } => (
  state.caseId !== null && state.draft !== null && !state.isSaving
);

export const failTestCaseEditSave = (
  state: TestCaseEditState,
  validation: CaseValidation,
): TestCaseEditState => ({
  ...state,
  validation,
  isSaving: false,
});

export const isTestCaseEditDirty = ({ original, draft }: TestCaseEditState) => (
  original !== null
  && draft !== null
  && (Object.keys(original) as Array<keyof EditableTestCase>)
    .some((field) => original[field] !== draft[field])
);

export const testCaseApiId = (id: string) => id.replace(/^tc-/, '');
