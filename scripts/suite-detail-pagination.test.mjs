import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/components/common/suiteDetailPagination.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
});
const pagination = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('pagination includes every page when the total fits without ellipses', () => {
  assert.deepEqual(pagination.suiteDetailPageItems(3, 7), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(pagination.suiteDetailPageItems(1, 0), []);
});

test('pagination adds leading and trailing ellipses around the current page window', () => {
  assert.deepEqual(pagination.suiteDetailPageItems(5, 10), [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]);
  assert.deepEqual(pagination.suiteDetailPageItems(1, 10), [1, 2, 3, 4, 'ellipsis', 10]);
  assert.deepEqual(pagination.suiteDetailPageItems(10, 10), [1, 'ellipsis', 7, 8, 9, 10]);
});

test('pagination keeps the current page and its immediate neighbors visible', () => {
  assert.deepEqual(pagination.suiteDetailPageItems(4, 9), [1, 'ellipsis', 3, 4, 5, 'ellipsis', 9]);
});
