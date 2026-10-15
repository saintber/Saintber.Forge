---
name: task-team
description: 依任務與組態啟動並協調 AI 團隊（PM 唯一對口、角色與模型由組態決定、角色主動回報、擴充需使用者同意）。用於「開團隊／加成員／派工／交接／看團隊狀態」；流程不預設任何工作流程。
---

# task-team：按任務啟動與協調 AI 團隊

這份技能是團隊協作的**唯一共通規則**。角色的職責內容來自組態檔（`roles.<roleId>`），不寫在這裡；命令由 `__TEAM_ROOT__/tooling/team/cli.mjs` 執行。使用繁體中文。

執行環境：Node 24。命令路徑來自安裝時展開的來源 root，**來源 checkout 要保留**（搬動或刪除後需從有效 checkout 重新安裝）。路徑含空格時，命令列用單引號包住該路徑；本技能與命令列產生的指令已依此處理。

## 先決條件與範圍

- 本技能**不要求** Spec Kit、Hub 的 `AGENTS.md` 或 Policy。在外部專案使用時，只依該專案自己的治理；沒有治理文件就明說「沒有適用的治理文件」，**不要**偽造憲章或複製 Hub 憲章。
- 任務不一定產生規格。流程中立：任務輸入 → 設計／規格（需要才有）→ 審閱 → 實作／驗證（需要才有）→ 成果。Spec Kit 只在使用者或任務選用時才使用，不因組隊預設。
- 提交（stage／commit／push）**需要使用者授權**：沒有授權就不做；使用者已為該任務授權的提交流程，可交給 PM 或指定角色處理，並依專案自己的提交規範。本技能不替使用者決定是否提交。
- 不改使用者既有的 Herdr pane、不改全域設定、不用 `bypassPermissions`、不用全面 Bash／`herdr *` 權限。

## 先判斷你的入口

本技能同時是「使用者要開團隊」與「已啟動成員的共通規則」的入口，先分支：

1. **啟動 prompt 有 `memberId`（你是已啟動的成員）**：你已在某個團隊內。沿用該團隊，**不要**再開新團隊、不要再執行 `start`。直接看下面「你是誰」。
2. **沒有 `memberId`（使用者的一般請求，例如「幫我開團隊做 X」）**：你是使用者的入口，不是團隊成員。
   - 先確認任務名與工作目錄；選組態檔（使用者指定的優先，沒指定就用專案內既有的團隊組態，找不到就請使用者指定，不自己捏造）。
   - 先 `auth` 與 `start … --dry-run` 讓使用者看到會用哪個 Space／Tab 與 PM，再 `start`：它只會建立並啟動**唯一的 PM**，並確保**一個**背景 watcher 在執行。
   - 開好後把 PM 的位置（Tab 與 pane 名稱）、團隊目錄與 watcher 狀態告訴使用者，之後使用者**只和 PM 對話**；你不再充當 PM，也不替 PM 派工。
   - 同一任務已有團隊（有團隊目錄且 `status` 顯示有效 PM）時，回報現況與 PM 位置，**不重複開團隊**。

## 你是誰

（已啟動成員適用）先確認自己的 `memberId` 與 `roleId`（啟動 prompt 會給）。PM 與角色的差別如下，**角色內容不能覆寫這些共通規則**：

- **PM**：團隊唯一的使用者對口。決定成員、派工、順序與流程；彙整人工裁決；驗收交付。
- **其他角色**：依自己的角色定義（目的、職責、專屬指示、成果）工作；與使用者**不直接溝通**。

## 共通規則

### 1. 使用者只和 PM 溝通
- 非 PM 的角色**不得**自己向使用者提問（含 AskUserQuestion）。需要人工裁決時送 `decision-needed` 事件給 PM，附問題、選項與影響。
- PM 彙整後向使用者提出，取得答案後回傳給正確角色。使用者沒回答不是同意；不代答 agent 權限／信任對話。
- 作者與其審閱者可在既定目標內直接質詢細節；結論、阻礙、未決項、里程碑、完成都要通知 PM。

