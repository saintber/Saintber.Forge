# Tasks: Lyrics Guess Game

**Feature Version**: v1.1 (2026-02-13) - 即時節錄歌詞策略  
**Input**: Design documents from `/specs/002-lyrics-guess-game/`  
**Prerequisites**: plan.md (v1.1), spec.md (v1.1), data-model.md, contracts/, research.md (v1.1), quickstart.md

**v1.1 重要變更**:
- **AI 法規限制**: 無法提供完整歌詞，改為每次出題時即時節錄歌詞片段（10字以上完整句子）
- **不保存歌詞**: Song 模型僅含 Title/Artist/CanGenerateQuestion，移除 Lyrics 和 InitializationFailed 欄位
- **即時節錄策略**: 出題時呼叫 AI 節錄歌詞片段，不進行保存或快取
- **記憶體優化**: 100 首歌從 ~1 MB 降至 ~10 KB（降低 99%）

**Tests & TDD Requirements**: 
- Tests are MANDATORY for all logic within TDD scope (Domain Logic, Application Service, Validation Rules)
- Tests MUST be written FIRST (Red → Green → Refactor) and MUST FAIL before implementation
- Tests are OPTIONAL only for: pure UI styling, one-time data scripts, static content without logic
- See `.specify/memory/constitution.md` Principle 11 and `docs/policy/testing-governance.md` for complete TDD requirements

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story?] Description`

- **Checkbox**: `- [ ]` for not started, `- [X]` for completed
- **[ID]**: Sequential task ID (T001, T002, ...)
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md project structure:
- Tool projects: `src/Tools/LyricsGuessGame/`
- Frontend: `src/Frontend/Saintber.Forge.BlazorServer/`
- Tests: `tests/Saintber.Forge.Tools.LyricsGuessGame.UnitTests/` and `tests/Saintber.Forge.Tools.LyricsGuessGame.IntegrationTests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create Abstractions project: `src/Tools/LyricsGuessGame/Saintber.Forge.Tools.LyricsGuessGame.Abstractions/Saintber.Forge.Tools.LyricsGuessGame.Abstractions.csproj`
- [X] T002 Create BLL project: `src/Tools/LyricsGuessGame/Saintber.Forge.Tools.LyricsGuessGame.BLL/Saintber.Forge.Tools.LyricsGuessGame.BLL.csproj`
- [X] T003 [P] Create UnitTests project: `tests/Saintber.Forge.Tools.LyricsGuessGame.UnitTests/Saintber.Forge.Tools.LyricsGuessGame.UnitTests.csproj`
- [X] T004 [P] Create IntegrationTests project: `tests/Saintber.Forge.Tools.LyricsGuessGame.IntegrationTests/Saintber.Forge.Tools.LyricsGuessGame.IntegrationTests.csproj`
- [X] T005 Install GitHub.Copilot.SDK package (version 0.1.23) to BLL project
- [X] T006 [P] Install xUnit, Moq, FluentAssertions packages to UnitTests project
- [X] T007 [P] Install xUnit, Microsoft.AspNetCore.Mvc.Testing to IntegrationTests project
- [X] T008 Add project references: BLL → Abstractions, UnitTests → BLL + Abstractions
- [X] T009 Add projects to solution: `dotnet sln add` all four projects

**Checkpoint**: Foundation ready - all projects compile successfully

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Models & Exceptions (TDD: Write tests FIRST for validation logic)

