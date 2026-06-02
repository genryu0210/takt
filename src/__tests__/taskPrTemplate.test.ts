import { describe, expect, it } from 'vitest';
import { buildTaskPrBody, buildTaskPrTitle } from '../features/tasks/execute/prTemplate.js';
import type { Issue } from '../infra/git/index.js';

describe('task PR templates', () => {
  const issue: Issue = {
    number: 129,
    title: 'Add visit nursing comment',
    body: [
      '## Background',
      'Visit nursing users need a supplemental comment.',
      '',
      '## Acceptance Criteria',
      '- Comments can be saved',
      '- Empty comments do not change existing display',
      '',
      '## Out of Scope',
      '- CSV import support',
    ].join('\n'),
    labels: [],
    comments: [],
  };

  it('expands title templates for normal task auto PRs', () => {
    const title = buildTaskPrTitle({
      pullRequestConfig: {
        titleTemplate: '[#{issue}] {summary}',
      },
      issues: [issue],
      report: 'Workflow `backend-lite` completed successfully.',
      task: 'Implement the issue.',
      workflowIdentifier: 'backend-lite',
      branch: 'feat/issue-129-visit-nursing-comment',
    });

    expect(title).toBe('[#129] Add visit nursing comment');
  });

  it('renders only configured body sections that have values', () => {
    const body = buildTaskPrBody({
      pullRequestConfig: {
        bodySections: ['summary', 'background', 'changes', 'acceptance_criteria', 'out_of_scope', 'verification'],
      },
      issues: [issue],
      report: 'Workflow `backend-lite` completed successfully.',
      task: 'Implement the issue.',
    });

    expect(body).toBe([
      '## Summary',
      '',
      'Add visit nursing comment',
      '',
      '## Background',
      '',
      'Visit nursing users need a supplemental comment.',
      '',
      '## Acceptance Criteria',
      '',
      '- Comments can be saved',
      '- Empty comments do not change existing display',
      '',
      '## Out of Scope',
      '',
      '- CSV import support',
      '',
      '## Verification',
      '',
      'Workflow `backend-lite` completed successfully.',
      '',
      'Closes #129',
    ].join('\n'));
    expect(body).not.toContain('## Changes');
  });

  it('expands full body templates when configured', () => {
    const body = buildTaskPrBody({
      pullRequestConfig: {
        bodyTemplate: [
          '## Summary',
          '{summary}',
          '',
          '## Verification',
          '{verification}',
          '',
          'Closes #{issue}',
        ].join('\n'),
      },
      issues: [issue],
      report: 'Task completed successfully.',
      task: 'Implement the issue.',
    });

    expect(body).toBe([
      '## Summary',
      'Add visit nursing comment',
      '',
      '## Verification',
      'Task completed successfully.',
      '',
      'Closes #129',
    ].join('\n'));
  });

  it('uses orderContent as the {task} template value when available', () => {
    const body = buildTaskPrBody({
      pullRequestConfig: {
        bodyTemplate: [
          '## Task',
          '{task}',
        ].join('\n'),
      },
      report: 'Task completed successfully.',
      task: 'generated-task-name',
      orderContent: [
        '# Task Spec',
        '',
        'Implement the full order.md content.',
      ].join('\n'),
    });

    expect(body).toBe([
      '## Task',
      '# Task Spec',
      '',
      'Implement the full order.md content.',
    ].join('\n'));
  });
});
