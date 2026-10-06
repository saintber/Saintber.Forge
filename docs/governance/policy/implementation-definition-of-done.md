---
id: POL-DOD-001
title: Implementation Definition of Done
status: active
scope: workspace
applies-to: [tasks, implement, analyze, adopt]
owner: saintber
supersedes: []
---

# Implementation Definition of Done

> 目的：定義一項功能或變更在工程層面可被視為完成（Done）之前，必須執行並通過的最低驗證，避免以推論取代實際驗證。
> 範圍：只描述「完成的最低條件」與「驗證流程的對映規則」，不限制技術選型。具體的命令、工具與環境由各專案自己的 Policy 補充。

本文由 `projects/forge-explorer/docs/governance/policy/implementation-definition-of-done.md` 中的通用部分提煉而來。

> 與原文的唯一差異：Verification Record 的存放位置。原文指定 `docs/plan/verification/`，該目錄在遷移後不再存在，改為放在工作包內（R7）。

## 規則

### R1 完成狀態
實作結果必須以下列其中一種狀態呈現：

| 狀態 | 條件 |
|---|---|
| **Done** | Gate A 通過；若需求包含手動驗證，Gate B 也完成；並已產出本次變更的 Verification Record |
| **Blocked: Manual Verification** | Gate A 通過，但 Gate B 尚未完成或尚未取得人工回報；已產出 Verification Record（至少包含 Gate A 的證據） |
| **Not Done** | Gate A 未通過（還原、建置、測試任一失敗），或缺少 Verification Record |

### R2 本文的 checklist 是規則模板
- 本文的清單**不得**在此打勾，也不得寫 Pass / Fail。
- 每次可交付的變更都要產出**獨立**的 Verification Record（R7）。
- 缺少本次變更的 Verification Record，**不得**宣告 Done，即使本文看起來都符合。

### R3 Gate A：自動驗證（每次變更後必跑）
1. **還原相依**：成功完成，例如 `dotnet restore`、`npm ci`。不得因來源被阻擋而略過；還原失敗必須判定為 Not Done，**不得**以「不是編譯錯誤」結案。
2. **建置**：成功完成且錯誤為 0；專案參考完整，不遺漏。不得在建置未成功時宣告完成。
3. **測試**：下列任一成立：
   - 已執行單元測試並通過。
   - 已執行整合測試並通過。
   - 本次範圍沒有測試單位時，提供**可重現的最小驗證方式**並記錄。

   存在測試單位卻沒有執行測試，**不得**視為 Done。

### R4 Gate B：人工驗證（需求包含時才需要）
需求包含下列任一類型時啟用：
- UI 與互動行為（包含 RWD、瀏覽器相容性）。
- 需要真實外部資源或特定網段才能驗證的行為。
- 需要人工操作流程（例如登入、權限切換、角色操作）。
- 需要人工檢查輸出物（例如文件、報表、畫面）。

最低要求：
- 提供可重現的手動驗證步驟。
- 明確寫出驗證成功的條件（Expected Result）。
- 記錄本次驗證結果（Pass / Fail 加上補充說明）。

### R5 實作流程的對映
1. 每完成一段可交付的變更，必須依序：
   1. 執行 Gate A（還原 → 建置 → 測試）。
   2. 產出本次變更的 Verification Record。
   3. 若需求包含 Gate B，停在 **Blocked: Manual Verification**，等待人工回報。
2. 不得把 Gate A 延後到全部實作結束才執行。
3. **失敗即中止**：Gate A 任一項失敗就判定為 Not Done，不得跳過後續檢查後宣告完成。
4. **環境阻擋**：遇到來源被阻擋或其他環境限制時，必須明確回報阻擋原因與錯誤摘要，狀態為 Not Done，並且仍要產出 Verification Record（標示 Not Done 與阻擋原因）。
5. **手動驗證**：Gate A 通過後，狀態為 Blocked: Manual Verification；必須輸出手動驗證步驟與預期結果；等人工回報 Pass / Fail 並更新 Verification Record 之後，才可轉為 Done。

### R6 不得視為完成的情況
- 還原失敗，卻宣稱「只是來源的問題」。
- 建置未通過，卻宣稱「只差引用或設定」。
- 存在測試卻沒有執行。
- 需要手動驗證，卻沒有提供步驟與結果。
- 缺少本次變更的 Verification Record。
- 跳過驗證流程，直接宣告 Done。

### R6a 文件與事實相符（憲章原則 VI）
完成一項變更時，必須檢查它是否讓任何文件失效：架構文件、Policy、有效規格、使用手冊、ADR。

- 發現實作偏離了已採納的設計或文件時，依憲章原則 VI 處理：**新增 ADR** 記錄偏離與理由；正本存在就更新正本，不存在就在 ADR 寫明現況並加入「建立正本」的任務。
- 這項檢查的結果記在該變更的 Verification Record（R7）。**沒有檢查，不得宣告 Done。**
- 此條由 Hub 憲章要求；其餘規則不變。

### R7 Verification Record
**目的**：確保 Gate A、Gate B 在**每一次可交付的變更**都被重新執行與記錄，避免「之前做過一次」就被誤判為這次也完成。

**位置**：該變更的工作包內，`specs/<NNN-name>/verification.md`；封存後隨工作包移到 `archive/changes/<NNN-name>/work/verification.md`。

**必填欄位**：
- 變更 ID 與範圍。
- 執行環境（本機或 CI、作業系統、執行環境版本可簡述）。
- Gate A 的結果：還原、建置、測試，至少提供命令與結果摘要；失敗要附上關鍵錯誤。
- Gate B（需要時）：手動步驟、預期結果、實際結果（Pass / Fail）。
- 最終狀態：Done / Blocked: Manual Verification / Not Done。

**參考模板**：

```md
# Verification Record — <change-id>

## Scope
- Summary:
- Affected Projects:

## Environment
- Runner: local/CI
- Runtime / SDK:
- Notes:

## Gate A — Automated
- Restore:
  - Command:
  - Result:
- Build:
  - Command:
  - Result:
- Test:
  - Command:
  - Result:

## Gate B — Manual (if applicable)
- Steps:
- Expected:
- Actual:
- Result: Pass/Fail

## Docs Consistency (R6a)
- Documents checked:
- Deviations found (ADR ids, or "none"):

## Final Status
- Done / Blocked: Manual Verification / Not Done
- Notes:
```

### R8 例外
依 [README](README.md) 的「例外」程序由 owner 核准。

## 與專案 Policy 的關係
專案可以加嚴，不得放寬。專案專屬的命令（例如 `dotnet restore / build / test`）與環境要求，寫在該專案的 Policy。
