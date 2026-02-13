# Decision: Lyrics Guess Game — Design & Policy Decisions

**Intent ID**: `002-lyrics-guess-game`  
**Related Intent**: `Intent.md`  
**Status**: Effective  
**Date**: 2026-02-13

---

## Decision Record Purpose

本文件記錄在「Lyrics Guess Game」功能中，  
為了落實 Intent 而所做出的**明確設計與政策性決策**。

本文件用於回答「為什麼這樣做」，  
而非描述「怎麼實作」（Implementation）或「要做什麼」（Specification）。

---

## D1. 存取模型（Access Model）

**Decision**  
本功能不區分登入與未登入狀態，所有使用者皆可使用完整遊戲功能。

**Rationale**
- 本功能定位為輕量、即開即玩的互動遊戲
- 登入流程將增加使用門檻，不符合體驗導向目標
- 功能不涉及個人資料、長期狀態或權限控管需求

**Consequences**
- 不依賴使用者身份或 Session
- 不與 Portal Home 的登入狀態產生耦合
- 不需處理使用者資料保存或同步問題

---

## D2. AI 呼叫方式

**Decision**  
所有 AI 相關能力皆透過自訂抽象層 `IAIServiceProvider` 呼叫，  
優先實作使用 **GitHub Copilot SDK** 的實作類別。

**Rationale**
- **抽象層設計**：符合 Constitution Principle 5（契約介面）與 Principle 6（可替換性），避免工具內部直接耦合特定 AI 供應商
- **Copilot SDK 優先**：GitHub Copilot 支援多廠商模型（OpenAI、Anthropic 等），提供跨供應商的統一介面
- **未來擴充性**：保留替換為其他實作的可能性（如 Azure OpenAI、本地模型、Semantic Kernel）
- **統一呼叫入口**：便於未來替換、擴充或停用特定 AI 模型

**Consequences**
- 功能本身不直接依賴 OpenAI、Azure OpenAI 或其他特定 SDK
- AI 能力視為外部服務，由抽象層負責錯誤處理與重試邏輯
- 優先實作 Copilot SDK，但設計上保持實作可替換性

**Implementation Priority**
1. **Phase 1**: 實作 `CopilotAIServiceProvider`（基於 GitHub Copilot SDK）
2. **Future**: 視需求擴充其他實作（`AzureOpenAIServiceProvider`、`LocalModelServiceProvider` 等）

---

## D3. AI 模型選擇機制

**Decision**  
提供下拉選單讓使用者於遊戲中選擇 AI 模型。

**Rationale**
- 不同 AI 模型在歌詞解析與語意判斷上可能有差異
- 提供使用者主動選擇權，有助於比較互動體驗
- 作為展示多模型支援能力的實際應用場景

**Consequences**
- UI 需顯示目前選用的 AI 模型
- 模型切換後，後續 AI 呼叫皆使用該模型
- 切換模型不影響已暫存的歌單資料（歌手/歌名）

---

## D4. AI 模型資料來源設計

**Decision**  
AI 模型資訊以結構化資料來源管理，而非硬編碼於程式中。

**Minimum Fields**
- **模型名稱（DisplayName）**: 對使用者友善的顯示名稱（如「GPT-4 Turbo（快速、準確）」）
- **模型識別碼（ModelId）**: AI SDK 實際呼叫時使用的識別字串（如「gpt-4-turbo」、「claude-3-sonnet"）
- **供應商（Provider）**: AI 模型的原始供應商（如「OpenAI」、「Anthropic」）
- **是否為預設模型（IsDefault）**: 標記系統啟動時預設選用的模型
- **是否啟用中（IsEnabled）**: 控制模型是否在下拉選單中顯示

**Copilot SDK 跨廠商支援考量**
- GitHub Copilot SDK 支援多種 AI 供應商（OpenAI、Anthropic 等）
- 同一個 Copilot SDK 實作可切換不同廠商的模型
- `Provider` 欄位用於記錄模型原始來源，但實際呼叫統一透過 Copilot SDK
- 模型切換時，僅需變更 `ModelId` 參數，無需切換實作類別

**Initial State**
- 預設填入目前 Copilot SDK 可用且啟用的模型（跨 OpenAI、Anthropic 等廠商）
- 僅標記一個模型為預設模型（建議選擇速度與準確度平衡的模型）

**Rationale**
- **跨廠商統一管理**：Copilot SDK 的多廠商支援特性，允許在單一實作中切換不同供應商模型
- **明確區分「可選模型」與「實際呼叫模型」**：避免未啟用模型被誤用
- **便於擴充**：新增模型僅需更新設定檔，無需修改程式碼
- **使用者透明**：使用者選擇模型時僅看到 `DisplayName`，無需了解底層 SDK 差異

**Consequences**
- 功能啟動時需載入模型清單
- 若預設模型失效，需能安全降級或提示使用者
- 同一個 `CopilotAIServiceProvider` 實作可支援多廠商模型切換

---

## D5. 歌詞節錄與出題策略

**Decision**  
不保存或快取完整歌詞。每次出題時，AI 即時根據歌手與歌名節錄歌詞片段作為題目。

**節錄要求**
- **最少字數**：10 字以上
- **完整性**：必須為完整句子，不可中斷
- **句數**：越少越好，以單一句子為優先
- **即時性**：每次出題時即時向 AI 請求節錄，不預先載入

**Rationale**
- **法規限制**：實際測試發現 AI 因版權與法規因素拒絕提供完整歌詞
- **即時節錄**：符合 AI 使用政策，避免大量歌詞資料快取或儲存
- **降低版權風險**：僅節錄必要片段用於遊戲互動，不保存完整歌詞內容
- **簡化資料管理**：無需設計歌詞儲存結構與快取機制

**Consequences**
- 歌單僅儲存「歌手 + 歌名」資訊於瀏覽器記憶體
- 每次出題需即時呼叫 AI 節錄歌詞片段
- 同一首歌出現多次可能節錄不同片段
- 網路延遲或 AI 服務異常會影響出題流暢度
- 不提供歷史紀錄或跨裝置存取

---

## D6. 遊戲流程控制策略

**Decision**  
遊戲流程以單一頁面狀態轉換為主，不使用跳頁或多重彈窗。

**Rationale**
- 減少操作中斷與上下文切換
- 維持遊戲節奏與連續性
- 降低 UI 狀態管理複雜度

**Consequences**
- UI 狀態需能清楚反映目前遊戲階段
- 使用者操作應能即時觸發下一步流程

---

## D7. 答案判定方式

**Decision**  
使用者輸入之答案由 AI 進行語意比對判定正確性。

**Rationale**
- 使用者可能輸入近似名稱、錯字或不同語言表達
- AI 語意比對可提供較友善的互動體驗
- 避免僅以字串完全相等判定導致誤判

**Consequences**
- 答案正確性具一定不確定性
- 回饋語句需保持簡短且不具誤導性
- 若判定失敗，可允許使用者再次嘗試或直接公佈答案

---

## D8. 答案揭露行為

**Decision**  
提供「公佈答案」按鈕，揭露正確歌名與演唱者後，立即進入下一題。

**Rationale**
- 避免使用者卡關影響體驗
- 維持遊戲節奏與可重複遊玩性

**Consequences**
- 不記錄是否「放棄」
- 公佈答案視為完成當前題目

---

## Related Documents

- `Intent.md`
- 後續產生之 spec / plan / verification 文件（若有）

---

## Appendix — Decision Notes (Optional)

（目前無）