- [X] T010 [P] **[v1.1 調整]** Update Song model tests in `tests/.../UnitTests/Models/SongTests.cs` - 移除 Lyrics/InitializationFailed 驗證，新增 CanGenerateQuestion 測試
- [X] T011 [P] **[v1.1 調整]** Update Song model in `src/Tools/.../Abstractions/Models/Song.cs` - 移除 Lyrics (string?) 和 InitializationFailed (bool)，新增 CanGenerateQuestion (bool，預設 true)，移除 IsInitialized 計算屬性
- [X] T012 [P] Unit test for Question model in `tests/.../UnitTests/Models/QuestionTests.cs` (MUST FAIL initially)
- [X] T013 [P] Create Question model with QuestionState enum in `src/Tools/.../Abstractions/Models/Question.cs`
- [X] T014 [P] **[v1.1 調整]** Update GameState model tests in `tests/.../UnitTests/Models/GameStateTests.cs` - 移除 FailedSongIndices 測試
- [X] T015 [P] **[v1.1 調整]** Update GameState model in `src/Tools/.../Abstractions/Models/GameState.cs` - 移除 FailedSongIndices (HashSet<int>)
- [X] T016 [P] Create AIModelConfig model in `src/Tools/.../Abstractions/Models/AIModelConfig.cs`
- [X] T017 [P] Create AnswerValidationResult model with SimilarityType enum in `src/Tools/.../Abstractions/Models/AnswerValidationResult.cs`
- [X] T018 [P] Create AIServiceException in `src/Tools/.../Abstractions/Exceptions/AIServiceException.cs`

### Service Interfaces

- [X] T019 [P] Create IAIServiceProvider interface in `src/Tools/.../Abstractions/IAIServiceProvider.cs` - ParseStructuredDataAsync, GenerateTextAsync
- [X] T020 [P] **[v1.1 調整]** Update ILyricsGuessGameService interface in `src/Tools/.../Abstractions/ILyricsGuessGameService.cs` - 移除 InitializeSongLyricsAsync，新增 GenerateLyricsSnippetAsync (Song, modelId) → string?，將 GenerateQuestionAsync 改名為 GenerateRandomQuestionAsync

### Configuration

- [X] T021 Create LyricsGuessGameConfig class in `src/Tools/.../BLL/Config/LyricsGuessGameConfig.cs`
- [X] T022 Update `appsettings.json` with Copilot (GitHub Token) and LyricsGuessGame (AIModels, Timeouts) sections per quickstart.md

### Service Implementations (TDD: Write tests FIRST)

- [X] T023 [P] Unit test for CopilotAIServiceProvider.ParseStructuredDataAsync in `tests/.../UnitTests/Services/CopilotAIServiceProviderTests.cs` (MUST FAIL initially)
- [X] T024 [P] Unit test for CopilotAIServiceProvider.GenerateTextAsync in `tests/.../UnitTests/Services/CopilotAIServiceProviderTests.cs` (MUST FAIL initially)
- [X] T025 [P] Unit test for CopilotAIServiceProvider JSON extraction via ParseStructuredDataAsync in `tests/.../UnitTests/Services/CopilotAIServiceProviderTests.cs` (MUST FAIL initially)
- [X] T026 Implement CopilotAIServiceProvider skeleton in `src/Tools/.../BLL/CopilotAIServiceProvider.cs` with Session-based API (CreateSessionAsync, On events, SendAsync)
- [X] T027 Implement ParseStructuredDataAsync method - use Session API, extract JSON from markdown, deserialize with timeout handling
- [X] T028 Implement GenerateTextAsync method - use Session API with event-based streaming (AssistantMessageEvent + SessionIdleEvent)
- [X] T029 Ensure CopilotAIServiceProvider stays domain-agnostic (common AI calls only)
- [X] T030 Refactor: Extract common EnsureStartedAsync, SendPromptAsync helper, ExtractJson utility

### Game Service (TDD: Write tests FIRST)

