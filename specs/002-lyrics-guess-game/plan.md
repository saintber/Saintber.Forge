# Implementation Plan: Lyrics Guess Game

**Branch**: `002-lyrics-guess-game` | **Date**: 2026-02-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-lyrics-guess-game/spec.md`
**Last Updated**: 2026-02-10

## ⚠️ Recent Update - Lazy Loading Mechanism

**變更日期**: 2026-02-10  
**變更原因**: 分散 AI 調用等待時間，提升遊戲開始速度，避免 UI 洩漏答案

### 核心變更

1. **兩階段 AI 處理流程**
   - **第一階段（歌單輸入時）**: AI 僅解析「歌名/演唱者」，不取得歌詞（1-3 秒/首）
   - **第二階段（隨機選歌時）**: 僅在首次選中該歌曲時，才呼叫 AI 取得完整歌詞（2-5 秒）
   - **效能提升**: 50 首歌開始遊戲時間從 50-100 秒縮短至 5-10 秒（提升 10-20 倍）

2. **UI 改進：防洩漏答案**
   - **原方案**: 唯讀文字方塊持續顯示歌單，玩家可從「正在載入歌詞...」提示判斷被選中哪首歌
   - **新方案**: 「查看歌單」按鈕 + 彈窗顯示，彈窗不顯示初始化狀態
   - **優勢**: 維持遊戲懸念，避免洩漏答案

3. **資料結構調整**
   ```csharp
   public class Song {
       public string Title { get; set; }         // 第一階段取得
       public string Artist { get; set; }        // 第一階段取得
       public string? Lyrics { get; set; }       // 第二階段延遲載入（預設 null）
       public bool IsInitialized => Lyrics != null;
       public bool InitializationFailed { get; set; }
   }
   ```

4. **受影響文件**
   - `spec.md`: 更新 User Stories、Functional Requirements、Success Criteria、Edge Cases
   - `research.md`: 重寫 R3 決策（前端資料儲存策略 → 延遲初始化機制）
   - `plan.md`: 本文件（加入此說明章節）

### 關鍵實作要點
- FR-003a: 新增「查看歌單」按鈕（彈窗顯示）
- FR-009: 隨機選中歌曲時檢查是否已初始化，未初始化則即時呼叫 AI
- FR-009a: 初始化失敗處理（最多重試 3 次，標記為 FailedSongIndices）
- FR-016: 自動下一題時包含延遲初始化檢查
- FR-018a: 記錄初始化失敗歌曲，避免重複嘗試

---

## Summary

建立以歌詞為基礎的猜歌互動遊戲 Tool，允許使用者輸入任意格式歌單文字，透過 AI 自動解析歌曲資訊與歌詞，隨機從歌詞中擷取片段出題，由使用者猜測歌名與演唱者。系統透過 AI 進行語意判定答案正確性，並提供「公佈答案」功能避免使用者卡關。所有互動流程在單一頁面完成，無需使用者登入，歌詞資料僅暫存於瀏覽器記憶體。技術實作採用 Blazor Server（前端 UI）搭配自訂 IAIServiceProvider（統一 AI 呼叫入口），支援使用者於遊戲中選擇不同 AI 模型進行互動。**採用兩階段 AI 處理流程與延遲初始化機制，大幅提升遊戲開始速度與使用體驗。**

## Technical Context

**Language/Version**: C# 12 / .NET 8 (net8.0)  
**Primary Dependencies**: 
- ASP.NET Core 8.0（Blazor Server hosting）
- 自訂 IAIServiceProvider（統一 AI 呼叫抽象層，支援 OpenAI/Azure OpenAI/本地模型）
- System.Text.Json（歌曲資料序列化、JSON 解析）
- Microsoft.JSInterop（SessionStorage 存取）
- HttpClient（AI API 呼叫）

**Storage**: 
- Blazor Server Component 狀態變數（C# 記憶體）：歌單、歌詞、遊戲進度 - 僅伺服器端暫存，無數量限制
- appsettings.json：AI 模型清單設定檔 - 研究決策 R2）

**Testing**: 
- xUnit（單元測試）
- bUnit（Blazor 元件測試）
- Playwright（E2E 測試 - 可選）

**Target Platform**: Blazor Server（server-side rendering with SignalR）  
**Project Type**: Web Application Tool（Frontend + AI integration）  

**Performance Goals**:
- 歌單解析到顯示第一題 < 10 秒（SC-001）
- 答案判定回應 < 3 秒（SC-002）
- AI 呼叫逾時設定：10 秒（解析）、5 秒（判定）

**Constraints**:
- 無使用者登入機制（Decision D1）
- 歌詞僅瀏覽器記憶體儲存，不進行後端持久化（Decision D5）
- 單一頁面狀態轉換，不使用多頁跳轉（Decision D6）
- AI 呼叫統一透過 IAIServiceProvider 抽象層（研究決策 R1）
- 不涉及音樂播放或音訊處理（Out of Scope）
- SignalR 連線使用預設設定（30 秒逾時，研究決策 R4）

**Scale/Scope**:
- 預期歌單規模：10-100 首歌曲/次（無強制限制，實際受限於 AI 解析效能）
- 歌詞片段長度：2-4 句（約 50-150 字元）
- 併發使用者：未明確定義（Blazor Server 連線模型）
- AI 模型數量：預期 3-5 個可選模型

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

檢視本功能是否符合 `.specify/memory/constitution.md` 定義的治理原則：

- [x] **Principle 3**: Lyrics Guess Game 為獨立 Tool，可被獨立建置、驗證與移除 ✅
- [x] **Principle 4**: 不依賴其他 Tool 實作，僅依賴 copilot.sdk（共享服務層），無工具間實作耦合 ✅
- [x] **Principle 5**: 透過 copilot.sdk 契約介面呼叫 AI 能力，不直接耦合特定 AI 提供者，符合治理允許的共享方式 ✅
- [x] **Principle 6**: AI 能力透過介面抽象，保留替換為其他實作型態的彈性（可為本地模型、雲端 API 等） ✅
- [x] **Principle 7**: 透過依賴注入取得 copilot.sdk 服務，不直接建立具體實作 ✅
- [x] **Principle 8**: UI 實作於 Blazor Server 頁面（`/lyrics-guess-game`），Tool 不包含獨立 Presentation 層 ✅

**Constitution Check Result**: ✅ **PASS** - 完全符合所有治理原則

**特別說明**:
- 本 Tool 無業務邏輯層（BLL/DAL），主要為 Presentation + AI 整合
- AI 模型清單使用 appsettings.json 設定檔（研究決策 R2），符合 Tool 獨立性原則
- 不使用現成 copilot.sdk，改為自訂 IAIServiceProvider 介面（研究決策 R1），保留實作替換彈性
- 歌曲資料使用 Blazor Component 狀態變數儲存（研究決策 R3），無數量限制，無需 SessionStorage

## Project Structure

此專案為 Presentation + AI 整合型態，主要檔案位於前端層級：

```plaintext
src/
  Saintber.Forge.BlazorServer/
    Pages/
      LyricsGuessGame/
        Index.razor            # 主遊戲頁面（歌單輸入、題目顯示、答案判定）
        Index.razor.cs         # 頁面邏輯（狀態管理、AI 呼叫）
    Components/
      LyricsGuessGame/
        SongInputComponent.razor     # 歌單輸入元件
        QuestionDisplayComponent.razor  # 題目顯示元件
        AnswerInputComponent.razor   # 答案輸入元件
        ModelSelectorComponent.razor # AI 模型選擇元件（共用）
    Services/
      LyricsGuessGameService.cs      # 遊戲邏輯封裝（歌單解析、題目產生、答案判定）