### 2. 模型完全由組態決定
- 不得依偏好或任務難度自行改用其他模型，也不得自行修改組態的模型清單、順序或門檻。
- 角色清單為空或未設定時才用 `defaultModel`；未定義或已停用的角色不能用 `defaultModel` 啟動。
- 門檻語意（只有 `quotaRemainingPercent`）：`> 0` 在已知剩餘**嚴格小於**門檻時登記待遷移；`= 0` 與未知都等真上限訊號；`< 0` 低餘額照常繼續，**只有真上限**才進入 `waiting-for-quota`，不遷移。429 短暫限速、context 滿、認證、權限、網路錯誤都**不是**配額耗盡。
- 遷移只在安全邊界進行；回合仍在產出時只登記。處於 `waiting-for-quota` 的角色不再收到新工作，PM 也一樣（watcher 不替換 PM）。
- 要遷移必須先有可接手的檢查點檔案（見「交接」）。

### 3. 主動回報，不等輪詢
角色**先**把事件 JSON 存入自己的 outbox，**再**執行固定的 notify 命令提交。事件類型：`ack`、`progress`、`heartbeat`、`checkpoint`、`milestone`、`blocked`、`decision-needed`、`completed`、`handoff`、`waiting-for-quota`、`message`。

- 收到派工先送 `ack`（帶 `taskId`），有實質進展送 `progress`，完成送 `completed`，卡住送 `blocked`。啟動後第一個 `ack`（還沒有派工）不帶 `taskId`；**派工相關的 `ack`、`progress`、`completed` 必須帶 `taskId`**，否則不會更新該派工的期限與狀態。
- **事件檔格式**（`<團隊目錄>/outbox/<你的 memberId>/<eventId>.json`，檔名就是 eventId，建立後不再修改）。最小有效事件：

```json
{
  "schemaVersion": 1,
  "teamId": "<啟動 prompt 的團隊 ID>",
  "memberId": "<你的 memberId>",
  "eventId": "ev-<時間或亂數，6 到 80 個字元，只含英數、底線、連字號>",
  "createdAt": "<ISO 時間>",
  "type": "progress",
  "summary": "一句話說明（不可空白，最長 2000 字）",
  "taskId": "<派工 ID；派工相關事件必填>",
  "paths": ["<成果或檢查點的路徑；可省略>"]
}
```

  `teamId`、`memberId` 必須與你的身分相同，`eventId` 必須與檔名相同，否則事件會被拒絕並列為無效。`type=message` 另需 `to`（對方 memberId）；`type=checkpoint` 的 `paths` 必須剛好一個**已存在**的檔案。也可以用啟動 prompt 給的 `event` 命令代為寫檔。
- `heartbeat` 與用量更新**不**重設「沒有成果回報」的硬期限；只有實質回報才算。
- 事件寫入的實際命令與路徑由啟動 prompt 給出（已依你的 shell 與路徑引用規則產生）。不要自己拼 `herdr` 指令傳訊。
- `completed` 不是驗收通過：PM 確認成果後才能交付。
- 送出（`sent`）不等於 PM 已收到（`received`）。PM 收到後用 `ack` 命令確認；不確定是否送達（`uncertain`）的項目由 PM 決定重送或放棄，**不要**自己重送。

### 4. 擴充團隊需使用者同意
需要新角色，或為既有角色增派第二位成員，一律由 PM 提案：
1. `propose`：缺口與為何現有角色不能兼任、職責與成果、`roleId`／成員數、模型清單與逐條門檻（沒設就明示採用 `defaultModel`）、預期用量與時程影響（不知道就寫「未知」，不編造金額）、必要的目錄或權限變更。
2. PM 向使用者說明；使用者明確 approve／reject／modify。等待不是同意；修改後要對新內容重新確認。
3. `decide` 校驗批准範圍與目前組態，**只套用已批准的內容**（角色定義與成員數），之後才建 pane、啟動、等 `ack` 加入。
4. 已存在的 `roleId` 用途不同、或組態在提案後被改動：停止並回報，不覆蓋。
5. 任務內批准只存入該團隊的有效組態；要永久寫回共用組態需使用者**另外明示**，且只新增已批准的內容。
6. 啟動失敗重試只補缺的步驟，不重複增員、不超過批准數量。

組隊初期（`forming`）PM 可從**已啟用**的組態角色選成員；開始派工後（`form-done` 或第一次派工）一律走提案。PM 角色不能再新增。

