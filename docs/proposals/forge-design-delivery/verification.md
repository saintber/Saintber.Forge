# 探索指令交付與校閱紀錄（現名 saintber-design）

- 日期：2026-10-14；狀態：本次指令交付與 Codex 校閱完成。
- 依據：使用者明確要求補轉換追蹤並建立三代理可用的探索指令；[ADR-0004](../../architecture/decisions/0004-exploration-conversion-tracking.md)、[流程手冊](../../developer-guide/development-workflows.md)。
- baseline-commit：`946a124`。開始時已有前一輪階段用詞的未提交文件；保留並在其上整合，不宣稱開始時乾淨。
- 範圍：repo 開發技能、部署器與測試、Hub／forge-explorer 的三代理入口與受管檔 hash、Tool 提案範本補充、流程及治理文件；不新增產品工具或改動產品有效規格。
- 正本：[技能](../../../tooling/skills/saintber-design/SKILL.md)、[部署與使用](../../../tooling/skills/saintber-design/README.md)。本紀錄引用正本，不另定義一套指令規則。

本紀錄保留原交付時 `forge-design` 的執行名稱與隔離證據路徑；目前使用 `saintber-design`，更名驗證見下節。歷史名稱不代表仍提供舊指令。

## 正式更名：saintber-design（2026-10-14）

- 依使用者明確指示，工具正式命名為 `saintber-design`。技能說明明確限定探索階段的方向、問題與候選方案，與 `speckit-plan` 的技術設計區分；不變更既有草案的檔名或生命週期。
- 更名來源目錄、技能 name、部署器與測試；重新部署 Hub／forge-explorer 的三代理入口。舊入口逐檔核對受管雜湊及目錄內容後才移除，未改動本地自訂內容或上游 Spec Kit 技能。不保留舊命令別名。
- `node --test tooling/skills/saintber-design/install.test.mjs`：12 項通過、0 失敗、0 skipped；安裝器及測試語法檢查通過。Skill Creator 的 `quick_validate.py` 以離線 Python UTF-8 環境檢查新名稱，通過。
- Python `tomllib` 核對兩份更名後 Gemini TOML；四份 Codex／Claude 入口與正本一致，Gemini prompt 與共用來源一致、只有一個參數位置；六個舊入口均不存在。兩個專案再次安裝，各三入口皆 `unchanged`。
- 下方 Claude 四個隔離情境是更名前驗證；本次沒有把它們宣稱為更名後端到端驗收，也沒有新增 Codex／Gemini CLI 行為驗收。此次更名不擴增技能功能或公共發佈機制。
- Claude 更新流程配套文件後，Codex 再校閱：四階段工具對照、A／B／C 順序、三代理正式入口、探索與技術設計分工、change 建立時的轉換紀錄及擴充限制已對齊。校閱提出的 context 範圍、完整命令名稱與紀錄時點均已修正，沒有新的使用者待決事項。
- Codex 最後檢查涵蓋已暫存、未暫存及未追蹤的 19 份 Markdown：83 個本地連結目標及 fence 檢查通過；`git diff --check` 通過。錨點由 Claude 另行核對，沒有 renderer 驗證。
- 此輪未執行 stage、commit 或 push。工作途中觀察到 index 已被外部操作暫存，包括舊指令入口；保留該狀態，沒有 reset 或替使用者重整暫存區。此次完整更名在工作目錄，暫存區尚未同步所有更名與文件修正。

## 自動驗證

