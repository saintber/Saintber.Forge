---
id: POL-STRUCT-001
title: Project Structure
status: active
scope: workspace
applies-to: [specify, plan, tasks, analyze, implement]
owner: saintber
supersedes: []
source: 採納時的設計 §1.3、§3、§4、§5、§6、§14.3
---

# Project Structure

> 目的：規範 Hub 與各專案的**目錄、責任邊界、依賴方向與遷出原則**。
> 本文是對**已採納設計**的忠實展開，**沒有新增設計**：每條規則標示它在設計中的出處（[快照](../../architecture/decisions/0001-attachments/design-2026-10-adopted.md)）。出處不在快照內的條文，會標為 **Proposed**，集中列在文末，**不得**僅因本檔的 `status: active` 就當成已核准。

## 規則

### R1 三層：Hub、Tool、Shared（§3.1）
- **Hub**：catalog、巢狀路由、取得並驗證工具入口包、轉交參數與結果、Hub 自身的 bootstrap 與家目錄、跨專案治理。**不負責**工具的安裝位置、安裝範圍、設定格式、執行方式、模組語意、工具狀態、工具的 PATH。
- **Tool**（`projects/<id>/`）：自己的 CLI 與 install / configure / run；自己的狀態、範圍、PATH、設定、資料；自己的 `AGENTS.md`、`.specify/`、Policy、文件、測試、套件定義。**不負責**路由到其他工具；不讀寫其他工具或 Hub 的內部檔案。
- **Shared**（`packages/`）：有 owner、版本與公開 API 的共用程式碼。**不負責**工具專屬的邏輯，也不直接被 Hub 路由呼叫。

### R2 依賴方向（§3.2）
- 工具**不得**依賴 Hub `src/` 的內部實作，也**不得**從相鄰工具的目錄載入程式（例如 `../ai-queue/src`）。
- 工具之間合法的互動只有兩種：**公開 CLI / API 契約**，以及**有版本的 Shared 套件**。
- 開發期的連結方式也必須遵守同一份契約，不能因為在同一個 repo 就走捷徑。
- Hub 只往下呼叫工具；工具不會反過來呼叫 Hub。

### R3 每個工具專案的固定結構（§5）
每個工具專案至少有：`README.md`、`AGENTS.md`、`CHANGELOG.md`、`saintber.project.json`（有入口之後）、`.specify/`、`docs/`、`specs/`、`archive/changes/`、`src/`、`tests/`。
- 套件與 solution 定義檔（`package.json`、`.sln`）放在**工具根目錄**；`src/` 內部的配置由工具依技術自訂。
- 沒有開始開發的工具只列在路線圖，**不預先建立空目錄**（§1.2）。

> **過渡期說明（事實，不是例外）**：forge-explorer 目前**沒有** `saintber.project.json` 與 `CHANGELOG.md`，因為它還沒有 saintber 入口，也還沒發佈版本。這兩項在有入口、有第一個版本時補上，見 `docs/migration-status.md`。

### R4 `workspace.json` 與 `catalog/index.json` 分工（§4.2）
- `workspace.json`：原始碼**在哪裡開發**（專案 ID、路徑、狀態、owner）。
- `catalog/index.json`：使用者的命令**指向哪個入口包**。
- 兩者不得互相推定。已遷出的工具可以只出現在 catalog；`local-dev` 類型的項目必須對應到 `workspace.json` 登錄的專案。
- 工具的流程以 `workspace.json` 找到 Hub，**不靠**往上找某個資料夾來猜測。

### R5 Shared 的建立與消費（§6）
- **建立時機**：至少有兩個實際消費者、而且需要共同演進時才建立；只是「以後可能共用」不建立。
- 每個 Shared 有明確的 owner、公開 API 文件、semver 版本、CHANGELOG；不相容的變更升 major。
- 消費者**不得**用相對路徑 import 原始碼。初期採 release tarball（在套件目錄 `npm pack`）、bundle 或 vendoring 其中一種，並在消費者的文件寫明。
- **不得**用 npm 的 git dependency 指向本 monorepo（npm 只讀 repo 根目錄的 `package.json`，會取到 Hub 套件）。
- 開發期可用 `file:` 連結，但入口包與遷出版本必須改成上述三種之一。
- Shared **不發佈到 npm**（只有 Hub 發佈 npm）；其他發佈方式以後另行決策。

### R6 套件定義（§14.1，使用者裁決）
- Hub 的根 `package.json`（`name: saintber`）是**唯一對外發佈的 npm 套件**。
- Node 工具可以有自己的 `package.json`，設為 `"private": true`，保存自己的 lockfile，不發佈到 npm。
- **不啟用 workspaces**；每個專案各自執行 `npm ci`。
- 工具的依賴只寫在自己的 `package.json`，不重複寫進根目錄或 manifest。

### R7 跨工具前置需求（§8.5）
- `requires.tools` 只是**資訊**；Hub 不自動排序或安裝前置工具。
- 實際檢查由工具透過前置工具的**公開 CLI**進行，不讀對方的內部檔案。

### R8 工具必須可遷出（憲章原則 II；§14.3）
- 遷出時必須處理的項目：Node 工具的 `package.json` 與 lockfile 可獨立 `npm ci`；Shared 依賴改為 release tarball 或 vendoring；`workspace` 類 Policy 內化、`distribution` 類 Policy 存成版本固定的快照；`$schema` 等引用指向有版本的網址；部署本地的 Spec Kit 指令與腳本；共用文件改為本地快照或有版本的網址；清除所有指向父目錄的連結。
- **不得**假設單靠 `git subtree split` 就能獨立。
- 遷出後，使用者對命令前綴與呼叫方式維持不變。

### R9 Hub 目錄（§4）
Hub 的目錄與責任依採納設計 §4、§4.1。其中 `scripts/release/` 的**目錄與責任分工**已核准（ADR-0001 決策 10）；**不包含**僅 tag 觸發、CI 完全唯讀、pack 一律憑證等強制條件。

## 與專案 Policy 的關係
專案可以加嚴，不得放寬。forge-explorer 的專屬結構規範（InnerApi / OuterApi / Frontend / Tools 等）在 `projects/forge-explorer/docs/governance/policy/project-structure.md`。

## Proposed（超出已採納設計的條文，待 owner 裁決）

目前**沒有**。本文各規則都有設計出處。
