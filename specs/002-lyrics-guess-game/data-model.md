# Data Model: Lyrics Guess Game

**Feature**: 002-lyrics-guess-game  
**Date**: 2026-02-11  
**Purpose**: 定義 Lyrics Guess Game 的資料結構與關係

---

## Overview

本功能採用 **前端狀態管理** 策略，所有資料僅儲存於 Blazor Component 狀態變數（C# 記憶體）中，不涉及後端資料庫或瀏覽器持久化儲存。

**設計原則**:
- 資料生命週期：頁面載入時建立，頁面重新整理時清空
- 即時片段提取：歌詞片段僅在出題時動態提取（不快取完整歌詞）
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
| `Title` | `string` | ✅ | 歌曲名稱（AI 解析歌單時取得） |
| `Artist` | `string` | ✅ | 演唱者名稱（AI 解析歌單時取得） |
| `CanGenerateQuestion` | `bool` | ✅ | 標記該歌曲是否可用於出題（預設 `true`，若 AI 無法提取歌詞片段則設為 `false`） |

**狀態轉換**:
```
[建立] → Title/Artist 已設定, CanGenerateQuestion = true
   ↓
[選中出題] → 呼叫 AI 即時提取歌詞片段（10+ 字完整句子）
   ↓
[提取成功] → 建立 Question 物件，CanGenerateQuestion 維持 true
[提取失敗] → CanGenerateQuestion = false（該歌曲後續不再嘗試）
```

**驗證規則**:
- `Title` 與 `Artist` 不可同時為空字串

**範例資料**:
```csharp
// 正常歌曲（可出題）
new Song 
{ 
    Title = "晴天", 
    Artist = "周杰倫", 
    CanGenerateQuestion = true
}

// 提取失敗歌曲（不可出題）
new Song 
{ 
    Title = "稀有歌曲", 
    Artist = "未知歌手", 
    CanGenerateQuestion = false
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
| `Songs` | `List<Song>` | ✅ | 歌曲清單（AI 解析歌單後建立） |
| `CurrentQuestion` | `Question?` | ❌ | 當前題目（遊戲開始後建立） |
| `UsedSongIndices` | `HashSet<int>` | ✅ | 已出題的歌曲索引集合（避免重複出題） |
| `SelectedModelId` | `string` | ✅ | 使用者目前選擇的 AI 模型識別碼 |
| `IsPlaylistParsed` | `bool` | ✅ | 歌單是否已完成解析 |
| `IsGameActive` | `bool` | ✅ | 遊戲是否正在進行中 |

**狀態轉換**:
```
[初始狀態] 
  Songs = [], CurrentQuestion = null, UsedSongIndices = {}
  IsPlaylistParsed = false, IsGameActive = false
     ↓
[輸入歌單 + AI 解析] 
  Songs = [...], IsPlaylistParsed = true（所有歌曲 CanGenerateQuestion = true）
     ↓
[開始遊戲 + 首次出題]
  隨機選擇可用歌曲 → AI 即時提取片段 → CurrentQuestion = {...}, UsedSongIndices = {0}, IsGameActive = true
     ↓
[答對/公佈答案]
  CurrentQuestion = null → 重新隨機選歌 + AI 即時提取 → CurrentQuestion = {...}, UsedSongIndices = {0, 3}
     ↓
[所有歌曲已出完]
  IsGameActive = false
```

**驗證規則**:
- `UsedSongIndices` 中的索引值需在 `Songs` 的有效範圍內
- `IsGameActive = true` 時，`CurrentQuestion` 不可為 `null`

---

## Entity Relationships

```
GameState
  ├─ Songs (1..*)
  │   └─ Song
  │       ├─ Title
  │       ├─ Artist
  │       └─ CanGenerateQuestion
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

### 即時歌詞片段提取機制（v1.1）

**階段一：歌單解析（僅基本資訊）**
- 輸入：使用者輸入的歌單文字
- AI 處理：僅解析「歌名/演唱者」（**不包含歌詞**）
- 預期時間：5-10 秒（50 首歌）
- 輸出：`List<Song>`（所有歌曲僅含 Title/Artist，`CanGenerateQuestion = true`）

**階段二：出題時即時提取片段（隨需）**
- 觸發時機：隨機選中歌曲準備出題時
- AI 處理：**僅提取 10+ 字的完整句子片段**（不取得完整歌詞）
- 預期時間：2-5 秒（單首歌）
- 輸出：`Question` 物件（包含 `LyricsSnippet`），**不儲存於 Song 實體**
- 失敗處理：若 AI 無法提取片段，設定 `Song.CanGenerateQuestion = false`，自動重試其他歌曲（最多 3 次）

**v1.1 優勢**（相較 v1.0 延遲快取策略）:
- 記憶體大幅減少：**99% reduction**（100 首歌從 ~1 MB → ~10 KB）
- AI 政策合規：不快取完整歌詞，符合版權與使用政策
- 隱私優化：歌詞片段僅暫存於當前題目，答題後即釋放

---

## Data Validation Rules

| 驗證項目 | 規則 | 錯誤處理 |
|---------|------|---------|
| AI 模型清單 | 至少一個 `IsEnabled = true` 且 `IsDefault = true` | 拋出 `InvalidOperationException` |
| 歌曲清單 | `Songs.Count > 0` | 顯示「無法解析歌單」錯誤訊息 |
| 歌詞片段長度 | 移除空白與標點後至少 5 字 | 重新隨機選擇位置或降級至下一首歌 |
| 答案輸入 | 不可為空字串 | 顯示「請輸入答案」提示 |
| 歌詞片段提取 | 單首歌最多重試 2 次，整體最多嘗試 3 首歌 | 標記 `CanGenerateQuestion = false` 並跳過 |

---

## Memory & Performance Considerations

**記憶體估算（v1.1 即時提取策略）**:
```
單首歌曲記憶體佔用：
- 基本資訊（Title + Artist + CanGenerateQuestion）：~100 bytes
- 當前題目片段（LyricsSnippet in Question）：~50-200 bytes（僅 1 題暫存）

場景範例（100 首歌，玩 20 輪）：
- 所有歌曲基本資訊：100 × 100 bytes = 10 KB
- 當前題目片段：~200 bytes（僅 1 題）
- 總計：~10.2 KB（**99% reduction vs v1.0**）

極端場景（500 首歌，玩 100 輪）：
- 所有歌曲基本資訊：500 × 100 bytes = 50 KB
- 當前題目片段：~200 bytes（僅 1 題）
- 總計：~50.2 KB（**vs v1.0 的 1.05 MB，減少 95%+**）
```

**效能優化**:
- 即時提取：完全避免歌詞快取，記憶體佔用最小化
- HashSet 查找：`UsedSongIndices` 使用 HashSet 提供 O(1) 查找效能
- 頁面重新整理清空：避免記憶體洩漏
- 重試機制：單次提取失敗時，自動嘗試其他可用歌曲（最多 3 次）

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
| 2026-02-11 | v1.0 | 初始版本，定義核心實體與延遲初始化機制 || 2026-02-14 | v1.1 | 策略變更：從「延遲歌詞快取」改為「即時片段提取」<br/>- 移除 Song.Lyrics、Song.InitializationFailed<br/>- 新增 Song.CanGenerateQuestion<br/>- 移除 GameState.FailedSongIndices<br/>- 記憶體減少 99%（100 首歌：1 MB → 10 KB） |