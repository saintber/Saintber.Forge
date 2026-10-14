# saintber-intent 技能交付與校閱

- 日期：2026-10-14；狀態：已完成，限下列範圍與已列驗證。
- owner：Hub（saintber）。
- 依據：使用者要求實作技能並由 Claude 更新文件，後續確認名稱為 `saintber-intent`；[需求與技能設計](../intent-management/design.md)及 [Intent 管理提案](../../developer-guide/intent-workflow.md)。
- baseline-commit：`f54ff32`；開始時工作樹乾淨。
- 流程：A 直接開發，不使用 Spec Kit。
- 本次範圍：技能正本、獨立安裝器與測試、Hub／forge-explorer 的 Codex／Claude／Gemini 入口，以及操作文件。沒有更改產品規格、程式、憲章、上游 Spec Kit 或治理採納狀態。
- 尚未實作：自動快照、狀態鎖、機器化需求／邊界解析、正式輸入建立、跨程序鎖與多檔原子部署。技能不執行其他開發階段。

## 交付

[技能正本](../../../tooling/skills/saintber-intent/SKILL.md)依本次已審閱設計實作；[安裝與使用](../../../tooling/skills/saintber-intent/README.md)由 Claude 撰寫、Codex 校閱。三種入口共用正本，與 saintber-design 可獨立安裝、不依賴 Spec Kit。

已涵蓋早期同稿修訂、topic／角色判斷、部分承接、需求來源、既有活動 change 的正式 Intent 修訂、語意版本與舊格式現行範圍辨識。正式輸入不存在時只回報 continue-change，不自動建立。快照只建議；來源 metadata 只在明確要求且承接已真實發生時補記，不代做承接。

治理管理提案仍為 Proposed（ADR-0006、POL-DOC-001 P1）；本次交付不自行把全部規則升為強制 Policy。原 [Intent 文件設計驗證](../intent-management/verification.md)保留當時正文與範圍。

## 部署驗證

- `node --test tooling/skills/saintber-intent/install.test.mjs tooling/skills/saintber-design/install.test.mjs`：26 項通過、0 失敗、0 skipped；Intent 14 項、Design 12 項。
- 新增 Intent／Design 共存驗證：安裝與升級 Intent 不更改另一技能的入口或登錄。
- 新增 CRLF checkout 後升級驗證：受管雜湊以 LF 計算，換行轉換不當作本地內容變更；真實修改仍拒絕覆蓋。此修正只作用 Intent 安裝器。
- 測試亦涵蓋三入口一致、冪等更新、受管升級、本地修改保留、治理缺漏、非法登錄與目標、symlink／junction／broken link 邊界、Gemini 不預期插值拒絕。
- Node 安裝器語法及 Skill Creator `quick_validate.py`（離線 Python UTF-8）：通過。
- Python `tomllib`：Hub 與 forge-explorer 的 Gemini TOML 解析通過；兩份 prompt 與正本內容一致、文字參數位置只有一個。四份 Codex／Claude 入口與正本一致。
- 兩個專案重跑部署，各三個入口均 unchanged。沒有直接編輯代理副本或上游 speckit-*。

## Claude 實際技能驗證

代理由 Skill 工具實際載入已安裝的 saintber-intent，處理原始需求及隔離文件；未提供預期答案。Codex 用 `check-behavior.mjs` 獨立比對前後內容、HEAD、index 與 transcript，不只採信代理回報。

| 情境 | 結果與實際產物 |
|---|---|
| Hub 已有 design，加入需求分析 | 同 topic 新建 intent，探索稿逐字保留；第一輪回報 new 與主題沿用定義不一致，見下節修正與重測 |
| 未承接的重試上限 3 → 5 | reuse，同稿修訂並留下真實指示與 pending 修訂記錄 |
| 已被活動 change 承接，沒有正式 Intent | continue-change，原稿及工作包逐字保留，沒有另建輸入或 topic |
| 活動正式 Intent 的匯出上限 100 → 200 | 現行版本 1 → 2，追加索引；歷史附錄與舊索引保留，下游工作包不改 |
| 正式文件有兩對矛盾現行邊界 | needs-clarification，文件逐字保留，不自行選一對 |
| 部分承接：只改通知需求 | reuse，只改未承接的通知；已承接重試、轉換列及探索稿保留 |
| standalone 已有 design，加入需求分析（修正後） | reuse，在同 topic 新建 intent，沒有跨 repo 依賴或修改探索稿 |
| standalone 活動正式 Intent 舊格式（修正後） | continue-change，確認現行需求後補唯一邊界，版本 1 → 2；歷史及其他需求保留，舊 Trigger 欄仍可辨識為原因 |

第一輪有兩項回報問題：同 topic 新角色檔回報 new；正式修訂未明列結果。Codex 在技能補明「reuse 是主題層級」「正式修訂仍回報 continue-change」，同步部署後，以新的 standalone session 重測兩項，回報與產物均符合。第一輪其他行為的檔案驗證通過；這不是修正後重跑所有情境的聲稱。

兩輪代理均未 stage／commit，沒有改動技能、治理、工作包、有效規格或不相依文件。客觀比對通過：Hub 19 個既有檔與 standalone 11 個既有檔逐字保留；部分承接及正式歷史內容另行核對。

## 證據與範圍限制

隔離證據位於 `%TEMP%/saintber-intent-accept-aeb377c2f3f84cbab5484d9edb8e45c8/`：

- `before.json`、`eval-task.md`、`eval-result.json`、`objective-result.json`（Hub 六情境）。
- `round2-before.json`、`round2-task.md`、`round2-result.json`、`round2-objective-result.json`（standalone 兩情境）。
- `prepare.mjs`、`round2.mjs`、`check-behavior.mjs`、session ID 與各 fixture。
- Hub 來源 commit：`89096a58770828752a4e85d201aa2e6b9b4bf827`；驗收 HEAD：`2eae4167bc119c83aca347c85ea2ea53670a3a1f`。standalone HEAD：`4fbb47dc915d3c4530c033f4821b522854dbc789`。這些只屬隔離測試，不是產品或 repo 的採納事實。

以上為 Claude 單一代理的合成情境；沒有獨立 Codex CLI 或 Gemini CLI 端到端驗收。Gemini CLI 本機未安裝，僅格式與共用內容驗證。未驗證所有 topic 拆分、多來源矛盾、補記承接 metadata、純文字修正或並行競態；不據此宣稱所有狀態已被機械保護。

文件連結、GitHub 形式標題錨點與 fence 已由 Codex 檢查，沒有 Markdown／Mermaid renderer 或使用者人工驗收。Claude 文件已由 Codex 校閱並修正「以實作反向取代設計」的措辭與主題層級回報說明。

## 採納與後續

本次依使用者授權交付 repo 開發技能及已驗證操作文件，不影響產品有效規格，不執行有效規格 adopt／archive，不 push。

後續需要時再討論治理提案正式採納、完整多代理實機驗收與產品化安裝；本次不擴大開發。

## 轉換紀錄

尚無轉換：本次以 A 流程交付，沒有建立 Spec Kit change。
