# tooling/speckit

本 repo 使用的 Spec Kit 版本與客製化紀錄。完整設計見 `design.md` §13。

## 固定的上游版本

`UPSTREAM_VERSION`：**1.1.0**（`specify-cli`）

## 做法：直接使用上游，不維護客製化副本

遷移（`hub/000-restructure`）時選擇了 `design.md` §13.2 的**路線 1**：升級到上游 v1.1.0，**捨棄**舊版的客製化，直接覆蓋。原因：

- 上游 v1.1.0 已內建 monorepo 支援（用本機的 v1.1.0 實測）：
  - `Get-RepoRoot` 往上找最近的 `.specify/`，在 `projects/<id>/` 內執行會解析到該專案。
  - `SPECIFY_INIT_DIR` 指向無效路徑時直接報錯，不退回其他目錄。
  - `create-new-feature.ps1` 改用 `common.ps1` 的解析，不再有獨立的 git root 邏輯。
- 舊版的客製化只有 forge-explorer 在用，而它長期沒有開發（使用者確認）。

舊版的 `.specify/`、`.github/agents`、`.github/prompts` 已從 Hub 移除，**沒有保留快照**；需要時可從 git 歷史找回（`b5c7239`）。

## 目前狀態

| 位置 | 內容 | 整合 |
|---|---|---|
| Hub 根目錄 | 上游 v1.1.0 | claude、codex |
| `projects/forge-explorer/` | 上游 v1.1.0，憲章保留 | claude、codex |

`.specify/`、`.claude/skills`、`.agents/skills` 由 `specify` CLI 管理，**不要手動編輯**。升級用 `specify integration upgrade`。

## 待處理

- 本專案的擴充（`context`、`adopt`、`archive`、Policy 載入）**尚未實作**。依 `design.md` §13.2，建議以上游的 preset 與 extension 機制承載，放在這個目錄下；做成之前不要宣稱它們可用。
- `design.md` §13.5 的驗收項目尚未執行。
