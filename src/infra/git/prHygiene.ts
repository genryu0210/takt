import { execFileSync } from 'node:child_process';
import { getErrorMessage } from '../../shared/utils/index.js';

export const DEFAULT_PR_HYGIENE_MAX_CHANGED_LINES = 5_000;

const BLOCKED_PATH_RULES = [
  { path: '.takt', reason: 'Takt runtime and project-local state must not be included in auto PRs.' },
  { path: '.runtime', reason: 'Runtime artifacts must not be included in auto PRs.' },
  { path: '.venv', reason: 'Virtual environments must not be included in auto PRs.' },
  { path: 'node_modules', reason: 'Installed dependencies must not be included in auto PRs.' },
  { path: 'dist', reason: 'Generated build output must not be included in auto PRs.' },
  { path: 'build', reason: 'Generated build output must not be included in auto PRs.' },
  { path: 'coverage', reason: 'Coverage output must not be included in auto PRs.' },
  { path: '.next', reason: 'Generated build output must not be included in auto PRs.' },
  { path: 'out', reason: 'Generated build output must not be included in auto PRs.' },
] as const;

export interface PrHygieneViolation {
  type: 'blocked-path' | 'diff-too-large' | 'diff-unavailable';
  message: string;
  paths?: string[];
  changedLines?: number;
  maxChangedLines?: number;
}

export interface PrHygieneCheckResult {
  ok: boolean;
  baseRef?: string;
  branch: string;
  changedLines: number;
  changedPaths: string[];
  violations: PrHygieneViolation[];
}

export interface PrHygieneCheckOptions {
  baseBranch?: string;
  branch: string;
  maxChangedLines?: number;
}

export function checkPrHygiene(cwd: string, options: PrHygieneCheckOptions): PrHygieneCheckResult {
  const maxChangedLines = options.maxChangedLines ?? DEFAULT_PR_HYGIENE_MAX_CHANGED_LINES;
  const baseRef = resolveBaseRef(cwd, options.baseBranch);

  if (!baseRef) {
    return {
      ok: false,
      branch: options.branch,
      changedLines: 0,
      changedPaths: [],
      violations: [{
        type: 'diff-unavailable',
        message: 'Unable to resolve a base branch for PR hygiene check.',
      }],
    };
  }

  try {
    const range = `${baseRef}...${options.branch}`;
    const nameStatusOutput = execFileSync('git', ['diff', '--name-status', range], {
      cwd,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    const numstatOutput = execFileSync('git', ['diff', '--numstat', range], {
      cwd,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    const changedPaths = parseNameStatusPaths(nameStatusOutput);
    const changedLines = countChangedLines(numstatOutput);
    const violations = [
      ...findBlockedPathViolations(changedPaths),
      ...(changedLines > maxChangedLines
        ? [{
            type: 'diff-too-large' as const,
            message: `Diff is too large: ${changedLines} changed lines exceeds the ${maxChangedLines} line limit.`,
            changedLines,
            maxChangedLines,
          }]
        : []),
    ];

    return {
      ok: violations.length === 0,
      baseRef,
      branch: options.branch,
      changedLines,
      changedPaths,
      violations,
    };
  } catch (error) {
    return {
      ok: false,
      baseRef,
      branch: options.branch,
      changedLines: 0,
      changedPaths: [],
      violations: [{
        type: 'diff-unavailable',
        message: `Unable to inspect PR diff: ${getErrorMessage(error)}`,
      }],
    };
  }
}

export function formatPrHygieneFailure(result: PrHygieneCheckResult): string {
  const lines = ['PR hygiene check failed.'];
  for (const violation of result.violations) {
    if (violation.type === 'blocked-path') {
      lines.push(`- ${violation.message}`);
      continue;
    }
    lines.push(`- ${violation.message}`);
  }
  return lines.join('\n');
}

function resolveBaseRef(cwd: string, baseBranch: string | undefined): string | undefined {
  if (baseBranch) {
    return baseBranch;
  }

  const candidates = [
    () => execFileSync('git', ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'], {
      cwd,
      stdio: 'pipe',
      encoding: 'utf-8',
    }).trim(),
    () => resolveExistingRef(cwd, 'origin/main'),
    () => resolveExistingRef(cwd, 'main'),
    () => resolveExistingRef(cwd, 'origin/master'),
    () => resolveExistingRef(cwd, 'master'),
  ];

  for (const candidate of candidates) {
    try {
      const resolved = candidate();
      if (resolved) {
        return resolved;
      }
    } catch {
      // Try the next fallback.
    }
  }

  return undefined;
}

function resolveExistingRef(cwd: string, ref: string): string | undefined {
  execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
    cwd,
    stdio: 'pipe',
  });
  return ref;
}

function parseNameStatusPaths(output: string): string[] {
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .flatMap(line => {
      const [status, ...paths] = line.split('\t');
      if (!status) {
        return [];
      }
      if (status.startsWith('R') || status.startsWith('C')) {
        return paths;
      }
      return paths.slice(0, 1);
    })
    .filter(Boolean);
}

function countChangedLines(output: string): number {
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .reduce((total, line) => {
      const [added, deleted] = line.split('\t');
      const addedCount = added === '-' ? 0 : Number.parseInt(added ?? '0', 10);
      const deletedCount = deleted === '-' ? 0 : Number.parseInt(deleted ?? '0', 10);
      return total + (Number.isFinite(addedCount) ? addedCount : 0) + (Number.isFinite(deletedCount) ? deletedCount : 0);
    }, 0);
}

function findBlockedPathViolations(paths: string[]): PrHygieneViolation[] {
  const blockedPaths = paths
    .map(path => ({ path, rule: findBlockedPathRule(path) }))
    .filter((entry): entry is { path: string; rule: typeof BLOCKED_PATH_RULES[number] } => entry.rule !== undefined);

  if (blockedPaths.length === 0) {
    return [];
  }

  const displayPaths = blockedPaths.map(entry => entry.path);
  const reasons = Array.from(new Set(blockedPaths.map(entry => entry.rule.reason)));
  const pathSummary = summarizePaths(displayPaths);
  return [{
    type: 'blocked-path',
    message: `Blocked generated/runtime paths detected: ${pathSummary}. ${reasons.join(' ')}`,
    paths: displayPaths,
  }];
}

function findBlockedPathRule(path: string): typeof BLOCKED_PATH_RULES[number] | undefined {
  const normalized = normalizeGitPath(path);
  return BLOCKED_PATH_RULES.find(rule => {
    const rulePath = normalizeGitPath(rule.path);
    return normalized === rulePath || normalized.startsWith(`${rulePath}/`);
  });
}

function normalizeGitPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function summarizePaths(paths: string[]): string {
  const visible = paths.slice(0, 10);
  const suffix = paths.length > visible.length ? `, ... +${paths.length - visible.length} more` : '';
  return `${visible.join(', ')}${suffix}`;
}