### 5. Pane、Space、Tab
- 所有 pane 都經既有 `tooling/herdr/grid.cjs` 新增，不自行分割。Space 依使用者明示或目前 Space（呼叫端的 `HERDR_WORKSPACE_ID`），明示不存在就報錯，不退回其他 Space；Tab 依明示，未指定就以任務名新增（`--no-focus`）。
- 只處理本團隊自建的 pane；使用者原有的 pane 不動、不關。

### 6. 逾期與診斷
- 派工時有 `ack`／`progress`／`hardNoReport` 三種期限，從「送出」記錄起算。逾期只做**一次有界診斷**（不殺、不重啟、不改模型），分類：未接受／工作中未回報／權限 blocked／通知失敗／`waiting-for-quota`／崩潰。
- 發現 `blocked` 立即診斷，相依工作暫停；逾期不等於死亡。
- 真正長的工作由 PM 明確延長期限，或由角色送進展。

### 7. 回報權限
- 最小權限：自己 outbox 的檔案寫入規則（`Edit(...)`，絕對路徑 `//`）與固定 notify 命令；deny／ask 優先於 allow，不覆蓋。
- 回報被權限擋下時：事件仍在 outbox，**不**繞過 deny。PM 向使用者說明症狀、所需最小規則與設定位置；原 pane 的權限對話只能由使用者主動接手，不冒充可自動授權。
- outbox 寫入也被擋下就如實說「沒有保存」，不聲稱事件已存在。
- `check-transport` 只檢查本機檔案寫入與 notify 是否存在，**不是** Claude 權限驗證。

### 8. 交接（PM 與任何角色）
- 每個角色（PM 也一樣）要**定期**把可接手的檢查點存成檔案：目標、已完成、剩餘、驗證結果、未決議題；每次存好就送一個 `checkpoint` 事件，`paths` 放該檔案的路徑（事件被接受時檔案必須已存在）。建議在每個里程碑、每次重要派工或決定之後、以及長時間工作的固定間隔各存一次。
- 沒有檢查點時，交接會被拒絕並明確標記 `NO_CHECKPOINT`，**不會**宣稱已自動接手，由 PM（或使用者）處置。
- 流程：`handoff` 預留接手 pane（透過 grid）→ 驗證舊 pane 已停止（只關本團隊自建的 pane；不能證明持有就停止並回報）→ 同一次狀態交易轉移寫入權、派工與 PM → 以預留 pane 啟動接手者並帶入檢查點。每一階段都記錄，崩潰後可重跑。
- 負門檻的角色維持等待，不遷移；沒有下一個可啟動條目時保留舊 pane，不關唯一的 PM。
- **PM 自己到真上限時**不能靠 PM 手動回報：外部 watcher 在 `--scan-limits` 下只讀各成員 pane 末端的畫面（不送任何 prompt），且該 pane 必須仍是我們啟動的那個 session 與 agent 種類；只採 provider 錯誤畫面（畫面最後一段的官方記載用語），工作內容、程式碼、測試或引號中的例句都不算；有 checkpoint 就走上面的安全交接，沒有就停在 `NO_CHECKPOINT`。429、529、認證、網路與 context 滿都不是上限訊號，不會觸發換模型；金額／預算／餘額類的停止（monthly spend、team shared budget、Credit balance is too low）只標 `budgetBlocked` 並回報給 PM 與使用者，**不遷移、不開新 pane、不動用其他帳號的額度**；看不懂或無法證明來源的畫面一律 unknown，不猜，也不會自動關 pane 或換模型。

## 命令

以下用 `<cli>` 表示 `node __TEAM_ROOT__/tooling/team/cli.mjs`；團隊目錄用 `--team-dir <目錄>`。

