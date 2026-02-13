# Implementation Plan: Lyrics Guess Game

**Branch**: `002-lyrics-guess-game` | **Date**: 2026-02-11 | **Last Updated**: 2026-02-13 (v1.1) | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-lyrics-guess-game/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

建立以歌詞為基礎的猜歌互動遊戲，允許使用者輸入歌單、由 AI 解析歌名與演唱者、出題時即時節錄歌詞片段並判定答案。

**v1.1 重要變更**：因 AI 法規限制無法提供完整歌詞，改為每次出題時即時節錄歌詞片段（10字以上完整句子）

**技術方案**:
- 使用 **Blazor Server** 架構，僅保存歌名/演唱者於 Component 狀態變數（不保存歌詞）
- 透過 **GitHub Copilot SDK** 作為 AI 整合層，支援跨廠商模型（OpenAI、Anthropic）
- 採用 **即時節錄策略**：第一階段僅解析歌名/演唱者（5-10 秒），出題時即時向 AI 請求節錄歌詞片段（2-5 秒/題）
- 建立 `IAIServiceProvider` 抽象層，符合 Constitution Principle 5（契約介面）與 Principle 6（可替換性）

## Technical Context

**Language/Version**: C# 12 / .NET 8.0  
**Primary Dependencies**: Blazor Server, GitHub Copilot SDK, ASP.NET Core 8.0  
**Storage**: N/A（僅使用 Blazor Component 狀態變數保存歌名/演唱者，不保存歌詞或涉及資料庫）  
**Testing**: xUnit, Moq, FluentAssertions  
**Target Platform**: Web（Blazor Server over SignalR）  
**Project Type**: web  
**Performance Goals**: AI 歌單解析 < 10 秒（50 首歌）、AI 即時節錄歌詞 < 5 秒、答案判定 < 3 秒  
**Constraints**: SignalR ClientTimeout 30 秒、記憶體使用 < 1 MB（100 首歌僅保存歌名/演唱者）、符合 AI 使用政策（不保存完整歌詞）  
**Scale/Scope**: 支援 50+ 首歌曲歌單、跨廠商 AI 模型切換（OpenAI、Anthropic）、即時歌詞節錄成功率 80%+

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

檢視本功能是否符合 `.specify/memory/constitution.md` 定義的治理原則：

- [x] **Principle 3**: ✅ LyricsGuessGame Tool 可被獨立建置（獨立 .csproj）、驗證（獨立測試專案）與移除（刪除 Tool 目錄不影響其他功能）
- [x] **Principle 4**: ✅ 無跨 Tool 實作耦合，本 Tool 不依賴其他 Tool 的 BLL 或 DAL
- [x] **Principle 5**: ✅ 跨 Tool 互動透過 `IAIServiceProvider` 契約介面（定義於 Abstractions 層）
- [x] **Principle 6**: ✅ 業務能力設計保持可替換性（所有服務方法為 async、使用 CancellationToken、拋出明確異常型別，支援未來替換為微服務或 FaaS）
- [x] **Principle 7**: ✅ 使用依賴注入取得服務（Program.cs 註冊 `IAIServiceProvider` 與 `ILyricsGuessGameService`）
- [x] **Principle 8**: ✅ Presentation 邏輯集中於 BlazorServer 的 Pages/Components，Tool 層僅包含業務邏輯與資料模型
- [x] **Principle 11**: ✅ 採用 TDD 開發模式，核心邏輯（歌單解析、歌詞初始化、答案驗證、遊戲狀態管理）屬於 TDD 強制範圍，實作前需先撰寫測試（見 Testing 區段）
- [x] **Principle 12**: ✅ 完成定義包含 Gate A（restore/build/test 全部通過）與 Verification Record，所有測試需執行並通過才可宣告完成

**Phase 1 Re-check Result**: ✅ 所有治理原則皆已滿足，無違反事項。

**TDD Implementation Notes**:
- **Unit Tests** (TDD 強制範圍): 
  - `LyricsGuessGameService` 的所有公開方法（歌單解析、歌詞即時節錄、問題生成、答案驗證）
  - `CopilotAIServiceProvider` 的 AI 呼叫邏輯（使用 Mock CopilotClient）
  - 所有 Model 的驗證邏輯（如 `Song` 僅含歌名/演唱者、`Question.State` 狀態機）
- **Integration Tests** (可選但建議):
  - 完整遊戲流程（輸入歌單 → 解析 → 即時節錄 → 出題 → 答題 → 下一題）
  - AI 真實呼叫測試（需 GITHUB_TOKEN，可在 Gate B 手動執行）
  - AI 節錄失敗處理測試（模擬法規拒絕、重試邏輯）
- **UI Tests** (Gate B): 
  - Blazor 元件互動測試（bUnit）
  - RWD 測試（非 TDD 強制範圍，可在實作後補充）

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── Frontend/
│   └── Saintber.Forge.BlazorServer/
│       ├── Pages/
│       │   └── LyricsGuessGame.razor          # 遊戲主頁面
│       ├── Components/
│       │   ├── PlaylistInputDialog.razor     # 歌單輸入彈窗
│       │   └── PlaylistViewDialog.razor      # 歌單查看彈窗
│       └── appsettings.json                   # AI 模型設定
│
├── Tools/
│   └── LyricsGuessGame/
│       ├── Saintber.Forge.Tools.LyricsGuessGame.Abstractions/
│       │   ├── IAIServiceProvider.cs          # AI 服務契約介面
│       │   ├── ILyricsGuessGameService.cs     # 遊戲服務契約介面
│       │   ├── Models/
│       │   │   ├── Song.cs                    # 歌曲資料模型
│       │   │   ├── Question.cs                # 題目資料模型
│       │   │   ├── GameState.cs               # 遊戲狀態模型
│       │   │   ├── AIModelConfig.cs           # AI 模型設定模型
│       │   │   └── AnswerValidationResult.cs  # 答案驗證結果
│       │   └── Exceptions/
│       │       └── AIServiceException.cs       # AI 服務異常
│       │
│       └── Saintber.Forge.Tools.LyricsGuessGame.BLL/
│           ├── CopilotAIServiceProvider.cs    # Copilot SDK 實作（優先）
│           ├── LyricsGuessGameService.cs      # 遊戲邏輯服務
│           └── Config/
│               └── LyricsGuessGameConfig.cs   # 設定類別
│
tests/
└── Saintber.Forge.Tools.LyricsGuessGame.Tests/
    ├── Unit/
    │   ├── LyricsGuessGameServiceTests.cs
    │   └── CopilotAIServiceProviderTests.cs
    └── Integration/
        └── AIIntegrationTests.cs
```

**Structure Decision**: 本功能採用 **Web Application** 架構，符合 Blazor Server 專案結構。Tool 層級專案（Abstractions + BLL）獨立於 Frontend，符合 Constitution Principle 3（Tool 獨立性）。不涉及後端 API 或資料庫層。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