- [X] T031 Unit test for LyricsGuessGameService.ParsePlaylistBasicInfoAsync in `tests/.../UnitTests/Services/LyricsGuessGameServiceTests.cs` (MUST FAIL initially, use Mock IAIServiceProvider)
- [X] T032 [P] **[v1.1 新增]** Unit test for LyricsGuessGameService.GenerateLyricsSnippetAsync in `tests/.../UnitTests/Services/LyricsGuessGameServiceTests.cs` - 測試成功節錄、失敗標記 CanGenerateQuestion、法規拒絕處理
- [X] T033 [P] **[v1.1 調整]** Update unit test for LyricsGuessGameService.GenerateRandomQuestionAsync in `tests/.../UnitTests/Services/LyricsGuessGameServiceTests.cs` - 測試即時節錄整合、跳過無法節錄的歌曲、重試邏輯
- [X] T034 Unit test for LyricsGuessGameService.ValidateAnswerAsync in `tests/.../UnitTests/Services/LyricsGuessGameServiceTests.cs` (MUST FAIL initially)
- [X] T035 Implement LyricsGuessGameService skeleton in `src/Tools/.../BLL/LyricsGuessGameService.cs`
- [X] T036 Implement ParsePlaylistBasicInfoAsync method - call AI to parse "歌名/演唱者" only (不含歌詞)，所有歌曲預設 CanGenerateQuestion = true
- [X] T037 **[v1.1 新增]** Implement GenerateLyricsSnippetAsync method - 呼叫 AI 節錄歌詞片段（10字以上完整句子），失敗時設定 song.CanGenerateQuestion = false，不保存歌詞內容
- [X] T038 **[v1.1 調整]** Implement GenerateRandomQuestionAsync method - 隨機選歌 → 呼叫 GenerateLyricsSnippetAsync 即時節錄 → 建立 Question（節錄失敗則重試最多 3 次）
- [X] T039 Implement ValidateAnswerAsync method - compose prompt and call ParseStructuredDataAsync
- [X] T040 Implement GetAvailableModels and GetDefaultModelId methods - load from LyricsGuessGameConfig

### DI Registration

- [X] T041 Register CopilotClient (singleton with GitHub Token from env/config) in `src/Frontend/Saintber.Forge.BlazorServer/Program.cs`
- [X] T042 Register IAIServiceProvider → CopilotAIServiceProvider (scoped) in Program.cs
- [X] T043 Register ILyricsGuessGameService → LyricsGuessGameService (scoped) in Program.cs
- [X] T044 Bind LyricsGuessGameConfig from appsettings.json using IOptions pattern in Program.cs

**Checkpoint**: Foundation complete - all services testable via mocks, all tests GREEN

---

## Phase 3: User Story 1 - 輸入歌單並開始遊戲 (Priority: P1) 🎯 MVP

**Goal**: 使用者輸入歌單文字，系統解析歌名/演唱者（第一階段），隨機選歌並即時節錄歌詞片段顯示題目（第二階段）

**Independent Test**: 輸入「晴天 周杰倫\n七里香\n稻香」，驗證解析成功（5-10 秒），顯示「正在出題...」後顯示第一題歌詞片段（2-5 秒）

### UI Components (Tests optional for UI layout, MANDATORY for interaction logic)

- [X] T045 [P] [US1] Create PlaylistInputDialog component in `src/Frontend/.../Components/PlaylistInputDialog.razor` - 多行文字方塊 + 確認/取消按鈕
- [X] T046 [P] [US1] **[v1.1 調整]** Create PlaylistViewDialog component in `src/Frontend/.../Components/PlaylistViewDialog.razor` - 彈窗顯示「歌名 - 演唱者」清單，**不顯示** CanGenerateQuestion 狀態（避免洩漏答案）
- [X] T047 [US1] Create LyricsGuessGame main page in `src/Frontend/.../Pages/LyricsGuessGame.razor` - 含「輸入歌單」、「查看歌單」按鈕與題目顯示區域

### UI Logic (TDD: Test interaction logic)

- [X] T048 [US1] Unit test for HandlePlaylistConfirmAsync (parse success) in `tests/Saintber.Forge.BlazorServer.UnitTests/Pages/LyricsGuessGameTests.cs` (MUST FAIL initially, use Mock ILyricsGuessGameService)
- [X] T049 [US1] Unit test for HandlePlaylistConfirmAsync (parse failure) in `tests/.../UnitTests/Pages/LyricsGuessGameTests.cs`
- [X] T050 [US1] Implement HandlePlaylistConfirmAsync in LyricsGuessGame.razor - call ParsePlaylistBasicInfoAsync，顯示「正在解析歌單...」（5-10 秒），成功後顯示「查看歌單」按鈕
- [X] T051 [US1] **[v1.1 調整]** Unit test for StartNextQuestionAsync in `tests/.../UnitTests/Pages/LyricsGuessGameTests.cs` - 測試隨機選歌 + 即時節錄整合、節錄失敗重試邏輯
- [X] T052 [US1] **[v1.1 調整]** Implement StartNextQuestionAsync in LyricsGuessGame.razor - 呼叫 GenerateRandomQuestionAsync（含即時節錄），顯示「正在出題...」（2-5 秒），節錄成功後顯示歌詞片段
- [X] T053 [US1] **[v1.1 調整]** Add error handling for lyrics snippet generation failures - 節錄失敗重試最多 3 次，若連續失敗顯示「AI 服務暫時無法提供歌詞，請更換歌單或稍後再試」
- [X] T054 [US1] **[v1.1 調整]** Add UI loading states - 「正在解析歌單...」（第一階段）和「正在出題...」（第二階段即時節錄）
- [X] T055 [US1] Add「查看歌單」button and dialog display logic - 點擊後顯示 PlaylistViewDialog 彈窗
- [X] T056 [US1] Implement playlist overwrite logic - 點擊「輸入歌單」時清空 GameState (Songs, UsedSongIndices, CurrentQuestion)

