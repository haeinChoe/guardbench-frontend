import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyChangedPaths, resolveChangeScope } from './ci-change-scope.mjs';

test('documentation-only changes skip application verification and deployment', () => {
  assert.deepEqual(
    classifyChangedPaths(['README.md', 'docs/operations/frontend-deployment.md']),
    { verificationRequired: false, deploymentRequired: false },
  );
});

test('source and web assets require verification and deployment', () => {
  assert.deepEqual(classifyChangedPaths(['src/App.tsx']), {
    verificationRequired: true,
    deploymentRequired: true,
  });
  assert.deepEqual(classifyChangedPaths(['public/robots.txt']), {
    verificationRequired: true,
    deploymentRequired: true,
  });
});

test('tests, tooling, and workflow changes require verification without deployment', () => {
  for (const path of [
    'scripts/ci-change-scope.mjs',
    'tests/browser/run.browser.test.tsx',
    '.github/workflows/deploy.yml',
    'tsconfig.browser.json',
    'vitest.config.ts',
    '.node-version',
  ]) {
    assert.deepEqual(classifyChangedPaths([path]), {
      verificationRequired: true,
      deploymentRequired: false,
    });
  }
});

test('build dependency changes require verification and deployment', () => {
  assert.deepEqual(classifyChangedPaths(['package-lock.json']), {
    verificationRequired: true,
    deploymentRequired: true,
  });
});

test('mixed documentation and source changes use the source verification scope', () => {
  assert.deepEqual(classifyChangedPaths(['docs/testing.md', 'src/App.tsx']), {
    verificationRequired: true,
    deploymentRequired: true,
  });
});

test('manual verification always runs and never deploys', () => {
  assert.deepEqual(resolveChangeScope('workflow_dispatch', '', ['src/App.tsx']), {
    verificationRequired: true,
    deploymentRequired: false,
  });
});

test('initial push verifies without triggering deployment', () => {
  assert.deepEqual(resolveChangeScope('push', '0000000000000000000000000000000000000000', []), {
    verificationRequired: true,
    deploymentRequired: false,
  });
});
