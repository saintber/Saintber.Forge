# Hub Policy 索引

本目錄是 Hub 的 Policy。格式與規則見 採納時的設計（快照）§11。

> 目前狀態：遷移（`hub/000-restructure`）時，先從舊的 Forge Policy 提煉出**三份通用 Policy**。
> Hub 憲章（含「Policy 具約束力」的引用原則，採納時的設計（快照）§11.3）**尚未撰寫**，會在遷移步驟 9 完成。

## Policy 清單

| ID | 檔案 | scope | applies-to | status |
|---|---|---|---|---|
| POL-SEC-001 | [security-baseline.md](security-baseline.md) | distribution | plan, tasks, analyze, implement | active |
| POL-TEST-001 | [testing-governance.md](testing-governance.md) | workspace | plan, tasks, analyze, implement | active |
| POL-DOD-001 | [implementation-definition-of-done.md](implementation-definition-of-done.md) | workspace | tasks, implement, analyze, adopt | active |

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

| 專案 | 繼承的 Policy | 基線 |
|---|---|---|
| forge-explorer | POL-SEC-001、POL-TEST-001、POL-DOD-001 | 見該專案的 README |

## 例外

- 在 plan 的 Complexity Tracking 記錄理由，**只是紀錄，不等於核准**。
- 例外必須由該 Policy 的 **owner 核准**。目前所有 Policy 的 owner 是 `saintber`；**代理不能自行核准**。
- 核准結果記在這張表：

| 例外 ID | Policy | 適用專案 | 理由 | 核准者 | 日期 | 到期或重審條件 |
|---|---|---|---|---|---|---|
| （目前沒有） | | | | | | |

## 尚未撰寫的 Hub Policy

採納時的設計（快照）§11.7 列出的其餘 Policy 會隨對應的工作包逐步撰寫：

| 優先 | ID 前綴 | 範圍 |
|---|---|---|
| ★ | POL-STRUCT | 目錄、責任、依賴方向、遷出原則 |
| ★ | POL-DOC | 文件類別、唯一 owner、歷史資料規則 |
| ★ | POL-SPEC | 有效規格、工作包、基線、adopt、archive |
| ★ | POL-SPECKIT | 專案選擇、必讀上下文、模板、上游版本、客製化 |
| ★ | POL-INVOKE | 巢狀路由、入口包、呼叫契約 |
| | POL-INSTALL、POL-TECH、POL-RELEASE、POL-SHARED | 見 採納時的設計（快照）§11.7 |

在 POL-SPEC 寫成之前，工作包與封存的規則以 採納時的設計（快照）§12 為準。
