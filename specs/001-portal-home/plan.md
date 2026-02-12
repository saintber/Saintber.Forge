# Implementation Plan: Portal Home

**Branch**: `001-portal-home` | **Date**: 2026-02-08 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/001-portal-home/spec.md`

## Summary

建立專案首頁（Portal Home）作為各 Tool 的統一 Presentation 入口。首頁以 RWD 卡片形式呈現可用 Tool，支援未登入使用者瀏覽公開功能，以及已登入使用者（透過 Microsoft Identity）存取完整功能清單。技術實作採用 Blazor Server，儲存 Tool 註冊資訊與使用者身份於 PostgreSQL，完全符合憲章 Principle 8（Presentation 集中治理）。

## Technical Context

**Language/Version**: C# 12 / .NET 8 (net8.0)  
**Primary Dependencies**: 
- ASP.NET Core 8.0（Blazor Server hosting）
- Microsoft.Identity.Web（Microsoft Identity / OIDC 整合）
- Entity Framework Core 8.0（資料存取）
- Npgsql.EntityFrameworkCore.PostgreSQL（PostgreSQL provider）

**Storage**: PostgreSQL（Tool Registration + User Identity）  
**Testing**: 
- xUnit（單元測試）
- bUnit（Blazor 元件測試）
- Playwright / Selenium（E2E RWD 測試 - Gate B）

**Target Platform**: Blazor Server（長連線模型，server-side rendering）  
**Project Type**: Web Application（Frontend only，無 Tool 業務邏輯）  

**Performance Goals**:
- 首頁載入時間 < 3 秒（SC-001, SC-002）
- 卡片點擊導覽成功率 100%（SC-003）

**Constraints**:
- 不得實作 Tool 業務邏輯（FR-011，憲章 Principle 8）
- Tool URL 穩定性與一致性（FR-009, FR-010）
- RWD 支援三種斷點（桌機/平板/手機，FR-008）

**Scale/Scope**:
- 初期預期 Tool 數量：5-20 個
- 無分頁需求（可延後至 Tool 數量 > 50 時再評估）
- 併發使用者：未明確定義（Blazor Server 連線模型，依部署資源而定）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

檢視本功能是否符合 `.specify/memory/constitution.md` 定義的治理原則：

- [x] **Principle 3**: Portal Home 非 Tool，為 Presentation 層集中組合點，無獨立建置需求 ✅
- [x] **Principle 4**: 不依賴任何 Tool 實作，僅透過 URL 導覽，無實作耦合 ✅
- [x] **Principle 5**: 透過 Tool Registration 資料（非程式碼契約）互動，符合治理允許的共享方式 ✅
- [x] **Principle 6**: Tool 以 URL 存在，完全保留替換彈性（可為內部服務、外部 API、靜態頁面等） ✅
- [x] **Principle 7**: 不直接呼叫 Tool 業務能力，僅 HTTP 導覽，符合依賴限制 ✅
- [x] **Principle 8**: Presentation 集中於 BlazorServer，Tool 不包含 UI，完全符合 ✅
- [x] **Principle 11**: ✅ 採用 TDD 開發模式，服務層邏輯（Tool Registration 查詢、使用者身份驗證）屬於 TDD 強制範圍，實作前需先撰寫測試（見 Testing 區段）
- [x] **Principle 12**: ✅ 完成定義包含 Gate A（restore/build/test 全部通過）+ Gate B（RWD 手動驗證）與 Verification Record，所有測試需執行並通過才可宣告完成

**Constitution Check Result**: ✅ **PASS** - 完全符合所有治理原則

**TDD Implementation Notes**:
- **Unit Tests** (TDD 強制範圍):
  - `ToolRegistrationService` 的所有查詢方法（公開/受保護 Tool 篩選邏輯）
  - `ToolCard` 元件的互動邏輯（點擊事件、URL 導覽）
  - 使用者身份驗證狀態判斷邏輯
- **Integration Tests** (可選但建議):
  - 完整導覽流程（未登入 → 點擊公開 Tool → 導向正確 URL）
  - 登入流程整合測試（Microsoft Identity redirect → callback → 顯示受保護 Tool）
- **E2E/RWD Tests** (Gate B，手動驗證為主):
  - RWD 斷點測試（桌機/平板/手機三種寬度）
  - 卡片佈局正確性（Playwright/Selenium 自動化可選）

## Project Structure

### Documentation (this feature)

```text
specs/001-portal-home/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (Microsoft Identity setup, Blazor Server best practices)
├── data-model.md        # Phase 1 output (ToolRegistration, UserIdentity entities)
├── quickstart.md        # Phase 1 output (開發環境設定、本地執行指南)
├── contracts/           # Phase 1 output (Tool Registration API, Identity endpoints)
│   ├── tool-api.yaml   # OpenAPI spec for Tool Registration CRUD
│   └── auth-flow.md    # Microsoft Identity authentication flow
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