tests/
  Saintber.Forge.BlazorServer.UnitTests/
    Services/
      LyricsGuessGameServiceTests.cs  # 遊戲邏輯單元測試
  Saintber.Forge.BlazorServer.ComponentTests/
    LyricsGuessGame/
      SongInputComponentTests.cs      # 元件測試（bUnit）
  Saintber.Forge.BlazorServer.IntegrationTests/
    E2E/
      LyricsGuessGameE2ETests.cs      # 端對端測試（Playwright，可選）

specs/
  002-lyrics-guess-game/
    spec.md
    plan.md                # 本文件
    research.md            # Phase 0 研究成果
    data-model.md          # Phase 1 資料模型
    contracts/             # Phase 1 AI 服務契約
      LyricsGuessGameService.md  # 遊戲服務介面設計
    tasks.md               # Phase 2 任務清單
```

**特別說明**：
- 本 Tool 無獨立 BLL/DAL 層，邏輯封裝於 `LyricsGuessGameService`
- AI 模型清單資料來源待 Phase 0 研究決定（PostgreSQL vs 設定檔）
- SessionStorage 操作透過 JS Interop 實現

## Phase 0: Outline & Research

**Goal**: 解決 Technical Context 中的 NEEDS CLARIFICATION 項目，產生 `research.md`

### Research Tasks

從 Technical Context 與 Decision.md 中萃取的研究項目：

1. **copilot.sdk 使用模式研究**
   - Decision: 確認 copilot.sdk 是否支援以下功能
   - Rationale: 驗證統一 AI 呼叫介面是否符合本功能需求
   - Questions:
     - 歌單解析：能否讓 AI 從非結構化文字中萃取歌曲清單（JSON 格式）？
     - 歌詞取得：能否讓 AI 依據歌名與歌手取得完整歌詞？
     - 答案判定：能否讓 AI 進行語意比對（容忍錯字、簡繁體）？
     - 模型切換：能否在執行期間動態切換 AI 模型？
     - 錯誤處理：逾時、Quota 超限、模型不可用的處理方式？

2. **AI 模型清單資料來源**
   - Decision: PostgreSQL 資料表 vs appsettings.json 設定檔
   - Rationale: 決定模型清單的儲存與管理方式
   - Questions:
     - 若使用 PostgreSQL：是否符合 Constitution（Tool 可獨立移除）？
     - 若使用設定檔：如何實現多 Tool 共用模型清單？
     - 模型清單是否需要即時更新（影響儲存方式選擇）？

3. **SessionStorage 最佳實踐**
   - Decision: 確認 SessionStorage 容量限制與序列化策略
   - Rationale: 確保 10-20 首歌曲的歌詞資料不會超出瀏覽器限制
   - Questions:
     - 主流瀏覽器 SessionStorage 容量限制（Chrome/Edge/Firefox）？
     - 預估歌詞資料大小（20 首 * 每首 500 字 * UTF-8 編碼）？
     - 超過限制時的錯誤處理策略（分批儲存、壓縮、限制歌曲數）？

4. **Blazor Server SignalR 連線穩定性**
   - Decision: 驗證長時間 AI 呼叫是否會導致 SignalR 斷線
   - Rationale: 確保遊戲流程不會因 AI 逾時中斷
   - Questions:
     - SignalR 預設逾時設定值？
     - AI 呼叫（10 秒解析）是否會觸發 Keep-Alive 機制？
     - 斷線重連時，SessionStorage 資料是否會遺失？

5. **隨機抽題演算法**
   - Decision: 確認歌詞片段擷取規則（避免重複、確保可辨識性）
   - Rationale: 提升遊戲體驗，避免出題過於簡單或困難
   - Questions:
     - 如何避免連續兩題來自同一首歌？
     - 如何確保片段包含關鍵字（避免「啊～」等無意義內容）？
     - 是否需要紀錄已出題目（避免重複）？

### Expected Outputs

**研究成果文件**: `research.md`（包含以下章節）

```markdown
# Research: Lyrics Guess Game

