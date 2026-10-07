# 遷移狀態（`hub/000-restructure`）

> 這份文件記錄**這次遷移**的完成度、證據與未完成項目。它與 `001-portal-home` 的**歷史交付驗證分開**：後者在 `projects/forge-explorer/archive/changes/001-portal-home/`，本文不重新驗證它。
>
> **階段 1 部分完成，尚未完成**（2026-10-06 Codex 審閱退回）。adopt / archive 腳本有已重現的缺陷；plan 的 Policy Check（G-PC）與編號不重用（G-NUM）是本階段需求，**尚未達成**。修正中。下方各項如實標示；沒有任何一項經使用者同意縮減或延期。
> 狀態更新日期：2026-10-06。分支 `backlogs/hub-restructure`（原名 `hub/000-restructure`，由使用者改名），尚未 push，也沒有開 PR。

來源計畫：[ADR-0001 的設計快照](architecture/decisions/0001-attachments/design-2026-10-adopted.md) §15.3（步驟）、§15.5（驗收情境）、§16（階段）。快照不再更新，所以進度記在這裡。

## 步驟完成度

| 步驟 | 內容 | 狀態 | 說明 |
|---|---|---|---|
| 1 | 開分支 | ✅ 完成 | `hub/000-restructure`，起點 `b5c7239` |
| 2 | 遷移前基線 | ✅ 完成 | build 0 警告 0 錯誤；單元測試 1 通過（見「證據」） |
| 3 | 搬移 .NET | ✅ 完成 | `git mv`；只改路徑 |
| 4 | 重跑 build / 測試 | ✅ 完成 | 結果與基線相同（見「證據」） |
| 5 | 001 封存、建立有效規格 | ✅ 完成 | 封存 ✅；有效規格已補建：`projects/forge-explorer/docs/specifications/`（portal-home、portal-authentication、tool-registry），每條標證據等級，缺口如實列出 |
| 6 | 拆分舊 Policy | ✅ 完成 | Hub 三份通用、forge-explorer 五份加 frontmatter；與舊文的對照由 Codex 核對 |
| 7 | Hub 骨架 | ✅ 完成 | `workspace.json`、`catalog/`、`schemas/`、`scripts/` 已建；forge-explorer 的 `README.md`、`AGENTS.md` 已補；`.gitignore` 已核對（U7）。`schemas/` 與 `scripts/` 的實際內容屬階段 2 以後 |
| 8 | Spec Kit | ✅ 完成 | 上游 v1.1.0；hub 擴充（context / adopt / archive）已安裝到 hub 與 forge-explorer，兩種代理都有；代理驗收 PASS（U3，含範圍限制） |
| 9 | 憲章、ADR、★Policy、README | ✅ 完成 | 憲章 **Active v1.0.0**（2026-10-06 批准）；ADR-0001；五份★Policy；根 README |
| 10 | 封存設計稿 | ✅ 完成 | 快照在 ADR 附件，**位置已獲使用者同意**（2026-10-06，ADR-0001 決策 11；僅限這份快照的保存位置） |

## 未完成（原範圍，無延期同意）

| # | 項目 | 來源 | 阻擋或前提 |
|---|---|---|---|
| U1 | ~~forge-explorer 的有效規格~~ | — | ✅ **已完成**（2026-10-06）：三個 capability、穩定 requirement ID、索引、Change Log、證據等級與已知缺口。Token（原 FR-007）未實作，列為未達成 |
| U2 | ~~五份★Policy~~ | — | ✅ **已完成**：`POL-STRUCT/DOC/SPEC/SPECKIT/INVOKE-001`，每條標出處；目前沒有 Proposed 條文。forge-explorer 與 Hub 憲章的衝突已由 owner 裁決（A+B，2026-10-07）並套用，forge-explorer 憲章 **v1.1.0** |
| U3 | ~~§13.5 代理驗收~~ | §13.5、§15.5 #2、#3 | ✅ **已完成**：Claude Code 與 Codex 各自在隔離副本**實際執行** S2、S3、SA，以 `check.mjs` 客觀判定**全部 PASS**（Codex 的結果另由 Claude 獨立重跑確認）。**範圍限制**：S2 只證明產出被隔離在目標專案，**不含**上游 `create-new-feature.ps1`、編號、branch、hooks 的全流程（Codex 的 S2 因終端無法啟動，以檔案工具等效建立）；SA 只證明 standalone 解析，**不等於** §11.6 治理內化或 §14.3 遷出演練（驗收 11）。見 `specs/001-stage1-speckit-extension/verification.md` |
| U5 | §15.5 驗收 4、5、5a | §15.5、§16 階段 1 | ✅ 以腳本的**自動化測試**通過（38 個測試，含變異測試）；**沒有**代理端到端的 adopt / archive 驗收。驗收 6–12 屬階段 2 以後，**不在本次範圍** |
| U6 | ~~憲章的 owner 批准~~ | — | ✅ **憲章已批准**（2026-10-06，Active v1.0.0）。Policy 依 Policy 索引的 A / B 類判斷效力；目前 B 類沒有需裁決的規範條文 |
| U7 | `.gitignore` 完整性 | §15.2 | ✅ 已核對：36 個應追蹤、16 個應忽略的代表路徑以 `git check-ignore -q` 驗證全部符合；新增 `dist/`、`coverage/`、`*.tgz`、`.npmrc`、`.specify/tmp/` 的排除 |

