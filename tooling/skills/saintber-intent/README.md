# saintber-intent

本 repo 開發用的需求分析指令，協助建立或修訂**早期需求分析稿**（`docs/proposals/`），並判斷這次該沿用主稿、另開 topic、延續既有 change 或先釐清。指令邏輯正本是 [SKILL.md](SKILL.md)；管理規則的詳細說明見 [Intent 管理](../../../docs/developer-guide/intent-workflow.md)，流程用詞見 [開發流程手冊](../../../docs/developer-guide/development-workflows.md)。本文只說明安裝與使用，不複製規則全文。

不依賴 Spec Kit，不需要 `.specify/`。與 [`saintber-design`](../saintber-design/README.md) 各有獨立的安裝器，可以分別安裝。

## 它是什麼、不是什麼

- **是**：需求分析階段的工具。整理問題、情境、目的、期待結果、範圍與非目標、已確立的限制、驗收方向與未決事項，維護「需求修訂記錄」與來源關係。需求分析與方案探索可以來回確認。
- **不是** `saintber-design`：方案探索（設計稿、候選方案）由它處理；`saintber-intent` 讀取設計稿但不改寫，只改需求分析內容。合併稿則只修改需求部分。
- **不是** `speckit-specify`：正式行為規格與候選 spec 不在這裡。它不改 `spec.md`、`plan.md`、`tasks.md`、程式或有效規格。
- **不會**初始化 Spec Kit，也不會替你執行承接、adopt、archive、stage、commit 或 push。

## 在六階段與 A／B／C 的位置

流程：`需求分析 ⇄ 方案探索 → 需求規格 → 技術設計 → 實作與驗證 → 採納與封存`。

| 階段 | `saintber-intent` | `saintber-design` |
|---|---|---|
| 需求分析 | **使用** | 只讀取，不改寫 |
| 方案探索 | 只讀取設計稿，不改寫 | **使用** |
| 其後各階段 | 不使用（`speckit-*` 或直接開發） | 不使用 |