- `node --test tooling/skills/forge-design/install.test.mjs`：12 項通過、0 失敗、0 skipped。包含共用來源、重複安裝、升級、三種入口的本地修改保留、未知受管檔拒絕、治理缺漏、registry 路徑限制、symlink／junction 邊界、Gemini 模板注入及錯誤目標。
- `node --check tooling/skills/forge-design/install.mjs` 與 `install.test.mjs`：通過。Node 執行的開發腳本無額外套件相依及編譯步驟，不執行不相關的 .NET 建置。
- Skill Creator 的 `quick_validate.py`：以離線 `uv` 環境、Python UTF-8 模式執行，來源技能驗證通過；沒有因 Windows cp950 讀取失敗而把驗證視為通過。
- Python 標準函式庫 `tomllib`：Hub 與 forge-explorer 的 Gemini TOML 均解析通過；prompt 和共用來源內容相符，文字參數位置只有一個，沒有 shell 或檔案注入。
- 兩個專案重新執行安裝器：各三個入口皆 `unchanged`；Codex、Claude 的四份 SKILL.md 與正本相同。未手改上游 `speckit-*` 或代理全域設定。
- Markdown 本地連結目標、fence 及 `git diff --check`：Codex 獨立檢查通過；此腳本不驗證錨點或 Mermaid 實際渲染。

## Claude 隔離代理驗證

隔離 Hub 副本位於 `%TEMP%/saintber-iso/forge-design-de3514eeb12b49e19810dbb2b867ec54`，不是本 repo、也不是其他代理的工作副本。Claude 四次以 Skill 工具實際載入 `forge-design`。

| 情境 | 實際結果 | 產物與保留行為 |
|---|---|---|
| 新的日誌輪替探索主題 | `new` | 建立 `fresh-probe.md`，草稿狀態與「尚無轉換」；沒有虛構轉換列 |
| 原有離線報表稿加入 JSON 選項 | `reuse` | 修改既有 `reuse-probe/design.md`，保留原格式、原內容與轉換紀錄 |
| 原稿已整份轉為既有 change | `continue-change` | 核對狀態、轉換列、真實來源 commit 與工作包；不改原稿、Intent 或工作包 |
| 原稿稱尚無轉換，但有工作包回指 | `needs-clarification` | 記錄矛盾及待釐清問題，不寫入該稿或工作包 |

證據是副本的 `agent-evaluation.json` 與實際產物。Codex 獨立比對 `fixture-before.json`：已轉換稿與矛盾稿逐字不變；同稿增修確實新增 JSON 選項，新稿使用單檔。另核對工作包、Intent、HEAD 與 index 皆未被代理變更。

這驗證的是 Claude 單一代理及四個合成情境，不宣稱 Codex／Gemini 同樣完成端到端驗收，也不代表所有方向稿的部分轉換、複雜變更或並行操作已驗收。

## 校閱及採納紀錄

- Claude 撰寫並校閱流程文件，Codex 核對手冊、ADR、Policy、技能、部署說明及範本的一致性；新稿預設單檔、owner 參數、文件歸屬讀取清單已對齊。
- 轉換紀錄包含範圍、change、目前位置、來源 commit、日期；紀錄缺漏不被當成未轉換；已轉換範圍由 change 承接，後續新範圍另開 topic。
- pending 來源補成真實 commit 是補證據，不重寫轉換事實、不自行 commit。只有建立或修訂稿時不新增轉換列。
- 本次依使用者授權採納 repo 開發指令的來源、程式及操作文件；本紀錄是驗證與採納依據。未執行有效規格的自動 adopt／archive，也未改動現行產品規格、既有 Accepted ADR 或已結案的舊驗證正文。
- Git index 未改；本次未 stage、commit 或 push。

## 範圍限制

- Codex 已能發現本專案的技能入口；沒有另跑獨立 Codex CLI 端到端驗收。
- 本機沒有 Gemini CLI，只有官方格式及 TOML parser 驗證，沒有 Gemini 實機驗收。
- 沒有在 Markdown／Mermaid renderer 檢視版面；內容校閱是代理校閱，不冒稱使用者人工驗收。
- 技能由代理讀檔判斷，沒有主稿機械鎖；部署器沒有跨程序鎖或多檔原子交易，中途失敗可留下部分更新，依操作說明處理。

**Done，限本次開發指令、部署與已列出的驗證／文件校閱。** 上述未驗證範圍仍保留，不能推論為已通過。