## 待使用者裁決

目前**沒有**待使用者裁決的事項。

> P1（設計快照放在 ADR 附件，還是 `archive/governance/`）已於 2026-10-06 裁決：**維持現址**（ADR-0001 決策 11）。
> 這項同意**僅關於這份快照的保存位置**。它**不是**新增 Policy（不代表未來所有設計稿都要如此保存）、**不代表**憲章已正式批准、剩餘遷移完成，或附件中未核准的強制條件獲批准。

已核准、已記錄：
- Spec Kit 升級到上游 v1.1.0、捨棄舊客製化、兩份原稿不保留（2026-10-06）。
- `scripts/release/` 的**目錄與責任分工**（2026-10-06，ADR-0001 決策 10；**不含**僅 tag 觸發、CI 完全唯讀、pack 一律憑證）。
- 設計快照維持現址，保存在 ADR-0001 的附件（2026-10-06，ADR-0001 決策 11；僅限這份快照的保存位置）。

## 三份通用 Policy 與舊文的對照（Codex 已核對）

> 已由 Codex 對照 `b5c7239` 的原文核對（原 U8，已完成）。這裡只留精簡對照。

| Hub Policy | 條款 ← 舊文 | 說明 |
|---|---|---|
| POL-SEC-001 | R1 ← §1、§3；R2 ← §5；R3 ← §6、§7；R4 ← §10；R5 ← §11 | 原本技術限定的 JWT / OIDC、InnerApi / OuterApi、Blazor 等留在 forge-explorer 專屬 Policy |
| POL-TEST-001 | R1–R3 ← 核心原則、被測目標、命名；R4、R5 ← 單元、整合測試；R6 ← 禁止事項 | .NET 命名格式與 `.Tests` 遷移規則留在工具專屬 |
| POL-DOD-001 | R1–R7 ← 完成狀態、模板、Gate A、Gate B、流程對映、Anti-Patterns、Verification Record | 具體 `dotnet` 命令留在工具專屬 |

**不是舊文原有的內容**：
- 例外由 owner 核准的程序：來源是已採納設計 §11.5，不是舊文。
- R6a 與 Docs Consistency：本輪使用者的澄清；正式條文待批准，見 U6。
- POL-SEC-001 **不代表所有未來的 Hub 安全責任都已完成**：bootstrap、入口包的來源與完整性驗證等**尚待補**（該檔「尚未涵蓋」一節）。

既有的通用底線都有保留。

## 證據

### .NET 搬移

| 項目 | 結果 | 來源 |
|---|---|---|
| 檔案內容比對 | `b5c7239` 的 `src/`、`tests/`、`Saintber.Forge.sln` 共 **51 個檔案，全部在 `projects/forge-explorer/`；50 個 git blob 相同**；唯一不同是 `tests/.../IntegrationTests/README.md`（3 處 CI 路徑，刻意更新） | 本輪由我以 `git rev-parse <commit>:<path>` 比對；Codex 獨立得到相同結果 |
| `dotnet build Saintber.Forge.sln` | 0 警告、0 錯誤 | **遷移前基線**與**搬移後**各執行一次（commit `8875efd` 之前後）；**本輪（校正輪）另外重跑一次**，結果相同 |
| 單元測試 `Saintber.Forge.BlazorServer.UnitTests` | 1 通過、0 失敗 | 同上，三次結果相同 |
| 整合測試（Playwright E2E） | **未執行** | 需要瀏覽器與資料庫環境，不在這次遷移的驗證範圍內 |

### Spec Kit（上游 v1.1.0）

| 項目 | 結果 | 說明 |
|---|---|---|
| 腳本的根目錄解析 | ✅ 已驗證 | 在 Hub 根目錄、`projects/forge-explorer/` 內、以及 `SPECIFY_INIT_DIR` 指定專案時，`common.ps1` 都解析到正確的目錄；無效的 `SPECIFY_INIT_DIR` 被拒絕，不退回。**這只是腳本層的測試** |
| 代理實際產出隔離、standalone 模式 | ❌ **未驗證** | 即 U3 |
| forge-explorer 憲章 | ✅ 完整 | 升級前後的雜湊相同（`4c9b82a9d814bcf5`，前 16 碼） |
| 整合 | claude、codex | Hub 與 forge-explorer 皆是；`specify integration status` 回報 OK |

### 本輪（校正輪）的修正

