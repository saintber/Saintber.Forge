# tooling/team

task-team 的執行程式：Node 24、零外部依賴。協作規則的唯一正本是 [`tooling/skills/task-team/SKILL.md`](../skills/task-team/SKILL.md)；設計與驗收情境見 [`docs/proposals/task-team-design.md`](../../docs/proposals/task-team-design.md)。這個目錄是 **repo 開發輔助工具**，不是可安裝的產品，也不是 Spec Kit 的一部分。

## 用法

```powershell
node tooling/team/cli.mjs help
node tooling/team/cli.mjs auth  --config <組態>
node tooling/team/cli.mjs start --config <組態> --task "<任務名>" --dry-run
node tooling/team/cli.mjs start --config <組態> --task "<任務名>" [--space <id|名稱>] [--tab <id|名稱>]
```

組態請從 [`config/team.example.json`](config/team.example.json) 複製後修改。示例中的角色、模型與門檻都是可編輯的初始值，欄位名稱是草案。

## 模組（`lib/`）

| 檔案 | 責任 |
|---|---|
| `config.mjs` | 開放的角色定義、`pmRoleId`、有效模型清單（`defaultModel` 只給已定義且啟用、沒有 `models` 的角色） |
| `models.mjs` | 門檻判定（`>0` 嚴格小於、`=0` 與未知等真上限、`<0` 只在真上限等待）、條目選擇、待遷移與恢復證據 |
| `selection.mjs` | 把真實的認證前檢與用量觀測接到條目選擇；停用的 provider 不探測 |
| `providers.mjs` | 各 CLI 的啟動參數（明確 model、不啟用 CLI 自動 fallback）、認證前檢、Codex 唯讀用量 |
| `limitsignal.mjs` | 從 pane 末端的 provider 錯誤畫面識別真上限；預算類、429／529、認證、網路、context 另分類 |
| `team.mjs` | 團隊狀態：成員、擴充提案與批准、派工與期限、遷移與寫入權 |
| `controller.mjs` | Herdr 放置與啟動恢復、watcher tick、可重放事件、交接、用量套用、單一 watcher owner |
| `sender.mjs` | 投遞 journal：`queued → sending → sent → received`，`uncertain` 不盲目重送 |
| `outbox.mjs` | 角色 outbox 與事件驗證 |
| `herdr.mjs` | Herdr adapter；所有 pane 都經 [`tooling/herdr/grid.cjs`](../herdr/grid.cjs) 新增 |
| `permissions.mjs`、`commandline.mjs` | 最小回報權限（`Edit(...)`＋固定 notify）與同源的命令列引用 |
| `store.mjs`、`proc.mjs` | 原子寫入與鎖、argv／無 shell 的子程序與 npm shim 解析 |

`notify.mjs` 是給角色呼叫的固定入口：只提交自己 outbox 內**已存在**的事件，不接受任意命令文字。

## 團隊目錄

預設 `<cwd>/.team/<teamId>/`（`--team-dir` 可指定；是本機狀態，不提交）：`state.json`、`outbox/<memberId>/<eventId>.json`、`delivery.json`、`sessions/`、`watcher.json`、`log.jsonl`。寫入一律暫存檔＋rename；狀態變更在短鎖內同步完成，外呼 Herdr／CLI 不持鎖。

## 測試

```powershell
node --test "tooling/team/test/*.test.mjs"
node --test tooling/skills/task-team/install.test.mjs
```

測試以注入的假 Herdr 與假用量來源執行（不啟動 AI、不讀真實帳號額度、不需要登入）；只有 `proc.test.mjs` 解析本機 shim 的案例、`commandline.test.mjs` 的真 shell 往返（Git Bash、PowerShell；找不到就明確 skip）使用本機環境。

## 已驗證與限制

- **自動測試覆蓋**：開放角色與 `pmRoleId`、門檻語意與未知、同池與持久化的耗盡紀錄、負門檻等待、擴充批准與重試不重複、投遞 journal（含 uncertain 與並行）、期限與 heartbeat、可重放事件、交接各階段的崩潰恢復、單 PM 自建 Tab 的預留 pane、watcher 唯一 owner、pane 限額訊號與引用文字不誤判、預算類停止不遷移。
- **真 Claude 權限 smoke（Codex 獨立執行，Claude Code 2.1.300，`--permission-mode dontAsk`，非 bypass；證據在其 `%TEMP%`，未提交）**：allow 時原生 Write 與固定 notify 皆成功，事件存在且 journal 為 `queued`；明示 `Edit` deny 優先，Write 被拒、沒有事件、Bash 未執行；ask 時 Write 成功、Bash 在 dontAsk 下被拒。**範圍僅此**：驗證 Write／notify 與 deny／ask 優先與 `queued`，**不含**送達已啟動 PM 的 `sent`／`received`。
- **單 PM 自建 Tab 交接實機（Codex 獨立）**：第一輪完成 Tab／pane／角色切換，但公司 proxy 對下一條 `azure_ai/claude-sonnet-5[1m]` 回 403「Model is blocked」，所以**不是**完整接手 PASS；原因未查明（API 允許清單列有 Sonnet 5，但實際請求被 proxy 擋），這不是額度，也不自動換到個人 Codex。正式清單是否停用或修權限由組態擁有者決定。第二輪用隔離 fixture（Sonnet 5.5 → Opus 5.5，門檻 50＋合成剩餘量 1，由外部程序呼叫 handoff）11 項檢查全部通過，接手 session 的原生日誌 model 為 `claude-opus-5-5`，並實際讀到檢查點；**不是**真耗盡，**不含**跨 provider。
- **尚未由本目錄的測試證明**：Codex 與 Gemini 角色的原生工具權限與沙箱行為都沒有實機驗證（本工具沒有對它們傳 Claude 的 `--settings`）；Claude 的規則只有上面的 smoke 範圍；Gemini 沒有實機驗證，也沒有用量 adapter；Claude 公司 Azure 沒有數字額度 adapter，缺值就是 unknown。`check-transport` 只檢查本機檔案寫入與 notify 是否存在，**不是**權限驗證。
- **不提供 OS 級保護**：outbox 路徑守衛會拒絕符號連結與 junction，但這是程式內的檢查，不是作業系統隔離。
- 模型 id 只能經明確的啟動參數指定；Herdr 的 `agent` 資訊沒有 model 欄位，所以啟動後的 model 是「未確認」，不宣稱已核對。
