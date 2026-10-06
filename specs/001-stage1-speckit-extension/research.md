# Research：第一階段 Spec Kit 擴充

## 已確認的事實（用本機 specify-cli v1.1.0 實測）

| 事實 | 證據 |
|---|---|
| 上游有 **extension** 機制：`extension.yml` 宣告 `provides.commands`、`hooks` | `core_pack/extensions/agent-context/extension.yml` |
| 上游有 **preset** 機制：`preset.yml` 的 `provides.templates` 可 `replaces` 或 `strategy: "wrap"` 既有指令 | `core_pack/presets/constitution-sync/preset.yml` |
| 安裝擴充：`specify extension add <name 或路徑> [--dev]`（`--dev` = 從本地目錄安裝） | `specify extension add --help` |
| 擴充的指令 `.md` 可指示代理執行 `.specify/extensions/<id>/scripts/{bash,powershell}/...` | `agent-context/commands/*.md` |
| 擴充可掛 **hook**（`after_specify`、`after_plan`、`before_constitution` 等），可選 | `agent-context/extension.yml`、skills 內的 hook 處理 |
| 擴充的**受管理檔案**由 manifest 追蹤，`specify integration status` 會回報被修改的檔案 | `.specify/integrations/*.manifest.json` |
| 腳本層的根目錄解析：往上找最近的 `.specify/`；`SPECIFY_INIT_DIR` 無效時報錯、不退回 | 已驗證（本批次稍早） |

## 設計決策

### D1：邏輯放在 Node 腳本，指令 `.md` 只負責呼叫
- 指令 `.md` 是給**代理**讀的提示，本身**無法被自動化測試**。
- adopt 的基線檢查、暫存區、失敗回復、requirement ID 檢查是**確定性邏輯**，必須能被測試。
- 所以：邏輯寫成 **Node `.mjs`**（跨平台，與 Hub 其他腳本一致），**以 `node:test` 測試**；指令 `.md` 呼叫腳本並轉述結果。
- 這**不違反** POL-SPECKIT-001 R6：腳本放在 `tooling/speckit/`，不修改 CLI 產生的檔案。

### D2：以 extension 承載新指令，以 preset 承載對既有指令的修改
| 需要 | 機制 | 為什麼 |
|---|---|---|
| 新指令 `speckit.context`、`speckit.adopt`、`speckit.archive` | **extension** | 上游沒有這些指令；extension 是「新增能力」的機制 |
| plan 含 Constitution & Policy Check | **preset**（wrap `speckit.plan`）或 template 覆寫 | 這是修改**既有**指令的行為 |
| 編號掃描 `archive/changes/` | **待驗證** | 見下方「未解問題」 |

### D3：不直接修改 CLI 產生的檔案
`.claude/skills/`、`.agents/skills/` 與 `.specify/` 內受管理的 scripts / templates **不改**。extension 與 preset 的安裝由 CLI 完成，並由 manifest 追蹤。

### D4：腳本的輸入輸出
- 所有腳本接受 `--root <dir>`（專案根目錄）與 `--json`，**不依賴 cwd**，方便在隔離副本中測試。
- **不自行 `git add` / `git commit`**（POL-SPEC-001 R7）；只讀 git 狀態（`git status --porcelain`、`git diff`）。
- 暫存區：`<root>/.specify/tmp/<change-id>/`（已在 `.gitignore`）。

## 未解問題（要在實作中驗證，不預設答案）

| # | 問題 | 驗證方式 |
|---|---|---|
| Q1 | `specify extension add --dev` 能否從 repo 內的 `tooling/speckit/extension` 安裝，並把指令同步到 **Claude 與 Codex 兩種**整合（`.claude/skills`、`.agents/skills`）？ | 在隔離副本實際安裝 |
| Q2 | 安裝後，新指令會不會被視為「受管理檔案」，升級時被覆蓋？ | `specify integration status` |
| Q3 | 編號掃描 `archive/changes/`：上游 `create-new-feature.ps1` 只掃 `specs/`。要用 extension hook（`before_specify`）檢查，還是在 `context` 中提供**編號建議**？ | 讀 `common.ps1` 與 hook 機制，在隔離副本試 |
| Q4 | preset 的 `wrap` 能否在 `speckit.plan` 後追加 Policy Check，而**不複製**整份 plan 指令？ | 讀 `constitution-sync` 的 wrap 實作與 README |
| Q5 | 上游**擴充指令的命名**是 `speckit.<ext>.<cmd>`（如 `speckit.agent-context.update`）；我們要的 `speckit.adopt` 是否允許，還是必須是 `speckit.<ext>.adopt`？ | 讀 extension 載入的規則 |

> Q1 – Q5 的答案會決定 plan。**在答案出來之前，不寫死指令名稱。**

## P0 驗證結果（2026-10-06，在隔離副本 `%TEMP%/saintber-iso` 實際執行，未碰本 repo）

