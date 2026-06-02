import type { PullRequestBodySection, PullRequestConfig } from '../../../core/models/index.js';
import type { Issue } from '../../../infra/git/index.js';
import { expandPipelineTemplate } from '../../pipeline/templateExpander.js';

export interface TaskPrTemplateContext {
  pullRequestConfig?: PullRequestConfig;
  issues?: Issue[];
  report: string;
  task: string;
  orderContent?: string;
  branch?: string;
  workflowIdentifier?: string;
}

type SectionDefinition = {
  key: PullRequestBodySection;
  title: string;
  aliases: string[];
};

type TemplateVars = Record<PullRequestBodySection, string> & {
  issue: string;
  title: string;
  report: string;
  task: string;
  workflow: string;
  branch: string;
};

const SECTION_DEFINITIONS: SectionDefinition[] = [
  { key: 'summary', title: 'Summary', aliases: ['summary', 'overview', '概要'] },
  { key: 'background', title: 'Background', aliases: ['background', 'context', '背景'] },
  { key: 'changes', title: 'Changes', aliases: ['changes', 'change', '変更内容', '実装内容'] },
  { key: 'acceptance_criteria', title: 'Acceptance Criteria', aliases: ['acceptance criteria', 'acceptance', '受け入れ条件'] },
  { key: 'out_of_scope', title: 'Out of Scope', aliases: ['out of scope', 'non goals', 'non-goals', 'やらないこと', '対象外'] },
  { key: 'verification', title: 'Verification', aliases: ['verification', 'tests', 'test', 'テスト', '確認'] },
  { key: 'review_focus', title: 'Review Focus', aliases: ['review focus', 'review points', 'レビュー観点', '見てほしいところ'] },
  { key: 'risks', title: 'Risks', aliases: ['risks', 'risk', 'impact', '影響範囲', 'リスク'] },
  { key: 'notes', title: 'Notes', aliases: ['notes', 'note', '備考'] },
];

const DEFAULT_BODY_SECTIONS: PullRequestBodySection[] = [
  'summary',
  'background',
  'changes',
  'acceptance_criteria',
  'out_of_scope',
  'verification',
  'review_focus',
  'risks',
  'notes',
];

const SECTION_BY_KEY = new Map(SECTION_DEFINITIONS.map((definition) => [definition.key, definition]));
const SECTION_ALIAS_TO_KEY = new Map(
  SECTION_DEFINITIONS.flatMap((definition) => definition.aliases.map((alias) => [normalizeHeading(alias), definition.key] as const)),
);

function normalizeHeading(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
}

function trimMarkdownHeading(value: string): string {
  return value.replace(/^#{1,6}\s+/, '').trim();
}

function firstMeaningfulLine(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value
    .split('\n')
    .map((line) => trimMarkdownHeading(line.trim()))
    .find((line) => line.length > 0);
}

function extractSectionValues(...sources: Array<string | undefined>): Partial<Record<PullRequestBodySection, string>> {
  const values: Partial<Record<PullRequestBodySection, string>> = {};
  for (const source of sources) {
    if (!source) {
      continue;
    }
    const lines = source.split('\n');
    let currentKey: PullRequestBodySection | undefined;
    let buffer: string[] = [];

    const flush = (): void => {
      if (!currentKey) {
        return;
      }
      const content = buffer.join('\n').trim();
      if (content && values[currentKey] === undefined) {
        values[currentKey] = content;
      }
    };

    for (const line of lines) {
      const headingMatch = line.match(/^#{1,6}\s+(.+?)\s*$/);
      const key = headingMatch ? SECTION_ALIAS_TO_KEY.get(normalizeHeading(headingMatch[1]!)) : undefined;
      if (key) {
        flush();
        currentKey = key;
        buffer = [];
      } else if (currentKey) {
        buffer.push(line);
      }
    }
    flush();
  }
  return values;
}

function buildTemplateVars(context: TaskPrTemplateContext): TemplateVars {
  const firstIssue = context.issues?.[0];
  const extracted = extractSectionValues(firstIssue?.body, context.orderContent, context.task);
  const taskSpec = context.orderContent ?? context.task;
  const summary = extracted.summary
    ?? firstIssue?.title
    ?? firstMeaningfulLine(context.orderContent)
    ?? firstMeaningfulLine(context.task)
    ?? 'Task update';
  const background = extracted.background
    ?? (Object.keys(extracted).length === 0 ? firstIssue?.body : undefined)
    ?? '';
  const verification = extracted.verification ?? context.report;

  return {
    issue: firstIssue ? String(firstIssue.number) : '',
    title: summary,
    summary,
    background,
    changes: extracted.changes ?? '',
    acceptance_criteria: extracted.acceptance_criteria ?? '',
    out_of_scope: extracted.out_of_scope ?? '',
    verification,
    review_focus: extracted.review_focus ?? '',
    risks: extracted.risks ?? '',
    notes: extracted.notes ?? '',
    report: context.report,
    task: taskSpec,
    workflow: context.workflowIdentifier ?? '',
    branch: context.branch ?? '',
  };
}

export function buildTaskPrTitle(context: TaskPrTemplateContext): string {
  const firstIssue = context.issues?.[0];
  const vars = buildTemplateVars(context);
  const template = context.pullRequestConfig?.titleTemplate;
  if (template) {
    return expandPipelineTemplate(template, vars).trim() || vars.summary;
  }

  const issuePrefix = firstIssue ? `[#${firstIssue.number}] ` : '';
  const maxSummaryLength = 100 - issuePrefix.length;
  const summary = vars.summary.length > maxSummaryLength
    ? `${vars.summary.slice(0, Math.max(0, maxSummaryLength - 3))}...`
    : vars.summary;
  return issuePrefix + summary;
}

export function buildTaskPrBody(context: TaskPrTemplateContext): string {
  const template = context.pullRequestConfig?.bodyTemplate;
  const vars = buildTemplateVars(context);
  if (template) {
    return expandPipelineTemplate(template, vars);
  }

  const sectionKeys = context.pullRequestConfig?.bodySections ?? DEFAULT_BODY_SECTIONS;
  const parts: string[] = [];
  for (const key of sectionKeys) {
    const value = (vars[key] ?? '').trim();
    if (!value) {
      continue;
    }
    const definition = SECTION_BY_KEY.get(key);
    if (!definition) {
      continue;
    }
    parts.push([`## ${definition.title}`, '', value].join('\n'));
  }

  if (context.issues && context.issues.length > 0) {
    parts.push(context.issues.map((issue) => `Closes #${issue.number}`).join('\n'));
  }

  return parts.join('\n\n').trim();
}
