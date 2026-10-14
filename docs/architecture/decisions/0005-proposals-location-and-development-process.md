# ADR-0005：提案目錄移到 `docs/proposals/`，以及六階段開發流程

- 狀態：Accepted
- 日期：2026-10-14
- 核准者：`saintber`（使用者本次明確批准最新的流程設計與目錄變更；指示由 Codex 轉達）
- 關聯：[ADR-0003](0003-development-workflow-granularity.md)（A／B／C 三種流程與 `proposals/` 的位置）、[ADR-0004](0004-exploration-conversion-tracking.md)（轉換紀錄與 `saintber-design`）。本 ADR **補充並修訂**其中的目錄位置與階段用詞，**不使 ADR-0001～0004 整份失效**。流程正本 [開發流程](../../developer-guide/development-workflows.md)

## 背景

ADR-0003 約定設計提案放在 `docs/architecture/proposals/`；原開發流程手冊則以四個階段說明工作進程（ADR-0003 本文只定義 A／B／C 三種流程）。實際使用後發現兩件事：

- 提案裡有大量的**需求分析**與**方案探索**，把它們全放在 `architecture/` 底下，會讓人誤以為那是「現行架構」。`architecture/` 應該只放現行架構、ADR 與已採納設計的附件快照。
- 「需求分析」與「方案探索」是兩種不同責任，早期可以來回確認；四階段的說法沒有把它們分開，也沒有說清楚哪些文件可以省略、哪些依據不能省略。

## 決策

### 1. 提案目錄

- 所有一般開發提案放在**所屬專案**的 `docs/proposals/`，不再放在 `docs/architecture/proposals/`。
- Hub：`docs/proposals/`。Tool：`projects/<id>/docs/proposals/`。Tool 範本：`tooling/scaffold/project/docs/proposals/`。
- `docs/architecture/` 只保留現行架構、ADR（`decisions/`）與已採納設計的附件快照。
- 搬移只改位置：保留 topic 名稱、狀態、附件、歷史正文與未提交的內容。

### 2. 六階段流程

需求分析與方案探索可以來回確認，其餘依序進行：

```
需求分析 ⇄ 方案探索 → 需求規格 → 技術設計 → 實作與驗證 → 採納與封存
```

| 階段 | 主要文件 | 是否可省略 |
|---|---|---|
| 需求分析 | topic 的 `intent.md`（選用） | 可省略文件 |
| 方案探索 | topic 的 `design.md`（選用） | 可省略文件 |
| 需求規格 | 工作包 `spec.md`（B）；A 的需求與驗收寫在適用的文件中 | A 可不另建文件，但行為與驗收仍須清楚 |
| 技術設計 | `plan.md`、`tasks.md`（任務拆分）；A 的技術方案寫在設計稿 | 不省略實作依據 |
| 實作與驗證 | 程式、`verification.md` | 不省略 |
| 採納與封存 | 有效規格、Change Log、`archive/changes/`；A 手動採納 | 採納只在影響有效規格時；封存只適用工作包 |

**可以省略文件，不能省略實作依據。** 合理的路徑：

- `intent → spec`、`design → spec`。
- 已確認、且同時包含需求、驗收與足夠技術方案的 `design → 實作`。
- 已有適用規格或設計的小修正，可引用既有依據。
- `intent → 實作` 通常不足（缺技術方案與驗收），不作為預設路徑。
- `design → intent` 只代表回饋或正式整理，**不是必經順序**；不得強制把所有探索稿複製成 Intent。

### 3. 早期 intent 與正式 Intent

- topic 下的早期 `intent.md`（需求分析）與 `design.md`（方案探索）是**不同責任**，不是互相競爭的主稿。單檔小稿 `<topic>.md` 可以合併兩者。
- 一個 topic 的**同一角色只有一份主稿**；保持同稿迭代、Git 歷史與轉換證據。只有同一角色出現兩份才算重複。
- 正式 change 的 Intent 仍在 `docs/intent/<NNN-name>/`，**選用**。可以直接用探索稿或使用者指示 specify，但要記錄來源、範圍與驗收，不假裝已有正式 Intent。
- 正式 Intent 若從早期 `intent.md` 整理，要明確指定**單一來源**，並**凍結被承接的範圍**；不讓兩份同時被當成該範圍的現行需求。部分承接時，不能把整份需求分析凍結。
- 「一個 topic 同一角色只有一份主稿」與轉換紀錄的規則，**共用規則的正本在開發流程手冊**（[§10.1](../../developer-guide/development-workflows.md#101-六個階段)、[§11](../../developer-guide/development-workflows.md#11-探索稿的轉換紀錄)）；`saintber-design` 技能只是遵循這些規則，不另行定義。

### 4. 收尾與方向稿

- 採納有效規格；工作包與正式 inputs 封存；提案保留來源與轉換追蹤。
- 工具方向稿**已轉換（被承接）的範圍凍結**，未轉換的範圍可以演進；方向稿不整份跟著每個 change 封存。

## 遷移映射

| 舊位置 | 新位置 |
|---|---|
| `docs/architecture/proposals/` | `docs/proposals/` |
| `tooling/scaffold/project/docs/architecture/proposals/` | `tooling/scaffold/project/docs/proposals/` |
| （Tool 原本沒有內容） | `projects/forge-explorer/docs/proposals/`（空骨架） |

- 歷史文件（已採納 ADR 的正文、先前的驗證紀錄、設計快照、`archive/`）中的**舊路徑保持原樣**，那是當時的事實；現行位置以本映射為準。**不要**把舊路徑下的歷史內容當成現行需求。
- 現行的導覽、AGENTS、README、Policy、範本與連結已改為新位置。

## 影響

- **修訂**：ADR-0003 決策 1 表格中的提案路徑，以及 ADR-0004 中對 `proposals/` 的位置引用，改以本 ADR 的新位置為準。兩者其他決策（A／B／C 流程、轉換紀錄、`saintber-design` 的職責）**仍然有效**，不標為 superseded。
- ADR-0001～0004 正文不改；僅在必要處加上導航註記指向本 ADR。
- **不修改**：憲章、設計快照、`archive/` 歷史、有效規格。不新增 Spec Kit 功能；Spec Kit 擴充的已知限制（G-PC、G-NUM 等）不變。
- 不新增需求分析專用的指令。`saintber-design` 只處理方案探索：讀取既有的需求分析，但不改寫它，也不自動執行其他階段。