根據 `project-structure.md`，Portal Home 應位於 Frontend 層級：

```text
src/Frontend/
├── Saintber.Forge.BlazorServer/          # Portal Home 主專案
│   ├── Program.cs                         # 應用程式入口，DI 設定
│   ├── Pages/
│   │   ├── Index.razor                   # Portal Home 首頁（卡片展示）
│   │   └── Login.razor                   # 登入頁面（Microsoft Identity redirect）
│   ├── Components/
│   │   ├── ToolCard.razor                # Tool 卡片元件（可重用）
│   │   └── Layout/
│   │       └── MainLayout.razor          # RWD 主版型
│   ├── Services/
│   │   ├── IToolRegistrationService.cs   # Tool 查詢介面
│   │   ├── ToolRegistrationService.cs    # Tool 查詢實作（讀取 DB）
│   │   └── IUserIdentityService.cs       # 使用者身份服務介面
│   ├── wwwroot/
│   │   └── css/
│   │       └── app.css                   # RWD 樣式（斷點定義）
│   └── appsettings.json                  # 設定（PostgreSQL connection, Microsoft Identity）

tests/
├── Saintber.Forge.BlazorServer.UnitTests/    # 單元測試專案
│   ├── Components/
│   │   └── ToolCardTests.cs              # bUnit 元件測試
│   └── Services/
│       └── ToolRegistrationServiceTests.cs # 單元測試
└── Saintber.Forge.BlazorServer.IntegrationTests/    # 整合測試專案（含 E2E）
    └── E2E/
        └── PortalHomeRwdTests.cs         # Playwright RWD 測試（Gate B）

src/Persistence/
└── Saintber.Forge.Persistence.EF.Postgres/
    ├── Entities/
    │   ├── ToolRegistration.cs           # EF Entity
    │   └── UserIdentity.cs               # EF Entity
    ├── PortalDbContext.cs                # EF DbContext
    └── Migrations/                       # EF Migrations
```

**Structure Decision**:
- 採用 `project-structure.md` 定義的 Frontend 結構
- Portal Home 位於 `BlazorServer` 專案（符合 Principle 8）
- 不建立獨立 Tool 目錄（Portal Home 為 Presentation 層，非 Tool）
- 共用 Persistence 層處理 PostgreSQL 存取（符合結構規範第八節）

## Phase 0: Research & Technology Decisions

以下為需要研究與明確的技術決策點：

### R1. Microsoft Identity / OIDC 整合策略

**Question**: Blazor Server 如何整合 Microsoft Identity？Token 管理策略？

**Research Scope**:
- Microsoft.Identity.Web 套件使用方式
- Blazor Server 長連線模型下的 Token 刷新機制
- Token 過期時的降級策略（回到未登入狀態）

**Output**: `research.md` 中包含完整設定步驟與程式碼範例

### R2. Blazor Server RWD 最佳實踐

**Question**: Blazor Server 如何實作 RWD？CSS 斷點定義？

**Research Scope**:
- Blazor 元件 CSS isolation 使用方式
- 三種斷點定義（桌機 ≥1200px、平板 768-1199px、手機 <768px）
- FlexBox / Grid 佈局策略

