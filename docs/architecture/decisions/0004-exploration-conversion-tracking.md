# ADR-0004：探索稿轉為 change 的轉換紀錄

- 狀態：Accepted
- 日期：2026-10-13
- 核准者：`saintber`（使用者本次明確指示：同意補上完整的探索稿轉換追蹤，並要求建立 Codex、Claude、Gemini 都能使用的建立設計稿指令；指示由 Codex 轉達）
- 後續：提案位置與六階段用詞見 [ADR-0005](0005-proposals-location-and-development-process.md)；本文的決策仍然有效。
- 關聯：[ADR-0003](0003-development-workflow-granularity.md)（三種流程與 `proposals/` 位置，本 ADR 不修改它）；流程正本 [開發流程 §11](../../developer-guide/development-workflows.md#11-探索稿的轉換紀錄)

## 背景

ADR-0003 規定探索文件轉為 change 後，狀態改為「已轉為 change」並連到 intent，但沒有規定要記錄**轉了哪些範圍、何時、從哪個版本**。方向稿（C）會持續演進，也可能只轉出部分章節或能力；沒有紀錄時，後來的人或代理無法判斷某段內容是否已經轉換、需求的正本在哪裡，也可能藉修改方向稿默默改動已轉換的需求。

## 決策

1. **每次轉換都記錄**：探索內容轉為 change 時，在該主稿的「轉換紀錄」表追加一列，記錄轉換範圍（整份、章節或能力）、對應的 change 與目前位置、來源 Git commit、日期。格式見流程手冊 §11。
2. **整份轉換**：原探索內容保留不改寫；本次需求的細節在對應的 change。
3. **部分轉換**：方向稿或主稿只轉出部分範圍時，未轉換的部分可以繼續演進；**已轉換的範圍不能藉修改主稿來改動需求**，要改就在對應的 change 或新的 change 處理。
4. **後續新範圍**：已結案或已轉換的範圍，之後有新需求時另開 topic 或 change，並連回來源。
5. **紀錄缺漏不等於沒有轉換**：轉換紀錄不存在、缺欄或與其他文件矛盾時，代理先核對對應的工作包、封存與有效規格，不能自行覆寫，也不能只靠檔名推測；無法確認時請使用者釐清。
6. **來源必須可定位**：來源 commit 必須真的包含被轉換的探索內容。探索稿尚未提交時，先提交，或明確記為 `pending（未提交）`；不得填寫不包含該內容的 commit。
7. **只在真正轉換時追加**：建立或更新設計稿的動作本身不是轉換，不得自動新增轉換紀錄。
8. **不新增版本制度**：沿用「一個主題一份主稿」與四個工作階段；不引入 v1／v2 或 semver。
9. **建立設計稿的指令**：新增 repo 開發用的技能（正式名稱 `saintber-design`，正本 `tooling/skills/saintber-design/`），供 Codex、Claude、Gemini 建立或更新設計稿，並判斷這次應沿用既有主稿、新開 topic、延續既有 change，或需要釐清。它**不**替使用者執行 specify、實作、adopt、archive、stage 或 commit；不覆蓋重名或格式不同的既有主稿；只修改仍可變的探索範圍，不動已結案或已轉換的部分。技能本身與各代理的部署由另外的工作負責，不在本 ADR 的文件範圍。

## 影響

- 流程手冊新增 §11（轉換紀錄格式、代理判斷順序）；§2、§5.2 步驟 11、§6.2 引用它。
- POL-DOC-001 **新增 R11**（探索稿的轉換紀錄），出處為本 ADR；既有的 R10（設計提案的歸屬）不修改。
- proposals 入口與 Tool 範本的提案範本加入轉換紀錄表。
- **不修改**：ADR-0001、0002、0003 正文，已結案的驗證紀錄，憲章，Spec Kit 擴充或其自動流程。本決策不建立資料庫，也不自動執行任何 Spec Kit 轉換。

## 更名註記（2026-10-14）

決策 9 的技能原暫名 `forge-design`。使用者已明確同意正式名稱為 `saintber-design`（理由是避免與 forge-explorer 混淆），本 ADR 改用正式名稱。這是**命名**的更正，不改變任何決策內容。

歷史驗證紀錄（例如 `forge-design-delivery` 的交付與隔離驗證）記錄的是**當時實際執行的名稱 `forge-design`** 與暫存路徑，不全域改寫，以保留追溯；現行的正本與說明見 [`tooling/skills/saintber-design/`](../../../tooling/skills/saintber-design/README.md) 與 [開發流程 §12](../../developer-guide/development-workflows.md#12-流程配套工具saintber-design-與-spec-kit-指令)。
