# Intent: Lyrics Guess Game — Intent Record

> Purpose  
> Preserve original stakeholder intent and its evolution over time.  
> This document records **human intent and understanding**, not final decisions or specifications.

> Audience  
> PM / SA / SD / Future maintainers

> Scope  
> This document does **not** define implementation details, technical decisions, or delivery scope.

---

## Intent Version Index

> The following table records **intent evolution milestones**.  
> Versions represent changes in understanding or scope recognition,  
> not implementation or release versions.

| Version | Date       | Trigger                          | Summary                                              |
|--------:|------------|----------------------------------|------------------------------------------------------|
| v1.0    | 2026-02-10 | Initial feature definition       | 定義以歌詞為基礎的猜歌互動遊戲意圖                      |

---

## Current Effective Intent

> **Effective Version:** v1.0
>  
> The sections below describe the **current effective intent** only.  
> Historical intent details are preserved in the versioned records above.

---

## 1. Problem Statement (Effective)

目前專案中缺乏一個具備娛樂性與互動性的 Tool，  
可讓使用者在不需事前準備資料、亦不需登入的情況下，  
透過自然語言與 AI 進行輕量且可重複遊玩的互動體驗。

現有功能多偏向工具性或系統入口，  
缺乏一個純粹以體驗為導向、可立即使用的互動型功能。

---

## 2. Motivation

建立「由歌詞猜歌」的遊戲，其目的在於：

- 提供即開即玩的互動體驗，不設登入門檻
- 允許使用者自行輸入歌單，不受固定題庫限制
- 利用 AI 能力降低資料準備與維護成本
- 作為展示 AI 模型差異與互動風格的實際應用案例
- 補強 Portal Home 之後的第二個實際可使用 Tool

---

## 3. Stakeholders & Users

- **一般使用者**
  - 不需登入即可直接進行遊戲
  - 希望快速體驗猜歌互動，不受帳號狀態影響
- **產品與開發人員**
  - 驗證 AI SDK 整合可行性
  - 驗證互動流程在最低門檻下的可用性與流暢度

---

## 4. Desired Outcome (Effective)

在目前理解下，Lyrics Guess Game 完成後應達成以下結果：

- 所有使用者皆可在未登入狀態下使用完整功能
- 使用者可自行輸入任意格式的歌單文字
- 系統能透過 AI 自動解析每首歌的資訊與完整歌詞
- 遊戲能隨機從歌詞中出題並提示使用者猜歌名
- 使用者可反覆作答或直接選擇公佈答案
- 每次答題結束後能立即進入下一題
- 使用者可於遊戲中選擇不同的 AI 模型進行互動
- 整體流程盡量維持在單一畫面中完成

---

## 5. User Interaction Assumptions

- 使用者輸入的歌單內容格式不固定，需由 AI 理解
- 歌單可能被多次重新輸入，並覆蓋先前解析結果
- 使用者不需建立帳號或登入即可完整體驗遊戲流程
- 使用者主要關心的是互動流暢度與趣味性，而非資料來源細節

---

## 6. Constraints & Known Boundaries

- 本功能不依賴使用者身份、權限或登入狀態
- 歌詞與歌曲資訊完全依賴 AI 推論結果
- 歌詞內容僅暫存於瀏覽器記憶體，不進行永久保存
- 不以多頁跳轉為主要互動方式
- 不與其他 Tool 共用使用者狀態或資料

---

## 7. Out of Scope (Effective)

在目前版本的 Intent 中，明確不包含：

- 使用者帳號、登入或權限相關機制
- 排行榜、積分、歷史紀錄等競賽機制
- 多人同時遊玩或對戰模式
- 歌詞或歌曲資料的長期儲存
- 音樂播放、音訊相關功能
- 版權或資料來源合法性驗證機制

---

## 8. Related Documents

- `Decision.md`（位於相同 Intent 目錄下）
- 後續產生之 spec / plan / verification 文件（若有）

---
