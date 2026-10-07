# forge-explorer 有效規格索引

這裡放的是**已驗證並採納、代表「現在」行為的規格**；每個 capability 只有一份，由 forge-explorer 擁有。規則見 Hub 的 [`docs/developer-guide/speckit-workflow.md`](../../../../docs/developer-guide/speckit-workflow.md) 與 [ADR-0001 的設計快照](../../../../docs/architecture/decisions/0001-attachments/design-2026-10-adopted.md) §12。

> **本批規格是遷移時依 §15.4「補建」的，有特殊的證據等級**，請先讀「證據等級」，再讀各規格。

## Capability 索引

| capability | owner | 一句話說明 | 最後採納 | 規格 |
|---|---|---|---|---|
| `portal-home` | forge-explorer | Portal 首頁：以 RWD 卡片呈現工具，依登入狀態篩選 | `001-portal-home`（補建） | [spec.md](portal-home/spec.md) |
| `portal-authentication` | forge-explorer | 以 Microsoft Identity / OIDC 登入，並記錄使用者身分 | `001-portal-home`（補建） | [spec.md](portal-authentication/spec.md) |
| `tool-registry` | forge-explorer | 以資料庫驅動的工具註冊 | `001-portal-home`（補建） | [spec.md](tool-registry/spec.md) |

## 證據等級

每條 requirement 都標示它的證據，**不得**把低等級的證據寫成高等級：

| 等級 | 意義 |
|---|---|
| **S（靜態碼）** | 本次遷移時**閱讀程式碼**確認「程式碼在做這件事」。**不是**行為測試，不代表它在執行時正確 |
| **H（歷史手動）** | `001-portal-home` 當時的驗證紀錄**自述**手動測試通過（見 `archive/changes/001-portal-home/work/verification.md`）。本次**沒有重新執行**。該紀錄整體予以保存，**不宣告未交付**；但其中至少有一項證據品質問題（空清單情境，備註與結論不一致），已個別標示 |
| **A（自動化）** | 有自動化測試**實際驗證了該行為** |
| **—（未驗證）** | 沒有任何證據，或證據顯示**未達成** |

**目前沒有任何 requirement 達到 A 等級。** 原因：
- 唯一的單元測試 `UnitTest1.Test1` 是**空方法**。「1 個測試通過」只代表測試命令成功執行，**不能**作為 Portal 行為的證據。
- 整合測試（Playwright RWD E2E）在遷移時**沒有執行**（需要執行中的應用程式、PostgreSQL 與 `https://localhost:7289`）。

## 狀態說明

`active` 的意思是「這是遷移時依明確證據補建並採納的現況」，證據可能是 S 或 H，**不代表執行時全部已重新驗證**。沒有足夠交付證據的原提案條款列為缺口，不藉 active 標示推定已完成。

2026-10-07 的 [遷移證據核對與採納紀錄](../developer-guide/migration-evidence-review.md) 更正 FR-007 的過度推論、REQ-PH-002／PA-004 的靜態範圍，並把歷史 REQ-PH-009 從有效條款移到缺口。舊封存與既有 Change Log 紀錄保留，不新增產品功能。

## 與歷史工作包的關係

來源是 `archive/changes/001-portal-home/work/spec.md`（狀態 `Draft`）。它保持原樣；本批規格是比對**程式碼與驗證紀錄**後的結果，**不是**把候選規格整份複製成現況：有差異之處，以實際程式碼為準，並在各規格的「與原提案的差異」列出。
