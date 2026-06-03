```markdown
# Review Comment Reply Results

## Result
Replies posted / Some comments could not be replied to

## Posted
| Reply Comment ID | Target | Reply Summary |
|------------------|--------|---------------|
| 123456789 | `src/file.ts:42` | Summary of the reply |

## Skipped
| Target | Reason |
|--------|--------|
| `src/file.ts:42` | Missing Reply Comment ID |

## Failed
| Reply Comment ID | Target | Error Summary |
|------------------|--------|---------------|
| 123456789 | `src/file.ts:42` | `gh api` error summary |

## Notes
- If only replying fails, keep the fixed branch state intact
- Do not record secrets, tokens, environment variable values, or private URLs
```
