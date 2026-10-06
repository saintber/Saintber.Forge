---
id: POL-SEC-001
title: Security Baseline
status: active
scope: distribution
applies-to: [plan, tasks, analyze, implement]
owner: saintber
supersedes: []
---

# Security Baseline

> 目的：定義透過 saintber 發佈與呼叫的工具，在安全上的**最低共同基線**。
> 範圍：只收錄不依賴特定技術的通用規則。技術專屬的規則（例如 API 分層、特定身份識別技術、特定前端框架的注意事項）由各專案自己的 Policy 補充。

本文由 `projects/forge-explorer/docs/governance/policy/security-baseline.md` 中的通用部分提煉而來，沒有新增規則。

## 規則的適用角色

`scope: distribution` 的 Policy 約束 Hub 與工具**雙方**，每條規則標示適用角色：

| 標示 | 意義 |
|---|---|
| `[hub]` | 只適用 Hub（saintber CLI、bootstrap） |
| `[tool]` | 只適用工具 |
| `[hub, tool]` | 雙方都適用，各自負責自己的那一側 |

## 規則

### R1 `[hub, tool]` 安全是能力，不是預設強制
- 身份識別與授權是**可啟用的能力**，並非所有功能都必須啟用。
- 是否啟用，依使用情境與風險評估決定。
- 允許存在完全公開、無授權的入口，但必須**明確標示**其「無授權」屬性。

### R2 `[hub, tool]` 不得內建信任假設
- 不得因部署位置而隱含信任呼叫端。
- 安全假設必須明確寫在設定或文件中。
- 不得以「目前只有內部使用」作為永久理由。

### R3 `[tool]` Token 的使用（工具有使用 Token 時）
- Token 只用於身份識別與授權判斷，**不得**作為業務資料或狀態的載體。
- Token **不得**承載敏感資料（例如密碼、金鑰）。
- Token 要有明確的有效期限；需要長期存取時搭配刷新機制，不得依賴永久有效的 Token 作為正常流程。

### R4 `[hub, tool]` 秘密資訊
- 金鑰、憑證、Client Secret **不得**硬編碼在程式碼中。
- 秘密資訊由設定或安全的儲存機制提供。
- **不得**把秘密資訊提交到版本控制系統。

### R5 `[hub, tool]` 例外
無法符合本基線時：
- 必須明確記錄原因。
- 必須說明風險承擔的範圍。
- 不得把例外視為預設狀態。
- 例外依 [README](README.md) 的「例外」程序由 owner 核准；記錄理由不等於核准。

## 本文件尚未涵蓋

下列項目屬於 Hub 自身的安全責任，會在 saintber CLI 的工作包中補上，**目前沒有規則**：
- bootstrap 與入口包的來源驗證、完整性檢查、寫入路徑。
- 安裝、執行時的最小權限。

## 與專案 Policy 的關係
專案可以加嚴，不得放寬。專案專屬的安全規範寫在該專案的 `docs/governance/policy/`，並在該專案的 README 標示繼承本文件。
