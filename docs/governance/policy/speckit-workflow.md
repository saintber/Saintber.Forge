---
id: POL-SPECKIT-001
title: Spec Kit Workflow
status: active
scope: workspace
applies-to: [specify, clarify, checklist, plan, tasks, analyze, implement, adopt]
owner: saintber
supersedes: []
source: 採納時的設計 §11.3、§13；ADR-0001 決策 9；憲章原則 V、VI
---

# Spec Kit Workflow

依 owner 於 2026-10-07 的明確指示（[ADR-0002](../../architecture/decisions/0002-migration-delivery-scope.md)），本 Policy 的階段流程適用於選擇使用 Spec Kit 的工作；小粒度 skill 可直接開發與驗證，不強迫建立工作包或依賴自動擴充。適用治理、設計先於實作及規格唯一仍須遵守。

> 目的：規範 Hub 與各專案**如何使用 Spec Kit**：專案選擇、必讀上下文、版本、客製化與驗收。
> 本文是對**已採納設計 §13** 與 **ADR-0001 決策 9** 的忠實展開。**設計與決策 9 有出入的地方，以決策 9 為準**（見「與設計快照的差異」）。

## 規則

### R1 固定的上游版本（§13.2；ADR 決策 9）
- 使用**固定的上游 Spec Kit 版本**，記在 `tooling/speckit/UPSTREAM_VERSION`（目前 `1.1.0`）。
- **直接使用上游，不維護客製化的副本**；舊版客製化已捨棄。
- 升級用 `specify integration upgrade`；**不在**沒有評估的情況下執行全量 init 或 upgrade，以免覆蓋既有的模板與代理指令。
- 升級前要評估差異，並重跑 R7 的驗收。

### R2 專案選擇（§13.2、§13.4）
- 解析目標專案的順序：**明確指定** → `SPECIFY_INIT_DIR` → 目前目錄**最近的** `.specify/`。
- 執行前回報**目標專案 ID、專案根目錄、change ID、產出路徑**。
- **明確指定的目標無效時報錯，不退回 Hub，也不偷偷降級**成 standalone。
- 不讓代理只靠 branch 名稱或「最新的數字」猜測目標。
- 在 `projects/<id>/` 內執行時，工作包建立在**該專案的** `specs/`，**不是** Hub 的 `specs/`。

### R3 兩種模式（§13.4）
| 模式 | 何時 | Policy 來源 |
|---|---|---|
| **workspace** | 目標專案在本 repo，並登錄在 `workspace.json` | 目標專案的憲章與 Policy 索引，加上 Hub 的 Policy 索引 |
| **standalone** | 工具已遷出，或單獨使用工具目錄 | 工具**本地**的憲章、內化的 workspace Policy、版本固定的 distribution Policy 快照；**不要求**父 repo 或 Hub 的檔案存在 |

- 找到 `workspace.json` 時，驗證目標專案有登錄在其中；沒有登錄就報錯。

### R4 各階段必讀的上下文（§13.4；§11.2、§11.3）
開始任何相關階段前，依序：
1. 確認目標專案與模式（R2、R3）。
2. 讀取目標專案的**憲章**與 **Policy 索引**（workspace 模式另讀 Hub 的 Policy 索引）。
3. 依 Policy 的 `scope`、適用角色與本階段的 `applies-to`，載入適用的 Policy、相關架構文件與跨工具契約。**包含 specify、clarify、checklist**，不只 plan 之後的階段。
4. 讀取相關的有效規格（先讀 `docs/specifications/README.md`）與本次的 intent / decision。
5. 把**實際讀取的檔案路徑**與 `baseline-commit` 記下，讓後續階段引用同一份上下文。

### R5 Policy Check（§11.3；憲章原則 V）
- plan 要包含 **Constitution & Policy Check**：逐條列出適用的 Policy ID 與檢核結果。
- analyze 要檢查：Policy 違反、未核准的例外、引用了 deprecated 的 Policy。
- 例外必須由該 Policy 的 owner 核准；在 plan 記錄理由**不等於核准**；代理不得自行核准。

### R6 CLI 產生的檔案與人維護的檔案（§13.6 的精神；ADR 決策 9）
- **CLI 產生、不得直接手改**：`.claude/skills/`、`.agents/skills/`，以及 `.specify/` 內由 Spec Kit 管理的共同 scripts 與 templates（清單見各專案 `.specify/integrations/speckit.manifest.json`）。
- **人維護、依其修訂流程**：`.specify/memory/constitution.md`、專案的 Policy、有效規格、工作包。
- 本專案的客製化**不直接改 CLI 產生的檔案**，而是用上游的 **preset**（模板）與 **extension**（新增能力）機制承載，放在 `tooling/speckit/`。
- 同步或升級時**不得覆蓋**：各專案的憲章、專屬 Policy、有效規格、工作包，以及使用者的修改。

### R7 slash command 的驗收（§13.5）
指令能否被發現，取決於代理產品、版本與工作區；multi-root `.code-workspace` **不保證**作用在正確的專案。**每種代理、每次升級 Spec Kit 都要驗收**：
1. 從 Hub 根目錄指定某專案，產出**只**出現在該專案目錄。
2. 指定**不存在**的專案時報錯，**不在 Hub 建立任何檔案**。
3. 單獨在工具目錄執行時，指令解析到該工具。
4. 在**沒有父 repo** 的工具副本中，以 standalone 模式運作，不讀取任何父路徑。
5. 修改憲章或升級後，Policy 引用原則仍在憲章中，plan 產出仍包含 Policy Check。

**腳本層的解析測試不能代替代理驗收**：驗收要由**實際的代理**執行。

### R8 branch 與編號（§13.3）
- 單一 repo 的 branch 是共用的，不會因為每個工具有 `.specify/` 就變成獨立。
- **建議** branch 命名 `<project-id>/<NNN-name>`；是否需要 scope 前綴，依上游版本的實際行為評估。
- 新工作包的編號要同時掃描 `specs/` 與 `archive/changes/`（POL-SPEC-001 R8）。
- 活動上下文屬於本機狀態，**不提交到 git**。

### R9 新增的指令（§13.4）
`context`、`adopt`、`archive` 在採納設計中是**新增指令**。**它們是否已存在，以 `docs/developer-guide/speckit-workflow.md` 的「指令現況」為準**，**不得**把尚未存在的指令當成已存在。存在之前，由人依 POL-SPEC-001 手動執行，規則不變。

## 與設計快照的差異（以 ADR 決策為準）

| 快照的說法 | 現在的依據 |
|---|---|
| §13.6：`tooling/speckit/` 是**唯一正本**，由 `scripts/dev/sync-speckit.mjs` 部署到各專案；指令用同一份產生三種格式（含 `.github/prompts`） | **ADR-0001 決策 9**：直接使用固定的上游版本，不維護客製化副本。整合目前是 **Claude 與 Codex**（技能形式，`/speckit-xxx`）；**不含** Copilot。`sync-speckit.mjs` 與三格式產生**不採用**，客製化改以 preset / extension 承載 |
| §13.1：本地舊版不支援 monorepo | 已升級到 v1.1.0，它支援（以腳本層測試確認）；代理層驗收見 R7 |

## Proposed（超出已採納設計的條文，待 owner 裁決）

目前**沒有**。R1 – R9 都有設計或 ADR 決策的出處。
