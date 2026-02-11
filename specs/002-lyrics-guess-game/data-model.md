# Data Model: Lyrics Guess Game

**Feature**: 002-lyrics-guess-game  
**Date**: 2026-02-11  
**Purpose**: 定義 Lyrics Guess Game 的資料結構與關係

---

## Overview

本功能採用 **前端狀態管理** 策略，所有資料僅儲存於 Blazor Component 狀態變數（C# 記憶體）中，不涉及後端資料庫或瀏覽器持久化儲存。

**設計原則**:
- 資料生命週期：頁面載入時建立，頁面重新整理時清空
- 延遲初始化：歌詞僅在選中該歌曲時載入（延遲載入機制）
- 無使用者身份：不區分登入狀態，不儲存個人資料

---

## Core Entities

### 1. AIModelConfig（AI 模型設定）

**用途**: 代表可供使用者選擇的 AI 模型資訊

**資料來源**: `appsettings.json` 設定檔（符合 Constitution Principle 3 - Tool 獨立性）

**欄位定義**:

| 欄位名稱 | 型別 | 必填 | 說明 |
|---------|------|------|------|
| `ModelId` | `string` | ✅ | AI SDK 實際呼叫時使用的模型識別碼（如 `"gpt-4-turbo"`、`"claude-3-sonnet"`） |
| `DisplayName` | `string` | ✅ | 對使用者友善的顯示名稱（如 `"GPT-4 Turbo（快速、準確）"`） |
| `Provider` | `string` | ✅ | AI 模型的原始供應商（如 `"OpenAI"`、`"Anthropic"`）<br/>註：Copilot SDK 支援多廠商，此欄位用於標記來源 |
| `IsEnabled` | `bool` | ✅ | 模型是否在下拉選單中顯示 |
| `IsDefault` | `bool` | ✅ | 是否為系統啟動時預設選用的模型（僅一個模型可為 `true`） |

**驗證規則**:
- `ModelId` 不可為空字串
- `DisplayName` 不可為空字串
- 設定檔中至少需有一個模型的 `IsEnabled = true` 且 `IsDefault = true`

**範例資料**:
```json
{
  "ModelId": "gpt-4-turbo",
  "DisplayName": "GPT-4 Turbo（快速、準確）",
  "Provider": "OpenAI",
  "IsEnabled": true,
  "IsDefault": true
}
```

---

### 2. Song（歌曲）

**用途**: 代表從歌單解析出的單首歌曲資訊

**儲存位置**: Blazor Component 狀態變數（`List<Song>`）

**欄位定義**:

| 欄位名稱 | 型別 | 必填 | 說明 |
|---------|------|------|------|
| `Title` | `string` | ✅ | 歌曲名稱（第一階段 AI 解析取得） |
| `Artist` | `string` | ✅ | 演唱者名稱（第一階段 AI 解析取得） |
| `Lyrics` | `string?` | ❌ | 完整歌詞（第二階段延遲載入，預設為 `null`） |
| `InitializationFailed` | `bool` | ✅ | 標記該歌曲是否初始化失敗（AI 無法取得歌詞），預設 `false` |

**計算屬性**:
```csharp
public bool IsInitialized => Lyrics != null;
```

**狀態轉換**:
```
[建立] → Title/Artist 已設定, Lyrics = null, InitializationFailed = false
   ↓
[選中出題] → 若 Lyrics == null，呼叫 AI 取得歌詞
   ↓
[初始化成功] → Lyrics 被賦值（非 null）
[初始化失敗] → InitializationFailed = true, Lyrics 仍為 null
```

**驗證規則**:
- `Title` 與 `Artist` 不可同時為空字串
- 若 `InitializationFailed = true`，則 `Lyrics` 必須為 `null`

**範例資料**:
```csharp
// 第一階段：僅有基本資訊
new Song 
{ 
    Title = "晴天", 
    Artist = "周杰倫", 
    Lyrics = null,
    InitializationFailed = false
}

// 第二階段：已初始化
new Song 
{ 
    Title = "晴天", 
    Artist = "周杰倫", 
    Lyrics = "故事的小黃花\n從出生那年就飄著...",
    InitializationFailed = false
}
```

