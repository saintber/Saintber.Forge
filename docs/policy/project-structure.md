# Project Structure — Saintber.Forge

> Purpose  
> 描述 Saintber.Forge 在目錄、Solution 與專案層級上的實際結構配置方式，  
> 作為落實憲章治理原則的操作型參考。

> Scope  
> 本文件屬於工程政策層（Policy），  
> 僅說明「如何安排結構」，不重新定義或補充治理裁決。

---

## 一、整體結構總覽

Forge 採用以下結構策略：

- 單一主 Solution：用於整體開發、整合與建置
- 各工具各自擁有獨立 Solution：支援未來獨立發布或拆分
- 工具以目錄為單位隔離
- 採用前後端分離：API 與前端分離部署與責任
- API 分為 InnerApi 與 OuterApi，依資源位置決定呼叫哪一個
- 前端採用 Blazor WebAssembly + Blazor Server 並存
- 各入口專案（InnerApi / OuterApi / BlazorServer）各自擁有 DI/IOC 註冊，不共用
- 各 Tool 應提供自己的 DI 註冊 Extensions，供入口專案自行選用

---

## 二、根目錄結構

```text
/
├─ Saintber.Forge.sln
├─ src/
│  ├─ Abstractions/
│  │  └─ Saintber.Forge.Tools.Abstractions
│  ├─ Api/
│  │  ├─ Saintber.Forge.InnerApi
│  │  └─ Saintber.Forge.OuterApi
│  └─ Frontend/
│     ├─ Saintber.Forge.BlazorServer
│     └─ Saintber.Forge.BlazorWasm
├─ tools/
│  └─ ToolA/
│     └─ ...
└─ docs/
```

---

## 三、Tools Abstractions 專案配置

### 1. 專案角色

`Saintber.Forge.Tools.Abstractions` 用於集中定義：

* 各工具對外可使用的 BLL 介面
* 跨工具穩定的請求 / 回應模型
* 不含行為的契約型別（如 Result、Value Object）

---

### 2. 使用時機

* 若某工具需被 API 或其他工具使用，其對外介面必須定義於本專案
* 若某工具不提供對外業務能力，可不在此定義介面

---

## 四、API 結構（InnerApi / OuterApi）

### 1. 專案定位

* `Saintber.Forge.InnerApi`

  * 僅供內部網路或受信任環境使用
* `Saintber.Forge.OuterApi`

  * 對外提供服務
  * 可包含公開 API 或受保護 API（身份識別/授權可選）

兩者皆為 BLL 的呼叫端，不承載業務邏輯。

---

### 2. DI/IOC 原則

* InnerApi 與 OuterApi 各自維護獨立的 DI/IOC 註冊
* 工具的服務註冊由工具的 BLL 專案提供 DI 註冊 Extensions 加入

---

## 五、Frontend 結構（Blazor Server / WASM）

### 1. 為何同時存在 Blazor Server 與 Blazor WebAssembly

Blazor Server 與 Blazor WebAssembly 為不同的 Hosting Model，
並非同一個專案在執行時切換模式。

Forge 以「同一站台下多個前端入口」的方式並存兩者，
用於在不同頁面/功能依安全性、即時性與成本取捨選擇合適模型。

---

### 2. 專案定位與使用情境

* `Saintber.Forge.BlazorServer`（內部 / 高權限 / 即時性）

  * 內部工具、管理介面、維運功能
  * 需要較高權限或較細緻的伺服端控管
  * 需要即時互動（長連線/即時更新）或集中狀態管理
  * 僅透過呼叫 InnerApi / OuterApi 使用業務能力

* `Saintber.Forge.BlazorWasm`（公開 / 高併發 / 低成本）

  * 公開頁面、一般使用者操作、可大量併發的互動頁面
  * 以 Client-side 執行降低 Server 計算負擔
  * 主要呼叫 OuterApi；是否呼叫 InnerApi 取決於部署網段與可達性

前端採用 RWD 設計為優先目標。

---

### 3. DI/IOC 原則

* BlazorServer、InnerApi、OuterApi 各自擁有 DI/IOC 註冊，不共用
* BlazorWasm 的 DI 僅限前端 client-side 服務（HttpClient、State、UI services）
* Frontend 專案不直接 reference 任一 Tool 的 BLL 或 DAL

---

## 六、工具目錄結構

### 1. 工具 Solution 與目錄

每一個工具皆位於 `tools/<ToolName>` 下，並擁有自己的 Solution：

```text
/tools
  /ToolA
    ToolA.sln
    /src
    /tests
```

---

### 2. 工具內部專案配置

```text
/tools/ToolA
  /src
    ToolA.BLL
    ToolA.DAL
  /tests
    ToolA.BLL.UnitTests
    ToolA.BLL.IntegrationTests
```

說明：

* 工具內不包含 API 或前端入口專案
* 工具對外整合透過契約（Tools Abstractions）與 API 呼叫達成

---

## 七、工具 DI 註冊 Extensions（Hosted in BLL）

### 1. 放置位置

各工具的 DI 註冊 Extensions 由工具的 BLL 專案提供，建議放置位置：

```text
<ToolName>.BLL
  /DependencyInjection
    ServiceCollectionExtensions.cs
```

---

### 2. 命名建議

* 類別命名：`ServiceCollectionExtensions`
* 方法命名：`Add<ToolName>(...)`

---

## 八、Persistence 專案結構

### 1. Persistence 命名與拆分

若有 EF/資料庫存取的共用實作需求，Persistence 專案採用：

```text
Persistence.EF.Abstractions
Persistence.EF.<DatabaseType>
```

範例：

```text
Persistence.EF.Abstractions
Persistence.EF.Postgres
Persistence.EF.SqlServer
```

---

### 2. 使用關係（示意）

* 工具的 DAL 或工具的 DI 註冊 Extensions 可 reference Persistence
* BLL 的業務邏輯不直接 reference `Persistence.EF.<DatabaseType>`
* Persistence 不反向依賴工具或入口專案

---

## 九、專案參考關係（實務示意）

```text
ToolA.BLL → ToolA.DAL
ToolA.BLL → Saintber.Forge.Tools.Abstractions

ToolA.DAL → Persistence.EF.Abstractions
ToolA.DAL → Persistence.EF.<DatabaseType>

InnerApi     → Saintber.Forge.Tools.Abstractions
InnerApi     → ToolA.BLL (selective)

OuterApi     → Saintber.Forge.Tools.Abstractions
OuterApi     → ToolA.BLL (selective)

BlazorServer → InnerApi / OuterApi (HTTP)
BlazorWasm   → OuterApi (HTTP)
```

---

## 十、結構調整與演進

### 1. 調整原則

* 本文件可隨實務經驗調整
* 調整目標應為提升結構清晰度與可演進性
* 若結構需求無法在本文件框架下合理滿足，應回頭檢視憲章裁決是否需要修正

---