**Output**: `research.md` 中包含 CSS 範例與元件結構建議

### R3. PostgreSQL Schema 設計

**Question**: ToolRegistration 與 UserIdentity 的 EF Core 映射？

**Research Scope**:
- EF Core Code-First vs Database-First 選擇
- Migration 管理策略
- Index 設計（依 Tool ID、Display Order 查詢）

**Output**: `research.md` 中包含 Entity 定義與 Migration 指令

### R4. Tool Registration 資料來源

**Question**: Tool 資訊如何維護？手動 DB 新增？設定檔？Admin API？

**Research Scope**:
- 初期採用 Seed Data（EF Migrations）
- 未來可擴充為 Admin UI 或 API（Out of Scope for MVP）
- 資料驅動設計確保無需修改程式碼即可新增 Tool（SC-005）

**Output**: `research.md` 中包含 Seed Data 範例與未來擴充建議

### R5. Gate B 測試策略（RWD 驗證）

**Question**: 如何自動化驗證 RWD 斷點？

**Research Scope**:
- Playwright 或 Selenium 瀏覽器自動化
- 視窗寬度調整與截圖比對
- CI/CD 整合方式（可在 Gate B 手動驗證後再自動化）

**Output**: `research.md` 中包含測試框架選擇與簡單範例

## Phase 1: Design & Contracts

### Data Model

詳細內容見 `data-model.md`，摘要如下：

**ToolRegistration**:
- ToolId (PK, Guid)
- ToolName (string, max 100)
- Description (string, max 500)
- Url (string, max 2000)
- IsPublic (bool)
- DisplayOrder (int)
- CreatedAt, UpdatedAt (timestamp)

**UserIdentity**:
- UserId (PK, string - Microsoft Identity Object ID)
- DisplayName (string)
- Email (string)
- LastLoginAt (timestamp)

（Token 不儲存於 DB，由 Microsoft Identity 管理）

### API Contracts

詳細內容見 `contracts/` 目錄：

1. **Tool Registration API** (`contracts/tool-api.yaml`)
   - GET /api/tools?isPublic={bool}
   - GET /api/tools/{toolId}
   - （POST/PUT/DELETE 為 Out of Scope，未來 Admin 功能）

2. **Authentication Flow** (`contracts/auth-flow.md`)
   - Microsoft Identity redirect flow
   - Token validation
   - Logout endpoint

### Quickstart

詳細內容見 `quickstart.md`，包含：
- 環境前置需求（.NET 8 SDK, PostgreSQL, Microsoft Azure AD App Registration）
- 本地開發設定步驟
- 首次執行與 Migration 建立
- 常見問題排除

## Phase 2: Task Decomposition

**Note**: Phase 2 (`tasks.md`) 由 `/speckit.tasks` 命令生成，不在本 plan.md 範圍內。

預期任務結構（僅供參考）：
- Phase 1 Setup: 專案建立、NuGet 套件安裝
- Phase 2 Foundational: EF DbContext、Migrations、Seed Data
- Phase 3 US1 (P1): 未登入首頁、公開 Tool 卡片展示、RWD 基本佈局
- Phase 4 US2 (P2): Microsoft Identity 整合、登入後完整清單
- Phase 5 US3 (P3): RWD 精煉、三種斷點優化
- Gate B Manual Verification: RWD 測試、瀏覽器相容性

## Re-evaluation: Constitution Check (Post-Design)

設計完成後重新檢視憲章合規性：