---

### 3. Question（題目）

**用途**: 代表當前顯示的猜歌題目

**儲存位置**: Blazor Component 狀態變數（`GameState.CurrentQuestion`）

**欄位定義**:

| 欄位名稱 | 型別 | 必填 | 說明 |
|---------|------|------|------|
| `LyricsSnippet` | `string` | ✅ | 隨機選取的歌詞片段（至少 10 字，句子完整） |
| `CorrectSongTitle` | `string` | ✅ | 正確答案：歌曲名稱 |
| `CorrectArtist` | `string` | ✅ | 正確答案：演唱者名稱 |
| `SongIndex` | `int` | ✅ | 歌曲在 `GameState.Songs` 中的索引位置 |
| `QuestionState` | `QuestionState` | ✅ | 題目狀態（`Unanswered`、`AnsweredCorrectly`、`RevealedAnswer`） |

**QuestionState 枚舉**:
```csharp
public enum QuestionState
{
    Unanswered,         // 未作答
    AnsweredCorrectly,  // 已答對
    RevealedAnswer      // 已公佈答案
}
```

**驗證規則**:
- `LyricsSnippet` 字數至少 10 字（移除空白與標點後）
- `SongIndex` 需在 `GameState.Songs` 的有效範圍內（0 ~ Songs.Count - 1）

**範例資料**:
```csharp
new Question
{
    LyricsSnippet = "故事的小黃花\n從出生那年就飄著\n童年的盪鞦韆\n隨記憶一直晃到現在",
    CorrectSongTitle = "晴天",
    CorrectArtist = "周杰倫",
    SongIndex = 3,
    QuestionState = QuestionState.Unanswered
}
```

---

### 4. GameState（遊戲狀態）

**用途**: 管理整個遊戲的進行狀態與資料

**儲存位置**: Blazor Component 狀態變數

**欄位定義**:

| 欄位名稱 | 型別 | 必填 | 說明 |
|---------|------|------|------|
| `Songs` | `List<Song>` | ✅ | 歌曲清單（第一階段 AI 解析後建立） |
| `CurrentQuestion` | `Question?` | ❌ | 當前題目（遊戲開始後建立） |
| `UsedSongIndices` | `HashSet<int>` | ✅ | 已出題的歌曲索引集合（避免重複出題） |
| `FailedSongIndices` | `HashSet<int>` | ✅ | 初始化失敗的歌曲索引集合（避免重複嘗試） |
| `SelectedModelId` | `string` | ✅ | 使用者目前選擇的 AI 模型識別碼 |
| `IsPlaylistParsed` | `bool` | ✅ | 歌單是否已完成第一階段解析 |
| `IsGameActive` | `bool` | ✅ | 遊戲是否正在進行中 |

**狀態轉換**:
```
[初始狀態] 
  Songs = [], CurrentQuestion = null, UsedSongIndices = {}, FailedSongIndices = {}
  IsPlaylistParsed = false, IsGameActive = false
     ↓
[輸入歌單 + AI 解析] 
  Songs = [...], IsPlaylistParsed = true
     ↓
[開始遊戲 + 首次出題]
  CurrentQuestion = {...}, UsedSongIndices = {0}, IsGameActive = true
     ↓
[答對/公佈答案]
  CurrentQuestion = null → 重新隨機選歌 → CurrentQuestion = {...}, UsedSongIndices = {0, 3}
     ↓
[所有歌曲已出完]
  IsGameActive = false
```

**驗證規則**:
- `UsedSongIndices` 中的索引值需在 `Songs` 的有效範圍內
- `FailedSongIndices` 與 `UsedSongIndices` 的交集應為空（失敗的歌曲不應被出題）
- `IsGameActive = true` 時，`CurrentQuestion` 不可為 `null`

---