## Decision 1: copilot.sdk Integration Pattern
- Decision: [使用方式與限制]
- Rationale: [為何符合需求]
- Alternatives considered: [直接呼叫 OpenAI API 等]
- Code sample: [範例程式碼]

## Decision 2: AI Model List Data Source
- Decision: [PostgreSQL / appsettings.json]
- Rationale: [治理原則、可維護性、動態更新需求]
- Alternatives considered: [硬編碼、Azure App Configuration]

## Decision 3: SessionStorage Strategy
- Decision: [容量限制處理方式]
- Rationale: [瀏覽器限制數據]
- Alternatives considered: [IndexedDB、LocalStorage]

## Decision 4: Blazor Server Connection Handling
- Decision: [逾時設定與重連策略]
- Rationale: [SignalR 行為分析]

## Decision 5: Random Question Algorithm
- Decision: [擷取規則與去重機制]
- Rationale: [遊戲體驗考量]
- Implementation notes: [演算法虛擬碼]
```

**STOP GATE**: 所有 Research Tasks 完成前，不得進入 Phase 1

## Phase 1: Design & Contracts

**Prerequisites**: `research.md` 完成，所有 NEEDS CLARIFICATION 解決

### Data Model (`data-model.md`)

從 spec.md 功能需求中萃取的資料實體：

1. **Song** (Client-side model)
   - Fields: Title (string), Artist (string), Lyrics (string)
   - Relationships: N/A (前端暫存，無資料庫關聯)
   - Validation: Title 與 Artist 非空，Lyrics 長度 > 0
   - Source: AI 解析歌單後產生

2. **Question** (Client-side model)
   - Fields: LyricsSnippet (string), CorrectSongTitle (string), CorrectArtist (string)
   - Relationships: 對應到 Song（記憶體參照）
   - Lifecycle: 出題時產生，答對後移除或標記已完成

3. **GameState** (SessionStorage model)
   - Fields: SongList (List<Song>), CurrentQuestion (Question), Score (int), TotalQuestions (int)
   - Serialization: JSON via System.Text.Json
   - Storage: SessionStorage key `LyricsGuessGame.State`

4. **AIModel** (共享資料，來源待研究決定)
   - Fields: ModelId (string), DisplayName (string), Provider (string)
   - Source: PostgreSQL `ai_models` 表 OR appsettings.json

### API Contracts (`contracts/`)

#### LyricsGuessGameService.md

```csharp
/// <summary>
/// 歌詞猜歌遊戲核心服務，封裝 AI 互動與遊戲邏輯
/// </summary>
public interface ILyricsGuessGameService
{
    /// <summary>
    /// 解析使用者輸入的歌單文字，萃取歌曲清單與歌詞
    /// </summary>
    /// <param name="playlistText">任意格式歌單文字</param>
    /// <param name="aiModelId">使用的 AI 模型 ID</param>
    /// <param name="cancellationToken">取消標記（逾時 10 秒）</param>
    /// <returns>歌曲清單（含歌詞）</returns>
    /// <exception cref="ArgumentException">歌單文字為空</exception>
    /// <exception cref="TimeoutException">AI 呼叫逾時</exception>
    /// <exception cref="InvalidOperationException">AI 回應格式錯誤</exception>
    Task<List<Song>> ParsePlaylistAsync(
        string playlistText, 
        string aiModelId, 
        CancellationToken cancellationToken = default);

