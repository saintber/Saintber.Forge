<!--
Sync Impact Report — Constitution v1.0.0

Version Change: (Initial) → v1.0.0
Ratification Date: 2026-02-07
Last Amended: 2026-02-08

Modified Principles: N/A (Initial establishment)
Added Sections: All core governance principles
Removed Sections: None

Templates Consistency Status:
✅ plan-template.md — Constitution Check section references governance principles
✅ spec-template.md — User scenarios align with tool independence principle
✅ tasks-template.md — Task structure compatible with tool isolation requirements
⚠️ commands/*.md — Requires verification for agent-agnostic guidance

Dependency Artifacts:
✅ project-structure.md — Aligns with Tool isolation and DI principles
✅ security-baseline.md — Security capabilities align with non-mandatory principle
✅ tech-baseline.md — Technology choices support tool replaceability
✅ testing-governance.md — Testing approach supports tool independence
✅ implementation-definition-of-done.md — Verification gates enforce quality principles
✅ README.md — Documentation structure supports constitution hierarchy

Follow-up TODOs:
- None (all placeholders resolved)

Deferred Items:
- None
-->

# Constitution — Saintber.Forge

> **Governance Document Version**: v1.0.0  
> **Ratification Date**: 2026-02-07  
> **Last Amended**: 2026-02-08

> Purpose  
> 本文件定義 Saintber.Forge 專案的**治理憲章**，  
> 說明 Forge 採取此治理模式的核心假設，並裁決不可退讓的行為邊界。

> Scope  
> 本文件為 Forge 的最高治理文件，  
> 其內容優先於所有 policy、plan 與實作決策。

---

## Constitution Metadata

| Property | Value |
|----------|-------|
| Project Name | Saintber.Forge |
| Version | v1.0.0 |
| Ratification Date | 2026-02-07 |
| Last Amended | 2026-02-08 |
| Status | Active |
| Amendment Authority | Project Constitution Committee |

---

## Versioning Policy

本憲章採用語義化版本控制（Semantic Versioning）：

- **MAJOR (X.0.0)**: 移除或重新定義核心治理原則，產生向後不相容的變更
- **MINOR (x.Y.0)**: 新增原則、章節或實質擴充治理指引
- **PATCH (x.y.Z)**: 澄清用語、修正錯字、非語義性的精煉

---

## 一、治理背景與核心假設

### Principle 1: Forge 的定位 — 工具集合而非平台

**裁決**:  
Saintber.Forge 被設計為一個 **工具集合（Tool Forge）**：

- 用來承載小型、實驗性或目的單一的工具
- 不以平台化或長期穩定 API 為主要目標
- 預期部分工具會被替換、拆分或移除

**理由**:  
工具集合的本質決定了治理策略必須優先考慮隔離性與可回收性，  
而非追求最大化重用或集中化控制。

---

### Principle 2: 核心風險假設 — 耦合成本超越重用收益

**裁決**:  
Forge 的治理設計基於以下風險判斷：

- 工具之間若形成耦合，將顯著提高拆解與回收成本
- 未受約束的共享會逐步演變為隱性平台
- 若業務能力與實作型態綁定，將阻礙未來演進
- Presentation 分散將導致整體行為難以收斂

**理由**:  
在工具集合情境下，耦合的負面影響（拆解困難、演進僵化）  
遠大於重用帶來的短期開發效率提升。

---

## 二、治理裁決（Non-Negotiable Rules）

### Principle 3: Tool 為最小治理單位

**裁決**:  
- 每一個 Tool 必須可被獨立建置、驗證與移除
- 任一 Tool 的存在不得成為其他 Tool 的前置條件

**理由**:  
工具的獨立性是可回收性的前提條件。  
若工具之間形成存在依賴，將無法安全地移除或替換任一工具。

**驗證方式**:  
- 每個 Tool 擁有獨立的 Solution
- 移除任一 Tool 目錄後，其他 Tool 的建置與測試仍能通過

---

### Principle 4: 禁止工具間的實作耦合

**裁決**:  
以下行為一律禁止：

- 一個 Tool 的實作直接依賴另一個 Tool 的實作
- 以任何形式形成跨 Tool 的實作層耦合

**理由**:  
實作層耦合會導致：
1. 修改一個 Tool 時必須同步修改其他 Tool
2. 無法獨立測試與驗證單一 Tool 的行為
3. 拆分或替換成本呈指數級增長

**驗證方式**:  
- 專案參考關係圖中，Tool.BLL 與 Tool.DAL 不得互相引用
- 跨 Tool 互動僅能透過 Abstractions 層的契約介面

---

### Principle 5: 共享僅限於明確治理的契約層

**裁決**:  
- Tool 之間僅允許透過明確定義的契約互動
- 未經治理允許的共享，皆視為違反本憲章

**理由**:  
契約層提供穩定的互動邊界，並保留實作替換的彈性。  
隱性共享（共用靜態類別、全域狀態、實作細節）會破壞隔離性。

**實作規範**:  
- 跨 Tool 契約定義於 `Saintber.Forge.Tools.Abstractions`
- 契約變更需經過版本管理與影響評估

---

### Principle 6: 業務能力必須保持可替換性

**裁決**:  
- 不得假設業務能力為同行程（in-process）實作
- 設計上必須保留替換為其他實作型態的可能性

**理由**:  
工具可能因效能、規模或部署需求而需要改為：
- 獨立微服務
- 函式即服務（FaaS）
- 外部第三方服務

若設計綁定同行程假設，替換成本將變得不可接受。

**設計要求**:  
- 使用介面而非具體類別
- 避免假設方法呼叫為同步或本地執行
- 錯誤處理需能涵蓋網路失敗或逾時情境

---

### Principle 7: 跨 Tool 能力使用方式限制

**裁決**:  
- 僅能依賴對外契約
- 必須透過依賴注入或等效機制取得實作
- 呼叫端不得綁定具體實作型別

**理由**:  
依賴注入機制確保：
1. 呼叫端不需要知道實作的具體型別
2. 可在測試或部署時替換實作
3. 相依關係可被明確管理與追蹤

**反模式範例（禁止）**:
```csharp
// ❌ 直接建立具體實作
var service = new ToolA.BLL.SomeService();

// ❌ 使用靜態方法存取
var result = ToolA.BLL.StaticHelper.DoSomething();
```

**正確範例**:
```csharp
// ✅ 透過介面與 DI
public class MyController
{
    private readonly IToolAService _service;
    
    public MyController(IToolAService service)
    {
        _service = service;
    }
}
```

---

### Principle 8: Presentation 為集中治理責任

**裁決**:  
- Presentation 不屬於 Tool 的職責範圍
- Tool 不得各自實作對外呈現行為
- Presentation 的組合與呈現須由集中組合點統一處理

**理由**:  
分散的 Presentation 會導致：
1. 使用者體驗不一致
2. 樣式與互動邏輯重複實作
3. 難以建立統一的導覽與存取控制

**實作規範**:  
- Tool 僅提供業務邏輯介面（BLL）
- Presentation 由 BlazorServer / BlazorWasm 專案負責
- Tool 不得包含 Razor 元件、Controllers 或 API Endpoints

---

## 三、憲章與其他文件的關係

### Principle 9: 憲章優先原則

**裁決**:  
- 所有 policy、plan 與實作內容不得違反本憲章所定義之裁決
- 若發現衝突，應調整政策或實作，而非削弱憲章

**理由**:  
憲章定義不可退讓的治理邊界。  
若允許政策或實作凌駕憲章，治理體系將失去意義。

**衝突解決程序**:  
1. 識別違反憲章的政策或實作
2. 評估是否為憲章本身需要修正
3. 若憲章正確，則修正政策或實作
4. 記錄決策理由與影響範圍

---

### Principle 10: 憲章不描述實作細節

**裁決**:  
- 本文件不描述結構、目錄、命名或工具配置
- 上述內容由 policy 文件負責並可隨實務調整
- 僅當治理方向改變時，才需要修改本文件

**理由**:  
憲章與政策的職責分離確保：
1. 治理原則保持穩定
2. 實作細節可隨經驗調整
3. 變更影響範圍可被明確界定

**文件階層**:  
```
Constitution (治理裁決)
    ↓
Policy (實作規範)
    ↓
Plan (執行計畫)
    ↓
Implementation (實際程式碼)
```

---

## 四、治理合規性與修正程序

### Amendment Procedure

憲章修正需遵循以下程序：

1. **提案階段**: 明確說明修正原因、影響範圍與版本變更類型
2. **影響評估**: 檢視所有 policy、plan 與實作的相容性
3. **版本決策**: 根據變更性質決定 MAJOR / MINOR / PATCH
4. **修正執行**: 更新憲章內容與版本號
5. **傳播更新**: 更新所有受影響的相依文件
6. **記錄保存**: 在 Sync Impact Report 中記錄完整變更歷程

---

### Compliance Review

定期進行憲章合規性檢視：

- **時機**: 每次重大功能交付前、每季度至少一次
- **範圍**: 檢視所有新增或修改的程式碼是否違反憲章原則
- **產出**: 合規性報告，列出發現的問題與修正計畫

---

## 五、結語

本憲章的存在目的是確保 Saintber.Forge 在演進過程中，  
能夠維持工具集合的本質特性：隔離性、可回收性與可替換性。

所有參與者在設計、實作或審查時，  
皆應以本憲章的原則作為最高指導方針。

---

**Document Control**  
- Location: `.specify/memory/constitution.md`  
- Authoritative Source: This document  
- Related Documents: See `docs/README.md` for complete documentation structure
