---
capability: task-team
owner: hub
status: active
last-adopted: task-team-design
evidence-note: 依 POL-SPEC-001 R9a 手動採納（流程 A，直接開發）；證據等級見下，實機證據只涵蓋「實機驗證範圍與限制」一節
---

# Task Team

按任務啟動並協調一組 AI 角色：PM 唯一對口、角色與模型完全由組態決定、角色主動回報、擴充需使用者同意。這是 repo 的**開發輔助工具**（`tooling/team/` 與 `tooling/skills/task-team/`），不是可安裝的產品，也不屬於 Spec Kit。

> 證據等級：**A** 自動化測試實際驗證該行為（`node --test "tooling/team/test/*.test.mjs"`，使用假 Herdr 與假用量來源）、**R** 實機（Codex 獨立執行的有限 smoke，範圍見最後一節）、**S** 只有靜態碼、**—** 未驗證。**沒有任何一條以「設計文件存在」當證據。**

設計與驗證紀錄：[`docs/proposals/task-team-design.md`](../../proposals/task-team-design.md)。

## Requirements

### 角色與團隊

**REQ-TT-001 開放的角色定義。** 角色是組態中的資料（`roles.<roleId>`：顯示名稱、目的、職責、專屬指示、成果、啟用旗標、模型清單）；新增任意 `roleId` 不需改程式或技能。角色專屬指示不能覆寫共通規則。
- 證據：資料模型（開放角色、必填欄位、新增角色不需改程式）**A**（`config.test.mjs`、`team.test.mjs`）；「角色專屬指示不能覆寫共通規則」是**技能指引**，只有 **S**（`SKILL.md` 的文字），**沒有**端對端驗證 AI 會遵循

**REQ-TT-002 PM 唯一且可配置。** `coordination.pmRoleId` 必須指向存在且啟用的角色；任一時刻只有一位有效 PM；PM 角色不能被追加為成員。
- 證據：**A**（`config.test.mjs`、`team.test.mjs`）

**REQ-TT-003 角色定義與團隊成員分開。** 成員為 `memberId + roleId + paneId`；增加 pane 不是另一套模型偏好。
- 證據：**A**（`team.test.mjs`、`integration.test.mjs`）

### 模型與額度

**REQ-TT-010 `defaultModel` 的使用限制。** 只有**已定義且啟用**、沒有 `models` 欄位或 `models: []` 的角色才複製 `defaultModel`；未定義或已停用的角色不能藉它啟動；非空清單全部停用、耗盡或無可啟動候選時不回退 `defaultModel`；格式錯誤的條目是組態錯誤。
- 證據：**A**（`config.test.mjs`、`integration.test.mjs`）

**REQ-TT-011 條目自己的門檻與單位。** 門檻屬於條目、不共享；目前只接受 `quotaRemainingPercent`，值必須有限且不超過 100；其他單位被拒絕。
- 證據：**A**（`config.test.mjs`）

**REQ-TT-012 門檻語意。** `> 0`：已知剩餘**嚴格小於**門檻才登記待遷移（相等不觸發）；`= 0` 與 unknown：等真上限訊號；`< 0`：低餘額照常繼續，只有真上限才 `waiting-for-quota` 且不遷移。unknown（無可靠數值、過期、缺對照、越界）視為可用到真上限。
- 證據：**A**（`models.test.mjs`、`migration.test.mjs`）

**REQ-TT-013 真上限訊號的範圍。** 429 短暫限速、529、context 滿、認證、權限、網路都不是配額耗盡。金額／預算類停止只回報、不遷移；閘道的「模型被拒絕」（403）不是額度也不是登入問題，只回報。
- 證據：**A**（`models.test.mjs`、`limit.test.mjs`）

**REQ-TT-014 已知耗盡不被 unknown 清除。** 已確知耗盡的 pool 與負門檻的等待只由可靠、新鮮、在範圍內且有剩餘的觀測解除；持久化跨 tick 與重啟，`entry.quotaPool` 優先於 provider pool。
- 證據：**A**（`runtime.test.mjs`、`models.test.mjs`、`integration.test.mjs`）

