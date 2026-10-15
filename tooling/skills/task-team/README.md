# task-team

本 repo 的開發輔助技能：按任務啟動並協調一組 AI 角色（PM 唯一對口、角色與模型由組態決定、角色主動回報、擴充需使用者同意）。共通規則只有一份，在 [`SKILL.md`](SKILL.md)；執行程式在 [`tooling/team/`](../../team/README.md)。設計依據見 [`task-team-design.md`](../../../docs/proposals/task-team-design.md)。

不依賴 Spec Kit，不要求目標專案有 Hub 的 `AGENTS.md` 或 Policy，也不在目標專案偽造治理文件。

## 安裝（每個 checkout／worktree 各做一次）

```powershell
node tooling/skills/task-team/install.mjs --project-dir <要使用團隊的專案目錄>
```

安裝器只產生三個入口與 registry：

| 代理 | 呼叫 | 入口 |
|---|---|---|
| Codex | `$task-team` | `.agents/skills/task-team/SKILL.md` |
| Claude Code | `/task-team` | `.claude/skills/task-team/SKILL.md` |
| Gemini CLI | `/task-team` | `.gemini/commands/task-team.toml` |
| （registry） | | `.agents/skills/task-team/installation.json` |

- 入口內的 `__TEAM_ROOT__` 會被換成**本 checkout 的絕對路徑**，所以入口是**本機產物**：
  - 本 repo 的 `.gitignore` 已忽略這三個入口，不提交；每個新 checkout 或 worktree 要先執行上面的安裝。
  - 不要把它們當成跨機器、跨 checkout 的正本；正本只有 `SKILL.md` 與安裝器。
  - **來源 checkout 要保留**：執行程式留在來源 checkout，不複製到目標專案。來源被搬動或刪除後，要從有效的 checkout 重新安裝，否則入口指向不存在的路徑。
- 在**外部專案**安裝時，安裝器不會改該專案的 `.gitignore`；請自行決定是否忽略這些本機產物，並知道它們含本機絕對路徑。
- 安裝器用 hash 記錄自己產生的內容：遇到使用者改過的入口（LOCAL_CHANGES）、不是它產生的同名檔、符號連結或 junction 會拒絕，不覆蓋。
- 不手改入口，也不改任何 `speckit-*` 技能；要更新就改 `SKILL.md` 後重新安裝。

## 使用

- **使用者入口**（沒有 `memberId`）：說明要做的任務與要用的組態；技能會先做 `auth` 與 `start --dry-run`，再 `start`。`start` 只啟動**唯一的 PM**，並預設確保一個背景 watcher。之後你只和 PM 對話。
- **已啟動的成員**（有 `memberId`）：沿用團隊，依 `SKILL.md` 的共通規則與角色定義工作，不再開團隊。
- 沒有團隊組態時，請先複製 [`tooling/team/config/team.example.json`](../../team/config/team.example.json) 改成自己的組態；示例中的模型、門檻與角色內容都只是可編輯的初始值。

命令一覽與每個命令的選項見 [`tooling/team/README.md`](../../team/README.md)。

## 路徑含空格

命令列用單引號包住含空格的路徑；技能與 `tooling/team` 產生給角色的命令、以及 Claude 的 Bash 權限規則，都由同一個格式化函式產生，不會出現規則與命令不一致。Node 本身仍以 argv 陣列啟動程序，不經 shell。

## 已驗證與未驗證

| 項目 | 狀態 |
|---|---|
| 安裝器：三入口、hash、拒絕本機修改／junction、並行安裝、中途失敗還原 | 有自動測試（`node --test tooling/skills/task-team/install.test.mjs`） |
| Gemini TOML 可被標準 TOML 解析，`{{args}}` 只出現一次 | 已解析驗證；**未在真 Gemini CLI 執行** |
| 入口被 Codex／Claude／Gemini **發現、載入並遵循** | **端對端未做**：安裝成功與入口檔存在，不能證明各 CLI 發現、載入或遵循這份技能。下面的真 Claude smoke 是**直接以 CLI 工具權限與交接程式**做的，**不是**完整的 skill 驗收 |
| Claude 最小回報權限（Write＋固定 notify、deny／ask 優先） | 一次真 CLI smoke（Codex 獨立執行）；**範圍僅到 `queued`，不含送達活 PM 的 `sent`／`received`**。單 PM 交接的實機範圍與限制見 [`tooling/team/README.md`](../../team/README.md)，**不等於完整團隊驗收** |

要看團隊相關的驗證範圍與限制，見 [`task-team-design.md`](../../../docs/proposals/task-team-design.md) 的驗證紀錄。