三種流程（A 直接開發、B Spec Kit 單次功能、C 完整 Tool 方向）的開頭都可以選用它；它不是任何流程的必經步驟。完整的工具對照見 [開發流程 §12](../../../docs/developer-guide/development-workflows.md#12-流程配套工具saintber-design-與-spec-kit-指令)。

## 安裝

在所屬 worktree 的 Hub 根目錄執行：

```powershell
node tooling/skills/saintber-intent/install.mjs --project-dir .
node tooling/skills/saintber-intent/install.mjs --project-dir projects/forge-explorer
```

目標必須已有 `AGENTS.md` 和 `docs/governance/policy/README.md`；沒有 Spec Kit 依賴。安裝器只產生以下入口與 `.agents/skills/saintber-intent/installation.json` 的受管檔 hash，不寫代理全域設定：

| 代理 | 呼叫 | 專案內的入口 |
|---|---|---|
| Codex | `$saintber-intent` | `.agents/skills/saintber-intent/SKILL.md` |
| Claude Code | `/saintber-intent` | `.claude/skills/saintber-intent/SKILL.md` |
| Gemini CLI | `/saintber-intent` | `.gemini/commands/saintber-intent.toml` |

三個入口共用同一份 `SKILL.md` 正本：Claude、Codex 的內容與正本相同；Gemini 的 prompt 由同一份內容產生，參數只作文字輸入，不做 shell 或檔案注入。代理若還沒發現新指令，依各自的技能／命令重新載入機制處理；Gemini CLI 可用 `/commands reload`。

只改 `SKILL.md` 正本再重跑安裝器，不要手改產生的入口。

**安裝器的保護與限制**

- 重複安裝相同來源不改檔（冪等）；來源更新時，只更新受管且未被修改的入口。
- 受管內容雜湊統一以 LF 換行計算；Git checkout 的 CRLF／LF 轉換不誤判為內容修改，其他本地修改仍拒絕覆蓋。
- 任何入口被本地修改、或同名入口不是本安裝器管理時，整次更新會在寫入前拒絕，不提供強制覆蓋選項，請先比對來源。
- 檔案邊界：只寫上表三個入口與 `installation.json`；拒絕 symlink／junction 路徑與非預期的檔案類型。
- 沒有跨程序鎖，也沒有多檔原子交易；中途失敗可能留下部分已更新的入口，排除阻礙後重跑即可。

## 使用

```text
Codex：$saintber-intent project=hub topic=task-team 整理依任務啟動 AI 團隊的需求
Claude：/saintber-intent project=forge-explorer topic=portal-search 修訂搜尋功能的範圍
Gemini：/saintber-intent project=hub topic=ai-queue 整理 AI 佇列的問題、目標與範圍
```

參數是給代理理解的自然語言（`project=`、`topic=`、`from=`、`owner=`），不是 shell 片段；也可以只用口語描述。

代理先讀主稿、轉換紀錄與實際承接文件，再回報四種結果之一：

| 結果 | 意思 |
|---|---|
| `reuse` | 同問題、未結案、未被承接：同稿修訂；既有 topic 只有 design 時，在同 topic 新建 intent 也屬沿用 |
| `new` | 新的獨立問題，或已結案後的新需求：另開 topic 並連回來源 |
| `continue-change` | 範圍已被仍活動的 change 承接：回報工作包位置，不改早期稿、不另開重複 topic |
| `needs-clarification` | 專案、範圍或承接證據不明或矛盾：回報已查證資料與待決問題，停止相依寫入 |

使用上的幾個重點：

- **同稿迭代**：未結案時同一份主稿修訂，不建 v1／v2 副本；只有問題、目標、範圍、限制、驗收方向的實質改變才追加修訂記錄，必須有真實依據，沒有就寫 `pending（原因）`。部分承接只凍結被承接的範圍；來源矛盾不合併成已確認需求。
- **一個 topic 同角色唯一**，不是整個 repo 一份。
- **既有活動 change**：已有正式 Intent 且你要求修訂時，可依版本規則修訂；沒有正式 Intent 時只回報位置（`continue-change`），不建立正式輸入、不改 spec／plan／tasks／程式。修訂後會列出受影響的下游文件，但不代為更新。
- **來源 metadata**：只有你明確要求，且承接已真實發生、證據核對無誤時，才補轉換紀錄或來源對照。
- **快照**：全文快照只是建議，不會自動保存。

## 判斷的性質

這是由 AI 讀檔判斷的技能，不是機械狀態鎖。現行範圍邊界、舊格式的辨識，都由代理讀文件核對，沒有機器解析器，也沒有鎖；證據不足時代理應先釐清。

ADR-0006 與 POL-DOC-001 P1 目前仍是 Proposed；技能已依使用者要求實作並可使用，但這不代表其中的 workspace 規則已被採納為強制 Policy。

## 驗證

```powershell
node --test tooling/skills/saintber-intent/install.test.mjs
```

14 項測試在系統暫存專案驗證三入口一致、重複安裝、升級、本地修改保留、CRLF checkout 後升級、非法目標、受管檔限制、symlink／junction 邊界與兩技能獨立共存。Claude 的隔離行為驗證與 Codex 客觀比對見 [交付紀錄](../../../docs/proposals/saintber-intent-delivery/verification.md)，涵蓋同 topic、修訂、活動 change、部分承接與正式邊界／舊格式；不把部署測試當成所有行為皆已驗證。沒有獨立 Codex／Gemini CLI 端到端驗收；Gemini 只做 TOML 與內容驗證。這與 Spec Kit 是否支援 Gemini 無關。

入口格式參考：[Claude skills](https://code.claude.com/docs/en/skills)、[Gemini CLI custom commands](https://geminicli.com/docs/cli/custom-commands/)。
