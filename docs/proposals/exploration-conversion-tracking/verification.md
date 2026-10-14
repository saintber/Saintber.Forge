# 驗證紀錄：探索稿轉換紀錄與 `forge-design` 的流程文件

- 狀態：Codex 校閱完成；總交付範圍與限制見 [forge-design 交付紀錄](../forge-design-delivery/verification.md)
- 更名說明（2026-10-14）：本指令原暫名 `forge-design`，使用者已核准正式名稱 `saintber-design`。下文的執行名稱、路徑與當時的驗證內容是**歷史紀錄**，保持原文不改；現行正本見 [`tooling/skills/saintber-design/`](../../../tooling/skills/saintber-design/README.md) 與 [開發流程 §12](../../developer-guide/development-workflows.md#12-流程配套工具saintber-design-與-spec-kit-指令)。
- 流程：A 直接開發，只改流程與治理文件，不使用 Spec Kit
- 引用的設計：[ADR-0004](../../architecture/decisions/0004-exploration-conversion-tracking.md)（使用者 2026-10-13 的明確指示）；正本 [開發流程 §11](../../developer-guide/development-workflows.md#11-探索稿的轉換紀錄)、[§12](../../developer-guide/development-workflows.md#12-流程配套工具saintber-design-與-spec-kit-指令)。本紀錄不重寫決策內容。
- baseline-commit：`946a124`。開始時工作目錄**不乾淨**：上一輪「工作階段用詞」的 5 份文件尚未提交（見 [development-phase-terminology](../development-phase-terminology/verification.md)）。本次在其上修改；本次範圍只列下方檔案。
- 受影響的 capability：不影響有效規格

## 範圍

- 新增 ADR-0004（Accepted，使用者明確指示）。
- `docs/developer-guide/development-workflows.md`：
  - 新增 §11 轉換紀錄：格式、規則、一般主稿與方向稿的分流、代理的判斷順序。
  - 新增 §12 `forge-design` 指令的文件說明，依 Codex 提供的實際用法撰寫；之後依實際的 `SKILL.md` 校正 `kind=topic|direction`、現況與驗收範圍。
  - §2 補「同主題舊命名沿用」，§3、§6.1 補「未成立 Tool 的方向稿以工具命名 topic，不共用 Hub 的 product-direction」，與 `SKILL.md` 一致。
  - §2、§5.2 步驟 11、§6.2 步驟 5 引用 §11。
- POL-DOC-001 新增 R11（出處 ADR-0004），Policy 索引同步。
- 入口引用：`docs/architecture/README.md`、`docs/architecture/proposals/README.md`、`docs/developer-guide/README.md`。

不在範圍：技能正本、安裝器、三代理入口、Tool 範本的轉換紀錄說明（都由 Codex 負責；我一度誤改範本，已還原，見下方）；ADR-0001～0003 正文；已結案的驗證紀錄；憲章；Spec Kit 擴充。

## 環境

- 本機 Windows；Node v24.19.0，只用來執行唯讀的文件檢查腳本，腳本放在系統暫存目錄，不在 repo。

## Gate A

純文件變更，依 POL-DOD-001 R3 第 3 點以可重現的最小驗證代替。

### 檢查結果

- 工作目錄中所有新增或修改的 Markdown 共 10 份，包含上一輪尚未提交的 5 份，與本次觸及的 8 份（ADR-0004、本紀錄、`development-workflows.md`、`docs/architecture/README.md`、`proposals/README.md`、`developer-guide/README.md`、`documentation-governance.md`、Policy 索引）。兩輪重疊 3 份：`development-workflows.md`、`proposals/README.md`、`developer-guide/README.md`，所以合計 5 + 8 − 3 = 10。合計 61 個本機連結與章節錨點，**0 個缺檔或錨點不存在**；code fence 0 個問題。
- 全 repo 指向 `development-workflows.md` 的入站引用 14 筆、7 個不同錨點（排除封存歷史與設計快照），全部存在；包含本次新增的 §11、§12 錨點。錨點檢查會略過 code fence 內的範例標題。
- 非 Markdown 變更：無。
- 受保護路徑（**僅指我負責範圍內的檢查，不代表整個 repo**）：我的修改沒有碰 `tooling/`（含 Tool 範本）、`.agents/`、`.claude/`、`.gemini/`、`.specify/`、`projects/`、`specs/`、`archive/`、ADR-0001～0003、設計快照、上次已結案的驗證紀錄。整個工作目錄在這些路徑下另有 Codex 新增或修改的技能正本、安裝器、三代理入口與範本，不是我的修改，也不在這項檢查的範圍；初次檢查當時它們尚未出現，現在已存在。
- 關鍵字搜尋：「必須用 v1／semver」、「建立即自動寫轉換紀錄」、「宣稱端到端機械保護」都沒有出現。
- repo 根目錄沒有 `.tmp-*`；檢查腳本放在系統暫存目錄，跑完已刪除。

#### 對齊 SKILL.md 後的重跑

- 只檢查我負責的 10 份 Markdown：62 個本機連結，0 個缺檔或錨點不存在；code fence 0 個問題。入站引用 14 筆、7 個錨點，全部存在。
- 手冊 §12 與 `tooling/skills/forge-design/SKILL.md` 的關鍵詞比對（代理比對）：`kind=topic|direction`、`project=hub|forge-explorer`、`from=`、`reuse`、`new`、`continue-change`、`needs-clarification` 兩邊都有；手冊已沒有 `kind=change`。
- 工作目錄另有 13 項由 Codex 負責的變更（技能正本、安裝器、測試、三代理入口、`tooling/skills/README.md`），不在本紀錄範圍，我沒有修改它們。

### 語意核對（代理比對，Claude）

- §11 的欄位與 ADR-0004 決策 1、6 一致：轉換範圍、對應 change、目前位置、來源 commit、日期；pending 的寫法，以及不得偽造 commit。
- 「只在真正轉換時追加」、「建立設計稿不是轉換」：§11.2、§12.2、ADR 決策 7 一致。
- 「紀錄缺漏不等於沒有轉換」、不覆寫、不依檔名推測：§11.3、POL-DOC R11、ADR 決策 5 一致。
- 沒有新增 v1／v2 或 semver；沿用一個主題一份主稿與四個工作階段。
- §12 明寫它是 AI 技能，不是端到端的機械保護；Gemini 只驗證格式，未實機驗收。

## 過程中的偏差

- 我一度把轉換紀錄表加進 `tooling/scaffold/project/docs/architecture/proposals/_template.md`。這違反本次「不寫 tooling」的分工，已用 `git checkout` 還原。之後該範本由 Codex 補上類型、owner 與轉換紀錄說明（無虛構轉換列）；那是 Codex 的修改，不是我的。

## 未執行的項目

- **沒有**執行 `forge-design`、安裝器或其測試；這些由 Codex 負責並另行記錄。§12 已與實際的 `tooling/skills/forge-design/SKILL.md`、`README.md` 做**文字比對**（代理比對），不是行為驗收。
- 後續依 Codex 的來函再校正：ADR-0004 影響段改為「POL-DOC 新增 R11」；§12 補 `owner=` 參數與新稿預設單檔；本紀錄明確「受保護路徑」只指我的範圍。
- **沒有**在 renderer 檢視版面，也沒有跑產品測試或建置。
- 語意核對是代理比對，**不是**人工審閱。

## 隔離副本的代理情境驗證（Claude；2026-10-14）

依使用者指定，在獨立的 Hub 暫存副本（`%TEMP%\saintber-iso\forge-design-<隨機碼>`，不在 repo 內）以**已部署的 `/forge-design`**（Skill 工具）處理四筆自然語言請求，project=hub、owner=saintber。證據檔在該副本的 `agent-evaluation.json`；我沒有修改主 repo、其他副本或任何工作包，沒有 stage 或 commit。

| # | topic | 判斷 | 寫入 | 要點 |
|---|---|---|---|---|
| 1 | fresh-probe | new | 新增單檔 `fresh-probe.md` | 先搜尋確認沒有同主題；以不覆蓋既有檔案的旗標建立；有稿首欄位；轉換紀錄寫「尚無轉換」，沒有虛構轉換列；只有方向與候選方案 |
| 2 | reuse-probe | reuse | 同一份主稿增修 | 草稿、尚無轉換、無其他引用；寫入前重讀並比對原文；28 行純新增，被刪除或改寫的既有行為 0；沒有 v1／v2 副本 |
| 3 | converted-probe | continue-change | **無寫入** | 稿已轉為 change 001-confirmed；來源 commit 經核對確實包含轉換當時的原文；工作包與 Intent 位置存在且回指本稿；未封存、未採納。建議在既有 change 討論，不改舊稿與工作包 |
| 4 | ambiguous-probe | needs-clarification | **無寫入** | 稿的轉換紀錄寫「尚無轉換」，但工作包 `002-notifications` 已回指本稿且主題相同，兩者在同一個 commit，看不出先後；紀錄空白不能當作從未轉換。待釐清問題只記錄在證據檔，沒有向真使用者提問 |

- **寫入前後的檔案雜湊比對**（47 個檔案：docs、specs、`.specify`、AGENTS、workspace.json、三個代理入口）：內容被修改的只有 reuse-probe 的主稿，新增的只有 fresh-probe；沒有刪除。converted-probe 與 ambiguous-probe 的主稿、兩個工作包與 Intent 的雜湊完全相同。Codex 另以 `fixture-before.json` 獨立核對 converted-probe、ambiguous-probe 逐字相同，並確認 continue-change、needs-clarification 沒有覆寫舊稿。
- 副本裡 Claude、Codex 兩個入口的 `SKILL.md`，與主 repo 已部署版本及 `tooling/skills/forge-design/SKILL.md` 正本的雜湊相同。
- 過程中我一度用格式不符的 grep 比對雜湊，誤報「三個檔案已變動」，與 git 的結果矛盾；查明是比對方法錯誤，改用精確解析後確認這三個檔案沒有變動。

**範圍限制**

- 這只是 **Claude 一個代理**在隔離副本的結果，**不代表** Codex 或 Gemini 完成端到端驗收；本段沒有驗證 Gemini 的 TOML，Codex 另行完成的格式解析見總交付紀錄。
- 情境 3、4 是很小的 fixture，真實的 change 與稿件更複雜；技能沒有機械鎖，判斷靠代理讀檔，這次結果正確不保證每次如此。
- 沒有向真使用者詢問；技能的內容檢查、連結檢查是代理自己執行。

## Docs Consistency（POL-DOD-001 R6a）

- 偏離已核准設計：無。新規則以 ADR-0004 記錄使用者本次的明確指示（Accepted，依使用者明確指示有效）；沒有改寫既有的 Accepted ADR。
- 最後依 Codex 來函修正 §11.1：「目前位置」欄改為不改寫其他欄、僅允許來源 commit 由 `pending` 補成真正包含原轉換內容的 commit（補證據，不重寫轉換事實），且不得由代理自動提交取得 commit。

## Final Status

- **Done，限本次流程文件與上述 Claude 單一代理的隔離驗證**：Codex 已於 2026-10-14 完成內容校閱與產物獨立核對。這是代理校閱，不是使用者人工驗收；整體指令交付與未驗證範圍依總交付紀錄，不推論其他代理的端到端結果。