**Checkpoint**: US1 complete - 可輸入歌單、解析歌名/演唱者、即時節錄歌詞並顯示第一題

---

## Phase 4: User Story 2 - 提交答案並獲得即時判定 (Priority: P1)

**Goal**: 使用者輸入答案，系統呼叫 AI 判定並給予即時回饋（答對了/風格很像但不是/只差一個字/不對喔），答對後自動進入下一題

**Independent Test**: 在題目顯示時輸入正確答案驗證顯示「答對了！」並自動進入下一題（含「正在出題...」等待），錯誤答案顯示對應提示

### UI & Logic (TDD: Test answer validation flow)

- [X] T057 [US2] Unit test for SubmitAnswerAsync (correct answer) in `tests/.../BlazorServer.UnitTests/Pages/LyricsGuessGameTests.cs` (MUST FAIL initially)
- [X] T058 [US2] Unit test for SubmitAnswerAsync (wrong answer with hints: CloseMatch, SameArtist, Unrelated) in `tests/.../UnitTests/Pages/LyricsGuessGameTests.cs`
- [X] T059 [US2] Unit test for SubmitAnswerAsync (AI validation error handling) in `tests/.../UnitTests/Pages/LyricsGuessGameTests.cs`
- [X] T060 [US2] Add answer input field and submit button to LyricsGuessGame.razor
- [X] T061 [US2] Implement SubmitAnswerAsync in LyricsGuessGame.razor - call ValidateAnswerAsync (3-5 秒)，根據 SimilarityType 顯示對應回饋
- [X] T062 [US2] Implement feedback display logic - 「答對了！」(Exact) / 「風格很像但不是」(SameArtist) / 「只差一個字」(CloseMatch) / 「不對喔！再猜一次」(Unrelated)
- [X] T063 [US2] **[v1.1 調整]** Implement auto-advance to next question on correct answer - 呼叫 StartNextQuestionAsync（含「正在出題...」+ 即時節錄 2-5 秒）
- [X] T064 [US2] Add AI validation error handling - 顯示「判定失敗，請重試」並允許重新提交或公佈答案
- [X] T065 [US2] Clear answer input and feedback after advancing to next question

**Checkpoint**: US2 complete - 答案驗證與回饋正常運作，答對後自動進入下一題（含即時節錄）

---

## Phase 5: User Story 3 - 公佈答案並進入下一題 (Priority: P2)

**Goal**: 使用者可點擊「公佈答案」查看正確答案（歌名 - 演唱者）並自動進入下一題

**Independent Test**: 在任意題目顯示時點擊「公佈答案」，驗證顯示歌名+演唱者，短暫停留後自動進入下一題（含「正在出題...」等待）

### UI & Logic

- [X] T066 [US3] Add「公佈答案」button to LyricsGuessGame.razor
- [X] T067 [US3] **[v1.1 調整]** Implement RevealAnswerAsync in LyricsGuessGame.razor - display correct answer, update Question.QuestionState = RevealedAnswer, 自動呼叫 StartNextQuestionAsync（含即時節錄）
- [X] T068 [US3] Ensure revealed songs are tracked in UsedSongIndices to prevent repeat in current session
- [X] T069 [US3] Add game end detection - 當所有歌曲皆已出題（UsedSongIndices.Count == Songs.Count）或所有歌曲皆無法節錄時顯示遊戲結束
- [X] T070 [US3] Implement「遊戲結束！所有歌曲已完成」message with「重新開始」or「輸入新歌單」options

