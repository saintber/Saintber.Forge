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
  Gate A 通過；且若需求包含手動驗證，Gate B 亦完成；  
  並且已產出「本次變更的 Verification Record」。

- **Blocked: Manual Verification**  
  Gate A 通過，但 Gate B 尚未完成或尚未取得人工回報結果；  
  並且已產出 Verification Record（至少包含 Gate A 證據）。

- **Not Done**  
  Gate A 未通過（包含 restore/build/test 任一失敗），  
  或缺少 Verification Record。

---

## 二、本文件為「規則模板」，不得被填寫

- 本文件中的 checklist 為「規則模板」，**不得在此文件內打勾或寫 Pass/Fail**
- 每次可交付變更必須產出獨立的 Verification Record（見第七節）
- 若缺少本次變更的 Verification Record，不得宣告 Done（即使本文件看起來已符合）

---

## 三、TDD 對完成條件之影響

### 1. TDD 為預設開發模式

若 Testing Governance 中規範採用 TDD，  
則完成條件必須滿足以下要求：

- 本次變更涉及可測試邏輯時，必須存在對應 UnitTests
- 測試不得為事後補寫而未經失敗驗證
- 測試須能於 Gate A 中自動執行

---

### 2. TDD 最低驗證要求

當變更涉及以下類型時，屬於 TDD 強制範圍：

- Domain Logic
- Application Service
- Validation Rules
- FSM / Workflow Decision
- Authorization Decision Logic

最低要求：

- [ ] 存在對應測試案例
- [ ] 測試能明確驗證新增或變更之邏輯
- [ ] 測試於實作完成後全部通過

---

### 3. 不適用 TDD 之情況

以下情況可不強制要求新增 UnitTests：

- 純 UI 樣式調整
- 無邏輯行為之靜態內容
- 一次性資料修復腳本
- 純基礎設施連線設定

若屬上述情況，應於 Verification Record 中註明理由。

---

## 四、Gate A：自動驗證清單（每次變更後必跑）

### A1. 套件還原（Restore）

- [ ] `dotnet restore` 成功完成
- [ ] 不得因 NuGet / feed 阻擋而略過還原
- [ ] 若 restore 失敗，必須判定為 **Not Done**

---

### A2. 建置（Build）

- [ ] `dotnet build` 成功完成（Errors = 0）
- [ ] 專案參考完整（ProjectReference / PackageReference 不遺漏）
- [ ] 不得在未建置成功的情況下宣告完成

---

### A3. 測試（Test）

- [ ] 已執行 `dotnet test`
- [ ] 所有測試通過
- [ ] 若涉及 TDD 強制範圍，必須存在對應 UnitTests

若存在測試專案但未執行測試，不得視為 Done。

若本次變更範圍無測試專案，必須：

- 提供可重現的最小驗證方式
- 並記錄於 Verification Record

---

## 五、Gate B：人工驗證清單（需求包含時才需要）

### B1. 何時需要 Gate B

當需求包含以下任一類型時，需啟用 Gate B：

- UI/互動行為驗證（包含 RWD、瀏覽器相容性）
- 需真實外部資源或特定網段才能驗證的行為
- 需人工操作流程（登入、角色切換等）
- 需人工檢查輸出物（文件、報表、畫面呈現）

---

### B2. Gate B 的最小要求

- [ ] 提供可重現的手動驗證步驟（Step-by-step）
- [ ] 明確驗證成功條件（Expected Result）
- [ ] 記錄本次驗證結果（Pass/Fail + 補充說明）

---

## 六、Speckit 實作流程對映（必遵守）

### 1. 每次實作迭代的最小循環

Speckit 每完成一段可交付的變更後，必須執行：

1) Gate A（Restore → Build → Test）  
2) 產出本次變更的 Verification Record（見第七節）  
3) 若需求包含 Gate B，則停在 **Blocked: Manual Verification**

不得將 Gate A 延後至全部實作結束才執行。

---

### 2. 失敗即中止（Fail Fast）

- Gate A 任一項失敗即判定為 **Not Done**
- 不得以非 compiler error 作為通過理由
- 不得跳過後續檢查並宣告完成

---

### 3. 環境阻擋處理方式

若遇到 NuGet / feed 阻擋或其他環境限制：

- 必須回報錯誤摘要
- 狀態為 **Not Done**
- 必須產出 Verification Record 並註明阻擋原因

---

### 4. 手動驗證處理方式

若需求包含 Gate B：

- Gate A 通過後狀態為 **Blocked: Manual Verification**
- 必須提供手動步驟與預期結果
- 取得人工回報後更新 Verification Record 才可轉為 Done

---

## 七、Verification Record（每次可交付變更必產出）

### 1. 目的

確保 Gate A / Gate B 在**每一次可交付變更**均被重新執行與記錄。

---

### 2. 存放位置與命名

```text
docs/plan/verification/<change-id>.verify.md
````

範例：

* `2026-02-08-toolA-initial.verify.md`
* `T001-add-outerapi-health.verify.md`
* `cloud-migration-wbs-03.verify.md`

---

### 3. 必填欄位

* Change Id / Scope
* 執行環境
* Gate A 執行結果（restore/build/test）
* TDD 適用說明（若適用）
* Gate B（若需要）
* 最終狀態：Done / Blocked / Not Done

---

### 4. 參考模板

````md
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
- Build:
- Test:

## TDD Compliance (if applicable)
- New/Updated UnitTests:
- Coverage Scope:
- Notes:

## Gate B — Manual (if applicable)
- Steps:
- Expected:
- Actual:
- Result:

## Final Status
- Done / Blocked: Manual Verification / Not Done
- Notes:
````

---

## 八、不可接受的完成狀態（Anti-Patterns）

以下情況不得視為完成：

* restore 失敗但宣稱可忽略
* build 未通過但宣稱僅為設定問題
* 存在測試但未執行測試
* 涉及 TDD 強制範圍卻未新增測試
* 需要手動驗證但未提供步驟與結果
* 缺少本次變更的 Verification Record
* 跳過驗證流程直接宣告 Done
