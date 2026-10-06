---
capability: portal-authentication
owner: forge-explorer
status: active
last-adopted: 001-portal-home
evidence-note: 補建（遷移 hub/000-restructure）；無自動化行為測試，且未用真實 Azure AD 驗證登入，見 ../README.md 的「證據等級」
---

# Portal Authentication

Portal 以 Microsoft Identity / OpenID Connect 登入，並記錄使用者身分。

> 證據等級：**S** 靜態碼、**H** 歷史手動（本次未重跑）、**A** 自動化、**—** 未驗證或未達成。說明見 [`../README.md`](../README.md)。

## Requirements

### REQ-PA-001 使用 Microsoft Identity / OIDC 登入
使用者登入採用 Microsoft Identity / OpenID Connect。

- 證據：**S**（`Program.cs` 註冊 `AddMicrosoftIdentityWebAppAuthentication(builder.Configuration, "AzureAd")`，並加入 `AddMicrosoftIdentityUI()`、`UseAuthentication()`、`UseAuthorization()`）
- 證據：**H**（歷史紀錄自述：點擊「登入」會重導到 Microsoft 登入頁、登入後顯示歡迎訊息，皆標 PASS，並註明 Azure AD 由使用者手動設定）。**本次無法重現**：repo 的 `AzureAd` 設定是占位值（`YOUR_TENANT_ID` 等），沒有自動化證據
- 來源：原 FR-006

### REQ-PA-002 記錄使用者身分
已登入使用者進入首頁時，系統記錄其身分：`UserId`、`DisplayName`、`Email`，並更新 `LastLoginAt`。

- 證據：**S**（`Index.razor` 取得 claims 後呼叫 `UserIdentityService.UpdateLastLoginAsync`；服務在不存在時建立紀錄，存在時更新 `LastLoginAt`、`DisplayName`、`Email`）；**H**（歷史紀錄自述「資料庫寫入登入時間」PASS）
- 儲存的**只有這四個欄位**
- 來源：原 FR-012（身分部分）

### REQ-PA-003 身分資料以 PostgreSQL 為儲存來源
身分資料存放在 PostgreSQL。

- 證據：**S**（`Program.cs` 以 `UseNpgsql` 註冊 `PortalDbContext`；`UserIdentity` 對應資料表 `UserIdentities`）
- **資料庫結構的可重現性缺少證據**：repo 沒有 EF Migration 檔案，見「已知缺口」G2
- 來源：原 FR-012

### REQ-PA-004 登入狀態失效時視為未登入
登入狀態失效時，系統將使用者視為未登入，只顯示公開工具。

- 證據：**S**（首頁以 `AuthenticationState` 的 `IsAuthenticated` 決定行為，失效則走公開路徑）；**H**（歷史紀錄自述「Token 過期 → 自動降級為公開模式」PASS）
- 本次無法重現，沒有自動化證據
- 來源：原邊界條件、US2 情境 4

## 未達成：Access Token 與 ID Token 的核發與保存

原提案的 **FR-007**：「登入成功後系統 MUST 核發 Access Token 與 ID Token」。

**這一條在現況中不能宣稱已實現或已驗證，所以不列為 requirement。**

- 程式碼中**沒有任何** Token 取得、保存或使用的實作：`AccessToken`、`IdToken`、`SaveTokens`、`GetTokenAsync`、`EnableTokenAcquisition` 都沒有出現。
- `UserIdentity` 實體**只有**`UserId`、`DisplayName`、`Email`、`LastLoginAt`，**沒有 Token 欄位**。
- Token 是 Microsoft Identity 平台在登入流程中簽發的；是否被 Portal 接收、保存，取決於設定，而這個專案沒有做。因此「系統核發並保存 Token」**沒有被實現**，也沒有被驗證。

此項若仍是需求，要走新的工作包。

## 與原提案的差異

- FR-007 未達成（見上）。
- 原提案提到「登入成功後」的 Token 行為；實作只讀取 claims 並記錄身分。

## 已知缺口

| # | 缺口 | 影響的 requirement |
|---|---|---|
| G1 | 登入流程只有歷史手動驗證的**自述**（H）；本次無法重現（設定為占位值），也沒有自動化證據 | REQ-PA-001、REQ-PA-002、REQ-PA-004 |
| G2 | EF Migration 不在版本控制中；資料庫結構的可重現性缺少證據 | REQ-PA-003 |
| G3 | 沒有任何自動化行為測試 | 全部 |
| G4 | **FR-007（Token）未實現**，且歷史驗證紀錄沒有證明它 | — |

來源與詳細核對：[`archive/changes/001-portal-home/archive.md`](../../../archive/changes/001-portal-home/archive.md)。

## Change Log

| Date | Change | Requirements | Summary | Archive |
|---|---|---|---|---|
| 2026-10-06 | 001-portal-home（補建） | REQ-PA-001 – 004 | 依 §15.4 補建；FR-007 因無實作與證據，未納入 requirement，列為未達成 | `archive/changes/001-portal-home` |
