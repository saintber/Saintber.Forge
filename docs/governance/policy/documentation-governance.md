---
id: POL-DOC-001
title: Documentation Governance
status: active
scope: workspace
applies-to: [specify, plan, tasks, analyze, implement, adopt]
owner: saintber
supersedes: []
source: 採納時的設計 §3.2、§10、§11、§12.2；憲章原則 IV、VI、VII
---

# Documentation Governance

> 目的：規範**文件的類別、唯一正本與歷史資料**。
> 本文是對**已採納設計**與 **Hub 憲章**的忠實展開，每條規則標示出處。出處不在設計或憲章內的條文，標為 **Proposed**，集中列在文末。

## 規則

### R1 文件類別與正本（§10.2；憲章原則 VI）
每一類文件有**自己的正本**，不重複寫同一條規則的全文：

| 類別 | 回答的問題 | 位置 |
|---|---|---|
| 憲章 | 不可退讓的原則 | `.specify/memory/constitution.md`（**唯一正本，不保留副本**，§10.4） |
| Policy | **必須**遵守什麼 | `docs/governance/policy/` |
| 架構 | 系統**現在**怎麼運作（描述性） | `docs/architecture/` |
| ADR | **為什麼**這樣選 | `docs/architecture/decisions/` |
| 有效規格 | 系統**應該**有什麼行為（現行） | `docs/specifications/<capability>/` |
| 工作包 | 這次要改什麼、怎麼做（pending） | `specs/<NNN-name>/` |
| Intent / Decision | 為什麼要做這次變更 | `docs/intent/<NNN-name>/` |
| 使用手冊 | 怎麼安裝、設定、執行 | `docs/user-guide/` |
| 開發者手冊 | 怎麼開發、發佈、遷出 | `docs/developer-guide/` |
| 封存 | 歷史 | `archive/changes/`、`archive/governance/` |

### R2 描述性文件只描述已完成的實作（憲章原則 VI、VII）
- `docs/architecture/` 的描述性文件與使用手冊**只描述已完成的實作**，**不得**把尚未實作的能力描述成現況。`docs/architecture/decisions/` 的 ADR 與其設計附件依 R3、R6 處理，可以記錄設計階段的提案與決策。
- 尚未實作的能力，文件必須明確標示「尚未實作」，**不得**寫得像已經存在。
- 描述性文件在變更**驗證並採納（adopt）後**更新。

### R3 設計稿是歷史快照（憲章原則 VI；ADR-0001）
- 採納時的設計是**歷史快照**，不是持續維護的文件，**不改寫正文**。
- 快照中**未經核准的字句不具約束力**，核准範圍以 ADR 的決策為準。
- 已採納的 ADR 不改寫；決策被推翻時新增 ADR，並把舊的標為 superseded。**只有經核准的決策變更**才能標 superseded；「已實現」與「進度」是另一回事，不得混為一談。

### R4 唯一 owner（§12.2；憲章原則 IV）
- 每個 capability 只有一個 owner 專案；每條 requirement 有穩定 ID，ID 不重用。
- 同一份公開契約只有一個 owner，其他工具引用指定的版本。
- 手冊與程式註解以 ID 或連結引用 requirement，**不另外宣告一套規格**。

### R5 歷史資料預設不被讀作需求（§12.2；憲章原則 IV）
- `archive/` 的內容預設**不被讀作需求**，只有追溯歷史時才明確讀取。
- 單檔多版本的 Intent：流程**只讀** Current Effective Intent，歷史段落不得被推導成現行需求。
- 檔名 `intent.md`、`decision.md` 一律**小寫**。

### R6 ADR 是記錄，不是核准（憲章原則 VI）
- 可在設計階段先建立 **Proposed** 草稿；**經 owner 核准後才成為 Accepted**，先後要清楚標示。
- **不得**用新增 ADR 作為代理自行批准規範的捷徑。
- 一般的錯誤修正**不需要**新增 ADR；只有變更**已採納的架構或決策**才需要。

### R7 誠實的狀態（憲章原則 VII）
- 驗證不足之處必須記為**已知缺口**，**不得**宣稱已驗證。
- 補建的有效規格，要標示每條 requirement 的**證據等級**，不得把低等級證據寫成高等級（範例：`projects/forge-explorer/docs/specifications/README.md`）。

### R8 連結與引用（§7.4、§11.4、§11.6、§14.3）
- workspace 內的文件可以用相對路徑引用 Hub 的治理與共用文件；工具的 Policy 索引要記錄繼承基線，並明確標示這是 workspace 引用。
- 對外 manifest 的 `$schema` 依 §7.4 使用**有版本的網址**，不依賴父 repo 的相對路徑。
- 工具遷出時，workspace Policy 必須內化，distribution Policy 保存版本固定的快照；共用文件改用**本地快照或有版本的網址**。遷出後不得留下指向舊父目錄的失效連結，也不依賴 main 分支的浮動內容。

### R9 文件結構（§10.1）
Hub 與每個工具的 `docs/` 結構相同：`README.md`、`user-guide/`、`developer-guide/`、`architecture/`（含 `decisions/`）、`governance/policy/`、`intent/`、`specifications/`。

## Proposed（超出已採納設計的條文，待 owner 裁決）

目前**沒有**。
