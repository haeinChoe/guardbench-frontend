import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const verificationPathPatterns = [
  /^\.github\/(actions|workflows)\//,
  /^public\//,
  /^scripts\//,
  /^src\//,
  /^tests\//,
  /^index\.html$/,
  /^package(-lock)?\.json$/,
  /^postcss\.config\./,
  /^tailwind\.config\./,
  /^tsconfig(?:\.[^/]+)?\.json$/,
  /^vite\.config\./,
  /^vitest\.config\./,
  /^\.node-version$/,
  /^\.oxlintrc(?:\..+)?$/,
  /^oxlint\.config\./,
];

const deploymentPathPatterns = [
  /^public\//,
  /^src\//,
  /^index\.html$/,
  /^package(-lock)?\.json$/,
  /^postcss\.config\./,
  /^tailwind\.config\./,
  /^vite\.config\./,
];

export function classifyChangedPaths(paths) {
  return {
    verificationRequired: paths.some((path) =>
      verificationPathPatterns.some((pattern) => pattern.test(path)),
    ),
    deploymentRequired: paths.some((path) =>
      deploymentPathPatterns.some((pattern) => pattern.test(path)),
    ),
  };
}

const isAllZeroSha = (value) => /^0+$/.test(value ?? '');

export function resolveChangeScope(eventName, baseSha, changedPaths) {
  if (eventName === 'workflow_dispatch' || isAllZeroSha(baseSha)) {
    return { verificationRequired: true, deploymentRequired: false };
  }

  return classifyChangedPaths(changedPaths);
}

function main() {
  const eventName = process.env.EVENT_NAME;
  const baseSha = process.env.BASE_SHA ?? '';
  const headSha = process.env.HEAD_SHA ?? '';
  let changedPaths = [];
  if (eventName !== 'workflow_dispatch' && !isAllZeroSha(baseSha)) {
    if (!baseSha || !headSha) {
      throw new Error('BASE_SHA and HEAD_SHA are required to detect changed scope.');
    }

    const output = execFileSync('git', ['diff', '--name-only', '--no-renames', baseSha, headSha], {
      encoding: 'utf8',
    });
    changedPaths = output.split('\n').filter(Boolean);
  }

  const scope = resolveChangeScope(eventName, baseSha, changedPaths);

  if (!process.env.GITHUB_OUTPUT) {
    throw new Error('GITHUB_OUTPUT is required to publish the detected scope.');
  }

  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `verification_required=${scope.verificationRequired}\ndeployment_required=${scope.deploymentRequired}\n`,
  );
  process.stdout.write(
    `verification_required=${scope.verificationRequired} deployment_required=${scope.deploymentRequired}\n`,
  );
}

if (process.argv[1]?.endsWith('ci-change-scope.mjs')) {
  main();
}