**Checkpoint**: US3 complete - 公佈答案功能正常，遊戲結束偵測正確

---

## Phase 6: User Story 4 - 選擇 AI 模型進行互動 (Priority: P3)

**Goal**: 使用者可從下拉選單選擇 AI 模型（支援 OpenAI、Anthropic 等跨廠商模型），系統在後續 AI 呼叫中使用選定的模型

**Independent Test**: 切換模型（如從 GPT-4 切換至 Claude 3 Sonnet）後驗證下一次 AI 呼叫（解析歌單/節錄歌詞/判定答案）使用新模型

### UI & Logic

- [X] T071 [P] [US4] Add AI model selection dropdown to LyricsGuessGame.razor
- [X] T072 [US4] Load available models from ILyricsGuessGameService.GetAvailableModels() into dropdown (顯示 DisplayName，value 為 ModelId)
- [X] T073 [US4] Implement model selection change handler - update GameState.SelectedModelId
- [X] T074 [US4] Add error handling for model-specific failures - 「所選模型暫時無法使用，請切換其他模型或稍後再試」

**Checkpoint**: US4 complete - 模型選擇功能正常，錯誤處理完善

---

## Phase 7: User Story 5 - 重新輸入歌單並覆蓋先前內容 (Priority: P3)

**Goal**: 使用者可在遊戲進行中隨時點擊「輸入歌單」按鈕，系統清空舊資料並重新解析新歌單

**Independent Test**: 遊戲進行中輸入新歌單並確認，驗證舊歌單、題目、進度皆被清空並重新開始

### UI & Logic

- [X] T075 [US5] Ensure「輸入歌單」button always visible during gameplay
- [X] T076 [US5] Implement state reset logic in HandlePlaylistConfirmAsync - clear GameState.Songs, GameState.CurrentQuestion, GameState.UsedSongIndices before parsing new playlist
- [X] T077 [US5] Add confirmation dialog for reset (optional, to prevent accidental data loss) - 「確定要覆蓋目前的歌單與進度嗎？」

**Checkpoint**: US5 complete - 歌單覆蓋功能正常，所有使用者故事功能完整

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 改進與驗證，確保所有使用者故事品質

- [X] T078 [P] **[v1.1 更新]** Update README.md with v1.1 changes in `docs/README.md` - 說明即時節錄策略、記憶體優化、AI 法規限制
- [X] T079 [P] Add XML documentation to IAIServiceProvider interface methods
- [X] T080 [P] Add XML documentation to ILyricsGuessGameService interface methods
- [X] T081 **[v1.1 調整]** Verify timeout settings match quickstart.md - ParsePlaylist: 10s, **GenerateLyricsSnippet: 5s** (取代 FetchLyrics), ValidateAnswer: 5s
- [X] T082 Review error messages for user-friendliness - 特別檢查 AI 法規拒絕、節錄失敗的訊息
- [X] T083 Execute quickstart.md validation - 從頭到尾執行快速開始指南，驗證所有步驟正確
- [X] T084 [P] Verify GITHUB_TOKEN security - 確保從環境變數載入，不硬編碼於程式碼或簽入版控
- [X] T085 Run `dotnet restore` (Gate A verification)
- [X] T086 Run `dotnet build` (Gate A verification - must have 0 errors)
- [X] T087 Run `dotnet test` (Gate A verification - all tests must pass, verify TDD coverage for all logic)
- [X] T088 **[v1.1 更新]** Create Verification Record in `docs/plan/verification/002-lyrics-guess-game-v1.1.verify.md` - 記錄 v1.1 規格變更驗證結果

**Checkpoint**: All polish tasks complete, ready for Gate B verification

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately ✅ COMPLETED
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories ⚠️ **需更新為 v1.1**
- **User Stories (Phase 3-7)**: All depend on Foundational (v1.1) phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (v1.1) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (v1.1) - Integrates with US1 but independently testable
- **User Story 3 (P2)**: Can start after US1+US2 - Uses question display & answer validation
- **User Story 4 (P3)**: Can start after Foundational (v1.1) - Independent model selection feature
- **User Story 5 (P3)**: Can start after Foundational (v1.1) - Independent reset feature

