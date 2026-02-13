# Documentation — Saintber.Forge

本目錄包含 Saintber.Forge 專案的所有正式文件。

本 README 僅作為**文件導覽與閱讀指引**，  
不定義治理規則、不描述實作細節，也不重述其他文件內容。

---

## 文件結構導覽

### Constitution
- **主要文件**: `.specify/memory/constitution.md`
- **文件副本**: `docs/constitution/constitution.md`（唯讀副本，供文件瀏覽）
- Forge 的最高治理文件  
- 定義不可退讓的原則與裁決  
- 任何結構、技術或流程文件皆不得違反本文件

---

### Policy
描述在遵守憲章前提下的實務規範與最低要求。

- `docs/policy/project-structure.md`  
  - 描述專案與目錄的實際結構配置  
  - 包含入口專案（InnerApi / OuterApi / Frontend）、Tools、Persistence 的安排方式  
  - 為「結構與參考關係」的唯一真相來源

- `docs/policy/security-baseline.md`  
  - 定義安全相關的最低基線  
  - 包含身份識別、授權、API 邊界與前端信任假設  
  - 安全為可選能力，非所有功能的強制要求

- `docs/policy/tech-baseline.md`  
  - 定義技術層面的最低基線  
  - 僅涵蓋語言、平台、版本與相容性假設  
  - 不描述結構、不描述責任、不描述安全機制

- `docs/policy/implementation-definition-of-done.md`  
  - 定義功能或工具在工程層面「完成」的最低標準  
  - 用於檢視交付品質與可維護性

---

### Intent
- `docs/intent/`
- 描述 Forge 或個別工具「為什麼存在」「要解決什麼問題」
- 用於承載動機、假設與背景，不定義實作方式

---

### Plan
- `docs/plan/`
- 描述特定階段、特定目標下的執行計畫與拆解結果
- 內容具有時效性，可能隨進度調整或淘汰

---

## Lyrics Guess Game 文件入口

- 規格與任務：`specs/002-lyrics-guess-game/`
- 服務契約：`specs/002-lyrics-guess-game/contracts/`
- 快速啟動：`specs/002-lyrics-guess-game/quickstart.md`
- Gate 驗證紀錄：`docs/plan/verification/`

---

## 建議閱讀順序

1. `.specify/memory/constitution.md`（或 `docs/constitution/constitution.md`）
2. `docs/policy/project-structure.md`
3. 視需求閱讀：
   - `docs/policy/security-baseline.md`
   - `docs/policy/tech-baseline.md`
4. 對應的 `docs/intent/*`
5. 相關的 `docs/plan/*`

---

本 README 僅提供導覽用途。  
所有治理與裁決以 `constitution.md` 為最終依據。
