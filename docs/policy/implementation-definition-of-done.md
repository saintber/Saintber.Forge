# Implementation Definition of Done — Saintber.Forge

> Purpose  
> 定義 Saintber.Forge 中，一項功能、工具或變更在工程層面可被視為完成（Done）前，  
> 必須執行並通過的最低驗證清單，避免以推論取代實際驗證。

> Scope  
> 本文件屬於工程政策層（Policy），  
> 僅描述「完成的最低條件」與「驗證流程對映規則」，  
> 不定義治理裁決、不描述結構設計、不限制技術選型。

---

## 一、完成狀態定義（Status）

實作結果必須以以下狀態之一呈現：

- **Done**  
  Gate A 通過；且若需求包含手動驗證，Gate B 亦完成；並且已產出「本次變更的 Verification Record」。

- **Blocked: Manual Verification**  
  Gate A 通過，但 Gate B 尚未完成或尚未取得人工回報結果；並且已產出 Verification Record（至少包含 Gate A 證據）。

- **Not Done**  
  Gate A 未通過（包含 restore/build/test 任一失敗），或缺少 Verification Record。

---

## 二、本文件為「規則模板」，不得被填寫

- 本文件中的 checklist 為「規則模板」，**不得在此文件內打勾或寫 Pass/Fail**
- 每次可交付變更必須產出獨立的 Verification Record（見第六節）
- 若缺少本次變更的 Verification Record，不得宣告 Done（即使本文件看起來已符合）

---

## 三、Gate A：自動驗證清單（每次變更後必跑）

### A1. 套件還原（Restore）

- [ ] `dotnet restore` 成功完成
- [ ] 不得因 NuGet / feed 阻擋而略過還原
- [ ] 若 restore 失敗，必須判定為 **Not Done**，不得以「非 compiler error」結案

### A2. 建置（Build）

- [ ] `dotnet build` 成功完成（Errors = 0）
- [ ] 專案參考完整（ProjectReference / PackageReference 不遺漏）
- [ ] 不得在未建置成功的情況下宣告完成

### A3. 測試（Test）

以下任一成立即可：

- [ ] 已執行單元測試 `dotnet test` 且通過  
  或
- [ ] 已執行整合測試 `dotnet test` 且通過  
  或
- [ ] 若本次變更範圍無測試專案，必須提供「可重現的最小驗證方式」並記錄（見 Gate B 或 Verification Record）

> 若存在測試專案但未執行測試，不得視為 Done。

---

## 四、Gate B：人工驗證清單（需求包含時才需要）

### B1. 何時需要 Gate B

當需求包含以下任一類型時，需啟用 Gate B：

- UI/互動行為驗證（包含 RWD、瀏覽器相容性）
- 需真實外部資源或特定網段（內網/外網）才能驗證的行為
- 需人工操作流程（例如登入、權限切換、角色操作）
- 需人工檢查輸出物（例如文件、報表、畫面呈現）

### B2. Gate B 的最小要求

- [ ] 提供可重現的手動驗證步驟（Step-by-step）
- [ ] 明確驗證成功條件（Expected Result）
- [ ] 記錄本次驗證結果（Pass/Fail + 補充說明）

---

## 五、Speckit 實作流程對映（必遵守）

### 1. 每次實作迭代的最小循環

Speckit 每完成一段可交付的變更後，必須執行：

1) Gate A（Restore → Build → Test）  
2) 產出本次變更的 Verification Record（見第六節）  
3) 若需求包含 Gate B，則停在 **Blocked: Manual Verification**，等待人工回報

不得將 Gate A 延後到全部實作結束才執行。

---

### 2. 失敗即中止（Fail Fast）

- Gate A 任一項失敗即判定為 **Not Done**
- 不得以「不是 msbuild compiler error」作為通過或結案理由
- 不得跳過後續檢查項目並宣告完成

---

### 3. 環境阻擋的處理方式

若遇到 NuGet / feed 阻擋或其他環境限制：

- 必須明確回報阻擋原因與錯誤訊息摘要
- 狀態必須為 **Not Done**（因 Gate A 未完成）
- 必須仍產出 Verification Record，並將狀態標示為 Not Done 與阻擋原因

---

### 4. 手動驗證的處理方式

若需求包含 Gate B：

- Speckit 在 Gate A 通過後，狀態必須為 **Blocked: Manual Verification**
- 必須輸出手動驗證步驟與預期結果
- 必須等待人工回報 Pass/Fail，並更新 Verification Record，才可轉為 Done

---

## 六、Verification Record（每次可交付變更必產出）

### 1. 目的

Verification Record 用於保證 Gate A/Gate B 在**每一次可交付變更**都被重新執行與記錄，  
避免「之前做過一次」就被誤判為本次也完成。

---

### 2. 存放位置與命名

每次可交付變更需新增一份文件：

```text
docs/plan/verification/<change-id>.verify.md
```

其中 `<change-id>` 需能辨識本次變更，例如：

* `2026-02-08-toolA-initial.verify.md`
* `T001-add-outerapi-health.verify.md`
* `cloud-migration-wbs-03.verify.md`

---

### 3. 必填欄位（最小內容）

Verification Record 至少需包含：

* Change Id / Scope（本次變更範圍）
* 執行環境（local/CI、OS、SDK 版本可簡述）
* Gate A 執行結果（restore/build/test）

  * 至少提供命令與結果摘要
  * 若失敗需貼出關鍵錯誤摘要
* Gate B（若需要）

  * 手動步驟、預期結果、實際結果（Pass/Fail）
* 最終狀態：Done / Blocked / Not Done

---

### 4. 參考模板（可直接複製）

```md
# Verification Record — <change-id>

## Scope
- Summary:
- Affected Projects:

## Environment
- Runner: local/CI
- .NET SDK:
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

## Final Status
- Done / Blocked: Manual Verification / Not Done
- Notes:
```

---

## 七、不可接受的完成狀態（Anti-Patterns）

以下情況不得視為完成：

* restore 失敗但宣稱「只是 NuGet 問題」
* build 未通過但宣稱「只差引用/設定」
* 存在測試但未執行測試
* 需要手動驗證但未提供步驟與結果
* 缺少本次變更的 Verification Record
* 跳過驗證流程，直接宣告 Done

---
