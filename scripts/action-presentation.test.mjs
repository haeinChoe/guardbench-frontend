import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const sourceUrl = new URL('../src/components/common/actionPresentation.ts', import.meta.url);
const { outputText } = ts.transpileModule(readFileSync(sourceUrl, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
});
const presentation = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('technical action codes use monospace while an absent action inherits the body font', () => {
  assert.deepEqual(presentation.actionCodePresentation('ALLOW'), {
    label: 'ALLOW',
    fontClassName: 'font-mono',
  });
  assert.deepEqual(presentation.optionalActionPresentation('BLOCK'), {
    label: 'BLOCK',
    fontClassName: 'font-mono',
  });
  assert.deepEqual(presentation.optionalActionPresentation(null), {
    label: '없음',
    fontClassName: '',
  });
});

test('action consumers use the shared typography components', () => {
  const expectations = [
    ['../src/components/views/ResultDetailView.tsx', ['<ActionCode value={selected.expectedAction}', '<OptionalActionValue value={selected.evaluatorVerdict}']],
    ['../src/components/views/RegressionComparisonSection.tsx', ['<ActionCode value={item.expectedAction}', '<OptionalActionValue value={item.comparisonVerdict}', '<OptionalActionValue value={item.currentVerdict}']],
    ['../src/components/common/SuiteDetailModal.tsx', ['<ActionCode value={c.expectedAction}']],
    ['../src/components/common/InitialTestCasesEditor.tsx', ['<ActionCode value={testCase.expectedAction}']],
  ];

  for (const [relativePath, requiredUsages] of expectations) {
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    for (const usage of requiredUsages) assert.ok(source.includes(usage), `${relativePath} must use ${usage}`);
  }
});

test('error banner keeps its Korean label in the body font and isolates the technical code', () => {
  const source = readFileSync(new URL('../src/components/common/RequestErrorBanner.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /<p className="[^"]*font-mono[^"]*">오류 코드:/);
  assert.match(source, /오류 코드: <span className="font-mono">\{presented\.code\}<\/span>/);
});