    /// <summary>
    /// 從歌曲清單中隨機產生題目
    /// </summary>
    /// <param name="songs">歌曲清單</param>
    /// <param name="excludeSongIndex">排除的歌曲索引（避免重複出題）</param>
    /// <returns>題目物件（含歌詞片段與答案）</returns>
    /// <exception cref="ArgumentException">歌曲清單為空</exception>
    Question GenerateQuestion(List<Song> songs, int? excludeSongIndex = null);

    /// <summary>
    /// 判定使用者答案是否正確
    /// </summary>
    /// <param name="userAnswer">使用者輸入的歌名或歌手</param>
    /// <param name="correctAnswer">正確答案</param>
    /// <param name="aiModelId">使用的 AI 模型 ID</param>
    /// <param name="cancellationToken">取消標記（逾時 5 秒）</param>
    /// <returns>true: 正確 / false: 錯誤</returns>
    /// <exception cref="TimeoutException">AI 呼叫逾時</exception>
    Task<bool> ValidateAnswerAsync(
        string userAnswer, 
        string correctAnswer, 
        string aiModelId, 
        CancellationToken cancellationToken = default);
}
```

#### SessionStorageService.md (JS Interop)

```csharp
/// <summary>
/// 瀏覽器 SessionStorage 存取服務
/// </summary>
public interface ISessionStorageService
{
    Task SetItemAsync<T>(string key, T value);
    Task<T?> GetItemAsync<T>(string key);
    Task RemoveItemAsync(string key);
}
```

### Quick Start (`quickstart.md`)

```markdown
# Quick Start: Lyrics Guess Game

