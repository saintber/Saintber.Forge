# Decision: Lyrics Guess Game — Design & Policy Decisions

**Intent ID**: `002-lyrics-guess-game`  
**Related Intent**: `Intent.md`  
**Status**: Effective  
**Date**: 2026-02-10

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
所有 AI 相關能力皆透過 `copilot.sdk` 呼叫。

**Rationale**
- 統一 AI 呼叫入口，避免工具內部直接耦合特定模型或供應商
- 與既有 Forge 專案的 AI 使用策略保持一致
- 便於未來替換、擴充或停用特定 AI 模型

**Consequences**
- 功能本身不直接依賴 OpenAI、Azure OpenAI 或其他 SDK
- AI 能力視為外部服務，由 SDK 層負責抽象與錯誤處理

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
- 切換模型不影響已暫存的歌詞資料

---

## D4. AI 模型資料來源設計

**Decision**  
AI 模型資訊以結構化資料來源管理，而非硬編碼於程式中。

**Minimum Fields**
- 模型名稱（Display Name）
- AI 廠商（Vendor）
- AI 模型識別碼（Model）
- 是否為預設模型（IsDefault）
- 是否啟用中（IsEnabled）

**Initial State**
- 預設填入目前 Copilot 可用且啟用的模型
- 僅標記一個模型為預設模型

**Rationale**
- 明確區分「可選模型」與「實際呼叫模型」
- 避免未啟用模型被誤用
- 便於後續調整預設值而不影響程式邏輯

**Consequences**
- 功能啟動時需載入模型清單
- 若預設模型失效，需能安全降級或提示使用者

---

## D5. 歌單與歌詞資料儲存策略

**Decision**  
所有歌單解析結果與完整歌詞僅儲存於瀏覽器記憶體中。

**Rationale**
- 歌詞屬於即時遊戲資料，不具備長期保存需求
- 避免後端儲存與版權相關風險
- 降低系統複雜度與基礎設施需求

**Consequences**
- 重新整理頁面即清空資料
- 不提供歷史紀錄或跨裝置存取
- 不需設計後端資料模型

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