**REQ-TT-015 選擇與 cursor。** 依清單順序選第一個啟用、可啟動、未耗盡的條目；負門檻條目即使已知耗盡仍被選定並等待，等待中的成員不啟動新推論；cursor 在同任務只往後；停用的 provider 不被探測。
- 證據：**A**（`models.test.mjs`、`integration.test.mjs`、`runtime.test.mjs`）

**REQ-TT-016 不啟用與組態不一致的 CLI 自動換模型。** 啟動參數只傳明確 model，不傳 `--fallback-model`。
- 證據：**A**（`integration.test.mjs`）；實際 CLI 行為 **—**（Herdr 不回報 model，啟動後 model 記為「未確認」）

### 擴充

**REQ-TT-020 擴充需使用者同意。** 組隊初期 PM 可從已啟用角色選成員；之後新增角色或為既有角色增派成員，一律提案、使用者 approve／reject／modify 後才錄入與建 pane；等待不是同意；修改後需重新確認；只套用已批准的內容。
- 證據：**A**（`team.test.mjs`）

**REQ-TT-021 批准的完整性。** 提案凍結其範圍與當時的有效組態指紋；組態在提案後被改動、或 `roleId` 已存在且用途不同時停止，不覆蓋；重試相同批准不重複增員。
- 證據：**A**（`team.test.mjs`）

**REQ-TT-022 寫回共用組態需明示。** 任務內批准只存入團隊有效組態；永久寫回需另行明示，且只新增已批准快照。
- 證據：**A**（`team.test.mjs`）

### Pane、Space、Tab

**REQ-TT-030 所有 pane 經 `grid.cjs`。** Space 依明示或呼叫端目前的 Space，明示不存在就報錯；Tab 依明示，未指定就以任務名新增（`--no-focus`）；不動使用者既有 pane；anchor 只在可證明為自己的空 shell 時關閉。
- 證據：**A**（`integration.test.mjs`）；**R**（Codex 獨立：以 `herdr tab create --no-focus` 建立 Tab 與其自帶的 anchor，**角色 pane** 才以 `grid.cjs split` 建立；關到最後一個 pane 後 Tab 消失）

**REQ-TT-031 啟動可恢復且只領養自己的 agent。** 啟動各步驟記錄；agent 名稱由 team＋member＋hash 產生（合法、唯一）；領養必須 live agent 的名稱、pane、種類都吻合本工具的啟動紀錄；等待 session 為有界且不送 prompt；失敗重跑不重複 pane 或 agent。
- 證據：**A**（`integration.test.mjs`、`launch.test.mjs`）；**R**

**REQ-TT-032 operation lease。** 同一成員的 launch／handoff 同一時間只有一個存活 owner；其他呼叫者回報進行中且不再呼叫 Herdr；死 owner 依 journal 恢復。
- 證據：**A**（`lease.test.mjs`）

### 回報與投遞

**REQ-TT-040 主動回報與事件格式。** 角色先把事件存入自己的 outbox，再由固定 notify 提交已存在的事件；輔助函式與技能範例產生的事件含 `schemaVersion`、`createdAt`、`teamId`、`memberId`、`eventId`、`type`、`summary`。**實際被校驗並拒絕的欄位**是：`teamId`、`memberId`、`eventId`（須與檔名一致且符合格式）、`type`（須為已知類型）、`summary`（非空、≤2000 字）、`paths`（若有須為字串陣列），以及 `message` 的 `to`、`checkpoint` 的單一路徑；**`schemaVersion` 與 `createdAt` 目前不被校驗**，缺少它們的事件不會因此被拒絕。notify 在讀檔前先驗證成員與事件 id，拒絕穿越與 junction。
- 證據：**A**（`entry.test.mjs`、`runtime.test.mjs`、`store.test.mjs`）

