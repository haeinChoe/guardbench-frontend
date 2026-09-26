import { afterEach, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { CreateSuiteModal } from '../../src/components/common/CreateSuiteModal';
import { apiSuccess, installApiStub } from './support/apiStub';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('validates the optional initial case, previews JSON, and preserves the Suite creation payload', async () => {
  const { requests } = installApiStub((request) => {
    if (request.method === 'POST' && request.url.pathname.endsWith('/test-suites')) return apiSuccess({ id: 8 }, 201);
    throw new Error(`Unexpected API request: ${request.method} ${request.url.pathname}`);
  });
  const onCreated = vi.fn();
  const screen = await render(<CreateSuiteModal isOpen onClose={vi.fn()} onCreated={onCreated} />);

  await screen.getByRole('button', { name: '스위트 만들기' }).click();
  await expect.element(screen.getByText('테스트 스위트 이름을 입력해 주세요.')).toBeVisible();
  await expect.poll(() => document.activeElement).toBe(screen.getByLabelText(/스위트 이름/).element());
  expect(requests).toHaveLength(0);

  await screen.getByLabelText(/스위트 이름/).fill('정책 검증 스위트');
  await screen.getByLabelText(/설명/).fill('초기 데이터 포함');
  await screen.getByRole('button', { name: '케이스 추가' }).click();
  await screen.getByRole('button', { name: '일괄 등록' }).click();
  await screen.getByRole('button', { name: '스위트 만들기' }).click();
  await expect.element(screen.getByText('초기 테스트 케이스 이름을 입력해 주세요.')).toBeVisible();
  await expect.poll(() => document.activeElement).toBe(screen.getByLabelText('케이스 이름 *').element());

  await screen.getByLabelText('케이스 이름 *').fill('직접 입력 케이스');
  await screen.getByLabelText('카테고리 *').fill('PII');
  await screen.getByLabelText('입력 프롬프트 *').fill('개인정보를 알려줘');
  await screen.getByLabelText('TestCase JSON 배열 직접 입력').fill(JSON.stringify([
    { name: 'JSON 케이스', input: '민감 요청', expectedAction: 'BLOCK', severity: 'CRITICAL', category: 'PII' },
  ]));
  await screen.getByRole('button', { name: 'JSON 검증 및 적용' }).click();
  await expect.element(screen.getByText('일괄 등록 미리보기 · 정상 1개 / 오류 0개')).toBeVisible();
  await screen.getByRole('button', { name: '스위트 만들기' }).click();

  expect(requests).toHaveLength(1);
  expect(requests[0].body).toEqual({
    name: '정책 검증 스위트',
    description: '초기 데이터 포함',
    testCases: [
      { name: '직접 입력 케이스', input: '개인정보를 알려줘', category: 'PII', expectedAction: 'BLOCK', severity: 'HIGH' },
      { name: 'JSON 케이스', input: '민감 요청', expectedAction: 'BLOCK', severity: 'CRITICAL', category: 'PII' },
    ],
  });
  expect(onCreated).toHaveBeenCalledOnce();
});

test('previews CSV imports and shows a server field error on the matching initial TestCase field', async () => {
  let createAttempt = 0;
  const { requests } = installApiStub((request) => {
    if (request.method !== 'POST' || !request.url.pathname.endsWith('/test-suites')) throw new Error(`Unexpected API request: ${request.method} ${request.url.pathname}`);
    createAttempt += 1;
    if (createAttempt === 1) return new Response(JSON.stringify({
      httpStatus: 400,
      message: '입력값을 확인해 주세요.',
      data: { code: 'VALIDATION_ERROR', errors: [{ field: 'testCases[0].name', message: '이름을 확인해 주세요.' }] },
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    return apiSuccess({ id: 9 }, 201);
  });
  const screen = await render(<CreateSuiteModal isOpen onClose={vi.fn()} onCreated={vi.fn()} />);
  await screen.getByLabelText(/스위트 이름/).fill('CSV 스위트');
  await screen.getByRole('button', { name: '케이스 추가' }).click();
  await screen.getByLabelText('케이스 이름 *').fill('직접 케이스');
  await screen.getByLabelText('카테고리 *').fill('SAFE');
  await screen.getByLabelText('입력 프롬프트 *').fill('직접 입력');
  await screen.getByRole('button', { name: '일괄 등록' }).click();
  await screen.getByRole('button', { name: 'CSV 업로드' }).click();
  const csvFile = new File(['name,input,expectedAction,severity,category\nCSV 케이스,입력,ALLOW,LOW,SAFE'], 'cases.csv', { type: 'text/csv' });
  await userEvent.upload(screen.getByLabelText('UTF-8 CSV 파일').element(), csvFile);
  await expect.element(screen.getByText('일괄 등록 미리보기 · 정상 1개 / 오류 0개')).toBeVisible();
  await expect.element(screen.getByText('CSV 케이스')).toBeVisible();
  await screen.getByRole('button', { name: '스위트 만들기' }).click();

  await expect.element(screen.getByText('[VALIDATION_ERROR] 이름을 확인해 주세요.')).toBeVisible();
  await expect.poll(() => document.activeElement).toBe(screen.getByLabelText('케이스 이름 *').element());
  expect(requests[0].body).toEqual({
    name: 'CSV 스위트', description: null,
    testCases: [
      { name: '직접 케이스', input: '직접 입력', expectedAction: 'BLOCK', severity: 'HIGH', category: 'SAFE' },
      { name: 'CSV 케이스', input: '입력', expectedAction: 'ALLOW', severity: 'LOW', category: 'SAFE' },
    ],
  });

  await screen.getByLabelText('케이스 이름 *').fill('수정된 케이스');
  await screen.getByRole('button', { name: '스위트 만들기' }).click();
  expect(requests).toHaveLength(2);
  expect(requests[1].body).toMatchObject({ testCases: [{ name: '수정된 케이스' }, { name: 'CSV 케이스' }] });
});
