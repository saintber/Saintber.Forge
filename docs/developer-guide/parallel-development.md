# Worktree 並行開發

遷移提交提供 Hub、Tool、Shared 的目錄基準。後續從這個基準開出各自的 worktree、討論自己的範圍，再合併結果；不需要先完成整份總體設計或所有 Spec Kit 擴充。

## 內容放在哪裡

| 工作 | 正本位置 |
|---|---|
| saintber 入口與對應測試 | `src/`、`tests/` |
| 工具自身的程式、治理、文件與測試 | `projects/<id>/` |
| 有實際共用需求的版本化 Shared | `packages/<name>/` |
| 使用者安裝引導 | `scripts/bootstrap/` |
| repo 開發、CI 與入口發佈腳本 | `scripts/dev/`、`scripts/ci/`、`scripts/release/` |
| Spec Kit 擴充與測試 | `tooling/speckit/` |
| Herdr 開發用 pane 版面腳本 | [`tooling/herdr/`](../../tooling/herdr/README.md)；操作見 [使用說明](herdr-grid.md) |
| repo 自製 skill | `tooling/skills/<name>/`；產品 skill 放在擁有它的 Tool |
| 新 Tool 的靜態範本 | `tooling/scaffold/project/` |
| 使用手冊、架構、Policy | 擁有該能力的專案 `docs/` |
| 需求輸入、候選工作包、有效規格、歷史 | 該專案 `docs/intent/`、`specs/`、`docs/specifications/`、`archive/changes/` |

標示為骨架的目錄只代表固定內容位置，沒有產品功能。Node 工具各自有 `private: true` 的 package.json 與 lockfile，不啟用 npm workspaces。新工具開始開發時才建立實際專案。

## 開出工作目錄

在本 repo 的 PowerShell 執行，以下路徑與 branch 是示例；先換成自己的名稱：

```powershell
git worktree add ../Saintber.Forge-cli -b hub/cli-foundation backlogs/hub-restructure
git worktree add ../Saintber.Forge-skill -b skills/my-skill backlogs/hub-restructure
```

`backlogs/hub-restructure` 是本次遷移分支；也可以用本次交付回報中的確切 commit 作基準。不在同一 worktree 裡切換另一項工作的 branch。

每個 worktree 有自己的工作目錄、Git index 與本機上下文。Spec Kit 使用的最近 `.specify/` 會隨該 worktree 的路徑解析；**不要**把另一個 worktree 的絕對路徑留在 `SPECIFY_INIT_DIR`、`SPECIFY_FEATURE_DIRECTORY` 或 `.specify/feature.json`。先檢查這些本機值，再執行。

使用 Hub 擴充前，可以在新 worktree 以 `node tooling/speckit/install.mjs --project-dir <目標專案>` 重建該目錄的本地安裝註冊。`--dev` 註冊紀錄可能保留原 worktree 的絕對來源路徑，不依賴另一工作目錄自動同步。不使用 Spec Kit 的小型工作不需要這個步驟。

## 開始新 Tool

在自己的 worktree，開始實際開發時複製範本，例如：

```powershell
Copy-Item -LiteralPath tooling/scaffold/project -Destination projects/ai-queue -Recurse
```

目的地須尚不存在；既有工具直接使用其目錄，不覆蓋。把 `<project-id>` 改成真實 ID，確認 owner、目的與技術，並登錄到 `workspace.json`。依需要新增套件設定或工具入口。

範本刻意沒有假的憲章或 Spec Kit 產生檔案。**需要 Spec Kit 時，先在工具根目錄用上游 CLI 初始化該工具自己的 `.specify/`、整合與憲章，再安裝 Hub 擴充。** 尚未初始化前不執行 Spec Kit，避免向上解析到 Hub；不要把 Tool 工作包建到 Hub `specs/`。

## 依工作大小選流程

- 功能需討論需求、驗收、架構與任務時，在目標專案使用 Spec Kit；設計快照作方向參考，詳細需求在新 change 確立。
- 小型 skill 或範圍清楚的修改，可以直接記錄設計／理由、實作、必要驗證與提交，不為了流程建立整套工作包。
- 兩者都要讀適用治理，不得實作偏離已批准設計。涉及有效規格的變更仍須有驗證與相應採納紀錄，規格保持唯一；不用 Spec Kit 不等於忽略規格。
- 三個 Hub 擴充指令已實作，完整設計／格式尚待確認。使用時遵守拒絕結果；未完成的自動 Policy Check、編號接軌不是其他 worktree 開發的前置依賴。

## 合併前

各項工作只提交自己的變更，完成必要驗證與文件同步。`workspace.json`、catalog 和 Policy 索引等共用檔案可能衝突，合併時審查；worktree 隔離不代表共用索引自動合併。若有效規格 baseline 已改變，先重新比對再採納。

更多使用限制見 [Spec Kit 指引](speckit-workflow.md)，本次交付範圍見 [ADR-0002](../architecture/decisions/0002-migration-delivery-scope.md)。
