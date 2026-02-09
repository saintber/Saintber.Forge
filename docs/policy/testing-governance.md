# Testing Governance

本文件定義 Saintber.Forge 專案中之測試治理原則，  
用以規範測試類型、測試專案與其「被測目標專案」之對應關係、命名方式，以及在 CI/CD 中的執行責任。

本文件屬於 **Policy 級文件**，  
所有 Forge 專案與子項目皆須遵循，除非在特定 Intent 下另有 **Intent 專屬 Decision 文件** 明確說明例外。:contentReference[oaicite:0]{index=0}

---

## 一、測試治理核心原則

1. **測試專案必須明確對應一個被測目標專案**
2. **測試類型必須透過專案命名即可辨識**
3. **是否可於 CI/CD 執行，必須由測試專案類型決定**
4. **不得以測試內容或資料夾結構隱含測試類型**

---

## 二、被測目標專案（Target Project）

本治理文件中所稱之「被測目標專案」，  
指的是實際被測試的 Forge 主專案，例如：

- `Saintber.Forge.BlazorServer`
- `Saintber.Forge.Auth`
- `Saintber.Forge.Persistence.EF.Postgres`

測試專案之命名，**必須以其被測目標專案名稱作為前綴**，  
以確保測試責任與歸屬清楚可追溯。

---

## 三、測試類型與專案命名規範

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

## 四、命名遷移與修正原則

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

## 五、禁止事項

1. 不得將 Integration Tests 放入 UnitTests 專案
2. 不得以資料夾（如 `E2E/`、`Integration/`）取代專案層級區分
3. 不得因 CI/CD 穩定性考量而降低測試命名清晰度
4. 不得讓測試專案的可執行性依賴 Pipeline 特定設定掩蓋其本質

---

## 六、例外與變更管理

若特定 Intent 需要偏離本治理規範（例如：強制 CI/CD 執行整合測試、或採用不同命名），  
必須在該 Intent 目錄下提供明確之 **Decision 文件** 說明原因、範圍與期限。

Decision 文件位置與命名遵循文件指南：:contentReference[oaicite:1]{index=1}

```text
docs/intent/<intent-id>-<intent-name>/
├─ intent.md
└─ decision.md
````

---

## 七、與其他治理文件之關係

* 本文件為 **Testing Policy**
* 測試是否為交付完成條件，依據：

  * `implementation-definition-of-done.md`
* 本文件僅規範測試「命名、分類與執行責任」，不定義具體測試案例內容或驗收規格。
