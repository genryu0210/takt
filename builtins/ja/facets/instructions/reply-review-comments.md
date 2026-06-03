# レビューコメント返信

修正・検証・最終レビューが完了した後、対応したPRレビューコメントへ返信してください。

## 手順

1. タスク本文からPR番号を特定する。
   - `PR #123`
   - `pull/123`
   - `pulls/123`
2. `Active Review Threads` と、現在のコードにも当てはまる `Outdated But Unresolved Review Threads` を返信対象にする。
3. 各コメントの `Reply Comment ID` を使って、対応内容を日本語で短く返信する。
4. 返信できたコメント、返信不要と判断したコメント、返信できなかったコメントをレポートへ記録する。

## 返信コマンド

レビューコメントへの返信は次の形式を使う。

```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments/{reply_comment_id}/replies \
  -f body="{返信本文}"
```

`{owner}/{repo}` は `gh repo view --json nameWithOwner -q .nameWithOwner` などで取得する。

## 返信本文

- 原則として日本語で書く
- 何を直したかを1-2文で書く
- 実行した検証が分かる場合は最後に短く添える
- 例: `対応しました。requestedDaysOff の日付配列validationを共通helperへ寄せ、create/updateの両方で利用する形に整理しました。関連テストも再実行済みです。`

## 禁止事項

- ファイルを編集しない
- テストやビルドを実行しない
- review thread をresolveしない
- 新しいPRを作らない
- secrets、token、環境変数値、private URL をコメントに含めない
- `Resolved / Outdated Review Threads` には、現在のコードで同じ問題が明確に残っていない限り返信しない

## 失敗時

- `Reply Comment ID` がないコメントは返信せず、レポートに `skipped` として残す
- `gh` が失敗した場合は、過度にリトライせず、失敗したコメントIDとエラー概要をレポートに残す
- 返信だけが失敗しても、修正済みbranchの状態を壊さない

## 完了条件

- 対象コメントへ返信できた場合は「返信完了」
- 返信対象の一部または全部に返信できない場合は「返信できないコメントがある」
