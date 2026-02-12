# Feature Specification: Portal Home

**Feature Branch**: `001-portal-home`  
**Created**: 2026-02-08  
**Status**: Draft  
**Input**: 建立專案首頁（Portal Home）作為各 Tool 的統一入口與導覽介面，支援登入/未登入狀態，以 RWD 卡片形式呈現可用功能

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 未登入使用者瀏覽公開功能 (Priority: P1)

未登入使用者進入 Portal Home，能夠看到所有公開可用的 Tool 卡片，並能透過點擊卡片或直接使用 URL 存取這些 Tool。

**Why this priority**: 這是最基本的入口功能，確保使用者無需登入即可發現並使用公開功能，降低使用門檻。

**Independent Test**: 在未登入狀態下開啟首頁，驗證可看到公開 Tool 卡片並能成功導覽，構成可獨立交付的 MVP。

**Acceptance Scenarios**:

1. **Given** 使用者未登入，**When** 使用者開啟 Portal Home，**Then** 系統顯示所有公開可用的 Tool 卡片
2. **Given** 使用者未登入且在首頁，**When** 使用者點擊公開 Tool 卡片，**Then** 系統導向該 Tool 的 URL 並正確載入
3. **Given** 使用者未登入，**When** 使用者直接在瀏覽器輸入 Tool 的 URL，**Then** 系統顯示與從首頁卡片點擊相同的結果
4. **Given** 使用者未登入且在首頁，**When** 使用者嘗試存取需授權的 Tool，**Then** 系統提示需要登入或導向登入頁

---

### User Story 2 - 已登入使用者存取完整功能 (Priority: P2)

已登入使用者進入 Portal Home，能夠看到包含需授權功能在內的所有 Tool 卡片，並能正常存取。

**Why this priority**: 擴充首頁功能以支援授權使用者，提供完整的功能清單，但依賴 P1 的基礎導覽機制。

**Independent Test**: 使用者完成 Microsoft 登入後，驗證能看到額外的受保護 Tool 卡片並能存取，獨立於 P1 測試。

**Acceptance Scenarios**:

1. **Given** 使用者已通過 Microsoft 身份驗證，**When** 使用者開啟 Portal Home，**Then** 系統顯示所有 Tool 卡片（包含公開與受保護的）
2. **Given** 使用者已登入且在首頁，**When** 使用者點擊需授權的 Tool 卡片，**Then** 系統導向該 Tool 並正確載入（攜帶身份資訊）
3. **Given** 使用者已登入，**When** 使用者直接在瀏覽器輸入受保護 Tool 的 URL，**Then** 系統顯示與從首頁卡片點擊相同的授權後結果
4. **Given** 使用者登入狀態過期，**When** 使用者重新整理 Portal Home，**Then** 系統僅顯示公開 Tool 卡片（視為未登入）

---

### User Story 3 - RWD 響應式設計支援 (Priority: P3)

使用者在不同裝置（桌機、平板、手機）上開啟 Portal Home，頁面佈局會自動調整以適應螢幕寬度，確保卡片可讀性與可操作性。

**Why this priority**: 提升使用體驗，但不影響核心導覽功能，可在 P1/P2 穩定後再優化。

**Independent Test**: 在不同螢幕寬度下開啟首頁，驗證卡片佈局正確調整且可正常點擊。

**Acceptance Scenarios**:

1. **Given** 使用者使用桌機（寬度 ≥ 1200px），**When** 開啟 Portal Home，**Then** 卡片以多欄（3-4 欄）排列顯示
2. **Given** 使用者使用平板（寬度 768px - 1199px），**When** 開啟 Portal Home，**Then** 卡片以 2 欄排列顯示
3. **Given** 使用者使用手機（寬度 < 768px），**When** 開啟 Portal Home，**Then** 卡片以單欄排列顯示
4. **Given** 使用者調整瀏覽器視窗寬度，**When** 視窗寬度跨越斷點，**Then** 卡片佈局即時調整

---

### Edge Cases

