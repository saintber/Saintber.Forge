# Tasks: Lyrics Guess Game

**Input**: Design documents from `/specs/002-lyrics-guess-game/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, quickstart.md

**Tests & TDD Requirements**: 
- Tests are MANDATORY for all logic within TDD scope (Domain Logic, Application Service, Validation Rules)
- Tests MUST be written FIRST (Red → Green → Refactor) and MUST FAIL before implementation
- Tests are OPTIONAL only for: pure UI styling, one-time data scripts, static content without logic
- See `.specify/memory/constitution.md` Principle 11 and `docs/policy/testing-governance.md` for complete TDD requirements

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

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

- [X] T010 [P] Unit test for Song model validation in `tests/.../UnitTests/Models/SongTests.cs` (MUST FAIL initially)
- [X] T011 [P] Create Song model in `src/Tools/.../Abstractions/Models/Song.cs`
- [X] T012 [P] Unit test for Question model in `tests/.../UnitTests/Models/QuestionTests.cs` (MUST FAIL initially)
- [X] T013 [P] Create Question model with QuestionState enum in `src/Tools/.../Abstractions/Models/Question.cs`
- [X] T014 [P] Unit test for GameState model in `tests/.../UnitTests/Models/GameStateTests.cs` (MUST FAIL initially)
- [X] T015 [P] Create GameState model in `src/Tools/.../Abstractions/Models/GameState.cs`
- [X] T016 [P] Create AIModelConfig model in `src/Tools/.../Abstractions/Models/AIModelConfig.cs`
- [X] T017 [P] Create AnswerValidationResult model with SimilarityType enum in `src/Tools/.../Abstractions/Models/AnswerValidationResult.cs`
- [X] T018 [P] Create AIServiceException in `src/Tools/.../Abstractions/Exceptions/AIServiceException.cs`

### Service Interfaces

- [X] T019 [P] Create IAIServiceProvider interface in `src/Tools/.../Abstractions/IAIServiceProvider.cs`
- [X] T020 [P] Create ILyricsGuessGameService interface in `src/Tools/.../Abstractions/ILyricsGuessGameService.cs`

### Configuration

- [X] T021 Create LyricsGuessGameConfig class in `src/Tools/.../BLL/Config/LyricsGuessGameConfig.cs`
- [X] T022 Update `appsettings.json` with Copilot and LyricsGuessGame sections per quickstart.md

### Service Implementations (TDD: Write tests FIRST)

- [X] T023 Unit test for CopilotAIServiceProvider.ParseStructuredDataAsync in `tests/.../UnitTests/Services/CopilotAIServiceProviderTests.cs` (MUST FAIL initially)
- [X] T024 Unit test for CopilotAIServiceProvider.GenerateTextAsync in `tests/.../UnitTests/Services/CopilotAIServiceProviderTests.cs` (MUST FAIL initially)
- [X] T025 Unit test for CopilotAIServiceProvider.ValidateAnswerAsync in `tests/.../UnitTests/Services/CopilotAIServiceProviderTests.cs` (MUST FAIL initially)
- [X] T026 Implement CopilotAIServiceProvider skeleton in `src/Tools/.../BLL/CopilotAIServiceProvider.cs`
- [X] T027 Implement ParseStructuredDataAsync method with JSON deserialization and timeout handling
- [X] T028 Implement GenerateTextAsync method with event-based streaming
- [X] T029 Implement ValidateAnswerAsync method with prompt engineering for answer validation
- [X] T030 Refactor: Extract common error handling and timeout logic

### Game Service (TDD: Write tests FIRST)

- [X] T031 Unit test for LyricsGuessGameService.ParsePlaylistBasicInfoAsync in `tests/.../UnitTests/Services/LyricsGuessGameServiceTests.cs` (MUST FAIL initially, use Mock IAIServiceProvider)
- [X] T032 Unit test for LyricsGuessGameService.InitializeSongLyricsAsync in `tests/.../UnitTests/Services/LyricsGuessGameServiceTests.cs` (MUST FAIL initially)
- [X] T033 Unit test for LyricsGuessGameService.GenerateQuestionAsync in `tests/.../UnitTests/Services/LyricsGuessGameServiceTests.cs` (MUST FAIL initially)
- [X] T034 Unit test for LyricsGuessGameService.ValidateAnswerAsync in `tests/.../UnitTests/Services/LyricsGuessGameServiceTests.cs` (MUST FAIL initially)
- [X] T035 Implement LyricsGuessGameService skeleton in `src/Tools/.../BLL/LyricsGuessGameService.cs`
- [X] T036 Implement ParsePlaylistBasicInfoAsync method (call AI for song/artist parsing)
- [X] T037 Implement InitializeSongLyricsAsync method (delayed lyrics loading)
- [X] T038 Implement GenerateQuestionAsync method (random lyrics snippet selection)
- [X] T039 Implement ValidateAnswerAsync method (delegate to AI service)
- [X] T040 Refactor: Extract lyrics splitting and snippet building logic

### DI Registration

- [X] T041 Register CopilotClient (singleton) in `src/Frontend/Saintber.Forge.BlazorServer/Program.cs`
- [X] T042 Register IAIServiceProvider → CopilotAIServiceProvider (scoped) in Program.cs
- [X] T043 Register ILyricsGuessGameService → LyricsGuessGameService (scoped) in Program.cs
- [X] T044 Bind LyricsGuessGameConfig from appsettings.json in Program.cs

**Checkpoint**: Foundation complete - all services testable via mocks, all tests GREEN

---

## Phase 3: User Story 1 - 輸入歌單並開始遊戲 (Priority: P1) 🎯 MVP

**Goal**: 使用者輸入歌單文字，系統解析歌曲資訊，隨機出題顯示歌詞片段

**Independent Test**: 輸入「晴天 周杰倫\n七里香\n稻香」，驗證解析成功並顯示第一題

### UI Components (Tests optional for UI layout, MANDATORY for interaction logic)

- [X] T045 [P] [US1] Create PlaylistInputDialog component in `src/Frontend/.../Components/PlaylistInputDialog.razor`
- [X] T046 [P] [US1] Create PlaylistViewDialog component in `src/Frontend/.../Components/PlaylistViewDialog.razor`
- [X] T047 [US1] Create LyricsGuessGame main page in `src/Frontend/.../Pages/LyricsGuessGame.razor`

### UI Logic (TDD: Test interaction logic)

- [X] T048 [US1] Unit test for HandlePlaylistConfirmAsync (parse success) in `tests/.../UnitTests/Pages/LyricsGuessGameTests.cs` (MUST FAIL initially, use Mock ILyricsGuessGameService)
- [X] T049 [US1] Unit test for HandlePlaylistConfirmAsync (parse failure) in `tests/.../UnitTests/Pages/LyricsGuessGameTests.cs`
- [X] T050 [US1] Implement HandlePlaylistConfirmAsync method in LyricsGuessGame.razor (call ParsePlaylistBasicInfoAsync)
- [X] T051 [US1] Unit test for StartNextQuestionAsync (song selection + lyrics initialization) in `tests/.../UnitTests/Pages/LyricsGuessGameTests.cs` (MUST FAIL initially)
- [X] T052 [US1] Implement StartNextQuestionAsync method (random song selection, lazy load lyrics, generate question)
- [X] T053 [US1] Add error handling for initialization failures (retry up to 3 times per spec edge case)
- [X] T054 [US1] Add UI loading states ("正在解析歌單..." and "正在載入歌詞...")
- [X] T055 [US1] Add "查看歌單" button and dialog display logic
- [X] T056 [US1] Implement playlist overwrite logic (clear previous state on new input)

**Checkpoint**: US1 complete - can input playlist, parse songs, display first question

---

## Phase 4: User Story 2 - 提交答案並獲得即時判定 (Priority: P1)

**Goal**: 使用者輸入答案，系統判定並給予回饋，答對後自動進入下一題

**Independent Test**: 輸入正確答案驗證顯示「答對了！」並進入下一題，錯誤答案顯示提示

### UI & Logic (TDD: Test answer validation flow)

- [ ] T057 [US2] Unit test for SubmitAnswerAsync (correct answer) in `tests/.../UnitTests/Pages/LyricsGuessGameTests.cs` (MUST FAIL initially)
- [ ] T058 [US2] Unit test for SubmitAnswerAsync (wrong answer with hints) in `tests/.../UnitTests/Pages/LyricsGuessGameTests.cs`
- [ ] T059 [US2] Unit test for SubmitAnswerAsync (validation error handling) in `tests/.../UnitTests/Pages/LyricsGuessGameTests.cs`
- [ ] T060 [US2] Add answer input field and submit button to LyricsGuessGame.razor
- [ ] T061 [US2] Implement SubmitAnswerAsync method (call ValidateAnswerAsync, display feedback)
- [ ] T062 [US2] Implement feedback display logic (答對了! / 風格很像但不是 / 只差一個字 / 不對喔！)
- [ ] T063 [US2] Implement auto-advance to next question on correct answer
- [ ] T064 [US2] Add validation error handling with retry option
- [ ] T065 [US2] Clear answer input after each submission

**Checkpoint**: US2 complete - answer validation and feedback working, auto-advance on correct answer

---

## Phase 5: User Story 3 - 公佈答案並進入下一題 (Priority: P2)

**Goal**: 使用者可點擊「公佈答案」查看正確答案並進入下一題

**Independent Test**: 點擊公佈答案，驗證顯示歌名+演唱者並自動進入下一題

### UI & Logic

- [ ] T066 [US3] Add "公佈答案" button to LyricsGuessGame.razor
- [ ] T067 [US3] Implement RevealAnswerAsync method (display correct answer, auto-advance after delay)
- [ ] T068 [US3] Ensure revealed songs are excluded from future questions in current game session
- [ ] T069 [US3] Add game end detection (all songs completed)
- [ ] T070 [US3] Implement "遊戲結束" message with restart options

**Checkpoint**: US3 complete - reveal answer functionality working, game end detection in place

---

## Phase 6: User Story 4 - 選擇 AI 模型進行互動 (Priority: P3)

**Goal**: 使用者可從下拉選單選擇 AI 模型，系統使用選定的模型

**Independent Test**: 切換模型後驗證下一次 AI 呼叫使用新模型

### UI & Logic

- [ ] T071 [P] [US4] Add AI model selection dropdown to LyricsGuessGame.razor
- [ ] T072 [US4] Load available models from LyricsGuessGameConfig into dropdown
- [ ] T073 [US4] Implement model selection change handler
- [ ] T074 [US4] Add error handling for model-specific failures with fallback message

**Checkpoint**: US4 complete - model selection working, errors handled gracefully

---

## Phase 7: User Story 5 - 重新輸入歌單並覆蓋先前內容 (Priority: P3)

**Goal**: 使用者可隨時重新輸入歌單，系統清空舊資料並重新開始

**Independent Test**: 遊戲進行中輸入新歌單，驗證舊資料被清空

### UI & Logic

- [ ] T075 [US5] Ensure "輸入歌單" button always visible during gameplay
- [ ] T076 [US5] Implement state reset logic (clear songs, questions, used indices)
- [ ] T077 [US5] Add confirmation dialog for reset (optional: prevent accidental reset)

**Checkpoint**: US5 complete - playlist reset working, all user stories functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T078 [P] Update README.md with Lyrics Guess Game section in `docs/README.md`
- [ ] T079 [P] Add XML documentation to IAIServiceProvider interface
- [ ] T080 [P] Add XML documentation to ILyricsGuessGameService interface
- [ ] T081 Verify timeout settings match quickstart.md (ParsePlaylist: 10s, FetchLyrics: 5s, ValidateAnswer: 5s)
- [ ] T082 Review error messages for user-friendliness
- [ ] T083 Execute quickstart.md validation (follow guide step-by-step)
- [ ] T084 [P] Verify GITHUB_TOKEN loaded from environment variable (security check - already implemented)
- [ ] T085 Run `dotnet restore` (Gate A verification)
- [ ] T086 Run `dotnet build` (Gate A verification - must have 0 errors)
- [ ] T087 Run `dotnet test` (Gate A verification - all tests must pass)
- [ ] T088 Create Verification Record in `docs/plan/verification/002-lyrics-guess-game-initial.verify.md`

**Checkpoint**: All polish tasks complete, ready for Gate B verification

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - Integrates with US1 but independently testable (can mock question state)
- **User Story 3 (P2)**: Can start after Foundational - Uses US1 question display but independently testable
- **User Story 4 (P3)**: Can start after Foundational - Independent model selection feature
- **User Story 5 (P3)**: Can start after Foundational - Independent reset feature

### Within Each User Story (TDD Flow)

- **TDD Red**: Write tests FIRST for all logic in TDD scope - tests MUST FAIL initially
- **TDD Green**: Implement minimum code to make tests pass
- **TDD Refactor**: Clean up code while keeping tests green
- Models/Services tests before UI logic tests
- UI interaction logic tests before UI implementation
- Core implementation before integration
- Story complete (all tests green) before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational model creation tasks (T010-T018) can run in parallel
- Interface creation tasks (T019-T020) can run in parallel
- Service test creation tasks (T023-T025, T031-T034) can run in parallel AFTER interfaces exist
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Different user stories can be worked on in parallel by different team members
- Polish documentation tasks (T078-T080) can run in parallel

---

## Parallel Example: Foundational Phase

```bash
# After interfaces are created, launch all service tests together (TDD Red):
Task: "Unit test for CopilotAIServiceProvider.ParseStructuredDataAsync" (T023)
Task: "Unit test for CopilotAIServiceProvider.GenerateTextAsync" (T024)
Task: "Unit test for CopilotAIServiceProvider.ValidateAnswerAsync" (T025)
Task: "Unit test for LyricsGuessGameService.ParsePlaylistBasicInfoAsync" (T031)
Task: "Unit test for LyricsGuessGameService.InitializeSongLyricsAsync" (T032)
Task: "Unit test for LyricsGuessGameService.GenerateQuestionAsync" (T033)
Task: "Unit test for LyricsGuessGameService.ValidateAnswerAsync" (T034)

