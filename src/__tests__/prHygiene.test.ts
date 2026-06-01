import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from 'node:child_process';
import { checkPrHygiene, formatPrHygieneFailure } from '../infra/git/prHygiene.js';

const mockExecFileSync = vi.mocked(execFileSync);

function mockDiffInspection(options: {
  nameStatus: string;
  numstat: string;
  existingRefs?: readonly string[];
}): void {
  const existingRefs = options.existingRefs ?? ['main'];
  mockExecFileSync.mockImplementation((_cmd, args) => {
    const argsArr = args as string[];
    if (argsArr[0] === 'rev-parse') {
      const ref = (argsArr[2] ?? '').replace(/\^\{commit\}$/, '');
      if (existingRefs.includes(ref)) {
        return `${ref}\n`;
      }
      throw new Error(`unknown ref: ${ref}`);
    }
    if (argsArr[0] === 'diff' && argsArr[1] === '--name-status') {
      return options.nameStatus;
    }
    if (argsArr[0] === 'diff' && argsArr[1] === '--numstat') {
      return options.numstat;
    }
    throw new Error(`unexpected git command: ${argsArr.join(' ')}`);
  });
}

describe('checkPrHygiene', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks Takt runtime and generated dependency paths', () => {
    mockDiffInspection({
      nameStatus: [
        'A\t.takt/runs/sample/reports/00-plan.md',
        'A\tnode_modules/pkg/index.js',
        'M\tsrc/index.ts',
      ].join('\n'),
      numstat: [
        '10\t0\t.takt/runs/sample/reports/00-plan.md',
        '5\t0\tnode_modules/pkg/index.js',
        '2\t1\tsrc/index.ts',
      ].join('\n'),
    });

    const result = checkPrHygiene('/repo', {
      baseBranch: 'main',
      branch: 'feat/work',
    });

    expect(result.ok).toBe(false);
    expect(result.changedLines).toBe(18);
    expect(result.violations).toEqual([
      expect.objectContaining({
        type: 'blocked-path',
        paths: [
          '.takt/runs/sample/reports/00-plan.md',
          'node_modules/pkg/index.js',
        ],
      }),
    ]);
    expect(formatPrHygieneFailure(result)).toContain('Blocked generated/runtime paths detected');
  });

  it('blocks abnormally large diffs', () => {
    mockDiffInspection({
      nameStatus: 'M\tsrc/index.ts',
      numstat: '3001\t2500\tsrc/index.ts',
    });

    const result = checkPrHygiene('/repo', {
      baseBranch: 'main',
      branch: 'feat/work',
      maxChangedLines: 5_000,
    });

    expect(result.ok).toBe(false);
    expect(result.changedLines).toBe(5_501);
    expect(result.violations).toEqual([
      expect.objectContaining({
        type: 'diff-too-large',
        changedLines: 5_501,
        maxChangedLines: 5_000,
      }),
    ]);
  });

  it('passes normal application diffs', () => {
    mockDiffInspection({
      nameStatus: 'M\tsrc/index.ts',
      numstat: '20\t4\tsrc/index.ts',
    });

    const result = checkPrHygiene('/repo', {
      baseBranch: 'main',
      branch: 'feat/work',
    });

    expect(result.ok).toBe(true);
    expect(result.changedLines).toBe(24);
    expect(result.violations).toEqual([]);
  });

  it('resolves provided base branches to remote tracking refs when no local branch exists', () => {
    mockDiffInspection({
      existingRefs: ['origin/main'],
      nameStatus: 'M\tsrc/index.ts',
      numstat: '20\t4\tsrc/index.ts',
    });

    const result = checkPrHygiene('/repo', {
      baseBranch: 'main',
      branch: 'feat/work',
    });

    expect(result.ok).toBe(true);
    expect(result.baseRef).toBe('origin/main');
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      ['diff', '--name-status', 'origin/main...feat/work'],
      expect.objectContaining({ cwd: '/repo' }),
    );
  });

  it('fails closed when the diff cannot be inspected', () => {
    mockExecFileSync.mockImplementation((_cmd, args) => {
      const argsArr = args as string[];
      if (argsArr[0] === 'rev-parse') {
        return 'main\n';
      }
      throw new Error('fatal: ambiguous argument');
    });

    const result = checkPrHygiene('/repo', {
      baseBranch: 'main',
      branch: 'feat/work',
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({
        type: 'diff-unavailable',
        message: expect.stringContaining('Unable to inspect PR diff'),
      }),
    ]);
  });
});
