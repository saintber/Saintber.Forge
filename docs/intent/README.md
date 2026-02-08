# Saintber.Forge — Documentation Guide

本 README 用於說明 **Saintber.Forge 專案中 SDD（Specification-Driven Development）文件的結構、責任邊界與使用方式**，  
並提供後續維護者在撰寫需求、呼叫 Speckit 指令時的操作依據。

本文件本身不定義任何業務規則或技術決策。

---

## 文件分類與責任

本專案的文件依其角色分為下列幾類：

### Constitution
- 定義不可退讓的治理原則
- 所有文件與實作皆不得違反憲章

### Intent
- 記錄「為什麼要做這個功能」
- 保存人類對問題的理解，以及理解的演進歷史
- 不描述實作方式或技術細節

### Decision
- 記錄在特定 Intent 前提下，所做出的實作約束或設計取捨
- 僅適用於該 Intent
- 不具通用性

### Policy
- 定義長期且通用的規範（結構、安全、技術基線、測試治理等）
- 違反需有明確理由

### Plan / Spec / Verification
- 屬於實作與交付層
- 由 Speckit 依 Intent / Decision / Policy 產生
- 不屬於需求定義文件

---

## Intent 文件規則（重要）

### Intent 的定位

Intent 文件用於記錄：

- 原始利害關係人需求
- 問題定義與動機
- 功能意圖的演進過程

Intent 文件 **不是**：
- 規格書（spec）
- 實作說明
- Release Note

---

### Intent 採用「單檔、多版本紀錄」模式

每一個 Intent 以 **單一 intent.md** 存在，  
在文件內透過 **Intent Version Index** 記錄意圖的演進。

版本的意義為：
- 人類理解與需求認知的演進
- 而非實作版本或交付版本

---

### Intent 目錄結構

```text
docs/intent/
└─ <intent-id>-<intent-name>/
   ├─ intent.md
   └─ decision.md
```

範例：

```text
docs/intent/
└─ 001-portal-home/
   ├─ intent.md
   └─ decision.md
```

---

## Intent.md 大綱範例

Intent 文件應遵循下列結構（摘要）：

```md
# <Feature Name> — Intent Record

## Intent Version Index
| Version | Date | Trigger | Summary |

## Current Effective Intent
(標示目前生效版本)

## Problem Statement
## Motivation
## Stakeholders & Users
## Desired Outcome
## Assumptions & Known Constraints
## Out of Scope
## Related Documents
```

僅 **Current Effective Intent** 區段以下內容，
應被視為目前有效的意圖描述。

---

## Decision 文件規則

* 每一個 Intent 最多一份 decision.md
* 記錄該 Intent 下的實作約束與取捨
* 若內容演變為長期通用規則，應升級為 Policy

---

## Speckit 指令使用原則

### 產生憲章

```text
/speckit.constitution docs/constitution/constitution.md
```

---

### 產生規格（specify）

```text
/speckit.specify
Inputs:
- docs/intent/001-portal-home/intent.md
- docs/intent/001-portal-home/decision.md

Policies:
- docs/constitution/constitution.md
- docs/policy/project-structure.md
- docs/policy/security-baseline.md
- docs/policy/tech-baseline.md
- docs/policy/implementation-definition-of-done.md

Instruction:
- 僅使用 Current Effective Intent 作為需求基準
- 不得從歷史 Intent Version 推導需求
```

---

## Intent 與交付版本的關係說明

* Intent 的版本：

  * 描述「人類對功能的理解如何演進」
* Release / Spec 的版本：

  * 描述「實際交付了什麼」

兩者刻意分離，以避免語意混淆。

---

## 文件維護原則

* Intent 可隨理解演進而補充版本紀錄
* Decision 可被更新、撤銷或升級為 Policy
* 不再適用的 Intent 目錄應整體移除
* 文件應保持「單一責任」，避免跨類型混寫

---

本 README 僅作為文件使用與治理指引。
不作為需求、規格或實作依據。
