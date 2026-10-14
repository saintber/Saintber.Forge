# saintber-design

本 repo 開發用的探索指令，協助建立或修訂方案探索階段的**設計稿／草案**（`docs/proposals/`）。它**只處理方案探索**：讀取已有的需求分析，但不改寫，也不自動執行其他階段。工作流程正本是 [開發流程手冊](../../../docs/developer-guide/development-workflows.md)，指令邏輯正本是 [SKILL.md](SKILL.md)。不依賴 Spec Kit。

> 原暫名 `forge-design`，使用者已核准正式名稱 `saintber-design`（見 [ADR-0004 的更名註記](../../../docs/architecture/decisions/0004-exploration-conversion-tracking.md)）。歷史驗證紀錄保留當時的名稱。

## 它是什麼、不是什麼

- **是**：方案探索階段的工具。產出 `docs/proposals/` 裡的設計稿／草案（方向、候選方案、待決事項），並判斷這次該沿用主稿、另開 topic、延續既有 change 或先釐清。需求分析（topic 的 `intent.md`，選用）與方案探索可以來回確認；探索發現需求問題時回報釐清，不直接改需求。
- **不是** `speckit-plan` 的技術設計。`speckit-plan` 屬於技術設計階段，上游 v1.1.0 實際的產物是 `plan.md`、`research.md`、`data-model.md`、`quickstart.md` 與 `contracts/`，沒有名為 `design.md` 的產物。本流程中的 `proposals/<topic>/design.md` 只是探索主稿的檔名約定。
- **不會**替你執行 specify、實作、adopt、archive、stage 或 commit，也不會自動新增轉換紀錄。

## 六階段與各流程用什麼工具

流程：`需求分析 ⇄ 方案探索 → 需求規格 → 技術設計 → 實作與驗證 → 採納與封存`（ADR-0005）。可以省略文件，不省略實作依據；沒有需求分析專用的指令。

完整對照、A／B／C 的使用順序與已知限制見手冊 [§12](../../../docs/developer-guide/development-workflows.md#12-流程配套工具saintber-design-與-spec-kit-指令)。摘要：

| 階段 | `saintber-design` | Spec Kit（流程 B） | 直接開發（流程 A） |
|---|---|---|---|
| 需求分析 | 不使用（只讀取已有的 `intent.md`） | 不使用 | 選用；可寫在提案中 |
| 方案探索 | **使用** | 不使用 | 選用 |
| 需求規格 | 不使用 | `speckit-hub-context`、`speckit-specify`、`speckit-clarify` | 不用 Spec Kit；若需要規格整理，由人或 AI 依治理處理 |
| 技術設計（`plan.md`、`tasks.md`） | 不使用 | `speckit-plan`、`speckit-tasks`、`speckit-analyze` | 不用 Spec Kit；技術方案寫在設計稿 |
| 實作與驗證 | 不使用 | `speckit-implement` | 不用 Spec Kit；依設計稿實作與驗證 |
| 採納與封存 | 不使用；轉換紀錄在建立或承接 change 時依手冊 §11 記錄，不由本指令執行，收尾只更新追溯位置 | `speckit-hub-adopt`、`speckit-hub-archive`（有已知限制） | 依 POL-SPEC-001 R9a 手動採納 |

- A 可以不用 Spec Kit，不要變成強制；C 的方向稿拆成多個 A 或 B。
- Claude Code 用 `/speckit-…`，Codex 用 `$speckit-…`（連字號）。**Gemini 只保證 `saintber-design` 的 TOML 入口已安裝**；本 repo 的 Spec Kit 整合目前只有 Claude 與 Codex，不要假設 Gemini 能執行 `speckit-*`。

## 安裝

在所屬 worktree 的 Hub 根目錄執行：

```powershell
node tooling/skills/saintber-design/install.mjs --project-dir .
node tooling/skills/saintber-design/install.mjs --project-dir projects/forge-explorer
```

目標必須已有 `AGENTS.md` 和 `docs/governance/policy/README.md`。安裝器只產生以下入口與 `.agents/skills/saintber-design/installation.json` 的受管檔 hash，不初始化 Spec Kit，不寫代理全域設定：

| 代理 | 呼叫 | 專案內的入口 |
|---|---|---|
| Codex | `$saintber-design` | `.agents/skills/saintber-design/SKILL.md` |
| Claude Code | `/saintber-design` | `.claude/skills/saintber-design/SKILL.md` |
| Gemini CLI | `/saintber-design` | `.gemini/commands/saintber-design.toml` |

Claude、Codex 的內容和正本相同；Gemini 的 prompt 由同一份內容產生，參數只作文字輸入，不做 shell 或檔案注入。代理若還沒發現新指令，依各自的技能／命令重新載入機制處理；Gemini CLI 可用 `/commands reload`。

只改 `SKILL.md` 正本，再重跑安裝器。重複安裝相同來源不改檔；代理側入口被本地修改或同名入口不是本安裝器管理時，整次更新會在寫入前拒絕，請先比對來源，不提供強制覆蓋選項。不要修改 `speckit-*`。

安裝器沒有跨程序鎖或多檔原子交易；中途失敗可能留下部分已更新入口，修正阻礙後可重跑。安裝成功不表示三個代理都已做實際互動驗收。

## 使用

```text
Codex：$saintber-design project=hub topic=task-team 探索依任務啟動 AI 團隊
Claude：/saintber-design project=forge-explorer topic=portal-search 探索搜尋功能
Gemini：/saintber-design project=hub kind=direction topic=ai-queue owner=saintber 探索尚未成立工具的方向
```

參數是給代理理解的自然語言；`kind=topic`（預設）表示一般探索稿，`kind=direction` 表示工具方向，兩者都不是正式 change。可用 `from=<來源主稿>` 指出延伸關係。

代理先讀狀態、轉換紀錄與實際承接文件，再回報 `reuse`、`new`、`continue-change` 或 `needs-clarification`。只有前兩者會建立或修訂可變的探索內容；後兩者回報既有 change 或釐清問題，不改寫歷史。

一個 topic 一份主稿；未結案在同稿修訂，已轉換部分由 change 承接，後續新範圍另開 topic／change。未知 project 不退回 Hub。舊稿紀錄缺漏不是從未轉換的證明。真正轉換時才追加來源 commit、日期、範圍、change 與位置；建立草稿不自動轉換、實作或提交。

這是由 AI 讀檔判斷的技能，不是主稿狀態的機械鎖。使用者內容與治理矛盾、轉換證據不足時，代理應先釐清。

## 驗證

```powershell
node --test tooling/skills/saintber-design/install.test.mjs
```

測試在系統暫存專案驗證三入口的一致性、重複安裝、升級、本地修改保留、非法目標、受管檔限制與 symlink／junction 邊界。來源技能另須驗證 frontmatter 和實際判斷情境。TOML 可用 Python 標準函式庫 `tomllib` 檢查。

入口格式依官方文件：[Codex skills](https://developers.openai.com/codex/skills)、[Claude skills](https://code.claude.com/docs/en/skills)、[Gemini CLI custom commands](https://geminicli.com/docs/cli/custom-commands/)。