**REQ-TT-041 投遞 journal。** `queued → sending → sent → received`；`sent` 不等於 `received`；PM 非 `idle`／`done` 時不送；送前記錄真實目標；逾時或未分類錯誤為 `uncertain`，不盲目重送，只有 PM 決定 resend／drop；並行 tick 不重複送出。
- 證據：**A**（`integration.test.mjs`、`runtime.test.mjs`）

**REQ-TT-042 期限。** 計時只在 journal 記錄「已送出」之後開始。`ack` 期限從**送出**起算；`progress` 期限從 **`ack`** 起算，之後從**上一次 `progress`／`milestone`** 起算（尚未 `ack` 時只看 `ack` 與 `hardNoReport`）；`hardNoReport` 從送出起算，之後從上一次**實質回報**（`progress`、`checkpoint`、`milestone`、`blocked`、`decision-needed`、`completed`、`handoff`、`waiting-for-quota`）起算，或到 PM 明確延長為止。heartbeat 與用量更新不重設 hard 期限；`completed` 不是驗收通過。
- 證據：**A**（`team.test.mjs`、`integration.test.mjs`）

**REQ-TT-043 診斷與通知。** 逾期做一次有界診斷；成員為本工具所啟動且 Herdr 確知 blocked 時**立即**診斷（不等 hard、不需派工）；診斷、自動交接受阻、預算停止、模型被拒絕都以通知進同一 journal 排給 logical PM，以成因去重，PM 忙時排隊；PM 無法接收時只列為受阻，不宣稱已回報；不替使用者答權限、不改模型。
- 證據：**A**（`notice.test.mjs`、`integration.test.mjs`）

**REQ-TT-044 事件可重放。** 事件以 journal 套用一次；單一壞事件不阻擋其餘；沒有 `taskId` 的 `completed` 不更新派工。
- 證據：**A**（`integration.test.mjs`）

### 權限與命令列

**REQ-TT-050 最小回報權限。** Claude 角色的 `--settings` 只增補 `Edit(//…/outbox/<member>/**)`（路徑規則只認 `Edit`／`Read`）與固定 notify 的 Bash 規則（只有 event id 為萬用字元）；不使用 bypass、不全面允許 Bash 或 `herdr *`；deny／ask 優先。命令列與規則由同一個格式化函式產生，支援含空格的路徑。
- 證據：**A**（`permissions.test.mjs`、`commandline.test.mjs`，含 Git Bash 與 PowerShell 往返）；**R**（見最後一節）

**REQ-TT-051 子程序只用 argv。** 不經 shell、有逾時、Windows 隱藏視窗；npm shim 只讀取文字、目標限 shim 目錄內，不執行。
- 證據：**A**（`proc.test.mjs`）

**REQ-TT-052 `check-transport` 不是權限驗證。** 只檢查本機 outbox 可寫與 notify 存在，輸出 `claudePermissionVerified: false`。
- 證據：**A**（`runtime.test.mjs`）

### 交接與 watcher

**REQ-TT-060 交接。** 需要 checkpoint；先預留接手 pane（經 `grid.cjs`）、在真實安全邊界重新觀測、驗證舊 pane 已停止後才轉權；轉權、階段與接手者在同一次狀態交易；PM 與寫入權一併轉移；沒有下一個條目時不關唯一的 PM；負門檻不遷移；`cancelled` 與 `successor-launched` 為終態 no-op，保留證據；崩潰各階段可重跑。
- 證據：**A**（`integration.test.mjs`、`runtime.test.mjs`、`migration.test.mjs`、`lease.test.mjs`）；**R**（隔離 fixture，見最後一節）

**REQ-TT-061 pending 的觸發。** 任何登記的待遷移（含已知值低於正門檻、不需真上限）在 watcher 的下一個安全邊界走交接；tick 先觀測用量再投遞；待遷移的成員不收新工作，進行中的回合不被打斷；沒有 checkpoint 時回報 `NO_CHECKPOINT`，不宣稱已接手。
- 證據：**A**（`migration.test.mjs`、`limit.test.mjs`）

