import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const sourceUrl = new URL('../src/components/views/resultPaginationPresentation.ts', import.meta.url);
const { outputText } = ts.transpileModule(readFileSync(sourceUrl, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
});
const presentation = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('페이지가 일곱 개 이하면 모든 페이지를 연속해서 보여준다', () => {
  assert.deepEqual(presentation.resultPageItems(4, 7), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(presentation.resultPageItems(1, 0), []);
});

test('페이지가 많으면 현재 페이지 주변과 시작·끝, 필요한 생략 표시를 만든다', () => {
  assert.deepEqual(presentation.resultPageItems(1, 10), [1, 2, 3, 4, 'ellipsis', 10]);
  assert.deepEqual(presentation.resultPageItems(5, 10), [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]);
  assert.deepEqual(presentation.resultPageItems(10, 10), [1, 'ellipsis', 7, 8, 9, 10]);
});