| 目的 | 命令 |
|---|---|
| 認證前檢 | `<cli> auth --config <組態>` |
| 看啟動計畫（不建 pane） | `<cli> start --config <組態> --task <任務名> --dry-run` |
| 開團隊（建 Tab／pane，啟動 PM） | `<cli> start --config <組態> --task <任務名> [--task-file <檔>] [--cwd <目錄>] [--space <id\|名稱>] [--tab <id\|名稱>]` |
| 狀態 | `<cli> status --team-dir <目錄>` |
| 初始組隊／結束組隊 | `<cli> members --roles <R1,R2> …`；`<cli> form-done …` |
| 啟動成員（可重跑恢復） | `<cli> launch --member <memberId> …` |
| 擴充提案／決定 | `<cli> propose --file <提案.json> …`；`<cli> decide --request <id> --version <n> --decision approve\|reject --source <來源> …` |
| 派工 | `<cli> assign --member <id> --summary <文字> [--ack <秒>] [--progress <秒>] [--hard <秒>] …` |
| 角色送事件 | 依啟動 prompt 的命令（先寫 outbox，再 notify） |
| PM 確認收到事件 | `<cli> ack --events <id …> …` |
| 處置不確定是否送達 | `<cli> resolve --id <項目> --decision resend\|drop …` |
| 驗收完成成果／延長期限 | `<cli> accept --task-id <id> …`；`<cli> extend --task-id <id> --until <時間> …` |
| 觀測用量 | `<cli> usage --member <id> (--remaining <n> --reliable \| --signal <s> \| --probe) …` |
| 安全邊界交接 | `<cli> handoff --member <id> --checkpoint <檔> …` |
| watcher（`start` 已預設啟動一個；本機，不呼叫 AI） | 補啟動：`<cli> watch --team-dir <目錄> --probe-usage --scan-limits --background`；結案：`<cli> stop-watch --team-dir <目錄>` |

命令在 shell 內執行時，含空格的路徑要加單引號。

## 本機 watcher：誰啟動、何時啟動、何時停止

沒有 watcher，就沒有逾期診斷、事件投遞重試、用量觀測與 PM 失效監控。因此：

- **由開團隊的入口確保**：`start` 在 PM 啟動後預設啟動**一個**隱藏的背景 watcher，並等它確認取得唯一 owner 才回報（`--no-watch` 才跳過，跳過時要告訴使用者「目前沒有監控」）。已有存活的 watcher 就沿用，不會開第二個。
- watcher 一律開 `--probe-usage`（有適配器的 provider 做唯讀用量觀測）與 `--scan-limits`（只讀 pane 末端、以官方上限用語識別真上限，不送 prompt）；用量掃描與上限掃描都不呼叫 AI。
- **定期 checkpoint 怎麼讓 watcher 找到**：每個成員存好檢查點檔後，送 `checkpoint` 事件（`paths` 放該檔）。watcher 接收事件時驗證檔案存在，並把「最新檢查點」登記到該成員的狀態（`members.<id>.checkpoint`）；之後該成員到真上限需要接手時，watcher 就用這個檢查點。沒送過 `checkpoint` 事件，就是沒有檢查點。
- 看狀態：`status` 會顯示 watcher 是否在跑；不在跑時 `watch --background` 重新啟動（唯一 owner，不會重複）。
- **結案時停止**：任務完成並由 PM 交付後，`stop-watch` 讓 watcher 在目前週期結束後退出；不再需要的團隊不要留著背景程序。

## 觀測用量的誠實範圍

- Codex：以 `codex app-server` 的唯讀 `account/rateLimits/read` 讀取；只取模式與百分比，不讀帳號內容。取確實約束條目的視窗中剩餘最少者；對不上 model 或缺數值就是 unknown，不猜。
- Claude（公司 Azure）：沒有可靠的數字額度 adapter，缺值就是 unknown；可接受 status line 或人工 `usage` 輸入的觀測，但 context 使用量與估計 USD **不是**配額。
- Gemini：有啟動 adapter，沒有實機驗證，也沒有用量 adapter；停用或未安裝時不探測、不呼叫。
- unknown（沒有可靠數值、資料過期、缺對照、數值越界）視為可用到真上限，不為了試探配額而送額外推論。**例外**：先前已確知耗盡的額度池或負門檻的等待，**不會**被後來的 unknown 清除；只有可靠、新鮮、在範圍內且有剩餘的觀測才算恢復。

## 完成回報

回報目前團隊狀態、已做的動作與結果、等待使用者決定的事項（經 PM）、受阻原因與所需最小權限。未驗證的能力要明說，不宣稱已測。