- 當 Portal Home 沒有任何可顯示的 Tool 時（未登入且無公開 Tool），顯示友善訊息「目前無可用功能」
- 當使用者登入狀態過期時，系統應將使用者視為未登入，僅顯示公開 Tool 卡片
- 當 Tool 的 URL 無法存取或回傳錯誤時，不影響 Portal Home 本身的顯示與其他卡片的點擊
- 當系統新增 Tool 時，Portal Home 應能自動反映新增的卡片（透過設定或資料驅動，非硬編碼）

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Portal Home MUST 以卡片（Card）形式呈現可用的 Tool
- **FR-002**: 每張卡片 MUST 包含 Tool 標題與簡要功能描述
- **FR-003**: 每張卡片 MUST 提供點擊後導向該 Tool 的 URL 功能
- **FR-004**: Portal Home MUST 支援未登入使用者存取（顯示公開 Tool）
- **FR-005**: Portal Home MUST 支援已登入使用者存取（顯示所有 Tool 包含受保護的）
- **FR-006**: 使用者登入 MUST 採用 Microsoft Identity / OpenID Connect 機制
- **FR-007**: 登入成功後系統 MUST 核發 Access Token 與 ID Token
- **FR-008**: Portal Home MUST 採用 RWD（Responsive Web Design）設計，支援桌機、平板、手機
- **FR-009**: 每個 Tool MUST 對應一個穩定且可直接存取的 URL
- **FR-010**: 使用者直接輸入 Tool URL 與從 Portal Home 卡片點擊進入，結果 MUST 一致
- **FR-011**: Portal Home 不得實作任何 Tool 的業務邏輯，僅作為導覽入口
- **FR-012**: 身份資料與相關狀態 MUST 能以 PostgreSQL 作為儲存來源

### Key Entities *(include if feature involves data)*

- **Tool Registration**: 代表系統中註冊的工具，包含屬性：
  - Tool ID（唯一識別碼）
  - Tool Name（顯示名稱）
  - Description（簡要功能描述）
  - URL（工具入口網址）
  - Is Public（是否為公開可用，無需授權）
  - Display Order（卡片排序順序）

- **User Identity**: 代表登入使用者的身份資訊，包含屬性：
  - User ID（Microsoft Identity 提供的唯一識別碼）
  - Display Name（顯示名稱）
  - Email（電子郵件）
  - Authentication Tokens（Access Token / ID Token）
  - Token Expiry（Token 有效期限）

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 未登入使用者能在 3 秒內完成首頁載入並看到公開 Tool 卡片
- **SC-002**: 已登入使用者能在 3 秒內完成首頁載入並看到所有 Tool 卡片（包含受保護的）
- **SC-003**: 使用者從 Portal Home 卡片點擊進入 Tool 的成功率達 100%（無導向錯誤或失效連結）
- **SC-004**: 使用者在桌機、平板、手機上開啟 Portal Home，頁面佈局正確調整且無水平捲軸
- **SC-005**: 新增 Tool 後，Portal Home 能在下次部署或重新整理後自動顯示新 Tool 卡片（無需修改首頁程式碼）
- **SC-006**: 90% 的使用者能在首次使用時，透過首頁成功找到並進入目標 Tool

## Assumptions

- Microsoft Identity / OpenID Connect 的設定與註冊已完成或將在實作階段處理
- PostgreSQL 資料庫已建立或將在實作階段建立
- Tool 的 URL 由各 Tool 本身負責維護與提供，Portal Home 僅負責導覽
- 卡片樣式與視覺設計將在實作階段由前端專案決定，本規格僅定義功能需求
- 使用者授權判斷邏輯（哪些 Tool 需要授權）將在實作階段明確定義

## Out of Scope

以下項目明確不在本次功能範圍內：

- Tool 內部的功能設計或實作
- 卡片的進階互動（如收藏、排序、拖曳、統計資訊）
- 權限模型的細節設計（僅需區分公開/受保護）
- 使用者個人化設定（如自訂首頁佈局、隱藏特定卡片）
- 多語系支援
- 無障礙設計（Accessibility）細節（但不排除未來擴充）

## Constitution Compliance Check

根據 `.specify/memory/constitution.md` 檢視本功能是否符合治理原則：

- ✅ **Principle 3**: Portal Home 不是 Tool，而是 Presentation 層的集中組合點，符合憲章定位
- ✅ **Principle 4**: Portal Home 不依賴任何 Tool 的實作，僅透過 URL 導覽，無實作耦合
- ✅ **Principle 5**: Portal Home 與 Tool 之間透過 URL 與 Tool Registration 資料互動，無隱性共享
- ✅ **Principle 6**: Tool 以 URL 形式存在，保留替換為其他實作型態的彈性
- ✅ **Principle 7**: Portal Home 不直接呼叫 Tool 的業務邏輯，符合依賴限制
- ✅ **Principle 8**: Portal Home 為集中 Presentation 責任的正確實踐
- ✅ **Principle 11**: 規格提供明確的 Acceptance Scenarios（Given-When-Then 格式），每個場景都可直接轉化為測試案例，支援 TDD 實踐
- ✅ **Principle 12**: 所有功能需求（FR-001 至 FR-012）皆為可驗證的陳述，可透過自動化測試（卡片渲染、URL 導覽）或手動測試（RWD 佈局）驗證

本功能完全符合憲章治理原則。
