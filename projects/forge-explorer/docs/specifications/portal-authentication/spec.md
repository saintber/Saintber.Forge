---
capability: portal-authentication
owner: forge-explorer
status: active
last-adopted: 001-portal-home
last-evidence-review: 2026-10-07
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

### REQ-PA-004 未通過驗證時走公開工具路徑
首頁讀取的身分未通過驗證時，只顯示公開工具。

- 證據：**S**（首頁以 `AuthenticationState` 的 `IsAuthenticated` 決定行為，false 時走公開路徑）；**H**（歷史紀錄自述「Token 過期 → 自動降級為公開模式」PASS）
- 靜態碼只證明 false 的分支，不證明 Token 過期時會自動刷新該狀態；本次沒有重現過期流程，沒有自動化證據
- 來源：原邊界條件、US2 情境 4

## 證據不足：Access Token 與 ID Token 的核發

原提案的 **FR-007**：「登入成功後系統 MUST 核發 Access Token 與 ID Token」。

原提案沒有要求將 Token 保存到資料庫。**現有證據不足以判定整條 FR-007 已達成或全部未實作，因此不把它補建為已交付 requirement。**

- `Program.cs` 已註冊 Microsoft Identity Web / OIDC，框架處理協定，不必在應用程式中出現自製 Token 取得方法。字串搜尋沒有命中，不能證明框架沒有接收 Token。
- `UserIdentity` 沒有 Token 欄位，只能支持「此身分實體不保存 Token」；不能把保存擴張成原需求，或用它判斷核發未達成。
- OIDC 的 ID Token 由認證伺服器簽發，詳見 [Microsoft 官方說明](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc)。Portal 的角色、實際授權設定與 Access Token 流程沒有足夠執行證據；AzureAd 設定為占位值，本次未以真實服務驗證。

後續若要補足此功能，重新釐清需求與驗收，不自行新增 Token 持久化要求。本次只是更正補建時的證據判讀，沒有修改程式。

## 與原提案的差異

- FR-007 證據不足（見上），不因沒有持久化欄位就判定整條未實作。
- 應用程式目前顯式讀取 claims 並記錄身分；框架層 OIDC 與完整 Token 流程不以此靜態碼單獨判定。

## 已知缺口

| # | 缺口 | 影響的 requirement |
|---|---|---|
| G1 | 登入流程只有歷史手動驗證的**自述**（H）；本次無法重現（設定為占位值），也沒有自動化證據 | REQ-PA-001、REQ-PA-002、REQ-PA-004 |
| G2 | EF Migration 不在版本控制中；資料庫結構的可重現性缺少證據 | REQ-PA-003 |
| G3 | 沒有任何自動化行為測試 | 全部 |
| G4 | **FR-007（Token）證據不足**；核發與持久化是不同要求，不能由沒有保存欄位推論核發未實作 | — |

來源與詳細核對：[`archive/changes/001-portal-home/archive.md`](../../../archive/changes/001-portal-home/archive.md)。

## Change Log

| Date | Change | Requirements | Summary | Archive |
|---|---|---|---|---|
| 2026-10-06 | 001-portal-home（補建） | REQ-PA-001 – 004 | 依 §15.4 補建；FR-007 因無實作與證據，未納入 requirement，列為未達成 | `archive/changes/001-portal-home` |
| 2026-10-07 | 遷移證據核對 | REQ-PA-004 | 更正靜態碼可支持的範圍；FR-007 改列證據不足，不新增保存需求；已驗證並採納此補建更正 | [核對與採納紀錄](../../developer-guide/migration-evidence-review.md) |