| 問題 | 結果 | 證據 |
|---|---|---|
| Q5 指令命名 | 必須是 `speckit.<ext>.<cmd>`；簡寫 `speckit.adopt` 會被拒絕。改用擴充 ID `hub` | `extensions/__init__.py:72`（`EXTENSION_COMMAND_NAME_PATTERN`） |
| Q1 本地安裝 | ✅ `specify extension add --dev <目錄>` 可行；`extension list` 顯示 | 實測 |
| Q2 受管理檔案 | ✅ 擴充檔案**不**在整合 manifest 內；`specify integration status`：modified 0、missing 0；擴充有自己的 `.specify/extensions/.registry` | 實測 |
| **Q1 兩種代理** | ❌ **一次只註冊給一個代理**（`init-options.json` 的 `ai`）。預設為 claude → 只有 `.claude/skills/speckit-hub-context`；`specify integration use codex` 後重裝 → 只有 `.agents/skills/speckit-hub-context`，**Claude 的那份消失** | registry：`{"claude":[…]}` → `{"codex":[…]}`；`agents.py` 的 `_active_skills_agent` 與 `only_agent` |
| Q3 編號掃描 | **未驗證** | — |
| Q4 preset wrap | **未驗證** | — |

### 阻擋與方案 A

上游 v1.1.0 的 extension 一次只安裝給一個代理。第一階段需要兩種代理，所以：

**方案 A（採用，仍在上游機制內，不手改 CLI 產生的檔案）**：邏輯在 Node 腳本，兩個代理共用；以 `tooling/speckit/install.mjs` 依序對每個代理做 `specify integration use <agent>` + `specify extension add --dev --force`，**結束後把預設整合切回原值**，並用 `specify integration status` 驗證沒有留下被修改的受管理檔案。

- 風險：`integration use` 會寫入 `.specify/init-options.json` 與 `integration.json`（CLI 管理的狀態）；必須在腳本結束時還原並驗證。
- 升級 Spec Kit 後要重跑 `install.mjs`。

**其他選項（未採用，待使用者在想改時裁決）**：B 只裝給一個代理，另一個靠 `AGENTS.md` 指示執行腳本（與設計 §13.5「指令行為一致」有落差）；C 等待上游支援。

## P0 驗證結果（續）

### 方案 A 實作驗證（`tooling/speckit/install.mjs`，在隔離副本）
- ✅ 兩種代理都拿到三個指令：registry `{"codex":[context,adopt,archive],"claude":[context,adopt,archive]}`；`.claude/skills/speckit-hub-*` 與 `.agents/skills/speckit-hub-*` 各 3 個。
- ✅ 預設整合**還原**為原本的 `claude`。
- ✅ `specify integration status`：modified 0、missing 0。
- ✅ 已安裝的腳本可從 Hub 根目錄執行，指定 `forge-explorer` 時解析正確（workspace 模式，產出在專案的 `specs/`）。
- ✅ `specify integration upgrade claude --force` 之後，hub 擴充的指令**仍在**（擴充不是整合的受管理檔案）。

### Q4：preset `wrap` 加入 Policy Check — **不採用目前的作法**
在隔離副本以 `specify preset add --dev tooling/speckit/preset` 實測：

| 結果 | 說明 |
|---|---|
| ❌ 只套用到一個代理 | Claude 的 `speckit-plan` 有 Policy Check 段落；**Codex 的沒有**。與 extension 相同的單一代理限制 |
| ❌ **修改了 CLI 受管理的檔案** | `specify integration status`：`modified 1`，檔案是 `.claude/skills/speckit-plan/SKILL.md`。這違反 POL-SPECKIT-001 R6 與本工作包 SC-003 |
| ❌ 移除 preset 後沒有復原 | `specify preset remove` 之後檔案仍與原本不同（frontmatter 被重新序列化），status 仍是 modified 1 |
| ✅ 可用上游方式修復 | `specify integration upgrade claude --force` 後檔案與原本**逐位元組相同**，status 回到 0；hub 擴充不受影響 |

**結論**：以 preset 包裝 `speckit.plan` 會改寫 CLI 受管理的檔案，且只作用在一個代理。**不在本 repo 安裝這個 preset。** `tooling/speckit/preset/` 保留為**已驗證不可行**的紀錄。

**Policy Check 的替代作法（不需改受管理檔案）**：
- `speckit.hub.context` 已輸出 Policy 索引清單；`commands/speckit.hub.context.md` 指示代理讀取並把 active 的 Policy 視為具約束力。
- 在 plan 中加入 Policy Check 的要求**改為放在 Policy 本身**（POL-SPECKIT-001 R5 已規定），由 `analyze` 階段檢查。
- **這表示驗收「plan 產出包含 Policy Check」目前沒有自動機制保證**；列為缺口 G-PC，見 verification.md。

### Q3：編號掃描 `archive/changes/`
上游 `create-new-feature.ps1` 只掃 `specs/`（本次未改它）。`speckit.hub.context` 會輸出 `nextChange`（同時掃描 `specs/` 與 `archive/changes/`），代理在 specify 時以 `-Number <nextChange>` 傳入。上游腳本對 `-Number` 的處理是「若該前綴已存在則自動校正」，**仍只看 `specs/`**。所以**目前編號不重用的保證依賴代理照做**，列為缺口 G-NUM。
