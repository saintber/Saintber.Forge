# Implementation Plan：第一階段 Spec Kit 擴充

**Spec**: [spec.md](spec.md) | **Research**: [research.md](research.md) | **Status**: pending（active；2026-10-07 起以遷移完成為收尾範圍，P5 與 G-NUM 留待後續）
**Branch**: 沿用目前分支（**不為本工作包切換分支**；POL-SPECKIT-001 R8）

## Summary

以上游 Spec Kit v1.1.0 的 **extension** 機制新增三個指令（context、adopt、archive）與測試，邏輯放在 Node 腳本，指令 `.md` 負責呼叫。原先的 preset Policy Check 試驗不可直接採用，沒有在本 repo 啟用；G-PC／G-NUM 保留未完成，完整擴充不阻擋本次遷移，不排第二階段。

## Technical Context

- **Language**：Node.js `.mjs`（Hub 的 Node 基線是 24；POL-TECH 尚未撰寫，這裡只依 ADR 決策 8）
- **Dependencies**：**無第三方套件**（只用 Node 內建模組：`node:fs`、`node:path`、`node:child_process`、`node:test`、`node:assert`）。理由：這是 Hub 的開發腳本，且避免新增 `package.json` 與 lockfile。**這是本工作包的選擇，不是通則**
- **Testing**：`node --test`；測試在**隔離的暫存 git repo** 中執行，不碰本 repo
- **Target**：Windows 與 Linux（使用 `node:path`、不寫死分隔符號）
- **Constraints**：不 `git add` / `git commit`；不修改 CLI 產生的檔案

## Constitution & Policy Check

| 檢核 | 結果 |
|---|---|
| 憲章 I – III（自主、可遷出、公開契約） | ✅ 擴充是 Hub 開發工具，不引入對工具內部的依賴 |
| 憲章 IV（規格唯一） | ✅ adopt 以 requirement ID 檢查重複與重用 |
| 憲章 V（Policy 約束力） | ✅ 見下方各條 |
| 憲章 VI（設計先於實作） | ⚠️ **一處命名偏離，已列為「偏離紀錄」** |
| 憲章 VII（誠實的狀態） | ✅ 指令未驗收前不標「已存在」 |
| POL-SPEC-001 R5 – R9 | ✅ 這個工作包就是它們的實作 |
| POL-SPECKIT-001 R6（不改 CLI 產生的檔案） | ✅ 用 extension / preset，並以 `specify integration status` 驗證 |
| POL-SPECKIT-001 R9（不得把未存在的指令當存在） | ✅ `speckit-workflow.md` 在驗收通過前維持「尚未實作」 |
| POL-DOD-001 R6a | ✅ 完成時檢查文件是否失效 |

### 偏離紀錄（憲章原則 VI）

| 設計的說法 | 事實 | 處理 |
|---|---|---|
| §13.4：新增指令 `speckit.context`、`speckit.adopt`、`speckit.archive` | 上游 extension 指令名必須符合 `^speckit\.<ext>.<cmd>$`（`extensions/__init__.py:72`），上述簡寫會被載入器拒絕 | 擴充 ID 取 `hub`，指令為 `speckit.hub.context`、`speckit.hub.adopt`、`speckit.hub.archive`。**這只是命名細節**：設計只說「新增三個指令」，沒有規定完整名稱，**不改架構、不改任何已核准的決策**，因此不需新 ADR；在 ADR-0001 的「實現與進度」補記即可 |
| `docs/developer-guide/speckit-workflow.md` 與 Policy 寫 `/speckit-xxx` | Codex 的呼叫方式是 `$speckit-xxx`（`_invocation_style.py` 的 `DOLLAR_SKILLS_AGENTS`） | 文件改為「Claude Code：`/speckit-xxx`；Codex：`$speckit-xxx`」。這是**事實更正** |

## 結構

```text
tooling/speckit/
├─ UPSTREAM_VERSION
├─ README.md
└─ extension/                      # 擴充 ID: hub
   ├─ extension.yml
   ├─ commands/
   │  ├─ speckit.hub.context.md
   │  ├─ speckit.hub.adopt.md
   │  └─ speckit.hub.archive.md
   ├─ scripts/
   │  ├─ lib/                        # 共用：專案解析、git 狀態、markdown fence、requirement 與 Delta、路徑／ID 安全、索引更新
   │  ├─ context.mjs
   │  ├─ adopt.mjs
   │  └─ archive.mjs
   └─ tests/
      ├─ helpers.mjs                 # 暫存 git repo 與工作包建構
      ├─ run-all.mjs                 # unit | integration | all；檢查命名，單元測試不得碰檔案系統
      ├─ requirements.unit.test.mjs
      ├─ context.integration.test.mjs
      ├─ adopt.integration.test.mjs
      ├─ archive.integration.test.mjs
      └─ hardening.integration.test.mjs
```

- 腳本以 `--root <dir>` 指定專案根目錄，**不依賴 cwd**。
- 以 `specify extension add --dev tooling/speckit/extension` 安裝（**待 Q1 驗證**）。

## 階段

| 階段 | 內容 | 驗證 |
|---|---|---|
| P0 | 驗證 Q1 – Q5 | 在**隔離副本**實際安裝 |
| P1 | 共用函式庫與 `context.mjs` + 測試 | `node --test` |
| P2 | `adopt.mjs`（基線檢查、暫存區、失敗回復、ID 檢查）+ 測試 | `node --test`，涵蓋驗收 4、5、5a |
| P3 | `archive.mjs` + 測試 | `node --test` |
| P4 | extension.yml 與指令 `.md`；在隔離副本安裝 | `specify extension list`、`specify integration status` |
| P5 | plan 的 Policy Check（preset 或 template，依 Q4） | 產出的 plan 含 Policy Check |
| P6 | **代理驗收**（Claude、Codex 各自實際執行） | 見 `quickstart.md` |
| P7 | 更新文件：`speckit-workflow.md`、ADR 實現與進度、`migration-status.md` | 連結與狀態一致 |

## 風險

| 風險 | 緩解 |
|---|---|
| extension 不能同步指令到 Codex 的 `.agents/skills` | P0 先驗證；若不行，列為**阻擋**回報，不自行手改 CLI 產生的檔案 |
| 腳本的行為靠代理轉述，代理可能不照做 | 邏輯與**所有失敗關卡**在腳本內（非提示詞）；P6 以實際代理驗證 |
| 在隔離副本與本 repo 的行為不同 | 隔離副本是**本 repo 的完整複製**（含 `.specify/`、extension） |

## 2026-10-07 收尾說明

- P0 – P4、P4a（安全修正）、P6（限定的代理驗收）、P7（文件）已做；**P5（Policy Check，G-PC）與 G-NUM 的自動機制未做**，留待後續 change，不是取消。
- 這份計畫是原本的構想；採用的嚴格 Delta／Snapshot／Manifest 格式不是使用者已定案的規格（見 `tooling/speckit/README.md`）。後續開發以 Spec Kit change 重新討論詳細需求。