### v1.1 Migration Strategy (針對已完成的任務)

**已完成但需調整的任務** (Phase 2):

1. **Models**: T010-T011 (Song), T014-T015 (GameState) - 移除舊欄位，新增 CanGenerateQuestion
2. **Service Interface**: T020 (ILyricsGuessGameService) - 移除 InitializeSongLyricsAsync，新增 GenerateLyricsSnippetAsync
3. **Service Tests**: T032 (InitializeSongLyricsAsync → GenerateLyricsSnippetAsync), T033 (GenerateQuestionAsync → GenerateRandomQuestionAsync)
4. **Service Implementation**: T037 (InitializeSongLyricsAsync → GenerateLyricsSnippetAsync), T038 (GenerateQuestionAsync → GenerateRandomQuestionAsync 含即時節錄)

**建議執行順序**:

```
1. 更新測試 (T010, T014, T032, T033) - TDD Red: 確保舊測試失敗
2. 更新模型 (T011, T015) - 移除舊欄位
3. 更新介面 (T020) - 移除/新增方法
4. 更新實作 (T037, T038) - 實作即時節錄邏輯
5. 驗證測試 - TDD Green: 確保新測試通過
6. 繼續 User Stories (Phase 3-7)
```

### Within Each User Story (TDD Flow)

- **TDD Red**: Write tests FIRST for all logic in TDD scope - tests MUST FAIL initially
- **TDD Green**: Implement minimum code to make tests pass
- **TDD Refactor**: Clean up code while keeping tests green
- Models/Services tests before UI logic tests
- UI interaction logic tests before UI implementation
- Core implementation before integration
- Story complete (all tests green) before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel ✅ COMPLETED
- All Foundational model/interface creation tasks (T010-T020) can run in parallel after understanding v1.1 changes
- Service test creation tasks (T023-T025, T031-T034) can run in parallel AFTER interfaces updated
- Once Foundational (v1.1) phase completes, US1-US5 can start in parallel (if team capacity allows)
- Different user stories can be worked on in parallel by different team members
- Polish documentation tasks (T078-T080) can run in parallel

---

## Parallel Example: User Story 1 (v1.1)

```bash
# After Foundational (v1.1) complete, launch UI components together:
Task T045: "Create PlaylistInputDialog component"
Task T046: "Create PlaylistViewDialog component (不顯示 CanGenerateQuestion)"
Task T047: "Create LyricsGuessGame main page"

# Then implement logic with TDD:
Task T048-T049: "Write tests for HandlePlaylistConfirmAsync" (TDD Red)
Task T050: "Implement HandlePlaylistConfirmAsync" (TDD Green)
Task T051: "Write tests for StartNextQuestionAsync (含即時節錄)" (TDD Red)
Task T052: "Implement StartNextQuestionAsync (含即時節錄)" (TDD Green)
```

---

## Implementation Strategy

### v1.1 Migration First (針對已完成的 v1.0 實作)

1. **Phase 2 Updates**: 更新已完成的 Foundational 任務以符合 v1.1 規格
   - Update Song/GameState models (T010-T011, T014-T015)
   - Update ILyricsGuessGameService interface (T020)
   - Update service tests (T032-T033)
   - Update service implementations (T037-T038)
2. **Validate**: 確保所有 Foundational 測試 GREEN（v1.1 版本）
### MVP First (User Story 1 + 2 Only)

1. Complete Phase 1: Setup ✅ COMPLETED
2. Complete Phase 2: Foundational v1.1 ⚠️ **需更新**
3. Complete Phase 3: User Story 1 (playlist input, instant lyrics snippet extraction, question display)
4. Complete Phase 4: User Story 2 (answer validation, auto-advance with instant extraction)
5. **STOP and VALIDATE**: Test US1+US2 independently (輸入歌單 → 即時節錄歌詞出題 → 答題 → 即時節錄下一題)
6. Deploy/demo if ready (**Minimum Viable Product with v1.1 instant extraction strategy**)