- 憲章原則 VI 與修訂程序改為「設計先於實作」（草稿，憲章整份待批准）；POL-DOD-001 R6a（正式條文待批准，但使用者的明確指示現在就須遵守）。
- R7 的 Verification Record 路徑與 forge 專屬 DOD 的路徑修訂：**依已採納設計調整，已授權**，不是新決策，不在待核准項。
- 補上 forge-explorer 的 `README.md` 與 `AGENTS.md`（U4 完成）。
- Hub Policy 索引新增「目前的效力」：區分已核准的既有規則（A）、待核准的新增條款（B）、憲章草稿（C），避免把草稿當成已生效，也避免把所有 Policy 視為失效。
- ADR-0001：區分「已核准的決策」、「待裁決」、「實現與進度」；快照來源改為準確描述。
- `.gitignore`：三條會忽略計畫路徑的規則已收斂範圍，保留 .NET 建置產物與秘密的排除。見下。
- 過時指引：`AGENTS.md`、Policy 與 docs README、`speckit-workflow`。
- 新增 `docs/architecture/overview.md`（現況，只缺 CLI 章節）。

### `.gitignore` 的核對

三條舊規則會忽略計畫中要追蹤的路徑，已用 `git check-ignore -q`（退出碼）實測：

| 路徑 | 修正前 | 修正後 |
|---|---|---|
| `packages/x/a.txt`（Hub 的 Shared） | 被忽略（`packages/`） | **可追蹤** |
| `scripts/release/pack-entry.mjs` | 被忽略（`[Rr]elease/`） | **可追蹤** |
| `Saintber.code-workspace`、`projects/*/*.code-workspace` | 被忽略（`*.code-workspace`） | **可追蹤** |
| `projects/forge-explorer/src/.../bin/Debug/`、`obj/` | 被忽略 | **仍被忽略** |
| `projects/forge-explorer/src/Persistence/x/packages/`（NuGet 還原） | 被忽略 | **仍被忽略** |
| `.env`、`appsettings.Development.json` | 被忽略 | **仍被忽略** |
| 其他 `*.code-workspace` | 被忽略 | **仍被忽略**（只開放設計中的兩種） |

> 備註：`git check-ignore -v` 顯示以 `!` 開頭的行，代表那條是「取消忽略」，**不是**例外沒有生效。判斷是否被忽略要看退出碼。

## 本輪發現的完成度差異

| 項目 | 差異 |
|---|---|
| 先前的完成度宣稱 | 先前回報「遷移 10 步全部完成」**不正確**：步驟 5、7、8、9 只是部分完成（見上表） |
| forge-explorer 根目錄 | 原本沒有 `README.md`、`AGENTS.md`；設計 §5 的 Tool 骨架要求有，**沒有使用者同意延期**。**已補上**（U4 完成）：只寫既有內容的入口與目標解析指引，如實標示 saintber 入口尚未實作，沒有改任何 .NET 程式碼或命名空間 |
| `design.md` 快照 | 附件含有尚未核准的強制條件字句（僅 tag 觸發、CI 完全唯讀、pack 一律憑證）；以 ADR-0001 決策 10 的範圍為準 |
| Policy 的效力標示 | 先前寫成「憲章 Draft，所以 Policy 尚不具約束力」，會讓代理忽略既有已核准規則；已更正 |

## 後續工作與阻擋

| 項目 | 狀態或阻擋 |
|---|---|
| 上游 `create-new-feature.ps1`、編號、branch、hooks 的全流程代理驗收 | **未驗證**：兩個代理的 S2 都沒有走完這段（Codex 以檔案工具等效建立；兩者都沒建 branch、沒有 hooks）。需要時另開工作 |
| adopt / archive 的代理端到端驗收（G-AGENT-ADOPT） | **未驗證**：目前只有腳本的自動化測試 |
| ~~forge-explorer 與 Hub 憲章的潛在衝突（C1–C7）~~ | ✅ **已裁決並套用**（2026-10-07，A+B）：forge-explorer 憲章 v1.0.0 → **v1.1.0**（MINOR），新增「五、與 Hub 的關係」、Amendment Authority 改為 owner（`saintber`）；原則 1–10 位元組相同（已驗證）；Ratification Date 保留 2026-02-07。依據見 `projects/forge-explorer/docs/governance/policy/conflicts-with-hub.md` |
| 已知缺口 G-PC（plan 的 Policy Check 沒有自動機制） | preset 方式經實測會改寫 CLI 受管理的檔案，不採用；目前靠 Policy 規範與 analyze 檢查 |
| 已知缺口 G-NUM（上游編號只掃 `specs/`） | 由 `speckit-hub-context` 提供 `nextChange`；依賴代理照做 |
| 遷出準備（§11.6 治理內化、distribution 快照）與遷出演練（驗收 11） | **未做**。standalone 驗收只證明解析與產出隔離；forge-explorer 的 AGENTS 與 Policy README 仍以 `../../` 指向 Hub |
| 階段 2 以後（saintber CLI、bootstrap、schemas、`scripts/release/` 的腳本、驗收 6–12） | 屬 `hub/00x-*` 之後的工作包；需先有已核准的設計 |