# Then implement all methods together (TDD Green):
Task: "Implement CopilotAIServiceProvider methods" (T026-T029)
Task: "Implement LyricsGuessGameService methods" (T035-T039)
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (playlist input and question display)
4. Complete Phase 4: User Story 2 (answer validation)
5. **STOP and VALIDATE**: Test US1+US2 independently (input playlist → answer questions → validate)
6. Deploy/demo if ready (**Minimum Viable Product**)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready **[TDD: All foundational tests GREEN]**
2. Add User Story 1 + 2 → Test independently → Deploy/Demo (MVP!) **[TDD: US1+US2 tests GREEN]**
3. Add User Story 3 → Test independently → Deploy/Demo **[TDD: US3 tests GREEN]**
4. Add User Story 4 + 5 → Test independently → Deploy/Demo **[TDD: US4+US5 tests GREEN]**
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (TDD: pair on tests, split on implementation)
2. Once Foundational is done:
   - Developer A: User Story 1 + 2 (MVP core)
   - Developer B: User Story 3
   - Developer C: User Story 4 + 5
3. Stories complete and integrate independently

---

## TDD Compliance Checklist

**Before marking ANY implementation task complete, verify:**

- [ ] Corresponding test task (T0XX) was completed FIRST
- [ ] Test initially FAILED (Red phase verified)
- [ ] Test now PASSES after implementation (Green phase achieved)
- [ ] Code has been refactored for clarity while maintaining green tests
- [ ] No implementation logic exists without corresponding tests
- [ ] Mock dependencies used appropriately (IAIServiceProvider mocked in game service tests)

**TDD Scope Reminder** (from Constitution Principle 11):

✅ **MANDATORY TDD**:
- All service methods (LyricsGuessGameService, CopilotAIServiceProvider)
- Model validation logic (Song initialization state, Question state transitions)
- Game state management logic
- Answer validation logic

❌ **OPTIONAL TDD**:
- Pure UI layout/styling (Blazor component markup)
- One-time configuration setup
- Static content display

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- **TDD CRITICAL**: Verify tests fail before implementing (Red phase)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- **Constitution Principle 11**: Tests MUST be written first for all logic
- **Constitution Principle 12**: Gate A (restore/build/test) MUST pass before declaring Done

---

## Gate A Verification (Before declaring "Done")

Run these commands and verify ALL pass:

```bash
dotnet restore                          # Must complete successfully
dotnet build                            # Must have 0 errors
dotnet test                             # All tests must pass
```

Create Verification Record documenting results in `docs/plan/verification/002-lyrics-guess-game-initial.verify.md`

**Status**: Done ONLY if Gate A passes + Verification Record exists + All TDD tests GREEN