## 本地開發步驟

1. 確認 copilot.sdk 已註冊（研究階段確認設定方式）
2. 執行 Blazor Server 專案：
   ```powershell
   dotnet run --project src/Saintber.Forge.BlazorServer
   ```
3. 瀏覽器開啟 `https://localhost:5001/lyrics-guess-game`
4. 輸入歌單文字（例如：「我想聽周杰倫的晴天、七里香、稻香」）
5. 選擇 AI 模型，點擊「開始遊戲」
6. 根據歌詞片段猜測歌名與歌手

## 測試指令

```powershell
# 單元測試
dotnet test tests/Saintber.Forge.BlazorServer.UnitTests

# 元件測試（bUnit）
dotnet test tests/Saintber.Forge.BlazorServer.ComponentTests

# E2E 測試（Playwright）
dotnet test tests/Saintber.Forge.BlazorServer.IntegrationTests --filter "FullyQualifiedName~LyricsGuessGameE2E"
```

## AI 模型設定

（研究階段確認設定方式，appsettings.json 或資料庫遷移腳本）
```

### Agent Context Update

執行以下指令更新 agent 知識庫：

```powershell
.\.specify\scripts\powershell\update-agent-context.ps1 -AgentType copilot
```

**新增技術項目**：
- copilot.sdk（統一 AI 呼叫入口）
- SessionStorage（瀏覽器記憶體儲存）
- JS Interop（Blazor JavaScript 互動）

**STOP GATE**: Phase 1 完成後，重新檢視 Constitution Check（確保設計未違反治理原則）

## Phase 2: Task Generation

**Prerequisites**: Phase 1 完成，Constitution Check 再次驗證通過

此階段由 `/speckit.tasks` 指令執行，產生詳細的任務清單：

- 依據 `data-model.md` 產生資料模型實作任務
- 依據 `contracts/` 產生服務介面與實作任務
- 依據 `spec.md` 功能需求產生 UI 元件任務
- 產生測試任務（單元測試、元件測試、E2E 測試）
- 產生文件任務（README、API 文件、使用手冊）

**Output**: `tasks.md`（WBS 結構，包含任務編號、預估工時、依賴關係）

---

**Planning Summary**:
- ✅ Technical Context: 完成
- ✅ Constitution Check: 通過
- ✅ Project Structure: 定義完成
- ⏳ Phase 0 (Research): 待執行（5 項研究任務）
- ⏳ Phase 1 (Design): 待執行（資料模型、API 契約、快速開始指南）
- ⏳ Phase 2 (Tasks): 待執行（需執行 `/speckit.tasks` 指令）

**Next Step**: 執行 `/speckit.tasks` 產生詳細任務分解，或開始 Phase 0 研究工作。