**REQ-TT-062 真上限識別不靠 PM 回應。** watcher 只讀成員 pane 末端的 provider 錯誤畫面，且該 pane 必須仍是本工具啟動的 session 與 agent 種類；工作內容、程式碼、引用的例句不算；無法證明來源的畫面為 unknown，不關 pane、不換模型。
- 證據：**A**（`limit.test.mjs`）

**REQ-TT-063 唯一的 watcher。** `start` 預設確保一個隱藏的背景 watcher；owner 以短鎖與 nonce 登記，兩個程序競爭只有一個成為 owner；停止為 graceful，不終止不明 PID。
- 證據：**A**（`entry.test.mjs`、`runtime.test.mjs`）

### 技能安裝

**REQ-TT-070 三入口共用一份正本、本機安裝。** `tooling/skills/task-team/SKILL.md` 是唯一正本；`install.mjs` 產生 Codex（`.agents/skills/task-team/SKILL.md`）、Claude（`.claude/skills/task-team/SKILL.md`）與 Gemini（`.gemini/commands/task-team.toml`）三個入口與 registry；入口內的 `__TEAM_ROOT__` 換成來源 checkout 的絕對路徑（執行程式留在來源，來源搬動後需重裝）；不要求目標專案有 Hub 的 `AGENTS.md`、Policy 或 Spec Kit。用 hash 記錄自己產生的內容：重裝無變更時為 unchanged；**保留使用者的本機修改**（遇到改過的入口、非本安裝器產生的同名檔、損壞或外來的 registry 即拒絕，不覆蓋）；拒絕符號連結與 junction；不覆蓋上游 Spec Kit 檔；不安全的 Gemini 內插與格式錯誤的技能在寫入前被拒絕；中途失敗只還原本次寫入的入口；兩個安裝程序並行時序列化且結果一致。
- 證據：**A**（`tooling/skills/task-team/install.test.mjs` 12 項；Codex 另以標準 TOML 解析確認 Gemini 入口、`{{args}}` 恰一個、無殘留占位符，並重裝確認 unchanged）。
- **不代表**：三個 CLI 實際發現、載入或遵循這份技能（端對端未驗證）；Gemini CLI 沒有實機。

## 實機驗證範圍與限制

實機證據由 Codex 獨立執行，存放在其 `%TEMP%`，**未提交**；以下範圍不得擴大解讀。

- **Claude 權限 smoke**（Claude Code 2.1.300，`dontAsk`，非 bypass）：allow 時原生 Write 與固定 notify 成功、事件 `queued`；明示 `Edit` deny 優先；ask 時 Bash 在 dontAsk 下被拒。**不含**送達活 PM 的 `sent`／`received`。
- **單 PM 自建 Tab 交接**：第一輪 Tab／pane／角色切換完成，但公司 proxy 對 `azure_ai/claude-sonnet-5[1m]` 回 403「Model is blocked」（原因未查明，不是額度），**不是**完整 PASS；第二輪用**隔離 fixture**（Sonnet 5.5 → Opus 5.5，門檻 50＋合成剩餘量 1，由外部程序呼叫 handoff）11 項檢查通過，接手 session 的原生日誌 model 為 `claude-opus-5-5`；**不是**真耗盡、**不含**跨 provider。
- **未驗證（—）**：三個 CLI 對技能的發現、載入與遵循；Gemini 的任何實機與用量 adapter；Codex 與 Gemini 角色的原生工具權限與沙箱；Claude 公司 Azure 的數字額度；`quotaRemainingPercent` 以外的單位；啟動後的 model 確認。

## Change Log

| Date | Change | Requirements | Summary | Archive |
|---|---|---|---|---|
| 2026-10-15 | task-team-design（流程 A，直接開發；R9a） | REQ-TT-001 – 003、010 – 016、020 – 022、030 – 032、040 – 044、050 – 052、060 – 063、070 | 首次採納：依已驗證的實作建立有效規格；證據等級逐條標示，實機範圍如實限制 | `docs/proposals/task-team-design.md` |