### Incremental Delivery

1. Complete Setup + Foundational v1.1 → Foundation ready **[TDD: All foundational tests GREEN]**
2. Add User Story 1 + 2 → Test independently → Deploy/Demo (MVP!) **[TDD: US1+US2 tests GREEN]**
3. Add User Story 3 → Test independently → Deploy/Demo **[TDD: US3 tests GREEN]**
4. Add User Story 4 + 5 → Test independently → Deploy/Demo **[TDD: US4+US5 tests GREEN]**
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers (after Foundational v1.1 complete):

1. Team completes Setup + Foundational v1.1 together (TDD: pair on tests, split on implementation)
2. Once Foundational v1.1 is done:
   - Developer A: User Story 1 + 2 (MVP core with instant extraction)
   - Developer B: User Story 3 (reveal answer)
   - Developer C: User Story 4 + 5 (model selection + reset)
3. Stories complete and integrate independently

---

## TDD Compliance Checklist

**Before marking ANY implementation task complete, verify:**

- [ ] Corresponding test task was completed FIRST
- [ ] Test initially FAILED (Red phase verified)
- [ ] Test now PASSES after implementation (Green phase achieved)
- [ ] Code has been refactored for clarity while maintaining green tests
- [ ] No implementation logic exists without corresponding tests
- [ ] Mock dependencies used appropriately (IAIServiceProvider mocked in game service tests)

**TDD Scope Reminder** (from Constitution Principle 11):

✅ **MANDATORY TDD**:
- All service methods (LyricsGuessGameService, CopilotAIServiceProvider)
- Model validation logic (Song.CanGenerateQuestion, Question state transitions)
- Game state management logic (random song selection, lyrics snippet generation retry)
- Answer validation logic

❌ **OPTIONAL TDD**:
- Pure UI layout/styling (Blazor component markup)
- One-time configuration setup
- Static content display

---

## v1.1 Specific Testing Focus

**Critical test scenarios for v1.1 changes:**

1. **GenerateLyricsSnippetAsync**:
   - ✅ 成功節錄 10字以上完整句子
   - ✅ AI 法規拒絕（回應「無法提供歌詞」）→ 設定 CanGenerateQuestion = false
   - ✅ 節錄片段少於 10 字 → 重試 2 次 → 失敗標記
   - ✅ 逾時處理（5 秒）

2. **GenerateRandomQuestionAsync**:
   - ✅ 隨機選歌 → 呼叫 GenerateLyricsSnippetAsync → 成功建立 Question
   - ✅ 節錄失敗 → 重新隨機選擇另一首歌 → 最多重試 3 次
   - ✅ 所有歌曲皆無法節錄或已出完 → 回傳 null

3. **UI Integration**:
   - ✅ StartNextQuestionAsync 顯示「正在出題...」（含即時節錄等待 2-5 秒）
   - ✅ 節錄失敗自動重試對使用者透明（不顯示錯誤除非重試耗盡）
   - ✅ 查看歌單不顯示 CanGenerateQuestion 狀態（避免洩漏答案）

---

## Notes

- **[v1.1 調整]**: 標記受 v1.1 規格變更影響的任務
- **[v1.1 新增]**: 標記 v1.1 新增的任務（如 GenerateLyricsSnippetAsync）
- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- **TDD CRITICAL**: Verify tests fail before implementing (Red phase)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **v1.1 記憶體優化**: 100 首歌從 ~1 MB (v1.0) 降至 ~10 KB (v1.1)，降低 99%
- **v1.1 符合 AI 使用政策**: 不保存完整歌詞，僅即時節錄片段用於遊戲互動

---

## Gate A Verification (Before declaring "Done")

Run these commands and verify ALL pass:

```bash
dotnet restore                          # Must complete successfully
dotnet build                            # Must have 0 errors
dotnet test                             # All tests must pass (including v1.1 updated tests)
```

Create Verification Record documenting v1.1 validation results in `docs/plan/verification/002-lyrics-guess-game-v1.1.verify.md`

**Status**: Done ONLY if Gate A passes + Verification Record exists + All TDD tests GREEN + v1.1 changes validated
