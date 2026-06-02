export const CONVENTIONAL_BRANCH_TYPES = [
  'feat',
  'fix',
  'docs',
  'test',
  'refactor',
  'perf',
  'ci',
  'build',
  'chore',
] as const;

export type ConventionalBranchType = typeof CONVENTIONAL_BRANCH_TYPES[number];

export interface BranchNameContext {
  taskSlug?: string;
  taskContent?: string;
  issueNumber?: number;
  timestamp: string;
}

const LABEL_RULES: Array<{ type: ConventionalBranchType; labels: string[] }> = [
  { type: 'fix', labels: ['bug', 'bugfix', 'defect', 'regression', 'security', 'hotfix', 'fix', 'fixes', 'fixed', '不具合', 'バグ', '修正'] },
  { type: 'feat', labels: ['feature', 'enhancement', 'feat', 'new-feature', '新機能', '機能追加', '追加'] },
  { type: 'docs', labels: ['docs', 'doc', 'documentation', 'document', 'readme', '文書', 'ドキュメント'] },
  { type: 'test', labels: ['test', 'tests', 'testing', 'spec', 'coverage', 'テスト'] },
  { type: 'refactor', labels: ['refactor', 'refactoring', 'cleanup', 'clean-up', 'リファクタ', 'リファクタリング', '整理'] },
  { type: 'perf', labels: ['perf', 'performance', 'speed', 'optimization', 'パフォーマンス', '性能', '高速化'] },
  { type: 'ci', labels: ['ci', 'github-actions', 'actions', 'workflow'] },
  { type: 'build', labels: ['build', 'dependency', 'dependencies', 'deps', 'package'] },
  { type: 'chore', labels: ['chore', 'maintenance', 'config', 'tooling', 'misc', '設定', 'メンテナンス'] },
];

const KEYWORD_RULES: Array<{ type: ConventionalBranchType; patterns: RegExp[] }> = [
  { type: 'fix', patterns: [/\b(fix|bug|bugfix|defect|broken|error|failure|failed|regression|hotfix|patch)\b/i, /(不具合|バグ|修正|直す|失敗|エラー)/] },
  { type: 'docs', patterns: [/\b(docs?|documentation|document|readme)\b/i, /(文書|ドキュメント)/] },
  { type: 'test', patterns: [/\b(tests?|testing|spec|coverage)\b/i, /(テスト)/] },
  { type: 'refactor', patterns: [/\b(refactor|refactoring|cleanup|clean-up)\b/i, /(リファクタ|整理)/] },
  { type: 'perf', patterns: [/\b(perf|performance|speed|optimi[sz]e|optimization)\b/i, /(パフォーマンス|性能|高速化)/] },
  { type: 'ci', patterns: [/\b(ci|github actions?|actions workflow)\b/i] },
  { type: 'build', patterns: [/\b(build|deps?|dependencies|dependency|package|lockfile)\b/i] },
  { type: 'chore', patterns: [/\b(chore|maintenance|config|tooling|misc)\b/i, /(設定|メンテナンス)/] },
  { type: 'feat', patterns: [/\b(feat|feature|add|create|implement|support|enable)\b/i, /(新機能|追加|実装|対応)/] },
];

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

function extractLabels(taskContent: string | undefined): string[] {
  if (!taskContent) {
    return [];
  }
  const match = taskContent.match(/^### Labels\s*\n([\s\S]*?)(?:\n#{2,3}\s|$)/m);
  if (!match?.[1]) {
    return [];
  }
  return match[1]
    .split(/[,\n]/)
    .map(normalizeLabel)
    .filter((label) => label.length > 0);
}

function resolveBranchTypeFromLabels(labels: string[]): ConventionalBranchType | undefined {
  const labelSet = new Set(labels);
  for (const rule of LABEL_RULES) {
    if (rule.labels.some((label) => labelSet.has(normalizeLabel(label)))) {
      return rule.type;
    }
  }
  return undefined;
}

function resolveBranchTypeFromText(text: string): ConventionalBranchType | undefined {
  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return rule.type;
    }
  }
  return undefined;
}

export function resolveConventionalBranchType(context: Pick<BranchNameContext, 'taskSlug' | 'taskContent'>): ConventionalBranchType {
  const labelType = resolveBranchTypeFromLabels(extractLabels(context.taskContent));
  if (labelType) {
    return labelType;
  }
  const text = [context.taskSlug, context.taskContent].filter(Boolean).join('\n');
  return resolveBranchTypeFromText(text) ?? 'feat';
}

export function buildConventionalBranchName(context: BranchNameContext): string {
  const type = resolveConventionalBranchType(context);
  const slug = context.taskSlug?.trim();
  if (context.issueNumber !== undefined) {
    const suffix = slug && slug.length > 0 ? slug : context.timestamp;
    return `${type}/issue-${context.issueNumber}-${suffix}`;
  }
  return `${type}/${slug && slug.length > 0 ? slug : context.timestamp}`;
}

