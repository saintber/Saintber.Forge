# Testing Governance

本文件定義 Saintber.Forge 專案中之測試治理原則，  
用以規範測試類型、測試專案與其「被測目標專案」之對應關係、命名方式、Test-Driven Development（TDD）原則，以及在 CI/CD 中的執行責任。

本文件屬於 **Policy 級文件**，  
所有 Forge 專案與子項目皆須遵循，除非在特定 Intent 下另有 **Intent 專屬 Decision 文件** 明確說明例外。

---

## 一、測試治理核心原則

1. **測試專案必須明確對應一個被測目標專案**
2. **測試類型必須透過專案命名即可辨識**
3. **是否可於 CI/CD 執行，必須由測試專案類型決定**
4. **不得以測試內容或資料夾結構隱含測試類型**
5. **預設採用 Test-Driven Development（TDD）作為開發模式**

---

## 二、Test-Driven Development（TDD）原則

### 1. 基本規範

Saintber.Forge 專案預設採用 **Test-Driven Development（TDD）** 作為主要開發模式。

除非於特定 Intent 中提供 Decision 文件明確說明例外，  
所有功能開發應遵循以下順序：

```

Spec → Test → Code → Refactor

```

不得將「完成實作後補寫測試」作為常態流程。

---

### 2. TDD 三階段循環（Red → Green → Refactor）

所有適用 TDD 之開發項目應遵循以下循環：

1. **Red**
   - 先撰寫測試案例
   - 測試必須失敗
   - 測試失敗原因須對應尚未實作之功能

2. **Green**
   - 撰寫最小可行實作，使測試通過
   - 不得於此階段進行非必要優化

3. **Refactor**
   - 在所有測試通過狀態下進行重構
   - 不得改變測試語意
   - 重構後所有測試仍須通過

---

### 3. 適用範圍

TDD 原則適用於：

- Domain Logic
- Application Service
- 純邏輯元件
- 驗證規則（Validation Rules）
- 授權決策邏輯（Authorization Logic）
- FSM / Workflow 決策邏輯

不強制適用於：

- 純 UI 樣式調整
- 一次性資料修復腳本
- 無邏輯行為之樣板程式碼
- 單純基礎設施連線設定

---

### 4. TDD 與測試類型之關係

- TDD 原則主要適用於 **UnitTests**
- IntegrationTests 不強制採用 Red → Green 模式
- IntegrationTests 用於驗證整合行為，而非驅動邏輯開發

---

### 5. 與 CI/CD 之關聯

- 所有依 TDD 撰寫之 UnitTests 必須可於 CI/CD Pipeline 自動執行
- 若 UnitTests 未通過，不得合併至主分支
- UnitTests 為品質 Gate A 之一

---

### 6. TDD 禁止事項

1. 不得先完成核心邏輯實作後再撰寫測試
2. 不得僅撰寫 Happy Path 測試
3. 不得以 IntegrationTests 取代應屬於 UnitTests 的邏輯驗證
4. 不得為使測試通過而改變測試語意掩蓋缺陷

---

### 7. 例外處理

若因技術限制或遺留系統因素無法採用 TDD，  
必須於對應 Intent 目錄中提供 Decision 文件，說明：

- 無法採用 TDD 之原因
- 影響範圍
- 風險評估
- 補救措施
- 預計恢復 TDD 之時間點

---

## 三、被測目標專案（Target Project）

本治理文件中所稱之「被測目標專案」，  
指的是實際被測試的 Forge 主專案，例如：

- `Saintber.Forge.BlazorServer`
- `Saintber.Forge.Auth`
- `Saintber.Forge.Persistence.EF.Postgres`

測試專案之命名，**必須以其被測目標專案名稱作為前綴**，  
以確保測試責任與歸屬清楚可追溯。

---

## 四、測試類型與專案命名規範

### 1. 單元測試（Unit Tests）

#### 定義

單元測試用於驗證被測目標專案中之：

- 類別
- 方法
- 元件
- 純邏輯服務

且 **不依賴任何外部環境或基礎設施**。

#### 命名規範

```

<被測目標專案>.UnitTests

```

#### 範例

- `Saintber.Forge.BlazorServer.UnitTests`
- `Saintber.Forge.Auth.UnitTests`

#### CI/CD 規範

- **必須** 可於 CI/CD Pipeline 中自動執行
- 不得依賴：
  - 資料庫
  - 外部 API
  - 檔案系統
  - 網路、Queue、Cache 等基礎設施
- 為主要品質 Gate（Gate A）之一

---

### 2. 整合測試（Integration Tests）

#### 定義

整合測試用於驗證被測目標專案與以下項目之整合行為：

- 資料庫
- 外部服務
- 基礎設施
- 真實或模擬環境資源

#### 命名規範

```

<被測目標專案>.IntegrationTests

```

#### 範例

- `Saintber.Forge.BlazorServer.IntegrationTests`
- `Saintber.Forge.Auth.IntegrationTests`

#### CI/CD 規範

- **不強制** 於 CI/CD Pipeline 中自動執行
- 允許：
  - 僅於特定環境執行
  - 作為 Gate B（手動或條件式驗證）
  - 由 UI Tests 或人工驗測替代
- 測試結果必須以以下方式之一被記錄：
  - 測試報告
  - 驗測紀錄（Verification Record）
  - 對應 Intent 專屬 Decision 文件

---

## 五、命名遷移與修正原則

若既有文件、工具或產生器使用以下命名：

```

<被測目標專案>.Tests

```

則應依其實際測試性質進行明確拆分與更名：

- **可於 CI/CD 執行、無外部相依者**  
  → 遷移至  
```

<被測目標專案>.UnitTests

```

- **依賴外部環境或基礎設施者**  
→ 遷移至  
```

<被測目標專案>.IntegrationTests

```

不得再以單一 `.Tests` 專案同時承載不同測試責任。

---

## 六、禁止事項

1. 不得將 Integration Tests 放入 UnitTests 專案
2. 不得以資料夾（如 `E2E/`、`Integration/`）取代專案層級區分
3. 不得因 CI/CD 穩定性考量而降低測試命名清晰度
4. 不得讓測試專案的可執行性依賴 Pipeline 特定設定掩蓋其本質

---

## 七、例外與變更管理

若特定 Intent 需要偏離本治理規範，  
必須在該 Intent 目錄下提供明確之 **Decision 文件** 說明原因、範圍與期限。

Decision 文件位置與命名：

```

docs/intent/<intent-id>-<intent-name>/
├─ intent.md
└─ decision.md

```

---

## 八、與其他治理文件之關係

- 本文件為 **Testing Policy**
- 測試是否為交付完成條件，依據：
  - `implementation-definition-of-done.md`
- 本文件規範測試命名、分類、TDD 原則與執行責任，不定義具體測試案例內容或驗收規格。
