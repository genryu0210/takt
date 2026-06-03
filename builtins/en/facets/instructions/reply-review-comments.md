# Reply to Review Comments

After fixes, verification, and final review are complete, reply to the addressed PR review comments.

## Steps

1. Identify the PR number from the task body.
   - `PR #123`
   - `pull/123`
   - `pulls/123`
2. Use `Active Review Threads` and any still-applicable `Outdated But Unresolved Review Threads` as reply targets.
3. Reply only to comments that have a `Reply Comment ID`, and post a concise reply in English.
   - `Reply Comment ID` is attached only to top-level review comments
   - Do not reply to existing reply comments inside the same thread
4. Record posted replies, skipped comments, and failed replies in the report.

## Reply Command

Use this form for review comment replies:

```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments/{reply_comment_id}/replies \
  -f body="{reply body}"
```

Get `{owner}/{repo}` with a command such as `gh repo view --json nameWithOwner -q .nameWithOwner`.

## Reply Body

- Write in English by default
- State what was fixed in 1-2 sentences
- Briefly mention verification when it is available
- Example: `Addressed. I moved requestedDaysOff date-array validation into a shared helper and use it from both create and update. Related tests were rerun.`

## Do Not

- Do not edit files
- Do not run tests or builds
- Do not resolve review threads
- Do not create a new PR
- Do not include secrets, tokens, environment variable values, or private URLs in comments
- Do not reply to `Resolved / Outdated Review Threads` unless the same issue clearly remains in the current code

## Failure Handling

- If a comment has no `Reply Comment ID`, skip it and record it as `skipped`
- If `gh` fails, do not retry excessively; record the failed comment ID and error summary
- If only replying fails, do not disturb the already-fixed branch state

## Completion Conditions

- Use "Replies posted" when target replies were posted
- Use "Some comments could not be replied to" when some or all target comments could not be replied to
