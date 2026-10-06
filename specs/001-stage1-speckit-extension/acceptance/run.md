# 代理驗收：執行步驟

> 設計 §13.5、POL-SPECKIT-001 R7：**每種代理都要實際執行**；腳本層的解析測試**不能代替**。
> 每個代理在**自己的**隔離副本中執行，互不可見。所有路徑都在系統暫存目錄，**不在本 repo**。
> 判定只看 `check.mjs` 對檔案系統與 git 的**客觀檢查**，**不採信代理的自述**。

## 0. 準備（Claude 已完成）

```text
node specs/001-stage1-speckit-extension/acceptance/prepare.mjs --repo <repo> --base %TEMP%/saintber-accept
```

產出：
- `%TEMP%/saintber-accept/<agent>/hub`：Hub 副本（git），含已安裝的 hub 擴充，另加驗收用專案 `ai-queue`（登錄在 `workspace.json`）
- `%TEMP%/saintber-accept/<agent>/standalone`：只有 forge-explorer，**沒有** `workspace.json`、**沒有**父 repo

## 固定提示詞

不要修改提示詞。兩種代理用**相同的內容**，只差呼叫方式（Claude Code 用 `/`，Codex 用 `$`）。

| 情境 | 目錄 | 提示詞（Claude Code） | 提示詞（Codex） |
|---|---|---|---|
| **S3** 無效專案 | `<agent>/hub` | `/speckit-hub-context no-such-project` | `$speckit-hub-context no-such-project` |
| **S2** 指定專案 | `<agent>/hub` | `/speckit-hub-context ai-queue` 然後 `/speckit-specify Add a retry limit setting to the queue. Target project: ai-queue. Create the work package under the target project only.` | 同左，把 `/` 換成 `$` |
| **SA** standalone | `<agent>/standalone` | `/speckit-hub-context` | `$speckit-hub-context` |

**順序**：S3 → 記錄 → S2 → 記錄；SA 獨立。

## 1. 每個情境後要記錄的東西

在 `%TEMP%/saintber-accept/<agent>/logs/` 下：

| 檔案 | 內容 | 指令（在該情境的目錄執行） |
|---|---|---|
| `S3.changes.txt` | S3 之後的變更清單 | `git status --porcelain --untracked-files=all` 的路徑欄（每行一個） |
| `S2.changes.txt` | S2 之後的變更清單 | 同上 |
| `SA.context.json` | standalone 的 context 原始輸出 | `node .specify/extensions/hub/scripts/context.mjs --json` |
| `SA.changes.txt` | SA 之後的變更清單 | 同 S3 |
| `<情境>.transcript.txt` | 代理的完整輸出 | 代理工具的輸出 |

> 注意：`S2.changes.txt` 是在 S3 之後**累加**的；S3 若通過就沒有新檔案，所以 S2 的清單就是 S2 自己的產出。

## 2. Claude Code（Claude 執行）

```powershell
$B = "$env:TEMP\saintber-accept\claude"
New-Item -ItemType Directory -Force "$B\logs" | Out-Null
cd "$B\hub"
claude -p "/speckit-hub-context no-such-project" > "$B\logs\S3.transcript.txt" 2>&1
git status --porcelain --untracked-files=all | ForEach-Object { $_.Substring(3) } > "$B\logs\S3.changes.txt"
claude -p "/speckit-hub-context ai-queue" > "$B\logs\S2a.transcript.txt" 2>&1
claude -p "/speckit-specify Add a retry limit setting to the queue. Target project: ai-queue. Create the work package under the target project only." > "$B\logs\S2b.transcript.txt" 2>&1
git status --porcelain --untracked-files=all | ForEach-Object { $_.Substring(3) } > "$B\logs\S2.changes.txt"
cd "$B\standalone"
claude -p "/speckit-hub-context" > "$B\logs\SA.transcript.txt" 2>&1
node .specify\extensions\hub\scripts\context.mjs --json > "$B\logs\SA.context.json"
git status --porcelain --untracked-files=all | ForEach-Object { $_.Substring(3) } > "$B\logs\SA.changes.txt"
```

## 3. Codex（**需要 Codex 自己執行**）

Codex 必須在**自己的副本** `%TEMP%\saintber-accept\codex\` 中執行，**不得**使用 Claude 的副本或本 repo。

```powershell
$B = "$env:TEMP\saintber-accept\codex"
New-Item -ItemType Directory -Force "$B\logs" | Out-Null
cd "$B\hub"
codex exec --skip-git-repo-check '$speckit-hub-context no-such-project' > "$B\logs\S3.transcript.txt" 2>&1
git status --porcelain --untracked-files=all | ForEach-Object { $_.Substring(3) } > "$B\logs\S3.changes.txt"
codex exec --skip-git-repo-check '$speckit-hub-context ai-queue' > "$B\logs\S2a.transcript.txt" 2>&1
codex exec --skip-git-repo-check '$speckit-specify Add a retry limit setting to the queue. Target project: ai-queue. Create the work package under the target project only.' > "$B\logs\S2b.transcript.txt" 2>&1
git status --porcelain --untracked-files=all | ForEach-Object { $_.Substring(3) } > "$B\logs\S2.changes.txt"
cd "$B\standalone"
codex exec --skip-git-repo-check '$speckit-hub-context' > "$B\logs\SA.transcript.txt" 2>&1
node .specify\extensions\hub\scripts\context.mjs --json > "$B\logs\SA.context.json"
git status --porcelain --untracked-files=all | ForEach-Object { $_.Substring(3) } > "$B\logs\SA.changes.txt"
```

- 提示詞用**單引號**，避免 PowerShell 把 `$speckit…` 當成變數。
- Codex 若需要權限才能寫檔（S2 會建立工作包），請以它允許在該目錄寫入的模式執行；**不要**放寬到本 repo。
- Codex 不需要 commit、也不要 commit。

## 4. 判定

```text
node specs/001-stage1-speckit-extension/acceptance/check.mjs --base %TEMP%/saintber-accept --agent claude
node specs/001-stage1-speckit-extension/acceptance/check.mjs --base %TEMP%/saintber-accept --agent codex
```

| 情境 | PASS 的條件 |
|---|---|
| S3 | **沒有任何新檔案** |
| S2 | 有產出，且**全部**在 `projects/ai-queue/specs/` 底下 |
| SA | context 為 `standalone`、`workspaceRoot` 為 null、沒有讀取父路徑、沒有新檔案 |

結果與 transcript 記到 `verification.md`。
