# Tasks：第一階段 Spec Kit 擴充

**Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

> 狀態以 `[ ]` 未做、`[X]` 已做。**只有真的執行並看到結果才打勾**；驗證類任務要寫出證據。
>
> **2026-10-07 收尾範圍**：以遷移完成為目標，不再擴大開發。T050、T051（G-PC）與 T052（G-NUM）**未完成，留待後續 change**，不是取消。測試檔已依 POL-TEST-001 改名為 `*.unit.test.mjs` / `*.integration.test.mjs`，下列 T014、T024、T031 以新檔名為準。

## P0 驗證未解問題（Q1 – Q5）
- [X] T001 在隔離副本驗證 Q1：`specify extension add --dev` 能否安裝本地擴充，並同步指令到 Claude 與 Codex
- [X] T002 驗證 Q2：安裝後 `specify integration status` 是否把擴充檔案列為受管理
- [X] T003 驗證 Q3：編號掃描 `archive/changes/` 的作法（hook 或 `context` 建議）
- [X] T004 驗證 Q4：preset `wrap` 能否在 plan 後追加 Policy Check
- [X] T005 驗證 Q5：extension 指令命名規則（結論：`speckit.<ext>.<cmd>`，見 plan 的偏離紀錄）

## P1 共用函式庫與 context
- [X] T010 `scripts/lib/`：專案解析（明確指定 → `SPECIFY_INIT_DIR` → 最近的 `.specify/`；無效即報錯、不降級）
- [X] T011 `scripts/lib/`：git 狀態讀取（committed / staged / unstaged / untracked，限定單一路徑）；**無 git 時明確報錯**
- [X] T012 `scripts/lib/`：requirement ID 解析、重複與重用檢查
- [X] T013 `scripts/context.mjs`：workspace / standalone 兩種模式；輸出專案、模式、讀取清單、建議的下一個工作包編號（掃描 `specs/` 與 `archive/changes/`）
- [X] T014 `tests/context.integration.test.mjs`：workspace、無效專案、standalone、不降級、編號不重用

## P2 adopt（驗收 4、5、5a）
- [X] T020 `scripts/adopt.mjs`：讀 `verification.md`，未通過則拒絕；`cancelled` / `superseded` 拒絕
- [X] T021 基線檢查：committed、staged、unstaged、新建的目標規格；辨識本工作包的 Delta 與其他來源的修改；來源不明就停止
- [X] T022 暫存區 `.specify/tmp/<change-id>/`：產生完整結果並驗證（ID、連結、目標存在）；殘留時要求處理
- [X] T023 套用前**再檢查一次**；套用；**失敗只回復本次觸及的檔案**；不 `git add` / `git commit`
- [X] T024 `tests/adopt.integration.test.mjs`、`tests/hardening.integration.test.mjs`：驗收 4（單一有效規格、Change Log 指向封存、歷史不遺失）、驗收 5（並行、staged、未提交、套用前再檢查、無關變更不受影響）、驗收 5a（中途失敗回復、使用者修改保留、未 stage / commit）

## P3 archive
- [X] T030 `scripts/archive.mjs`：移動工作包與輸入；目標已存在時內容相同視為完成、不同則報錯；`archive.md` 不記錄自己的 commit；清除活動上下文
- [X] T031 `tests/archive.integration.test.mjs`、`tests/hardening.integration.test.mjs`：可重試、不覆蓋、cancelled / superseded 只封存

## P4 extension 與指令
- [X] T040 `extension.yml`（id `hub`；指令 `speckit.hub.context` / `adopt` / `archive`）
- [X] T041 三個指令 `.md`：呼叫腳本、轉述結果、**不繞過腳本的失敗**
- [X] T042 在隔離副本安裝；`specify extension list` 顯示；`specify integration status` 沒有被修改的受管理檔案

## P4a 安全修正（Codex 審閱 R10 – R13；2026-10-07）
- [X] T045 fence 感知的 requirement 解析與套用後驗證（`lib/markdown.mjs`、`lib/requirements.mjs`；單元測試 20 項）
- [X] T046 路徑與 ID 白名單、symlink／junction 拒絕（`lib/safety.mjs`）
- [X] T047 adopt：內容快照（Snapshot）、多 capability、Owner 與索引更新、回復不覆蓋並行修改且保留暫存區 before／after
- [X] T048 archive：Manifest 完整性與身份驗證（重試、暫存、寫入後）、逐檔刪除前再比對、回復不覆蓋並行新增
- [X] T049 回歸測試 `hardening.integration.test.mjs`（Codex 探針、junction、工作區登錄越界、重試缺檔／多檔／竄改／別的 change、並行回復）
  - 證據：`node tooling/speckit/extension/tests/run-all.mjs all` → 88 通過、0 失敗（單元 20、整合 68；2026-10-07 本輪實測）。隔離副本 mutation：7 項變異 6 項被抓到；archive 寫入後的 `verifyArchive` 因前一行 `sameTree` 已涵蓋同類錯誤，沒有被單獨抓到

## P5 Policy Check
- [ ] T050 依 T004 的結論，讓 plan 包含 Constitution & Policy Check（**未完成，留待後續 change**：preset 不可行；缺口 G-PC）
- [ ] T051 驗證：產出的 plan 含 Policy Check 區段（**未完成，留待後續 change**，同上）
- [ ] T052 編號不重用的自動機制（G-NUM；**未完成，留待後續 change**；目前只有 `context` 的建議編號）

## P6 代理驗收（見 acceptance/run.md）
- [X] T060 備妥隔離副本與固定提示詞
- [X] T061 Claude Code 實際執行：驗收 2、3、standalone
- [X] T062 Codex 實際執行：驗收 2、3、standalone（**需 Codex 配合**）
- [X] T063 比對兩者結果並記錄在 `verification.md`
- [ ] T064 adopt／archive 的代理端到端驗收、原生 specify→plan→archive 全流程雙代理驗收（**未做，留待後續 change**）

## P7 文件
- [X] T070 更新 `docs/developer-guide/speckit-workflow.md` 的「指令現況」與呼叫方式（Claude `/`、Codex `$`）
- [X] T071 ADR-0001「實現與進度」補記指令命名事實
- [X] T072 更新 `docs/migration-status.md`（U3、U5）
- [X] T073 POL-DOD R6a：檢查文件是否失效，結果記在 `verification.md`
