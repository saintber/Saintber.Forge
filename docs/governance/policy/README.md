# Hub Policy 索引

本目錄是 Hub 的 Policy。格式與規則見 [採納時的設計（快照）](../../architecture/decisions/0001-attachments/design-2026-10-adopted.md) §11。

## 效力

Hub 憲章已於 2026-10-06 由使用者批准（**Active v1.0.0**），其原則 V 規定：**status 為 active 的 Policy 具約束力**。

**憲章的批准不等於逐份核准每份 Policy 的每一條新增條款。** 因此 Policy 的條文分兩類，**生效與否看這兩類**：

| 類別 | 內容 | 效力 |
|---|---|---|
| **A. 已核准或忠實展開** | ① 提煉自舊 Forge Policy 的原有規則（使用者先前已核准）；② **已採納設計**與 **ADR 決策**的忠實展開，每條標示設計出處；③ 使用者已明確指示的規則（例如「禁止實作違背文件，先改設計再實作」） | **具約束力，須遵守** |
| **B. 超出已採納設計的新增條文（Proposed）** | 設計與 ADR 中**沒有出處**的新規範 | **不因 `status: active` 就自動生效**，在 owner 裁決前是提案。見下方「待裁決」 |

目前 **B 類只有一項**（見下）；其餘條文都屬 A 類。

### 待裁決（B 類，Proposed）

| Policy | 條文 | 為什麼是 B 類 | 狀態 |
|---|---|---|---|
| POL-SEC-001 | 「尚未涵蓋」一節列出 Hub 自身的安全責任（bootstrap 與入口包的來源驗證、完整性、寫入路徑、最小權限） | 這是**說明**目前沒有規則，**不是規則**；列在此處只是為了讓審閱者看到缺口 | 說明性文字，不需裁決 |

**目前沒有**需要 owner 裁決的新規範條文。五份新撰寫的 Policy（`POL-STRUCT-001`、`POL-DOC-001`、`POL-SPEC-001`、`POL-SPECKIT-001`、`POL-INVOKE-001`）每條都標示設計或憲章的出處，**文末的「Proposed」一節皆為「目前沒有」**。

> 若審閱發現某條**其實沒有出處**，請指出：該條應降為 B 類（Proposed），或補上出處。

### 與設計快照有出入的地方（以 ADR 決策為準）

快照中有幾處已被後來**已核准的決策**取代或限縮，Policy 以決策為準：

| 快照 | 決策 | 影響的 Policy |
|---|---|---|
| §13.6 的客製化正本與 `sync-speckit.mjs`、三種格式 | ADR-0001 決策 9：直接使用固定的上游版本，不維護客製化副本；整合是 Claude 與 Codex | POL-SPECKIT-001（「與設計快照的差異」） |
| §4、§14.2 的 `scripts/release/` 附帶「僅 tag 觸發」「CI 完全唯讀」「pack 一律憑證」 | ADR-0001 決策 10：只核准「目錄與責任分工」 | POL-STRUCT-001 R9、POL-INVOKE-001（開頭聲明） |

## Policy 清單

`status: active` 表示該檔具約束力，但**以上方 A / B 類判斷每一條**。

| ID | 檔案 | scope | applies-to | 備註 |
|---|---|---|---|---|
| POL-STRUCT-001 | [project-structure.md](project-structure.md) | workspace | specify, plan, tasks, analyze, implement | 設計 §1.3、§3–§6、§14 的展開 |
| POL-DOC-001 | [documentation-governance.md](documentation-governance.md) | workspace | specify – adopt | 設計 §10、§12.2；憲章 IV、VI、VII |
| POL-SPEC-001 | [specification-lifecycle.md](specification-lifecycle.md) | workspace | specify – adopt | 設計 §12 的展開 |
| POL-SPECKIT-001 | [speckit-workflow.md](speckit-workflow.md) | workspace | 全部階段 | 設計 §13；ADR 決策 9 |
| POL-INVOKE-001 | [invocation-contract.md](invocation-contract.md) | distribution | specify – implement | 設計 §7、§8；**CLI 尚未實作，這是待實作去遵守的契約** |
| POL-SEC-001 | [security-baseline.md](security-baseline.md) | distribution | plan, tasks, analyze, implement | 提煉自舊 Policy；Hub 自身的安全責任尚待補 |
| POL-TEST-001 | [testing-governance.md](testing-governance.md) | workspace | plan, tasks, analyze, implement | 提煉自舊 Policy |
| POL-DOD-001 | [implementation-definition-of-done.md](implementation-definition-of-done.md) | workspace | tasks, implement, analyze, adopt | 提煉自舊 Policy；R6a 來自憲章原則 VI 與使用者的明確指示；R7 路徑依已採納設計 |

### scope 的意義

| scope | 適用對象 |
|---|---|
| `workspace` | 所有在本 repo 內開發的專案 |
| `distribution` | 透過 saintber 發佈與呼叫的雙方：Hub，以及工具（包含已遷出的工具）。規則逐條標示 `[hub]`、`[tool]` 或 `[hub, tool]` |
| `hub-only` | 只約束 Hub 本身 |
| `project` | 只約束該專案自己（寫在專案的 Policy，不在這裡） |

## 繼承

```text
Hub 憲章
 └─ Hub Policy（workspace / distribution）   ← 專案必須遵守
     └─ 專案憲章                             ← 可以加嚴，不得牴觸
         └─ 專案 Policy（project）           ← 可以加嚴，不得放寬
```

各專案在自己的 `docs/governance/policy/README.md` 列出繼承了哪些 Hub Policy，以及**繼承基線**（Hub 的 commit 或 tag）。

| 專案 | 繼承的 Hub Policy | 基線 | 與 Hub 憲章的衝突 |
|---|---|---|---|
| forge-explorer | POL-STRUCT-001、POL-DOC-001、POL-SPEC-001、POL-SPECKIT-001、POL-INVOKE-001（`[tool]` 規則）、POL-SEC-001、POL-TEST-001、POL-DOD-001 | 見該專案的 README | 見 [`conflicts-with-hub.md`](../../../projects/forge-explorer/docs/governance/policy/conflicts-with-hub.md)（待 owner 裁決，**舊文原封不動**） |

## 例外

- 在 plan 的 Complexity Tracking 記錄理由，**只是紀錄，不等於核准**。
- 例外必須由該 Policy 的 **owner 核准**。目前所有 Policy 的 owner 是 `saintber`；**代理不能自行核准**。
- 核准結果記在這張表：

| 例外 ID | Policy | 適用專案 | 理由 | 核准者 | 日期 | 到期或重審條件 |
|---|---|---|---|---|---|---|
| （目前沒有） | | | | | | |

## 尚未撰寫的 Hub Policy

`採納時的設計` §11.7 列出、**還沒寫**的 Policy，隨對應的工作包逐步撰寫：

| ID 前綴 | 範圍 | 前提 |
|---|---|---|
| POL-INSTALL | 工具自行持有安裝、設定、狀態；範圍由工具與使用者決定 | 需有工具實作 |
| POL-TECH | Hub 的 Node 支援清單（24）、平台測試矩陣 | 需 saintber CLI |
| POL-RELEASE | catalog 與 descriptor 維護、入口包發佈、遷出後的來源維護 | `scripts/release/` 的**觸發策略尚待決定** |
| POL-SHARED | Shared 的建立時機、owner、版本、消費方式 | 已在 POL-STRUCT-001 R5 涵蓋基本規則，是否獨立成檔待定 |
