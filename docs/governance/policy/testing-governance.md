---
id: POL-TEST-001
title: Testing Governance
status: active
scope: workspace
applies-to: [plan, tasks, analyze, implement]
owner: saintber
supersedes: []
---

# Testing Governance

> 目的：規範測試的**分類、對應關係與執行責任**。
> 範圍：只收錄不依賴特定技術的通用規則。測試單位的命名格式、技術專屬的遷移規則，由各專案自己的 Policy 訂定。
> 本文不定義具體的測試案例內容或驗收規格。

本文由 `projects/forge-explorer/docs/governance/policy/testing-governance.md` 中的通用部分提煉而來，沒有新增規則。

## 名詞
- **測試單位**：專案中承載測試的單位，例如 .NET 的測試專案、Node 的測試套件目錄。
- **被測目標**：實際被測試的主專案或元件。

## 規則

### R1 測試單位必須明確對應一個被測目標
測試的責任與歸屬要能追溯。

### R2 測試類型必須能從命名辨識
- 命名格式由各專案自己的 Policy 訂定。
- **不得**用測試內容或資料夾結構來隱含測試類型。

### R3 能否在 CI/CD 執行，由測試類型決定

### R4 單元測試
- 驗證被測目標中的類別、方法、元件、純邏輯。
- **不得**依賴外部環境或基礎設施：資料庫、外部 API、檔案系統、網路、Queue、Cache 等。
- **必須**可以在 CI/CD 中自動執行。
- 是主要的品質關卡之一（Gate A，見 POL-DOD-001）。

### R5 整合測試
- 驗證被測目標與資料庫、外部服務、基礎設施、真實或模擬環境資源的整合行為。
- **不強制**在 CI/CD 中自動執行。允許只在特定環境執行、作為 Gate B（人工或條件式驗證）、或由 UI 測試與人工驗測替代。
- 測試結果**必須**以下列其中一種方式記錄：測試報告、驗證紀錄（Verification Record）、該變更的 `decision.md`。

### R6 禁止事項
1. 不得把整合測試放進單元測試的測試單位。
2. 不得以資料夾（例如 `E2E/`、`Integration/`）取代測試單位層級的區分。
3. 不得因為 CI/CD 的穩定性考量而降低測試命名的清晰度。
4. 不得讓測試的可執行性依賴 pipeline 的特定設定，進而掩蓋它的本質。

### R7 例外
需要偏離本規範時（例如強制在 CI/CD 執行整合測試、或採用不同的命名）：
- 依 [README](README.md) 的「例外」程序由 owner 核准。
- 並在該變更的 `decision.md` 說明原因、範圍與期限。

## 與其他文件的關係
- 測試是否為交付完成的條件，依據 POL-DOD-001（`implementation-definition-of-done.md`）。
- 專案可以加嚴，不得放寬。