- [x] **Principle 3 (Tool 資料隔離)**: `ToolRegistration` 僅儲存 Tool 註冊資訊（名稱、URL、公開性），不包含 Tool 內部資料。所有 Tool 業務邏輯由 Tool 專案獨立實作。✅
- [x] **Principle 4 (DI 架構)**: `PortalDbContext` 透過 `services.AddDbContext<PortalDbContext>()` 註冊為 Scoped 服務，ToolService 透過建構子注入 DbContext。完全符合 DI 原則。✅
- [x] **Principle 5 (Presentation 集中化)**: Portal Home 為 Blazor Server 頁面（`src/Frontend/Saintber.Forge.BlazorServer/Pages/Index.razor`），所有 UI 集中於 Frontend 專案，無 Tool 專案分散 UI。✅
- [x] **Principle 6 (Tool 替換性)**: Tool 透過 `Url` 欄位連結（字串格式），Portal Home 僅負責導覽，不依賴特定 Tool 實作。未來新增/移除 Tool 僅需修改 Seed Data，無程式碼變更。✅
- [x] **Principle 7 (業務能力獨立性)**: Portal Home 提供「工具瀏覽與導覽」能力，不綁定特定 Tool 業務邏輯。Tool Registration 為通用資料結構，支援任意類型 Tool。✅
- [x] **Principle 8 (Config 外部化)**: 資料庫連線字串、Azure AD 設定皆由 `appsettings.json` / User Secrets 管理，支援環境變數覆寫（符合 12-Factor App）。✅

**Post-Design Constitution Check**: ✅ **PASS** - 設計完全符合憲章  
**Post-Design Summary**: Portal Home 完全符合 Constitution 治理原則，無需修正設計。Seed Data 策略確保 Tool 替換性，DI 架構確保測試性與隔離性。所有 Phase 1 產出物（research.md, data-model.md, contracts/, quickstart.md）已完成並驗證合規。

## Verification Strategy

根據 `implementation-definition-of-done.md`：

### Gate A (自動驗證)
- `dotnet restore` - 套件還原
- `dotnet build` - Blazor Server 專案建置
- `dotnet test` - 單元測試（xUnit）+ 元件測試（bUnit）

### Gate B (手動驗證)
本功能需要 Gate B，因為包含：
- RWD 視覺驗證（三種斷點）
- 瀏覽器相容性測試（Edge, Chrome, Safari）
- Microsoft Identity 登入流程（需實際 Azure AD）

**Verification Record**: 
每次可交付變更後產出 `docs/plan/verification/<change-id>.verify.md`

## Dependencies & Assumptions

### External Dependencies
- Microsoft Azure AD（App Registration 已完成或將在實作時處理）
- PostgreSQL 資料庫（本地或雲端instance）

### Assumptions
- Tool URL 由各 Tool 負責維護，Portal Home 僅負責導覽（spec Assumption）
- Microsoft Identity 失敗時降級為未登入狀態（research 階段確認）
- 初期 Tool 數量不超過 20 個，無需分頁（可延後）

### Risks
- Microsoft Identity 設定複雜度（Mitigation: Phase 0 research 提供完整步驟）
- Blazor Server 長連線模型下的 Token 管理（Mitigation: 使用 Microsoft.Identity.Web 標準實踐）
- RWD 測試覆蓋度（Mitigation: Gate B 手動驗證確保品質）

## Success Metrics Alignment

本計畫與 spec.md Success Criteria 的對應：

- **SC-001, SC-002** (3秒載入): Blazor Server SSR + 簡單查詢，預期可達成
- **SC-003** (100%導覽成功率): URL 靜態配置，測試驗證
- **SC-004** (RWD正確調整): Gate B 手動驗證 + CSS 斷點設計
- **SC-005** (自動顯示新Tool): Seed Data / DB 驅動設計
- **SC-006** (90%找到目標): UX 設計範疇，透過清楚卡片標題與描述達成

## Next Steps

1. ✅ 執行 Phase 0 Research（生成 `research.md`）
2. ✅ 執行 Phase 1 Design（生成 `data-model.md`, `contracts/`, `quickstart.md`）
3. ⏸️ 等待 `/speckit.tasks` 命令生成 `tasks.md`
4. ⏸️ 實作階段遵循 Gate A/B 驗證流程

---

**Plan Status**: ✅ Ready for Phase 0 Research  
**Constitution Compliance**: ✅ Fully Aligned  
**Blocker**: None