## Entity Relationships

```
GameState
  ├─ Songs (1..*)
  │   └─ Song
  │       ├─ Title
  │       ├─ Artist
  │       ├─ Lyrics (nullable)
  │       └─ InitializationFailed
  │
  ├─ CurrentQuestion (0..1)
  │   └─ Question
  │       ├─ LyricsSnippet
  │       ├─ CorrectSongTitle
  │       ├─ CorrectArtist
  │       ├─ SongIndex (references Songs[index])
  │       └─ QuestionState
  │
  ├─ UsedSongIndices (0..*)
  ├─ FailedSongIndices (0..*)
  └─ SelectedModelId (references AIModelConfig.ModelId)

AIModelConfig (from appsettings.json)
  ├─ ModelId
  ├─ DisplayName
  ├─ Provider
  ├─ IsEnabled
  └─ IsDefault
```

---

## State Management Strategy

### 延遲初始化機制

**第一階段：歌單解析（快速）**
- 輸入：使用者輸入的歌單文字
- AI 處理：僅解析「歌名/演唱者」（不包含歌詞）
- 預期時間：5-10 秒（50 首歌）
- 輸出：`List<Song>`（所有 `Lyrics = null`）

**第二階段：歌詞載入（隨需）**
- 觸發時機：隨機選中該歌曲準備出題時
- AI 處理：取得該歌曲的完整歌詞
- 預期時間：2-5 秒（單首歌）
- 輸出：更新 `Song.Lyrics`

**優勢**:
- 使用者開始遊戲時間：5-10 秒（vs 一次性載入 100-250 秒）
- 記憶體使用：僅已出題歌曲佔用記憶體（如 100 首歌玩 20 輪 = 僅 20 首初始化）
- 失敗容錯：初始化失敗的歌曲不影響整體遊戲

---

## Data Validation Rules

| 驗證項目 | 規則 | 錯誤處理 |
|---------|------|---------|
| AI 模型清單 | 至少一個 `IsEnabled = true` 且 `IsDefault = true` | 拋出 `InvalidOperationException` |
| 歌曲清單 | `Songs.Count > 0` | 顯示「無法解析歌單」錯誤訊息 |
| 歌詞片段長度 | 移除空白與標點後至少 5 字 | 重新隨機選擇位置或降級至下一首歌 |
| 答案輸入 | 不可為空字串 | 顯示「請輸入答案」提示 |
| 歌曲初始化 | 最多重試 3 次 | 標記 `InitializationFailed = true` 並跳過 |

---

## Memory & Performance Considerations

**記憶體估算**:
```
單首歌曲記憶體佔用：
- 基本資訊（Title + Artist）：~100 bytes
- 完整歌詞（Lyrics）：~1-3 KB

場景範例（100 首歌，玩 20 輪）：
- 第一階段（所有歌曲基本資訊）：100 × 100 bytes = 10 KB
- 第二階段（已初始化歌曲）：20 × 2 KB = 40 KB
- 總計：~50 KB（可接受）

極端場景（500 首歌，全部初始化）：
- 基本資訊：500 × 100 bytes = 50 KB
- 全部歌詞：500 × 2 KB = 1 MB
- 總計：~1.05 MB（仍可接受）
```

**效能優化**:
- 延遲初始化：避免大量歌曲一次性載入
- HashSet 查找：`UsedSongIndices` 與 `FailedSongIndices` 使用 HashSet 提供 O(1) 查找效能
- 頁面重新整理清空：避免記憶體洩漏

---

## Related Documents

- [spec.md](spec.md) - 完整功能規格
- [research.md](research.md) - 技術研究與決策
- [Decision.md](../../docs/intent/002-lyrics-guess-game/Decision.md) - 設計決策記錄
- [contracts/](contracts/) - API 契約定義

---

## Change History

| 日期 | 版本 | 變更內容 |
|------|------|---------|
| 2026-02-11 | v1.0 | 初始版本，定義核心實體與延遲初始化機制 |
