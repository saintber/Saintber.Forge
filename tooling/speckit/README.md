# tooling/speckit

本 repo 使用的 Spec Kit 版本與客製化紀錄。完整設計見 採納時的設計（快照）§13。

## 固定的上游版本

`UPSTREAM_VERSION`：**1.1.0**（`specify-cli`）

## 做法：直接使用上游，不維護客製化副本

遷移（`hub/000-restructure`）時選擇了 採納時的設計（快照）§13.2 的**路線 1**：升級到上游 v1.1.0，**捨棄**舊版的客製化，直接覆蓋。原因：

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

兩者另安裝 Hub 擴充（見下）。

**CLI 產生、不得直接手改**：`.claude/skills/`、`.agents/skills/`，以及 `.specify/` 內由 Spec Kit 管理的共同 scripts 與 templates（清單見各專案 `.specify/integrations/speckit.manifest.json`）。升級用 `specify integration upgrade`。

**人維護、依其修訂流程**：`.specify/memory/constitution.md`（憲章）與專案的 Policy、有效規格等治理內容；它們不是 CLI 產生的，不受上述限制。

本專案的客製化**不直接改上述 CLI 產生的檔案**，而是用上游的 extension 機制承載（見下方）。

## Hub 擴充（`extension/`）：目前交付範圍

擴充 ID `hub`，三個指令（技能名 `speckit-hub-*`；Claude 用 `/`，Codex 用 `$`）。原始碼在 `extension/`，各專案的 `.specify/extensions/hub/` 是安裝副本。

| 指令 | 目前實作 |
|---|---|
| `context` | 解析目標專案與模式（workspace / standalone），列出要讀的憲章與 Policy 索引，回報建議的下一個編號。唯讀，目標無效時報錯、不降級 |
| `adopt` | 驗證通過的工作包 → 以 Delta 合併進有效規格；基線檢查、暫存區、套用前再檢查；失敗只回復本次觸及的檔案，**目標已被別人改過就保留新內容**，回報 `ROLLBACK_INCOMPLETE` 並保留暫存區；不 stage、不 commit |
| `archive` | 封存工作包與輸入；可重試、不覆蓋；重試時以 `archive.md` 的 Manifest 驗完整快照與身份；刪來源前逐檔再比對；失敗時回復，不覆蓋並行新增的檔案 |

**必要的安全修正已完成並有回歸測試**：fence 感知的解析與套用後驗證、路徑與 ID 白名單、symlink／junction 拒絕、Manifest 與身份驗證、回復不覆蓋並行修改。

### 測試

```bash
node tooling/speckit/extension/tests/run-all.mjs [unit|integration|all]
```

單元測試（`*.unit.test.mjs`）不碰檔案系統與 git；整合測試（`*.integration.test.mjs`）在系統暫存目錄建立隔離 repo，不碰本 repo（POL-TEST-001）。截至 2026-10-07 本輪實測：**88 項通過**（單元 20、整合 68）。獨立重跑與重新安裝後的核對由收尾流程記錄，見 `specs/001-stage1-speckit-extension/verification.md`。

### 安裝

```bash
node tooling/speckit/install.mjs --project-dir <專案目錄>
```

上游 v1.1.0 的 `specify extension add` 一次只註冊給一個代理，所以腳本依序對每個已安裝的整合執行，最後還原預設整合並檢查受管理檔案沒有異動。**升級 Spec Kit 後必須對每個專案重跑。**

## 尚未完成（留待後續，各自開 change 討論）

這些**不是已取消**，也**不是本次遷移的阻擋項**：

- **G-PC**：plan 的 Constitution & Policy Check 沒有自動機制。preset 包裝 `speckit.plan` 會改寫受管理檔案且只作用於一個代理，不採用；可再評估 template override 或 hooks。
- **G-NUM**：原生 specify 的編號只掃 `specs/`。`context` 會給建議編號，但沒有強制接軌或碰撞保護。
- 各原生階段自動載入上下文、適用 Policy 的解析、讀取紀錄。
- adopt／archive 的**代理端到端驗收**；原生 specify→plan 全流程的雙代理驗收。
- standalone 的治理內化、擴充分發與遷出演練。
- 舊五欄 Change Log 與無 Manifest 舊封存的完整相容方案。
- 跨程序鎖、崩潰復原、跨專案採納。

## 尚未經使用者確認的實作選擇

下列是實作時為了安全或可檢查而採用的**機器格式**，**不是使用者已定案的需求**；後續討論詳細需求時可以調整或取消：

- 工作包需有 `**Affected Capabilities**`，並用嚴格的 `## Delta`（`#### ADDED|MODIFIED|REMOVED` / `##### REQ-…`）格式描述變更；新 capability 需 `**Owner**:`。
- Change Log 增加第六欄 `Snapshot`（Delta 內容雜湊）；舊五欄表會被升級。
- `archive.md` 含 `## Manifest`（逐檔 sha256）與 `Metadata-Digest`。
- change／capability／requirement ID 的白名單格式。

完整構想、現況與待確認取捨見 [Spec Kit 擴充完整設計稿](../../docs/architecture/proposals/speckit-extension-design.md)（待確認 proposal，不是有效規格或 Policy）。
