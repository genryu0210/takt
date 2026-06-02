import { describe, expect, it } from 'vitest';
import { buildConventionalBranchName, resolveConventionalBranchType } from '../infra/task/branchName.js';

describe('conventional branch names', () => {
  it('uses fix for bug labels even when the slug looks like a feature', () => {
    const type = resolveConventionalBranchType({
      taskSlug: 'add-login-timeout',
      taskContent: [
        '## Issue #42: Add login timeout handling',
        '',
        '### Labels',
        'bug, priority:high',
      ].join('\n'),
    });

    expect(type).toBe('fix');
  });

  it('uses conventional prefixes with issue numbers', () => {
    const branch = buildConventionalBranchName({
      taskSlug: 'update-readme',
      taskContent: [
        '## Issue #12: Update README',
        '',
        '### Labels',
        'documentation',
      ].join('\n'),
      issueNumber: 12,
      timestamp: '20260530T1200',
    });

    expect(branch).toBe('docs/issue-12-update-readme');
  });

  it('defaults to feat when no label or keyword matches', () => {
    const branch = buildConventionalBranchName({
      taskSlug: 'visit-nursing-comment',
      timestamp: '20260530T1200',
    });

    expect(branch).toBe('feat/visit-nursing-comment');
  });
});

